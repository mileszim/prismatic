// Input: pointer (drag to look, click to focus) and keyboard (W/S move forward
// & back, A/D turn the camera left & right). Movement and turning are applied
// per-frame via update(dt) from the render loop.
//
// Yaw is split into a keyboard-driven `heading` plus a small mouse `lookYaw`
// offset, so turning with the keys and glancing with the mouse don't fight.

import { FOCAL, EYE_H } from './config.js';
import { NEARF, FARF } from '../constants.js';
import { makeProjector, toScreen } from './projection.js';

const MOVE_SPEED = 16; // metres per second
const ROT_SPEED = 1.4; // radians per second (~80°/s)
const LOOK_YAW = 0.2; // mouse glance range (rad)
const LOOK_PITCH = 0.05;
const CAM_X_LIMIT = 42;
const CAM_Z_MIN = -8;
const CAM_Z_MAX = 100;

// e.code -> intent. Layout-independent (KeyW etc.) plus the arrows.
const MOVE_KEYS = {
  KeyW: 'f', ArrowUp: 'f',
  KeyS: 'b', ArrowDown: 'b',
  KeyA: 'rotL', ArrowLeft: 'rotL',
  KeyD: 'rotR', ArrowRight: 'rotR',
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createInput(canvas, { state, W, H, objects, markDirty, onFocus, onShutter }) {
  let down = null;
  const held = new Set();

  let heading = 0; // keyboard-driven yaw
  let lookYaw = 0; // mouse glance offset
  let lookPitch = 0;

  function applyView() {
    state.yaw = heading + lookYaw;
    state.pitch = lookPitch;
  }

  // ---- look + tap-to-focus (pointer) ----------------------------------
  function onPointerDown(e) {
    down = { x: e.clientX, y: e.clientY, moved: false };
    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    const r = canvas.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
    lookYaw = nx * LOOK_YAW;
    lookPitch = -ny * LOOK_PITCH;
    applyView();
    markDirty();
    if (down && Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 5) down.moved = true;
  }

  function onPointerUp(e) {
    if (down && !down.moved) tapFocus(e);
    down = null;
  }

  function tapFocus(e) {
    const r = canvas.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width * W;
    const py = (e.clientY - r.top) / r.height * H;

    const proj = makeProjector(state.yaw, state.pitch, state.camX, state.camZ);
    let best = null, bestD2 = 46 * 46;
    for (const o of objects) {
      const cam = proj([o.x, 2, o.z]);
      if (cam.z <= 0.4) continue;
      const s = toScreen(cam, W, H);
      const d2 = (s.x - px) ** 2 + (s.y - py) ** 2;
      if (d2 < bestD2) { bestD2 = d2; best = cam.z; }
    }

    let dist;
    if (best != null) dist = best;
    else if (py > H / 2 + 2) dist = EYE_H * FOCAL / (py - H / 2); // ground under cursor
    else dist = FARF; // sky -> infinity

    dist = Math.max(NEARF, Math.min(FARF, dist));
    state.focus = dist;
    markDirty();
    if (onFocus) onFocus(dist);
  }

  // ---- move + turn (keyboard) -----------------------------------------
  function onKeyDown(e) {
    // Spacebar = shutter release (unless a control has focus, so it doesn't
    // double-fire with a focused button or scrub a slider).
    if (e.code === 'Space') {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA') return;
      e.preventDefault();
      onShutter?.();
      return;
    }

    const intent = MOVE_KEYS[e.code];
    if (!intent) return;
    const inInput = e.target && e.target.tagName === 'INPUT';
    // let a focused slider keep using the arrow keys
    if (inInput && e.code.startsWith('Arrow')) return;
    held.add(intent);
    if (!inInput) e.preventDefault(); // stop arrows from scrolling the page
  }

  function onKeyUp(e) {
    const intent = MOVE_KEYS[e.code];
    if (intent) held.delete(intent);
  }

  function clearKeys() { held.clear(); } // avoid stuck keys on window blur

  function update(dt) {
    if (!dt || held.size === 0) return;
    let moved = false;

    // turn (yaw>0 looks right, so D increases heading, A decreases it)
    if (held.has('rotL')) { heading -= ROT_SPEED * dt; moved = true; }
    if (held.has('rotR')) { heading += ROT_SPEED * dt; moved = true; }
    if (moved) applyView(); // refresh state.yaw before translation uses it

    // forward / back along the current heading
    const mz = (held.has('f') ? 1 : 0) - (held.has('b') ? 1 : 0);
    if (mz) {
      const step = MOVE_SPEED * dt * mz;
      state.camX = clamp(state.camX + Math.sin(state.yaw) * step, -CAM_X_LIMIT, CAM_X_LIMIT);
      state.camZ = clamp(state.camZ + Math.cos(state.yaw) * step, CAM_Z_MIN, CAM_Z_MAX);
      moved = true;
    }

    if (moved) markDirty();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearKeys);

  return {
    update,
    detach() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearKeys);
    },
  };
}
