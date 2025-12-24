// src/app/dashboard/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import {
  Heart,
  MessageCircle,
  Users,
  Edit,
  Send,
  Camera,
  X,
  Settings,
  ToggleLeft,
  User,
  MapPin,
  Globe,
  Loader2,
} from 'lucide-react';

type GriefType =
  | 'parent'
  | 'child'
  | 'spouse'
  | 'sibling'
  | 'friend'
  | 'pet'
  | 'miscarriage'
  | 'caregiver'
  | 'suicide'
  | 'other';

const griefTypeLabels: Record<GriefType, string> = {
  parent: 'Loss of a Parent',
  child: 'Loss of a Child',
  spouse: 'Grieving a Partner',
  sibling: 'Loss of a Sibling',
  friend: 'Loss of a Friend',
  pet: 'Pet Loss',
  miscarriage: 'Pregnancy or Infant Loss',
  caregiver: 'Caregiver Grief',
  suicide: 'Suicide Loss',
  other: 'Other Loss',
};

interface UserProfile {
  id: string;
  grief_types: GriefType[];
  avatar_url?: string | null;
  accepts_calls: boolean;
  accept_from_genders: ('male' | 'female' | 'nonbinary' | 'any')[];
  accept_from_countries: string[];
  accept_from_languages: string[];
  is_anonymous: boolean;
}

interface Post {
  id: string;
  text: string;
  media_urls: string[] | null;
  grief_types: GriefType[];
  created_at: string;
  likes_count: number;
  user_id: string;
  is_anonymous: boolean;
}

// === Helper: Validate and parse grief types ===
const isValidGriefType = (value: unknown): value is GriefType => {
  return typeof value === 'string' && Object.keys(griefTypeLabels).includes(value);
};

const parseGriefTypes = (input: unknown): GriefType[] => {
  if (!Array.isArray(input)) return [];
  return input.filter(isValidGriefType);
};

