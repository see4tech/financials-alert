import { NextResponse } from 'next/server';

/**
 * Returns Supabase config from Netlify/server env (SUPABASE_URL, SUPABASE_ANON_KEY).
 * Used by the browser when NEXT_PUBLIC_* are not set.
 */
export async function GET() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ supabaseUrl: null, supabaseAnonKey: null });
  }
  return NextResponse.json({ supabaseUrl: url, supabaseAnonKey: anonKey });
}
