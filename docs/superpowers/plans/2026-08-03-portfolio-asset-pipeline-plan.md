# Portfolio Asset Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract visual systems into isolated render sources and build a Puppeteer + ffmpeg pipeline to pre-render hero.webm, grain.webm, and card-frame.webp.

**Architecture:** Isolate each visual component (hero Three.js, grain noise, card surface) into standalone HTML files under `render-sources/`. Each file is self-contained with inline styles and scripts, renderable headlessly. A Node.js pipeline script launches Puppeteer, captures frames, and pipes them through ffmpeg to produce transparent VP9 WebM and static WebP assets.

**Tech Stack:** Vite, Puppeteer, fluent-ffmpeg (with system ffmpeg), Vanilla HTML/CSS/JS

---

## File Structure

```
shiyuki99.github.io/
  package.json                                    — NEW: deps + scripts
  vite.config.js                                  — NEW: minimal Vite config
  render-sources/
    hero/hero.html                                — NEW: Three.js globe + glow
    grain/grain.html                              — NEW: procedural noise canvas
    cards/card.html                               — NEW: card frame surface only
  scripts/
    config.mjs                                    — NEW: shared paths & settings
    capture-video.mjs                             — NEW: Puppeteer + ffmpeg video
    capture-texture.mjs                           — NEW: Puppeteer screenshot
    prerender.mjs                                 — NEW: orchestrator
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `scripts/config.mjs`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "shiyuki99.github.io",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "prerender": "node scripts/prerender.mjs",
    "prebuild": "node scripts/prerender.mjs"
  },
  "devDependencies": {
    "vite": "^6.4.0",
    "puppeteer": "^24.15.0",
    "fluent-ffmpeg": "^2.1.3"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: Dependencies install without errors. Verify `node_modules/` exists.

- [ ] **Step 3: Create vite.config.js**

```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
```

- [ ] **Step 4: Verify Vite works**

Run: `npx vite --version`
Expected: Vite version printed.

- [ ] **Step 5: Create scripts/config.mjs**

```javascript
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const CONFIG = {
  root: ROOT,
  renderSources: path.join(ROOT, 'render-sources'),
  output: path.join(ROOT, 'public', 'assets'),

  hero: {
    width: 800,
    height: 600,
    duration: 8,  // seconds — must match the render source loop
    fps: 30,
  },

  grain: {
    width: 640,
    height: 640,
    duration: 3,
    fps: 10,      // steps(10) animation feel
  },

  card: {
    width: 800,
    height: 500,
  },

  ffmpeg: {
    // VP9 with alpha for hero
    vp9: '-c:v libvpx-vp9 -pix_fmt yuva420p -crf 10 -b:v 0 -deadline good -auto-alt-ref 0',
    // VP9 without alpha for grain
    vp9NoAlpha: '-c:v libvpx-vp9 -pix_fmt yuv420p -crf 10 -b:v 0 -deadline good',
  },
};
```

- [ ] **Step 6: Create output directory**

Run: `mkdir -p public/assets`

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vite.config.js scripts/config.mjs public/assets
git commit -m "build: scaffold project with Vite and prerender pipeline config"
```

---

### Task 2: Hero Render Source

**Files:**
- Create: `render-sources/hero/hero.html`

Extract only the visual layers from the hero: Three.js canvas (wireframe globe, particles, grid, glow). No text, no buttons, no scroll triggers.

