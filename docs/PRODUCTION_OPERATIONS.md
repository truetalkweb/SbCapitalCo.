# Production Operations

## Release Gate

1. Run `npm test` and `node --check server.js` in `backend`.
2. Run `npm run release:gate` in `frontend`.
3. Run `npm audit --omit=dev` in both repositories and review every finding.
4. Push only the tested commits. Railway deploys the backend from `main`; Vercel deploys the frontend from `main` or the approved production deployment.
5. After both deployments are ready, run `npm run smoke:production` in `frontend`.
6. Verify the authenticated terminal at 1920x1080, 1600x900, and 1366x768. Check all workspaces, chart pixels, console output, and provider degradation labels.

## Incident Triage

1. Record the user-visible request ID and UTC timestamp. Never request passwords, tokens, cookies, or broker credentials.
2. Check `/api/platform/health` for the public service mode. Owner Admin users can use Settings > Admin Monitoring and `/api/health/deep` for sanitized detail.
3. Isolate the failing service. A provider outage should not be treated as a frontend outage when cached or unrelated panels remain available.
4. Confirm whether the state is Live, Delayed, Cached, Simulated, Degraded, or Unavailable. Do not relabel missing financial values as zero.
5. Use Railway and Vercel logs filtered by request ID. Do not paste raw environment values or authorization headers into issue reports.

## Rollback

1. Stop the rollout if smoke tests, authentication, entitlements, CORS, or review-only safeguards regress.
2. In Vercel, promote the last verified production deployment. In Railway, redeploy the last verified backend commit.
3. Re-run `npm run smoke:production` after rollback.
4. Keep the failed commit available for diagnosis; do not rewrite production history or delete evidence.

## Provider Outage

1. Confirm timeout, cooldown, and cache behavior from sanitized Admin monitoring.
2. Leave bounded retry limits in place. Do not repeatedly refresh a quota-limited provider.
3. Keep cached data explicitly labeled with freshness. Mark unavailable values as unavailable.
4. Disable only the affected integration when necessary; keep independent workspaces operational.

## Secret Rotation

1. Rotate the credential in the provider and production secret stores. Never commit it or place it in a frontend environment variable.
2. Redeploy only the service that consumes the secret.
3. Verify authentication/provider health and inspect production bundles with `npm run smoke:production`.
4. Revoke the old credential after the new deployment is confirmed.
