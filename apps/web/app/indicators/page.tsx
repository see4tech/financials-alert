'use client';

import Link from 'next/link';
import { NavBar } from '@/app/components/NavBar';
import { useLocale } from '@/app/context/LocaleContext';

const CORE_KEYS = [
  'macro.us10y',
  'macro.dxy',
  'eq.nasdaq',
  'eq.leaders',
  'crypto.btc',
  'sent.fng',
];

export default function IndicatorsPage() {
  const { t } = useLocale();
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <NavBar />
      <h1 className="text-2xl font-bold mb-6">{t('indicators.title')}</h1>
      <ul className="space-y-2">
        {CORE_KEYS.map((key) => (
          <li key={key}>
            <Link href={`/indicators/${key}`} className="text-blue-600 hover:underline">
              {key}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
