// src/app/call/[id]/page.tsx
'use client';

import { useParams } from 'next/navigation';
import CallPageUI from './CallPageUI';
import { useCallPageLogic } from './useCallPageLogic';
import { useRef } from 'react';

export default function CallPage() {
  const params = useParams();
  const sessionId = params.id as string;
  
  const {
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
    leaveRoom,
    toggleAudioMute,
    toggleVideoMute,
    sendChatMessage,
    setNewMessage,
    handleChatKeyPress,
    loading
  } = useCallPageLogic(sessionId);

  // Create non-null refs for the UI
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-stone-600">Loading your call space...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <CallPageUI
      connecting={connecting}
      isConnected={isConnected}
      isAudioMuted={isAudioMuted}
      isVideoMuted={isVideoMuted}
      participants={participants}
      sessionInfo={sessionInfo}
      sessionParticipants={sessionParticipants}
      chatMessages={chatMessages}
      newMessage={newMessage}
      connectionError={connectionError}
      user={user}
      localVideoRef={localVideoRef}
      chatContainerRef={chatContainerRef}
      leaveRoom={leaveRoom}
      toggleAudioMute={toggleAudioMute}
      toggleVideoMute={toggleVideoMute}
      sendChatMessage={sendChatMessage}
      setNewMessage={setNewMessage}
      handleChatKeyPress={handleChatKeyPress}
    />
  );
}




