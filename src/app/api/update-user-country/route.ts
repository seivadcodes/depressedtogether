// src/app/api/update-user-country/route.ts
import { createClient } from '@supabase/supabase-js';
import { type NextRequest } from 'next/server';

// Use anon key + cookies — lets Supabase infer the user from the session
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: { headers: { Authorization: '' } }, // will be overridden by cookie
  }
);

export async function POST(request: NextRequest) {
  // Get user ID from client (you already have it via useAuth)
  const { user_id } = await request.json();

  if (!user_id || typeof user_id !== 'string') {
    return Response.json({ error: 'Invalid user ID' }, { status: 400 });
  }

  const country = request.headers.get('x-vercel-ip-country') || 'XX';

  // Supabase will use the session cookie from the request to authenticate
  const { error } = await supabase
    .from('profiles')
    .update({ country })
    .eq('id', user_id);

  if (error) {
    console.error('Update failed:', error);
    return Response.json({ error: 'Failed to update' }, { status: 500 });
  }

  return Response.json({ success: true, country });
}