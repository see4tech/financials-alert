import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StatusSnapshot, IndicatorPoint, WeeklyScore, DerivedMetric } from '../database/entities';
import { RegistryService } from '../indicators/registry.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(StatusSnapshot) private readonly snapshotRepo: Repository<StatusSnapshot>,
    @InjectRepository(IndicatorPoint) private readonly pointsRepo: Repository<IndicatorPoint>,
    @InjectRepository(WeeklyScore) private readonly scoreRepo: Repository<WeeklyScore>,
    @InjectRepository(DerivedMetric) private readonly derivedRepo: Repository<DerivedMetric>,
    private readonly registry: RegistryService,
  ) {}

  async getToday(timezone: string) {
    const coreKeys = this.registry.getCoreKeys();
    const indicators: {
      key: string;
      value?: number;
      trend: string;
      status: string;
      explain?: string;
      ma21d?: number;
      referenceText?: string;
    }[] = [];
    let asOf = new Date();

    for (const key of coreKeys) {
      const latest = await this.snapshotRepo.findOne({
        where: { indicator_key: key },
        order: { ts: 'DESC' },
      });
      if (!latest) continue;
      let value: number | undefined;
      let ma21d: number | undefined;
      let referenceText: string | undefined;
      if (key !== 'eq.leaders') {
        const latestPoint = await this.pointsRepo.findOne({
          where: { indicator_key: key },
          order: { ts: 'DESC' },
        });
        value = latestPoint ? Number(latestPoint.value) : undefined;
        const derived = await this.derivedRepo.findOne({
          where: { indicator_key: key },
          order: { ts: 'DESC' },
        });
        if (derived?.ma_21d != null) ma21d = Number(derived.ma_21d);
        if (key === 'crypto.btc') {
          const config = this.registry.getByKey('crypto.btc');
          const z = config?.zones;
          if (z)
            referenceText = `$${(z.support_low / 1000).toFixed(0)}k–$${(z.support_high / 1000).toFixed(0)}k (zone); <$${(z.bear_line / 1000).toFixed(0)}k red; >$${(z.bull_confirm / 1000).toFixed(0)}k green`;
        }
      }
      indicators.push({
        key: latest.indicator_key,
        value,
        trend: latest.trend,
        status: latest.status,
        explain: latest.explanation ?? undefined,
        ...(ma21d != null && { ma21d }),
        ...(referenceText && { referenceText }),
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
    const recommendations = this.getRecommendations(indicators, score, { bull, bear });

    return {
      asOf: asOf.toISOString(),
      score,
      deltaWeek,
      indicators,
      scenario: { bull, bear },
      recommendations,
    };
  }

  private getRecommendations(
    indicators: { key: string; status: string }[],
    score: number,
    scenario: { bull: string; bear: string },
  ): { id: string; tickers?: string[] }[] {
    const m = new Map(indicators.map((i) => [i.key, i.status]));
    const out: { id: string; tickers?: string[] }[] = [];

    if ((scenario.bull === 'strengthening' || scenario.bull === 'mixed') && score >= 4) {
      out.push({ id: 'buy_etf', tickers: ['QQQ', 'SPY'] });
    }

    const leadersOk = m.get('eq.leaders') === 'GREEN';
    const nasdaqOk = m.get('eq.nasdaq') === 'GREEN' || m.get('eq.nasdaq') === 'YELLOW';
    if (leadersOk && nasdaqOk) {
      out.push({ id: 'buy_stocks', tickers: ['NVDA', 'MSFT', 'AAPL', 'GOOGL'] });
    }

    if ((scenario.bull === 'mixed' || scenario.bear === 'moderate') && score >= 3 && score <= 5) {
      out.push({ id: 'hold_equity' });
    }

    if (scenario.bear === 'elevated' || score <= 2) {
      out.push({ id: 'reduce_equity' });
    }

    const btcGreen = m.get('crypto.btc') === 'GREEN';
    const fngOk = m.get('sent.fng') === 'GREEN' || m.get('sent.fng') === 'YELLOW';
    if (btcGreen && fngOk) {
      out.push({ id: 'buy_crypto', tickers: ['BTC'] });
    }

    if (m.get('crypto.btc') === 'YELLOW') {
      out.push({ id: 'hold_crypto' });
    }

    if (m.get('crypto.btc') === 'RED') {
      out.push({ id: 'reduce_crypto' });
    }

    if (scenario.bear === 'elevated' && score <= 2) {
      out.push({ id: 'sell_risk' });
    }

    return out;
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
