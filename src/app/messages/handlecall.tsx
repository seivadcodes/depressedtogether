// HandleCall.tsx
import { useEffect, useRef } from 'react';

const HandleCall = ({ 
  offer, 
  senderId, 
  onAnswer, 
  onIceCandidate 
}: { 
  offer: RTCSessionDescriptionInit; 
  senderId: string; 
  onAnswer: (answer: RTCSessionDescriptionInit) => void;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
}) => {
  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peerConnection.current = pc;

    pc.ontrack = (event) => {
      // Attach remote stream to video element
      const remoteVideo = document.getElementById('remoteVideo') as HTMLVideoElement;
      if (remoteVideo) remoteVideo.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        onIceCandidate(event.candidate);
      }
    };

    // Set remote offer
    pc.setRemoteDescription(new RTCSessionDescription(offer))
      .then(() => pc.createAnswer())
      .then((answer) => {
        return pc.setLocalDescription(answer);
      })
      .then(() => {
        if (pc.localDescription) {
          onAnswer(pc.localDescription);
        }
      })
      .catch(console.error);

    return () => {
      pc.close();
    };
  }, []);

  return (
    <div>
      <p>Incoming call from {senderId}...</p>
      <video id="remoteVideo" autoPlay playsInline />
    </div>
  );
};