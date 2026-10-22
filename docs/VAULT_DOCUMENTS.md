# Create files and recipient instructions

Users can now upload a file or create a document without leaving the app. Templates cover passwords/accounts, crypto wallet recovery, instructions, letters, contacts, blank documents, and a package introduction. Native documents stay editable and export as PDF. The package introduction is a normal protected document: assign it to every contact who should receive that message. It is incorporated into that recipient's Start here instructions when included in their released package.

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

For the cache hardening, also apply the `Cache-Control "no-store"` change for the `@client_spa` handler from `deploy/Caddyfile.routing.example` to the actual Caddy site configuration and validate/reload Caddy. Pulling this example file alone does not update a server's active configuration. Keep the existing CSP, HTTPS, and HSTS headers. Hashed public JavaScript/CSS assets can remain cached; they contain no user document data.

If rollback is necessary, leave the additive migration in place and restore the previous app/backend version. Avoid editing native documents with an older client that does not understand their content type.

## Behavior

- Uploads wait for an explicit save, allowing a per-file note to be entered first. The safety PIN and vault passphrase flows are preserved.
- Saving creates no recipient assignment and sends no message. Use Emergency contacts to assign files, including any package introduction. Removing the old upload-only emergency toggle avoids suggesting that a UI-only setting configured delivery.
- Native content is structured JSON inside the normal encrypted UAC1 object, identified by `application/vnd.anycircumstances.document+json`. PDF filenames describe the exported download. The owner can reopen its structured fields from the vault. Passwords are initially masked in the editor. No plaintext content is persisted in browser storage.
- The wallet template records the original wallet/device and networks; ordered recovery words; backup format and language; whether a recovery passphrase is used, its exact text or separate location; derivation paths, account/address indexes, script type, known receiving addresses, device/local-file access, multi-share or multisig configuration, and other recovery instructions. BIP39 word counts (12/15/18/21/24) and SLIP39 share lengths (20/33) are checked locally. Unknown, Electrum, and other formats remain supported without pretending that a BIP39 word-count check validates them. No checksum/wordlist validation, wallet derivation, balance lookup, network submission of recovery words, or recovery guarantee is provided. See [BIP39](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki), [SLIP39](https://github.com/satoshilabs/slips/blob/master/slip-0039.md), and the original wallet manufacturer's recovery instructions. Multi-share backups support up to 16 shares in a document; recipients may instead be directed to separate offline shares. Imported-key accounts, multisig, smart accounts, and custodial accounts may require separate backups or credentials.
- Recovery words, wallet passphrases, device access, and local-file passwords are masked by default. Reveal controls hide again when the window loses focus or visibility changes. Passphrases are not trimmed or normalized. Exports number the recovery words and include the selected passphrase status and all supplied recovery fields. Titles are visible metadata; users are told not to put secrets in them. All recipients assigned to a document receive all of its contents, including any included passphrase or shares.
- Sensitive editor controls disable autocomplete, autocorrect, capitalization, and spellcheck, and carry common password-manager, grammar-extension, and session-replay exclusion hints. No analytics/replay integration is added. These hints cannot control malicious or noncompliant browser extensions.
- API content/envelope requests and encrypted object downloads explicitly use `cache: no-store`. Existing API responses already send no-store; signed S3 downloads now explicitly override the object response to no-store, including older objects, and new uploads/edits carry no-store metadata. These changes do not purge previously cached copies. Completed upload entries release their plaintext File and note references, and the upload passphrase is cleared when the batch finishes. Sensitive pages unmount their contents on pagehide so back/forward restoration starts fresh. Locking the vault clears the upload editor and queue. No plaintext draft autosave, localStorage, sessionStorage, or IndexedDB persistence is introduced. Legacy localStorage reads are limited to already-encrypted vault-key backups.
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

Wallet tests cover masked entry and auto-hide, no browser-storage writes, exact passphrase preservation, format-specific word counts, malformed schema rejection without echoing secret input, encrypted round-trip/tamper/wrong-key rejection, complete recovery exports, and clearing state across pagehide/pageshow. The signed S3 download test checks its no-store response override without contacting S3. The optional native Swift interoperability script requires the separate iOS checkout; it cannot run from this web-only repository by itself.

## Security boundaries

This feature inherits the vault's existing server escrow/KMS-based emergency release design. It is not a new zero-knowledge custody model: compromise of the application and its authorized key-release permissions can compromise released content. Use an offline wallet backup when that risk is unacceptable. Browser memory must hold plaintext while editing or decrypting. Releasing JavaScript references does not guarantee physical memory erasure, prevent operating-system swap/screenshots, or defeat browser malware, extensions, XSS, compromised dependencies, or a compromised server delivering altered JavaScript. Explicit PDF/ZIP downloads and copies made by recipients remain outside the app's cache controls and cannot be recalled. No implementation should be described as unhackable or as guaranteeing that no copies exist.
