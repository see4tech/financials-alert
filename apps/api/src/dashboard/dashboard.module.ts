import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IndicatorPoint, DerivedMetric, WeeklyScore, StatusSnapshot } from '../database/entities';
import { DashboardController } from './dashboard.controller';
import { IndicatorsController, ScoreController } from './indicators.controller';
import { DashboardService } from './dashboard.service';
import { IndicatorsService } from './indicators.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IndicatorPoint, DerivedMetric, WeeklyScore, StatusSnapshot]),
  ],
  controllers: [DashboardController, IndicatorsController, ScoreController],
  providers: [DashboardService, IndicatorsService],
  exports: [DashboardService, IndicatorsService],
})
export class DashboardModule {}
