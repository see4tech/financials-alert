'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchIndicatorHistory } from '@/lib/api';

const CORE_KEYS = ['macro.us10y', 'macro.dxy', 'eq.nasdaq', 'eq.leaders', 'crypto.btc', 'sent.fng'];

export function IndicatorDetailClient({ keyParam }: { keyParam: string }) {
  const key = keyParam;
  const [data, setData] = useState<{ data: { ts: string; value: number }[] } | null>(null);
  const [range, setRange] = useState<'30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!key) return;
    fetchIndicatorHistory(key, range, '1d')
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [key, range]);

  if (!key) return null;
  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  const points = data?.data || [];
  const maxVal = Math.max(...points.map((p) => p.value), 1);
  const minVal = Math.min(...points.map((p) => p.value), 0);
  const rangeVal = maxVal - minVal || 1;
  const yTicks = [minVal, minVal + rangeVal * 0.5, maxVal].filter((v, i, a) => a.indexOf(v) === i);
  const formatDate = (ts: string) => new Date(ts).toLocaleDateString('es', { month: 'short', day: 'numeric' });
  const xStep = Math.max(1, Math.floor(points.length / 7));

  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <nav className="mb-8 flex gap-4">
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
        <Link href="/indicators" className="text-blue-600 hover:underline">Indicators</Link>
        <Link href="/alerts" className="text-blue-600 hover:underline">Alerts</Link>
      </nav>
      <h1 className="text-2xl font-bold mb-4">{key}</h1>
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setRange('30d')}
          className={`px-3 py-1 rounded ${range === '30d' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          30D
        </button>
        <button
          onClick={() => setRange('90d')}
          className={`px-3 py-1 rounded ${range === '90d' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          90D
        </button>
      </div>
      {points.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
          <p className="font-medium">No history yet</p>
          <p className="mt-1 text-sm">
            Indicator data is populated by a scheduled job (every 15 min). Wait for the next run or trigger{' '}
            <code className="rounded bg-amber-100 px-1 text-xs">/.netlify/functions/run-jobs</code> manually.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-white">
          <div className="flex gap-2 h-56">
            <div className="flex flex-col justify-between text-right text-xs text-gray-500 pr-2 shrink-0">
              {yTicks.map((t) => (
                <span key={t}>{typeof t === 'number' && t % 1 !== 0 ? t.toFixed(2) : t}</span>
              ))}
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-end gap-px flex-1">
                {points.map((p) => (
                  <div
                    key={p.ts}
                    className="flex-1 bg-blue-500 rounded-t min-w-0"
                    style={{
                      height: `${maxVal === minVal ? 100 : ((p.value - minVal) / rangeVal) * 100}%`,
                    }}
                    title={`${formatDate(p.ts)}: ${p.value}`}
                  />
                ))}
              </div>
              <div className="flex text-xs text-gray-500 mt-1 gap-px">
                {points.map((p, i) => (
                  <span key={p.ts} className="flex-1 min-w-0 text-center truncate" style={{ flex: 1 }}>
                    {i % xStep === 0 ? formatDate(p.ts) : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Cada barra = un día. Valor en tooltip al pasar el ratón.</p>
        </div>
      )}
    </main>
  );
}
