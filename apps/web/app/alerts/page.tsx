'use client';

import { useEffect, useState } from 'react';
import { NavBar } from '@/app/components/NavBar';
import { useLocale } from '@/app/context/LocaleContext';
import { fetchAlertsHistory, fetchRules } from '@/lib/api';

export default function AlertsPage() {
  const { t } = useLocale();
  const [fired, setFired] = useState<{ id: string; rule_id: string; ts: string; payload?: unknown }[]>([]);
  const [rules, setRules] = useState<{ id: string; json_rule: Record<string, unknown>; is_enabled: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchAlertsHistory('30d'), fetchRules()])
      .then(([hist, r]) => {
        setFired(Array.isArray(hist) ? hist : []);
        setRules(Array.isArray(r) ? r : []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">{t('common.loading')}</div>;
  if (error) return <div className="p-8 text-red-600">{t('common.error')}: {error}</div>;

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <NavBar />
      <h1 className="text-2xl font-bold mb-6">{t('alerts.title')}</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">{t('alerts.rules')}</h2>
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="border rounded p-3 flex justify-between items-center">
              <span className="font-mono text-sm">{String(r.json_rule?.name ?? r.id)}</span>
              <span className={r.is_enabled ? 'text-green-600' : 'text-gray-400'}>
                {r.is_enabled ? t('alerts.on') : t('alerts.off')}
              </span>
            </li>
          ))}
        </ul>
        {rules.length === 0 && <p className="text-gray-500">{t('alerts.noRules')}</p>}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-4">{t('alerts.firedAlerts')}</h2>
        <ul className="space-y-2">
          {fired.map((a) => (
            <li key={a.id} className="border rounded p-3 text-sm">
              <span className="text-gray-500">{new Date(a.ts).toLocaleString()}</span>
              <pre className="mt-1 overflow-auto">{JSON.stringify(a.payload ?? {}, null, 0)}</pre>
            </li>
          ))}
        </ul>
        {fired.length === 0 && <p className="text-gray-500">{t('alerts.noFired')}</p>}
      </section>
    </main>
  );
}
