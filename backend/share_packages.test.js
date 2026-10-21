const test = require("node:test");
const assert = require("node:assert/strict");
const { authorizedPackageFile } = require("./share_packages");
test("a released link cannot open a different file without its batch membership", async () => {
  const share = {
    file_id: "users/1/a",
    contact_id: 7,
    delivery_group_id: null,
  };
  const pool = {
    query: async () => {
      throw new Error("unexpected query");
    },
  };
  assert.equal(await authorizedPackageFile(pool, share, ""), "users/1/a");
  assert.equal(await authorizedPackageFile(pool, share, "users/1/b"), null);
});
test("package membership is scoped to the contact, release batch, expiry, and file owner", async () => {
  const share = {
    file_id: "users/1/a",
    contact_id: 7,
    delivery_group_id: "batch-one",
  };
  const pool = {
    query: async (sql, params) => {
      assert.match(sql, /f.user_id=c.user_id/);
      assert.match(sql, /expires_at >= UTC_TIMESTAMP/);
      assert.deepEqual(params.slice(0, 2), ["7", "batch-one"]);
      return [params[2] === "users/1/b" ? [{ file_id: "users/1/b" }] : []];
    },
  };
  assert.equal(
    await authorizedPackageFile(pool, share, "users/1/b"),
    "users/1/b",
  );
  assert.equal(
    await authorizedPackageFile(pool, share, "users/2/private"),
    null,
  );
});
