'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import type { Room, RemoteTrack, LocalTrack } from 'livekit-client';

type IncomingCall = {
  roomName: string;
  callerId: string;
  callerName: string;
  callType: 'audio' | 'video';
  conversationId: string;
};

type CallContextType = {
  // Call state
  isInCall: boolean;
  setIsInCall: (inCall: boolean) => void;
  callType: 'audio' | 'video';
  setCallType: (type: 'audio' | 'video') => void;
  
  // Incoming call
  incomingCall: IncomingCall | null;
  setIncomingCall: (call: IncomingCall | null) => void;

  // Room & tracks
  callRoom: Room | null;
  setCallRoom: (room: Room | null) => void;
  remoteVideoTrack: RemoteTrack | null;
  setRemoteVideoTrack: (track: RemoteTrack | null) => void;
  localVideoTrack: LocalTrack | null;
  setLocalVideoTrack: (track: LocalTrack | null) => void;
  localAudioTrack: LocalTrack | null;
  setLocalAudioTrack: (track: LocalTrack | null) => void;

  // Controls
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  isCameraOff: boolean;
  setIsCameraOff: (off: boolean) => void;
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export function CallProvider({ children }: { children: ReactNode }) {
  const [isInCall, setIsInCall] = useState(false);
  const [callType, setCallType] = useState<'audio' | 'video'>('audio');
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callRoom, setCallRoom] = useState<Room | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<RemoteTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalTrack | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<LocalTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (callRoom) {
        callRoom.disconnect();
      }
    };
  }, [callRoom]);

  return (
    <CallContext.Provider
      value={{
        isInCall,
        setIsInCall,
        callType,
        setCallType,
        incomingCall,
        setIncomingCall,
        callRoom,
        setCallRoom,
        remoteVideoTrack,
        setRemoteVideoTrack,
        localVideoTrack,
        setLocalVideoTrack,
        localAudioTrack,
        setLocalAudioTrack,
        isMuted,
        setIsMuted,
        isCameraOff,
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