import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(__dirname, "..");
const artifactDir = path.join(frontendRoot, "release-gate-artifacts", "authenticated-production");
const reportPath = path.join(frontendRoot, "release-gate-artifacts", "authenticated-production-audit.json");
const productionUrl = String(process.env.PRODUCTION_URL || "https://www.sbcapitalco.com").replace(/\/+$/, "");
const backendUrl = String(process.env.BACKEND_URL || "https://sbcapitalco-backend-production.up.railway.app").replace(/\/+$/, "");
const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
const publishableKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "").trim();
const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const ownerEmail = String(process.env.PRIVATE_BROKER_OWNER_EMAILS || "").split(",")[0]?.trim().toLowerCase();
const runId = `${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;

const workspaceIds = [
  "dashboard", "scanner", "chart-analysis", "watchlist", "news", "alerts", "orders",
  "positions", "risk", "performance", "replay", "journal", "settings",
];
const freeWorkspaceIds = new Set([
  "dashboard", "scanner", "chart-analysis", "watchlist", "news", "alerts", "orders", "positions", "settings",
]);
const premiumWorkspaceIds = new Set(workspaceIds);
const createdUserIds = [];
const createdUserEmails = [];
const report = {
  schemaVersion: 1,
  runId,
  startedAt: new Date().toISOString(),
  targets: { frontend: productionUrl, backend: backendUrl },
  checks: [],
  screenshots: [],
  browserDiagnostics: [],
  expectedDiagnostics: [],
  passed: false,
};

function requireEnvironment() {
  const missing = [
    ["SUPABASE_URL", supabaseUrl],
    ["SUPABASE_PUBLISHABLE_KEY", publishableKey],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
    ["PRIVATE_BROKER_OWNER_EMAILS", ownerEmail],
  ].filter(([, value]) => !value).map(([name]) => name);
  assert.equal(missing.length, 0, `Missing required server environment: ${missing.join(", ")}`);
}

function record(name, details = {}) {
  report.checks.push({ name, passed: true, ...details });
  process.stdout.write(`PASS ${name}\n`);
}

function safeError(error) {
  return String(error?.message || error || "Unknown audit failure")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[redacted]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted-email]")
    .slice(0, 600);
}

function makePassword() {
  return `Audit!${crypto.randomBytes(18).toString("base64url")}9z`;
}

function makeClient(key, accessToken) {
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

async function api(pathname, accessToken, options = {}) {
  const response = await fetch(`${backendUrl}${pathname}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

async function createFixture(admin, role) {
  const email = `audit-${role}-${runId}@example.com`;
  const password = makePassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { audit_fixture: true },
  });
  assert.ifError(error);
  assert.ok(data.user?.id, `Could not create ${role} fixture`);
  createdUserIds.push(data.user.id);
  createdUserEmails.push(email);
  return { role, email, password, id: data.user.id };
}

async function findUserByEmail(admin, email) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  assert.ifError(error);
  return data.users.find((user) => String(user.email || "").toLowerCase() === email);
}

async function passwordSession(fixture) {
  const client = makeClient(publishableKey);
  const { data, error } = await client.auth.signInWithPassword({ email: fixture.email, password: fixture.password });
  assert.ifError(error);
  assert.ok(data.session?.access_token, `No ${fixture.role} access token`);
  return { client, accessToken: data.session.access_token };
}

async function ownerSession(admin) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: ownerEmail,
    options: { redirectTo: productionUrl },
  });
  assert.ifError(error);
  assert.ok(data.properties?.hashed_token, "Owner magic-link token hash was not returned");
  const client = makeClient(publishableKey);
  const verified = await client.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "email" });
  assert.ifError(verified.error);
  assert.ok(verified.data.session?.access_token, "Owner audit session was not established");
  return { accessToken: verified.data.session.access_token };
}

