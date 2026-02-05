import { ProviderAdapter, NormalizedPoint, FetchParams } from './adapter.interface';

const TWELVE_BASE = 'https://api.twelvedata.com';

export class TwelveDataAdapter implements ProviderAdapter {
  name = 'Twelve Data';
  supports = ['macro.dxy', 'eq.nasdaq', 'eq.leaders'];

  private symbolMap: Record<string, string> = {
    'macro.dxy': 'DX-Y.NYB',
    'eq.nasdaq': 'IXIC',
    'eq.leaders': '',
  };

  private leaderSymbols = ['NVDA', 'MSFT', 'AAPL', 'GOOGL'];

  async fetch(indicatorKey: string, params: FetchParams): Promise<NormalizedPoint[]> {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) return [];
    if (indicatorKey === 'eq.leaders') return this.fetchLeaders(params);
    const symbol = this.symbolMap[indicatorKey];
    if (!symbol) return [];
    const to = params.to || new Date().toISOString().slice(0, 10);
    const from = params.from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const url = `${TWELVE_BASE}/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&start_date=${from}&end_date=${to}&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 429) throw new Error('Twelve Data rate limit');
      throw new Error(`Twelve Data ${res.status}`);
    }
    const data = (await res.json()) as { values?: Array<{ datetime: string; close: string }> };
    const values = data.values || [];
    return values.map((v) => ({
      indicatorKey,
      ts: `${v.datetime}T20:00:00.000Z`,
      value: parseFloat(v.close),
      meta: { source: 'Twelve Data', raw: v as unknown as Record<string, unknown> },
    }));
  }

  private async fetchLeaders(params: FetchParams): Promise<NormalizedPoint[]> {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) return [];
    const to = params.to || new Date().toISOString().slice(0, 10);
    const from = params.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const all: NormalizedPoint[] = [];
    for (const sym of this.leaderSymbols) {
      const url = `${TWELVE_BASE}/time_series?symbol=${sym}&interval=1day&start_date=${from}&end_date=${to}&apikey=${apiKey}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as { values?: Array<{ datetime: string; close: string }> };
      const values = data.values || [];
      for (const v of values) {
        all.push({
          indicatorKey: `eq.leaders.${sym}`,
          ts: `${v.datetime}T20:00:00.000Z`,
          value: parseFloat(v.close),
          meta: { source: 'Twelve Data', raw: { symbol: sym, ...v } as Record<string, unknown> },
        });
      }
    }
    return all;
  }
}
