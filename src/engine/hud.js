// The viewfinder overlay drawn on top of the photographed image: the rounded
// bright-line frame, AF-area brackets, the central ground-glass focusing screen
// with microprism collar + split-image prism, the exposure readouts, and the
// focus-distance ladder with its depth-of-field bracket.
//
// The focusing screen is driven by the real projected geometry, not a single
// "subject distance": every line is sheared/scrambled by ITS OWN defocus, so a
// near edge stays broken while the camera is focused far (and vice-versa) — like
// a real split-image + microprism screen.

import { INK, PAPER } from './config.js';
import { ISOS, NEARF, FARF, focusLabel } from '../constants.js';
import { fieldRect, roundRectPath } from './layout.js';

const SPLIT_R = 22; // radius of the split-image spot
const SPLIT_GAIN = 15; // px disparity per unit of log-distance defocus
const SPLIT_MAX = 16; // max half-shift (px)

const MICRO_INNER = SPLIT_R; // microprism collar inner radius
const MICRO_OUTER = 40; // microprism collar outer radius
const MICRO_GAIN = 9; // facet displacement per unit of log-distance defocus
const MICRO_MAX = 6; // max facet displacement (px)
const CELL = 4; // microprism facet size (px)
const GLASS_R = 64; // ground-glass / spot-meter reference circle
const TWO_PI = Math.PI * 2;
const LOG_RANGE = Math.log(FARF / NEARF);

