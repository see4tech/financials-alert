import { AlertRule, AlertFired } from './entities';
import type { Repo } from './db-types';

export class AlertsService {
  constructor(
    private readonly ruleRepo: Repo<AlertRule>,
    private readonly firedRepo: Repo<AlertFired>,
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
    return this.ruleRepo.save({ json_rule, user_id: null } as Partial<AlertRule>);
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
    if (this.ruleRepo.remove) await this.ruleRepo.remove(rule);
    return true;
  }
}
