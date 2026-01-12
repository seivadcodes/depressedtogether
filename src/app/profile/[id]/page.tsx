// src/app/profile/[id]/page.tsx (or wherever this file lives)
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCall } from '@/context/CallContext';
import SendMessageOverlay from '@/components/modals/SendMessageOverlay';

interface Profile {
  id: string;
  full_name: string | null;
  grief_types: string[];
  country: string | null; // Should contain ISO 3166-1 alpha-2 code (e.g., 'US', 'GB')
}

const griefLabels: Record<string, string> = {
  parent: 'Loss of a Parent',
  child: 'Loss of a Child',
  spouse: 'Grieving a Partner',
  sibling: 'Loss of a Sibling',
  friend: 'Loss of a Friend',
  pet: 'Pet Loss',
  miscarriage: 'Pregnancy or Infant Loss',
  caregiver: 'Caregiver Grief',
  suicide: 'Suicide Loss',
  other: 'Other Loss',
};

// Standard function to convert ISO country code to flag emoji (works for ALL countries)
function countryCodeToFlagEmoji(isoCode: string | null): string {
  if (!isoCode || isoCode.length !== 2) return '🌍';
  
  try {
    // Convert ISO 3166-1 alpha-2 code to flag emoji
    const codePoints = isoCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    
    return String.fromCodePoint(...codePoints);
  } catch (e) {
    console.warn('Invalid country code:', isoCode);
    return '🌍';
  }
}

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { startCall } = useCall();

  const [data, setData] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMessageOverlay, setShowMessageOverlay] = useState(false);

  const isValidId = useMemo(() => {
    return id && typeof id === 'string' && id.trim() !== '';
  }, [id]);

  const fetchProfile = useCallback(async () => {
    if (!isValidId) {
      setLoading(false);
      setData(null);
      setError('Invalid profile ID');
      return;
    }

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Missing Supabase env vars');
      setLoading(false);
      setData(null);
      setError('Server configuration error');
      return;
    }

    try {
      // Make sure we're selecting the country column
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,full_name,grief_types,country`,
        {
          headers: {
            apiKey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            accept: 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Profile not found');
      }

      const profiles: Profile[] = await response.json();
      const profile = profiles[0] || null;

      if (!profile) {
        setError('Profile not found');
        setData(null);
      } else {
        // Clean up country data
        const cleanedProfile = {
          ...profile,
          country: profile.country?.trim() || null,
        };
        setData(cleanedProfile);
      }
    } catch (err) {
      console.error('Profile fetch failed:', err);
      setData(null);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [id, isValidId]);

  useEffect(() => {
    setLoading(true);
    setData(null);
    setError(null);
    fetchProfile();
  }, [fetchProfile]);

  const handleCall = async () => {
    if (!data?.id) return;
    await startCall(
      data.id,
      data.full_name || 'Anonymous',
      'audio',
      data.id,
      data.id
    );
  };

  const handleMessage = () => {
    if (!data?.id) return;
    setShowMessageOverlay(true);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1rem', color: '#444' }}>
        Loading profile...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1rem', color: '#d32f2f' }}>
        {error || 'Profile not found'}
      </div>
    );
  }

  const name = data.full_name || 'Anonymous';
  const firstName = data.full_name ? data.full_name.split(' ')[0] : 'Them';
  const types = Array.isArray(data.grief_types) ? data.grief_types : [];
  const countryCode = data.country?.trim() || null;
  
  // Get full country name using browser's Intl API (no manual mappings needed!)
  let countryName = countryCode;
  try {
    if (countryCode && countryCode.length === 2) {
      const regionNames = new Intl.DisplayNames(['en'], {type: 'region'});
      countryName = regionNames.of(countryCode.toUpperCase()) || countryCode;
    }
  } catch (e) {
    console.debug('Intl API not fully supported, using country code', e);
  }

  return (
    <div style={{ padding: '1rem', maxWidth: '500px', margin: '2rem auto', fontFamily: 'system-ui' }}>
      <div
        style={{
          background: '#fff',
          borderRadius: '12px',
          padding: '1.5rem',
          textAlign: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            margin: '0 auto 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            color: 'white',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>

        <h1 style={{ margin: '0 0 0.25rem', fontSize: '1.5rem', fontWeight: '700', color: '#1e293b' }}>
          {name}
        </h1>

        {/* Automatic country display - no manual mappings! */}
        {countryCode && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            gap: '0.5rem',
            marginBottom: '0.75rem'
          }}>
            <span style={{ fontSize: '1.2rem' }}>
              {countryCodeToFlagEmoji(countryCode)}
            </span>
            <p style={{ 
              margin: 0, 
              fontSize: '1rem', 
              fontWeight: '500',
              color: '#475569'
            }}>
              {countryName}
            </p>
          </div>
        )}

        {types.length > 0 && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '0.5rem', 
            justifyContent: 'center', 
            marginBottom: '1.25rem',
            padding: '0.5rem 0'
          }}>
            {types.map((t) => (
              <span
                key={t}
                style={{
                  background: 'linear-gradient(to right, #fecaca, #fca5a5)',
                  color: '#b91c1c',
                  fontSize: '0.85rem',
                  padding: '0.35rem 0.85rem',
                  borderRadius: '9999px',
                  fontWeight: '500',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                {griefLabels[t] || t}
              </span>
            ))}
          </div>
        )}

        <p style={{ 
          fontSize: '1.05rem', 
          color: '#475569', 
          marginBottom: '1.5rem',
          lineHeight: 1.5,
          fontStyle: 'italic'
        }}>
       
        </p>

        <div style={{ 
          display: 'flex', 
          gap: '1rem', 
          justifyContent: 'center', 
          marginBottom: '1.25rem',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={handleCall}
            style={{
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '0.8rem 1.5rem',
              fontSize: '1.05rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              minWidth: '140px',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'none')}
          >
            <span>📞</span> Call {firstName}
          </button>

          <button
            onClick={handleMessage}
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '0.8rem 1.5rem',
              fontSize: '1.05rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              minWidth: '140px',
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseOut={(e) => (e.currentTarget.style.transform = 'none')}
          >
            <span>💬</span> Message {firstName}
          </button>
        </div>

        {/* Contextual message using automatically detected country name */}
        {countryCode && (
          <div style={{ 
            marginTop: '1rem', 
            paddingTop: '1rem', 
            borderTop: '1px solid #e2e8f0',
            fontSize: '0.95rem',
            color: '#64748b',
            fontStyle: 'italic'
          }}>
            Connecting with others from {countryName}
          </div>
        )}
      </div>
      
      {showMessageOverlay && (
        <SendMessageOverlay
          isOpen={true}
          targetUserId={data.id}
          targetName={data.full_name || 'Anonymous'}
          onClose={() => setShowMessageOverlay(false)}
        />
      )}
    </div>
  );
}