// deterministic per-facet pseudo-random angle (stable while the view is still,
// so the collar shimmers as the camera moves rather than buzzing in place)
function facetHash(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function createHud(W, H) {
  const FIELD = fieldRect(W, H);
  const cxm = W / 2, cym = H / 2;
  const LX0 = W * 0.28, LX1 = W * 0.72;

  // collar depth-key sampling window
  const bx0 = Math.round(cxm - MICRO_OUTER);
  const by0 = Math.round(cym - MICRO_OUTER);
  const bw = MICRO_OUTER * 2, bh = MICRO_OUTER * 2;

  // cache the depth pixels per scene render (the projected-segment array gets a
  // fresh reference each render, so an identity check tells us when to re-read)
  let lastDrawn = null;
  let depthBuf = null;

  const ladderX = (d) => {
    const t = Math.log(Math.max(d, NEARF) / NEARF) / LOG_RANGE;
    return LX0 + Math.min(1, Math.max(0, t)) * (LX1 - LX0);
  };

  function draw(ctx, state, scene) {
    const sharp = scene.sharp;
    const drawn = scene.getDrawn();

    if (drawn !== lastDrawn) {
      lastDrawn = drawn;
      depthBuf = scene.depth.getContext('2d').getImageData(bx0, by0, bw, bh).data;
    }

    // Signed split-image shear for a feature at distance z: zero at the focal
    // plane, growing (and flipping sign across it) with log-distance defocus.
    const F = state.focus;
    const shift = (z) => {
      const d = (Math.log(F / (z < NEARF ? NEARF : z)) / LOG_RANGE) * SPLIT_GAIN;
      return d < -SPLIT_MAX ? -SPLIT_MAX : d > SPLIT_MAX ? SPLIT_MAX : d;
    };

    ctx.save();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = 'butt';

    // bright-line frame (rounded — "through the eyepiece")
    ctx.lineWidth = 2;
    roundRectPath(ctx, FIELD.x, FIELD.y, FIELD.w, FIELD.h, FIELD.r);
    ctx.stroke();
    ctx.lineWidth = 1;
    roundRectPath(ctx, FIELD.x + 7, FIELD.y + 7, FIELD.w - 14, FIELD.h - 14, FIELD.r - 7);
    ctx.stroke();

    // edge framing ticks (middle of each side)
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cxm, FIELD.y - 5); ctx.lineTo(cxm, FIELD.y + 13);
    ctx.moveTo(cxm, FIELD.y + FIELD.h + 5); ctx.lineTo(cxm, FIELD.y + FIELD.h - 13);
    ctx.moveTo(FIELD.x - 5, cym); ctx.lineTo(FIELD.x + 13, cym);
    ctx.moveTo(FIELD.x + FIELD.w + 5, cym); ctx.lineTo(FIELD.x + FIELD.w - 13, cym);
    ctx.stroke();

    // AF-area brackets framing the focusing screen
    const ax0 = W * 0.31, ax1 = W * 0.69, ay0 = H * 0.27, ay1 = H * 0.73, abl = 20;
    ctx.beginPath();
    ctx.moveTo(ax0, ay0 + abl); ctx.lineTo(ax0, ay0); ctx.lineTo(ax0 + abl, ay0);
    ctx.moveTo(ax1 - abl, ay0); ctx.lineTo(ax1, ay0); ctx.lineTo(ax1, ay0 + abl);
    ctx.moveTo(ax0, ay1 - abl); ctx.lineTo(ax0, ay1); ctx.lineTo(ax0 + abl, ay1);
    ctx.moveTo(ax1 - abl, ay1); ctx.lineTo(ax1, ay1); ctx.lineTo(ax1, ay1 - abl);
    ctx.stroke();

    // ground-glass / spot-meter reference circle
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cxm, cym, GLASS_R, 0, TWO_PI); ctx.stroke();

    // microprism collar: tile the sharp scene into facets, each refracted by an
    // amount set by the LOCAL line's defocus (read from the depth key) — a near
    // line scrambles even when the background is sharp, and vice-versa.
    if (sharp) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cxm, cym, MICRO_OUTER, 0, TWO_PI);
      ctx.arc(cxm, cym, MICRO_INNER, 0, TWO_PI);
      ctx.clip('evenodd');
      for (let yy = -MICRO_OUTER; yy < MICRO_OUTER; yy += CELL) {
        for (let xx = -MICRO_OUTER; xx < MICRO_OUTER; xx += CELL) {
          const px = cxm + xx, py = cym + yy;
          let disp = 0;
          if (depthBuf) {
            const lx = Math.round(px + CELL / 2 - bx0);
            const ly = Math.round(py + CELL / 2 - by0);
            if (lx >= 0 && ly >= 0 && lx < bw && ly < bh) {
              const v = depthBuf[(ly * bw + lx) * 4];
              if (v > 0) {
                const z = NEARF * Math.pow(FARF / NEARF, (v - 1) / 254);
                disp = Math.abs(Math.log(F / z) / LOG_RANGE) * MICRO_GAIN;
                if (disp > MICRO_MAX) disp = MICRO_MAX;
              }
            }
          }
          let ox = 0, oy = 0;
          if (disp > 0) {
            const a = facetHash(px, py) * TWO_PI;
            ox = Math.cos(a) * disp;
            oy = Math.sin(a) * disp;
          }
          ctx.drawImage(sharp, px + ox, py + oy, CELL, CELL, px, py, CELL, CELL);
        }
      }
      ctx.restore();
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cxm, cym, MICRO_OUTER, 0, TWO_PI); ctx.stroke();
    }

    // split-image prism: the same wireframe, redrawn with the top half sheared
    // +shift and the bottom half -shift, each line by its own depth. A feature on
    // the focal plane has zero shift (continuous across the seam); anything else
    // breaks apart — the amount and direction reading out its defocus.
    if (drawn && drawn.length) {
      const xMin = cxm - SPLIT_R - SPLIT_MAX, xMax = cxm + SPLIT_R + SPLIT_MAX;
      const yMin = cym - SPLIT_R, yMax = cym + SPLIT_R;
      const half = (sign, top) => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cxm - SPLIT_R, cym);
        ctx.lineTo(cxm + SPLIT_R, cym);
        ctx.arc(cxm, cym, SPLIT_R, 0, Math.PI, top);
        ctx.closePath();
        ctx.clip();
        ctx.fillStyle = PAPER;
        ctx.fillRect(cxm - SPLIT_R, cym - SPLIT_R, SPLIT_R * 2, SPLIT_R * 2);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const s of drawn) {
          if (Math.max(s.ax, s.bx) < xMin || Math.min(s.ax, s.bx) > xMax) continue;
          if (Math.max(s.ay, s.by) < yMin || Math.min(s.ay, s.by) > yMax) continue;
          ctx.moveTo(s.ax + sign * shift(s.za), s.ay);
          ctx.lineTo(s.bx + sign * shift(s.zb), s.by);
        }
        ctx.stroke();
        ctx.restore();
      };
      half(1, true); // upper half, sheared +
      half(-1, false); // lower half, sheared -
    }

    // spot outline + the prism seam
    ctx.strokeStyle = INK;
    ctx.lineCap = 'butt';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cxm, cym, SPLIT_R, 0, TWO_PI); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cxm - SPLIT_R, cym); ctx.lineTo(cxm + SPLIT_R, cym); ctx.stroke();

    // exposure readouts (bottom corners)
    ctx.font = "700 15px 'Courier New', monospace";
    ctx.textBaseline = 'bottom';
    ctx.fillText('ƒ/' + state.fnum, 74, H - 50);
    ctx.fillText('ISO ' + ISOS[state.isoIdx], 74, H - 30);
    ctx.textAlign = 'right';
    ctx.fillText('FOCUS ' + focusLabel(state.focus), W - 74, H - 50);
    ctx.textAlign = 'left';

    // focus-distance ladder + depth-of-field bracket
    const ly = H - 30;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(LX0, ly); ctx.lineTo(LX1, ly); ctx.stroke();
    ctx.font = "700 9px 'Courier New', monospace";
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const d of [2, 5, 10, 25, 60, 130]) {
      const x = ladderX(d);
      ctx.beginPath(); ctx.moveTo(x, ly - 4); ctx.lineTo(x, ly + 4); ctx.stroke();
      ctx.fillText(d >= 130 ? '∞' : d, x, ly + 6);
    }
    const k = state.fnum * 0.06;
    const nx = ladderX(state.focus / (1 + k));
    const fx = ladderX(Math.min(FARF, state.focus * (1 + k)));
    ctx.fillStyle = 'rgba(20,17,12,0.16)';
    ctx.fillRect(nx, ly - 6, Math.max(2, fx - nx), 12);
    ctx.fillStyle = INK;
    const mx = ladderX(state.focus);
    ctx.beginPath();
    ctx.moveTo(mx, ly - 9); ctx.lineTo(mx - 5, ly - 17); ctx.lineTo(mx + 5, ly - 17); ctx.closePath();
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.restore();
  }

  return { draw };
}
