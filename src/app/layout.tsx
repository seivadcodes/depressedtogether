// Inside src/app/layout.tsx

'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/header';
import FooterNav from '@/components/layout/FooterNav';
import { SupabaseProvider } from '@/components/SupabaseProvider';
import { useAuth } from '@/hooks/useAuth';
import { ReactNode, Suspense, useEffect } from 'react'; // 👈 added useEffect
import { Toaster } from 'react-hot-toast';
import { CallProvider } from '@/context/CallContext';
import CallOverlay from '@/components/calling/CallOverlay';

const inter = Inter({ subsets: ['latin'] });

function LayoutContent({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  // ✅ Auto-update country when user is known
  useEffect(() => {
    if (user?.id && typeof user.id === 'string' && user.id.trim() !== '') {
      // Fire-and-forget POST to update country
      fetch('/api/update-user-country', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id }),
        credentials: 'include', // ensures session cookie is sent
      }).catch(err => {
        console.warn('Failed to auto-update country:', err);
      });
    }
  }, [user?.id]); // runs once per login/session

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

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
    console.error('Layout: Invalid user.id — skipping CallProvider', user.id);
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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${inter.className} flex flex-col h-full bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 text-stone-900`}
        suppressHydrationWarning
      >
        <SupabaseProvider>
          <Suspense fallback={<div>Loading...</div>}>
            <LayoutContent>{children}</LayoutContent>
          </Suspense>
        </SupabaseProvider>
      </body>
    </html>
  );
}