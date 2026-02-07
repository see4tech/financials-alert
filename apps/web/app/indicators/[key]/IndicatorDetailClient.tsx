'use client';

import { NavBar } from '@/app/components/NavBar';
import { IndicatorChart } from '@/app/components/IndicatorChart';
import { useLocale } from '@/app/context/LocaleContext';

export function IndicatorDetailClient({ keyParam }: { keyParam: string }) {
  const key = keyParam;
  const { t } = useLocale();

  if (!key) return null;

  const labelKey = 'dashboard.indicatorShortLabel.' + key;
  const label = t(labelKey) !== labelKey ? t(labelKey) : key;

  return (
    <main className="min-h-screen p-6 md:p-8 max-w-4xl mx-auto">
      <NavBar />
      <h1 className="text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">{label}</h1>
      <IndicatorChart indicatorKey={key} compact={false} />
    </main>
  );
}
