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
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error('[auth] Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars');
    return null;
  }
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
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
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

/** Wrapper around fetch with an AbortController timeout (ms). */
async function fetchWithTimeout(url: string, init: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 8000, ...fetchInit } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...fetchInit, signal: controller.signal });
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms: ${url.split('?')[0]}`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ── Hardcoded commodity symbols for market scan ──
const COMMODITY_SYMBOLS = [
  'CL', 'GC', 'NG', 'SI', 'HG', 'PL', 'PA', 'ZC', 'ZW', 'ZS',
  'KC', 'CT', 'SB', 'CC', 'LBS', 'LE', 'HE', 'OJ', 'RB', 'HO', 'BZ',
];

// ── Fallback popular symbols when NASDAQ screener is unavailable ──
const FALLBACK_STOCKS: { symbol: string; name: string }[] = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway Inc.' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'MA', name: 'Mastercard Inc.' },
  { symbol: 'PG', name: 'Procter & Gamble Co.' },
  { symbol: 'UNH', name: 'UnitedHealth Group Inc.' },
  { symbol: 'HD', name: 'The Home Depot Inc.' },
  { symbol: 'XOM', name: 'Exxon Mobil Corporation' },
  { symbol: 'COST', name: 'Costco Wholesale Corporation' },
  { symbol: 'ABBV', name: 'AbbVie Inc.' },
  { symbol: 'CRM', name: 'Salesforce Inc.' },
  { symbol: 'AMD', name: 'Advanced Micro Devices Inc.' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'LLY', name: 'Eli Lilly and Company' },
  { symbol: 'AVGO', name: 'Broadcom Inc.' },
  { symbol: 'ADBE', name: 'Adobe Inc.' },
  { symbol: 'PEP', name: 'PepsiCo Inc.' },
  { symbol: 'KO', name: 'The Coca-Cola Company' },
  { symbol: 'MRK', name: 'Merck & Co. Inc.' },
  { symbol: 'TMO', name: 'Thermo Fisher Scientific Inc.' },
  { symbol: 'CSCO', name: 'Cisco Systems Inc.' },
  { symbol: 'ACN', name: 'Accenture plc' },
  { symbol: 'ORCL', name: 'Oracle Corporation' },
  { symbol: 'ABT', name: 'Abbott Laboratories' },
  { symbol: 'DIS', name: 'The Walt Disney Company' },
  { symbol: 'INTC', name: 'Intel Corporation' },
  { symbol: 'QCOM', name: 'QUALCOMM Inc.' },
  { symbol: 'CMCSA', name: 'Comcast Corporation' },
  { symbol: 'NKE', name: 'NIKE Inc.' },
  { symbol: 'BA', name: 'The Boeing Company' },
  { symbol: 'GS', name: 'The Goldman Sachs Group Inc.' },
];

const FALLBACK_ETFS: { symbol: string; name: string }[] = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF' },
  { symbol: 'EFA', name: 'iShares MSCI EAFE ETF' },
  { symbol: 'EEM', name: 'iShares MSCI Emerging Markets ETF' },
  { symbol: 'VEA', name: 'Vanguard FTSE Developed Markets ETF' },
  { symbol: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF' },
  { symbol: 'XLF', name: 'Financial Select Sector SPDR Fund' },
  { symbol: 'XLK', name: 'Technology Select Sector SPDR Fund' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund' },
  { symbol: 'XLV', name: 'Health Care Select Sector SPDR Fund' },
  { symbol: 'XLI', name: 'Industrial Select Sector SPDR Fund' },
  { symbol: 'XLP', name: 'Consumer Staples Select Sector SPDR Fund' },
  { symbol: 'XLY', name: 'Consumer Discretionary Select Sector SPDR Fund' },
  { symbol: 'XLU', name: 'Utilities Select Sector SPDR Fund' },
  { symbol: 'ARKK', name: 'ARK Innovation ETF' },
  { symbol: 'GLD', name: 'SPDR Gold Shares' },
  { symbol: 'SLV', name: 'iShares Silver Trust' },
  { symbol: 'TLT', name: 'iShares 20+ Year Treasury Bond ETF' },
  { symbol: 'HYG', name: 'iShares iBoxx $ High Yield Corporate Bond ETF' },
  { symbol: 'LQD', name: 'iShares iBoxx $ Investment Grade Corporate Bond ETF' },
  { symbol: 'VNQ', name: 'Vanguard Real Estate ETF' },
  { symbol: 'SOXX', name: 'iShares Semiconductor ETF' },
  { symbol: 'SMH', name: 'VanEck Semiconductor ETF' },
  { symbol: 'KWEB', name: 'KraneShares CSI China Internet ETF' },
  { symbol: 'IBB', name: 'iShares Biotechnology ETF' },
  { symbol: 'XBI', name: 'SPDR S&P Biotech ETF' },
];

const LOCALE_NAMES: Record<string, string> = { en: 'English', es: 'Spanish' };

/** Call OpenAI chat completions with user's API key. Returns parsed JSON array of recommendations. */
async function getRecommendationsFromOpenAI(
  apiKey: string,
  dashboardSummary: string,
  assetsWithPrices: { symbol: string; asset_type: string; price: number | null }[],
  _locale = 'en',
): Promise<Array<{ symbol: string; action_en: string; action_es: string; entry_price?: number; exit_price?: number; take_profit?: number; stop_loss?: number; reasoning_en?: string; reasoning_es?: string }>> {
  const assetsText = assetsWithPrices
    .map((a) => `${a.symbol}(${a.asset_type}):${a.price ?? '?'}`)
    .join(', ');
  const prompt = `Financial advisor. For EACH asset return JSON: {symbol,action_en("buy"/"sell"/"hold"),action_es("comprar"/"vender"/"mantener"),entry_price,exit_price,take_profit,stop_loss,reasoning_en(1 sentence),reasoning_es(1 sentence)}. All prices=numbers.

