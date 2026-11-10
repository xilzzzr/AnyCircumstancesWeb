// Creates an authenticator-app secret for an admin account.
//
//   node create_admin_totp.js <adminUserId>
//
// 1. Add the printed otpauth link (or the secret) to an authenticator app.
// 2. Add "<adminUserId>:<secret>" to ADMIN_TOTP_SECRETS in the backend
//    environment (comma-separated for several admins) and restart the backend.
// From then on, admin sign-in asks for the 6-digit code. Run this on the
// server and don't paste the secret anywhere else.
const crypto = require("crypto");
const { base32Encode } = require("./totp");

const userId = String(process.argv[2] || "").trim();
if (!/^\d+$/.test(userId)) {
  console.error("Usage: node create_admin_totp.js <adminUserId>");
  process.exit(1);
}

const secret = base32Encode(crypto.randomBytes(20));
const label = encodeURIComponent(`AnyCircumstances admin ${userId}`);
console.log(`Secret: ${secret}`);
console.log(`Authenticator link: otpauth://totp/${label}?secret=${secret}&issuer=AnyCircumstances&algorithm=SHA1&digits=6&period=30`);
console.log(`Environment entry: ADMIN_TOTP_SECRETS=${userId}:${secret}`);
