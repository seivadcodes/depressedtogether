// app/test-call/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCall } from '@/context/CallContext';
import { Room, RoomEvent, LocalTrack, LocalAudioTrack, Track } from 'livekit-client';

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
};

export interface IncomingCall {
  callerId: string;
  callerName: string;
  roomName: string;
  callType: 'audio' | 'video';
  conversationId: string;
}

export default function TestCallPage() {
  const { user: currentUser } = useAuth();
  const supabase = createClient();
  const { incomingCall, setIncomingCall } = useCall();

  const [users, setUsers] = useState<Profile[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  
  // Call state management
  const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'connected' | 'ended'>('idle');
  const [callTimer, setCallTimer] = useState(0);
  const [calleeName, setCalleeName] = useState('');
  const [remoteAudioEnabled, setRemoteAudioEnabled] = useState(true);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  
  const callStartTimeRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ringingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callStateRef = useRef(callState);
  const roomRef = useRef<Room | null>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    const fetchUsersAndProfile = async () => {
      if (!currentUser?.id) return;

      const { data: otherUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .neq('id', currentUser.id);

      if (usersError) {
        console.error('Failed to load users:', usersError);
        toast.error('Failed to load users');
      } else {
        setUsers(otherUsers || []);
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', currentUser.id)
        .single();

      if (profileError) {
        console.error('Failed to load current user profile:', profileError);
        toast.error('Failed to load your profile');
      } else {
        setCurrentUserProfile(profile);
      }
    };

    fetchUsersAndProfile();
  }, [currentUser?.id, supabase]);

  // Handle call timer
  useEffect(() => {
    if (callState === 'connected' && callStartTimeRef.current) {
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTimeRef.current!) / 1000);
        setCallTimer(elapsed);
      }, 1000);
    }
    
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [callState]);

  // Handle call state transitions
  useEffect(() => {
    if (callState === 'calling') {
      ringingTimeoutRef.current = setTimeout(() => {
        setCallState('ringing');
      }, 2000);
    } else if (callState === 'ringing') {
      ringingTimeoutRef.current = setTimeout(() => {
        endCall();
        toast('Call timed out', { icon: '⏰' });
      }, 30000);
    } else if (callState === 'connected') {
      callStartTimeRef.current = Date.now();
    } else if (callState === 'ended') {
      const resetTimeout = setTimeout(() => {
        setCallState('idle');
        setCalleeName('');
        setCallTimer(0);
        callStartTimeRef.current = null;
        setRemoteAudioEnabled(true);
        setLocalAudioEnabled(true);
      }, 1000);
      return () => clearTimeout(resetTimeout);
    }

    return () => {
      if (ringingTimeoutRef.current) {
        clearTimeout(ringingTimeoutRef.current);
      }
    };
  }, [callState]);

  // Get LiveKit token
  const getToken = useCallback(async (roomName: string, identity: string, name: string) => {
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          room: roomName, 
          identity,
          name 
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to get token');
      }

      const data = await res.json();
      return data.token;
    } catch (error) {
      console.error('Error getting token:', error);
      throw error;
    }
  }, []);

  // End call and clean up
  const endCall = useCallback(async () => {
    setCallState('ended');
    
    if (ringingTimeoutRef.current) {
      clearTimeout(ringingTimeoutRef.current);
      ringingTimeoutRef.current = null;
    }

    // Clean up LiveKit room
    if (roomRef.current) {
      try {
        await roomRef.current.disconnect();
      } catch (error) {
        console.error('Error disconnecting from room:', error);
      }
      roomRef.current = null;
    }

    // Clean up local audio track
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current = null;
    }

    // Clean up audio elements
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
      remoteAudioRef.current = null;
    }
    
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
      localAudioRef.current = null;
    }

    toast('Call ended', { icon: '✅' });
  }, []);

  // Join LiveKit room
  // Join LiveKit room
