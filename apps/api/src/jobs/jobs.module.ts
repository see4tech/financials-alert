import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  IndicatorPointRaw,
  IndicatorPoint,
  DerivedMetric,
  StatusSnapshot,
  WeeklyScore,
} from '../database/entities';
import { AlertRule, AlertFired, NotificationDelivery } from '../database/entities';
import { FetchProcessor } from './fetch.processor';
import { FetchScheduler } from './fetch.scheduler';
import { AggregateProcessor } from './aggregate.processor';
import { DerivedProcessor } from './derived.processor';
import { StatusProcessor } from './status.processor';
import { RulesEvalProcessor } from './rules-eval.processor';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'fetch' },
      { name: 'aggregate' },
      { name: 'derived' },
      { name: 'status' },
      { name: 'rules-eval' },
    ),
    TypeOrmModule.forFeature([
      IndicatorPointRaw,
      IndicatorPoint,
      DerivedMetric,
      StatusSnapshot,
      WeeklyScore,
      AlertRule,
      AlertFired,
      NotificationDelivery,
    ]),
    AlertsModule,
  ],
  providers: [
    FetchProcessor,
    FetchScheduler,
    AggregateProcessor,
    DerivedProcessor,
    StatusProcessor,
    RulesEvalProcessor,
  ],
})
export class JobsModule {}
