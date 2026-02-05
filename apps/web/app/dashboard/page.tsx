'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchDashboard, fetchScoreHistory } from '@/lib/api';

type Indicator = { key: string; value?: number; trend: string; status: string; explain?: string };
type Dashboard = {
  asOf: string;
  score: number;
  deltaWeek: number;
  indicators: Indicator[];
  scenario: { bull: string; bear: string };
};

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [scoreHistory, setScoreHistory] = useState<{ week_start_date: string; score: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchDashboard(), fetchScoreHistory('12w')])
      .then(([d, sh]) => {
        setData(d);
        setScoreHistory(sh.data || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!data) return null;

  const statusColor = (s: string) =>
    s === 'GREEN' ? 'bg-green-100 text-green-800' : s === 'RED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800';
  const trendArrow = (t: string) => (t === 'RISING' ? '↑' : t === 'FALLING' ? '↓' : '→');

  return (
    <main className="min-h-screen p-8 max-w-6xl mx-auto">
      <nav className="mb-8 flex gap-4">
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        <Link href="/indicators" className="text-blue-600 hover:underline">Indicators</Link>
        <Link href="/alerts" className="text-blue-600 hover:underline">Alerts</Link>
      </nav>

      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-6">As of: {new Date(data.asOf).toLocaleString()}</p>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <h2 className="text-sm font-medium text-gray-500">Weekly Score</h2>
          <p className="text-3xl font-bold">{data.score}</p>
          <p className="text-sm text-gray-600">Δ week: {data.deltaWeek >= 0 ? '+' : ''}{data.deltaWeek}</p>
        </div>
        <div className="border rounded-lg p-4 bg-white shadow-sm">
          <h2 className="text-sm font-medium text-gray-500">Score history (12w)</h2>
          <div className="flex items-end gap-0.5 h-12 mt-2">
            {scoreHistory.slice(-12).map((s, i) => (
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
          <h2 className="text-sm font-medium text-gray-500">Scenario</h2>
          <p className="font-medium">Bull: {data.scenario.bull}</p>
          <p className="font-medium">Bear: {data.scenario.bear}</p>
        </div>
      </section>

      <h2 className="text-xl font-semibold mb-4">Indicators</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.indicators.map((ind) => (
          <div key={ind.key} className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="flex justify-between items-start">
              <span className="font-medium">{ind.key}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${statusColor(ind.status)}`}>{ind.status}</span>
            </div>
            {ind.value != null && <p className="text-lg mt-1">{ind.value}</p>}
            <p className="text-sm text-gray-600 mt-1">{trendArrow(ind.trend)} {ind.trend}</p>
            {ind.explain && <p className="text-xs text-gray-500 mt-2">{ind.explain}</p>}
            <Link href={`/indicators/${ind.key}`} className="text-xs text-blue-600 mt-2 inline-block hover:underline">
              View history
            </Link>
          </div>
        ))}
      </div>
      {data.indicators.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="font-medium">No indicator data yet</p>
          <p className="mt-1 text-sm">
            Data is filled by a background job that runs every 15 minutes. If you just deployed, wait for the next run
            or trigger it manually: <code className="rounded bg-amber-100 px-1 text-xs">POST /.netlify/functions/run-jobs</code> with
            header <code className="rounded bg-amber-100 px-1 text-xs">X-Cron-Secret: your-secret</code> (if you set <code className="rounded bg-amber-100 px-1 text-xs">CRON_SECRET</code>).
          </p>
          <p className="mt-2 text-xs text-amber-700">
            Ensure <code className="rounded bg-amber-100 px-1">FRED_API_KEY</code> (and optionally <code className="rounded bg-amber-100 px-1">TWELVE_DATA_API_KEY</code>) are set in Netlify so the job can fetch data.
          </p>
        </div>
      )}
    </main>
  );
}
