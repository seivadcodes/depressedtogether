'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// Define the expected shape of a notification record from Supabase
interface Notification {
  id: string;
  user_id: string;
  message: string;
  link?: string | null;
  read: boolean;
  created_at: string; // ISO string from Supabase
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
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
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData?.session) {
          console.error('Session error:', sessionError);
          onClose();
          return;
        }

        const userId = sessionData.session.user.id;

        const { data, error } = await supabase
          .from('notifications')
          .select('id, user_id, message, link, read, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setNotifications(data || []);
      } catch (err) {
        console.error('Failed to load notifications:', err);
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
        {/* Header */}
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

        {/* Body */}
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
                  <p
                    style={{
                      margin: 0,
                      fontSize: '15px',
                      color: n.read ? '#64748b' : '#1e293b',
                      fontWeight: n.read ? 'normal' : '500',
                    }}
                  >
                    {n.message}
                  </p>
                  <small style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {new Date(n.created_at).toLocaleString()}
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