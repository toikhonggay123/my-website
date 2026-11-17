import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { chromium, expect } from '@playwright/test';

const base = process.env.AFYLLX_TEST_URL || 'http://127.0.0.1:4372';
const explore = 'Khám phá các lĩnh vực';
let browser;

before(async () => {
  browser = await chromium.launch({
    channel: process.env.AFYLLX_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
  });
});
after(async () => browser?.close());

test('the 3D scene stays visible through contact navigation and browser history', async () => {
  const page = await browser.newPage({ viewport: { width: 599, height: 714 } });
  try {
    const canvas = page.locator('canvas[data-stage]');
    const visibleScene = async () => {
      await expect(canvas).toHaveAttribute('data-ready', '1', { timeout: 10000 });
      await expect(canvas).toHaveCSS('visibility', 'visible');
      await expect(canvas).toHaveCSS('opacity', '1', { timeout: 6000 });
      await expect.poll(async () => {
        const pixelData = (await page.screenshot()).toString('base64');
        // Sample the composited page so an opaque layer over a live canvas fails this check.
        return page.evaluate(async (encoded) => {
          const frame = new Image();
          frame.src = 'data:image/png;base64,' + encoded;
          await frame.decode();
          const sample = new OffscreenCanvas(80, 80);
          const ctx = sample.getContext('2d');
          ctx.drawImage(frame, 0, 0, sample.width, sample.height);
          const { data } = ctx.getImageData(0, 0, sample.width, sample.height);
          let brightBlue = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 2] > 70 && data[i + 2] - data[i] > 30) brightBlue++;
          }
          return brightBlue / (data.length / 4);
        }, pixelData);
      }, { message: 'The composited background should contain the visible blue scene' }).toBeGreaterThan(0.15);
    };

    await page.goto(base + '/#kham-pha');
    await visibleScene();
    await page.locator('header').getByRole('link', { name: 'Liên hệ', exact: true }).click();
    await expect(page).toHaveURL(base + '/lien-he');
    await visibleScene();
    await page.goBack();
    await expect(page).toHaveURL(base + '/#kham-pha');
    await expect(page.locator('#kham-pha')).toBeVisible();
    await visibleScene();
    await page.goForward();
    await expect(page).toHaveURL(base + '/lien-he');
    await visibleScene();
  } finally {
    await page.close();
  }
});

for (const viewport of [{ width: 599, height: 714 }, { width: 1280, height: 800 }]) {
  test(`the intro is readable at the Explore destination at ${viewport.width}px`, async () => {
    const page = await browser.newPage({ viewport });
    try {
      await page.goto(base);
      await page.getByRole('link', { name: explore }).click();
      await expect(page).toHaveURL(base + '/#kham-pha');
      const intro = page.locator('#kham-pha p');
      await expect(intro).toBeInViewport();
      await expect.poll(() => intro.evaluate(el => {
        return Math.min(...[el, ...el.querySelectorAll('span')].map(node => Number(getComputedStyle(node).opacity)));
      })).toBe(1);
    } finally {
      await page.close();
    }
  });
}

test('each division and About has one link in the main content, and topic links still prefill', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(base);
    for (const path of ['edu', 'digital', 'gov', 've-afyllx']) {
      await expect(page.locator(`main a[href="/${path}"]`)).toHaveCount(1);
    }
    for (const topic of ['edu', 'digital', 'gov']) {
      await page.locator(`main a[href="/lien-he?chu-de=${topic}"]`).click();
      await expect(page.locator('select[name="topic"]')).toHaveValue(topic);
      await page.goBack();
      await expect(page).toHaveURL(base + '/');
    }
  } finally {
    await page.close();
  }
});

test('the asset worker serves a CSP report-only policy on the home page', async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  const policy = response.headers.get('content-security-policy-report-only');
  assert.match(policy ?? '', /(?:^|;\s*)script-src 'self'(?:[ ;]|$)/);
  assert.doesNotMatch(policy, /'unsafe-inline'|'unsafe-eval'/);
});
