'use client';

import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/header';
import FooterNav from '@/components/layout/FooterNav';
import { SupabaseProvider } from '@/components/SupabaseProvider';
import { SignalingProvider } from '@/components/SignalingProvider';
import { useAuth } from '@/hooks/useAuth';
import { ReactNode, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';

// ✅ Import both CallProvider and UI components
import { CallProvider } from '@/context/CallContext';
import CallNotificationPopup from '@/components/CallNotificationPopup';
import CallOverlay from '@/components/calling/CallOverlay'; // ✅ Add this

const inter = Inter({ subsets: ['latin'] });

export function LayoutContent({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  const currentUserId = user?.id || null;

  return (
    <CallProvider>
      <Toaster />
      
      {/* ✅ Render both popup (for incoming alert) AND overlay (for active call) */}
      <CallNotificationPopup />
      <CallOverlay /> {/* 👈 This renders the actual call screen */}

      <SignalingProvider currentUserId={currentUserId} />
      <Header />
      <main className="flex-grow pb-16 md:pb-0 pt-16 md:pt-16">
        {children}
      </main>
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