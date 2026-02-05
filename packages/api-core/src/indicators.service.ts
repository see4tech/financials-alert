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
    const scores = await this.scoresRepo.find({
      where: { week_start_date: MoreThan(since.toISOString().slice(0, 10)) },
      order: { week_start_date: 'ASC' },
      take: 52,
    });
    return { data: scores };
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
