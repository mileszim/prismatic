// Shared viewfinder layout helpers.

// The rounded "through-the-eyepiece" field, inset from the canvas edge.
export function fieldRect(W, H) {
  return { x: 26, y: 26, w: W - 52, h: H - 52, r: 40 };
}

// Trace a rounded-rectangle path (used for both the frame stroke and the clip).
export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
