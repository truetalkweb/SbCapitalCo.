import { authenticatedFetch } from "./authenticatedRequest";
import { BROKER_API_URL } from "../config/terminalConfig";
export {
  DEFAULT_ENTITLEMENTS,
  FEATURE_MIN_PLAN,
  PLAN_LABELS,
  PLAN_ORDER,
  WORKSPACE_FEATURES,
  canUseFeature,
  canUseWorkspace,
  getFeatureMinPlan,
  normalizePlan,
  planMeets,
} from "./entitlementPolicy";

export async function fetchCurrentEntitlements() {
  const response = await authenticatedFetch(`${BROKER_API_URL}/api/entitlements/me`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "Entitlements unavailable.");
  }
  return response.json();
}
