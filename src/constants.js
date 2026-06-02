// Shared optics constants + focus-slider mapping, used by both the React UI
// (labels, slider <-> distance conversion) and the rendering engine.

export const STOPS = [1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22];
export const ISOS = [100, 200, 400, 800, 1600, 3200, 6400];
export const SHUTTERS = [1000, 500, 250, 125, 60, 30, 15, 8, 4]; // 1/x second

export const NEARF = 1.5; // nearest focusable distance (m)
export const FARF = 130; // "infinity"

export function shutterLabel(idx) {
  return '1/' + SHUTTERS[idx];
}

export function shutterSeconds(idx) {
  return 1 / SHUTTERS[idx];
}

// Exposure deviation in stops from the neutral default (ƒ/2.8, 1/125, ISO 400).
// Positive = brighter (over-exposed), negative = darker (under-exposed). Lets the
// three controls behave like a real exposure triangle: stop down or pick a faster
// shutter and the frame darkens unless ISO opens it back up.
const REF_F = 2.8, REF_SEC = 1 / 125, REF_ISO = 400;
export function exposureStops(fnum, shutterIdx, isoIdx) {
  return (
    Math.log2((REF_F * REF_F) / (fnum * fnum)) +
    Math.log2(shutterSeconds(shutterIdx) / REF_SEC) +
    Math.log2(ISOS[isoIdx] / REF_ISO)
  );
}

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
