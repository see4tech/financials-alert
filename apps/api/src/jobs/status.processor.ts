import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, IsNull } from 'typeorm';
import { IndicatorPoint, DerivedMetric, StatusSnapshot, WeeklyScore } from '../database/entities';
import { RegistryService } from '../indicators/registry.service';
import { StatusEngine } from '../indicators/status-engine';

@Processor('status')
export class StatusProcessor extends WorkerHost {
  constructor(
    @InjectRepository(IndicatorPoint) private readonly pointsRepo: Repository<IndicatorPoint>,
    @InjectRepository(DerivedMetric) private readonly derivedRepo: Repository<DerivedMetric>,
    @InjectRepository(StatusSnapshot) private readonly snapshotRepo: Repository<StatusSnapshot>,
    @InjectRepository(WeeklyScore) private readonly scoreRepo: Repository<WeeklyScore>,
    private readonly registry: RegistryService,
    private readonly statusEngine: StatusEngine,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const ts = new Date();
    const coreKeys = this.registry.getCoreKeys().filter((k) => this.registry.getByKey(k)?.enabled);
    const results: { key: string; status: string; trend: string; explanation: string }[] = [];

    for (const key of coreKeys) {
      if (key === 'eq.leaders') {
        const leaderResult = await this.computeLeaders(ts);
        results.push(leaderResult);
        await this.snapshotRepo.save({
          ts,
          indicator_key: key,
          status: leaderResult.status,
          trend: leaderResult.trend,
          explanation: leaderResult.explanation,
          meta: null,
        });
        continue;
      }

      const config = this.registry.getByKey(key);
      if (!config) continue;

      const stalenessMs = config.poll_interval_sec * 3 * 1000;
      const since = new Date(Date.now() - (config.trend_window_days + 5) * 24 * 60 * 60 * 1000);

      const points = await this.pointsRepo.find({
        where: { indicator_key: key, ts: MoreThanOrEqual(since), granularity: '1d' },
        order: { ts: 'ASC' },
        take: 50,
      });
      const latestPoint = points.length ? points[points.length - 1] : null;
      const latestTs = latestPoint?.ts ?? new Date(0);

      const derivedRow = await this.derivedRepo.findOne({
        where: { indicator_key: key, ts: MoreThanOrEqual(since) },
        order: { ts: 'DESC' },
      });
      const derived = {
        slope: derivedRow?.slope_21d != null ? Number(derivedRow.slope_21d) : undefined,
        ma_21d: derivedRow?.ma_21d != null ? Number(derivedRow.ma_21d) : undefined,
        pct_14d: derivedRow?.pct_14d != null ? Number(derivedRow.pct_14d) : undefined,
      };

      const result = this.statusEngine.compute(
        key,
        points.map((p) => ({ ts: p.ts, value: Number(p.value) })),
        derived,
        stalenessMs,
        latestTs,
      );
      results.push({ key, ...result });
      await this.snapshotRepo.save({
        ts,
        indicator_key: key,
        status: result.status,
        trend: result.trend,
        explanation: result.explanation,
        meta: null,
      });
    }

    const score = results.filter((r) => r.status === 'GREEN').length;
    const weekStart = this.weekStart(ts);
    const lastWeeks = await this.scoreRepo.find({
      where: { user_id: IsNull() },
      order: { week_start_date: 'DESC' },
      take: 2,
    });
    const prevWeekStart = lastWeeks.length >= 2 ? lastWeeks[1].week_start_date : this.prevWeek(weekStart);
    const prevScore = await this.scoreRepo.findOne({
      where: { week_start_date: prevWeekStart, user_id: IsNull() },
    });
    const delta = prevScore ? score - prevScore.score : 0;
    const existing = await this.scoreRepo.findOne({
      where: { week_start_date: weekStart, user_id: IsNull() },
    });
    if (existing) {
      existing.score = score;
      existing.delta_score = delta;
      await this.scoreRepo.save(existing);
    } else {
      await this.scoreRepo.save({
        week_start_date: weekStart,
        user_id: null,
        score,
        delta_score: delta,
        notes: null,
      });
    }
  }

  private async computeLeaders(ts: Date): Promise<{ key: string; status: string; trend: string; explanation: string }> {
    const tickers = ['NVDA', 'MSFT', 'AAPL', 'GOOGL'];
    let green = 0;
    let red = 0;
    const config = this.registry.getByKey('eq.nasdaq');
    const epsilon = config?.epsilon ?? 0.001;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    for (const sym of tickers) {
      const key = `eq.leaders.${sym}`;
      const points = await this.pointsRepo.find({
        where: { indicator_key: key, ts: MoreThanOrEqual(since), granularity: '1d' },
        order: { ts: 'ASC' },
        take: 25,
      });
      if (points.length < 5) continue;
      const derivedRow = await this.derivedRepo.findOne({
        where: { indicator_key: key },
        order: { ts: 'DESC' },
      });
      const result = this.statusEngine.compute(
        'eq.nasdaq',
        points.map((p) => ({ ts: p.ts, value: Number(p.value) })),
        {
          slope: derivedRow?.slope_21d != null ? Number(derivedRow.slope_21d) : undefined,
          ma_21d: derivedRow?.ma_21d != null ? Number(derivedRow.ma_21d) : undefined,
        },
        24 * 3600 * 1000,
        points[points.length - 1].ts,
      );
      if (result.status === 'GREEN') green++;
      if (result.status === 'RED') red++;
    }

    const status = green >= 3 ? 'GREEN' : green === 2 ? 'YELLOW' : red >= 2 ? 'RED' : 'YELLOW';
    const trend = green >= 3 ? 'RISING' : red >= 2 ? 'FALLING' : 'FLAT';
    return {
      key: 'eq.leaders',
      status,
      trend,
      explanation: `${green} leaders green, ${red} red`,
    };
  }

  private weekStart(d: Date): string {
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setUTCDate(diff);
    return monday.toISOString().slice(0, 10);
  }

  private prevWeek(weekStart: string): string {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  }
}
