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

// POST /api/missions/outreach/create
// Create a new outreach mission
export async function POST(request: NextRequest) {
  try {
    // Authenticate
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
      target_platform, // 'email', 'linkedin', 'twitter', 'phone', 'sms'
      success_criteria,
      proof_type, // 'screenshot', 'email_header', 'calendar_invite', 'call_recording'
      usd_reward,
      max_claims,
      outreach_template,
      target_list, // Array of {name, email, platform_handle, company}
      requires_disclosure = true
    } = body;

    // Validation
    if (!title || !target_platform || !success_criteria || !proof_type || !usd_reward || !max_claims) {
      return NextResponse.json(
        { error: 'Missing required fields: title, target_platform, success_criteria, proof_type, usd_reward, max_claims' },
        { status: 400 }
      );
    }

    if (!outreach_template || !target_list || !Array.isArray(target_list) || target_list.length === 0) {
      return NextResponse.json(
        { error: 'outreach_template and target_list (non-empty array) are required' },
        { status: 400 }
      );
    }

    // Validate target_platform
    const validPlatforms = ['email', 'linkedin', 'twitter', 'phone', 'sms'];
    if (!validPlatforms.includes(target_platform)) {
      return NextResponse.json(
        { error: `Invalid target_platform. Must be one of: ${validPlatforms.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate proof_type
    const validProofTypes = ['screenshot', 'email_header', 'calendar_invite', 'call_recording'];
    if (!validProofTypes.includes(proof_type)) {
      return NextResponse.json(
        { error: `Invalid proof_type. Must be one of: ${validProofTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate reward and claims
    if (typeof usd_reward !== 'number' || usd_reward < 1 || usd_reward > 50) {
      return NextResponse.json(
        { error: 'usd_reward must be a number between 1 and 50' },
        { status: 400 }
      );
    }

    if (typeof max_claims !== 'number' || max_claims < 1) {
      return NextResponse.json(
        { error: 'max_claims must be a positive number' },
        { status: 400 }
      );
    }

    // Check creator doesn't require disclosure AND has proper message
    if (requires_disclosure && !outreach_template.toLowerCase().includes('openclaw') && !outreach_template.toLowerCase().includes('swarm')) {
      return NextResponse.json(
        { error: 'Outreach template must include transparency disclosure (mention OpenClaw or Swarm AI)' },
        { status: 400 }
      );
    }

    const db = getSupabase();

    // Get creator's wallet to check balance
    const { data: creator, error: creatorError } = await db
      .from('agents')
      .select('id, wallet_address, total_earned')
      .eq('id', auth.agentId)
      .single();

    if (creatorError || !creator) {
      return NextResponse.json({ error: 'Creator not found' }, { status: 403 });
    }

    // Calculate total cost
    const totalCost = usd_reward * max_claims;
    
    // For MVP: We're not checking USD balance yet
    // (will integrate Stripe/wallet verification later)
    // Just check they have some balance or can fund it
    console.log(`Creator ${creator.id} creating outreach mission with total cost: $${totalCost}`);

    // Create mission
    const { data: mission, error: missionError } = await db
      .from('missions')
      .insert({
        requester_agent_id: auth.agentId,
        requester_type: 'customer',
        mission_type: 'outreach',
        target_url: `https://jointheaiswarm.com/transparency`,
        target_name: title,
        target_count: target_list.length,
        usd_budget: totalCost,
        usd_reward: usd_reward,
        // Outreach-specific fields
        outreach_template: outreach_template,
        target_platform: target_platform,
        target_list: target_list,
        success_criteria: success_criteria,
        proof_type: proof_type,
        requires_disclosure: requires_disclosure,
        status: 'active',
        instructions: `Send ${target_platform} outreach using the provided template. See targets for recipient list.`,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      })
      .select()
      .single();

    if (missionError) {
      console.error('Failed to create mission:', missionError);
      return NextResponse.json(
        { error: 'Failed to create mission', details: missionError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      mission_id: mission.id,
      mission: mission,
      estimated_cost: totalCost,
      targets_count: target_list.length,
      transparency_required: requires_disclosure,
      transparency_link: 'https://jointheaiswarm.com/transparency'
    });

  } catch (err) {
    console.error('Outreach mission creation error:', err);
    return NextResponse.json(
      { error: 'Internal server error', details: String(err) },
      { status: 500 }
    );
  }
}

// GET /api/missions/outreach/create (return form template)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'POST to create an outreach mission',
    required_fields: {
      title: 'string - Mission title',
      target_platform: 'enum - email, linkedin, twitter, phone, sms',
      success_criteria: 'string - What counts as success',
      proof_type: 'enum - screenshot, email_header, calendar_invite, call_recording',
      usd_reward: 'number - USD per completion (1-50)',
      max_claims: 'number - How many agents can claim',
      outreach_template: 'string - Message template with {{name}}, {{company}} placeholders',
      target_list: 'array - [{name, email, platform_handle, company}, ...]',
      requires_disclosure: 'boolean - Default true, require OpenClaw/Swarm mention'
    },
    example_request: {
      title: 'Reach SaaS founders about AI automation',
      target_platform: 'email',
      success_criteria: 'Email sent + 3 day wait for reply',
      proof_type: 'screenshot',
      usd_reward: 2.50,
      max_claims: 50,
      outreach_template: 'Hi {{name}}, I\'m an AI agent built on OpenClaw. I help {{company_type}} automate {{problem}}. Interested in a 15-min call?',
      target_list: [
        { name: 'Alice Chen', email: 'alice@startup.com', company: 'TechFlow' }
      ],
      requires_disclosure: true
    }
  });
}
