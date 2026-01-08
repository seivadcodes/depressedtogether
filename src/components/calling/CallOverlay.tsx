'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useCall } from '@/context/CallContext';
import type { RemoteTrack } from 'livekit-client';

// --- SVG Icons ---
const MicIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
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
    width="24"
    height="24"
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

const PhoneOffIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
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

const PhoneIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 8.63 19.07 19.5 19.5 0 0 1 6 15.5a2 2 0 0 1-.45-2.11L8.09 9.91A16 16 0 0 0 14 15l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

// --- Helpers ---
const formatCallDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// --- Main Component ---
export default function CallOverlay() {
  const {
    callState,
    callType,
    callDuration,
    remoteAudioTrack,
    localAudioTrack,
    isMuted,
    setIsMuted,
    hangUp,
    incomingCall,
    acceptCall,
    rejectCall,
  } = useCall();

  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  // 🔊 Attach remote audio track
  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    if (!audioEl || !remoteAudioTrack) return;

    try {
      remoteAudioTrack.attach(audioEl);
      audioEl.play().catch(e => {
        console.warn('Audio autoplay blocked:', e);
      });

      return () => {
        remoteAudioTrack.detach(audioEl);
      };
    } catch (e) {
      console.error('Failed to attach remote audio:', e);
    }

    return () => {
      if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
      }
    };
  }, [remoteAudioTrack]);

  // 🔇 Toggle mute (real implementation would control actual track)
  const toggleMute = useCallback(() => {
    // In a full implementation, you'd do:
    // if (localAudioTrack) localAudioTrack.setEnabled(!isMuted);
    setIsMuted(!isMuted);
  }, [isMuted, setIsMuted, localAudioTrack]);

  // 🚫 Don't render if completely idle
  if (callState === 'idle' && !incomingCall) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      {/* Hidden audio element for remote stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Call Status */}
      <div className="text-center mb-8 max-w-md">
        {incomingCall && callState === 'idle' && (
          <>
            <h2 className="text-xl font-bold text-white mb-2">Incoming {callType} Call</h2>
            <p className="text-lg text-white/90">{incomingCall.callerName}</p>
            <p className="text-sm text-blue-300 mt-1">Tap to accept or decline</p>
          </>
        )}

        {callState === 'calling' && (
          <>
            <h2 className="text-xl font-bold text-white mb-2">Calling…</h2>
            <div className="flex space-x-1">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="text-lg text-white/90 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  .
                </span>
              ))}
            </div>
          </>
        )}

        {callState === 'ringing' && (
          <>
            <h2 className="text-xl font-bold text-white mb-2">Ringing…</h2>
            <div className="flex space-x-1">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="text-lg text-white/90 animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                >
                  .
                </span>
              ))}
            </div>
          </>
        )}

        {callState === 'connected' && (
          <>
            <h2 className="text-xl font-bold text-white mb-2">Connected</h2>
            <div className="bg-black/40 text-white text-3xl font-mono px-4 py-2 rounded-lg inline-block">
              {formatCallDuration(callDuration)}
            </div>
          </>
        )}

        {callState === 'ended' && (
          <>
            <h2 className="text-xl font-bold text-white mb-2">Call Ended</h2>
            <p className="text-red-400">Disconnected</p>
          </>
        )}
      </div>

      {/* Controls */}
      {incomingCall && callState === 'idle' && (
        <div className="flex gap-8 mb-6">
          <button
            onClick={rejectCall}
            className="flex flex-col items-center group"
          >
            <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center mb-2 group-hover:bg-red-700 transition-colors">
              <PhoneOffIcon className="text-white w-6 h-6" />
            </div>
            <span className="text-white font-medium">Decline</span>
          </button>

          <button
            onClick={acceptCall}
            className="flex flex-col items-center group"
          >
            <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center mb-2 group-hover:bg-green-700 transition-colors">
              <PhoneIcon className="text-white w-6 h-6" />
            </div>
            <span className="text-white font-medium">Accept</span>
          </button>
        </div>
      )}

      {(callState === 'calling' || callState === 'ringing' || callState === 'connected') && (
        <div className="flex gap-8">
          {callState === 'connected' && (
            <button
              onClick={toggleMute}
              className={`flex flex-col items-center ${
                isMuted ? 'text-red-400' : 'text-gray-300'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 ${
                  isMuted ? 'bg-red-900/50' : 'bg-gray-800/50'
                }`}
              >
                {isMuted ? (
                  <MicOffIcon className="text-white w-6 h-6" />
                ) : (
                  <MicIcon className="text-white w-6 h-6" />
                )}
              </div>
              <span className="text-white text-sm font-medium">
                {isMuted ? 'Unmute' : 'Mute'}
              </span>
            </button>
          )}

          <button
            onClick={hangUp}
            className="flex flex-col items-center group"
          >
            <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center mb-2 group-hover:bg-red-700 transition-colors">
              <PhoneOffIcon className="text-white w-6 h-6" />
            </div>
            <span className="text-white font-medium">End</span>
          </button>
        </div>
      )}
    </div>
  );
}