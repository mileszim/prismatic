// Shared optics constants + focus-slider mapping, used by both the React UI
// (labels, slider <-> distance conversion) and the rendering engine.

export const STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
export const ISOS = [100, 200, 400, 800, 1600, 3200, 6400];

export const NEARF = 1.5; // nearest focusable distance (m)
export const FARF = 130; // "infinity"

// Focus slider runs 0..1000 mapped logarithmically onto NEARF..FARF.
export function focusFromSlider(v) {
  return NEARF * Math.pow(FARF / NEARF, v / 1000);
}

export function sliderFromFocus(d) {
  const t = Math.log(Math.max(NEARF, Math.min(FARF, d)) / NEARF) / Math.log(FARF / NEARF);
  return Math.round(t * 1000);
}

export function focusLabel(focus) {
  return focus >= FARF * 0.97 ? '∞' : Math.round(focus) + ' M';
}