- [ ] **Step 1: Create render-sources/hero/hero.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hero Render Source</title>
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: #050505; overflow: hidden; width: 800px; height: 600px; position: relative; }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
  .hero-light {
    position: absolute; z-index: 0;
    width: 640px; height: 640px; top: 12%; left: -8%;
    border-radius: 50%; pointer-events: none;
    background: radial-gradient(circle, rgba(255,255,255,0.045) 0%, rgba(229,62,62,0.03) 40%, transparent 70%);
    opacity: 0;
  }
  .scanline {
    position: absolute; left: -6%; right: -6%; top: 0; height: 2px; z-index: 3;
    background: linear-gradient(90deg, transparent, rgba(229,62,62,0.85), transparent);
    box-shadow: 0 0 24px rgba(229,62,62,0.55);
    opacity: 0; pointer-events: none;
    animation: scan-sweep 8s ease-in-out infinite;
  }
  @keyframes scan-sweep {
    0%, 100% { top: 0%; opacity: 0; }
    15% { opacity: 1; }
    25% { top: 100%; opacity: 0; }
  }
  @keyframes light-breathe {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.7; transform: scale(1.07); }
  }
</style>
</head>
<body>
  <canvas id="hero-canvas"></canvas>
  <div class="hero-light"></div>
  <div class="scanline"></div>

  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.module.js"
    }
  }
  </script>
  <script type="module">
    import * as THREE from 'three';

    const canvas = document.getElementById('hero-canvas');
    const W = 800, H = 600;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(W, H, false);
    renderer.setPixelRatio(2);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    camera.position.z = 7;

    // Wireframe icosahedron pair
    const group = new THREE.Group();
    scene.add(group);
    const outer = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.9, 1)),
      new THREE.LineBasicMaterial({ color: 0xE53E3E, transparent: true, opacity: 0.22 })
    );
    const inner = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.05, 0)),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.07 })
    );
    group.add(outer, inner);
    group.position.set(2.7, 0.1, 0);

    // Dust particles
    const particleCount = 130;
    const positions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const r = 2.5 + Math.random() * 1.3;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0xE53E3E, size: 0.035, transparent: true, opacity: 0.45,
    }));
    scene.add(dust);

    // Floor grid
    const grid = new THREE.GridHelper(26, 34, 0xffffff, 0xffffff);
    grid.material.transparent = true;
    grid.material.opacity = 0.03;
    grid.position.y = -3.4;
    scene.add(grid);

    // Start glow breathing after 2s (boot delay)
    setTimeout(() => {
      const light = document.querySelector('.hero-light');
      light.style.opacity = '1';
      light.style.animation = 'light-breathe 4.2s ease-in-out infinite';
    }, 2050);

    // Render loop — runs forever, captured for 8 seconds
    let startTime = null;
    const duration = 8000; // ms
    const rotationSpeed = 0.0016;
    const parallaxStrength = 0.14;
    let t = 0;

    function animate(time) {
      t += 0.016; // fixed timestep for deterministic replay

      group.rotation.y += rotationSpeed;
      group.rotation.x += rotationSpeed * 0.35;
      inner.rotation.y -= rotationSpeed * 1.6;
      dust.rotation.y -= rotationSpeed * 0.5;
      group.position.y += Math.sin(time * 0.0006) * 0.0012;

      // Simulated parallax drift (slight camera sway)
      camera.position.x = Math.sin(time * 0.0003) * parallaxStrength * 2.2;
      camera.position.y = Math.cos(time * 0.0004) * parallaxStrength * 1.8;
      camera.lookAt(group.position.x * 0.45, 0, 0);

      renderer.render(scene, camera);

      // Signal completion after 8 seconds — but keep looping for seamless capture
      if (!window.__ready && time > 3000) {
        window.__ready = true;
      }
    }

    renderer.setAnimationLoop(animate);
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify render source opens in browser**

Open `render-sources/hero/hero.html` in a browser. Verify: wireframe globe visible, particles drifting, scanline sweeps periodically, glow breathing after 2s.

- [ ] **Step 3: Commit**

```bash
git add render-sources/hero/hero.html
git commit -m "feat: add hero render source (Three.js globe + glow)"
```

---

### Task 3: Grain Render Source

**Files:**
- Create: `render-sources/grain/grain.html`

