'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';

interface HeartsAndCommentsProps {
  itemId: string;
  itemType: 'angel' | 'memory';
  allowComments?: boolean;
  styleOverrides?: React.CSSProperties;
}

interface CommentWithUser {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  user?: {
    full_name?: string | null;
  };
}

export default function HeartsAndComments({
  itemId,
  itemType,
  allowComments = true,
  styleOverrides = {},
}: HeartsAndCommentsProps) {
  const [heartCount, setHeartCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [hasHearted, setHasHearted] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [commentContent, setCommentContent] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<CommentWithUser[]>([]);
  const supabase = createClient();

  const tableName = itemType === 'angel' ? 'angel' : 'memory';
  const heartsTable = `${tableName}_hearts`;
  const commentsTable = `${tableName}_comments`;
  const idColumn = `${tableName}_id`;

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { count: heartTotal, error: heartError } = await supabase
          .from(heartsTable)
          .select('*', { count: 'exact', head: true })
          .eq(idColumn, itemId);

        if (heartError) throw heartError;
        setHeartCount(heartTotal || 0);

        const { count: commentTotal, error: commentError } = await supabase
          .from(commentsTable)
          .select('*', { count: 'exact', head: true })
          .eq(idColumn, itemId);

        if (commentError) throw commentError;
        setCommentCount(commentTotal || 0);

        const { data: commentData, error: commentsError } = await supabase
          .from(commentsTable)
          .select(`
            *,
            user:profiles!inner(full_name)
          `)
          .eq(idColumn, itemId)
          .order('created_at', { ascending: false });

        if (commentsError) throw commentsError;
        setComments(commentData || []);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: existingHeart } = await supabase
            .from(heartsTable)
            .select('id')
            .eq(idColumn, itemId)
            .eq('user_id', user.id)
            .maybeSingle();

          setHasHearted(!!existingHeart);
        }
      } catch (err) {
        console.error(`Error fetching ${itemType} stats:`, err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [itemId, itemType]);

  const toggleHeart = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Please sign in to react.');
      return;
    }

    try {
      if (hasHearted) {
        const { error } = await supabase
          .from(heartsTable)
          .delete()
          .eq(idColumn, itemId)
          .eq('user_id', user.id);

        if (error) throw error;
        setHeartCount((prev) => Math.max(0, prev - 1));
        setHasHearted(false);
      } else {
        const { error } = await supabase
          .from(heartsTable)
          .insert({ [idColumn]: itemId, user_id: user.id });

        if (error) throw error;
        setHeartCount((prev) => prev + 1);
        setHasHearted(true);
      }
    } catch (err) {
      console.error('Heart toggle failed:', err);
      alert('Failed to update reaction. Please try again.');
    }
  };

  const handlePostComment = async () => {
    if (!allowComments) return;

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

    try {
      const { error } = await supabase
        .from(commentsTable)
        .insert({
          [idColumn]: itemId,
          user_id: user.id,
          content: trimmed,
        });

      if (error) throw error;

      setCommentContent('');
      setCommentCount((prev) => prev + 1);

      const newComment = {
        id: Date.now().toString(),
        content: trimmed,
        user_id: user.id,
        created_at: new Date().toISOString(),
        user: { full_name: 'You' },
      };

      setComments((prev) => [newComment, ...prev]);

      setTimeout(async () => {
        const { data: freshComments } = await supabase
          .from(commentsTable)
          .select(`
            *,
            user:profiles!inner(full_name)
          `)
          .eq(idColumn, itemId)
          .order('created_at', { ascending: false });

        setComments(freshComments || []);
      }, 1000);
    } catch (err) {
      console.error('Comment submit error:', err);
      setSubmitError('Failed to post. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: '8px',
          backgroundColor: '#333',
          color: 'white',
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '14px',
          ...styleOverrides,
        }}
      >
        ...
      </div>
    );
  }

  return (
    <div style={{ width: '100%', fontSize: '14px', ...styleOverrides }}>
      {/* Hearts & Comments Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '6px 10px',
          backgroundColor: '#333',
          color: 'white',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
        }}
      >
        <button
          onClick={toggleHeart}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: 0,
            fontSize: '14px',
          }}
          aria-label={hasHearted ? 'Remove heart' : 'Add heart'}
        >
          {hasHearted ? '❤️' : '🤍'} {heartCount}
        </button>

        {allowComments && (
          <button
            onClick={() => setShowCommentInput(!showCommentInput)}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: 0,
              fontSize: '14px',
            }}
            aria-label="Toggle comments"
          >
            💬 {commentCount}
          </button>
        )}
      </div>

      {/* Inline Comment Input + Existing Comments */}
      {showCommentInput && allowComments && (
        <div style={{ marginTop: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Share a kind word or memory..."
              rows={2}
              style={{
                flex: 1,
                padding: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'none',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px',
                borderBottomLeftRadius: '6px',
                borderBottomRightRadius: '6px',
              }}
              maxLength={500}
            />
            <button
              onClick={handlePostComment}
              disabled={isPosting || !commentContent.trim()}
              style={{
                padding: '6px 12px',
                color: 'white',
                border: 'none',
                backgroundColor: isPosting ? '#94a3b8' : '#3b82f6',
                cursor: isPosting ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                whiteSpace: 'nowrap',
                fontSize: '14px',
                alignSelf: 'flex-start',
                borderTopLeftRadius: '6px',
                borderTopRightRadius: '6px',
                borderBottomLeftRadius: '6px',
                borderBottomRightRadius: '6px',
              }}
            >
              {isPosting ? 'Posting...' : 'Post'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '4px',
              fontSize: '12px',
            }}
          >
            <span style={{ color: '#94a3b8' }}>
              {500 - commentContent.length} characters remaining
            </span>
            {submitError && <span style={{ color: '#d32f2f' }}>{submitError}</span>}
          </div>

          {/* Existing Comments */}
          {comments.length > 0 && (
            <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                {comments.length} Comment{comments.length !== 1 ? 's' : ''}
              </h4>
              {comments.map((comment) => (
                <div key={comment.id} style={{ marginBottom: '12px', fontSize: '14px', lineHeight: 1.5 }}>
                  <strong style={{ color: '#1e293b', display: 'block' }}>
                    {comment.user?.full_name || 'Anonymous'}
                  </strong>
                  <div style={{ color: '#334155', marginTop: '4px' }}>{comment.content}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                    {new Date(comment.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}