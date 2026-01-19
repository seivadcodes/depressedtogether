// src/app/client-layout.tsx
'use client';

import { ReactNode, useEffect, useRef } from 'react';
import Header from '@/components/layout/header';
import FooterNav from '@/components/layout/FooterNav';
import { Toaster } from 'react-hot-toast';
import { CallProvider } from '@/context/CallContext';
import CallOverlay from '@/components/calling/CallOverlay';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase-client'; // 👈 Add this

export default function ClientLayout({
  children,
  user,
}: {
  children: ReactNode;
  user: User | null;
}) {
  const hasUpdatedCountry = useRef(false);
  const supabase = createClient(); // 👈 Initialize client

  // 🔁 Auto-update country (existing logic)
  useEffect(() => {
    if (
      user?.id &&
      typeof user.id === 'string' &&
      user.id.trim() !== '' &&
      !hasUpdatedCountry.current
    ) {
      hasUpdatedCountry.current = true;
      fetch('/api/update-user-country', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
        credentials: 'include',
      }).catch(err => {
        console.warn('Failed to auto-update country:', err);
      });
    }
  }, [user?.id]);

  // 🌐 Global presence updater — NEW!
  useEffect(() => {
    if (!user?.id) return;

    const updateLastOnline = async () => {
      try {
        await supabase
          .from('profiles')
          .update({ last_online: new Date().toISOString() })
          .eq('id', user.id);
      } catch (err) {
        console.warn('Failed to update last_online:', err);
      }
    };

    // Update immediately on page load
    updateLastOnline();

    // Update every 45 seconds
    const interval = setInterval(updateLastOnline, 45_000);

    return () => clearInterval(interval);
  }, [user?.id, supabase]);

  // ... rest of your render logic unchanged
  if (!user) {
    return (
      <>
        <Header />
        <main className="flex-grow pb-16 md:pb-0 pt-16 md:pt-16">{children}</main>
        <FooterNav />
      </>
    );
  }

  if (!user.id || typeof user.id !== 'string' || user.id.trim() === '') {
    console.error('ClientLayout: Invalid user.id', user.id);
    return (
      <>
        <Header />
        <main className="flex-grow pb-16 md:pb-0 pt-16 md:pt-16">{children}</main>
        <FooterNav />
      </>
    );
  }

  return (
    <CallProvider userId={user.id} fullName={user.user_metadata?.full_name || 'Anonymous'}>
      <Toaster />
      <CallOverlay />
      <Header />
      <main className="flex-grow pb-16 md:pb-0 pt-16 md:pt-16">{children}</main>
      <FooterNav />
    </CallProvider>
  );
}