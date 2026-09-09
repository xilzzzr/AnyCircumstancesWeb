// Smoke-check compiled onboarding markup and its destinations after npm run build.
import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
const assets = new URL('../dist-ssr/assets/', import.meta.url);
const file = (await readdir(assets)).find(name => /^AuthPages-.*\.js$/.test(name));
const { OnboardingPage } = await import(new URL(file, assets));
const html = renderToString(React.createElement(StaticRouter, { location: '/onboarding' }, React.createElement(OnboardingPage)));
const routes = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
for (const path of ['/app/plan', '/app/verification', '/app/emergency-contacts', '/app/upload']) {
  assert.ok(html.includes(`href="${path}"`), `Missing setup link: ${path}`);
  assert.ok(routes.includes(`path="${path.slice(5)}"`), `Missing app route: ${path}`);
}
assert.ok(html.includes('href="/app"'), 'Dashboard must remain available');
assert.ok(!html.includes('completed'), 'Do not report completion without saved account state');
console.log('Compiled setup guide links resolve to app routes; dashboard remains available.');
