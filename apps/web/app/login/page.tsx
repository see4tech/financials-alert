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
    const client = getSupabaseBrowser();
    setAuthConfigured(client !== null);
    if (client) {
      client.auth.getSession().then(({ data: { session } }) => {
        if (session) router.replace('/dashboard');
      });
    }
  }, [clientReady, router]);

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

  if (clientReady && authConfigured === false) {
    return (
      <main className="min-h-screen p-8 bg-slate-50 dark:bg-slate-900">
        <div className="max-w-4xl mx-auto mb-6">
          <NavBar />
        </div>
        <div className="flex items-center justify-center">
          <div className="w-full max-w-sm rounded-xl p-6 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-amber-800 dark:text-amber-300 mb-4">{t('auth.notConfigured')}</p>
            <Link href="/dashboard" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              {t('nav.dashboard')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-8 bg-slate-50 dark:bg-slate-900">
      <div className="max-w-4xl mx-auto mb-6">
        <NavBar />
      </div>
      <div className="flex items-center justify-center">
      <div className="w-full max-w-sm rounded-xl p-6 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">{t('auth.login')}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('auth.email')}
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('auth.password')}
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          <Link href="/signup" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            {t('auth.signup')}
          </Link>
        </p>
      </div>
      </div>
    </main>
  );
}
