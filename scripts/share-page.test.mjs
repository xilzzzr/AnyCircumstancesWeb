import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { generateKeyPairSync, publicEncrypt, privateDecrypt } from 'node:crypto';

const bundle = async (path, plugins = []) => {
  const result = await build({ entryPoints: [path], bundle: true, write: false, format: 'esm', platform: 'browser', jsx: 'automatic', plugins });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};
const vault = await bundle('src/lib/vaultCrypto.ts');
const { default: SharePage } = await bundle('src/pages/SharePage.tsx', [{
  name: 'headless-react-hooks',
  setup(build) {
    build.onResolve({ filter: /^(react|react\/jsx-runtime|react-router-dom)$/ }, ({ path }) => ({ path, namespace: 'test' }));
    build.onLoad({ filter: /.*/, namespace: 'test' }, ({ path }) => ({ contents: path === 'react' ? `
      export const useState = (...args) => globalThis.shareHarness.useState(...args);
      export const useEffect = (...args) => globalThis.shareHarness.useEffect(...args);
    ` : path === 'react-router-dom' ? 'export const useParams = () => ({});' : `
      export const jsx = (type, props) => ({type, props});
      export const jsxs = jsx;
      export const Fragment = 'fragment';
    ` }));
  },
}]);

const nodes = (tree) => !tree || typeof tree !== 'object' ? [] : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];

test('clean recipient sessions and refresh decrypt an owner UAC1 PDF using fresh memory-only keys', async (t) => {
  const original = new File(['%PDF-1.4\nEmergency instructions\n%%EOF'], 'Emergency instructions.pdf', { type: 'application/pdf' });
  const encrypted = await vault.encryptFileToAesGcm(original);
  const escrow = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const escrowCiphertext = publicEncrypt({ key: escrow.publicKey, oaepHash: 'sha256' }, encrypted.rawAes);
  const token = 'ab'.repeat(32);
  const publicKeys = [];
  let downloadedBlob;
  let failure = '';
  t.mock.method(URL, 'createObjectURL', (blob) => { downloadedBlob = blob; return 'blob:test'; });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url === 'https://storage.test/ciphertext') {
      if (failure === 'download') return new Response('', { status: 500 });
      return new Response(failure === 'decrypt' ? new Blob(['corrupt']) : encrypted.blob);
    }
    const body = JSON.parse(init.body);
    assert.equal(body.token, token);
    if (url === '/files/share-lookup') return Response.json({ ok: true, file: { id: 'users/1/opaque-key', content_type: original.type } });
    if (url === '/files/share-presign-download') return Response.json({ ok: true, url: 'https://storage.test/ciphertext' });
    assert.equal(url, '/files/share-get-contact-envelope');
    assert.deepEqual(Object.keys(body).sort(), ['public_key', 'token']);
    assert.ok(!publicKeys.includes(body.public_key));
    publicKeys.push(body.public_key);
    if (failure === 'missing_file_escrow') return Response.json({ ok: false, error: failure });
    const raw = privateDecrypt({ key: escrow.privateKey, oaepHash: 'sha256' }, escrowCiphertext);
    const encKey = publicEncrypt({ key: Buffer.from(body.public_key, 'base64'), type: 'spki', format: 'der', oaepHash: 'sha256' }, raw);
    return Response.json({ ok: true, enc_key_b64: failure === 'unwrap' ? 'broken' : encKey.toString('base64'), meta_json: { original_name: original.name } });
  });
  // No browser storage is available, even for reads. Each harness is a clean mount.
  const saved = Object.fromEntries(['window', 'localStorage', 'sessionStorage', 'shareHarness'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  for (const key of ['localStorage', 'sessionStorage']) Object.defineProperty(globalThis, key, { configurable: true, get() { assert.fail('Recipient accessed browser storage'); } });
  globalThis.window = { location: { hash: `#token=${token}` } };
  for (const scenario of ['', '', '', 'missing_file_escrow', 'unwrap', 'download', 'decrypt']) {
    failure = scenario;
    const states = [];
    const effects = [];
    let cursor = 0;
    let first = true;
    globalThis.shareHarness = {
      useState(initial) {
        const i = cursor++;
        if (first) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], (value) => { states[i] = value; }];
      },
      useEffect(fn) { if (first) effects.push(fn); },
    };
    const render = () => { cursor = 0; const tree = SharePage(); first = false; return tree; };
    render();
    effects.forEach((effect) => effect());
    await new Promise((resolve) => setImmediate(resolve));
    let tree = render();
    assert.ok(!JSON.stringify(tree).includes('Generate contact keys'));
    const button = nodes(tree).find((node) => node.type === 'button');
    assert.ok(button);
    await button.props.onClick();
    tree = render();
    if (scenario) {
      const code = scenario === 'missing_file_escrow' ? scenario : `${scenario}_failed`;
      assert.ok(JSON.stringify(tree).includes(code));
      assert.ok(!nodes(tree).some((node) => node.type === 'a'));
    } else {
      const link = nodes(tree).find((node) => node.type === 'a');
      assert.ok(link, JSON.stringify(tree));
      assert.equal(link.props.download, original.name);
      assert.equal(await downloadedBlob.text(), await original.text());
      assert.ok(JSON.stringify(tree).includes(original.name));
    }
    assert.equal(window.location.hash, `#token=${token}`);
  }
  assert.equal(publicKeys.length, 7);
});
