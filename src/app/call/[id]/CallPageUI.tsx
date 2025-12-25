// src/app/call/[id]/CallPageUI.tsx
'use client';

import { Card } from '@/components/ui/card';
import Button from '@/components/ui/button';
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
  Send,
  AlertCircle
} from 'lucide-react';
import React, { useRef, RefObject, useMemo } from 'react';

interface CallPageUIProps {
  // State
  connecting: boolean;
  isConnected: boolean;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  participants: any[];
  sessionInfo: any | null;
  sessionParticipants: any[];
  chatMessages: any[];
  newMessage: string;
  connectionError: string | null;
  user: any | null;
  
  // Refs
  localVideoRef: RefObject<HTMLVideoElement | null>;
  chatContainerRef: RefObject<HTMLDivElement | null>;
  
  // Callbacks
  leaveRoom: () => void;
  toggleAudioMute: () => void;
  toggleVideoMute: () => void;
  sendChatMessage: () => void;
  setNewMessage: (message: string) => void;
  handleChatKeyPress: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function CallPageUI({
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
  localVideoRef,
  chatContainerRef,
  leaveRoom,
  toggleAudioMute,
  toggleVideoMute,
  sendChatMessage,
  setNewMessage,
  handleChatKeyPress
}: CallPageUIProps) {
  // Determine session mode capabilities
  const isAudioOnly = sessionInfo?.mode === 'audio';
  const isVideoEnabled = sessionInfo?.mode === 'video' && !isVideoMuted;
  
  // Grief type labels for display
  const griefTypeLabels: Record<string, string> = {
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

  // Get participant name with fallback
  const getParticipantName = (participant: any) => {
    if (!participant) return 'Anonymous';
    const participantData = sessionParticipants.find(p => p.user_id === participant.identity);
    const profile = participantData?.profiles?.[0];
    return profile?.full_name || participant.name || 'Anonymous';
  };

  // Get participant initials for avatar
  const getParticipantInitials = (name: string) => {
    if (!name) return '?';
    return name.split(' ')
      .map(word => word[0])
      .filter(char => /[A-Z]/i.test(char))
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

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
            <p className="text-sm text-stone-500 mb-2">
              {isAudioOnly 
                ? 'Please allow microphone permissions when prompted' 
                : 'Please allow camera and microphone permissions when prompted'}
            </p>
            <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 text-sm px-3 py-1 rounded-full">
              <Mic className="h-3 w-3" />
              <span>Microphone</span>
              {!isAudioOnly && (
                <>
                  <span className="mx-1">•</span>
                  <Video className="h-3 w-3" />
                  <span>Camera</span>
                </>
              )}
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
                    {profile?.full_name || 'Anonymous'} {participant.user_id === user?.id && '(you)'}
                  </span>
                  <div className="ml-auto">
                    {participant.user_id === user?.id ? (
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
            <div className="mt-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{connectionError}</span>
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
              onClick={() => window.history.back()}
              className="p-2 text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-stone-800">{sessionInfo?.title}</h1>
              {sessionInfo?.grief_types?.[0] && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Heart className="h-3 w-3 text-amber-500" />
                  <span className="text-sm text-stone-600">
                    {griefTypeLabels[sessionInfo.grief_types[0]]}
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
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <span>
              {connectionError}. Please try refreshing the page or contact support if the issue persists.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video/Audio Area */}
          <div className="lg:col-span-2 space-y-4">
            {/* Local Participant Area */}
            <Card className="overflow-hidden bg-stone-900 rounded-xl shadow-md">
              <div className="relative aspect-video bg-stone-800">
                {isAudioOnly ? (
                  // Audio-only mode representation
                  <div className="w-full h-full flex flex-col items-center justify-center p-4">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center mb-4">
                      <span className="text-2xl font-bold text-white">
                        {user?.full_name ? getParticipantInitials(user.full_name) : 'Y'}
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-medium text-lg">You</p>
                      <div className="mt-2 flex items-center justify-center gap-2">
                        <Mic className={`h-5 w-5 ${isAudioMuted ? 'text-red-400' : 'text-amber-400'}`} />
                        <span className={`text-sm ${isAudioMuted ? 'text-red-300' : 'text-amber-300'}`}>
                          {isAudioMuted ? 'Microphone muted' : 'Microphone active'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Video mode
                  <>
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
                          onClick={isAudioOnly ? undefined : toggleVideoMute}
                          disabled={isAudioOnly}
                          className={`p-2 rounded-full transition-opacity ${
                            isAudioOnly
                              ? 'opacity-50 cursor-not-allowed'
                              : isVideoMuted 
                                ? 'bg-red-500/20 text-red-400' 
                                : 'bg-black/30 text-white hover:bg-black/40'
                          }`}
                          title={isAudioOnly ? "Video is disabled for this call" : (isVideoMuted ? 'Enable camera' : 'Disable camera')}
                        >
                          {isAudioOnly || isVideoMuted ? (
                            <VideoOff className="h-5 w-5" />
                          ) : (
                            <Video className="h-5 w-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Remote Participants Area */}
            {participants.length > 0 ? (
              <div className={`grid ${isAudioOnly ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4`}>
                {participants.map((participant) => {
                  if (participant.identity === user?.id) return null;
                  
                  const participantName = getParticipantName(participant);
                  const initials = getParticipantInitials(participantName);
                  
                  return (
                    <Card key={participant.identity} className="overflow-hidden bg-stone-900 rounded-xl shadow-md">
                      <div className="relative aspect-video bg-stone-800">
                        {isAudioOnly ? (
                          // Audio-only participant representation
                          <div className="w-full h-full flex flex-col items-center justify-center p-4">
                            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center mb-3">
                              <span className="text-xl font-bold text-white">{initials}</span>
                            </div>
                            <p className="text-white font-medium text-lg">{participantName}</p>
                            <div className="mt-2 flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded-full">
                              <Mic className="h-4 w-4 text-amber-300" />
                              <span className="text-sm text-amber-200">Listening</span>
                            </div>
                          </div>
                        ) : (
                          // Video participant
                          <>
                            <div 
                              id={`remote-video-${participant.identity}`}
                              className="w-full h-full"
                            />
                            <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                              <span className="text-white text-sm font-medium">
                                {participantName}
                              </span>
                            </div>
                          </>
                        )}
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