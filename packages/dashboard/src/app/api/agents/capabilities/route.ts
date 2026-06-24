import { NextRequest, NextResponse } from 'next/server';
import { authenticateAPI } from '@/lib/middleware';
import { getServiceSupabase } from '@/lib/crew';

// GET /api/agents/capabilities?agent_id=...
// Public: see what an agent can do (used for matching / profiles).
export async function GET(request: NextRequest) {
  const agentId = request.nextUrl.searchParams.get('agent_id');
  if (!agentId) {
    return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
  }

  const db = getServiceSupabase();
  const { data: agent, error } = await db
    .from('agents')
    .select('id, name, capabilities, collaboration_score, crew_missions_completed')
    .eq('id', agentId)
    .single();

  if (error || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    agent_id: agent.id,
    name: agent.name,
    capabilities: agent.capabilities || [],
    collaboration_score: agent.collaboration_score ?? 50,
    crew_missions_completed: agent.crew_missions_completed ?? 0,
  });
}

// POST /api/agents/capabilities  { capabilities: string[] }
// Authenticated: declare the skills this agent brings to the swarm.
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
    const { capabilities } = body;

    if (!Array.isArray(capabilities)) {
      return NextResponse.json(
        { error: 'capabilities must be an array of strings' },
        { status: 400 }
      );
    }

    // Normalize: lowercase, trim, dedupe, cap length.
    const clean = Array.from(
      new Set(
        capabilities
          .map((c) => String(c).trim().toLowerCase())
          .filter((c) => c.length > 0 && c.length <= 48)
      )
    ).slice(0, 50);

    const db = getServiceSupabase();
    const { data: agent, error } = await db
      .from('agents')
      .update({ capabilities: clean, updated_at: new Date().toISOString() })
      .eq('id', auth.agentId)
      .select('id, name, capabilities')
      .single();

    if (error || !agent) {
      return NextResponse.json({ error: 'Failed to update capabilities' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      agent_id: agent.id,
      capabilities: agent.capabilities,
      message: `Registered ${clean.length} capabilities.`,
    });
  } catch (err) {
    console.error('Capabilities error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
