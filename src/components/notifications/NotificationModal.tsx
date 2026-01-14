'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// Type for the enriched notification shown in UI
export interface Notification {
  id: string;
  user_id: string;
  sender_id: string | null;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
  type: string;
  sender_name: string;
}

// Raw type matching Supabase query shape
interface RawNotification {
  id: string;
  user_id: string;
  sender_id: string | null;
  message: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
  type: string;
  sender: {
    full_name: string | null;
  } | {
    full_name: string | null;
  }[] | null;
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

const formatTimeAgo = (dateString: string): string => {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins === 1) return '1 minute ago';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours === 1) return '1 hour ago';
  if (diffHours < 24) return `${diffHours} hours ago`;
  return past.toLocaleDateString();
};

const renderNotificationMessage = (n: Notification): React.ReactNode => {
  switch (n.type) {
    case 'one_on_one_request':
    case 'group_request':
      return (
        <>
          <strong>{n.sender_name}</strong> needs your support
          {n.message && (
            <>
              : “<span style={{ color: n.read ? '#64748b' : '#1e293b' }}>{n.message}</span>”
            </>
          )}
        </>
      );

    case 'community_post':
  // message already contains the complete sentence (e.g., "Dansx shared a new post in Pet loss")
  return n.message || 'A new post was shared in the community';
    case 'comment':
      return (
        <>
          <strong>{n.sender_name}</strong> commented on your post
          {n.message && (
            <>
              : “<span style={{ color: n.read ? '#64748b' : '#1e293b' }}>{n.message}</span>”
            </>
          )}
        </>
      );

    case 'like':
      return (
        <>
          <strong>{n.sender_name}</strong> liked your post
        </>
      );

    default:
      return n.message || 'You have a new notification';
  }
};

export default function NotificationModal({ isOpen, onClose }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !data?.session) {
          console.error('❌ Session error in NotificationModal:', sessionError);
          onClose();
          return;
        }

        const userId = data.session.user.id;
        console.log('🔍 Fetching notifications for user:', userId);

        const { data: notificationsData, error } = await supabase
          .from('notifications')
          .select(`
            id,
            user_id,
            sender_id,
            message,
            link,
            read,
            created_at,
            type,
            sender:profiles!notifications_sender_id_fkey(full_name)
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Supabase error:', error);
          throw error;
        }

        // Safely cast to known shape
        const typedData = (notificationsData || []) as unknown as RawNotification[];

        const enriched: Notification[] = typedData.map((item) => {
          let senderName = 'Someone';

          if (item.sender) {
            let profile: { full_name: string | null } | undefined;

            if (Array.isArray(item.sender)) {
              profile = item.sender[0];
            } else {
              profile = item.sender;
            }

            if (profile?.full_name) {
              // Extract first name only
              senderName = profile.full_name.split(' ')[0].trim() || 'Someone';
            }
          }

          return {
            id: item.id,
            user_id: item.user_id,
            sender_id: item.sender_id,
            message: item.message || '',
            link: item.link,
            read: item.read,
            created_at: item.created_at,
            type: item.type,
            sender_name: senderName,
          };
        });

        setNotifications(enriched);
      } catch (err) {
        console.error('🔥 Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [isOpen, onClose, supabase]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    window.dispatchEvent(new CustomEvent('unreadUpdateRequest'));
  };

  const handleNotificationClick = (n: Notification) => {
    markAsRead(n.id);
    if (n.link) {
      router.push(n.link);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px',
        zIndex: 2000,
        padding: '20px',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '400px',
          maxHeight: '70vh',
          overflow: 'hidden',
          boxShadow:
            '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
            Notifications
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#64748b',
            }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div style={{ padding: '12px 0', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
              No new notifications
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid #f1f5f9',
                    cursor: 'pointer',
                    backgroundColor: n.read ? '#fafafa' : '#f0f9ff',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: n.read ? 'normal' : '500' }}>
                    {renderNotificationMessage(n)}
                  </p>
                  <small style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {formatTimeAgo(n.created_at)}
                  </small>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}