export function b64FromBytes(bytes: Uint8Array) {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function bytesFromB64(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n: number) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

// New vault keys use 600,000 PBKDF2-SHA256 iterations (current OWASP guidance).
// Keys created earlier keep 200,000: a bundle is never re-wrapped, because the
// server refuses to replace a stored vault key.
export const VAULT_KDF_ITERATIONS = 600000;
const SUPPORTED_ITERATIONS = new Set([200000, VAULT_KDF_ITERATIONS]);

async function pbkdf2Key(passphrase: string, salt: Uint8Array, usages: KeyUsage[], iterations: number) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    usages
  );
}

export type VaultKeyBundle = {
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: 200000 | 600000;
  private_key_format: "pkcs8";
  public_key: string;
  encrypted_private_key: string;
  salt: string;
  iv: string;
};

export async function createVaultKeyBundle(passphrase: string): Promise<VaultKeyBundle> {
  const kp = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const wrapKey = await pbkdf2Key(passphrase, salt, ["encrypt"], VAULT_KDF_ITERATIONS);
  const privateBytes = await crypto.subtle.exportKey("pkcs8", kp.privateKey);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapKey, privateBytes);
  return { version: 1, kdf: "PBKDF2-SHA256", iterations: VAULT_KDF_ITERATIONS, private_key_format: "pkcs8",
    public_key: b64FromBytes(new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey))),
    encrypted_private_key: b64FromBytes(new Uint8Array(encrypted)), salt: b64FromBytes(salt), iv: b64FromBytes(iv) };
}

export async function unlockVaultKeyBundle(bundle: VaultKeyBundle, passphrase: string) {
  if (bundle.version !== 1 || bundle.kdf !== "PBKDF2-SHA256" || !SUPPORTED_ITERATIONS.has(bundle.iterations) || bundle.private_key_format !== "pkcs8") {
    throw new Error("unsupported_vault_key");
  }
  try {
    const pubKey = await crypto.subtle.importKey("spki", bytesFromB64(bundle.public_key), { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
    const wrapKey = await pbkdf2Key(passphrase, bytesFromB64(bundle.salt), ["decrypt"], bundle.iterations);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytesFromB64(bundle.iv) }, wrapKey, bytesFromB64(bundle.encrypted_private_key));
    const privKey = await crypto.subtle.importKey("pkcs8", plain, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]);
    // Detect a mismatched public/private pair before it can encrypt new files.
    const challenge = randomBytes(32);
    const wrapped = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubKey, challenge);
    const opened = new Uint8Array(await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, wrapped));
    if (!opened.every((byte, i) => byte === challenge[i])) throw new Error("key_mismatch");
    return { pubKey, privKey, pubSpkiB64: bundle.public_key };
  } catch { throw new Error("bad_passphrase"); }
}

function legacyVaultKey(): VaultKeyBundle | null {
  try {
    const public_key = localStorage.getItem("uac_user_pub_spki_b64");
    const encrypted_private_key = localStorage.getItem("uac_user_priv_pkcs8_enc_b64");
    const salt = localStorage.getItem("uac_user_priv_salt_b64");
    const iv = localStorage.getItem("uac_user_priv_iv_b64");
    return public_key && encrypted_private_key && salt && iv ? {
      version: 1, kdf: "PBKDF2-SHA256", iterations: 200000, private_key_format: "pkcs8",
      public_key, encrypted_private_key, salt, iv,
    } : null;
  } catch { return null; }
}

