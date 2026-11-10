const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync(require.resolve("./files.js"), "utf8").replace(/\r\n/g, "\n");
function slice(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `could not find ${JSON.stringify(startMarker)} in files.js`);
  return source.slice(start, end);
}

const victimCiphertext = Buffer.alloc(256, 7).toString("base64");

// Runs the real /save-file-escrow route against an escrow table that already
// holds another user's escrowed key.
async function saveEscrow(encKeyB64) {
  let handler;
  const writes = [];
  const pass = (req, res, next) => next();
  vm.runInNewContext(
    `${slice("function isBoundedBase64(", "\n}\n")}\n}\n${slice('router.post(\n  "/save-file-escrow"', "\n\nrouter.")}`,
    {
      String, console: { warn: () => {}, log: () => {}, error: () => {} },
      router: { post: (path, ...fns) => { handler = fns[fns.length - 1]; } },
      requireUser: pass, requirePaid: pass, requireVaultAuthorization: pass,
      asyncHandler: (fn) => fn,
      escrowKeyId: () => "kms-key-1",
      getPool: () => ({
        query: async (sql, params) => {
          if (sql.startsWith("SELECT id FROM files")) return [[{ id: params[0] }]];
          if (sql.includes("FROM file_key_escrows WHERE enc_key_b64 = ?")) {
            return [params[0] === victimCiphertext ? [{ file_id: "users/1/victim-file" }] : []];
          }
          writes.push(sql);
          return [{}];
        },
      }),
    }
  );
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await handler({ userId: "2", body: { file_id: "users/2/attacker-file", alg: "rsa-oaep-sha256", enc_key_b64: encKeyB64, key_ref: "kms-key-1" } }, res);
  return { res, writes };
}

test("an escrowed key copied from another file is refused", async () => {
  const { res, writes } = await saveEscrow(victimCiphertext);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, "escrow_rejected");
  assert.deepEqual(writes, []);
});

test("a fresh escrowed key is saved", async () => {
  const { res, writes } = await saveEscrow(Buffer.alloc(256, 9).toString("base64"));
  assert.equal(res.statusCode, 200);
  assert.equal(writes.length, 1);
  assert.match(writes[0], /INSERT INTO file_key_escrows/);
});
