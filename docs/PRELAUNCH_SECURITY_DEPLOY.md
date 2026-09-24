# Pre-launch security deployment

This checklist is required before deploying the pre-launch hardening branch to production.

## 1. Take backups and freeze security-sensitive deploys

1. Take an RDS snapshot.
2. Confirm the S3 bucket/versioning/backup policy is healthy.
3. Pause unrelated production deploys until this rollout is complete.
4. Confirm the production host is running Node.js 22 or newer.

Do not remove the existing escrow private key yet. Existing file-key escrow rows must be rewrapped first.

## 2. Rotate historically exposed credentials

The repository's earlier security audit identified historical commits that contained a database password, JWT signing secret, and SMTP credential. Removing a secret from Git does not revoke it.

Rotate all three before launch:

- RDS/database password
- `JWT_ACCESS_SECRET` (use at least 32 random bytes; 64 random bytes is preferred)
- SMTP password/API credential

Update the production environment with the new values. Rotating `JWT_ACCESS_SECRET` intentionally signs every user out.

After rotation, invalidate/remove the old credentials at their providers. Git-history cleanup is optional afterward, but rotation is not optional.

## 3. Create a non-exportable AWS KMS escrow key

Create an asymmetric RSA encryption key in the same AWS region used by the application:

```bash
aws kms create-key \
  --key-spec RSA_2048 \
  --key-usage ENCRYPT_DECRYPT \
  --description "AnyCircumstances emergency file-key escrow"
```

Record the returned key ID, then create a stable alias:

```bash
aws kms create-alias \
  --alias-name alias/anycircumstances-escrow \
  --target-key-id <KEY_ID>
```

Attach the following *minimum* permissions to the EC2 instance role used by the backend. Replace the resource ARN with the exact KMS key ARN:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AnyCircumstancesEscrow",
      "Effect": "Allow",
      "Action": [
        "kms:GetPublicKey",
        "kms:Decrypt"
      ],
      "Resource": "arn:aws:kms:<REGION>:<ACCOUNT_ID>:key/<KEY_ID>"
    }
  ]
}
```

Do not grant `kms:*`, `kms:ScheduleKeyDeletion`, or administrative KMS permissions to the application role.

Add these environment values, but **keep the old escrow private key temporarily for the migration step**:

```bash
ESCROW_KMS_KEY_ID=alias/anycircumstances-escrow
AWS_REGION=<your-region>
```

## 4. Apply the database migration

From the production checkout at `/srv/uac-web`, apply:

```bash
mysql --ssl-mode=VERIFY_CA \
  --ssl-ca=/etc/ssl/certs/rds-global-bundle.pem \
  -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p "$DB_NAME" \
  < backend/20260923_prelaunch_security_hardening.sql
```

The migration adds:

- session-version revocation
- 24-hour duress lock state
- retry/claim state for reminders
- per-recipient emergency delivery jobs
- durable account cleanup jobs
- PIN-reset email challenge storage
- escrow key identifiers

## 5. Rewrap every existing escrowed file key to KMS

Install the hardened backend dependencies:

```bash
cd /srv/uac-web/backend
npm ci
```

Make the old escrow key available to this one migration command as `LEGACY_ESCROW_PRIVATE_KEY_PEM`. Do not print it, paste it into shell history, or commit it.

If the old key is currently only in the protected backend environment file, the migration script can read the existing `ESCROW_PRIVATE_KEY_PEM` value directly. Run:

```bash
npm run migrate:escrow-kms
```

The command must finish with:

```text
Escrow migration complete. Rewrapped N file key(s) to alias/anycircumstances-escrow.
```

Do not continue if it reports any remaining or failed rows.

After successful rewrap:

1. Remove `ESCROW_PRIVATE_KEY_PEM` from all production environment sources.
2. Remove any temporary `LEGACY_ESCROW_PRIVATE_KEY_PEM`.
3. Revoke/delete filesystem copies of the old private key after confirming the KMS migration and backup.
4. Make sure the PM2 environment does not retain the old variable.

The hardened backend refuses to start in production if `ESCROW_PRIVATE_KEY_PEM` is still present.

## 6. Deploy the application

From `/srv/uac-web`:

```bash
npm ci
npm test
npm run lint
npm run build

cd backend
npm ci
npm test
cd ..

unset ESCROW_PRIVATE_KEY_PEM
unset LEGACY_ESCROW_PRIVATE_KEY_PEM

