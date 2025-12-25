// src/app/communities/[communityId]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Users, 
  Heart, 
  MessageCircle, 
  Plus, 
  LogIn, 
  LogOut, 
  Settings,
  UserPlus,
  Image as ImageIcon
} from 'lucide-react';

// Types based on reference documents
interface Community {
  id: string;
  name: string;
  description: string;
  member_count: number;
  online_count: number;
  grief_type: string;
  created_at: string;
  cover_photo_url?: string | null;
}

interface Member {
  user_id: string;          // ← primary identifier
  username: string;
  avatar_url: string | null;
  last_online: string | null;
  is_online: boolean;
  role: 'member' | 'admin' | 'moderator';
  joined_at: string;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  community_id: string;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
}

export default function CommunityDetailPage() {
  const params = useParams();
  const communityId = params.communityId as string;
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();
  
  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [userRole, setUserRole] = useState<'member' | 'admin' | 'moderator' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newPostContent, setNewPostContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [bannerLoading, setBannerLoading] = useState(true);

  // Grief types with gradients from reference documents
  const griefTypeGradients: Record<string, string> = {
    'parent': 'from-amber-200 to-orange-300',
    'child': 'from-purple-200 to-indigo-300',
    'spouse': 'from-rose-200 to-pink-300',
    'sibling': 'from-teal-200 to-cyan-300',
    'friend': 'from-blue-200 to-indigo-300',
    'pet': 'from-yellow-200 to-amber-300',
    'miscarriage': 'from-pink-200 to-rose-300',
    'caregiver': 'from-stone-200 to-amber-300',
    'suicide': 'from-violet-200 to-purple-300',
    'other': 'from-gray-200 to-stone-300'
  };

  // Format time since last activity using native Date
  const formatRecentActivity = (dateString: string): string => {
    const now = new Date();
    const created = new Date(dateString);
    const diffMinutes = Math.floor((now.getTime() - created.getTime()) / 60000);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 2) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffMinutes < 120) return '1 hour ago';
    
    const hours = Math.floor(diffMinutes / 60);
    return `${hours} hours ago`;
  };

  // Check if user is online (last 5 minutes)
  const isUserOnline = (lastOnline: string | null): boolean => {
    if (!lastOnline) return false;
    const lastOnlineDate = new Date(lastOnline);
    const now = new Date();
    return (now.getTime() - lastOnlineDate.getTime()) < 5 * 60 * 1000; // 5 minutes
  };

  // Fetch community data
  useEffect(() => {
    const fetchData = async () => {
      if (!communityId) return;
      
      try {
        setLoading(true);
        setError(null);

        // Fetch community details
        const { data: communityData, error: communityError } = await supabase
          .from('communities')
          .select('*')
          .eq('id', communityId)
          .single();

        if (communityError) throw communityError;
        
        // Add cover photo URL
        const communityWithPhoto = {
          ...communityData,
          cover_photo_url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/communities/${communityId}/banner.jpg?t=${Date.now()}`
        };
        
        setCommunity(communityWithPhoto);

        // Check if user is a member
        if (user) {
          const { data: memberData, error: memberError } = await supabase
            .from('community_members')
            .select('role')
            .eq('community_id', communityId)
            .eq('user_id', user.id)
            .single();

          if (memberData) {
            setIsMember(true);
            setUserRole(memberData.role);
          } else {
            setIsMember(false);
            setUserRole(null);
          }
        }

        // Fetch members with user details
       const { data: membersData, error: membersError } = await supabase
  .from('community_members')
  .select(`
    role,
    joined_at,
    user_id,
    user:profiles!inner (
      
      full_name,
      avatar_url,
      last_online
    )
  `)
  .eq('community_id', communityId)
  .order('joined_at', { ascending: true });

        if (membersError) throw membersError;
        
        // Format members data correctly
       const formattedMembers = membersData.map(member => {
  const profile = Array.isArray(member.user) ? member.user[0] : member.user;
  return {
    
    user_id: member.user_id,
    username: profile.full_name || 'Anonymous', // map to username for UI
    avatar_url: profile.avatar_url,
    last_online: profile.last_online,
    is_online: isUserOnline(profile.last_online),
    role: member.role,
    joined_at: member.joined_at
  };
});
        
        setMembers(formattedMembers);

        // Fetch posts
        const { data: postData, error: postError } = await supabase
          .from('community_posts')
.select(`
  id,
  content,
  created_at,
  community_id,
  likes_count,
  comments_count,
  user_id,
  user:profiles!inner (
    id,
    full_name,
    avatar_url
  )
`)
.eq('community_id', communityId)
.order('created_at', { ascending: false });

        if (postError) throw postError;
        
        // Format posts data correctly
        const formattedPosts = postData.map(post => {
          const userData = Array.isArray(post.user) ? post.user[0] : post.user;
          return {
            id: post.id,
            content: post.content,
            created_at: post.created_at,
            user_id: post.user_id,
            username: userData.full_name || 'Anonymous',
            avatar_url: userData.avatar_url,
            community_id: post.community_id,
            likes_count: post.likes_count || 0,
            comments_count: post.comments_count || 0,
            is_liked: false
          };
        });
        
        setPosts(formattedPosts);
        
      } catch (err: any) {
        console.error('Error fetching community:', err);
        setError(err.message || 'Failed to load community data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [communityId, user, supabase]);

  // Handle banner image load
  const handleBannerLoad = () => {
    setBannerLoading(false);
  };

  // Handle join/leave community
  const handleMembership = async () => {
    if (!user) {
      router.push(`/auth?redirectTo=/communities/${communityId}`);
      return;
    }

    if (isMember) {
      // Leave community
      const { error } = await supabase
        .from('community_members')
        .delete()
        .eq('community_id', communityId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Error leaving community:', error);
        setError('Failed to leave community');
        return;
      }
      
      setIsMember(false);
      setUserRole(null);
      setCommunity(prev => prev ? { ...prev, member_count: prev.member_count - 1 } : null);
    } else {
      // Join community
      const { error } = await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          user_id: user.id,
          joined_at: new Date().toISOString(),
          role: 'member'
        });

      if (error) {
        console.error('Error joining community:', error);
        setError('Failed to join community');
        return;
      }
      
      setIsMember(true);
      setUserRole('member');
      setCommunity(prev => prev ? { ...prev, member_count: prev.member_count + 1 } : null);
    }
  };

  // Handle create post
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !community || !newPostContent.trim()) return;
    
    setIsPosting(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .from('community_posts')
        .insert({
          community_id: community.id,
          user_id: user.id,
          content: newPostContent.trim(),
          created_at: new Date().toISOString()
        })
        .select(`
          id,
          content,
          created_at,
          community_id,
          likes_count,
          comments_count,
          user_id,
          user:profiles!inner (
            id,
            full_name,
            avatar_url
          )
        `)
        .single();

      if (error) throw error;
      
      // Format new post correctly
      const userData = Array.isArray(data.user) ? data.user[0] : data.user;
      const newPost = {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        user_id: data.user_id,
        username: userData?.full_name || 'Anonymous', 
        avatar_url: userData.avatar_url,
        community_id: data.community_id,
        likes_count: data.likes_count || 0,
        comments_count: data.comments_count || 0,
        is_liked: false
      };
      
      // Add new post to state
      setPosts(prev => [newPost, ...prev]);
      setNewPostContent('');
    } catch (err: any) {
      console.error('Error creating post:', err);
      setError(err.message || 'Failed to create post');
    } finally {
      setIsPosting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-amber-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-stone-600">Loading community...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 max-w-md text-center shadow-md">
          <div className="text-amber-500 mb-3">
            <Users className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">Error Loading Community</h2>
          <p className="text-stone-600 mb-4">{error}</p>
          <Button onClick={() => router.back()} className="bg-amber-500 hover:bg-amber-600 text-white">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 max-w-md text-center shadow-md">
          <div className="text-amber-500 mb-3">
            <Users className="h-12 w-12 mx-auto" />
          </div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">Community Not Found</h2>
          <p className="text-stone-600 mb-4">The community you're looking for doesn't exist.</p>
          <Button onClick={() => router.push('/communities')} className="bg-amber-500 hover:bg-amber-600 text-white">
            Browse Communities
          </Button>
        </div>
      </div>
    );
  }

  const gradient = griefTypeGradients[community.grief_type] || 'from-amber-200 to-orange-300';
  const isAdmin = userRole === 'admin';
  const isModerator = userRole === 'moderator' || isAdmin;
  
  // Get safe username from auth user
  const authUsername = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Anonymous';

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 pt-20 md:pt-6">
      {/* Community Banner */}
      <div className="relative h-48 md:h-64 mb-6 overflow-hidden">
        {bannerLoading && (
          <div className="absolute inset-0 bg-gradient-to-br from-stone-200 to-stone-300 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-t-transparent"></div>
          </div>
        )}
        <img 
          src={community.cover_photo_url || `https://via.placeholder.com/1200x300/${gradient.replace(/ /g, '')}?text=${encodeURIComponent(community.name)}`}
          alt={community.name}
          className={`w-full h-full object-cover transition-opacity duration-300 ${bannerLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={handleBannerLoad}
          onError={() => setBannerLoading(false)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        
        {/* Admin Edit Banner Button */}
        {isAdmin && (
          <button 
            className="absolute bottom-4 right-4 bg-white/20 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-white/30 transition-colors"
            onClick={() => {
              // TODO: Implement banner upload modal
              alert('Banner upload functionality coming soon!');
            }}
          >
            <ImageIcon size={16} />
            Edit Banner
          </button>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Community Header */}
            <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${gradient} flex-shrink-0 flex items-center justify-center`}>
                    <Users className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-stone-800">{community.name}</h1>
                    <p className="text-stone-600 mt-1">{community.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-stone-500">
                      <span className="flex items-center gap-1">
                        <Users size={16} className="text-amber-500" />
                        {community.member_count} members
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart size={16} className="text-green-500" />
                        {community.online_count} online now
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={16} className="text-blue-500" />
                        {posts.length} posts
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {user ? (
                    <Button
                      onClick={handleMembership}
                      className={`flex items-center gap-2 ${isMember ? 'bg-red-500 hover:bg-red-600' : 'bg-amber-500 hover:bg-amber-600'} text-white`}
                    >
                      {isMember ? (
                        <>
                          <LogOut size={18} />
                          Leave Community
                        </>
                      ) : (
                        <>
                          <LogIn size={18} />
                          Join Community
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => router.push(`/auth?redirectTo=/communities/${communityId}`)}
                      className="bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-2"
                    >
                      <LogIn size={18} />
                      Sign in to Join
                    </Button>
                  )}
                  
                  {isAdmin && (
                    <Button
                      onClick={() => {
                        // TODO: Implement community settings
                        alert('Community settings coming soon!');
                      }}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Settings size={18} />
                      Manage
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Create Post */}
            {isMember && (
              <Card className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
                <form onSubmit={handleCreatePost}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex-shrink-0 flex items-center justify-center text-white font-medium">
                      {user?.user_metadata?.avatar_url ? (
                        <img 
                          src={user.user_metadata.avatar_url} 
                          alt={authUsername} 
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        authUsername[0]?.toUpperCase() || 'U'
                      )}
                    </div>
                    <div className="flex-1">
                      <textarea
                        value={newPostContent}
                        onChange={(e) => setNewPostContent(e.target.value)}
                        placeholder={`What's on your mind, ${authUsername}? Share your thoughts, memories, or questions with the community...`}
                        className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent min-h-[100px] max-h-[200px] resize-y"
                        maxLength={500}
                      />
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-xs text-stone-500">{newPostContent.length}/500</span>
                        <Button
                          type="submit"
                          disabled={isPosting || !newPostContent.trim()}
                          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium"
                        >
                          {isPosting ? 'Posting...' : 'Share'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </form>
              </Card>
            )}

            {/* Posts Feed */}
            <div className="space-y-5">
              {posts.length === 0 ? (
                <Card className="bg-white rounded-xl border border-stone-200 p-8 text-center">
                  <MessageCircle className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-stone-800 mb-1">No posts yet</h3>
                  <p className="text-stone-600">
                    {isMember 
                      ? "Be the first to share your thoughts with the community."
                      : "Join this community to see and share posts."
                    }
                  </p>
                  {!isMember && user && (
                    <Button 
                      onClick={handleMembership}
                      className="mt-4 bg-amber-500 hover:bg-amber-600 text-white"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Join to Participate
                    </Button>
                  )}
                </Card>
              ) : (
                posts.map(post => (
                  <Card key={post.id} className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex-shrink-0 flex items-center justify-center text-white font-medium">
                        {post.avatar_url ? (
                          <img 
                            src={post.avatar_url} 
                            alt={post.username} 
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          post.username[0]?.toUpperCase() || 'U'
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <h3 className="font-medium text-stone-800">{post.username}</h3>
                            <p className="text-xs text-stone-500">
                              {formatRecentActivity(post.created_at)}
                            </p>
                          </div>
                          {isModerator && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="text-stone-400 hover:text-stone-600"
                              onClick={() => {
                                // TODO: Implement post moderation
                                alert('Post moderation options coming soon!');
                              }}
                            >
                              •••
                            </Button>
                          )}
                        </div>
                        
                        <p className="text-stone-700 whitespace-pre-line mb-4">
                          {post.content}
                        </p>
                        
                        <div className="flex items-center gap-4 text-sm text-stone-500">
                          <button 
                            className={`flex items-center gap-1 hover:text-amber-600 transition-colors ${post.is_liked ? 'text-amber-600' : ''}`}
                            onClick={() => {
                              // TODO: Implement like functionality
                              alert('Like functionality coming soon!');
                            }}
                          >
                            <Heart size={16} fill={post.is_liked ? 'currentColor' : 'none'} />
                            {post.likes_count}
                          </button>
                          <button 
                            className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                            onClick={() => {
                              // TODO: Implement comment functionality
                              alert('Comment functionality coming soon!');
                            }}
                          >
                            <MessageCircle size={16} />
                            {post.comments_count}
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Member List */}
            <Card className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-stone-800 flex items-center gap-2">
                  <Users size={20} className="text-amber-500" />
                  Community Members
                </h2>
                {isMember && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-amber-600 hover:bg-amber-50"
                    onClick={() => {
                      // TODO: Implement invite functionality
                      alert('Member invite functionality coming soon!');
                    }}
                  >
                    <UserPlus size={16} className="mr-1" />
                    Invite
                  </Button>
                )}
              </div>
              
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {members.map(member => {
                  return (
                    <div 
                      key={member.user_id} 
                      className="flex items-center justify-between p-2 hover:bg-stone-50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                          <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-medium ${
                            member.avatar_url 
                              ? 'overflow-hidden' 
                              : `bg-gradient-to-br ${gradient} text-white`
                          }`}>
                            {member.avatar_url ? (
                              <img 
                                src={member.avatar_url} 
                                alt={member.username} 
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              member.username[0]?.toUpperCase() || 'U'
                            )}
                          </div>
                          {member.is_online && (
                            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white"></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-stone-800 truncate">{member.username}</p>
                          <p className="text-xs text-stone-500">
                            Joined {formatRecentActivity(member.joined_at)}
                          </p>
                        </div>
                      </div>
                      
                      {member.role !== 'member' && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          member.role === 'admin' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {member.role}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {members.length > 10 && (
                <Button 
                  variant="outline" 
                  className="w-full mt-2 text-amber-600 hover:bg-amber-50"
                  onClick={() => {
                    // TODO: Implement view all members modal
                    alert('Full member list coming soon!');
                  }}
                >
                  View all members ({members.length})
                </Button>
              )}
            </Card>

            {/* Community Guidelines */}
            <Card className="bg-white rounded-xl border border-stone-200 p-5 shadow-sm">
              <h2 className="text-lg font-bold text-stone-800 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                Our Guidelines
              </h2>
              <ul className="space-y-2 text-sm text-stone-600">
                <li>• Share from the heart, listen with compassion</li>
                <li>• Respect different grief journeys and timelines</li>
                <li>• No unsolicited advice - ask before offering support</li>
                <li>• Keep personal details confidential</li>
                <li>• Report harmful content to moderators</li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}