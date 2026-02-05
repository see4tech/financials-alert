import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { StatusSnapshot, IndicatorPoint, WeeklyScore } from '../database/entities';
import { RegistryService } from '../indicators/registry.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(StatusSnapshot) private readonly snapshotRepo: Repository<StatusSnapshot>,
    @InjectRepository(IndicatorPoint) private readonly pointsRepo: Repository<IndicatorPoint>,
    @InjectRepository(WeeklyScore) private readonly scoreRepo: Repository<WeeklyScore>,
    private readonly registry: RegistryService,
  ) {}

  async getToday(timezone: string) {
    const coreKeys = this.registry.getCoreKeys();
    const indicators: { key: string; value?: number; trend: string; status: string; explain?: string }[] = [];
    let asOf = new Date();

    for (const key of coreKeys) {
      const latest = await this.snapshotRepo.findOne({
        where: { indicator_key: key },
        order: { ts: 'DESC' },
      });
      if (!latest) continue;
      let value: number | undefined;
      if (key !== 'eq.leaders') {
        const latestPoint = await this.pointsRepo.findOne({
          where: { indicator_key: key },
          order: { ts: 'DESC' },
        });
        value = latestPoint ? Number(latestPoint.value) : undefined;
      }
      indicators.push({
        key: latest.indicator_key,
        value,
        trend: latest.trend,
        status: latest.status,
        explain: latest.explanation ?? undefined,
      });
      if (latest.ts > asOf) asOf = latest.ts;
    }

    const weekStart = this.weekStart(new Date());
    const scoreRow = await this.scoreRepo.findOne({
      where: { week_start_date: weekStart, user_id: IsNull() },
    });
    const score = scoreRow?.score ?? 0;
    const deltaWeek = scoreRow?.delta_score ?? 0;

    const bull = this.scenarioBull(indicators);
    const bear = this.scenarioBear(indicators);

    return {
      asOf: asOf.toISOString(),
      score,
      deltaWeek,
      indicators,
      scenario: { bull, bear },
    };
  }

  private weekStart(d: Date): string {
    const day = d.getUTCDay();
    const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setUTCDate(diff);
    return monday.toISOString().slice(0, 10);
  }

  private scenarioBull(indicators: { key: string; status: string }[]): string {
    const m = new Map(indicators.map((i) => [i.key, i.status]));
    const yieldsOk = m.get('macro.us10y') === 'GREEN';
    const nasdaqOk = m.get('eq.nasdaq') === 'GREEN' || m.get('eq.nasdaq') === 'YELLOW';
    const btcOk = m.get('crypto.btc') === 'GREEN' || m.get('crypto.btc') === 'YELLOW';
    const liqOk = m.get('crypto.liquidations') === 'GREEN';
    const count = [yieldsOk, nasdaqOk, btcOk, liqOk].filter(Boolean).length;
    return count >= 3 ? 'strengthening' : count >= 1 ? 'mixed' : 'low';
  }

  private scenarioBear(indicators: { key: string; status: string }[]): string {
    const m = new Map(indicators.map((i) => [i.key, i.status]));
    const yieldsRed = m.get('macro.us10y') === 'RED';
    const nasdaqRed = m.get('eq.nasdaq') === 'RED';
    const btcRed = m.get('crypto.btc') === 'RED';
    const count = [yieldsRed, nasdaqRed, btcRed].filter(Boolean).length;
    return count >= 2 ? 'elevated' : count >= 1 ? 'moderate' : 'low';
  }
}
