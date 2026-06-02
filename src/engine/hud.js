// The viewfinder overlay drawn on top of the photographed image: the rounded
// bright-line frame, AF-area brackets, the central ground-glass focusing screen
// with microprism collar + split-image prism, the exposure readouts, and the
// focus-distance ladder with its depth-of-field bracket.

import { INK } from './config.js';
import { ISOS, NEARF, FARF, focusLabel } from '../constants.js';
import { makeProjector, toScreen } from './projection.js';
import { fieldRect, roundRectPath } from './layout.js';

const SPLIT_R = 22; // radius of the split-image spot
const SPLIT_GAIN = 15; // px disparity per unit of log-distance defocus
const SPLIT_MAX = 14; // max half-shift (px)

const MICRO_INNER = SPLIT_R; // microprism collar inner radius
const MICRO_OUTER = 40; // microprism collar outer radius
const MICRO_GAIN = 8; // facet displacement per unit of log-distance defocus
const MICRO_MAX = 5; // max facet displacement (px)
const CELL = 4; // microprism facet size (px)
const GLASS_R = 64; // ground-glass / spot-meter reference circle
const TWO_PI = Math.PI * 2;

// deterministic per-facet pseudo-random angle (stable while the view is still,
// so the collar shimmers as the camera moves rather than buzzing in place)
function facetHash(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export function createHud(W, H, objects) {
  const FIELD = fieldRect(W, H);
  const LX0 = W * 0.28, LX1 = W * 0.72;

  const ladderX = (d) => {
    const t = Math.log(Math.max(d, NEARF) / NEARF) / Math.log(FARF / NEARF);
    return LX0 + Math.min(1, Math.max(0, t)) * (LX1 - LX0);
  };

  // Depth (m) of the object nearest the centre of the spot, or null if none.
  function centerSubjectDepth(state) {
    const proj = makeProjector(state.yaw, state.pitch, state.camX, state.camZ);
    let subjDepth = null, bestD2 = 230 * 230;
    for (const o of objects) {
      const cam = proj([o.x, 3, o.z]);
      if (cam.z <= 0.4) continue;
      const s = toScreen(cam, W, H);
      const d2 = (s.x - W / 2) ** 2 + (s.y - H / 2) ** 2;
      if (d2 < bestD2) { bestD2 = d2; subjDepth = cam.z; }
    }
    return subjDepth;
  }

  function draw(ctx, state, sharp) {
    ctx.save();
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    ctx.lineCap = 'butt';
    const cxm = W / 2, cym = H / 2;

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

    // central focusing screen ------------------------------------------------
    // Defocus is measured in log-distance (like a real focus-ring throw) so the
    // split-image and microprism slide evenly across the whole range instead of
    // sitting pinned until focus is nearly reached.
    const subj = centerSubjectDepth(state);
    let dx = 0, micro = 0;
    if (subj != null) {
      const diff = Math.log(state.focus / subj) / Math.log(FARF / NEARF);
      dx = Math.max(-SPLIT_MAX, Math.min(SPLIT_MAX, diff * SPLIT_GAIN));
      micro = Math.min(MICRO_MAX, Math.abs(diff) * MICRO_GAIN);
    }

    // ground-glass / spot-meter reference circle
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cxm, cym, GLASS_R, 0, TWO_PI); ctx.stroke();

    // microprism collar: tile the sharp scene into facets, each refracted in a
    // different direction by an amount set by defocus — scrambled out of focus,
    // resolving to a clean image as focus is reached.
    if (sharp) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cxm, cym, MICRO_OUTER, 0, TWO_PI);
      ctx.arc(cxm, cym, MICRO_INNER, 0, TWO_PI);
      ctx.clip('evenodd');
      for (let yy = -MICRO_OUTER; yy < MICRO_OUTER; yy += CELL) {
        for (let xx = -MICRO_OUTER; xx < MICRO_OUTER; xx += CELL) {
          const px = cxm + xx, py = cym + yy;
          let ox = 0, oy = 0;
          if (micro > 0) {
            const a = facetHash(px, py) * TWO_PI;
            ox = Math.cos(a) * micro;
            oy = Math.sin(a) * micro;
          }
          ctx.drawImage(sharp, px + ox, py + oy, CELL, CELL, px, py, CELL, CELL);
        }
      }
      ctx.restore();
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cxm, cym, MICRO_OUTER, 0, TWO_PI); ctx.stroke();
    }

    // split-image prism: sharp scene with the top half slid +dx and the bottom
    // half -dx. A feature crossing the seam breaks apart out of focus and lines
    // up (matching the surroundings) at focus.
    if (sharp) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cxm - SPLIT_R, cym);
      ctx.lineTo(cxm + SPLIT_R, cym);
      ctx.arc(cxm, cym, SPLIT_R, 0, Math.PI, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(sharp, dx, 0);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cxm - SPLIT_R, cym);
      ctx.lineTo(cxm + SPLIT_R, cym);
      ctx.arc(cxm, cym, SPLIT_R, 0, Math.PI, false);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(sharp, -dx, 0);
      ctx.restore();
    }

    // spot outline + the prism seam
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
