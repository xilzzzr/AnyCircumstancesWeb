const test = require("node:test");
const assert = require("node:assert/strict");
const { migrate } = require("./migrate_vault_documents");

test("document and immutable-storage migrations are repeatable and recover from partial runs", async () => {
  const columns = new Set();
  const indexes = new Set();
  const tables = new Set();
  const writes = [];
  const connection = { query: async (sql) => {
    if (sql.startsWith("SHOW COLUMNS")) {
      const column = sql.includes("files") ? "files.storage_key" : "contact_file_share_tokens.delivery_group_id";
      return [columns.has(column) ? [{ Field: column.split(".")[1] }] : []];
    }
    if (sql.startsWith("SHOW INDEX")) return [indexes.has("idx_share_delivery_group") ? [{ Key_name:"idx_share_delivery_group" }] : []];
    if (sql.startsWith("SHOW TABLES")) return [tables.has("file_storage_objects") ? [{ table:"file_storage_objects" }] : []];
    writes.push(sql);
    if (sql.includes("ADD COLUMN delivery_group_id")) columns.add("contact_file_share_tokens.delivery_group_id");
    if (sql.includes("ADD COLUMN storage_key")) columns.add("files.storage_key");
    if (sql.includes("ADD INDEX idx_share_delivery_group")) indexes.add("idx_share_delivery_group");
    if (sql.includes("CREATE TABLE IF NOT EXISTS file_storage_objects")) tables.add("file_storage_objects");
    return [{}];
  }};
  await migrate(connection);
  assert.equal(writes.length, 4);
  await migrate(connection);
  assert.equal(writes.length, 4);
  indexes.delete("idx_share_delivery_group");
  await migrate(connection);
  assert.equal(writes.length, 5);
});
