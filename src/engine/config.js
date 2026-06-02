// Engine render constants — internal to the canvas renderer.
// (UI-facing optics like STOPS/ISOS and the focus mapping live in ../constants.js)

export const INK = '#14110c';
export const PAPER = '#f4f0e5';

export const FOCAL = 680; // projection focal length (px) — sets the field of view
export const EYE_H = 2.4; // camera height above the ground plane (m)

export const BANDS = 12; // depth slices used for the depth-of-field blur
export const DOF_K = 34; // overall defocus strength
export const MAX_BLUR = 9; // px cap on the circle of confusion

// ISO index -> film-grain density + pixel block size (aligned with ISOS in constants.js)
export const GRAIN = {
  amt: [0.035, 0.06, 0.09, 0.13, 0.19, 0.27, 0.36],
  block: [1, 1, 1, 2, 2, 3, 4],
};
