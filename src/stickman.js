import * as THREE from 'three';
import { paint, toTexture } from './pixels.js';

const LIMB = 0.085;
const INK = 0x1c1c1c;

function faceCanvas(withFace) {
  return paint(16, 16, (x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) return [28, 28, 28];
    if (withFace) {
      const eye = (y === 6 || y === 7) && (x === 4 || x === 5 || x === 10 || x === 11);
      const mouth = (y === 11 && x >= 6 && x <= 9) || (y === 10 && (x === 5 || x === 10));
      if (eye || mouth) return [28, 28, 28];
    }
    return [244, 244, 240];
  });
}

const dampAngle = (a, b, k, dt) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-k * dt));
};
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export function createStickman() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const ink = new THREE.MeshLambertMaterial({ color: INK });

  const limb = (len) => {
    const pivot = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(LIMB, len, LIMB), ink);
    m.position.y = -len / 2;
    m.castShadow = true;
    pivot.add(m);
    return pivot;
  };

  const legL = limb(0.72);
  const legR = limb(0.72);
  legL.position.set(-0.07, 0.72, 0);
  legR.position.set(0.07, 0.72, 0);
  body.add(legL, legR);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(LIMB, 0.62, LIMB), ink);
  torso.position.y = 0.72 + 0.31;
  torso.castShadow = true;
  body.add(torso);

  const armL = limb(0.6);
  const armR = limb(0.6);
  armL.position.set(-0.04, 1.28, 0);
  armR.position.set(0.04, 1.28, 0);
  body.add(armL, armR);

  const neck = new THREE.Group();
  neck.position.y = 1.34;
  body.add(neck);
  const plain = new THREE.MeshLambertMaterial({ map: toTexture(faceCanvas(false)) });
  const face = new THREE.MeshLambertMaterial({ map: toTexture(faceCanvas(true)) });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), [plain, plain, plain, plain, face, plain]);
  head.position.y = 0.22;
  head.castShadow = true;
  neck.add(head);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8, 0.6), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.9;
  root.add(hit);

  const state = {
    mode: 'idle',
    target: new THREE.Vector3(),
    speed: 4.2,
    onArrive: null,
    facing: 0,
    faceTarget: 0,
    phase: 0,
    reach: 0,
    reachTarget: 0,
    wave: 0,
    jump: 0,
    look: null,
    ground: null,
  };

  const api = {
    root,
    hit,
    get busy() {
      return state.mode === 'walk';
    },
    setGround(fn) {
      state.ground = fn;
    },
    walkTo(x, z, onArrive, { instant = false } = {}) {
      state.target.set(x, 0, z);
      state.onArrive = onArrive;
      state.reachTarget = 0;
      if (instant) {
        root.position.x = x;
        root.position.z = z;
        root.position.y = state.ground?.(x, z) ?? 0;
        state.mode = 'idle';
        const cb = state.onArrive;
        state.onArrive = null;
        cb?.();
        return;
      }
      state.mode = 'walk';
    },
    face(yaw, instant = false) {
      state.faceTarget = yaw;
      if (instant) state.facing = yaw;
    },
    reach(on) {
      state.reachTarget = on ? 1 : 0;
    },
    wave(seconds = 1.6) {
      state.wave = seconds;
    },
    hop() {
      if (state.jump <= 0) state.jump = 0.45;
    },
    lookAt(point) {
      state.look = point;
    },
    update(dt, time) {
      const p = root.position;
      if (state.mode === 'walk') {
        const dx = state.target.x - p.x;
        const dz = state.target.z - p.z;
        const dist = Math.hypot(dx, dz);
        const step = state.speed * dt;
        state.faceTarget = Math.atan2(dx, dz);
        if (dist <= step) {
          p.x = state.target.x;
          p.z = state.target.z;
          state.mode = 'idle';
          const cb = state.onArrive;
          state.onArrive = null;
          cb?.();
        } else {
          p.x += (dx / dist) * step;
          p.z += (dz / dist) * step;
        }
      }

      const groundY = state.ground?.(p.x, p.z) ?? 0;
      p.y = damp(p.y, groundY, 10, dt);

      state.facing = dampAngle(state.facing, state.faceTarget, 12, dt);
      root.rotation.y = state.facing;

      const walking = state.mode === 'walk';
      state.phase += dt * (walking ? 11 : 0);
      const swing = walking ? Math.sin(state.phase) : 0;
      legL.rotation.x = damp(legL.rotation.x, swing * 0.75, 18, dt);
      legR.rotation.x = damp(legR.rotation.x, -swing * 0.75, 18, dt);

      state.reach = damp(state.reach, state.reachTarget, 10, dt);
      const breathe = Math.sin(time * 2) * 0.04;
      armL.rotation.x = damp(armL.rotation.x, -swing * 0.65 - state.reach * 1.35, 16, dt);
      armR.rotation.x = damp(armR.rotation.x, swing * 0.65 - state.reach * 1.35, 16, dt);
      armL.rotation.z = damp(armL.rotation.z, -0.28 - breathe, 10, dt);

      if (state.wave > 0) {
        state.wave -= dt;
        armR.rotation.z = damp(armR.rotation.z, 2.5 + Math.sin(time * 14) * 0.35, 14, dt);
      } else {
        armR.rotation.z = damp(armR.rotation.z, 0.28 + breathe, 10, dt);
      }

      let lift = walking ? Math.abs(Math.cos(state.phase)) * 0.05 : 0;
      if (state.jump > 0) {
        state.jump = Math.max(0, state.jump - dt);
        const j = 1 - state.jump / 0.45;
        lift += Math.sin(j * Math.PI) * 0.45;
      }
      body.position.y = lift;

      // The head follows the pointer, within a neck's reach.
      let yaw = 0;
      let pitch = 0;
      if (state.look && !walking) {
        const local = root.worldToLocal(state.look.clone());
        yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
        const d = Math.hypot(local.x, local.z);
        pitch = THREE.MathUtils.clamp(-Math.atan2(local.y - 1.55, d), -0.5, 0.4);
      }
      neck.rotation.y = damp(neck.rotation.y, yaw, 8, dt);
      neck.rotation.x = damp(neck.rotation.x, pitch, 8, dt);
    },
  };
  return api;
}
