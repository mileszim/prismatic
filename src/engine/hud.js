// The viewfinder overlay drawn on top of the photographed image: the rounded
// bright-line frame, AF-area brackets, the central ground-glass focusing screen
// with microprism collar + split-image prism, the exposure readouts, and the
// focus-distance ladder with its depth-of-field bracket.

import { INK } from './config.js';
import { ISOS, NEARF, FARF, focusLabel } from '../constants.js';
import { makeProjector, toScreen } from './projection.js';
import { fieldRect, roundRectPath } from './layout.js';

const SPLIT_R = 22; // radius of the split-image spot
const SPLIT_GAIN = 30; // px disparity per unit of normalised defocus
const SPLIT_MAX = 12; // max half-shift (px)

export function createHud(W, H, objects) {
  const FIELD = fieldRect(W, H);
  const LX0 = W * 0.28, LX1 = W * 0.72;

  const ladderX = (d) => {
    const t = Math.log(Math.max(d, NEARF) / NEARF) / Math.log(FARF / NEARF);
    return LX0 + Math.min(1, Math.max(0, t)) * (LX1 - LX0);
  };

  // Horizontal disparity (px) of the split-image halves: the subject under the
  // spot is found, and the shift is proportional to how far the focal plane is
  // from it — zero (aligned) at correct focus, opposite signs front/back focus.
  function splitShift(state) {
    const proj = makeProjector(state.yaw, state.pitch, state.camX, state.camZ);
    let subjDepth = null, bestD2 = 230 * 230;
    for (const o of objects) {
      const cam = proj([o.x, 3, o.z]);
      if (cam.z <= 0.4) continue;
      const s = toScreen(cam, W, H);
      const d2 = (s.x - W / 2) ** 2 + (s.y - H / 2) ** 2;
      if (d2 < bestD2) { bestD2 = d2; subjDepth = cam.z; }
    }
    if (subjDepth == null) return 0;
    const norm = (state.focus - subjDepth) / Math.max(subjDepth, state.focus, 1);
    return Math.max(-SPLIT_MAX, Math.min(SPLIT_MAX, norm * SPLIT_GAIN));
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

    // central focusing screen
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cxm, cym, 64, 0, Math.PI * 2); ctx.stroke(); // ground glass
    ctx.save();
    ctx.setLineDash([2, 4]);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cxm, cym, 32, 0, Math.PI * 2); ctx.stroke(); // microprism collar
    ctx.restore();

    // split-image prism: show the sharp scene inside the spot, with the top
    // half slid +dx and the bottom half -dx. A feature crossing the seam breaks
    // apart out of focus and lines up (matching the surroundings) at focus.
    const dx = splitShift(state);
    if (sharp) {
      // top half
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(cxm - SPLIT_R, cym);
      ctx.lineTo(cxm + SPLIT_R, cym);
      ctx.arc(cxm, cym, SPLIT_R, 0, Math.PI, true);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(sharp, dx, 0);
      ctx.restore();
      // bottom half
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

    // spot outline + the prism seam across the middle
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cxm, cym, SPLIT_R, 0, Math.PI * 2); ctx.stroke();
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
