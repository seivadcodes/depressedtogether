'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Phone, MessageCircle, Clock, Users, Brain, Heart } from 'lucide-react';
import Image from 'next/image';

interface UserProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  accepts_calls?: boolean;
}

interface OneOnOneRequest {
  id: string;
  user_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  room_id?: string;
  acceptor_id?: string;
  user?: UserProfile;
  context?: string | null;
}

interface GroupRequest {
  id: string;
  user_id: string;
  status: string;
  expires_at: string;
  created_at: string;
  room_id?: string;
  user?: UserProfile;
  context?: string | null;
}

interface AvailableRequest extends OneOnOneRequest, GroupRequest {
  type: 'one-on-one' | 'group';
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f0ff 50%, #d9e7ff 100%)',
    padding: '3rem 1rem 1.5rem',
  },
  maxWidth: {
    maxWidth: '56rem',
    margin: '0 auto',
  },
  sectionGap: { marginBottom: '2rem' },
  card: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(10px)',
    borderRadius: '1rem',
    border: '1px solid rgba(96, 165, 250, 0.2)',
    padding: '2rem',
    textAlign: 'center' as const,
    boxShadow: '0 8px 32px rgba(59, 130, 246, 0.08)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: '800',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#4b5563',
    marginTop: '0.5rem',
    fontSize: '1.1rem',
    lineHeight: '1.6',
  },
  button: {
    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    color: '#fff',
    fontWeight: '600',
    padding: '0.875rem 2.5rem',
    borderRadius: '9999px',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    transition: 'all 0.3s ease',
    fontSize: '1rem',
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
  },
  groupButton: {
    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    boxShadow: '0 4px 15px rgba(139, 92, 246, 0.3)',
  },
  disabledButton: {
    background: '#93c5fd',
    cursor: 'not-allowed',
  },
  userAvatar: {
    width: '3.5rem',
    height: '3.5rem',
    borderRadius: '9999px',
    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    border: '3px solid #3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0 as const,
  },
  requestCard: {
    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    border: '2px solid #3b82f6',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.15)',
  },
  groupRequestCard: {
    background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
    border: '2px solid #8b5cf6',
    borderRadius: '1rem',
    padding: '1.5rem',
    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.15)',
  },
  gridItem: {
    textAlign: 'center' as const,
    padding: '1.5rem',
    background: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '0.75rem',
    border: '1px solid rgba(59, 130, 246, 0.1)',
  },
  avatarPlaceholder: {
    width: '3rem',
    height: '3rem',
    borderRadius: '9999px',
    background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    border: '2px solid #3b82f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1rem',
    flexShrink: 0 as const,
  },
};

