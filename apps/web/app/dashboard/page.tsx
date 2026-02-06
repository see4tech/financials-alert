'use client';

import { useCallback, useEffect, useState } from 'react';
import { NavBar } from '@/app/components/NavBar';
import { useLocale } from '@/app/context/LocaleContext';
import { getSupabaseBrowser } from '@/lib/supabase';
import { fetchDashboard, fetchScoreHistory, triggerRunJobs, triggerBackfillHistory, fetchRecommendations, type AiRecommendation } from '@/lib/api';
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
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [backfillSuccess, setBackfillSuccess] = useState<string | null>(null);
  const [cronSecretPrompt, setCronSecretPrompt] = useState(false);
  const [cronSecretInput, setCronSecretInput] = useState('');
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [hoveredSummaryCard, setHoveredSummaryCard] = useState<'weeklyScore' | 'scoreHistory' | null>(null);
  const [hoveredScoreBar, setHoveredScoreBar] = useState<{ week_start_date: string; score: number } | null>(null);
  const [userAssets, setUserAssets] = useState<{ id: string; symbol: string; asset_type: string }[]>([]);
  const [newAssetSymbol, setNewAssetSymbol] = useState('');
  const [newAssetType, setNewAssetType] = useState<string>('stock');
  const [addAssetLoading, setAddAssetLoading] = useState(false);
  const [recsLoading, setRecsLoading] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<AiRecommendation[] | null>(null);
  const [recsError, setRecsError] = useState<string | null>(null);

  const statusIconColor = useCallback((s: string): string =>
    s === 'GREEN' ? 'text-green-600' : s === 'RED' ? 'text-red-600' : s === 'YELLOW' ? 'text-amber-500' : 'text-gray-400', []);
  const trendArrow = useCallback((trend: string): string =>
    trend === 'RISING' ? '↑' : trend === 'FALLING' ? '↓' : '→', []);

  const loadUserAssets = useCallback(() => {
    const client = getSupabaseBrowser();
    if (!client) return;
    client.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return;
      client
        .from('user_assets')
        .select('id, symbol, asset_type')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: true })
        .then(({ data }) => setUserAssets(Array.isArray(data) ? data : []));
    });
  }, []);

  useEffect(() => {
    loadUserAssets();
  }, [loadUserAssets]);

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

  const handleAddAsset = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const sym = newAssetSymbol.trim().toUpperCase();
    if (!sym) return;
    const client = getSupabaseBrowser();
    if (!client) return;
    const { data: { session } } = await client.auth.getSession();
    if (!session?.user?.id) return;
    setAddAssetLoading(true);
    try {
      const { error } = await client.from('user_assets').insert({
        user_id: session.user.id,
        symbol: sym,
        asset_type: newAssetType,
      });
      if (error) throw error;
      setNewAssetSymbol('');
      loadUserAssets();
    } catch (err) {
      console.error(err);
    } finally {
      setAddAssetLoading(false);
    }
  }, [newAssetSymbol, newAssetType, loadUserAssets]);

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
      const { recommendations } = await fetchRecommendations(session.access_token);
      setAiRecommendations(recommendations || []);
    } catch (e) {
      setRecsError(e instanceof Error ? e.message : String(e));
    } finally {
      setRecsLoading(false);
    }
  }, []);

  if (loading) return <div className="p-8">{t('common.loading')}</div>;
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
    newAssetSymbol={newAssetSymbol}
    setNewAssetSymbol={setNewAssetSymbol}
    newAssetType={newAssetType}
    setNewAssetType={setNewAssetType}
    handleAddAsset={handleAddAsset}
    addAssetLoading={addAssetLoading}
    handleRemoveAsset={handleRemoveAsset}
    handleGenerateRecommendations={handleGenerateRecommendations}
    recsLoading={recsLoading}
    recsError={recsError}
    aiRecommendations={aiRecommendations}
    setHoveredCard={setHoveredCard}
    hoveredCard={hoveredCard}
  />;
}
