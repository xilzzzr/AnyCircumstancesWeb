import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

// Runs actual native crypto on macOS, with networking stubbed. No account or production data.
test('WebCrypto and native Swift exchange encrypted keys and multi-chunk files in both directions', async () => {
  const native = resolve(process.env.UAC_NATIVE_ROOT || '../AnyCircumstances', 'AnyCircumstances/Services');
  const tmp = await mkdtemp(join(tmpdir(), 'uac-interop-'));
  try {
    const load = async (entry) => {
      const built = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm' });
      return import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
    };
    const web = await load('src/lib/vaultCrypto.ts');
    const { decryptUacBytes } = await load('src/lib/uacChunk.ts');
    const passphrase = 'interoperability passphrase';
    const bundle = await web.createVaultKeyBundle(passphrase);
    const keys = await web.unlockVaultKeyBundle(bundle, passphrase);
    const original = Uint8Array.from({ length: 4 * 1024 * 1024 + 57 }, (_, i) => i % 251);
    const file = await web.encryptFileToAesGcm(new File([original], 'sample.bin'));
    const legacyIV = web.randomBytes(12);
    const legacyKey = await crypto.subtle.importKey('raw', file.rawAes, 'AES-GCM', false, ['encrypt']);
    const legacyBytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: legacyIV }, legacyKey, original);
    await writeFile(join(tmp, 'legacy.bin'), Buffer.from(legacyBytes));
    await writeFile(join(tmp, 'web.json'), JSON.stringify({ bundle, wrapped: await web.wrapAesKeyForUser(keys.pubKey, file.rawAes), iv: web.b64FromBytes(legacyIV) }));
    await writeFile(join(tmp, 'web.bin'), Buffer.from(await file.blob.arrayBuffer()));
    await writeFile(join(tmp, 'plain.bin'), original);
    const api = await readFile(join(native, 'APIClient.swift'), 'utf8');
    const models = api.slice(api.indexOf('struct VaultKeyBundle:'), api.indexOf('struct MePublicKeyResponse:'));
    await writeFile(join(tmp, 'Stub.swift'), `import Foundation
${models}
enum APIError: Error { case serverError(String) }
struct UserEnvelopeResponse { let enc_key_b64: String? }
class APIClient {
 static let shared = APIClient()
 func getVaultKeys() async throws -> VaultKeysResponse { fatalError() }
 func saveVaultKey(_ bundle: VaultKeyBundle, initialize: Bool) async throws { fatalError() }
 func get<T: Decodable>(path: String) async throws -> T { fatalError() }
 func getUserEnvelope(fileId: String) async throws -> UserEnvelopeResponse { fatalError() }
}
`);
    await writeFile(join(tmp, 'Main.swift'), `import Foundation
struct Input: Decodable { let bundle: VaultKeyBundle; let wrapped: String; let iv: String }
struct Output: Encodable { let bundle: VaultKeyBundle; let wrapped: String }
@main struct Interop {
 static func main() throws {
  let root = URL(fileURLWithPath: CommandLine.arguments[1])
  let input = try JSONDecoder().decode(Input.self, from: Data(contentsOf: root.appendingPathComponent("web.json")))
  let passphrase = "interoperability passphrase"
  let keys = try VaultCrypto.unlockKeyBundle(input.bundle, passphrase: passphrase)
  let raw = try VaultCrypto.unwrapAESKeyForUser(privateKey: keys.privateKey, wrappedKeyB64: input.wrapped)
  let plain = try Data(contentsOf: root.appendingPathComponent("plain.bin"))
  let decrypted = try VaultCrypto.decryptFileFromAesGcm(encryptedData: Data(contentsOf: root.appendingPathComponent("web.bin")), rawAESKey: raw)
  precondition(decrypted.data == plain)
  let legacy = try VaultCrypto.decryptFileFromAesGcm(encryptedData: Data(contentsOf: root.appendingPathComponent("legacy.bin")), rawAESKey: raw, legacyIVBase64: input.iv)
  precondition(legacy.data == plain)
  do { _ = try VaultCrypto.unlockKeyBundle(input.bundle, passphrase: "wrong"); fatalError("Wrong passphrase accepted") } catch {}
  let nativeBundle = try VaultCrypto.makeKeyBundle(keys, passphrase: passphrase)
  let nativeFile = try VaultCrypto.encryptFileToAesGcm(fileData: plain)
  let output = Output(bundle: nativeBundle, wrapped: try VaultCrypto.wrapAESKeyForUser(publicKey: keys.publicKey, rawAESKey: nativeFile.rawAESKey))
  try JSONEncoder().encode(output).write(to: root.appendingPathComponent("native.json"))
  try nativeFile.data.write(to: root.appendingPathComponent("native.bin"))
 }
}
`);
    execFileSync('xcrun', ['swiftc', join(native, 'VaultCrypto.swift'), join(native, 'KeychainHelper.swift'), join(tmp, 'Stub.swift'), join(tmp, 'Main.swift'), '-o', join(tmp, 'interop')], { timeout: 120000, env: { ...process.env, DEVELOPER_DIR: '/Applications/Xcode.app/Contents/Developer' } });
    execFileSync(join(tmp, 'interop'), [tmp], { timeout: 30000 });
    const output = JSON.parse(await readFile(join(tmp, 'native.json'), 'utf8'));
    const restored = await web.unlockVaultKeyBundle(output.bundle, passphrase);
    const raw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, restored.privKey, web.bytesFromB64(output.wrapped));
    const aes = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['decrypt']);
    assert.deepEqual(await decryptUacBytes(aes, new Uint8Array(await readFile(join(tmp, 'native.bin'))), {}), original);
  } finally { await rm(tmp, { recursive: true, force: true }); }
});
