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
  styleOverrides = {}
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
        // Fetch hearts count
        const { count: heartTotal, error: heartError } = await supabase
          .from(heartsTable)
          .select('*', { count: 'exact', head: true })
          .eq(idColumn, itemId);
        
        if (heartError) throw heartError;
        setHeartCount(heartTotal || 0);

        // Fetch comments count
        const { count: commentTotal, error: commentError } = await supabase
          .from(commentsTable)
          .select('*', { count: 'exact', head: true })
          .eq(idColumn, itemId);
        
        if (commentError) throw commentError;
        setCommentCount(commentTotal || 0);

        // Fetch actual comments with user names
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

        // Check if current user has hearted
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
        setHeartCount(prev => Math.max(0, prev - 1));
        setHasHearted(false);
      } else {
        const { error } = await supabase
          .from(heartsTable)
          .insert({ [idColumn]: itemId, user_id: user.id });
        
        if (error) throw error;
        setHeartCount(prev => prev + 1);
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
      setCommentCount(prev => prev + 1);
      
      // Optimistic UI update
      const newComment = {
        id: Date.now().toString(),
        content: trimmed,
        user_id: user.id,
        created_at: new Date().toISOString(),
        user: { full_name: 'You' }
      };
      
      setComments(prev => [newComment, ...prev]);
      
      // Refresh actual comments after 1s for consistency
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
      <div style={{ 
        ...baseStyles.container, 
        ...styleOverrides,
        ...baseStyles.loading 
      }}>
        ...
      </div>
    );
  }

  return (
    <div style={{ 
      ...baseStyles.container, 
      ...styleOverrides,
      marginTop: '1rem'
    }}>
      {/* Hearts & Comments Bar */}
      <div style={baseStyles.bar}>
        <button
          onClick={toggleHeart}
          style={baseStyles.button}
          aria-label={hasHearted ? 'Remove heart' : 'Add heart'}
        >
          {hasHearted ? '❤️' : '🤍'} {heartCount}
        </button>
        
        {allowComments && (
          <button
            onClick={() => setShowCommentInput(!showCommentInput)}
            style={baseStyles.button}
            aria-label="Toggle comments"
          >
            💬 {commentCount}
          </button>
        )}
      </div>

      {/* Inline Comment Input + Existing Comments */}
      {showCommentInput && allowComments && (
        <div style={baseStyles.commentSection}>
          <div style={baseStyles.inputContainer}>
            <textarea
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              placeholder="Share a kind word or memory..."
              rows={2}
              style={baseStyles.textarea}
              maxLength={500}
            />
            <button
              onClick={handlePostComment}
              disabled={isPosting || !commentContent.trim()}
              style={{
                ...baseStyles.postButton,
                background: isPosting ? '#94a3b8' : '#3b82f6',
                cursor: isPosting ? 'not-allowed' : 'pointer'
              }}
            >
              {isPosting ? 'Posting...' : 'Post'}
            </button>
          </div>
          
          <div style={baseStyles.statusContainer}>
            <span style={baseStyles.charCount}>
              {500 - commentContent.length} characters remaining
            </span>
            {submitError && (
              <span style={baseStyles.error}>
                {submitError}
              </span>
            )}
          </div>

          {/* Existing Comments */}
          {comments.length > 0 && (
            <div style={baseStyles.commentsList}>
              <h4 style={baseStyles.commentsHeader}>
                {comments.length} Comment{comments.length !== 1 ? 's' : ''}
              </h4>
              {comments.map((comment) => (
                <div key={comment.id} style={baseStyles.commentItem}>
                  <strong style={baseStyles.commentAuthor}>
                    {comment.user?.full_name || 'Anonymous'}
                  </strong>
                  <div style={baseStyles.commentContent}>{comment.content}</div>
                  <div style={baseStyles.commentDate}>
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

// Base styles for consistent theming
const baseStyles = {
  container: {
    width: '100%',
    fontSize: '0.75rem',
  },
  loading: {
    padding: '0.25rem 0.5rem',
    background: 'rgba(0,0,0,0.7)',
    color: 'white',
    borderRadius: '8px',
    textAlign: 'center' as const,
  },
  bar: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.25rem 0.5rem',
    background: 'rgba(0,0,0,0.7)',
    borderRadius: '8px',
    color: 'white',
  },
  button: {
    background: 'none',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    fontWeight: 'bold' as const,
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: 0,
  },
  commentSection: {
    marginTop: '0.5rem',
  },
  inputContainer: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'flex-start',
  },
  textarea: {
    flex: 1,
    padding: '0.5rem',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    resize: 'none' as const,
  },
  postButton: {
    padding: '0.375rem 0.75rem',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600' as const,
    whiteSpace: 'nowrap' as const,
    fontSize: '0.9rem',
    alignSelf: 'flex-start' as const,
  },
  statusContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '0.25rem',
    fontSize: '0.8rem',
  },
  charCount: {
    color: '#94a3b8',
  },
  error: {
    color: '#d32f2f',
  },
  commentsList: {
    marginTop: '1rem',
    borderTop: '1px solid #e2e8f0',
    paddingTop: '0.5rem',
  },
  commentsHeader: {
    margin: '0 0 0.5rem',
    fontSize: '0.9rem',
    fontWeight: '600' as const,
    color: '#1e293b',
  },
  commentItem: {
    marginBottom: '0.75rem',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  commentAuthor: {
    color: '#1e293b',
    display: 'block',
  },
  commentContent: {
    color: '#334155',
    marginTop: '0.25rem',
  },
  commentDate: {
    fontSize: '0.75rem',
    color: '#94a3b8',
    marginTop: '0.25rem',
  },
} as const;