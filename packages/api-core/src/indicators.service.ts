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
    const points = await this.pointsRepo.find({
      where: { indicator_key: key, ts: MoreThan(since) },
      order: { ts: 'ASC' },
      take: 500,
    });
    return { key, granularity: '1d', data: points };
  }

  async getScoreHistory(range: string) {
    const since = this.parseRange(range);
    const sinceStr = since.toISOString().slice(0, 10);
    const all = await this.scoresRepo.find({
      where: { week_start_date: MoreThan(sinceStr) },
      order: { week_start_date: 'DESC' },
      take: 52,
    });
    // One row per week (latest score per week in case of duplicates)
    const byWeek = new Map<string, { week_start_date: string; score: number }>();
    for (const row of all) {
      const w = String((row as { week_start_date?: string }).week_start_date).slice(0, 10);
      if (!byWeek.has(w)) byWeek.set(w, { week_start_date: w, score: Number((row as { score?: number }).score) });
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
