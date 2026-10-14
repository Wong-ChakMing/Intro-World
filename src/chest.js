import * as THREE from 'three';
import { CHEST_KINDS, chestFaceCanvas, toTexture } from './pixels.js';

const PX = 1 / 16;
const W = 14 * PX;
const BASE_H = 10 * PX;
const LID_H = 5 * PX;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export function createChest(kind, seed = 1) {
  const k = CHEST_KINDS[kind];
  const mat = (canvas) => new THREE.MeshLambertMaterial({ map: toTexture(canvas) });

  const baseSide = mat(chestFaceCanvas(kind, 14, 10, seed));
  const baseInside = mat(chestFaceCanvas(kind, 14, 14, seed + 1, true));
  const baseBottom = mat(chestFaceCanvas(kind, 14, 14, seed + 2));
  const lidSide = mat(chestFaceCanvas(kind, 14, 5, seed + 3));
  const lidTop = mat(chestFaceCanvas(kind, 14, 14, seed + 4));
  const lidInside = mat(chestFaceCanvas(kind, 14, 14, seed + 5, true));

  const group = new THREE.Group();

  const base = new THREE.Mesh(new THREE.BoxGeometry(W, BASE_H, W), [baseSide, baseSide, baseInside, baseBottom, baseSide, baseSide]);
  base.position.y = BASE_H / 2;
  group.add(base);

  // The lid pivots on the back edge of the base, exactly like the vanilla chest model.
  const hinge = new THREE.Group();
  hinge.position.set(0, BASE_H, -W / 2);
  group.add(hinge);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(W, LID_H, W), [lidSide, lidSide, lidTop, lidInside, lidSide, lidSide]);
  lid.position.set(0, LID_H / 2, W / 2);
  hinge.add(lid);

  const latchMat = new THREE.MeshLambertMaterial({ color: new THREE.Color().setRGB(...k.latch.map((v) => v / 255), THREE.SRGBColorSpace) });
  const latch = new THREE.Mesh(new THREE.BoxGeometry(2 * PX, 4 * PX, PX), latchMat);
  latch.position.set(0, 0, W + PX / 2);
  hinge.add(latch);

  if (kind === 'ender') latchMat.emissive = new THREE.Color(0x0d4a30);

  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  // Invisible, generous hit box so the chest is easy to click or tap.
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.4, 1.3), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 0.6;
  group.add(hit);

  // Minecraft's block selection outline.
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(W + 0.02, BASE_H + LID_H + 0.02, W + 0.02)),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.55 }),
  );
  outline.position.y = (BASE_H + LID_H) / 2;
  outline.visible = false;
  group.add(outline);

  let angle = 0;
  let from = 0;
  let to = 0;
  let t = 1;
  let duration = 0.3;

  return {
    group,
    hit,
    outline,
    get isOpen() {
      return to > 0;
    },
    open(instant = false) {
      from = angle;
      to = 1.45;
      t = instant ? 1 : 0;
      duration = 0.32;
    },
    close(instant = false) {
      from = angle;
      to = 0;
      t = instant ? 1 : 0;
      duration = 0.22;
    },
    update(dt) {
      if (t < 1) t = Math.min(1, t + dt / duration);
      angle = from + (to - from) * easeOut(t);
      hinge.rotation.x = -angle;
    },
  };
}
