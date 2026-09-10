import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const result = await build({ entryPoints: ['src/lib/dashboardPlan.ts'], bundle: true, write: false, format: 'esm' });
const { dashboardPlanState } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

test('active and trial subscriptions remain paid', () => {
  for (const status of ['active', 'trial', 'trialing']) {
    assert.equal(dashboardPlanState({ ok: true, status }), 'paid');
  }
});

test('only explicit no-plan responses display Free', () => {
  for (const status of ['none', 'pending_setup']) {
    assert.equal(dashboardPlanState({ ok: true, status }), 'free');
  }
  for (const data of [{}, { ok: false }, { ok: false, status: 'none' }, { ok: true }, { ok: true, status: 'unknown' }, { error: 'rate_limited' }]) {
    assert.throws(() => dashboardPlanState(data), /billing_status_unavailable/);
  }
});

test('billing problems are distinct from a Free plan', () => {
  for (const status of ['past_due', 'paused', 'canceled', 'unpaid', 'incomplete']) {
    assert.equal(dashboardPlanState({ ok: true, status }), 'inactive');
  }
});
