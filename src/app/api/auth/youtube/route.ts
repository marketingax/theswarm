import { NextRequest, NextResponse } from 'next/server';

// YouTube OAuth configuration
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/youtube/callback`
  : 'https://jointheaiswarm.com/api/auth/youtube/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

// Start OAuth flow - redirect to Google
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get('agent_id');

  if (!agentId) {
    return NextResponse.json({ error: 'agent_id required' }, { status: 400 });
  }

  if (!YOUTUBE_CLIENT_ID) {
    return NextResponse.json({ error: 'YouTube OAuth not configured' }, { status: 500 });
  }

  // Build OAuth URL
  const state = Buffer.from(JSON.stringify({ agent_id: agentId, ts: Date.now() })).toString('base64');
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', YOUTUBE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  return NextResponse.redirect(authUrl.toString());
}
