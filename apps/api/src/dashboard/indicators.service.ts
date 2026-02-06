import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { IndicatorPoint, DerivedMetric, WeeklyScore } from '../database/entities';

@Injectable()
export class IndicatorsService {
  constructor(
    @InjectRepository(IndicatorPoint) private readonly pointsRepo: Repository<IndicatorPoint>,
    @InjectRepository(DerivedMetric) private readonly derivedRepo: Repository<DerivedMetric>,
    @InjectRepository(WeeklyScore) private readonly scoresRepo: Repository<WeeklyScore>,
  ) {}

  async getHistory(key: string, range: string, granularity: string) {
    const since = this.parseRange(range);
    const points = await this.pointsRepo.find({
      where: { indicator_key: key, ts: MoreThan(since) },
      order: { ts: 'ASC' },
      take: 500,
    });
    return { key, granularity, data: points };
  }

  async getScoreHistory(range: string) {
    const all = await this.scoresRepo.find({
      order: { week_start_date: 'DESC' },
      take: 52,
    });
    const since = this.parseRange(range);
    const sinceStr = since.toISOString().slice(0, 10);
    const byWeek = new Map<string, { week_start_date: string; score: number }>();
    for (const row of all) {
      const w = row.week_start_date != null ? String(row.week_start_date).slice(0, 10) : '';
      if (!w || w < sinceStr) continue;
      if (!byWeek.has(w)) byWeek.set(w, { week_start_date: w, score: Number(row.score) ?? 0 });
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
