import { Injectable } from '@nestjs/common';
import { ProviderAdapter, NormalizedPoint, FetchParams } from './adapter.interface';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

@Injectable()
export class FredAdapter implements ProviderAdapter {
  name = 'FRED';
  supports = ['macro.us10y'];

  async fetch(indicatorKey: string, params: FetchParams): Promise<NormalizedPoint[]> {
    const apiKey = process.env.FRED_API_KEY;
    if (!apiKey) return [];

    const seriesId = indicatorKey === 'macro.us10y' ? 'DGS10' : '';
    if (!seriesId) return [];

    const to = params.to || new Date().toISOString().slice(0, 10);
    const from = params.from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&observation_start=${from}&observation_end=${to}`;

    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 429) throw new Error('FRED rate limit');
      throw new Error(`FRED ${res.status}`);
    }
    const data = (await res.json()) as { observations?: Array<{ date: string; value: string }> };
    const observations = data.observations || [];
    const points: NormalizedPoint[] = observations
      .filter((o) => o.value !== '.')
      .map((o) => ({
        indicatorKey,
        ts: `${o.date}T12:00:00.000Z`,
        value: parseFloat(o.value),
        meta: { source: 'FRED', raw: o as unknown as Record<string, unknown> },
      }));
    return points;
  }
}
