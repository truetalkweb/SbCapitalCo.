import { canUseWorkspace, getFeatureMinPlan, planMeets, PLAN_LABELS } from '../services/entitlementPolicy.js';

export function firstSessionSteps(entitlements) {
  return [
    { id: 'watchlist', title: 'Build your watchlist', workspace: 'watchlist', action: 'Open Watchlist',
      detail: 'Add a symbol you want to follow, then select it to keep chart and news context aligned.' },
    { id: 'charts', title: 'Inspect a chart and prepare a plan', workspace: 'charts', action: 'Open Charts',
      detail: 'Select your symbol, inspect its data timestamps, and record setup, stop, target and notes in Trade plan.' },
    { id: 'orders', title: 'Place a paper order', workspace: 'orders', action: 'Open Paper Orders',
      detail: 'Use Review Order from the chart to carry your plan into the ticket. Check quantity, prices and risk before explicitly placing a paper order. Fills need fresh quotes and an open session.' },
    { id: 'journal', title: 'Review the completed trade', workspace: 'journal', action: 'Open Journal',
      detail: 'After a paper position closes, review its original entry plan and realized results in Journal. An open position is not a completed trade.' },
  ].map(step => {
    const allowed = canUseWorkspace(entitlements, step.workspace);
    const required = getFeatureMinPlan(step.workspace);
    return { ...step, allowed, destination: allowed ? step.workspace : 'settings',
      action: allowed ? step.action : 'View plan access',
      access: allowed ? 'Included in your access' : planMeets(entitlements?.plan, required) ? 'This feature is restricted for your account.' : `${PLAN_LABELS[required]} access required.` };
  });
}
