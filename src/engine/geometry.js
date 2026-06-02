// Builds the static wireframe landscape as a list of 3D line segments plus a
// list of placed objects (used for tap-to-focus and the split-image subject).
//
// Segment: { a:[x,y,z], b:[x,y,z], w:lineWidth }
// Object:  { x, z }  (ground position)

export function buildScene() {
  const segs = [];
  const objects = [];

  const seg = (ax, ay, az, bx, by, bz, w) =>
    segs.push({ a: [ax, ay, az], b: [bx, by, bz], w: w || 1 });

  function box(cx, cz, w, h, d) {
    const x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y0 = 0, y1 = h;
    seg(x0, y0, z0, x1, y0, z0); seg(x1, y0, z0, x1, y0, z1);
    seg(x1, y0, z1, x0, y0, z1); seg(x0, y0, z1, x0, y0, z0);
    seg(x0, y1, z0, x1, y1, z0); seg(x1, y1, z0, x1, y1, z1);
    seg(x1, y1, z1, x0, y1, z1); seg(x0, y1, z1, x0, y1, z0);
    seg(x0, y0, z0, x0, y1, z0); seg(x1, y0, z0, x1, y1, z0);
    seg(x1, y0, z1, x1, y1, z1); seg(x0, y0, z1, x0, y1, z1);
    objects.push({ x: cx, z: cz });
  }

  function pyramid(cx, cz, base, h) {
    const b = base / 2, x0 = cx - b, x1 = cx + b, z0 = cz - b, z1 = cz + b;
    seg(x0, 0, z0, x1, 0, z0); seg(x1, 0, z0, x1, 0, z1);
    seg(x1, 0, z1, x0, 0, z1); seg(x0, 0, z1, x0, 0, z0);
    seg(x0, 0, z0, cx, h, cz); seg(x1, 0, z0, cx, h, cz);
    seg(x1, 0, z1, cx, h, cz); seg(x0, 0, z1, cx, h, cz);
    objects.push({ x: cx, z: cz });
  }

  // ground grid — longitudinal lines split per z-step so a single line can be
  // sharp where it crosses the focal plane and soft elsewhere
  const zs = [3, 4.5, 6.5, 9, 12.5, 17, 23, 31, 42, 56, 75, 100, 125];
  const xMax = 44, step = 8;
  for (let x = -xMax; x <= xMax; x += step) {
    for (let k = 0; k < zs.length - 1; k++) seg(x, 0, zs[k], x, 0, zs[k + 1], 0.9);
  }
  for (const z of zs) seg(-xMax, 0, z, xMax, 0, z, 0.9);

  // jagged mountain horizon (two ridges)
  const frac = (i) => { const s = Math.sin(i * 12.9898) * 43758.5453; return s - Math.floor(s); };
  function ridge(z, baseAmp, w, sd) {
    const span = 130, n = 46;
    let px = -span, py = 1 + frac(sd) * baseAmp;
    for (let i = 1; i <= n; i++) {
      const x = -span + span * 2 * (i / n);
      const y = 1 + (0.35 + 0.65 * frac(i * 1.3 + sd)) * baseAmp;
      seg(px, py, z, x, y, z, w);
      px = x; py = y;
    }
  }
  ridge(125, 30, 1.1, 7.7);
  ridge(112, 18, 0.9, 3.1);

  // scattered obstacles across a range of depths
  pyramid(-3, 11, 4, 5);
  box(8, 9, 3, 3.5, 3);
  box(-16, 16, 5, 6, 5);
  pyramid(13, 22, 9, 11);
  box(-26, 30, 2.2, 16, 2.2); // obelisk
  box(23, 40, 6, 9, 6);
  pyramid(-9, 53, 13, 16);
  box(5, 71, 9, 5.5, 9);

  return { segs, objects };
}
