import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { toUserId, fromUserId, fromUserName, roomName, callType, conversationId } = await req.json();
    
    if (!toUserId || !fromUserId || !roomName || !callType) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get recipient's WebSocket connection ID from the database
    const supabase = createClient();
    const { data: recipient, error: recipientError } = await supabase
      .from('profiles')
      .select('ws_connection_id')
      .eq('id', toUserId)
      .single();

    if (recipientError || !recipient || !recipient.ws_connection_id) {
      console.log('CallCheck: Recipient not found or not connected', toUserId);
      // Don't fail the request - just log that recipient isn't available
      return NextResponse.json({ success: true, message: 'Recipient not currently connected' });
    }

    // Send notification to the WebSocket server
    const wsServerUrl = `http://178.128.210.229:8084/notify`;
    const response = await fetch(wsServerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connectionId: recipient.ws_connection_id,
        payload: {
          type: 'incoming_call',
          fromUserId,
          fromUserName,
          roomName,
          callType,
          conversationId,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('CallCheck: Failed to notify recipient via WebSocket server', errorData);
      return NextResponse.json({ success: false, error: 'Failed to notify recipient' }, { status: 500 });
    }

    console.log(`CallCheck: Successfully notified ${toUserId} about call from ${fromUserId}`);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('CallCheck notification error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}