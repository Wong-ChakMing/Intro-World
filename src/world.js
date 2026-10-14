import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { blockCanvases, plantCanvas, rng, toTexture } from './pixels.js';

const ISLAND_RADIUS = 15;
const PLAZA_RADIUS = 7.5;

function smoothNoise(seed) {
  const r = rng(seed);
  const waves = Array.from({ length: 4 }, () => ({
    fx: 0.15 + r() * 0.25,
    fz: 0.15 + r() * 0.25,
    p: r() * Math.PI * 2,
    a: 0.4 + r() * 0.6,
  }));
  return (x, z) => waves.reduce((s, w) => s + Math.sin(x * w.fx + w.p) * Math.cos(z * w.fz - w.p) * w.a, 0) / 2;
}

function heightMap() {
  const n = smoothNoise(7);
  const edge = smoothNoise(9);
  const cells = [];
  for (let x = -24; x <= 24; x++) {
    for (let z = -24; z <= 24; z++) {
      const d = Math.hypot(x, z * 1.05);
      const ang = Math.atan2(z, x);
      const shore = ISLAND_RADIUS + Math.sin(ang * 3 + 1) * 1.5 + edge(x, z) * 1.2;
      let type;
      let h;
      if (d < PLAZA_RADIUS) {
        type = 'grass';
        h = 0;
      } else if (d < shore - 1.6) {
        type = 'grass';
        const hill = Math.max(0, n(x, z) + 0.35) * 2.6 * Math.min(1, (d - PLAZA_RADIUS) / 3);
        // keep the view from the camera (+z) low so the plaza stays visible
        const front = z > 4 ? 0.35 : 1;
        h = Math.round(hill * front);
      } else if (d < shore) {
        type = 'sand';
        h = 0;
      } else if (d < shore + 7) {
        type = d < shore + 2.5 ? 'sand' : 'gravel';
        h = -2;
      } else continue;
      cells.push({ x, z, h, type, d });
    }
  }
  return cells;
}

