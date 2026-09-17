import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';

// Inspect emitted imports and Vite preload references, not source filenames.
const dist = resolve('dist');
const assets = await readdir(resolve(dist, 'assets'));
assert(assets.some(file => /-[\w-]+\.js$/.test(file)), 'No hashed JavaScript assets');
const shell = await readFile(resolve(dist, 'spa.html'), 'utf8');
assert(shell.includes('<div id="root"></div>'), 'Missing SPA root');
assert(shell.includes('noindex'), 'Private SPA shell must not be indexed');
let checked = 0;
for (const file of ['spa.html', ...assets.filter(file => /\.(js|css)$/.test(file)).map(file => `assets/${file}`)]) {
  const source = await readFile(resolve(dist, file), 'utf8');
  for (const match of source.matchAll(/["']((?:\/assets\/|assets\/|\.\/)[^"'\s]+\.(?:js|css))["']/g)) {
    const target = match[1].startsWith('./') ? resolve(dist, dirname(file), match[1]) : resolve(dist, match[1].replace(/^\//, ''));
    await access(target);
    checked++;
  }
}
console.log(`Validated spa.html, ${assets.length} assets and ${checked} emitted JS/CSS references.`);
