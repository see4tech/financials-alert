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

/** Trigger the run-jobs Netlify function. Pass cronSecret if CRON_SECRET is set in Netlify. */
export async function triggerRunJobs(cronSecret?: string): Promise<{ ok: boolean }> {
  const base = typeof window !== 'undefined' ? '' : API_BASE || 'http://localhost:3000';
  const url = `${base}/.netlify/functions/run-jobs`;
  const headers: Record<string, string> = {};
  if (cronSecret) headers['X-Cron-Secret'] = cronSecret;
  const res = await fetch(url, { method: 'POST', headers });
  if (res.status === 401) throw new Error('Cron secret required. Set CRON_SECRET in Netlify and enter it when prompted.');
  await throwOnNotOk(res);
  return res.json().catch(() => ({ ok: true }));
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

// ── User preferences (locale, theme) ──
export async function getUserPreferences(accessToken: string): Promise<{ locale: string; theme: string }> {
  const res = await fetch(`${API_BASE}/api/user/preferences`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  await throwOnNotOk(res);
  return res.json();
}

export async function saveUserPreferences(
  accessToken: string,
  payload: { locale?: string; theme?: string },
): Promise<{ locale?: string; theme?: string; saved: boolean }> {
  const res = await fetch(`${API_BASE}/api/user/preferences`, {
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
  entry_price?: number;
  exit_price?: number;
  take_profit?: number;
  stop_loss?: number;
  reasoning?: string;
};

export async function fetchRecommendations(accessToken: string, locale = 'en'): Promise<{ recommendations: AiRecommendation[] }> {
  const res = await fetch(`${API_BASE}/api/recommendations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ locale }),
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
): Promise<{ scan: MarketScanResult[] }> {
  const payload: Record<string, unknown> = { locale, count };
  if (assetTypes && assetTypes.length > 0) payload.assetTypes = assetTypes;
  const res = await fetch(`${API_BASE}/api/market-scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(payload),
  });
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

/** One-time backfill: load 90 days of history for all indicators. Uses same secret as run-jobs (CRON_SECRET). */
export async function triggerBackfillHistory(cronSecret?: string): Promise<{ ok: boolean; message?: string; results?: Record<string, { raw: number; points: number }> }> {
  const base = typeof window !== 'undefined' ? '' : API_BASE || 'http://localhost:3000';
  const url = `${base}/.netlify/functions/backfill-history`;
  const headers: Record<string, string> = {};
  if (cronSecret) headers['X-Cron-Secret'] = cronSecret;
  const res = await fetch(url, { method: 'POST', headers });
  if (res.status === 401) throw new Error('Cron secret required. Set CRON_SECRET in Netlify and enter it when prompted.');
  await throwOnNotOk(res);
  return res.json();
}
