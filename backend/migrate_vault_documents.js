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
  const [storageColumns] = await connection.query(
    "SHOW COLUMNS FROM files LIKE 'storage_key'",
  );
  if (!storageColumns.length)
    await connection.query(
      "ALTER TABLE files ADD COLUMN storage_key VARCHAR(512) NULL",
    );
  const [objectTables] = await connection.query(
    "SHOW TABLES LIKE 'file_storage_objects'",
  );
  if (!objectTables.length)
    await connection.query(
      `CREATE TABLE IF NOT EXISTS file_storage_objects (
        object_key VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
        file_id VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        INDEX idx_file_storage_objects_file_id (file_id)
      ) ENGINE=InnoDB`,
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
