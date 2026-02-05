import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { IndicatorPointRaw, IndicatorPoint } from '../database/entities';
import { RegistryService } from '../indicators/registry.service';

@Processor('aggregate')
export class AggregateProcessor extends WorkerHost {
  constructor(
    @InjectRepository(IndicatorPointRaw) private readonly rawRepo: Repository<IndicatorPointRaw>,
    @InjectRepository(IndicatorPoint) private readonly pointsRepo: Repository<IndicatorPoint>,
    private readonly registry: RegistryService,
    @InjectQueue('derived') private readonly derivedQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ indicatorKey: string }>): Promise<void> {
    const { indicatorKey } = job.data;
    const config = this.registry.getByKey(indicatorKey);
    if (!config) return;

    const since = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000);
    const raws = await this.rawRepo.find({
      where: { indicator_key: indicatorKey, ts: MoreThanOrEqual(since) },
      order: { ts: 'ASC' },
      take: 5000,
    });
    if (raws.length === 0) return;

    const byDay = new Map<string, { ts: Date; value: number }>();
    for (const r of raws) {
      const day = r.ts.toISOString().slice(0, 10);
      const existing = byDay.get(day);
      if (!existing || r.ts > existing.ts) {
        byDay.set(day, { ts: r.ts, value: Number(r.value) });
      }
    }

    for (const [, v] of byDay) {
      await this.pointsRepo
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
    await this.derivedQueue.add('derived', { indicatorKey }, { delay: 1000 });
  }
}
