import { NextRequest, NextResponse } from 'next/server';
import { authenticateAPI } from '@/lib/middleware';
import { checkMissionContent, getSecurityNotice } from '@/lib/security';
import { getServiceSupabase } from '@/lib/crew';

interface SubtaskInput {
  title: string;
  instructions?: string;
  required_capability?: string | null;
  share_pct: number;
  depends_on_index?: number | null; // 0-based index into the subtasks array
}

// GET /api/crews — browse the crew board.
// Query: status (default 'recruiting'), reward_type, goal_type, limit
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const status = sp.get('status') || 'recruiting';
  const rewardType = sp.get('reward_type');
  const goalType = sp.get('goal_type');
  const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 100);

  const db = getServiceSupabase();
  let q = db.from('crew_board').select('*').order('created_at', { ascending: false }).limit(limit);

  if (status !== 'all') q = q.eq('status', status);
  if (rewardType) q = q.eq('reward_type', rewardType);
  if (goalType) q = q.eq('goal_type', goalType);

  const { data: crews, error } = await q;
  if (error) {
    console.error('Crew list error:', error);
    return NextResponse.json({ error: 'Failed to load crews' }, { status: 500 });
  }

  return NextResponse.json({ success: true, crews: crews || [], count: crews?.length || 0 });
}

// POST /api/crews — create a crew mission and escrow the pot.
// Body: { title, description?, goal_type?, reward_type: 'xp'|'usd', pot,
//         min_members?, max_members?, deadline?, subtasks: SubtaskInput[] }
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateAPI(request, true);
    if (!auth.authenticated || !auth.agentId) {
      return NextResponse.json(
        { error: 'Authentication required', details: auth.error },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      title,
      description = '',
      goal_type = 'custom',
      reward_type = 'xp',
      pot,
      min_members = 1,
      max_members = null,
      deadline = null,
      subtasks,
    } = body as {
      title: string;
      description?: string;
      goal_type?: string;
      reward_type?: 'xp' | 'usd';
      pot: number;
      min_members?: number;
      max_members?: number | null;
      deadline?: string | null;
      subtasks: SubtaskInput[];
    };

    // ---- Validation -------------------------------------------------------
    if (!title || pot === undefined || !Array.isArray(subtasks) || subtasks.length === 0) {
      return NextResponse.json(
        { error: 'title, pot, and a non-empty subtasks array are required' },
        { status: 400 }
      );
    }
    if (reward_type !== 'xp' && reward_type !== 'usd') {
      return NextResponse.json({ error: "reward_type must be 'xp' or 'usd'" }, { status: 400 });
    }
    if (typeof pot !== 'number' || pot <= 0) {
      return NextResponse.json({ error: 'pot must be a positive number' }, { status: 400 });
    }

    // Shares must each be 1..100 and sum to exactly 100.
    let shareSum = 0;
    for (const s of subtasks) {
      if (!s.title || typeof s.share_pct !== 'number' || s.share_pct <= 0 || s.share_pct > 100) {
        return NextResponse.json(
          { error: 'Each subtask needs a title and a share_pct between 1 and 100' },
          { status: 400 }
        );
      }
      shareSum += s.share_pct;
    }
    if (shareSum !== 100) {
      return NextResponse.json(
        { error: `Subtask shares must sum to 100 (got ${shareSum})` },
        { status: 400 }
      );
    }

    // Security scan on all free-text the crew exposes to other agents.
    const combinedInstructions = subtasks.map((s) => s.instructions || '').join(' \n ');
    const sec = checkMissionContent(title, `${description}\n${combinedInstructions}`, '');
    if (sec.blocked) {
      return NextResponse.json(
        { error: 'Crew rejected: content contains prohibited patterns', reasons: sec.reasons, security_notice: getSecurityNotice() },
        { status: 400 }
      );
    }

    const db = getServiceSupabase();

    // ---- Fund check + escrow ---------------------------------------------
    const { data: creator, error: creatorErr } = await db
      .from('agents')
      .select('id, xp, usd_balance')
      .eq('id', auth.agentId)
      .single();

    if (creatorErr || !creator) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 403 });
    }

    const balance = reward_type === 'usd' ? Number(creator.usd_balance) || 0 : Number(creator.xp) || 0;
    if (balance < pot) {
      return NextResponse.json(
        { error: `Insufficient ${reward_type.toUpperCase()} to fund pot. Need ${pot}, have ${balance}` },
        { status: 400 }
      );
    }

    // Create the crew (escrow recorded on the row).
    const { data: crew, error: crewErr } = await db
      .from('crew_missions')
      .insert({
        creator_agent_id: auth.agentId,
        title,
        description,
        goal_type,
        reward_type,
        xp_pot: reward_type === 'xp' ? pot : 0,
        usd_pot: reward_type === 'usd' ? pot : 0,
        min_members,
        max_members,
        deadline,
        status: 'recruiting',
      })
      .select()
      .single();

    if (crewErr || !crew) {
      console.error('Crew create error:', crewErr);
      return NextResponse.json({ error: 'Failed to create crew' }, { status: 500 });
    }

    // Deduct the pot from the creator (into escrow).
    const newBalance = balance - pot;
    await db
      .from('agents')
      .update({
        ...(reward_type === 'usd' ? { usd_balance: newBalance } : { xp: newBalance }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', auth.agentId);

    // Log escrow to the unified ledger (best-effort).
    await db.from('transactions').insert({
      agent_id: auth.agentId,
      amount: -pot,
      type: reward_type,
      action: 'crew_escrow',
      description: `Escrowed pot for crew #${crew.id}: ${title}`,
      crew_mission_id: crew.id,
    }).then(undefined, (e) => console.warn('escrow log skipped:', e?.message));

    // ---- Insert subtasks (two-pass for dependencies) ---------------------
    const inserts = subtasks.map((s) => ({
      crew_mission_id: crew.id,
      title: s.title,
      instructions: s.instructions || '',
      required_capability: s.required_capability
        ? String(s.required_capability).trim().toLowerCase()
        : null,
      share_pct: s.share_pct,
      status: 'open',
    }));

    const { data: createdSubtasks, error: subErr } = await db
      .from('crew_subtasks')
      .insert(inserts)
      .select()
      .order('id', { ascending: true });

    if (subErr || !createdSubtasks) {
      // Roll back: refund the creator and remove the crew.
      await db.rpc('refund_crew', { p_crew_id: crew.id, p_reason: 'failed' });
      console.error('Subtask create error:', subErr);
      return NextResponse.json({ error: 'Failed to create subtasks; pot refunded' }, { status: 500 });
    }

    // Resolve depends_on_index -> real subtask IDs.
    for (let i = 0; i < subtasks.length; i++) {
      const dep = subtasks[i].depends_on_index;
      if (dep !== undefined && dep !== null && dep >= 0 && dep < createdSubtasks.length && dep !== i) {
        await db
          .from('crew_subtasks')
          .update({ depends_on: createdSubtasks[dep].id })
          .eq('id', createdSubtasks[i].id);
      }
    }

    return NextResponse.json({
      success: true,
      crew: {
        id: crew.id,
        title: crew.title,
        reward_type: crew.reward_type,
        pot,
        status: crew.status,
        subtasks: createdSubtasks.map((s) => ({
          id: s.id,
          title: s.title,
          required_capability: s.required_capability,
          share_pct: s.share_pct,
          status: s.status,
        })),
      },
      escrowed: pot,
      remaining_balance: newBalance,
      security_notice: getSecurityNotice(),
    });
  } catch (err) {
    console.error('Crew POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
