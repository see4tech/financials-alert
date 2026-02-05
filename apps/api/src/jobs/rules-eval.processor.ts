import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertRule, AlertFired } from '../database/entities';
import { RulesEngine } from '../alerts/rules-engine';
import { NotificationService } from '../alerts/notification.service';
import { AlertRuleJson } from '../alerts/rules-engine';

@Processor('rules-eval')
export class RulesEvalProcessor extends WorkerHost {
  constructor(
    @InjectRepository(AlertRule) private readonly ruleRepo: Repository<AlertRule>,
    @InjectRepository(AlertFired) private readonly firedRepo: Repository<AlertFired>,
    private readonly rulesEngine: RulesEngine,
    private readonly notification: NotificationService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const rules = await this.ruleRepo.find({ where: { is_enabled: true } });
    for (const rule of rules) {
      try {
        const { fired, payload } = await this.rulesEngine.evaluateRule(rule);
        if (!fired || !payload) continue;

        const dedupeKey = this.rulesEngine.dedupeKey(rule.id, payload);
        const existing = await this.firedRepo.findOne({ where: { dedupe_key: dedupeKey } });
        if (existing) continue;

        const alert = await this.firedRepo.save({
          rule_id: rule.id,
          ts: new Date(),
          payload,
          dedupe_key: dedupeKey,
        });

        const json = rule.json_rule as unknown as AlertRuleJson;
        const actions = json.actions ?? ['email'];
        await this.notification.send(alert.id, payload, actions);
      } catch (err) {
        job.log(`Rule ${rule.id}: ${err}`);
      }
    }
  }
}
