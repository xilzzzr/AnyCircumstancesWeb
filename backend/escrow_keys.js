const crypto = require("crypto");
const https = require("https");
const { defaultProvider } = require("@aws-sdk/credential-provider-node");
const { SignatureV4 } = require("@smithy/signature-v4");

class NodeSha256 {
  constructor(secret) {
    this.hash = secret
      ? crypto.createHmac("sha256", Buffer.from(secret))
      : crypto.createHash("sha256");
  }
  update(data) {
    this.hash.update(data);
  }
  digest() {
    return Promise.resolve(this.hash.digest());
  }
}

let cachedPublicKey = null;
let cachedPublicKeyAt = 0;

function kmsConfig() {
  const keyId = String(process.env.ESCROW_KMS_KEY_ID || "").trim();
  const region = String(process.env.ESCROW_KMS_REGION || process.env.AWS_REGION || "").trim();
  return keyId && region ? { keyId, region } : null;
}

function legacyPrivateKey() {
  if (process.env.NODE_ENV === "production") return "";
  return String(process.env.ESCROW_PRIVATE_KEY_PEM || "").replace(/\\n/g, "\n").trim();
}

async function kmsRequest(target, body) {
  const cfg = kmsConfig();
  if (!cfg) throw new Error("escrow_kms_not_configured");

  const payload = JSON.stringify(body);
  const hostname = `kms.${cfg.region}.amazonaws.com`;
  const request = {
    method: "POST",
    protocol: "https:",
    hostname,
    path: "/",
    headers: {
      host: hostname,
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `TrentService.${target}`,
    },
    body: payload,
  };

  const signer = new SignatureV4({
    service: "kms",
    region: cfg.region,
    credentials: defaultProvider(),
    sha256: NodeSha256,
  });
  const signed = await signer.sign(request);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        method: signed.method,
        hostname: signed.hostname,
        path: signed.path,
        headers: {
          ...signed.headers,
          "content-length": String(Buffer.byteLength(payload)),
        },
        timeout: 10000,
      },
      (res) => {
        let responseBody = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => { responseBody += chunk; });
        res.on("end", () => {
          let parsed = {};
          try { parsed = responseBody ? JSON.parse(responseBody) : {}; } catch {}
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
          const error = new Error("escrow_kms_request_failed");
          error.statusCode = res.statusCode;
          error.kmsCode = parsed?.__type || parsed?.code || "";
          reject(error);
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("escrow_kms_timeout")));
    req.on("error", reject);
    req.end(payload);
  });
}

async function getEscrowPublicKeyPem() {
  const cfg = kmsConfig();
  if (cfg) {
    if (cachedPublicKey && Date.now() - cachedPublicKeyAt < 6 * 60 * 60 * 1000) {
      return cachedPublicKey;
    }
    const response = await kmsRequest("GetPublicKey", { KeyId: cfg.keyId });
    if (response.KeyUsage && response.KeyUsage !== "ENCRYPT_DECRYPT") {
      throw new Error("escrow_kms_key_usage_invalid");
    }
    if (
      Array.isArray(response.EncryptionAlgorithms) &&
      !response.EncryptionAlgorithms.includes("RSAES_OAEP_SHA_256")
    ) {
      throw new Error("escrow_kms_oaep_sha256_not_supported");
    }
    const der = Buffer.from(String(response.PublicKey || ""), "base64");
    if (!der.length) throw new Error("escrow_kms_public_key_missing");
    const key = crypto.createPublicKey({ key: der, format: "der", type: "spki" });
    if (key.asymmetricKeyType !== "rsa") throw new Error("escrow_kms_key_must_be_rsa");
    cachedPublicKey = key.export({ type: "spki", format: "pem" }).toString();
    cachedPublicKeyAt = Date.now();
    return cachedPublicKey;
  }

  const privateKey = legacyPrivateKey();
  if (!privateKey) return null;
  return crypto.createPublicKey(crypto.createPrivateKey(privateKey))
    .export({ type: "spki", format: "pem" })
    .toString();
}

async function decryptEscrowedKey(encKeyB64) {
  const ciphertext = Buffer.from(String(encKeyB64 || ""), "base64");
  if (!ciphertext.length) throw new Error("invalid_escrow_ciphertext");

  const cfg = kmsConfig();
  if (cfg) {
    const response = await kmsRequest("Decrypt", {
      KeyId: cfg.keyId,
      CiphertextBlob: ciphertext.toString("base64"),
      EncryptionAlgorithm: "RSAES_OAEP_SHA_256",
    });
    const plaintext = Buffer.from(String(response.Plaintext || ""), "base64");
    if (!plaintext.length) throw new Error("escrow_kms_plaintext_missing");
    return plaintext;
  }

  const privateKey = legacyPrivateKey();
  if (!privateKey) throw new Error("escrow_private_key_missing");
  return crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    ciphertext
  );
}

module.exports = {
  decryptEscrowedKey,
  getEscrowPublicKeyPem,
  kmsConfig,
};
