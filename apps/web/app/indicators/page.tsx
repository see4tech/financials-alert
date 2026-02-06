'use client';

import { NavBar } from '@/app/components/NavBar';
import { IndicatorChart } from '@/app/components/IndicatorChart';
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
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <NavBar />
      <h1 className="text-2xl font-bold mb-6">{t('indicators.title')}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {CORE_KEYS.map((indKey) => {
          const labelKey = 'dashboard.indicatorShortLabel.' + indKey;
          const label = t(labelKey) !== labelKey ? t(labelKey) : indKey;
          return (
            <div
              key={indKey}
              className="border rounded-lg p-4 bg-white shadow-sm"
            >
              <h2 className="text-lg font-semibold text-gray-800 mb-3">{label}</h2>
              <IndicatorChart indicatorKey={indKey} compact />
            </div>
          );
        })}
      </div>
    </main>
  );
}
