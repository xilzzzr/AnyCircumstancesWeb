const test = require("node:test");
const assert = require("node:assert/strict");
const { migrate } = require("./migrate_vault_documents");
test("document migration can be rerun, including after a partially completed migration", async () => {
  let column = false;
  let index = false;
  let changes = 0;
  const connection = {
    query: async (sql) => {
      if (sql.startsWith("SHOW COLUMNS"))
        return [column ? [{ Field: "delivery_group_id" }] : []];
      if (sql.startsWith("SHOW INDEX"))
        return [index ? [{ Key_name: "idx_share_delivery_group" }] : []];
      if (sql.includes("ADD COLUMN")) {
        column = true;
        changes++;
      }
      if (sql.includes("ADD INDEX")) {
        index = true;
        changes++;
      }
      return [{}];
    },
  };
  await migrate(connection);
  assert.equal(changes, 2);
  await migrate(connection);
  assert.equal(changes, 2);
  index = false;
  await migrate(connection);
  assert.equal(changes, 3);
});
