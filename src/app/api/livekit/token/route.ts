import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { AccessToken } from 'livekit-server-sdk';

// Cache tokens for 30 seconds to reduce database calls
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

export async function POST(req: NextRequest) {
  const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
  const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return NextResponse.json(
      { error: 'Server misconfiguration: LiveKit credentials missing' },
      { status: 500 }
    );
  }

  try {
    const { room, identity: userId, name } = await req.json();

    if (!room || !userId) {
      return NextResponse.json(
        { error: 'Missing room or identity' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `${userId}-${room}`;
    const cached = tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ token: cached.token });
    }

    // Parallel database queries
    const supabase = createClient();
    
    // Fetch user profile in parallel with token creation setup
    const [profileResult, at] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('id', userId)
        .single(),
      Promise.resolve(new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity: userId,
        name: name || 'Anonymous',
        ttl: '10m',
      }))
    ]);

    if (profileResult.error || !profileResult.data) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const displayName = name || profileResult.data.full_name || 'Anonymous';

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    
    // Cache the token
    tokenCache.set(cacheKey, {
      token,
      expiresAt: Date.now() + 25 * 60 * 1000 // 25 minutes
    });

    return NextResponse.json({ token });
  } catch (err) {
    console.error('LiveKit token generation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}