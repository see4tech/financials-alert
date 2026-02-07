import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

/** Major commodities – hardcoded as there is no standard free reference API. */
const COMMODITIES = [
  { symbol: 'XAUUSD', name: 'Gold Spot', exchange: 'COMMODITY' },
  { symbol: 'XAGUSD', name: 'Silver Spot', exchange: 'COMMODITY' },
  { symbol: 'XPTUSD', name: 'Platinum Spot', exchange: 'COMMODITY' },
  { symbol: 'XPDUSD', name: 'Palladium Spot', exchange: 'COMMODITY' },
  { symbol: 'CL', name: 'Crude Oil WTI', exchange: 'NYMEX' },
  { symbol: 'BZ', name: 'Brent Crude Oil', exchange: 'NYMEX' },
  { symbol: 'NG', name: 'Natural Gas', exchange: 'NYMEX' },
  { symbol: 'HG', name: 'Copper', exchange: 'COMEX' },
  { symbol: 'GC', name: 'Gold Futures', exchange: 'COMEX' },
  { symbol: 'SI', name: 'Silver Futures', exchange: 'COMEX' },
  { symbol: 'ZC', name: 'Corn', exchange: 'CBOT' },
  { symbol: 'ZW', name: 'Wheat', exchange: 'CBOT' },
  { symbol: 'ZS', name: 'Soybeans', exchange: 'CBOT' },
  { symbol: 'KC', name: 'Coffee', exchange: 'ICE' },
  { symbol: 'CT', name: 'Cotton', exchange: 'ICE' },
  { symbol: 'SB', name: 'Sugar', exchange: 'ICE' },
  { symbol: 'CC', name: 'Cocoa', exchange: 'ICE' },
  { symbol: 'OJ', name: 'Orange Juice', exchange: 'ICE' },
  { symbol: 'PA', name: 'Palladium Futures', exchange: 'NYMEX' },
  { symbol: 'PL', name: 'Platinum Futures', exchange: 'NYMEX' },
  { symbol: 'HO', name: 'Heating Oil', exchange: 'NYMEX' },
  { symbol: 'RB', name: 'RBOB Gasoline', exchange: 'NYMEX' },
];

function getSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required');
  return createClient(url, key);
}

/** Upsert rows in batches of batchSize. Returns total inserted/updated. */
async function batchUpsert(
  supabase: ReturnType<typeof createClient>,
  rows: Array<{ symbol: string; name: string; asset_type: string; exchange: string | null }>,
  batchSize = 500,
): Promise<number> {
  let count = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error } = await supabase
      .from('symbols')
      .upsert(batch, { onConflict: 'symbol,asset_type' });
    if (error) {
      console.error(`upsert batch error (offset ${i}):`, error.message);
    } else {
      count += batch.length;
    }
  }
  return count;
}

