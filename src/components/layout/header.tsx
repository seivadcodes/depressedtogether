'use client';

import Link from 'next/link';
import { Home, User, LogOut } from 'lucide-react';
import Image from 'next/image'; // ✅ Added

import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect, useRef, useMemo } from 'react';

export default function Header() {
  const { user, loading, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // ✅ Compute avatar URL and initials
  const userDisplay = useMemo(() => {
    if (!user) {
      return { avatarUrl: null, initials: 'U' };
    }

    const avatarUrl = user.user_metadata?.avatar_url || null;

    let name = '';
    if (user.user_metadata?.full_name) {
      name = user.user_metadata.full_name;
    } else if (user.email) {
      name = user.email.split('@')[0];
    }

    const initials = name
      .split(' ')
      .map((n) => n[0]?.toUpperCase() || '')
      .join('')
      .substring(0, 2) || 'U';

    return { avatarUrl, initials };
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    setIsMenuOpen(false);
  };

  // If still loading, show nothing
  if (loading) {
    return null;
  }

  return (
    <>
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: 'rgba(30, 58, 138, 0.95)', // #1e3a8a (blue-800)
          backdropFilter: 'blur(4px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            maxWidth: '48rem',
            margin: '0 auto',
            padding: '0.75rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'white',
              textDecoration: 'none',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#bfdbfe')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'white')}
            aria-label="Back to Home"
          >
            <Home size={20} color="white" />
            <span style={{ fontWeight: 500 }}>Healing Shoulder</span>
          </Link>

          {user ? (
            <div ref={menuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                style={{
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '9999px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: userDisplay.avatarUrl ? 'transparent' : '#60a5fa', // blue-400
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
                aria-label="User menu"
              >
                {userDisplay.avatarUrl ? (
                  <Image
                    src={userDisplay.avatarUrl}
                    alt="Profile"
                    width={32}
                    height={32}
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '9999px',
                      objectFit: 'cover',
                      border: '1px solid rgba(255,255,255,0.2)',
                    }}
                    unoptimized // ✅ Required for Supabase public URLs (or configure loader)
                  />
                ) : (
                  <span
                    style={{
                      color: 'white',
                      fontWeight: 500,
                      fontSize: '0.875rem',
                    }}
                  >
                    {userDisplay.initials}
                  </span>
                )}
              </button>

              {isMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: '2.5rem',
                    width: '12rem',
                    backgroundColor: 'white',
                    border: '1px solid #e2e2e2',
                    borderRadius: '0.5rem',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    padding: '0.25rem 0',
                    zIndex: 50,
                  }}
                >
                  <Link
                    href="/dashboard"
                    style={{
                      display: 'block',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      color: '#3f3f46',
                      textDecoration: 'none',
                    }}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      color: '#3f3f46',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f4f4f5')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <LogOut size={16} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                color: 'white',
                fontSize: '0.875rem',
                fontWeight: 500,
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#bfdbfe')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'white')}
            >
              <User size={18} color="white" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </header>

      {/* Overlay to close menu on outside tap (mobile-friendly) */}
      {isMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            backgroundColor: 'transparent',
          }}
          onClick={() => setIsMenuOpen(false)}
        ></div>
      )}
    </>
  );
}