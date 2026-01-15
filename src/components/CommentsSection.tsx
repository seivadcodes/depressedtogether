// components/CommentsSection.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import { Heart, Send, MessageCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  likes_count: number;
  is_anonymous: boolean;
  author_name: string;
  author_avatar_url: string | null;
  is_deleted: boolean;
  parent_comment_id: string | null;
  replies_count: number;
}

interface CommentsSectionProps {
  parentId: string;
  parentType: 'post' | 'story' | 'memory';
  currentUser: {
    id: string;
    fullName: string;
    avatarUrl?: string;
    isAnonymous: boolean;
  };
}

interface CommentThread {
  comment: Comment;
  replies: CommentThread[];
  // 👇 NEW: track if current user has liked this comment
  hasLiked: boolean;
}

const MOBILE_BREAKPOINT = 768;

export function CommentsSection({ 
  parentId, 
  parentType, 
  currentUser 
}: CommentsSectionProps) {
  const supabase = createClient();
  const [comments, setComments] = useState<CommentThread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [newTopLevelComment, setNewTopLevelComment] = useState('');
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [windowWidth, setWindowWidth] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({});

  // Handle window resize
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 👇 Fetch comments AND user likes
  const loadComments = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select(`
          id,
          user_id,
          content,
          created_at,
          likes_count,
          is_anonymous,
          author_name,
          author_avatar_url,
          is_deleted,
          parent_comment_id,
          replies_count
        `)
        .eq('parent_id', parentId)
        .eq('parent_type', parentType)
        .eq('is_deleted', false)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Fetch user's likes for these comments
      const commentIds = commentsData.map(c => c.id);
      let userLikes: Set<string> = new Set();
      if (commentIds.length > 0) {
        const { data: likesData } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .in('comment_id', commentIds)
          .eq('user_id', currentUser.id);

        userLikes = new Set(likesData?.map(l => l.comment_id));
      }

      // Build comment map with hasLiked
      const commentMap = new Map<string, CommentThread>();
      commentsData.forEach(comment => {
        commentMap.set(comment.id, {
          comment: { ...comment },
          replies: [],
          hasLiked: userLikes.has(comment.id)
        });
      });

      const topLevelComments: CommentThread[] = [];
      commentsData.forEach(comment => {
        if (!comment.parent_comment_id) {
          topLevelComments.push(commentMap.get(comment.id)!);
        } else if (commentMap.has(comment.parent_comment_id)) {
          const parent = commentMap.get(comment.parent_comment_id)!;
          parent.replies.push(commentMap.get(comment.id)!);
        }
      });

      const computeRepliesCount = (thread: CommentThread): number => {
        const directCount = thread.replies.length;
        thread.comment.replies_count = directCount;
        thread.replies.forEach(computeRepliesCount);
        return directCount;
      };

      topLevelComments.forEach(thread => {
        computeRepliesCount(thread);
        const sortReplies = (t: CommentThread) => {
          t.replies.sort((a, b) => 
            new Date(a.comment.created_at).getTime() - new Date(b.comment.created_at).getTime()
          );
          t.replies.forEach(sortReplies);
        };
        sortReplies(thread);
      });

      setComments(topLevelComments);
    } catch (err) {
      console.error('Failed to load comments:', err);
      setError('Failed to load comments. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [parentId, parentType, currentUser.id]);

  useEffect(() => {
    loadComments();
    
    const channel = supabase
      .channel(`comments-${parentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `parent_id=eq.${parentId},is_deleted=is.false`
        },
        async (payload) => {
          const newComment = payload.new as Comment;
          if (newComment.user_id !== currentUser.id) {
            handleNewComment(newComment);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'comments',
          filter: `parent_id=eq.${parentId}`
        },
        (payload) => {
          const updatedComment = payload.new as Comment;
          if (updatedComment.is_deleted) {
            setComments(prev => removeComment(prev, updatedComment.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [parentId, parentType, loadComments, currentUser.id]);

  const removeComment = (threads: CommentThread[], id: string): CommentThread[] => {
    return threads
      .filter(thread => thread.comment.id !== id)
      .map(thread => ({
        ...thread,
        replies: removeComment(thread.replies, id)
      }));
  };

  const handleNewComment = (comment: Comment) => {
    const parentId = comment.parent_comment_id;
    if (parentId) {
      setComments(prev => updateReplies(prev, parentId, comment));
    } else {
      setComments(prev => [...prev, { comment, replies: [], hasLiked: false }]);
    }
  };

  const updateReplies = (
    threads: CommentThread[], 
    parentId: string, 
    newReply: Comment
  ): CommentThread[] => {
    return threads.map(thread => {
      if (thread.comment.id === parentId) {
        return {
          ...thread,
          comment: {
            ...thread.comment,
            replies_count: (thread.comment.replies_count || 0) + 1
          },
          replies: [...thread.replies, { comment: newReply, replies: [], hasLiked: false }]
        };
      }
      return {
        ...thread,
        replies: updateReplies(thread.replies, parentId, newReply)
      };
    });
  };

  const addTopLevelCommentOptimistically = (comment: Comment) => {
    setComments(prev => [...prev, { comment, replies: [], hasLiked: false }]);
  };

  const addReplyOptimistically = (parentId: string, reply: Comment) => {
    setComments(prev => addReplyToTree(prev, parentId, reply));
  };

  const addReplyToTree = (
    threads: CommentThread[],
    parentId: string,
    reply: Comment
  ): CommentThread[] => {
    return threads.map(thread => {
      if (thread.comment.id === parentId) {
        return {
          ...thread,
          comment: {
            ...thread.comment,
            replies_count: (thread.comment.replies_count || 0) + 1
          },
          replies: [...thread.replies, { comment: reply, replies: [], hasLiked: false }]
        };
      }
      return {
        ...thread,
        replies: addReplyToTree(thread.replies, parentId, reply)
      };
    });
  };

  const removeOptimisticComment = (commentId: string, isReply = false, parentId?: string) => {
    if (isReply && parentId) {
      setComments(prev => removeReplyFromTree(prev, parentId, commentId));
    } else {
      setComments(prev => prev.filter(t => t.comment.id !== commentId));
    }
  };

  const removeReplyFromTree = (
    threads: CommentThread[],
    parentId: string,
    replyId: string
  ): CommentThread[] => {
    return threads.map(thread => {
      if (thread.comment.id === parentId) {
        return {
          ...thread,
          comment: {
            ...thread.comment,
            replies_count: Math.max(0, (thread.comment.replies_count || 0) - 1)
          },
          replies: thread.replies.filter(r => r.comment.id !== replyId)
        };
      }
      return {
        ...thread,
        replies: removeReplyFromTree(thread.replies, parentId, replyId)
      };
    });
  };

  const handleSubmit = async (replyToCommentId?: string) => {
    const content = replyToCommentId 
      ? (replyTexts[replyToCommentId] || '').trim()
      : newTopLevelComment.trim();

    if (!content || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    const commentId = uuidv4();
    const now = new Date().toISOString();
    const authorName = currentUser.isAnonymous ? 'Anonymous' : currentUser.fullName;
    const authorAvatar = currentUser.isAnonymous 
      ? null 
      : (currentUser.avatarUrl || null);

    const newCommentObj: Comment = {
      id: commentId,
      user_id: currentUser.id,
      is_anonymous: currentUser.isAnonymous,
      author_name: authorName,
      author_avatar_url: authorAvatar,
      content,
      created_at: now,
      likes_count: 0,
      is_deleted: false,
      parent_comment_id: replyToCommentId || null,
      replies_count: 0
    };

    if (replyToCommentId) {
      addReplyOptimistically(replyToCommentId, newCommentObj);
      setReplyTexts(prev => ({ ...prev, [replyToCommentId]: '' }));
      setActiveReplyId(null);
    } else {
      addTopLevelCommentOptimistically(newCommentObj);
      setNewTopLevelComment('');
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          id: commentId,
          parent_id: parentId,
          parent_type: parentType,
          user_id: currentUser.id,
          is_anonymous: currentUser.isAnonymous,
          author_name: authorName,
          author_avatar_url: authorAvatar,
          content,
          created_at: now,
          parent_comment_id: replyToCommentId || null
        });

      if (error) throw error;
    } catch (err) {
      console.error('Submission failed:', err);
      setError('Failed to post. Please try again.');
      removeOptimisticComment(commentId, !!replyToCommentId, replyToCommentId);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ NEW: Toggle like with persistence
  const handleLike = async (commentId: string, currentHasLiked: boolean) => {
    setComments(prev => updateCommentLikeState(prev, commentId, !currentHasLiked));

    try {
      if (!currentHasLiked) {
        // Add like
        await supabase.from('comment_likes').insert({
          comment_id: commentId,
          user_id: currentUser.id
        });
        // Increment count
        await supabase.rpc('increment_comment_likes', { comment_id: commentId });
      } else {
        // Remove like
        await supabase
          .from('comment_likes')
          .delete()
          .match({ comment_id: commentId, user_id: currentUser.id });
        // Decrement count
        await supabase.rpc('decrement_comment_likes', { comment_id: commentId });
      }
    } catch (err) {
      console.error('Like toggle failed:', err);
      // Revert UI
      setComments(prev => updateCommentLikeState(prev, commentId, currentHasLiked));
    }
  };

  const updateCommentLikeState = (
    threads: CommentThread[], 
    commentId: string, 
    newHasLiked: boolean
  ): CommentThread[] => {
    return threads.map(thread => {
      if (thread.comment.id === commentId) {
        const delta = newHasLiked ? 1 : -1;
        return {
          ...thread,
          hasLiked: newHasLiked,
          comment: {
            ...thread.comment,
            likes_count: Math.max(0, thread.comment.likes_count + delta)
          }
        };
      }
      return {
        ...thread,
        replies: updateCommentLikeState(thread.replies, commentId, newHasLiked)
      };
    });
  };

  const toggleReply = (commentId: string) => {
    setActiveReplyId(activeReplyId === commentId ? null : commentId);
    if (activeReplyId !== commentId) {
      setReplyTexts(prev => ({ ...prev, [commentId]: '' }));
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => ({ ...prev, [commentId]: !prev[commentId] }));
  };

  const getAvatar = (comment: Comment) => {
    if (comment.is_anonymous) {
      return (
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '9999px',
          backgroundColor: '#FEF3C7',
          border: '1px solid #FDE68A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <span style={{ color: '#92400E', fontWeight: 500, fontSize: '0.875rem' }}>A</span>
        </div>
      );
    }
    
    if (comment.author_avatar_url) {
      return (
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '9999px',
          overflow: 'hidden',
          border: '1px solid #FDE68A'
        }}>
          <Image 
            src={comment.author_avatar_url} 
            alt={comment.author_name} 
            width={32} 
            height={32}
            style={{ objectFit: 'cover', width: '100%', height: '100%' }}
          />
        </div>
      );
    }
    
    return (
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '9999px',
        backgroundColor: '#FEF3C7',
        border: '1px solid #FDE68A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{ color: '#92400E', fontWeight: 500, fontSize: '0.875rem' }}>
          {comment.author_name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  };

  const renderComment = (thread: CommentThread, depth = 0) => {
    const { comment, replies, hasLiked } = thread;
    const isMobile = windowWidth < MOBILE_BREAKPOINT;
    const isReplyOpen = activeReplyId === comment.id;
    const areRepliesExpanded = expandedReplies[comment.id];
    
    return (
      <div key={comment.id} style={{ 
        marginLeft: depth > 0 ? '24px' : '0',
        position: 'relative',
        paddingBottom: '12px'
      }}>
        {depth > 0 && (
          <div style={{
            position: 'absolute',
            left: '-16px',
            top: '20px',
            bottom: '-12px',
            width: '2px',
            backgroundColor: '#E5E7EB',
            borderRadius: '9999px'
          }} />
        )}
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flexShrink: 0, marginTop: '4px' }}>
            {getAvatar(comment)}
          </div>
          
          <div style={{ flex: 1 }}>
            <div style={{ 
              backgroundColor: '#F9FAFB',
              borderRadius: '12px',
              padding: '12px',
              border: '1px solid #E5E7EB'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '4px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    fontWeight: 600, 
                    color: '#1F2937',
                    fontSize: '0.875rem'
                  }}>
                    {comment.author_name}
                  </span>
                  {comment.is_anonymous && (
                    <span style={{ 
                      fontSize: '0.75rem',
                      backgroundColor: '#FEF3C7',
                      color: '#92400E',
                      padding: '2px 6px',
                      borderRadius: '9999px',
                      fontWeight: 500
                    }}>
                      Anonymous
                    </span>
                  )}
                </div>
                <span style={{ 
                  color: '#6B7280', 
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap'
                }}>
                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                </span>
              </div>
              
              <p style={{ 
                color: '#374151', 
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                fontSize: '0.875rem'
              }}>
                {comment.content}
              </p>
            </div>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '16px', 
              marginTop: '8px',
              flexWrap: 'wrap'
            }}>
              <button
                onClick={() => handleLike(comment.id, hasLiked)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: hasLiked ? '#EF4444' : '#6B7280',
                  fontSize: '0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Heart 
                  size={14} 
                  style={{ 
                    fill: hasLiked ? '#EF4444' : 'none', 
                    stroke: hasLiked ? '#EF4444' : 'currentColor' 
                  }} 
                />
                <span>{comment.likes_count || 0}</span>
              </button>

              <button
                onClick={() => setIsExpanded(true)} // 👈 Opens full comments when clicked
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: '#6B7280',
                  fontSize: '0.75rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <MessageCircle size={14} />
                <span>Reply</span>
              </button>

              {replies.length > 0 && (
                <button
                  onClick={() => toggleReplies(comment.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#6B7280',
                    fontSize: '0.75rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F3F4F6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {areRepliesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  <span>{replies.length} repl{replies.length === 1 ? 'y' : 'ies'}</span>
                </button>
              )}
            </div>
            
            {isReplyOpen && (
              <div style={{ marginTop: '12px', paddingLeft: '8px' }}>
                <ReplyForm 
                  value={replyTexts[comment.id] || ''}
                  onChange={(val) => setReplyTexts(prev => ({ ...prev, [comment.id]: val }))}
                  onSubmit={() => handleSubmit(comment.id)}
                  isSubmitting={isSubmitting}
                  currentUser={currentUser}
                  isMobile={windowWidth < MOBILE_BREAKPOINT}
                />
              </div>
            )}
            
            {areRepliesExpanded && replies.length > 0 && (
              <div style={{ marginTop: '12px', borderLeft: '2px solid #E5E7EB', paddingLeft: '16px' }}>
                {replies.map(childThread => renderComment(childThread, depth + 1))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const latestComment = comments.length > 0 
    ? comments.reduce((latest, thread) => 
        new Date(thread.comment.created_at) > new Date(latest.comment.created_at) 
          ? thread 
          : latest
      )
    : null;

  if (isLoading) {
    return (
      <div style={{ 
        marginTop: '24px', 
        display: 'flex', 
        justifyContent: 'center', 
        padding: '24px' 
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          border: '3px solid #FDE68A',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  // Collapsed preview mode
  if (!isExpanded) {
    return (
      <div style={{ marginTop: '24px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <h3 style={{ 
            fontSize: '1.125rem',
            fontWeight: 600,
            color: '#1F2937'
          }}>
            {comments.length} Comment{comments.length !== 1 ? 's' : ''}
          </h3>
          {comments.length > 0 && (
            <button
              onClick={() => setIsExpanded(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: '#F59E0B',
                background: 'none',
                border: 'none',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              View all <ChevronDown size={16} />
            </button>
          )}
        </div>

        {/* Show latest comment in preview */}
        {latestComment && (
          <div 
            onClick={() => setIsExpanded(true)} // 👈 Clicking opens full comments
            style={{ 
              marginBottom: '16px', 
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <div style={{ 
              marginLeft: '0',
              position: 'relative',
              paddingBottom: '12px'
            }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flexShrink: 0, marginTop: '4px' }}>
                  {getAvatar(latestComment.comment)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    backgroundColor: '#F9FAFB',
                    borderRadius: '12px',
                    padding: '12px',
                    border: '1px solid #E5E7EB'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginBottom: '4px',
                      flexWrap: 'wrap'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ 
                          fontWeight: 600, 
                          color: '#1F2937',
                          fontSize: '0.875rem'
                        }}>
                          {latestComment.comment.author_name}
                        </span>
                        {latestComment.comment.is_anonymous && (
                          <span style={{ 
                            fontSize: '0.75rem',
                            backgroundColor: '#FEF3C7',
                            color: '#92400E',
                            padding: '2px 6px',
                            borderRadius: '9999px',
                            fontWeight: 500
                          }}>
                            Anonymous
                          </span>
                        )}
                      </div>
                      <span style={{ 
                        color: '#6B7280', 
                        fontSize: '0.75rem',
                        whiteSpace: 'nowrap'
                      }}>
                        {formatDistanceToNow(new Date(latestComment.comment.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p style={{ 
                      color: '#374151', 
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      fontSize: '0.875rem'
                    }}>
                      {latestComment.comment.content}
                    </p>
                  </div>

                  {/* Preview actions: ❤️ and 💬 */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    marginTop: '8px'
                  }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLike(latestComment.comment.id, latestComment.hasLiked);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: latestComment.hasLiked ? '#EF4444' : '#6B7280',
                        fontSize: '0.75rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: '6px'
                      }}
                    >
                      <Heart 
                        size={12} 
                        style={{ 
                          fill: latestComment.hasLiked ? '#EF4444' : 'none', 
                          stroke: latestComment.hasLiked ? '#EF4444' : 'currentColor' 
                        }} 
                      />
                      <span>{latestComment.comment.likes_count || 0}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(true);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#6B7280',
                        fontSize: '0.75rem',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: '6px'
                      }}
                    >
                      <MessageCircle size={12} />
                      <span>{latestComment.comment.replies_count} repl{latestComment.comment.replies_count === 1 ? 'y' : 'ies'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsExpanded(true)}
          style={{
            width: '100%',
            padding: '10px',
            background: '#F9FAFB',
            border: '1px dashed #D1D5DB',
            borderRadius: '8px',
            color: '#6B7280',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          + Add a comment
        </button>
      </div>
    );
  }

  // Expanded view
  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ 
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#1F2937'
        }}>
          {comments.length} Comment{comments.length !== 1 ? 's' : ''}
        </h3>
        <button
          onClick={() => setIsExpanded(false)}
          style={{
            color: '#6B7280',
            background: 'none',
            border: 'none',
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          Show preview only
        </button>
      </div>

      {/* Main Comment Form */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div style={{ flexShrink: 0 }}>
            {currentUser.isAnonymous ? (
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '9999px',
                backgroundColor: '#FEF3C7',
                border: '1px solid #FDE68A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ color: '#92400E', fontWeight: 600, fontSize: '1rem' }}>A</span>
              </div>
            ) : currentUser.avatarUrl ? (
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '9999px',
                overflow: 'hidden',
                border: '1px solid #FDE68A'
              }}>
                <Image 
                  src={currentUser.avatarUrl} 
                  alt="Your avatar" 
                  width={40} 
                  height={40}
                  style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                />
              </div>
            ) : (
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '9999px',
                backgroundColor: '#FEF3C7',
                border: '1px solid #FDE68A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ color: '#92400E', fontWeight: 600, fontSize: '1rem' }}>
                  {currentUser.fullName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>
          
          <div style={{ flex: 1 }}>
            <textarea
              ref={textareaRef}
              value={newTopLevelComment}
              onChange={(e) => {
                setNewTopLevelComment(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Add a comment..."
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #D1D5DB',
                borderRadius: '12px',
                fontSize: '0.875rem',
                resize: 'none',
                minHeight: '48px',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = '#F59E0B'}
              onBlur={(e) => e.currentTarget.style.borderColor = '#D1D5DB'}
            />
            
            {error && (
              <div style={{ 
                marginTop: '8px', 
                color: '#EF4444', 
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <X size={14} />
                {error}
              </div>
            )}
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              marginTop: '12px'
            }}>
              <button
                onClick={() => handleSubmit()}
                disabled={!newTopLevelComment.trim() || isSubmitting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: windowWidth < MOBILE_BREAKPOINT ? '8px' : '8px 16px',
                  backgroundColor: !newTopLevelComment.trim() || isSubmitting ? '#E5E7EB' : '#F59E0B',
                  color: !newTopLevelComment.trim() || isSubmitting ? '#9CA3AF' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 500,
                  fontSize: '0.875rem',
                  cursor: !newTopLevelComment.trim() || isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {isSubmitting ? (
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.5)',
                    borderTopColor: 'white',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                ) : windowWidth < MOBILE_BREAKPOINT ? (
                  <Send size={18} style={{ strokeWidth: 1.5 }} />
                ) : (
                  <>
                    <span>Comment</span>
                    <Send size={16} style={{ strokeWidth: 1.5 }} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {comments.map(thread => renderComment(thread))}
        
        {comments.length === 0 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '24px 0',
            color: '#6B7280',
            fontSize: '0.875rem'
          }}>
            No comments yet. Be the first to share your thoughts!
          </div>
        )}
      </div>
      
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function ReplyForm({ 
  onSubmit, 
  value, 
  onChange, 
  isSubmitting, 
  currentUser,
  isMobile
}: {
  onSubmit: () => void;
  value: string;
  onChange: (val: string) => void;
  isSubmitting: boolean;
  currentUser: CommentsSectionProps['currentUser'];
  isMobile: boolean;
}) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px' }}>
      <div style={{ flexShrink: 0, marginTop: '3px' }}>
        {currentUser.isAnonymous ? (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            backgroundColor: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: '#92400E', fontWeight: 600, fontSize: '0.75rem' }}>A</span>
          </div>
        ) : currentUser.avatarUrl ? (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            overflow: 'hidden'
          }}>
            <Image 
              src={currentUser.avatarUrl} 
              alt="Your avatar" 
              width={28} 
              height={28}
              style={{ objectFit: 'cover', width: '100%', height: '100%' }}
            />
          </div>
        ) : (
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '9999px',
            backgroundColor: '#FEF3C7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{ color: '#92400E', fontWeight: 600, fontSize: '0.75rem' }}>
              {currentUser.fullName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>
      
      <div style={{ flex: 1, position: 'relative' }}>
        <textarea
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Write a reply..."
          style={{
            width: '100%',
            padding: '8px 12px 8px 36px',
            border: '1px solid #E5E7EB',
            borderRadius: '12px',
            fontSize: '0.875rem',
            resize: 'none',
            minHeight: '36px',
            backgroundColor: '#F9FAFB'
          }}
        />
        
        <button
          type="submit"
          disabled={!value.trim() || isSubmitting}
          style={{
            position: 'absolute',
            right: '4px',
            bottom: '4px',
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            backgroundColor: !value.trim() || isSubmitting ? '#E5E7EB' : '#F59E0B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            cursor: !value.trim() || isSubmitting ? 'not-allowed' : 'pointer'
          }}
        >
          {isSubmitting ? (
            <div style={{
              width: '14px',
              height: '14px',
              border: '1.5px solid rgba(255,255,255,0.5)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }} />
          ) : (
            <Send size={14} color={!value.trim() ? '#9CA3AF' : '#FFFFFF'} style={{ strokeWidth: 1.5 }} />
          )}
        </button>
      </div>
    </form>
  );
}