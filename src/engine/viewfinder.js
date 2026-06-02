// Orchestrator: owns the canvas, the camera state, the offscreen pipeline, and
// the render loop. React drives it through setParams({ fnum, focus, isoIdx });
// tap-to-focus reports back via the onFocus callback.

import { PAPER } from './config.js';
import { fieldRect, roundRectPath } from './layout.js';
import { buildScene } from './geometry.js';
import { createSceneRenderer } from './scene.js';
import { createGrain, drawVignette } from './grain.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';

export function createViewfinder(canvas, { onFocus } = {}) {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d');
  const FIELD = fieldRect(W, H);

  const { segs, objects } = buildScene();
  const scene = createSceneRenderer(W, H, segs);
  const grain = createGrain(W, H);
  const hud = createHud(W, H, objects);

  const state = { fnum: 2.8, focus: 12, isoIdx: 2, yaw: 0, pitch: 0, camX: 0, camZ: 0 };
  let sceneDirty = true;
  const markDirty = () => { sceneDirty = true; };

  const input = createInput(canvas, { state, W, H, objects, markDirty, onFocus });

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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    // mask the live image to the rounded viewfinder field
    ctx.save();
    roundRectPath(ctx, FIELD.x, FIELD.y, FIELD.w, FIELD.h, FIELD.r);
    ctx.clip();
    ctx.drawImage(scene.canvas, 0, 0);
    grain.draw(ctx, state.isoIdx);
    drawVignette(ctx, W, H);
    ctx.restore();

    hud.draw(ctx, state);
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  return {
    setParams({ fnum, focus, isoIdx } = {}) {
      if (fnum !== undefined && fnum !== state.fnum) { state.fnum = fnum; sceneDirty = true; }
      if (focus !== undefined && focus !== state.focus) { state.focus = focus; sceneDirty = true; }
      if (isoIdx !== undefined) state.isoIdx = isoIdx; // grain redraws every frame
    },
    dispose() {
      cancelAnimationFrame(rafId);
      input.detach();
    },
  };
}
