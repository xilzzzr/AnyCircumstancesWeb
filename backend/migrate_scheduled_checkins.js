const fs = require('fs');
const { initializeEnvironment } = require('./environment');

async function migrateScheduledCheckins(db) {
  const columns = [
    ['verification_settings', 'schedule_json', 'JSON NULL'],
    ['users', 'display_name', 'VARCHAR(120) NULL'],
  ];
  const added = [];
  for (const [table, column, definition] of columns) {
    const [rows] = await db.query(
      'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [table, column]
    );
    if (rows.length) continue;
    // All identifiers and definitions come from the fixed list above.
    await db.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    added.push(`${table}.${column}`);
  }
  return added;
}
async function main() {
  initializeEnvironment();
  const mysql = require('mysql2/promise');
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL_CA } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) throw new Error('Missing DB_HOST, DB_USER or DB_NAME');
  const caPath = DB_SSL_CA || (DB_HOST.includes('rds.amazonaws.com') ? '/etc/ssl/certs/rds-global-bundle.pem' : '');
  const db = await mysql.createConnection({ host:DB_HOST, port:Number(DB_PORT || 3306), user:DB_USER,
    password:DB_PASSWORD || '', database:DB_NAME, connectTimeout:10000,
    ...(caPath ? { ssl:{ ca:fs.readFileSync(caPath) } } : {}) });
  try {
    const added = await migrateScheduledCheckins(db);
    console.log(added.length ? `Added ${added.join(', ')}` : 'Scheduled check-in schema is already up to date.');
  } finally { await db.end(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { migrateScheduledCheckins };
