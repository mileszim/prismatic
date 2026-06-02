// Orchestrator: owns the canvas, the camera state, the offscreen pipeline, and
// the render loop. React drives it through setParams({ fnum, focus, isoIdx,
// shutterSec, expo }); tap-to-focus reports back via onFocus and the shutter
// release returns a captured frame via onCapture.

import { PAPER } from './config.js';
import { fieldRect, roundRectPath } from './layout.js';
import { buildScene } from './geometry.js';
import { createSceneRenderer } from './scene.js';
import { createMotionBlur } from './motion.js';
import { createGrain, drawVignette } from './grain.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';

export function createViewfinder(canvas, { onFocus, onCapture } = {}) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  const FIELD = fieldRect(W, H);

  const { segs, objects } = buildScene();
  const scene = createSceneRenderer(W, H, segs);
  const motion = createMotionBlur(W, H);
  const grain = createGrain(W, H);
  const hud = createHud(W, H);

  // shutterSec drives motion blur; expo (stops) drives the exposure wash.
  const state = {
    fnum: 2.8, focus: 12, isoIdx: 2, shutterSec: 1 / 125, expo: 0,
    yaw: 0, pitch: 0, camX: 0, camZ: 0,
  };
  let sceneDirty = true;
  const markDirty = () => { sceneDirty = true; };

  let pendingCapture = false;
  const requestCapture = () => { pendingCapture = true; };

  // Off-screen canvas the saved photo is cropped into (field-sized, no reticle).
  const photo = document.createElement('canvas');
  photo.width = FIELD.w;
  photo.height = FIELD.h;
  const pctx = photo.getContext('2d');

  const input = createInput(canvas, {
    state, W, H, objects, markDirty, onFocus, onShutter: requestCapture,
  });

  // Apply the exposure-triangle wash to whatever is under the current clip.
  function applyExposure(g) {
    const e = state.expo;
    if (e > 0.02) {
      // over-exposed: lift toward paper
      g.fillStyle = 'rgba(244,240,229,' + Math.min(0.62, e * 0.23).toFixed(3) + ')';
      g.fillRect(0, 0, W, H);
    } else if (e < -0.02) {
      // under-exposed: tone down with ink
      g.fillStyle = 'rgba(20,17,12,' + Math.min(0.44, -e * 0.16).toFixed(3) + ')';
      g.fillRect(0, 0, W, H);
    }
  }

  let rafId = 0;
  let lastT = 0;
  function frame(t) {
    // Apply held-key camera movement, scaled by frame time for smooth glide.
    const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0;
    lastT = t;
    input.update(dt);

    // The wireframe only needs re-rendering when the view or optics change;
    // grain is regenerated every frame so it shimmers like real film.
    if (sceneDirty) { scene.render(state); sceneDirty = false; }

    // Motion blur: exposure that spans dt/shutterSec of real time leaves a trail.
    const fade = dt > 0
      ? Math.max(0.04, Math.min(1, 1 - Math.exp(-dt / state.shutterSec)))
      : 1;
    motion.accumulate(scene.canvas, fade);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // mask the live image to the rounded viewfinder field
    ctx.save();
    roundRectPath(ctx, FIELD.x, FIELD.y, FIELD.w, FIELD.h, FIELD.r);
    ctx.clip();
    ctx.drawImage(motion.canvas, 0, 0);
    applyExposure(ctx);
    grain.draw(ctx, state.isoIdx);
    drawVignette(ctx, W, H);
    ctx.restore();

    // Grab the framed image (no reticle/readouts) before the HUD is drawn.
    if (pendingCapture) {
      pendingCapture = false;
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.clearRect(0, 0, FIELD.w, FIELD.h);
      pctx.drawImage(canvas, FIELD.x, FIELD.y, FIELD.w, FIELD.h, 0, 0, FIELD.w, FIELD.h);
      const dataURL = photo.toDataURL('image/png');
      if (onCapture) onCapture(dataURL);
    }

    hud.draw(ctx, state, scene);
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  return {
    setParams({ fnum, focus, isoIdx, shutterSec, expo } = {}) {
      if (fnum !== undefined && fnum !== state.fnum) { state.fnum = fnum; sceneDirty = true; }
      if (focus !== undefined && focus !== state.focus) { state.focus = focus; sceneDirty = true; }
      if (isoIdx !== undefined) state.isoIdx = isoIdx; // grain redraws every frame
      if (shutterSec !== undefined) state.shutterSec = shutterSec; // motion blur, per-frame
      if (expo !== undefined) state.expo = expo; // exposure wash, per-frame
    },
    capture() { requestCapture(); },
    dispose() {
      cancelAnimationFrame(rafId);
      input.detach();
    },
  };
}
