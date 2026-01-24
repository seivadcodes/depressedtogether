// app/api/livekit/token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { AccessToken } from 'livekit-server-sdk';

export const dynamic = 'force-dynamic'; // 👈 Keep this

export async function POST(req: NextRequest) {
  try {
    // ✅ Move env check INSIDE the handler — runs at request time, not build time
    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET) {
      console.error('LiveKit API key or secret missing at runtime');
      return NextResponse.json(
        { error: 'Server misconfigured: LiveKit credentials missing' },
        { status: 500 }
      );
    }

    const { room, identity: userId, name } = await req.json();

    if (!room || !userId || typeof name !== 'string') {
      return NextResponse.json({ error: 'Missing room, identity, or valid name' }, { status: 400 });
    }

    const supabase = createClient();
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    const displayName = name || profile.full_name || 'Anonymous';

    const at = new AccessToken(
      process.env.LIVEKIT_API_KEY!,
      process.env.LIVEKIT_API_SECRET!,
      {
        identity: userId,
        name: displayName,
        ttl: '10m',
      }
    );

    at.addGrant({
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    return NextResponse.json({ token });
  } catch (err) {
    console.error('LiveKit token generation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}