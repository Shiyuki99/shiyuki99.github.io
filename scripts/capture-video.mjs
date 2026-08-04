import puppeteer from 'puppeteer';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import ffmpegStatic from 'ffmpeg-static';
import { CONFIG } from './config.mjs';

ffmpeg.setFfmpegPath(ffmpegStatic);

fs.mkdirSync(CONFIG.output, { recursive: true });

export async function captureVideo(sourceDir, sourceFile, settings) {
  const { width, height, duration, fps, alpha = false, scale = 1 } = settings;
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
  await page.setViewport({ width, height, deviceScaleFactor: scale });

  if (alpha) {
    await page.evaluateOnNewDocument(() => {
      const style = document.createElement('style');
      style.textContent = 'body { background: transparent !important; }';
      document.head.appendChild(style);
    });
  }

  await page.goto(fileUrl, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.waitForFunction('window.__ready === true', { timeout: 15000 });

  // Step-based capture: advance animation by fixed delta before each screenshot.
  // This ensures exact timing regardless of how long page.screenshot() takes.
  const totalFrames = duration * fps;
  const dtPerFrame = Math.round(1000 / fps);
  const frameDir = path.join(CONFIG.output, `${sourceDir}_frames`);
  fs.mkdirSync(frameDir, { recursive: true });

  for (let i = 0; i < totalFrames; i++) {
    const framePath = path.join(frameDir, `frame_${String(i).padStart(5, '0')}.png`);
    await page.evaluate((dt) => window.__stepFrame(dt), dtPerFrame);
    await page.screenshot({ path: framePath, type: 'png', omitBackground: true });
    console.log(`  Frame ${i + 1}/${totalFrames}`);
  }

  await browser.close();

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
