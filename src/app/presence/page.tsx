// src/app/presence/page.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase';
import Image from 'next/image';

interface OnlineUser {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  last_seen: string;
  is_online: boolean;
}

// Smart polling configuration
const POLLING_CONFIG = {
  FAST_INTERVAL: 5000, // 5 seconds when active
  SLOW_INTERVAL: 30000, // 30 seconds when idle
  IDLE_TIMEOUT: 60000, // 1 minute to consider user idle
  OFFLINE_THRESHOLD: 60000, // 1 minute to consider offline
} as const;

export default function PresencePage() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPageActive, setIsPageActive] = useState(true);
  const [pollingSpeed, setPollingSpeed] = useState<'fast' | 'slow'>('fast');

  // Refs for tracking state without re-renders
  const lastUpdateRef = useRef<number>(Date.now());
  const lastActivityRef = useRef<number>(Date.now());
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const supabase = createClient();

  // Track user activity to adjust polling speed
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (pollingSpeed === 'slow') {
      setPollingSpeed('fast');
      console.log('Increased polling speed due to activity');
    }
  }, [pollingSpeed]);

  const fetchOnlineUsers = useCallback(async (forceUpdate: boolean = false) => {
    if (!isPageActive || !isMountedRef.current) return;

    const timeSinceLastUpdate = Date.now() - lastUpdateRef.current;
    if (!forceUpdate && timeSinceLastUpdate < (pollingSpeed === 'fast' ? 3000 : 15000)) {
      return;
    }

    setError(null);

    try {
      const cutoff = new Date(Date.now() - POLLING_CONFIG.OFFLINE_THRESHOLD).toISOString();

      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, last_seen')
        .gte('last_seen', cutoff)
        .order('last_seen', { ascending: false });

      if (fetchError) throw fetchError;

      const enriched = data.map((user) => ({
        ...user,
        is_online: new Date(user.last_seen) > new Date(Date.now() - POLLING_CONFIG.OFFLINE_THRESHOLD),
      }));

      setOnlineUsers(prev => {
        const prevIds = new Set(prev.map(u => u.id));
        const newIds = new Set(enriched.map(u => u.id));
        
        if (prev.length !== enriched.length || 
            ![...prevIds].every(id => newIds.has(id)) ||
            prev.some((user, index) => 
              user.is_online !== enriched[index]?.is_online ||
              user.last_seen !== enriched[index]?.last_seen
            )) {
          return enriched;
        }
        return prev;
      });

      lastUpdateRef.current = Date.now();
      setLastUpdated(new Date());
      retryCountRef.current = 0;

      if (pollingSpeed === 'fast') {
        setTimeout(() => {
          if (Date.now() - lastActivityRef.current > POLLING_CONFIG.IDLE_TIMEOUT) {
            setPollingSpeed('slow');
            console.log('Switching to slow polling due to inactivity');
          }
        }, POLLING_CONFIG.IDLE_TIMEOUT);
      }

    } catch (err) {
      console.error('Failed to fetch online users:', err);
      
      retryCountRef.current++;
      const backoffDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
      
      setTimeout(() => {
        if (isMountedRef.current) {
          fetchOnlineUsers(true);
        }
      }, backoffDelay);
      
      setError('Unable to load online users. Retrying...');
    } finally {
      if (loading) setLoading(false);
    }
  }, [supabase, pollingSpeed, isPageActive, loading]);

  // Set up smart polling with adaptive intervals
  useEffect(() => {
    const setupPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }

      const interval = pollingSpeed === 'fast' 
        ? POLLING_CONFIG.FAST_INTERVAL 
        : POLLING_CONFIG.SLOW_INTERVAL;

      pollingIntervalRef.current = setInterval(() => {
        fetchOnlineUsers();
      }, interval);

      console.log(`Polling set to ${pollingSpeed} mode (${interval}ms)`);
    };

    if (isPageActive) {
      fetchOnlineUsers(true);
      setupPolling();
    }

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [pollingSpeed, isPageActive, fetchOnlineUsers]);

  // Track page visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      setIsPageActive(isVisible);
      
      if (isVisible) {
        updateActivity();
        fetchOnlineUsers(true);
      } else {
        console.log('Page inactive, polling paused');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchOnlineUsers, updateActivity]);

  // Track user activity
  useEffect(() => {
    const handleUserActivity = () => updateActivity();

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
    };
  }, [updateActivity]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const formatLastSeen = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleManualRefresh = useCallback(() => {
    updateActivity();
    fetchOnlineUsers(true);
  }, [fetchOnlineUsers, updateActivity]);

  if (loading && onlineUsers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-2">Checking who is online...</p>
          <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6"
      onClick={updateActivity}
    >
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Active Users</h1>
            {lastUpdated && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-gray-500">
                  Last updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                <button
                  onClick={handleManualRefresh}
                  className="text-sm text-blue-500 hover:text-blue-700 hover:underline"
                  aria-label="Refresh"
                >
                  Refresh
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${pollingSpeed === 'fast' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
            <span className="text-xs text-gray-500">
              {pollingSpeed === 'fast' ? 'Live' : 'Idle'}
            </span>
          </div>
        </div>

        {error ? (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
            {error}
            <button 
              onClick={handleManualRefresh}
              className="ml-2 text-red-700 underline"
            >
              Retry now
            </button>
          </div>
        ) : onlineUsers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-600">No users are currently active.</p>
          </div>
        ) : (
          <>
            <ul className="space-y-4">
              {onlineUsers.map((user) => (
                <li
                  key={user.id}
                  className="bg-white rounded-lg shadow p-4 flex items-center gap-4 hover:shadow-md transition-shadow duration-200"
                >
                  <div className="relative">
                    {user.avatar_url ? (
                      <div className="w-12 h-12 rounded-full border-2 border-green-400 overflow-hidden">
                        <Image
                          src={user.avatar_url}
                          alt={user.full_name || 'User'}
                          width={48}
                          height={48}
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center border-2 border-green-400">
                        <span className="text-gray-600 font-medium">
                          {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                    )}
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900 truncate">
                      {user.full_name || 'Anonymous'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {user.is_online ? (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Active now
                        </span>
                      ) : (
                        `Active at ${formatLastSeen(user.last_seen)}`
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-center text-sm text-gray-500">
              <p>{onlineUsers.length} active users{onlineUsers.length !== 1 ? 's' : ''}</p>
            </div>
          </>
        )}

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Users are marked online if active in the last 60 seconds.
            <br />
            Page auto-refreshes every {pollingSpeed === 'fast' ? '5' : '30'} seconds.
            <br />
            <span className="text-xs">(Click anywhere to refresh now)</span>
          </p>
        </div>
      </div>
    </div>
  );
}