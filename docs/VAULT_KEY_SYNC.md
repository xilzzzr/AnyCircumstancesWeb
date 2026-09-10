# Cross-device vault access

## Deployment

1. Apply `backend/20260909_add_vault_key_backups.sql` to the application database. Pulling the repository does not execute SQL; neither backend startup nor the build runs migrations automatically.
2. Deploy/restart the updated backend, then deploy the website build.
3. Ship the updated native iPhone app. Older app versions do not sync keys and use the obsolete PUT upload flow.

From the repository root on the server, after pulling the merged code, run:

```sh
mysql -u YOUR_MYSQL_USER -p YOUR_DATABASE < backend/20260909_add_vault_key_backups.sql
```

Replace the two placeholders with the application's MySQL user and database. Add `-h YOUR_DATABASE_HOST` if MySQL runs on a separate host. MySQL prompts for the password. This migration only creates `user_vault_keys`; it does not change existing tables or files. `CREATE TABLE IF NOT EXISTS` makes rerunning this migration harmless when the table already exists.

Then install dependencies (`npm ci` and `npm --prefix backend ci`), run `npm run build`, deploy `dist/` using the existing hosting setup, and restart the backend with its existing process manager. Apply the SQL before starting the updated backend or iPhone app.

Back up the new `user_vault_keys` table with the rest of the application database. Account deletion removes these records. Cancellation that purges files retains keys for future use.

## Using the vault

Sign in to the same account on the website or native app and enter the same vault passphrase. New uploads require a successful encrypted-key backup before uploading files. A clean browser retrieves the backup from the account; it does not depend on local storage. No passphrase or unencrypted private key is sent by this synchronization flow.

For an existing vault, before clearing site data:

- On each original browser, open Vault → Enable cross-device access and enter the original upload passphrase. Wait for “Vault key backed up.” Downloading or uploading also performs this migration.
- In the updated native app, download an existing file with its upload passphrase once to back up that device’s legacy key. Uploading also attempts migration.
- If different devices historically used different passphrases, their existing files still require their original passphrases. Each key is retained independently.

Clearing cached images/files is different from clearing site data. Before migration, clearing local storage can remove the only locally held copy of an old web vault key. After a successful backup, clearing site data or changing devices does not remove the account backup. Store the vault passphrase in a password manager; resetting the account login password does not change it. This change does not implement forgotten-vault-passphrase recovery. Already-lost legacy keys cannot be reconstructed by this sync flow.

## Protocol

Authenticated GET `/files/vault-keys` returns `user_id`, legacy `public_key`, `has_files`, and `keys`. POST accepts `{bundle, initialize}`. The server scopes every read/write to the authenticated user, bounds the number/size of keys, and never replaces an existing backup. A locked user row serializes initialization; losing first-time clients reload the winning key instead of uploading with a discarded key.

Each v1 bundle contains:

- `public_key`: base64 RSA-2048 SPKI DER.
- `encrypted_private_key`: AES-256-GCM ciphertext plus a 16-byte authentication tag, encrypting PKCS#8 DER.
- `salt`: base64 16 bytes; `iv`: base64 12 bytes.
- `kdf: "PBKDF2-SHA256"`, `iterations: 200000`, `private_key_format: "pkcs8"`, `version: 1`.

The KDF retains compatibility with existing keys. Native Security.framework PKCS#1 private keys are wrapped in PKCS#8 before backup; both clients verify the public/private pair before using it. Legacy unscoped local keys are migrated only when they match the registered public key or successfully unwrap an owned file envelope. New keys are not generated when an existing vault lacks its original key.

## Verification

```sh
npx tsc --noEmit -p tsconfig.app.json
node --test scripts/vault-regression.test.mjs scripts/dashboard-plan.test.mjs
npm --prefix backend test
npm run build
# macOS + Xcode; sibling iPhone repository, or set UAC_NATIVE_ROOT:
node --test scripts/vault-native-interop.test.mjs
```

The interop test runs the actual native crypto implementation against generated WebCrypto fixtures, then decrypts native output in WebCrypto. It covers key wrapping and multi-chunk files in both directions without accessing a real account.
