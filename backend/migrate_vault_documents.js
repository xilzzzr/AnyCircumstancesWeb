const mysql = require("mysql2/promise");
const fs = require("fs");
const { initializeEnvironment } = require("./environment");

async function migrate(connection) {
  const [columns] = await connection.query(
    "SHOW COLUMNS FROM contact_file_share_tokens LIKE 'delivery_group_id'",
  );
  if (!columns.length)
    await connection.query(
      "ALTER TABLE contact_file_share_tokens ADD COLUMN delivery_group_id CHAR(36) NULL",
    );
  const [indexes] = await connection.query(
    "SHOW INDEX FROM contact_file_share_tokens WHERE Key_name = 'idx_share_delivery_group'",
  );
  if (!indexes.length)
    await connection.query(
      "ALTER TABLE contact_file_share_tokens ADD INDEX idx_share_delivery_group (contact_id, delivery_group_id)",
    );
}
async function main() {
  initializeEnvironment();
  for (const key of ["DB_HOST", "DB_USER", "DB_NAME"])
    if (!process.env[key]) throw new Error(`Missing ${key}`);
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME,
  };
  const caPath =
    process.env.DB_SSL_CA ||
    (config.host.includes("rds.amazonaws.com")
      ? "/etc/ssl/certs/rds-global-bundle.pem"
      : "");
  if (caPath) config.ssl = { ca: fs.readFileSync(caPath) };
  const connection = await mysql.createConnection(config);
  try {
    await migrate(connection);
    console.log(
      "Vault document migration complete. Existing access links are preserved.",
    );
  } finally {
    await connection.end();
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(
      "Vault document migration failed:",
      error.code || error.message,
    );
    process.exitCode = 1;
  });
module.exports = { migrate };
