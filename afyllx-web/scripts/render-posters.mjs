import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const project = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(project, 'public/afyllx-media');
const base = new URL(process.env.AFYLLX_TEST_URL || 'http://127.0.0.1:4321');
// Each shot is [file name, scene options, chapter index, local/build]. Journey
// shots use local .72 (the hold point: fully expanded object, copy shown).
const chapters = ['edu', 'digital', 'gov'];
const groups = [
  { prefix: 'depth-', suffix: '', width: 1600, height: 1000, shots: chapters.map((id, i) => [id, { mode: 'journey' }, i, .72]) },
  { prefix: 'depth-', suffix: '-mobile', width: 540, height: 1168, shots: chapters.map((id, i) => [id, { mode: 'journey' }, i, .72]) },
  { prefix: 'depth-', suffix: '', width: 1600, height: 1000, shots: [['hero', { mode: 'lineup' }, 0, 1]] },
  { prefix: 'sculpture-', suffix: '', width: 1280, height: 960, shots: [
    ...chapters.map(id => [id, { mode: 'detail', focus: id }, 0, 1]),
    ['hero', { mode: 'lineup' }, 0, 1],
  ] },
];
const browser = await chromium.launch({
  channel: process.env.AFYLLX_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined),
});
let written = 0;
try {
  await fs.mkdir(output, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1.5 });
  page.on('pageerror', error => console.error('Poster page:', error.message));
  await page.addInitScript(() => {
    // SMAA lookup images are unattached Image instances, so document.images
    // does not include them. Track this isolated render page's image loads.
    const images = [];
    window.__afyllxPosterImages = images;
    window.Image = new Proxy(window.Image, {
      construct(Target, args) {
        const image = Reflect.construct(Target, args);
        images.push(image);
        return image;
      },
    });
  });
  await page.goto(new URL('/robots.txt', base).href, { waitUntil: 'networkidle' });
  for (const group of groups) {
    const pictures = await page.evaluate(async ({ prefix, suffix, width, height, shots }) => {
      let createStageScene;
      try {
        ({ createStageScene } = await import('/src/motion/stage-scene.js'));
      } catch (error) {
        throw new Error('Poster rendering requires the Astro dev server, not the built preview: ' + error.message);
      }
      document.body.style.cssText = 'margin:0;background:#050915';
      const pictures = [];
      let canvas;
      for (const [name, options, index, local] of shots) {
        // A fresh canvas per shot gives every scene its own WebGL context.
        canvas?.remove();
        canvas = document.createElement('canvas');
        canvas.style.cssText = 'display:block;width:' + width + 'px;height:' + height + 'px';
        document.body.replaceChildren(canvas);
        const imageStart = window.__afyllxPosterImages.length;
        const scene = createStageScene(canvas, options);
        try {
          await Promise.all(window.__afyllxPosterImages.slice(imageStart).map(image => image.decode()));
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
          const gl = canvas.getContext('webgl2');
          if (!gl || gl.isContextLost()) throw new Error('WebGL2 is unavailable while rendering posters');
          if (canvas.width !== Math.round(width * 1.5) || canvas.height !== Math.round(height * 1.5)) {
            throw new Error('Expected 1.5× poster resolution, received ' + canvas.width + '×' + canvas.height);
          }
          const info = gl.getExtension('WEBGL_debug_renderer_info');
          const renderer = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'WebGL2';
          scene.render(index, local, 3);
          await new Promise(requestAnimationFrame);
          scene.render(index, local, 3);
          const pixels = new Uint8Array(canvas.width * canvas.height * 4);
          gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          let opaque = 0;
          for (let index = 3; index < pixels.length; index += 4) if (pixels[index] >= 254) opaque++;
          const coverage = opaque / (canvas.width * canvas.height);
          const error = gl.getError();
          if (error !== gl.NO_ERROR || coverage <= .99) {
            throw new Error(name + ': incomplete poster framebuffer (' + (coverage * 100).toFixed(2) + '% opaque, WebGL error ' + error + ')');
          }
          const image = canvas.toDataURL('image/webp', .95);
          if (!image.startsWith('data:image/webp;base64,')) throw new Error('The browser did not encode WebP');
          pictures.push({ name: prefix + name + suffix + '.webp', image, width: canvas.width, height: canvas.height, renderer });
        } finally {
          scene.dispose();
        }
      }
      canvas?.remove();
      return pictures;
    }, group);
    for (const picture of pictures) {
      const bytes = Buffer.from(picture.image.slice('data:image/webp;base64,'.length), 'base64');
      await fs.writeFile(path.join(output, picture.name), bytes);
      written++;
      console.log(JSON.stringify({ file: picture.name, width: picture.width, height: picture.height, bytes: bytes.length, renderer: picture.renderer }));
    }
  }
  console.log(JSON.stringify({ posters: 'PASS', files: written, directory: output }));
} finally {
  await browser.close();
}
