import {
  getDb,
  RegistryService,
  FredAdapter,
  CoinGeckoAdapter,
  BinanceAdapter,
  AlternativeMeAdapter,
  TwelveDataAdapter,
  type ProviderAdapter,
  MoreThanOrEqual,
} from '@market-health/api-core';
import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const CRON_SECRET = process.env.CRON_SECRET || process.env.NETLIFY_CRON_SECRET;

/** One-time backfill: fetch last 90 days of history for all indicators and aggregate to indicator_points. */
export const config = {};

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed. Use POST with X-Cron-Secret.' };
  }
  if (CRON_SECRET) {
    const auth = event.headers['authorization'] || event.headers['x-cron-secret'];
    const token = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '') : '';
    if (token !== CRON_SECRET) {
      return { statusCode: 401, body: 'Unauthorized' };
    }
  }

  const toDate = new Date();
  const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const fromStr = fromDate.toISOString().slice(0, 10);
  const toStr = toDate.toISOString().slice(0, 10);
  const params = { from: fromStr, to: toStr };

  const db = await getDb();
  const rawRepo = db.getRawRepo();
  const pointsRepo = db.getPointsRepo();
  const registry = new RegistryService();
  const adapters: ProviderAdapter[] = [
    new FredAdapter(),
    new CoinGeckoAdapter(),
    new BinanceAdapter(),
    new AlternativeMeAdapter(),
    new TwelveDataAdapter(),
  ];

  const getAdapter = (indicatorKey: string) =>
    adapters.find((a) => a.supports.includes(indicatorKey)) ?? null;

  const results: Record<string, { raw: number; points: number }> = {};

  for (const ind of registry.getEnabled()) {
    const adapter = getAdapter(ind.key);
    if (!adapter) {
      console.warn('Backfill: no adapter for', ind.key);
      continue;
    }
    try {
      const points = await adapter.fetch(ind.key, params);
      if (points.length === 0) {
        console.warn('Backfill: 0 points for', ind.key);
        continue;
      }
      const rows = points.map((p) => ({
        id: crypto.randomUUID(),
        ts: new Date(p.ts),
        indicator_key: p.indicatorKey,
        value: p.value,
        source: p.meta.source,
        raw_json: p.meta.raw ? JSON.parse(JSON.stringify(p.meta.raw)) : null,
      }));
      await rawRepo.insertOrIgnore(rows);
      results[ind.key] = { raw: rows.length, points: 0 };
      console.log('Backfill: inserted', rows.length, 'raw for', ind.key);
    } catch (err) {
      console.warn('Backfill fetch failed for', ind.key, err);
    }
  }

  const aggregateKeys: string[] = [];
  for (const ind of registry.getEnabled()) {
    if (ind.key === 'eq.leaders' && ind.constituents) {
      aggregateKeys.push(...ind.constituents.map((c) => `eq.leaders.${c}`));
    } else {
      aggregateKeys.push(ind.key);
    }
  }

  const since = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);

  for (const indicatorKey of aggregateKeys) {
    const config =
      registry.getByKey(indicatorKey) ||
      registry.getByKey(indicatorKey.split('.')[0] + '.' + indicatorKey.split('.')[1]);
    if (!config && !indicatorKey.startsWith('eq.leaders.')) continue;
    const raws = await rawRepo.find({
      where: { indicator_key: indicatorKey, ts: MoreThanOrEqual(since) },
      order: { ts: 'ASC' },
      take: 5000,
    });
    if (raws.length === 0) continue;
    const byDay = new Map<string, { ts: Date; value: number }>();
    for (const r of raws) {
      const rAny = r as { ts: Date; value: unknown };
      const ts = rAny.ts instanceof Date ? rAny.ts : new Date(rAny.ts);
      const day = ts.toISOString().slice(0, 10);
      const existing = byDay.get(day);
      if (!existing || ts > existing.ts) byDay.set(day, { ts, value: Number(rAny.value) });
    }
    const pointRows = Array.from(byDay.values()).map((v) => ({
      id: crypto.randomUUID(),
      ts: v.ts,
      indicator_key: indicatorKey,
      value: v.value,
      granularity: '1d',
      quality_flag: 'ok',
    }));
    await pointsRepo.insertOrIgnore(pointRows);
    if (results[indicatorKey]) results[indicatorKey].points = pointRows.length;
    else results[indicatorKey] = { raw: 0, points: pointRows.length };
    console.log('Backfill: aggregated', indicatorKey, '->', pointRows.length, 'points');
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      message: 'Backfill completed. Historical data (90d) loaded for all indicators.',
      from: fromStr,
      to: toStr,
      results,
    }),
  };
};
