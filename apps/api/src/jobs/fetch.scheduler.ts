import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { RegistryService } from '../indicators/registry.service';

@Injectable()
export class FetchScheduler implements OnModuleInit {
  constructor(
    @InjectQueue('fetch') private readonly fetchQueue: Queue,
    @InjectQueue('aggregate') private readonly aggregateQueue: Queue,
    @InjectQueue('derived') private readonly derivedQueue: Queue,
    @InjectQueue('status') private readonly statusQueue: Queue,
    @InjectQueue('rules-eval') private readonly rulesEvalQueue: Queue,
    private readonly registry: RegistryService,
  ) {}

  onModuleInit(): void {
    const enabled = this.registry.getEnabled();
    for (const ind of enabled) {
      this.fetchQueue.add(
        'poll',
        { indicatorKey: ind.key },
        {
          repeat: { every: Math.max(60_000, ind.poll_interval_sec * 1000) },
          jobId: `fetch-${ind.key}`,
        },
      );
    }
    this.statusQueue.add('snapshot', {}, { repeat: { every: 15 * 60 * 1000 }, jobId: 'status-snapshot' });
    this.rulesEvalQueue.add('eval', {}, { repeat: { every: 15 * 60 * 1000 }, jobId: 'rules-eval' });
  }
}
