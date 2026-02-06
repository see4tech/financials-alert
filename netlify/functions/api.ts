import express, { Request, Response } from 'express';
import serverless from 'serverless-http';
import { createClient } from '@supabase/supabase-js';
import {
  getDb,
  RegistryService,
  DashboardService,
  IndicatorsService,
  AlertsService,
} from '@market-health/api-core';

const LLM_PROVIDERS = ['openai', 'claude', 'gemini'] as const;

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string')
    return (e as { message: string }).message;
  return String(e);
}

/** Validate Bearer token and return user id or null. Uses Supabase anon key for auth.getUser. */
async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const auth = req.headers.authorization;
  const token = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  if (!token) return null;
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  try {
    const supabase = createClient(url, anonKey);
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user?.id) return null;
    return user.id;
  } catch {
    return null;
  }
}

/** Supabase client with service role for reading/writing user_llm_settings (bypasses RLS). */
function getSupabaseService(): ReturnType<typeof createClient> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  return createClient(url, key);
}

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana', XRP: 'ripple',
  USDT: 'tether', USDC: 'usd-coin', DOGE: 'dogecoin', ADA: 'cardano', AVAX: 'avalanche-2',
};

/** Fetch current price for an asset. Returns null if unavailable. */
async function fetchPrice(symbol: string, assetType: string): Promise<number | null> {
  const sym = symbol.trim().toUpperCase();
  if (assetType === 'crypto') {
    const id = COINGECKO_IDS[sym] || sym.toLowerCase();
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, { usd?: number }>;
    const price = data[id]?.usd;
    return typeof price === 'number' ? price : null;
  }
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(
    `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol.trim())}&apikey=${apiKey}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { close?: string; price?: string };
  const p = data.close ?? data.price;
  if (p == null) return null;
  const n = parseFloat(String(p));
  return Number.isNaN(n) ? null : n;
}

/** Call OpenAI chat completions with user's API key. Returns parsed JSON array of recommendations. */
async function getRecommendationsFromOpenAI(
  apiKey: string,
  dashboardSummary: string,
  assetsWithPrices: { symbol: string; asset_type: string; price: number | null }[],
): Promise<Array<{ symbol: string; action: string; entry_price?: number; exit_price?: number; take_profit?: number; stop_loss?: number; reasoning?: string }>> {
  const assetsText = assetsWithPrices
    .map((a) => `${a.symbol} (${a.asset_type}): ${a.price != null ? a.price : 'price unknown'}`)
    .join('\n');
  const prompt = `You are a financial assistant. Given the following market context and asset list with current prices, recommend for EACH asset: action (buy, sell, or hold), entry_price, exit_price, take_profit, stop_loss (all as numbers), and a short reasoning.

Market context:
${dashboardSummary}

Assets and current prices:
${assetsText}

Respond with a JSON array only, one object per asset, with keys: symbol, action, entry_price, exit_price, take_profit, stop_loss, reasoning. Use the exact symbol from the list. If price is unknown, still suggest levels.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI: empty response');
  const parsed = JSON.parse(content) as Record<string, unknown>;
  const list = Array.isArray(parsed.recommendations) ? parsed.recommendations : Array.isArray(parsed) ? parsed : [];
  return list as Array<{ symbol: string; action: string; entry_price?: number; exit_price?: number; take_profit?: number; stop_loss?: number; reasoning?: string }>;
}

let app: express.Express | null = null;

async function getApp(): Promise<express.Express> {
  if (app) return app;

  const db = await getDb();
  const registry = new RegistryService();
  const dashboardService = new DashboardService(
    db.getSnapshotRepo(),
    db.getPointsRepo(),
    db.getScoreRepo(),
    db.getDerivedRepo(),
    registry,
  );
  const indicatorsService = new IndicatorsService(
    db.getPointsRepo(),
    db.getDerivedRepo(),
    db.getScoreRepo(),
  );
  const alertsService = new AlertsService(db.getRuleRepo(), db.getFiredRepo());

  app = express();
  app.use(express.json());

  app.get('/api/config', (_req: Request, res: Response) => {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
    const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;
    res.json({ supabaseUrl: url ?? null, supabaseAnonKey: anonKey ?? null });
  });

  app.get('/api/dashboard/today', async (req: Request, res: Response) => {
    try {
      const timezone = (req.query.timezone as string) || 'America/Santo_Domingo';
      const data = await dashboardService.getToday(timezone);
      res.json(data);
    } catch (e) {
      console.error('/api/dashboard/today', e);
      res.status(500).json({ error: errorMessage(e) });
    }
  });

  app.get('/api/indicators/:key/history', async (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      const range = (req.query.range as string) || '30d';
      const granularity = (req.query.granularity as string) || '1d';
      const data = await indicatorsService.getHistory(key, range, granularity);
      res.json(data);
    } catch (e) {
      console.error('/api/indicators/:key/history', e);
      res.status(500).json({ error: errorMessage(e) });
    }
  });

  app.get('/api/score/history', async (req: Request, res: Response) => {
    try {
      const range = (req.query.range as string) || '12w';
      const data = await indicatorsService.getScoreHistory(range);
      res.json(data);
    } catch (e) {
      console.error('/api/score/history', e);
      res.status(500).json({ error: errorMessage(e) });
    }
  });

  app.get('/api/alerts/history', async (req: Request, res: Response) => {
    try {
      const range = (req.query.range as string) || '30d';
      const data = await alertsService.getHistory(range);
      res.json(data);
    } catch (e) {
      console.error('/api/alerts/history', e);
      res.status(500).json({ error: errorMessage(e) });
    }
  });

  app.get('/api/rules', async (_req: Request, res: Response) => {
    try {
      const data = await alertsService.listRules();
      res.json(data);
    } catch (e) {
      console.error('/api/rules', e);
      res.status(500).json({ error: errorMessage(e) });
    }
  });

  app.get('/api/rules/:id', async (req: Request, res: Response) => {
    try {
      const rule = await alertsService.getRule(req.params.id);
      if (!rule) return res.status(404).json({ error: 'Not found' });
      res.json(rule);
    } catch (e) {
      console.error('/api/rules/:id GET', e);
      res.status(500).json({ error: errorMessage(e) });
    }
  });

  app.post('/api/rules', async (req: Request, res: Response) => {
    try {
      const { json_rule } = req.body || {};
      if (!json_rule) return res.status(400).json({ error: 'json_rule required' });
      const data = await alertsService.createRule(json_rule);
      res.status(201).json(data);
    } catch (e) {
      console.error('/api/rules POST', e);
      res.status(500).json({ error: errorMessage(e) });
    }
  });

  app.patch('/api/rules/:id', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const data = await alertsService.updateRule(req.params.id, body);
      if (!data) return res.status(404).json({ error: 'Not found' });
      res.json(data);
    } catch (e) {
      console.error('/api/rules/:id PATCH', e);
      res.status(500).json({ error: errorMessage(e) });
    }
  });

  app.delete('/api/rules/:id', async (req: Request, res: Response) => {
    try {
      const ok = await alertsService.deleteRule(req.params.id);
      res.json({ deleted: ok });
    } catch (e) {
      console.error('/api/rules/:id DELETE', e);
      res.status(500).json({ error: errorMessage(e) });
    }
  });

  app.get('/api/user/llm-settings', async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const supabase = getSupabaseService();
      const { data: row, error } = await supabase
        .from('user_llm_settings')
        .select('provider, api_key')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.error('/api/user/llm-settings GET', error);
        return res.status(500).json({ error: errorMessage(error) });
      }
      return res.json({
        provider: row?.provider ?? null,
        hasKey: !!(row?.api_key && row.api_key.length > 0),
      });
    } catch (e) {
      console.error('/api/user/llm-settings GET', e);
      return res.status(500).json({ error: errorMessage(e) });
    }
  });

  app.post('/api/user/llm-settings', async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const { provider, api_key } = req.body ?? {};
      if (typeof provider !== 'string' || !LLM_PROVIDERS.includes(provider as typeof LLM_PROVIDERS[number])) {
        return res.status(400).json({ error: 'provider must be one of: openai, claude, gemini' });
      }
      if (typeof api_key !== 'string' || api_key.trim().length === 0) {
        return res.status(400).json({ error: 'api_key is required' });
      }
      const supabase = getSupabaseService();
      const { error } = await supabase
        .from('user_llm_settings')
        .upsert(
          { user_id: userId, provider, api_key: api_key.trim(), updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        );
      if (error) {
        console.error('/api/user/llm-settings POST', error);
        return res.status(500).json({ error: errorMessage(error) });
      }
      return res.json({ provider, saved: true });
    } catch (e) {
      console.error('/api/user/llm-settings POST', e);
      return res.status(500).json({ error: errorMessage(e) });
    }
  });

  app.post('/api/recommendations', async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const supabase = getSupabaseService();
      const { data: assets } = await supabase
        .from('user_assets')
        .select('symbol, asset_type')
        .eq('user_id', userId);
      const list = Array.isArray(assets) ? assets : [];
      if (list.length === 0) {
        return res.status(400).json({ error: 'Add at least one asset (stock, ETF, commodity, or crypto) in My Assets to generate recommendations.' });
      }
      const { data: llmRow } = await supabase
        .from('user_llm_settings')
        .select('provider, api_key')
        .eq('user_id', userId)
        .maybeSingle();
      if (!llmRow?.api_key) {
        return res.status(400).json({ error: 'Configure your AI provider and API key in Settings first.' });
      }
      const dashboard = await dashboardService.getToday('UTC');
      const indSummary = dashboard.indicators.map((i) => `${i.key}: ${i.status} (${i.trend}), value: ${i.value ?? 'n/a'}`).join('\n');
      const dashboardSummary = `Score: ${dashboard.score}, Delta week: ${dashboard.deltaWeek}. Scenario: bull=${dashboard.scenario.bull}, bear=${dashboard.scenario.bear}.\nIndicators:\n${indSummary}`;
      const assetsWithPrices: { symbol: string; asset_type: string; price: number | null }[] = [];
      for (const a of list) {
        const price = await fetchPrice(a.symbol, a.asset_type);
        assetsWithPrices.push({ symbol: a.symbol, asset_type: a.asset_type, price });
      }
      const provider = (llmRow.provider as string) || 'openai';
      let recommendations: Array<{ symbol: string; action: string; entry_price?: number; exit_price?: number; take_profit?: number; stop_loss?: number; reasoning?: string }>;
      if (provider === 'openai') {
        recommendations = await getRecommendationsFromOpenAI(llmRow.api_key, dashboardSummary, assetsWithPrices);
      } else {
        return res.status(400).json({ error: `Provider "${provider}" is not yet supported for recommendations. Use OpenAI in Settings.` });
      }
      return res.json({ recommendations });
    } catch (e) {
      console.error('/api/recommendations', e);
      return res.status(500).json({ error: errorMessage(e) });
    }
  });

  return app;
}

let serverlessHandler: ReturnType<typeof serverless> | null = null;

export const handler = async (event: unknown, context: unknown) => {
  const expressApp = await getApp();
  if (!serverlessHandler) serverlessHandler = serverless(expressApp, { binary: false });
  return serverlessHandler(event, context);
};
