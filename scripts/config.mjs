import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const CONFIG = {
  root: ROOT,
  renderSources: path.join(ROOT, 'render-sources'),
  output: path.join(ROOT, 'public', 'assets'),

  hero: {
    width: 960,
    height: 720,
    duration: 8,
    fps: 60,
    scale: 2,
  },

  grain: {
    width: 640,
    height: 640,
    duration: 3,
    fps: 10,
  },

  card: {
    width: 800,
    height: 500,
  },

  ffmpeg: {
    vp9: '-c:v libvpx-vp9 -pix_fmt yuva420p -crf 10 -b:v 0 -deadline good -auto-alt-ref 0',
    vp9NoAlpha: '-c:v libvpx-vp9 -pix_fmt yuv420p -crf 10 -b:v 0 -deadline good',
  },
};
