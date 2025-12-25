// src/app/call/[id]/useCallPageLogic.ts
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
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [participants, setParticipants] = useState<RemoteParticipant[]>([]);
  const [localParticipant, setLocalParticipant] = useState<LocalParticipant | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [sessionInfo, setSessionInfo] = useState<any | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<any[]>([]);

  // Chat state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Refs for media elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Cleanup function for media elements
  const cleanupMediaElements = () => {
    // Cleanup local video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
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
  .select('status')
  .eq('id', sessionId)
  .single();

      if (sessionError) throw sessionError;
      setSessionInfo(sessionData);

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
        session: sessionData,
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
    if (!sessionId || !user) {
      setConnectionError('Missing session ID or user information');
      return;
    }

    try {
      setConnecting(true);
      setConnectionError(null);

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

      // Setup event listeners before connecting
      setupRoomEventListeners(newRoom);

      // Connect to room
      await newRoom.connect(url, token);
      
      // Set up local participant
      const localParticipant = newRoom.localParticipant;
      setLocalParticipant(localParticipant);
      
      // Set up local video
      if (localVideoRef.current) {
        // Get camera permissions first
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        // Stop any existing tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Create tracks with proper permissions
        const tracks = await localParticipant.createTracks({
          video: true,
          audio: true,
        });
        
        tracks.forEach(track => {
          if (track.kind === 'video' && localVideoRef.current) {
            track.attach(localVideoRef.current);
          }
          localParticipant.publishTrack(track);
        });
        
        // Set initial mute states
        setIsAudioMuted(false);
        setIsVideoMuted(false);
      }

      // Update session status to active if it's still pending
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

      setRoom(newRoom);
      setIsConnected(true);
      
      console.log('Successfully connected to LiveKit room:', sessionId);
    } catch (error) {
      console.error('Error connecting to LiveKit room:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to the call';
      setConnectionError(errorMessage);
      
      // Check for specific permission errors
      if (error instanceof Error && (
        error.message.includes('NotAllowedError') || 
        error.message.includes('Permission denied')
      )) {
        setConnectionError('Please allow camera and microphone permissions to join the call.');
      }
    } finally {
      setConnecting(false);
    }
  };

  // Setup event listeners for the room
  const setupRoomEventListeners = (room: Room) => {
    // Participant connected
    room.on('participantConnected', (participant: RemoteParticipant) => {
      console.log(`Participant connected: ${participant.identity}`);
      
      setParticipants(prev => {
        if (!prev.some(p => p.identity === participant.identity)) {
          return [...prev, participant];
        }
        return prev;
      });
      
      // Subscribe to all tracks immediately
      participant.trackPublications.forEach((publication: RemoteTrackPublication) => {
        if (publication.track) {
          // No need to set subscription permissions in newer LiveKit versions
          // as tracks are auto-subscribed by default
        }
      });
    });

    // Participant disconnected
    room.on('participantDisconnected', (participant: RemoteParticipant) => {
      console.log(`Participant disconnected: ${participant.identity}`);
      
      // Cleanup media elements for this participant
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
      
      // Add system message to chat
      addSystemMessage(`${participant.name || 'Someone'} has left the call`);
    });

    // Track published
    room.on('trackPublished', (publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log(`Track published by ${participant.identity}: ${publication.kind}`);
    });

    // Track subscribed (audio or video)
    room.on('trackSubscribed', (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
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
          videoEl.setAttribute('playsinline', 'true');
          videoEl.className = 'w-full h-full object-cover rounded-lg';
          remoteVideoRefs.current.set(participant.identity, videoEl);
        }
        track.attach(videoEl);
      }
    });

    // Track unsubscribed
    room.on('trackUnsubscribed', (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      console.log(`Track unsubscribed from ${participant.identity}: ${track.kind}`);
      track.detach();
    });

    // Data received (chat messages)
    room.on('dataReceived', (payload: Uint8Array, participant?: RemoteParticipant) => {
      try {
        const message = new TextDecoder().decode(payload);
        const data = JSON.parse(message);
        
        if (data.type === 'chat') {
          const sender = participant || room.localParticipant;
          const senderName = participant ? participant.name : 'You';
          
          addChatMessage({
            id: Date.now().toString(),
            sender_id: sender.identity,
            sender_name: senderName || 'Anonymous',
            content: data.content,
            timestamp: new Date()
          });
        }
      } catch (error) {
        console.error('Error parsing data message:', error);
      }
    });

    // Room disconnected
    room.on('disconnected', () => {
      console.log('Disconnected from room');
      setIsConnected(false);
      cleanupMediaElements();
    });
  };

  // Toggle audio mute
  const toggleAudioMute = async () => {
    if (!room || !localParticipant) return;
    
    try {
      const newState = !isAudioMuted;
      
      // Get audio tracks
      const audioTrackPublication = Array.from(localParticipant.audioTrackPublications.values())[0];
      
      if (audioTrackPublication && audioTrackPublication.track) {
        // Unpublish existing track
        await localParticipant.unpublishTrack(audioTrackPublication.track);
      }
      
      if (!newState) {
        // Create new audio track if unmuting
        const tracks = await localParticipant.createTracks({ audio: true });
        if (tracks.length > 0 && tracks[0]) {
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
    if (!room || !localParticipant || !localVideoRef.current) return;
    
    try {
      const newState = !isVideoMuted;
      
      // Get video tracks
      const videoTrackPublication = Array.from(localParticipant.videoTrackPublications.values())[0];
      
      if (videoTrackPublication && videoTrackPublication.track) {
        // Unpublish existing track
        await localParticipant.unpublishTrack(videoTrackPublication.track);
      }
      
      if (!newState) {
        // Create new video track if unmuting
        const tracks = await localParticipant.createTracks({ 
          video: { resolution: { width: 1280, height: 720 } }
        });
        
        if (tracks.length > 0 && tracks[0].kind === 'video') {
          tracks[0].attach(localVideoRef.current);
          await localParticipant.publishTrack(tracks[0]);
        }
      } else {
        // Show placeholder when video is muted
        localVideoRef.current.srcObject = null;
        // Optionally show a placeholder image
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
    if (!room || !newMessage.trim() || !user) return;

    try {
      const message = {
        type: 'chat',
        content: newMessage.trim(),
        timestamp: new Date().toISOString()
      };

      // Send via data channel
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message)),
        { reliable: true }
      );

      // Add to local chat immediately
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
    if (room) {
      // Send goodbye message
      try {
        const goodbyeMessage = {
          type: 'chat',
          content: 'has left the call',
          timestamp: new Date().toISOString()
        };

        await room.localParticipant.publishData(
          new TextEncoder().encode(JSON.stringify(goodbyeMessage)),
          { reliable: true }
        );
      } catch (error) {
        console.error('Error sending goodbye message:', error);
      }
      
      room.disconnect();
      cleanupMediaElements();
      setIsConnected(false);
      
      // Update session status if this was the last participant
      if (sessionInfo?.status === 'active') {
        const { count } = await supabase
          .from('session_participants')
          .select('*', { count: 'exact', head: true })
          .eq('session_id', sessionId);
        
        if (count !== null && count <= 1) { // Only this user remaining
          await supabase
            .from('sessions')
            .update({ status: 'ended' })
            .eq('id', sessionId);
        }
      }
      
      router.push('/connect');
    }
  };

  // Initialize - fetch session details and connect
  useEffect(() => {
    if (authLoading || !user) return;

    const initCall = async () => {
      const sessionData = await fetchSessionDetails();
      if (sessionData) {
        await connectToRoom();
        
        // Add welcome message
        setTimeout(() => {
          addSystemMessage('Welcome to your healing space. This is a safe place to share and be heard.');
        }, 1000);
      }
    };

    initCall();

    // Setup interval to update session status
    const statusInterval = setInterval(async () => {
      if (isConnected) {
        // Check if session should be ended due to inactivity
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
    }, 30000); // Check every 30 seconds

    return () => {
      clearInterval(statusInterval);
      if (room) {
        room.disconnect();
        cleanupMediaElements();
      }
    };
  }, [authLoading, user, sessionId]);

  // Handle browser tab close or refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isConnected && room) {
        e.preventDefault();
        e.returnValue = 'You are currently in a call. Are you sure you want to leave?';
        return 'You are currently in a call. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isConnected, room]);

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