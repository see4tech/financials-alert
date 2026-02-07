'use client';

import { useState } from 'react';
import Link from 'next/link';
import { NavBar } from '@/app/components/NavBar';
import { AssetSearch } from '@/app/components/AssetSearch';
import type { AiRecommendation, MarketScanResult } from '@/lib/api';

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

export type DashboardContentProps = {
  data: Dashboard;
  scoreHistory: { week_start_date: string; score: number }[];
  t: (key: string) => string;
  translateExplain: (text: string) => string;
  locale: string;
  runJobsNow: (secret?: string) => void;
  runJobsLoading: boolean;
  runBackfillNow: (secret?: string) => void;
  backfillLoading: boolean;
  cronSecretPrompt: boolean;
  cronSecretInput: string;
  setCronSecretInput: (v: string) => void;
  setCronSecretPrompt: (v: boolean) => void;
  setRunJobsError: (v: string | null) => void;
  setBackfillError: (v: string | null) => void;
  runJobsError: string | null;
  backfillError: string | null;
  backfillSuccess: string | null;
  statusIconColor: (s: string) => string;
  trendArrow: (trend: string) => string;
  setHoveredSummaryCard: (v: 'weeklyScore' | 'scoreHistory' | null) => void;
  setHoveredScoreBar: (v: { week_start_date: string; score: number } | null) => void;
  hoveredSummaryCard: 'weeklyScore' | 'scoreHistory' | null;
  hoveredScoreBar: { week_start_date: string; score: number } | null;
  userAssets: { id: string; symbol: string; asset_type: string; display_name?: string | null }[];
  handleAddAssetFromSearch: (symbol: string, assetType: string, displayName: string) => void;
  addAssetLoading: boolean;
  handleRemoveAsset: (id: string) => void;
  handleGenerateRecommendations: () => void;
  recsLoading: boolean;
  recsError: string | null;
  aiRecommendations: AiRecommendation[] | null;
  hasLlmKey: boolean;
  handlePopulateSymbols: () => void;
  populateLoading: boolean;
  populateSuccess: string | null;
  populateError: string | null;
  setHoveredCard: (v: string | null) => void;
  hoveredCard: string | null;
  handleMarketScan: (count: number, assetTypes: string[]) => void;
  scanLoading: boolean;
  scanResults: MarketScanResult[] | null;
  scanError: string | null;
};

type TabId = 'indicators' | 'assets' | 'scanner';

