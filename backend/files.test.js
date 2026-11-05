const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const cookieParser = require("cookie-parser");

let queryImpl;
const authPath = require.resolve("./auth");
const pool = {
  query: (...args) => queryImpl(...args),
  getConnection: async () => ({
    query: (...args) => queryImpl(...args),
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {},
    release() {},
  }),
};
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: { authPool: pool },
};

const { filesRouter } = require("./files");

const token = "ab".repeat(32);
const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
const escrow = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const recipient = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const rawAes = crypto.randomBytes(32);
const wrapped = crypto.publicEncrypt(
  { key: escrow.publicKey, oaepHash: "sha256" },
  rawAes
).toString("base64");
const publicB64 = recipient.publicKey.export({ type: "spki", format: "der" }).toString("base64");
const meta = {
  original_name: "Emergency instructions.pdf",
  original_content_type: "application/pdf",
  chunked: true,
};

test("emergency link is redeemed once into a short-lived HttpOnly share session", async (t) => {
  const savedEnv = {
    NODE_ENV: process.env.NODE_ENV,
    JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
    ESCROW_PRIVATE_KEY_PEM: process.env.ESCROW_PRIVATE_KEY_PEM,
    ESCROW_KMS_KEY_ID: process.env.ESCROW_KMS_KEY_ID,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_REGION: process.env.AWS_REGION,
  };
  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = "test-share-secret-that-is-definitely-long-enough";
  process.env.ESCROW_PRIVATE_KEY_PEM = escrow.privateKey.export({ type: "pkcs8", format: "pem" });
  delete process.env.ESCROW_KMS_KEY_ID;
  process.env.AWS_ACCESS_KEY_ID = "local-test-access";
  process.env.AWS_SECRET_ACCESS_KEY = "local-test-signing-secret";
  process.env.AWS_REGION = "us-east-1";

  let usedAt = null;
  const expiresAt = new Date(Date.now() + 60_000);

  queryImpl = async (sql, params) => {
    if (sql.includes("FROM contact_file_share_tokens")) {
      if (sql.includes("t.token_hash = ?")) {
        assert.equal(params[0], tokenHash);
      } else {
        assert.deepEqual(params, ["42", "7", "users/1/file"]);
      }
      return [[{
        id: 42,
        contact_id: 7,
        file_id: "users/1/file",
        expires_at: expiresAt,
        used_at: usedAt,
        content_type: "application/pdf",
      }]];
    }

    if (sql.startsWith("UPDATE contact_file_share_tokens SET used_at")) {
      usedAt = new Date();
      return [{ affectedRows: 1 }];
    }

    if (sql.includes("FROM file_key_escrows")) {
      return [[{ alg: "rsa-oaep-sha256", enc_key_b64: wrapped }]];
    }

    if (sql.includes("SELECT user_id FROM files")) {
      return [[{ user_id: 1 }]];
    }

    if (sql.includes("FROM file_key_envelopes")) {
      assert.deepEqual(params, ["users/1/file", "1"]);
      return [[{ meta_json: JSON.stringify(meta) }]];
    }
    if (sql.includes("SELECT bucket, content_type, storage_key FROM files")) {
      return [[{ bucket: "local-test-bucket", content_type: "application/pdf" }]];
    }

    throw new Error(`Unexpected SQL: ${sql}`);
  };

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/files", filesRouter);
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ ok: false, error: "unexpected_test_error" });
  });

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => {
    server.close();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const base = `http://127.0.0.1:${server.address().port}/files`;

  const first = await fetch(base + "/share-lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.ok, true);
  assert.equal(firstBody.file.id, "users/1/file");
  assert.ok(usedAt);

  const setCookie = first.headers.get("set-cookie");
  assert.ok(setCookie);
  assert.match(setCookie, /share_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Strict/i);
  const cookie = setCookie.split(";")[0];

  const replayWithoutSession = await fetch(base + "/share-lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  assert.equal(replayWithoutSession.status, 410);
  assert.equal((await replayWithoutSession.json()).error, "token_already_redeemed");

  const refreshWithSession = await fetch(base + "/share-lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({}),
  });
  assert.equal(refreshWithSession.status, 200);
  assert.equal((await refreshWithSession.json()).ok, true);

  const envelopeResponse = await fetch(base + "/share-get-contact-envelope", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ public_key: publicB64 }),
  });
  assert.equal(envelopeResponse.status, 200);
  assert.equal(envelopeResponse.headers.get("cache-control"), "no-store");
  const envelope = await envelopeResponse.json();
  assert.equal(envelope.ok, true);
  assert.deepEqual(envelope.meta_json, meta);

  const opened = crypto.privateDecrypt(
    { key: recipient.privateKey, oaepHash: "sha256" },
    Buffer.from(envelope.enc_key_b64, "base64")
  );
  assert.deepEqual(opened, rawAes);

  const downloadResponse = await fetch(base + "/share-presign-download", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({}),
  });
  assert.equal(downloadResponse.status, 200);
  const signedDownload = new URL((await downloadResponse.json()).url);
  assert.equal(signedDownload.searchParams.get("response-cache-control"), "no-store");
  assert.ok(signedDownload.searchParams.get("X-Amz-Signature"));

  const noSession = await fetch(base + "/share-get-contact-envelope", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_key: publicB64 }),
  });
  assert.equal(noSession.status, 401);
  assert.equal((await noSession.json()).error, "share_session_required");
});

