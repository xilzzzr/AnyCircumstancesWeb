const { initializeEnvironment } = require("./environment");
initializeEnvironment();

const crypto = require("crypto");
const fs = require("fs");
const mysql = require("mysql2/promise");
const { escrowKeyId, getEscrowPublicKeyPem, kmsConfig } = require("./escrow_keys");

function legacyPrivateKey() {
  return String(
    process.env.LEGACY_ESCROW_PRIVATE_KEY_PEM ||
    process.env.ESCROW_PRIVATE_KEY_PEM ||
    ""
  ).replace(/\\n/g, "\n").trim();
}

function buildDbPool() {
  const host = String(process.env.DB_HOST || "").trim();
  const user = String(process.env.DB_USER || "").trim();
  const database = String(process.env.DB_NAME || "").trim();
  if (!host || !user || !database) throw new Error("missing_database_configuration");

  const cfg = {
    connectTimeout: 10000,
    host,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user,
    password: process.env.DB_PASSWORD || "",
    database,
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
  };

  const caPath = String(process.env.DB_SSL_CA || "").trim();
  if (caPath) cfg.ssl = { ca: fs.readFileSync(caPath) };
  else if (host.includes("rds.amazonaws.com")) {
    cfg.ssl = { ca: fs.readFileSync("/etc/ssl/certs/rds-global-bundle.pem") };
  }
  return mysql.createPool(cfg);
}

async function main() {
  const cfg = kmsConfig();
  if (!cfg) throw new Error("ESCROW_KMS_KEY_ID_and_region_are_required");

  const oldPrivatePem = legacyPrivateKey();
  if (!oldPrivatePem) throw new Error("LEGACY_ESCROW_PRIVATE_KEY_PEM_is_required");

  const oldPrivateKey = crypto.createPrivateKey(oldPrivatePem);
  if (oldPrivateKey.asymmetricKeyType !== "rsa") throw new Error("legacy_escrow_key_must_be_rsa");

  const newPublicPem = await getEscrowPublicKeyPem();
  if (!newPublicPem) throw new Error("kms_public_key_unavailable");
  const newPublicKey = crypto.createPublicKey(newPublicPem);
  if (newPublicKey.asymmetricKeyType !== "rsa") throw new Error("kms_escrow_key_must_be_rsa");

  const currentKeyId = escrowKeyId();
  const pool = buildDbPool();
  let migrated = 0;

  try {
    const [rows] = await pool.query(
      `SELECT file_id, alg, enc_key_b64, escrow_key_id
       FROM file_key_escrows
       WHERE escrow_key_id IS NULL
          OR escrow_key_id = ''
          OR escrow_key_id = 'legacy-local'`
    );

    for (const row of rows || []) {
      if (String(row.alg || "") !== "rsa-oaep-sha256") {
        throw new Error("unsupported_legacy_escrow_algorithm");
      }

      const plaintext = crypto.privateDecrypt(
        {
          key: oldPrivateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        Buffer.from(String(row.enc_key_b64 || ""), "base64")
      );

      try {
        const rewrapped = crypto.publicEncrypt(
          {
            key: newPublicKey,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: "sha256",
          },
          plaintext
        );

        const [result] = await pool.query(
          `UPDATE file_key_escrows
           SET enc_key_b64 = ?, escrow_key_id = ?
           WHERE file_id = ?
             AND (escrow_key_id IS NULL OR escrow_key_id = '' OR escrow_key_id = 'legacy-local')`,
          [rewrapped.toString("base64"), currentKeyId, String(row.file_id)]
        );
        if (result?.affectedRows) migrated += 1;
      } finally {
        plaintext.fill(0);
      }
    }

    const [remainingRows] = await pool.query(
      `SELECT COUNT(*) AS remaining
       FROM file_key_escrows
       WHERE escrow_key_id IS NULL
          OR escrow_key_id = ''
          OR escrow_key_id = 'legacy-local'`
    );
    const remaining = Number(remainingRows?.[0]?.remaining || 0);
    if (remaining !== 0) throw new Error(`escrow_migration_incomplete:${remaining}`);

    console.log(`Escrow migration complete. Rewrapped ${migrated} file key(s) to ${currentKeyId}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Escrow migration failed:", String(error?.message || error || "unknown_error"));
  process.exit(1);
});
