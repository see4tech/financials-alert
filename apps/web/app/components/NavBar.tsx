'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from '@/app/context/LocaleContext';
import { useSupabaseAuthReady } from '@/app/context/SupabaseAuthContext';
import { getSupabaseBrowser } from '@/lib/supabase';

export function NavBar() {
  const { t, locale, setLocale } = useLocale();
  const router = useRouter();
  const clientReady = useSupabaseAuthReady();
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (!clientReady) return;
    const client = getSupabaseBrowser();
    if (!client) {
      setSession(true);
      return;
    }
    client.auth.getSession().then(({ data: { session: s } }) => setSession(!!s));
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      client.auth.getSession().then(({ data: { session: s } }) => setSession(!!s));
    });
    return () => subscription.unsubscribe();
  }, [clientReady]);

  async function handleLogout() {
    const client = getSupabaseBrowser();
    if (client) {
      await client.auth.signOut();
    }
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="mb-8 flex flex-wrap items-center gap-4">
      {session === true && (
        <>
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            {t('nav.dashboard')}
          </Link>
          <Link href="/indicators" className="text-blue-600 hover:underline">
            {t('nav.indicators')}
          </Link>
          <Link href="/alerts" className="text-blue-600 hover:underline">
            {t('nav.alerts')}
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="text-blue-600 hover:underline ml-auto"
          >
            {t('nav.logout')}
          </button>
        </>
      )}
      {(session === false || session === null) && (
        <>
          <Link href="/login" className="text-blue-600 hover:underline">
            {t('nav.login')}
          </Link>
          <Link href="/signup" className="text-blue-600 hover:underline">
            {t('nav.signup')}
          </Link>
          <span className="ml-auto" />
        </>
      )}
      <span className="ml-auto flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => setLocale('es')}
          className={locale === 'es' ? 'font-semibold text-blue-600 underline' : 'text-gray-600 hover:text-blue-600'}
          aria-pressed={locale === 'es'}
        >
          ES
        </button>
        <span className="text-gray-400" aria-hidden>
          |
        </span>
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={locale === 'en' ? 'font-semibold text-blue-600 underline' : 'text-gray-600 hover:text-blue-600'}
          aria-pressed={locale === 'en'}
        >
          EN
        </button>
      </span>
    </nav>
  );
}
