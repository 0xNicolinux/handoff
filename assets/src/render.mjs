#!/usr/bin/env node
// render.mjs: renders banner.html and social.html to PNG with headless Chromium (dev-only, not needed to use
// the skill). From the repo root:
//
//   npm i --no-save playwright && npx playwright install chromium
//   node assets/src/build-demo.mjs        # demo.svg (no dependencies)
//   node assets/src/render.mjs            # banner.png (2x) and social-preview.png
//
// Fonts (Geist, Geist Mono) load from Google Fonts, so it needs network access.

import { chromium } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const src = dirname(fileURLToPath(import.meta.url));
const assets = join(src, '..');
const browser = await chromium.launch();

async function shot(file, out, width, height, scale, transparent) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.goto(pathToFileURL(join(src, file)).href, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(assets, out), omitBackground: transparent, clip: { x: 0, y: 0, width, height } });
  await page.close();
  console.log(`wrote assets/${out}`);
}

await shot('banner.html', 'banner.png', 1280, 540, 2, true);
await shot('social.html', 'social-preview.png', 1280, 640, 1, false);
await browser.close();