async function assignPlan(ownerAccessToken, fixture, plan) {
  const { response, payload } = await api("/api/admin/entitlements", ownerAccessToken, {
    method: "POST",
    body: JSON.stringify({ userId: fixture.id, plan, status: "active", notes: `Production beta audit ${runId}` }),
  });
  assert.equal(response.status, 200, `Admin entitlement update failed with ${response.status}`);
  assert.equal(payload.updated, true);
  assert.equal(payload.plan, plan);
}

async function verifyEntitlements(owner, free, premium) {
  await assignPlan(owner.accessToken, free.fixture, "free");
  await assignPlan(owner.accessToken, premium.fixture, "premium");

  for (const current of [owner, free, premium]) {
    const { response, payload } = await api("/api/entitlements/me", current.accessToken);
    assert.equal(response.status, 200, `${current.role} entitlement lookup failed`);
    assert.equal(payload.plan, current.role);
    assert.equal(payload.status, "active");
    assert.ok(payload.capabilities && typeof payload.capabilities === "object");
  }
  record("owner-admin-and-fixture-entitlements");

  for (const current of [free, premium]) {
    const denied = await api("/api/admin/monitoring", current.accessToken);
    assert.ok([402, 403].includes(denied.response.status), `${current.role} unexpectedly accessed Admin monitoring`);
  }
  const monitoring = await api("/api/admin/monitoring", owner.accessToken);
  assert.equal(monitoring.response.status, 200);
  assert.ok(monitoring.payload.efficiency && monitoring.payload.services);
  const config = await api("/api/config/status", owner.accessToken);
  assert.equal(config.response.status, 200);
  assert.equal(config.payload.publicProductMode, true);
  assert.equal(config.payload.brokerRoutesEnabled, false);
  record("admin-route-isolation-and-public-product-safety", {
    publicProductMode: true,
    brokerRoutesEnabled: false,
  });
}

async function verifyRls(free, premium) {
  const freeDb = makeClient(publishableKey, free.accessToken);
  const premiumDb = makeClient(publishableKey, premium.accessToken);

  const forbiddenInsert = await freeDb.from("terminal_workspaces").insert({
    user_id: premium.fixture.id,
    data: { audit: "cross-user-write" },
  });
  assert.ok(forbiddenInsert.error, "Cross-user workspace insert was not blocked");

  for (const current of [free, premium]) {
    const ownDb = current.role === "free" ? freeDb : premiumDb;
    const upsert = await ownDb.from("terminal_workspaces").upsert({
      user_id: current.fixture.id,
      data: { audit: { runId, role: current.role, stage: 1 }, themeMode: "dark" },
      schema_version: 1,
      client_updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }).select("revision,data").single();
    assert.ifError(upsert.error);
    assert.equal(upsert.data.revision, 1);

    const update = await ownDb.from("terminal_workspaces")
      .update({ data: { audit: { runId, role: current.role, stage: 2 }, themeMode: "dark" } })
      .eq("user_id", current.fixture.id)
      .select("revision,data").single();
    assert.ifError(update.error);
    assert.equal(update.data.revision, 2);
    assert.equal(update.data.data.audit.stage, 2);
  }

  const freeSeesPremium = await freeDb.from("terminal_workspaces").select("user_id").eq("user_id", premium.fixture.id);
  const premiumSeesFree = await premiumDb.from("terminal_workspaces").select("user_id").eq("user_id", free.fixture.id);
  assert.ifError(freeSeesPremium.error);
  assert.ifError(premiumSeesFree.error);
  assert.equal(freeSeesPremium.data.length, 0);
  assert.equal(premiumSeesFree.data.length, 0);

  for (const current of [free, premium]) {
    const ownDb = current.role === "free" ? freeDb : premiumDb;
    const own = await ownDb.from("user_entitlements").select("user_id,plan,status").eq("user_id", current.fixture.id);
    const otherId = current.role === "free" ? premium.fixture.id : free.fixture.id;
    const other = await ownDb.from("user_entitlements").select("user_id").eq("user_id", otherId);
    assert.ifError(own.error);
    assert.ifError(other.error);
    assert.equal(own.data.length, 1);
    assert.equal(own.data[0].plan, current.role);
    assert.equal(other.data.length, 0);
    const write = await ownDb.from("user_entitlements").update({ plan: "admin" }).eq("user_id", current.fixture.id);
    assert.ok(write.error, `${current.role} could write its entitlement`);
  }
  record("supabase-owner-only-workspace-and-entitlement-rls");
}

