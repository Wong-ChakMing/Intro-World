import { CHEST_KINDS, paint, shade } from './pixels.js';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

function fromMap(rows, pal) {
  const p = Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, Array.isArray(v) ? v : hex(v)]));
  return paint(16, 16, (x, y) => p[rows[y]?.[x]] ?? null);
}

function fromFn(fn) {
  return paint(16, 16, (x, y) => {
    const v = fn(x + 0.5, y + 0.5, x, y);
    return v ? (Array.isArray(v) ? v : hex(v)) : null;
  });
}

const book = (cover) =>
  fromMap(
    [
      '................',
      '................',
      '...kkkkkkkkkk...',
      '..kCCCCCCCCCck..',
      '..kCLLCCCCCCck..',
      '..kCLCCCCCCCck..',
      '..kCCCggggCCck..',
      '..kCCCgCCgCCck..',
      '..kCCCggggCCck..',
      '..kCCCCCCCCCck..',
      '..kCCCCCCCCCck..',
      '..kCCCCCCCCCck..',
      '..kccccccccccpk.',
      '...kppppppppppk.',
      '....kkkkkkkkkkk.',
      '................',
    ],
    { k: '#2a1a0c', C: cover, c: shade(hex(cover), 0.7), L: shade(hex(cover), 1.35), g: '#e8c25a', p: '#efe7d2' },
  );

const chestIcon = (kind) => {
  const k = CHEST_KINDS[kind];
  return fromMap(
    [
      '................',
      '................',
      '.kkkkkkkkkkkkkk.',
      '.kLLLLLLLLLLLLk.',
      '.kMMMMMMMMMMMMk.',
      '.kMMMMMMMMMMMMk.',
      '.kDDDDDaaDDDDDk.',
      '.kkkkkkaakkkkkk.',
      '.kMMMMMeeMMMMMk.',
      '.kMMMMMMMMMMMMk.',
      '.kMMMMMMMMMMMMk.',
      '.kMMMMMMMMMMMMk.',
      '.kMMMMMMMMMMMMk.',
      '.kDDDDDDDDDDDDk.',
      '.kkkkkkkkkkkkkk.',
      '................',
    ],
    { k: k.border, L: k.light, M: k.fill, D: shade(k.fill, 0.75), a: k.latch, e: k.latchEdge },
  );
};

const disc = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

