'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/app/context/LocaleContext';
import { useSupabaseAuthReady } from '@/app/context/SupabaseAuthContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import { NavBar } from '@/app/components/NavBar';
import Link from 'next/link';

export default function SignupPage() {
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
      const { error: err } = await client.auth.signUp({ email, password });
      if (err) {
        setError(t('auth.signupError'));
        setLoading(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError(t('auth.signupError'));
      setLoading(false);
    }
  }

  if (clientReady && authConfigured === false) {
    return (
      <main className="min-h-screen pt-16 px-4 sm:px-6 lg:px-8 pb-24 md:pb-8 bg-slate-50 dark:bg-slate-900">
        <NavBar />
        <div className="flex items-center justify-center mt-12">
          <div className="w-full max-w-sm cb-card p-6">
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
    <main className="min-h-screen pt-16 px-4 sm:px-6 lg:px-8 pb-24 md:pb-8 bg-slate-50 dark:bg-slate-900">
      <NavBar />
      <div className="flex items-center justify-center mt-12">
      <div className="w-full max-w-sm cb-card p-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-4">{t('auth.signup')}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('auth.email')}
            </label>
            <input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {t('auth.password')}
            </label>
            <input
              id="signup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={6}
              className="w-full border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {loading ? t('common.loading') : t('auth.signup')}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          <Link href="/login" className="text-indigo-600 dark:text-indigo-400 hover:underline">
            {t('auth.login')}
          </Link>
        </p>
      </div>
      </div>
    </main>
  );
}
