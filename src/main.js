import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/500.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import './style.css';

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';

import { chests, profile } from './content.js';
import { iconURL } from './icons.js';
import { blockCanvases, guiFrames } from './pixels.js';
import { createChest } from './chest.js';
import { createStickman } from './stickman.js';
import { buildWorld } from './world.js';
import { createUI } from './ui.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const coarse = window.matchMedia('(pointer: coarse)').matches;

// Pixel frames for the HTML GUI, drawn once and handed to CSS.
{
  const f = guiFrames();
  const s = document.documentElement.style;
  s.setProperty('--frame-panel', `url(${f.panel})`);
  s.setProperty('--frame-slot', `url(${f.slot})`);
  s.setProperty('--frame-button', `url(${f.button})`);
  s.setProperty('--frame-button-hover', `url(${f.buttonHover})`);
  s.setProperty('--dirt', `url(${f.dirt})`);
  s.setProperty('--stone', `url(${blockCanvases().stone.toDataURL()})`);
  const icon = document.createElement('link');
  icon.rel = 'icon';
  icon.href = iconURL('chest-oak');
  document.head.append(icon);
}

// Where each chest sits. Outer chests turn inward so the guide never walks through one.
const LAYOUT = {
  about: { x: -4, z: -1, yaw: Math.PI / 2 },
  experience: { x: -2, z: -4, yaw: 0 },
  projects: { x: 0, z: -5, yaw: 0 },
  skills: { x: 2, z: -4, yaw: 0 },
  contact: { x: 4, z: -1, yaw: -Math.PI / 2 },
};
const SPAWN = new THREE.Vector3(0, 0, 1);
const HOME_FOCUS = new THREE.Vector3(0, 0.6, -1.6);

let pendingId = null;
let firstClose = true;

const ui = createUI({
  chests,
  profile,
  onRequestChest: (id) => requestChest(id),
  onClosed: (id, { silent }) => {
    stations[id]?.chest.close(reduceMotion.matches);
    guide?.reach(false);
    pendingId = null;
    if (!silent && firstClose) {
      firstClose = false;
      ui.say('Pick another chest whenever you like.');
    }
  },
});

const loading = document.getElementById('loading');
const canvas = document.getElementById('scene');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  renderer = null;
}

const stations = {};
let guide = null;

if (!renderer) {
  document.documentElement.classList.add('no-webgl');
  loading.classList.add('is-done');
  ui.say('Your browser cannot draw the 3D world, but every chest still opens from the hotbar below.');
} else {
  start();
}

function requestChest(id) {
  if (!renderer) {
    ui.openChest(id);
    return;
  }
  if (ui.openId === id) return;
  if (ui.openId) ui.closeChest({ silent: true, restoreFocus: false });
  const station = stations[id];
  const c = chests.find((x) => x.id === id);
  pendingId = id;
  ui.setActive(id);
  ui.say(c.walkLine);
  // Narrow screens already show every chest edge to edge, so the camera holds still there.
  focusOn(window.innerWidth / window.innerHeight < 0.8 ? HOME_FOCUS : station.focus);

  const instant = reduceMotion.matches;
  guide.walkTo(
    station.stand.x,
    station.stand.z,
    () => {
      if (pendingId !== id) return;
      guide.face(station.faceYaw, instant);
      guide.reach(true);
      setTimeout(() => {
        if (pendingId !== id) return;
        station.chest.open(instant);
        setTimeout(() => pendingId === id && ui.openChest(id), instant ? 0 : 280);
      }, instant ? 0 : 200);
    },
    { instant },
  );
}

let focusTarget = HOME_FOCUS.clone();
function focusOn(v) {
  focusTarget = v.clone();
}

