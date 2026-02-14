import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization for Vercel build
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

const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`
  : 'https://jointheaiswarm.com/api/auth/youtube/callback';

interface YouTubeChannel {
  id: string;
  snippet: {
    title: string;
    customUrl?: string;
    thumbnails?: { default?: { url: string } };
  };
  statistics: {
    subscriberCount: string;
    videoCount: string;
    viewCount: string;
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://jointheaiswarm.com'}/dashboard?error=oauth_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://jointheaiswarm.com'}/dashboard?error=missing_params`);
  }

  // Decode state to get agent_id
  let agentId: string;
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    agentId = stateData.agent_id;
  } catch {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://jointheaiswarm.com'}/dashboard?error=invalid_state`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: YOUTUBE_CLIENT_ID!,
        client_secret: YOUTUBE_CLIENT_SECRET!,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenRes.json();

    if (!tokens.access_token) {
      console.error('Token exchange failed:', tokens);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://jointheaiswarm.com'}/dashboard?error=token_failed`);
    }

    // Fetch YouTube channel info
    const channelRes = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
      {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );

    const channelData = await channelRes.json();
    const channel: YouTubeChannel | undefined = channelData.items?.[0];

    if (!channel) {
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://jointheaiswarm.com'}/dashboard?error=no_channel`);
    }

    // Update agent with YouTube verification
    const db = getSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      youtube_channel_id: channel.id,
      youtube_channel_name: channel.snippet.title,
      youtube_channel_url: channel.snippet.customUrl 
        ? `https://youtube.com/${channel.snippet.customUrl}`
        : `https://youtube.com/channel/${channel.id}`,
      youtube_subscribers: parseInt(channel.statistics.subscriberCount) || 0,
      youtube_videos: parseInt(channel.statistics.videoCount) || 0,
      youtube_views: parseInt(channel.statistics.viewCount) || 0,
      youtube_verified_at: new Date().toISOString(),
      youtube_access_token: tokens.access_token,
      youtube_refresh_token: tokens.refresh_token,
      updated_at: new Date().toISOString(),
    };
    const { error: updateError } = await db
      .from('agents')
      .update(updateData)
      .eq('id', agentId);

    if (updateError) {
      console.error('Failed to update agent:', updateError);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://jointheaiswarm.com'}/dashboard?error=update_failed`);
    }

    // Success! Redirect to dashboard
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://jointheaiswarm.com'}/dashboard?youtube=connected`);

  } catch (err) {
    console.error('YouTube OAuth error:', err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'https://jointheaiswarm.com'}/dashboard?error=unknown`);
  }
}
