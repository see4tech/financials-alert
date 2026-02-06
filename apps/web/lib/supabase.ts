import { createClient, SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;
let envMissing: boolean | null = null;

/** Called by SupabaseAuthProvider when config is loaded from /api/config (Netlify SUPABASE_* vars). */
export function setSupabaseBrowserClient(client: SupabaseClient): void {
  browserClient = client;
  envMissing = false;
}

/**
 * Supabase client for browser (Auth). Uses NEXT_PUBLIC_SUPABASE_* or client set from /api/config (Netlify SUPABASE_URL, SUPABASE_ANON_KEY).
 * Returns null when not yet configured (auth disabled or config loading).
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (typeof window === 'undefined') {
    return null;
  }
  if (envMissing === true) return null;
  if (browserClient) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    envMissing = true;
    return null;
  }
  browserClient = createClient(url, key);
  return browserClient;
}

/**
 * Load Supabase config from /api/config (uses Netlify SUPABASE_URL, SUPABASE_ANON_KEY) and set the browser client.
 */
export async function initSupabaseBrowserFromConfig(): Promise<SupabaseClient | null> {
  if (typeof window === 'undefined') return null;
  if (browserClient) return browserClient;
  if (envMissing === true) return null;
  try {
    const res = await fetch('/api/config');
    const data = (await res.json()) as { supabaseUrl?: string | null; supabaseAnonKey?: string | null };
    const url = data.supabaseUrl ?? null;
    const key = data.supabaseAnonKey ?? null;
    if (!url || !key) {
      envMissing = true;
      return null;
    }
  browserClient = createClient(url, key);
  return browserClient;
  } catch {
    envMissing = true;
    return null;
  }
}
