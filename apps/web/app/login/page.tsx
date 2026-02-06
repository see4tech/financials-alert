'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/app/context/LocaleContext';
import { useSupabaseAuthReady } from '@/app/context/SupabaseAuthContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import { NavBar } from '@/app/components/NavBar';
import Link from 'next/link';

export default function LoginPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [authConfigured, setAuthConfigured] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const clientReady = useSupabaseAuthReady();

  useEffect(() => {
    if (!clientReady) return;
    setAuthConfigured(!!getSupabaseBrowser());
  }, [clientReady]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const client = getSupabaseBrowser();
    if (!client) return;
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await client.auth.signInWithPassword({ email, password });
      if (err) {
        setError(t('auth.loginError'));
        setLoading(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError(t('auth.loginError'));
      setLoading(false);
    }
  }

  if (authConfigured === false) {
    return (
      <main className="min-h-screen p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto mb-6">
          <NavBar />
        </div>
        <div className="flex items-center justify-center">
          <div className="w-full max-w-sm border rounded-lg p-6 bg-white shadow-sm">
            <p className="text-sm text-amber-800 mb-4">{t('auth.notConfigured')}</p>
            <Link href="/dashboard" className="text-blue-600 hover:underline">
              {t('nav.dashboard')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto mb-6">
        <NavBar />
      </div>
      <div className="flex items-center justify-center">
      <div className="w-full max-w-sm border rounded-lg p-6 bg-white shadow-sm">
        <h1 className="text-xl font-bold mb-4">{t('auth.login')}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.email')}
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">
              {t('auth.password')}
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white rounded px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>
        <p className="mt-4 text-sm text-gray-600">
          <Link href="/signup" className="text-blue-600 hover:underline">
            {t('auth.signup')}
          </Link>
        </p>
      </div>
      </div>
    </main>
  );
}
