import { ProviderAdapter, NormalizedPoint, FetchParams } from './adapter.interface';

const FNG_URL = 'https://api.alternative.me/fng/?limit=90';

export class AlternativeMeAdapter implements ProviderAdapter {
  name = 'Alternative.me';
  supports = ['sent.fng'];

  async fetch(indicatorKey: string, _params: FetchParams): Promise<NormalizedPoint[]> {
    if (indicatorKey !== 'sent.fng') return [];
    const res = await fetch(FNG_URL);
    if (!res.ok) {
      if (res.status === 429) throw new Error('Alternative.me rate limit');
      throw new Error(`Alternative.me ${res.status}`);
    }
    const data = (await res.json()) as { data?: Array<{ value: string; timestamp: string }> };
    const list = data.data || [];
    return list.map((d) => ({
      indicatorKey: 'sent.fng',
      ts: new Date(parseInt(d.timestamp, 10) * 1000).toISOString(),
      value: parseInt(d.value, 10),
      meta: { source: 'Alternative.me', raw: d as unknown as Record<string, unknown> },
    }));
  }
}
