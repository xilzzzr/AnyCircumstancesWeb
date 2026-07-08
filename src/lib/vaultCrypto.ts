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

async function pbkdf2Key(passphrase: string, salt: Uint8Array, usages: KeyUsage[]) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    usages
  );
}

const LS_PUB = "uac_user_pub_spki_b64";
const LS_PRIV_ENC = "uac_user_priv_pkcs8_enc_b64";
const LS_PRIV_SALT = "uac_user_priv_salt_b64";
const LS_PRIV_IV = "uac_user_priv_iv_b64";

export async function ensureUserKeypair(passphrase: string) {
  const pubB64 = localStorage.getItem(LS_PUB);
  const privEncB64 = localStorage.getItem(LS_PRIV_ENC);
  const saltB64 = localStorage.getItem(LS_PRIV_SALT);
  const ivB64 = localStorage.getItem(LS_PRIV_IV);

  if (pubB64 && privEncB64 && saltB64 && ivB64) {
    try {
      const pubBytes = bytesFromB64(pubB64);
      const pubKey = await crypto.subtle.importKey(
        "spki",
        pubBytes,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
      );

      const salt = bytesFromB64(saltB64);
      const iv = bytesFromB64(ivB64);
      const wrapKey = await pbkdf2Key(passphrase, salt, ["decrypt"]);

      const privPkcs8Buf = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        wrapKey,
        bytesFromB64(privEncB64)
      );
      const privPkcs8 = new Uint8Array(privPkcs8Buf);

      const privKey = await crypto.subtle.importKey(
        "pkcs8",
        privPkcs8,
        { name: "RSA-OAEP", hash: "SHA-256" },
        false,
        ["decrypt"]
      );

      return { pubKey, privKey, pubSpkiB64: pubB64 };
    } catch {
      throw new Error("bad_passphrase");
    }
  }

  const kp = await crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );

  const spki = new Uint8Array(await crypto.subtle.exportKey("spki", kp.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const wrapKey = await pbkdf2Key(passphrase, salt, ["encrypt"]);
  const encPriv = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapKey, pkcs8));

  const spkiB64New = b64FromBytes(spki);
  localStorage.setItem(LS_PUB, spkiB64New);
  localStorage.setItem(LS_PRIV_SALT, b64FromBytes(salt));
  localStorage.setItem(LS_PRIV_IV, b64FromBytes(iv));
  localStorage.setItem(LS_PRIV_ENC, b64FromBytes(encPriv));

  return { pubKey: kp.publicKey, privKey: kp.privateKey, pubSpkiB64: spkiB64New };
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

export async function encryptFileToAesGcm(file: File) {
  const CHUNK_SIZE = 4 * 1024 * 1024; // 4 MiB
  const IV_LEN = 12;

  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
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

export async function ensureServerHasUserPublicKey(pubSpkiB64: string) {
  const me = await fetch("/files/me-public-key", { credentials: "include" }).then((r) => r.json()).catch(() => null);
  if (me && me.ok && me.public_key) return true;

  const resp = await fetch("/files/set-user-public-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ public_key: pubSpkiB64 }),
  });
  const j = await resp.json().catch(() => ({}));
  return !!(resp.ok && j.ok);
}
