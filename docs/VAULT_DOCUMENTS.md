# Create files and recipient instructions

Users can now upload a file or create a document without leaving the app. Templates cover passwords/accounts, instructions, letters, contacts, blank documents, and a package introduction. Native documents stay editable and export as PDF. The package introduction is a normal protected document: assign it to every contact who should receive that message. It is incorporated into that recipient's Start here instructions when included in their released package.

Every uploaded or created file can carry an optional 4,000-character recipient note. Notes use AES-GCM with an independent random nonce and domain-bound additional authenticated data, encrypted with that file's existing key. Only ciphertext is stored in envelope metadata. Notes never appear in notification emails or vault list previews. Existing escrow and temporary recipient-key wrapping deliver access to the file and its note together.

## Deploy

From `/srv/uac-web`, after merging the PR:

```sh
git pull --ff-only origin main
npm ci
npm ci --prefix backend
npm run migrate:vault-documents --prefix backend
npm run build
pm2 restart uac-backend --update-env
```

The migration must finish before restarting the backend or dispatcher. It loads the existing backend/root environment configuration, preserves existing links, and can be rerun safely. It adds a nullable release-group ID and index to `contact_file_share_tokens`. Restart any separately running dispatcher process after migration so future releases populate the group ID. No new environment variables are required. The S3 execution role needs `s3:PutObject` on the existing user upload prefix for editing native documents, in addition to the existing upload/download/delete permissions.

If rollback is necessary, leave the additive migration in place and restore the previous app/backend version. Avoid editing native documents with an older client that does not understand their content type.

## Behavior

- Uploads wait for an explicit save, allowing a per-file note to be entered first. The safety PIN and vault passphrase flows are preserved.
- Saving creates no recipient assignment and sends no message. Use Emergency contacts to assign files, including any package introduction. Removing the old upload-only emergency toggle avoids suggesting that a UI-only setting configured delivery.
- Native content is structured JSON inside the normal encrypted UAC1 object, identified by `application/vnd.anycircumstances.document+json`. PDF filenames describe the exported download. The owner can reopen its structured fields from the vault. Passwords are initially masked in the editor. No plaintext content is persisted in browser storage.
- Edits reuse the existing per-file key with fresh random nonces. They retain file identity, assignments, and escrow. Updates require the current signed-in session, active plan, vault authorization, matching owner, storage quota, and matching metadata revision. Note-only updates do not download or rewrite the underlying file.
- Documents are limited to 128 KiB of structured plaintext and 100 accounts/contacts. This version uses explicit saving with navigation warnings; it does not implement autosaved drafts, revision history, or a rich-text editor.
- Each new recipient release batch has its own group ID. A redeemed link can only open files released in that same group to that same contact. Unreleased assignments, other contacts, and other batches remain inaccessible. Old links remain single-file links.
- Recipients read notes above each download, can read native documents, download PDFs, download instructions, or download a ZIP containing their files and `Start here.pdf` / `Start here.txt`. Duplicate filenames are disambiguated and instructions use the resulting names. PDF generation uses bundled Roboto fonts, including Cyrillic. PDF/ZIP dependencies are lazy-loaded.
- Combined ZIP downloads are limited to 256 MiB of encrypted source files to bound browser memory. Larger packages remain available as individual downloads. Existing download/share expiry rules apply.
- Existing links, including newly grouped links, resolve the current saved file and note until expiry, as the existing delivery system does. This change does not introduce immutable release snapshots or recall already downloaded copies. Editing the source cannot change a recipient's downloaded copy.

## Verification

```sh
npx tsc --noEmit -p tsconfig.app.json
npm test
npm test --prefix backend
npm run build
node scripts/verify-build-assets.mjs
```

Tests cover the password template flow, encrypted Unicode notes, tamper/wrong-key rejection, native document editing with the existing key, input bounds, locked/unpaid/cross-owner update denial, stale updates, storage limits, release-group isolation, and rerunnable migrations. SQL and AWS calls are mocked; a production smoke test should use a dedicated owner/contact and non-sensitive test content.
