import { describe, expect, test } from "vitest";
import { b64FromBytes, createVaultKeyBundle, randomBytes, unlockVaultKeyBundle, VAULT_KDF_ITERATIONS, type VaultKeyBundle } from "@/lib/vaultCrypto";

// Wraps a fresh key pair the way vault keys were wrapped before the change.
async function bundleWithIterations(passphrase: string, iterations: number): Promise<VaultKeyBundle> {
  const pair = await crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["encrypt", "decrypt"]);
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  const wrapKey = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapKey, await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  return {
    version: 1, kdf: "PBKDF2-SHA256", iterations: iterations as VaultKeyBundle["iterations"], private_key_format: "pkcs8",
    public_key: b64FromBytes(new Uint8Array(await crypto.subtle.exportKey("spki", pair.publicKey))),
    encrypted_private_key: b64FromBytes(new Uint8Array(encrypted)), salt: b64FromBytes(salt), iv: b64FromBytes(iv),
  };
}

describe("vault key bundles", () => {
  test("new vault keys use 600,000 iterations and unlock only with the right passphrase", async () => {
    const bundle = await createVaultKeyBundle("correct horse battery");
    expect(bundle.iterations).toBe(VAULT_KDF_ITERATIONS);
    expect(VAULT_KDF_ITERATIONS).toBe(600000);
    await expect(unlockVaultKeyBundle(bundle, "correct horse battery")).resolves.toMatchObject({ pubSpkiB64: bundle.public_key });
    await expect(unlockVaultKeyBundle(bundle, "wrong passphrase")).rejects.toThrow("bad_passphrase");
  }, 30000);

  test("vault keys created earlier with 200,000 iterations still unlock", async () => {
    const bundle = await bundleWithIterations("older passphrase", 200000);
    await expect(unlockVaultKeyBundle(bundle, "older passphrase")).resolves.toMatchObject({ pubSpkiB64: bundle.public_key });
  }, 30000);

  test("other iteration counts are refused", async () => {
    const bundle = await bundleWithIterations("some passphrase", 1000);
    await expect(unlockVaultKeyBundle(bundle, "some passphrase")).rejects.toThrow("unsupported_vault_key");
  }, 30000);
});
