'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { useRouter } from 'next/navigation';

// Minimal type for emoji object — avoids import issues and satisfies ESLint
interface EmojiMartEmoji {
  native: string;
}

type Props = {
  isOpen: boolean;
  targetUserId: string;
  targetName: string;
  onClose: () => void;
};

export default function SendMessageOverlay({ 
  isOpen, 
  targetUserId, 
  targetName, 
  onClose 
}: Props) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter(); 

  useEffect(() => {
    if (!isOpen) return;
    
    const initConversation = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          onClose();
          return;
        }
        
        const currentUserId = session.user.id;
        
        // Check for existing conversation
        const { data: existingConvs, error: fetchError } = await supabase
          .from('conversations')
          .select('id')
          .or(
            `and(user1_id.eq.${currentUserId},user2_id.eq.${targetUserId}),` +
            `and(user1_id.eq.${targetUserId},user2_id.eq.${currentUserId})`
          );
        
        if (fetchError) throw fetchError;
        
        if (existingConvs && existingConvs.length > 0) {
          setConversationId(existingConvs[0].id);
        } else {
          // Create new conversation
          const user1 = currentUserId < targetUserId ? currentUserId : targetUserId;
          const user2 = currentUserId > targetUserId ? currentUserId : targetUserId;
          
          const { data: newConv, error: insertError } = await supabase
            .from('conversations')
            .insert({ 
              user1_id: user1, 
              user2_id: user2 
            })
            .select('id')
            .single();
            
          if (insertError) throw insertError;
          setConversationId(newConv.id);
        }
      } catch (err) {
        console.error('Failed to initialize conversation:', err);
        onClose();
      } finally {
        setLoading(false);
      }
    };
    
    initConversation();
  }, [isOpen, targetUserId, targetName, onClose, supabase]);

  const handleSend = async () => {
  if (!message.trim() || !conversationId) return;

  setIsSending(true);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      onClose();
      return;
    }

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: session.user.id,
        content: message.trim(),
      });

    if (error) throw error;

    // ✅ Redirect to messages page
    router.push(`/messages/${conversationId}`);
    
    // Close overlay after navigation (optional, but safe)
    onClose();
  } catch (err) {
    console.error('Failed to send message:', err);
    alert('Failed to send message. Please try again.');
  } finally {
    setIsSending(false);
  }
};

  const handleEmojiSelect = (emoji: EmojiMartEmoji) => {
    setMessage(prev => prev + emoji.native);
    setShowEmoji(false);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  // Close emoji picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.emoji-picker-container')) {
        setShowEmoji(false);
      }
    };
    
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflow: 'hidden',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #f1f5f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              color: '#1e293b',
              margin: 0
            }}>
              Message {targetName}
            </h2>
            <p style={{ 
              fontSize: '14px', 
              color: '#64748b', 
              margin: '4px 0 0'
            }}>
              Send a private message
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#64748b',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            ✕
          </button>
        </div>
        
        {/* Content */}
        <div style={{ padding: '20px', minHeight: '200px' }}>
          {loading ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '150px' 
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                border: '3px solid #cbd5e1',
                borderTopColor: '#6366f1',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 12px'
              }}></div>
              <p style={{ color: '#64748b' }}>Setting up conversation...</p>
              <style>{`
                @keyframes spin {
                  to { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          ) : !conversationId ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ color: '#ef4444' }}>Failed to start conversation. Please try again later.</p>
              <button
                onClick={onClose}
                style={{
                  marginTop: '16px',
                  padding: '8px 16px',
                  backgroundColor: '#4f46e5',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '60px' }}>
              <div className="emoji-picker-container" style={{ position: 'relative' }}>
                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  alignItems: 'center',
                  position: 'relative'
                }}>
                  <button
                    type="button"
                    onClick={() => setShowEmoji(!showEmoji)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '20px',
                      cursor: 'pointer',
                      color: '#64748b',
                      padding: '8px'
                    }}
                  >
                    😊
                  </button>
                  
                  <input
                    ref={inputRef}
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message... Be kind, be present."
                    disabled={isSending}
                    style={{
                      flex: 1,
                      padding: '14px 20px',
                      borderRadius: '14px',
                      border: '1px solid #e2e8f0',
                      fontSize: '15px',
                      backgroundColor: '#f8fafc',
                      color: '#1e293b'
                    }}
                  />
                  
                  <button
                    type="submit"
                    disabled={!message.trim() || isSending}
                    style={{
                      padding: '14px 24px',
                      borderRadius: '14px',
                      border: 'none',
                      backgroundColor: message.trim() && !isSending ? '#4f46e5' : '#cbd5e1',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '15px',
                      cursor: message.trim() && !isSending ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {isSending ? 'Sending...' : 'Send'}
                  </button>
                </div>
                
                {showEmoji && (
                  <div style={{
                    position: 'absolute',
                    bottom: '60px',
                    left: 0,
                    zIndex: 100,
                    boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    width: '100%'
                  }}>
                    <Picker
                      data={data}
                      onEmojiSelect={handleEmojiSelect}
                      theme="light"
                      previewPosition="none"
                      maxFrequentRows={0}
                      navPosition="none"
                      skinTonePosition="none"
                      perLine={8}
                    />
                  </div>
                )}
              </div>
              
              <div style={{ 
                fontSize: '13px', 
                color: '#64748b', 
                textAlign: 'center',
                padding: '0 10px'
              }}>
                Messages are end-to-end encrypted and only visible to you and {targetName}.
              </div>
            </form>
          )}
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid #f1f5f6',
          backgroundColor: '#f8fafc',
          fontSize: '13px',
          color: '#64748b',
          textAlign: 'center'
        }}>
          By sending a message, you agree to our Community Guidelines and Privacy Policy.
        </div>
      </div>
    </div>
  );
}