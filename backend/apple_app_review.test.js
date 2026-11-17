const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { sandboxAllowed, assertSandboxTransactionAllowed } = require("./apple_sandbox_policy");

const account = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const production = { NODE_ENV: "production", ALLOW_APPLE_SANDBOX: "true", APPLE_SANDBOX_ACCOUNT_TOKENS: account };

test("production sandbox access requires an explicit flag and valid account allowlist", () => {
  assert.equal(sandboxAllowed({ NODE_ENV: "production", ALLOW_APPLE_SANDBOX: "true" }), false);
  assert.equal(sandboxAllowed({ ...production, APPLE_SANDBOX_ACCOUNT_TOKENS: "*" }), false);
  assert.equal(sandboxAllowed({ ...production, ALLOW_APPLE_SANDBOX: "false" }), false);
  assert.equal(sandboxAllowed(production), true);
  assert.equal(sandboxAllowed({ NODE_ENV: "development", ALLOW_APPLE_SANDBOX: "true" }), true);
});

test("a verified sandbox transaction can only activate the configured review account", () => {
  assert.doesNotThrow(() => assertSandboxTransactionAllowed({ environment: "Sandbox", appAccountToken: account.toUpperCase() }, production));
  for (const token of [other, "", "*", undefined]) {
    assert.throws(() => assertSandboxTransactionAllowed({ environment: "Sandbox", appAccountToken: token }, production), /apple_sandbox_account_not_allowed/);
    assert.throws(() => assertSandboxTransactionAllowed({ environment: "Sandbox", appAccountToken: token }, { ...production, NODE_ENV: undefined }), /apple_sandbox_account_not_allowed/);
  }
  assert.doesNotThrow(() => assertSandboxTransactionAllowed({ environment: "Production", appAccountToken: other }, production));
});

function moduleWithVerifiedAppleTransport(env, verify) {
  const module = { exports: {} };
  const attempts = [];
  class Verifier {
    constructor(roots, online, environment, bundle, appId) {
      assert.equal(online, true);
      assert.equal(bundle, "com.anycircumstances.app");
      this.environment = environment;
    }
    async verifyAndDecodeTransaction(signed) {
      attempts.push(this.environment);
      return verify(signed, this.environment);
    }
  }
  const sandbox = {
    module, exports: module.exports, Buffer, Date, Set, console,
    process: { env: { APPLE_BUNDLE_ID: "com.anycircumstances.app", APPLE_APP_ID: "6770357123", APPLE_ROOT_CA_PATHS: "test-only-root", ...env } },
    require(name) {
      if (name === "fs") return { readFileSync: () => Buffer.from("test-only-root") };
      if (name === "@apple/app-store-server-library") return { SignedDataVerifier: Verifier, Environment: { PRODUCTION: "Production", SANDBOX: "Sandbox" } };
      if (name === "./apple_sandbox_policy") {
        return {
          sandboxAllowed: () => sandboxAllowed(sandbox.process.env),
          assertSandboxTransactionAllowed: transaction => assertSandboxTransactionAllowed(transaction, sandbox.process.env),
        };
      }
      return require(name);
    },
  };
  vm.runInNewContext(fs.readFileSync(require.resolve("./apple_subscriptions"), "utf8"), sandbox);
  return { api: module.exports, attempts };
}

test("the client environment hint never skips production signature verification", async () => {
  const { api, attempts } = moduleWithVerifiedAppleTransport(production, (signed, environment) => {
    assert.equal(signed, "signed-test-fixture");
    if (environment === "Production") throw new Error("not production");
    return { appAccountToken: account, productId: "test-product" };
  });
  const decoded = await api.verifyTransaction("signed-test-fixture", "Sandbox");
  assert.deepEqual(attempts, ["Production", "Sandbox"]);
  assert.equal(decoded.environment, "Sandbox");
});

test("unlisted sandbox accounts and invalid signatures never reach entitlement writes", async () => {
  const { api } = moduleWithVerifiedAppleTransport(production, (_, environment) => {
    if (environment === "Production") throw new Error("not production");
    return { appAccountToken: other };
  });
  await assert.rejects(api.verifyTransaction("signed-test-fixture", "Production"), /invalid_apple_transaction_signature/);
  let writes = 0;
  await assert.rejects(api.upsertAppleEntitlement({ query: async () => { writes++; } }, "1",
    { environment: "Sandbox", appAccountToken: other }, "SUBSCRIBED", "Production"), /apple_sandbox_account_not_allowed/);
  assert.equal(writes, 0);
  const invalid = moduleWithVerifiedAppleTransport(production, () => { throw new Error("bad signature"); });
  await assert.rejects(invalid.api.verifyTransaction("unsigned-client-input", "Sandbox"), /invalid_apple_transaction_signature/);
});