Generate a 140x140 procedural noise tile each frame, displayed fullscreen. The CSS `steps(10)` animation feel is achieved by rendering at 10fps with a new noise pattern each frame.

- [ ] **Step 1: Create render-sources/grain/grain.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Grain Render Source</title>
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #050505;
    overflow: hidden;
    width: 640px;
    height: 640px;
    position: relative;
  }
  canvas { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; }
</style>
</head>
<body>
  <canvas id="grain-canvas"></canvas>

  <script>
    const canvas = document.getElementById('grain-canvas');
    const W = 640, H = 640;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const TILE = 140;
    const noiseCanvas = document.createElement('canvas');
    noiseCanvas.width = noiseCanvas.height = TILE;
    const nctx = noiseCanvas.getContext('2d');
    const imgData = nctx.createImageData(TILE, TILE);

    function generateNoise() {
      for (let i = 0; i < imgData.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        imgData.data[i] = imgData.data[i + 1] = imgData.data[i + 2] = v;
        imgData.data[i + 3] = 255;
      }
      nctx.putImageData(imgData, 0, 0);
    }

    function draw() {
      generateNoise();
      ctx.clearRect(0, 0, W, H);
      // Tile the 140x140 pattern across 640x640 with offsets to simulate the shift animation
      for (let x = -TILE; x < W; x += TILE) {
        for (let y = -TILE; y < H; y += TILE) {
          ctx.drawImage(noiseCanvas, x + (Math.random() * 9 - 4.5), y + (Math.random() * 9 - 4.5));
        }
      }
      // Apply opacity via global composite
      ctx.fillStyle = '#050505';
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 0.97;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    window.__ready = true;

    // New noise tile every 100ms = 10fps = steps(10) feel
    setInterval(() => {
      if (window.__shouldStop) return;
      draw();
      window.__frameReady = true;
      window.__frameCount = (window.__frameCount || 0) + 1;
    }, 100);

    draw();
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `render-sources/grain/grain.html`. Should show animated noise pattern updating 10 times per second.

- [ ] **Step 3: Commit**

```bash
git add render-sources/grain/grain.html
git commit -m "feat: add grain render source (procedural noise canvas)"
```

---

### Task 4: Card Render Source

**Files:**
- Create: `render-sources/cards/card.html`

Reconstruct the card's visual frame — the `.card-surface` with clip-path, metal texture, borders, corner brackets — as a standalone render for a single screenshot.

- [ ] **Step 1: Create render-sources/cards/card.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Card Frame Render Source</title>
<style>
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: transparent;
    width: 800px;
    height: 500px;
    overflow: hidden;
  }
  .card-inner {
    position: relative;
    width: 100%;
    height: 100%;
    will-change: transform;
  }
  .card-surface {
    --cut: 20px;
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(155deg, rgba(26,26,26,0.97) 0%, rgba(9,9,9,0.99) 60%);
    border: 1px solid rgba(255,255,255,0.10);
    clip-path: polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px));
    overflow: hidden;
    transition: border-color 0.5s ease, box-shadow 0.5s ease;
  }
  .card-surface::before {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(115deg,
      rgba(255,255,255,0.015) 0px,
      rgba(255,255,255,0.015) 1px,
      transparent 1px,
      transparent 7px);
    opacity: 0.5;
  }
  .card-inner::before {
    content: '';
    position: absolute;
    inset: 7px;
    z-index: 2;
    pointer-events: none;
    border: 1px solid rgba(255,255,255,0.05);
    clip-path: polygon(0 0, calc(100% - 13px) 0, 100% 13px, 100% 100%, 13px 100%, 0 calc(100% - 13px));
  }
  .card-inner::after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: 3;
    pointer-events: none;
    background:
      linear-gradient(rgba(229,62,62,0.55) 0 0) top left / 20px 1px no-repeat,
      linear-gradient(rgba(229,62,62,0.55) 0 0) top left / 1px 20px no-repeat,
      linear-gradient(rgba(229,62,62,0.55) 0 0) bottom right / 20px 1px no-repeat,
      linear-gradient(rgba(229,62,62,0.55) 0 0) bottom right / 1px 20px no-repeat;
    opacity: 0.55;
  }
