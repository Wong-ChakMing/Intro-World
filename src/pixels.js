import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
export const shade = (c, k) => [clamp(c[0] * k), clamp(c[1] * k), clamp(c[2] * k)];

/** Paints a w×h canvas; fn(x, y) returns [r,g,b] or [r,g,b,a] or null for transparent. */
export function paint(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = fn(x, y);
      const i = (y * w + x) * 4;
      if (!v) continue;
      img.data[i] = v[0];
      img.data[i + 1] = v[1];
      img.data[i + 2] = v[2];
      img.data[i + 3] = v[3] ?? 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function toTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  return t;
}

const noisy = (r, base, lo = 0.88, hi = 1.08) => shade(base, lo + r() * (hi - lo));

export function blockCanvases() {
  const grassTop = (() => {
    const r = rng(11);
    return paint(16, 16, () => {
      const v = r();
      if (v < 0.08) return [74, 128, 40];
      if (v > 0.93) return [126, 186, 70];
      return noisy(r, [99, 160, 54]);
    });
  })();

  const dirtPx = (r) => {
    const v = r();
    if (v < 0.1) return [102, 72, 48];
    if (v > 0.92) return [160, 120, 86];
    return noisy(r, [134, 96, 67]);
  };

  const dirt = (() => {
    const r = rng(12);
    return paint(16, 16, () => dirtPx(r));
  })();

  const grassSide = (() => {
    const r = rng(13);
    const drip = Array.from({ length: 16 }, () => 2 + Math.floor(r() * 3) + (r() < 0.2 ? 1 : 0));
    return paint(16, 16, (x, y) => {
      if (y < drip[x]) return noisy(r, [94, 152, 50]);
      return dirtPx(r);
    });
  })();

  const stone = (() => {
    const r = rng(14);
    return paint(16, 16, () => {
      const v = r();
      if (v < 0.12) return [104, 104, 104];
      if (v > 0.9) return [146, 146, 146];
      return noisy(r, [125, 125, 125], 0.95, 1.04);
    });
  })();

  const sand = (() => {
    const r = rng(15);
    return paint(16, 16, () => noisy(r, [219, 207, 163], 0.93, 1.03));
  })();

  const gravel = (() => {
    const r = rng(16);
    return paint(16, 16, () => {
      const v = r();
      if (v < 0.25) return [96, 90, 88];
      if (v > 0.8) return [160, 154, 150];
      return noisy(r, [128, 122, 119]);
    });
  })();

  const logSide = (() => {
    const r = rng(17);
    const col = Array.from({ length: 16 }, () => 0.82 + r() * 0.22);
    return paint(16, 16, (x) => {
      const k = col[x] * (0.94 + r() * 0.1);
      return shade([106, 82, 50], k);
    });
  })();

  const logTop = (() => {
    const r = rng(18);
    return paint(16, 16, (x, y) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (d > 6.5) return noisy(r, [106, 82, 50]);
      const ring = Math.floor(d) % 2 === 0;
      return noisy(r, ring ? [176, 141, 88] : [152, 118, 70], 0.95, 1.04);
    });
  })();

  const leaves = (() => {
    const r = rng(19);
    return paint(16, 16, () => {
      const v = r();
      if (v < 0.16) return null;
      if (v < 0.3) return [44, 98, 26];
      if (v > 0.9) return [96, 170, 56];
      return noisy(r, [64, 132, 38]);
    });
  })();

  const planks = (() => {
    const r = rng(20);
    const offs = [3, 11, 6, 13];
    return paint(16, 16, (x, y) => {
      const row = Math.floor(y / 4);
      if (y % 4 === 3) return [104, 80, 46];
      if (x === offs[row]) return [118, 90, 52];
      return noisy(r, [162, 130, 78], 0.92, 1.05);
    });
  })();

  const water = (() => {
    const r = rng(21);
    return paint(16, 16, () => noisy(r, [58, 110, 220], 0.92, 1.08));
  })();

  return { grassTop, grassSide, dirt, stone, sand, gravel, logSide, logTop, leaves, planks, water };
}

export function plantCanvas(type) {
  const r = rng(type === 'poppy' ? 31 : type === 'dandelion' ? 32 : 33);
  return paint(16, 16, (x, y) => {
    if (type === 'grass') {
      const blades = [2, 4, 5, 7, 9, 10, 12, 14];
      const top = [6, 3, 8, 2, 5, 9, 4, 7];
      const i = blades.indexOf(x);
      if (i === -1 || y < top[i]) return null;
      return noisy(r, [92, 150, 50]);
    }
    const stem = x === 7 && y >= 7;
    const leaf = (y === 11 && (x === 6 || x === 5)) || (y === 12 && x === 8);
    if (stem || leaf) return [52, 110, 30];
    if (type === 'poppy') {
      const head = y >= 3 && y <= 6 && x >= 6 && x <= 9;
      if (head) return x === 7 && y === 4 ? [60, 30, 20] : noisy(r, [214, 40, 30]);
    } else {
      const head = y >= 4 && y <= 6 && x >= 6 && x <= 8;
      if (head) return noisy(r, [250, 216, 50]);
    }
    return null;
  });
}

