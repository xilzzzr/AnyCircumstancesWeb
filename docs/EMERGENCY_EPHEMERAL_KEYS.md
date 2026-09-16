# Emergency downloads with temporary recipient keys

Each Download + decrypt click creates a fresh RSA-OAEP SHA-256 keypair in browser memory. The public SPKI and bearer share token are posted to `/files/share-get-contact-envelope`. After validating expiry and file/contact ownership, the backend unwraps the existing escrow and re-wraps it to that public key. Only the wrapped key and owner metadata are returned, with `Cache-Control: no-store`. Neither temporary key nor envelope is persisted. The fragment token remains available after refresh.

Owner uploads, owner envelopes, escrow storage, UAC1, and dispatcher token generation are unchanged. `decryptUacBytes()` handles both UAC1 and legacy AES-GCM. The page no longer requires an IV in metadata before inspecting the ciphertext. Download filenames use owner metadata `original_name`.

## Legacy compatibility and deployment

No database migration is required. Existing contact envelopes and `emergency_contacts.public_key` are retained. The legacy registration endpoint still accepts registration but no longer creates contact envelopes. `/save-contact-envelope` still validates authenticated ownership and assignment and acknowledges old requests, but no longer writes envelopes. Old clients calling the download envelope endpoint without `public_key` receive `missing_public_key`; deploy frontend/backend together and reload stale clients. Removing legacy endpoints, columns, and rows is a later cleanup.

The emergency email template no longer says contact key setup is required. Dispatcher link generation, recipient selection, and email delivery are unchanged.

## Read-only escrow diagnostic

Run against the application database:

```sql
SELECT
    f.id,
    f.created_at,
    CASE
        WHEN e.file_id IS NULL OR e.enc_key_b64 IS NULL OR e.enc_key_b64 = ''
        THEN 'MISSING ESCROW'
        ELSE 'OK'
    END AS escrow_status
FROM files f
LEFT JOIN file_key_escrows e ON e.file_id = f.id
ORDER BY f.created_at DESC;
```

Older uploads may predate escrow support. They cannot be delivered through the new emergency flow without a valid escrow row, even if an old contact envelope exists. No automatic deletion, re-upload, or legacy-envelope fallback is performed. A row's presence does not prove its ciphertext matches the configured escrow private key.

## Verification

- `node --test backend/files.test.js`: real Express HTTP route with an isolated fake database; real RSA escrow/re-wrap; two independent keypairs, cross-key rejection, metadata, authorization errors, and no writes.
- `node --test scripts/share-page.test.mjs`: real SharePage event handler in a headless React hook harness; real WebCrypto and owner UAC1 encryption, mocked HTTP/storage service, clean mounts and refresh, filename preservation, storage access rejection, and failure states.
- `npm --prefix backend test`
- `node --test scripts/vault-regression.test.mjs scripts/vault-native-interop.test.mjs`
- `npx tsc --noEmit -p tsconfig.app.json`
- `npm run build`

These automated tests do not replace the live browser/database acceptance check. With the patch deployed, sign in, upload a PDF, verify its escrow row, assign it to a verified contact, and generate an emergency share link. Open it in two clean browser sessions; click Download + decrypt and confirm the PDF contents and original name. Refresh and repeat. Confirm no recipient key storage entries or new contact envelopes appear. No emergency emails were sent as part of local testing.
