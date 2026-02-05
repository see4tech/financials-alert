import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Market Health Checklist</h1>
      <nav className="flex gap-4">
        <Link href="/dashboard" className="text-blue-600 hover:underline">
          Dashboard
        </Link>
        <Link href="/indicators" className="text-blue-600 hover:underline">
          Indicators
        </Link>
        <Link href="/alerts" className="text-blue-600 hover:underline">
          Alerts
        </Link>
      </nav>
    </main>
  );
}
