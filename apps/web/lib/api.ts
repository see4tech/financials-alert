// On Netlify leave unset to use same-origin /api (rewritten to serverless function). Local dev: set to http://localhost:3000.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== 'undefined' ? '' : 'http://localhost:3000');

async function throwOnNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const text = await res.text();
  let message = text || res.statusText;
  try {
    const json = JSON.parse(text) as { error?: string };
    if (typeof json?.error === 'string') message = json.error;
  } catch {
    /* use raw text as message */
  }
  throw new Error(message);
}

export async function fetchDashboard(timezone?: string) {
  const q = timezone ? `?timezone=${encodeURIComponent(timezone)}` : '';
  const res = await fetch(`${API_BASE}/api/dashboard/today${q}`);
  await throwOnNotOk(res);
  return res.json();
}

export async function fetchIndicatorHistory(key: string, range = '30d', granularity = '1d') {
  const res = await fetch(
    `${API_BASE}/api/indicators/${encodeURIComponent(key)}/history?range=${range}&granularity=${granularity}`,
  );
  await throwOnNotOk(res);
  return res.json();
}

export async function fetchScoreHistory(range = '12w') {
  const res = await fetch(`${API_BASE}/api/score/history?range=${range}`);
  await throwOnNotOk(res);
  return res.json();
}

export async function fetchAlertsHistory(range = '30d') {
  const res = await fetch(`${API_BASE}/api/alerts/history?range=${range}`);
  await throwOnNotOk(res);
  return res.json();
}

export async function fetchRules() {
  const res = await fetch(`${API_BASE}/api/rules`);
  await throwOnNotOk(res);
  return res.json();
}

export async function createRule(json_rule: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json_rule }),
  });
  await throwOnNotOk(res);
  return res.json();
}

export async function updateRule(
  id: string,
  updates: { json_rule?: Record<string, unknown>; is_enabled?: boolean },
) {
  const res = await fetch(`${API_BASE}/api/rules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  await throwOnNotOk(res);
  return res.json();
}

export async function deleteRule(id: string): Promise<{ deleted: boolean }> {
  const res = await fetch(`${API_BASE}/api/rules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  await throwOnNotOk(res);
  return res.json();
}

/** Trigger the run-jobs Netlify function. Pass cronSecret if CRON_SECRET is set in Netlify.
 *  Fire-and-forget: we don't wait for the full response since the job can take 18s+
 *  which exceeds Netlify's sandbox timeout. We just confirm the request was accepted. */
export async function triggerRunJobs(cronSecret?: string): Promise<{ ok: boolean }> {
  const base = typeof window !== 'undefined' ? '' : API_BASE || 'http://localhost:3000';
  const url = `${base}/.netlify/functions/run-jobs`;
  const headers: Record<string, string> = {};
  if (cronSecret) headers['X-Cron-Secret'] = cronSecret;
  // Use a short timeout — we only need to confirm the request was received, not wait for completion.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28000);
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, signal: controller.signal });
  } catch (e) {
    clearTimeout(timer);
    // If aborted, the job is likely still running server-side — treat as success
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: true };
    }
    throw e;
  }
  clearTimeout(timer);
  if (res.status === 401) throw new Error('Cron secret required. Set CRON_SECRET in Netlify and enter it when prompted.');
  // 502/504 from Netlify gateway timeout — job is still running, treat as success
  if (res.status === 502 || res.status === 504) return { ok: true };
  await throwOnNotOk(res);
  return res.json().catch(() => ({ ok: true }));
}

/** Process a single indicator (fetch + aggregate + derive + status). Returns the result for that indicator. */
export async function runJobStep(indicatorKey: string): Promise<{ ok: boolean; indicatorKey: string; fetched: number; status: string; trend: string }> {
  const res = await fetch(`${API_BASE}/api/run-job-step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ indicatorKey }),
  });
  await throwOnNotOk(res);
  return res.json();
}

/** Finalize run-jobs: compute weekly score + evaluate alert rules. Call after all indicators are processed. */
export async function runJobFinalize(): Promise<{ ok: boolean; score: number; delta: number }> {
  const res = await fetch(`${API_BASE}/api/run-job-finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  await throwOnNotOk(res);
  return res.json();
}

/** Get the list of enabled indicator keys from the server config. */
export async function getIndicatorKeys(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/config`);
  await throwOnNotOk(res);
  const data = await res.json();
  // The config endpoint returns indicator keys
  return data.indicatorKeys || [];
}

export async function getLlmSettings(accessToken: string): Promise<{ provider: string | null; hasKey: boolean }> {
  const res = await fetch(`${API_BASE}/api/user/llm-settings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await throwOnNotOk(res);
  return res.json();
}

export async function saveLlmSettings(
  accessToken: string,
  payload: { provider: string; api_key: string },
): Promise<{ provider: string; saved: boolean }> {
  const res = await fetch(`${API_BASE}/api/user/llm-settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  await throwOnNotOk(res);
  return res.json();
}

// ── User preferences (locale, theme, etoro_trading_mode) ──
export async function getUserPreferences(accessToken: string): Promise<{ locale: string; theme: string; etoro_trading_mode: string }> {
  const res = await fetch(`${API_BASE}/api/user/preferences`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await throwOnNotOk(res);
  return res.json();
}

export async function saveUserPreferences(
  accessToken: string,
  payload: { locale?: string; theme?: string; etoro_trading_mode?: string },
): Promise<{ locale?: string; theme?: string; etoro_trading_mode?: string; saved: boolean }> {
  const res = await fetch(`${API_BASE}/api/user/preferences`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  await throwOnNotOk(res);
  return res.json();
}

// ── eToro settings (no secrets returned) ──
export async function getEtoroSettings(accessToken: string): Promise<{ configured: boolean }> {
  const res = await fetch(`${API_BASE}/api/user/etoro-settings`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await throwOnNotOk(res);
  return res.json();
}

export async function saveEtoroSettings(
  accessToken: string,
  payload: { apiKey: string; userKey: string },
): Promise<{ saved: boolean }> {
  const res = await fetch(`${API_BASE}/api/user/etoro-settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ apiKey: payload.apiKey, userKey: payload.userKey }),
  });
  await throwOnNotOk(res);
  return res.json();
}

