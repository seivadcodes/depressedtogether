'use client';

import { useEffect, useRef } from 'react';
import { useCall } from '@/context/CallContext';
import type {
  Room,
  RemoteParticipant,
  RemoteTrack,
  LocalTrack,
  Track,
  TrackPublication,
  RemoteTrackPublication,
} from 'livekit-client';

// SVG icons remain the same
const MicIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

const MicOffIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-6 0v4.34" />
    <path d="M19 15v2a7 7 0 0 1-14 0v-2" />
  </svg>
);

const CameraIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const CameraOffIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <line x1="1" y1="1" x2="23" y2="23" />
    <path d="M21.5 12c.9 0 1.5-.5 1.5-1.5V7a2 2 0 0 0-2-2h-4l-2-3h-6l-2 3H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2M12 18a6 6 0 0 0 6-6" />
  </svg>
);

const PhoneOffIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M10.68 13.31a1 1 0 0 0 1.32 1.32l4-4a1 1 0 0 0 0-1.32l-4-4a1 1 0 0 0-1.32 1.32L13.66 9H7a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2.34l-2.97 2.97a1 1 0 0 0 1.32 1.32l4-4z" />
  </svg>
);

export default function CallOverlay() {
  const {
    isInCall,
    callType,
    remoteVideoTrack,
    localVideoTrack,
    isMuted,
    isCameraOff,
    setIsMuted,
    setIsCameraOff,
    setIsInCall,
    callRoom,
    setRemoteVideoTrack,
    setLocalAudioTrack,
  } = useCall();

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Attach remote audio track
  useEffect(() => {
    if (remoteVideoTrack && remoteVideoTrack.kind === 'audio' && remoteAudioRef.current) {
      remoteVideoTrack.attach(remoteAudioRef.current);
      return () => {
        remoteVideoTrack.detach();
      };
    }
  }, [remoteVideoTrack]);

  // Attach remote video
  useEffect(() => {
    if (remoteVideoTrack && remoteVideoTrack.kind === 'video' && remoteVideoRef.current) {
      remoteVideoTrack.attach(remoteVideoRef.current);
      return () => {
        remoteVideoTrack.detach();
      };
    }
  }, [remoteVideoTrack]);

  // Attach local video
  useEffect(() => {
    if (localVideoTrack && !isCameraOff && localVideoRef.current) {
      localVideoTrack.attach(localVideoRef.current);
      return () => {
        localVideoTrack.detach();
      };
    }
  }, [localVideoTrack, isCameraOff]);

  // Subscribe to remote participants and their tracks
  useEffect(() => {
    if (!isInCall || !callRoom) return;

    const room = callRoom;
    const cleanupFns: (() => void)[] = [];

    const handleParticipant = (participant: RemoteParticipant) => {
      // Handle track subscriptions
      const handleTrackSubscribed = (track: RemoteTrack) => {
        console.log('Subscribed to track:', track.kind);
        if (track.kind === 'audio') {
          setRemoteVideoTrack(track); // Reusing existing state for simplicity
        } else if (track.kind === 'video') {
          setRemoteVideoTrack(track);
        }
      };

      const handleTrackUnsubscribed = (track: RemoteTrack) => {
        if (track.kind === 'audio' || track.kind === 'video') {
          setRemoteVideoTrack(null);
        }
      };

      participant.on('trackSubscribed', handleTrackSubscribed);
      participant.on('trackUnsubscribed', handleTrackUnsubscribed);

      // Handle existing tracks
      participant.trackPublications.forEach((publication) => {
        if (publication.isSubscribed && publication.track) {
          handleTrackSubscribed(publication.track);
        }
      });

      return () => {
        participant.off('trackSubscribed', handleTrackSubscribed);
        participant.off('trackUnsubscribed', handleTrackUnsubscribed);
      };
    };

    // Process existing participants
    room.remoteParticipants.forEach((participant) => {
      cleanupFns.push(handleParticipant(participant));
    });

    // Handle new participants
    const handleParticipantConnected = (participant: RemoteParticipant) => {
      cleanupFns.push(handleParticipant(participant));
    };

    room.on('participantConnected', handleParticipantConnected);

    return () => {
      room.off('participantConnected', handleParticipantConnected);
      cleanupFns.forEach((fn) => fn?.());
    };
  }, [isInCall, callRoom, setRemoteVideoTrack]);

  const hangup = () => {
    if (callRoom) {
      // Unpublish all tracks before disconnecting
      callRoom.localParticipant.trackPublications.forEach((publication) => {
        if (publication.track) {
          callRoom.localParticipant.unpublishTrack(publication.track);
        }
      });
      
      callRoom.disconnect();
      setIsInCall(false);
      setRemoteVideoTrack(null);
      setLocalAudioTrack(null);
    }
  };

  const toggleMute = async () => {
    if (!callRoom) return;
    try {
      // Get audio track publications
      const audioTrackPublication = Array.from(callRoom.localParticipant.trackPublications.values())
        .find(pub => pub.track?.kind === 'audio');
      
      if (audioTrackPublication && audioTrackPublication.track) {
        if (isMuted) {
          // Unmuted - publish the track
          await callRoom.localParticipant.publishTrack(audioTrackPublication.track);
        } else {
          // Muted - unpublish the track
          callRoom.localParticipant.unpublishTrack(audioTrackPublication.track);
        }
      }
      setIsMuted(!isMuted);
    } catch (err) {
      console.error('Mute failed:', err);
    }
  };

  const toggleCamera = async () => {
    if (!callRoom) return;
    try {
      const videoTrackPublication = Array.from(callRoom.localParticipant.trackPublications.values())
        .find(pub => pub.track?.kind === 'video');
      
      if (videoTrackPublication && videoTrackPublication.track) {
        if (isCameraOff) {
          // Turn camera on - republish track
          await callRoom.localParticipant.publishTrack(videoTrackPublication.track);
        } else {
          // Turn camera off - unpublish track
          callRoom.localParticipant.unpublishTrack(videoTrackPublication.track);
        }
      }
      setIsCameraOff(!isCameraOff);
    } catch (err) {
      console.error('Camera toggle failed:', err);
    }
  };

  if (!isInCall) return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center p-4">
      {/* Hidden audio element for remote audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      
      {/* Remote video */}
      <div className="relative w-full max-w-3xl aspect-video bg-black rounded-xl overflow-hidden mb-6">
        {callType === 'video' && remoteVideoTrack && remoteVideoTrack.kind === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <span className="text-white/80 text-lg">
              {callType === 'audio'
                ? 'Audio call • Listening...'
                : 'Waiting for video...'}
            </span>
          </div>
        )}
      </div>

      {/* Local preview */}
      {callType === 'video' && localVideoTrack && !isCameraOff && (
        <div className="absolute top-6 right-6 w-32 h-24 rounded-lg overflow-hidden border-2 border-white">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-6">
        <button
          onClick={toggleMute}
          className={`p-3 rounded-full flex flex-col items-center ${
            isMuted ? 'bg-red-500' : 'bg-gray-700'
          }`}
        >
          {isMuted ? (
            <MicOffIcon className="text-white" />
          ) : (
            <MicIcon className="text-white" />
          )}
          <span className="text-xs text-white mt-1">
            {isMuted ? 'Muted' : 'Mic'}
          </span>
        </button>

        {callType === 'video' && (
          <button
            onClick={toggleCamera}
            className={`p-3 rounded-full flex flex-col items-center ${
              isCameraOff ? 'bg-gray-600' : 'bg-gray-700'
            }`}
          >
            {isCameraOff ? (
              <CameraOffIcon className="text-white" />
            ) : (
              <CameraIcon className="text-white" />
            )}
            <span className="text-xs text-white mt-1">
              {isCameraOff ? 'Off' : 'Cam'}
            </span>
          </button>
        )}

        <button
          onClick={hangup}
          className="p-3 rounded-full bg-red-600 flex flex-col items-center"
        >
          <PhoneOffIcon className="text-white" />
          <span className="text-xs text-white mt-1">End</span>
        </button>
      </div>
    </div>
  );
}