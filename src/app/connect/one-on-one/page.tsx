// src/app/connect/one-on-one/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  createLocalTracks,
  Room,
  ConnectionState,
  LocalAudioTrack,
} from 'livekit-client';
import Button from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy, PhoneCall, MicOff, Mic } from 'lucide-react';

// ⚠️ Prevent static prerendering – this page uses browser-only APIs (window, navigator, WebRTC)
export const dynamic = 'force-client';

export default function OneOnOneCall() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomRef = useRef<Room | null>(null);
  const audioTrackRef = useRef<LocalAudioTrack | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [localAudioEnabled, setLocalAudioEnabled] = useState(true);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const urlRoomId = searchParams.get('room');

  useEffect(() => {
    if (urlRoomId) {
      setRoomId(urlRoomId);
      joinRoom(urlRoomId);
    }

    return () => {
      disconnect();
    };
  }, [urlRoomId]);

  const generateRoomId = () => {
    return 'call-' + Math.random().toString(36).substring(2, 10);
  };

  const startCall = () => {
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    joinRoom(newRoomId);
    if (typeof window !== 'undefined') {
      router.push(`/connect/one-on-one?room=${newRoomId}`);
    }
  };

  const joinRoom = async (roomName: string) => {
    if (isConnecting || isConnected) return;
    setIsConnecting(true);
    setError(null);

    try {
      // Step 1: Fetch token from your API
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName }),
      });

      if (!tokenRes.ok) {
        throw new Error('Failed to get call token');
      }

      const { token, url: livekitUrl } = await tokenRes.json();

      // Step 2: Create audio track
      const tracks = await createLocalTracks({ video: false, audio: true });
      const audioTrack = tracks.find((t) => t.kind === 'audio') as LocalAudioTrack | undefined;

      if (!audioTrack) throw new Error('Audio track creation failed');
      audioTrackRef.current = audioTrack;

      // Step 3: Connect to YOUR LiveKit server
      const room = new Room();
      roomRef.current = room;

      room.on('connectionStateChanged', (state) => {
        if (state === ConnectionState.Connected) {
          setIsConnected(true);
          setIsConnecting(false);
        } else if (
          state === ConnectionState.Disconnected ||
          state === ConnectionState.Reconnecting
        ) {
          if (state === ConnectionState.Disconnected) {
            setIsConnected(false);
            setIsConnecting(false);
          }
        }
      });

      await room.connect(livekitUrl, token);
      await room.localParticipant.publishTrack(audioTrack);
    } catch (err) {
      console.error('LiveKit connection error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error. Please try again.');
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (audioTrackRef.current) {
      audioTrackRef.current.stop(); // Clean up media stream
    }
    audioTrackRef.current = null;
    setIsConnected(false);
  };

  const toggleAudio = () => {
    const track = audioTrackRef.current;
    if (track) {
      if (localAudioEnabled) {
        track.mute();
      } else {
        track.unmute();
      }
      setLocalAudioEnabled(!localAudioEnabled);
    }
  };

  const copyLink = () => {
    if (typeof window === 'undefined' || !roomId) return;
    navigator.clipboard
      .writeText(`${window.location.origin}/connect/one-on-one?room=${roomId}`)
      .catch((err) => console.error('Failed to copy link:', err));
  };

  // === Connected View ===
  if (isConnected) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Call Active</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-muted-foreground">
              You’re connected. Others can join using your link.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" size="icon" onClick={toggleAudio}>
                {localAudioEnabled ? (
                  <Mic className="h-5 w-5" />
                ) : (
                  <MicOff className="h-5 w-5 text-destructive" />
                )}
              </Button>
              <Button
                variant="outline"
                onClick={disconnect}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                End Call
              </Button>
            </div>
            <div className="text-center">
              <Button
                variant="outline"
                size="sm"
                onClick={copyLink}
                className="text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Join Link
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // === Lobby View ===
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">One-on-One Support Call</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && <p className="text-destructive text-center">{error}</p>}

          {roomId && typeof window !== 'undefined' ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Share this link with someone to join your call:
              </p>
              <div className="bg-muted p-3 rounded text-sm break-all font-mono">
                {window.location.origin}/connect/one-on-one?room={roomId}
              </div>
              <Button
                variant="outline"
                onClick={copyLink}
                className="w-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <PhoneCall className="h-12 w-12 text-primary mx-auto" />
              <p className="text-muted-foreground">
                Start a call now. Anyone with the link can join instantly.
              </p>
              <Button
                onClick={startCall}
                disabled={isConnecting}
                className="w-full"
              >
                {isConnecting ? 'Connecting...' : 'Start Call'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}