import { authenticatedFetch } from "./authenticatedRequest";
import { BROKER_API_URL } from "../config/terminalConfig";

export const PLAN_ORDER = {
  free: 0,
  pro: 1,
  premium: 2,
  admin: 3,
};

export const PLAN_LABELS = {
  free: "Free",
  pro: "Pro",
  premium: "Premium",
  admin: "Admin",
};

export const FEATURE_MIN_PLAN = {
  dashboard: "free",
  scanner: "free",
  charts: "free",
  watchlist: "free",
  news: "free",
  alerts: "free",
  settings: "free",
  aiSummaries: "pro",
  replay: "pro",
  journal: "pro",
  orders: "premium",
  positions: "premium",
  risk: "premium",
  performance: "premium",
  brokerDiagnostics: "premium",
};

export const WORKSPACE_FEATURES = {
  intelligence: "dashboard",
  charts: "charts",
  "chart-analysis": "charts",
  scanner: "scanner",
  watchlist: "watchlist",
  news: "news",
  alerts: "alerts",
  replay: "replay",
  journal: "journal",
  orders: "orders",
  positions: "positions",
  risk: "risk",
  performance: "performance",
  settings: "settings",
  broker: "brokerDiagnostics",
  portfolio: "positions",
};

export const DEFAULT_ENTITLEMENTS = {
  plan: "free",
  status: "active",
  source: "default",
  capabilities: {
    dashboard: true,
    scanner: true,
    charts: true,
    watchlist: true,
    news: true,
    alerts: true,
    settings: true,
    aiSummaries: false,
    replay: false,
    journal: false,
    orders: false,
    positions: false,
    risk: false,
    performance: false,
    brokerDiagnostics: false,
  },
};

export function normalizePlan(plan) {
  const value = String(plan || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(PLAN_ORDER, value) ? value : "free";
}

export function planMeets(plan, minPlan = "free") {
  return PLAN_ORDER[normalizePlan(plan)] >= PLAN_ORDER[normalizePlan(minPlan)];
}

export function getFeatureMinPlan(feature) {
  return FEATURE_MIN_PLAN[feature] || "free";
}

export function canUseFeature(entitlements, feature) {
  const plan = normalizePlan(entitlements?.plan);
  if (plan === "admin") return true;
  if (entitlements?.capabilities && Object.prototype.hasOwnProperty.call(entitlements.capabilities, feature)) {
    return Boolean(entitlements.capabilities[feature]);
  }
  return planMeets(plan, getFeatureMinPlan(feature));
}

export function canUseWorkspace(entitlements, workspaceId) {
  return canUseFeature(entitlements, WORKSPACE_FEATURES[workspaceId] || workspaceId);
}

export async function fetchCurrentEntitlements() {
  const response = await authenticatedFetch(`${BROKER_API_URL}/api/entitlements/me`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "Entitlements unavailable.");
  }
  return response.json();
}
