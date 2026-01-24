// app/api/debug/route.ts
import { NextResponse } from 'next/server';

// ✅ Critical: Use Node.js runtime to access private env vars
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY ? '✅ SET' : '❌ UNDEFINED',
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ? '✅ SET' : '❌ UNDEFINED',
    LIVEKIT_URL: process.env.LIVEKIT_URL ? '✅ SET' : '❌ UNDEFINEDb',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
  });
}