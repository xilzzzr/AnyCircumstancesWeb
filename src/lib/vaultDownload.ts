import { bytesFromB64, ensureUserKeypair } from "./vaultCrypto";
import { decryptUacBytes } from "./uacChunk";
import { getUserEnvelope, presignDownload, type VaultFile } from "./uacFilesApi";

export async function decryptVaultFile(file: VaultFile, passphrase: string) {
  const envelope = await getUserEnvelope(file.key);
  const { privKey } = await ensureUserKeypair(passphrase.trim(), false, envelope.enc_key_b64);
  const rawKey = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" }, privKey, bytesFromB64(envelope.enc_key_b64)
  );
  const aesKey = await crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
  const url = await presignDownload(file.key);
  if (!url) throw new Error("no_url");
  const response = await fetch(url);
  if (!response.ok) throw new Error("download_failed");
  const bytes = await decryptUacBytes(aesKey, new Uint8Array(await response.arrayBuffer()), envelope.meta_json);
  return {
    blob: new Blob([bytes], { type: envelope.meta_json?.original_content_type || file.content_type || "application/octet-stream" }),
    name: envelope.meta_json?.original_name || file.name,
  };
}