export default function ConnectPage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeOneOnOne, setActiveOneOnOne] = useState<OneOnOneRequest | null>(null);
  const [activeGroup, setActiveGroup] = useState<GroupRequest | null>(null);
  const [availableOneOnOne, setAvailableOneOnOne] = useState<AvailableRequest[]>([]);
  const [availableGroups, setAvailableGroups] = useState<AvailableRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();
  const [isPostingOneOnOne, setIsPostingOneOnOne] = useState(false);
  const [isPostingGroup, setIsPostingGroup] = useState(false);
  const isRedirectingRef = useRef(false);
  const [acceptingRequestId, setAcceptingRequestId] = useState<string | null>(null);
  const [showContextModal, setShowContextModal] = useState<'one-on-one' | 'group' | null>(null);
  const [tempContext, setTempContext] = useState('');

  const fetchActiveOneOnOne = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('quick_connect_requests')
        .select('id, user_id, status, expires_at, created_at, room_id')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const request = data?.[0];
      if (!request) {
        setActiveOneOnOne(null);
        return;
      }
      if (request.status === 'matched' && request.room_id) {
        isRedirectingRef.current = true;
        router.push(`/room/${request.room_id}`);
        return;
      }
      if (request.status !== 'available') {
        setActiveOneOnOne(null);
        return;
      }
      setActiveOneOnOne({
        ...request,
        user: { id: userId, full_name: user?.full_name || 'Anonymous', avatar_url: user?.avatar_url || null },
      });
    } catch (err) {
      console.error('Error fetching active 1:1:', err);
    }
  }, [router, supabase, user]);

  const fetchActiveGroup = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('quick_group_requests')
        .select('id, user_id, status, expires_at, created_at, room_id')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const request = data?.[0];
      if (!request) {
        setActiveGroup(null);
        return;
      }
      if (request.status === 'matched' && request.room_id) {
        isRedirectingRef.current = true;
        router.push(`/room/${request.room_id}`);
        return;
      }
      if (request.status !== 'available') {
        setActiveGroup(null);
        return;
      }
      setActiveGroup({
        ...request,
        user: { id: userId, full_name: user?.full_name || 'Anonymous', avatar_url: user?.avatar_url || null },
      });
    } catch (err) {
      console.error('Error fetching active group:', err);
    }
  }, [router, supabase, user]);

  const fetchAvailableOneOnOne = useCallback(async (currentUserId: string, acceptsCalls: boolean | null) => {
    if (acceptsCalls === false) {
      setAvailableOneOnOne([]);
      return;
    }

    try {
      const { data: requests, error: reqError } = await supabase
        .from('quick_connect_requests')
        .select('id, created_at, user_id, status, expires_at, context')
        .eq('status', 'available')
        .neq('user_id', currentUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (reqError) throw reqError;

      const userIds = requests.map((r) => r.user_id);
      if (userIds.length === 0) {
        setAvailableOneOnOne([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p])
      );

      const formatted = requests
        .map((req) => ({
          ...req,
          type: 'one-on-one' as const,
          user: profileMap.get(req.user_id) || { id: req.user_id, full_name: 'Anonymous', avatar_url: null },
        })) as AvailableRequest[];

      setAvailableOneOnOne(formatted);
    } catch (err) {
      console.error('Error fetching available 1:1:', err);
      setAvailableOneOnOne([]);
    }
  }, [supabase]);

  const fetchAvailableGroups = useCallback(async (currentUserId: string, acceptsCalls: boolean | null) => {
    if (acceptsCalls === false) {
      setAvailableGroups([]);
      return;
    }

    try {
      const { data: requests, error: reqError } = await supabase
        .from('quick_group_requests')
        .select('id, created_at, user_id, status, expires_at, context')
        .eq('status', 'available')
        .neq('user_id', currentUserId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true });

      if (reqError) throw reqError;

      const userIds = requests.map((r) => r.user_id);
      if (userIds.length === 0) {
        setAvailableGroups([]);
        return;
      }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const profileMap = new Map(
        (profiles || []).map((p) => [p.id, p])
      );

      const formatted = requests
        .map((req) => ({
          ...req,
          type: 'group' as const,
          user: profileMap.get(req.user_id) || { id: req.user_id, full_name: 'Anonymous', avatar_url: null },
        })) as AvailableRequest[];

      setAvailableGroups(formatted);
    } catch (err) {
      console.error('Error fetching available groups:', err);
      setAvailableGroups([]);
    }
  }, [supabase]);

  useEffect(() => {
    let isMounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

    const fetchAllData = async (userId: string, acceptsCalls: boolean | null) => {
      if (acceptsCalls === false) {
        setAvailableOneOnOne([]);
        setAvailableGroups([]);
        return;
      }
      try {
        await fetchAvailableOneOnOne(userId, acceptsCalls);
        await fetchAvailableGroups(userId, acceptsCalls);
        await fetchActiveOneOnOne(userId);
        await fetchActiveGroup(userId);
      } catch (err) {
        console.error('Polling error:', err);
      }
    };

    const startPolling = (userId: string, acceptsCalls: boolean | null) => {
      if (pollInterval) return;
      const poll = () => {
        if (!isRedirectingRef.current && !document.hidden && isMounted) {
          fetchAllData(userId, acceptsCalls);
        }
      };
      pollInterval = setInterval(poll, 8000);
      poll();
    };

    const initialize = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/auth');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, accepts_calls')
          .eq('id', session.user.id)
          .single();

        if (profileError) throw profileError;

        if (isMounted) {
          setUser(profile);
          startPolling(session.user.id, profile.accepts_calls ?? null);
        }
      } catch (err) {
        console.error('Initialization error:', err);
        if (isMounted) setError('Failed to load connection requests');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    initialize();

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [
    fetchActiveOneOnOne,
    fetchActiveGroup,
    fetchAvailableOneOnOne,
    fetchAvailableGroups,
    router,
    supabase
  ]);

  const postOneOnOneWithContext = async (context: string) => {
    if (!user || activeOneOnOne || activeGroup || isPostingOneOnOne || isRedirectingRef.current) return;
    setIsPostingOneOnOne(true);
    setError(null);

    try {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('quick_connect_requests')
        .insert({
          user_id: user.id,
          status: 'available',
          expires_at: expiresAt,
          context: context.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      const { error: notifyError } = await supabase.rpc('create_targeted_notifications', {
        req_type: 'one_on_one',
        req_id: data.id,
      });

      if (notifyError) {
        console.warn('Non-critical: failed to create notifications:', notifyError.message);
      }

      setActiveOneOnOne({
        ...data,
        user: {
          id: user.id,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
        },
      });
    } catch (err) {
      console.error('Failed to post 1:1 request:', err);
      setError('Failed to create one-on-one request.');
    } finally {
      setIsPostingOneOnOne(false);
    }
  };

  const postGroupWithContext = async (context: string) => {
    if (!user || activeOneOnOne || activeGroup || isPostingGroup || isRedirectingRef.current) return;
    setIsPostingGroup(true);
    setError(null);

    try {
      const roomId = `group-call-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const { error: insertErr } = await supabase
        .from('quick_group_requests')
        .insert({
          user_id: user.id,
          status: 'available',
          expires_at: expiresAt,
          room_id: roomId,
          context: context.trim() || null,
        });

      if (insertErr) throw insertErr;

      const { error: participantErr } = await supabase
        .from('room_participants')
        .insert({
          room_id: roomId,
          user_id: user.id,
          role: 'host',
        });

      if (participantErr) throw participantErr;

      const { data: reqData, error: fetchErr } = await supabase
        .from('quick_group_requests')
        .select('id')
        .eq('room_id', roomId)
        .eq('user_id', user.id)
        .single();

      if (!fetchErr && reqData?.id) {
        const { error: notifyError } = await supabase.rpc('create_targeted_notifications', {
          req_type: 'group',
          req_id: reqData.id,
        });

        if (notifyError) {
          console.warn('Non-critical: failed to create group notifications:', notifyError.message);
        }
      }

      isRedirectingRef.current = true;
      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error('Failed to post group request:', err);
      setError('Failed to create group call request.');
    } finally {
      setIsPostingGroup(false);
    }
  };

  const cancelOneOnOne = async () => {
    if (!activeOneOnOne || isRedirectingRef.current) return;
    setActiveOneOnOne(null);

    try {
      const { error } = await supabase
        .from('quick_connect_requests')
        .update({ status: 'completed' })
        .eq('id', activeOneOnOne.id)
        .eq('status', 'available');

      if (!error) {
        await supabase
          .from('notifications')
          .delete()
          .eq('source_id', activeOneOnOne.id)
          .eq('type', 'one_on_one_request');
      }
    } catch (err) {
      console.error('Cancel 1:1 error:', err);
    }
  };

  const cancelGroup = async () => {
    if (!activeGroup || isRedirectingRef.current) return;

    try {
      const { data, error } = await supabase
        .from('quick_group_requests')
        .update({ status: 'completed' })
        .eq('id', activeGroup.id)
        .eq('status', 'available')
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        await supabase
          .from('notifications')
          .delete()
          .eq('source_id', activeGroup.id)
          .eq('type', 'group_request');
      }

      setActiveGroup(null);
    } catch (err) {
      console.error('Cancel group error:', err);
      setError('Failed to cancel group request.');
    }
  };

  const acceptOneOnOne = async (requestId: string) => {
    if (!user || isRedirectingRef.current || acceptingRequestId) return;
    
    setAcceptingRequestId(requestId);
    try {
      const roomId = `quick-connect-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      const { data: existing } = await supabase
        .from('quick_connect_requests')
        .select('*')
        .eq('id', requestId)
        .eq('status', 'available')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!existing) {
        setError('One-on-one request not found or expired.');
        setAcceptingRequestId(null);
        return;
      }

      const { error: updateErr } = await supabase
        .from('quick_connect_requests')
        .update({
          status: 'matched',
          room_id: roomId,
          acceptor_id: user.id,
        })
        .eq('id', requestId)
        .eq('status', 'available');

      if (updateErr) throw updateErr;

      await supabase.from('room_participants').upsert([
        { room_id: roomId, user_id: existing.user_id, role: 'participant' },
        { room_id: roomId, user_id: user.id, role: 'participant' }
      ], { onConflict: 'room_id,user_id' });

      isRedirectingRef.current = true;
      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error('Failed to accept 1:1:', err);
      setError('Failed to accept one-on-one request.');
    } finally {
      setAcceptingRequestId(null);
    }
  };

  const acceptGroup = async (requestId: string) => {
    if (!user || isRedirectingRef.current || acceptingRequestId) return;
    
    setAcceptingRequestId(requestId);
    try {
      const { data: existing } = await supabase
        .from('quick_group_requests')
        .select('user_id, room_id, status')
        .eq('id', requestId)
        .eq('status', 'available')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!existing) {
        setError('Group request not found or expired.');
        setAcceptingRequestId(null);
        return;
      }

      let roomId = existing.room_id;
      if (!roomId) {
        roomId = `group-call-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        const { error: updateErr } = await supabase
          .from('quick_group_requests')
          .update({ status: 'matched', room_id: roomId })
          .eq('id', requestId)
          .eq('status', 'available');
        if (updateErr) throw updateErr;
      }

      await supabase.from('room_participants').upsert(
        { room_id: roomId, user_id: user.id, role: 'participant' },
        { onConflict: 'room_id,user_id' }
      );
      await supabase.from('room_participants').upsert(
        { room_id: roomId, user_id: existing.user_id, role: 'host' },
        { onConflict: 'room_id,user_id' }
      );

      isRedirectingRef.current = true;
      router.push(`/room/${roomId}`);
    } catch (err) {
      console.error('Failed to accept group:', err);
      setError('Failed to join group call.');
    } finally {
      setAcceptingRequestId(null);
    }
  };

  const timeAgo = (timestamp: string) => {
    const now = new Date();
    const posted = new Date(timestamp);
    const diffSeconds = Math.floor((now.getTime() - posted.getTime()) / 1000);

    if (diffSeconds < 60) {
      return 'just now';
    }
    if (diffSeconds < 3600) {
      const minutes = Math.floor(diffSeconds / 60);
      return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    }
    const hours = Math.floor(diffSeconds / 3600);
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  };

  if (isLoading) {
    return (
      <div style={{ ...styles.container, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
        <div style={{ textAlign: 'center' }}>
          <Brain size={48} style={{ color: '#3b82f6', marginBottom: '1rem' }} />
          <p style={{ color: '#4b5563', fontSize: '1.125rem' }}>Loading connections...</p>
        </div>
      </div>
    );
  }

  const allRequests = [...availableOneOnOne, ...availableGroups].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div style={styles.container}>
      {error && (
        <div
          style={{
            position: 'fixed',
            top: '1rem',
            right: '1rem',
            maxWidth: '24rem',
            padding: '1rem',
            background: '#fee2e2',
            color: '#b91c1c',
            borderRadius: '0.75rem',
            boxShadow: '0 8px 25px rgba(0,0,0,0.1)',
            zIndex: 50,
            border: '1px solid #fca5a5',
          }}
        >
          {error}
        </div>
      )}
      <div style={styles.maxWidth}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Depressed Together</h1>
            <p style={styles.subtitle}>
              You are not alone. Connect with others who understand what you are going through.
              No judgments, just genuine support.
            </p>
          </div>
        </div>

        {/* One-on-One Request */}
        {activeOneOnOne ? (
          <div style={{ ...styles.requestCard, ...styles.sectionGap }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={styles.userAvatar}>
                    {user?.avatar_url ? (
                      <Image
                        src={`/api/media/avatars/${user.avatar_url}`}
                        alt={user.full_name}
                        width={56}
                        height={56}
                        className="rounded-full"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      <span style={{ color: '#1d4ed8', fontWeight: '700', fontSize: '1.25rem' }}>
                        {user?.full_name?.charAt(0) || '👤'}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 style={{ fontWeight: '700', color: '#1e40af', fontSize: '1.25rem' }}>
                      Your support request is active
                    </h2>
                    <p style={{ color: '#4b5563' }}>Waiting for someone to listen and understand</p>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#1e40af',
                    borderRadius: '9999px',
                    padding: '0.5rem 1rem',
                    width: 'fit-content',
                    marginTop: '0.75rem',
                  }}
                >
                  <Clock size={18} />
                  <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                    Expires in {Math.ceil((new Date(activeOneOnOne.expires_at).getTime() - Date.now()) / 60000)} minutes
                  </span>
                </div>
              </div>
              <button
                onClick={cancelOneOnOne}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#1e40af',
                  borderRadius: '9999px',
                  border: '1px solid #3b82f6',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fee2e2';
                  e.currentTarget.style.color = '#b91c1c';
                  e.currentTarget.style.borderColor = '#f87171';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                  e.currentTarget.style.color = '#1e40af';
                  e.currentTarget.style.borderColor = '#3b82f6';
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ ...styles.card, ...styles.sectionGap }}>
            <div style={{ ...styles.userAvatar, width: '5rem', height: '5rem', margin: '0 auto 1.5rem' }}>
              <Heart size={40} style={{ color: '#3b82f6' }} />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1e40af', marginBottom: '1rem' }}>
              Need Someone to Listen?
            </h2>
            <p style={{ color: '#4b5563', marginBottom: '2rem', maxWidth: '36rem', margin: '0 auto', lineHeight: '1.6' }}>
              Share what is on your mind with someone who gets it. One-on-one conversations can make a world of difference.
            </p>
            <button
              onClick={() => setShowContextModal('one-on-one')}
              disabled={isPostingOneOnOne || !!activeGroup || isRedirectingRef.current}
              style={{
                ...styles.button,
                ...(isPostingOneOnOne || activeGroup || isRedirectingRef.current ? styles.disabledButton : {}),
                margin: '0 auto',
              }}
              onMouseEnter={(e) => {
                if (!isPostingOneOnOne && !activeGroup && !isRedirectingRef.current) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(59, 130, 246, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isPostingOneOnOne && !activeGroup && !isRedirectingRef.current) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)';
                }
              }}
            >
              <MessageCircle size={22} /> Request One-on-One Support
            </button>
          </div>
        )}

        {/* Group Request */}
        {activeGroup ? (
          <div style={{ ...styles.groupRequestCard, ...styles.sectionGap }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                  <div style={{ ...styles.userAvatar, borderColor: '#8b5cf6' }}>
                    {user?.avatar_url ? (
                      <Image
                        src={`/api/media/avatars/${user.avatar_url}`}
                        alt={user.full_name}
                        width={56}
                        height={56}
                        className="rounded-full"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      <span style={{ color: '#7c3aed', fontWeight: '700', fontSize: '1.25rem' }}>
                        {user?.full_name?.charAt(0) || '👥'}
                      </span>
                    )}
                  </div>
                  <div>
                    <h2 style={{ fontWeight: '700', color: '#7c3aed', fontSize: '1.25rem' }}>
                      Your group support circle is open
                    </h2>
                    <p style={{ color: '#6b7280' }}>Waiting for others to join the conversation</p>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    background: 'rgba(139, 92, 246, 0.1)',
                    color: '#7c3aed',
                    borderRadius: '9999px',
                    padding: '0.5rem 1rem',
                    width: 'fit-content',
                    marginTop: '0.75rem',
                  }}
                >
                  <Clock size={18} />
                  <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                    Expires in {Math.ceil((new Date(activeGroup.expires_at).getTime() - Date.now()) / 60000)} minutes
                  </span>
                </div>
              </div>
              <button
                onClick={cancelGroup}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: 'rgba(139, 92, 246, 0.1)',
                  color: '#7c3aed',
                  borderRadius: '9999px',
                  border: '1px solid #8b5cf6',
                  cursor: 'pointer',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#fee2e2';
                  e.currentTarget.style.color = '#b91c1c';
                  e.currentTarget.style.borderColor = '#f87171';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(139, 92, 246, 0.1)';
                  e.currentTarget.style.color = '#7c3aed';
                  e.currentTarget.style.borderColor = '#8b5cf6';
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ ...styles.card, ...styles.sectionGap }}>
            <div style={{ ...styles.userAvatar, width: '5rem', height: '5rem', margin: '0 auto 1.5rem' }}>
              <Users size={40} style={{ color: '#8b5cf6' }} />
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#7c3aed', marginBottom: '1rem' }}>
              Join a Support Circle?
            </h2>
            <p style={{ color: '#4b5563', marginBottom: '2rem', maxWidth: '36rem', margin: '0 auto', lineHeight: '1.6' }}>
              Sometimes healing happens together. Start or join a group conversation where everyone understands.
            </p>
            <button
              onClick={() => setShowContextModal('group')}
              disabled={isPostingGroup || !!activeOneOnOne || isRedirectingRef.current}
              style={{
                ...styles.button,
                ...styles.groupButton,
                ...(isPostingGroup || activeOneOnOne || isRedirectingRef.current ? styles.disabledButton : {}),
                margin: '0 auto',
              }}
              onMouseEnter={(e) => {
                if (!isPostingGroup && !activeOneOnOne && !isRedirectingRef.current) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(139, 92, 246, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isPostingGroup && !activeOneOnOne && !isRedirectingRef.current) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(139, 92, 246, 0.3)';
                }
              }}
            >
              <Users size={22} /> Start Group Support Circle
            </button>
          </div>
        )}

        {/* Available Requests */}
        <div style={{ ...styles.card, ...styles.sectionGap, padding: 0, overflow: 'hidden' }}>
          <div style={{ 
            padding: '1.5rem 1.75rem', 
            borderBottom: '1px solid rgba(59, 130, 246, 0.1)', 
            background: 'linear-gradient(135deg, #f0f7ff 0%, #e6f0ff 100%)',
          }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e40af' }}>Available Support Requests</h2>
            <p style={{ color: '#4b5563', marginTop: '0.5rem' }}>
              {allRequests.length > 0
                ? 'Others are waiting to connect. You can make a difference.'
                : 'No active requests right now. Be the first to reach out.'}
            </p>
          </div>
          {allRequests.length > 0 ? (
            <div style={{ maxHeight: '500px', overflowY: 'auto', padding: '0.25rem' }}>
              {allRequests.map((request) => (
                <div
                  key={request.id}
                  onClick={() => !isRedirectingRef.current && (request.type === 'group' ? acceptGroup(request.id) : acceptOneOnOne(request.id))}
                  style={{
                    padding: '1.75rem',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    borderRadius: '0.875rem',
                    background: '#fff',
                    border: '1px solid rgba(59, 130, 246, 0.1)',
                    margin: '0.75rem',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 25px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = request.type === 'group' ? '#8b5cf6' : '#3b82f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.1)';
                  }}
                >
                  <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
                    <div style={{
                      width: '3.5rem',
                      height: '3.5rem',
                      borderRadius: '9999px',
                      background: request.type === 'group' 
                        ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)' 
                        : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                      border: `2px solid ${request.type === 'group' ? '#8b5cf6' : '#3b82f6'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {request.user?.avatar_url ? (
                        <Image
                          src={`/api/media/avatars/${request.user.avatar_url}`}
                          alt={request.user.full_name}
                          width={56}
                          height={56}
                          className="rounded-full"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      ) : (
                        <span style={{ 
                          color: request.type === 'group' ? '#7c3aed' : '#1d4ed8', 
                          fontWeight: '700', 
                          fontSize: '1.125rem' 
                        }}>
                          {request.user?.full_name?.charAt(0) || '👤'}
                        </span>
                      )}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <h3 style={{
                          fontWeight: '700',
                          color: '#1e40af',
                          fontSize: '1.125rem',
                        }}>
                          {request.user?.full_name} {request.type === 'group' ? ' (Group)' : ''}
                        </h3>
                        <span style={{
                          background: request.type === 'group' 
                            ? 'rgba(139, 92, 246, 0.1)' 
                            : 'rgba(59, 130, 246, 0.1)',
                          color: request.type === 'group' ? '#7c3aed' : '#1d4ed8',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                        }}>
                          {request.type === 'group' ? 'Group' : 'One-on-One'}
                        </span>
                      </div>

                      <p style={{
                        color: '#6b7280',
                        fontSize: '0.95rem',
                        marginBottom: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Clock size={14} />
                          {timeAgo(request.created_at)}
                        </span>
                        <span>•</span>
                        <span>{request.type === 'group' ? 'Looking for group support' : 'Seeking understanding'}</span>
                      </p>

                      {request.context && (
                        <div style={{
                          background: 'rgba(249, 250, 251, 0.8)',
                          border: '1px solid rgba(209, 213, 219, 0.5)',
                          borderRadius: '0.75rem',
                          padding: '1rem',
                          fontSize: '0.95rem',
                          color: '#4b5563',
                          lineHeight: 1.6,
                          marginBottom: '1rem',
                          fontStyle: 'italic',
                          position: 'relative',
                        }}>
                          <div style={{
                            position: 'absolute',
                            top: '0.5rem',
                            left: '0.5rem',
                            fontSize: '2rem',
                            color: 'rgba(59, 130, 246, 0.2)',
                            lineHeight: 1,
                          }}></div>
                          {request.context}
                        </div>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isRedirectingRef.current) {
                            if (request.type === 'group') {
                              acceptGroup(request.id);
                            } else {
                              acceptOneOnOne(request.id);
                            }
                          }
                        }}
                        disabled={acceptingRequestId === request.id}
                        style={{
                          background: acceptingRequestId === request.id
                            ? '#9ca3af'
                            : request.type === 'group'
                              ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                              : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '9999px',
                          padding: '0.75rem 1.5rem',
                          fontWeight: '600',
                          fontSize: '0.95rem',
                          cursor: acceptingRequestId === request.id ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          transition: 'all 0.3s ease',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        }}
                        onMouseEnter={(e) => {
                          if (acceptingRequestId !== request.id) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (acceptingRequestId !== request.id) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                          }
                        }}
                      >
                        {acceptingRequestId === request.id ? (
                          <>
                            <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.25" />
                              <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
                            </svg>
                            Connecting...
                          </>
                        ) : (
                          <>
                            <Heart size={18} />
                            Offer Support
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '4rem', textAlign: 'center', color: '#9ca3af' }}>
              <div style={{ ...styles.avatarPlaceholder, width: '4rem', height: '4rem', margin: '0 auto 1.5rem' }}>
                <Brain size={32} style={{ color: '#d1d5db' }} />
              </div>
              <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No support requests right now</p>
              <p style={{ fontSize: '0.95rem' }}>You can be the first to reach out</p>
            </div>
          )}
        </div>

        {/* How It Works */}
        <div style={{ ...styles.card, ...styles.sectionGap }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1e40af', marginBottom: '1.5rem', textAlign: 'center' }}>
            How Depression Support Works
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div style={styles.gridItem}>
              <div style={{ ...styles.avatarPlaceholder, width: '4rem', height: '4rem', margin: '0 auto 1rem' }}>
                <MessageCircle size={28} style={{ color: '#3b82f6' }} />
              </div>
              <h3 style={{ fontWeight: '700', color: '#1e40af', marginBottom: '0.5rem' }}>1:1 Support</h3>
              <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
                Connect privately with someone who understands depression. Share what you are going through without judgment.
              </p>
            </div>
            <div style={styles.gridItem}>
              <div style={{ ...styles.avatarPlaceholder, width: '4rem', height: '4rem', margin: '0 auto 1rem' }}>
                <Users size={28} style={{ color: '#8b5cf6' }} />
              </div>
              <h3 style={{ fontWeight: '700', color: '#7c3aed', marginBottom: '0.5rem' }}>Group Circles</h3>
              <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
                Join supportive group conversations where everyone gets what you areexperiencing.
              </p>
            </div>
            <div style={styles.gridItem}>
              <div style={{ ...styles.avatarPlaceholder, width: '4rem', height: '4rem', margin: '0 auto 1rem' }}>
                <Clock size={28} style={{ color: '#10b981' }} />
              </div>
              <h3 style={{ fontWeight: '700', color: '#047857', marginBottom: '0.5rem' }}>10-Minute Window</h3>
              <p style={{ color: '#6b7280', fontSize: '0.95rem', lineHeight: '1.5' }}>
                Requests expire after 10 minutes to keep connections fresh and immediate.
              </p>
            </div>
          </div>
        </div>

        {/* Context Modal */}
        {showContextModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 100,
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setShowContextModal(null)}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                borderRadius: '1.25rem',
                padding: '2rem',
                width: '90%',
                maxWidth: '32rem',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                position: 'relative',
                border: '1px solid rgba(59, 130, 246, 0.1)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 style={{ fontWeight: '700', color: '#1e40af', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
                What is on your mind?
              </h3>
              <p style={{ color: '#6b7280', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.6' }}>
                Sharing a bit about what you are experiencing helps others understand how to support you best. This is completely optional.
              </p>
              <textarea
                autoFocus
                value={tempContext}
                onChange={(e) => setTempContext(e.target.value.slice(0, 280))}
                placeholder="e.g., I've been feeling really isolated lately and could use someone to talk to..."
                maxLength={280}
                rows={4}
                style={{
                  width: '100%',
                  padding: '1rem',
                  borderRadius: '0.75rem',
                  border: '2px solid rgba(59, 130, 246, 0.2)',
                  fontSize: '1rem',
                  resize: 'none',
                  marginBottom: '1.5rem',
                  background: '#f8fafc',
                  transition: 'all 0.3s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#3b82f6';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                  {280 - tempContext.length} characters remaining
                </span>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setShowContextModal(null)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#f1f5f9',
                      color: '#64748b',
                      border: '1px solid #cbd5e1',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#e2e8f0';
                      e.currentTarget.style.color = '#475569';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                      e.currentTarget.style.color = '#64748b';
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (showContextModal === 'one-on-one') {
                        postOneOnOneWithContext(tempContext);
                      } else if (showContextModal === 'group') {
                        postGroupWithContext(tempContext);
                      }
                      setTempContext('');
                      setShowContextModal(null);
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: showContextModal === 'group' 
                        ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' 
                        : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '9999px',
                      cursor: 'pointer',
                      fontWeight: '600',
                      transition: 'all 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}