function attachDiagnostics(page, role) {
  const diagnostics = [];
  page.on("pageerror", (error) => diagnostics.push({ role, type: "pageerror", message: safeError(error) }));
  page.on("console", (message) => {
    if (message.type() === "error") {
      const locationUrl = message.location()?.url || "";
      diagnostics.push({
        role,
        type: "console",
        message: safeError(message.text()),
        path: locationUrl && (locationUrl.startsWith(productionUrl) || locationUrl.startsWith(backendUrl))
          ? new URL(locationUrl).pathname
          : undefined,
      });
    }
  });
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() >= 400 && (url.startsWith(productionUrl) || url.startsWith(backendUrl))) {
      diagnostics.push({ role, type: "http", status: response.status(), path: new URL(url).pathname });
    }
  });
  return diagnostics;
}

async function login(page, fixture) {
  await page.goto(productionUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByLabel("Email").fill(fixture.email);
  await page.getByLabel("Password").fill(fixture.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.locator('nav[aria-label="Terminal workspaces"]').waitFor({ state: "visible", timeout: 60_000 });
}

async function dismissOnboarding(page) {
  const dismiss = page.getByRole("button", { name: "Do not show again", exact: true });
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
}

async function createFreeFixtureThroughUi(admin, browser) {
  const fixture = {
    role: "free",
    email: `audit-free-${runId}@sbcapitalco.com`,
    password: makePassword(),
  };
  createdUserEmails.push(fixture.email);
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page, "auth-lifecycle");

  await page.goto(productionUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("tab", { name: "Create account", exact: true }).click();
  await page.getByLabel("Email").fill(fixture.email);
  await page.getByLabel("Password").fill(fixture.password);
  await page.locator("form").getByRole("button", { name: "Create account", exact: true }).click();
  const signupStatus = page.getByRole("status");
  await signupStatus.waitFor({ state: "visible", timeout: 30_000 });
  const signupMessage = await signupStatus.innerText();
  let user = await findUserByEmail(admin, fixture.email);
  let signupRequest = "created";
  if (!user?.id) {
    assert.match(signupMessage, /rate|too many|email/i, "Public signup failed for an unexpected reason");
    signupRequest = "mail-rate-limited-generated-link-fallback";
    const fallback = await admin.auth.admin.createUser({
      email: fixture.email,
      password: fixture.password,
      email_confirm: false,
      app_metadata: { audit_fixture: true },
    });
    assert.ifError(fallback.error);
    user = fallback.data.user;
  }
  assert.ok(user?.id, "Public signup did not create a Supabase user");
  fixture.id = user.id;
  createdUserIds.push(user.id);

  const confirmation = await admin.auth.admin.generateLink({
    type: "signup",
    email: fixture.email,
    password: fixture.password,
    options: { redirectTo: productionUrl },
  });
  assert.ifError(confirmation.error);
  assert.ok(confirmation.data.properties?.action_link, "Signup confirmation link was not generated");
  await page.goto(confirmation.data.properties.action_link, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator('nav[aria-label="Terminal workspaces"]').waitFor({ state: "visible", timeout: 60_000 });
  assert.equal(new URL(page.url()).origin, new URL(productionUrl).origin, "Confirmation did not return to the canonical origin");
  await dismissOnboarding(page);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Secure workspace" }).waitFor({ state: "visible", timeout: 30_000 });

  const recovery = await admin.auth.admin.generateLink({ type: "recovery", email: fixture.email, options: { redirectTo: productionUrl } });
  assert.ifError(recovery.error);
  assert.ok(recovery.data.properties?.action_link, "Recovery link was not generated");
  await page.goto(recovery.data.properties.action_link, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByRole("heading", { name: "Set a new password" }).waitFor({ state: "visible", timeout: 60_000 });
  const nextPassword = makePassword();
  await page.locator('input[autocomplete="new-password"]').fill(nextPassword);
  await page.getByRole("button", { name: "Update password", exact: true }).click();
  await page.locator('nav[aria-label="Terminal workspaces"]').waitFor({ state: "visible", timeout: 60_000 });
  fixture.password = nextPassword;
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Secure workspace" }).waitFor({ state: "visible", timeout: 30_000 });

  const unexpectedDiagnostics = diagnostics.filter((item) => {
    const expectedMailThrottle = signupRequest === "mail-rate-limited-generated-link-fallback"
      && item.type === "console"
      && /status of 429/i.test(item.message);
    if (expectedMailThrottle) report.expectedDiagnostics.push({ role: item.role, type: "mail-rate-limit", status: 429 });
    return !expectedMailThrottle;
  });
  report.browserDiagnostics.push(...unexpectedDiagnostics);
  assert.equal(unexpectedDiagnostics.filter((item) => item.type === "pageerror").length, 0, "Auth lifecycle had browser page errors");
  await context.close();
  record("public-signup-confirmation-recovery-and-canonical-redirect", { signupRequest });
  return fixture;
}

async function visitWorkspace(page, id, allowed) {
  const workspaceNav = page.locator('nav[aria-label="Terminal workspaces"]');
  const button = workspaceNav.locator(`[data-workspace-id="${id}"]`);
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await workspaceNav.locator(`[data-workspace-id="${id}"][aria-current="page"]`).waitFor({ state: "visible", timeout: 10_000 });
  await page.waitForTimeout(id === "dashboard" || id === "chart-analysis" || id === "replay" ? 900 : 250);
  const locked = await page.getByRole("heading", { name: "Upgrade required" }).count();
  assert.equal(Boolean(locked), !allowed, `${id} access mismatch`);
}

async function verifyBrowserRole(browser, current, allowedWorkspaces, { capture = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page, current.role);
  await login(page, current.fixture);
  await dismissOnboarding(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('nav[aria-label="Terminal workspaces"]').waitFor({ state: "visible", timeout: 60_000 });
  await dismissOnboarding(page);
  record(`${current.role}-session-restoration`);

  for (const id of workspaceIds) await visitWorkspace(page, id, allowedWorkspaces.has(id));
  record(`${current.role}-workspace-access-matrix`, { workspaces: workspaceIds.length });

  await visitWorkspace(page, "orders", true);
  await page.getByRole("button", { name: "Buy", exact: true }).last().click();
  await page.locator('[data-testid="order-review-status"]').waitFor({ state: "visible" });
  assert.match(await page.locator('[data-testid="order-review-status"]').innerText(), /review-only/i);
  await visitWorkspace(page, "positions", true);
  record(`${current.role}-orders-and-positions-review-flow`);

  await visitWorkspace(page, "settings", true);
  await page.getByText(/Supabase entitlement table/).waitFor({ state: "visible" });
  await page.getByText(current.role === "free" ? "Free" : "Premium", { exact: true }).last().waitFor({ state: "visible" });

  if (capture) {
    const themeSelect = page.getByLabel("Theme", { exact: true });
    for (const theme of ["dark", "light"]) {
      await page.getByRole("tab", { name: "General", exact: true }).click();
      await themeSelect.selectOption(theme);
      await page.locator(`.theme-${theme}`).waitFor({ state: "visible", timeout: 30_000 });
      await visitWorkspace(page, "dashboard", true);
      for (const viewport of [[1920, 1080], [1600, 900], [1366, 768]]) {
        const [width, height] = viewport;
        await page.setViewportSize({ width, height });
        await page.waitForTimeout(500);
        const filename = `dashboard-${theme}-${width}x${height}.png`;
        await page.screenshot({ path: path.join(artifactDir, filename), fullPage: false });
        report.screenshots.push(filename);
      }
      await visitWorkspace(page, "settings", true);
      await page.getByRole("tab", { name: "Data & Connections", exact: true }).click();
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await page.getByText(/Workspace (saved|up to date)/i).waitFor({ state: "visible", timeout: 30_000 });
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.locator(`.theme-${theme}`).waitFor({ state: "visible", timeout: 30_000 });
    }
    record("premium-cloud-theme-persistence-and-responsive-screenshots", { screenshots: report.screenshots.length });
  }

  report.browserDiagnostics.push(...diagnostics);
  const severeDiagnostics = diagnostics.filter((item) => item.type === "pageerror");
  assert.equal(severeDiagnostics.length, 0, `${current.role} had browser page errors`);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.getByRole("heading", { name: "Secure workspace" }).waitFor({ state: "visible", timeout: 30_000 });
  await context.close();
  record(`${current.role}-logout`);
}

async function verifyOwnerBrowser(browser, admin) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: ownerEmail,
    options: { redirectTo: productionUrl },
  });
  assert.ifError(error);
  assert.ok(data.properties?.action_link);
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page, "admin");
  await page.goto(data.properties.action_link, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator('nav[aria-label="Terminal workspaces"]').waitFor({ state: "visible", timeout: 60_000 });
  await dismissOnboarding(page);
  const settingsButton = page.locator('nav[aria-label="Terminal workspaces"] [data-workspace-id="settings"]');
  const adminMonitoring = page.getByText("Admin Monitoring", { exact: true });
  for (let attempt = 0; attempt < 3 && !await adminMonitoring.isVisible().catch(() => false); attempt += 1) {
    await settingsButton.click({ force: true });
    await adminMonitoring.waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
  }
  assert.equal(await adminMonitoring.isVisible().catch(() => false), true, "Admin Monitoring did not render in the owner Settings workspace");
  await page.getByText("Admin", { exact: true }).last().waitFor({ state: "visible" });
  report.browserDiagnostics.push(...diagnostics);
  assert.equal(diagnostics.filter((item) => item.type === "pageerror").length, 0, "Admin had browser page errors");
  await context.close();
  record("owner-admin-production-ui");
}

async function cleanup(admin) {
  const ids = new Set(createdUserIds);
  if (createdUserEmails.length) {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const user of data?.users || []) {
      if (createdUserEmails.includes(String(user.email || "").toLowerCase())) ids.add(user.id);
    }
  }
  for (const userId of [...ids].reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) process.stderr.write(`WARN fixture cleanup failed: ${safeError(error)}\n`);
  }
}

