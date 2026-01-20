// src/utils/imageUtils.ts
import { createClient } from '@/lib/supabase';

export function getPublicImageUrl(path: string, bucket = 'avatars'): string | null {
  if (!path) return null;
  
  // If already a full URL, return as-is
  if (path.startsWith('http')) {
    return path;
  }
  
  let cleanPath = path;
  if (path.startsWith(`${bucket}/`)) {
    cleanPath = path.substring(bucket.length + 1);
  }
  
  try {
    const supabase = createClient();
    const { data } = supabase.storage.from(bucket).getPublicUrl(cleanPath);
    return data?.publicUrl ?? null;
  } catch (error) {
    console.error(`Error getting public URL for ${path}:`, error);
    return null;
  }
}