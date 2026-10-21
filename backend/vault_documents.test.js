const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const {
  registerDocumentRoutes,
  revisionOf,
  validSealedNote,
} = require("./vault_documents");

test("encrypted notes are bounded and malformed fields are rejected", () => {
  assert.equal(validSealedNote(null), true);
  assert.ok(
    validSealedNote({
      version: 1,
      iv_b64: Buffer.alloc(12).toString("base64"),
      ciphertext_b64: Buffer.alloc(32).toString("base64"),
    }),
  );
  for (const note of [
    "plaintext",
    {},
    { version: 2 },
    { version: 1, iv_b64: "short", ciphertext_b64: "A".repeat(23000) },
  ])
    assert.ok(!validSealedNote(note));
});

test("content edits enforce authentication, vault unlock, ownership, revision checks, and storage quotas", async (t) => {
  let writes = [];
  let puts = [];
  let limitGb = 1;
  let storedMeta = {
    original_name: "Accounts.pdf",
    document_template: "passwords",
  };
  let exists = true;
  const pool = {
    getConnection: async () => ({
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release() {},
      query: async (sql, params) => {
        if (sql.startsWith("SELECT storage_limit"))
          return [[{ storage_limit_gb: limitGb }]];
        if (sql.startsWith("SELECT f.bucket"))
          return [
            exists
              ? [
                  {
                    bucket: "test-bucket",
                    content_type:
                      "application/vnd.anycircumstances.document+json",
                    size_bytes: 100,
                    meta_json: JSON.stringify(storedMeta),
                  },
                ]
              : [],
          ];
        if (sql.startsWith("SELECT COALESCE")) return [[{ used_bytes: 100 }]];
        writes.push({ sql, params });
        if (sql.startsWith("UPDATE file_key_envelopes"))
          storedMeta = JSON.parse(params[0]);
        return [{ affectedRows: 1 }];
      },
    }),
  };
  const pass = (req, res, next) => next();
  const app = express();
  const router = express.Router();
  app.use(express.json());
  registerDocumentRoutes(router, {
    requireUser: (req, res, next) => {
      if (!req.headers["x-user"]) return res.sendStatus(401);
      req.userId = req.headers["x-user"];
      next();
    },
    requirePaid: (req, res, next) =>
      req.headers["x-paid"] ? next() : res.sendStatus(402),
    requireVaultAuthorization: (req, res, next) =>
      req.headers["x-unlocked"] ? next() : res.sendStatus(423),
    limiter: pass,
    asyncHandler: (fn) => (req, res, next) =>
      Promise.resolve(fn(req, res)).catch(next),
    getPool: () => pool,
    putDocument: async (input) => {
      puts.push(input);
    },
  });
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/update-content`;
  const headers = {
    "Content-Type": "application/json",
    "x-user": "1",
    "x-paid": "yes",
    "x-unlocked": "yes",
  };
  const request = (body, custom = headers) =>
    fetch(url, { method: "POST", headers: custom, body: JSON.stringify(body) });
  const base = {
    file_id: "users/1/a",
    expected_revision: revisionOf(storedMeta),
    recipient_note: null,
  };
  assert.equal(
    (await request(base, { "Content-Type": "application/json" })).status,
    401,
  );
  assert.equal((await request(base, { ...headers, "x-paid": "" })).status, 402);
  assert.equal(
    (await request(base, { ...headers, "x-unlocked": "" })).status,
    423,
  );
  assert.equal(
    (await request({ ...base, file_id: "users/2/private" })).status,
    403,
  );
  assert.equal(
    (await request({ ...base, recipient_note: "plaintext" })).status,
    400,
  );
  assert.equal(
    (await request({ ...base, expected_revision: "stale" })).status,
    409,
  );
  assert.equal(writes.length, 0);
  assert.equal(puts.length, 0);
  const encrypted = Buffer.alloc(70);
  encrypted.write("UAC1");
  encrypted.writeBigUInt64LE(20n, 9);
  limitGb = 0;
  const body = {
    ...base,
    original_name: "Updated.pdf",
    ciphertext_b64: encrypted.toString("base64"),
  };
  assert.equal((await request(body)).status, 413);
  assert.equal(puts.length, 0);
  limitGb = 1;
  const result = await request(body);
  assert.equal(result.status, 200);
  assert.equal(puts.length, 1);
  assert.deepEqual(puts[0].ciphertext, encrypted);
  assert.equal(storedMeta.original_name, "Updated.pdf");
  assert.ok(
    writes.some((w) => w.sql.startsWith("UPDATE files SET size_bytes")),
  );
  assert.equal(
    (await request(body)).status,
    409,
    "stale edits cannot overwrite a saved revision",
  );
  exists = false;
  assert.equal(
    (await request({ ...base, expected_revision: revisionOf(storedMeta) }))
      .status,
    404,
  );
});