const joinRoom = useCallback(async (roomName: string) => {
  if (!currentUser?.id || !currentUserProfile) {
    toast.error('User not authenticated');
    return;
  }

  try {
    const token = await getToken(
      roomName,
      currentUser.id,
      currentUserProfile.full_name || currentUser.email || 'User'
    );

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    roomRef.current = room;

    // Set up event listeners
    room
      .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Audio) {
          const audioElement = new Audio();
          audioElement.autoplay = true;
          audioElement.volume = 0.5;
          remoteAudioRef.current = audioElement;
          
          if (track.mediaStreamTrack) {
            const mediaStream = new MediaStream([track.mediaStreamTrack]);
            audioElement.srcObject = mediaStream;
          }
          
          toast.success(`${participant.name} joined the call`);
        }
      })
      .on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Audio) {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
          }
        }
      })
      .on(RoomEvent.Disconnected, () => {
        endCall();
      })
      .on(RoomEvent.ParticipantConnected, (participant) => {
        console.log(`${participant.name} connected`);
      })
      .on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log(`${participant.name} disconnected`);
        // If the other participant leaves, end the call
        if (participant.identity !== currentUser.id) {
          endCall();
          toast('Call ended by other participant');
        }
      });

    // Connect to the room
    await room.connect(
      `wss://webrtc-livekit-9g4r.onrender.com`,
      token
    );

    // Enable camera and microphone
    await room.localParticipant.enableCameraAndMicrophone();

    // Get audio track from local participant's tracks
    const audioTrackPublications = Array.from(room.localParticipant.audioTrackPublications.values());
    const audioPublication = audioTrackPublications[0];

    if (audioPublication?.track && audioPublication.track instanceof LocalAudioTrack) {
      localAudioTrackRef.current = audioPublication.track;
      
      // Create local audio element (muted by default)
      const localAudioElement = new Audio();
      localAudioElement.muted = true;
      localAudioElement.autoplay = true;
      localAudioRef.current = localAudioElement;
      
      if (audioPublication.track.mediaStreamTrack) {
        const mediaStream = new MediaStream([audioPublication.track.mediaStreamTrack]);
        localAudioElement.srcObject = mediaStream;
      }
    }

    setCallState('connected');
    callStartTimeRef.current = Date.now();
    
  } catch (error) {
    console.error('Failed to join room:', error);
    toast.error('Failed to connect to call');
    endCall();
  }
}, [currentUser?.id, currentUserProfile, getToken, endCall]);

  // Toggle local audio (mute/unmute)
  const toggleLocalAudio = useCallback(async () => {
    if (!roomRef.current) return;

    try {
      const localParticipant = roomRef.current.localParticipant;
      const audioPublications = Array.from(localParticipant.audioTrackPublications.values());
      
      if (audioPublications.length > 0) {
        const audioPublication = audioPublications[0];
        
        if (localAudioEnabled) {
          // Mute
          await audioPublication.track?.mute();
          toast('Microphone muted', { icon: '🔇' });
        } else {
          // Unmute
          await audioPublication.track?.unmute();
          toast('Microphone unmuted', { icon: '🎤' });
        }
        
        setLocalAudioEnabled(!localAudioEnabled);
      }
    } catch (error) {
      console.error('Failed to toggle audio:', error);
      toast.error('Failed to toggle microphone');
    }
  }, [localAudioEnabled]);

  // Toggle remote audio volume
  const toggleRemoteAudio = useCallback(() => {
    if (remoteAudioRef.current) {
      if (remoteAudioEnabled) {
        remoteAudioRef.current.volume = 0;
        toast('Speaker muted', { icon: '🔇' });
      } else {
        remoteAudioRef.current.volume = 0.5;
        toast('Speaker unmuted', { icon: '🔊' });
      }
      setRemoteAudioEnabled(!remoteAudioEnabled);
    }
  }, [remoteAudioEnabled]);

  // WebSocket listener
  useEffect(() => {
    if (!currentUser?.id) return;

    const ws = new WebSocket(`ws://178.128.210.229:8084?userId=${currentUser.id}`);

    const handleMessage = async (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        const { type } = msg;

        if (type === 'incoming_call') {
          setIncomingCall({
            callerId: msg.callerId,
            callerName: msg.callerName,
            roomName: msg.roomName,
            callType: msg.callType,
            conversationId: msg.conversationId,
          });
        }
        else if (type === 'call_accepted') {
          if (callStateRef.current === 'ringing' || callStateRef.current === 'calling') {
            if (ringingTimeoutRef.current) {
              clearTimeout(ringingTimeoutRef.current);
              ringingTimeoutRef.current = null;
            }
            // Join the room when call is accepted
            await joinRoom(msg.roomName);
          }
        }
        else if (type === 'call_ended') {
          if (callStateRef.current === 'connected' || callStateRef.current === 'ringing') {
            endCall();
          }
        }
      } catch (e) {
        console.error('WebSocket message error', e);
      }
    };

    ws.onmessage = handleMessage;
    ws.onopen = () => console.log('✅ WebSocket connected');
    ws.onerror = (err) => console.error('WebSocket error:', err);
    ws.onclose = () => console.log('WebSocket disconnected');

    return () => ws.close();
  }, [currentUser?.id, joinRoom, endCall, setIncomingCall]);

  const handleAccept = useCallback(async () => {
    if (!incomingCall) return;

    const callerName = incomingCall.callerName || 'User';
    setCalleeName(callerName);
    setIncomingCall(null);

    try {
      // Notify signaling server
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: incomingCall.callerId,
          type: 'call_accepted',
          roomName: incomingCall.roomName,
        }),
      });

      // Join the LiveKit room
      await joinRoom(incomingCall.roomName);
      
    } catch (err) {
      console.error('Failed to accept call:', err);
      toast.error('Failed to accept call');
      endCall();
    }
  }, [incomingCall, joinRoom, endCall, setIncomingCall]);

  const handleDecline = useCallback(async () => {
    if (!incomingCall) return;

    try {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: incomingCall.callerId,
          type: 'call_ended',
          roomName: incomingCall.roomName,
        }),
      });
    } catch (err) {
      console.error('Failed to send decline notification:', err);
    }

    setIncomingCall(null);
    toast('Call declined', { icon: '📞' });
    
    if (callState !== 'idle' && callState !== 'ended') {
      setCallState('ended');
    }
  }, [incomingCall, callState, setIncomingCall]);

  const handleCall = useCallback(async () => {
    if (!selectedUserId || !currentUser?.id || !currentUserProfile) return;

    const callerName = currentUserProfile.full_name || currentUser.email?.split('@')[0] || 'User';
    const callee = users.find(u => u.id === selectedUserId);
    const calleeName = callee?.full_name || 'Recipient';

    setCalleeName(calleeName);
    setCallState('calling');

    const roomName = `audio-call-${Date.now()}`;
    const callType: 'audio' | 'video' = 'audio';

    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: selectedUserId,
          callerId: currentUser.id,
          callerName,
          roomName,
          callType,
          conversationId: `test-conv-${currentUser.id}-${selectedUserId}`,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('Call failed:', errorData);
        toast.error('Failed to send call');
        setCallState('ended');
      } else {
        // Wait for acceptance or timeout
        // The WebSocket will handle the acceptance
      }
    } catch (err) {
      console.error('Call error:', err);
      toast.error('Network error: failed to send call');
      setCallState('ended');
    }
  }, [selectedUserId, currentUser?.id, currentUserProfile, users]);

  const hangUp = useCallback(async () => {
    if (callState === 'connected' || callState === 'ringing') {
      // Notify other participant
      const peerId = incomingCall ? incomingCall.callerId : selectedUserId;
      const roomName = incomingCall ? incomingCall.roomName : `audio-call-${Date.now()}`;
      
      if (peerId) {
        try {
          await fetch('/api/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              toUserId: peerId,
              type: 'call_ended',
              roomName,
            }),
          });
        } catch (err) {
          console.error('Failed to send hangup notification', err);
        }
      }
    }

    endCall();
  }, [callState, incomingCall, selectedUserId, endCall]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  };

  const callCardStyle: React.CSSProperties = {
    backgroundColor: '#1e293b',
    borderRadius: '24px',
    padding: '32px',
    width: '90%',
    maxWidth: '400px',
    textAlign: 'center',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
    position: 'relative',
  };

  const avatarStyle: React.CSSProperties = {
    width: '96px',
    height: '96px',
    borderRadius: '50%',
    backgroundColor: '#334155',
    margin: '0 auto 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#cbd5e1',
    border: '4px solid #4f46e5',
  };

  const nameStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#f1f5f9',
    marginBottom: '8px',
  };

  const statusStyle: React.CSSProperties = {
    fontSize: '18px',
    color: '#94a3b8',
    marginBottom: '24px',
    textTransform: 'capitalize',
  };

  const timerStyle: React.CSSProperties = {
    fontSize: '48px',
    fontWeight: 'bold',
    color: '#f1f5f9',
    margin: '16px 0 32px',
    fontFamily: 'monospace',
  };

  const buttonContainerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '16px',
    flexWrap: 'wrap',
  };

  const buttonStyle: React.CSSProperties = {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'transform 0.1s, box-shadow 0.1s',
  };

  const hangUpButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#ef4444',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)',
  };

  const declineButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#64748b',
    boxShadow: '0 4px 12px rgba(100, 116, 139, 0.4)',
  };

  const controlButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#334155',
    boxShadow: '0 4px 12px rgba(51, 65, 85, 0.4)',
  };

  const iconStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    strokeWidth: '1.5',
  };

  if (!currentUser) {
    return <div style={{ padding: '32px' }}>Loading...</div>;
  }

  if (!currentUserProfile) {
    return <div style={{ padding: '32px' }}>Loading your profile...</div>;
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px', position: 'relative' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b', marginBottom: '16px' }}>Audio Call Test</h1>
      <p style={{ color: '#475569', lineHeight: 1.5, marginBottom: '32px' }}>
        Select a user to start an audio call. They will receive a real-time notification.
      </p>

      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#334155', marginBottom: '8px' }}>
          Select User to Call
        </label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          style={{
            width: '100%',
            padding: '14px',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            fontSize: '16px',
            backgroundColor: '#f8fafc',
            color: '#1e293b',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#4f46e5'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#cbd5e1'}
        >
          <option value="">— Choose a user —</option>
          {users.map((user) => (
            <option key={user.id} value={user.id} style={{ padding: '8px' }}>
              {user.full_name || 'Unnamed User'}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleCall}
        disabled={!selectedUserId || callState !== 'idle'}
        style={{
          width: '100%',
          padding: '16px',
          backgroundColor: selectedUserId && callState === 'idle' ? '#4f46e5' : '#94a8c4',
          color: 'white',
          fontWeight: '600',
          fontSize: '18px',
          borderRadius: '16px',
          border: 'none',
          cursor: selectedUserId && callState === 'idle' ? 'pointer' : 'not-allowed',
          transition: 'background-color 0.2s',
        }}
        onMouseOver={(e) => {
          if (selectedUserId && callState === 'idle') {
            e.currentTarget.style.backgroundColor = '#4338ca';
          }
        }}
        onMouseOut={(e) => {
          if (selectedUserId && callState === 'idle') {
            e.currentTarget.style.backgroundColor = '#4f46e5';
          }
        }}
      >
        {callState === 'idle' ? 'Start Audio Call' : 'Call in Progress...'}
      </button>

      {/* Connection Status */}
      {callState === 'connected' && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          backgroundColor: '#10b98120',
          borderRadius: '8px',
          border: '1px solid #10b981',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
            <div style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#10b981',
              borderRadius: '50%',
              animation: 'pulse 2s infinite',
            }} />
            <span>Connected to LiveKit server</span>
          </div>
        </div>
      )}

      {/* Incoming Call Popup */}
      {incomingCall && callState === 'idle' && (
        <div style={overlayStyle}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '28px',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              backgroundColor: '#4f46e5',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <svg style={{ width: '28px', height: '28px', color: 'white' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}>
              Incoming Audio Call
            </h3>
            <p style={{ color: '#475569', marginBottom: '8px', fontSize: '18px' }}>
              From: {incomingCall.callerName}
            </p>
            <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
              <button
                onClick={handleAccept}
                style={{
                  flex: 1,
                  padding: '14px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  borderRadius: '16px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#16a34a'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#22c55e'}
              >
                Accept
              </button>
              <button
                onClick={handleDecline}
                style={{
                  flex: 1,
                  padding: '14px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '16px',
                  border: 'none',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calling Overlay */}
      {(callState === 'calling' || callState === 'ringing' || callState === 'connected') && (
        <div style={overlayStyle}>
          <div style={callCardStyle}>
            <div style={avatarStyle}>
              {(calleeName || 'U').charAt(0).toUpperCase()}
            </div>
            
            <div style={nameStyle}>{calleeName}</div>
            
            <div style={statusStyle}>
              {callState === 'calling' && 'Connecting...'}
              {callState === 'ringing' && 'Ringing...'}
              {callState === 'connected' && 'Connected'}
            </div>
            
            {callState === 'connected' && (
              <>
                <div style={timerStyle}>
                  {formatTime(callTimer)}
                </div>
                
                {/* Audio Controls */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '12px',
                  marginBottom: '24px',
                }}>
                  <button
                    onClick={toggleLocalAudio}
                    style={controlButtonStyle}
                    title={localAudioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
                  >
                    {localAudioEnabled ? (
                      <svg style={iconStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="white" strokeWidth="2"/>
                        <path d="M19 10v2a7 7 0 01-7 7m0 0a7 7 0 01-7-7v-2m7 7v4m0 0H8m4 0h4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg style={iconStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="white" strokeWidth="2"/>
                        <path d="M19 10v2a7 7 0 01-7 7m0 0a7 7 0 01-7-7v-2m7 7v4m0 0H8m4 0h4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M22 2l-20 20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                  
                  <button
                    onClick={toggleRemoteAudio}
                    style={controlButtonStyle}
                    title={remoteAudioEnabled ? 'Mute Speaker' : 'Unmute Speaker'}
                  >
                    {remoteAudioEnabled ? (
                      <svg style={iconStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15.536 8.464a5 5 0 010 7.072M12 6a9 9 0 010 12M5 15l-2 2M19 9l2-2M1 9l2 2M23 15l-2 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    ) : (
                      <svg style={iconStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15.536 8.464a5 5 0 010 7.072M12 6a9 9 0 010 12M5 15l-2 2M19 9l2-2M1 9l2 2M23 15l-2 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M22 2l-20 20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    )}
                  </button>
                </div>
              </>
            )}
            
            <div style={buttonContainerStyle}>
              {callState === 'ringing' && (
                <>
                  <button 
                    onClick={hangUp} 
                    style={declineButtonStyle}
                    title="Cancel Call"
                  >
                    <svg style={iconStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M15 9L9 15M9 9l6 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button 
                    style={{ 
                      ...buttonStyle, 
                      backgroundColor: '#eab308',
                      boxShadow: '0 4px 12px rgba(234, 179, 8, 0.4)',
                    }}
                    title="Waiting for answer..."
                    disabled
                  >
                    <svg style={iconStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </>
              )}
              
              <button 
                onClick={hangUp} 
                style={hangUpButtonStyle}
                title="End Call"
              >
                <svg style={iconStyle} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}