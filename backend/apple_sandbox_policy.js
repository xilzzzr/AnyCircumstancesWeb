// App Review and TestFlight use Apple's cryptographically signed Sandbox data.
// On a production service, only dedicated accounts explicitly listed by their
// opaque appAccountToken may receive sandbox entitlements. Never trust a hint
// supplied by the client instead of the verified transaction environment.
function sandboxAccountTokens(env = process.env) {
  return new Set(String(env.APPLE_SANDBOX_ACCOUNT_TOKENS || "")
    .split(",").map(value => value.trim().toLowerCase())
    .filter(value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)));
}

function sandboxAllowed(env = process.env) {
  return String(env.ALLOW_APPLE_SANDBOX || "").toLowerCase() === "true"
    && (env.NODE_ENV !== "production" || sandboxAccountTokens(env).size > 0);
}

function assertSandboxTransactionAllowed(transaction, env = process.env) {
  if (String(transaction.environment || "").toLowerCase() !== "sandbox") return;
  const allowedTokens = sandboxAccountTokens(env);
  if (!sandboxAllowed(env)
      || ((env.NODE_ENV === "production" || allowedTokens.size > 0)
          && !allowedTokens.has(String(transaction.appAccountToken || "").toLowerCase()))) {
    throw new Error("apple_sandbox_account_not_allowed");
  }
}

module.exports = { sandboxAllowed, assertSandboxTransactionAllowed };