async function main() {
  requireEnvironment();
  await fs.mkdir(artifactDir, { recursive: true });
  const admin = makeClient(serviceRoleKey);
  let browser;
  try {
    const healthResponse = await fetch(`${backendUrl}/api/platform/health`);
    assert.equal(healthResponse.status, 200, "Production backend health failed");
    const frontendResponse = await fetch(productionUrl, { redirect: "follow" });
    assert.equal(frontendResponse.status, 200, "Production frontend health failed");
    record("production-endpoints-online");

    browser = await chromium.launch({ headless: true });
    const freeFixture = await createFreeFixtureThroughUi(admin, browser);
    const premiumFixture = await createFixture(admin, "premium");
    const owner = { role: "admin", ...(await ownerSession(admin)) };
    const freeSession = await passwordSession(freeFixture);
    const premiumSession = await passwordSession(premiumFixture);
    const free = { role: "free", fixture: freeFixture, ...freeSession };
    const premium = { role: "premium", fixture: premiumFixture, ...premiumSession };

    await verifyEntitlements(owner, free, premium);
    await verifyRls(free, premium);

    await verifyBrowserRole(browser, free, freeWorkspaceIds);
    await verifyBrowserRole(browser, premium, premiumWorkspaceIds, { capture: true });
    await verifyOwnerBrowser(browser, admin);

    report.passed = true;
  } catch (error) {
    report.failure = safeError(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await cleanup(admin);
    report.completedAt = new Date().toISOString();
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  if (!report.passed) throw new Error(report.failure || "Production audit failed");
  process.stdout.write(`Audit passed with ${report.checks.length} checks and ${report.screenshots.length} screenshots.\n`);
}

await main();
