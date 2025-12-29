'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';
import { useAuth } from '@/hooks/useAuth';

type Profile = {
  id: string;
  username?: string;
  full_name?: string;
};

export default function CallPage() {
  const { user, loading: authLoading, signOut: authSignOut } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [otherUsers, setOtherUsers] = useState<Profile[]>([]);
  const [targetUser, setTargetUser] = useState<string>('');
  const [incomingCall, setIncomingCall] = useState<{ callerId: string; callId: string } | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [loading, setLoading] = useState(true);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const supabase = createClient();

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      console.warn('Not authenticated. Redirecting to /auth.');
      router.push('/auth');
    }
  }, [user, authLoading, router]);

  // Fetch profile and other users
  useEffect(() => {
    if (!user) return;

    const fetchProfileAndUsers = async () => {
      try {
        // Fetch current user's profile
        const { data: userProfile, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Failed to fetch profile:', profileError);
          return;
        }

        const displayName = userProfile.username || userProfile.full_name || user.email?.split('@')[0] || 'User';
        setProfile({ ...userProfile, username: displayName });

        // Fetch other users (for display)
        const { data: users, error: usersError } = await supabase
          .from('profiles')
          .select('id, username, full_name')
          .neq('id', user.id);

        if (usersError) {
          console.error('Failed to fetch other users:', usersError);
          setOtherUsers([]);
        } else {
          setOtherUsers(
            users.map((u) => ({
              ...u,
              username: u.username || u.full_name || 'Anonymous',
            }))
          );
        }
      } catch (err) {
        console.error('Unexpected error in profile fetch:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndUsers();
  }, [user, supabase]);

  // Set up Supabase call signaling
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('calls')
      .on('broadcast', { event: 'call' }, (payload) => {
        if (payload.payload.targetId === user.id && !isInCall) {
          console.log('Incoming call:', payload.payload);
          setIncomingCall({
            callerId: payload.payload.callerId,
            callId: payload.payload.callId,
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, isInCall, supabase]);

  const startCall = async () => {
    if (!user || !targetUser) return;

    const callId = `${user.id}-${targetUser}-${Date.now()}`;
    console.log('Starting call:', { callerId: user.id, targetId: targetUser, callId });

    await supabase.channel('calls').send({
      type: 'broadcast',
      event: 'call',
      payload: { callerId: user.id, targetId: targetUser, callId },
    });

    joinRoom(callId);
  };

  const joinRoom = async (callId: string) => {
    if (!user?.id) {
      console.error('Cannot join room: user.id missing');
      setIsInCall(false);
      return;
    }

    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!livekitUrl) {
      alert('LiveKit URL missing in environment. Check NEXT_PUBLIC_LIVEKIT_URL.');
      setIsInCall(false);
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
        console.log('Remote audio attached');
      }
    });

    newRoom.on(RoomEvent.Disconnected, () => {
      console.log('Room disconnected');
      if (remoteAudioRef.current) {
        document.body.removeChild(remoteAudioRef.current);
        remoteAudioRef.current = null;
      }
      setIsInCall(false);
    });

    newRoom.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
      console.log('LiveKit connection state:', state);
    });

    try {
      console.log('Requesting LiveKit token for room:', callId);
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: callId,
          identity: user.id, // ✅ using stable user.id
        }),
      });

      if (!tokenRes.ok) {
        const errorText = await tokenRes.text();
        console.error('Token fetch failed:', tokenRes.status, errorText);
        alert(`Failed to get call token (${tokenRes.status}). Check console.`);
        setIsInCall(false);
        return;
      }

      const { token } = await tokenRes.json();
      if (!token) throw new Error('No token in response');

      console.log('Connecting to LiveKit...');
      await newRoom.connect(livekitUrl, token);

      // Publish audio
      const tracks = await newRoom.localParticipant.createTracks({ audio: true });
      tracks.forEach((track) => {
        newRoom.localParticipant.publishTrack(track);
        console.log('Published track:', track.kind);
      });
    } catch (err: any) {
      console.error('joinRoom error:', err);
      const msg = err.message || 'Unknown error';
      alert(`Call failed: ${msg}\n\nSee browser console for details.`);
      setIsInCall(false);
    }
  };

  const acceptCall = () => {
    if (incomingCall) {
      joinRoom(incomingCall.callId);
      setIncomingCall(null);
    }
  };

  const endCall = () => {
    if (room) {
      room.disconnect();
    }
  };

  const declineCall = () => setIncomingCall(null);

  const handleSignOut = async () => {
    await authSignOut();
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-lg text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!user || !profile) {
    return null;
  }

  // Find caller display name for incoming call
  const callerProfile = incomingCall
    ? otherUsers.find((u) => u.id === incomingCall.callerId)
    : null;
  const callerName = callerProfile?.username || 'Someone';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Audio Calls</h1>
          <button
            onClick={handleSignOut}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            Logout
          </button>
        </div>

        {isInCall ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center border-2 border-blue-500">
            <h2 className="text-2xl font-bold mb-4 text-blue-600">In Call</h2>
            <p className="text-gray-600 mb-6">
              Connected with{' '}
              {room?.remoteParticipants.size
                ? Array.from(room.remoteParticipants.values())[0].identity
                : 'someone'}
            </p>
            <button
              onClick={endCall}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-full text-lg transition transform hover:scale-105"
            >
              End Call
            </button>
            <div className="mt-6 text-sm text-gray-500">Microphone is active • Audio only</div>
          </div>
        ) : incomingCall ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center border-2 border-yellow-500">
            <h2 className="text-2xl font-bold mb-4 text-yellow-700">Incoming Call</h2>
            <p className="text-xl mb-6 text-gray-700">{callerName} is calling you</p>
            <div className="flex justify-center gap-6">
              <button
                onClick={acceptCall}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition transform hover:scale-105"
              >
                Accept
              </button>
              <button
                onClick={declineCall}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition transform hover:scale-105"
              >
                Decline
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Start a Call</h2>
              <p className="text-gray-600 mb-4">Select a user to start an audio call</p>
              <select
                value={targetUser}
                onChange={(e) => setTargetUser(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select user...</option>
                {otherUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
              <button
                onClick={startCall}
                disabled={!targetUser}
                className={`w-full py-3 rounded-lg font-medium text-lg transition ${
                  targetUser
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Call {targetUser ? `→ ${otherUsers.find(u => u.id === targetUser)?.username || ''}` : ''}
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-700 mb-2">Your user ID:</h3>
              <div className="text-sm font-mono bg-gray-100 p-3 rounded-lg">{user.id}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}