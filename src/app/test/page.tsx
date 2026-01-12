// src/app/test-country/page.tsx
'use client';

import { useEffect, useState } from 'react';

type CountryInfo = {
  country: string; // e.g., "KE", "US", "GB"
};

export default function TestCountryPage() {
  const [country, setCountry] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <p style={{ fontSize: '0.9rem', color: '#666' }}>
        (Deployed on Vercel? )
      </p>
    </div>
  );
}