export const CHEST_KINDS = {
  oak: { fill: [160, 112, 58], light: [190, 140, 80], border: [58, 38, 18], latch: [205, 205, 205], latchEdge: [80, 80, 80], grain: true },
  copper: { fill: [196, 106, 66], light: [228, 140, 100], border: [104, 48, 28], latch: [240, 170, 120], latchEdge: [104, 48, 28], patina: [80, 168, 138], metal: true },
  gold: { fill: [244, 200, 64], light: [255, 238, 140], border: [168, 112, 16], latch: [255, 250, 210], latchEdge: [140, 90, 10], metal: true },
  diamond: { fill: [92, 214, 222], light: [196, 250, 250], border: [22, 112, 122], latch: [240, 255, 255], latchEdge: [22, 112, 122], metal: true },
  ender: { fill: [18, 44, 46], light: [36, 84, 82], border: [5, 12, 13], latch: [70, 226, 160], latchEdge: [10, 60, 40], speck: true },
};

/** Bordered face texture at true chest pixel size (w×h). */
export function chestFaceCanvas(kind, w, h, seed, interior = false) {
  const k = CHEST_KINDS[kind];
  const r = rng(seed);
  return paint(w, h, (x, y) => {
    if (interior) {
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return k.border;
      return noisy(r, shade(k.fill, 0.32));
    }
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) return k.border;
    if (k.metal && (x === 1 || y === 1)) return k.light;
    if (k.metal && (x === w - 2 || y === h - 2)) return shade(k.fill, 0.78);
    if (k.patina && r() < 0.06) return k.patina;
    if (k.speck) {
      const v = r();
      if (v < 0.08) return k.light;
      if (v < 0.12) return [60, 150, 130];
    }
    if (k.grain) {
      const streak = (y * 7 + Math.floor(x / 5)) % 9 === 0;
      if (streak) return shade(k.fill, 0.82);
    }
    return noisy(r, k.fill, 0.92, 1.06);
  });
}

/** 9-slice frames for the HTML GUI, drawn at 1px = 1 Minecraft GUI pixel. */
export function guiFrames() {
  const BLACK = [0, 0, 0];
  const LIGHT = [255, 255, 255];
  const DARK = [85, 85, 85];
  const FILL = [198, 198, 198];
  const panel = paint(16, 16, (x, y) => {
    const e = 15;
    const corners = [x + y, e - x + y, x + e - y, e - x + e - y];
    if (corners.some((s) => s < 2)) return null;
    if (x === 0 || y === 0 || x === e || y === e) return BLACK;
    if ((x === 1 || x === e - 1) && (y === 1 || y === e - 1)) return BLACK;
    const nearTL = x <= 2 || y <= 2;
    const nearBR = x >= e - 2 || y >= e - 2;
    if (nearTL && nearBR) return FILL;
    if (nearTL) return LIGHT;
    if (nearBR) return DARK;
    return FILL;
  });

  const S = { d: [55, 55, 55], m: [139, 139, 139], w: [255, 255, 255] };
  const slotMap = ['ddm', 'dmw', 'mww'];
  const slot = paint(3, 3, (x, y) => S[slotMap[y][x]]);

  const button = (fill, light, dark, edge) =>
    paint(6, 6, (x, y) => {
      if ((x === 0 || x === 5) && (y === 0 || y === 5)) return null;
      if (x === 0 || y === 0 || x === 5 || y === 5) return edge;
      if (y === 4 || x === 4) return dark;
      if (y === 1 || x === 1) return light;
      return fill;
    });

  return {
    panel: panel.toDataURL(),
    slot: slot.toDataURL(),
    button: button([111, 111, 111], [168, 168, 168], [74, 74, 74], [0, 0, 0]).toDataURL(),
    buttonHover: button([111, 111, 111], [168, 168, 168], [74, 74, 74], [255, 255, 255]).toDataURL(),
    dirt: (() => {
      const r = rng(12);
      return paint(16, 16, () => {
        const v = r();
        const base = v < 0.1 ? [102, 72, 48] : v > 0.92 ? [160, 120, 86] : shade([134, 96, 67], 0.88 + r() * 0.2);
        return shade(base, 0.32);
      }).toDataURL();
    })(),
  };
}
