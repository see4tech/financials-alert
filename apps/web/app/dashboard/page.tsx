'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { NavBar } from '@/app/components/NavBar';
import { useLocale } from '@/app/context/LocaleContext';
import { fetchDashboard, fetchScoreHistory, triggerRunJobs } from '@/lib/api';

type Indicator = { key: string; value?: number; trend: string; status: string; explain?: string };
type Dashboard = {
  asOf: string;
  score: number;
  deltaWeek: number;
  indicators: Indicator[];
  scenario: { bull: string; bear: string };
};

function refreshData(): Promise<[Dashboard, { data: { week_start_date: string; score: number }[] }]> {
  return Promise.all([fetchDashboard(), fetchScoreHistory('12w')]);
}

export default function DashboardPage() {
  const { t, translateExplain } = useLocale();
  const [data, setData] = useState<Dashboard | null>(null);
  const [scoreHistory, setScoreHistory] = useState<{ week_start_date: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runJobsLoading, setRunJobsLoading] = useState(false);
  const [runJobsError, setRunJobsError] = useState<string | null>(null);
  const [cronSecretPrompt, setCronSecretPrompt] = useState(false);
  const [cronSecretInput, setCronSecretInput] = useState('');

  useEffect(() => {
    refreshData()
      .then(([d, sh]) => {
        setData(d);
        setScoreHistory(sh.data || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const runJobsNow = useCallback(
    async (secret?: string) => {
      setRunJobsError(null);
      setRunJobsLoading(true);
      try {
        await triggerRunJobs(secret);
        setCronSecretPrompt(false);
        setCronSecretInput('');
        const [d, sh] = await refreshData();
        setData(d);
        setScoreHistory(sh.data || []);
        setError(null);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Cron secret required')) setCronSecretPrompt(true);
        else setRunJobsError(msg);
      } finally {
        setRunJobsLoading(false);
      }
    },
    [],
  );

  if (loading) return <div className="p-8">{t('common.loading')}</div>;
  if (error) {
    return (
      <main className="min-h-screen p-8 max-w-6xl mx-auto">
        <NavBar />
        <div className="mb-4 text-red-600">{t('common.error')}: {error}</div>
        <p className="mb-4 text-sm text-gray-600">{t('dashboard.errorHint')}</p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runJobsNow()}
            disabled={runJobsLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {runJobsLoading ? t('dashboard.running') : t('dashboard.runJobs')}
          </button>
          {runJobsError && <p className="text-sm text-red-600">{runJobsError}</p>}
        </div>
        {cronSecretPrompt && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <label htmlFor="cron-secret-err" className="text-sm font-medium">{t('dashboard.cronSecretLabel')}</label>
            <input
              id="cron-secret-err"
              type="password"
              value={cronSecretInput}
              onChange={(e) => setCronSecretInput(e.target.value)}
              placeholder={t('dashboard.cronSecretPlaceholder')}
              className="rounded border border-amber-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => runJobsNow(cronSecretInput)}
              disabled={runJobsLoading || !cronSecretInput.trim()}
              className="rounded bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {t('dashboard.runWithSecret')}
            </button>
          </div>
        )}
      </main>
    );
  }
  if (!data) return null;

  const statusIconColor = (s: string) =>
    s === 'GREEN' ? 'text-green-600' : s === 'RED' ? 'text-red-600' : s === 'YELLOW' ? 'text-amber-500' : 'text-gray-400';
  const trendArrow = (trend: string) => (trend === 'RISING' ? '↑' : trend === 'FALLING' ? '↓' : '→');

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <NavBar />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('dashboard.asOf')}: {new Date(data.asOf).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => runJobsNow()}
            disabled={runJobsLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {runJobsLoading ? t('dashboard.running') : t('dashboard.runJobs')}
          </button>
          {runJobsError && <p className="text-sm text-red-600">{runJobsError}</p>}
        </div>
      </div>
      {cronSecretPrompt && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800">
          <label htmlFor="cron-secret" className="text-sm font-medium">
            {t('dashboard.cronSecretLabel')}
          </label>
          <input
            id="cron-secret"
            type="password"
            value={cronSecretInput}
            onChange={(e) => setCronSecretInput(e.target.value)}
            placeholder={t('dashboard.cronSecretPlaceholder')}
            className="rounded border border-amber-300 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => runJobsNow(cronSecretInput)}
            disabled={runJobsLoading || !cronSecretInput.trim()}
            className="rounded bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {t('dashboard.runWithSecret')}
          </button>
          <button
            type="button"
            onClick={() => { setCronSecretPrompt(false); setRunJobsError(null); }}
            className="text-sm underline"
          >
            {t('dashboard.cancel')}
          </button>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <h2 className="text-sm font-medium text-gray-500">{t('dashboard.weeklyScore')}</h2>
          <p className="text-3xl font-bold">{data.score}</p>
          <p className="text-sm text-gray-600">{t('dashboard.deltaWeek')}: {data.deltaWeek >= 0 ? '+' : ''}{data.deltaWeek}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <h2 className="text-sm font-medium text-gray-500">{t('dashboard.scoreHistory')}</h2>
          <div className="flex items-end gap-0.5 h-12 mt-2">
            {scoreHistory.slice(-12).map((s) => (
              <div
                key={s.week_start_date}
                className="flex-1 bg-blue-200 rounded-t min-w-[4px]"
                style={{ height: `${Math.max(8, (Number(s.score) / 8) * 100)}%` }}
                title={`${s.week_start_date}: ${s.score}`}
              />
            ))}
          </div>
        </div>
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <h2 className="text-sm font-medium text-gray-500">{t('dashboard.scenario')}</h2>
          <p className="font-medium">{t('dashboard.bull')}: {t('dashboard.scenarioValue.bull.' + data.scenario.bull)}</p>
          <p className="font-medium">{t('dashboard.bear')}: {t('dashboard.scenarioValue.bear.' + data.scenario.bear)}</p>
        </div>
      </section>

      <h2 className="text-xl font-semibold mb-4">{t('dashboard.indicators')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.indicators.map((ind) => (
          <div key={ind.key} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex justify-between items-start">
              <span className="font-medium">{ind.key}</span>
              <span className={statusIconColor(ind.status)} title={t('status.' + ind.status.toLowerCase())} aria-label={t('status.' + ind.status.toLowerCase())}>
                {ind.status === 'GREEN' && (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                )}
                {ind.status === 'RED' && (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                )}
                {ind.status === 'YELLOW' && (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                )}
                {ind.status === 'UNKNOWN' && (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-.A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                )}
              </span>
            </div>
            {ind.value != null && <p className="text-lg mt-1">{ind.value}</p>}
            <p className="text-sm text-gray-600 mt-1">{trendArrow(ind.trend)} {t('trend.' + ind.trend.toLowerCase())}</p>
            {ind.explain && <p className="text-xs text-gray-500 mt-2">{translateExplain(ind.explain)}</p>}
            {ind.status === 'UNKNOWN' && ind.explain === 'Data stale' && (
              <p className="text-xs text-amber-600 mt-1">{t('dashboard.staleHint')}</p>
            )}
            {t('dashboard.favorable.' + ind.key) !== 'dashboard.favorable.' + ind.key && (
              <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-100">{t('dashboard.favorable.' + ind.key)}</p>
            )}
            <Link href={`/indicators/${ind.key}`} className="text-xs text-blue-600 mt-2 inline-block hover:underline">
              {t('dashboard.viewHistory')}
            </Link>
          </div>
        ))}
      </div>
      {data.indicators.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="font-medium">{t('dashboard.noIndicators')}</p>
          <p className="mt-1 text-sm">{t('dashboard.noIndicatorsHint')}</p>
          <p className="mt-2 text-xs text-amber-700">{t('dashboard.apiKeysHint')}</p>
        </div>
      )}
    </main>
  );
}
