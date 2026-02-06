import { ProviderAdapter, NormalizedPoint, FetchParams } from './adapter.interface';

/**
 * CoinGecko free API – no key, works from any region/datacenter (e.g. Netlify).
 * Rate limit: ~10–50 req/min on free tier. Use for crypto.btc when Binance returns 451.
 * @see https://www.coingecko.com/en/api
 */
const COINGECKO_PRICE = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd';
const COINGECKO_MARKET_CHART = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=';

export class CoinGeckoAdapter implements ProviderAdapter {
  name = 'CoinGecko';
  supports = ['crypto.btc'];

  async fetch(indicatorKey: string, params: FetchParams): Promise<NormalizedPoint[]> {
    if (indicatorKey !== 'crypto.btc') return [];
    if (params.from != null) return this.fetchHistory(params);
    const res = await fetch(COINGECKO_PRICE);
    if (!res.ok) {
      if (res.status === 429) throw new Error('CoinGecko rate limit');
      throw new Error(`CoinGecko ${res.status}`);
    }
    const data = (await res.json()) as { bitcoin?: { usd?: number } };
    const usd = data.bitcoin?.usd;
    if (usd == null) return [];
    const ts = new Date().toISOString();
    return [
      {
        indicatorKey: 'crypto.btc',
        ts,
        value: usd,
        meta: { source: 'CoinGecko', raw: data as unknown as Record<string, unknown> },
      },
    ];
  }

  private async fetchHistory(params: FetchParams): Promise<NormalizedPoint[]> {
    const days = 90;
    const res = await fetch(COINGECKO_MARKET_CHART + days);
    if (!res.ok) {
      if (res.status === 429) throw new Error('CoinGecko rate limit');
      throw new Error(`CoinGecko ${res.status}`);
    }
    const data = (await res.json()) as { prices?: Array<[number, number]> };
    const prices = data.prices || [];
    return prices.map(([tsMs, value]) => ({
      indicatorKey: 'crypto.btc',
      ts: new Date(tsMs).toISOString(),
      value,
      meta: { source: 'CoinGecko', raw: { ts: tsMs, value } as unknown as Record<string, unknown> },
    }));
  }
}
