// hooks/useVideoRequest.ts
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase';

export type VideoRequestStatus = 'none' | 'pending' | 'accepted' | 'declined';

export function useVideoRequest(
  room: any | null, 
  userId: string | null,
  participants: any[],
  localParticipant: any | null,
  addSystemMessage: (message: string) => void
) {
  const [videoRequestStatus, setVideoRequestStatus] = useState<VideoRequestStatus>('none');
  const [incomingRequests, setIncomingRequests] = useState<Record<string, boolean>>({});
  const [canEnableVideo, setCanEnableVideo] = useState(true);
  const [participantsVideoStatus, setParticipantsVideoStatus] = useState<Record<string, boolean>>({});

  // Fetch participants' video preferences when they join
  useEffect(() => {
    if (!room || !userId) return;

    const fetchVideoPreferences = async () => {
      try {
        const participantIds = participants.map(p => p.identity);
        const { data, error } = await createClient()
          .from('profiles')
          .select('id, accepts_video_calls')
          .in('id', participantIds);

        if (error) throw error;

        // Map preferences to participant IDs
        const preferencesMap: Record<string, boolean> = {};
        data.forEach(profile => {
          preferencesMap[profile.id] = profile.accepts_video_calls || false;
        });

        // Check if all participants accept video calls
        const allAcceptVideo = participantIds.every(id => preferencesMap[id] !== false);
        setCanEnableVideo(allAcceptVideo);
        
        // Initialize video status
        const initialStatus: Record<string, boolean> = {};
        participantIds.forEach(id => {
          initialStatus[id] = allAcceptVideo;
        });
        setParticipantsVideoStatus(initialStatus);

      } catch (error) {
        console.error('Error fetching video preferences:', error);
        setCanEnableVideo(false);
      }
    };

    fetchVideoPreferences();
  }, [participants, room, userId]);

  // Set up data channel listeners
  useEffect(() => {
    if (!room) return;

    const handleDataReceived = (payload: Uint8Array, participant?: any) => {
      try {
        const message = JSON.parse(new TextDecoder().decode(payload));
        
        // Handle video requests
        if (message.type === 'video_request' && participant) {
          handleIncomingRequest(message.from);
        }
        // Handle video responses
        else if (message.type === 'video_response' && participant) {
          handleResponse(message.from, message.accept);
        }
      } catch (error) {
        console.error('Error parsing data message:', error);
      }
    };

    room.on('dataReceived', handleDataReceived);
    return () => room.off('dataReceived', handleDataReceived);
  }, [room, participantsVideoStatus]);

  const handleIncomingRequest = (requesterId: string) => {
    // Don't show request if we've already declined or if we don't accept video calls
    if (incomingRequests[requesterId] || !canEnableVideo) return;
    
    setIncomingRequests(prev => ({ ...prev, [requesterId]: true }));
    addSystemMessage(`${getParticipantName(requesterId)} wants to enable video`);
  };

  const handleResponse = (responderId: string, accepted: boolean) => {
    if (videoRequestStatus !== 'pending') return;

    if (accepted) {
      setParticipantsVideoStatus(prev => ({ ...prev, [responderId]: true }));
      
      // Check if all participants accepted
      const allAccepted = Object.values(participantsVideoStatus).every(status => status);
      if (allAccepted) {
        enableLocalVideo();
        setVideoRequestStatus('accepted');
        addSystemMessage('All participants accepted video. Cameras enabled.');
      }
    } else {
      setVideoRequestStatus('declined');
      addSystemMessage(`${getParticipantName(responderId)} declined video request.`);
    }
  };

  const sendVideoRequest = async () => {
    if (!room || !userId || videoRequestStatus !== 'none' || !canEnableVideo) return;
    
    setVideoRequestStatus('pending');
    
    try {
      const message = {
        type: 'video_request',
        from: userId,
        timestamp: new Date().toISOString()
      };
      
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message)),
        { reliable: true }
      );
      
      addSystemMessage('Video request sent to participants.');
    } catch (error) {
      console.error('Error sending video request:', error);
      setVideoRequestStatus('none');
      addSystemMessage('Failed to send video request.');
    }
  };

  const sendVideoResponse = async (requesterId: string, accept: boolean) => {
    if (!room || !userId) return;
    
    setIncomingRequests(prev => {
      const newRequests = { ...prev };
      delete newRequests[requesterId];
      return newRequests;
    });

    try {
      const message = {
        type: 'video_response',
        from: userId,
        to: requesterId,
        accept,
        timestamp: new Date().toISOString()
      };
      
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message)),
        { reliable: true }
      );
      
      if (accept && localParticipant) {
        await enableLocalVideo();
      }
      
      addSystemMessage(accept 
        ? 'You accepted the video request.'
        : 'You declined the video request.'
      );
    } catch (error) {
      console.error('Error sending video response:', error);
    }
  };

  const enableLocalVideo = async () => {
    if (!localParticipant) return false;
    
    try {
      const tracks = await localParticipant.createTracks({ video: true });
      if (tracks[0]) {
        await localParticipant.publishTrack(tracks[0]);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error enabling local video:', error);
      return false;
    }
  };

  const getParticipantName = (participantId: string) => {
    const participant = participants.find(p => p.identity === participantId);
    return participant?.name || 'Someone';
  };

  return {
    canEnableVideo,
    videoRequestStatus,
    incomingRequests,
    participantsVideoStatus,
    sendVideoRequest,
    sendVideoResponse,
    enableLocalVideo
  };
}