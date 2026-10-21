# Local feature demo

Requires Node.js 22 or newer and the PR #38 branch. From the repository root:

```sh
npm ci
node scripts/local-demo.mjs
```

The browser opens at http://localhost:8080/__demo. If it does not open, visit that address yourself.

| Setting | Value |
| --- | --- |
| Email | demo@example.test |
| Account password | VaultDemo2026! |
| Vault PIN | 123456 |
| Suggested vault passphrase | DemoVault2026! |

The passphrase is chosen on first save. Use the same one when reopening documents. The PIN unlocks vault actions; the passphrase decrypts the content.

1. Sign in and create a password document. Add another account and a recipient note, then save.
2. In Vault, unlock with the PIN and open the document using your passphrase. Edit a password or note, save, and reopen to check it.
3. Upload a small existing file with a recipient note as well.
4. In Emergency Contacts, assign those files to the preconfigured Demo Recipient. Confirm using the account password above.
5. Use the demo instructions link at the bottom of the screen, then **Preview recipient package**. Check the file notes, individual PDF downloads, and ZIP containing Start here.pdf.
6. Return to the owner vault and delete a test file to check deletion.

This harness uses the actual frontend and browser encryption with an in-memory API simulation. It does not start the production backend, connect to MySQL or AWS, send email, or charge payments. Unknown API operations fail rather than reaching a production service. It is for testing the document and recipient screens, not end-to-end validation of billing, scheduled releases, login security, or production infrastructure. The recipient preview simulates release of only files assigned to Demo Recipient and requires no email access. Uploaded requests are limited to 32 MiB.

Use invented information only. Everything, including encryption keys, is erased when the process stops. Press Control+C to stop. Restart for a clean account. If port 8080 is already in use, run `UAC_DEMO_PORT=8081 node scripts/local-demo.mjs` and use the address printed in Terminal.

The harness binds only to the local computer and is started only by this command. Normal `npm run dev`, production builds, and the production backend do not enable it.
