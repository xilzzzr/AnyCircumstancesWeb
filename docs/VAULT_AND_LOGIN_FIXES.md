# Vault downloads and login

Vault downloads now retrieve the user's encrypted file-key envelope, unlock the local private key using the upload passphrase, decrypt the file, and save it with its original filename and content type. Existing chunked UAC1 and legacy AES-GCM files are supported. Missing local keys, incorrect passphrases, and damaged files stop the download instead of saving ciphertext. Cross-device key backups are now implemented; see [Vault key sync](VAULT_KEY_SYNC.md) for migration and deployment requirements.

Login reloads the authenticated user after receiving cookies. Session checks renew expired access tokens through `/auth/refresh`, with concurrent checks sharing a single refresh operation.

Authentication limits default to:

| Environment variable | Default per 15 minutes |
| --- | --- |
| `LOGIN_ACCOUNT_LIMIT_PER_15_MINUTES` | 30 unsuccessful attempts per email |
| `LOGIN_IP_LIMIT_PER_15_MINUTES` | 100 unsuccessful attempts per IP |
| `AUTH_IP_LIMIT_PER_15_MINUTES` | 600 auth mutations per IP |

Successful logins do not consume either login allowance. Session reads, refresh, and logout do not consume the auth allowance; application-wide limits still apply. Existing environment overrides take precedence. The frontend displays the server's retry delay when login returns 429.

Deploy the rebuilt frontend and restart the backend to apply these changes. If production explicitly sets `LOGIN_ACCOUNT_LIMIT_PER_15_MINUTES=10`, remove that override or increase it to use the more forgiving limit.

Regression checks:

```sh
node --test scripts/vault-regression.test.mjs
npm --prefix backend test
npm run build
```

## Dashboard plan display

The dashboard now identifies the plan only from a successful, recognized billing-status response. Failed billing or feature requests no longer label the account Free. Billing lookup failures show a retry action, and inactive subscriptions point to billing management. Storage capacity is derived from the summary without restarting the entire dashboard load. Leaving the plan editor ignores late request failures so they cannot redirect the user after navigation.

Run `node --test scripts/dashboard-plan.test.mjs` for plan-state regressions.