async function vaultKeyRequest(path: string, body?: unknown) {
  const response = await fetch(path, { credentials: "include", cache: "no-store", ...(body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || "vault_key_sync_failed");
  return data;
}

const cleanPublicKey = (value: string) => value.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
async function canUnwrap(privKey: CryptoKey, wrapped: string) {
  try { await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privKey, bytesFromB64(wrapped)); return true; }
  catch { return false; }
}

async function resolveUserKeypair(passphrase: string, createIfMissing: boolean, wrappedFileKey?: string) {
  const state = await vaultKeyRequest("/files/vault-keys");
  const bundles: VaultKeyBundle[] = state.keys;
  if (!Array.isArray(bundles)) throw new Error("vault_key_sync_failed");
  const legacy = legacyVaultKey();
  if (legacy && !bundles.some((bundle) => bundle.public_key === legacy.public_key)) {
    // Old storage was not account-scoped. Only migrate keys proven to belong to this account.
    let belongs = cleanPublicKey(state.public_key || "") === legacy.public_key;
    let localKeys: Awaited<ReturnType<typeof unlockVaultKeyBundle>> | null = null;
    try { localKeys = await unlockVaultKeyBundle(legacy, passphrase); } catch { /* Try synced keys below. */ }
    if (!belongs && localKeys && state.has_files) {
      if (wrappedFileKey) belongs = await canUnwrap(localKeys.privKey, wrappedFileKey);
      else {
        const list = await vaultKeyRequest("/files/list");
        for (const file of list.files || []) {
          const envelope = await vaultKeyRequest("/files/get-user-envelope", { file_id: file.key });
          if (await canUnwrap(localKeys.privKey, envelope.enc_key_b64)) { belongs = true; break; }
        }
      }
    }
    if (belongs && localKeys) {
      await vaultKeyRequest("/files/vault-keys", { bundle: legacy, initialize: false });
      bundles.push(legacy);
    } else if (belongs) throw new Error("bad_passphrase");
  }
  if (!bundles.length) {
    if (!createIfMissing || state.public_key || state.has_files) throw new Error("missing_vault_key");
    if (passphrase.length < 8) throw new Error("passphrase_too_short");
    const bundle = await createVaultKeyBundle(passphrase);
    try {
      await vaultKeyRequest("/files/vault-keys", { bundle, initialize: true });
      bundles.push(bundle);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "vault_key_already_exists") throw error;
      const current = await vaultKeyRequest("/files/vault-keys");
      bundles.push(...current.keys);
    }
  }
  let unlocked = false;
  for (const bundle of bundles) {
    let keypair;
    try { keypair = await unlockVaultKeyBundle(bundle, passphrase); } catch { continue; }
    unlocked = true;
    if (!wrappedFileKey || await canUnwrap(keypair.privKey, wrappedFileKey)) return keypair;
  }
  throw new Error(unlocked ? "missing_file_key" : "bad_passphrase");
}

// Serialize uploads within one page; server initialization also handles other devices/tabs.
let keyQueue: Promise<unknown> = Promise.resolve();
export function ensureUserKeypair(passphrase: string, createIfMissing = true, wrappedFileKey?: string) {
  const result = keyQueue.then(() => resolveUserKeypair(passphrase, createIfMissing, wrappedFileKey));
  keyQueue = result.then(() => undefined, () => undefined);
  return result;
}

function u32le(n: number) {
  const b = new Uint8Array(4);
  const dv = new DataView(b.buffer);
  dv.setUint32(0, n >>> 0, true);
  return b;
}

function makeHeader(chunkSize: number, originalSize: number, ivLen: number) {
  const header = new Uint8Array(18);
  header[0] = 0x55; // U
  header[1] = 0x41; // A
  header[2] = 0x43; // C
  header[3] = 0x31; // 1
  header[4] = 1; // version

  const dv = new DataView(header.buffer);
  dv.setUint32(5, chunkSize >>> 0, true);
  dv.setBigUint64(9, BigInt(originalSize), true);
  header[17] = ivLen;

  return header;
}

function makeAad(header: Uint8Array, chunkIndex: number) {
  const aad = new Uint8Array(header.length + 4);
  aad.set(header, 0);
  aad.set(u32le(chunkIndex), header.length);
  return aad;
}

export async function encryptFileToAesGcm(file: File, existingRawKey?: Uint8Array) {
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MiB
  const IV_LEN = 12;

  const aesKey = existingRawKey
    ? await crypto.subtle.importKey("raw", existingRawKey, { name: "AES-GCM" }, true, ["encrypt", "decrypt"])
    : await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const rawAes = new Uint8Array(await crypto.subtle.exportKey("raw", aesKey));

  const header = makeHeader(CHUNK_SIZE, file.size, IV_LEN);
  const parts: BlobPart[] = [header];

  let offset = 0;
  let idx = 0;

  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const chunkBuf = await file.slice(offset, end).arrayBuffer();
    const chunk = new Uint8Array(chunkBuf);

    const iv = randomBytes(IV_LEN);
    const aad = makeAad(header, idx);

    const ctBuf = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      aesKey,
      chunk
    );
    const ct = new Uint8Array(ctBuf);

    parts.push(iv);
    parts.push(u32le(ct.length));
    parts.push(ct);

    offset = end;
    idx += 1;
  }

  const blob = new Blob(parts, { type: "application/octet-stream" });

  return {
    blob,
    rawAes,
    meta: {
      format: "UAC1-AES-256-GCM-CHUNKED",
      version: 1,
      chunk_size: CHUNK_SIZE,
      header_b64: b64FromBytes(header),
    },
  };
}

export async function wrapAesKeyForUser(pubKey: CryptoKey, rawAes: Uint8Array) {
  const wrapped = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, pubKey, rawAes));
  return b64FromBytes(wrapped);
}

