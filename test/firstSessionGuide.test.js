import test from 'node:test';
import assert from 'node:assert/strict';
import { firstSessionSteps } from '../src/utils/firstSessionGuide.js';
import { PLAN_DESCRIPTIONS } from '../src/services/entitlementPolicy.js';

test('Free guide opens included workspaces and routes paid review to account settings', () => {
  const steps = firstSessionSteps({ plan: 'free' });
  assert.deepEqual(steps.map(step => step.destination), ['watchlist', 'charts', 'orders', 'settings']);
  assert.equal(steps.at(-1).action, 'View plan access');
  assert.equal(steps.at(-1).access, 'Pro access required.');
  assert.match(PLAN_DESCRIPTIONS.free, /paper simulation/);
  assert.doesNotMatch(PLAN_DESCRIPTIONS.premium, /broker diagnostics/i);
});

test('guide honors account capability restrictions even for a higher plan', () => {
  const steps = firstSessionSteps({ plan: 'premium', capabilities: { journal: false } });
  assert.equal(steps.at(-1).destination, 'settings');
  assert.equal(steps.at(-1).access, 'This feature is restricted for your account.');
  assert.equal(firstSessionSteps({ plan: 'pro' }).at(-1).destination, 'journal');
});
