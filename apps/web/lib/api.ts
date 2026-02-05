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
