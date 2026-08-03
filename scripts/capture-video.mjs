import puppeteer from 'puppeteer';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import ffmpegStatic from 'ffmpeg-static';
import { CONFIG } from './config.mjs';

ffmpeg.setFfmpegPath(ffmpegStatic);

// Ensure output directory exists
fs.mkdirSync(CONFIG.output, { recursive: true });

/**
 * Capture a render source HTML file to a VP9 WebM video.
 * Uses Puppeteer to render frames and pipes them to ffmpeg via stdin.
 *
 * @param {string} sourceDir  — subdirectory name under render-sources
 * @param {string} sourceFile — HTML filename
 * @param {object} settings   — { width, height, duration, fps, alpha }
 */
export async function captureVideo(sourceDir, sourceFile, settings) {
  const { width, height, duration, fps, alpha = false } = settings;
  const sourcePath = path.join(CONFIG.renderSources, sourceDir, sourceFile);
  const fileUrl = `file://${sourcePath}`;

  console.log(`Capturing: ${sourceDir} → ${width}x${height} @ ${fps}fps, ${duration}s`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      `--window-size=${width},${height}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      ...(alpha ? ['--enable-alpha-channel'] : []),
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 1 });

  // Set transparent background for alpha videos
  if (alpha) {
    await page.evaluateOnNewDocument(() => {
      const style = document.createElement('style');
      style.textContent = 'body { background: transparent !important; }';
      document.head.appendChild(style);
    });
  }

  await page.goto(fileUrl, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for the render source to signal it's ready
  await page.waitForFunction('window.__ready === true', { timeout: 15000 });

  const totalFrames = duration * fps;
  const frameInterval = Math.round(1000 / fps);
  const frameDir = path.join(CONFIG.output, `${sourceDir}_frames`);
  fs.mkdirSync(frameDir, { recursive: true });

  // Capture individual frames as PNG (preserves alpha).
  // Wait frameInterval ms between captures so the animation advances.
  for (let i = 0; i < totalFrames; i++) {
    const framePath = path.join(frameDir, `frame_${String(i).padStart(5, '0')}.png`);
    await page.screenshot({ path: framePath, type: 'png', omitBackground: true });
    console.log(`  Frame ${i + 1}/${totalFrames}`);
    if (i < totalFrames - 1) {
      await new Promise(r => setTimeout(r, frameInterval));
    }
  }

  await browser.close();

  // Encode frames to WebM via ffmpeg
  const outputFile = path.join(CONFIG.output, `${sourceDir}.webm`);
  const ffmpegArgs = alpha ? CONFIG.ffmpeg.vp9 : CONFIG.ffmpeg.vp9NoAlpha;

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(path.join(frameDir, 'frame_%05d.png'))
      .inputFPS(fps)
      .outputOptions(ffmpegArgs.split(' '))
      .videoCodec('libvpx-vp9')
      .output(outputFile)
      .on('end', () => {
        console.log(`  Done: ${outputFile}`);
        // Cleanup frame directory
        fs.rmSync(frameDir, { recursive: true, force: true });
        resolve();
      })
      .on('error', (err) => {
        console.error(`  Error encoding ${sourceDir}:`, err);
        reject(err);
      })
      .run();
  });
}
