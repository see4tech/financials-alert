'use client';

import { NavBar } from '@/app/components/NavBar';
import { useLocale } from '@/app/context/LocaleContext';

export default function Home() {
  const { t } = useLocale();
  return (
    <main className="min-h-screen p-8">
      <NavBar />
      <h1 className="text-2xl font-bold mb-6">{t('home.title')}</h1>
    </main>
  );
}
