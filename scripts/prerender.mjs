import { captureVideo } from './capture-video.mjs';
import { captureTexture } from './capture-texture.mjs';
import { CONFIG } from './config.mjs';

async function main() {
  console.log('=== Portfolio Asset Pipeline ===\n');

  try {
    await captureVideo('hero', 'hero.html', {
      width: CONFIG.hero.width,
      height: CONFIG.hero.height,
      duration: CONFIG.hero.duration,
      fps: CONFIG.hero.fps,
      alpha: true,
      scale: CONFIG.hero.scale,
    });

    await captureVideo('grain', 'grain.html', {
      width: CONFIG.grain.width,
      height: CONFIG.grain.height,
      duration: CONFIG.grain.duration,
      fps: CONFIG.grain.fps,
      alpha: false,
    });

    await captureTexture('cards', 'card.html', 'card-frame.webp', {
      width: CONFIG.card.width,
      height: CONFIG.card.height,
    });

    console.log('\n=== All assets generated ===');
  } catch (err) {
    console.error('Pipeline failed:', err);
    process.exit(1);
  }
}

main();