Context: ${dashboardSummary}
Assets: ${assetsText}

Return JSON: {"recommendations":[...]}`;

  const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    timeout: 20000,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 1500,
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
  // OpenAI may wrap the array under different keys; find the first array value
  let list: unknown[] = [];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    for (const val of Object.values(parsed)) {
      if (Array.isArray(val) && val.length > 0) {
        list = val;
        break;
      }
    }
  }
  if (list.length === 0) {
    console.warn('OpenAI: no array found in response, raw:', content.slice(0, 500));
  }
  return list as Array<{ symbol: string; action: string; entry_price?: number; exit_price?: number; take_profit?: number; stop_loss?: number; reasoning?: string }>;
}

// ── Market Scan types & helpers ──
type ScanCandidate = {
  symbol: string;
  name: string;
  asset_type: string;
  pct_change: number;
  score: number;
  current_price?: number;
  fifty_two_week_high?: number;
};

/** Fetch NASDAQ screener (stocks or etf). Free, no API key needed.
 *  Falls back to curated list + Twelve Data quotes when NASDAQ blocks the request. */
async function fetchNasdaqScreener(
  tableType: 'stocks' | 'etf',
  limit: number,
  twelveDataKey?: string,
): Promise<ScanCandidate[]> {
  // Try NASDAQ screener first
  try {
    const url = `https://api.nasdaq.com/api/screener/${tableType}?tableonly=true&limit=${limit}&offset=0`;
    const res = await fetchWithTimeout(url, {
      timeout: 4000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Referer: 'https://www.nasdaq.com/',
        Origin: 'https://www.nasdaq.com',
      },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: { table?: { rows?: Array<{ symbol?: string; name?: string; pctchange?: string; marketCap?: string; volume?: string }> } };
      };
      const rows = json?.data?.table?.rows ?? [];
      if (rows.length > 0) {
        console.log(`[market-scan] NASDAQ screener ${tableType}: ${rows.length} rows`);
        return rows
          .filter((r) => r.symbol && r.name)
          .map((r) => {
            const pct = parseFloat(String(r.pctchange ?? '0').replace(/[%,]/g, '')) || 0;
            return {
              symbol: r.symbol!.trim(),
              name: r.name!.trim(),
              asset_type: tableType === 'etf' ? 'etf' : 'stock',
              pct_change: pct,
              score: 0,
            };
          });
      }
    } else {
      console.warn(`[market-scan] NASDAQ screener ${tableType} returned ${res.status}, using fallback`);
    }
  } catch (e) {
    console.warn(`[market-scan] NASDAQ screener ${tableType} failed, using fallback:`, e instanceof Error ? e.message : e);
  }

  // Fallback: use curated list + Twelve Data batch quotes
  const fallbackList = tableType === 'etf' ? FALLBACK_ETFS : FALLBACK_STOCKS;
  const assetType = tableType === 'etf' ? 'etf' : 'stock';

  if (!twelveDataKey) {
    // No API key: return the list without price data (scoring will still work but less accurately)
    console.log(`[market-scan] Fallback ${tableType}: ${fallbackList.length} symbols (no Twelve Data key for quotes)`);
    return fallbackList.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      asset_type: assetType,
      pct_change: 0,
      score: 0,
    }));
  }

  // Batch quote from Twelve Data in chunks of 8 (API limit per call)
  console.log(`[market-scan] Fallback ${tableType}: quoting ${fallbackList.length} symbols via Twelve Data`);
  const candidates: ScanCandidate[] = [];
  const chunks: typeof fallbackList[] = [];
  for (let i = 0; i < fallbackList.length; i += 8) {
    chunks.push(fallbackList.slice(i, i + 8));
  }

  const chunkResults = await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const syms = chunk.map((s) => s.symbol).join(',');
        const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(syms)}&apikey=${twelveDataKey}`;
        const res = await fetchWithTimeout(url, { timeout: 4000 });
        if (!res.ok) return chunk.map((s) => ({ ...s, pct: 0, close: undefined as number | undefined, high52: undefined as number | undefined }));
        const data = (await res.json()) as Record<string, {
          symbol?: string; name?: string; percent_change?: string; close?: string;
          fifty_two_week?: { high?: string };
        }>;
        // Single symbol: flat. Multiple: keyed by symbol.
        if (chunk.length === 1 && data.symbol && typeof data.symbol === 'string') {
          const d = data as unknown as { symbol: string; name?: string; percent_change?: string; close?: string; fifty_two_week?: { high?: string } };
          return [{
            symbol: d.symbol, name: d.name ?? chunk[0].name,
            pct: parseFloat(String(d.percent_change ?? '0')) || 0,
            close: d.close ? parseFloat(d.close) || undefined : undefined,
            high52: d.fifty_two_week?.high ? parseFloat(d.fifty_two_week.high) || undefined : undefined,
          }];
        }
        return chunk.map((s) => {
          const q = data[s.symbol];
          if (!q) return { ...s, pct: 0, close: undefined as number | undefined, high52: undefined as number | undefined };
          return {
            symbol: s.symbol, name: q.name ?? s.name,
            pct: parseFloat(String(q.percent_change ?? '0')) || 0,
            close: q.close ? parseFloat(q.close) || undefined : undefined,
            high52: q.fifty_two_week?.high ? parseFloat(q.fifty_two_week.high) || undefined : undefined,
          };
        });
      } catch {
        return chunk.map((s) => ({ ...s, pct: 0, close: undefined as number | undefined, high52: undefined as number | undefined }));
      }
    }),
  );

  for (const results of chunkResults) {
    for (const r of results) {
      candidates.push({
        symbol: r.symbol,
        name: r.name,
        asset_type: assetType,
        pct_change: r.pct,
        score: 0,
        current_price: r.close,
        fifty_two_week_high: r.high52,
      });
    }
  }

  console.log(`[market-scan] Fallback ${tableType}: got ${candidates.length} candidates with quotes`);
  return candidates;
}

/** Fetch top crypto from CoinGecko. Free, no key. */
async function fetchCoinGeckoTop(limit = 30): Promise<ScanCandidate[]> {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false&price_change_percentage=7d`;
    const res = await fetchWithTimeout(url, { timeout: 4000 });
    if (!res.ok) {
      console.warn(`[market-scan] CoinGecko ${res.status}`);
      return [];
    }
    const data = (await res.json()) as Array<{
      symbol?: string;
      name?: string;
      current_price?: number;
      price_change_percentage_24h?: number;
      price_change_percentage_7d_in_currency?: number;
      ath?: number;
    }>;
    return data
      .filter((c) => c.symbol && c.name)
      .map((c) => ({
        symbol: (c.symbol ?? '').toUpperCase(),
        name: c.name ?? '',
        asset_type: 'crypto',
        pct_change: c.price_change_percentage_24h ?? 0,
        score: 0,
        current_price: c.current_price ?? undefined,
        fifty_two_week_high: c.ath ?? undefined,
      }));
  } catch (e) {
    console.warn('[market-scan] CoinGecko error:', e);
    return [];
  }
}

