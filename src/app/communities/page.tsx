'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Users, MessageCircle, Plus, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase';
import Button from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

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

// Gradient mapping by grief type
const griefGradients: Record<string, string> = {
  parent: 'linear-gradient(135deg, #fcd34d, #f97316)',
  child: 'linear-gradient(135deg, #d8b4fe, #8b5cf6)',
  spouse: 'linear-gradient(135deg, #fda4af, #ec4899)',
  sibling: 'linear-gradient(135deg, #5eead4, #06b6d4)',
  friend: 'linear-gradient(135deg, #93c5fd, #6366f1)',
  pet: 'linear-gradient(135deg, #fef08a, #f59e0b)',
  miscarriage: 'linear-gradient(135deg, #fbcfe8, #e11d48)',
  caregiver: 'linear-gradient(135deg, #e5e7eb, #f59e0b)',
  suicide: 'linear-gradient(135deg, #ddd6fe, #a78bfa)',
  other: 'linear-gradient(135deg, #e5e7eb, #9ca3af)',
};

const defaultGradient = 'linear-gradient(135deg, #fcd34d, #f97316)';

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
  // Use the path from DB, and proxy it — don't override it!
  cover_photo_url: community.cover_photo_url
  ? `/api/media/communities/${community.cover_photo_url}`
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
          background: 'linear-gradient(to bottom, #fffbeb, #f5f5f1, #f0f0ee)',
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
              border: '4px solid #f59e0b',
              borderTopColor: 'transparent',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <p style={{ color: '#64748b' }}>Loading communities...</p>
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
          background: 'linear-gradient(to bottom, #fffbeb, #f5f5f1, #f0f0ee)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}
      >
        <div
          style={{
            background: 'white',
            borderRadius: '0.75rem',
            padding: '1.5rem',
            maxWidth: '28rem',
            textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ color: '#f59e0b', marginBottom: '0.75rem' }}>
            <Users size={48} style={{ margin: '0 auto' }} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1e293b', marginBottom: '0.5rem' }}>
            Error Loading Communities
          </h2>
          <p style={{ color: '#64748b', marginBottom: '1rem' }}>{error}</p>
          <Button
            onClick={() => router.refresh()}
            style={{
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
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
    background: 'linear-gradient(to bottom, #fffbeb, #f5f5f1, #f0f0ee)',
    paddingTop: '5rem',
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
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: '9999px',
              background: griefGradients.parent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <Users size={28} color="white" />
          </div>
          <h1
            style={{
              fontSize: '1.875rem',
              fontWeight: '700',
              color: '#1e293b',
              marginBottom: '0.5rem',
            }}
          >
            Find Your Tribe
          </h1>
          <p style={{ color: '#64748b', maxWidth: '42rem', margin: '0 auto 1rem' }}>
            Join a circle where your grief is understood — not explained away. Share your story, read others&apos; stories, or simply be present.
          </p>
          <div
            style={{
              display: 'inline-block',
              padding: '0.5rem 1rem',
              borderRadius: '9999px',
              background: '#dcfce7',
              color: '#166534',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            🟢 {formattedOnlineText} in communities right now
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
                transition: 'transform 0.15s ease-in-out',
                marginBottom: '1.25rem',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <div
                style={{
                  background: 'white',
                  borderRadius: '0.75rem',
                  border: '1px solid #e2e8f0',
                  padding: '1rem',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                  transition: 'box-shadow 0.2s ease',
                  display: 'flex',
                  gap: '1rem',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.04)')}
              >
                {/* Cover Photo - Left-aligned, fixed size */}
                <div
                  style={{
                    width: '6rem',
                    height: '6rem',
                    borderRadius: '0.5rem',
                    overflow: 'hidden',
                    flexShrink: 0,
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
                        background: griefGradients[community.grief_type] || defaultGradient,
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
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Header Section */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ flex: 1, minWidth: 0, marginRight: '1rem' }}>
                      <h2
                        style={{
                          fontWeight: '700',
                          color: '#1e293b',
                          fontSize: '1.125rem',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                          hyphens: 'auto',
                          lineHeight: 1.3,
                        }}
                      >
                        {community.name}
                      </h2>
                      <p
                        style={{
                          color: '#64748b',
                          fontSize: '0.875rem',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                          overflowWrap: 'break-word',
                        }}
                      >
                        {community.description}
                      </p>
                    </div>
                    <Button
                      style={{
                        background: '#f59e0b',
                        color: 'white',
                        border: 'none',
                        padding: '0.375rem 0.75rem',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        alignSelf: 'flex-start',
                      }}
                    >
                      Visit
                      <ArrowRight size={14} />
                    </Button>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Users size={14} style={{ color: '#94a3b8' }} />
                      {community.member_count === 1 ? '1 member' : `${community.member_count.toLocaleString()} members`}
                    </span>
                  </div>

                  {/* Activity */}
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.875rem', color: '#334155' }}>
                    <MessageCircle size={16} style={{ color: '#f59e0b', marginTop: '0.125rem' }} />
                    <p>
                      {formatRecentActivity(community.created_at)}: Someone just shared a memory
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
              background: 'white',
              borderRadius: '0.75rem',
              border: '2px dashed #cbd5e1',
              marginBottom: '2rem',
            }}
          >
            <div
              style={{
                width: '3rem',
                height: '3rem',
                borderRadius: '9999px',
                background: '#fef3c7',
                color: '#b45309',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}
            >
              <Users size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1e293b', marginBottom: '0.5rem' }}>
              No communities yet
            </h3>
            <p style={{ color: '#64748b', maxWidth: '28rem', margin: '0 auto 1.5rem' }}>
              Be the first to create a community for your grief experience. Your story matters, and others are waiting to hear it.
            </p>
            <Button
              onClick={handleRequestCommunity}
              style={{
                background: '#f59e0b',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <Plus size={16} />
              Start Your Community
            </Button>
          </div>
        )}

        {/* CTA Footer */}
        <div
          style={{
            background: 'white',
            borderRadius: '0.75rem',
            border: '1px solid #e2e8f0',
            padding: '1.25rem',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#64748b', marginBottom: '0.75rem' }}>
            Can&rsquo;t find a community that matches your grief experience?
          </p>
          <Button
            onClick={handleRequestCommunity}
            style={{
              background: '#f59e0b',
              color: 'white',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Plus size={16} />
            Start a New Community
          </Button>
        </div>

        {/* Guidelines Footer */}
        <div
          style={{
            marginTop: '2rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            color: '#94a3b8',
            padding: '1rem',
            background: 'rgba(255,255,255,0.5)',
            borderRadius: '0.5rem',
          }}
        >
          <p>All communities are moderated with care. We honor every story without judgment.</p>
          <p style={{ fontWeight: '600', marginTop: '0.25rem' }}>Your grief is valid. Your presence matters.</p>
        </div>
      </div>

      {/* Optional: define animation if not in global CSS */}
      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}