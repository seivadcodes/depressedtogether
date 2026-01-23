// src/app/resources/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, AlertTriangle, ExternalLink, Search, Filter } from 'lucide-react';

function getYouTubeEmbedUrl(url: string): string | null {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  const videoId = match && match[2].length === 11 ? match[2] : null;
  return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
}

type ResourceType = 'Story' | 'Guide' | 'Tool' | 'Video' | 'Book';

interface Resource {
  id: string;
  title: string;
  excerpt: string;
  type: ResourceType;
  category: string;
  tags: string[];
  content_warnings: string[];
  community_source: string | null;
  book_author: string | null;
  book_quote: string | null;
  external_url: string | null;
  created_at: string;
  book_cover_url: string | null;
  user_id: string;
  video_url: string | null;
  video_type: 'link' | 'upload';
}

const CATEGORIES: Record<ResourceType, string> = {
  Story: 'Personal Stories',
  Guide: 'Guidance',
  Tool: 'Tools',
  Video: 'Videos',
  Book: 'Books',
};

const ALL_TYPES = 'All';
type FilterType = ResourceType | 'All';

export default function ResourcesPage() {
  const supabase = createClient();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, 'helpful' | 'unhelpful'>>({});
  const [resourceCounts, setResourceCounts] = useState<Record<string, { helpful: number; unhelpful: number }>>({});
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<FilterType>(ALL_TYPES);

  // Filter resources based on search and type
  const filteredResources = useMemo(() => {
    return resources.filter(resource => {
      if (selectedType !== ALL_TYPES && resource.type !== selectedType) {
        return false;
      }
      
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          resource.title.toLowerCase().includes(query) ||
          resource.excerpt.toLowerCase().includes(query) ||
          (resource.book_author && resource.book_author.toLowerCase().includes(query)) ||
          (resource.community_source && resource.community_source.toLowerCase().includes(query))
        );
      }
      
      return true;
    });
  }, [resources, searchQuery, selectedType]);

  useEffect(() => {
    const fetchResourcesAndVotes = async () => {
      try {
        const { data: resourcesData, error: resourcesError } = await supabase
          .from('resources')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false });

        if (resourcesError) {
          console.error('Error fetching resources:', resourcesError);
          setError('Failed to load resources.');
          setLoading(false);
          return;
        }

        setResources(resourcesData as Resource[]);

        const resourceIds = resourcesData.map((r: Resource) => r.id);

        const { data: allVotes, error: votesError } = await supabase
          .from('resource_votes')
          .select('resource_id, vote_type')
          .in('resource_id', resourceIds);

        if (!votesError && allVotes) {
          const counts: Record<string, { helpful: number; unhelpful: number }> = {};
          resourcesData.forEach((r: Resource) => {
            counts[r.id] = { helpful: 0, unhelpful: 0 };
          });

          allVotes.forEach(vote => {
            if (counts[vote.resource_id]) {
              if (vote.vote_type === 'helpful') {
                counts[vote.resource_id].helpful += 1;
              } else if (vote.vote_type === 'unhelpful') {
                counts[vote.resource_id].unhelpful += 1;
              }
            }
          });

          setResourceCounts(counts);
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (user && resourceIds.length > 0) {
          const { data: userVotesData, error: userVotesError } = await supabase
            .from('resource_votes')
            .select('resource_id, vote_type')
            .in('resource_id', resourceIds)
            .eq('user_id', user.id);

          if (!userVotesError && userVotesData) {
            const voteMap: Record<string, 'helpful' | 'unhelpful'> = {};
            userVotesData.forEach(v => {
              voteMap[v.resource_id] = v.vote_type as 'helpful' | 'unhelpful';
            });
            setUserVotes(voteMap);
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('Error in fetchResourcesAndVotes:', err);
        setError('Failed to load resources.');
        setLoading(false);
      }
    };

    fetchResourcesAndVotes();
  }, [supabase]);

  const handleVote = async (resourceId: string, newVoteType: 'helpful' | 'unhelpful') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please log in to vote.');
      return;
    }

    const currentVote = userVotes[resourceId];
    const currentCount = resourceCounts[resourceId] || { helpful: 0, unhelpful: 0 };

    const newCounts = { ...currentCount };
    const newUserVotes = { ...userVotes };

    if (currentVote === newVoteType) {
      if (newVoteType === 'helpful') {
        newCounts.helpful = Math.max(0, newCounts.helpful - 1);
      } else {
        newCounts.unhelpful = Math.max(0, newCounts.unhelpful - 1);
      }
      delete newUserVotes[resourceId];
    } else {
      if (currentVote === 'helpful') {
        newCounts.helpful = Math.max(0, newCounts.helpful - 1);
      } else if (currentVote === 'unhelpful') {
        newCounts.unhelpful = Math.max(0, newCounts.unhelpful - 1);
      }
      if (newVoteType === 'helpful') {
        newCounts.helpful += 1;
      } else {
        newCounts.unhelpful += 1;
      }
      newUserVotes[resourceId] = newVoteType;
    }

    setResourceCounts(prev => ({ ...prev, [resourceId]: newCounts }));
    setUserVotes(newUserVotes);

    try {
      if (currentVote === newVoteType) {
        await supabase
          .from('resource_votes')
          .delete()
          .eq('resource_id', resourceId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('resource_votes')
          .upsert({
            resource_id: resourceId,
            user_id: user.id,
            vote_type: newVoteType,
            created_at: new Date().toISOString(),
          }, {
            onConflict: 'resource_id,user_id'
          });
      }

      const { data: freshVotes, error: fetchError } = await supabase
        .from('resource_votes')
        .select('vote_type')
        .eq('resource_id', resourceId);

      if (!fetchError && freshVotes) {
        const freshCounts = { helpful: 0, unhelpful: 0 };
        freshVotes.forEach(vote => {
          if (vote.vote_type === 'helpful') {
            freshCounts.helpful += 1;
          } else if (vote.vote_type === 'unhelpful') {
            freshCounts.unhelpful += 1;
          }
        });

        setResourceCounts(prev => ({
          ...prev,
          [resourceId]: freshCounts
        }));
      } else {
        console.error('Failed to fetch fresh votes:', fetchError);
        setResourceCounts(prev => ({ ...prev, [resourceId]: currentCount }));
        setUserVotes(prev => {
          const reverted = { ...prev };
          if (currentVote) {
            reverted[resourceId] = currentVote;
          } else {
            delete reverted[resourceId];
          }
          return reverted;
        });
        alert('Failed to save your vote. Please try again.');
      }
    } catch (err) {
      console.error('Vote sync failed:', err);
      setResourceCounts(prev => ({ ...prev, [resourceId]: currentCount }));
      setUserVotes(prev => {
        const reverted = { ...prev };
        if (currentVote) {
          reverted[resourceId] = currentVote;
        } else {
          delete reverted[resourceId];
        }
        return reverted;
      });
      alert('Failed to save your vote. Please try again.');
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType(ALL_TYPES);
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f0f7ff', 
        padding: '1.5rem 1rem 3.5rem', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center' 
      }}>
        <p style={{ color: '#1e40af' }}>Loading resources...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f0f7ff', 
        padding: '1.5rem 2rem' 
      }}>
        <div style={{ 
          maxWidth: '768px', 
          margin: '0 auto', 
          backgroundColor: '#fee2e2', 
          padding: '1rem', 
          borderRadius: '0.5rem' 
        }}>
          <p style={{ color: '#b91c1c' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#f0f7ff', 
      padding: '1.5rem 1rem 3.5rem' 
    }}>
      <div style={{ maxWidth: '768px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            style={{
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '9999px',
              backgroundColor: '#dbeafe',
              color: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 0.75rem',
            }}
          >
            <BookOpen size={18} />
          </div>
          <h1 style={{ 
            fontSize: '1.875rem', 
            fontWeight: '700', 
            color: '#1e40af',
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Grief Resources
          </h1>
          <p style={{ color: '#4b5563', marginTop: '0.5rem' }}>
            Shared wisdom and tools from people who understand grief
          </p>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ position: 'relative' }}>
            <Search 
              size={20} 
              style={{ 
                position: 'absolute', 
                left: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: '#6b7280' 
              }} 
            />
            <input
              type="text"
              placeholder="Search resources by title, author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem 0.625rem 2.5rem',
                borderRadius: '0.75rem',
                border: '1px solid #d1d5db',
                backgroundColor: 'white',
                fontSize: '0.875rem',
                color: '#374151',
                outline: 'none',
                transition: 'all 150ms ease-in-out',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              }}
            />
          </div>
        </div>

        {/* Category Filters */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Filter size={16} style={{ color: '#1e40af' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#1e40af' }}>
              Filter by Type
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
            <button
              onClick={() => setSelectedType(ALL_TYPES)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '9999px',
                border: selectedType === ALL_TYPES ? '2px solid #3b82f6' : '1px solid #d1d5db',
                backgroundColor: selectedType === ALL_TYPES ? '#dbeafe' : 'white',
                color: selectedType === ALL_TYPES ? '#1e40af' : '#4b5563',
                fontSize: '0.875rem',
                fontWeight: selectedType === ALL_TYPES ? '600' : '400',
                cursor: 'pointer',
                transition: 'all 150ms ease-in-out',
                boxShadow: selectedType === ALL_TYPES ? '0 2px 8px rgba(59, 130, 246, 0.2)' : 'none',
              }}
            >
              All Resources ({resources.length})
            </button>
            {Object.entries(CATEGORIES).map(([type, label]) => {
              const count = resources.filter(r => r.type === type).length;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type as ResourceType)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '9999px',
                    border: selectedType === type ? '2px solid #3b82f6' : '1px solid #d1d5db',
                    backgroundColor: selectedType === type ? '#dbeafe' : 'white',
                    color: selectedType === type ? '#1e40af' : '#4b5563',
                    fontSize: '0.875rem',
                    fontWeight: selectedType === type ? '600' : '400',
                    cursor: 'pointer',
                    transition: 'all 150ms ease-in-out',
                    boxShadow: selectedType === type ? '0 2px 8px rgba(59, 130, 246, 0.2)' : 'none',
                  }}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {(searchQuery || selectedType !== ALL_TYPES) && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              marginTop: '1rem',
              padding: '0.75rem',
              backgroundColor: 'rgba(59, 130, 246, 0.05)',
              borderRadius: '0.5rem',
              border: '1px solid rgba(59, 130, 246, 0.1)'
            }}>
              <span style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                Showing {filteredResources.length} of {resources.length} resources
                {searchQuery && ` for "${searchQuery}"`}
                {selectedType !== ALL_TYPES && ` in ${CATEGORIES[selectedType as ResourceType]}`}
              </span>
              <button
                onClick={clearFilters}
                style={{
                  padding: '0.375rem 0.75rem',
                  borderRadius: '0.375rem',
                  border: '1px solid #3b82f6',
                  backgroundColor: 'white',
                  color: '#3b82f6',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 150ms ease-in-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.color = '#3b82f6';
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {filteredResources.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '3rem', 
            backgroundColor: 'white', 
            borderRadius: '1rem', 
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(59, 130, 246, 0.1)'
          }}>
            <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '1.125rem' }}>
              No resources found{searchQuery ? ` for "${searchQuery}"` : ''}.
            </p>
            {(searchQuery || selectedType !== ALL_TYPES) && (
              <button
                onClick={clearFilters}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '0.5rem',
                  border: '1px solid #3b82f6',
                  backgroundColor: 'white',
                  color: '#3b82f6',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 150ms ease-in-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'white';
                  e.currentTarget.style.color = '#3b82f6';
                }}
              >
                Clear filters to show all resources
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {filteredResources.map((resource) => {
              const currentVote = userVotes[resource.id];
              const counts = resourceCounts[resource.id] || {
                helpful: 0,
                unhelpful: 0,
              };

              const bookCoverSrc = resource.book_cover_url 
                ? `/api/media/${resource.book_cover_url}`
                : null;

              const videoSrc = resource.video_url && resource.video_type === 'upload'
                ? `/api/media/${resource.video_url}`
                : null;

              return (
                <div
                  key={resource.id}
                  style={{
                    backgroundColor: 'white',
                    borderRadius: '1rem',
                    padding: '1.5rem',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
                    border: '1px solid rgba(59, 130, 246, 0.1)',
                    borderLeft: '4px solid #3b82f6',
                    transition: 'transform 150ms ease-in-out, box-shadow 150ms ease-in-out',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(59, 130, 246, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.05)';
                  }}
                >
                  <div style={{ display: 'inline-block', marginBottom: '0.75rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: '600',
                        backgroundColor: '#dbeafe',
                        color: '#1e40af',
                        padding: '0.375rem 0.75rem',
                        borderRadius: '9999px',
                        boxShadow: '0 1px 3px rgba(59, 130, 246, 0.1)',
                      }}
                    >
                      {CATEGORIES[resource.type]}
                    </span>
                  </div>

                  <h2 style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: '700', 
                    color: '#1e40af', 
                    marginBottom: '0.75rem',
                    lineHeight: '1.4'
                  }}>
                    {resource.title}
                  </h2>

                  {resource.type === 'Book' && (
                    <div style={{ marginBottom: '1rem' }}>
                      {bookCoverSrc && (
                        <div
                          style={{
                            width: '200px',
                            height: '260px',
                            marginBottom: '0.75rem',
                            overflow: 'hidden',
                            borderRadius: '0.5rem',
                            border: '1px solid #e5e7eb',
                            position: 'relative',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                          }}
                        >
                          <Image
                            src={bookCoverSrc}
                            alt={`Cover for ${resource.title}`}
                            fill
                            style={{ objectFit: 'cover' }}
                            unoptimized
                          />
                        </div>
                      )}
                      {resource.book_author && (
                        <p style={{ 
                          color: '#4b5563', 
                          fontStyle: 'italic', 
                          marginBottom: '0.5rem',
                          fontSize: '0.95rem'
                        }}>
                          by {resource.book_author}
                        </p>
                      )}
                      {resource.book_quote && (
                      <p style={{ 
  color: '#374151', 
  fontStyle: 'normal', 
  margin: 0,
  padding: '0.75rem',
  backgroundColor: '#f8fafc',
  borderRadius: '0.5rem',
  borderLeft: '3px solid #3b82f6'
}}>
  &ldquo;{resource.book_quote}&rdquo;
</p>
                      )}
                    </div>
                  )}

                  {resource.type !== 'Book' && resource.excerpt && (
                    <p style={{ 
                      color: '#4b5563', 
                      marginBottom: '1rem',
                      lineHeight: '1.6'
                    }}>
                      {resource.excerpt}
                    </p>
                  )}

                  {resource.community_source && (
                    <p style={{ 
                      fontSize: '0.875rem', 
                      color: '#6b7280', 
                      marginBottom: '1rem',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: '#f8fafc',
                      borderRadius: '0.375rem',
                      display: 'inline-block'
                    }}>
                      Shared in: <strong>{resource.community_source}</strong>
                    </p>
                  )}

                  {resource.content_warnings.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.375rem', 
                        marginBottom: '0.5rem' 
                      }}>
                        <AlertTriangle size={14} style={{ color: '#8b5cf6' }} />
                        <span style={{ 
                          fontSize: '0.875rem', 
                          fontWeight: '600', 
                          color: '#8b5cf6' 
                        }}>
                          Content Warnings
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                        {resource.content_warnings.map((warning) => (
                          <span
                            key={warning}
                            style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: '#ede9fe',
                              color: '#7c3aed',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              border: '1px solid rgba(139, 92, 246, 0.2)',
                            }}
                          >
                            {warning}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {resource.type === 'Video' && (
                    <div style={{ marginBottom: '1rem' }}>
                      {resource.video_type === 'upload' && videoSrc ? (
                        <video
                          src={videoSrc}
                          controls
                          style={{
                            width: '100%',
                            maxHeight: '300px',
                            borderRadius: '0.75rem',
                            border: '1px solid #e5e7eb',
                            backgroundColor: '#000',
                          }}
                        />
                      ) : resource.video_type === 'link' && resource.external_url ? (
                        getYouTubeEmbedUrl(resource.external_url) ? (
                          <div style={{ 
                            position: 'relative', 
                            paddingBottom: '56.25%', 
                            height: 0, 
                            overflow: 'hidden', 
                            borderRadius: '0.75rem',
                            border: '1px solid #e5e7eb'
                          }}>
                            <iframe
                              src={getYouTubeEmbedUrl(resource.external_url)!}
                              title={resource.title}
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                border: 'none',
                              }}
                            />
                          </div>
                        ) : (
                          <Link
                            href={resource.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              color: '#1e40af',
                              fontWeight: '600',
                              textDecoration: 'none',
                              padding: '0.5rem 1rem',
                              backgroundColor: '#dbeafe',
                              borderRadius: '0.5rem',
                              border: '1px solid rgba(59, 130, 246, 0.3)',
                              transition: 'all 150ms ease-in-out',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#3b82f6';
                              e.currentTarget.style.color = 'white';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = '#dbeafe';
                              e.currentTarget.style.color = '#1e40af';
                            }}
                          >
                            Watch Video <ExternalLink size={14} />
                          </Link>
                        )
                      ) : (
                        <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
                          No playable video content available.
                        </p>
                      )}
                    </div>
                  )}

                  {resource.external_url && resource.type !== 'Video' && (
                    <div style={{ marginTop: '1rem' }}>
                      <Link
                        href={resource.external_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          color: '#1e40af',
                          fontWeight: '600',
                          textDecoration: 'none',
                          padding: '0.5rem 1rem',
                          backgroundColor: '#dbeafe',
                          borderRadius: '0.5rem',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          transition: 'all 150ms ease-in-out',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = '#3b82f6';
                          e.currentTarget.style.color = 'white';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = '#dbeafe';
                          e.currentTarget.style.color = '#1e40af';
                        }}
                      >
                        View Resource <ExternalLink size={14} />
                      </Link>
                    </div>
                  )}

                  {/* Voting Controls */}
                  <div style={{ 
                    marginTop: '1.5rem', 
                    display: 'flex', 
                    gap: '0.75rem', 
                    alignItems: 'center',
                    paddingTop: '1rem',
                    borderTop: '1px solid #e5e7eb'
                  }}>
                    <button
                      onClick={() => handleVote(resource.id, 'helpful')}
                      style={{
                        background: currentVote === 'helpful' ? '#dcfce7' : 'white',
                        border: currentVote === 'helpful' ? '2px solid #16a34a' : '1px solid #d1d5db',
                        borderRadius: '9999px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        color: currentVote === 'helpful' ? '#166534' : '#4b5563',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: currentVote === 'helpful' ? '600' : '400',
                        transition: 'all 150ms ease-in-out',
                        boxShadow: currentVote === 'helpful' ? '0 2px 8px rgba(22, 163, 74, 0.2)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (currentVote !== 'helpful') {
                          e.currentTarget.style.backgroundColor = '#f0f9ff';
                          e.currentTarget.style.borderColor = '#3b82f6';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentVote !== 'helpful') {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }
                      }}
                    >
                      <span style={{ fontSize: '1rem' }}>👍</span> Helpful ({counts.helpful})
                    </button>
                    <button
                      onClick={() => handleVote(resource.id, 'unhelpful')}
                      style={{
                        background: currentVote === 'unhelpful' ? '#fee2e2' : 'white',
                        border: currentVote === 'unhelpful' ? '2px solid #dc2626' : '1px solid #d1d5db',
                        borderRadius: '9999px',
                        padding: '0.5rem 1rem',
                        fontSize: '0.875rem',
                        color: currentVote === 'unhelpful' ? '#991b1b' : '#4b5563',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontWeight: currentVote === 'unhelpful' ? '600' : '400',
                        transition: 'all 150ms ease-in-out',
                        boxShadow: currentVote === 'unhelpful' ? '0 2px 8px rgba(220, 38, 38, 0.2)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (currentVote !== 'unhelpful') {
                          e.currentTarget.style.backgroundColor = '#f0f9ff';
                          e.currentTarget.style.borderColor = '#3b82f6';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (currentVote !== 'unhelpful') {
                          e.currentTarget.style.backgroundColor = 'white';
                          e.currentTarget.style.borderColor = '#d1d5db';
                        }
                      }}
                    >
                      <span style={{ fontSize: '1rem' }}>👎</span> Not Helpful ({counts.unhelpful})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Resource Button */}
        <div style={{ marginTop: '3rem', textAlign: 'center' }}>
          <Link
            href="/submit-resource"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.75rem 2rem',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              color: 'white',
              borderRadius: '0.75rem',
              fontWeight: '600',
              textDecoration: 'none',
              fontSize: '1rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(59, 130, 246, 0.3)',
              transition: 'all 300ms ease-in-out',
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
            <BookOpen size={18} />
            Share Your Own Resource
          </Link>
        </div>
      </div>
    </div>
  );
}