function start() {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const sky = new THREE.Color(0x78a7ff);
  scene.background = sky;
  scene.fog = new THREE.Fog(sky, 34, 80);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.5;
  controls.minDistance = 7;
  controls.maxDistance = 34;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.28;
  controls.minAzimuthAngle = -1.1;
  controls.maxAzimuthAngle = 1.1;
  controls.target.copy(HOME_FOCUS);

  const labels = new CSS2DRenderer();
  labels.domElement.className = 'labels';
  document.body.insertBefore(labels.domElement, canvas.nextSibling);

  scene.add(new THREE.HemisphereLight(0xd6e8ff, 0x6a5a3c, 1.7));
  const sun = new THREE.DirectionalLight(0xfff2dc, 2.3);
  sun.position.set(14, 22, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 70 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  const sunDisc = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false }));
  sunDisc.position.set(55, 70, -110);
  sunDisc.lookAt(0, 0, 0);
  scene.add(sunDisc);

  const world = buildWorld(scene);

  // Chests -------------------------------------------------------------------
  const hitboxes = [];
  chests.forEach((c, i) => {
    const L = LAYOUT[c.id];
    const chest = createChest(c.kind, 100 + i * 10);
    chest.group.position.set(L.x, 0, L.z);
    chest.group.rotation.y = L.yaw;
    scene.add(chest.group);

    const front = new THREE.Vector3(Math.sin(L.yaw), 0, Math.cos(L.yaw));
    const stand = new THREE.Vector3(L.x, 0, L.z).addScaledVector(front, 1.05);
    const tag = document.createElement('div');
    tag.className = 'nametag';
    tag.textContent = c.title;
    const label = new CSS2DObject(tag);
    label.position.set(0, 1.45, 0);
    chest.group.add(label);

    chest.hit.userData.id = c.id;
    hitboxes.push(chest.hit);
    stations[c.id] = {
      chest,
      stand,
      tag,
      faceYaw: L.yaw + Math.PI,
      focus: new THREE.Vector3(L.x * 0.45, 0.6, -1.6 + (L.z + 1.6) * 0.35),
    };
  });

  // Guide --------------------------------------------------------------------
  guide = createStickman();
  guide.setGround((x, z) => world.groundY(x, z));
  guide.root.position.copy(SPAWN);
  scene.add(guide.root);

  // Camera framing -------------------------------------------------------------
  // Portrait screens look down more steeply so the two rows of chests separate on screen.
  const LANDSCAPE_DIR = new THREE.Vector3(0, 0.52, 0.85).normalize();
  const PORTRAIT_DIR = new THREE.Vector3(0, 0.86, 0.5).normalize();
  let portrait = null;
  function fitDistance() {
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const needWidth = portrait ? 11.5 : 12.5;
    const byWidth = needWidth / (2 * Math.tan(halfFov) * camera.aspect);
    return THREE.MathUtils.clamp(byWidth, 12.5, 26);
  }
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    camera.aspect = w / h;
    const nowPortrait = camera.aspect < 0.8;
    camera.fov = nowPortrait ? 60 : 45;
    camera.updateProjectionMatrix();
    let dir = camera.position.clone().sub(controls.target).normalize();
    if (nowPortrait !== portrait) dir = (nowPortrait ? PORTRAIT_DIR : LANDSCAPE_DIR).clone();
    portrait = nowPortrait;
    camera.position.copy(controls.target).addScaledVector(dir, fitDistance());
  }
  resize();
  window.addEventListener('resize', resize);

  // Pointer: hover, look, click ----------------------------------------------------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const lookPoint = new THREE.Vector3();
  let hovered = null;
  let down = null;

  function pick(e) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hitChest = raycaster.intersectObjects(hitboxes, false)[0];
    const hitGuide = raycaster.intersectObject(guide.hit, false)[0];
    const hitLand = raycaster.intersectObjects(world.surface, false)[0];
    const nearer = (hit) => hit && (!hitLand || hit.distance < hitLand.distance);
    if (hitGuide && nearer(hitGuide) && (!hitChest || hitGuide.distance < hitChest.distance)) return { type: 'guide', point: hitGuide.point };
    if (hitChest && nearer(hitChest)) return { type: 'chest', id: hitChest.object.userData.id, point: hitChest.point };
    if (hitLand) return { type: 'ground', point: hitLand.point };
    const point = raycaster.ray.intersectPlane(ground, new THREE.Vector3());
    if (point) return { type: 'water', point };
    return null;
  }

  function setHover(id) {
    if (hovered === id) return;
    if (hovered) {
      stations[hovered].chest.outline.visible = false;
      stations[hovered].tag.classList.remove('is-hover');
    }
    hovered = id;
    if (id) {
      stations[id].chest.outline.visible = true;
      stations[id].tag.classList.add('is-hover');
    }
    canvas.classList.toggle('hovering', Boolean(id));
  }

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const hit = pick(e);
    setHover(hit?.type === 'chest' ? hit.id : null);
    canvas.classList.toggle('hovering', hit?.type === 'chest' || hit?.type === 'guide');
    if (hit?.point) {
      lookPoint.copy(hit.point);
      if (hit.type === 'ground') lookPoint.y = Math.max(hit.point.y, 1.2);
      if (hit.type === 'water') lookPoint.y = 1.2;
      guide.lookAt(lookPoint);
    }
  });
  canvas.addEventListener('pointerleave', () => {
    setHover(null);
    guide.lookAt(null);
  });
  canvas.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 600;
    down = null;
    if (moved > 8 || !quick || ui.busy) return;
    const hit = pick(e);
    if (!hit) return;
    if (hit.type === 'chest') requestChest(hit.id);
    else if (hit.type === 'guide') {
      guide.hop();
      ui.say(GUIDE_LINES[guideLine++ % GUIDE_LINES.length]);
    } else if (hit.type === 'ground' || hit.type === 'water') {
      const spot = world.place(hit.point.x, hit.point.z);
      if (!spot) return;
      pendingId = null;
      guide.reach(false);
      guide.walkTo(spot.x, spot.z, null, { instant: reduceMotion.matches });
    }
  });

  const GUIDE_LINES = [
    "I'm only a stick, but Chak Ming built me with Three.js.",
    'Every block and texture here is drawn in code.',
    'The ender chest holds his contact details.',
    coarse ? 'Drag with one finger to look around.' : 'Drag to look around, scroll to zoom.',
  ];
  let guideLine = 0;

  // Loop ---------------------------------------------------------------------------
  const clock = new THREE.Clock();
  let first = true;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    const t = clock.elapsedTime;
    world.update(dt, t);
    guide.update(dt, t);
    for (const s of Object.values(stations)) s.chest.update(dt);

    const prev = controls.target.clone();
    const k = reduceMotion.matches ? 1 : 1 - Math.exp(-2.4 * dt);
    controls.target.lerp(focusTarget, k);
    camera.position.add(controls.target.clone().sub(prev));
    controls.update();

    renderer.render(scene, camera);
    labels.render(scene, camera);

    if (first) {
      first = false;
      intro();
    }
  });

  function intro() {
    loading.classList.add('is-done');
    setTimeout(() => loading.remove(), 400);
    guide.face(0, true);
    guide.wave(1.8);
    ui.say("Hi! Welcome to Chak Ming's world.");
    setTimeout(() => {
      ui.say(coarse ? "Tap a chest and I'll open it for you." : "Click a chest and I'll open it for you. Keys 1 to 5 work too.");
    }, 900);
    const fromHash = location.hash.slice(1);
    if (stations[fromHash]) setTimeout(() => requestChest(fromHash), 1300);
  }
}
