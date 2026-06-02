// Renders the wireframe landscape with depth-of-field into an offscreen canvas.
//
// Segments are projected, sorted far->near, then drawn in depth bands. Each band
// is rasterised to a temp canvas and composited with a blur whose radius is the
// circle of confusion at that depth — far from the focal plane = more blur, and
// a wider aperture (smaller f-number) = more blur per unit of defocus.

import { INK, PAPER, BANDS, DOF_K, MAX_BLUR } from './config.js';
import { makeProjector, toScreen } from './projection.js';

export function createSceneRenderer(W, H, segs) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const temp = document.createElement('canvas');
  temp.width = W;
  temp.height = H;
  const tctx = temp.getContext('2d');

  function render(state) {
    const proj = makeProjector(state.yaw, state.pitch);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);

    const NZ = 0.4; // near clip plane
    const drawn = [];
    for (const s of segs) {
      let A = proj(s.a), B = proj(s.b);
      if (A.z < NZ && B.z < NZ) continue;
      if (A.z < NZ) {
        const t = (NZ - A.z) / (B.z - A.z);
        A = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, z: NZ };
      } else if (B.z < NZ) {
        const t = (NZ - B.z) / (A.z - B.z);
        B = { x: B.x + (A.x - B.x) * t, y: B.y + (A.y - B.y) * t, z: NZ };
      }
      const a = toScreen(A, W, H), b = toScreen(B, W, H);
      drawn.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, depth: (A.z + B.z) / 2 });
    }
    drawn.sort((p, q) => q.depth - p.depth); // painter's order: far -> near

    const F = state.focus, f = state.fnum;
    const per = Math.ceil(drawn.length / BANDS) || 1;
    for (let bi = 0; bi < BANDS; bi++) {
      const chunk = drawn.slice(bi * per, (bi + 1) * per);
      if (!chunk.length) continue;

      let dsum = 0;
      for (const c of chunk) dsum += c.depth;
      const d = dsum / chunk.length;

      tctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, W, H);
      tctx.strokeStyle = INK;
      tctx.lineCap = 'round';
      tctx.lineWidth = Math.max(0.8, 2.3 - d * 0.02);
      tctx.beginPath();
      for (const c of chunk) { tctx.moveTo(c.ax, c.ay); tctx.lineTo(c.bx, c.by); }
      tctx.stroke();

      let blur = (DOF_K / f) * Math.abs(d - F) / Math.max(d, F, 1);
      if (blur > MAX_BLUR) blur = MAX_BLUR;
      ctx.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : 'none';
      ctx.drawImage(temp, 0, 0);
    }
    ctx.filter = 'none';
  }

  return { canvas, render };
}