export function DashboardContent(props: DashboardContentProps) {
  const {
    data,
    scoreHistory,
    t,
    translateExplain,
    locale,
    runJobsNow,
    runJobsLoading,
    runBackfillNow,
    backfillLoading,
    cronSecretPrompt,
    cronSecretInput,
    setCronSecretInput,
    setCronSecretPrompt,
    setRunJobsError,
    setBackfillError,
    runJobsError,
    backfillError,
    backfillSuccess,
    statusIconColor,
    trendArrow,
    setHoveredSummaryCard,
    setHoveredScoreBar,
    hoveredSummaryCard,
    hoveredScoreBar,
    userAssets,
    handleAddAssetFromSearch,
    addAssetLoading,
    handleRemoveAsset,
    handleGenerateRecommendations,
    recsLoading,
    recsError,
    aiRecommendations,
    hasLlmKey,
    setHoveredCard,
    hoveredCard,
    handleMarketScan,
    scanLoading,
    scanResults,
    scanError,
  } = props;

  const [activeTab, setActiveTab] = useState<TabId>('indicators');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'indicators', label: t('dashboard.tabIndicators') },
    { id: 'assets', label: t('dashboard.tabAssets') },
    { id: 'scanner', label: t('dashboard.tabScanner') },
  ];

  return (
    <div role="main" className="min-h-screen p-8 max-w-6xl mx-auto">
      <NavBar />

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('dashboard.title')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('dashboard.asOf')}: {new Date(data.asOf).toLocaleString()}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('dashboard.refreshHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => runJobsNow()}
            disabled={runJobsLoading}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {runJobsLoading ? t('dashboard.running') : t('dashboard.runJobs')}
          </button>
          <button
            type="button"
            onClick={() => runBackfillNow(cronSecretInput.trim() || undefined)}
            disabled={backfillLoading}
            className="rounded-xl bg-slate-600 dark:bg-slate-500 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:hover:bg-slate-400 disabled:opacity-50 transition-colors shadow-sm"
            title={t('dashboard.backfillHint')}
          >
            {backfillLoading ? t('dashboard.backfilling') : t('dashboard.backfillHistory')}
          </button>
          {runJobsError && <p className="text-sm text-red-600 dark:text-red-400">{runJobsError}</p>}
          {backfillError && <p className="text-sm text-red-600 dark:text-red-400">{backfillError}</p>}
          {backfillSuccess && <p className="text-sm text-green-600 dark:text-green-400">{backfillSuccess}</p>}
        </div>
      </div>

      {cronSecretPrompt && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-3 text-amber-800 dark:text-amber-300">
          <label htmlFor="cron-secret" className="text-sm font-medium">
            {t('dashboard.cronSecretLabel')}
          </label>
          <input
            id="cron-secret"
            type="password"
            value={cronSecretInput}
            onChange={(e) => setCronSecretInput(e.target.value)}
            placeholder={t('dashboard.cronSecretPlaceholder')}
            className="rounded-lg border border-amber-300 dark:border-amber-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-900 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={() => runJobsNow(cronSecretInput)}
            disabled={runJobsLoading || !cronSecretInput.trim()}
            className="rounded-lg bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {t('dashboard.runWithSecret')}
          </button>
          <button
            type="button"
            onClick={() => runBackfillNow(cronSecretInput)}
            disabled={backfillLoading || !cronSecretInput.trim()}
            className="rounded-lg bg-slate-600 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
          >
            {t('dashboard.backfillWithSecret')}
          </button>
          <button
            type="button"
            onClick={() => { setCronSecretPrompt(false); setRunJobsError(null); setBackfillError(null); }}
            className="text-sm underline"
          >
            {t('dashboard.cancel')}
          </button>
        </div>
      )}

      {/* ── Tab bar (pill style) ── */}
      <div className="mb-6">
        <nav className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ── Tab: Indicators & Scores ── */}
      {activeTab === 'indicators' && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Weekly Score */}
            <div
              className="rounded-xl p-5 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow border border-slate-200 dark:border-slate-700 relative"
              onMouseEnter={() => setHoveredSummaryCard('weeklyScore')}
              onMouseLeave={() => setHoveredSummaryCard(null)}
            >
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('dashboard.weeklyScore')}</h2>
              <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{data.score}</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{t('dashboard.deltaWeek')}: {data.deltaWeek >= 0 ? '+' : ''}{data.deltaWeek}</p>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">{t('dashboard.weeklyScoreBreakdown')}</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-500 mb-2">{t('dashboard.weeklyScoreBreakdownHint')}</p>
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
                        <span className="text-slate-600 dark:text-slate-400">({list.length}): {labels.join(', ')}</span>
                      </span>
                    );
                  })}
                  {data.indicators.some((i) => i.status !== 'GREEN' && i.status !== 'YELLOW' && i.status !== 'RED') && (
                    <span className="flex items-center gap-1">
                      <span className="font-medium text-slate-400">{t('dashboard.scoreStatusUnknown')}</span>
                      <span className="text-slate-600 dark:text-slate-400">
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
                <div className="absolute z-20 left-0 right-0 bottom-full mb-1 p-3 text-xs text-left bg-slate-800 dark:bg-slate-700 text-white rounded-xl shadow-lg pointer-events-none max-w-xs">
                  {t('dashboard.weeklyScoreTooltip')}
                </div>
              )}
            </div>

            {/* Score History */}
            <div
              className="rounded-xl p-5 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow border border-slate-200 dark:border-slate-700 relative"
              onMouseEnter={() => setHoveredSummaryCard('scoreHistory')}
              onMouseLeave={() => { setHoveredSummaryCard(null); setHoveredScoreBar(null); }}
            >
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('dashboard.scoreHistory')}</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{t('dashboard.scoreHistoryRange')}</p>
              {hoveredSummaryCard === 'scoreHistory' && (
                <div className="absolute z-20 left-0 right-0 bottom-full mb-1 p-3 text-xs text-left bg-slate-800 dark:bg-slate-700 text-white rounded-xl shadow-lg pointer-events-none max-w-sm">
                  <p className="mb-1">{t('dashboard.scoreHistoryCaption')}</p>
                  <p className="mb-1">{t('dashboard.scoreHistoryWhatItIs')}</p>
                  <p>{t('dashboard.scoreHistoryHowToInterpret')}</p>
                </div>
              )}
              {scoreHistory.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('dashboard.scoreHistoryEmpty')}</p>
              ) : (
                <div className="flex gap-1 h-28 mt-2 items-end">
                  <div className="flex flex-col justify-between text-right text-xs text-slate-500 dark:text-slate-400 pr-1 shrink-0 h-full">
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
                        scoreNum >= 5 ? 'bg-green-500' : scoreNum >= 3 ? 'bg-amber-500' : scoreNum >= 1 ? 'bg-red-400' : 'bg-slate-300 dark:bg-slate-600';
                      return (
                        <div
                          key={s.week_start_date}
                          className="flex-1 flex flex-col justify-end items-center min-w-0 h-full cursor-default"
                          onMouseEnter={() => setHoveredScoreBar(s)}
                          onMouseLeave={() => setHoveredScoreBar(null)}
                          title={`${t('dashboard.scoreHistoryHoverLabel')} ${s.week_start_date} → ${s.score}`}
                        >
                          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-0.5 leading-none" aria-hidden="true">
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

            {/* Scenario */}
            <div className="rounded-xl p-5 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-shadow border border-slate-200 dark:border-slate-700">
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('dashboard.scenario')}</h2>
              <p className="font-medium text-slate-900 dark:text-slate-100">{t('dashboard.bull')}: {t('dashboard.scenarioValue.bull.' + data.scenario.bull)}</p>
              <p className="font-medium text-slate-900 dark:text-slate-100">{t('dashboard.bear')}: {t('dashboard.scenarioValue.bear.' + data.scenario.bear)}</p>
            </div>
          </section>

          {/* Dashboard recommendations */}
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">{t('dashboard.recommendationsTitle')}</h2>
          {(!data.recommendations || data.recommendations.length === 0) ? (
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('dashboard.recommendationsEmpty')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {data.recommendations.map((rec) => {
                const labelKey = 'dashboard.recommendations.' + rec.id;
                const descKey = 'dashboard.recommendations.' + rec.id + '_desc';
                const desc = t(descKey) !== descKey ? t(descKey) : null;
                return (
                  <div key={rec.id} className="rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{t(labelKey)}</p>
                    {desc && <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{desc}</p>}
                    {rec.tickers && rec.tickers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {rec.tickers.map((ticker) => (
                          <span
                            key={ticker}
                            className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300"
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

          {/* Indicators grid */}
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">{t('dashboard.indicators')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.indicators.map((ind) => {
              const tooltipKey = 'dashboard.indicatorTooltip.' + ind.key;
              const tooltipText = t(tooltipKey) !== tooltipKey ? t(tooltipKey) : null;
              return (
                <div
                  key={ind.key}
                  className="rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow relative"
                  onMouseEnter={() => setHoveredCard(ind.key)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{ind.key}</span>
                    <span className={statusIconColor(ind.status)} title={t('status.' + ind.status.toLowerCase())} aria-label={t('status.' + ind.status.toLowerCase())}>
                      <svg className="w-6 h-6 drop-shadow-sm" viewBox="0 0 20 20">
                        <circle cx="10" cy="10" r="8" fill="currentColor" />
                      </svg>
                    </span>
                  </div>
                  {ind.value != null && (
                    <p className="text-lg mt-1 text-slate-900 dark:text-slate-100">
                      {ind.value}
                      {ind.ma21d != null && (
                        <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">
                          ({t('dashboard.ma21d')}: {ind.ma21d})
                        </span>
                      )}
                    </p>
                  )}
                  {ind.referenceText && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {t('dashboard.referenceLabel')}{' '}
                      {locale === 'es'
                        ? ind.referenceText.replace(/\bzone\b/g, 'zona').replace(/\bred\b/g, 'rojo').replace(/\bgreen\b/g, 'verde')
                        : ind.referenceText}
                    </p>
                  )}
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{trendArrow(ind.trend)} {t('trend.' + ind.trend.toLowerCase())}</p>
                  {ind.explain && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{translateExplain(ind.explain)}</p>}
                  {ind.status === 'UNKNOWN' && ind.explain === 'Data stale' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('dashboard.staleHint')}</p>
                  )}
                  {t('dashboard.favorable.' + ind.key) !== 'dashboard.favorable.' + ind.key && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                      <span className="font-medium text-slate-700 dark:text-slate-300">{t('dashboard.favorableLabel')}</span>{' '}
                      {t('dashboard.favorable.' + ind.key)}
                    </p>
                  )}
                  {hoveredCard === ind.key && tooltipText && (
                    <div className="absolute z-20 left-0 right-0 bottom-full mb-1 p-3 text-xs text-left bg-slate-800 dark:bg-slate-700 text-white rounded-xl shadow-lg pointer-events-none">
                      {tooltipText}
                    </div>
                  )}
                  <Link href={`/indicators/${ind.key}`} className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 inline-block hover:underline">
                    {t('dashboard.viewHistory')}
                  </Link>
                </div>
              );
            })}
          </div>
          {data.indicators.length === 0 && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-4 text-amber-800 dark:text-amber-300">
              <p className="font-medium">{t('dashboard.noIndicators')}</p>
              <p className="mt-1 text-sm">{t('dashboard.noIndicatorsHint')}</p>
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t('dashboard.apiKeysHint')}</p>
            </div>
          )}
        </>
      )}

      {/* ── Tab: My Assets & Recommendations ── */}
      {activeTab === 'assets' && (
        <>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">{t('dashboard.myAssets')}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{t('dashboard.myAssetsHint')}</p>
          <div className="mb-4">
            <AssetSearch
              onSelect={handleAddAssetFromSearch}
              loading={addAssetLoading}
              t={t}
              existingAssets={userAssets}
            />
          </div>
          {userAssets.length > 0 && (
            <>
              <ul className="flex flex-wrap gap-2 mb-3">
                {userAssets.map((a) => {
                  const typeKey = a.asset_type === 'stock' ? 'Stock' : a.asset_type === 'etf' ? 'Etf' : a.asset_type === 'commodity' ? 'Commodity' : 'Crypto';
                  const typeColor =
                    a.asset_type === 'stock' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                    a.asset_type === 'etf' ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                    a.asset_type === 'commodity' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                    'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
                  return (
                    <li key={a.id} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${typeColor}`}>
                      <span className="font-medium">{a.symbol}</span>
                      {a.display_name && <span className="text-xs opacity-70 hidden sm:inline">- {a.display_name}</span>}
                      <span className="text-[10px] opacity-60">({t('dashboard.assetType' + typeKey)})</span>
                      <button type="button" onClick={() => handleRemoveAsset(a.id)} className="ml-0.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs font-bold" aria-label={t('dashboard.removeAsset')}>
                        &times;
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={handleGenerateRecommendations}
                disabled={recsLoading}
                className="rounded-xl bg-slate-700 dark:bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-500 disabled:opacity-50 mb-4 transition-colors shadow-sm"
              >
                {recsLoading ? t('common.loading') : t('dashboard.generateRecommendations')}
              </button>
              {!hasLlmKey && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('dashboard.configureLlmHint')}</p>}
            </>
          )}
          {userAssets.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t('dashboard.noAssetsHint')}</p>}

          {recsError && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{recsError}</p>}
          {aiRecommendations && aiRecommendations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {aiRecommendations.map((rec, i) => (
                <div key={rec.symbol + String(i)} className="rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{rec.symbol}</span>
                    <span className={`text-sm font-medium ${/buy|comprar/i.test(rec.action) ? 'text-green-600 dark:text-green-400' : /sell|vender/i.test(rec.action) ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {rec.action}
                    </span>
                  </div>
                  <dl className="text-sm space-y-1 text-slate-700 dark:text-slate-300">
                    {rec.entry_price != null && <><dt className="inline font-medium">{t('dashboard.entryPrice')}:</dt> <dd className="inline">{rec.entry_price}</dd></>}
                    {rec.exit_price != null && <><dt className="inline font-medium ml-2">{t('dashboard.exitPrice')}:</dt> <dd className="inline">{rec.exit_price}</dd></>}
                    {rec.take_profit != null && <><dt className="inline font-medium block">{t('dashboard.takeProfit')}:</dt> <dd className="inline">{rec.take_profit}</dd></>}
                    {rec.stop_loss != null && <><dt className="inline font-medium ml-2">{t('dashboard.stopLoss')}:</dt> <dd className="inline">{rec.stop_loss}</dd></>}
                  </dl>
                  {rec.reasoning && <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">{rec.reasoning}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Tab: Market Scanner ── */}
      {activeTab === 'scanner' && (
        <ScannerSection
          t={t}
          locale={locale}
          handleMarketScan={handleMarketScan}
          scanLoading={scanLoading}
          scanResults={scanResults}
          scanError={scanError}
          hasLlmKey={hasLlmKey}
        />
      )}
    </div>
  );
}

// ── Helpers ──
/** Returns a formatted price string only if the value is a real number, otherwise null. */
function fmtPrice(v: unknown): string | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Market Scanner sub-component with local state for count & asset type filter ──
const ALL_ASSET_TYPES = ['stock', 'etf', 'commodity', 'crypto'] as const;
const SCAN_COUNT_OPTIONS = [3, 5, 10, 15, 20] as const;

function ScannerSection({
  t,
  locale,
  handleMarketScan,
  scanLoading,
  scanResults,
  scanError,
  hasLlmKey,
}: {
  t: (key: string) => string;
  locale: string;
  handleMarketScan: (count: number, assetTypes: string[]) => void;
  scanLoading: boolean;
  scanResults: MarketScanResult[] | null;
  scanError: string | null;
  hasLlmKey: boolean;
}) {
  const [scanCount, setScanCount] = useState<number>(5);
  const [scanAssetTypes, setScanAssetTypes] = useState<string[]>([...ALL_ASSET_TYPES]);

  const toggleAssetType = (type: string) => {
    setScanAssetTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length <= 1) return prev;
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  const typeLabel = (type: string) => {
    const key = type === 'stock' ? 'Stock' : type === 'etf' ? 'Etf' : type === 'commodity' ? 'Commodity' : 'Crypto';
    return t('dashboard.assetType' + key);
  };

  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{t('dashboard.scanResults')}</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">{t('dashboard.scanMarketHint')}</p>

      {/* Controls row */}
      <div className="flex flex-wrap items-end gap-4 mb-4">
        {/* Count selector */}
        <div>
          <label htmlFor="scan-count" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            {t('dashboard.scanCountLabel')}
          </label>
          <select
            id="scan-count"
            value={scanCount}
            onChange={(e) => setScanCount(Number(e.target.value))}
            disabled={scanLoading}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
          >
            {SCAN_COUNT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        {/* Asset type filter */}
        <div>
          <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            {t('dashboard.scanAssetTypeFilter')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ALL_ASSET_TYPES.map((type) => {
              const active = scanAssetTypes.includes(type);
              const colorActive =
                type === 'stock'
                  ? 'bg-blue-600 text-white'
                  : type === 'etf'
                    ? 'bg-green-600 text-white'
                    : type === 'commodity'
                      ? 'bg-amber-600 text-white'
                      : 'bg-purple-600 text-white';
              const colorInactive = 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600';
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleAssetType(type)}
                  disabled={scanLoading}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${active ? colorActive : colorInactive}`}
                >
                  {typeLabel(type)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scan button */}
        <button
          type="button"
          onClick={() => handleMarketScan(scanCount, scanAssetTypes)}
          disabled={scanLoading}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          {scanLoading ? t('common.loading') : t('dashboard.scanMarket')}
        </button>
      </div>

      {!hasLlmKey && <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('dashboard.configureLlmHint')}</p>}
      {scanError && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{scanError}</p>}
      {scanResults && scanResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scanResults.map((item, i) => {
            const typeKey = item.asset_type === 'stock' ? 'Stock' : item.asset_type === 'etf' ? 'Etf' : item.asset_type === 'commodity' ? 'Commodity' : 'Crypto';
            const typeBadge =
              item.asset_type === 'stock'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                : item.asset_type === 'etf'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                  : item.asset_type === 'commodity'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                    : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300';
            const borderAccent =
              item.asset_type === 'stock'
                ? 'border-l-blue-500'
                : item.asset_type === 'etf'
                  ? 'border-l-green-500'
                  : item.asset_type === 'commodity'
                    ? 'border-l-amber-500'
                    : 'border-l-purple-500';
            return (
              <div key={item.symbol + String(i)} className={`rounded-xl p-4 bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 border-l-4 ${borderAccent} hover:shadow-md transition-shadow`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-lg text-slate-900 dark:text-slate-100">{item.symbol}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge}`}>
                    {t('dashboard.assetType' + typeKey)}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 truncate">{item.name}</p>
                {fmtPrice(item.current_price) && (
                  <p className="text-sm mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{t('dashboard.currentPrice')}:</span>{' '}
                    <span className="text-slate-900 dark:text-slate-100">${fmtPrice(item.current_price)}</span>
                  </p>
                )}
                <dl className="text-sm space-y-0.5">
                  {fmtPrice(item.entry_price) && (
                    <div className="text-slate-700 dark:text-slate-300">
                      <dt className="inline font-medium">{t('dashboard.entryPrice')}:</dt>{' '}
                      <dd className="inline">${fmtPrice(item.entry_price)}</dd>
                    </div>
                  )}
                  {fmtPrice(item.take_profit) && (
                    <div>
                      <dt className="inline font-medium text-green-700 dark:text-green-400">{t('dashboard.takeProfit')}:</dt>{' '}
                      <dd className="inline text-green-700 dark:text-green-400">${fmtPrice(item.take_profit)}</dd>
                    </div>
                  )}
                  {fmtPrice(item.stop_loss) && (
                    <div>
                      <dt className="inline font-medium text-red-700 dark:text-red-400">{t('dashboard.stopLoss')}:</dt>{' '}
                      <dd className="inline text-red-700 dark:text-red-400">${fmtPrice(item.stop_loss)}</dd>
                    </div>
                  )}
                </dl>
                {(() => {
                  const reason = (locale === 'es' ? item.reasoning_es : item.reasoning_en) || item.reasoning_en || item.reasoning_es || item.reasoning;
                  return reason ? <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-700 pt-2">{reason}</p> : null;
                })()}
              </div>
            );
          })}
        </div>
      )}
      {scanResults && scanResults.length === 0 && !scanError && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('dashboard.scanEmpty')}</p>
      )}
    </div>
  );
}
