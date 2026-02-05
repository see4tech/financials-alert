import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('today')
  async today(@Query('timezone') timezone?: string) {
    return this.dashboard.getToday(timezone || 'America/Santo_Domingo');
  }
}
