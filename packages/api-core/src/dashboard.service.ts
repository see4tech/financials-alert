import { IsNull } from 'typeorm';
import { StatusSnapshot, IndicatorPoint, WeeklyScore } from './entities';
import { RegistryService } from './registry';
import type { Repo } from './db-types';

type DerivedRow = { ma_21d?: number | null };

export class DashboardService {
  constructor(
    private readonly snapshotRepo: Repo<StatusSnapshot>,
    private readonly pointsRepo: Repo<IndicatorPoint>,
    private readonly scoreRepo: Repo<WeeklyScore>,
    private readonly derivedRepo: Repo<DerivedRow>,
    private readonly registry: RegistryService,
  ) {}

  async getToday(_timezone: string) {
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
        const d = derived as { ma_21d?: number | null } | null;
        if (d?.ma_21d != null) ma21d = Number(d.ma_21d);
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
    let score = 0;
    let deltaWeek = 0;
    try {
      const scoreRow = await this.scoreRepo.findOne({
        where: { week_start_date: weekStart, user_id: IsNull() },
      });
      score = scoreRow?.score ?? 0;
      deltaWeek = scoreRow?.delta_score ?? 0;
    } catch {
      // avoid 500 if weekly_scores query fails (e.g. bad UUID)
    }

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

  getRecommendations(
    indicators: { key: string; status: string }[],
    score: number,
    scenario: { bull: string; bear: string },
  ): { id: string; tickers?: string[] }[] {
    const m = new Map(indicators.map((i) => [i.key, i.status]));
    const out: { id: string; tickers?: string[] }[] = [];

    // buy_etf: bull strengthening/mixed and score >= 4
    if ((scenario.bull === 'strengthening' || scenario.bull === 'mixed') && score >= 4) {
      out.push({ id: 'buy_etf', tickers: ['QQQ', 'SPY'] });
    }

    // buy_stocks: eq.leaders GREEN and (eq.nasdaq GREEN or YELLOW)
    const leadersOk = m.get('eq.leaders') === 'GREEN';
    const nasdaqOk = m.get('eq.nasdaq') === 'GREEN' || m.get('eq.nasdaq') === 'YELLOW';
    if (leadersOk && nasdaqOk) {
      out.push({ id: 'buy_stocks', tickers: ['NVDA', 'MSFT', 'AAPL', 'GOOGL'] });
    }

    // hold_equity: bull mixed or bear moderate, score 3–5
    if ((scenario.bull === 'mixed' || scenario.bear === 'moderate') && score >= 3 && score <= 5) {
      out.push({ id: 'hold_equity' });
    }

    // reduce_equity: bear elevated or score <= 2
    if (scenario.bear === 'elevated' || score <= 2) {
      out.push({ id: 'reduce_equity' });
    }

    // buy_crypto: crypto.btc GREEN and (sent.fng favorable or neutral – treat GREEN/YELLOW as ok)
    const btcGreen = m.get('crypto.btc') === 'GREEN';
    const fngOk = m.get('sent.fng') === 'GREEN' || m.get('sent.fng') === 'YELLOW';
    if (btcGreen && fngOk) {
      out.push({ id: 'buy_crypto', tickers: ['BTC'] });
    }

    // hold_crypto: crypto.btc YELLOW
    if (m.get('crypto.btc') === 'YELLOW') {
      out.push({ id: 'hold_crypto' });
    }

    // reduce_crypto: crypto.btc RED
    if (m.get('crypto.btc') === 'RED') {
      out.push({ id: 'reduce_crypto' });
    }

    // sell_risk: bear elevated and score <= 2
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
