'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { NavBar } from '@/app/components/NavBar';
import { useLocale } from '@/app/context/LocaleContext';
import { fetchDashboard, fetchScoreHistory, triggerRunJobs } from '@/lib/api';

type Indicator = { key: string; value?: number; trend: string; status: string; explain?: string; ma21d?: number; referenceText?: string };
type Recommendation = { id: string; tickers?: string[] };
type Dashboard = {
  asOf: string;
  score: number;
  deltaWeek: number;
  indicators: Indicator[];
  scenario: { bull: string; bear: string };
  recommendations?: Recommendation[];
};

function refreshData(): Promise<[Dashboard, { data: { week_start_date: string; score: number }[] }]> {
  return Promise.all([fetchDashboard(), fetchScoreHistory('12w')]);
}

export default function DashboardPage() {
  const { t, translateExplain, locale } = useLocale();
  const [data, setData] = useState<Dashboard | null>(null);
  const [scoreHistory, setScoreHistory] = useState<{ week_start_date: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runJobsLoading, setRunJobsLoading] = useState(false);
  const [runJobsError, setRunJobsError] = useState<string | null>(null);
  const [cronSecretPrompt, setCronSecretPrompt] = useState(false);
  const [cronSecretInput, setCronSecretInput] = useState('');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredSummaryCard, setHoveredSummaryCard] = useState<'weeklyScore' | 'scoreHistory' | null>(null);
  const [hoveredScoreBar, setHoveredScoreBar] = useState<{ week_start_date: string; score: number } | null>(null);

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
          <p className="text-xs text-gray-400 mt-0.5">{t('dashboard.refreshHint')}</p>
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
        <div
          className="border rounded-lg p-4 bg-white shadow-sm relative"
          onMouseEnter={() => setHoveredSummaryCard('weeklyScore')}
          onMouseLeave={() => setHoveredSummaryCard(null)}
        >
          <h2 className="text-sm font-medium text-gray-500">{t('dashboard.weeklyScore')}</h2>
          <p className="text-3xl font-bold">{data.score}</p>
          <p className="text-sm text-gray-600">{t('dashboard.deltaWeek')}: {data.deltaWeek >= 0 ? '+' : ''}{data.deltaWeek}</p>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-500 mb-1.5">{t('dashboard.weeklyScoreBreakdown')}</p>
            <p className="text-[11px] text-gray-500 mb-2">{t('dashboard.weeklyScoreBreakdownHint')}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
              {(['GREEN', 'YELLOW', 'RED'] as const).map((status) => {
                const list = data.indicators.filter((i) => i.status === status);
                if (list.length === 0) return null;
                const statusKey = status === 'GREEN' ? 'scoreStatusGreen' : status === 'YELLOW' ? 'scoreStatusYellow' : 'scoreStatusRed';
                const labels = list.map((i) => {
                  const key = 'dashboard.indicatorShortLabel.' + i.key;
                  const label = t(key);
                  return label !== key ? label : i.key;
                });
                return (
                  <span key={status} className="flex items-center gap-1">
                    <span className={`font-medium ${statusIconColor(status)}`}>{t('dashboard.' + statusKey)}</span>
                    <span className="text-gray-600">({list.length}): {labels.join(', ')}</span>
                  </span>
                );
              })}
              {data.indicators.some((i) => i.status !== 'GREEN' && i.status !== 'YELLOW' && i.status !== 'RED') && (
                <span className="flex items-center gap-1">
                  <span className="font-medium text-gray-400">{t('dashboard.scoreStatusUnknown')}</span>
                  <span className="text-gray-600">
                    ({data.indicators.filter((i) => i.status !== 'GREEN' && i.status !== 'YELLOW' && i.status !== 'RED').length}):{' '}
                    {data.indicators
                      .filter((i) => i.status !== 'GREEN' && i.status !== 'YELLOW' && i.status !== 'RED')
                      .map((i) => (t('dashboard.indicatorShortLabel.' + i.key) !== 'dashboard.indicatorShortLabel.' + i.key ? t('dashboard.indicatorShortLabel.' + i.key) : i.key))
                      .join(', ')}
                  </span>
                </span>
              )}
            </div>
          </div>
          {hoveredSummaryCard === 'weeklyScore' && (
            <div className="absolute z-20 left-0 right-0 bottom-full mb-1 p-3 text-xs text-left bg-gray-800 text-white rounded-lg shadow-lg pointer-events-none max-w-xs">
              {t('dashboard.weeklyScoreTooltip')}
            </div>
          )}
        </div>
        <div
          className="border rounded-lg p-4 bg-white shadow-sm relative"
          onMouseEnter={() => setHoveredSummaryCard('scoreHistory')}
          onMouseLeave={() => { setHoveredSummaryCard(null); setHoveredScoreBar(null); }}
        >
          <h2 className="text-sm font-medium text-gray-500">{t('dashboard.scoreHistory')}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{t('dashboard.scoreHistoryRange')}</p>
          {hoveredSummaryCard === 'scoreHistory' && (
            <div className="absolute z-20 left-0 right-0 bottom-full mb-1 p-3 text-xs text-left bg-gray-800 text-white rounded-lg shadow-lg pointer-events-none max-w-sm">
              <p className="mb-1">{t('dashboard.scoreHistoryCaption')}</p>
              <p className="mb-1">{t('dashboard.scoreHistoryWhatItIs')}</p>
              <p>{t('dashboard.scoreHistoryHowToInterpret')}</p>
            </div>
          )}
          {scoreHistory.length === 0 ? (
            <p className="text-xs text-gray-500 mt-2">{t('dashboard.scoreHistoryEmpty')}</p>
          ) : (
            <div className="flex gap-1 h-28 mt-2 items-end">
              <div className="flex flex-col justify-between text-right text-xs text-gray-500 pr-1 shrink-0 h-full">
                <span>8</span>
                <span>4</span>
                <span>0</span>
              </div>
              <div className="flex-1 flex gap-0.5 min-w-0 h-full">
                {scoreHistory.slice(-12).map((s) => {
                  const scoreNum = Number(s.score);
                  const maxScore = 8;
                  const pct = Math.min(100, (scoreNum / maxScore) * 100);
                  const barHeightPct = Math.max(10, pct);
                  const barColor =
                    scoreNum >= 5 ? 'bg-green-500' : scoreNum >= 3 ? 'bg-amber-500' : scoreNum >= 1 ? 'bg-red-400' : 'bg-gray-300';
                  return (
                    <div
                      key={s.week_start_date}
                      className="flex-1 flex flex-col justify-end items-center min-w-0 h-full cursor-default"
                      onMouseEnter={() => setHoveredScoreBar(s)}
                      onMouseLeave={() => setHoveredScoreBar(null)}
                      title={`${t('dashboard.scoreHistoryHoverLabel')} ${s.week_start_date} → ${s.score}`}
                    >
                      <span className="text-[10px] font-medium text-gray-600 mb-0.5 leading-none" aria-hidden="true">
                        {s.score}
                      </span>
                      <div
                        className={`w-full ${barColor} rounded-t min-h-[2px]`}
                        style={{ height: `${barHeightPct}%` }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <h2 className="text-sm font-medium text-gray-500">{t('dashboard.scenario')}</h2>
          <p className="font-medium">{t('dashboard.bull')}: {t('dashboard.scenarioValue.bull.' + data.scenario.bull)}</p>
          <p className="font-medium">{t('dashboard.bear')}: {t('dashboard.scenarioValue.bear.' + data.scenario.bear)}</p>
        </div>
      </section>

      <h2 className="text-xl font-semibold mb-4">{t('dashboard.recommendationsTitle')}</h2>
      {(!data.recommendations || data.recommendations.length === 0) ? (
        <p className="text-sm text-gray-500 mb-6">{t('dashboard.recommendationsEmpty')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {data.recommendations.map((rec) => {
            const labelKey = 'dashboard.recommendations.' + rec.id;
            const descKey = 'dashboard.recommendations.' + rec.id + '_desc';
            const desc = t(descKey) !== descKey ? t(descKey) : null;
            return (
              <div key={rec.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <p className="font-medium text-gray-900">{t(labelKey)}</p>
                {desc && <p className="text-xs text-gray-600 mt-1">{desc}</p>}
                {rec.tickers && rec.tickers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {rec.tickers.map((ticker) => (
                      <span
                        key={ticker}
                        className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
                      >
                        {ticker}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <h2 className="text-xl font-semibold mb-4">{t('dashboard.indicators')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.indicators.map((ind) => {
          const tooltipKey = 'dashboard.indicatorTooltip.' + ind.key;
          const tooltipText = t(tooltipKey) !== tooltipKey ? t(tooltipKey) : null;
          return (
          <div
            key={ind.key}
            className="border rounded-lg p-4 bg-white shadow-sm relative"
            onMouseEnter={() => setHoveredCard(ind.key)}
            onMouseLeave={() => setHoveredCard(null)}
          >
            <div className="flex justify-between items-start">
              <span className="font-medium">{ind.key}</span>
              <span className={statusIconColor(ind.status)} title={t('status.' + ind.status.toLowerCase())} aria-label={t('status.' + ind.status.toLowerCase())}>
                <svg className="w-6 h-6" viewBox="0 0 20 20">
                  <circle cx="10" cy="10" r="8" fill="currentColor" />
                </svg>
              </span>
            </div>
            {ind.value != null && (
              <p className="text-lg mt-1">
                {ind.value}
                {ind.ma21d != null && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({t('dashboard.ma21d')}: {ind.ma21d})
                  </span>
                )}
              </p>
            )}
            {ind.referenceText && (
              <p className="text-xs text-gray-500 mt-1">
                {t('dashboard.referenceLabel')}{' '}
                {locale === 'es'
                  ? ind.referenceText.replace(/\bzone\b/g, 'zona').replace(/\bred\b/g, 'rojo').replace(/\bgreen\b/g, 'verde')
                  : ind.referenceText}
              </p>
            )}
            <p className="text-sm text-gray-600 mt-1">{trendArrow(ind.trend)} {t('trend.' + ind.trend.toLowerCase())}</p>
            {ind.explain && <p className="text-xs text-gray-500 mt-2">{translateExplain(ind.explain)}</p>}
            {ind.status === 'UNKNOWN' && ind.explain === 'Data stale' && (
              <p className="text-xs text-amber-600 mt-1">{t('dashboard.staleHint')}</p>
            )}
            {t('dashboard.favorable.' + ind.key) !== 'dashboard.favorable.' + ind.key && (
              <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-100">
                <span className="font-medium text-gray-700">{t('dashboard.favorableLabel')}</span>{' '}
                {t('dashboard.favorable.' + ind.key)}
              </p>
            )}
            {hoveredCard === ind.key && tooltipText && (
              <div className="absolute z-20 left-0 right-0 bottom-full mb-1 p-3 text-xs text-left bg-gray-800 text-white rounded-lg shadow-lg pointer-events-none">
                {tooltipText}
              </div>
            )}
            <Link href={`/indicators/${ind.key}`} className="text-xs text-blue-600 mt-2 inline-block hover:underline">
              {t('dashboard.viewHistory')}
            </Link>
          </div>
          );
        })}
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
