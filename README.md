# Market Health Checklist

Dashboard, scoring, and alerts for the Weekly Market Health Checklist (macro, equities, crypto, sentiment).

## Stack

- **Local**: NestJS API, TypeORM, BullMQ, Postgres, Redis; Next.js 14 + Tailwind.
- **Netlify**: Next.js on Netlify; API and jobs as serverless functions (no Redis/BullMQ). **Database: Supabase** (Postgres).

## Deploy on Netlify (with Supabase)

1. **Database (Supabase)**  
   - Create a project at [supabase.com](https://supabase.com).  
   - Get the connection string: **Project Settings → Database → Connection string → URI** (use "Transaction" mode, or "Session" if you prefer). For serverless (Netlify functions), the **Connection pooling** URI (port 6543) is recommended.  
   - Run the migration: in **Supabase → SQL Editor**, paste and run the contents of `apps/api/src/database/migrations/001_initial_schema.sql`. Or locally: `psql "$DATABASE_URL" -f apps/api/src/database/migrations/001_initial_schema.sql`.

2. **Netlify**: Connect the repo (build settings from repo `netlify.toml`):
   - Build command: `npm install && npm run build:web`
   - Publish directory: `apps/web/out`
   - Functions directory: `netlify/functions`

3. **Environment variables** (Site settings → Environment variables). Set these in Netlify so the API and cron can connect:
   - **`DATABASE_URL`** – **Preferred.** Supabase Postgres connection string: **Project Settings → Database → Connection string → URI** (use the **pooler** URI, port 6543, for serverless). When set, the API and cron use TypeORM over Postgres.
   - **When Postgres is not directly accessible:** leave `DATABASE_URL` unset and set **`SUPABASE_URL`** and **`SUPABASE_SERVICE_ROLE_KEY`**. The app will use Supabase’s REST API (no direct DB connection). Ensure the same tables exist (run the migration in Supabase SQL Editor).
   - **`SUPABASE_ANON_KEY`** – Optional; use if you add Supabase Auth/Realtime/Storage from the frontend.
   - `FRED_API_KEY` – FRED (10Y yield)
   - `TWELVE_DATA_API_KEY` – optional (DXY, Nasdaq, leaders)
   - `NEXT_PUBLIC_API_URL` – your Netlify site URL (e.g. `https://your-site.netlify.app`) so the app calls `/api` on the same origin
   - `CRON_SECRET` – optional; set to a secret string if you want to protect manual trigger of run-jobs (POST with `X-Cron-Secret: <CRON_SECRET>`)
   - `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `ALERT_EMAIL`, `DASHBOARD_LINK` – optional (alerts)

4. **Jobs**: The `run-jobs` function runs on a **schedule** (every 15 minutes via Netlify Scheduled Functions). No Redis or worker process. To trigger manually: `POST https://your-site.netlify.app/.netlify/functions/run-jobs` with header `X-Cron-Secret: <CRON_SECRET>` if set.

   **Indicators show no data?** Data is filled by `run-jobs`. Set **`FRED_API_KEY`** (required for 10Y yield and others) and optionally **`TWELVE_DATA_API_KEY`** in Netlify so the job can fetch data. After deploy, wait up to 15 minutes for the first scheduled run, or trigger the job manually (see above). Check Netlify → Functions → run-jobs logs for errors.

5. **Redirect**: `netlify.toml` rewrites `/api/*` to `/.netlify/functions/api`. The Next.js app uses `NEXT_PUBLIC_API_URL` or same-origin `/api`.

## Quick start (local)

1. **Start Postgres and Redis**

   ```bash
   docker compose up -d postgres redis
   ```

2. **Apply database migration**

   ```bash
   psql "$DATABASE_URL" -f apps/api/src/database/migrations/001_initial_schema.sql
   ```

   Or set `DATABASE_URL=postgresql://market:market@localhost:5432/market_health` if using default Docker Compose.

3. **Install and run API**

   ```bash
   npm install
   npm run dev:api
   ```

   API runs at http://localhost:3000. Set `FRED_API_KEY` and optionally `TWELVE_DATA_API_KEY` for full data (BTC and Fear & Greed work without keys).

4. **Run web**

   ```bash
   npm run dev:web
   ```

   Web runs at http://localhost:3001. Set `NEXT_PUBLIC_API_URL=http://localhost:3000` in `.env` or `.env.local` in `apps/web` if needed.

## Data sources (by indicator)

| Indicator      | Source        | API key / notes |
|----------------|---------------|------------------|
| **macro.us10y** | FRED (DGS10)  | `FRED_API_KEY` (free at fred.stlouisfed.org) |
| **macro.dxy**  | Twelve Data   | `TWELVE_DATA_API_KEY` (free tier) |
| **eq.nasdaq**  | Twelve Data   | `TWELVE_DATA_API_KEY` |
| **eq.leaders** | Twelve Data   | NVDA, MSFT, AAPL, GOOGL |
| **crypto.btc** | **CoinGecko** (primary), Binance (fallback) | No key for CoinGecko; works from any region. Binance often returns 451 from serverless (Netlify/AWS). |
| **sent.fng**   | Alternative.me | No key; Fear & Greed index |

BTC was previously Binance-only; Binance returns **451 Unavailable For Legal Reasons** from many datacenter IPs (e.g. Netlify). The app now uses **CoinGecko** first for `crypto.btc` (free, no key, no regional block).

## Where to set API keys

There is **no UI in the app** to store API keys. They are **server-only** and must be set in your hosting environment so they are never exposed to the browser.

- **On Netlify:** Site configuration → Environment variables. Add `FRED_API_KEY`, `TWELVE_DATA_API_KEY`, etc. Redeploy after changing them.
- **Local:** `.env` in the repo root (see `.env.example`).

The job and API read them via `process.env.*`; they are not stored in the database.

## Env

- `DATABASE_URL` – Postgres connection string (required for API)
- `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` – Redis for BullMQ
- `FRED_API_KEY` – FRED (10Y yield)
- `TWELVE_DATA_API_KEY` – DXY, Nasdaq, mega-caps (optional; DXY/equities disabled without it)
- `NEXT_PUBLIC_API_URL` – API base URL for the Next.js app (e.g. http://localhost:3000)
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `ALERT_EMAIL` – optional; for email alerts (SendGrid)
- `DASHBOARD_LINK` – optional; link in alert emails (default http://localhost:3001/dashboard)

## Project layout

- `apps/api` – NestJS API (local), provider adapters, status/rules engine, shared entities and services
- `apps/web` – Next.js dashboard
- `netlify/functions/api.ts` – serverless API (same routes as NestJS)
- `netlify/functions/run-jobs.ts` – scheduled job runner (fetch → aggregate → derived → status → rules)
- `netlify.toml` – build, redirects (/api → function)
- `apps/api/src/indicators/registry.json` – indicator config; copy in `netlify/functions/registry.json` for serverless
- `apps/api/src/database/migrations/` – SQL migrations (Supabase / plain Postgres)
