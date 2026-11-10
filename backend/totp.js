// Time-based one-time passwords (RFC 6238, the codes authenticator apps show):
// HMAC-SHA1, 30-second steps, 6 digits. No dependency needed.
const crypto = require("crypto");

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input) {
  const clean = String(input || "").toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("invalid_base32");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function codeAt(secret, counter) {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = crypto.createHmac("sha1", secret).update(message).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const binary = hash.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

// Returns the time step the code belongs to (to block reuse), or null.
// Accepts the previous and next step too, for clock drift.
function verifyTotp(secretBase32, code, { now = Date.now(), window = 1 } = {}) {
  const entered = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(entered)) return null;
  let secret;
  try { secret = base32Decode(secretBase32); } catch { return null; }
  if (secret.length < 10) return null;
  const current = Math.floor(now / 1000 / STEP_SECONDS);
  for (let counter = current - window; counter <= current + window; counter += 1) {
    if (counter < 0) continue;
    const expected = codeAt(secret, counter);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(entered))) return counter;
  }
  return null;
}

module.exports = { base32Decode, base32Encode, codeAt, verifyTotp };
