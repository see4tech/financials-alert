import {
  getDb,
  RegistryService,
  StatusEngine,
  FredAdapter,
  CoinGeckoAdapter,
  BinanceAdapter,
  AlternativeMeAdapter,
  TwelveDataAdapter,
  type ProviderAdapter,
  MoreThanOrEqual,
  LessThanOrEqual,
  IsNull,
  linearRegressionSlope,
  average,
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
  const derivedRepo = db.getDerivedRepo();
  const scoreRepo = db.getScoreRepo();
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

  // Derived metrics (ma_21d, slope, etc.) for the backfill range so we can compute historical weekly scores
  const derivedSince = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
  for (const indicatorKey of aggregateKeys) {
    const config =
      registry.getByKey(indicatorKey) ||
      (indicatorKey.startsWith('eq.leaders.') ? registry.getByKey('eq.leaders') : undefined);
    const trendWindow = config?.trend_window_days ?? 21;
    const points = await pointsRepo.find({
      where: { indicator_key: indicatorKey, ts: MoreThanOrEqual(derivedSince), granularity: '1d' },
      order: { ts: 'ASC' },
      take: 200,
    });
    if (points.length < 2) continue;
    const values = points.map((p) => ({ ts: (p as { ts: Date }).ts, value: Number((p as { value: unknown }).value) }));
    for (let i = trendWindow; i < values.length; i++) {
      const window = values.slice(i - trendWindow, i);
      const vals = window.map((v) => v.value);
      const slope21 = linearRegressionSlope(vals);
      const slope14 = window.length >= 14 ? linearRegressionSlope(vals.slice(-14)) : slope21;
      const ma21 = average(vals);
      const v0 = values[i].value;
      const v1d = i >= 1 ? values[i - 1].value : v0;
      const v7d = i >= 7 ? values[i - 7].value : v0;
      const v14d = i >= 14 ? values[i - 14].value : v0;
      const v21d = i >= 21 ? values[i - 21].value : v0;
      await derivedRepo.insertOrIgnore([
        {
          id: crypto.randomUUID(),
          ts: values[i].ts,
          indicator_key: indicatorKey,
          pct_1d: v1d !== 0 ? ((v0 - v1d) / v1d) * 100 : 0,
          pct_7d: v7d !== 0 ? ((v0 - v7d) / v7d) * 100 : 0,
          pct_14d: v14d !== 0 ? ((v0 - v14d) / v14d) * 100 : 0,
          pct_21d: v21d !== 0 ? ((v0 - v21d) / v21d) * 100 : 0,
          slope_14d: slope14,
          slope_21d: slope21,
          ma_21d: ma21,
        },
      ]);
    }
    console.log('Backfill: derived for', indicatorKey);
  }

  // Weekly scores for last 12 weeks so "Historial (12 sem)" shows data
  const statusEngine = new StatusEngine(registry);
  const coreKeys = registry.getCoreKeys().filter((k) => registry.getByKey(k)?.enabled);
  const mondays: string[] = [];
  for (let w = 0; w < 12; w++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - 7 * w);
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setUTCDate(diff);
    mondays.push(monday.toISOString().slice(0, 10));
  }
  const stalenessMs = 365 * 24 * 3600 * 1000; // 1 year so historical data is never "stale"
  let weeksInserted = 0;
  for (const weekStart of mondays) {
    const endOfWeek = new Date(weekStart + 'T23:59:59.999Z');
    endOfWeek.setUTCDate(endOfWeek.getUTCDate() + 6); // Sunday
    let scoreCount = 0;

    for (const key of coreKeys) {
      if (key === 'eq.leaders') {
        const tickers = ['NVDA', 'MSFT', 'AAPL', 'GOOGL'];
        let green = 0;
        let red = 0;
        for (const sym of tickers) {
          const k = `eq.leaders.${sym}`;
          const pts = await pointsRepo.find({
            where: { indicator_key: k, ts: LessThanOrEqual(endOfWeek), granularity: '1d' },
            order: { ts: 'DESC' },
            take: 25,
          });
          if (pts.length < 5) continue;
          const ptsAsc = (pts as { ts: Date; value: unknown }[]).slice().reverse();
          const derivedRow = await derivedRepo.findOne({
            where: { indicator_key: k, ts: LessThanOrEqual(endOfWeek) },
            order: { ts: 'DESC' },
          });
          const result = statusEngine.compute(
            'eq.nasdaq',
            ptsAsc.map((p) => ({ ts: p.ts, value: Number(p.value) })),
            {
              slope: derivedRow?.slope_21d != null ? Number((derivedRow as { slope_21d?: number }).slope_21d) : undefined,
              ma_21d: derivedRow?.ma_21d != null ? Number((derivedRow as { ma_21d?: number }).ma_21d) : undefined,
            },
            stalenessMs,
            ptsAsc[ptsAsc.length - 1].ts,
          );
          if (result.status === 'GREEN') green++;
          if (result.status === 'RED') red++;
        }
        const status = green >= 3 ? 'GREEN' : green === 2 ? 'YELLOW' : red >= 2 ? 'RED' : 'YELLOW';
        if (status === 'GREEN') scoreCount++;
        continue;
      }
      const config = registry.getByKey(key);
      if (!config) continue;
      const points = await pointsRepo.find({
        where: { indicator_key: key, ts: LessThanOrEqual(endOfWeek), granularity: '1d' },
        order: { ts: 'DESC' },
        take: 50,
      });
      if (points.length < 2) continue;
      const pointsAsc = (points as { ts: Date; value: unknown }[]).slice().reverse();
      const derivedRow = await derivedRepo.findOne({
        where: { indicator_key: key, ts: LessThanOrEqual(endOfWeek) },
        order: { ts: 'DESC' },
      });
      const result = statusEngine.compute(
        key,
        pointsAsc.map((p) => ({ ts: p.ts, value: Number(p.value) })),
        {
          slope: derivedRow?.slope_21d != null ? Number((derivedRow as { slope_21d?: number }).slope_21d) : undefined,
          ma_21d: derivedRow?.ma_21d != null ? Number((derivedRow as { ma_21d?: number }).ma_21d) : undefined,
        },
        stalenessMs,
        pointsAsc[pointsAsc.length - 1].ts,
      );
      if (result.status === 'GREEN') scoreCount++;
    }

    const existing = await scoreRepo.findOne({ where: { week_start_date: weekStart, user_id: IsNull() } });
    if (!existing) {
      const prevWeekStart = (() => {
        const d = new Date(weekStart);
        d.setUTCDate(d.getUTCDate() - 7);
        return d.toISOString().slice(0, 10);
      })();
      const prevScore = await scoreRepo.findOne({ where: { week_start_date: prevWeekStart, user_id: IsNull() } });
      const delta = prevScore ? scoreCount - Number((prevScore as { score: number }).score) : 0;
      await scoreRepo.save({
        week_start_date: weekStart,
        user_id: null,
        score: scoreCount,
        delta_score: delta,
        notes: null,
      });
      weeksInserted++;
      console.log('Backfill: weekly score', weekStart, '->', scoreCount);
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      message: 'Backfill completed. Historical data (90d) loaded for all indicators. Weekly score history (12w) backfilled.',
      from: fromStr,
      to: toStr,
      results,
      weeklyScoresInserted: weeksInserted,
    }),
  };
};
