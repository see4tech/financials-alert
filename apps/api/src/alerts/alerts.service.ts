import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertRule, AlertFired } from '../database/entities';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(AlertRule) private readonly ruleRepo: Repository<AlertRule>,
    @InjectRepository(AlertFired) private readonly firedRepo: Repository<AlertFired>,
  ) {}

  async getHistory(_range: string) {
    return this.firedRepo.find({
      order: { ts: 'DESC' },
      take: 100,
    });
  }

  async listRules() {
    return this.ruleRepo.find({ order: { id: 'ASC' } });
  }

  async createRule(json_rule: Record<string, unknown>) {
    const rule = this.ruleRepo.create({ json_rule, user_id: null as unknown as string });
    return this.ruleRepo.save(rule);
  }

  async getRule(id: string) {
    return this.ruleRepo.findOne({ where: { id } });
  }

  async updateRule(id: string, updates: { json_rule?: Record<string, unknown>; is_enabled?: boolean }) {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) return null;
    if (updates.json_rule != null) rule.json_rule = updates.json_rule;
    if (updates.is_enabled != null) rule.is_enabled = updates.is_enabled;
    return this.ruleRepo.save(rule);
  }

  async deleteRule(id: string) {
    const rule = await this.ruleRepo.findOne({ where: { id } });
    if (!rule) return false;
    await this.ruleRepo.remove(rule);
    return true;
  }
}
