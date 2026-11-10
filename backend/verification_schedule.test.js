const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const scheduleFunctions = require('./checkin_schedule');
// Normalize line endings so the route slicing below also works on Windows checkouts.
const source = fs.readFileSync(require.resolve('./auth.js'), 'utf8').replace(/\r\n/g, '\n');
const schedule = { mode:'days', interval:3, timeZone:'America/Chicago', startDate:'2026-10-22', times:['09:00'] };
const now = new Date('2026-10-22T15:00:00Z');
function setup({ paid = 'daily', existing = null } = {}) {
  let row = existing;
  let mutations = 0;
  let handler;
  let transaction = false;
  const conn = {
    async beginTransaction() { transaction = true; }, async commit() { transaction = false; }, async rollback() { transaction = false; }, release() {},
    async query(sql, params) {
      assert.equal(transaction, true);
      if (sql.startsWith('SELECT')) { assert.match(sql, /FOR UPDATE/); return [row ? [row] : []]; }
      mutations++;
      if (sql.includes('schedule_json')) row = { ...(row || {}), user_id:params[0], frequency:params[1], grace_period_hours:params[2], reminders:params[3], next_due_at:params[4], schedule_json:params[5] };
      return [{ affectedRows:1 }];
    }
  };
  const context = { Date, JSON, Object, String, Number, ...scheduleFunctions,
    pool:{ getConnection:async () => conn }, requireUserId:async () => '1', asyncHandler:fn => fn,
    getPaidCheckinFrequency:async () => paid, getVerificationSettingsRow:async () => row,
    isValidGraceHours:n => Number.isInteger(n) && n >= 6 && n <= 72 && n % 6 === 0,
    isValidReminders:n => Number.isInteger(n) && n >= 1 && n <= 5,
    nowUtc:() => now, daysForFrequency:freq => freq === 'daily' ? 1 : freq === 'weekly' ? 7 : 30,
    addDays:(date, days) => new Date(+date + days * 86400000), settingsDto:r => r,
    router:{ put:(path, fn) => { handler = fn; } }
  };
  const start = source.indexOf('router.put(\n  "/verification-settings"');
  const end = source.indexOf('\nrouter.post(', start);
  vm.runInNewContext(source.slice(start,end), context);
  return {
    async save(body) {
      const res = { statusCode:200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
      await handler({ body:{ gracePeriodHours:24, reminders:3, ...body } },res);
      return res;
    }, mutations:() => mutations, row:() => row
  };
}
test('calendar settings cannot be forged by free, weekly, or monthly accounts', async () => {
  for (const paid of [null,'weekly','monthly']) {
    const fixture = setup({ paid }); const res = await fixture.save({ schedule });
    assert.equal(res.statusCode, 403); assert.equal(fixture.mutations(), 0);
  }
});
test('daily accounts save a calendar next due in UTC without changing grace duration', async () => {
  const fixture = setup(); const res = await fixture.save({ schedule });
  assert.equal(res.statusCode, 200); assert.equal(fixture.row().grace_period_hours,24);
  assert.equal(fixture.row().next_due_at.toISOString(),'2026-10-25T14:00:00.000Z');
});
test('legacy clients omitting schedule preserve saved recurrence and due time', async () => {
  const due = new Date('2026-10-25T14:00:00Z');
  const fixture = setup({ existing:{ frequency:'daily', schedule_json:JSON.stringify(schedule), next_due_at:due, grace_period_hours:24 } });
  await fixture.save({ reminders:4 });
  assert.equal(+fixture.row().next_due_at,+due);
  assert.deepEqual(JSON.parse(fixture.row().schedule_json), scheduleFunctions.normalizeSchedule(schedule));
});
test('overdue users must check in before changing their calendar or grace duration', async () => {
  for (const change of [{ schedule:{ ...schedule, interval:30 } }, { gracePeriodHours:72 }]) {
    const fixture = setup({ existing:{ frequency:'daily', schedule_json:JSON.stringify(schedule), next_due_at:new Date('2026-10-22T14:00:00Z'), grace_period_hours:24 } });
    const res = await fixture.save(change);
    assert.equal(res.statusCode,409); assert.equal(res.body.error,'check_in_before_schedule_change'); assert.equal(fixture.mutations(),0);
  }
});
test('reminder-only saves preserve overdue due time', async () => {
  const due = new Date('2026-10-22T14:00:00Z');
  const fixture = setup({ existing:{ frequency:'daily', schedule_json:JSON.stringify(schedule), next_due_at:due, grace_period_hours:24 } });
  const res = await fixture.save({ reminders:4 });
  assert.equal(res.statusCode,200); assert.equal(+fixture.row().next_due_at,+due);
});
test('invalid schedules fail without writing and ordinary monthly settings remain available', async () => {
  const fixture = setup(); const res = await fixture.save({ schedule:{ ...schedule, times:['25:00'] } });
  assert.equal(res.statusCode,400); assert.equal(fixture.mutations(),0);
  const monthly = setup({ paid:'monthly' });
  assert.equal((await monthly.save({ reminders:2 })).statusCode,200);
});
test('reading settings never rearms an unanswered calendar check-in', async () => {
  let writes = 0;
  const existing = { frequency:'daily', next_due_at:new Date('2026-10-20T14:00:00Z'), schedule_json:JSON.stringify(schedule) };
  const start = source.indexOf('async function syncVerificationFromBilling(');
  const end = source.indexOf('\nfunction settingsDto', start);
  const context = { getPaidCheckinFrequency:async () => 'daily', String,
    pool:{ getConnection:async () => ({ beginTransaction:async () => {}, commit:async () => {}, rollback:async () => {}, release() {},
      query:async sql => { if (sql.startsWith('SELECT')) return [[existing]]; writes++; return [{}]; } }) }
  };
  vm.runInNewContext(source.slice(start,end), context);
  await context.syncVerificationFromBilling('1');
  assert.equal(writes,0);
});
for (const [label, instant, expected] of [
  ['early','2026-10-22T13:00:00Z','2026-10-22T14:00:00.000Z'],
  ['late','2026-10-22T15:00:00Z','2026-10-25T14:00:00.000Z']
]) test(`${label} successful check-in uses the locked calendar row without drifting its anchor`, async () => {
  let handler; let due;
  const start = source.indexOf('router.post(\n  "/verification-check-in"');
  const end = source.indexOf('\nrouter.get(', start);
  const locked = { frequency:'daily', grace_period_hours:24, reminders:3, schedule_json:JSON.stringify(schedule) };
  const conn = { beginTransaction:async () => {}, commit:async () => {}, rollback:async () => {}, release() {}, query:async (sql,params) => {
    if (sql.startsWith('SELECT')) return [[locked]];
    if (sql.includes('INSERT INTO verification_settings')) due = params[5];
    return [{}];
  } };
  vm.runInNewContext(source.slice(start,end), { Date, String, Number, ...scheduleFunctions,
    router:{ post:(path,fn) => { handler = fn; } }, asyncHandler:fn => fn,
    requireUserId:async () => '1', pool:{ query:async () => [[{ pin_hash:'hashed-pin' }]], getConnection:async () => conn },
    bcrypt:{ compare:async () => true }, getPaidCheckinFrequency:async () => 'daily',
    // Deliberately stale: the in-transaction locked row must supply the recurrence.
    getVerificationSettingsRow:async () => ({ ...locked, schedule_json:null }),
    nowUtc:() => new Date(instant), daysForFrequency:() => 1, addDays:(date,n) => new Date(+date + n * 86400000),
    settingsDto:r => r, logError:() => assert.fail('check-in failed')
  });
  const res = { status() { return this; }, json() { return this; } };
  await handler({ body:{ pin:'123456' } },res);
  assert.equal(due.toISOString(),expected);
});
