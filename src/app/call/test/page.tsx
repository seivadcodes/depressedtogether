// src/app/call/test/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Room,
  RemoteParticipant,
  Track,
  Participant, // Added
  LocalTrackPublication, // Added for type safety
} from 'livekit-client';

export default function TestCallPage() {
  const [roomName, setRoomName] = useState('healing-room');
  const [isConnected, setIsConnected] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to connect.');
  
  // New states
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [audioLevels, setAudioLevels] = useState<Map<string, number>>(new Map());
  const [localAudioLevel, setLocalAudioLevel] = useState(0);

  const roomRef = useRef<Room | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localScreenShareRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const log = (msg: string) => {
    console.log('[TestCallPage]', msg);
    setStatusMessage(msg);
  };

  // Setup audio visualization
  const setupAudioVisualization = async (stream: MediaStream) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateAudioLevel = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const normalized = Math.min(average / 128, 1);
        setLocalAudioLevel(normalized);
        
        if (stream.active) {
          requestAnimationFrame(updateAudioLevel);
        }
      };
      
      updateAudioLevel();
    } catch (error) {
      console.error('Audio visualization error:', error);
    }
  };

  const connect = async () => {
    if (!roomName.trim()) {
      log('Room name is empty.');
      return;
    }

    log(`Connecting to room: ${roomName}...`);

    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Token fetch failed: ${res.status} ${text}`);
      }

      const { token, url } = await res.json();

      if (!token || !url) {
        throw new Error('Missing token or LiveKit URL');
      }

      log('Received token. Connecting to LiveKit...');

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      room.on('participantConnected', (participant: RemoteParticipant) => {
        log(`Participant joined: ${participant.identity}`);
        setRemoteParticipants((prev) => [...prev, participant]);
      });

      room.on('participantDisconnected', (participant: RemoteParticipant) => {
        log(`Participant left: ${participant.identity}`);
        setRemoteParticipants((prev) =>
          prev.filter((p) => p.identity !== participant.identity)
        );
        setAudioLevels((prev) => {
          const next = new Map(prev);
          next.delete(participant.identity);
          return next;
        });
        remoteVideoRefs.current.delete(participant.identity);
      });

      room.on('trackSubscribed', (track, publication, participant) => {
        log(`Track subscribed from ${participant.identity}: ${publication.source}`);
        const videoEl = remoteVideoRefs.current.get(participant.identity) || document.createElement('video');
        remoteVideoRefs.current.set(participant.identity, videoEl);
        
        if (publication.kind === 'video') {
          track.attach(videoEl);
        }
      });

      room.on('trackUnsubscribed', (track, publication, participant) => {
        log(`Track unsubscribed from ${participant.identity}`);
        track.detach();
      });

      // Fixed: Use Participant[] instead of string[]
      room.on('activeSpeakersChanged', (speakers: Participant[]) => {
        if (speakers.length > 0) {
          setActiveSpeaker(speakers[0].identity);
        } else {
          setActiveSpeaker(null);
        }
      });

      room.on('localTrackPublished', (publication) => {
        if (publication.source === Track.Source.ScreenShare) {
          setIsScreenSharing(true);
          log('Screen sharing started');
        }
      });

      room.on('localTrackUnpublished', (publication) => {
        if (publication.source === Track.Source.ScreenShare) {
          setIsScreenSharing(false);
          log('Screen sharing stopped');
        }
      });

      room.on('disconnected', () => {
        log('Disconnected from room.');
        setIsConnected(false);
        setRemoteParticipants([]);
        setAudioLevels(new Map());
        remoteVideoRefs.current.clear();
        setIsScreenSharing(false);
      });

      await room.connect(url, token);
      log('Connected to room!');

      // Enable microphone and camera
      await room.localParticipant.setMicrophoneEnabled(isMicEnabled);
      await room.localParticipant.setCameraEnabled(isCameraEnabled);

      // Setup local video
      const localCamPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (localCamPub?.track && localVideoRef.current) {
        localCamPub.track.attach(localVideoRef.current);
        log('Local video attached.');
      }

      // Setup audio visualization for local participant
      const localMicPub = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      if (localMicPub?.track?.mediaStream) {
        await setupAudioVisualization(localMicPub.track.mediaStream);
      }

      // Monitor remote participant audio levels
      const updateRemoteAudioLevels = () => {
        const newLevels = new Map<string, number>();
        room.remoteParticipants.forEach((participant) => {
          const level = participant.audioLevel || 0;
          newLevels.set(participant.identity, level);
        });
        setAudioLevels(newLevels);
        requestAnimationFrame(updateRemoteAudioLevels);
      };
      updateRemoteAudioLevels();

      setIsConnected(true);
      
      // Generate shareable link
      const shareUrl = `${window.location.origin}/call/test?room=${roomName}`;
      log(`Room link: ${shareUrl}`);
      
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown connection error';
      console.error('[TestCallPage] Connection error:', err);
      log(`Error: ${errorMsg}`);
      alert(`Failed to connect: ${errorMsg}`);
    }
  };

  const disconnect = () => {
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
  };

  const toggleMic = async () => {
    if (!roomRef.current) return;
    
    try {
      const newState = !isMicEnabled;
      await roomRef.current.localParticipant.setMicrophoneEnabled(newState);
      setIsMicEnabled(newState);
      log(`Microphone ${newState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
    }
  };

  const toggleCamera = async () => {
    if (!roomRef.current) return;
    
    try {
      const newState = !isCameraEnabled;
      await roomRef.current.localParticipant.setCameraEnabled(newState);
      setIsCameraEnabled(newState);
      log(`Camera ${newState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to toggle camera:', error);
    }
  };

  const toggleScreenShare = async () => {
    if (!roomRef.current) return;
    
    try {
      if (isScreenSharing) {
        await roomRef.current.localParticipant.setScreenShareEnabled(false);
        setIsScreenSharing(false);
      } else {
        await roomRef.current.localParticipant.setScreenShareEnabled(true);
        setIsScreenSharing(true);
      }
    } catch (error: any) {
      console.error('Screen share error:', error);
      if (error.message?.includes('Permission denied')) {
        alert('Please allow screen sharing permissions in your browser.');
      }
    }
  };

  const copyRoomLink = () => {
    const shareUrl = `${window.location.origin}/call/test?room=${roomName}`;
    navigator.clipboard.writeText(shareUrl);
    log('Room link copied to clipboard!');
  };

  // Get participant mute status
  const getParticipantStatus = (participant: RemoteParticipant) => {
    const isAudioMuted = !participant.isMicrophoneEnabled;
    const isVideoMuted = !participant.isCameraEnabled;
    return { isAudioMuted, isVideoMuted };
  };

  // Handle audio context cleanup
  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Handle room parameter from URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam) {
        setRoomName(roomParam);
      }
    }
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', background: '#111827', color: '#f3f4f6', minHeight: '100vh' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <header style={{ marginBottom: '30px', borderBottom: '1px solid #374151', paddingBottom: '20px' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '8px', color: '#10b981' }}>🩹 Healing Shoulder — Video Call</h1>
          <p style={{ color: '#9ca3af', marginBottom: '16px' }}>
            <strong>Status:</strong> <span style={{ color: '#d1d5db' }}>{statusMessage}</span>
          </p>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            {!isConnected ? (
              <>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="Enter room name"
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: 'white',
                    flex: '1',
                    minWidth: '200px',
                    maxWidth: '300px'
                  }}
                />
                <button
                  onClick={connect}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  🎥 Join Room
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={copyRoomLink}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  📋 Copy Room Link
                </button>
                <div style={{ flex: 1 }}></div>
                <button
                  onClick={disconnect}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  🔚 Leave Room
                </button>
              </>
            )}
          </div>
        </header>

        {/* Controls Bar */}
        {isConnected && (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '30px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={toggleMic}
              style={{
                padding: '12px 24px',
                backgroundColor: isMicEnabled ? '#ef4444' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '600'
              }}
            >
              {isMicEnabled ? '🔇 Mute' : '🎤 Unmute'}
            </button>
            
            <button
              onClick={toggleCamera}
              style={{
                padding: '12px 24px',
                backgroundColor: isCameraEnabled ? '#3b82f6' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '600'
              }}
            >
              {isCameraEnabled ? '🚫 Camera Off' : '📹 Camera On'}
            </button>
            
            <button
              onClick={toggleScreenShare}
              style={{
                padding: '12px 24px',
                backgroundColor: isScreenSharing ? '#f59e0b' : '#374151',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '600'
              }}
            >
              {isScreenSharing ? '🖥️ Stop Sharing' : '🖥️ Share Screen'}
            </button>
          </div>
        )}

        {/* Video Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}>
          {/* Remote Participants */}
          {remoteParticipants.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              padding: '60px 20px',
              backgroundColor: '#1f2937',
              borderRadius: '12px',
              border: '2px dashed #374151'
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '20px' }}>👋</div>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '12px', color: '#d1d5db' }}>
                Waiting for participants...
              </h3>
              <p style={{ color: '#9ca3af', marginBottom: '20px' }}>
                Share the room link with others to start the healing session.
              </p>
              {isConnected && (
                <button
                  onClick={copyRoomLink}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  📋 Copy Invite Link
                </button>
              )}
            </div>
          ) : (
            remoteParticipants.map((participant) => {
              const { isAudioMuted, isVideoMuted } = getParticipantStatus(participant);
              const audioLevel = audioLevels.get(participant.identity) || 0;
              const isActiveSpeaker = activeSpeaker === participant.identity;
              
              return (
                <div
                  key={participant.identity}
                  style={{
                    position: 'relative',
                    backgroundColor: '#1f2937',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: isActiveSpeaker ? '3px solid #10b981' : '2px solid #374151',
                    boxShadow: isActiveSpeaker ? '0 0 20px rgba(16, 185, 129, 0.5)' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                >
                  {/* Audio Level Visualization */}
                  <div style={{
                    position: 'absolute',
                    bottom: '0',
                    left: '0',
                    right: '0',
                    height: '4px',
                    backgroundColor: 'rgba(16, 185, 129, 0.3)',
                    zIndex: '10'
                  }}>
                    <div style={{
                      width: `${audioLevel * 100}%`,
                      height: '100%',
                      backgroundColor: '#10b981',
                      transition: 'width 0.1s ease'
                    }} />
                  </div>
                  
                  <video
                    ref={(el) => {
                      if (el) {
                        const existing = remoteVideoRefs.current.get(participant.identity);
                        if (existing && !el.contains(existing)) {
                          el.appendChild(existing);
                        }
                        remoteVideoRefs.current.set(participant.identity, el);
                      }
                    }}
                    autoPlay
                    playsInline
                    style={{
                      width: '100%',
                      height: '200px',
                      objectFit: 'cover',
                      backgroundColor: '#000',
                      display: isVideoMuted ? 'none' : 'block'
                    }}
                  />
                  
                  {/* Participant Info Overlay */}
                  <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    right: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backdropFilter: 'blur(4px)'
                  }}>
                    <span style={{ fontWeight: '600', color: 'white' }}>
                      {participant.name || participant.identity}
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>
                        {isAudioMuted ? '🔇' : '🎤'}
                      </span>
                      <span style={{ fontSize: '1.2rem' }}>
                        {isVideoMuted ? '🚫' : '📹'}
                      </span>
                    </div>
                  </div>
                  
                  {/* Active Speaker Indicator */}
                  {isActiveSpeaker && (
                    <div style={{
                      position: 'absolute',
                      top: '10px',
                      right: '10px',
                      width: '12px',
                      height: '12px',
                      backgroundColor: '#10b981',
                      borderRadius: '50%',
                      animation: 'pulse 2s infinite'
                    }} />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Local Video Preview */}
        {isConnected && (
          <div style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '250px',
            zIndex: '100',
            backgroundColor: '#1f2937',
            borderRadius: '12px',
            overflow: 'hidden',
            border: '2px solid #3b82f6',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)'
          }}>
            <div style={{
              position: 'absolute',
              top: '10px',
              left: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.9rem',
              zIndex: '10'
            }}>
              You
            </div>
            
            {/* Local Audio Level Visualization */}
            <div style={{
              position: 'absolute',
              bottom: '0',
              left: '0',
              right: '0',
              height: '4px',
              backgroundColor: 'rgba(16, 185, 129, 0.3)',
              zIndex: '10'
            }}>
              <div style={{
                width: `${localAudioLevel * 100}%`,
                height: '100%',
                backgroundColor: '#10b981',
                transition: 'width 0.1s ease'
              }} />
            </div>
            
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: '100%',
                height: '150px',
                objectFit: 'cover',
                backgroundColor: '#000',
                display: isCameraEnabled ? 'block' : 'none'
              }}
            />
            
            {/* Camera/Mic Status */}
            <div style={{
              position: 'absolute',
              bottom: '10px',
              right: '10px',
              display: 'flex',
              gap: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              padding: '4px 8px',
              borderRadius: '4px'
            }}>
              <span style={{ fontSize: '1rem' }}>
                {isMicEnabled ? '🎤' : '🔇'}
              </span>
              <span style={{ fontSize: '1rem' }}>
                {isCameraEnabled ? '📹' : '🚫'}
              </span>
            </div>
            
            {/* Screen Share Preview (if active) */}
            {isScreenSharing && (
              <div style={{
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '0.9rem'
              }}>
                🖥️ Screen Sharing Active
              </div>
            )}
          </div>
        )}
      </div>

      {/* Global Styles for Pulse Animation */}
      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.7; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.7; }
        }
        
        @media (max-width: 768px) {
          .local-preview {
            width: 200px !important;
            height: 120px !important;
          }
        }
        
        @media (max-width: 480px) {
          .local-preview {
            width: 150px !important;
            height: 90px !important;
          }
        }
      `}</style>
    </div>
  );
}