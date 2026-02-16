'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from '@/app/context/LocaleContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import { fetchDashboard, fetchScoreHistory, triggerBackfillHistory, triggerPopulateSymbols, fetchRecommendations, fetchMarketScan, getLlmSettings, getEtoroSettings, placeEtoroOrder, runJobStep, runJobFinalize, getIndicatorKeys, type AiRecommendation, type MarketScanResult } from '@/lib/api';
import { DashboardContent } from './DashboardContent';
import { DashboardErrorView } from './DashboardErrorView';

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
  const [runJobsProgress, setRunJobsProgress] = useState<{ current: number; total: number; currentKey: string } | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [backfillSuccess, setBackfillSuccess] = useState<string | null>(null);
  const [cronSecretPrompt, setCronSecretPrompt] = useState(false);
  const [cronSecretInput, setCronSecretInput] = useState('');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredSummaryCard, setHoveredSummaryCard] = useState<'weeklyScore' | 'scoreHistory' | null>(null);
  const [hoveredScoreBar, setHoveredScoreBar] = useState<{ week_start_date: string; score: number } | null>(null);
  const [userAssets, setUserAssets] = useState<{ id: string; symbol: string; asset_type: string; display_name?: string | null }[]>([]);
  const [addAssetLoading, setAddAssetLoading] = useState(false);
  const [recsLoading, setRecsLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<AiRecommendation[] | null>(null);
  const [recsError, setRecsError] = useState<string | null>(null);
  const [hasLlmKey, setHasLlmKey] = useState(false);
  const [hasEtoroConfigured, setHasEtoroConfigured] = useState(false);
  const [populateLoading, setPopulateLoading] = useState(false);
  const [populateSuccess, setPopulateSuccess] = useState<string | null>(null);
  const [populateError, setPopulateError] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanResults, setScanResults] = useState<MarketScanResult[] | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanTotal, setScanTotal] = useState(0);
  const scanCancelledRef = useRef(false);

  const statusIconColor = useCallback((s: string): string =>
    s === 'GREEN' ? 'text-emerald-500 dark:text-emerald-400' : s === 'RED' ? 'text-red-500 dark:text-red-400' : s === 'YELLOW' ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500', []);
  const trendArrow = useCallback((trend: string): string =>
    trend === 'RISING' ? '↑' : trend === 'FALLING' ? '↓' : '→', []);

  const loadUserAssets = useCallback(() => {
    const client = getSupabaseBrowser();
    if (!client) return;
    client.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return;
      client
        .from('user_assets')
        .select('id, symbol, asset_type, display_name')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })
        .then(({ data }) => setUserAssets(Array.isArray(data) ? data : []));
    });
  }, []);

  useEffect(() => {
    loadUserAssets();
  }, [loadUserAssets]);

  // Check if user has an LLM API key configured
  useEffect(() => {
    const client = getSupabaseBrowser();
    if (!client) return;
    client.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) return;
      getLlmSettings(session.access_token)
        .then((s) => setHasLlmKey(s.hasKey))
        .catch(() => {});
      getEtoroSettings(session.access_token)
        .then((s) => setHasEtoroConfigured(s.configured))
        .catch(() => {});
    });
  }, []);

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
    async (_secret?: string) => {
      setRunJobsError(null);
      setRunJobsLoading(true);
      setRunJobsProgress(null);
      try {
        // Get the list of enabled indicators from the server
        const keys = await getIndicatorKeys();
        if (keys.length === 0) {
          setRunJobsError('No indicators configured.');
          setRunJobsLoading(false);
          return;
        }
        const total = keys.length + 1; // +1 for finalize step

        // Process each indicator one by one, updating progress
        for (let i = 0; i < keys.length; i++) {
          setRunJobsProgress({ current: i + 1, total, currentKey: keys[i] });
          try {
            await runJobStep(keys[i]);
          } catch (e) {
            console.warn(`[runJobsNow] step failed for ${keys[i]}:`, e);
            // Continue with next indicator even if one fails
          }
        }

        // Finalize: compute score + run alert rules
        setRunJobsProgress({ current: total, total, currentKey: 'score' });
        await runJobFinalize();

        // Refresh dashboard data
        const [d, sh] = await refreshData();
        setData(d);
        setScoreHistory(sh.data || []);
        setError(null);
        setCronSecretPrompt(false);
        setCronSecretInput('');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setRunJobsError(msg);
      } finally {
        setRunJobsLoading(false);
        setRunJobsProgress(null);
      }
    },
    [],
  );

  const runBackfillNow = useCallback(
    async (secret?: string) => {
      setBackfillError(null);
      setBackfillSuccess(null);
      setBackfillLoading(true);
      try {
        await triggerBackfillHistory(secret);
        setCronSecretPrompt(false);
        setCronSecretInput('');
        setBackfillSuccess(t('dashboard.backfillSuccess'));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('Cron secret required')) setCronSecretPrompt(true);
        else setBackfillError(msg);
      } finally {
        setBackfillLoading(false);
      }
    },
    [t],
  );

  const handleAddAssetFromSearch = useCallback(async (symbol: string, assetType: string, displayName: string) => {
    const client = getSupabaseBrowser();
    if (!client) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user?.id) return;
    setAddAssetLoading(true);
    try {
      const { error } = await client.from('user_assets').insert({
        user_id: session.user.id,
        symbol: symbol.toUpperCase(),
        asset_type: assetType,
        display_name: displayName,
      });
      if (error) throw error;
      loadUserAssets();
    } catch (err) {
      console.error(err);
    } finally {
      setAddAssetLoading(false);
    }
  }, [loadUserAssets]);

  const handlePopulateSymbols = useCallback(async () => {
    setPopulateError(null);
    setPopulateSuccess(null);
    setPopulateLoading(true);
    try {
      const res = await triggerPopulateSymbols(cronSecretInput.trim() || undefined);
      const parts: string[] = [];
      if (res.results) {
        for (const [k, v] of Object.entries(res.results)) {
          parts.push(`${k}: ${v}`);
        }
      }
      setPopulateSuccess(t('dashboard.populateSuccess') + (parts.length > 0 ? ` (${parts.join(', ')})` : ''));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Cron secret required')) setCronSecretPrompt(true);
      else setPopulateError(msg);
    } finally {
      setPopulateLoading(false);
    }
  }, [cronSecretInput, t]);

  const handleRemoveAsset = useCallback(async (id: string) => {
    const client = getSupabaseBrowser();
    if (!client) return;
    const { error } = await client.from('user_assets').delete().eq('id', id);
    if (!error) loadUserAssets();
  }, [loadUserAssets]);

  const handleGenerateRecommendations = useCallback(async () => {
    const client = getSupabaseBrowser();
    if (!client) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) return;
    setRecsError(null);
    setRecsLoading(true);
    setAiRecommendations(null);
    try {
      const result = await fetchRecommendations(session.access_token, locale);
      console.log('[recommendations] raw response:', JSON.stringify(result));
      const recs = result.recommendations || [];
      setAiRecommendations(recs);
      if (recs.length === 0) {
        setRecsError('No recommendations returned. Check Netlify function logs and your LLM API key in Settings.');
      }
    } catch (e) {
      console.error('[recommendations] client error:', e);
      setRecsError(e instanceof Error ? e.message : String(e));
    } finally {
      setRecsLoading(false);
    }
  }, [locale]);

  const handleMarketScan = useCallback(async (count: number, assetTypes: string[], etoroOnly?: boolean) => {
    const client = getSupabaseBrowser();
    if (!client) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) return;

    setScanError(null);
    setScanLoading(true);
    setScanResults([]);
    setScanTotal(count);
    scanCancelledRef.current = false;

    const BATCH = 5;
    const accumulated: MarketScanResult[] = [];

    try {
      let remaining = count;
      while (remaining > 0 && !scanCancelledRef.current) {
        const batchSize = Math.min(BATCH, remaining);
        const excludeSymbols = accumulated.map((r) => r.symbol);
        const result = await fetchMarketScan(session.access_token, locale, batchSize, assetTypes, excludeSymbols, etoroOnly);
        console.log('[market-scan] batch response:', JSON.stringify(result));
        const items = result.scan || [];
        if (items.length === 0) break; // no more candidates
        accumulated.push(...items);
        setScanResults([...accumulated]);
        remaining -= items.length;
      }

      if (accumulated.length === 0 && !scanCancelledRef.current) {
        setScanError('No scan results returned. Check Netlify function logs and your LLM API key in Settings.');
      }
    } catch (e) {
      console.error('[market-scan] client error:', e);
      setScanError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanLoading(false);
    }
  }, [locale]);

  const handleStopScan = useCallback(() => {
    scanCancelledRef.current = true;
  }, []);

  const handlePlaceEtoroOrder = useCallback(async (symbol: string, amount: number, isBuy: boolean): Promise<void> => {
    const client = getSupabaseBrowser();
    if (!client) throw new Error('Not authenticated');
    const { data: { session } } = await client.auth.getSession();
    if (!session?.access_token) throw new Error('Not authenticated');
    await placeEtoroOrder(session.access_token, { symbol, amount, isBuy });
  }, []);

  if (loading) return <div className="pt-16 p-8 pb-24 md:pb-8 text-slate-500 dark:text-slate-400">{t('common.loading')}</div>;
  if (error) {
    return <DashboardErrorView
      error={error}
      t={t}
      runJobsNow={runJobsNow}
      runJobsLoading={runJobsLoading}
      runJobsError={runJobsError}
      cronSecretPrompt={cronSecretPrompt}
      cronSecretInput={cronSecretInput}
      setCronSecretInput={setCronSecretInput}
    />;
  }
  if (!data) return null;

  return <DashboardContent
    data={data}
    scoreHistory={scoreHistory}
    t={t}
    translateExplain={translateExplain}
    locale={locale}
    runJobsNow={runJobsNow}
    runJobsLoading={runJobsLoading}
    runJobsProgress={runJobsProgress}
    runBackfillNow={runBackfillNow}
    backfillLoading={backfillLoading}
    cronSecretPrompt={cronSecretPrompt}
    cronSecretInput={cronSecretInput}
    setCronSecretInput={setCronSecretInput}
    setCronSecretPrompt={setCronSecretPrompt}
    setRunJobsError={setRunJobsError}
    setBackfillError={setBackfillError}
    runJobsError={runJobsError}
    backfillError={backfillError}
    backfillSuccess={backfillSuccess}
    statusIconColor={statusIconColor}
    trendArrow={trendArrow}
    setHoveredSummaryCard={setHoveredSummaryCard}
    setHoveredScoreBar={setHoveredScoreBar}
    hoveredSummaryCard={hoveredSummaryCard}
    hoveredScoreBar={hoveredScoreBar}
    userAssets={userAssets}
    handleAddAssetFromSearch={handleAddAssetFromSearch}
    addAssetLoading={addAssetLoading}
    handleRemoveAsset={handleRemoveAsset}
    handleGenerateRecommendations={handleGenerateRecommendations}
    recsLoading={recsLoading}
    recsError={recsError}
    aiRecommendations={aiRecommendations}
    hasLlmKey={hasLlmKey}
    handlePopulateSymbols={handlePopulateSymbols}
    populateLoading={populateLoading}
    populateSuccess={populateSuccess}
    populateError={populateError}
    setHoveredCard={setHoveredCard}
    hoveredCard={hoveredCard}
    handleMarketScan={handleMarketScan}
    handleStopScan={handleStopScan}
    scanLoading={scanLoading}
    scanResults={scanResults}
    scanError={scanError}
    scanTotal={scanTotal}
    hasEtoroConfigured={hasEtoroConfigured}
    handlePlaceEtoroOrder={handlePlaceEtoroOrder}
  />;
}
