// src/app/auth/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/button';

export default function AuthPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectTo);
    }
  }, [user, loading, router, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (authMode === 'sign-in') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
      // Redirect handled automatically by useEffect above
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-solid border-amber-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-stone-600">Checking your session...</p>
        </div>
      </div>
    );
  }

  // If user is present and authenticated, they'll be redirected above
  if (user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-stone-50 to-stone-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md border border-stone-200">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 mx-auto mb-4">
            <span className="text-white text-2xl">🫂</span>
          </div>
          <h1 className="text-2xl font-bold text-stone-800">
            {authMode === 'sign-in' ? 'Welcome Back' : 'Create Your Healing Space'}
          </h1>
          <p className="text-stone-600 mt-2">
            {authMode === 'sign-in' 
              ? 'Sign in to continue your healing journey' 
              : 'Join a compassionate community that understands'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label htmlFor="email" className="block text-sm font-medium text-stone-700">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-medium text-stone-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 font-medium rounded-xl transition-colors"
          >
            {submitting ? (
              <span className="flex items-center justify-center">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-white border-t-transparent mr-2"></span>
                {authMode === 'sign-in' ? 'Signing in...' : 'Creating account...'}
              </span>
            ) : (
              authMode === 'sign-in' ? 'Sign In' : 'Create Account'
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setAuthMode(authMode === 'sign-in' ? 'sign-up' : 'sign-in')}
            className="text-sm text-amber-700 hover:text-amber-800 font-medium hover:underline"
          >
            {authMode === 'sign-in' 
              ? "Don't have an account? Create one" 
              : "Already have an account? Sign in"}
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-stone-100 text-center text-xs text-stone-500">
          <p>By continuing, you agree to our <Link href="/terms" className="text-amber-700 hover:underline">Terms</Link> and <Link href="/privacy" className="text-amber-700 hover:underline">Privacy Policy</Link></p>
          <p className="mt-1">Healing Shoulder is a supportive community. Your grief is valid here.</p>
        </div>
      </div>
    </div>
  );
}