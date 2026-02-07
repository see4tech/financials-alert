'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useLocale } from '@/app/context/LocaleContext';
import { useSupabaseAuthReady } from '@/app/context/SupabaseAuthContext';

export default function Home() {
  const router = useRouter();
  const { t } = useLocale();
  const clientReady = useSupabaseAuthReady();
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!clientReady) return;
    let cancelled = false;
    const client = getSupabaseBrowser();
    if (!client) {
      setResolved(true);
      router.replace('/dashboard');
      return;
    }
    client.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        if (session) router.replace('/dashboard');
        else router.replace('/login');
        setResolved(true);
      })
      .catch(() => {
        if (!cancelled) {
          router.replace('/login');
          setResolved(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [router, clientReady]);

  if (!clientReady || !resolved) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <p className="text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
      </main>
    );
  }
  return null;
}