function instanced(geometry, material, matrices, { cast = true, receive = true } = {}) {
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, matrices.length));
  matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
  mesh.count = matrices.length;
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function buildWorld(scene) {
  const c = blockCanvases();
  const tex = Object.fromEntries(Object.entries(c).map(([k, v]) => [k, toTexture(v)]));
  const lambert = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, ...extra });

  const mats = {
    grass: [lambert(tex.grassSide), lambert(tex.grassSide), lambert(tex.grassTop), lambert(tex.dirt), lambert(tex.grassSide), lambert(tex.grassSide)],
    dirt: lambert(tex.dirt),
    stone: lambert(tex.stone),
    sand: lambert(tex.sand),
    gravel: lambert(tex.gravel),
    log: [lambert(tex.logSide), lambert(tex.logSide), lambert(tex.logTop), lambert(tex.logTop), lambert(tex.logSide), lambert(tex.logSide)],
    leaves: lambert(tex.leaves, { alphaTest: 0.5, side: THREE.DoubleSide }),
    planks: lambert(tex.planks),
  };

  const box = new THREE.BoxGeometry(1, 1, 1);
  const buckets = { grass: [], dirt: [], stone: [], sand: [], gravel: [], log: [], leaves: [], planks: [] };
  const m4 = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  const occupied = new Set();
  const key = (x, y, z) => `${x},${y},${z}`;
  const put = (type, x, y, z) => {
    const k = key(x, y, z);
    if (occupied.has(k)) return;
    occupied.add(k);
    buckets[type].push(m4(x, y - 0.5, z));
  };

  const isSpawn = (x, z) => Math.abs(x) <= 1 && z >= 0 && z <= 2;
  const cells = heightMap();
  const heightAt = new Map(cells.map((cell) => [`${cell.x},${cell.z}`, cell.h]));
  for (const cell of cells) {
    put(isSpawn(cell.x, cell.z) ? 'planks' : cell.type, cell.x, cell.h, cell.z);
    for (let y = cell.h - 1; y >= -3; y--) {
      const below = y < -1 ? 'stone' : cell.type === 'grass' ? 'dirt' : cell.type;
      put(below, cell.x, y, cell.z);
    }
  }

  // Trees: placed around the plaza, kept clear of the camera's line of sight.
  const r = rng(42);
  const treeSpots = [
    [-10, -6], [-7, -10], [-2, -11], [4, -10], [9, -8], [11, -3], [-12, -1], [12, 3], [-11, 5], [7, -12],
  ];
  for (const [tx, tz] of treeSpots) {
    const ground = heightAt.get(`${tx},${tz}`) ?? 0;
    const trunk = 4 + Math.floor(r() * 2);
    for (let i = 1; i <= trunk; i++) put('log', tx, ground + i, tz);
    const top = ground + trunk;
    for (let level = top - 1; level <= top + 2; level++) {
      const rad = level > top ? 1 : 2;
      for (let dx = -rad; dx <= rad; dx++) {
        for (let dz = -rad; dz <= rad; dz++) {
          const corner = Math.abs(dx) === rad && Math.abs(dz) === rad;
          if (corner && (level === top + 2 || r() < 0.55)) continue;
          if (dx === 0 && dz === 0 && level <= top) continue;
          put('leaves', tx + dx, level, tz + dz);
        }
      }
    }
  }

  const group = new THREE.Group();
  for (const [type, list] of Object.entries(buckets)) {
    if (!list.length) continue;
    group.add(instanced(box, mats[type], list, { cast: type !== 'gravel' }));
  }

  // Plants: crossed quads, like Minecraft's flowers and short grass.
  const plantGeo = (() => {
    const a = new THREE.PlaneGeometry(0.9, 0.9).rotateY(Math.PI / 4);
    const b = new THREE.PlaneGeometry(0.9, 0.9).rotateY(-Math.PI / 4);
    const g = mergeGeometries([a, b]);
    // Upward normals light both faces evenly, the way Minecraft shades foliage.
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    return g;
  })();

  const plants = { grass: [], poppy: [], dandelion: [] };
  const pr = rng(77);
  for (const cell of cells) {
    if (cell.type !== 'grass' || cell.d < 5.8 || isSpawn(cell.x, cell.z)) continue;
    if (occupied.has(key(cell.x, cell.h + 1, cell.z))) continue;
    const v = pr();
    const type = v < 0.16 ? 'grass' : v < 0.2 ? 'poppy' : v < 0.235 ? 'dandelion' : null;
    if (!type) continue;
    plants[type].push(m4(cell.x, cell.h + 0.45, cell.z));
  }
  for (const [type, list] of Object.entries(plants)) {
    const mat = new THREE.MeshLambertMaterial({ map: toTexture(plantCanvas(type)), alphaTest: 0.5, side: THREE.DoubleSide });
    group.add(instanced(plantGeo, mat, list, { cast: false, receive: false }));
  }

  // Water: one flat sheet, slightly below the block tops, like Minecraft's 14/16 water.
  const waterTex = tex.water;
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(160, 160);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshLambertMaterial({ map: waterTex, transparent: true, opacity: 0.82, depthWrite: false }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.18;
  water.receiveShadow = true;
  group.add(water);

  // Clouds: flat, blocky, drifting slowly in one direction.
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.86 });
  const cr = rng(5);
  for (let i = 0; i < 14; i++) {
    const cloud = new THREE.Group();
    const parts = 2 + Math.floor(cr() * 3);
    for (let p = 0; p < parts; p++) {
      const w = 4 + Math.floor(cr() * 6);
      const d = 3 + Math.floor(cr() * 5);
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 1, d), cloudMat);
      m.position.set(Math.floor(cr() * 6) - 3, 0, Math.floor(cr() * 4) - 2);
      cloud.add(m);
    }
    cloud.position.set(cr() * 120 - 60, 17 + Math.floor(cr() * 3), cr() * 80 - 60);
    clouds.add(cloud);
  }
  group.add(clouds);

  scene.add(group);

  return {
    update(dt, t) {
      waterTex.offset.x = (t * 0.02) % 1;
      waterTex.offset.y = Math.sin(t * 0.3) * 0.02;
      for (const cl of clouds.children) {
        cl.position.x += dt * 0.6;
        if (cl.position.x > 70) cl.position.x = -70;
      }
    },
  };
}
