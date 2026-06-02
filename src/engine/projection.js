// Camera math: world point -> camera space -> screen pixels.

import { FOCAL, EYE_H } from './config.js';

// Returns a projector closure for the given camera orientation and ground
// position. It maps a world point [x, y, z] into camera space { x, y, z },
// where z is the forward distance (used as the depth for blur and the
// split-image rangefinder).
export function makeProjector(yaw, pitch, camX = 0, camZ = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return (p) => {
    const rx = p[0] - camX, ry = p[1] - EYE_H, rz = p[2] - camZ;
    const x1 = rx * cy - rz * sy;
    const z1 = rx * sy + rz * cy;
    const y2 = ry * cp - z1 * sp;
    const z2 = ry * sp + z1 * cp;
    return { x: x1, y: y2, z: z2 };
  };
}

// Perspective-divide a camera-space point onto the screen.
export function toScreen(cam, W, H) {
  return { x: FOCAL * cam.x / cam.z + W / 2, y: -FOCAL * cam.y / cam.z + H / 2 };
}
