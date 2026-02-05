# Market Health Checklist

Dashboard, scoring, and alerts for the Weekly Market Health Checklist (macro, equities, crypto, sentiment).

## Stack

- **API**: NestJS, TypeORM, BullMQ, Postgres + TimescaleDB, Redis
- **Web**: Next.js 14, Tailwind
- **Jobs**: BullMQ workers (fetch, aggregate, status, alerts)

## Quick start

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

## Env

- `DATABASE_URL` – Postgres connection string (required for API)
- `REDIS_URL` or `REDIS_HOST`/`REDIS_PORT` – Redis for BullMQ
- `FRED_API_KEY` – FRED (10Y yield)
- `TWELVE_DATA_API_KEY` – DXY, Nasdaq, mega-caps (optional; DXY/equities disabled without it)
- `NEXT_PUBLIC_API_URL` – API base URL for the Next.js app (e.g. http://localhost:3000)
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `ALERT_EMAIL` – optional; for email alerts (SendGrid)
- `DASHBOARD_LINK` – optional; link in alert emails (default http://localhost:3001/dashboard)

## Project layout

- `apps/api` – NestJS API, jobs, provider adapters, status/rules engine
- `apps/web` – Next.js dashboard
- `apps/api/src/indicators/registry.json` – indicator config (keys, windows, poll intervals)
- `apps/api/src/database/migrations/` – SQL migrations (TimescaleDB)
# financials-alert
