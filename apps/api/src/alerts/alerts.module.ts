import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertRule, AlertFired, NotificationDelivery, IndicatorPoint, StatusSnapshot } from '../database/entities';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { RulesEngine } from './rules-engine';
import { NotificationService } from './notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AlertRule,
      AlertFired,
      NotificationDelivery,
      IndicatorPoint,
      StatusSnapshot,
    ]),
  ],
  controllers: [AlertsController],
  providers: [AlertsService, RulesEngine, NotificationService],
  exports: [AlertsService, RulesEngine, NotificationService, TypeOrmModule],
})
export class AlertsModule {}
