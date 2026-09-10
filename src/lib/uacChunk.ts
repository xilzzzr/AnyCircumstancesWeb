export async function decryptUacBytes(aesKey: CryptoKey, encBytes: Uint8Array, meta: any): Promise<Uint8Array> {
  const startsUAC1 =
    encBytes.length >= 4 &&
    encBytes[0] === 0x55 &&
    encBytes[1] === 0x41 &&
    encBytes[2] === 0x43 &&
    encBytes[3] === 0x31;

  if (!startsUAC1) {
    const ivB64 = meta?.iv_b64;
    if (!ivB64) throw new Error("missing_iv: envelope meta_json.iv_b64 is missing.");
    const ivClean = String(ivB64).replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const ivPadded = ivClean + "===".slice((ivClean.length + 3) % 4);
    const ivBin = atob(ivPadded);
    const iv = new Uint8Array(ivBin.length);
    for (let i = 0; i < ivBin.length; i++) iv[i] = ivBin.charCodeAt(i);

    return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, encBytes));
  }
  const headerLen = 18;
  if (encBytes.length < headerLen) throw new Error("decrypt_failed: truncated_header");

  const header = encBytes.slice(0, headerLen);
  const hdv = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const chunkSize = hdv.getUint32(5, true);
  const originalSize = Number(hdv.getBigUint64(9, true));
  const ivLen = header[17];
  if (header[4] !== 1 || !chunkSize || !Number.isSafeInteger(originalSize) || originalSize < 0 || ivLen !== 12 || originalSize > encBytes.length) throw new Error("decrypt_failed: bad_header");

  const out = new Uint8Array(originalSize);
  let outOff = 0;
  let off = headerLen;
  let idx = 0;
  while (off < encBytes.length && outOff < originalSize) {
    if (off + ivLen + 4 > encBytes.length) throw new Error("decrypt_failed: truncated_chunk");

    const iv = encBytes.slice(off, off + ivLen);
    off += ivLen;

    const ctLen = new DataView(encBytes.buffer, encBytes.byteOffset + off, 4).getUint32(0, true);
    off += 4;

    if (ctLen !== Math.min(chunkSize, originalSize - outOff) + 16) throw new Error("decrypt_failed: bad_chunk_size");
    if (off + ctLen > encBytes.length) throw new Error("decrypt_failed: truncated_ciphertext");
    const ct = encBytes.slice(off, off + ctLen);
    off += ctLen;
    const aad = new Uint8Array(headerLen + 4);
    aad.set(header, 0);
    new DataView(aad.buffer).setUint32(headerLen, idx >>> 0, true);

    const plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: aad }, aesKey, ct)
    );

    out.set(plain, outOff);
    outOff += plain.length;
    idx += 1;
  }

  if (outOff !== originalSize || off !== encBytes.length) throw new Error("decrypt_failed: incomplete_file");
  return out;
}
