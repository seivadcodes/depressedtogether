'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, MessageCircle, Plus, ArrowRight, Brain, Heart } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import Button from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

interface Community {
  id: string;
  name: string;
  description: string;
  member_count: number;
  online_count: number;
  topic: string;
  created_at: string;
  cover_photo_url?: string | null;
}

// Gradient mapping by depression topic
const topicGradients: Record<string, string> = {
  'general-depression': 'linear-gradient(135deg, #93c5fd, #3b82f6)',
  'anxiety': 'linear-gradient(135deg, #c7d2fe, #6366f1)',
  'therapy': 'linear-gradient(135deg, #a5f3fc, #06b6d4)',
  'medication': 'linear-gradient(135deg, #d8b4fe, #a855f7)',
  'self-care': 'linear-gradient(135deg, #86efac, #22c55e)',
  'mindfulness': 'linear-gradient(135deg, #fde68a, #f59e0b)',
  'burnout': 'linear-gradient(135deg, #fca5a5, #ef4444)',
  'social-anxiety': 'linear-gradient(135deg, #f9a8d4, #ec4899)',
  'recovery': 'linear-gradient(135deg, #c4b5fd, #8b5cf6)',
  'support': 'linear-gradient(135deg, #a5b4fc, #4f46e5)',
  'other': 'linear-gradient(135deg, #e5e7eb, #9ca3af)',
};

const defaultGradient = 'linear-gradient(135deg, #93c5fd, #3b82f6)';

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();

  const [totalOnline, setTotalOnline] = useState(0);

  useEffect(() => {
    const fetchOnlineCount = async () => {
      try {
        const { count, error } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('last_seen', new Date(Date.now() - 60_000).toISOString());

        if (error) {
          console.error('Failed to fetch online count:', error);
          setTotalOnline(0);
        } else {
          setTotalOnline(count || 0);
        }
      } catch (err) {
        console.error('Unexpected error fetching online count:', err);
        setTotalOnline(0);
      }
    };

    fetchOnlineCount();
    const interval = setInterval(fetchOnlineCount, 30_000);
    return () => clearInterval(interval);
  }, [supabase]);

  useEffect(() => {
    const fetchCommunities = async () => {
      try {
        const { data, error } = await supabase
          .from('communities_with_counts')
          .select('*')
          .order('member_count', { ascending: false });

        if (error) throw error;

        if (data) {
          const communitiesWithPhotos = data.map((community) => ({
            ...community,
            cover_photo_url: community.cover_photo_url
              ? `/api/media/${community.cover_photo_url}`
              : null,
          }));

          setCommunities(communitiesWithPhotos);
          const total = communitiesWithPhotos.reduce((sum, c) => sum + c.online_count, 0);
          setTotalOnline(total);
        }
      } catch (err) {
        console.error('Error fetching communities:', err);
        setError('Failed to load communities. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchCommunities();
  }, [supabase]);

  const formatRecentActivity = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMinutes = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMs / 3_600_000);
    const diffDays = Math.floor(diffMs / 86_400_000);
    const diffWeeks = Math.floor(diffDays / 7);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 2) return '1 minute ago';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours < 2) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 2) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffWeeks < 2) return '1 week ago';
    if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
    const months = Math.floor(diffDays / 30);
    if (months < 2) return '1 month ago';
    if (months < 12) return `${months} months ago`;

    const years = Math.floor(diffDays / 365);
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  };

  const handleRequestCommunity = () => {
    if (!user) {
      router.push('/auth?redirectTo=/communities/create');
      return;
    }
    router.push('/communities/create');
  };

  // === Loading State ===
  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f0f7ff 0%, #dbeafe 50%, #bfdbfe 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              height: '3rem',
              width: '3rem',
              borderRadius: '9999px',
              border: '4px solid #3b82f6',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <p style={{ color: '#4b5563' }}>Loading communities...</p>
        </div>
      </div>
    );
  }

  // === Error State ===
  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #f0f7ff 0%, #dbeafe 50%, #bfdbfe 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            padding: '1.5rem',
            maxWidth: '28rem',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <div style={{ color: '#3b82f6', marginBottom: '0.75rem' }}>
            <Brain size={48} style={{ margin: '0 auto' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e40af', marginBottom: '0.5rem' }}>
            Error Loading Communities
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '1rem' }}>{error}</p>
          <Button
            onClick={() => router.refresh()}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              fontWeight: '600',
              transition: 'all 300ms ease-in-out',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f7ff 0%, #dbeafe 50%, #bfdbfe 100%)',
    paddingTop: '2rem',
    paddingBottom: '2rem',
    paddingLeft: '1rem',
    paddingRight: '1rem',
  };

  const innerContainerStyle: React.CSSProperties = {
    maxWidth: '896px',
    margin: '0 auto',
  };

  // Format online count with correct pluralization
  const formattedOnlineText = totalOnline === 1 ? '1 person' : `${totalOnline} people`;

  return (
    <div style={containerStyle}>
      <div style={innerContainerStyle}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '4rem',
              height: '4rem',
              borderRadius: '9999px',
              background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
              border: '2px solid #3b82f6',
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.2)',
            }}
          >
            <Users size={28} color="#1e40af" />
          </div>
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: '800',
              color: '#1e40af',
              marginBottom: '0.5rem',
              background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Find Your Support Circle
          </h1>
          <p style={{ 
  color: '#4b5563', 
  maxWidth: '42rem', 
  margin: '0 auto 1rem',
  fontSize: '1.125rem',
  lineHeight: '1.6'
}}>
  Join a community where your depression is understood &mdash; not explained away. Share your story, read others&rsquo; stories, or simply be present.
