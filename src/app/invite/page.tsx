// app/invite/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { Phone, User, X, MessageCircle } from 'lucide-react';

type Profile = {
  id: string;
  full_name: string;
  avatar_url?: string;
};

type TalkRequest = {
  caller_id: string;
  caller_name: string;
  room_id: string;
  timestamp: number;
};

export default function InvitePage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<TalkRequest | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // Load users + listen for incoming talk requests
  useEffect(() => {
    const init = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session?.user) {
        router.push('/auth');
        return;
      }

      // Load other users
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .neq('id', session.user.id)
        .limit(10);

      if (fetchError) {
        setError('Failed to load community members');
      } else {
        setUsers(data || []);
      }
      setIsLoading(false);

      // 🔑 Listen on YOUR private channel for talk requests
      const channel = supabase
        .channel(`user:${session.user.id}`)
        .on('broadcast', { event: 'talk_request' }, (payload: any) => {
          setIncomingRequest(payload.payload);
          // Auto-dismiss after 15 seconds
          setTimeout(() => setIncomingRequest(null), 15000);
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    init();
  }, [router, supabase]);

  const sendTalkRequest = async () => {
    if (!selectedUser) return;

    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return;

    const callerName =
      session.user.user_metadata?.full_name ||
      session.user.email?.split('@')[0] ||
      'Community Member';

    const roomId = `call-${Date.now()}`;

    // ✅ Send ONLY to the selected user's private channel
    await supabase
      .channel(`user:${selectedUser.id}`)
      .send({
        type: 'broadcast',
        event: 'talk_request',
        payload: {
          caller_id: session.user.id,
          caller_name: callerName,
          room_id: roomId,
          timestamp: Date.now(),
        },
      });

    // ✅ Immediately redirect self to calls2
    router.push(`/calls2?roomId=${encodeURIComponent(roomId)}&peer=${selectedUser.id}&initiator=true`);
  };

  const acceptRequest = () => {
    if (!incomingRequest) return;
    const { room_id, caller_id } = incomingRequest;
    setIncomingRequest(null);
    router.push(`/calls2?roomId=${encodeURIComponent(room_id)}&peer=${caller_id}&initiator=false`);
  };

  const rejectRequest = () => {
    setIncomingRequest(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-amber-50 to-stone-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="text-stone-600">Finding your community...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-stone-100 p-4 relative">
      {/* Incoming Request Popup */}
      {incomingRequest && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-11/12 max-w-md">
          <div className="bg-white rounded-xl shadow-lg border border-amber-200 overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="mt-1 text-amber-600">
                  <MessageCircle size={20} />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-stone-800">{incomingRequest.caller_name}</h3>
                  <p className="text-stone-600 text-sm mt-1">wants to talk right now.</p>
                </div>
                <button
                  onClick={rejectRequest}
                  className="text-stone-400 hover:text-stone-600"
                  aria-label="Dismiss"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={rejectRequest}
                  className="flex-1 py-2 px-3 text-sm text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-lg"
                >
                  Not now
                </button>
                <button
                  onClick={acceptRequest}
                  className="flex-1 py-2 px-3 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg flex items-center justify-center gap-1"
                >
                  <Phone size={16} />
                  Talk Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 max-w-sm p-4 bg-red-100 text-red-700 rounded-lg shadow z-50">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-stone-800">I Need to Talk</h1>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-stone-600 hover:text-stone-900"
            aria-label="Close"
          >
            <X size={24} />
          </button>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
          <div className="p-4 border-b border-stone-100 bg-stone-50">
            <p className="text-stone-700">
              Select a trusted community member. If they’re online, they’ll receive your request
              immediately.
            </p>
          </div>

          <div className="divide-y divide-stone-100">
            {users.length > 0 ? (
              users.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className={`p-4 flex items-center gap-4 cursor-pointer transition-colors ${
                    selectedUser?.id === user.id
                      ? 'bg-amber-50 ring-2 ring-amber-200'
                      : 'hover:bg-amber-50'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex-shrink-0 flex items-center justify-center border border-amber-200 overflow-hidden">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-amber-800 font-medium">
                        {user.full_name?.charAt(0).toUpperCase() || <User size={18} />}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-stone-800 truncate">{user.full_name}</h3>
                    <p className="text-stone-500 text-sm mt-1">Community member</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-stone-500">
                No other members found.
              </div>
            )}
          </div>
        </div>

        {selectedUser && (
          <div className="mt-6 bg-white rounded-xl border border-stone-200 p-5">
            <h2 className="font-medium text-stone-800 mb-2">
              Talk to {selectedUser.full_name}?
            </h2>
            <p className="text-stone-600 text-sm mb-4">
              They’ll be notified right away if they’re online.
            </p>
            <button
              onClick={sendTalkRequest}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors shadow"
            >
              <Phone size={20} />
              I Need to Talk Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}