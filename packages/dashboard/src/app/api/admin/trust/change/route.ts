import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !key) {
      throw new Error('Missing Supabase configuration');
    }

    supabase = createClient(url, key);
  }
  return supabase;
}

const VALID_TIERS = ['trusted', 'normal', 'probation', 'blacklist', 'banned'];

export async function POST(request: NextRequest) {
  try {
    // Authenticate via Bearer token or session cookie
    const auth = await requireAuth(request);
    if (!auth.authenticated || !auth.agentId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const db = getSupabase();

    // Trust tier changes are admin-only
    const { data: actor } = await db
      .from('agents')
      .select('is_admin')
      .eq('id', auth.agentId)
      .single();

    if (actor?.is_admin !== true) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { agent_id, new_tier, reason } = await request.json();

    if (!agent_id || !new_tier || !reason) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!VALID_TIERS.includes(new_tier)) {
      return NextResponse.json(
        { success: false, error: `Invalid trust tier. Must be one of: ${VALID_TIERS.join(', ')}` },
        { status: 400 }
      );
    }

    // Fetch the current tier for the audit record
    const { data: target, error: targetError } = await db
      .from('agents')
      .select('id, trust_tier')
      .eq('id', agent_id)
      .single();

    if (targetError || !target) {
      return NextResponse.json(
        { success: false, error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Update the agent's trust tier
    const { error } = await db
      .from('agents')
      .update({
        trust_tier: new_tier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agent_id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Audit log — every trust change records actor, old/new tier, reason
    const { error: auditError } = await db.from('trust_history').insert({
      agent_id,
      changed_by: auth.agentId,
      old_tier: target.trust_tier || 'normal',
      new_tier,
      reason,
    });

    if (auditError) {
      console.error('Trust tier updated but audit logging FAILED:', auditError);
      return NextResponse.json(
        {
          success: false,
          error:
            'Trust tier was updated but audit logging failed. Apply migrations/004_trust_history.sql.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      agent_id,
      old_tier: target.trust_tier || 'normal',
      new_tier,
    });
  } catch (error) {
    console.error('Trust change error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to change trust tier' },
      { status: 500 }
    );
  }
}
