# Public Launch Security Completion Audit

Status is based on inspected source, local tests, browser QA, production Supabase
queries, the production migration applied on July 19, 2026, and production Auth
email flows exercised against `https://www.sbcapitalco.com`.

| Requirement | Status | Evidence |
| --- | --- | --- |
| User-owned workspace has `user_id` and timestamps | Verified live | `terminal_workspaces` has non-null `user_id`, `created_at`, and `updated_at`, plus `client_updated_at`. |
| Owner-only RLS | Verified live | RLS is enabled; SELECT/INSERT/UPDATE/DELETE policies compare `auth.uid()` with `user_id`. Two-user read/write isolation was verified. |
| Minimal table grants | Verified live | Authenticated users have only SELECT/INSERT/UPDATE/DELETE on workspaces and SELECT on entitlements; anon has no table grants. |
| Bounded workspace documents | Verified live | Database constraints and the client require a JSON object no larger than 2 MB. |
| Role-based Admin | Verified | Admin comes from the entitlement table/Auth `app_metadata`; frontend email and development-preview bypasses are absent. |
| Backend-only secrets | Verified locally | Frontend secret scan found no credential values; service-role and provider keys are documented as backend-only. |
| Free/Pro/Premium/Admin boundaries | Verified locally | Frontend and backend policy tests cover all plans, inactive plans, explicit denial, and forged capabilities. |
| Free Orders/Positions review-only | Verified locally | Premium UI actions prepare reviews; dormant order execution also requires enabled broker tools and an active supported broker connection. |
| Cloud persistence coverage | Verified in source | Workspace payload contains watchlists, alerts, scanner presets, settings, layouts, journal entries, replay notes/bookmarks, and review data. |
| Conflict handling | Verified schema/client | Live audit triggers increment server revisions; revision-aware client updates restore newer cloud data instead of overwriting it. |
| Offline/local fallback | Verified in source | Fallback is scoped by authenticated user ID, validated, size-bounded, and used when cloud access is unavailable. |
| Saving/offline/error states | Verified in source | Saving, saved, offline, restoring, conflict-restored, and cloud-unavailable states are present. |
| Signup/login/reset enumeration safety | Verified locally | Signup/reset use generic responses; invalid login does not reveal account existence. |
| Expired Auth link UX | Verified in browser | Invalid callback parameters show a recovery message and are removed from the URL. |
| Production confirmation/reset redirects | Verified live | Signup confirmation and password-reset emails were delivered to an isolated test account. Both links returned to `https://www.sbcapitalco.com`; confirmation established a session, recovery accepted a new password, and subsequent login succeeded. |
| Protected API authentication | Verified locally | Diagnostic, Admin, AI, watchlist, audit, and account APIs use authenticated middleware and plan/capability checks. |
| Input validation/rate limits/CORS | Verified locally | Bounded inputs, route-specific rate limits, production allowlist CORS, and untrusted-origin rejection are implemented. |
| Public error sanitization | Verified locally | Health/provider responses omit tokens, private URLs, keys, cache internals, and raw provider diagnostics. |
| Structured secret-safe logs | Verified in source | Server logging records event metadata and error codes without tokens, emails, or raw provider messages. |
| Supabase advisors | Partially clear | Performance has no findings. Leaked-password protection is unavailable on the current Supabase Free plan; minimum password length is now 8. |

## Deployment And Remaining Limitation

The hardened frontend is deployed to Vercel and aliased to
`https://www.sbcapitalco.com`. The hardened backend is deployed to Railway.
Production signup confirmation, password recovery, logout, session restoration,
protected-route rejection, and two-user isolation have been verified.

Supabase leaked-password protection remains unavailable on the current Free plan.
Upgrade to Supabase Pro before enabling that optional Auth protection. Stripe and
live broker execution remain intentionally outside this security phase.
