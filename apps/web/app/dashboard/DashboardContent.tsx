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
  handleStopScan: () => void;
  scanLoading: boolean;
  scanResults: MarketScanResult[] | null;
  scanError: string | null;
  scanTotal: number;
};

type TabId = 'indicators' | 'assets' | 'scanner';

/* ── SVG icons for action buttons ── */
function RefreshIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
function HistoryIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

/* ── Asset type color helpers ── */
const TYPE_ICON_BG: Record<string, string> = {
  stock: 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400',
  etf: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  commodity: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  crypto: 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400',
};
const TYPE_BADGE: Record<string, string> = {
  stock: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  etf: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  commodity: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  crypto: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};
const TYPE_BORDER_L: Record<string, string> = {
  stock: 'border-l-blue-500',
  etf: 'border-l-emerald-500',
  commodity: 'border-l-amber-500',
  crypto: 'border-l-purple-500',
};

function typeKey(assetType: string) {
  return assetType === 'stock' ? 'Stock' : assetType === 'etf' ? 'Etf' : assetType === 'commodity' ? 'Commodity' : 'Crypto';
}

export function DashboardContent(props: DashboardContentProps) {
  const {
    data, scoreHistory, t, translateExplain, locale,
    runJobsNow, runJobsLoading, runBackfillNow, backfillLoading,
    cronSecretPrompt, cronSecretInput, setCronSecretInput, setCronSecretPrompt,
    setRunJobsError, setBackfillError, runJobsError, backfillError, backfillSuccess,
    statusIconColor, trendArrow,
    setHoveredSummaryCard, setHoveredScoreBar, hoveredSummaryCard, hoveredScoreBar,
    userAssets, handleAddAssetFromSearch, addAssetLoading, handleRemoveAsset,
    handleGenerateRecommendations, recsLoading, recsError, aiRecommendations,
    hasLlmKey, setHoveredCard, hoveredCard,
    handleMarketScan, handleStopScan, scanLoading, scanResults, scanError, scanTotal,
  } = props;

  const [activeTab, setActiveTab] = useState<TabId>('indicators');

  const tabs: { id: TabId; label: string }[] = [
    { id: 'indicators', label: t('dashboard.tabIndicators') },
    { id: 'assets', label: t('dashboard.tabAssets') },
    { id: 'scanner', label: t('dashboard.tabScanner') },
  ];

  return (
    <div role="main" className="min-h-screen pt-16 px-4 sm:px-6 lg:px-8 pb-24 md:pb-8 max-w-6xl mx-auto">
      <NavBar />

      {/* ═══════════ HERO SECTION (Coinbase "Total balance" style) ═══════════ */}
      <section className="cb-card p-6 mb-6">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('dashboard.weeklyScore')}</p>
        <div className="flex items-baseline gap-3 mb-1">
          <span className="text-5xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {data.score}<span className="text-2xl text-slate-400 dark:text-slate-500">/8</span>
          </span>
          <span className={`inline-flex items-center gap-1 text-sm font-semibold px-2.5 py-0.5 rounded-full ${
            data.deltaWeek > 0
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
              : data.deltaWeek < 0
                ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
          }`}>
            {data.deltaWeek > 0 ? '↑' : data.deltaWeek < 0 ? '↓' : '→'} {data.deltaWeek >= 0 ? '+' : ''}{data.deltaWeek}
          </span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          {t('dashboard.asOf')}: {new Date(data.asOf).toLocaleString()}
        </p>
        <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 dark:text-slate-400">
          <span>{t('dashboard.bull')}: <span className="font-medium text-slate-700 dark:text-slate-300">{t('dashboard.scenarioValue.bull.' + data.scenario.bull)}</span></span>
          <span>{t('dashboard.bear')}: <span className="font-medium text-slate-700 dark:text-slate-300">{t('dashboard.scenarioValue.bear.' + data.scenario.bear)}</span></span>
        </div>

        {/* ── Action buttons row (Coinbase circular buttons) ── */}
        <div className="flex items-start gap-6 mt-6 pt-5 border-t border-slate-100 dark:border-slate-700">
          <button type="button" onClick={() => runJobsNow()} disabled={runJobsLoading} className="cb-action-btn group">
            <span className="cb-action-circle bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/60 group-disabled:opacity-50">
              <RefreshIcon />
            </span>
            <span className="cb-action-label">{runJobsLoading ? '...' : t('dashboard.runJobs')}</span>
          </button>

          <button type="button" onClick={() => runBackfillNow(cronSecretInput.trim() || undefined)} disabled={backfillLoading} className="cb-action-btn group" title={t('dashboard.backfillHint')}>
            <span className="cb-action-circle bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-600 group-disabled:opacity-50">
              <HistoryIcon />
            </span>
            <span className="cb-action-label">{backfillLoading ? '...' : t('dashboard.backfillHistory')}</span>
          </button>

          <button type="button" onClick={() => setActiveTab('scanner')} className="cb-action-btn group">
            <span className="cb-action-circle bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/60">
              <SearchIcon />
            </span>
            <span className="cb-action-label">{t('dashboard.scanMarket')}</span>
          </button>

          <button type="button" onClick={() => setActiveTab('assets')} className="cb-action-btn group">
            <span className="cb-action-circle bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400 group-hover:bg-purple-200 dark:group-hover:bg-purple-900/60">
              <SparkleIcon />
            </span>
            <span className="cb-action-label">{t('dashboard.tabAssets')}</span>
          </button>
        </div>

        {/* Status messages */}
        {runJobsError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{runJobsError}</p>}
        {backfillError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{backfillError}</p>}
        {backfillSuccess && <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-3">{backfillSuccess}</p>}
      </section>

      {/* Cron secret prompt */}
      {cronSecretPrompt && (
        <div className="mb-6 flex flex-wrap items-center gap-2 cb-card p-4 border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
          <label htmlFor="cron-secret" className="text-sm font-medium">{t('dashboard.cronSecretLabel')}</label>
          <input id="cron-secret" type="password" value={cronSecretInput} onChange={(e) => setCronSecretInput(e.target.value)} placeholder={t('dashboard.cronSecretPlaceholder')} className="rounded-lg border border-amber-300 dark:border-amber-600 bg-white dark:bg-slate-800 px-2 py-1 text-sm text-slate-900 dark:text-slate-100" />
          <button type="button" onClick={() => runJobsNow(cronSecretInput)} disabled={runJobsLoading || !cronSecretInput.trim()} className="rounded-lg bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700 disabled:opacity-50">{t('dashboard.runWithSecret')}</button>
          <button type="button" onClick={() => runBackfillNow(cronSecretInput)} disabled={backfillLoading || !cronSecretInput.trim()} className="rounded-lg bg-slate-600 px-3 py-1 text-sm text-white hover:bg-slate-700 disabled:opacity-50">{t('dashboard.backfillWithSecret')}</button>
          <button type="button" onClick={() => { setCronSecretPrompt(false); setRunJobsError(null); setBackfillError(null); }} className="text-sm underline">{t('dashboard.cancel')}</button>
        </div>
      )}

      {/* ═══════════ TAB BAR ═══════════ */}
      <div className="mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <nav className="inline-flex rounded-2xl bg-slate-100 dark:bg-slate-800 p-1 gap-1 min-w-max" aria-label="Tabs">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-2 text-sm font-medium rounded-xl transition-colors whitespace-nowrap ${
                  active
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

      {/* ═══════════ TAB: INDICATORS & SCORES ═══════════ */}
      {activeTab === 'indicators' && (
        <>
          {/* Score history card */}
          <section className="cb-card p-5 mb-6" onMouseEnter={() => setHoveredSummaryCard('scoreHistory')} onMouseLeave={() => { setHoveredSummaryCard(null); setHoveredScoreBar(null); }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t('dashboard.scoreHistory')}</h2>
              <span className="text-xs text-slate-400 dark:text-slate-500">{t('dashboard.scoreHistoryRange')}</span>
            </div>
            {scoreHistory.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('dashboard.scoreHistoryEmpty')}</p>
            ) : (
              <div className="flex gap-1 h-32 items-end">
                <div className="flex flex-col justify-between text-right text-xs text-slate-400 dark:text-slate-500 pr-1 shrink-0 h-full">
                  <span>8</span><span>4</span><span>0</span>
                </div>
                <div className="flex-1 flex gap-0.5 min-w-0 h-full">
                  {scoreHistory.slice(-12).map((s) => {
                    const num = Number(s.score);
                    const pct = Math.max(10, Math.min(100, (num / 8) * 100));
                    const color = num >= 5 ? 'bg-emerald-500' : num >= 3 ? 'bg-amber-500' : num >= 1 ? 'bg-red-400' : 'bg-slate-300 dark:bg-slate-600';
                    return (
                      <div key={s.week_start_date} className="flex-1 flex flex-col justify-end items-center min-w-0 h-full cursor-default" onMouseEnter={() => setHoveredScoreBar(s)} onMouseLeave={() => setHoveredScoreBar(null)} title={`${t('dashboard.scoreHistoryHoverLabel')} ${s.week_start_date} → ${s.score}`}>
                        <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5 leading-none">{s.score}</span>
                        <div className={`w-full ${color} rounded-t-md min-h-[2px]`} style={{ height: `${pct}%` }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Score breakdown card */}
          <section className="cb-card p-5 mb-6 relative" onMouseEnter={() => setHoveredSummaryCard('weeklyScore')} onMouseLeave={() => setHoveredSummaryCard(null)}>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">{t('dashboard.weeklyScoreBreakdown')}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-500 mb-3">{t('dashboard.weeklyScoreBreakdownHint')}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
              {(['GREEN', 'YELLOW', 'RED'] as const).map((status) => {
                const list = data.indicators.filter((i) => i.status === status);
                if (list.length === 0) return null;
                const statusKey = status === 'GREEN' ? 'scoreStatusGreen' : status === 'YELLOW' ? 'scoreStatusYellow' : 'scoreStatusRed';
                const labels = list.map((i) => { const k = 'dashboard.indicatorShortLabel.' + i.key; const l = t(k); return l !== k ? l : i.key; });
                return (
                  <span key={status} className="flex items-center gap-1">
                    <span className={`font-semibold ${statusIconColor(status)}`}>{t('dashboard.' + statusKey)}</span>
                    <span className="text-slate-600 dark:text-slate-400">({list.length}): {labels.join(', ')}</span>
                  </span>
                );
              })}
            </div>
          </section>

          {/* Dashboard recommendations */}
          {data.recommendations && data.recommendations.length > 0 && (
            <section className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('dashboard.recommendationsTitle')}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.recommendations.map((rec) => {
                  const labelKey = 'dashboard.recommendations.' + rec.id;
                  const descKey = labelKey + '_desc';
                  const desc = t(descKey) !== descKey ? t(descKey) : null;
                  return (
                    <div key={rec.id} className="cb-card-hover p-4">
                      <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{t(labelKey)}</p>
                      {desc && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{desc}</p>}
                      {rec.tickers && rec.tickers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {rec.tickers.map((ticker) => (
                            <span key={ticker} className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-medium text-slate-700 dark:text-slate-300">{ticker}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Indicators grid */}
          <section>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('dashboard.indicators')}</h2>
            {data.indicators.length === 0 ? (
              <div className="cb-card p-5 border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300">
                <p className="font-medium">{t('dashboard.noIndicators')}</p>
                <p className="mt-1 text-sm">{t('dashboard.noIndicatorsHint')}</p>
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{t('dashboard.apiKeysHint')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.indicators.map((ind) => {
                  const tooltipKey = 'dashboard.indicatorTooltip.' + ind.key;
                  const tooltipText = t(tooltipKey) !== tooltipKey ? t(tooltipKey) : null;
                  return (
                    <div key={ind.key} className="cb-card-hover p-4 relative" onMouseEnter={() => setHoveredCard(ind.key)} onMouseLeave={() => setHoveredCard(null)}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{ind.key}</span>
                          {ind.value != null && (
                            <p className="text-lg text-slate-900 dark:text-slate-100 mt-0.5">
                              {ind.value}
                              {ind.ma21d != null && <span className="ml-2 text-sm font-normal text-slate-500 dark:text-slate-400">({t('dashboard.ma21d')}: {ind.ma21d})</span>}
                            </p>
                          )}
                        </div>
                        <span className={statusIconColor(ind.status)} title={t('status.' + ind.status.toLowerCase())}>
                          <svg className="w-5 h-5 drop-shadow-sm" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" fill="currentColor" /></svg>
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">{trendArrow(ind.trend)} {t('trend.' + ind.trend.toLowerCase())}</p>
                      {ind.explain && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{translateExplain(ind.explain)}</p>}
                      {ind.referenceText && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t('dashboard.referenceLabel')} {locale === 'es' ? ind.referenceText.replace(/\bzone\b/g, 'zona').replace(/\bred\b/g, 'rojo').replace(/\bgreen\b/g, 'verde') : ind.referenceText}</p>}
                      {t('dashboard.favorable.' + ind.key) !== 'dashboard.favorable.' + ind.key && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                          <span className="font-medium text-slate-700 dark:text-slate-300">{t('dashboard.favorableLabel')}</span> {t('dashboard.favorable.' + ind.key)}
                        </p>
                      )}
                      {ind.status === 'UNKNOWN' && ind.explain === 'Data stale' && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{t('dashboard.staleHint')}</p>}
                      {hoveredCard === ind.key && tooltipText && (
                        <div className="absolute z-20 left-0 right-0 bottom-full mb-1 p-3 text-xs text-left bg-slate-800 dark:bg-slate-700 text-white rounded-xl shadow-lg pointer-events-none">{tooltipText}</div>
                      )}
                      <Link href={`/indicators/${ind.key}`} className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 inline-block hover:underline">{t('dashboard.viewHistory')}</Link>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* ═══════════ TAB: MY ASSETS (Coinbase "Balances" style) ═══════════ */}
      {activeTab === 'assets' && (
        <>
          {/* Search */}
          <section className="mb-6">
            <AssetSearch onSelect={handleAddAssetFromSearch} loading={addAssetLoading} t={t} existingAssets={userAssets} />
          </section>

          {/* Action row */}
          {userAssets.length > 0 && (
            <div className="flex items-start gap-6 mb-6">
              <button type="button" onClick={handleGenerateRecommendations} disabled={recsLoading} className="cb-action-btn group">
                <span className="cb-action-circle bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/60 group-disabled:opacity-50">
                  <SparkleIcon />
                </span>
                <span className="cb-action-label">{recsLoading ? '...' : t('dashboard.generateRecommendations')}</span>
              </button>
              <button type="button" onClick={() => setActiveTab('scanner')} className="cb-action-btn group">
                <span className="cb-action-circle bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-900/60">
                  <SearchIcon />
                </span>
                <span className="cb-action-label">{t('dashboard.scanMarket')}</span>
              </button>
            </div>
          )}

          {!hasLlmKey && <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{t('dashboard.configureLlmHint')}</p>}

          {/* Asset list (Coinbase card style) */}
          {userAssets.length > 0 ? (
            <section className="mb-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('dashboard.myAssets')}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {userAssets.map((a) => {
                  const tKey = typeKey(a.asset_type);
                  const iconBg = TYPE_ICON_BG[a.asset_type] || TYPE_ICON_BG.stock;
                  return (
                    <div key={a.id} className="cb-card-hover p-4 flex items-center gap-3">
                      {/* Type icon circle */}
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${iconBg}`}>
                        {a.symbol.charAt(0)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{a.symbol}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{a.display_name || t('dashboard.assetType' + tKey)}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${TYPE_BADGE[a.asset_type] || ''}`}>
                        {t('dashboard.assetType' + tKey)}
                      </span>
                      <button type="button" onClick={() => handleRemoveAsset(a.id)} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0" aria-label={t('dashboard.removeAsset')}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <div className="cb-card p-8 text-center mb-6">
              <p className="text-slate-500 dark:text-slate-400 text-sm">{t('dashboard.noAssetsHint')}</p>
            </div>
          )}

          {/* AI Recommendations */}
          {recsError && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{recsError}</p>}
          {aiRecommendations && aiRecommendations.length > 0 && (
            <section>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">{t('dashboard.recommendationsTitle')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {aiRecommendations.map((rec, i) => (
                  <div key={rec.symbol + String(i)} className="cb-card-hover p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{rec.symbol}</span>
                      <span className={`text-sm font-semibold px-2.5 py-0.5 rounded-full ${/buy|comprar/i.test(rec.action) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : /sell|vender/i.test(rec.action) ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                        {rec.action}
                      </span>
                    </div>
                    <dl className="text-sm space-y-0.5 text-slate-700 dark:text-slate-300">
                      {rec.entry_price != null && <div><dt className="inline font-medium">{t('dashboard.entryPrice')}:</dt> <dd className="inline">{rec.entry_price}</dd></div>}
                      {rec.exit_price != null && <div><dt className="inline font-medium">{t('dashboard.exitPrice')}:</dt> <dd className="inline">{rec.exit_price}</dd></div>}
                      {rec.take_profit != null && <div><dt className="inline font-medium text-emerald-700 dark:text-emerald-400">{t('dashboard.takeProfit')}:</dt> <dd className="inline text-emerald-700 dark:text-emerald-400">{rec.take_profit}</dd></div>}
                      {rec.stop_loss != null && <div><dt className="inline font-medium text-red-700 dark:text-red-400">{t('dashboard.stopLoss')}:</dt> <dd className="inline text-red-700 dark:text-red-400">{rec.stop_loss}</dd></div>}
                    </dl>
                    {rec.reasoning && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-700">{rec.reasoning}</p>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ═══════════ TAB: MARKET SCANNER ═══════════ */}
      {activeTab === 'scanner' && (
        <ScannerSection
          t={t} locale={locale}
          handleMarketScan={handleMarketScan} handleStopScan={handleStopScan}
          scanLoading={scanLoading} scanResults={scanResults} scanError={scanError} scanTotal={scanTotal}
          hasLlmKey={hasLlmKey}
        />
      )}
    </div>
  );
}

/* ── Helpers ── */
function fmtPrice(v: unknown): string | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Market Scanner sub-component ── */
const ALL_ASSET_TYPES = ['stock', 'etf', 'commodity', 'crypto'] as const;
const SCAN_COUNT_OPTIONS = [3, 5, 10, 15, 20] as const;

function ScannerSection({ t, locale, handleMarketScan, handleStopScan, scanLoading, scanResults, scanError, scanTotal, hasLlmKey }: {
  t: (key: string) => string; locale: string;
  handleMarketScan: (count: number, assetTypes: string[]) => void; handleStopScan: () => void;
  scanLoading: boolean; scanResults: MarketScanResult[] | null; scanError: string | null; scanTotal: number; hasLlmKey: boolean;
}) {
  const [scanCount, setScanCount] = useState<number>(5);
  const [scanAssetTypes, setScanAssetTypes] = useState<string[]>([...ALL_ASSET_TYPES]);

  const toggleAssetType = (type: string) => {
    setScanAssetTypes((prev) => {
      if (prev.includes(type)) { if (prev.length <= 1) return prev; return prev.filter((x) => x !== type); }
      return [...prev, type];
    });
  };

  const typeLabel = (type: string) => t('dashboard.assetType' + typeKey(type));

  return (
    <>
      {/* Controls card */}
      <section className="cb-card p-5 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">{t('dashboard.scanResults')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t('dashboard.scanMarketHint')}</p>

        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label htmlFor="scan-count" className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('dashboard.scanCountLabel')}</label>
            <select id="scan-count" value={scanCount} onChange={(e) => setScanCount(Number(e.target.value))} disabled={scanLoading}
              className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50">
              {SCAN_COUNT_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{t('dashboard.scanAssetTypeFilter')}</span>
            <div className="flex flex-wrap gap-1.5">
              {ALL_ASSET_TYPES.map((type) => {
                const active = scanAssetTypes.includes(type);
                const cActive = type === 'stock' ? 'bg-blue-600 text-white' : type === 'etf' ? 'bg-emerald-600 text-white' : type === 'commodity' ? 'bg-amber-600 text-white' : 'bg-purple-600 text-white';
                const cInactive = 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600';
                return (
                  <button key={type} type="button" onClick={() => toggleAssetType(type)} disabled={scanLoading}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${active ? cActive : cInactive}`}>
                    {typeLabel(type)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={() => handleMarketScan(scanCount, scanAssetTypes)} disabled={scanLoading}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
              {scanLoading ? t('common.loading') : t('dashboard.scanMarket')}
            </button>
            {scanLoading && (
              <button type="button" onClick={handleStopScan} className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-colors shadow-sm">{t('dashboard.scanStop')}</button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {scanLoading && scanResults && scanTotal > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1">
              <span>{t('dashboard.scanProgress').replace('{loaded}', String(scanResults.length)).replace('{total}', String(scanTotal))}</span>
              <span>{Math.round((scanResults.length / scanTotal) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${Math.round((scanResults.length / scanTotal) * 100)}%` }} />
            </div>
          </div>
        )}

        {!hasLlmKey && <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('dashboard.configureLlmHint')}</p>}
        {scanError && <p className="text-sm text-red-600 dark:text-red-400 mt-3">{scanError}</p>}
      </section>

      {/* Results grid */}
      {scanResults && scanResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          {scanResults.map((item, i) => {
            const tKey = typeKey(item.asset_type);
            const badge = TYPE_BADGE[item.asset_type] || '';
            const borderL = TYPE_BORDER_L[item.asset_type] || '';
            return (
              <div key={item.symbol + String(i)} className={`cb-card-hover p-4 border-l-4 ${borderL}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-lg text-slate-900 dark:text-slate-100">{item.symbol}</span>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge}`}>{t('dashboard.assetType' + tKey)}</span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 truncate">{item.name}</p>
                {fmtPrice(item.current_price) && (
                  <p className="text-sm mb-1"><span className="font-medium text-slate-700 dark:text-slate-300">{t('dashboard.currentPrice')}:</span> <span className="text-slate-900 dark:text-slate-100">${fmtPrice(item.current_price)}</span></p>
                )}
                <dl className="text-sm space-y-0.5">
                  {fmtPrice(item.entry_price) && <div className="text-slate-700 dark:text-slate-300"><dt className="inline font-medium">{t('dashboard.entryPrice')}:</dt> <dd className="inline">${fmtPrice(item.entry_price)}</dd></div>}
                  {fmtPrice(item.take_profit) && <div><dt className="inline font-medium text-emerald-700 dark:text-emerald-400">{t('dashboard.takeProfit')}:</dt> <dd className="inline text-emerald-700 dark:text-emerald-400">${fmtPrice(item.take_profit)}</dd></div>}
                  {fmtPrice(item.stop_loss) && <div><dt className="inline font-medium text-red-700 dark:text-red-400">{t('dashboard.stopLoss')}:</dt> <dd className="inline text-red-700 dark:text-red-400">${fmtPrice(item.stop_loss)}</dd></div>}
                </dl>
                {(() => {
                  const reason = (locale === 'es' ? item.reasoning_es : item.reasoning_en) || item.reasoning_en || item.reasoning_es || item.reasoning;
                  return reason ? <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-700 pt-2">{reason}</p> : null;
                })()}
              </div>
            );
          })}
        </div>
      )}
      {scanResults && scanResults.length === 0 && !scanError && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('dashboard.scanEmpty')}</p>
      )}
    </>
  );
}
