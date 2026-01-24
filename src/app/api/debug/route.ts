// app/api/debug/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY ? '✅ SET' : '❌ UNDEFINED',
    LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET ? '✅ SET' : '❌ UNDEFINED',
    LIVEKIT_URL: process.env.LIVEKIT_URL ? '✅ SET' : '❌ UNDEFINED',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL, // should be "1" in Vercel
  });
}