pm2 restart uac-backend --update-env
pm2 logs uac-backend --lines 100
```

The backend must start without an environment-validation error.

## 7. Apply the real Caddy changes

The repository file `deploy/Caddyfile.routing.example` now includes:

- `/stripe/webhook` backend routing
- HSTS
- CSP
- clickjacking protection
- no-referrer policy
- nosniff and permissions policy

Merge those handlers/headers into the production `/etc/caddy/Caddyfile` without discarding production-specific TLS/logging settings.

Then:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Verify that POST requests to `/stripe/webhook` reach the Node backend rather than the SPA/static handler.

## 8. Install the one-minute dispatcher timer

The dispatcher handles:

- grace-period reminders and retries
- race-safe scheduled emergency release
- failed emergency-recipient retries
- durable account deletion/cancellation cleanup retries

Install the supplied systemd units:

```bash
sudo cp /srv/uac-web/deploy/anycircumstances-dispatcher.service /etc/systemd/system/
sudo cp /srv/uac-web/deploy/anycircumstances-dispatcher.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now anycircumstances-dispatcher.timer
sudo systemctl start anycircumstances-dispatcher.service
sudo systemctl status anycircumstances-dispatcher.timer
sudo journalctl -u anycircumstances-dispatcher.service -n 100 --no-pager
```

If an older cron/PM2 job already invokes `dispatch_emergency.js`, remove it after this timer is enabled. The new job claiming is concurrency-safe, but duplicate schedulers are unnecessary.

## 9. Verify provider webhooks

In Stripe, confirm the production webhook endpoint is:

```text
https://anycircumstances.com/stripe/webhook
```

Send a Stripe test webhook and verify a 2xx response in Stripe plus the backend logs.

Verify App Store Server Notifications still target:

```text
https://anycircumstances.com/apple/app-store-notifications
```

## 10. Run sacrificial-account security tests

Use accounts/files created specifically for testing. Do not use a real customer's vault.

Verify all of the following:

1. Normal vault PIN creates a short-lived server authorization and permits download.
2. Direct `/files/list`, `/files/presign-upload`, `/files/confirm-upload`, `/files/save-file-escrow`, `/files/save-user-envelope`, `/files/presign-download`, `/files/get-user-envelope`, `/files/delete`, and both GET/POST `/files/vault-keys` fail with `vault_locked` before PIN unlock.
3. A wrong PIN is rate-limited.
4. Normal and emergency PIN cannot be configured to the same value.
5. Normal safety PIN + Delete Account really queues deletion, signs the account out, and cleanup completes.
6. Emergency PIN + Delete Account displays the same success flow, does **not** delete/cancel anything, locks login for 24 hours, and queues emergency delivery.
7. Repeat the same test for Cancel Subscription + Delete Files.
8. A password reset invalidates every previously issued access/refresh session.
9. Logout invalidates copied access cookies immediately.
10. Reusing a rotated refresh token invalidates the account's other sessions.
11. A share email token can be redeemed once; a second browser cannot replay it.
12. After redemption, the URL fragment is removed and the same browser can finish within the 20-minute HttpOnly share session.
13. A last-second successful check-in prevents a stale scheduled dispatcher run from creating release jobs.
14. Make one emergency recipient SMTP delivery fail and verify successful recipients stay complete while only the failed recipient retries.
15. Temporarily fail Stripe or S3 during deletion and verify `account_lifecycle_jobs` retries rather than losing cleanup state.
16. In Verification Settings, use **Change PIN** and verify the flow requires the current account password, then a fresh 6-digit email code, then requires both a new safety PIN and a different emergency PIN.
17. Verify the email code expires after 10 minutes, locks after five wrong code attempts, and cannot be reused after a successful PIN change.
18. Verify direct calls to the legacy `/auth/set-pin` and `/auth/set-panic-pin` routes cannot overwrite an already-configured PIN and return `use_pin_reset_flow` instead.

## 11. Protect the release process

The repository now has `.github/workflows/security.yml` and Dependabot configuration.

Before launch, enable branch protection for `main` in GitHub if your plan supports protection for this private repository:

- require pull requests
- require the `security-test` job
- require the branch to be up to date
- prevent force pushes
- prevent branch deletion
- do not allow bypass for routine changes

If the current GitHub plan does not support the required private-repository protection, upgrade the repository/account plan before treating CI as an enforceable launch gate.

## 12. KMS monitoring

KMS makes the escrow private key non-exportable, but the backend's EC2 role can still request decrypt operations. This is intentionally not described as zero-knowledge encryption.

Before launch:

- enable/retain CloudTrail KMS logging
- alert on unusual `Decrypt` volume
- keep the EC2 role scoped to this one key
- do not grant KMS administrative actions to the app
- review every production path that can call emergency envelope creation
- keep old KMS decrypt permission until every file escrow row has been rewrapped; each ciphertext is now bound to the exact KMS key ID that wrapped it, so key rotation must preserve decrypt access or rewrap old rows first

## Launch criterion

Do not launch until:

- the migration is applied
- every old escrow row is rewrapped to KMS
- the old escrow private key is removed from production
- historical DB/JWT/SMTP credentials are rotated
- the real Caddy config is updated
- the dispatcher timer is active
- the security CI is green
- the sacrificial-account tests above pass