const DRAW = {
  diamond: () =>
    fromMap(
      [
        '................',
        '................',
        '....kkkkkkkk....',
        '...kwwlllllmk...',
        '..kwlllllllmmk..',
        '.kwllllllllmmmk.',
        '.kllllllllmmmmk.',
        '..kllllllmmmmk..',
        '...kllllmmmmk...',
        '....kllmmmmk....',
        '.....klmmmk.....',
        '......kmmk......',
        '.......kk.......',
        '................',
        '................',
        '................',
      ],
      { k: '#0b3d3a', w: '#ffffff', l: '#4aedd9', m: '#20c5b5' },
    ),
  emerald: () =>
    fromMap(
      [
        '................',
        '.......kk.......',
        '......kwlk......',
        '.....kwllmk.....',
        '....kwlllmmk....',
        '....kwllmmmk....',
        '....kllllmmk....',
        '....kllllmmk....',
        '....kllllmmk....',
        '....kllmmmmk....',
        '....klmmmmdk....',
        '.....kmmmdk.....',
        '......kmdk......',
        '.......kk.......',
        '................',
        '................',
      ],
      { k: '#00451a', w: '#c8ffd8', l: '#41f384', m: '#17c544', d: '#009a2a' },
    ),
  gold: () =>
    fromMap(
      [
        '................',
        '................',
        '................',
        '................',
        '......kkkkkkkk..',
        '.....kwwwwwwwyk.',
        '....kwyyyyyyyok.',
        '...kwyyyyyyyook.',
        '..kkkkkkkkkkoook',
        '..kwwwwwwwwkook.',
        '..kyyyyyyyykok..',
        '..kooooooookk...',
        '..kkkkkkkkkk....',
        '................',
        '................',
        '................',
      ],
      { k: '#5a3a00', w: '#fffbd0', y: '#fde65f', o: '#dc9613' },
    ),
  pickaxe: () =>
    fromMap(
      [
        '................',
        '.....kkkkkk.....',
        '....kwllllllk...',
        '.....kkkkkllmk..',
        '.........kklmk..',
        '........kbkklmk.',
        '.......kbk.klmk.',
        '......kbk...kmk.',
        '.....kbk....kmk.',
        '....kbk......k..',
        '...kbk..........',
        '..kbk...........',
        '.kbk............',
        '.kk.............',
        '................',
        '................',
      ],
      { k: '#2b2b2b', w: '#ffffff', l: '#d8d8d8', m: '#8a8a8a', b: '#8c6a2c' },
    ),
  redstone: () =>
    fromMap(
      [
        '................',
        '................',
        '......r.........',
        '....rRr...r.....',
        '...rRRRr.rRr....',
        '....rRRrrRRRr...',
        '.....rrRRRRr....',
        '..r...rRRRRrr...',
        '.rRr.rRRRRRRRr..',
        '..rrrRRRrrRRr...',
        '....rRRr..rr....',
        '...rRRRr....r...',
        '....rrr....rRr..',
        '............r...',
        '................',
        '................',
      ],
      { r: '#7a0000', R: '#ff2a1a' },
    ),
  torch: () =>
    fromMap(
      [
        '................',
        '................',
        '......kkkk......',
        '......kwRk......',
        '......kRRk......',
        '......kRrk......',
        '......kkkk......',
        '.......bd.......',
        '.......bd.......',
        '.......bd.......',
        '.......bd.......',
        '.......bd.......',
        '.......bd.......',
        '.......bd.......',
        '.......kk.......',
        '................',
      ],
      { k: '#4a0000', w: '#ffc0b0', R: '#ff2a1a', r: '#b01000', b: '#a2803e', d: '#6b5228' },
    ),
  book: () => book('#8a3b1e'),
  'book-blue': () => book('#2f5aa8'),
  nametag: () =>
    fromMap(
      [
        '................',
        '................',
        '................',
        '.kkk............',
        'kssk............',
        'ks.skkkkkkkkkk..',
        '.kkkppppppppppk.',
        '....kpqqqqqpppk.',
        '....kppppppppppk',
        '....kpqqqqqqqppk',
        '....kppppppppppk',
        '.....kkkkkkkkkk.',
        '................',
        '................',
        '................',
        '................',
      ],
      { k: '#3b2a17', p: '#c7a77a', q: '#8b6d47', s: '#d6d6d6' },
    ),
  paper: () =>
    fromMap(
      [
        '................',
        '................',
        '...kkkkkkkkk....',
        '...kwwwwwwwwk...',
        '...kwqqqqqwwwk..',
        '...kwwwwwwwwwk..',
        '...kwqqqqqqqwk..',
        '...kwwwwwwwwwk..',
        '...kwqqqqqqwwk..',
        '...kwwwwwwwwwk..',
        '...kwqqqqqqqwk..',
        '...kwwwwwwwwwk..',
        '...kwqqqqwwwwk..',
        '...kwwwwwwwwwk..',
        '...kkkkkkkkkkk..',
        '................',
      ],
      { k: '#6b665c', w: '#f4f1e6', q: '#9a958a' },
    ),
  bell: () =>
    fromMap(
      [
        '................',
        '.......kk.......',
        '......kYYk......',
        '.....kkkkkk.....',
        '....kYYYYyyk....',
        '....kYwYYyyk....',
        '....kYwYYyyk....',
        '...kYYwYYyyyk...',
        '...kYYYYYyyyk...',
        '..kYYYYYYyyyyk..',
        '..kkkkkkkkkkkk..',
        '.kyyyyyyyyyyyyk.',
        '..kkkkkkkkkkkk..',
        '.......kk.......',
        '................',
        '................',
      ],
      { k: '#5a4004', Y: '#f7d34a', y: '#c99a1e', w: '#fff6c0' },
    ),
  pumpkin: () =>
    fromMap(
      [
        '................',
        '.......gg.......',
        '......gg........',
        '..kkkkkkkkkkkk..',
        '.kOOoOOOOoOOOOk.',
        '.kOoOOOOOOoOOOk.',
        '.kOkkOOOOOkkOOk.',
        '.kOkkOOOOOkkOOk.',
        '.kOOOOOkkOOOOOk.',
        '.kOOOOOOOOOOOOk.',
        '.kOkOkkkkkkOkOk.',
        '.kOOkkkkkkkkOOk.',
        '.kOOOOOOOOOOOOk.',
        '..kkkkkkkkkkkk..',
        '................',
        '................',
      ],
      { k: '#3a1f05', O: '#e38a1d', o: '#b8650f', g: '#4a6b1f' },
    ),
  campfire: () =>
    fromMap(
      [
        '................',
        '.......y........',
        '......yYy.......',
        '.....yYOYy......',
        '....yYOOOYy.....',
        '....yOOrOOy.....',
        '...yOOrrrOOy....',
        '...yOrrrrrOy....',
        '....yrrWrry.....',
        '..bbbbbbbbbbbb..',
        '..bdbbdbbdbbdb..',
        '..bbbbbbbbbbbb..',
        '...ddd....ddd...',
        '................',
        '................',
        '................',
      ],
      { y: '#ffd64a', Y: '#fff3a0', O: '#ff9a1f', r: '#e2541b', W: '#ffffff', b: '#6b4a2a', d: '#3d2a17' },
    ),
  bundle: () =>
    fromMap(
      [
        '................',
        '................',
        '......kkkk......',
        '.....kssssk.....',
        '......kssk......',
        '.....kkkkkk.....',
        '....kbbbbbbk....',
        '...kbBBbbbbbk...',
        '..kbBbbbbbbbbk..',
        '..kbbbbbbbbbbk..',
        '..kbbbbbbbbbdk..',
        '..kbbbbbbbbddk..',
        '...kbbbbbbddk...',
        '....kkkkkkkk....',
        '................',
        '................',
      ],
      { k: '#3b2512', b: '#a8743f', B: '#c9935a', d: '#7d5229', s: '#d9b98a' },
    ),
  compass: () =>
    fromFn((x, y, ix, iy) => {
      const d = disc(x, y, 8, 8);
      if (d > 6.6) return null;
      if (d > 5.6) return '#2e2e2e';
      if ((ix === 9 && iy === 6) || (ix === 10 && iy === 5) || (ix === 8 && iy === 7)) return '#e3261c';
      if ((ix === 7 && iy === 9) || (ix === 6 && iy === 10)) return '#f2f2f2';
      if (ix === 8 && iy === 8) return '#2e2e2e';
      if (d > 4.6) return '#8f8f8f';
      return y < 7 ? '#d6d6d6' : '#bdbdbd';
    }),
  endereye: () =>
    fromFn((x, y, ix, iy) => {
      const d = disc(x, y, 8, 8);
      if (d > 6.4) return null;
      if (d > 5.5) return '#0e3b2c';
      if (Math.abs(x - 8) < 1.1 && Math.abs(y - 8) < 3.2) return '#0a1f17';
      if (ix === 5 && iy === 5) return '#d8fff0';
      if (d > 4) return '#1f7a5a';
      return '#5fd8a6';
    }),
  map: () =>
    fromFn((x, y, ix, iy) => {
      if (ix < 1 || ix > 14 || iy < 2 || iy > 13) return null;
      if (ix === 1 || ix === 14 || iy === 2 || iy === 13) return '#5a4426';
      const land = Math.sin(ix * 0.9) + Math.cos(iy * 0.8) + Math.sin((ix + iy) * 0.5);
      if (land > 1.1) return '#6aa84f';
      if (land < -0.9) return '#4a7fd6';
      if ((ix + iy * 3) % 11 === 0) return '#b8a27a';
      return '#e6d6a8';
    }),
  spyglass: () =>
    fromFn((x, y, ix, iy) => {
      const along = (ix - (15 - iy)) / 1;
      const t = (ix + (15 - iy)) / 2;
      if (Math.abs(along) > 1.5 || t < 2.5 || t > 13) return null;
      if (t > 11.5) return '#22313a';
      if (t > 10.5) return '#7a3f20';
      if (t > 6 && t < 7.5) return '#7a3f20';
      return along < 0 ? '#e6915e' : '#b45f35';
    }),
};

for (const kind of Object.keys(CHEST_KINDS)) DRAW[`chest-${kind}`] = () => chestIcon(kind);

const cache = new Map();
export function iconURL(name) {
  if (!cache.has(name)) cache.set(name, (DRAW[name] ?? DRAW.paper)().toDataURL());
  return cache.get(name);
}
