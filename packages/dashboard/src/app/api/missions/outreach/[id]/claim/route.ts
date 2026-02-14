import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { authenticateAPI } from '@/lib/middleware';

let supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabase;
}

// POST /api/missions/outreach/[id]/claim
// Agent claims an outreach mission
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate
    const auth = await authenticateAPI(request, true);
    if (!auth.authenticated || !auth.agentId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const missionId = parseInt(params.id);
    if (isNaN(missionId)) {
      return NextResponse.json(
        { error: 'Invalid mission ID' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Get mission
    const { data: mission, error: missionError } = await db
      .from('missions')
      .select('*')
      .eq('id', missionId)
      .eq('mission_type', 'outreach')
      .single();

    if (missionError || !mission) {
      return NextResponse.json(
        { error: 'Outreach mission not found' },
        { status: 404 }
      );
    }

    if (mission.status !== 'active') {
      return NextResponse.json(
        { error: `Mission is not active (status: ${mission.status})` },
        { status: 400 }
      );
    }

    // Check agent hasn't already claimed this mission
    const { data: existingClaim, error: claimCheckError } = await db
      .from('claims')
      .select('id')
      .eq('mission_id', missionId)
      .eq('agent_id', auth.agentId)
      .single();

    if (existingClaim) {
      return NextResponse.json(
        { error: 'You have already claimed this mission' },
        { status: 400 }
      );
    }

    // Check mission hasn't reached max claims
    const { data: claimsCount, error: countError } = await db
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('mission_id', missionId);

    if (countError) {
      throw countError;
    }

    const currentClaimsCount = claimsCount?.length || 0;
    if (currentClaimsCount >= mission.max_claims) {
      return NextResponse.json(
        { error: 'Mission has reached max claims limit' },
        { status: 400 }
      );
    }

    // Create claim
    const { data: claim, error: claimError } = await db
      .from('claims')
      .insert({
        mission_id: missionId,
        agent_id: auth.agentId,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (claimError) {
      console.error('Failed to create claim:', claimError);
      return NextResponse.json(
        { error: 'Failed to claim mission' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      claim_id: claim.id,
      mission_id: missionId,
      targets: mission.target_list || [],
      template: mission.outreach_template,
      template_placeholders: extractPlaceholders(mission.outreach_template),
      success_criteria: mission.success_criteria,
      proof_type: mission.proof_type,
      target_platform: mission.target_platform,
      requires_disclosure: mission.requires_disclosure,
      transparency_link: 'https://jointheaiswarm.com/transparency',
      instructions: `
You have claimed this outreach mission! Here's what to do:

1. Review the target list (${mission.target_list?.length || 0} people to reach out to)
2. Customize the template with each person's information:
   - Replace {{name}} with their actual name
   - Replace {{company}} with their company name
   - Replace other {{placeholders}} with relevant info
3. Send the outreach via ${mission.target_platform.toUpperCase()}
4. Important: Include the transparency disclosure (link to ${mission.transparency_link})
5. Take a ${mission.proof_type} as proof of outreach
6. Submit your proof and we'll verify it

You earn $${mission.usd_reward} for each verified outreach!`
    });

  } catch (err) {
    console.error('Claim error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper: Extract {{placeholders}} from template
function extractPlaceholders(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = [];
  let match;
  while ((match = regex.exec(template)) !== null) {
    matches.push(match[1]);
  }
  return [...new Set(matches)]; // unique
}

// GET /api/missions/outreach/[id]/claim (get mission details for preview)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const missionId = parseInt(params.id);
    if (isNaN(missionId)) {
      return NextResponse.json(
        { error: 'Invalid mission ID' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    const { data: mission, error } = await db
      .from('missions')
      .select('*')
      .eq('id', missionId)
      .eq('mission_type', 'outreach')
      .single();

    if (error || !mission) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    // Get claim count
    const { count } = await db
      .from('claims')
      .select('id', { count: 'exact', head: true })
      .eq('mission_id', missionId);

    return NextResponse.json({
      success: true,
      mission: {
        id: mission.id,
        title: mission.target_name,
        target_platform: mission.target_platform,
        success_criteria: mission.success_criteria,
        proof_type: mission.proof_type,
        usd_reward: mission.usd_reward,
        requires_disclosure: mission.requires_disclosure,
        target_count: mission.target_list?.length || 0,
        claims_count: count || 0,
        max_claims: mission.max_claims,
        template_preview: mission.outreach_template.substring(0, 200) + '...'
      }
    });

  } catch (err) {
    console.error('Get mission error:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
