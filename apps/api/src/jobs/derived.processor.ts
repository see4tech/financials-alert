import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { IndicatorPoint, DerivedMetric } from '../database/entities';
import { RegistryService } from '../indicators/registry.service';
import { linearRegressionSlope, average } from '../indicators/trend';

@Processor('derived')
export class DerivedProcessor extends WorkerHost {
  constructor(
    @InjectRepository(IndicatorPoint) private readonly pointsRepo: Repository<IndicatorPoint>,
    @InjectRepository(DerivedMetric) private readonly derivedRepo: Repository<DerivedMetric>,
    private readonly registry: RegistryService,
  ) {
    super();
  }

  async process(job: Job<{ indicatorKey: string }>): Promise<void> {
    const { indicatorKey } = job.data;
    const config = this.registry.getByKey(indicatorKey);
    if (!config) return;

    const since = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    const points = await this.pointsRepo.find({
      where: { indicator_key: indicatorKey, ts: MoreThanOrEqual(since), granularity: '1d' },
      order: { ts: 'ASC' },
      take: 100,
    });
    if (points.length < 2) return;

    const values = points.map((p) => ({ ts: p.ts, value: Number(p.value) }));

    for (let i = config.trend_window_days; i < values.length; i++) {
      const window = values.slice(i - config.trend_window_days, i);
      const vals = window.map((v) => v.value);
      const slope21 = linearRegressionSlope(vals);
      const slope14 = window.length >= 14 ? linearRegressionSlope(vals.slice(-14)) : slope21;
      const ma21 = average(vals);
      const v0 = values[i].value;
      const v1d = i >= 1 ? values[i - 1].value : v0;
      const v7d = i >= 7 ? values[i - 7].value : v0;
      const v14d = i >= 14 ? values[i - 14].value : v0;
      const v21d = i >= 21 ? values[i - 21].value : v0;
      const pct1d = v1d !== 0 ? ((v0 - v1d) / v1d) * 100 : 0;
      const pct7d = v7d !== 0 ? ((v0 - v7d) / v7d) * 100 : 0;
      const pct14d = v14d !== 0 ? ((v0 - v14d) / v14d) * 100 : 0;
      const pct21d = v21d !== 0 ? ((v0 - v21d) / v21d) * 100 : 0;

      await this.derivedRepo
        .createQueryBuilder()
        .insert()
        .into(DerivedMetric)
        .values({
          id: crypto.randomUUID(),
          ts: values[i].ts,
          indicator_key: indicatorKey,
          pct_1d: pct1d,
          pct_7d: pct7d,
          pct_14d: pct14d,
          pct_21d: pct21d,
          slope_14d: slope14,
          slope_21d: slope21,
          ma_21d: ma21,
        })
        .orIgnore()
        .execute();
    }
  }
}
