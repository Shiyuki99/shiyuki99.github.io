import { captureVideo } from './capture-video.mjs';
import { CONFIG } from './config.mjs';
import path from 'path';
import fs from 'fs';

function needsRebuild(sourceDir, sourceFile, outputName) {
  const outputPath = path.join(CONFIG.output, outputName);
  if (!fs.existsSync(outputPath)) return true;

  const sourcePath = path.join(CONFIG.renderSources, sourceDir, sourceFile);
  const sourceStat = fs.statSync(sourcePath);
  const outputStat = fs.statSync(outputPath);

  // Also check if any scripts changed (pipeline code affects output)
  const scriptFiles = ['prerender.mjs', 'capture-video.mjs', 'config.mjs'];
  const scriptsDir = path.join(CONFIG.root, 'scripts');
  for (const sf of scriptFiles) {
    const sp = path.join(scriptsDir, sf);
    if (fs.existsSync(sp) && fs.statSync(sp).mtime > outputStat.mtime) return true;
  }

  return sourceStat.mtime > outputStat.mtime;
}

async function main() {
  console.log('=== Portfolio Asset Pipeline ===\n');

  try {
    if (needsRebuild('hero', 'hero.html', 'hero.webm')) {
      console.log('hero: source modified, regenerating...');
      await captureVideo('hero', 'hero.html', {
        width: CONFIG.hero.width,
        height: CONFIG.hero.height,
        duration: CONFIG.hero.duration,
        fps: CONFIG.hero.fps,
        alpha: true,
        scale: CONFIG.hero.scale,
      });
    } else {
      console.log('hero: up to date, skipping');
    }

    if (needsRebuild('grain', 'grain.html', 'grain.webm')) {
      console.log('grain: source modified, regenerating...');
      await captureVideo('grain', 'grain.html', {
        width: CONFIG.grain.width,
        height: CONFIG.grain.height,
        duration: CONFIG.grain.duration,
        fps: CONFIG.grain.fps,
        alpha: true,
      });
    } else {
      console.log('grain: up to date, skipping');
    }

    console.log('\n=== All assets up to date ===');
  } catch (err) {
    console.error('Pipeline failed:', err);
    process.exit(1);
  }
}

main();
