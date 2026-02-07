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
    const NASDAQ_HEADERS = { 'User-Agent': 'Mozilla/5.0 (compatible)', Accept: 'application/json' };

    if (!twelveDataKey) {
      console.warn('[populate] TWELVE_DATA_API_KEY not set – skipping Twelve Data sources');
    }

    // ────────────────────────────────────────────────────
    // Phase 1: Fire ALL API fetches in parallel
    // ────────────────────────────────────────────────────
    console.log('[populate] Starting all API fetches in parallel…');

    const fetchTdStocks = twelveDataKey
      ? fetch(`https://api.twelvedata.com/stocks?country=United+States&apikey=${twelveDataKey}`).catch((e) => { console.error('[populate] TD stocks fetch error:', e); return null; })
      : Promise.resolve(null);

    const fetchTdEtfs = twelveDataKey
      ? fetch(`https://api.twelvedata.com/etf?country=United+States&apikey=${twelveDataKey}`).catch((e) => { console.error('[populate] TD ETF fetch error:', e); return null; })
      : Promise.resolve(null);

    const fetchTdCommodities = twelveDataKey
      ? fetch(`https://api.twelvedata.com/commodities?apikey=${twelveDataKey}`).catch((e) => { console.error('[populate] TD commodities fetch error:', e); return null; })
      : Promise.resolve(null);

    const fetchNasdaqEtfs = fetch(
      'https://api.nasdaq.com/api/screener/stocks?tableType=etf&limit=10000',
      { headers: NASDAQ_HEADERS },
    ).catch((e) => { console.warn('[populate] NASDAQ ETF fetch error:', e); return null; });

    const fetchNasdaqStocks = fetch(
      'https://api.nasdaq.com/api/screener/stocks?tableType=stocks&limit=25000',
      { headers: NASDAQ_HEADERS },
    ).catch((e) => { console.warn('[populate] NASDAQ stocks fetch error:', e); return null; });

    const fetchCrypto1 = fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1',
    ).catch((e) => { console.warn('[populate] CoinGecko p1 error:', e); return null; });

    const fetchCrypto2 = fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=2',
    ).catch((e) => { console.warn('[populate] CoinGecko p2 error:', e); return null; });

    const [tdStocksRes, tdEtfsRes, tdCommoditiesRes, nasdaqEtfsRes, nasdaqStocksRes, crypto1Res, crypto2Res] =
      await Promise.all([fetchTdStocks, fetchTdEtfs, fetchTdCommodities, fetchNasdaqEtfs, fetchNasdaqStocks, fetchCrypto1, fetchCrypto2]);

    console.log('[populate] All API fetches complete, parsing responses…');

    // ────────────────────────────────────────────────────
    // Phase 2: Parse responses (fast, CPU only)
    // ────────────────────────────────────────────────────

    // ── Stocks: Twelve Data + NASDAQ supplement ──
    type Row = { symbol: string; name: string; asset_type: string; exchange: string | null };
    const stockRows: Row[] = [];
    const stockSeen = new Set<string>();

    if (tdStocksRes?.ok) {
      const json = (await tdStocksRes.json()) as { data?: Array<{ symbol: string; name: string; exchange: string }> };
      for (const s of json.data || []) {
        if (!stockSeen.has(s.symbol)) {
          stockSeen.add(s.symbol);
          stockRows.push({ symbol: s.symbol, name: s.name, asset_type: 'stock', exchange: s.exchange });
        }
      }
      console.log(`[populate] ${stockRows.length} stocks from Twelve Data`);
    } else if (tdStocksRes) {
      console.error('[populate] TD /stocks status:', tdStocksRes.status);
    }

    if (nasdaqStocksRes?.ok) {
      const json = (await nasdaqStocksRes.json()) as { data?: { table?: { rows?: Array<{ symbol: string; name: string }> }; rows?: Array<{ symbol: string; name: string }> } };
      const rows = json?.data?.table?.rows || json?.data?.rows || [];
      let added = 0;
      for (const r of rows) {
        const sym = (r.symbol || '').trim();
        if (sym && !stockSeen.has(sym)) {
          stockSeen.add(sym);
          stockRows.push({ symbol: sym, name: (r.name || '').trim(), asset_type: 'stock', exchange: null });
          added++;
        }
      }
      console.log(`[populate] +${added} stocks from NASDAQ screener (total: ${stockRows.length})`);
    } else if (nasdaqStocksRes) {
      console.warn('[populate] NASDAQ stocks screener status:', nasdaqStocksRes.status);
    }

    // ── ETFs: Twelve Data + NASDAQ supplement ──
    const etfRows: Row[] = [];
    const etfSeen = new Set<string>();

    if (tdEtfsRes?.ok) {
      const json = (await tdEtfsRes.json()) as { data?: Array<{ symbol: string; name: string; exchange: string }> };
      for (const s of json.data || []) {
        if (!etfSeen.has(s.symbol)) {
          etfSeen.add(s.symbol);
          etfRows.push({ symbol: s.symbol, name: s.name, asset_type: 'etf', exchange: s.exchange });
        }
      }
      console.log(`[populate] ${etfRows.length} ETFs from Twelve Data`);
    } else if (tdEtfsRes) {
      console.error('[populate] TD /etf status:', tdEtfsRes.status);
    }

    if (nasdaqEtfsRes?.ok) {
      const json = (await nasdaqEtfsRes.json()) as { data?: { table?: { rows?: Array<{ symbol: string; name: string }> }; rows?: Array<{ symbol: string; name: string }> } };
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
      console.log(`[populate] +${added} ETFs from NASDAQ screener (total: ${etfRows.length})`);
    } else if (nasdaqEtfsRes) {
      console.warn('[populate] NASDAQ ETF screener status:', nasdaqEtfsRes.status);
    }

    // ── Commodities: Twelve Data + hardcoded fallback ──
    const commodityRows: Row[] = [];
    const commoditySeen = new Set<string>();

    if (tdCommoditiesRes?.ok) {
      const json = (await tdCommoditiesRes.json()) as { data?: Array<{ symbol: string; name: string; exchange?: string }> };
      for (const c of json.data || []) {
        if (!commoditySeen.has(c.symbol)) {
          commoditySeen.add(c.symbol);
          commodityRows.push({ symbol: c.symbol, name: c.name, asset_type: 'commodity', exchange: c.exchange || 'COMMODITY' });
        }
      }
      console.log(`[populate] ${commodityRows.length} commodities from Twelve Data`);
    } else if (tdCommoditiesRes) {
      console.warn('[populate] TD /commodities status:', tdCommoditiesRes.status);
    }

    for (const c of COMMODITIES) {
      if (!commoditySeen.has(c.symbol)) {
        commoditySeen.add(c.symbol);
        commodityRows.push({ symbol: c.symbol, name: c.name, asset_type: 'commodity', exchange: c.exchange });
      }
    }
    console.log(`[populate] ${commodityRows.length} total commodities (dynamic + hardcoded)`);

    // ── Crypto: CoinGecko ──
    const coins: Array<{ symbol: string; name: string }> = [];
    if (crypto1Res?.ok) coins.push(...((await crypto1Res.json()) as Array<{ symbol: string; name: string }>));
    if (crypto2Res?.ok) coins.push(...((await crypto2Res.json()) as Array<{ symbol: string; name: string }>));

    const cryptoSeen = new Set<string>();
    const cryptoRows: Row[] = coins
      .filter((c) => {
        const key = c.symbol.toUpperCase();
        if (cryptoSeen.has(key)) return false;
        cryptoSeen.add(key);
        return true;
      })
      .map((c) => ({ symbol: c.symbol.toUpperCase(), name: c.name, asset_type: 'crypto', exchange: 'Crypto' }));
    console.log(`[populate] ${cryptoRows.length} crypto from CoinGecko`);

    // ────────────────────────────────────────────────────
    // Phase 3: Upsert all data to Supabase in parallel
    // ────────────────────────────────────────────────────
    console.log('[populate] Upserting all categories in parallel…');

    const [stockCount, etfCount, commodityCount, cryptoCount] = await Promise.all([
      stockRows.length > 0 ? batchUpsert(supabase, stockRows) : Promise.resolve(0),
      etfRows.length > 0 ? batchUpsert(supabase, etfRows) : Promise.resolve(0),
      commodityRows.length > 0 ? batchUpsert(supabase, commodityRows) : Promise.resolve(0),
      cryptoRows.length > 0 ? batchUpsert(supabase, cryptoRows) : Promise.resolve(0),
    ]);

    results.stocks = stockCount;
    results.etfs = etfCount;
    results.commodities = commodityCount;
    results.crypto = cryptoCount;

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
