import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { generateKeyPairSync, publicEncrypt, privateDecrypt } from 'node:crypto';

const bundle = async (path, plugins = []) => {
  const result = await build({
    entryPoints: [path],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    jsx: 'automatic',
    plugins,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
};

const vault = await bundle('src/lib/vaultCrypto.ts');
const { default: SharePage } = await bundle('src/pages/SharePage.tsx', [{
  name: 'headless-react-hooks',
  setup(build) {
    build.onResolve({ filter: /^(react|react\/jsx-runtime|react-router-dom)$/ }, ({ path }) => ({ path, namespace: 'test' }));
    build.onLoad({ filter: /.*/, namespace: 'test' }, ({ path }) => ({
      contents: path === 'react' ? `
        export const useState = (...args) => globalThis.shareHarness.useState(...args);
        export const useEffect = (...args) => globalThis.shareHarness.useEffect(...args);
        export const useRef = (...args) => globalThis.shareHarness.useRef(...args);
      ` : path === 'react-router-dom' ? 'export const useParams = () => ({});' : `
        export const jsx = (type, props) => ({type, props});
        export const jsxs = jsx;
        export const Fragment = 'fragment';
      `,
    }));
  },
}]);

const nodes = (tree) =>
  !tree || typeof tree !== 'object'
    ? []
    : [tree, ...[tree.props?.children].flat(Infinity).flatMap(nodes)];

const text = (tree) =>
  !tree || typeof tree !== 'object'
    ? (typeof tree === 'string' || typeof tree === 'number' ? String(tree) : '')
    : [tree.props?.children].flat(Infinity).map(text).join('');

const buttonNamed = (tree, name) =>
  nodes(tree).find((node) => node.type === 'button' && text(node).trim() === name);

test('emergency share waits for the button, redeems the fragment once, clears it, and uses the HttpOnly share session afterward', async (t) => {
  const original = new File(
    ['%PDF-1.4\nEmergency instructions\n%%EOF'],
    'Emergency instructions.pdf',
    { type: 'application/pdf' }
  );
  const encrypted = await vault.encryptFileToAesGcm(original);
  const escrow = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const escrowCiphertext = publicEncrypt(
    { key: escrow.publicKey, oaepHash: 'sha256' },
    encrypted.rawAes
  );
  const token = 'ab'.repeat(32);
  const publicKeys = [];
  let lookups = 0;
  let downloadedBlob;
  let failure = '';

  t.mock.method(URL, 'createObjectURL', (blob) => {
    downloadedBlob = blob;
    return 'blob:test';
  });
  t.mock.method(URL, 'revokeObjectURL', () => {});

  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (url === 'https://storage.test/ciphertext') {
      if (failure === 'download') return new Response('', { status: 500 });
      return new Response(failure === 'decrypt' ? new Blob(['corrupt']) : encrypted.blob);
    }

    assert.equal(init.credentials, 'include');
    const body = JSON.parse(init.body || '{}');

    if (url === '/files/share-lookup') {
      assert.deepEqual(body, { token });
      lookups++;
      return Response.json({
        ok: true,
        file: { id: 'users/1/opaque-key', content_type: original.type },
      });
    }

    if (url === '/files/share-presign-download') {
      assert.deepEqual(body, {});
      return Response.json({ ok: true, url: 'https://storage.test/ciphertext' });
    }

    assert.equal(url, '/files/share-get-contact-envelope');
    assert.deepEqual(Object.keys(body), ['public_key']);
    assert.ok(!publicKeys.includes(body.public_key));
    publicKeys.push(body.public_key);

    if (failure === 'missing_file_escrow') {
      return Response.json({ ok: false, error: failure });
    }

    const raw = privateDecrypt(
      { key: escrow.privateKey, oaepHash: 'sha256' },
      escrowCiphertext
    );
    const encKey = publicEncrypt(
      {
        key: Buffer.from(body.public_key, 'base64'),
        type: 'spki',
        format: 'der',
        oaepHash: 'sha256',
      },
      raw
    );

    return Response.json({
      ok: true,
      enc_key_b64: failure === 'unwrap' ? 'broken' : encKey.toString('base64'),
      meta_json: { original_name: original.name },
    });
  });

  const saved = Object.fromEntries(
    ['window', 'localStorage', 'sessionStorage', 'shareHarness'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );

  t.after(() => {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  for (const key of ['localStorage', 'sessionStorage']) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get() {
        assert.fail('Recipient accessed browser storage');
      },
    });
  }

  globalThis.window = {
    location: { hash: '', pathname: '/share', search: '' },
    history: {
      replaceState(_state, _title, next) {
        assert.equal(next, '/share');
        globalThis.window.location.hash = '';
      },
    },
  };

  for (const scenario of ['', '', '', 'missing_file_escrow', 'unwrap', 'download', 'decrypt']) {
    failure = scenario;
    globalThis.window.location.hash = `#token=${token}`;

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
      useRef(initial) {
        const i = cursor++;
        if (first) states[i] = { current: initial };
        return states[i];
      },
      useEffect(fn) {
        if (first) effects.push(fn);
      },
    };

    const render = () => {
      cursor = 0;
      const tree = SharePage();
      first = false;
      return tree;
    };

    const lookupsBefore = lookups;
    render();
    effects.forEach((effect) => effect());
    await new Promise((resolve) => setImmediate(resolve));

    // Nothing is redeemed on load: a link scanner or preview must not spend the single-use link.
    let tree = render();
    assert.equal(lookups, lookupsBefore);
    assert.equal(window.location.hash, `#token=${token}`);
    assert.ok(text(tree).includes('Someone shared important information with you'));
    assert.ok(!JSON.stringify(tree).includes('Generate contact keys'));

    const open = buttonNamed(tree, 'Open shared file');
    assert.ok(open, JSON.stringify(tree));
    await open.props.onClick();
    tree = render();
    assert.equal(lookups, lookupsBefore + 1);
    assert.equal(window.location.hash, '');

    const downloadLink = (current) => nodes(current).find((node) => node.type === 'a' && node.props.download);

    if (scenario) {
      const code = scenario === 'missing_file_escrow' ? scenario : `${scenario}_failed`;
      const shown = text(tree);
      assert.ok(!JSON.stringify(tree).includes(code), 'raw error code must not be shown');
      assert.ok(
        shown.includes(scenario === 'download' ? "The download didn't finish" : "The file couldn't be prepared"),
        shown
      );
      assert.ok(!downloadLink(tree));

      // Retrying after redemption reuses the share session and never redeems the link again.
      failure = '';
      const retry = buttonNamed(tree, 'Try again');
      assert.ok(retry, JSON.stringify(tree));
      await retry.props.onClick();
      tree = render();
      assert.equal(lookups, lookupsBefore + 1);
    }

    const link = downloadLink(tree);
    assert.ok(link, JSON.stringify(tree));
    assert.equal(link.props.download, original.name);
    assert.equal(await downloadedBlob.text(), await original.text());
    assert.ok(JSON.stringify(tree).includes(original.name));
  }

  // 7 opens plus 4 retries after the failure scenarios, each with a fresh temporary key.
  assert.equal(publicKeys.length, 11);
});
