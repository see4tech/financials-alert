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
        <p className="text-gray-500">No history yet.</p>
      ) : (
        <div className="border rounded-lg p-4 bg-white h-64 flex items-end gap-px">
          {points.map((p) => (
            <div
              key={p.ts}
              className="flex-1 bg-blue-500 rounded-t min-w-0"
              style={{
                height: `${maxVal === minVal ? 50 : ((p.value - minVal) / (maxVal - minVal)) * 100}%`,
              }}
              title={`${p.ts}: ${p.value}`}
            />
          ))}
        </div>
      )}
    </main>
  );
}
