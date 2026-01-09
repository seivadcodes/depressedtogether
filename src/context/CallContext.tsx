'use client';
import { createContext, useContext, useState, ReactNode, useEffect, } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Room, LocalAudioTrack, RemoteAudioTrack } from 'livekit-client';
import toast from 'react-hot-toast';

type CallState = 'idle' | 'calling' | 'ringing' | 'connecting' | 'connected' | 'ended';
type CallType = 'audio' | 'video';

type IncomingCall = {
  callerId: string;
  callerName: string;
  callType: CallType;
  roomName: string;
};

type CallContextType = {
  callState: CallState;
  callType: CallType;
  calleeName: string | null;
  incomingCall: IncomingCall | null;
  callRoom: Room | null;
  remoteAudioTrack: RemoteAudioTrack | null;
  localAudioTrack: LocalAudioTrack | null;
  isMuted: boolean;
  isCameraOff: boolean;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  hangUp: () => void;
  startCall: (calleeId: string, calleeName: string, type: CallType, roomName: string) => Promise<void>;
  setIsMuted: (muted: boolean) => void;
  setIsCameraOff: (off: boolean) => void;
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const [callState, setCallState] = useState<CallState>('idle');
  const [callType, setCallType] = useState<CallType>('audio');
  const [calleeName, setCalleeName] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callRoom, setCallRoom] = useState<Room | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<RemoteAudioTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalAudioTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(true);
  const supabase = createClient();

  // Listen for incoming calls
  useEffect(() => {
    const channel = supabase
      .channel('call_notifications')
      .on('broadcast', { event: 'incoming_call' }, (payload) => {
        const { callerId, callerName, callType, roomName } = payload.payload;
        if (callState === 'idle') {
          setIncomingCall({ callerId, callerName, callType, roomName });
          setCallState('ringing');
        }
      })
      .on('broadcast', { event: 'call_rejected' }, () => {
        if (callState === 'calling') {
          toast.error('Call rejected');
          hangUp();
        }
      })
      .on('broadcast', { event: 'call_accepted' }, async (payload) => {
        if (callState === 'calling') {
          try {
            setCallState('connecting');
            await connectToRoom(payload.payload.roomName);
          } catch (error) {
            console.error('Failed to connect to room:', error);
            toast.error('Failed to connect to call');
            hangUp();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [callState, supabase]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callRoom) {
        callRoom.disconnect();
      }
    };
  }, [callRoom]);

  // Handle mute state changes
  useEffect(() => {
  if (callRoom && callState === 'connected') {
    callRoom.localParticipant.setMicrophoneEnabled(!isMuted);
  }
}, [isMuted, callRoom, callState]);
  const connectToRoom = async (roomName: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('User not authenticated');
      
      const userName = session.user.user_metadata?.full_name || 
                      session.user.email?.split('@')[0] || 
                      'Anonymous';
      
      // Get token from API
      const tokenRes = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room: roomName,
          identity: session.user.id,
          name: userName,
        }),
      });
      
      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to get token');
      }
      
      const { token } = await tokenRes.json();
      
      // Connect to room
      const room = new Room();
      setCallRoom(room);
      
      // Handle track subscriptions
      room.on('trackSubscribed', (track) => {
        if (track.kind === 'audio' && track instanceof RemoteAudioTrack) {
          setRemoteAudioTrack(track);
        }
      });
      
      await room.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL!, token);
      
      // Publish local audio track
      const audioTrack = (await room.localParticipant.createTracks({ audio: true }))[0] as LocalAudioTrack;
      await room.localParticipant.publishTrack(audioTrack);
      setLocalAudioTrack(audioTrack);
      
      return room;
    } catch (error) {
      console.error('Failed to connect to room:', error);
      throw error;
    }
  };

  const startCall = async (calleeId: string, calleeName: string, type: CallType, roomName: string) => {
    try {
      setCallType(type);
      setCalleeName(calleeName);
      setCallState('calling');
      
      // Notify the callee about the incoming call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('User not authenticated');
      
      const callerName = session.user.user_metadata?.full_name || 
                        session.user.email?.split('@')[0] || 
                        'Anonymous';
      
      // Send notification to callee
      await supabase.channel('call_notifications').send({
        type: 'broadcast',
        event: 'incoming_call',
        payload: {
          callerId: session.user.id,
          callerName,
          callType: type,
          roomName,
        },
      }, [calleeId]);
      
    } catch (error) {
      console.error('Failed to start call:', error);
      toast.error('Failed to start call');
      hangUp();
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    
    try {
      setCallType(incomingCall.callType);
      
      // Notify caller that call was accepted
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('User not authenticated');
      
      await supabase.channel('call_notifications').send({
        type: 'broadcast',
        event: 'call_accepted',
        payload: {
          roomName: incomingCall.roomName,
        },
      }, [incomingCall.callerId]);
      
      // Connect to room
      await connectToRoom(incomingCall.roomName);
      setCallState('connected');
      setIncomingCall(null);
    } catch (error) {
      console.error('Failed to accept call:', error);
      toast.error('Failed to accept call');
      hangUp();
    }
  };

  const rejectCall = () => {
    if (!incomingCall) return;
    
    // Notify caller that call was rejected
    supabase.channel('call_notifications').send({
      type: 'broadcast',
      event: 'call_rejected',
      payload: {},
    }, [incomingCall.callerId]);
    
    setIncomingCall(null);
    setCallState('idle');
  };

const hangUp = (_reason?: string) => {
   if (callRoom) {
  // ✅ Correct way to unpublish tracks
  callRoom.localParticipant.trackPublications.forEach((publication) => {
    if (publication.track) {
      callRoom.localParticipant.unpublishTrack(publication.track);
      publication.track.stop(); // Optional: stop media stream
    }
  });
  callRoom.disconnect();
  setCallRoom(null);
}
    setRemoteAudioTrack(null);
    setLocalAudioTrack(null);
    setCallState('ended');
    
    // After a brief delay, return to idle state
    setTimeout(() => {
      setCallState('idle');
      setCalleeName(null);
    }, 1000);
  };

  return (
    <CallContext.Provider
      value={{
        callState,
        callType,
        calleeName,
        incomingCall,
        callRoom,
        remoteAudioTrack,
        localAudioTrack,
        isMuted,
        isCameraOff,
        acceptCall,
        rejectCall,
        hangUp,
        startCall,
        setIsMuted,
        setIsCameraOff,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within CallProvider');
  }
  return context;
};