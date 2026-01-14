'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface CommentWithUser {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  user?: {
    full_name?: string | null;
  };
}

interface MemoryActionsProps {
  memoryId: string;
}

export default function MemoryActions({ memoryId }: MemoryActionsProps) {
  const [heartCount, setHeartCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [hasHearted, setHasHearted] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [fullComments, setFullComments] = useState<CommentWithUser[]>([]);
  const [loadingFullComments, setLoadingFullComments] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Fetch initial stats + latest comment
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        // 1. Get heart count
        const { count: heartTotal } = await supabase
          .from('memory_hearts')
          .select('*', { count: 'exact', head: true })
          .eq('memory_id', memoryId);
        setHeartCount(heartTotal || 0);

        // 2. Get comment count
        const { count: commentTotal } = await supabase
          .from('memory_comments')
          .select('*', { count: 'exact', head: true })
          .eq('memory_id', memoryId);
        setCommentCount(commentTotal || 0);

        // 3. Get latest comment (if any)
        let initialComments: CommentWithUser[] = [];
        if (commentTotal && commentTotal > 0) {
          const { data } = await supabase
            .from('memory_comments')
            .select(`
              *,
              user:profiles!inner(full_name)
            `)
            .eq('memory_id', memoryId)
            .order('created_at', { ascending: false })
            .limit(1);
          initialComments = data || [];
        }
        setFullComments(initialComments);

        // 4. Check if user has hearted
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: existingHeart } = await supabase
            .from('memory_hearts')
            .select('id')
            .eq('memory_id', memoryId)
            .eq('user_id', user.id)
            .maybeSingle();
          setHasHearted(!!existingHeart);
        }
      } catch (err) {
        console.error('Error fetching initial data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [memoryId]);

  // Load all comments when user clicks "View all"
  const loadAllComments = async () => {
    if (fullComments.length >= commentCount) return; // already loaded all
    setLoadingFullComments(true);
    try {
      const { data } = await supabase
        .from('memory_comments')
        .select(`
          *,
          user:profiles!inner(full_name)
        `)
        .eq('memory_id', memoryId)
        .order('created_at', { ascending: false });
      setFullComments(data || []);
    } catch (err) {
      console.error('Failed to load all comments:', err);
    } finally {
      setLoadingFullComments(false);
    }
  };

  const toggleComments = () => {
    if (!showAllComments && commentCount > 1) {
      loadAllComments();
    }
    setShowAllComments(!showAllComments);
  };

  const toggleHeart = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please sign in to react.');
      return;
    }

    if (hasHearted) {
      const { error } = await supabase
        .from('memory_hearts')
        .delete()
        .eq('memory_id', memoryId)
        .eq('user_id', user.id);
      if (error) {
        console.error('Unlike failed:', error);
        return;
      }
      setHeartCount((prev) => Math.max(0, prev - 1));
      setHasHearted(false);
    } else {
      const { error } = await supabase
        .from('memory_hearts')
        .insert({ memory_id: memoryId, user_id: user.id });
      if (error) {
        console.error('Like failed:', error);
        return;
      }
      setHeartCount((prev) => prev + 1);
      setHasHearted(true);
    }
  };

  const handlePostComment = async () => {
    const trimmed = commentContent.trim();
    if (!trimmed) {
      setSubmitError('Please enter a message.');
      return;
    }
    if (trimmed.length > 500) {
      setSubmitError('Message is too long (max 500 characters).');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitError('You must be signed in to comment.');
      return;
    }

    setIsPosting(true);
    setSubmitError(null);

    const { error } = await supabase
      .from('memory_comments')
      .insert({
        memory_id: memoryId,
        user_id: user.id,
        content: trimmed,
      });

    setIsPosting(false);
    if (error) {
      console.error('Comment submit error:', error);
      setSubmitError('Failed to post. Please try again.');
    } else {
      setCommentContent('');
      setCommentCount((prev) => prev + 1);

      // Optimistic update: add to top
      const newComment: CommentWithUser = {
        id: crypto.randomUUID(),
        content: trimmed,
        user_id: user.id,
        created_at: new Date().toISOString(),
        user: { full_name: (user.user_metadata.full_name as string | undefined) ?? null },
      };

      // If we were showing only 1, now show at least 2
      if (fullComments.length === 1 || !showAllComments) {
        setFullComments([newComment, ...fullComments]);
        setShowAllComments(true); // auto-expand on first reply
      } else {
        setFullComments([newComment, ...fullComments]);
      }
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '0.25rem 0.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>
        ...
      </div>
    );
  }

  // Determine what to show
  const displayedComments = showAllComments ? fullComments : fullComments.slice(0, 1);

  return (
    <div>
      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
        <button
          onClick={toggleHeart}
          style={{
            background: 'none',
            border: 'none',
            color: hasHearted ? '#ef4444' : '#64748b',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          {hasHearted ? '❤️' : '🤍'} {heartCount}
        </button>

        <button
          onClick={toggleComments}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          💬 {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
        </button>
      </div>

      {/* Comments Preview or Full List */}
      {commentCount > 0 && (
        <div
          style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '1px solid #e2e8f0',
            overflow: 'visible',
            position: 'relative',
          }}
        >
          {displayedComments.map((comment) => (
            <div
              key={comment.id}
              style={{
                marginBottom: '0.75rem',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}
            >
              <strong style={{ color: '#1e293b' }}>
                {comment.user?.full_name || 'Anonymous'}
              </strong>
              <div style={{ color: '#334155', marginTop: '0.25rem' }}>{comment.content}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                {new Date(comment.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}

          {/* View All / Collapse Button */}
          {commentCount > 1 && (
            <button
              onClick={toggleComments}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                fontSize: '0.85rem',
                fontWeight: '600',
                marginBottom: '1rem',
              }}
            >
              {showAllComments ? '▲ Show less' : `▼ View all ${commentCount} comments`}
            </button>
          )}

          {/* Comment Input */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Share a kind word or memory..."
              rows={2}
              style={{
                flex: 1,
                padding: '0.5rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.9rem',
                fontFamily: 'inherit',
                resize: 'none',
              }}
              maxLength={500}
            />
            <button
              onClick={handlePostComment}
              disabled={isPosting || !commentContent.trim()}
              style={{
                padding: '0.375rem 0.75rem',
                background: isPosting ? '#94a3b8' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                cursor: isPosting ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                fontSize: '0.9rem',
              }}
            >
              {isPosting ? 'Posting...' : 'Post'}
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
              {500 - commentContent.length} characters remaining
            </span>
            {submitError && (
              <span style={{ color: '#d32f2f', fontSize: '0.8rem' }}>
                {submitError}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}