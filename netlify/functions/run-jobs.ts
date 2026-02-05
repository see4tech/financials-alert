import { ensureDataSource } from '../../apps/api/src/database/data-source';
import { RegistryService } from '../../apps/api/src/indicators/registry.service';
import { StatusEngine } from '../../apps/api/src/indicators/status-engine';
import { RulesEngine } from '../../apps/api/src/alerts/rules-engine';
import { NotificationService } from '../../apps/api/src/alerts/notification.service';
import { FredAdapter } from '../../apps/api/src/providers/fred.adapter';
import { BinanceAdapter } from '../../apps/api/src/providers/binance.adapter';
import { AlternativeMeAdapter } from '../../apps/api/src/providers/alternative-me.adapter';
import { TwelveDataAdapter } from '../../apps/api/src/providers/twelve-data.adapter';
import { ProviderAdapter } from '../../apps/api/src/providers/adapter.interface';
import { linearRegressionSlope, average } from '../../apps/api/src/indicators/trend';
import { MoreThanOrEqual, IsNull } from 'typeorm';
import {
  IndicatorPointRaw,
  IndicatorPoint,
  DerivedMetric,
  StatusSnapshot,
  WeeklyScore,
  AlertRule,
  AlertFired,
  NotificationDelivery,
} from '../../apps/api/src/database/entities';
import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';

const CRON_SECRET = process.env.CRON_SECRET || process.env.NETLIFY_CRON_SECRET;

