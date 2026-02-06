import { en } from './en';

export const es: typeof en = {
  nav: {
    home: 'Inicio',
    dashboard: 'Panel',
    indicators: 'Indicadores',
    alerts: 'Alertas',
  },
  common: {
    loading: 'Cargando...',
    error: 'Error',
  },
  home: {
    title: 'Market Health Checklist',
  },
  dashboard: {
    title: 'Panel',
    asOf: 'Actualizado',
    runJobs: 'Actualizar',
    running: 'Actualizando…',
    weeklyScore: 'Puntuación semanal',
    weeklyScoreTooltip: 'Número de indicadores en estado VERDE esta semana (máx. 6). Se cuenta cada lunes.',
    deltaWeek: 'Δ semana',
    scoreHistory: 'Historial (12 sem)',
    scoreHistoryTooltip: 'Puntuación semanal de las últimas 12 semanas. Cada barra = una semana (lunes–domingo). Pasa el ratón para ver fecha y valor.',
    scoreHistoryCaption: '0–8 = nº indicadores en verde. Cada barra = 1 semana.',
    scenario: 'Escenario',
    bull: 'Alcista',
    bear: 'Bajista',
    indicators: 'Indicadores',
    viewHistory: 'Ver historial',
    noIndicators: 'Aún no hay datos de indicadores',
    noIndicatorsHint:
      'Los datos los rellena un job en segundo plano cada 15 min. Si acabas de desplegar, espera a la siguiente ejecución o dispara POST /.netlify/functions/run-jobs con el header X-Cron-Secret (si tienes CRON_SECRET).',
    apiKeysHint:
      'No hay lugar en la app para guardar API keys. Configúralas en Netlify → Site configuration → Environment variables: FRED_API_KEY (10Y), TWELVE_DATA_API_KEY (DXY/Nasdaq). BTC y Fear & Greed no las necesitan.',
    staleHint:
      'Sin datos recientes. Ejecuta los jobs; si sigue igual, revisa la fuente (p. ej. Twelve Data: Nasdaq usa símbolo QQQ por defecto).',
    cronSecretLabel: 'Cron secret (CRON_SECRET en Netlify):',
    cronSecretPlaceholder: 'Introduce el secret',
    runWithSecret: 'Ejecutar con secret',
    cancel: 'Cancelar',
    errorHint: 'Puedes ejecutar el job de datos para rellenar la base de datos y luego actualizar.',
    favorable: {
      'macro.us10y':
        'Escenario favorable: rendimiento estable o a la baja; sin nuevos máximos de 2–4 semanas.',
      'macro.dxy': 'Escenario favorable: DXY a la baja (dólar más débil).',
      'eq.nasdaq':
        'Escenario favorable: precio por encima de la media 21 días y tendencia no bajista.',
      'eq.leaders':
        'Escenario favorable: mayoría de líderes en verde (3+ de 4).',
      'crypto.btc':
        'Escenario favorable: BTC mantiene $60k–$64k con tendencia alcista o cierra por encima de $75k.',
      'sent.fng':
        'Escenario favorable: miedo alto (≤25) que mejora, o zona neutral (26–60).',
    },
    indicatorTooltip: {
      'macro.us10y':
        'Rendimiento del bono estadounidense a 10 años. Mide el tipo de interés de la deuda pública a 10 años. Lo afectan la política de la Fed, expectativas de inflación y demanda de activos refugio. Fuente: FRED (DGS10).',
      'macro.dxy':
        'Índice del dólar estadounidense. Mide el valor del dólar frente a una cesta de monedas (euro, yen, etc.). Lo afectan la Fed, flujos comerciales y sentimiento de riesgo. Fuente: Twelve Data (UUP/ETF).',
      'eq.nasdaq':
        'Nasdaq-100 (vía ETF QQQ). Sigue a las 100 mayores empresas no financieras del Nasdaq. Lo afectan resultados tecnológicos, tipos de interés y apetito por riesgo. Fuente: Twelve Data.',
      'eq.leaders':
        'Líderes mega-cap: NVDA, MSFT, AAPL, GOOGL. Vista compuesta de nombres clave tech/crecimiento. Fuente: Twelve Data.',
      'crypto.btc':
        'Precio spot de Bitcoin (USD). Lo afectan macro, flujos institucionales y sentimiento. Fuente: CoinGecko.',
      'sent.fng':
        'Índice Miedo y Codicia (0–100). Mide el sentimiento de mercado con encuestas y volatilidad. Bajo = miedo, alto = codicia. Fuente: Alternative.me.',
    },
    scenarioValue: {
      bull: {
        strengthening: 'fortaleciéndose',
        mixed: 'mixto',
        low: 'bajo',
      },
      bear: {
        elevated: 'elevado',
        moderate: 'moderado',
        low: 'bajo',
      },
    },
  },
  trend: {
    rising: 'ALCISTA',
    falling: 'BAJISTA',
    flat: 'LATERAL',
  },
  status: {
    green: 'VERDE',
    red: 'ROJO',
    yellow: 'AMARILLO',
    unknown: 'DESCONOCIDO',
  },
  indicators: {
    title: 'Indicadores',
  },
  indicatorsDetail: {
    noHistory: 'Aún no hay historial',
    noHistoryHint:
      'Los datos los rellena un job programado (cada 15 min). Espera a la siguiente ejecución o dispara /.netlify/functions/run-jobs manualmente.',
    chartHint: 'Cada barra = un día. Valor en tooltip al pasar el ratón.',
    period30: '30D',
    period90: '90D',
  },
  alerts: {
    title: 'Alertas',
    rules: 'Reglas',
    on: 'Activado',
    off: 'Desactivado',
    noRules: 'No hay reglas. Créalas vía API.',
    firedAlerts: 'Alertas disparadas (30d)',
    noFired: 'No se han disparado alertas.',
  },
  explanations: {
    'Data stale': 'Datos desactualizados',
    'Unknown indicator': 'Indicador desconocido',
    'No status rule': 'Sin regla de estado',
    '21D slope negative or flat; no new 2-week highs':
      'Pendiente 21D negativa o plana; sin nuevos máximos de 2 semanas',
    'RISING and breaks 2–4 week highs':
      'Al alza y rompe máximos de 2–4 semanas',
    'Mild RISING but below recent peak':
      'Subida suave pero por debajo del pico reciente',
    'DXY falling': 'DXY a la baja',
    'DXY rising': 'DXY al alza',
    'DXY flat': 'DXY plano',
    'Above 21D MA and trend not falling':
      'Por encima de la MA 21d y tendencia no bajista',
    'Below MA and making lower lows':
      'Por debajo de la MA y mínimos decrecientes',
    'Near MA / sideways': 'Cerca de la MA / lateral',
    'Composite; see per-ticker status':
      'Compuesto; ver estado por ticker',
    'No zones configured': 'Sin zonas configuradas',
    'Breaks below $58k bear line': 'Rompe por debajo de $58k (línea bajista)',
    'Holds $60k–$64k and trend improving':
      'Mantiene $60k–$64k y tendencia mejorando',
    'Inside zone but repeated tests / high vol':
      'Dentro de zona pero pruebas repetidas / alta volatilidad',
    'Above $75k bull confirm': 'Por encima de $75k (confirmación alcista)',
    'Between zones': 'Entre zonas',
    'Fear high and improving (contrarian fuel)':
      'Miedo alto y mejorando (combustible contrarian)',
    'Extreme greed': 'Codicia extrema',
    Neutral: 'Neutral',
    Mixed: 'Mixto',
  },
};

function leadersPattern(explain: string): string | null {
  const m = explain.match(/^(\d+)\s+leaders green,\s*(\d+)\s+red$/);
  if (m) return `${m[1]} líderes en verde, ${m[2]} en rojo`;
  return null;
}

export function translateExplanation(explain: string, dict: typeof es): string {
  const direct = dict.explanations[explain as keyof typeof dict.explanations];
  if (direct) return direct;
  const leaders = leadersPattern(explain);
  if (leaders) return leaders;
  return explain;
}
