import { en } from './en';

export const es: typeof en = {
  nav: {
    home: 'Inicio',
    dashboard: 'Panel',
    indicators: 'Indicadores',
    alerts: 'Alertas',
    settings: 'Ajustes',
    logout: 'Cerrar sesión',
    login: 'Iniciar sesión',
    signup: 'Registrarse',
  },
  auth: {
    login: 'Iniciar sesión',
    signup: 'Registrarse',
    email: 'Correo electrónico',
    password: 'Contraseña',
    loginError: 'Correo o contraseña incorrectos.',
    signupError: 'Error al registrarse. Prueba otro correo o revisa la contraseña.',
    signupSuccess: 'Cuenta creada. Ya has iniciado sesión.',
    notConfigured: 'Auth no está configurado. Configura SUPABASE_URL y SUPABASE_ANON_KEY en Netlify (o en tu entorno). Puedes usar la app desde el Panel.',
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
    weeklyScoreBreakdown: 'Cómo se llega a esta puntuación',
    weeklyScoreBreakdownHint: 'La puntuación es el número de indicadores en VERDE en el último cálculo (cada vez que pulsas Actualizar o corre el job).',
    scoreStatusGreen: 'VERDE',
    scoreStatusYellow: 'ÁMBAR',
    scoreStatusRed: 'ROJO',
    scoreStatusUnknown: '—',
    indicatorShortLabel: {
      'macro.us10y': '10Y',
      'macro.dxy': 'DXY',
      'eq.nasdaq': 'Nasdaq',
      'eq.leaders': 'Líderes',
      'crypto.btc': 'BTC',
      'sent.fng': 'F&G',
    },
    refreshHint: 'Los indicadores diarios (10Y, DXY, Nasdaq, Fear & Greed) se actualizan una vez al día; BTC y líderes pueden cambiar cada pocas horas.',
    deltaWeek: 'Δ semana',
    scoreHistory: 'Historial (12 sem)',
    scoreHistoryRange: 'Rango: últimas 12 semanas.',
    scoreHistoryEmpty: 'Sin datos aún. Pulsa «Actualizar» para ejecutar el job; tras guardar la puntuación semanal, aquí aparecerá al menos una barra. Si ya pulsaste Actualizar y sigue vacío, haz un despliegue para que la API use la última versión.',
    scoreHistoryTooltip: 'Puntuación semanal de las últimas 12 semanas. Cada barra = una semana (lunes–domingo). Pasa el ratón para ver fecha y valor.',
    scoreHistoryCaption: '0–8 = nº indicadores en verde. Cada barra = 1 semana.',
    scoreHistoryWhatItIs: 'Cada barra es la puntuación de esa semana: cuántos indicadores estaban en VERDE (0–8). Es el valor del último cálculo de esa semana (un momento, no un promedio de 7 días). No se compara con otra serie.',
    scoreHistoryHowToInterpret: 'Sirve para ver si la situación mejora (barras al alza) o empeora (barras a la baja). Más indicadores en verde = contexto más favorable. Si solo ves una o pocas barras, es porque el sistema lleva poco tiempo guardando datos.',
    scoreHistoryHoverLabel: 'Semana',
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
    backfillHistory: 'Cargar historial 90 días',
    backfilling: 'Cargando…',
    backfillSuccess: 'Historial de 90 días cargado. Los gráficos de indicadores y el historial de puntuación (12 sem) se actualizarán.',
    backfillHint: 'Una vez: descarga datos históricos de los últimos 90 días para todos los indicadores.',
    backfillWithSecret: 'Cargar historial con secret',
    cancel: 'Cancelar',
    errorHint: 'Puedes ejecutar el job de datos para rellenar la base de datos y luego actualizar.',
    ma21d: 'Media 21 d',
    referenceLabel: 'Referencia:',
    favorableLabel: 'Qué se considera favorable:',
    favorable: {
      'macro.us10y':
        'Rendimiento estable o a la baja; sin nuevos máximos de 2–4 semanas.',
      'macro.dxy': 'DXY a la baja (dólar más débil).',
      'eq.nasdaq':
        'Precio por encima de la media 21 días y tendencia no bajista.',
      'eq.leaders':
        'Mayoría de líderes en verde (3+ de 4).',
      'crypto.btc':
        'BTC mantiene $60k–$64k con tendencia alcista o cierra por encima de $75k.',
      'sent.fng':
        'Miedo alto (≤25) que mejora, o zona neutral (26–60).',
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
    recommendationsTitle: 'Recomendaciones',
    recommendationsEmpty: 'Sin recomendaciones específicas para el estado actual.',
    myAssets: 'Mis activos',
    myAssetsHint: 'Busca y añade activos (acciones, ETF, materias primas, cripto) para obtener recomendaciones de la IA según el panel y los precios actuales.',
    searchAssetLabel: 'Buscar activo',
    searchAssetPlaceholder: 'Buscar por símbolo o nombre (ej. AAPL, Bitcoin, Vanguard)…',
    noSymbolsFound: 'No se encontraron símbolos.',
    populateHint: 'Intenta con otro término de búsqueda o verifica la ortografía.',
    alreadyAdded: 'Añadido',
    populateSymbols: 'Cargar símbolos',
    populateSymbolsHint: 'Carga todos los símbolos de acciones, ETF, materias primas y cripto desde Twelve Data y CoinGecko.',
    populateSuccess: 'Símbolos cargados exitosamente.',
    assetSymbol: 'Símbolo',
    assetType: 'Tipo',
    assetTypeStock: 'Acción',
    assetTypeEtf: 'ETF',
    assetTypeCommodity: 'Materia prima',
    assetTypeCrypto: 'Cripto',
    addAsset: 'Añadir',
    removeAsset: 'Quitar',
    generateRecommendations: 'Generar recomendaciones',
    noAssetsHint: 'Añade al menos un activo arriba para generar recomendaciones de la IA.',
    configureLlmHint: 'Configura un LLM (OpenAI) en Ajustes para usar las recomendaciones.',
    entryPrice: 'Entrada',
    exitPrice: 'Salida',
    takeProfit: 'Take profit',
    stopLoss: 'Stop loss',
    actionBuy: 'Comprar',
    actionSell: 'Vender',
    actionHold: 'Mantener',
    scanMarket: 'Escanear mercado',
    scanMarketHint: 'Escanea acciones, ETFs, materias primas y cripto en todo el mercado para encontrar las 5 mejores oportunidades de compra usando análisis de IA.',
    scanResults: 'Escáner de mercado',
    scanEmpty: 'No se encontraron resultados. Intenta de nuevo más tarde.',
    currentPrice: 'Precio actual',
    recommendations: {
      buy_etf: 'Considera invertir en fondos que replican el mercado (p. ej. QQQ, SPY)',
      buy_etf_desc: 'Las condiciones apoyan poner algo de dinero en bolsa de forma diversificada.',
      buy_stocks: 'Considera comprar acciones de empresas grandes (p. ej. NVDA, Apple, Microsoft)',
      buy_stocks_desc: 'Los indicadores de mercado y de grandes empresas están favorables.',
      hold_equity: 'Mantén lo que tienes en acciones; no conviene hacer cambios grandes',
      hold_equity_desc: 'El contexto es mixto; mejor esperar antes de comprar o vender mucho.',
      reduce_equity: 'Considera vender parte de tus acciones o no comprar más por ahora',
      reduce_equity_desc: 'Hay riesgo de que el mercado baje; es mejor protegerse y reducir lo que tienes en bolsa.',
      buy_crypto: 'Considera añadir algo de criptomonedas (p. ej. Bitcoin)',
      buy_crypto_desc: 'Bitcoin y el sentimiento de mercado están en zona favorable.',
      hold_crypto: 'Si tienes cripto, manténla; no es momento de vender ni de comprar mucho más',
      hold_crypto_desc: 'Bitcoin está en zona de precaución; mejor no mover.',
      reduce_crypto: 'Considera vender parte de tus criptomonedas o no comprar más',
      reduce_crypto_desc: 'Bitcoin está en zona de riesgo; conviene reducir lo que tienes en cripto.',
      sell_risk: 'Considera vender parte de tus inversiones más arriesgadas (acciones, cripto)',
      sell_risk_desc: 'El contexto es muy desfavorable; es mejor tener más efectivo y menos en bolsa o cripto.',
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
  settings: {
    title: 'Ajustes',
    llmSectionTitle: 'Proveedor de IA (para recomendaciones)',
    llmSectionHint: 'Elige tu proveedor y guarda tu API key. La clave se guarda de forma segura y no se vuelve a mostrar.',
    llmProvider: 'Proveedor',
    llmProviderOpenAI: 'OpenAI',
    llmProviderClaude: 'Claude (Anthropic)',
    llmProviderGemini: 'Gemini (Google)',
    llmApiKey: 'API key',
    llmApiKeyPlaceholder: 'Introduce tu API key',
    llmApiKeyPlaceholderSaved: 'Introduce una nueva clave para reemplazar la guardada',
    llmApiKeySaved: 'Ya hay una clave guardada. Introduce un valor nuevo solo para reemplazarla.',
    llmSaved: 'Ajustes guardados.',
    save: 'Guardar',
    apiKeyRequired: 'La API key es obligatoria.',
    signInRequired: 'Debes iniciar sesión para guardar los ajustes.',
  },
  alerts: {
    title: 'Alertas',
    rules: 'Reglas',
    on: 'Activado',
    off: 'Desactivado',
    noRules: 'No hay reglas. Crea una más abajo.',
    firedAlerts: 'Alertas disparadas (30d)',
    noFired: 'No se han disparado alertas.',
    createRule: 'Crear regla',
    editRule: 'Editar regla',
    deleteRule: 'Borrar',
    confirmDelete: '¿Borrar esta regla? No se puede deshacer.',
    name: 'Nombre',
    conditionType: 'Tipo de condición',
    conditionCrossBelow: 'Cruzar por debajo del umbral',
    conditionCrossAbove: 'Cruzar por encima del umbral',
    conditionTrendChange: 'Cambio de tendencia',
    conditionPersistence: 'Persistencia (ej. estado verde)',
    indicator: 'Indicador',
    threshold: 'Umbral',
    confirmations: 'Confirmaciones',
    enabled: 'Activada',
    sendEmail: 'Enviar email al dispararse',
    emailRecipientNote: 'El destinatario se configura con ALERT_EMAIL en Netlify.',
    save: 'Guardar',
    cancel: 'Cancelar',
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
