// src/app/test-country/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/auth';

type CountryInfo = {
  country: string;
};

export default function TestCountryPage() {
  const [country, setCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    const fetchCountry = async () => {
      try {
        const res = await fetch('/api/country');
        if (!res.ok) throw new Error('Failed to fetch country');
        const data: CountryInfo = await res.json();
        setCountry(data.country);
      } catch (err) {
        setError('Could not detect country');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCountry();
  }, []);

  const saveToProfile = async () => {
    if (!country) return;

    setSaving(true);
    setSaveStatus('idle');

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setSaveStatus('error');
      setSaving(false);
      setError('You must be signed in to save your country.');
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ country })
      .eq('id', user.id);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      setSaveStatus('error');
    } else {
      setSaveStatus('success');
    }

    setSaving(false);
  };

  if (loading) {
    return <div style={{ padding: '2rem' }}>Detecting your country...</div>;
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>🌍 Country Detection Test</h1>
      {error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : (
        <p>
          Your country code: <strong>{country || 'Unknown'}</strong>
        </p>
      )}

      {country && country !== 'XX' && (
        <button
          onClick={saveToProfile}
          disabled={saving}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? 'Saving...' : 'Save to Profile'}
        </button>
      )}

      {saveStatus === 'success' && (
        <p style={{ color: 'green', marginTop: '0.5rem' }}>
          ✅ Country saved to your profile!
        </p>
      )}
      {saveStatus === 'error' && (
        <p style={{ color: 'red', marginTop: '0.5rem' }}>
          ❌ Failed to save country. Please try again.
        </p>
      )}

      <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '2rem' }}>
        (Deployed on Vercel?)
      </p>
    </div>
  );
}