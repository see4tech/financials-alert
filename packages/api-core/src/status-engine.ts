import { RegistryService } from './registry';
import { linearRegressionSlope, classifyTrend, average, Trend } from './trend';

export type Status = 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';

export interface StatusResult {
  status: Status;
  trend: Trend;
  explanation: string;
}

interface Point {
  ts: Date;
  value: number;
}

export class StatusEngine {
  constructor(private readonly registry: RegistryService) {}

  compute(
    indicatorKey: string,
    points: Point[],
    derived: { slope?: number; ma_21d?: number; pct_14d?: number },
    stalenessMs: number,
    latestTs: Date,
  ): StatusResult {
    const config = this.registry.getByKey(indicatorKey);
    if (!config) return { status: 'UNKNOWN', trend: 'FLAT', explanation: 'Unknown indicator' };

    const now = Date.now();
    if (latestTs.getTime() < now - stalenessMs) {
      return { status: 'UNKNOWN', trend: 'FLAT', explanation: 'Data stale' };
    }

    const slope = derived.slope ?? (points.length >= 2 ? linearRegressionSlope(points.map((p) => p.value)) : 0);
    const trend = classifyTrend(slope, config.epsilon);

    if (indicatorKey === 'macro.us10y') return this.status10Y(trend, points);
    if (indicatorKey === 'macro.dxy') return this.statusDXY(trend);
    if (indicatorKey === 'eq.nasdaq') return this.statusNasdaq(trend, points, derived);
    if (indicatorKey === 'eq.leaders') return this.statusLeaders(points, derived);
    if (indicatorKey === 'crypto.btc') return this.statusBTC(points, derived);
    if (indicatorKey === 'sent.fng') return this.statusFNG(points, trend);

    return { status: 'UNKNOWN', trend, explanation: 'No status rule' };
  }

  private status10Y(trend: Trend, points: Point[]): StatusResult {
    const recent = points.slice(-14).map((p) => p.value);
    const high2w = recent.length ? Math.max(...recent) : 0;
    const last = points.length ? points[points.length - 1].value : 0;
    if (trend === 'FALLING' || trend === 'FLAT') {
      return { status: 'GREEN', trend, explanation: '21D slope negative or flat; no new 2-week highs' };
    }
    if (last >= high2w * 0.998) {
      return { status: 'RED', trend, explanation: 'RISING and breaks 2–4 week highs' };
    }
    return { status: 'YELLOW', trend, explanation: 'Mild RISING but below recent peak' };
  }

  private statusDXY(trend: Trend): StatusResult {
    if (trend === 'FALLING') return { status: 'GREEN', trend, explanation: 'DXY falling' };
    if (trend === 'RISING') return { status: 'RED', trend, explanation: 'DXY rising' };
    return { status: 'YELLOW', trend, explanation: 'DXY flat' };
  }

  private statusNasdaq(trend: Trend, points: Point[], derived: { ma_21d?: number }): StatusResult {
    const last = points.length ? points[points.length - 1].value : 0;
    const ma = derived.ma_21d ?? (points.length >= 21 ? average(points.slice(-21).map((p) => p.value)) : last);
    const aboveMa = last >= ma * 0.995;
    if (aboveMa && trend !== 'FALLING') return { status: 'GREEN', trend, explanation: 'Above 21D MA and trend not falling' };
    if (!aboveMa && trend === 'FALLING') return { status: 'RED', trend, explanation: 'Below MA and making lower lows' };
    return { status: 'YELLOW', trend, explanation: 'Near MA / sideways' };
  }

  private statusLeaders(_points: Point[], _derived: { slope?: number }): StatusResult {
    return { status: 'YELLOW', trend: 'FLAT', explanation: 'Composite; see per-ticker status' };
  }

  private statusBTC(points: Point[], derived: { slope?: number }): StatusResult {
    const config = this.registry.getByKey('crypto.btc');
    const zones = config?.zones;
    const last = points.length ? points[points.length - 1].value : 0;
    const trend = derived.slope !== undefined ? (derived.slope > 0.001 ? 'RISING' : derived.slope < -0.001 ? 'FALLING' : 'FLAT') : 'FLAT';
    if (!zones) return { status: 'YELLOW', trend: 'FLAT', explanation: 'No zones configured' };
    if (last < zones.bear_line) return { status: 'RED', trend: 'FALLING', explanation: 'Breaks below $58k bear line' };
    if (last >= zones.support_low && last <= zones.support_high && trend !== 'FALLING') {
      return { status: 'GREEN', trend: 'RISING', explanation: 'Holds $60k–$64k and trend improving' };
    }
    if (last >= zones.support_low && last <= zones.support_high) {
      return { status: 'YELLOW', trend, explanation: 'Inside zone but repeated tests / high vol' };
    }
    if (last >= zones.bull_confirm) return { status: 'GREEN', trend, explanation: 'Above $75k bull confirm' };
    return { status: 'YELLOW', trend, explanation: 'Between zones' };
  }

  private statusFNG(points: Point[], trend: Trend): StatusResult {
    const last = points.length ? points[points.length - 1].value : 50;
    if (last <= 25 && trend !== 'FALLING') return { status: 'GREEN', trend, explanation: 'Fear high and improving (contrarian fuel)' };
    if (last >= 75) return { status: 'RED', trend, explanation: 'Extreme greed' };
    if (last >= 26 && last <= 60) return { status: 'YELLOW', trend, explanation: 'Neutral' };
    return { status: 'YELLOW', trend, explanation: 'Mixed' };
  }
}
