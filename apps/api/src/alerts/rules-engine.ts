import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { AlertRule, AlertFired, IndicatorPoint, StatusSnapshot } from '../database/entities';

export interface AlertRuleCondition {
  type: 'cross_below' | 'cross_above' | 'trend_change' | 'persistence' | 'composite';
  indicatorKey?: string;
  threshold?: number;
  confirmations?: number;
  samplingMinutes?: number;
}

export interface AlertRuleJson {
  id?: string;
  name: string;
  severity?: string;
  cooldownMinutes?: number;
  condition: AlertRuleCondition;
  actions?: string[];
}

@Injectable()
export class RulesEngine {
  constructor(
    @InjectRepository(AlertRule) private readonly ruleRepo: Repository<AlertRule>,
    @InjectRepository(AlertFired) private readonly firedRepo: Repository<AlertFired>,
    @InjectRepository(IndicatorPoint) private readonly pointsRepo: Repository<IndicatorPoint>,
    @InjectRepository(StatusSnapshot) private readonly snapshotRepo: Repository<StatusSnapshot>,
  ) {}

  async evaluateRule(rule: AlertRule): Promise<{ fired: boolean; payload?: Record<string, unknown> }> {
    const json = rule.json_rule as unknown as AlertRuleJson;
    const condition = json.condition;
    if (!condition) return { fired: false };

    const cooldownMs = (json.cooldownMinutes ?? 360) * 60 * 1000;
    const lastFired = await this.firedRepo.findOne({
      where: { rule_id: rule.id },
      order: { ts: 'DESC' },
    });
    if (lastFired && lastFired.ts.getTime() > Date.now() - cooldownMs) {
      return { fired: false };
    }

    if (condition.type === 'cross_below' && condition.indicatorKey != null && condition.threshold != null) {
      return this.evalCrossBelow(condition, json);
    }
    if (condition.type === 'cross_above' && condition.indicatorKey != null && condition.threshold != null) {
      return this.evalCrossAbove(condition, json);
    }
    if (condition.type === 'trend_change' && condition.indicatorKey) {
      return this.evalTrendChange(condition, json);
    }
    if (condition.type === 'persistence' && condition.indicatorKey != null && condition.confirmations != null) {
      return this.evalPersistence(condition, json);
    }
    return { fired: false };
  }

  private async evalCrossBelow(
    condition: AlertRuleCondition,
    json: AlertRuleJson,
  ): Promise<{ fired: boolean; payload?: Record<string, unknown> }> {
    const key = condition.indicatorKey!;
    const threshold = condition.threshold!;
    const confirmations = condition.confirmations ?? 1;
    const since = new Date(Date.now() - (condition.samplingMinutes ?? 5) * confirmations * 60 * 1000);
    const points = await this.pointsRepo.find({
      where: { indicator_key: key, ts: MoreThanOrEqual(since) },
      order: { ts: 'DESC' },
      take: confirmations + 2,
    });
    if (points.length < confirmations) return { fired: false };
    const recent = points.slice(0, confirmations);
    const allBelow = recent.every((p) => Number(p.value) < threshold);
    const prevAbove = points.length > confirmations && Number(points[confirmations].value) >= threshold;
    if (allBelow && prevAbove) {
      return {
        fired: true,
        payload: {
          ruleName: json.name,
          indicatorKey: key,
          threshold,
          value: Number(recent[0].value),
          ts: recent[0].ts.toISOString(),
        },
      };
    }
    return { fired: false };
  }

  private async evalCrossAbove(
    condition: AlertRuleCondition,
    json: AlertRuleJson,
  ): Promise<{ fired: boolean; payload?: Record<string, unknown> }> {
    const key = condition.indicatorKey!;
    const threshold = condition.threshold!;
    const confirmations = condition.confirmations ?? 1;
    const since = new Date(Date.now() - (condition.samplingMinutes ?? 5) * confirmations * 60 * 1000);
    const points = await this.pointsRepo.find({
      where: { indicator_key: key, ts: MoreThanOrEqual(since) },
      order: { ts: 'DESC' },
      take: confirmations + 2,
    });
    if (points.length < confirmations) return { fired: false };
    const recent = points.slice(0, confirmations);
    const allAbove = recent.every((p) => Number(p.value) >= threshold);
    const prevBelow = points.length > confirmations && Number(points[confirmations].value) < threshold;
    if (allAbove && prevBelow) {
      return {
        fired: true,
        payload: {
          ruleName: json.name,
          indicatorKey: key,
          threshold,
          value: Number(recent[0].value),
          ts: recent[0].ts.toISOString(),
        },
      };
    }
    return { fired: false };
  }

  private async evalTrendChange(
    condition: AlertRuleCondition,
    json: AlertRuleJson,
  ): Promise<{ fired: boolean; payload?: Record<string, unknown> }> {
    const key = condition.indicatorKey!;
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const snapshots = await this.snapshotRepo.find({
      where: { indicator_key: key, ts: MoreThanOrEqual(since) },
      order: { ts: 'DESC' },
      take: 5,
    });
    if (snapshots.length < 2) return { fired: false };
    const [latest, prev] = snapshots;
    if (latest.trend !== prev.trend) {
      return {
        fired: true,
        payload: {
          ruleName: json.name,
          indicatorKey: key,
          previousTrend: prev.trend,
          currentTrend: latest.trend,
          ts: latest.ts.toISOString(),
        },
      };
    }
    return { fired: false };
  }

  private async evalPersistence(
    condition: AlertRuleCondition,
    json: AlertRuleJson,
  ): Promise<{ fired: boolean; payload?: Record<string, unknown> }> {
    const key = condition.indicatorKey!;
    const confirmations = condition.confirmations ?? 2;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snapshots = await this.snapshotRepo.find({
      where: { indicator_key: key, ts: MoreThanOrEqual(since) },
      order: { ts: 'DESC' },
      take: confirmations + 2,
    });
    if (snapshots.length < confirmations) return { fired: false };
    const recent = snapshots.slice(0, confirmations);
    const allGreen = recent.every((s) => s.status === 'GREEN');
    if (allGreen) {
      return {
        fired: true,
        payload: {
          ruleName: json.name,
          indicatorKey: key,
          confirmations,
          ts: recent[0].ts.toISOString(),
        },
      };
    }
    return { fired: false };
  }

  dedupeKey(ruleId: string, payload: Record<string, unknown>): string {
    const dateBucket = new Date().toISOString().slice(0, 13);
    return `${ruleId}:${dateBucket}:${JSON.stringify(payload)}`;
  }
}
