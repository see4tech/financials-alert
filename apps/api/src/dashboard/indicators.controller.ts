import { Controller, Get, Param, Query } from '@nestjs/common';
import { IndicatorsService } from './indicators.service';

@Controller('api/indicators')
export class IndicatorsController {
  constructor(private readonly indicators: IndicatorsService) {}

  @Get(':key/history')
  async history(
    @Param('key') key: string,
    @Query('range') range?: string,
    @Query('granularity') granularity?: string,
  ) {
    return this.indicators.getHistory(key, range || '30d', granularity || '1d');
  }
}

@Controller('api/score')
export class ScoreController {
  constructor(private readonly indicators: IndicatorsService) {}

  @Get('history')
  async history(@Query('range') range?: string) {
    return this.indicators.getScoreHistory(range || '12w');
  }
}