</p>
          <div
            style={{
              display: 'inline-block',
              padding: '0.5rem 1.25rem',
              borderRadius: '9999px',
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#166534',
              fontSize: '0.875rem',
              fontWeight: '600',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
            }}
          >
            <span style={{ 
              width: '0.75rem', 
              height: '0.75rem', 
              backgroundColor: '#10b981', 
              borderRadius: '50%',
              display: 'inline-block',
              marginRight: '0.5rem',
              animation: 'pulse 2s infinite',
            }}></span>
            {formattedOnlineText} in communities right now
          </div>
        </div>

        {/* Communities List */}
        <div style={{ marginBottom: '3rem' }}>
          {communities.map((community) => (
            <Link
              key={community.id}
              href={`/communities/${community.id}`}
              style={{
                display: 'block',
                textDecoration: 'none',
                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                marginBottom: '1.25rem',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '1rem',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  padding: '1.25rem',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease-in-out',
                  display: 'flex',
                  gap: '1rem',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 12px 32px rgba(59, 130, 246, 0.15)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.05)')}
              >
                {/* Gradient background accent */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '6px',
                    height: '100%',
                    background: topicGradients[community.topic] || defaultGradient,
                  }}
                />

                {/* Cover Photo - Left-aligned, fixed size */}
                <div
                  style={{
                    width: '6rem',
                    height: '6rem',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    flexShrink: 0,
                    border: '1px solid rgba(59, 130, 246, 0.1)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                    position: 'relative',
                    zIndex: 1,
                  }}
                >
                  {community.cover_photo_url ? (
                    <img
                      src={community.cover_photo_url}
                      alt={community.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        background: topicGradients[community.topic] || defaultGradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                      }}
                    >
                      <Users size={24} />
                    </div>
                  )}
                </div>

                {/* Content Area */}
                <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
                  {/* Header Section */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: '1rem' }}>
                      <h2
                        style={{
                          fontWeight: '700',
                          color: '#1e40af',
                          fontSize: '1.25rem',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          lineHeight: 1.3,
                          marginBottom: '0.25rem',
                        }}
                      >
                        {community.name}
                      </h2>
                      <p
                        style={{
                          color: '#6b7280',
                          fontSize: '0.875rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          lineHeight: '1.5',
                        }}
                      >
                        {community.description}
                      </p>
                    </div>
                    <Button
                      style={{
                        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        alignSelf: 'flex-start',
                        transition: 'all 300ms ease-in-out',
                        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(59, 130, 246, 0.2)';
                      }}
                    >
                      Visit
                      <ArrowRight size={14} />
                    </Button>
                  </div>

                  {/* Stats */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '1rem', 
                    fontSize: '0.75rem', 
                    color: '#6b7280', 
                    marginBottom: '0.75rem',
                    fontWeight: '500'
                  }}>
                    <span style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.375rem',
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '9999px',
                    }}>
                      <Users size={14} style={{ color: '#3b82f6' }} />
                      {community.member_count === 1 ? '1 member' : `${community.member_count.toLocaleString()} members`}
                    </span>
                  </div>

                  {/* Activity */}
                  <div style={{ 
                    display: 'flex', 
                    gap: '0.5rem', 
                    fontSize: '0.875rem', 
                    color: '#4b5563',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'rgba(249, 250, 251, 0.8)',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(229, 231, 235, 0.5)',
                  }}>
                    <MessageCircle size={16} style={{ color: '#3b82f6', marginTop: '0.125rem' }} />
                    <p style={{ margin: 0 }}>
                      {formatRecentActivity(community.created_at)}: Someone just shared their experience
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Empty State */}
        {communities.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(10px)',
              borderRadius: '1rem',
              border: '2px dashed rgba(59, 130, 246, 0.3)',
              marginBottom: '2rem',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            }}
          >
            <div
              style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '9999px',
                background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
                border: '2px solid #3b82f6',
              }}
            >
              <Users size={24} />
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e40af', marginBottom: '0.5rem' }}>
              No communities yet
            </h3>
            <p style={{ color: '#6b7280', maxWidth: '28rem', margin: '0 auto 1.5rem', fontSize: '1rem' }}>
              Be the first to create a community for your depression experience. Your story matters, and others are waiting to hear it.
            </p>
            <Button
              onClick={handleRequestCommunity}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '0.75rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontWeight: '600',
                fontSize: '1rem',
                transition: 'all 300ms ease-in-out',
                boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.3)';
              }}
            >
              <Plus size={18} />
              Start Your Community
            </Button>
          </div>
        )}

        {/* CTA Footer */}
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '1rem',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            padding: '1.5rem',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            marginBottom: '2rem',
          }}
        >
          <p style={{ 
            color: '#4b5563', 
            marginBottom: '1rem',
            fontSize: '1.125rem',
            fontWeight: '500'
          }}>
            Can&rsquo;t find a community that matches your depression experience?
          </p>
          <Button
            onClick={handleRequestCommunity}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '0.75rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: '600',
              fontSize: '1rem',
              transition: 'all 300ms ease-in-out',
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(59, 130, 246, 0.3)';
            }}
          >
            <Plus size={18} />
            Start a New Community
          </Button>
        </div>

        {/* Guidelines Footer */}
        <div
          style={{
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#6b7280',
            padding: '1.25rem',
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: '0.75rem',
            border: '1px solid rgba(59, 130, 246, 0.1)',
          }}
        >
          <p>All communities are moderated with care. We honor every story without judgment.</p>
          <p style={{ fontWeight: '600', marginTop: '0.5rem', color: '#1e40af' }}>
            Your feelings are valid. Your presence matters.
          </p>
        </div>
      </div>

      {/* Global styles for animations */}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%, 100% { 
            opacity: 1;
          }
          50% { 
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}