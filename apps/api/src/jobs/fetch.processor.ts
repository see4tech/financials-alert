import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IndicatorPointRaw } from '../database/entities';
import { ProviderFactory } from '../providers/provider.factory';

@Processor('fetch')
export class FetchProcessor extends WorkerHost {
  constructor(
    @InjectRepository(IndicatorPointRaw)
    private readonly rawRepo: Repository<IndicatorPointRaw>,
    private readonly providerFactory: ProviderFactory,
    @InjectQueue('aggregate') private readonly aggregateQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ indicatorKey: string }>): Promise<void> {
    const { indicatorKey } = job.data;
    const adapter = this.providerFactory.getAdapter(indicatorKey);
    if (!adapter) return;

    try {
      const points = await adapter.fetch(indicatorKey, {});
      if (points.length === 0) return;
      const keys = [...new Set(points.map((p) => p.indicatorKey))];
      for (const p of points) {
        await this.rawRepo
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
      for (const key of keys) {
        await this.aggregateQueue.add('aggregate', { indicatorKey: key }, { delay: 2000 });
      }
    } catch (err) {
      job.log(String(err));
      throw err;
    }
  }
}
