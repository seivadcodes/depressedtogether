// app/calls2/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { PhoneOff, Mic, MicOff, X } from 'lucide-react';
import { Room, RoomEvent, ParticipantEvent, Track, createLocalTracks } from 'livekit-client';

export default function Calls2Page() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = createClient();

  const roomId = searchParams.get('roomId');
  const peerId = searchParams.get('peer');
  const isInitiator = searchParams.get('initiator') === 'true';

  const [room, setRoom] = useState<any>(null);
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [peerName, setPeerName] = useState<string>('Community Member');
  const [isMuted, setIsMuted] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioElementsRef = useRef<HTMLAudioElement[]>([]);

  // Cleanup
  useEffect(() => {
    return () => {
      audioElementsRef.current.forEach(el => { el.pause(); el.remove(); });
      if (timerRef.current) clearInterval(timerRef.current);
      if (room) room.disconnect();
    };
  }, [room]);

  // Fetch peer name + listen for disconnect
  useEffect(() => {
    if (!peerId) return;
    const fetchPeer = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', peerId)
        .single();
      if (!error && data) setPeerName(data.full_name || 'Community Member');
    };
    fetchPeer();
  }, [peerId]);

  // Auto-connect when room info is present
  useEffect(() => {
    if (!roomId || !peerId) {
      router.push('/invite');
      return;
    }

    const connect = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const identity = `${isInitiator ? 'caller' : 'callee'}-${session?.user.id}`;

        const tokenRes = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identity, room: roomId, isPublisher: true }),
        });
        const { token, url } = await tokenRes.json();

        const newRoom = new Room({ adaptiveStream: true, dynacast: true });

        newRoom.on(RoomEvent.ParticipantDisconnected, () => {
          setCallStatus('ended');
          setTimeout(() => router.push('/invite'), 3000);
        });

        newRoom.on(RoomEvent.Disconnected, () => {
          setCallStatus('ended');
          setTimeout(() => router.push('/invite'), 3000);
        });

       newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
  if (track.kind === Track.Kind.Audio) {
    if (callStatus !== 'connected') {
      setCallStatus('connected');
      setCallDuration(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
    }

    const el = track.attach();
    el.volume = 0.8;
    el.style.display = 'none';
    document.body.appendChild(el);
    audioElementsRef.current.push(el);

    // Store reference so we can remove it later
    const cleanup = () => {
      el.remove();
      audioElementsRef.current = audioElementsRef.current.filter(e => e !== el);
    };

    // Clean up when track is unsubscribed
    newRoom.on(RoomEvent.TrackUnsubscribed, (unsubTrack, unsubPub, unsubPart) => {
      if (unsubTrack === track) {
        cleanup();
      }
    });

    // Also clean up on room disconnect
    newRoom.on(RoomEvent.Disconnected, cleanup);
  }
});

        await newRoom.connect(url, token);

        const [audioTrack] = await createLocalTracks({ audio: true, video: false });
        if (audioTrack) await newRoom.localParticipant.publishTrack(audioTrack);

        setRoom(newRoom);
      } catch (err) {
        console.error('Call connect failed:', err);
        setError('Failed to start call');
        setTimeout(() => router.push('/invite'), 3000);
      }
    };

    connect();
  }, [roomId, peerId, isInitiator]);

  const endCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (room) room.disconnect();
    router.push('/invite');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!roomId || !peerId) return null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top bar */}
      <div className="p-6 text-center border-b border-gray-800">
        <h1 className="text-2xl font-bold">{peerName}</h1>
        <p className="text-gray-400 mt-1">
          {callStatus === 'connecting' ? 'Connecting...' : 
           callStatus === 'connected' ? `Talking • ${formatTime(callDuration)}` : 
           'Call ended'}
        </p>
      </div>

      {/* Avatar */}
      <div className="flex-1 flex items-center justify-center">
        <div className="w-48 h-48 rounded-full bg-gray-800 flex items-center justify-center border-4 border-gray-700">
          <span className="text-5xl">{peerName.charAt(0).toUpperCase()}</span>
        </div>
      </div>

      {/* Ended overlay */}
      {callStatus === 'ended' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
          <p className="text-lg text-gray-300">Call ended</p>
        </div>
      )}

      {/* Controls */}
      <div className="p-8 pb-12">
        <div className="flex justify-center gap-8 mb-8">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className={`p-4 rounded-full ${isMuted ? 'bg-red-500/20 text-red-400 border border-red-500' : 'bg-gray-700 text-white'}`}
          >
            {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
        </div>

        <div className="flex justify-center">
          <button
            onClick={endCall}
            className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center hover:bg-red-700"
            aria-label="End call"
          >
            <PhoneOff size={32} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}