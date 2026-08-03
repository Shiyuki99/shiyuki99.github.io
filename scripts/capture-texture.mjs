import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { CONFIG } from './config.mjs';

fs.mkdirSync(CONFIG.output, { recursive: true });

/**
 * Capture a single screenshot (WebP) from a render source.
 *
 * @param {string} sourceDir  — subdirectory under render-sources
 * @param {string} sourceFile — HTML filename
 * @param {string} outputName — output filename (e.g., 'card-frame.webp')
 * @param {object} settings   — { width, height }
 */
export async function captureTexture(sourceDir, sourceFile, outputName, settings) {
  const { width, height } = settings;
  const sourcePath = path.join(CONFIG.renderSources, sourceDir, sourceFile);
  const fileUrl = `file://${sourcePath}`;

  console.log(`Capturing texture: ${sourceDir} → ${outputName}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--window-size=${width},${height}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });

  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  const outputPath = path.join(CONFIG.output, outputName);
  await page.screenshot({
    path: outputPath,
    type: 'webp',
    quality: 90,
    omitBackground: true,
  });

  await browser.close();
  console.log(`  Done: ${outputPath}`);
}
