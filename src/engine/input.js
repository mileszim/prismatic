// Pointer input: drag to look around (yaw/pitch) and click to focus. A click
// that doesn't move picks the nearest object under the cursor, otherwise the
// ground point there, otherwise infinity — and reports the distance via onFocus.

import { FOCAL, EYE_H } from './config.js';
import { NEARF, FARF } from '../constants.js';
import { makeProjector, toScreen } from './projection.js';

export function createInput(canvas, { state, W, H, objects, markDirty, onFocus }) {
  let down = null;

  function onPointerDown(e) {
    down = { x: e.clientX, y: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    const r = canvas.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    state.yaw = nx * 0.26;
    state.pitch = -ny * 0.05;
    markDirty();
    if (down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 5) down.moved = true;
  }

  function onPointerUp(e) {
    if (down && !down.moved) tapFocus(e);
    down = null;
  }

  function tapFocus(e) {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * W;
    const py = (e.clientY - r.top) / r.height * H;

    const proj = makeProjector(state.yaw, state.pitch);
    let best = null, bestD2 = 46 * 46;
    for (const o of objects) {
      const cam = proj([o.x, 2, o.z]);
      if (cam.z <= 0.4) continue;
      const s = toScreen(cam, W, H);
      const d2 = (s.x - px) ** 2 + (s.y - py) ** 2;
      if (d2 < bestD2) { bestD2 = d2; best = cam.z; }
    }

    let dist;
    if (best != null) dist = best;
    else if (py > H / 2 + 2) dist = EYE_H * FOCAL / (py - H / 2); // ground under cursor
    else dist = FARF; // sky -> infinity

    dist = Math.max(NEARF, Math.min(FARF, dist));
    state.focus = dist;
    markDirty();
    if (onFocus) onFocus(dist);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);

  return {
    detach() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
    },
  };
}