export const handler: Handler = async (event) => {
  // ── Auth ──
  const secret = event.headers['x-cron-secret'] || '';
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized – X-Cron-Secret required' }) };
  }

  try {
    const supabase = getSupabase();
    const twelveDataKey = process.env.TWELVE_DATA_API_KEY;
    const results: Record<string, number> = {};

    // ── 1. Stocks from Twelve Data (US only, no exchange filter) ──
    if (twelveDataKey) {
      try {
        console.log('[populate] Fetching stocks from Twelve Data…');
        const res = await fetch(
          `https://api.twelvedata.com/stocks?country=United+States&apikey=${twelveDataKey}`,
        );
        if (res.ok) {
          const json = (await res.json()) as {
            data?: Array<{ symbol: string; name: string; exchange: string; type: string }>;
          };
          if (!json.data || json.data.length === 0) {
            console.warn('[populate] /stocks returned empty data. Status:', res.status, 'snippet:', JSON.stringify(json).slice(0, 300));
          }
          const rows = (json.data || []).map((s) => ({
            symbol: s.symbol,
            name: s.name,
            asset_type: 'stock' as const,
            exchange: s.exchange,
          }));
          console.log(`[populate] ${rows.length} stocks fetched, upserting…`);
          results.stocks = await batchUpsert(supabase, rows);
        } else {
          const body = await res.text().catch(() => '');
          console.error('[populate] Twelve Data /stocks status:', res.status, 'body:', body.slice(0, 300));
        }
      } catch (e) {
        console.error('[populate] stocks error:', e);
      }
    } else {
      console.warn('[populate] TWELVE_DATA_API_KEY not set – skipping stocks & ETFs & commodities from Twelve Data');
    }

    // ── 2. ETFs – Twelve Data + NASDAQ screener (Twelve Data is incomplete) ──
    {
      const etfRows: Array<{ symbol: string; name: string; asset_type: 'etf'; exchange: string | null }> = [];
      const etfSeen = new Set<string>();

      // 2a. Twelve Data ETFs
      if (twelveDataKey) {
        try {
          console.log('[populate] Fetching ETFs from Twelve Data…');
          const res = await fetch(
            `https://api.twelvedata.com/etf?country=United+States&apikey=${twelveDataKey}`,
          );
          if (res.ok) {
            const json = (await res.json()) as {
              data?: Array<{ symbol: string; name: string; exchange: string }>;
            };
            if (!json.data || json.data.length === 0) {
              console.warn('[populate] /etf returned empty data. Status:', res.status, 'snippet:', JSON.stringify(json).slice(0, 300));
            }
            for (const s of json.data || []) {
              if (!etfSeen.has(s.symbol)) {
                etfSeen.add(s.symbol);
                etfRows.push({ symbol: s.symbol, name: s.name, asset_type: 'etf', exchange: s.exchange });
              }
            }
            console.log(`[populate] ${etfRows.length} ETFs from Twelve Data`);
          } else {
            const body = await res.text().catch(() => '');
            console.error('[populate] Twelve Data /etf status:', res.status, 'body:', body.slice(0, 300));
          }
        } catch (e) {
          console.error('[populate] Twelve Data ETF error:', e);
        }
      }

      // 2b. NASDAQ screener – supplements Twelve Data with missing ETFs (e.g. VOO, VIG)
      try {
        console.log('[populate] Fetching ETFs from NASDAQ screener…');
        const res = await fetch(
          'https://api.nasdaq.com/api/screener/stocks?tableType=etf&limit=10000',
          { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', Accept: 'application/json' } },
        );
        if (res.ok) {
          const json = (await res.json()) as {
            data?: {
              table?: { rows?: Array<{ symbol: string; name: string }> };
              rows?: Array<{ symbol: string; name: string }>;
            };
          };
          const rows = json?.data?.table?.rows || json?.data?.rows || [];
          let added = 0;
          for (const r of rows) {
            const sym = (r.symbol || '').trim();
            if (sym && !etfSeen.has(sym)) {
              etfSeen.add(sym);
              etfRows.push({ symbol: sym, name: (r.name || '').trim(), asset_type: 'etf', exchange: null });
              added++;
            }
          }
          console.log(`[populate] ${added} additional ETFs from NASDAQ screener (total: ${etfRows.length})`);
        } else {
          const body = await res.text().catch(() => '');
          console.warn('[populate] NASDAQ ETF screener status:', res.status, 'body:', body.slice(0, 300));
        }
      } catch (e) {
        console.warn('[populate] NASDAQ ETF screener error:', e);
      }

      if (etfRows.length > 0) {
        console.log(`[populate] ${etfRows.length} total ETFs, upserting…`);
        results.etfs = await batchUpsert(supabase, etfRows);
      }
    }

    // ── 2c. Supplement stocks from NASDAQ screener ──
    try {
      console.log('[populate] Fetching stocks from NASDAQ screener…');
      const res = await fetch(
        'https://api.nasdaq.com/api/screener/stocks?tableType=stocks&limit=25000',
        { headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', Accept: 'application/json' } },
      );
      if (res.ok) {
        const json = (await res.json()) as {
          data?: {
            table?: { rows?: Array<{ symbol: string; name: string }> };
            rows?: Array<{ symbol: string; name: string }>;
          };
        };
        const rows = json?.data?.table?.rows || json?.data?.rows || [];
        const stockRows = rows
          .filter((r) => (r.symbol || '').trim().length > 0)
          .map((r) => ({
            symbol: (r.symbol || '').trim(),
            name: (r.name || '').trim(),
            asset_type: 'stock' as const,
            exchange: null as string | null,
          }));
        if (stockRows.length > 0) {
          console.log(`[populate] ${stockRows.length} stocks from NASDAQ screener, upserting…`);
          const nasdaqStocks = await batchUpsert(supabase, stockRows);
          results.stocks = (results.stocks || 0) + nasdaqStocks;
          results.nasdaq_stocks_supplement = nasdaqStocks;
        } else {
          console.warn('[populate] NASDAQ stock screener returned 0 rows');
        }
      } else {
        const body = await res.text().catch(() => '');
        console.warn('[populate] NASDAQ stock screener status:', res.status, 'body:', body.slice(0, 300));
      }
    } catch (e) {
      console.warn('[populate] NASDAQ stock screener error:', e);
    }

    // ── 3. Commodities – Twelve Data dynamic list + hardcoded fallback ──
    try {
      const dynamicRows: Array<{ symbol: string; name: string; asset_type: 'commodity'; exchange: string | null }> = [];
      if (twelveDataKey) {
        try {
          console.log('[populate] Fetching commodities from Twelve Data…');
          const res = await fetch(
            `https://api.twelvedata.com/commodities?apikey=${twelveDataKey}`,
          );
          if (res.ok) {
            const json = (await res.json()) as {
              data?: Array<{ symbol: string; name: string; exchange?: string }>;
            };
            if (!json.data || json.data.length === 0) {
              console.warn('[populate] /commodities returned empty data. snippet:', JSON.stringify(json).slice(0, 300));
            }
            for (const c of json.data || []) {
              dynamicRows.push({
                symbol: c.symbol,
                name: c.name,
                asset_type: 'commodity',
                exchange: c.exchange || 'COMMODITY',
              });
            }
            console.log(`[populate] ${dynamicRows.length} commodities fetched from Twelve Data`);
          } else {
            const body = await res.text().catch(() => '');
            console.warn('[populate] Twelve Data /commodities status:', res.status, 'body:', body.slice(0, 300));
          }
        } catch (e) {
          console.warn('[populate] Twelve Data commodities error (falling back to hardcoded):', e);
        }
      }
      // Merge: start with dynamic, add any hardcoded symbols not already present
      const seenSymbols = new Set(dynamicRows.map((r) => r.symbol));
      for (const c of COMMODITIES) {
        if (!seenSymbols.has(c.symbol)) {
          dynamicRows.push({ symbol: c.symbol, name: c.name, asset_type: 'commodity', exchange: c.exchange });
        }
      }
      console.log(`[populate] ${dynamicRows.length} total commodities (dynamic + hardcoded), upserting…`);
      results.commodities = await batchUpsert(supabase, dynamicRows);
    } catch (e) {
      console.error('[populate] commodity error:', e);
    }

    // ── 4. Crypto from CoinGecko (top 500 by market cap) ──
    try {
      console.log('[populate] Fetching crypto from CoinGecko…');
      const page1 = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1',
      );
      const page2 = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=2',
      );
      const coins: Array<{ symbol: string; name: string }> = [];
      if (page1.ok) coins.push(...((await page1.json()) as Array<{ symbol: string; name: string }>));
      if (page2.ok) coins.push(...((await page2.json()) as Array<{ symbol: string; name: string }>));

      // Deduplicate by uppercase symbol (some coins share symbols)
      const seen = new Set<string>();
      const rows = coins
        .filter((c) => {
          const key = c.symbol.toUpperCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .map((c) => ({
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          asset_type: 'crypto' as const,
          exchange: 'Crypto' as string | null,
        }));
      console.log(`[populate] ${rows.length} crypto fetched, upserting…`);
      results.crypto = await batchUpsert(supabase, rows);
    } catch (e) {
      console.error('[populate] crypto error:', e);
    }

    console.log('[populate] Done:', results);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, results }),
    };
  } catch (e) {
    console.error('[populate] Fatal:', e);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
    };
  }
};
