import { IndicatorDetailClient } from './IndicatorDetailClient';

const CORE_KEYS = ['macro.us10y', 'macro.dxy', 'eq.nasdaq', 'eq.leaders', 'crypto.btc', 'sent.fng'];

export function generateStaticParams() {
  return CORE_KEYS.map((key) => ({ key }));
}

export default function IndicatorDetailPage({ params }: { params: { key: string } }) {
  return <IndicatorDetailClient keyParam={params.key} />;
}
