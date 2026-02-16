# eToro integration: scanner filter, trading, and demo/real setting

## Context

- **Scanner today**: `netlify/functions/api.ts` builds candidates from NASDAQ/CoinGecko/Twelve Data, scores them, then sends top N to OpenAI. Results are shown in `DashboardContent.tsx` (`ScannerSection`).
- **eToro API**: Base `https://public-api.etoro.com/api/v1`; auth via headers `x-api-key`, `x-user-key`, `x-request-id`. Search: `GET /market-data/search?internalSymbolFull={symbol}` to resolve symbol to `instrumentId`. Place order: `POST /trading/execution/market-open-orders/by-amount` (real) or demo path. Demo vs real is determined by the base path when placing orders.
- **Settings**: Settings page and preferences API read/write locale and theme; `user_preferences` (user_id, locale, updated_at); theme in 006.

---

## 1. Data model and preferences

**New table: `user_etoro_settings`**

- Columns: `user_id` (PK, FK auth.users), `api_key` (text), `user_key` (text), `updated_at` (timestamptz). RLS: user can only SELECT/INSERT/UPDATE own row. Do **not** return `api_key`/`user_key` in API responses.

**Extend `user_preferences`**

- Add `etoro_trading_mode text NOT NULL DEFAULT 'demo' CHECK (etoro_trading_mode IN ('demo', 'real'))`.
- Add **`etoro_investment_cap numeric(18,2) NOT NULL DEFAULT 0** (monto en dinero que el usuario define como techo para invertir; 0 = no automatizar por monto). En la app: solo se permite trading automático usando como máximo este capital inicial y/o las ganancias generadas por ese trading (ver sección 5).

Migration: `supabase/migrations/007_etoro_trading.sql`.

**Backend: preferences API**

- GET/POST `/api/user/preferences` must read/write `etoro_trading_mode` and **`etoro_investment_cap`**.

---

## 2. Scanner: only eToro assets

- Add optional **filter**: when request has `etoroOnly: true` and user has eToro credentials, restrict candidates to symbols that exist on eToro (e.g. via eToro Market Data Search per symbol or cached instrument list).
- **Market-scan payload**: optional `etoroOnly?: boolean`. When true, load `user_etoro_settings`, filter `allCandidates` by eToro search, then score + OpenAI.
- **Frontend**: Checkbox “Solo activos en eToro” in Scanner; send `etoroOnly: true`. Show checkbox only if user has eToro configured (e.g. `GET /api/user/etoro-settings` returns `{ configured: boolean }`).

---

## 3. Trading from scanner recommendations

- **Backend**: `POST /api/etoro/order` with `{ symbol, amount, isBuy, stopLoss?, takeProfit? }`. Resolve symbol via eToro search; call eToro market-open (demo or real) using `user_preferences.etoro_trading_mode`. **Before placing the order, backend must enforce the investment cap** (see section 5).
- **Frontend**: “Operar” / “Trade” button per scanner result; modal for amount and confirm; call `POST /api/etoro/order`. Only show when eToro configured.

---

## 4. Settings: eToro credentials, demo/real, and investment amount

**Backend**

- `GET /api/user/etoro-settings`: `{ configured: boolean }` (no keys).
- `POST /api/user/etoro-settings`: body `{ apiKey, userKey }`; upsert into `user_etoro_settings`.
- Preferences API: include **`etoro_investment_cap`** (read/write). Amount in user’s currency (e.g. USD).

**Frontend: Settings page**

- **eToro section**:
  - API Key and User Key (masked), save via POST etoro-settings.
  - **Trading account**: Demo | Real (persist `etoro_trading_mode`).
  - **Monto a invertir (Investment amount)**: input numérico (ej. USD). El usuario define el monto máximo en dinero que la automatización puede usar. Solo se invertirá con ese monto y/o las ganancias producto de ese trading (ver sección 5). Guardar en `etoro_investment_cap`. Si es 0, interpretar como “sin límite por monto” o deshabilitar trading automático hasta que defina un monto.
- i18n: eToro, API Key, User Key, Trading account, Demo, Real, **Monto a invertir**, and warning for Real + amount.

---

## 5. Regla de capital: solo monto definido + ganancias

**Requisito**: La automatización solo debe invertir con el **monto en dinero que el usuario define en Settings** y/o las **ganancias** generadas por ese trading.

**Implementación sugerida**:

1. **Guardar en el usuario**:
   - `etoro_investment_cap`: monto máximo que el usuario asigna (ej. 1000 USD). Definido en Settings.
   - Opcional: tabla o campos para “capital usado hasta ahora” (suma de montos invertidos desde ese capital) y “ganancias realizadas” (por cierre de posiciones), para poder calcular “capital disponible = cap inicial + ganancias - capital ya usado”. Si no se quiere persistir en BD, se puede derivar desde eToro (portfolio/PnL) cada vez.

2. **Al colocar una orden** (`POST /api/etoro/order`):
   - Leer `etoro_investment_cap` del usuario. Si es 0, rechazar orden automática o pedir que configure monto en Settings.
   - Obtener “capital disponible para trading automático”:
     - **Opción A (simple)**: Usar el endpoint de eToro que devuelve portfolio/cash (demo o real). Considerar “capital disponible” = mínimo entre `etoro_investment_cap` y el balance disponible en la cuenta, y no permitir que una sola orden supere lo que queda por “usar” de ese cap (p. ej. guardar en BD “total ya invertido desde cap” y disponible = cap - invertido + ganancias realizadas).
     - **Opción B (con seguimiento en BD)**: Tabla `etoro_trading_ledger` (user_id, type: 'allocation'|'profit'|'withdrawal', amount, order_id opcional, ts). “Capital disponible” = `etoro_investment_cap` + SUM(profits) - SUM(allocations). Al abrir posición: registrar allocation; al cerrar (webhook o polling): registrar profit. Al colocar orden: comprobar que amount <= capital disponible.
   - Si `amount` de la orden supera el capital disponible, responder 400 con mensaje claro (“Monto superior al capital asignado para trading automático”).
   - Si todo OK, llamar a eToro para abrir la posición (y, si se usa Opción B, registrar el allocation).

3. **UI**: En Settings, texto de ayuda junto al monto: “La automatización solo invertirá con este monto y/o las ganancias generadas por ese trading.”

**Resumen**: En Settings el usuario define el **monto en dinero a invertir**; la lógica de órdenes debe garantizar que la automatización solo use ese monto y/o las ganancias de ese trading (comprobando antes de cada orden y, si se desea, llevando un ledger de asignaciones y ganancias).

---

## 6. Flow summary

- Settings: user sets eToro keys, Demo/Real, and **investment amount** (`etoro_investment_cap`). Stored in `user_preferences` + `user_etoro_settings`.
- Scanner (eToro only): optional filter so only eToro instruments are scanned; results show “Trade” button.
- Trade: user clicks Trade, enters amount; backend checks amount <= capital available (cap + profits - used); then places order on eToro (demo or real).

---

## 7. Files to add or change (concise)

| Area | Action |
|------|--------|
| **DB** | Migration 007: `user_etoro_settings`; alter `user_preferences` add `etoro_trading_mode` default 'demo' and **`etoro_investment_cap`** default 0. |
| **API** | Etoro-settings GET/POST; preferences with `etoro_trading_mode` and **`etoro_investment_cap`**; market-scan `etoroOnly` filter; POST `/api/etoro/order` with **capital check** (solo monto + ganancias). |
| **Client** | getEtoroSettings, saveEtoroSettings, placeEtoroOrder; preferences types with **etoro_investment_cap**; fetchMarketScan(..., etoroOnly?). |
| **Settings UI** | eToro section: API key, User key, Demo/Real, **Monto a invertir** (input + helper text). |
| **Scanner UI** | Checkbox “Only eToro assets”; Trade button + amount modal; call placeEtoroOrder. |
| **i18n** | eToro labels, trading mode, **investment amount** label and help text. |

---

## 8. Security and safety

- eToro keys only server-side.
- Demo by default.
- **Nunca exceder el capital definido**: validar en backend que cada orden respete “solo monto definido + ganancias”.
