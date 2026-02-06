'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useLocale } from '@/app/context/LocaleContext';

export default function Home() {
  const router = useRouter();
  const { t } = useLocale();
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSupabaseBrowser()
      .auth.getSession()
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
  }, [router]);

  if (!resolved) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <p className="text-gray-500">{t('common.loading')}</p>
      </main>
    );
  }
  return null;
}