/** Fetch batch commodity quotes from Twelve Data. */
async function fetchCommodityQuotes(apiKey: string): Promise<ScanCandidate[]> {
  try {
    const symbols = [...new Set(COMMODITY_SYMBOLS)].join(',');
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`;
    const res = await fetchWithTimeout(url, { timeout: 4000 });
    if (!res.ok) {
      console.warn(`[market-scan] Twelve Data commodities ${res.status}`);
      return [];
    }
    const data = (await res.json()) as Record<
      string,
      { symbol?: string; name?: string; percent_change?: string; close?: string; fifty_two_week?: { high?: string } }
    >;
    const results: ScanCandidate[] = [];
    // When only one symbol, response is flat object; otherwise it's keyed by symbol
    const entries = data.symbol ? [[data.symbol as unknown as string, data]] : Object.entries(data);
    for (const [, val] of entries as [string, typeof data[string]][]) {
      if (!val?.symbol) continue;
      const pct = parseFloat(String(val.percent_change ?? '0')) || 0;
      results.push({
        symbol: val.symbol,
        name: val.name ?? val.symbol,
        asset_type: 'commodity',
        pct_change: pct,
        score: 0,
        current_price: val.close ? parseFloat(val.close) || undefined : undefined,
        fifty_two_week_high: val.fifty_two_week?.high ? parseFloat(val.fifty_two_week.high) || undefined : undefined,
      });
    }
    return results;
  } catch (e) {
    console.warn('[market-scan] Twelve Data commodities error:', e);
    return [];
  }
}

/** Fetch batch quotes from Twelve Data for given symbols. Returns map symbol -> quote data. */
async function fetchTwelveDataBatchQuotes(
  symbols: string[],
  apiKey: string,
): Promise<Record<string, { close?: number; percent_change?: number; fifty_two_week_high?: number }>> {
  if (symbols.length === 0) return {};
  try {
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbols.join(','))}&apikey=${apiKey}`;
    const res = await fetchWithTimeout(url, { timeout: 4000 });
    if (!res.ok) return {};
    const data = (await res.json()) as Record<
      string,
      { symbol?: string; close?: string; percent_change?: string; fifty_two_week?: { high?: string } }
    >;
    const result: Record<string, { close?: number; percent_change?: number; fifty_two_week_high?: number }> = {};
    // Single symbol: flat object. Multiple: keyed by symbol.
    if (data.symbol && typeof data.symbol === 'string') {
      const d = data as unknown as { symbol: string; close?: string; percent_change?: string; fifty_two_week?: { high?: string } };
      result[d.symbol] = {
        close: d.close ? parseFloat(d.close) || undefined : undefined,
        percent_change: d.percent_change ? parseFloat(d.percent_change) || undefined : undefined,
        fifty_two_week_high: d.fifty_two_week?.high ? parseFloat(d.fifty_two_week.high) || undefined : undefined,
      };
    } else {
      for (const [sym, val] of Object.entries(data)) {
        if (!val?.close) continue;
        result[sym] = {
          close: parseFloat(String(val.close)) || undefined,
          percent_change: val.percent_change ? parseFloat(String(val.percent_change)) || undefined : undefined,
          fifty_two_week_high: val.fifty_two_week?.high ? parseFloat(val.fifty_two_week.high) || undefined : undefined,
        };
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Algorithmic scoring for market scan candidates. */
function scoreCandidates(candidates: ScanCandidate[]): ScanCandidate[] {
  for (const c of candidates) {
    let score = 0;
    // Positive daily price change = high weight
    if (c.pct_change > 0) score += Math.min(c.pct_change * 10, 50); // cap at 50
    // Not overbought: below 90% of 52-week high = medium weight
    if (c.fifty_two_week_high && c.current_price) {
      const ratio = c.current_price / c.fifty_two_week_high;
      if (ratio < 0.9) score += 20;
      else if (ratio < 0.95) score += 10;
    }
    // Penalize negative price change
    if (c.pct_change < -5) score -= 20;
    else if (c.pct_change < 0) score -= 5;
    c.score = score;
  }
  return candidates;
}

/** Pick top N candidates ensuring a mix of asset types. At least minPerType from each available type. */
function pickTopCandidates(candidates: ScanCandidate[], total = 20, minPerType = 2): ScanCandidate[] {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const types = [...new Set(sorted.map((c) => c.asset_type))];
  const picked: ScanCandidate[] = [];
  const pickedSymbols = new Set<string>();

  // Ensure minimum from each type
  for (const type of types) {
    const ofType = sorted.filter((c) => c.asset_type === type);
    let count = 0;
    for (const c of ofType) {
      if (count >= minPerType) break;
      if (pickedSymbols.has(c.symbol)) continue;
      picked.push(c);
      pickedSymbols.add(c.symbol);
      count++;
    }
  }

  // Fill remaining from top scoring
  for (const c of sorted) {
    if (picked.length >= total) break;
    if (pickedSymbols.has(c.symbol)) continue;
    picked.push(c);
    pickedSymbols.add(c.symbol);
  }

  return picked.slice(0, total);
}

const VALID_ASSET_TYPES = ['stock', 'etf', 'commodity', 'crypto'] as const;

/** Call OpenAI to provide analysis for pre-selected candidates. */
async function getMarketScanFromOpenAI(
  apiKey: string,
  dashboardSummary: string,
  candidates: Array<{
    symbol: string;
    name: string;
    asset_type: string;
    current_price?: number;
    pct_change?: number;
    fifty_two_week_high?: number;
  }>,
  locale = 'en',
  count = 5,
): Promise<
  Array<{
    symbol: string;
    name: string;
    asset_type: string;
    action: string;
    current_price?: number;
    entry_price?: number;
    take_profit?: number;
    stop_loss?: number;
    reasoning?: string;
  }>
> {
  const candidatesText = candidates
    .map(
      (c) =>
        `${c.symbol}|${c.asset_type}|${c.current_price ?? '?'}|${c.pct_change != null ? c.pct_change.toFixed(1) + '%' : '?'}`,
    )
    .join('\n');
  const prompt = `Financial analyst. For each asset below, provide entry_price, take_profit, stop_loss (numbers), and 1-sentence reasoning in English (reasoning_en) and Spanish (reasoning_es).

Context: ${dashboardSummary}

Assets (symbol|type|price|change):
${candidatesText}

Return JSON: {"picks":[{symbol,name,asset_type,action:"buy",current_price,entry_price,take_profit,stop_loss,reasoning_en,reasoning_es}]}
All prices MUST be numbers. Estimate if unknown. Exactly ${count} items.`;

  const res = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
    timeout: 22000,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: Math.min(count * 200, 3000),
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
  let list: unknown[] = [];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (typeof parsed === 'object' && parsed !== null) {
    for (const val of Object.values(parsed)) {
      if (Array.isArray(val) && val.length > 0) {
        list = val;
        break;
      }
    }
  }
  // Sanitise: coerce price fields to numbers (the LLM sometimes returns strings or text)
  const toNum = (v: unknown): number | undefined => {
    if (v == null) return undefined;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : undefined;
  };

  return (list as Array<Record<string, unknown>>).map((item) => ({
    symbol: String(item.symbol ?? ''),
    name: String(item.name ?? ''),
    asset_type: String(item.asset_type ?? ''),
    action: String(item.action ?? 'buy'),
    current_price: toNum(item.current_price),
    entry_price: toNum(item.entry_price),
    take_profit: toNum(item.take_profit),
    stop_loss: toNum(item.stop_loss),
    reasoning_en: item.reasoning_en != null ? String(item.reasoning_en) : (item.reasoning != null ? String(item.reasoning) : undefined),
    reasoning_es: item.reasoning_es != null ? String(item.reasoning_es) : (item.reasoning != null ? String(item.reasoning) : undefined),
  }));
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

  // ── Symbol search (public – no auth required) ──
  // Uses direct queries instead of RPC to avoid stale function definitions.
  // Priority: exact symbol > symbol prefix > symbol contains > name contains.
  app.get('/api/symbols/search', async (req: Request, res: Response) => {
    try {
      const q = ((req.query.q as string) || '').trim();
      if (q.length < 1) return res.json({ results: [] });
      const supabase = getSupabaseService();
      const qUp = q.toUpperCase();
      const seen = new Set<string>();
      const merged: Array<{ symbol: string; name: string; asset_type: string; exchange: string | null }> = [];

      const addRows = (rows: typeof merged) => {
        for (const r of rows) {
          const key = r.symbol + ':' + r.asset_type;
          if (!seen.has(key)) {
            seen.add(key);
            merged.push(r);
          }
        }
      };

      // 1. Exact symbol match
      const { data: exact } = await supabase
        .from('symbols')
        .select('symbol, name, asset_type, exchange')
        .ilike('symbol', q)
        .limit(5);
      addRows(exact || []);

      // 2. Symbol starts with query
      const { data: prefix } = await supabase
        .from('symbols')
        .select('symbol, name, asset_type, exchange')
        .ilike('symbol', `${q}%`)
        .limit(10);
      addRows(prefix || []);

      // 3. Symbol or name contains query (broader match)
      if (merged.length < 20) {
        const { data: broad } = await supabase
          .from('symbols')
          .select('symbol, name, asset_type, exchange')
          .or(`symbol.ilike.%${q}%,name.ilike.%${q}%`)
          .limit(30);
        // Sort broad: symbol-contains first, then name-only
        const sorted = (broad || []).sort((a, b) => {
          const aSymMatch = a.symbol.toUpperCase().includes(qUp) ? 0 : 1;
          const bSymMatch = b.symbol.toUpperCase().includes(qUp) ? 0 : 1;
          return aSymMatch - bSymMatch;
        });
        addRows(sorted);
      }

      return res.json({ results: merged.slice(0, 20) });
    } catch (e) {
      console.error('/api/symbols/search', e);
      return res.status(500).json({ error: errorMessage(e) });
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

  // ── User preferences (locale, theme, etc.) ──
  app.get('/api/user/preferences', async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const supabase = getSupabaseService();
      const { data: row, error } = await supabase
        .from('user_preferences')
        .select('locale, theme')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        console.error('/api/user/preferences GET', error);
        return res.status(500).json({ error: errorMessage(error) });
      }
      return res.json({ locale: row?.locale ?? 'en', theme: row?.theme ?? 'system' });
    } catch (e) {
      console.error('/api/user/preferences GET', e);
      return res.status(500).json({ error: errorMessage(e) });
    }
  });

  app.post('/api/user/preferences', async (req: Request, res: Response) => {
    try {
      const userId = await getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });
      const body = req.body ?? {};
      // Build upsert payload – only include fields that were sent
      const upsertData: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
      if ('locale' in body) {
        const { locale } = body;
        if (typeof locale !== 'string' || !['en', 'es'].includes(locale)) {
          return res.status(400).json({ error: 'locale must be one of: en, es' });
        }
        upsertData.locale = locale;
      }
      if ('theme' in body) {
        const { theme } = body;
        if (typeof theme !== 'string' || !['light', 'dark', 'system'].includes(theme)) {
          return res.status(400).json({ error: 'theme must be one of: light, dark, system' });
        }
        upsertData.theme = theme;
      }
      const supabase = getSupabaseService();
      const { error } = await supabase
        .from('user_preferences')
        .upsert(upsertData, { onConflict: 'user_id' });
      if (error) {
        console.error('/api/user/preferences POST', error);
        return res.status(500).json({ error: errorMessage(error) });
      }
      return res.json({ ...(upsertData.locale ? { locale: upsertData.locale } : {}), ...(upsertData.theme ? { theme: upsertData.theme } : {}), saved: true });
    } catch (e) {
      console.error('/api/user/preferences POST', e);
      return res.status(500).json({ error: errorMessage(e) });
    }
  });

  // ── AI Recommendations ──
  app.post('/api/recommendations', async (req: Request, res: Response) => {
    try {
      console.log('[recommendations] handler start');
      const userId = await getUserIdFromRequest(req);
      if (!userId) {
        console.warn('[recommendations] auth failed – no userId');
        return res.status(401).json({ error: 'Unauthorized' });
      }
      console.log('[recommendations] userId:', userId);
      const supabase = getSupabaseService();
      const { data: assets, error: assetsErr } = await supabase
        .from('user_assets')
        .select('symbol, asset_type')
        .eq('user_id', userId);
      if (assetsErr) console.error('[recommendations] user_assets query error', assetsErr);
      const list = Array.isArray(assets) ? assets : [];
      console.log('[recommendations] assets count:', list.length, list.map((a) => a.symbol));
      if (list.length === 0) {
        return res.status(400).json({ error: 'Add at least one asset (stock, ETF, commodity, or crypto) in My Assets to generate recommendations.' });
      }
      const { data: llmRow, error: llmErr } = await supabase
        .from('user_llm_settings')
        .select('provider, api_key')
        .eq('user_id', userId)
        .maybeSingle();
      if (llmErr) console.error('[recommendations] user_llm_settings query error', llmErr);
      if (!llmRow?.api_key) {
        console.warn('[recommendations] no API key found for user');
        return res.status(400).json({ error: 'Configure your AI provider and API key in Settings first.' });
      }
      console.log('[recommendations] provider:', llmRow.provider, 'apiKey length:', llmRow.api_key?.length);
      // Fetch dashboard context and all prices in parallel to save time
      const [dashboard, ...priceResults] = await Promise.all([
        dashboardService.getToday('UTC'),
        ...list.map(async (a) => {
          let price: number | null = null;
          try { price = await fetchPrice(a.symbol, a.asset_type); } catch { /* ignore */ }
          return { symbol: a.symbol, asset_type: a.asset_type, price };
        }),
      ]);
      const assetsWithPrices = priceResults as { symbol: string; asset_type: string; price: number | null }[];
      const indSummary = dashboard.indicators.map((i: { key: string; status: string; trend: string; value?: number | null }) => `${i.key}: ${i.status} (${i.trend}), value: ${i.value ?? 'n/a'}`).join('\n');
      const dashboardSummary = `Score: ${dashboard.score}, Delta week: ${dashboard.deltaWeek}. Scenario: bull=${dashboard.scenario.bull}, bear=${dashboard.scenario.bear}.\nIndicators:\n${indSummary}`;
      console.log('[recommendations] assetsWithPrices:', JSON.stringify(assetsWithPrices));
      const provider = (llmRow.provider as string) || 'openai';
      let recommendations: Array<{ symbol: string; action_en: string; action_es: string; entry_price?: number; exit_price?: number; take_profit?: number; stop_loss?: number; reasoning_en?: string; reasoning_es?: string }>;
      if (provider === 'openai') {
        recommendations = await getRecommendationsFromOpenAI(llmRow.api_key, dashboardSummary, assetsWithPrices);
      } else {
        return res.status(400).json({ error: `Provider "${provider}" is not yet supported for recommendations. Use OpenAI in Settings.` });
      }
      console.log('[recommendations] result count:', recommendations.length);
      return res.json({ recommendations });
    } catch (e) {
      console.error('/api/recommendations error:', e);
      const msg = errorMessage(e);
      if (msg.includes('abort') || msg.includes('timeout') || msg.includes('Timedout')) {
        return res.status(504).json({ error: 'Recommendation request timed out. Try again or reduce the number of assets.' });
      }
      return res.status(500).json({ error: msg });
    }
  });

  // ── Market Scan ──
  app.post('/api/market-scan', async (req: Request, res: Response) => {
    try {
      console.log('[market-scan] handler start');
      const userId = await getUserIdFromRequest(req);
      if (!userId) {
        console.warn('[market-scan] auth failed – no userId');
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const supabase = getSupabaseService();
      const { data: llmRow, error: llmErr } = await supabase
        .from('user_llm_settings')
        .select('provider, api_key')
        .eq('user_id', userId)
        .maybeSingle();
      if (llmErr) console.error('[market-scan] user_llm_settings query error', llmErr);
      if (!llmRow?.api_key) {
        return res.status(400).json({ error: 'Configure your AI provider and API key in Settings first.' });
      }
      const provider = (llmRow.provider as string) || 'openai';
      if (provider !== 'openai') {
        return res.status(400).json({ error: `Provider "${provider}" is not yet supported for market scan. Use OpenAI in Settings.` });
      }

      // Read locale
      const bodyLocale = req.body?.locale;
      let userLocale = 'en';
      if (typeof bodyLocale === 'string' && ['en', 'es'].includes(bodyLocale)) {
        userLocale = bodyLocale;
      } else {
        const { data: prefRow } = await supabase
          .from('user_preferences')
          .select('locale')
          .eq('user_id', userId)
          .maybeSingle();
        userLocale = (prefRow?.locale as string) || 'en';
      }
      // Read count (number of picks)
      const rawCount = req.body?.count;
      const count = typeof rawCount === 'number' && rawCount >= 1 && rawCount <= 20 ? Math.floor(rawCount) : 5;

      // Read asset type filter
      const rawAssetTypes = req.body?.assetTypes;
      let assetTypes: string[] = VALID_ASSET_TYPES.slice();
      if (Array.isArray(rawAssetTypes) && rawAssetTypes.length > 0) {
        const filtered = rawAssetTypes.filter((t: unknown) => typeof t === 'string' && (VALID_ASSET_TYPES as readonly string[]).includes(t));
        if (filtered.length > 0) assetTypes = filtered;
      }

      // Read exclude list (symbols already returned in previous batches)
      const rawExclude = req.body?.exclude;
      const excludeSet = new Set<string>(
        Array.isArray(rawExclude) ? rawExclude.filter((s: unknown) => typeof s === 'string').map((s: string) => s.toUpperCase()) : [],
      );

      console.log('[market-scan] locale:', userLocale, 'count:', count, 'assetTypes:', assetTypes, 'exclude:', excludeSet.size);

      // Phase 1: Fetch screening data in parallel (only for requested asset types)
      // Each source is wrapped so one timeout doesn't kill the entire scan
      const twelveDataKey = process.env.TWELVE_DATA_API_KEY || '';
      console.log('[market-scan] Phase 1: fetching screening data + dashboard context...');
      const safeResolve = async (fn: () => Promise<ScanCandidate[]>, label: string): Promise<ScanCandidate[]> => {
        try { return await fn(); } catch (e) { console.warn(`[market-scan] ${label} failed:`, e instanceof Error ? e.message : e); return []; }
      };
      const [stocks, etfs, crypto, commodities, dashboard] = await Promise.all([
        assetTypes.includes('stock') ? safeResolve(() => fetchNasdaqScreener('stocks', 60, twelveDataKey), 'stocks') : Promise.resolve([] as ScanCandidate[]),
        assetTypes.includes('etf') ? safeResolve(() => fetchNasdaqScreener('etf', 30, twelveDataKey), 'etfs') : Promise.resolve([] as ScanCandidate[]),
        assetTypes.includes('crypto') ? safeResolve(() => fetchCoinGeckoTop(20), 'crypto') : Promise.resolve([] as ScanCandidate[]),
        assetTypes.includes('commodity') && twelveDataKey ? safeResolve(() => fetchCommodityQuotes(twelveDataKey), 'commodities') : Promise.resolve([] as ScanCandidate[]),
        dashboardService.getToday('UTC'),
      ]);
      console.log(`[market-scan] Phase 1 done in ${Date.now()}ms: stocks=${stocks.length}, etfs=${etfs.length}, crypto=${crypto.length}, commodities=${commodities.length}`);

      const allCandidates = [...stocks, ...etfs, ...crypto, ...commodities]
        .filter((c) => !excludeSet.has(c.symbol.toUpperCase()));
      if (allCandidates.length === 0) {
        // If all candidates were excluded, return empty (not an error – the client already has results)
        if (excludeSet.size > 0) return res.json({ scan: [] });
        return res.status(500).json({ error: 'Could not fetch screening data from any source.' });
      }

      // Phase 2: Algorithmic scoring – pick exactly `count` candidates (no extra for AI)
      scoreCandidates(allCandidates);
      const topPicked = pickTopCandidates(allCandidates, count, Math.min(2, Math.floor(count / 2)));
      console.log('[market-scan] Phase 2: picked', topPicked.map((c) => `${c.symbol}(${c.asset_type})`).join(', '));

      // Skip Phase 3 (quote fetching) – AI can estimate prices from available data
      // This saves 3-6 seconds which is critical for staying within the function timeout

      // Build dashboard context (compact)
      const indSummary = dashboard.indicators
        .map((i: { key: string; status: string; trend: string }) => `${i.key}:${i.status}/${i.trend}`)
        .join(', ');
      const dashboardSummary = `Score:${dashboard.score} Δ:${dashboard.deltaWeek} Bull:${dashboard.scenario.bull} Bear:${dashboard.scenario.bear} [${indSummary}]`;

      // Phase 3: AI analysis (the only slow step now)
      console.log(`[market-scan] Phase 3: calling OpenAI for ${count} picks...`);
      const scan = await getMarketScanFromOpenAI(
        llmRow.api_key,
        dashboardSummary,
        topPicked.map((c) => ({
          symbol: c.symbol,
          name: c.name,
          asset_type: c.asset_type,
          current_price: c.current_price,
          pct_change: c.pct_change,
          fifty_two_week_high: c.fifty_two_week_high,
        })),
        userLocale,
        count,
      );
      console.log('[market-scan] result count:', scan.length);
      return res.json({ scan });
    } catch (e) {
      console.error('/api/market-scan error:', e);
      const msg = e instanceof Error ? e.message : String(e);
      // Make timeout errors more user-friendly
      if (msg.includes('timed out') || msg.includes('aborted') || (e instanceof Error && e.name === 'AbortError')) {
        return res.status(504).json({ error: 'Scan timed out. Try fewer results or fewer asset types.' });
      }
      return res.status(500).json({ error: msg });
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
