import { MoreThan } from 'typeorm';
import { IndicatorPoint, DerivedMetric, WeeklyScore } from './entities';
import type { Repo } from './db-types';

export class IndicatorsService {
  constructor(
    private readonly pointsRepo: Repo<IndicatorPoint>,
    private readonly derivedRepo: Repo<DerivedMetric>,
    private readonly scoresRepo: Repo<WeeklyScore>,
  ) {}

  async getHistory(key: string, range: string, _granularity: string) {
    const since = this.parseRange(range);
    if (key === 'eq.leaders') {
      return this.getHistoryEqLeaders(since);
    }
    const points = await this.pointsRepo.find({
      where: { indicator_key: key, ts: MoreThan(since) },
      order: { ts: 'ASC' },
      take: 500,
    });
    return { key, granularity: '1d', data: points };
  }

  private async getHistoryEqLeaders(since: Date): Promise<{ key: string; granularity: string; data: Array<{ ts: string; value: number }> }> {
    const constituents = ['eq.leaders.NVDA', 'eq.leaders.MSFT', 'eq.leaders.AAPL', 'eq.leaders.GOOGL'];
    const allPoints: Array<{ ts: Date; value: number }> = [];
    for (const c of constituents) {
      const rows = await this.pointsRepo.find({
        where: { indicator_key: c, ts: MoreThan(since) },
        order: { ts: 'ASC' },
        take: 500,
      });
      for (const row of rows) {
        const r = row as { ts: Date; value: unknown };
        allPoints.push({ ts: r.ts instanceof Date ? r.ts : new Date(r.ts), value: Number(r.value) });
      }
    }
    const byDay = new Map<string, number[]>();
    for (const p of allPoints) {
      const day = p.ts.toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(p.value);
    }
    const data = Array.from(byDay.entries())
      .map(([day, vals]) => ({ ts: `${day}T12:00:00.000Z`, value: vals.reduce((a, b) => a + b, 0) / vals.length }))
      .sort((a, b) => a.ts.localeCompare(b.ts));
    return { key: 'eq.leaders', granularity: '1d', data };
  }

  async getScoreHistory(range: string) {
    // Fetch last 52 rows without date filter so we always get data regardless of DB date handling
    const all: unknown[] = await this.scoresRepo.find({
      order: { week_start_date: 'DESC' },
      take: 52,
    });
    const since = this.parseRange(range);
    const sinceStr = since.toISOString().slice(0, 10);
    const byWeek = new Map<string, { week_start_date: string; score: number }>();
    for (const row of all) {
      const r = row as { week_start_date?: string; score?: number };
      const w = r.week_start_date != null ? String(r.week_start_date).slice(0, 10) : '';
      if (!w) continue;
      if (w < sinceStr) continue;
      if (!byWeek.has(w)) byWeek.set(w, { week_start_date: w, score: Number(r.score) ?? 0 });
    }
    const sorted = Array.from(byWeek.values()).sort((a, b) => a.week_start_date.localeCompare(b.week_start_date));
    const last12 = sorted.slice(-12);
    return { data: last12 };
  }

  private parseRange(range: string): Date {
    const now = new Date();
    const m = range.match(/^(\d+)(d|w)$/);
    if (!m) return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const n = parseInt(m[1], 10);
    const unit = m[2];
    if (unit === 'd') return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
    return new Date(now.getTime() - n * 7 * 24 * 60 * 60 * 1000);
  }
}
