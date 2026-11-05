import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isBrandRequest } from '../lib/brand-routing.mjs';

test('apex brand pages, canonical aliases and namespaced assets reach the website', () => {
  for (const path of ['/', '/edu', '/digital/', '/gov.html', '/index.html', '/ve-afyllx?from=nav', '/lien-he', '/quyen-rieng-tu', '/404.html', '/robots.txt', '/sitemap.xml', '/afyllx-assets/main.js', '/afyllx-media/depth-gov.webp', '/afyllx-brand/mark.webp']) {
    for (const method of ['GET', 'HEAD']) assert.equal(isBrandRequest(new Request('https://afyllx.com' + path, { method })), true, method + ' ' + path);
  }
});

test('application routes, APIs, PWA resources and mutations retain the app handler', () => {
  for (const path of ['/quan-tri', '/mealcheck', '/cai-dat', '/quet-qr', '/api/health', '/api/qr/scan', '/assets/index.js', '/brand/edtech-mark.png', '/icons/edtech-192.png', '/sw.js', '/manifest.webmanifest', '/gov-extra', '/afyllx-assets-legacy/main.js', '/edu/api', '/unknown']) {
    assert.equal(isBrandRequest(new Request('https://afyllx.com' + path)), false, path);
  }
  for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
    assert.equal(isBrandRequest(new Request('https://afyllx.com/', { method })), false, method);
  }
});

test('Edu gateway, legacy origin, local requests and lookalike hosts are never intercepted', () => {
  for (const origin of ['https://edu.afyllx.com', 'https://my-website.fyllxestonia.workers.dev', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://afyllx.com.evil.test', 'https://www.afyllx.com']) {
    assert.equal(isBrandRequest(new Request(origin + '/')), false, origin);
    assert.equal(isBrandRequest(new Request(origin + '/afyllx-assets/main.js')), false, origin);
  }
});

test('website deployment adds a service binding without replacing the app domain or database', () => {
  const app = JSON.parse(fs.readFileSync(new URL('../wrangler.cloud.jsonc', import.meta.url), 'utf8'));
  const web = JSON.parse(fs.readFileSync(new URL('../afyllx-web/wrangler.jsonc', import.meta.url), 'utf8'));
  assert.deepEqual(app.services, [{binding: 'AFYLLX_WEB', service: 'afyllx-web'}]);
  assert.deepEqual(app.routes, [{pattern: 'afyllx.com', custom_domain: true}]);
  assert.equal(app.d1_databases[0].database_id, '34ef2bb4-c150-4464-b532-0ceae01cc5f7');
  assert.equal(web.routes, undefined);
  assert.equal(web.d1_databases, undefined);
  assert.equal(web.assets.not_found_handling, '404-page');
});