/** Run every 15 minutes (UTC). Can also be triggered via POST with X-Cron-Secret or Authorization: Bearer <CRON_SECRET>. */
export const config = { schedule: '*/15 * * * *' };

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod === 'POST' && CRON_SECRET) {
    const auth = event.headers['authorization'] || event.headers['x-cron-secret'];
    const token = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '') : '';
    if (token !== CRON_SECRET) {
      return { statusCode: 401, body: 'Unauthorized' };
    }
  }
  if (event.httpMethod === 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed. Use POST with X-Cron-Secret for manual trigger.' };
  }
  // Scheduled invocations have no httpMethod; allow through

  const ds = await ensureDataSource();
  const rawRepo = ds.getRepository(IndicatorPointRaw);
  const pointsRepo = ds.getRepository(IndicatorPoint);
  const derivedRepo = ds.getRepository(DerivedMetric);
  const snapshotRepo = ds.getRepository(StatusSnapshot);
  const scoreRepo = ds.getRepository(WeeklyScore);
  const ruleRepo = ds.getRepository(AlertRule);
  const firedRepo = ds.getRepository(AlertFired);
  const deliveryRepo = ds.getRepository(NotificationDelivery);

  const registry = new RegistryService();
  const adapters: ProviderAdapter[] = [
    new FredAdapter(),
    new BinanceAdapter(),
    new AlternativeMeAdapter(),
    new TwelveDataAdapter(),
  ];

  const getAdapter = (indicatorKey: string) =>
    adapters.find((a) => a.supports.includes(indicatorKey)) ?? null;

  // 1. Fetch
  for (const ind of registry.getEnabled()) {
    const adapter = getAdapter(ind.key);
    if (!adapter) continue;
    try {
      const points = await adapter.fetch(ind.key, {});
      const keys = [...new Set(points.map((p) => p.indicatorKey))];
      for (const p of points) {
        await rawRepo
          .createQueryBuilder()
          .insert()
          .into(IndicatorPointRaw)
          .values({
            id: crypto.randomUUID(),
            ts: new Date(p.ts),
            indicator_key: p.indicatorKey,
            value: p.value,
            source: p.meta.source,
            raw_json: p.meta.raw ? JSON.parse(JSON.stringify(p.meta.raw)) : null,
          })
          .orIgnore()
          .execute();
      }
    } catch (err) {
      console.warn('Fetch failed for', ind.key, err);
    }
  }

  // 2. Aggregate keys: enabled + eq.leaders constituents
  const aggregateKeys: string[] = [];
  for (const ind of registry.getEnabled()) {
    if (ind.key === 'eq.leaders' && ind.constituents) {
      aggregateKeys.push(...ind.constituents.map((c) => `eq.leaders.${c}`));
    } else {
      aggregateKeys.push(ind.key);
    }
  }

  for (const indicatorKey of aggregateKeys) {
    const config = registry.getByKey(indicatorKey) || registry.getByKey(indicatorKey.split('.')[0] + '.' + indicatorKey.split('.')[1]);
    if (!config && !indicatorKey.startsWith('eq.leaders.')) continue;
    const since = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000);
    const raws = await rawRepo.find({
      where: { indicator_key: indicatorKey, ts: MoreThanOrEqual(since) },
      order: { ts: 'ASC' },
      take: 5000,
    });
    if (raws.length === 0) continue;
    const byDay = new Map<string, { ts: Date; value: number }>();
    for (const r of raws) {
      const day = r.ts.toISOString().slice(0, 10);
      const existing = byDay.get(day);
      if (!existing || r.ts > existing.ts) byDay.set(day, { ts: r.ts, value: Number(r.value) });
    }
    for (const [, v] of byDay) {
      await pointsRepo
        .createQueryBuilder()
        .insert()
        .into(IndicatorPoint)
        .values({
          id: crypto.randomUUID(),
          ts: v.ts,
          indicator_key: indicatorKey,
          value: v.value,
          granularity: '1d',
          quality_flag: 'ok',
        })
        .orIgnore()
        .execute();
    }
  }

  // 3. Derived (for same keys that have config with trend_window_days)
  for (const indicatorKey of aggregateKeys) {
    const config =
      registry.getByKey(indicatorKey) ||
      (indicatorKey.startsWith('eq.leaders.') ? registry.getByKey('eq.leaders') : undefined);
    const trendWindow = config?.trend_window_days ?? 21;
    const since = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    const points = await pointsRepo.find({
      where: { indicator_key: indicatorKey, ts: MoreThanOrEqual(since), granularity: '1d' },
      order: { ts: 'ASC' },
      take: 100,
    });
    if (points.length < 2) continue;
    const values = points.map((p) => ({ ts: p.ts, value: Number(p.value) }));
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
      await derivedRepo
        .createQueryBuilder()
        .insert()
        .into(DerivedMetric)
        .values({
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
        })
        .orIgnore()
        .execute();
    }
  }

  // 4. Status
  const statusEngine = new StatusEngine(registry);
  const ts = new Date();
  const coreKeys = registry.getCoreKeys().filter((k) => registry.getByKey(k)?.enabled);
  let scoreCount = 0;

  for (const key of coreKeys) {
    if (key === 'eq.leaders') {
      const tickers = ['NVDA', 'MSFT', 'AAPL', 'GOOGL'];
      let green = 0;
      let red = 0;
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      for (const sym of tickers) {
        const k = `eq.leaders.${sym}`;
        const pts = await pointsRepo.find({
          where: { indicator_key: k, ts: MoreThanOrEqual(since), granularity: '1d' },
          order: { ts: 'ASC' },
          take: 25,
        });
        if (pts.length < 5) continue;
        const derivedRow = await derivedRepo.findOne({ where: { indicator_key: k }, order: { ts: 'DESC' } });
        const result = statusEngine.compute(
          'eq.nasdaq',
          pts.map((p) => ({ ts: p.ts, value: Number(p.value) })),
          {
            slope: derivedRow?.slope_21d != null ? Number(derivedRow.slope_21d) : undefined,
            ma_21d: derivedRow?.ma_21d != null ? Number(derivedRow.ma_21d) : undefined,
          },
          24 * 3600 * 1000,
          pts[pts.length - 1].ts,
        );
        if (result.status === 'GREEN') green++;
        if (result.status === 'RED') red++;
      }
      const status = green >= 3 ? 'GREEN' : green === 2 ? 'YELLOW' : red >= 2 ? 'RED' : 'YELLOW';
      const trend = green >= 3 ? 'RISING' : red >= 2 ? 'FALLING' : 'FLAT';
      if (status === 'GREEN') scoreCount++;
      await snapshotRepo.save({
        ts,
        indicator_key: key,
        status,
        trend,
        explanation: `${green} leaders green, ${red} red`,
        meta: null,
      });
      continue;
    }

    const config = registry.getByKey(key);
    if (!config) continue;
    const stalenessMs = config.poll_interval_sec * 3 * 1000;
    const since = new Date(Date.now() - (config.trend_window_days + 5) * 24 * 60 * 60 * 1000);
    const points = await pointsRepo.find({
      where: { indicator_key: key, ts: MoreThanOrEqual(since), granularity: '1d' },
      order: { ts: 'ASC' },
      take: 50,
    });
    const latestTs = points.length ? points[points.length - 1].ts : new Date(0);
    const derivedRow = await derivedRepo.findOne({
      where: { indicator_key: key, ts: MoreThanOrEqual(since) },
      order: { ts: 'DESC' },
    });
    const result = statusEngine.compute(
      key,
      points.map((p) => ({ ts: p.ts, value: Number(p.value) })),
      {
        slope: derivedRow?.slope_21d != null ? Number(derivedRow.slope_21d) : undefined,
        ma_21d: derivedRow?.ma_21d != null ? Number(derivedRow.ma_21d) : undefined,
      },
      stalenessMs,
      latestTs,
    );
    if (result.status === 'GREEN') scoreCount++;
    await snapshotRepo.save({
      ts,
      indicator_key: key,
      status: result.status,
      trend: result.trend,
      explanation: result.explanation,
      meta: null,
    });
  }

  const score = scoreCount;
  const weekStart = (() => {
    const d = ts;
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setUTCDate(diff);
    return monday.toISOString().slice(0, 10);
  })();
  const prevWeekStart = (() => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  })();
  const prevScore = await scoreRepo.findOne({
    where: { week_start_date: prevWeekStart, user_id: IsNull() },
  });
  const delta = prevScore ? score - prevScore.score : 0;
  const existing = await scoreRepo.findOne({ where: { week_start_date: weekStart, user_id: IsNull() } });
  if (existing) {
    existing.score = score;
    existing.delta_score = delta;
    await scoreRepo.save(existing);
  } else {
    await scoreRepo.save({
      week_start_date: weekStart,
      user_id: null,
      score,
      delta_score: delta,
      notes: null,
    });
  }

  // 5. Rules
  const rulesEngine = new RulesEngine(ruleRepo, firedRepo, pointsRepo, snapshotRepo);
  const notificationService = new NotificationService(firedRepo, deliveryRepo);
  const rules = await ruleRepo.find({ where: { is_enabled: true } });

  for (const rule of rules) {
    try {
      const { fired, payload } = await rulesEngine.evaluateRule(rule);
      if (!fired || !payload) continue;
      const json = rule.json_rule as { name?: string; cooldownMinutes?: number; condition?: unknown; actions?: string[] };
      const dedupeKey = rulesEngine.dedupeKey(rule.id, payload);
      const existingFired = await firedRepo.findOne({ where: { dedupe_key: dedupeKey } });
      if (existingFired) continue;
      const alert = await firedRepo.save({
        rule_id: rule.id,
        ts: new Date(),
        payload,
        dedupe_key: dedupeKey,
      });
      await notificationService.send(alert.id, payload, json.actions ?? ['email']);
    } catch (err) {
      console.warn('Rule eval failed', rule.id, err);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
