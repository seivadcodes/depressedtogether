// src/app/call/[id]/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  Room, 
  RemoteParticipant, 
  LocalParticipant, 
  Track, 
  RemoteTrackPublication, 
  RemoteTrack,
  LocalTrack,
  DataPacket_Kind
} from 'livekit-client';
import { 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  Users, 
  MessageSquare, 
  Loader2,
  ArrowLeft,
  Heart,
  Clock,
  Send
} from 'lucide-react';
import Button from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type GriefType =
  | 'parent'
  | 'child'
  | 'spouse'
  | 'sibling'
  | 'friend'
  | 'pet'
  | 'miscarriage'
  | 'caregiver'
  | 'suicide'
  | 'other';

interface Session {
  id: string;
  session_type: 'one_on_one' | 'group';
  status: 'pending' | 'active' | 'ended';
  grief_types: GriefType[];
  host_id: string;
  title: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
}

interface SessionParticipant {
  user_id: string;
  joined_at: string;
  profiles: Profile[] | null;
}

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  timestamp: Date;
}

export default function CallPage() {
  const params = useParams();
  const sessionId = params.id as string;
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
  const [sessionInfo, setSessionInfo] = useState<Session | null>(null);
  const [sessionParticipants, setSessionParticipants] = useState<SessionParticipant[]>([]);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Refs for media elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Grief type labels for display
  const griefTypeLabels: Record<GriefType, string> = {
    parent: 'Loss of a Parent',
    child: 'Loss of a Child',
    spouse: 'Grieving a Partner',
    sibling: 'Loss of a Sibling',
    friend: 'Loss of a Friend',
    pet: 'Pet Loss',
    miscarriage: 'Pregnancy or Infant Loss',
    caregiver: 'Caregiver Grief',
    suicide: 'Suicide Loss',
    other: 'Other Loss',
  };

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
        .select('*')
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
        .select('status')
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
  const addChatMessage = (message: ChatMessage) => {
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

    // Send via data channel - CORRECTED PARAMETER FORMAT
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

 // Leave the room
const leaveRoom = async () => {
  if (room) {
    // Send goodbye message - CORRECTED PARAMETER FORMAT
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

// Handle chat input key press
const handleChatKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatMessage();
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-amber-500" />
          <p className="text-stone-600">Loading your call space...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    router.push('/auth');
    return null;
  }

  if (connecting && !isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center max-w-md mx-auto p-6 bg-white rounded-xl shadow-lg">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Heart className="h-8 w-8 text-white animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75"></div>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-stone-800 mb-2">Connecting to your healing space</h2>
          <p className="text-stone-600 mb-6">
            {sessionInfo?.session_type === 'one_on_one' 
              ? 'Waiting for your healing partner to join...'
              : 'Preparing your group support circle...'}
          </p>
          
          <div className="text-center mb-6">
            <p className="text-sm text-stone-500 mb-2">Please allow camera and microphone permissions when prompted</p>
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-sm px-3 py-1 rounded-full">
              <Mic className="h-3 w-3" />
              <span>Microphone</span>
              <span className="mx-1">•</span>
              <Video className="h-3 w-3" />
              <span>Camera</span>
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-3">
            {sessionParticipants.map((participant, index) => {
              const profile = participant.profiles ? participant.profiles[0] : null;
              return (
                <div key={participant.user_id} className="flex items-center gap-3 w-full">
                  <div className={`w-3 h-3 rounded-full ${
                    index === 0 ? 'bg-amber-500' : 'bg-green-500'
                  } animate-pulse`}></div>
                  <span className="text-stone-700 font-medium">
                    {profile?.full_name || 'Anonymous'} {participant.user_id === user.id && '(you)'}
                  </span>
                  <div className="ml-auto">
                    {participant.user_id === user.id ? (
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        isConnected ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isConnected ? 'Connected' : 'Connecting...'}
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-600">
                        Joining soon
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {connectionError && (
            <div className="mt-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {connectionError}
            </div>
          )}
          
          <Button
            onClick={leaveRoom}
            variant="outline"
            className="mt-6 border-stone-300 text-stone-700 hover:bg-stone-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Leave Call
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-amber-50/20">
      {/* Header */}
      <div className="border-b border-stone-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/connect')}
              className="p-2 text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-stone-800">{sessionInfo?.title}</h1>
              {sessionInfo?.grief_types[0] && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Heart className="h-3 w-3 text-amber-500" />
                  <span className="text-sm text-stone-600">
                    {griefTypeLabels[sessionInfo.grief_types[0] as GriefType]}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
              <span className="flex h-2 w-2 rounded-full bg-green-500 mr-1.5"></span>
              {participants.length + 1} {sessionInfo?.session_type === 'group' ? 'people' : 'person'}
            </span>
            
            <Button 
              onClick={leaveRoom}
              variant="outline"
              size="icon"
              className="bg-red-500 hover:bg-red-600 text-white border-red-500"
            >
              <PhoneOff className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {connectionError && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
            {connectionError}. Please try refreshing the page or contact support if the issue persists.
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Local Video */}
            <Card className="overflow-hidden bg-stone-900 rounded-xl shadow-md">
              <div className="relative aspect-video bg-stone-800">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center">
                  <div className="bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                    <span className="text-white text-sm font-medium">
                      You {isAudioMuted && '(muted)'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={toggleAudioMute}
                      className={`p-2 rounded-full ${
                        isAudioMuted ? 'bg-red-500/20 text-red-400' : 'bg-black/30 text-white hover:bg-black/40'
                      }`}
                      title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                      {isAudioMuted ? (
                        <MicOff className="h-5 w-5" />
                      ) : (
                        <Mic className="h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={toggleVideoMute}
                      className={`p-2 rounded-full ${
                        isVideoMuted ? 'bg-red-500/20 text-red-400' : 'bg-black/30 text-white hover:bg-black/40'
                      }`}
                      title={isVideoMuted ? 'Enable camera' : 'Disable camera'}
                    >
                      {isVideoMuted ? (
                        <VideoOff className="h-5 w-5" />
                      ) : (
                        <Video className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Remote Videos */}
            {participants.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {participants.map((participant) => {
                  if (participant.identity === user?.id) return null; // Skip local participant
                  
                  const participantData = sessionParticipants.find(p => p.user_id === participant.identity);
                  const profile = participantData?.profiles ? participantData.profiles[0] : null;
                  return (
                    <Card key={participant.identity} className="overflow-hidden bg-stone-900 rounded-xl shadow-md">
                      <div className="relative aspect-video bg-stone-800">
                        <div 
                          id={`remote-video-${participant.identity}`}
                          ref={el => {
                            if (el) {
                              // Clear existing content
                              el.innerHTML = '';
                              // Create and attach video element
                              const videoEl = document.createElement('video');
                              videoEl.autoplay = true;
                              videoEl.playsInline = true;
                              videoEl.className = 'w-full h-full object-cover';
                              el.appendChild(videoEl);
                              
                              // Store reference
                              remoteVideoRefs.current.set(participant.identity, videoEl);
                            }
                          }}
                          className="w-full h-full"
                        />
                        <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                          <span className="text-white text-sm font-medium">
                            {profile?.full_name || participant.name || 'Anonymous'}
                          </span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="bg-white border-2 border-dashed border-amber-300 rounded-xl p-8 text-center">
                <div className="flex flex-col items-center justify-center h-64">
                  {sessionInfo?.session_type === 'one_on_one' ? (
                    <>
                      <div className="relative mb-6">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                          <Users className="h-8 w-8 text-white" />
                        </div>
                        <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75"></div>
                      </div>
                      <h3 className="text-xl font-semibold text-stone-800 mb-2">Waiting for your support partner</h3>
                      <p className="text-stone-600">They'll join you shortly. This is a safe space for healing.</p>
                    </>
                  ) : (
                    <>
                      <div className="relative mb-6">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                          <Users className="h-8 w-8 text-white" />
                        </div>
                        <div className="absolute inset-0 rounded-full bg-amber-400 animate-ping opacity-75"></div>
                      </div>
                      <h3 className="text-xl font-semibold text-stone-800 mb-2">Your support circle is forming</h3>
                      <p className="text-stone-600">More people will join soon. Thank you for being here.</p>
                    </>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar - Participants & Chat */}
          <div className="space-y-6">
            {/* Participants List */}
            <Card className="p-4 bg-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-stone-800 flex items-center gap-2">
                  <Users className="h-4 w-4 text-amber-500" />
                  Participants
                </h3>
                <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full">
                  {participants.length + 1} / {sessionInfo?.session_type === 'one_on_one' ? 2 : 8}
                </span>
              </div>
              
              <div className="space-y-3">
                {/* Current User */}
                <div className="flex items-center gap-3 p-2 bg-amber-50 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="font-medium text-stone-800 flex-1">You</span>
                  {isAudioMuted && (
                    <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full">
                      Muted
                    </span>
                  )}
                </div>
                
                {/* Remote Participants */}
                {participants.map((participant) => {
                  if (participant.identity === user?.id) return null;
                  
                  const participantData = sessionParticipants.find(p => p.user_id === participant.identity);
                  const profile = participantData?.profiles ? participantData.profiles[0] : null;
                  return (
                    <div key={participant.identity} className="flex items-center gap-3 p-2 hover:bg-stone-50 rounded-lg transition-colors">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-stone-700 flex-1">
                        {profile?.full_name || participant.name || 'Anonymous'}
                      </span>
                      {participant.identity === sessionInfo?.host_id && (
                        <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-full">
                          Host
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Chat Section */}
            <Card className="p-4 bg-white h-[300px] flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-stone-800 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                  Support Chat
                </h3>
              </div>
              
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto mb-4 bg-stone-50 rounded-lg p-3 min-h-[200px] space-y-3"
              >
                {chatMessages.length === 0 ? (
                  <div className="text-center text-stone-500 text-sm py-8">
                    <div className="mb-4 flex justify-center">
                      <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                        <MessageSquare className="h-6 w-6 text-amber-500" />
                      </div>
                    </div>
                    <p>Share thoughts and resources here</p>
                    <p className="text-xs mt-1 text-stone-400">Messages are not saved after the call ends</p>
                  </div>
                ) : (
                  chatMessages.map((message) => (
                    <div 
                      key={message.id} 
                      className={`flex ${message.sender_id === 'system' ? 'justify-center' : message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] rounded-lg p-3 ${
                        message.sender_id === 'system' 
                          ? 'bg-stone-200 text-stone-700 text-center text-xs'
                          : message.sender_id === user?.id
                          ? 'bg-amber-500 text-white rounded-br-none'
                          : 'bg-stone-100 text-stone-800 rounded-bl-none'
                      }`}>
                        {message.sender_id !== 'system' && (
                          <div className={`text-xs font-medium mb-1 ${
                            message.sender_id === user?.id ? 'text-amber-100' : 'text-amber-700'
                          }`}>
                            {message.sender_name}
                          </div>
                        )}
                        <div className="text-sm">{message.content}</div>
                        <div className={`text-xs mt-1 ${
                          message.sender_id === 'system' ? 'text-stone-500' : 'text-white/80'
                        }`}>
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleChatKeyPress}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
                <Button 
                  onClick={sendChatMessage}
                  disabled={!newMessage.trim()}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            {/* Call Guidelines */}
            <Card className="p-4 bg-white">
              <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2">
                <Heart className="h-4 w-4 text-amber-500" />
                This is a safe space
              </h3>
              
              <ul className="space-y-2 text-sm text-stone-600">
                <li className="flex items-start gap-2">
                  <span className="mt-1">•</span>
                  <span>Listen with compassion, speak from the heart</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1">•</span>
                  <span>What's shared here stays here</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1">•</span>
                  <span>You can step away anytime if needed</span>
                </li>
              </ul>
              
              <div className="mt-4 pt-4 border-t border-stone-200 flex items-center justify-between">
                <span className="text-xs text-stone-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Session started {sessionInfo?.created_at ? new Date(sessionInfo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'}
                </span>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={leaveRoom}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-300"
                >
                  End Call
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}