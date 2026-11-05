const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSchedule, nextScheduledCheckin, nextDueAfterSave } = require('./checkin_schedule');
const daily = { mode: 'days', interval: 1, startDate: '2026-01-01', times: ['09:00'], timeZone: 'America/Chicago' };
const next = (s, after) => nextScheduledCheckin(s, new Date(after)).toISOString();
test('every N calendar days keeps its start-date anchor after late and early check-ins', () => {
  const schedule = { ...daily, interval: 3 };
  assert.equal(next(schedule, '2026-10-22T15:00:00Z'), '2026-10-25T14:00:00.000Z');
  assert.equal(next(daily, '2026-10-22T13:59:00Z'), '2026-10-22T14:00:00.000Z');
  assert.equal(next(daily, '2026-10-22T14:00:00Z'), '2026-10-23T14:00:00.000Z');
});
test('selected weekdays and alternate weeks use Monday of start-date week', () => {
  const schedule = { ...daily, mode: 'weeks', interval: 2, startDate: '2026-10-19', weekdays: [1, 4] };
  assert.equal(next(schedule, '2026-10-22T14:00:00Z'), '2026-11-02T15:00:00.000Z');
});
test('month dates skip missing dates and cross December correctly', () => {
  const schedule = { ...daily, mode: 'month', monthDays: [31] };
  assert.equal(next(schedule, '2026-02-01T00:00:00Z'), '2026-03-31T14:00:00.000Z');
  assert.equal(next(schedule, '2026-12-31T15:00:00Z'), '2027-01-31T15:00:00.000Z');
  assert.equal(next({ ...schedule, monthDays: [29] }, '2028-02-01T00:00:00Z'), '2028-02-29T15:00:00.000Z');
});
test('spring DST gap shifts forward; autumn repeated times fire once', () => {
  assert.equal(next({ ...daily, times: ['02:30'] }, '2026-03-08T07:00:00Z'), '2026-03-08T08:30:00.000Z');
  assert.equal(next({ ...daily, times: ['02:30', '03:00'] }, '2026-03-08T07:00:00Z'), '2026-03-08T08:00:00.000Z');
  assert.equal(next({ ...daily, times: ['01:30'] }, '2026-11-01T05:00:00Z'), '2026-11-01T06:30:00.000Z');
  assert.equal(next({ ...daily, times: ['01:30'] }, '2026-11-01T06:31:00Z'), '2026-11-02T07:30:00.000Z');
});
test('supports half-hour offsets and multiple times per day', () => {
  assert.equal(next({ ...daily, timeZone: 'Asia/Kolkata', times: ['09:00','18:00'] }, '2026-10-22T04:00:00Z'), '2026-10-22T12:30:00.000Z');
});
test('invalid schedules fail validation, including arbitrary times, empty selected days and bad zones', () => {
  for (const value of [false, [], { ...daily, startDate:'2026-02-30' }, { ...daily, timeZone:'' }, { ...daily, timeZone:'Mars/Olympus' }, { ...daily, times:['24:00'] }, { ...daily, interval:0 }, { ...daily, interval:1.5 }, { ...daily, mode:'weeks', weekdays:[] }, { ...daily, mode:'month', monthDays:[32] }]) assert.throws(() => normalizeSchedule(value));
});
test('saving a different schedule never extends or shortens an open grace period', () => {
  const due = new Date('2026-10-22T14:00:00Z');
  for (const hours of [6, 24, 72]) {
    const existing = { next_due_at: due, grace_period_hours: hours };
    const now = new Date('2026-10-22T15:00:00Z');
    const saved = nextDueAfterSave(existing, { ...daily, interval:30 }, now);
    assert.equal(+saved, +due);
    assert.equal(+saved + hours * 3600000, +due + hours * 3600000);
  }
});
