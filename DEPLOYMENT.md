# SbCapitalCo Deployment Readiness

This runbook prepares the current React/Vite frontend for Vercel and the Node/Express backend for Railway. It does not deploy either service.

## Supabase

1. Apply `supabase/migrations/20260629080953_terminal_workspaces.sql` in the Supabase SQL editor or migration workflow.
2. Confirm `terminal_workspaces` has RLS enabled.
3. Confirm `anon` has no table grants and `authenticated` has select, insert, update, and delete grants.
4. Confirm each policy compares `auth.uid()` with `user_id` for its operation.
5. Keep email confirmation enabled for public signup.
6. Set the Auth Site URL and redirect allow-list to the production frontend domain, for example `https://www.sbcapitalco.com`.

## Vercel frontend variables

Required:

- `VITE_BROKER_API_URL` - Railway backend origin, without a trailing `/api` path.
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` - preferred public browser key. `VITE_SUPABASE_ANON_KEY` remains supported for legacy projects.
- `VITE_SUPABASE_WORKSPACE_TABLE=terminal_workspaces`
- `VITE_AUTH_REDIRECT_URL=https://www.sbcapitalco.com` - recommended in production so signup and password reset emails return to the canonical domain.

Production safety flags:

- `VITE_PUBLIC_PRODUCT_MODE=true`
- `VITE_ENABLE_BROKER_TOOLS=false`
- `VITE_ENABLE_LIVE_TRADING=false`
- `VITE_ENABLE_FINNHUB_REST=false`
- `VITE_ENABLE_FINNHUB_WS=false`
- `VITE_ENABLE_QUOTE_SSE=false`

Never place FMP, Finnhub, Gemini, OpenAI, Firebase private-key, Questrade refresh-token, or Supabase service-role values in a `VITE_*` variable.

## Railway backend variables

Core:

- `NODE_ENV=production`
- `PORT` - normally supplied by Railway.
- `CORS_ORIGIN=https://www.sbcapitalco.com,https://sbcapitalco.com` plus the final Vercel production origin if different.
- `ALLOW_LOCAL_CORS=false`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` or legacy `SUPABASE_ANON_KEY`
- `API_RATE_LIMIT=600`
- `AI_RATE_LIMIT=20`

Market/news/AI providers as used:

- `FMP_API_KEY`
- `FINNHUB_API_KEY` (optional)
- `AI_PROVIDER=gemini`
- `AI_MODEL=gemini-2.5-flash-lite`
- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-2.5-flash-lite`

Questrade and Firebase token persistence as used:

- `QUESTRADE_REFRESH_TOKEN`
- `PERSIST_QUESTRADE_REFRESH_TOKEN=false`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `QUESTRADE_TOKEN_COLLECTION`
- `QUESTRADE_TOKEN_DOC`

Trading safety:

- `PUBLIC_PRODUCT_MODE=true`
- `ENABLE_PUBLIC_BROKER_ROUTES=false`
- `LIVE_TRADING_ENABLED=false`
- `QUESTRADE_ORDER_PERMISSION_CONFIRMED=false`

Keep every provider credential in Railway only. Do not commit `.env` files.

## Local run

Backend:

```powershell
cd D:\Projects\trading-platform\backend
npm install
npm start
```

Frontend:

```powershell
cd D:\Projects\trading-platform\frontend
npm install
npm run dev
```

## Pre-deployment verification

```powershell
cd D:\Projects\trading-platform\frontend
npx eslint src
npm run build
npm audit --omit=dev

cd D:\Projects\trading-platform\backend
node --check server.js
npm audit --omit=dev
```

Then verify:

- Signup confirmation, login, logout, session restoration, and password-reset recovery.
- RLS owner isolation with two accounts.
- Missing, invalid, and expired bearer tokens return 401; valid tokens succeed.
- `/api/platform/health`, `/api/scanner`, `/api/news`, `/api/news/NVDA`, `/api/news/TSLA`, and `/api/movers` return successfully.
- Production CORS accepts only configured frontend origins.
- Browser console is clean at 1920x1080, 1600x900, 1366x768, and the narrow responsive viewport.
- Broker execution remains disabled and all order controls remain review/paper-only.

## Known provider behavior

- FMP free-tier or plan limits can return 429 responses. Scanner rows then use clearly labeled cached or fallback context.
- News may use Yahoo market/company feeds when configured provider coverage is limited.
- Questrade quotes and historical candles depend on a valid refresh token and current API permissions.
- Missing financial fields must display as unavailable; they must not be replaced with production-looking mock values.
