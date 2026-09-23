const path = require("path");
const dotenv = require("dotenv");

const BACKEND_ENV_PATH = path.join(__dirname, ".env");
const REPOSITORY_ENV_PATH = path.resolve(__dirname, "..", ".env");
const ENVIRONMENT_PATHS = Object.freeze([BACKEND_ENV_PATH, REPOSITORY_ENV_PATH]);
const REQUIRED_BACKEND_ENV_VARS = Object.freeze([
  "DB_HOST",
  "DB_USER",
  "DB_NAME",
  "JWT_ACCESS_SECRET",
]);

let initialized = false;

function initializeEnvironment() {
  if (initialized) return;

  // Values supplied by PM2 or the shell stay authoritative. backend/.env is
  // the primary file; the repository-root .env remains a deterministic legacy
  // fallback for installations that used the original root-launched server.
  for (const envPath of ENVIRONMENT_PATHS) {
    const result = dotenv.config({ path: envPath, override: false, quiet: true });
    if (result.error && result.error.code !== "ENOENT") {
      const code = result.error.code ? ` (${result.error.code})` : "";
      throw new Error(`Unable to load environment configuration from ${envPath}${code}`);
    }
  }

  initialized = true;
}

function validateBackendEnvironment(environment = process.env) {
  const missing = REQUIRED_BACKEND_ENV_VARS.filter(
    (name) => typeof environment[name] !== "string" || environment[name].trim() === ""
  );

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  if (
    environment.NODE_ENV === "production" &&
    Buffer.byteLength(environment.JWT_ACCESS_SECRET, "utf8") < 32
  ) {
    throw new Error("JWT_ACCESS_SECRET must be at least 32 bytes in production");
  }

  if (environment.NODE_ENV === "production") {
    const kmsKeyId = String(environment.ESCROW_KMS_KEY_ID || "").trim();
    const allowLegacyEscrow =
      String(environment.ALLOW_LEGACY_ESCROW_PRIVATE_KEY || "").toLowerCase() === "true";
    if (!kmsKeyId && !allowLegacyEscrow) {
      throw new Error(
        "Production requires ESCROW_KMS_KEY_ID; raw ESCROW_PRIVATE_KEY_PEM requires explicit ALLOW_LEGACY_ESCROW_PRIVATE_KEY=true"
      );
    }
  }
}

module.exports = {
  ENVIRONMENT_PATHS,
  REQUIRED_BACKEND_ENV_VARS,
  initializeEnvironment,
  validateBackendEnvironment,
};
