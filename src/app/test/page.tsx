'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Phone, Users, User, MoreVertical, AlertTriangle, Camera } from 'lucide-react';
import Link from 'next/link';
import ReportModal from '@/components/modals/ReportModal';
import { useCall } from '@/context/CallContext';
import { useAuth } from '@/hooks/useAuth';

interface CallHistoryItem {
  id: string;
  type: 'one-on-one' | 'group';
  room_id: string;
  started_at: string;
  otherParticipant?: { 
    id: string; 
    name: string;
    avatar_url?: string;
  };
}

export default function CallHistoryPage() {
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();
const [reportTarget, setReportTarget] = useState<{ id: string; type: 'call' } | null>(null);
 const [currentUserId, setCurrentUserId] = useState<string | null>(null);
const { startCall } = useCall();
const { user: currentUser } = useAuth(); 
useEffect(() => {
    const fetchCallHistory = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push('/auth');
          return;
        }
        const userId = session.user.id;
        setCurrentUserId(userId); 

        // === 1:1 Calls ===
        const { data: oneOnOneCalls, error: oneOnError } = await supabase
          .from('quick_connect_requests')
          .select('room_id, user_id, acceptor_id, call_started_at')
          .or(`user_id.eq.${userId},acceptor_id.eq.${userId}`)
          .not('call_started_at', 'is', null)
          .order('call_started_at', { ascending: false });

        if (oneOnError) throw oneOnError;

        // === Group Calls: get rooms user joined, then check if call_started_at exists ===
        const { data: groupRooms, error: groupRoomError } = await supabase
          .from('room_participants')
          .select('room_id')
          .eq('user_id', userId);

        if (groupRoomError) throw groupRoomError;

        let groupCalls: { room_id: string; call_started_at: string }[] = [];
        if (groupRooms.length > 0) {
          const roomIds = groupRooms.map(r => r.room_id);
          const { data: groupData, error: groupError } = await supabase
            .from('quick_group_requests')
            .select('room_id, call_started_at')
            .in('room_id', roomIds)
            .not('call_started_at', 'is', null)
            .order('call_started_at', { ascending: false });

          if (groupError) throw groupError;
          groupCalls = groupData || [];
        }

        // === Fetch participant names and avatar URLs for 1:1 ===
        const participantIds = new Set<string>();
        oneOnOneCalls.forEach(call => {
          if (call.user_id !== userId) participantIds.add(call.user_id);
          if (call.acceptor_id !== userId) participantIds.add(call.acceptor_id);
        });

        const profileMap = new Map<string, { name: string; avatar_url?: string }>();
        if (participantIds.size > 0) {
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url') // Added avatar_url
            .in('id', Array.from(participantIds));

          if (profileError) throw profileError;
          
          profiles?.forEach(p => {
            profileMap.set(p.id, {
              name: p.full_name || p.email || 'Anonymous',
              avatar_url: p.avatar_url
            });
          });
        }

        // === Build history ===
        const historyItems: CallHistoryItem[] = [];

        oneOnOneCalls.forEach(call => {
          const otherId = call.user_id === userId ? call.acceptor_id : call.user_id;
          const profile = profileMap.get(otherId) || { name: 'Unknown' };
          
          historyItems.push({
            id: call.room_id,
            type: 'one-on-one',
            room_id: call.room_id,
            started_at: call.call_started_at,
            otherParticipant: {
              id: otherId,
              name: profile.name,
              avatar_url: profile.avatar_url
            },
          });
        });

        groupCalls.forEach(call => {
          historyItems.push({
            id: call.room_id,
            type: 'group',
            room_id: call.room_id,
            started_at: call.call_started_at,
          });
        });

        historyItems.sort((a, b) =>
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        );

        setCalls(historyItems);
      } catch (err) {
        console.error('Call history error:', err);
        const errorMessage = err instanceof Error 
          ? err.message 
          : 'Failed to load call history';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchCallHistory();
  }, [supabase, router]);

  const formatDate = (isoString: string): string => {
    return new Date(isoString).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };


  const handleReCall = async (call: CallHistoryItem) => {
  if (call.type === 'group') {
    // Optional: handle group re-call differently, or disable
    // For now, we'll skip group re-calls
    alert('Rejoining group calls is not supported yet.');
    return;
  }

  if (!call.otherParticipant?.id || !call.otherParticipant?.name) {
    console.warn('Missing participant info for re-call');
    return;
  }

  // Match the profile page's call signature
  await startCall(
    call.otherParticipant.id,           // recipientId
    call.otherParticipant.name,         // recipientName
    'audio',                            // callType
    currentUser?.id || currentUserId!,  // callerId — fix the bug!
    call.room_id                        // roomId (can be reused or generate new)
  );
};

 const handleReport = (callId: string) => {
  setReportTarget({ id: callId, type: 'call' });
  setOpenMenuId(null); // Close kebab menu
};

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        paddingTop: '4rem',
        
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: 'white',
          borderRadius: '1.5rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}>
          <Phone size={48} style={{ color: '#3b82f6', margin: '0 auto 1rem' }} />
          <p style={{ color: '#6b7280', fontSize: '1.125rem' }}>Loading call history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        paddingTop: '4rem',
        padding: '1rem',
        textAlign: 'center'
      }}>
        <AlertTriangle size={48} style={{ color: '#ef4444', margin: '0 auto 1.5rem' }} />
        <h2 style={{ 
          fontSize: '1.875rem',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '0.5rem'
        }}>Error Loading History</h2>
        <p style={{ 
          color: '#6b7280',
          maxWidth: '42rem',
          margin: '0 auto 1.5rem'
        }}>{error}</p>
        <button
          onClick={() => router.refresh()}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '0.75rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={e => e.currentTarget.style.backgroundColor = '#1d4ed8'}
          onMouseOut={e => e.currentTarget.style.backgroundColor = '#2563eb'}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      paddingTop: '4rem',
      paddingBottom: '2rem',
      padding: '1rem'
    }}>
      <div style={{ maxWidth: '42rem', margin: '0 auto' }}>
        <h1 style={{ 
          fontSize: '1.875rem',
          fontWeight: '700',
          color: '#111827',
          textAlign: 'center',
          marginBottom: '1.5rem'
        }}>Call History</h1>

        {calls.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            padding: '2.5rem',
            textAlign: 'center'
          }}>
            <Phone size={40} style={{ color: '#9ca3af', margin: '0 auto 1rem' }} />
            <p style={{ color: '#6b7280', fontSize: '1.125rem', marginBottom: '0.75rem' }}>
              No calls in your history yet
            </p>
            <Link 
              href="/connect"
              style={{
                color: '#2563eb',
                textDecoration: 'none',
                fontSize: '0.875rem',
                display: 'inline-block',
                marginTop: '0.5rem'
              }}
              onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
              onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
            >
              Start a new conversation
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {calls.map((call) => (
              <div 
                key={call.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: '1.5rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '1rem',
                  position: 'relative'
                }}
              >
                <div style={{ marginTop: '0.25rem' }}>
                  {call.type === 'group' ? (
                    <div style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '9999px',
                      backgroundColor: '#f3e8ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Users size={20} style={{ color: '#7e22ce' }} />
                    </div>
                  ) : (
                    <div style={{
                      width: '2.5rem',
                      height: '2.5rem',
                      borderRadius: '9999px',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {call.otherParticipant?.avatar_url ? (
                        <img 
                          src={call.otherParticipant.avatar_url} 
                          alt="Avatar" 
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : (
                        <div style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: '#dbeafe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <User size={20} style={{ color: '#2563eb' }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ 
                    fontWeight: '600', 
                    color: '#111827', 
                    fontSize: '1.125rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {call.type === 'group'
                      ? 'Group Session'
                      : call.otherParticipant?.name || 'Private Session'}
                  </h3>
                  <p style={{ 
                    color: '#6b7280', 
                    fontSize: '0.875rem',
                    marginTop: '0.25rem'
                  }}>
                    {formatDate(call.started_at)}
                  </p>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'flex-end',
                  gap: '0.5rem'
                }}>
                  <button
  onClick={() => handleReCall(call)}
  style={{
    padding: '0.375rem 0.75rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '500',
    cursor: 'pointer',
  }}
  onMouseOver={e => e.currentTarget.style.backgroundColor = '#2563eb'}
  onMouseOut={e => e.currentTarget.style.backgroundColor = '#3b82f6'}
>
  📞 Call
</button>
                  <div style={{ position: 'relative' }}>
                    <button
                      onClick={() => setOpenMenuId(openMenuId === call.id ? null : call.id)}
                      style={{
                        width: '2rem',
                        height: '2rem',
                        borderRadius: '0.5rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: '#f3f4f6',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                      aria-label="Call options"
                    >
                      <MoreVertical size={18} style={{ color: '#4b5563' }} />
                    </button>
                    
                    {openMenuId === call.id && (
                      <div style={{
                        position: 'absolute',
                        right: 0,
                        top: '2.5rem',
                        width: '12rem',
                        backgroundColor: 'white',
                        borderRadius: '0.75rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        border: '1px solid #e5e7eb',
                        zIndex: 50,
                        padding: '0.25rem'
                      }}>
                        <button
                          onClick={() => handleReport(call.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '0.5rem',
                            width: '100%',
                            textAlign: 'left',
                            border: 'none',
                            backgroundColor: 'transparent',
                            cursor: 'pointer'
                          }}
                          onMouseOver={e => e.currentTarget.style.backgroundColor = '#f9fafb'}
                          onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                          <span style={{ color: '#111827', fontSize: '0.875rem' }}>Report</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {reportTarget && currentUserId && (
  <ReportModal
    isOpen={true}
    onClose={() => setReportTarget(null)}
    targetId={reportTarget.id}
    targetType="call"
    currentUserId={currentUserId}
    // Optional: pass call duration if you track it
    // For now, we'll omit it or compute it later
    participants={
      calls
        .find(c => c.id === reportTarget.id && c.type === 'group')
        ? [] // You’d need to fetch group participants separately if needed
        : calls
            .filter(c => c.id === reportTarget.id && c.type === 'one-on-one')
            .map(c => ({
              id: c.otherParticipant!.id,
              name: c.otherParticipant!.name,
            }))
    }
  />
)}
    </div>
    
  );
}