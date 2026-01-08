// src/components/SignalingProvider.tsx
'use client';

import { useEffect, useRef } from 'react';
import { useCall } from '@/context/CallContext';

let globalWebSocket: WebSocket | null = null;

export function SignalingProvider({ currentUserId }: { currentUserId: string | null }) {
  const hasConnected = useRef(false);
  const { setIncomingCall } = useCall();

  useEffect(() => {
    if (!currentUserId) {
      if (globalWebSocket) {
        globalWebSocket.close();
        globalWebSocket = null;
        hasConnected.current = false;
      }
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(currentUserId)) {
      console.warn('⚠️ [Signaling] Invalid userId format:', currentUserId);
      return;
    }

    if (hasConnected.current || (globalWebSocket && globalWebSocket.readyState === WebSocket.OPEN)) {
      return;
    }

    const ws = new WebSocket(`ws://178.128.210.229:8084?userId=${currentUserId}`);
    globalWebSocket = ws;
    hasConnected.current = true;

    ws.onopen = () => {
      console.log('✅ [Signaling] WebSocket OPEN for user:', currentUserId);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'incoming_call') {
          console.log('📞 [Signaling] Incoming call:', data);
          setIncomingCall({
            roomName: data.roomName,
            callerId: data.fromUserId,
            callerName: data.fromUserName, // ✅ matches IncomingCall type
            callType: data.callType,
            conversationId: data.conversationId || '',
          });
        }
      } catch (e) {
        console.error('[Signaling] Invalid message:', e);
      }
    };

    ws.onclose = () => {
      globalWebSocket = null;
      hasConnected.current = false;
    };

    return () => {
      if (ws === globalWebSocket) {
        ws.close();
        globalWebSocket = null;
        hasConnected.current = false;
      }
    };
  }, [currentUserId, setIncomingCall]);

  return null;
}