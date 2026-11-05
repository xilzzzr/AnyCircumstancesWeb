const test = require('node:test');
const assert = require('node:assert/strict');
const { migrateScheduledCheckins } = require('./migrate_scheduled_checkins');
test('schema migration adds only missing columns and can be safely repeated', async () => {
  const columns = new Set(); const writes = [];
  const db = { async query(sql, params) {
    if (params) return [columns.has(params.join('.')) ? [{}] : []];
    const [,table,column] = sql.match(/^ALTER TABLE (\w+) ADD COLUMN (\w+)/);
    columns.add(`${table}.${column}`); writes.push(sql); return [{}];
  } };
  assert.deepEqual(await migrateScheduledCheckins(db), ['verification_settings.schedule_json','users.display_name']);
  assert.deepEqual(await migrateScheduledCheckins(db), []);
  assert.equal(writes.length,2);
});
