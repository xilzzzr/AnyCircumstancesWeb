const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const {
  ENVIRONMENT_PATHS,
  REQUIRED_BACKEND_ENV_VARS,
  validateBackendEnvironment,
} = require("./environment");

test("environment paths are absolute and independent of the working directory", () => {
  assert.deepEqual(ENVIRONMENT_PATHS, [
    path.join(__dirname, ".env"),
    path.resolve(__dirname, "..", ".env"),
  ]);
  assert.ok(ENVIRONMENT_PATHS.every(path.isAbsolute));
});

test("required backend environment accepts externally supplied values", () => {
  assert.doesNotThrow(() =>
    validateBackendEnvironment({
      DB_HOST: "pm2-db-host",
      DB_USER: "pm2-db-user",
      DB_NAME: "pm2-db-name",
      JWT_ACCESS_SECRET: "externally-supplied-secret",
    })
  );
});

test("initializer preserves process values when launched from another working directory", () => {
  const environmentModule = path.join(__dirname, "environment.js");
  const script = `
    const assert = require("node:assert/strict");
    const { initializeEnvironment, validateBackendEnvironment } = require(${JSON.stringify(environmentModule)});
    initializeEnvironment();
    validateBackendEnvironment();
    assert.equal(process.env.DB_HOST, "pm2-db-host");
    assert.equal(process.env.DB_USER, "pm2-db-user");
    assert.equal(process.env.DB_NAME, "pm2-db-name");
  `;
  const result = spawnSync(process.execPath, ["-e", script], {
    cwd: os.tmpdir(),
    encoding: "utf8",
    env: {
      ...process.env,
      DB_HOST: "pm2-db-host",
      DB_USER: "pm2-db-user",
      DB_NAME: "pm2-db-name",
      JWT_ACCESS_SECRET: "test-only-secret-with-more-than-thirty-two-bytes",
    },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "");
});

test("missing environment failure lists only missing variable names", () => {
  assert.throws(
    () =>
      validateBackendEnvironment({
        DB_HOST: "pm2-db-host",
        DB_USER: "pm2-db-user",
        DB_NAME: "pm2-db-name",
      }),
    {
      message: "Missing required env vars: JWT_ACCESS_SECRET",
    }
  );
});

test("all required variable names remain explicitly documented", () => {
  assert.deepEqual(REQUIRED_BACKEND_ENV_VARS, [
    "DB_HOST",
    "DB_USER",
    "DB_NAME",
    "JWT_ACCESS_SECRET",
  ]);
});

test("production rejects a short JWT secret without logging its value", () => {
  assert.throws(
    () =>
      validateBackendEnvironment({
        NODE_ENV: "production",
        DB_HOST: "pm2-db-host",
        DB_USER: "pm2-db-user",
        DB_NAME: "pm2-db-name",
        JWT_ACCESS_SECRET: "too-short",
      }),
    {
      message: "JWT_ACCESS_SECRET must be at least 32 bytes in production",
    }
  );
});

test("production requires KMS-backed escrow and rejects an exportable private key", () => {
  const base = {
    NODE_ENV: "production",
    DB_HOST: "pm2-db-host",
    DB_USER: "pm2-db-user",
    DB_NAME: "pm2-db-name",
    JWT_ACCESS_SECRET: "test-only-secret-with-more-than-thirty-two-bytes",
    AWS_REGION: "us-east-1",
  };

  assert.throws(
    () => validateBackendEnvironment(base),
    { message: "ESCROW_KMS_KEY_ID is required in production" }
  );

  assert.doesNotThrow(() =>
    validateBackendEnvironment({
      ...base,
      ESCROW_KMS_KEY_ID: "alias/anycircumstances-escrow",
    })
  );

  assert.throws(
    () =>
      validateBackendEnvironment({
        ...base,
        ESCROW_KMS_KEY_ID: "alias/anycircumstances-escrow",
        ESCROW_PRIVATE_KEY_PEM: "-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----",
      }),
    {
      message: "ESCROW_PRIVATE_KEY_PEM must not be used in production; use AWS KMS",
    }
  );
});
