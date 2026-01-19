// app/api/media/route.ts
import { createClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  if (!path) {
    return NextResponse.json({ error: 'Missing path' }, { status: 400 });
  }

  // Optional: Add auth checks here (e.g., is user allowed to view this angel?)

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from('angels-media')
    .download(path);

  if (error) {
    console.error('Media fetch error:', error);
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Detect MIME type (basic)
  const mimeType = path.endsWith('.png') ? 'image/png'
                : path.endsWith('.jpg') || path.endsWith('.jpeg') ? 'image/jpeg'
                : path.endsWith('.gif') ? 'image/gif'
                : 'image/webp';

  return new NextResponse(data, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=3600', // optional caching
    },
  });
}