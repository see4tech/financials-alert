import { ProviderAdapter, NormalizedPoint, FetchParams } from './adapter.interface';

const BINANCE_TICKER = 'https://api.binance.com/api/v3/ticker/price?symbol=';

export class BinanceAdapter implements ProviderAdapter {
  name = 'Binance';
  supports = ['crypto.btc'];

  async fetch(indicatorKey: string, _params: FetchParams): Promise<NormalizedPoint[]> {
    if (indicatorKey !== 'crypto.btc') return [];
    const res = await fetch(`${BINANCE_TICKER}BTCUSDT`);
    if (!res.ok) {
      if (res.status === 429) throw new Error('Binance rate limit');
      throw new Error(`Binance ${res.status}`);
    }
    const data = (await res.json()) as { price: string };
    const ts = new Date().toISOString();
    return [
      {
        indicatorKey: 'crypto.btc',
        ts,
        value: parseFloat(data.price),
        meta: { source: 'Binance', raw: data as unknown as Record<string, unknown> },
      },
    ];
  }
}
