'use client';

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
  handleMarketScan: () => void;
  scanLoading: boolean;
  scanResults: MarketScanResult[] | null;
  scanError: string | null;
};

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
    handlePopulateSymbols,
    populateLoading,
    populateSuccess,
    populateError,
    setHoveredCard,
    hoveredCard,
    handleMarketScan,
    scanLoading,
    scanResults,
    scanError,
  } = props;

  return (
    <div role="main" className="min-h-screen p-8 max-w-6xl mx-auto">
      <NavBar />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('dashboard.asOf')}: {new Date(data.asOf).toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-0.5">{t('dashboard.refreshHint')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => runJobsNow()}
            disabled={runJobsLoading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {runJobsLoading ? t('dashboard.running') : t('dashboard.runJobs')}
          </button>
          <button
            type="button"
            onClick={() => runBackfillNow(cronSecretInput.trim() || undefined)}
            disabled={backfillLoading}
            className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            title={t('dashboard.backfillHint')}
          >
            {backfillLoading ? t('dashboard.backfilling') : t('dashboard.backfillHistory')}
          </button>
          {runJobsError && <p className="text-sm text-red-600">{runJobsError}</p>}
          {backfillError && <p className="text-sm text-red-600">{backfillError}</p>}
          {backfillSuccess && <p className="text-sm text-green-600">{backfillSuccess}</p>}
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
            onClick={() => runBackfillNow(cronSecretInput)}
            disabled={backfillLoading || !cronSecretInput.trim()}
            className="rounded bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
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

      <h2 className="text-xl font-semibold mb-4">{t('dashboard.myAssets')}</h2>
      <p className="text-sm text-gray-600 mb-3">{t('dashboard.myAssetsHint')}</p>
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
              const typeColor = a.asset_type === 'stock' ? 'bg-blue-50 text-blue-700' : a.asset_type === 'etf' ? 'bg-green-50 text-green-700' : a.asset_type === 'commodity' ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700';
              return (
                <li key={a.id} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm ${typeColor}`}>
                  <span className="font-medium">{a.symbol}</span>
                  {a.display_name && <span className="text-xs opacity-70 hidden sm:inline">- {a.display_name}</span>}
                  <span className="text-[10px] opacity-60">({t('dashboard.assetType' + typeKey)})</span>
                  <button type="button" onClick={() => handleRemoveAsset(a.id)} className="ml-0.5 text-red-500 hover:text-red-700 text-xs font-bold" aria-label={t('dashboard.removeAsset')}>
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
            className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 mb-4"
          >
            {recsLoading ? t('common.loading') : t('dashboard.generateRecommendations')}
          </button>
          {!hasLlmKey && <p className="text-xs text-gray-500 mb-2">{t('dashboard.configureLlmHint')}</p>}
        </>
      )}
      {userAssets.length === 0 && <p className="text-sm text-gray-500 mb-6">{t('dashboard.noAssetsHint')}</p>}
      {/* Populate symbols button hidden – symbols already loaded */}
      {/* ── Market Scanner ── */}
      <div className="mt-6 mb-8">
        <h2 className="text-xl font-semibold mb-2">{t('dashboard.scanResults')}</h2>
        <p className="text-sm text-gray-600 mb-3">{t('dashboard.scanMarketHint')}</p>
        <button
          type="button"
          onClick={handleMarketScan}
          disabled={scanLoading}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 mb-4"
        >
          {scanLoading ? t('common.loading') : t('dashboard.scanMarket')}
        </button>
        {!hasLlmKey && <p className="text-xs text-gray-500 mb-2">{t('dashboard.configureLlmHint')}</p>}
        {scanError && <p className="text-sm text-red-600 mb-4">{scanError}</p>}
        {scanResults && scanResults.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scanResults.map((item, i) => {
              const typeKey = item.asset_type === 'stock' ? 'Stock' : item.asset_type === 'etf' ? 'Etf' : item.asset_type === 'commodity' ? 'Commodity' : 'Crypto';
              const typeBadge =
                item.asset_type === 'stock'
                  ? 'bg-blue-100 text-blue-700'
                  : item.asset_type === 'etf'
                    ? 'bg-green-100 text-green-700'
                    : item.asset_type === 'commodity'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-purple-100 text-purple-700';
              return (
                <div key={item.symbol + String(i)} className="border rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-lg">{item.symbol}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeBadge}`}>
                      {t('dashboard.assetType' + typeKey)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-2 truncate">{item.name}</p>
                  {item.current_price != null && (
                    <p className="text-sm mb-1">
                      <span className="font-medium text-gray-700">{t('dashboard.currentPrice')}:</span>{' '}
                      <span className="text-gray-900">${typeof item.current_price === 'number' ? item.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : item.current_price}</span>
                    </p>
                  )}
                  <dl className="text-sm space-y-0.5">
                    {item.entry_price != null && (
                      <div>
                        <dt className="inline font-medium text-gray-700">{t('dashboard.entryPrice')}:</dt>{' '}
                        <dd className="inline">${item.entry_price}</dd>
                      </div>
                    )}
                    {item.take_profit != null && (
                      <div>
                        <dt className="inline font-medium text-green-700">{t('dashboard.takeProfit')}:</dt>{' '}
                        <dd className="inline text-green-700">${item.take_profit}</dd>
                      </div>
                    )}
                    {item.stop_loss != null && (
                      <div>
                        <dt className="inline font-medium text-red-700">{t('dashboard.stopLoss')}:</dt>{' '}
                        <dd className="inline text-red-700">${item.stop_loss}</dd>
                      </div>
                    )}
                  </dl>
                  {item.reasoning && <p className="text-xs text-gray-600 mt-2 border-t border-gray-100 pt-2">{item.reasoning}</p>}
                </div>
              );
            })}
          </div>
        )}
        {scanResults && scanResults.length === 0 && !scanError && (
          <p className="text-sm text-gray-500">{t('dashboard.scanEmpty')}</p>
        )}
      </div>

      {recsError && <p className="text-sm text-red-600 mb-4">{recsError}</p>}
      {aiRecommendations && aiRecommendations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {aiRecommendations.map((rec, i) => (
            <div key={rec.symbol + String(i)} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">{rec.symbol}</span>
                <span className={`text-sm font-medium ${/buy|comprar/i.test(rec.action) ? 'text-green-600' : /sell|vender/i.test(rec.action) ? 'text-red-600' : 'text-gray-600'}`}>
                  {rec.action}
                </span>
              </div>
              <dl className="text-sm space-y-1">
                {rec.entry_price != null && <><dt className="inline font-medium">{t('dashboard.entryPrice')}:</dt> <dd className="inline">{rec.entry_price}</dd></>}
                {rec.exit_price != null && <><dt className="inline font-medium ml-2">{t('dashboard.exitPrice')}:</dt> <dd className="inline">{rec.exit_price}</dd></>}
                {rec.take_profit != null && <><dt className="inline font-medium block">{t('dashboard.takeProfit')}:</dt> <dd className="inline">{rec.take_profit}</dd></>}
                {rec.stop_loss != null && <><dt className="inline font-medium ml-2">{t('dashboard.stopLoss')}:</dt> <dd className="inline">{rec.stop_loss}</dd></>}
              </dl>
              {rec.reasoning && <p className="text-xs text-gray-600 mt-2">{rec.reasoning}</p>}
            </div>
          ))}
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
    </div>
  );
}
