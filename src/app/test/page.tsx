'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCall } from '@/context/CallContext'; // 👈 Add this

type Profile = {
  id: string;
  full_name: string | null;
  avatar_url?: string | null;
};

export default function TestCallPage() {
  const { user: currentUser } = useAuth();
  const supabase = createClient();
  const { incomingCall, setIncomingCall } = useCall(); // 👈 Get call state

  const [users, setUsers] = useState<Profile[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  useEffect(() => {
    const fetchUsersAndProfile = async () => {
      if (!currentUser?.id) return;

      const { data: otherUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .neq('id', currentUser.id);

      if (usersError) {
        console.error('Failed to load users:', usersError);
        toast.error('Failed to load users');
      } else {
        setUsers(otherUsers || []);
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .eq('id', currentUser.id)
        .single();

      if (profileError) {
        console.error('Failed to load current user profile:', profileError);
        toast.error('Failed to load your profile');
      } else {
        setCurrentUserProfile(profile);
      }
    };

    fetchUsersAndProfile();
  }, [currentUser?.id, supabase]);

  const handleCall = async () => {
    if (!selectedUserId || !currentUser?.id || !currentUserProfile) return;

    const fromUserName = currentUserProfile.full_name || currentUser.email?.split('@')[0] || 'User';
    const callee = users.find(u => u.id === selectedUserId);
    const calleeName = callee?.full_name || 'Recipient';

    const roomName = `call-test-${Date.now()}`;
    const callType: 'audio' | 'video' = 'video';

    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toUserId: selectedUserId,
          fromUserId: currentUser.id,
          fromUserName,
          roomName,
          callType,
          conversationId: `test-conv-${currentUser.id}-${selectedUserId}`,
        }),
      });

      if (res.ok) {
        toast.success(`CallCheck sent to ${calleeName}!`);
      } else {
        const errorData = await res.json();
        console.error('CallCheck failed:', errorData);
        toast.error('Failed to send call');
      }
    } catch (err) {
      console.error('CallCheck error:', err);
      toast.error('Network error: failed to send call');
    }
  };

  // ✅ Handle incoming call acceptance
  const handleAccept = () => {
    if (!incomingCall) return;
    alert(`✅ Accepted call from ${incomingCall.fromUserName}! Room: ${incomingCall.roomName}`);
    setIncomingCall(null); // dismiss
  };

  const handleDecline = () => {
    setIncomingCall(null);
    toast('CallCheck declined', { icon: '📞' });
  };

  if (!currentUser) {
    return <div className="p-8">Loading...</div>;
  }

  if (!currentUserProfile) {
    return <div className="p-8">Loading your profile...</div>;
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-6 relative">
      <h1 className="text-2xl font-bold text-stone-800">CallCheck Test</h1>
      <p className="text-stone-600">
        Select a user to call. They will receive a real-time notification **on this page**.
      </p>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-stone-700">Select User to Call</label>
        <select
          value={selectedUserId}
          onChange={(e) => setSelectedUserId(e.target.value)}
          className="w-full p-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
        >
          <option value="">— Choose a user —</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.full_name || 'Unnamed User'}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleCall}
        disabled={!selectedUserId}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-stone-300 disabled:cursor-not-allowed transition"
      >
        CallCheck Them!
      </button>

      {/* ✅ Incoming Call Popup — rendered directly on this page */}
      {incomingCall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
            <h3 className="font-bold text-lg">Incoming {incomingCall.callType} Call</h3>
            <p className="text-gray-600 mt-2">From: {incomingCall.fromUserName}</p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleAccept}
                className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700"
              >
                Accept
              </button>
              <button
                onClick={handleDecline}
                className="flex-1 bg-gray-300 text-gray-800 py-2 rounded-lg hover:bg-gray-400"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}