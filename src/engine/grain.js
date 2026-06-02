// Sensor/film post effects: ISO grain (with pixelation) and lens vignette.

import { GRAIN } from './config.js';

// Film-grain layer. Higher ISO -> denser speckle AND a larger pixel block,
// so the noise also reads as sensor pixelation at the top of the range.
export function createGrain(W, H) {
  const canvas = document.createElement('canvas');
  let ctx = canvas.getContext('2d');

  function draw(target, isoIdx) {
    const amt = GRAIN.amt[isoIdx];
    const block = GRAIN.block[isoIdx];
    const gw = Math.ceil(W / block), gh = Math.ceil(H / block);
    if (canvas.width !== gw || canvas.height !== gh) {
      canvas.width = gw;
      canvas.height = gh;
      ctx = canvas.getContext('2d');
    }

    const img = ctx.createImageData(gw, gh);
    const data = img.data;
    const lightCut = 1 - amt * 0.35;
    for (let i = 0; i < gw * gh; i++) {
      const k = i * 4, r = Math.random();
      if (r < amt) {
        // dark speck (film grain on paper)
        data[k] = 20; data[k + 1] = 18; data[k + 2] = 14;
        data[k + 3] = 50 + Math.random() * 140;
      } else if (r > lightCut) {
        // bright speck (breaks up the ink)
        data[k] = 250; data[k + 1] = 248; data[k + 2] = 240;
        data[k + 3] = 30 + Math.random() * 90;
      } else {
        data[k + 3] = 0;
      }
    }
    ctx.putImageData(img, 0, 0);

    target.imageSmoothingEnabled = false;
    target.drawImage(canvas, 0, 0, gw, gh, 0, 0, W, H);
    target.imageSmoothingEnabled = true;
  }

  return { draw };
}

export function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
