export const en = {
  nav: {
    home: 'Home',
    dashboard: 'Dashboard',
    indicators: 'Indicators',
    alerts: 'Alerts',
  },
  common: {
    loading: 'Loading...',
    error: 'Error',
  },
  home: {
    title: 'Market Health Checklist',
  },
  dashboard: {
    title: 'Dashboard',
    asOf: 'As of',
    runJobs: 'Refresh',
    running: 'Refreshing…',
    weeklyScore: 'Weekly Score',
    deltaWeek: 'Δ week',
    scoreHistory: 'Score history (12w)',
    scenario: 'Scenario',
    bull: 'Bull',
    bear: 'Bear',
    indicators: 'Indicators',
    viewHistory: 'View history',
    noIndicators: 'No indicator data yet',
    noIndicatorsHint:
      'Data is filled by a background job that runs every 15 minutes. If you just deployed, wait for the next run or trigger POST /.netlify/functions/run-jobs manually with header X-Cron-Secret (if you set CRON_SECRET).',
    apiKeysHint:
      'There is no in-app place to store API keys. Set them in Netlify → Site configuration → Environment variables: FRED_API_KEY (required for 10Y yield), TWELVE_DATA_API_KEY (optional, for DXY/Nasdaq). BTC and Fear & Greed work without keys.',
    staleHint:
      'No recent data. Run jobs; if still stale, check the data source (e.g. Twelve Data: Nasdaq uses symbol QQQ by default).',
    cronSecretLabel: 'Cron secret (CRON_SECRET in Netlify):',
    cronSecretPlaceholder: 'Enter secret',
    runWithSecret: 'Run with secret',
    cancel: 'Cancel',
    errorHint: 'You can try running the data job to populate the database, then refresh.',
    favorable: {
      'macro.us10y':
        'Favorable scenario: yield stable or falling; no new 2–4 week highs.',
      'macro.dxy': 'Favorable scenario: DXY falling (weaker dollar).',
      'eq.nasdaq':
        'Favorable scenario: price above 21-day average and trend not falling.',
      'eq.leaders': 'Favorable scenario: majority of leaders green (3+ of 4).',
      'crypto.btc':
        'Favorable scenario: BTC holds $60k–$64k with rising trend or closes above $75k.',
      'sent.fng':
        'Favorable scenario: high fear (≤25) improving, or neutral zone (26–60).',
    },
    indicatorTooltip: {
      'macro.us10y':
        'US 10-year Treasury yield. Measures the interest rate on 10-year US government debt. Affected by Fed policy, inflation expectations, and demand for safe assets. Source: FRED (DGS10).',
      'macro.dxy':
        'US Dollar Index. Measures the value of the US dollar against a basket of major currencies (euro, yen, etc.). Affected by Fed policy, trade flows, and risk sentiment. Source: Twelve Data (UUP/ETF).',
      'eq.nasdaq':
        'Nasdaq-100 (via QQQ ETF). Tracks the performance of the 100 largest non-financial companies on Nasdaq. Affected by tech earnings, rates, and risk appetite. Source: Twelve Data.',
      'eq.leaders':
        'Mega-cap leaders: NVDA, MSFT, AAPL, GOOGL. Composite view of key tech/growth names. Source: Twelve Data.',
      'crypto.btc':
        'Bitcoin spot price (USD). Affected by macro, institutional flows, and sentiment. Source: CoinGecko.',
      'sent.fng':
        'Fear & Greed Index (0–100). Measures market sentiment from surveys and volatility. Low = fear, high = greed. Source: Alternative.me.',
    },
    scenarioValue: {
      bull: {
        strengthening: 'strengthening',
        mixed: 'mixed',
        low: 'low',
      },
      bear: {
        elevated: 'elevated',
        moderate: 'moderate',
        low: 'low',
      },
    },
  },
  trend: {
    rising: 'RISING',
    falling: 'FALLING',
    flat: 'FLAT',
  },
  status: {
    green: 'GREEN',
    red: 'RED',
    yellow: 'YELLOW',
    unknown: 'UNKNOWN',
  },
  indicators: {
    title: 'Indicators',
  },
  indicatorsDetail: {
    noHistory: 'No history yet',
    noHistoryHint:
      'Indicator data is populated by a scheduled job (every 15 min). Wait for the next run or trigger /.netlify/functions/run-jobs manually.',
    chartHint: 'Each bar = one day. Value in tooltip when hovering.',
    period30: '30D',
    period90: '90D',
  },
  alerts: {
    title: 'Alerts',
    rules: 'Rules',
    on: 'On',
    off: 'Off',
    noRules: 'No rules. Create rules via API.',
    firedAlerts: 'Fired alerts (30d)',
    noFired: 'No alerts fired.',
  },
  explanations: {} as Record<string, string>,
};
