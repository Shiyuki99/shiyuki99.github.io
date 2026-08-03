# Portfolio Asset Pipeline — Phase 1 & 2 Design

## Context

Current portfolio is a single 3971-line `index.html` with all visual systems mixed inline. No build system, no package.json, all deps from CDN. Heavy runtime rendering: Three.js globe, CSS grain animation, canvas particles, DOM cursor glitch fragments, card deck with per-element animation.

Goal: Pre-render expensive visuals into static assets. Runtime only handles lightweight interaction. Progressive enhancement — page works without JS.

This spec covers Phases 1 & 2: isolate visual systems, build rendering pipeline.

## Phase 1 — Isolate Visual Systems

Extract each visual component from `index.html` into standalone HTML files under `render-sources/`. Each file must be independently renderable by Puppeteer (self-contained styles, inline scripts, no external deps except CDN libraries loaded within the file).

### Directory Structure

```
render-sources/
  hero/
    hero.html       — Three.js canvas, globe, particles, glow overlay
  grain/
    grain.html      — Procedural canvas noise → export as video frame
  cards/
    card.html       — Single card frame (surface, borders, texture)
  cursor/
    cursor.html     — Cube + glow sprite + trail (if needed as texture)
```

### Hero Render Source

Extract from the current hero implementation (lines 2923-3140):

- Three.js wireframe icosahedron pair (outer crimson, inner white)
- 130 orbiting dust particles
- Faint floor grid
- Hero light overlay (radial gradient)
- Scanline effect
- Auto-rotation + parallax camera

Output target: 8-second seamless loop at ~800x600, VP9 with alpha.

Remove from render source: text, buttons, ScrollTrigger — these stay live.

### Grain Render Source

Replace the runtime canvas noise (lines 2737-2750) with a procedural noise generator that exports as video.

- 140x140 tile → upscaled to fullscreen
- Random grayscale pixels
- 3-second loop to match the current 9s `steps(10)` feel

Output: fullscreen VP9 video overlay (1080p, no alpha needed, just opacity via CSS).

### Card Render Source

Reconstruct a single card's visual frame (the `.card-surface` with its metal texture, bevel, borders, corner L-brackets, keylines) as a static render.

Extract from current `.card-surface` styles (lines 1082-1462):

- Diagonal cut corners via clip-path
- Two-tone graphite gradient
- Crimson border + inset offset keyline
- Corner L-bracket pseudo-elements
- Repeating metal texture

Output: Single 800x500 WebP frame texture with transparency.

Do NOT include in render: text, buttons, tags — those stay live DOM.

### Cursor Render Source (Optional)

Cube + glow sprite at 48x48 resolution. Only needed if moving cursor visuals to pre-rendered sprites instead of CSS box-shadows.

## Phase 2 — Asset Pipeline

Automated pipeline using Puppeteer + ffmpeg. Single command regenerates all assets.

### Project Structure Post-Refactor

```
shiyuki99.github.io/
  src/
    main.js                  — Vite entry, runtime orchestration
    main.css                 — shared styles
    components/              — live DOM components
  public/
    assets/
      hero.webm              — generated
      grain.webm             — generated
      card-frame.webp        — generated
  render-sources/            — isolated HTML for pipeline
    hero/hero.html
    grain/grain.html
    cards/card.html
    cursor/cursor.html
  scripts/
    prerender.mjs            — main orchestrator
    capture-video.mjs        — Puppeteer → ffmpeg video capture
    capture-texture.mjs      — Puppeteer screenshot
    config.mjs               — shared paths, dimensions, durations
  index.html                 — thin shell
  package.json
  vite.config.js
```

### Dependencies

```json
{
  "devDependencies": {
    "vite": "^6.x",
    "puppeteer": "^24.x",
    "fluent-ffmpeg": "^2.x"
  }
}
```

ffmpeg must be available on system PATH. Puppeteer downloads its own Chromium.

### Script: `scripts/config.mjs`

Shared configuration:

- `RENDER_SOURCES` — path to render-sources directory
- `ASSETS_OUTPUT` — path to public/assets
- Hero dimensions: 800x600, 8s loop, 30fps
- Grain dimensions: 1920x1080, 3s loop, 10fps (step animation)
- Card dimensions: 800x500 (single frame)
- VP9 encoding args for transparency support

### Script: `scripts/capture-video.mjs`

```javascript
// For each video source:
// 1. Launch Puppeteer in headless mode
// 2. Navigate to render source HTML
// 3. Wait for any animations to initialize (GSAP/Three.js ready)
// 4. Capture frames via page.screencast or RAF-driven screenshots
// 5. Pipe frames to ffmpeg stdin as raw video
// 6. Encode to VP9 WebM with alpha channel
```

Capture strategy: Use `page.evaluate()` to hook into the render source's animation loop. On each frame, call `page.evaluate(() => new Promise(r => requestAnimationFrame(r)))` then `page.screenshot({ encoding: 'base64', omitBackground: false })`. Pipe frames to ffmpeg via the fluent-ffmpeg API with `inputFormat('image2pipe')`.

For alpha channel support, use Chromium `--enable-alpha-channel` and `mvhd/VP9` encoding.

### Script: `scripts/capture-texture.mjs`

```javascript
// For static textures (card frame):
// 1. Launch Puppeteer headless
// 2. Navigate to card.html
// 3. Wait for styles to resolve
// 4. page.screenshot({ type: 'webp', quality: 90, omitBackground: true })
// 5. Save to public/assets/card-frame.webp
```

### Script: `scripts/prerender.mjs`

Orchestrator:

```
import { renderHero, renderGrain, renderCards } from './capture-video.mjs';
import { captureTexture } from './capture-texture.mjs';

await renderHero();
await renderGrain();
await captureTexture('cards/card.html', 'card-frame.webp');
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "prerender": "node scripts/prerender.mjs",
    "prebuild": "node scripts/prerender.mjs"
  }
}
```

`prebuild` ensures assets are regenerated before each Vite build. Production build on GitHub Pages would be: `npm run build` → `public/` deployed.

### Video Encoding Notes

- VP9 codec for transparency: `-c:v libvpx-vp9 -pix_fmt yuva420p`
- Alpha channel requires `--enable-alpha-channel` flag on Chromium
- `yuva420p` pixel format preserves transparency
- For grain (no alpha needed): standard VP9, `pix_fmt yuv420p`

## Phase Boundaries

Phases 1 & 2 deliver: isolated render sources + automated asset generation. The generated assets are dropped into `public/assets/` but NOT yet wired into the live page. That wiring happens in subsequent phases (3-8).

This design does NOT modify the live `index.html`. It creates new files alongside it. The existing portfolio continues working unchanged throughout.

## Success Criteria

- `npm run prerender` generates hero.webm, grain.webm, card-frame.webp without errors
- Each render source HTML opens independently in browser and renders correctly
- Generated assets are valid WebM/WebP files with correct dimensions
- Zero manual steps in the pipeline
