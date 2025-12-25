'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  Room, 
  RemoteParticipant, 
  LocalParticipant, 
  Track, 
  RemoteTrackPublication, 
  RemoteTrack,
  LocalTrack
} from 'livekit-client';

export function useCallPageLogic(sessionId: string) {
  const router = useRouter();
  const supabase = createClient();
  const { user, loading: authLoading } = useAuth();
  
  // LiveKit state
  const [isConnected, setIsConnected] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<any | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<any[]>([]);
  const [callMode, setCallMode] = useState<'audio' | 'video'>('audio');

  // CRITICAL FIX 1: Use ref for room instance instead of state
  const roomRef = useRef<Room | null>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Media refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // CRITICAL FIX 2: Add connection guard state
  const [isInitializing, setIsInitializing] = useState(false);

  // Cleanup function for media elements
  const cleanupMediaElements = () => {
    // Cleanup local video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      localVideoRef.current.style.backgroundColor = '#1f2937';
    }

    // Cleanup remote videos
    remoteVideoRefs.current.forEach((videoEl, identity) => {
      videoEl.pause();
      videoEl.srcObject = null;
      videoEl.remove();
    });
    remoteVideoRefs.current.clear();

    // Cleanup remote audios
    remoteAudioRefs.current.forEach((audioEl, identity) => {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
    });
    remoteAudioRefs.current.clear();
  };

  // Fetch session details and participants
  const fetchSessionDetails = async () => {
    if (!sessionId || !user) return;

    try {
      // Get session info
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('status, mode')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Backward compatibility: default to 'audio' if mode is missing or invalid
      const mode = (sessionData?.mode === 'video') ? 'video' : 'audio';
      setCallMode(mode);
      setSessionInfo({ ...sessionData, mode });

      // Get participants with profile info
      const { data: participantsData, error: participantsError } = await supabase
        .from('session_participants')
        .select(`
          user_id,
          joined_at,
          profiles: user_id (id, full_name)
        `)
        .eq('session_id', sessionId);

      if (participantsError) throw participantsError;

      setSessionParticipants(participantsData || []);
      
      return {
        session: { ...sessionData, mode },
        participants: participantsData
      };
    } catch (error) {
      console.error('Error fetching session details:', error);
      setConnectionError('Failed to load session details. Please try again.');
      return null;
    }
  };

  // Connect to LiveKit room
  const connectToRoom = async () => {
    // CRITICAL FIX 3: Prevent multiple connection attempts
    if (isConnected || connecting || isInitializing) {
      console.log('Connection attempt blocked - already connecting/connected');
      return;
    }
    
    setIsInitializing(true);
    setConnecting(true);
    setConnectionError(null);

    try {
      if (!sessionId || !user) {
        throw new Error('Missing session ID or user information');
      }

      // Get LiveKit token
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          roomName: sessionId,
          identity: user.id,
          name: user.user_metadata.full_name || 'Anonymous'
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get LiveKit token: ${response.status} ${errorText}`);
      }

      const { token, url } = await response.json();
      if (!token || !url) {
        throw new Error('Missing token or LiveKit URL in response');
      }

      // CRITICAL FIX 4: Proper cleanup before new connection
      if (roomRef.current) {
        console.log('Cleaning up previous room connection');
        roomRef.current.disconnect();
        cleanupMediaElements();
      }

      // Create and connect to room
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720 }
        },
        publishDefaults: {
          videoEncoding: {
            maxBitrate: 1_500_000,
            maxFramerate: 24,
          },
        },
      });

      roomRef.current = newRoom; // Store in ref
      setupRoomEventListeners(newRoom);

      // Connect to room
      await newRoom.connect(url, token);
      
      // Set up local participant
      const localParticipant = newRoom.localParticipant;
      setLocalParticipant(localParticipant);
      
      // Determine media constraints based on call mode
      const shouldRequestVideo = callMode === 'video';
      
      // Set initial mute states
      setIsAudioMuted(false);
      setIsVideoMuted(!shouldRequestVideo);

      // Handle media permissions
      try {
        const streamConstraints = {
          audio: true,
          video: shouldRequestVideo
        };

        // Test permissions without keeping the stream
        const stream = await navigator.mediaDevices.getUserMedia(streamConstraints);
        stream.getTracks().forEach(track => track.stop()); // CRITICAL: Release tracks immediately
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            if (shouldRequestVideo) {
              setConnectionError('Camera permission denied. Please enable camera access or switch to audio-only mode.');
              await newRoom.disconnect();
              return;
            }
            // For audio-only mode, we proceed even if video is denied
          } else {
            throw err;
          }
        }
      }

      // Create and publish tracks
      const tracks = await localParticipant.createTracks({
        video: shouldRequestVideo,
        audio: true,
      });
      
      tracks.forEach(track => {
        if (track.kind === 'video' && localVideoRef.current && shouldRequestVideo) {
          track.attach(localVideoRef.current);
        }
        localParticipant.publishTrack(track);
      });
      
      // Handle audio-only mode display
      if (!shouldRequestVideo && localVideoRef.current) {
        localVideoRef.current.srcObject = null;
        localVideoRef.current.style.backgroundColor = '#1f2937';
      }

      // Update session status to active
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (!sessionError && sessionData?.status === 'pending') {
        await supabase
          .from('sessions')
          .update({ status: 'active' })
          .eq('id', sessionId);
      }

      setIsConnected(true);
      console.log('Successfully connected to LiveKit room:', sessionId);
    } catch (error) {
      console.error('Error connecting to LiveKit room:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to the call';
      setConnectionError(errorMessage);
    } finally {
      setIsInitializing(false);
      setConnecting(false);
    }
  };

  // Setup event listeners for the room
  const setupRoomEventListeners = (room: Room) => {
    room.on('participantConnected', (participant: RemoteParticipant) => {
      console.log(`Participant connected: ${participant.identity}`);
      
      setParticipants(prev => {
        if (!prev.some(p => p.identity === participant.identity)) {
          return [...prev, participant];
        }
        return prev;
      });
      
      // Add system message
      addSystemMessage(`${participant.name || 'Someone'} has joined the call`);
    });

    room.on('participantDisconnected', (participant: RemoteParticipant) => {
      console.log(`Participant disconnected: ${participant.identity}`);
      
      // Cleanup media elements
      if (remoteVideoRefs.current.has(participant.identity)) {
        const videoEl = remoteVideoRefs.current.get(participant.identity);
        if (videoEl) {
          videoEl.srcObject = null;
          videoEl.remove();
        }
        remoteVideoRefs.current.delete(participant.identity);
      }

      if (remoteAudioRefs.current.has(participant.identity)) {
        const audioEl = remoteAudioRefs.current.get(participant.identity);
        if (audioEl) {
          audioEl.srcObject = null;
          audioEl.remove();
        }
        remoteAudioRefs.current.delete(participant.identity);
      }

      setParticipants(prev => prev.filter(p => p.identity !== participant.identity));
      
      addSystemMessage(`${participant.name || 'Someone'} has left the call`);
    });

    room.on('trackSubscribed', (track: RemoteTrack, _, participant: RemoteParticipant) => {
      console.log(`Track subscribed from ${participant.identity}: ${track.kind}`);
      
      if (track.kind === 'audio') {
        let audioEl = remoteAudioRefs.current.get(participant.identity);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          document.body.appendChild(audioEl);
          remoteAudioRefs.current.set(participant.identity, audioEl);
        }
        track.attach(audioEl);
      } else if (track.kind === 'video') {
        let videoEl = remoteVideoRefs.current.get(participant.identity);
        if (!videoEl) {
          videoEl = document.createElement('video');
          videoEl.autoplay = true;
          videoEl.playsInline = true; // Modern property instead of attribute
          videoEl.className = 'w-full h-full object-cover rounded-lg';
          remoteVideoRefs.current.set(participant.identity, videoEl);
        }
        track.attach(videoEl);
      }
    });

    room.on('trackUnsubscribed', (track: RemoteTrack) => {
      track.detach();
    });

    room.on('dataReceived', (payload: Uint8Array, participant?: RemoteParticipant) => {
      try {
        const message = new TextDecoder().decode(payload);
        const data = JSON.parse(message);
        
        if (data.type === 'chat') {
          const senderName = participant?.name || 'Anonymous';
          
          addChatMessage({
            id: Date.now().toString(),
            sender_id: participant?.identity || 'system',
            sender_name: senderName,
            content: data.content,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Error parsing data message:', error);
      }
    });

    room.on('disconnected', () => {
      console.log('Disconnected from room');
      setIsConnected(false);
      cleanupMediaElements();
    });
  };

  // Toggle audio mute
  const toggleAudioMute = async () => {
    if (!roomRef.current || !localParticipant) return;
    
    try {
      const newState = !isAudioMuted;
      
      // Get audio tracks
      const audioTrackPublication = Array.from(localParticipant.audioTrackPublications.values())[0];
      
      if (audioTrackPublication?.track) {
        await localParticipant.unpublishTrack(audioTrackPublication.track);
      }
      
      if (!newState) {
        const tracks = await localParticipant.createTracks({ audio: true });
        if (tracks[0]) {
          await localParticipant.publishTrack(tracks[0]);
        }
      }
      
      setIsAudioMuted(newState);
      console.log(newState ? 'Microphone muted' : 'Microphone unmuted');
    } catch (error) {
      console.error('Error toggling microphone:', error);
      setConnectionError('Failed to toggle microphone. Please check permissions.');
    }
  };

  // Toggle video mute
  const toggleVideoMute = async () => {
    if (callMode === 'audio') {
      console.warn('Video toggle disabled in audio-only mode');
      return;
    }

    if (!roomRef.current || !localParticipant || !localVideoRef.current) return;
    
    try {
      const newState = !isVideoMuted;
      
      const videoTrackPublication = Array.from(localParticipant.videoTrackPublications.values())[0];
      
      if (videoTrackPublication?.track) {
        await localParticipant.unpublishTrack(videoTrackPublication.track);
      }
      
      if (!newState) {
        const tracks = await localParticipant.createTracks({ 
          video: { resolution: { width: 1280, height: 720 } }
        });
        
        const videoTrack = tracks.find(t => t.kind === 'video');
        if (videoTrack) {
          videoTrack.attach(localVideoRef.current);
          await localParticipant.publishTrack(videoTrack);
          localVideoRef.current.style.backgroundColor = 'transparent';
        }
      } else {
        localVideoRef.current.srcObject = null;
        localVideoRef.current.style.backgroundColor = '#1f2937';
      }
      
      setIsVideoMuted(newState);
      console.log(newState ? 'Camera disabled' : 'Camera enabled');
    } catch (error) {
      console.error('Error toggling camera:', error);
      setConnectionError('Failed to toggle camera. Please check permissions.');
    }
  };

  // Add chat message
  const addChatMessage = (message: any) => {
    setChatMessages(prev => [...prev, message]);
  };

  // Add system message
  const addSystemMessage = (content: string) => {
    addChatMessage({
      id: `system-${Date.now()}`,
      sender_id: 'system',
      sender_name: 'System',
      content,
      timestamp: new Date()
    });
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!roomRef.current || !newMessage.trim() || !user) return;

    try {
      const message = {
        type: 'chat',
        content: newMessage.trim(),
        timestamp: new Date().toISOString()
      };

      await roomRef.current.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message)),
        { reliable: true }
      );

      addChatMessage({
        id: Date.now().toString(),
        sender_id: user.id,
        sender_name: 'You',
        content: newMessage.trim(),
        timestamp: new Date()
      });

      setNewMessage('');
      
      // Scroll to bottom
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 100);
    } catch (error) {
      console.error('Error sending chat message:', error);
      setConnectionError('Failed to send message. Please try again.');
    }
  };

  // Handle chat input key press
  const handleChatKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  // Leave the room
  const leaveRoom = async () => {
    if (!roomRef.current) return;

    try {
      // Send goodbye message (best effort)
      try {
        const goodbyeMessage = {
          type: 'chat',
          content: 'has left the call',
          timestamp: new Date().toISOString()
        };

        await roomRef.current.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(goodbyeMessage)),
          { reliable: true }
        );
      } catch (error) {
        console.warn('Goodbye message failed (non-critical):', error);
      }
      
      // CRITICAL FIX 5: Proper disconnection sequence
      roomRef.current.disconnect();
      cleanupMediaElements();
      
      // Update session status if this was the last participant
      if (sessionInfo?.status === 'active') {
        const { count } = await supabase
          .from('session_participants')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionId);
        
        if (count !== null && count <= 1) {
          await supabase
            .from('sessions')
            .update({ status: 'ended' })
            .eq('id', sessionId);
        }
      }
    } finally {
      roomRef.current = null;
      setIsConnected(false);
      router.push('/connect');
    }
  };

  // Initialize - fetch session details and connect
  useEffect(() => {
    if (authLoading || !user) return;

    // CRITICAL FIX 6: Prevent multiple initializations
    if (isConnected || connecting || isInitializing) {
      return;
    }

    const initCall = async () => {
      const sessionData = await fetchSessionDetails();
      if (sessionData) {
        await connectToRoom();
        
        setTimeout(() => {
          addSystemMessage('Welcome to your healing space. This is a safe place to share and be heard.');
        }, 1000);
      }
    };

    initCall();

    // Setup interval to update session status
    const statusInterval = setInterval(async () => {
      if (isConnected && roomRef.current) {
        const { data: participantsData, error: participantsError } = await supabase
          .from('session_participants')
          .select('user_id')
          .eq('session_id', sessionId);
        
        if (!participantsError && participantsData && participantsData.length === 0) {
          await supabase
            .from('sessions')
            .update({ status: 'ended' })
            .eq('id', sessionId);
          leaveRoom();
        }
      }
    }, 30000);

    // CRITICAL FIX 7: Fixed cleanup with roomRef
    return () => {
      clearInterval(statusInterval);
      if (roomRef.current) {
        roomRef.current.disconnect();
        cleanupMediaElements();
        roomRef.current = null;
      }
    };
  }, [authLoading, user, sessionId, isConnected, connecting, isInitializing]);

  // Handle browser tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isConnected && roomRef.current) {
        e.preventDefault();
        e.returnValue = 'You are currently in a call. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isConnected]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Auth loading state
  if (authLoading) {
    return {
      loading: true,
      user: null,
      error: null
    };
  }

  // No user state
  if (!user) {
    router.push('/auth');
    return {
      loading: false,
      user: null,
      error: 'Authentication required'
    };
  }

  return {
    // State
    connecting,
    isConnected,
    isAudioMuted,
    isVideoMuted,
    participants,
    sessionInfo,
    sessionParticipants,
    chatMessages,
    newMessage,
    connectionError,
    user,
    callMode,
    
    // Refs
    localVideoRef,
    chatContainerRef,
    
    // Callbacks
    leaveRoom,
    toggleAudioMute,
    toggleVideoMute,
    sendChatMessage,
    setNewMessage,
    handleChatKeyPress,
    
    // Derived state
    loading: authLoading
  };
}