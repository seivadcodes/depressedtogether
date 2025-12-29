// app/room/[id]/page.tsx — FULL UPDATED VERSION
'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import {
  PhoneOff,
  Mic,
  MicOff,
  Clock,
  AlertTriangle,
  User as UserIcon,
} from 'lucide-react';
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';

type Profile = {
  id: string;
  full_name?: string;
  avatar_url?: string | null;
};

type RoomRecord = {
  id: string;
  room_id: string;
  user_id: string;
  acceptor_id: string | null;
  status: string;
};

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const supabase = createClient();
  const roomId = params.id as string;

  // State
  const [user, setUser] = useState<Profile | null>(null);
  const [roomRecord, setRoomRecord] = useState<RoomRecord | null>(null);
  const [participants, setParticipants] = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isInCall, setIsInCall] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [callEndedByPeer, setCallEndedByPeer] = useState(false);

  // Refs
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const supabaseChannelRef = useRef<any>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/auth');
    }
  }, [authUser, authLoading, router]);

  // Cleanup on unmount or leave
  const cleanupCall = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (remoteAudioRef.current) {
      document.body.removeChild(remoteAudioRef.current);
      remoteAudioRef.current = null;
    }
    if (supabaseChannelRef.current) {
      supabase.removeChannel(supabaseChannelRef.current);
      supabaseChannelRef.current = null;
    }
    setIsInCall(false);
    setCallDuration(0);
  };

  // Initialize room & user
  useEffect(() => {
    if (!authUser?.id || !roomId) return;

    const initialize = async () => {
      try {
        // Load user profile
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', authUser.id)
          .single();

        if (profileErr) throw profileErr;
        setUser(profile);

        // Verify room access
        const { data: roomData, error: roomErr } = await supabase
          .from('quick_connect_requests')
          .select('id, room_id, user_id, acceptor_id, status')
          .eq('room_id', roomId)
          .single();

        if (roomErr || !roomData) throw new Error('Room not found');
        if (roomData.status !== 'matched') throw new Error('Room is not active');
        if (roomData.user_id !== authUser.id && roomData.acceptor_id !== authUser.id) {
          throw new Error('Not authorized');
        }

        setRoomRecord(roomData);

        // Load participant profiles
        const ids = roomData.acceptor_id
          ? [roomData.user_id, roomData.acceptor_id]
          : [roomData.user_id];

        const { data: profiles, error: profilesErr } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', ids);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        const parts = ids.map(id => {
          const p = profileMap.get(id);
          return {
            id,
            name: p?.full_name || 'Anonymous',
            avatar: p?.avatar_url || undefined,
          };
        });

        setParticipants(parts);

        // Set up Supabase Realtime channel for this room
        const channelName = `room:${roomId}`;
        const channel = supabase
          .channel(channelName)
          .on('broadcast', { event: 'call_ended' }, (payload) => {
            console.log('Received call_ended signal from peer');
            setCallEndedByPeer(true);
            // We'll handle disconnection in the main effect below
          })
          .subscribe();

        supabaseChannelRef.current = channel;

        // Join LiveKit room
        await joinLiveKitRoom(roomId, authUser.id);

      } catch (err: any) {
        console.error('Init error:', err);
        setError(err.message || 'Failed to join room');
      } finally {
        setIsLoading(false);
      }
    };

    initialize();

    return () => {
      cleanupCall();
      if (room) room.disconnect();
    };
  }, [roomId, authUser?.id]);

  // Join LiveKit
  const joinLiveKitRoom = async (roomName: string, identity: string) => {
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!livekitUrl) {
      setError('LiveKit URL not configured');
      return;
    }

    const newRoom = new Room();
    setRoom(newRoom);
    setIsInCall(true);

    newRoom.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const element = track.attach();
        element.autoplay = true;
        element.muted = false;
        element.volume = 1.0;

        if (remoteAudioRef.current) {
          document.body.removeChild(remoteAudioRef.current);
        }
        remoteAudioRef.current = element;
        document.body.appendChild(element);
        setRemoteMuted(false);
      }
    });

    newRoom.on(RoomEvent.TrackUnsubscribed, () => {
      setRemoteMuted(true);
    });

    newRoom.on(RoomEvent.Disconnected, () => {
      cleanupCall();
    });

    newRoom.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      if (state === ConnectionState.Disconnected) {
        cleanupCall();
      }
    });

    try {
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomName, identity }),
      });

      if (!tokenRes.ok) throw new Error(`Token error: ${tokenRes.status}`);
      const { token } = await tokenRes.json();

      await newRoom.connect(livekitUrl, token);

      const tracks = await newRoom.localParticipant.createTracks({ audio: true });
      tracks.forEach((track) => {
        newRoom.localParticipant.publishTrack(track);
      });

      intervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('LiveKit join error:', err);
      setError(`Call failed: ${err.message}`);
      cleanupCall();
    }
  };

  const toggleAudio = () => {
    if (!room) return;
    const localAudioTrack = room.localParticipant.audioTrackPublications.values().next().value?.track;
    if (localAudioTrack) {
      if (isAudioEnabled) {
        localAudioTrack.mute();
      } else {
        localAudioTrack.unmute();
      }
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const leaveRoom = async (endedByUser: boolean = true) => {
    if (isLeaving) return;
    setIsLeaving(true);

    try {
      if (endedByUser) {
        // Broadcast that this user is ending the call
        await supabaseChannelRef.current?.send({
          type: 'broadcast',
          event: 'call_ended',
          payload: { by: authUser?.id },
        });

        // Update DB status to 'completed'
        await supabase
          .from('quick_connect_requests')
          .update({ status: 'completed' })
          .eq('room_id', roomId);
      }

      if (room) {
        room.disconnect();
      }

      router.push('/connect');
    } catch (err) {
      console.error('Leave room error:', err);
      setError('Failed to leave room');
    } finally {
      setIsLeaving(false);
    }
  };

  // Handle peer ending the call
  useEffect(() => {
    if (callEndedByPeer && isInCall) {
      console.log('Peer ended the call. Disconnecting...');
      if (room) room.disconnect();
      // Optionally show a toast: "The other participant ended the call"
      setTimeout(() => {
        router.push('/connect');
      }, 1000);
    }
  }, [callEndedByPeer, isInCall, room, router]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-stone-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-stone-600">Joining room...</p>
        </div>
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-stone-100 p-4">
        <div className="bg-white rounded-xl border border-stone-200 p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="text-red-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-stone-800 mb-3">Connection Issue</h2>
          <p className="text-stone-600 mb-6">{error}</p>
          <button
            onClick={() => router.push('/connect')}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-6 rounded-full transition-colors"
          >
            Return to Connections
          </button>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-stone-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Audio Call</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex -space-x-2">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className={`w-10 h-10 rounded-full border-2 ${
                      p.id === user?.id ? 'border-amber-400' : 'border-stone-200'
                    } bg-stone-200 flex items-center justify-center overflow-hidden`}
                  >
                    {p.avatar ? (
                      <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-stone-700 font-medium">{p.name.charAt(0)}</span>
                    )}
                  </div>
                ))}
              </div>
              <span className="text-stone-600">{participants.length} participant{participants.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-amber-100 text-amber-800 rounded-full px-3 py-1">
              <Clock size={16} />
              <span className="font-medium">{formatDuration(callDuration)}</span>
            </div>
            <button
              onClick={() => leaveRoom(true)}
              disabled={isLeaving}
              className={`${
                isLeaving ? 'bg-stone-200 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600'
              } text-white font-bold py-2 px-4 rounded-full flex items-center gap-2 transition-colors`}
            >
              {isLeaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <PhoneOff size={18} />
              )}
              Leave
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-8 mb-6 text-center">
          <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <UserIcon className="text-amber-600" size={40} />
          </div>
          <h2 className="text-xl font-bold text-stone-800 mb-2">
            {isInCall ? 'Call in Progress' : 'Connecting...'}
          </h2>
          <p className="text-stone-600 mb-4">
            {remoteMuted ? 'Other participant muted' : 'Listening...'}
          </p>
          {callEndedByPeer && (
            <div className="inline-block px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium">
              Call ended by the other participant
            </div>
          )}
          {!callEndedByPeer && (
            <div className="inline-block px-4 py-2 bg-amber-50 text-amber-700 rounded-lg font-medium">
              {isInCall ? 'Audio call active' : 'Establishing connection'}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-stone-800 mb-4">Participants</h2>
          <div className="space-y-4">
            {participants.map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  p.id === user?.id ? 'bg-amber-50' : 'hover:bg-stone-50'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-full ${
                    p.id === user?.id ? 'border-2 border-amber-400' : 'border border-stone-200'
                  } bg-stone-200 flex items-center justify-center overflow-hidden flex-shrink-0`}
                >
                  {p.avatar ? (
                    <img src={p.avatar} alt={p.name} className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <span className="text-stone-700 font-medium text-lg">{p.name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-stone-800 truncate">{p.name}</h3>
                  <p className={`text-xs font-medium ${p.id === user?.id ? 'text-amber-600' : 'text-green-500'}`}>
                    {p.id === user?.id
                      ? 'You'
                      : callEndedByPeer
                      ? 'Left'
                      : remoteMuted
                      ? 'Muted'
                      : 'Connected'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-6 mb-6">
          <h3 className="font-bold text-stone-800 mb-4">Audio Control</h3>
          <div className="flex justify-center">
            <button
              onClick={toggleAudio}
              disabled={!isInCall || callEndedByPeer}
              className={`p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors ${
                !isInCall || callEndedByPeer
                  ? 'bg-stone-100 text-stone-400 cursor-not-allowed'
                  : isAudioEnabled
                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {isAudioEnabled ? <Mic size={28} /> : <MicOff size={28} />}
              <span className="text-sm font-medium">{isAudioEnabled ? 'Mute' : 'Unmute'}</span>
            </button>
          </div>
        </div>

        <div className="bg-amber-50 rounded-xl border border-amber-200 p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="text-amber-600" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-stone-800 mb-1">Call in session</h3>
              <p className="text-stone-600 text-sm">
                If either participant leaves, the call ends for both.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}