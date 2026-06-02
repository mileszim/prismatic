// Renders the wireframe landscape with depth-of-field into an offscreen canvas.
//
// Segments are projected, sorted far->near, then drawn in depth bands. Each band
// is rasterised to a temp canvas and composited with a blur whose radius is the
// circle of confusion at that depth — far from the focal plane = more blur, and
// a wider aperture (smaller f-number) = more blur per unit of defocus.
//
// Two by-products feed the focusing screen in the HUD:
//   • `sharp`   — an un-blurred render the microprism collar samples.
//   • `depth`   — a render where each line's grey value encodes its distance, so
//                 the collar can scramble each facet by its own local defocus.
//   • getDrawn() — the projected screen-space segments (with per-endpoint depth),
//                 which the split-image prism shears per-segment.

import { INK, PAPER, BANDS, DOF_K, MAX_BLUR } from './config.js';
import { NEARF, FARF } from '../constants.js';
import { makeProjector, toScreen } from './projection.js';

const LOG_RANGE = Math.log(FARF / NEARF);

// distance (m) -> 1..255 grey (0 reserved for "no geometry here")
function encodeDepth(z) {
  let t = Math.log(Math.max(z, NEARF) / NEARF) / LOG_RANGE;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  return 1 + Math.round(t * 254);
}

export function createSceneRenderer(W, H, segs) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const temp = document.createElement('canvas');
  temp.width = W;
  temp.height = H;
  const tctx = temp.getContext('2d');

  // Two scratch buffers for the cross-browser depth-of-field blur. Safari's
  // CanvasRenderingContext2D.filter is unreliable (a silent no-op on iOS), so
  // rather than `ctx.filter = 'blur()'` we approximate each band's circle of
  // confusion by progressively halving it into a small buffer and scaling back
  // up — the bilinear interpolation IS the blur. Uses only drawImage, so it
  // renders identically in Chrome, Firefox, and Safari/iOS.
  const dnA = document.createElement('canvas');
  dnA.width = W; dnA.height = H;
  const dnAc = dnA.getContext('2d');
  const dnB = document.createElement('canvas');
  dnB.width = W; dnB.height = H;
  const dnBc = dnB.getContext('2d');

  // A second, fully-sharp render of the same wireframe. The microprism collar
  // samples this so its facets stay crisp regardless of the depth-of-field blur.
  const sharp = document.createElement('canvas');
  sharp.width = W;
  sharp.height = H;
  const sctx = sharp.getContext('2d');

  // Depth key: each line drawn in a grey proportional to its distance.
  const depth = document.createElement('canvas');
  depth.width = W;
  depth.height = H;
  const dctx = depth.getContext('2d');

  let drawnSegs = [];

  // Composite `temp` (the current band) onto the main canvas, blurred by `blur`
  // px. Down-samples by repeated halving (a box average that keeps thin lines
  // from dropping out), then a single up-scale whose smoothing spreads the ink
  // — fainter as it widens, exactly like a real circle of confusion.
  function drawWithBlur(blur) {
    if (blur < 1) { ctx.drawImage(temp, 0, 0); return; }
    const factor = blur < MAX_BLUR ? blur : MAX_BLUR;
    const tw = Math.max(2, Math.round(W / factor));
    const th = Math.max(2, Math.round(H / factor));

    let srcC = temp, sw = W, sh = H;
    let dstC = dnA, dstCtx = dnAc, otherC = dnB, otherCtx = dnBc;
    const step = (nw, nh) => {
      dstCtx.setTransform(1, 0, 0, 1, 0, 0);
      dstCtx.clearRect(0, 0, nw, nh);
      dstCtx.imageSmoothingEnabled = true;
      dstCtx.drawImage(srcC, 0, 0, sw, sh, 0, 0, nw, nh);
      srcC = dstC; sw = nw; sh = nh;
      const c = dstC, cx = dstCtx;
      dstC = otherC; dstCtx = otherCtx; otherC = c; otherCtx = cx;
    };
    while (sw > tw * 2 || sh > th * 2) {
      step(Math.max(tw, sw >> 1), Math.max(th, sh >> 1));
    }
    step(tw, th); // final exact down-scale
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(srcC, 0, 0, tw, th, 0, 0, W, H); // up-scale = the blur
  }

  function render(state) {
    const proj = makeProjector(state.yaw, state.pitch, state.camX, state.camZ);
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
      drawn.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, za: A.z, zb: B.z, depth: (A.z + B.z) / 2 });
    }
    drawn.sort((p, q) => q.depth - p.depth); // painter's order: far -> near
    drawnSegs = drawn;

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
      drawWithBlur(blur);
    }

    // sharp pass (sampled by the microprism collar)
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, W, H);
    sctx.fillStyle = PAPER;
    sctx.fillRect(0, 0, W, H);
    sctx.strokeStyle = INK;
    sctx.lineCap = 'round';
    sctx.lineWidth = 1.4;
    sctx.beginPath();
    for (const c of drawn) { sctx.moveTo(c.ax, c.ay); sctx.lineTo(c.bx, c.by); }
    sctx.stroke();

    // depth pass (grey = distance; transparent where there's no line). Drawn a
    // little fat so the collar's facet-centre lookups reliably land on a line.
    dctx.setTransform(1, 0, 0, 1, 0, 0);
    dctx.clearRect(0, 0, W, H);
    dctx.lineCap = 'round';
    dctx.lineWidth = 6;
    for (const c of drawn) {
      const v = encodeDepth(c.depth);
      dctx.strokeStyle = `rgb(${v},${v},${v})`;
      dctx.beginPath();
      dctx.moveTo(c.ax, c.ay);
      dctx.lineTo(c.bx, c.by);
      dctx.stroke();
    }
  }

  return { canvas, sharp, depth, render, getDrawn: () => drawnSegs };
}
