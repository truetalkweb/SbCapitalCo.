# SB Terminal Public Launch Security

## Current Data Model

Authenticated workspace data is stored in `public.terminal_workspaces`, one row per
Supabase user. Its `data` document contains the user's watchlist, alerts, scanner
presets, settings, chart layouts, journal entries, replay notes/bookmarks, and
review-only local orders/positions. Ownership is enforced by `user_id` and RLS.

Plan assignments are stored in `public.user_entitlements`. Users may read only
their own row. Only the backend service-role/admin workflow may create or change
plans. Frontend state and `user_metadata` are never authorization sources.

## Applied Migration

Apply, in order:

1. `supabase/migrations/20260629080953_terminal_workspaces.sql`
2. `supabase/migrations/20260719000000_public_launch_security.sql`

The second migration is idempotent and:

- adds workspace `created_at`, `client_updated_at`, `schema_version`, and `revision`;
- requires workspace data to be a JSON object no larger than 2 MB;
- removes excess authenticated grants such as `TRUNCATE`, `TRIGGER`, and `REFERENCES`;
- recreates owner-only workspace RLS policies;
- creates/hardens `user_entitlements`;
- gives authenticated users read-only access to their own entitlement;
- adds server-generated audit timestamps and workspace revisions.

The public-launch migration was applied to production on July 19, 2026. Live
verification confirmed its columns, validated constraints, triggers, minimal
grants, owner-only policies, and two-user isolation behavior.

## Supabase Auth Configuration

Set the project Site URL:

```text
https://www.sbcapitalco.com
```

Add allowed Redirect URLs:

```text
https://www.sbcapitalco.com
https://www.sbcapitalco.com/**
http://127.0.0.1:5173
http://localhost:5173
```

Local URLs are development-only. Production now uses the canonical HTTPS Site URL
and includes the `www` wildcard redirect. The minimum password length is 8.
Leaked-password protection requires Supabase Pro and remains unavailable on the
current Free plan.

## Frontend Environment

Only public browser-safe values belong here:

```text
VITE_BROKER_API_URL=https://sbcapitalco-backend-production.up.railway.app
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_WORKSPACE_TABLE=terminal_workspaces
VITE_AUTH_REDIRECT_URL=https://www.sbcapitalco.com
VITE_PUBLIC_PRODUCT_MODE=true
VITE_ENABLE_BROKER_TOOLS=false
VITE_ENABLE_LIVE_TRADING=false
```

Never add `SUPABASE_SERVICE_ROLE_KEY`, broker refresh tokens, Firebase private
keys, Gemini/OpenAI keys, or market-provider keys to frontend or `VITE_*` values.

## Backend Environment

```text
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
CORS_ORIGIN=https://www.sbcapitalco.com,https://sbcapitalco.com
ALLOW_LOCAL_CORS=false
API_RATE_LIMIT=3000
AI_RATE_LIMIT=20
ADMIN_API_RATE_LIMIT=60
PUBLIC_PRODUCT_MODE=true
ENABLE_PUBLIC_BROKER_ROUTES=false
LIVE_TRADING_ENABLED=false
```

The service-role key is backend-only and is required for controlled Admin plan
updates. Rotate it immediately if it is ever exposed outside Railway/backend
secrets.

## Plan Boundaries

- Free: Dashboard, Scanner, Charts, Watchlist, News, Alerts, Settings, Orders, and
  Positions. Orders and Positions are review-only without supported broker access.
- Pro: Free plus AI summaries, Replay, and Journal.
- Premium: Pro plus Risk, Performance, and broker diagnostics/data.
- Admin: all capabilities plus the protected entitlement-management API.

`past_due` and `cancelled` rows fail closed to Free capabilities. Every protected
backend route checks both plan rank and server-issued capability.

## Release Verification

1. Apply the migration and rerun Supabase security/performance advisors.
2. Confirm authenticated grants are only `SELECT`, `INSERT`, `UPDATE`, and
   `DELETE` on `terminal_workspaces`, and only `SELECT` on `user_entitlements`.
3. Sign in as two separate test users. Save different watchlists, alerts, layouts,
   journal entries, and replay notes. Refresh and verify no cross-account data.
4. Open two sessions for one user, edit both, and verify the stale session restores
   the newer cloud revision instead of overwriting it.
5. Verify Free, Pro, Premium, inactive, and Admin accounts against both UI locks and
   protected APIs.
6. Verify confirmation, expired confirmation, reset-password, logout, session
   restoration, and session-expired states on the production domain.
7. Run `npm test`, `npx eslint src test`, and `npm run build` in `frontend`.
8. Run `npm test` and `node --check server.js` in `backend`.
9. Confirm browser console/network logs contain no secrets, raw provider errors, or
   unexpected 401/403/500 responses.

## Known Pre-Deployment Items

- Frontend and backend application changes have not been deployed.
- Supabase leaked-password protection is unavailable on the current Free plan.
- Production email confirmation/reset must be exercised after the canonical redirect
  settings and verified frontend build are deployed.
- Stripe and live broker execution are intentionally outside this phase.
