// Shutter-speed motion blur via a frame-accumulation buffer.
//
// Each frame the buffer is faded toward paper, then the fresh scene is composited
// with `darken` (per-channel min). Stationary lines land on themselves every frame
// and stay full-strength (crisp); when the camera moves, the line a few frames ago
// is no longer redrawn, so it only gets faded — leaving a trail. A long exposure
// (small fade) keeps trails for many frames; a fast one (fade -> 1) replaces the
// frame outright, freezing motion.

import { PAPER } from './config.js';

export function createMotionBlur(W, H) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  let primed = false;

  function reset() {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, W, H);
    primed = false;
  }

  // fade in [0..1]: 1 == replace the frame (no trail); small == long trail.
  function accumulate(src, fade) {
    if (!primed || fade >= 0.999) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(src, 0, 0);
      primed = true;
      return canvas;
    }
    // lighten the standing image toward paper...
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = fade;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    // ...then stamp the new frame's dark lines back in at full strength.
    ctx.globalCompositeOperation = 'darken';
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    return canvas;
  }

  return { canvas, accumulate, reset };
}
