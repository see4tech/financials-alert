'use client';

import Link from 'next/link';

const CORE_KEYS = [
  'macro.us10y',
  'macro.dxy',
  'eq.nasdaq',
  'eq.leaders',
  'crypto.btc',
  'sent.fng',
];

export default function IndicatorsPage() {
  return (
    <main className="min-h-screen p-8 max-w-4xl mx-auto">
      <nav className="mb-8 flex gap-4">
        <Link href="/" className="text-blue-600 hover:underline">Home</Link>
        <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
        <Link href="/alerts" className="text-blue-600 hover:underline">Alerts</Link>
      </nav>
      <h1 className="text-2xl font-bold mb-6">Indicators</h1>
      <ul className="space-y-2">
        {CORE_KEYS.map((key) => (
          <li key={key}>
            <Link href={`/indicators/${key}`} className="text-blue-600 hover:underline">
              {key}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
