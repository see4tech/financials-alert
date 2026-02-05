// On Netlify leave unset to use same-origin /api (rewritten to serverless function). Local dev: set to http://localhost:3000.
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== 'undefined' ? '' : 'http://localhost:3000');

export async function fetchDashboard(timezone?: string) {
  const q = timezone ? `?timezone=${encodeURIComponent(timezone)}` : '';
  const res = await fetch(`${API_BASE}/api/dashboard/today${q}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchIndicatorHistory(key: string, range = '30d', granularity = '1d') {
  const res = await fetch(
    `${API_BASE}/api/indicators/${encodeURIComponent(key)}/history?range=${range}&granularity=${granularity}`,
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchScoreHistory(range = '12w') {
  const res = await fetch(`${API_BASE}/api/score/history?range=${range}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchAlertsHistory(range = '30d') {
  const res = await fetch(`${API_BASE}/api/alerts/history?range=${range}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchRules() {
  const res = await fetch(`${API_BASE}/api/rules`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createRule(json_rule: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/rules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ json_rule }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