export async function placeEtoroOrder(
  accessToken: string,
  payload: { symbol: string; amount: number; isBuy: boolean },
): Promise<{ ok: boolean; orderId?: string }> {
  const res = await fetch(`${API_BASE}/api/etoro/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
  await throwOnNotOk(res);
  return res.json();
}

export type AiRecommendation = {
  symbol: string;
  action: string;
  action_en?: string;
  action_es?: string;
  entry_price?: number;
  exit_price?: number;
  take_profit?: number;
  stop_loss?: number;
  reasoning?: string;
  reasoning_en?: string;
  reasoning_es?: string;
};

export async function fetchRecommendations(accessToken: string, locale = 'en'): Promise<{ recommendations: AiRecommendation[] }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${API_BASE}/api/recommendations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ locale }),
      signal: controller.signal,
    });
    await throwOnNotOk(res);
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { recommendations?: AiRecommendation[]; error?: string };
      if (json.error) throw new Error(json.error);
      return { recommendations: json.recommendations || [] };
    } catch (e) {
      console.error('[fetchRecommendations] failed to parse response:', text.slice(0, 500));
      throw e;
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error(locale === 'es'
        ? 'La solicitud tardó demasiado. Intenta de nuevo o reduce la cantidad de activos.'
        : 'Request timed out. Try again or reduce the number of assets.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ── Market Scan ──
export type MarketScanResult = {
  symbol: string;
  name: string;
  asset_type: string;
  action?: string;
  current_price?: number;
  entry_price?: number;
  take_profit?: number;
  stop_loss?: number;
  reasoning?: string;
  reasoning_en?: string;
  reasoning_es?: string;
};

export async function fetchMarketScan(
  accessToken: string,
  locale = 'en',
  count = 5,
  assetTypes?: string[],
  exclude?: string[],
  etoroOnly?: boolean,
): Promise<{ scan: MarketScanResult[] }> {
  const payload: Record<string, unknown> = { locale, count };
  if (assetTypes && assetTypes.length > 0) payload.assetTypes = assetTypes;
  if (exclude && exclude.length > 0) payload.exclude = exclude;
  if (etoroOnly === true) payload.etoroOnly = true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000); // 55s client timeout
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/market-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e: unknown) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(locale === 'es'
        ? 'El escaneo tardó demasiado. Intenta con menos resultados o menos tipos de activo.'
        : 'Scan timed out. Try fewer results or fewer asset types.');
    }
    throw e;
  }
  clearTimeout(timer);
  await throwOnNotOk(res);
  const text = await res.text();
  try {
    const json = JSON.parse(text) as { scan?: MarketScanResult[]; error?: string };
    if (json.error) throw new Error(json.error);
    return { scan: json.scan || [] };
  } catch (e) {
    console.error('[fetchMarketScan] failed to parse response:', text.slice(0, 500));
    throw e;
  }
}

// ── Symbol search ──
export type SymbolResult = { symbol: string; name: string; asset_type: string; exchange: string | null };

export async function searchSymbols(q: string): Promise<{ results: SymbolResult[] }> {
  const res = await fetch(`${API_BASE}/api/symbols/search?q=${encodeURIComponent(q)}`);
  await throwOnNotOk(res);
  return res.json();
}

/** Populate symbols DB from Twelve Data + CoinGecko. Protected by CRON_SECRET. */
export async function triggerPopulateSymbols(cronSecret?: string): Promise<{ ok: boolean; results?: Record<string, number> }> {
  const base = typeof window !== 'undefined' ? '' : API_BASE || 'http://localhost:3000';
  const url = `${base}/.netlify/functions/populate-symbols`;
  const headers: Record<string, string> = {};
  if (cronSecret) headers['X-Cron-Secret'] = cronSecret;
  const res = await fetch(url, { method: 'POST', headers });
  if (res.status === 401) throw new Error('Cron secret required.');
  await throwOnNotOk(res);
  return res.json();
}

/** One-time backfill: load 90 days of history for all indicators. Uses same secret as run-jobs (CRON_SECRET).
 *  Same fire-and-forget pattern: backfill can take 20s+. */
export async function triggerBackfillHistory(cronSecret?: string): Promise<{ ok: boolean; message?: string; results?: Record<string, { raw: number; points: number }> }> {
  const base = typeof window !== 'undefined' ? '' : API_BASE || 'http://localhost:3000';
  const url = `${base}/.netlify/functions/backfill-history`;
  const headers: Record<string, string> = {};
  if (cronSecret) headers['X-Cron-Secret'] = cronSecret;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28000);
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, signal: controller.signal });
  } catch (e) {
    clearTimeout(timer);
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { ok: true, message: 'Backfill triggered (running in background).' };
    }
    throw e;
  }
  clearTimeout(timer);
  if (res.status === 401) throw new Error('Cron secret required. Set CRON_SECRET in Netlify and enter it when prompted.');
  if (res.status === 502 || res.status === 504) return { ok: true, message: 'Backfill triggered (running in background).' };
  await throwOnNotOk(res);
  return res.json();
}