export default function DashboardPage() {
  const supabase = getSupabaseBrowserClient();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGriefSetup, setShowGriefSetup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedGriefTypes, setSelectedGriefTypes] = useState<GriefType[]>([]);
  const [newPostText, setNewPostText] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [onlineCount, setOnlineCount] = useState(87);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize online counter
  useEffect(() => {
    const interval = setInterval(() => {
      setOnlineCount(prev => Math.max(10, prev + (Math.random() > 0.5 ? 1 : -1)));
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  // Fetch user profile and posts on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          router.push('/login');
          return;
        }

        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profileError) throw profileError;

        // Safely parse profile data
        const safeProfile: UserProfile = {
          id: profileData.id,
          grief_types: parseGriefTypes(profileData.grief_types),
          avatar_url: profileData.avatar_url ?? undefined,
          accepts_calls: profileData.accepts_calls ?? false,
          accept_from_genders: Array.isArray(profileData.accept_from_genders)
            ? profileData.accept_from_genders.filter(g =>
                ['male', 'female', 'nonbinary', 'any'].includes(g)
              ) as ('male' | 'female' | 'nonbinary' | 'any')[]
            : ['any'],
          accept_from_countries: Array.isArray(profileData.accept_from_countries)
            ? profileData.accept_from_countries
            : [],
          accept_from_languages: Array.isArray(profileData.accept_from_languages)
            ? profileData.accept_from_languages
            : [],
          is_anonymous: profileData.is_anonymous ?? false,
        };

        if (safeProfile.grief_types.length === 0) {
          setShowGriefSetup(true);
          setSelectedGriefTypes([]);
        } else {
          setSelectedGriefTypes([...safeProfile.grief_types]);
        }

        setProfile(safeProfile);

        // Fetch recent posts
        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (postsError) throw postsError;

        // Transform media URLs to public URLs and parse grief types
        const safePosts: Post[] = postsData.map(post => ({
          id: post.id,
          text: post.text || '',
          media_urls: post.media_urls?.map((url: string) =>
            supabase.storage.from('post-media').getPublicUrl(url).data.publicUrl
          ) || null,
          grief_types: parseGriefTypes(post.grief_types),
          created_at: post.created_at || new Date().toISOString(),
          likes_count: post.likes_count || 0,
          user_id: post.user_id || session.user.id,
          is_anonymous: post.is_anonymous ?? false,
        }));

        setPosts(safePosts);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please refresh.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [supabase, router]);

  const toggleGriefType = (type: GriefType) => {
    setSelectedGriefTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleSaveGriefTypes = async () => {
    if (selectedGriefTypes.length === 0) {
      alert('Please select at least one type of loss.');
      return;
    }

    if (!profile) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ grief_types: selectedGriefTypes })
        .eq('id', profile.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, grief_types: selectedGriefTypes } : null);
      setShowGriefSetup(false);
    } catch (err) {
      console.error('Error updating grief types:', err);
      alert('Failed to save grief types. Please try again.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Limit to 4 files
    const filesArray = Array.from(files).slice(0, 4 - mediaFiles.length);
    setMediaFiles(prev => [...prev, ...filesArray]);
    
    // Create previews
    const newPreviews = filesArray.map(file => URL.createObjectURL(file));
    setMediaPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
    setMediaPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handlePostSubmit = async () => {
    if (!newPostText.trim() || !profile) return;
    setPosting(true);
    setError(null);

    try {
      let mediaUrls: string[] = [];
      
      // Upload media files if any
      if (mediaFiles.length > 0) {
        const uploadPromises = mediaFiles.map(async (file, index) => {
          const fileName = `post_${profile.id}_${Date.now()}_${index}${file.name.substring(file.name.lastIndexOf('.'))}`;
          const { data, error } = await supabase.storage
            .from('post-media')
            .upload(`public/${fileName}`, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (error) throw error;
          return data.path;
        });

        mediaUrls = await Promise.all(uploadPromises);
      }

      // Create new post
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: profile.id,
          text: newPostText,
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          grief_types: profile.grief_types,
          is_anonymous: profile.is_anonymous,
        })
        .select()
        .single();

      if (postError) throw postError;

      // Build safe new post
      const newPost: Post = {
        id: postData.id,
        text: postData.text || newPostText,
        media_urls: postData.media_urls?.map((url: string) =>
          supabase.storage.from('post-media').getPublicUrl(url).data.publicUrl
        ) || null,
        grief_types: parseGriefTypes(postData.grief_types),
        created_at: postData.created_at || new Date().toISOString(),
        likes_count: postData.likes_count || 0,
        user_id: postData.user_id || profile.id,
        is_anonymous: postData.is_anonymous ?? profile.is_anonymous,
      };

      setPosts(prev => [newPost, ...prev]);
      setNewPostText('');
      setMediaFiles([]);
      setMediaPreviews([]);
    } catch (err) {
      console.error('Error creating post:', err);
      setError('Failed to share post. Please try again.');
    } finally {
      setPosting(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100">
        <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 p-4">
        <div className="bg-white p-6 rounded-xl border border-amber-200 max-w-md w-full text-center">
          <div className="text-amber-500 mb-4">⚠️</div>
          <p className="text-stone-800 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-amber-500 text-white rounded-full hover:bg-amber-600 transition"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  // === Grief Setup Modal ===
  if (showGriefSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 p-4 flex flex-col items-center justify-start">
        <div className="max-w-md w-full">
          <h1 className="text-2xl font-medium text-stone-800 text-center mb-2">
            What losses are you carrying?
          </h1>
          <p className="text-stone-600 text-center mb-6">
            You can choose more than one. This helps us connect you with the right people.
          </p>
          <div className="space-y-3 mb-6">
            {(Object.entries(griefTypeLabels) as [GriefType, string][]).map(([type, label]) => (
              <button
                key={type}
                onClick={() => toggleGriefType(type)}
                className={`w-full text-left p-4 rounded-lg border transition ${
                  selectedGriefTypes.includes(type)
                    ? 'border-amber-500 bg-amber-50 text-amber-800'
                    : 'border-stone-200 bg-white text-stone-800 hover:border-amber-300'
                }`}
              >
                {label}
                {selectedGriefTypes.includes(type) && (
                  <span className="ml-2 text-amber-600 font-medium">✓</span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={handleSaveGriefTypes}
            disabled={selectedGriefTypes.length === 0}
            className={`w-full py-3 rounded-full font-medium transition ${
              selectedGriefTypes.length > 0
                ? 'bg-amber-500 text-white hover:bg-amber-600'
                : 'bg-stone-200 text-stone-400 cursor-not-allowed'
            }`}
          >
            Save & Continue
          </button>
          <p className="text-center text-xs text-stone-500 mt-4">
            You can edit this anytime in Settings.
          </p>
        </div>
      </div>
    );
  }

  // === Settings Drawer ===
  if (showSettings) {
    return (
      <div className="min-h-screen bg-stone-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-stone-800">Settings</h2>
            <button
              onClick={() => setShowSettings(false)}
              className="text-stone-500 hover:text-stone-700 p-2"
              aria-label="Close settings"
            >
              <X size={24} />
            </button>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-stone-800 mb-2">Your Grief Context</h3>
            <p className="text-sm text-stone-600 mb-2">
              {profile?.grief_types.map(t => griefTypeLabels[t]).join(', ') || 'Not set'}
            </p>
            <button
              onClick={() => {
                setSelectedGriefTypes(profile?.grief_types || []);
                setShowGriefSetup(true);
                setShowSettings(false);
              }}
              className="text-amber-600 text-sm hover:underline flex items-center gap-1"
            >
              <Edit size={14} />
              Edit grief types
            </button>
          </div>

          <div className="mb-6 p-4 bg-white rounded-xl border border-stone-200">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-stone-800 font-medium">Accepting calls</span>
              <ToggleLeft
                onClick={() => {
                  if (!profile) return;
                  const newValue = !profile.accepts_calls;
                  supabase
                    .from('profiles')
                    .update({ accepts_calls: newValue })
                    .eq('id', profile.id);
                  setProfile(prev => prev ? { ...prev, accepts_calls: newValue } : null);
                }}
                className={`w-11 h-6 rounded-full p-1 transition-colors ${
                  profile?.accepts_calls
                    ? 'bg-amber-500 text-white'
                    : 'bg-stone-300 text-stone-500'
                }`}
              />
            </label>
            <p className="text-xs text-stone-500 mt-2">
              When off, you won't appear in matches for 1:1 calls
            </p>
          </div>

          <div className="mb-6">
            <h3 className="font-medium text-stone-800 mb-2">Post Anonymously</h3>
            <label className="flex items-center gap-3 p-3 bg-white rounded-lg border border-stone-200">
              <input
                type="checkbox"
                checked={profile?.is_anonymous}
                onChange={async (e) => {
                  if (!profile) return;
                  const newValue = e.target.checked;
                  const { error } = await supabase
                    .from('profiles')
                    .update({ is_anonymous: newValue })
                    .eq('id', profile.id);
                  
                  if (!error) {
                    setProfile(prev => prev ? { ...prev, is_anonymous: newValue } : null);
                  }
                }}
                className="form-checkbox h-5 w-5 text-amber-600 rounded"
              />
              <span className="text-stone-800">Hide my identity when posting and calling</span>
            </label>
          </div>

          <div className="mb-8">
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-stone-100 text-stone-800 rounded-lg font-medium hover:bg-stone-200 transition"
            >
              Log Out
            </button>
          </div>

          <button
            onClick={() => setShowSettings(false)}
            className="w-full py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  // === Main Dashboard ===
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 p-4 md:p-6 pb-24 pt-6 md:pt-[120px]">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Grief Context + Settings */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-stone-200 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-sm font-medium text-stone-600 mb-1">Your grief context</h2>
              <div className="flex flex-wrap gap-2">
                {profile?.grief_types.map((type) => (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-sm px-3 py-1.5 rounded-full border border-amber-200"
                  >
                    <Heart size={12} className="text-amber-600" />
                    {griefTypeLabels[type]}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="p-2.5 text-stone-600 hover:text-stone-900 rounded-full hover:bg-stone-200 transition-colors"
              aria-label="Settings"
            >
              <Settings size={20} />
            </button>
          </div>
          <button
            onClick={() => setShowGriefSetup(true)}
            className="mt-3 text-xs text-amber-600 hover:underline flex items-center gap-1"
          >
            <Edit size={12} />
            Edit or add another loss
          </button>
        </div>

        <div className="text-center">
          <p className="text-stone-600 font-medium">You're not alone</p>
          <div className="mt-2 inline-flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl border border-green-200">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-800">
              {onlineCount} people online right now
            </span>
          </div>
        </div>

        {/* Post Composer */}
        <section className="bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 border border-amber-200">
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Profile" 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <MessageCircle size={18} className="text-amber-600" />
              )}
            </div>
            <div className="flex-1">
              <textarea
                value={newPostText}
                onChange={(e) => setNewPostText(e.target.value)}
                placeholder="What's in your heart today? Your words matter here..."
                className="w-full p-2 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300 rounded-lg resize-none min-h-[80px]"
                rows={3}
              />
              
              {mediaPreviews.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {mediaPreviews.map((url, i) => (
                    <div key={i} className="relative w-20 h-20">
                      <img
                        src={url}
                        alt="Preview"
                        className="w-full h-full object-cover rounded-lg border border-stone-200"
                      />
                      <button
                        onClick={() => removeMedia(i)}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                        aria-label="Remove media"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 text-stone-600 hover:text-amber-600 text-sm font-medium transition-colors"
                  >
                    <Camera size={16} />
                    Add photo/video
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                  />
                </div>
                <button
                  onClick={handlePostSubmit}
                  disabled={!newPostText.trim() || posting}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium transition-colors ${
                    newPostText.trim() && !posting
                      ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-md'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  {posting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Sharing...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Share
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Posts */}
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold text-stone-800 text-lg">In Your Communities</h2>
            <span className="text-xs text-amber-600 font-medium">Real-time updates</span>
          </div>
          {posts.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-stone-200 rounded-xl p-8 text-center">
              <MessageCircle className="text-stone-300 mx-auto mb-3" size={48} />
              <p className="text-stone-500">No posts yet. Be the first to share your heart.</p>
              <p className="text-amber-600 text-sm mt-1 font-medium">Your words can comfort others today</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <div 
                  key={post.id} 
                  className="bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        {profile?.is_anonymous ? (
                          <User size={16} className="text-amber-600" />
                        ) : profile?.avatar_url ? (
                          <img 
                            src={profile.avatar_url} 
                            alt="User" 
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <User size={16} className="text-amber-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-stone-800">
                          {profile?.is_anonymous ? 'Anonymous' : 'You'}
                        </p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {post.grief_types.map((type) => (
                            <span 
                              key={type} 
                              className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full"
                            >
                              {griefTypeLabels[type]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-stone-800 mb-3 whitespace-pre-wrap">{post.text}</p>
                    
                    {post.media_urls && post.media_urls.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
                        {post.media_urls.slice(0, 4).map((url, i) => (
                          <div 
                            key={i} 
                            className="aspect-square rounded-lg overflow-hidden border border-stone-200 bg-stone-50"
                          >
                            <img
                              src={url}
                              alt={`Post media ${i + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center pt-3 border-t border-stone-100">
                      <span className="text-xs text-stone-500">
                        {new Date(post.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                      <button className="flex items-center gap-1 text-stone-500 hover:text-amber-600 text-sm font-medium transition-colors">
                        <Heart size={16} />
                        {post.likes_count}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section>
          <h2 className="font-semibold text-stone-800 mb-4 text-lg">Get Support Now</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => router.push('/connect')}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-stone-200 bg-white hover:border-amber-400 transition-all group"
            >
              <div className="p-3 bg-amber-50 rounded-xl mb-3 group-hover:bg-amber-100 transition-colors">
                <MessageCircle className="text-amber-600" size={32} />
              </div>
              <span className="font-medium text-stone-800 text-lg">Talk Now</span>
              <span className="text-sm text-stone-500 mt-1">Connect with someone who understands</span>
            </button>
            <button
              onClick={() => router.push('/communities')}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-stone-200 bg-white hover:border-amber-400 transition-all group"
            >
              <div className="p-3 bg-amber-50 rounded-xl mb-3 group-hover:bg-amber-100 transition-colors">
                <Users className="text-amber-600" size={32} />
              </div>
              <span className="font-medium text-stone-800 text-lg">Your Communities</span>
              <span className="text-sm text-stone-500 mt-1">Find your people</span>
            </button>
          </div>
        </section>

        <div className="text-center pt-6 border-t border-stone-200 mt-6">
          <p className="text-stone-600 text-sm font-medium">You belong here. Always.</p>
          <p className="text-xs text-stone-400 mt-1">Healing happens in community</p>
        </div>
      </div>
    </div>
  );
}