</style>
</head>
<body>
  <div class="card-inner">
    <div class="card-surface"></div>
  </div>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `render-sources/cards/card.html`. Should show the card frame with diagonal corners, metal texture, inner keyline, and red corner brackets.

- [ ] **Step 3: Commit**

```bash
git add render-sources/cards/card.html
git commit -m "feat: add card render source (frame surface)"
```

---

### Task 5: Video Capture Script

**Files:**
- Create: `scripts/capture-video.mjs`

- [ ] **Step 1: Create scripts/capture-video.mjs**

```javascript
import puppeteer from 'puppeteer';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { CONFIG } from './config.mjs';

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
      ...(alpha ? ['--enable-alpha-channel', '--use-gl=swiftshader'] : []),
      '--disable-gpu', // software rendering for consistency in headless
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

  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/capture-video.mjs
git commit -m "feat: add Puppeteer + ffmpeg video capture script"
```

---

### Task 6: Texture Capture Script

**Files:**
- Create: `scripts/capture-texture.mjs`

- [ ] **Step 1: Create scripts/capture-texture.mjs**

```javascript
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
      '--disable-gpu',
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
```

- [ ] **Step 2: Commit**

```bash
git add scripts/capture-texture.mjs
git commit -m "feat: add Puppeteer texture capture script"
```

---

### Task 7: Prerender Orchestrator

**Files:**
- Create: `scripts/prerender.mjs`

- [ ] **Step 1: Create scripts/prerender.mjs**

```javascript
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
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/prerender.mjs`

- [ ] **Step 3: Test the pipeline**

Run: `node scripts/prerender.mjs`

Expected output:
```
=== Portfolio Asset Pipeline ===
Capturing: hero → 800x600 @ 30fps, 8s
  Frame 1/240
  ...
  Done: public/assets/hero.webm
Capturing: grain → 640x640 @ 10fps, 3s
  Frame 1/30
  ...
  Done: public/assets/grain.webm
Capturing texture: cards → card-frame.webp
  Done: public/assets/card-frame.webp
=== All assets generated ===
```

- [ ] **Step 4: Verify output files**

Run: `ls -la public/assets/`
Expected: `hero.webm`, `grain.webm`, `card-frame.webp` exist with non-zero sizes.

- [ ] **Step 5: Commit**

```bash
git add scripts/prerender.mjs public/assets/hero.webm public/assets/grain.webm public/assets/card-frame.webp
git commit -m "feat: add prerender orchestrator and generated assets"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Run prerender fresh**

Run: `rm -f public/assets/hero.webm public/assets/grain.webm public/assets/card-frame.webp && node scripts/prerender.mjs`
Expected: All three assets regenerate successfully.

- [ ] **Step 2: Check asset validity**

Run: `file public/assets/hero.webm public/assets/grain.webm public/assets/card-frame.webp`
Expected: hero.webm and grain.webm report as "WebM", card-frame.webp reports as "Web/P".

- [ ] **Step 3: Verify hero.webm has expected dimensions**

Run: `ffprobe public/assets/hero.webm 2>&1 | grep Stream`
Expected: Shows 800x600, VP9 codec.

- [ ] **Step 4: Verify grain.webm has expected dimensions**

Run: `ffprobe public/assets/grain.webm 2>&1 | grep Stream`
Expected: Shows 640x640, VP9 codec.

- [ ] **Step 5: Add .gitignore for frame temp dirs**

Ensure `.gitignore` includes:
```
public/assets/*_frames/
```
(Already covered by generated files staying in `public/assets/`)

- [ ] **Step 6: Final commit if any changes**

```bash
git status
```
Only commit if there are untracked changes.
