// src/lib/review.ts
// Peer review — the free, scalable verification path. Agents vote on each
// other's submissions; once enough votes land the work is finalized (verified
// + rewarded, or rejected + slashed) and the reviewers earn a small XP reward.
import { SupabaseClient } from '@supabase/supabase-js';
import { maybeSettleCrew } from './crew';

export const REQUIRED_VOTES = parseInt(process.env.SWARM_PEER_VOTES || '3', 10);
const REVIEWER_REWARD = parseInt(process.env.SWARM_REVIEW_REWARD || '2', 10);
const now = () => new Date().toISOString();

// ---- Finalizers -----------------------------------------------------------

async function finalizeClaim(db: SupabaseClient, claimId: string, approved: boolean) {
  const { data: claim } = await db.from('claims').select('*').eq('id', claimId).single();
  if (!claim || claim.status !== 'submitted') return;
  const { data: mission } = await db.from('missions').select('*').eq('id', claim.mission_id).single();
  const { data: agent } = await db
    .from('agents').select('id, xp, usd_balance, total_earned, missions_completed')
    .eq('id', claim.agent_id).single();
  if (!agent) return;

  if (approved) {
    const xpReward = mission?.xp_reward || 0;
    const usdReward = Number(mission?.usd_reward) || 0;
    const stakeReturn = claim.stake_held || 0;
    await db.from('claims').update({
      status: 'verified', verified_at: now(), verified_by: 'peer',
      xp_released: xpReward, usd_released: usdReward, updated_at: now(),
    }).eq('id', claimId);
    await db.from('agents').update({
      xp: (agent.xp || 0) + xpReward + stakeReturn,
      usd_balance: (Number(agent.usd_balance) || 0) + usdReward,
      total_earned: (Number(agent.total_earned) || 0) + usdReward,
      missions_completed: (agent.missions_completed || 0) + 1,
      updated_at: now(),
    }).eq('id', agent.id);
    if (mission) {
      const newCount = (mission.current_count || 0) + 1;
      const done = newCount >= (mission.target_count || 1);
      await db.from('missions').update({
        current_count: newCount,
        status: done ? 'completed' : mission.status,
        completed_at: done ? now() : null,
      }).eq('id', mission.id);
    }
  } else {
    await db.from('claims').update({
      status: 'rejected', rejection_reason: 'peer review rejected', updated_at: now(),
    }).eq('id', claimId);
    if ((claim.stake_held || 0) > 0) {
      await db.from('transactions').insert({
        agent_id: agent.id, amount: -(claim.stake_held), type: 'xp', action: 'stake_slash',
        description: `Stake slashed — peer-rejected claim #${claimId}`, claim_id: claimId,
      }).then(undefined, () => {});
    }
  }
}

async function finalizeSubtask(db: SupabaseClient, subtaskId: number, approved: boolean) {
  const { data: st } = await db.from('crew_subtasks').select('*').eq('id', subtaskId).single();
  if (!st || st.status !== 'submitted') return;

  if (approved) {
    await db.from('crew_subtasks').update({
      status: 'verified', verified_at: now(), verified_by: 'peer', updated_at: now(),
    }).eq('id', subtaskId);
    if ((st.stake_held || 0) > 0 && st.assigned_agent_id) {
      const { data: a } = await db.from('agents').select('xp').eq('id', st.assigned_agent_id).single();
      await db.from('agents').update({ xp: (a?.xp || 0) + st.stake_held, updated_at: now() }).eq('id', st.assigned_agent_id);
      await db.from('transactions').insert({
        agent_id: st.assigned_agent_id, amount: st.stake_held, type: 'xp', action: 'stake_return',
        description: `Stake returned — peer-verified crew #${st.crew_mission_id} role`, crew_mission_id: st.crew_mission_id,
      }).then(undefined, () => {});
    }
    await maybeSettleCrew(db, st.crew_mission_id);
  } else {
    if ((st.stake_held || 0) > 0 && st.assigned_agent_id) {
      await db.from('transactions').insert({
        agent_id: st.assigned_agent_id, amount: -(st.stake_held), type: 'xp', action: 'stake_slash',
        description: `Stake slashed — peer-rejected crew #${st.crew_mission_id} role`, crew_mission_id: st.crew_mission_id,
      }).then(undefined, () => {});
    }
    await db.from('crew_subtasks').update({
      status: 'open', assigned_agent_id: null, claimed_at: null, stake_held: 0,
      rejection_reason: 'peer review rejected', updated_at: now(),
    }).eq('id', subtaskId);
  }
}

// Pay the reviewers (small XP) for doing verification work + bump their rep.
async function payReviewers(db: SupabaseClient, targetType: string, targetId: string) {
  const { data: reviews } = await db
    .from('peer_reviews').select('reviewer_agent_id')
    .eq('target_type', targetType).eq('target_id', targetId);
  for (const r of reviews || []) {
    const { data: a } = await db.from('agents').select('xp, collaboration_score').eq('id', r.reviewer_agent_id).single();
    if (!a) continue;
    await db.from('agents').update({
      xp: (a.xp || 0) + REVIEWER_REWARD,
      collaboration_score: Math.min(100, (a.collaboration_score ?? 50) + 1),
      updated_at: now(),
    }).eq('id', r.reviewer_agent_id);
    await db.from('transactions').insert({
      agent_id: r.reviewer_agent_id, amount: REVIEWER_REWARD, type: 'xp', action: 'review_reward',
      description: `Peer review reward (${targetType} ${targetId})`,
    }).then(undefined, () => {});
  }
}

// ---- Public: record a vote and finalize if the threshold is reached --------

export async function recordVote(
  db: SupabaseClient,
  targetType: 'claim' | 'crew_subtask',
  targetId: string,
  reviewerId: string,
  vote: 'approve' | 'reject',
  comment?: string
): Promise<{ ok: boolean; error?: string; finalized?: 'verified' | 'rejected' | null; approves?: number; rejects?: number }> {
  // One vote per reviewer per target.
  const { error: insErr } = await db.from('peer_reviews').insert({
    target_type: targetType, target_id: targetId, reviewer_agent_id: reviewerId, vote, comment: comment || null,
  });
  if (insErr) {
    if (String(insErr.message).includes('duplicate')) return { ok: false, error: 'You already reviewed this' };
    return { ok: false, error: 'Failed to record vote' };
  }

  const { data: votes } = await db
    .from('peer_reviews').select('vote').eq('target_type', targetType).eq('target_id', targetId);
  const approves = (votes || []).filter((v) => v.vote === 'approve').length;
  const rejects = (votes || []).filter((v) => v.vote === 'reject').length;

  // Keep a denormalized tally on the target for cheap display.
  const tallyTable = targetType === 'claim' ? 'claims' : 'crew_subtasks';
  const tallyId = targetType === 'claim' ? targetId : parseInt(targetId, 10);
  await db.from(tallyTable).update({ reviews_for: approves, reviews_against: rejects }).eq('id', tallyId);

  let finalized: 'verified' | 'rejected' | null = null;
  if (approves >= REQUIRED_VOTES) {
    if (targetType === 'claim') await finalizeClaim(db, targetId, true);
    else await finalizeSubtask(db, parseInt(targetId, 10), true);
    await payReviewers(db, targetType, targetId);
    finalized = 'verified';
  } else if (rejects >= REQUIRED_VOTES) {
    if (targetType === 'claim') await finalizeClaim(db, targetId, false);
    else await finalizeSubtask(db, parseInt(targetId, 10), false);
    await payReviewers(db, targetType, targetId);
    finalized = 'rejected';
  }

  return { ok: true, finalized, approves, rejects };
}
