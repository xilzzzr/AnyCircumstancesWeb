const fs = require("fs");
const http2 = require("http2");
const jwt = require("jsonwebtoken");

let cachedProviderToken = null;
let cachedProviderTokenCreatedAt = 0;

function currentApnsEnv() {
  return process.env.APNS_ENV === "production" ? "production" : "development";
}

function apnsHost() {
  return currentApnsEnv() === "production"
    ? "https://api.push.apple.com"
    : "https://api.sandbox.push.apple.com";
}

function readPrivateKey() {
  const keyPath = String(process.env.APNS_PRIVATE_KEY_PATH || "").trim();
  if (keyPath) {
    return fs.readFileSync(keyPath, "utf8");
  }

  const inlineKey = String(process.env.APNS_PRIVATE_KEY || "").trim();
  if (inlineKey) {
    return inlineKey.replace(/\\n/g, "\n");
  }

  return "";
}

function apnsConfig() {
  const keyId = String(process.env.APNS_KEY_ID || "").trim();
  const teamId = String(process.env.APNS_TEAM_ID || "").trim();
  const bundleId = String(process.env.APNS_BUNDLE_ID || "").trim();
  const privateKey = readPrivateKey();

  if (!keyId || !teamId || !bundleId || !privateKey) {
    return { ok: false, missing: true };
  }

  return { ok: true, keyId, teamId, bundleId, privateKey };
}

function providerToken() {
  const cfg = apnsConfig();
  if (!cfg.ok) return null;

  const now = Date.now();
  if (cachedProviderToken && now - cachedProviderTokenCreatedAt < 45 * 60 * 1000) {
    return cachedProviderToken;
  }

  cachedProviderToken = jwt.sign(
    {},
    cfg.privateKey,
    {
      algorithm: "ES256",
      issuer: cfg.teamId,
      header: {
        alg: "ES256",
        kid: cfg.keyId,
      },
    }
  );
  cachedProviderTokenCreatedAt = now;
  return cachedProviderToken;
}

function shouldInvalidateToken(status, reason) {
  return (
    status === 410 ||
    reason === "BadDeviceToken" ||
    reason === "Unregistered" ||
    reason === "DeviceTokenNotForTopic"
  );
}

function sendApnsRequest(token, notification) {
  const cfg = apnsConfig();
  const authToken = providerToken();

  if (!cfg.ok || !authToken) {
    return Promise.resolve({ ok: false, skipped: true, reason: "apns_not_configured" });
  }

  const payload = {
    aps: {
      alert: {
        title: notification.title,
        body: notification.body,
      },
      sound: "default",
    },
    ...(notification.data || {}),
  };

  return new Promise((resolve) => {
    const client = http2.connect(apnsHost());
    let responseBody = "";
    let status = 0;

    client.on("error", (err) => {
      resolve({ ok: false, status: 0, reason: err.message || "apns_connection_error" });
    });

    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${authToken}`,
      "apns-topic": cfg.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
    });

    req.setEncoding("utf8");
    req.on("response", (headers) => {
      status = Number(headers[":status"] || 0);
    });
    req.on("data", (chunk) => {
      responseBody += chunk;
    });
    req.on("end", () => {
      client.close();

      let reason = "";
      if (responseBody) {
        try {
          reason = String(JSON.parse(responseBody).reason || "");
        } catch {
          reason = responseBody.slice(0, 120);
        }
      }

      resolve({
        ok: status >= 200 && status < 300,
        status,
        reason,
      });
    });
    req.on("error", (err) => {
      client.close();
      resolve({ ok: false, status: 0, reason: err.message || "apns_request_error" });
    });

    req.end(JSON.stringify(payload));
  });
}

async function sendPushToUser(conn, userId, notification) {
  const env = currentApnsEnv();
  const cfg = apnsConfig();

  if (!cfg.ok) {
    console.log("[apns] skipped: missing APNs env config");
    return { ok: false, skipped: true, sent: 0, failed: 0 };
  }

  const [rows] = await conn.query(
    `
    SELECT id, token
    FROM user_device_tokens
    WHERE user_id = ?
      AND platform = 'ios'
      AND apns_env = ?
      AND invalidated_at IS NULL
    `,
    [String(userId), env]
  );

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    const result = await sendApnsRequest(String(row.token), notification);

    if (result.ok) {
      sent += 1;
      console.log("[apns] sent user_id=", userId, "token_id=", row.id, "env=", env);
      continue;
    }

    failed += 1;
    console.log(
      "[apns] failed user_id=",
      userId,
      "token_id=",
      row.id,
      "env=",
      env,
      "status=",
      result.status,
      "reason=",
      result.reason || "unknown"
    );

    if (shouldInvalidateToken(result.status, result.reason)) {
      await conn.query(
        "UPDATE user_device_tokens SET invalidated_at = NOW() WHERE id = ? LIMIT 1",
        [row.id]
      );
      console.log("[apns] invalidated token_id=", row.id, "reason=", result.reason || result.status);
    }
  }

  return { ok: failed === 0, sent, failed };
}

module.exports = {
  currentApnsEnv,
  sendPushToUser,
};
