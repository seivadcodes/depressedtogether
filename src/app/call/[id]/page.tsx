// src/app/call/[id]/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PhoneOff, Mic, MicOff, X, Heart, MessageCircle, CheckCircle } from 'lucide-react'; // ✅ Added CheckCircle import
import { 
  Room, 
  RoomEvent, 
  ParticipantEvent,
  Track,
  createLocalTracks,
  RemoteParticipant,
  LocalAudioTrack,
  RemoteTrack,
  TrackEvent, 
  ConnectionState
} from 'livekit-client';

export default function CallPage() {
  const params = useParams<{ id: string }>();
  const sessionId = params?.id;
  const router = useRouter();
  const supabase = createClient();
  
  const [room, setRoom] = useState<Room | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [participants, setParticipants] = useState<Record<string, { identity: string; name: string; isConnected: boolean }>>({});
  const [sessionDetails, setSessionDetails] = useState<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const localAudioTrackRef = useRef<LocalAudioTrack | null>(null);
  const remoteAudioElementsRef = useRef<HTMLAudioElement[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      remoteAudioElementsRef.current.forEach(el => {
        el.pause();
        el.remove();
      });
      if (timerRef.current) clearInterval(timerRef.current);
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.stop();
        localAudioTrackRef.current = null;
      }
      if (room) room.disconnect();
    };
  }, [room]);

  // Initialize call when component mounts
  useEffect(() => {
    if (!sessionId) return;

    const initializeCall = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Get current user
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          router.push('/auth');
          return;
        }

        // Verify user is part of this session
        const { data: participant, error: participantError } = await supabase
          .from('session_participants')
          .select('*, session:session_id(*)')
          .eq('session_id', sessionId)
          .eq('user_id', session.user.id)
          .single();

        if (participantError || !participant) {
          setError('You are not authorized to join this call. Redirecting...');
          setTimeout(() => router.push('/connect'), 3000);
          return;
        }

        setSessionDetails(participant.session);

        // Connect to LiveKit room immediately
        const roomName = sessionId;
        const identity = session.user.id;
        
        const newRoom = await connectToRoom(roomName, identity);
        setRoom(newRoom);
        
        // Set up participant tracking
        newRoom.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          handleParticipantConnected(participant);
        });
        
        newRoom.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
          handleParticipantDisconnected(participant);
        });
        
        newRoom.on(RoomEvent.Disconnected, handleRoomDisconnected);
        
        // Handle existing participants (for the first connection)
       newRoom.remoteParticipants.forEach((participant: RemoteParticipant) => {
  handleParticipantConnected(participant);
});

      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to start call. Please try again from the Connect page.');
        setTimeout(() => router.push('/connect'), 5000);
      } finally {
        setIsLoading(false);
      }
    };

    initializeCall();
  }, [sessionId]);

  const connectToRoom = async (roomName: string, identity: string) => {
    try {
      // Get LiveKit token
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          identity,
          room: roomName,
          isPublisher: true
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get LiveKit token');
      }

      const { token, url } = await response.json();
      
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
          videoEncoding: { maxBitrate: 300_000 },
          videoCodec: 'vp8',
        },
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Handle connection state changes
      newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
        if (state === ConnectionState.Connected) {
          setCallStatus('connecting');
        } else if (state === ConnectionState.Disconnected) {
          setCallStatus('ended');
        }
      });

      await newRoom.connect(url, token);
      
      // Create and publish local audio track
      const audioTracks = await createLocalTracks({ 
        audio: true, 
        video: false 
      });

      if (audioTracks[0]) {
        localAudioTrackRef.current = audioTracks[0] as LocalAudioTrack;
        await newRoom.localParticipant.publishTrack(audioTracks[0]);
      }

      return newRoom;
    } catch (err) {
      console.error('Room connection error:', err);
      setError('Failed to connect to audio call');
      setCallStatus('ended');
      throw err;
    }
  };

  const handleParticipantConnected = (participant: RemoteParticipant) => {
    setParticipants(prev => ({
      ...prev,
      [participant.identity]: {
        identity: participant.identity,
        name: 'Community Member',
        isConnected: true
      }
    }));

    participant.on(ParticipantEvent.TrackSubscribed, (track: RemoteTrack) => {
      handleTrackSubscribed(track, participant);
    });
  };

  const handleParticipantDisconnected = (participant: RemoteParticipant) => {
    setParticipants(prev => {
      const updated = { ...prev };
      if (updated[participant.identity]) {
        updated[participant.identity].isConnected = false;
      }
      return updated;
    });

    // If this was the only other participant, end the call after delay
    const activeParticipants = Object.values(participants).filter(
      (p) => p.isConnected && p.identity !== participant.identity
    );
    
    if (activeParticipants.length <= 1) {
      setCallStatus('ended');
      setTimeout(endCall, 3000);
    }
  };

  const handleRoomDisconnected = () => {
    setCallStatus('ended');
    setTimeout(endCall, 2000);
  };

  const handleTrackSubscribed = (track: RemoteTrack, _participant: RemoteParticipant) => {
    if (track.kind === Track.Kind.Audio) {
      // Start timer and update status ONLY when we receive the first remote audio track
      if (callStatus !== 'connected') {
        setCallStatus('connected');
        setCallDuration(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }

      const element = track.attach();
      element.volume = 0.8;
      element.autoplay = true;
      element.style.display = 'none';
      document.body.appendChild(element);
      remoteAudioElementsRef.current.push(element);
      
      
    }
  };

  const endCall = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Update session status in database
    if (sessionDetails?.id) {
      await supabase
        .from('sessions')
        .update({ status: 'ended' })
        .eq('id', sessionDetails.id);
    }

    // Cleanup room connection
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current = null;
    }

    if (room) {
      room.disconnect();
      setRoom(null);
    }
    
    // Redirect to connect page after delay
    setTimeout(() => {
      router.push('/connect');
    }, 2000);
  };

  const toggleMute = () => {
    if (localAudioTrackRef.current) {
      if (isMuted) {
        localAudioTrackRef.current.unmute();
      } else {
        localAudioTrackRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-pink-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md mx-4">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-amber-500 border-t-transparent mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-stone-800 mb-2">Connecting Your Call</h2>
          <p className="text-stone-600 mb-4">
            {sessionDetails?.session_type === 'one_on_one' 
              ? 'Finding someone who understands...' 
              : 'Joining your support circle...'}
          </p>
          
          <div className="flex justify-center gap-2">
            {[...Array(3)].map((_, i) => (
              <div 
                key={i} 
                className={`w-3 h-3 rounded-full bg-amber-300 animate-bounce`}
                style={{ animationDelay: `${i * 0.2}s` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-pink-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg max-w-md mx-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <X className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-2">Connection Issue</h2>
          <p className="text-stone-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/connect')}
            className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors"
          >
            Back to Connect
          </button>
        </div>
      </div>
    );
  }

  // Main call interface
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-pink-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-amber-200 bg-white/80 backdrop-blur-sm z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/connect')}
              className="p-2 hover:bg-amber-100 rounded-full transition-colors"
              aria-label="Back to Connect"
            >
              <X className="h-6 w-6 text-stone-700" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-stone-800">
                {sessionDetails?.title || 'Support Call'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${callStatus === 'connected' ? 'bg-green-500' : 'bg-amber-500'}`}></div>
                <span className="text-sm font-medium text-stone-600">
                  {callStatus === 'connecting' && 'Connecting...'}
                  {callStatus === 'connected' && `Connected • ${formatTime(callDuration)}`}
                  {callStatus === 'ended' && 'Call ended'}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {sessionDetails?.grief_types?.[0] && (
              <div className="flex items-center gap-1 bg-amber-100 px-3 py-1 rounded-full">
                <Heart className="h-4 w-4 text-amber-700" />
                <span className="text-sm font-medium text-amber-800">
                  {sessionDetails.grief_types[0].replace(/_/g, ' ')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Connection status */}
        {callStatus === 'connecting' && (
          <div className="text-center mb-8 max-w-md mx-auto">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold text-stone-800 mb-2">
              {sessionDetails?.session_type === 'one_on_one'
                ? 'Waiting for your supporter'
                : 'Waiting for others to join'}
            </h2>
            <p className="text-stone-600">
              {sessionDetails?.session_type === 'one_on_one'
                ? 'Someone will join you shortly to listen and support'
                : 'Your support circle is forming. More people will join soon.'}
            </p>
          </div>
        )}

        {/* Participant avatars */}
        <div className="flex -space-x-4 mb-8">
          {Object.values(participants).map((participant, index) => (
            <div 
              key={participant.identity} 
              className={`w-24 h-24 rounded-full border-4 ${
                participant.isConnected 
                  ? 'border-amber-400 bg-gradient-to-br from-amber-300 to-amber-500' 
                  : 'border-stone-300 bg-stone-200'
              } flex items-center justify-center text-white font-bold text-xl shadow-lg`}
              style={{ zIndex: Object.values(participants).length - index }}
            >
              {participant.isConnected ? (
                <span>{participant.name.charAt(0)}</span>
              ) : (
                <X className="h-8 w-8 text-stone-500" />
              )}
            </div>
          ))}
          
          {/* Current user avatar */}
          <div className="w-24 h-24 rounded-full border-4 border-white bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-amber-300 animate-pulse">
            <span>Y</span>
          </div>
        </div>

        {/* Call ended overlay */}
        {callStatus === 'ended' && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 backdrop-blur-sm">
            <div className="text-center p-8 bg-white rounded-2xl max-w-md mx-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="h-8 w-8 text-green-600" /> {/* ✅ Now properly imported */}
              </div>
              <h2 className="text-2xl font-bold text-stone-800 mb-2">Call Completed</h2>
              <p className="text-stone-600 mb-6">
                Thank you for sharing your journey. Your courage makes our community stronger.
              </p>
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => router.push('/connect')}
                  className="px-6 py-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-medium rounded-xl transition-colors"
                >
                  Back to Connect
                </button>
                <button
                  onClick={() => router.push('/journal')}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-xl transition-colors"
                >
                  <MessageCircle className="h-5 w-5 inline mr-1" />
                  Journal Your Thoughts
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 pb-12 bg-white/80 backdrop-blur-sm border-t border-amber-200 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-center gap-6 mb-6">
            <button
              onClick={toggleMute}
              className={`p-4 rounded-full transition-all duration-300 ${
                isMuted 
                  ? 'bg-red-100 text-red-600 border-2 border-red-300 scale-105' 
                  : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
              }`}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
            </button>
          </div>

          <div className="flex justify-center">
            <button
              onClick={endCall}
              className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg ring-4 ring-red-200"
              aria-label="End call"
            >
              <PhoneOff size={32} className="text-white" />
            </button>
          </div>
          
          <p className="text-center text-stone-500 mt-4 text-sm max-w-md mx-auto">
            This is a safe space. What's shared here stays here. 
            You can end the call anytime by clicking the red button.
          </p>
        </div>
      </div>

      {/* Guiding text for first-time users */}
      {callStatus === 'connecting' && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-6 py-3 rounded-full backdrop-blur-sm text-sm z-20 animate-fade-in-up">
          Someone will join you shortly. Your microphone is live - you can start sharing whenever you're ready.
        </div>
      )}
    </div>
  );
}