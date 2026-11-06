import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const base = process.env.AFYLLX_TEST_URL || 'http://127.0.0.1:4321';
const software = process.argv.includes('--software');
const output = path.resolve('.preview/webgl-' + (software ? 'software' : 'hardware'));
fs.mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.AFYLLX_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
  args: software ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [],
});
const errors = [];
let frames = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

  async function inspect(selector, name, animated = true) {
    const canvas = page.locator(selector);
    const read = () => canvas.evaluate(element => {
      const gl = element.getContext('webgl2');
      if (!gl || gl.isContextLost()) return { lost: true };
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      const pixels = new Uint8Array(element.width * element.height * 4);
      gl.readPixels(0, 0, element.width, element.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let opaque = 0, bright = 0, hash = 2166136261;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] >= 254) opaque++;
        if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 180) bright++;
        hash = Math.imul(hash ^ pixels[i] ^ (pixels[i + 1] << 8) ^ (pixels[i + 2] << 16), 16777619) >>> 0;
      }
      const rect = element.getBoundingClientRect();
      return {
        lost: false, total: element.width * element.height, opaque, bright, hash,
        renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : '',
        error: gl.getError(), opacity: getComputedStyle(element).opacity,
        width: rect.width, height: rect.height,
      };
    });
    const first = await read();
    assert.equal(first.lost, false, name + ': WebGL context');
    if (!software) assert.doesNotMatch(first.renderer, /SwiftShader|llvmpipe|WARP|Software Adapter/i, 'Run the hardware regression with a real GPU');
    assert.equal(first.error, 0, name + ': WebGL error');
    assert.equal(first.opacity, '1', name + ': canvas visibility');
    assert.ok(first.width > 100 && first.height > 100, name + ': canvas size');
    assert.ok(first.opaque > first.total * .995, name + ': incomplete/empty framebuffer ' + JSON.stringify(first));
    // Ink glass has narrow illuminated bevels rather than large bright faces.
    // Full alpha coverage above still catches the original empty/partial MSAA frames.
    assert.ok(first.bright > Math.max(100, first.total * .00025), name + ': missing illuminated geometry ' + JSON.stringify(first));
    if (animated) {
      // Small idle motions can stay on the same pixel grid for a few frames.
      let second = first;
      for (let attempt = 0; attempt < 4 && second.hash === first.hash; attempt++) {
        await page.waitForTimeout(400);
        second = await read();
      }
      assert.notEqual(second.hash, first.hash, name + ': animation is frozen');
      assert.ok(second.opaque > second.total * .995, name + ': next frame is incomplete');
    }
    frames++;
    await page.screenshot({ path: path.join(output, name + '.png') });
    console.log(JSON.stringify({ scene: name, brightPixels: first.bright, completeFrame: true, animated, renderer: first.renderer }));
  }

  async function chapter(name) {
    await page.evaluate(name => {
      const element = document.querySelector('[data-scene="' + name + '"]');
      scrollTo(0, element.getBoundingClientRect().top + scrollY + element.clientHeight / 2 - innerHeight / 2);
    }, name);
    await page.waitForTimeout(1000);
    assert.equal(await page.locator('[data-journey]').getAttribute('data-current'), name);
    assert.ok(Math.abs(await page.locator('.journey-viewport').evaluate(element => element.getBoundingClientRect().top)) < 1, name + ': sticky viewport');
  }

  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('.journey.is-rendered').waitFor();
  await page.waitForTimeout(1000);
  await inspect('[data-depth-canvas]', 'desktop-hero');
  for (const name of ['intro', 'edu', 'digital', 'gov', 'digital', 'edu']) {
    await chapter(name);
    await inspect('[data-depth-canvas]', 'desktop-' + name + '-' + frames);
  }
  for (const [label, viewport] of [
    ['tall', { width: 1182, height: 1177 }],
    ['mobile', { width: 390, height: 844 }],
  ]) {
    await page.setViewportSize(viewport);
    for (const name of ['hero', 'edu', 'digital', 'gov']) {
      await chapter(name);
      await inspect('[data-depth-canvas]', label + '-' + name);
    }
  }
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(base + '/#chuong-digital', { waitUntil: 'networkidle' });
  await page.locator('.journey.is-rendered').waitFor();
  await page.waitForTimeout(1000);
  await inspect('[data-depth-canvas]', 'direct-chapter');
  const secondTab = await browser.newPage();
  await secondTab.bringToFront();
  await page.bringToFront();
  await page.waitForTimeout(600);
  await inspect('[data-depth-canvas]', 'tab-return');
  await secondTab.close();
  for (const name of ['edu', 'digital', 'gov', 've-afyllx']) {
    await page.goto(base + '/' + name, { waitUntil: 'networkidle' });
    await page.locator('[data-depth-visual].is-rendered').waitFor();
    await page.waitForTimeout(1000);
    await inspect('[data-depth-visual] canvas', 'page-' + name);
  }
  assert.deepEqual(errors, [], 'Browser runtime or shader errors');
  console.log(JSON.stringify({ webgl: 'PASS', mode: software ? 'software' : 'hardware', scenes: frames, base }));
} finally {
  await browser.close();
}
