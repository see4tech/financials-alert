import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('api')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get('alerts/history')
  async history(@Query('range') range?: string) {
    return this.alerts.getHistory(range || '30d');
  }

  @Get('rules')
  async listRules() {
    return this.alerts.listRules();
  }

  @Get('rules/:id')
  async getRule(@Param('id') id: string) {
    return this.alerts.getRule(id);
  }

  @Post('rules')
  async createRule(@Body() body: { json_rule: Record<string, unknown> }) {
    return this.alerts.createRule(body.json_rule);
  }

  @Patch('rules/:id')
  async updateRule(
    @Param('id') id: string,
    @Body() body: { json_rule?: Record<string, unknown>; is_enabled?: boolean },
  ) {
    return this.alerts.updateRule(id, body);
  }

  @Delete('rules/:id')
  async deleteRule(@Param('id') id: string) {
    const ok = await this.alerts.deleteRule(id);
    return ok ? { deleted: true } : { deleted: false };
  }
}
