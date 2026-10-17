// Slipway's yard in 3D, drawn with three.js (vendor/three.js, kept on the device, so it plays offline): the yard's six
// squares by five, the dock in front of it (the part in hand, the hold, the next part), and behind it the berth with the
// ship being built, the water beyond. Everything is built in code, no models and no textures: every part is a few
// boxes and cylinders on a pallet in its kind's enamel, with a brass stud for each stage, and every ship is lofted from
// a handful of numbers (length, beam, depth, sheer, how full her ends are) and fitted out with masts, sails, guns,
// funnels, deckhouses and screws, each kind split into as many components as she needs of it. What she still needs is
// drawn faint, a wooden hull's missing sections as bare frames, so she's seen going together. Every colour comes from
// the skin: Almanac, Modern, Office or Kontor (the suite's theme), each by day and by night, the enamels from the theme.
// It draws only while something moves. The page (slipway.js) drives it: set, play, hover, lift, pick, theme.
import * as THREE from "./vendor/three.js";
import { W, H, EMPTY, BLUEPRINT, KINDS, kindOf, stageOf, shipAt, powered } from "./slipway-engine.js";

const EL = 47;                                                // the camera: degrees above the yard
const square = i => new THREE.Vector3((i % W) - W / 2 + .5, 0, Math.floor(i / W) + .5);
const BERTH = -2.05, SHIP_YAW = .42;                          // the ship's middle line behind the yard, and her angle on it
const DOCK_Z = H + .95, SLOTS = { hold: -2.05, hand: 0, next: 2.05 };
const DOUBLE = 2, PCF = 1;                                    // THREE.DoubleSide and THREE.PCFShadowMap (not in the bundle's exports)
const UP = new THREE.Vector3(0, 1, 0), BRACE = .5, MAST = .84;          // yards braced round; masts drawn a little short

// ---------- the skins ----------
// Almanac: a yard of warm stone, timber and brass. Modern: an architect's white model. Office: Fluent's greys. Kontor:
// a drawing office, every part inked. At night the light is the moon's and the yard's lamps are lit.
const SKINS = {
  almanac: {
    day: { tile: 0xe6dbbd, tile2: 0xdfd3b2, apron: 0xc8b88f, grout: 0x8f806a, quay: 0xa59674, water: 0x5f97ab, far: 0x86b2c0,
      wood: 0xa0703f, woodDark: 0x5e3d22, deck: 0xc9a46c, canvas: 0xf3ead6, rope: 0x75624a, iron: 0x41464c, steel: 0x9aa3aa,
      hull: 0x25313b, boot: 0xa1412f, house: 0xf5f0e4, glass: 0x2b3a47, funnel: 0xc98a33, tank: 0x6b8a62, brass: 0xc8892a, paper: 0x2c5b8a,
      sky: 0xfff4e2, ground: 0x7d745f, hemi: 1.15, sun: 0xfff0d6, sunI: 2.5, sunAt: [5, 11, 8], exposure: 1.05 },
    night: { tile: 0x5d5a4c, tile2: 0x58554a, apron: 0x4a4639, grout: 0x2a2822, quay: 0x4e4a3c, water: 0x2b5f78, far: 0x24495c, seaGlow: .25,
      wood: 0x8a6038, woodDark: 0x4a301b, deck: 0x9c8058, canvas: 0xe2d9c4, rope: 0x5e4e3b, iron: 0x3a3f45, steel: 0x7f888f,
      hull: 0x25313b, boot: 0x8a3a2c, house: 0xe8dfca, glass: 0xffcf7a, funnel: 0xb07a2e, tank: 0x4f6a49, brass: 0xc8892a, paper: 0x3a6fa3,
      sky: 0x9fb6dd, ground: 0x2a2f36, hemi: 1.1, sun: 0xbcd2f2, sunI: 1.9, sunAt: [-5, 11, 6], exposure: 1.2, night: true, lamp: 0xffc56a },
  },
  modern: {
    day: { tile: 0xf6f7f6, tile2: 0xeff1f0, apron: 0xdfe3e3, grout: 0xb9c3c8, quay: 0xcfd6d9, water: 0x8fbfd3, far: 0xb7d6e3,
      wood: 0xd9c3a0, woodDark: 0x9c8466, deck: 0xe8dcc6, canvas: 0xffffff, rope: 0x9aa4aa, iron: 0x4a545c, steel: 0xc5cbd0,
      hull: 0x1c2a34, boot: 0xa23c30, house: 0xffffff, glass: 0x1c2a34, funnel: 0xe1ab24, tank: 0x9fb8a5, brass: 0xe1ab24, paper: 0x2d5e88,
      sky: 0xffffff, ground: 0xb9c3c8, hemi: 1.45, sun: 0xffffff, sunI: 2.1, sunAt: [3, 12, 6], exposure: 1 },
    night: { tile: 0x3a4651, tile2: 0x36424c, apron: 0x2c363e, grout: 0x1a2228, quay: 0x323d46, water: 0x27566e, far: 0x22485c, seaGlow: .22,
      wood: 0xa48d6c, woodDark: 0x6c5a44, deck: 0x8f8170, canvas: 0xdce3e8, rope: 0x6f7a82, iron: 0x3c464e, steel: 0x8b959c,
      hull: 0x1c2a34, boot: 0x8f362c, house: 0xe6ecf0, glass: 0xcfe8ff, funnel: 0xc9981f, tank: 0x5a7262, brass: 0xc9981f, paper: 0x4a86bd,
      sky: 0xa4b8c9, ground: 0x1a2228, hemi: 1.1, sun: 0xc8dbef, sunI: 1.8, sunAt: [-4, 12, 5], exposure: 1.2, night: true, lamp: 0xcfe8ff },
  },
  office: {
    day: { tile: 0xfafafa, tile2: 0xf3f3f3, apron: 0xe6e6e6, grout: 0xc7c7c7, quay: 0xd6d6d6, water: 0xc7dff7, far: 0xdcebfa,
      wood: 0xc8b49a, woodDark: 0x8a7a66, deck: 0xe0d6c8, canvas: 0xffffff, rope: 0x8a8a8a, iron: 0x424242, steel: 0xbdbdbd,
      hull: 0x242424, boot: 0x0f6cbd, house: 0xffffff, glass: 0x242424, funnel: 0x0f6cbd, tank: 0xa8b8a8, brass: 0x0f6cbd, paper: 0x0f6cbd,
      sky: 0xffffff, ground: 0xd1d1d1, hemi: 1.7, sun: 0xffffff, sunI: 1.3, sunAt: [4, 12, 6], exposure: 1, edge: [0x0f6cbd, .4] },
    night: { tile: 0x333333, tile2: 0x2e2e2e, apron: 0x262626, grout: 0x141414, quay: 0x2b2b2b, water: 0x163454, far: 0x14304e, seaGlow: .25,
      wood: 0x7d6e5c, woodDark: 0x54493d, deck: 0x5f564b, canvas: 0xd6d6d6, rope: 0x6b6b6b, iron: 0x3d3d3d, steel: 0x6e6e6e,
      hull: 0x1f1f1f, boot: 0x479ef5, house: 0x3d3d3d, glass: 0x9ccbfa, funnel: 0x479ef5, tank: 0x4a5a4a, brass: 0x479ef5, paper: 0x479ef5,
      sky: 0x3a4c60, ground: 0x141414, hemi: .95, sun: 0xcfe4fb, sunI: 1.2, sunAt: [-4, 12, 5], exposure: 1.05, edge: [0x479ef5, .8], night: true, lamp: 0x9ccbfa },
  },
  kontor: {
    day: { tile: 0xffffff, tile2: 0xf7faf8, apron: 0xe4eae6, grout: 0xc9d2cc, quay: 0xdfe6e1, water: 0xcfe0d6, far: 0xe4eee8,
      wood: 0xffffff, woodDark: 0xe9efeb, deck: 0xf4f7f5, canvas: 0xffffff, rope: 0xc9d2cc, iron: 0xdfe6e1, steel: 0xf4f7f5,
      hull: 0xffffff, boot: 0x2eb36a, house: 0xffffff, glass: 0x111a15, funnel: 0x2eb36a, tank: 0xe4eae6, brass: 0x2eb36a, paper: 0x2eb36a,
      sky: 0xffffff, ground: 0xc9d2cc, hemi: 1.75, sun: 0xffffff, sunI: 1.1, sunAt: [4, 12, 6], exposure: 1, edge: [0x1e7a45, .75], ink: true },
    night: { tile: 0x15201a, tile2: 0x131d17, apron: 0x101812, grout: 0x060a08, quay: 0x18231c, water: 0x10251a, far: 0x0d1f15, seaGlow: .3,
      wood: 0x15201a, woodDark: 0x1f2c24, deck: 0x15201a, canvas: 0x15201a, rope: 0x2c3d33, iron: 0x1f2c24, steel: 0x1f2c24,
      hull: 0x15201a, boot: 0x3dd884, house: 0x15201a, glass: 0x6bffb0, funnel: 0x3dd884, tank: 0x1f2c24, brass: 0x3dd884, paper: 0x3dd884,
      sky: 0x4f7a60, ground: 0x0b100d, hemi: .9, sun: 0xa8f0c8, sunI: 1.2, sunAt: [-4, 12, 5], exposure: 1.2, edge: [0x3dd884, .95], ink: true, night: true, lamp: 0x6bffb0 },
  },
};
/** The skin in force: the suite's theme and day or night (as set, else as the device), with the kinds' colours: the four
 *  enamels, and copper (the theme's second player colour) for the screws. */
export function skinNow() {
  const root = document.documentElement, theme = SKINS[root.dataset.theme] ? root.dataset.theme : "almanac";
  const night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  const css = getComputedStyle(root), v = (name, or) => new THREE.Color((css.getPropertyValue(name) || "").trim() || or);
  const s = SKINS[theme][night ? "night" : "day"];
  return { name: `${theme} ${night ? "night" : "day"}`, ...s, kinds: [v("--c0", "#d49a22"), v("--c1", "#3d7a66"), v("--c2", "#2c5b8a"), v("--c3", "#8f3328"), v("--p1", "#b4632a")] };
}

// ---------- the ships: each lofted from a few numbers ----------
// len, beam, depth: the hull; sheer: how much higher her ends are than her waist; keel: how far her keel rises to the
// stern and to the stem (her rake); plan: how full her stern and bow are (low is full); transom: her stern's width (0 a
// pointed stern); tumble: tumblehome, how much narrower her deck is than her waist; castles: [from, to, height] along
// her length; masts: { u (along her, stern 0 to bow 1), h, rig: square tiers | lateen | none }; bowsprit; ports: rows
// of gunports; power: funnels, houses, engine, screws.
const SPECS = {
  cog: { len: 3.2, beam: 1.05, depth: .8, sheer: .16, keel: [.3, .3], plan: [.6, .65], transom: 0, full: .55, wood: true, clinker: true,
    castles: [[0, .2, .3], [.86, 1, .18]], masts: [{ u: .52, h: 2.5, rig: 1 }], bowsprit: .45 },
  hulk: { len: 3.6, beam: 1.1, depth: .85, sheer: .3, keel: [.38, .38], plan: [.55, .55], transom: 0, full: .6, wood: true, clinker: true,
    castles: [[0, .2, .32], [.84, 1, .26]], masts: [{ u: .5, h: 2.7, rig: 1 }], bowsprit: .4 },
  caravel: { len: 3.5, beam: .85, depth: .7, sheer: .12, keel: [.2, .28], plan: [.75, 1.05], transom: .45, full: .65, wood: true,
    castles: [[0, .22, .22]], masts: [{ u: .64, h: 2.4, rig: "lateen" }, { u: .3, h: 2.0, rig: "lateen" }] },
  carrack: { len: 4.3, beam: 1.1, depth: .95, sheer: .2, keel: [.22, .3], plan: [.7, .8], transom: .5, full: .6, wood: true, ports: 1,
    castles: [[0, .26, .42], [.8, 1.04, .34]], masts: [{ u: .8, h: 2.5, rig: 2 }, { u: .52, h: 3.1, rig: 2 }, { u: .22, h: 2.2, rig: "lateen" }], bowsprit: .7 },
  galleon: { len: 4.9, beam: 1.1, depth: .95, sheer: .14, keel: [.2, .26], plan: [.75, .95], transom: .55, full: .65, tumble: .12, wood: true, ports: 2,
    castles: [[0, .3, .48], [.78, .9, .2]], beak: .45, masts: [{ u: .76, h: 2.8, rig: 2 }, { u: .5, h: 3.3, rig: 3 }, { u: .25, h: 2.3, rig: "lateen" }], bowsprit: .8 },
  fluyt: { len: 4.8, beam: 1.15, depth: 1, sheer: .14, keel: [.16, .24], plan: [.55, .75], transom: .3, full: .45, tumble: .32, wood: true,
    castles: [[0, .2, .3]], masts: [{ u: .76, h: 2.9, rig: 2 }, { u: .5, h: 3.3, rig: 3 }, { u: .24, h: 2.3, rig: "lateen" }], bowsprit: .75 },
  indiaman: { len: 5.3, beam: 1.2, depth: 1.05, sheer: .1, keel: [.16, .22], plan: [.7, .9], transom: .6, full: .6, tumble: .1, wood: true, ports: 1,
    castles: [[0, .24, .3]], masts: [{ u: .76, h: 3.3, rig: 3 }, { u: .5, h: 3.8, rig: 3 }, { u: .24, h: 2.9, rig: 2 }], bowsprit: .9, stripe: true },
  clipper: { len: 5.7, beam: .95, depth: .75, sheer: .08, keel: [.14, .3], plan: [.8, 1.6], transom: .35, full: .7, wood: true,
    masts: [{ u: .76, h: 3.9, rig: 5 }, { u: .5, h: 4.3, rig: 5 }, { u: .24, h: 3.6, rig: 4 }], bowsprit: 1.1, jibs: 3, stripe: true },
  steamer: { len: 5.8, beam: .9, depth: .9, sheer: .06, keel: [.14, .3], plan: [.75, 1.4], transom: .35, full: .7,
    masts: [{ u: .82, h: 2.6, rig: "bare" }, { u: .3, h: 2.4, rig: "bare" }], bowsprit: .6,
    power: { funnels: [.55], houses: [[.36, .46, .2]], engine: [.46, .62], screws: 1 } },
  liner: { len: 6, beam: .95, depth: 1, sheer: .04, keel: [.12, .2], plan: [.8, 1.3], transom: .4, full: .75,
    masts: [{ u: .9, h: 2.2, rig: "bare" }, { u: .12, h: 2, rig: "bare" }],
    power: { funnels: [.72, .58, .44, .3], houses: [[.22, .8, .28], [.3, .74, .22]], engine: [.3, .74], screws: 2 } },
  vlcc: { len: 6, beam: 1.25, depth: .7, sheer: .02, keel: [.08, .1], plan: [.9, .85], transom: .75, full: .92, tank: true,
    masts: [{ u: .95, h: .9, rig: "bare" }],
    power: { funnels: [.06], houses: [[.02, .14, .55]], engine: [.02, .14], screws: 1, manifold: .5 } },
};

// ---------- geometry ----------
const geos = new Map();
const geo = (key, make) => { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); };
const box = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, n = 14, open = false) => geo(`c${rt},${rb},${h},${n},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, n, 1, open));
const ball = r => geo(`s${r}`, () => new THREE.SphereGeometry(r, 12, 8));
/** A U, open at the top, w across and h high, t thick, made `depth` long along x: a hull section seen end on. */
const uShape = (w, h, t, depth, round) => geo(`u${w},${h},${t},${depth},${round}`, () => {
  const s = new THREE.Shape(), r = h * round;
  s.moveTo(-w / 2, h); s.lineTo(-w / 2, r); s.quadraticCurveTo(-w / 2, 0, 0, 0); s.quadraticCurveTo(w / 2, 0, w / 2, r); s.lineTo(w / 2, h);
  s.lineTo(w / 2 - t, h); s.lineTo(w / 2 - t, r); s.quadraticCurveTo(w / 2 - t, t, 0, t); s.quadraticCurveTo(-w / 2 + t, t, -w / 2 + t, r); s.lineTo(-w / 2 + t, h);
  s.lineTo(-w / 2, h);
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  return g;
});
const ringShape = (r, inner, h) => geo(`r${r},${inner},${h}`, () => {
  const s = new THREE.Shape(), hole = new THREE.Path();
  s.absarc(0, 0, r, 0, Math.PI * 2, false); hole.absarc(0, 0, inner, 0, Math.PI * 2, true); s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 20 });
  g.rotateX(-Math.PI / 2);
  return g;
});
// a propeller blade: a rounded paddle in the x–z plane, from the hub out along x
const bladeShape = (len, wid) => geo(`bl${len},${wid}`, () => {
  const s = new THREE.Shape();
  s.moveTo(0, -wid * .25); s.quadraticCurveTo(len * .55, -wid * .75, len, -wid * .1); s.quadraticCurveTo(len * 1.04, wid * .3, len * .7, wid * .45); s.quadraticCurveTo(len * .3, wid * .5, 0, wid * .25); s.lineTo(0, -wid * .25);
  const g = new THREE.ExtrudeGeometry(s, { depth: .022, bevelEnabled: false, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  return g;
});
// a sail: a grid between its head (z0..z1 at y1) and its foot (z2..z3 at y0), bellied out along x by `belly`
function sailGeo(head, foot, belly) {
  const NX = 6, NY = 5, pos = [], idx = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) {
    const a = i / NX, b = j / NY;                    // across, and up from the foot
    const z = (1 - b) * (foot[0] + (foot[1] - foot[0]) * a) + b * (head[0] + (head[1] - head[0]) * a);
    const y = foot[2] + (head[2] - foot[2]) * b;
    pos.push(belly * Math.sin(Math.PI * a) * Math.sin(Math.PI * (.15 + b * .7)), y, z);
  }
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const p = j * (NX + 1) + i; idx.push(p, p + 1, p + NX + 1, p + 1, p + NX + 2, p + NX + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A hull lofted from stations stern to bow: its skin, deck and transom cut lengthwise into `pieces` (one for each hull
 * component she needs), each with vertex colours (her paint or her planking's strakes and wales), and the frames that
 * stand where a wooden piece isn't planked yet. Local: x along her (stern −len/2), y up from her keel, z across.
 */
function lofted(spec, pieces, skin) {
  const { len, beam, depth, sheer = .1, keel = [.2, .2], plan = [.7, .9], transom = 0, full = .6, tumble = 0 } = spec;
  const NU = 30, NV = 9;
  const xAt = u => -len / 2 + u * len;
  const deckAt = u => depth + sheer * (2 * u - 1) ** 2 * (u < .5 ? 1.2 : 1);
  const keelAt = u => (u < keel[0] ? (1 - u / keel[0]) ** 2 * depth * .85 : u > 1 - keel[1] ? ((u - 1 + keel[1]) / keel[1]) ** 2 * depth * .95 : 0);
  const breadth = u => {
    if (u < .5) { const s = u / .5; return beam / 2 * (transom + (1 - transom) * Math.pow(1 - (1 - s) ** 2, plan[0])); }
    const s = (1 - u) / .5;
    return beam / 2 * Math.pow(Math.max(0, 1 - (1 - s) ** 2), plan[1]);
  };
  const across = v => Math.pow(Math.sin(v * Math.PI / 2), full) * (1 - tumble * Math.max(0, (v - .62) / .38) ** 2);
  const point = (u, v, side) => new THREE.Vector3(xAt(u), keelAt(u) + (deckAt(u) - keelAt(u)) * v, side * breadth(u) * across(v));
  // the paint (or the planking): bands by height
  const colourAt = v => {
    const c = new THREE.Color();
    if (spec.tank) return c.set(v < .45 ? skin.boot : skin.hull);
    if (!spec.wood) return c.set(v < .38 ? skin.boot : skin.hull);
    if (spec.stripe && v > .66 && v < .8) return c.set(skin.house);
    if (Math.abs(v - .55) < .04 || Math.abs(v - .82) < .03) return c.set(skin.woodDark);
    return c.set(skin.wood).multiplyScalar(spec.clinker && Math.round(v * 9) % 2 ? .86 : 1);
  };
  const out = [];
  for (let p = 0; p < pieces; p++) {
    const u0 = p / pieces, u1 = (p + 1) / pieces, n = Math.max(2, Math.round(NU / pieces)), pos = [], col = [], idx = [], dpos = [], didx = [];
    for (const side of [1, -1]) {
      const base = pos.length / 3;
      for (let i = 0; i <= n; i++) for (let j = 0; j <= NV; j++) {
        const u = u0 + (u1 - u0) * i / n, v = j / NV, q = point(u, v, side), c = colourAt(v);
        pos.push(q.x, q.y, q.z); col.push(c.r, c.g, c.b);
      }
      for (let i = 0; i < n; i++) for (let j = 0; j < NV; j++) {
        const a = base + i * (NV + 1) + j, b = a + NV + 1;
        if (side > 0) idx.push(a, b, a + 1, b, b + 1, a + 1); else idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
    // the deck, across from side to side
    for (let i = 0; i <= n; i++) { const u = u0 + (u1 - u0) * i / n, l = point(u, 1, 1), r = point(u, 1, -1); dpos.push(l.x, l.y - .01, l.z, r.x, r.y - .01, r.z); }
    for (let i = 0; i < n; i++) { const a = i * 2; didx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    // her transom, where her stern is square
    if (p === 0 && transom > 0) {
      const c0 = pos.length / 3, mid = point(0, .5, 1);
      pos.push(mid.x, mid.y, 0); col.push(...colourAt(.5).toArray());
      for (let j = 0; j <= NV; j++) { const q = point(0, j / NV, 1), c = colourAt(j / NV); pos.push(q.x, q.y, q.z); col.push(c.r, c.g, c.b); }
      for (let j = 0; j <= NV; j++) { const q = point(0, j / NV, -1), c = colourAt(j / NV); pos.push(q.x, q.y, q.z); col.push(c.r, c.g, c.b); }
      for (let j = 0; j < NV; j++) { idx.push(c0, c0 + 1 + j + 1, c0 + 1 + j); idx.push(c0, c0 + NV + 2 + j, c0 + NV + 2 + j + 1); }
    }
    const skinGeo = new THREE.BufferGeometry();
    skinGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    skinGeo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    skinGeo.setIndex(idx);
    skinGeo.computeVertexNormals();
    const deckGeo = new THREE.BufferGeometry();
    deckGeo.setAttribute("position", new THREE.Float32BufferAttribute(dpos, 3));
    deckGeo.setIndex(didx);
    deckGeo.computeVertexNormals();
    // the frames: ribs at a few stations, each a chain of short timbers round her section
    const frames = [];
    const nf = Math.max(3, Math.round(10 / pieces));
    for (let f = 0; f < nf; f++) {
      const u = u0 + (u1 - u0) * (f + .5) / nf, pts = [];
      for (let j = NV; j >= 0; j--) pts.push(point(u, j / NV, 1));
      for (let j = 1; j <= NV; j++) pts.push(point(u, j / NV, -1));
      frames.push(pts);
    }
    // the lines plan: the sheer and two waterlines on this piece, and a station at each end (Kontor's drawing)
    const lines = [];
    for (const side of [1, -1]) for (const v of [1, .62, .3]) for (let i = 0; i < n; i++) {
      const a = point(u0 + (u1 - u0) * i / n, v, side), b = point(u0 + (u1 - u0) * (i + 1) / n, v, side);
      lines.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    for (const u of [u0, u1]) for (let j = 0; j < NV; j++) for (const side of [1, -1]) {
      const a = point(u, j / NV, side), b = point(u, (j + 1) / NV, side);
      lines.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    out.push({ skinGeo, deckGeo, frames, lines, u0, u1 });
  }
  return { pieces: out, point, deckAt, keelAt, breadth, xAt };
}

// ---------- the yard ----------
export function createYard(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });     // throws where there's no WebGL: the page draws flat
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCF;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "sw-3d";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The yard and the ship on the slipway");
  host.prepend(canvas);

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100), ray = new THREE.Raycaster(), ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let skin = null, scene = null, yardGroup = null, shipGroup = null, dockGroup = null, fxGroup = null, last = null;
  let pieces = new Array(W * H).fill(null), dock = { hand: null, hold: null, next: null }, cursor = null, lifted = null, glowing = [];
  const tweens = [];
  let frame = 0;
  const mats = new Map(), owned = [];
  const mat = (colour, extra = {}) => {
    const key = `${new THREE.Color(colour).getHex()}|${JSON.stringify(extra)}`;
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: colour, roughness: .75, metalness: 0, ...extra }));
    return mats.get(key);
  };
  const metal = colour => mat(colour, { roughness: .4, metalness: .55 });
  const glowMat = colour => mat(colour, { emissive: colour, emissiveIntensity: 1.1, roughness: .4 });
  let ghostMat = null, edgeMat = null;
  const edges = new Map();
  /** A mesh of a geometry and a material, placed and turned, added to a group; inked where the skin inks. */
  function add(g, geometry, material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = m.receiveShadow = true;
    if (edgeMat) {
      if (!edges.has(geometry)) edges.set(geometry, new THREE.EdgesGeometry(geometry, 35));
      const e = new THREE.LineSegments(edges.get(geometry), edgeMat);
      e.userData.ink = true;
      m.add(e);
    }
    g.add(m);
    return m;
  }

  // ---------- the parts ----------
  const lying = (g, geometry, material, x, y, z, ry = 0) => add(g, geometry, material, x, y, z, 0, ry, Math.PI / 2);   // a cylinder laid along x
  const chocks = (g, xs = [-.24, .24]) => { for (const x of xs) add(g, box(.08, .06, .2), mat(skin.woodDark), x, .09, 0); };
  const SAIL_PARTS = [
    [ // the hull: a plank, a strake of three, a hull section on its frames
      g => add(g, box(.74, .06, .17), mat(skin.wood), 0, .1, 0, 0, .35, 0),
      g => { for (let j = -1; j <= 1; j++) add(g, box(.76, .05, .16), mat(skin.wood), 0, .11 + Math.abs(j) * .035, j * .158, j * .2, 0, 0); chocks(g, [-.27, .27]); },
      g => { add(g, uShape(.66, .34, .07, .52, .5), mat(skin.wood), 0, .06, 0); for (const x of [-.27, 0, .27]) add(g, uShape(.7, .34, .1, .045, .5), mat(skin.woodDark), x, .055, 0); },
    ],
    [ // the masts: a spar, a made mast hooped in iron, a rigged mast with its yard and top
      g => { lying(g, cyl(.04, .055, .78), mat(skin.wood), 0, .15, 0); chocks(g); },
      g => { lying(g, cyl(.065, .08, .8), mat(skin.wood), 0, .17, 0); for (const x of [-.24, 0, .24]) lying(g, cyl(.088, .088, .035), mat(skin.iron), x, .17, 0); chocks(g, [-.3, .3]); },
      g => { lying(g, cyl(.055, .075, .82), mat(skin.wood), 0, .16, -.05); add(g, cyl(.03, .03, .64), mat(skin.wood), .22, .22, 0, Math.PI / 2, 0, 0); lying(g, cyl(.11, .11, .03), mat(skin.woodDark), .3, .16, -.05); add(g, cyl(.07, .07, .05), mat(skin.rope), -.2, .09, .22); chocks(g, [-.28, .12]); },
    ],
    [ // the sails: a bolt of canvas, a sail folded and roped, a suit of sails
      g => { lying(g, cyl(.13, .13, .5, 18), [mat(skin.canvas), mat(skin.rope), mat(skin.rope)], 0, .19, 0); },
      g => { add(g, box(.6, .1, .44), mat(skin.canvas), 0, .11, 0); add(g, box(.62, .105, .03), mat(skin.rope), 0, .11, .06); add(g, box(.03, .105, .46), mat(skin.rope), .12, .11, 0); },
      g => { [[.62, .46], [.54, .4], [.46, .34]].forEach(([w, d], j) => add(g, box(w, .08, d), mat(skin.canvas), 0, .1 + j * .08, 0)); add(g, box(.03, .26, .48), mat(skin.rope), -.13, .18, 0); add(g, box(.03, .26, .48), mat(skin.rope), .13, .18, 0); },
    ],
    [ // the guns: pigs of iron, a cast barrel, a gun on its carriage
      g => { for (const z of [-.12, .12]) add(g, cyl(.1, .14, .1, 4), mat(skin.iron), 0, .11, z, 0, Math.PI / 4, 0).scale.set(2, 1, .8); },
      g => { lying(g, cyl(.055, .085, .62, 16), metal(skin.iron), 0, .17, 0); lying(g, cyl(.07, .07, .04), metal(skin.iron), .31, .17, 0); add(g, ball(.045), metal(skin.iron), -.35, .17, 0); chocks(g, [-.2, .2]); },
      g => { add(g, box(.46, .12, .3), mat(skin.wood), 0, .17, 0); for (const x of [-.16, .16]) for (const z of [-.17, .17]) add(g, cyl(.075, .075, .04), mat(skin.woodDark), x, .13, z, Math.PI / 2, 0, 0); lying(g, cyl(.05, .075, .56, 16), metal(skin.iron), .08, .28, 0).rotation.z = Math.PI / 2 - .08; },
    ],
  ];                                                  // no screws under sail
  const POWER_PARTS = [
    [ // the hull: a steel plate, a riveted strake, a hull block in her paint
      g => { add(g, box(.7, .04, .5), metal(skin.steel), 0, .09, 0, 0, .25, 0); for (let k = 0; k < 6; k++) add(g, cyl(.018, .018, .02, 6), metal(skin.iron), -.28 + k * .112, .115, .2, 0, .25, 0); },
      g => { for (let j = -1; j <= 1; j++) add(g, box(.76, .04, .16), metal(skin.steel), 0, .11 + Math.abs(j) * .035, j * .158, j * .2, 0, 0); chocks(g, [-.27, .27]); },
      g => { add(g, uShape(.66, .34, .06, .56, .22), mat(skin.hull), 0, .06, 0); add(g, uShape(.68, .12, .07, .58, .5), mat(skin.boot), 0, .055, 0); },
    ],
    [ // the funnels: a ring, a section, a funnel in her colours
      g => add(g, ringShape(.2, .15, .1), metal(skin.steel), 0, .06, 0),
      g => { add(g, cyl(.19, .19, .26, 20, true), mat(skin.funnel, { side: DOUBLE }), 0, .19, 0); add(g, ringShape(.2, .18, .04), mat(skin.hull), 0, .2, 0); },
      g => { add(g, cyl(.16, .19, .4, 20), mat(skin.funnel), 0, .26, 0); add(g, cyl(.165, .165, .08, 20), mat(skin.hull), 0, .43, 0); add(g, cyl(.172, .172, .045, 20), mat(skin.house), 0, .34, 0); },
    ],
    [ // the engines: a cylinder, a boiler, an engine
      g => { add(g, cyl(.11, .11, .24, 16), metal(skin.iron), 0, .18, 0); add(g, cyl(.14, .14, .04, 16), metal(skin.steel), 0, .31, 0); add(g, cyl(.14, .14, .04, 16), metal(skin.steel), 0, .08, 0); },
      g => { lying(g, cyl(.17, .17, .55, 18), [metal(skin.iron), metal(skin.steel), metal(skin.steel)], 0, .23, 0); add(g, cyl(.06, .07, .09, 12), metal(skin.steel), .08, .43, 0); chocks(g, [-.18, .18]); },
      g => { add(g, box(.62, .1, .4), metal(skin.iron), 0, .11, 0); for (const x of [-.18, 0, .18]) add(g, cyl(.07, .07, .24, 14), metal(skin.steel), x, .28, -.04); add(g, box(.56, .05, .12), metal(skin.iron), 0, .41, -.04); add(g, cyl(.19, .19, .04, 20), metal(skin.iron), .1, .26, .17, Math.PI / 2, 0, 0); },
    ],
    [ // the deckhouses: a panel, a cabin, a deckhouse with its bridge
      g => { add(g, box(.62, .04, .42), mat(skin.house), 0, .09, 0); for (const x of [-.14, .14]) add(g, box(.16, .012, .1), mat(skin.glass), x, .115, 0); },
      g => { add(g, box(.5, .26, .34), mat(skin.house), 0, .19, 0); add(g, box(.54, .03, .38), mat(skin.steel), 0, .335, 0); for (const x of [-.15, 0, .15]) add(g, box(.08, .06, .012), mat(skin.glass), x, .23, .172); },
      g => { add(g, box(.56, .22, .4), mat(skin.house), 0, .17, 0); add(g, box(.42, .17, .3), mat(skin.house), 0, .365, -.03); add(g, box(.64, .04, .12), mat(skin.house), 0, .47, .06); add(g, box(.44, .045, .006), mat(skin.glass), 0, .4, .12); },
    ],
    [ // the screws: a blade, a propeller, a screw on its shaft
      g => add(g, bladeShape(.42, .26), metal(skin.brass), -.18, .1, .02, 0, .3, 0),
      g => { add(g, cyl(.06, .06, .1, 12), metal(skin.brass), 0, .12, 0); for (let k = 0; k < 3; k++) add(g, bladeShape(.3, .2), metal(skin.brass), 0, .11, 0, 0, k * Math.PI * 2 / 3, 0); },
      g => { lying(g, cyl(.03, .03, .64), metal(skin.steel), -.06, .24, 0); const p = new THREE.Group(); p.position.set(.27, .24, 0); p.rotation.z = Math.PI / 2; g.add(p); add(p, cyl(.055, .055, .09, 12), metal(skin.brass)); for (let k = 0; k < 3; k++) add(p, bladeShape(.22, .16), metal(skin.brass), 0, 0, 0, 0, k * Math.PI * 2 / 3, 0); add(g, box(.08, .16, .14), mat(skin.iron), -.25, .14, 0); add(g, box(.08, .16, .14), mat(skin.iron), .08, .14, 0); },
    ],
  ];
  /** A part as it lies in the yard: its pallet in its kind's enamel, a brass stud for each stage, the part on it. */
  function partModel(c, era) {
    const g = new THREE.Group();
    if (c === BLUEPRINT) {
      for (const [z, r] of [[-.1, .085], [.1, .075]]) lying(g, cyl(r, r, .54, 16), [mat(skin.paper), mat(skin.house), mat(skin.house)], 0, .1 + r, z, .1);
      add(g, box(.5, .012, .34), mat(skin.paper), .02, .07, 0, 0, -.2, 0);
      return g;
    }
    const k = kindOf(c), st = stageOf(c);
    add(g, box(.8, .055, .8), mat(skin.kinds[k], { roughness: .55 }), 0, .03, 0);
    for (let j = 0; j < st; j++) add(g, cyl(.045, .045, .03, 12), metal(skin.brass), (j - (st - 1) / 2) * .13, .07, .345);
    (era || !SAIL_PARTS[k] ? POWER_PARTS : SAIL_PARTS)[k][st - 1](g);
    g.userData.code = c;
    return g;
  }

  // ---------- the ship ----------
  const split = (list, n) => Array.from({ length: n }, (_, k) => list.slice(Math.round(k * list.length / n), Math.round((k + 1) * list.length / n)));
  /** The ship on the berth: her keel and cradle, and each kind's components (an array of groups each). */
  function buildShip(index) {
    const ship = shipAt(index), spec = SPECS[ship.id], needs = ship.needs, root = new THREE.Group(), comps = Array.from({ length: KINDS }, () => []);
    const body = new THREE.Group();                   // what slides at the launch: everything but the cradle
    root.add(body);
    const H0 = .32;                                   // her keel above the berth, on blocks
    body.position.y = H0;
    const L = lofted(spec, Math.max(1, needs[0]), skin);
    const wood = !!spec.wood;
    // the keel, the stem and the sternpost: laid down from the start
    add(body, box(spec.len * .86, .07, .07), mat(skin.woodDark), 0, .02, 0);
    // the cradle: keel blocks and the ways under her
    for (let k = 0; k < 7; k++) add(root, box(.16, H0, .32), mat(skin.woodDark), -spec.len * .38 + k * spec.len * .76 / 6, H0 / 2 - .01, 0);
    for (const z of [-.42, .42]) add(root, box(spec.len * .95, .06, .1), mat(skin.wood), 0, .03, z);
    const hullMat = wood ? mat(0xffffff, { vertexColors: true, roughness: .8 }) : mat(0xffffff, { vertexColors: true, roughness: .5, metalness: .15 });
    const deckMat = mat(spec.tank ? skin.tank : skin.deck, { side: DOUBLE });
    L.pieces.forEach(p => {
      const g = new THREE.Group();
      add(g, p.skinGeo, hullMat);
      add(g, p.deckGeo, deckMat);
      if (skin.ink) g.add(Object.assign(new THREE.LineSegments(lineGeo(p.lines), edgeMat), { userData: { ink: true } }));
      // where she isn't planked yet, her frames stand
      const frames = new THREE.Group();
      for (const pts of p.frames) for (let j = 0; j + 1 < pts.length; j++) {
        const a = pts[j], b = pts[j + 1], d = a.distanceTo(b);
        if (d < .01) continue;
        const m = add(frames, box(.045, d, .05), mat(wood ? skin.wood : skin.steel), (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
        m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
      }
      g.userData.frames = frames;
      comps[0].push(g);
      body.add(g, frames);
    });
    // castles fore and aft, a beakhead: on the hull piece they stand on
    const pieceAt = u => comps[0][Math.min(comps[0].length - 1, Math.floor(u * comps[0].length))];
    for (const [a, b, h] of spec.castles || []) {
      const u = (a + b) / 2, x = L.xAt(Math.min(1, u)), w = (Math.min(b, 1) - a) * spec.len, y = L.deckAt(Math.min(1, u)), half = Math.max(.25, L.breadth(Math.min(.98, u)) * .95);
      add(pieceAt(Math.min(.99, u)), box(w, h, half * 2), mat(wood ? skin.wood : skin.house), x, y + h / 2 - .02, 0);
      add(pieceAt(Math.min(.99, u)), box(w + .04, .03, half * 2 + .04), mat(skin.woodDark), x, y + h, 0);
    }
    if (spec.beak) add(pieceAt(.99), box(spec.beak, .12, .14), mat(skin.wood), spec.len / 2 + spec.beak / 2 - .1, L.deckAt(1) - .3, 0, 0, 0, .25);
    // gunports: dark squares in a row along each side, split among the guns she needs
    if (spec.ports && needs[3]) {
      const ports = [];
      for (let row = 0; row < spec.ports; row++) for (let k = 0; k < 9; k++) {
        const u = .2 + k * .07, v = .66 - row * .17, q = L.point(u, v, 1);
        ports.push({ u, v });
      }
      split(ports, needs[3]).forEach(list => {
        const g = new THREE.Group();
        for (const { u, v } of list) for (const side of [1, -1]) {
          const q = L.point(u, v, side);
          add(g, box(.09, .08, .02), mat(skin.iron), q.x, q.y, q.z + side * .01);
          add(g, cyl(.022, .026, .12, 8), metal(skin.iron), q.x, q.y, q.z + side * .06, Math.PI / 2, 0, 0);
        }
        comps[3].push(g); body.add(g);
      });
    } else if (needs[3] && !spec.power) {
      // guns on deck, where she has no gunports
      split([.3, .42, .54, .66], needs[3]).forEach(us => {
        const g = new THREE.Group();
        for (const u of us) for (const side of [1, -1]) { const q = L.point(u, .98, side); add(g, cyl(.025, .03, .16, 8), metal(skin.iron), q.x, q.y + .05, q.z * .8, Math.PI / 2, 0, 0); }
        comps[3].push(g); body.add(g);
      });
    }
    // masts, yards and sails
    const masts = [], sails = [];
    for (let m of spec.masts || []) {
      m = { ...m, h: m.h * MAST };
      const x = L.xAt(m.u), y0 = L.deckAt(m.u), g = new THREE.Group(), sg = new THREE.Group();
      add(g, cyl(.035, .06, m.h, 10), mat(skin.wood), x, y0 + m.h / 2, 0);
      if (m.rig === "bare") { add(g, cyl(.02, .02, .7, 6), mat(skin.wood), x, y0 + m.h * .8, 0, Math.PI / 2, 0, 0); masts.push({ g, sg: null }); continue; }
      if (m.rig === "lateen") {
        const yardLen = m.h * 1.15, tilt = .62;
        add(g, cyl(.02, .025, yardLen, 8), mat(skin.wood), x, y0 + m.h * .62, 0, 0, 0, tilt);
        // the yard turned about z: its upper end aft (−x), its lower end forward
        const top = new THREE.Vector3(x - Math.sin(tilt) * yardLen / 2, y0 + m.h * .62 + Math.cos(tilt) * yardLen / 2, 0);
        const low = new THREE.Vector3(x + Math.sin(tilt) * yardLen / 2, y0 + m.h * .62 - Math.cos(tilt) * yardLen / 2, 0);
        // a triangle from the yard's two ends down to the deck aft of the mast
        const tri = new THREE.Shape([new THREE.Vector2(top.x, top.y - .03), new THREE.Vector2(low.x, low.y + .03), new THREE.Vector2(Math.max(top.x, x - m.h * .5), y0 + .18)]);
        add(sg, new THREE.ShapeGeometry(tri), mat(skin.canvas, { side: DOUBLE }), 0, 0, .03);
      } else {
        const tiers = m.rig;
        add(g, cyl(.09, .09, .025, 12), mat(skin.woodDark), x, y0 + m.h * .58, 0);
        for (let t = 0; t < tiers; t++) {
          const yHead = y0 + m.h * (.95 - t * (.85 / tiers)) - .02, yFoot = yHead - m.h * (.85 / tiers) + .06, w = (m.h * .34) * (1 - (tiers - 1 - t) * .13);
          const yard = new THREE.Group();
          yard.position.set(x, 0, 0);
          yard.rotation.y = BRACE;                         // braced round, as if she were sailing, so her sails are seen
          g.add(yard);
          add(yard, cyl(.016, .016, w * 1.08, 6), mat(skin.wood), 0, yHead, 0, Math.PI / 2, 0, 0);
          const sailYard = new THREE.Group();
          sailYard.position.set(x, 0, 0);
          sailYard.rotation.y = BRACE;
          sg.add(sailYard);
          const s = add(sailYard, sailGeo([-w / 2, w / 2, yHead], [-w / 2 * 1.08, w / 2 * 1.08, yFoot], .06 + w * .05), mat(skin.canvas, { side: DOUBLE }));
          s.castShadow = true;
        }
      }
      masts.push({ g, sg });
    }
    if (spec.bowsprit) {
      const g0 = masts[0]?.g || body;
      add(g0, cyl(.02, .035, spec.bowsprit, 8), mat(skin.wood), spec.len / 2 + spec.bowsprit * .32, L.deckAt(1) + .06, 0, 0, 0, -Math.PI / 2 + .35);
    }
    if (spec.jibs && masts.length) {
      const f = spec.masts.reduce((a, m, k) => (m.u > spec.masts[a].u ? k : a), 0), fore = spec.masts[f];
      const x0 = L.xAt(fore.u), y0 = L.deckAt(fore.u), foreH = fore.h * MAST, tip = new THREE.Vector2(spec.len / 2 + spec.bowsprit * .62, L.deckAt(1) + .26);
      for (let k = 0; k < spec.jibs; k++) {
        const hy = y0 + foreH * (.62 + k * .1);
        const tri = new THREE.Shape([new THREE.Vector2(x0 + .05, hy), new THREE.Vector2(tip.x - k * .16, tip.y - k * .04), new THREE.Vector2(x0 + .25 + k * .1, y0 + .25)]);
        add(masts[f].sg, new THREE.ShapeGeometry(tri), mat(skin.canvas, { side: DOUBLE }), 0, 0, .015 * (k + 1));
      }
    }
    if (!spec.power) {
      split(masts, needs[1] || 1).forEach(list => { const g = new THREE.Group(); for (const m of list) g.add(m.g); if (needs[1]) comps[1].push(g); body.add(g); });
      split(masts.filter(m => m.sg), needs[2] || 1).forEach(list => { const g = new THREE.Group(); for (const m of list) g.add(m.sg); if (needs[2]) comps[2].push(g); body.add(g); });
    } else {
      // under power her masts come with the piece of hull they stand on
      spec.masts.forEach((m, k) => pieceAt(Math.min(.99, m.u)).add(masts[k].g));
      const P = spec.power;
      // funnels
      split(P.funnels, needs[1]).forEach(us => {
        const g = new THREE.Group();
        for (const u of us) {
          const x = L.xAt(u), y = L.deckAt(u) + P.houses.filter(([a, b]) => u >= a && u <= b).reduce((sum, h) => sum + h[2], 0);
          add(g, cyl(.11, .12, .7, 16), mat(skin.funnel), x, y + .35, 0);
          add(g, cyl(.115, .115, .13, 16), mat(skin.hull), x, y + .67, 0);
        }
        comps[1].push(g); body.add(g);
      });
      // engines: the casing and skylight over the engine room (the engine itself is out of sight below)
      split([0, 1, 2].map(k => P.engine[0] + (P.engine[1] - P.engine[0]) * (k + .5) / 3), needs[2]).forEach(us => {
        const g = new THREE.Group();
        for (const u of us) { const x = L.xAt(u), y = L.deckAt(u); add(g, box(spec.len * (P.engine[1] - P.engine[0]) / 3 * .9, .12, .34), metal(skin.iron), x, y + .06, 0); add(g, box(.14, .05, .2), mat(skin.glass), x, y + .14, 0); }
        comps[2].push(g); body.add(g);
      });
      // deckhouses
      const tiers = P.houses.map(([a, b, h], k) => ({ a, b, h, k }));
      split(tiers, needs[3]).forEach(list => {
        const g = new THREE.Group();
        for (const { a, b, h, k } of list) {
          const x = L.xAt((a + b) / 2), w = (b - a) * spec.len, base = L.deckAt((a + b) / 2) + tiers.slice(0, k).reduce((s, t) => s + t.h, 0), half = spec.beam * (.42 - k * .06);
          add(g, box(w, h, half * 2), mat(skin.house), x, base + h / 2, 0);
          add(g, box(w * .96, .035, .006), mat(skin.glass), x, base + h * .62, half + .004);
          add(g, box(w * .96, .035, .006), mat(skin.glass), x, base + h * .62, -half - .004);
          if (spec.tank) add(g, box(.08, .05, half * 2 + .3), mat(skin.house), x + w / 2 - .04, base + h - .03, 0);
        }
        comps[3].push(g); body.add(g);
      });
      // the screws, under her stern, and a tanker's manifold amidships
      split(Array.from({ length: P.screws }, (_, k) => k), needs[4]).forEach(list => {
        const g = new THREE.Group();
        for (const k of list) {
          const p = new THREE.Group(), z = P.screws > 1 ? (k % 2 ? -.18 : .18) : 0;
          p.position.set(-spec.len / 2 + .2, .16, z); p.rotation.z = Math.PI / 2; g.add(p);
          add(p, cyl(.04, .04, .07, 10), metal(skin.brass));
          for (let b = 0; b < 3; b++) add(p, bladeShape(.15, .11), metal(skin.brass), 0, 0, 0, 0, b * Math.PI * 2 / 3, 0);
        }
        comps[4].push(g); body.add(g);
      });
      if (P.manifold) {
        const x = L.xAt(P.manifold), y = L.deckAt(P.manifold), g = pieceAt(P.manifold);
        add(g, box(.5, .08, spec.beam * .8), metal(skin.iron), x, y + .05, 0);
        for (const z of [-.12, .12]) add(g, cyl(.02, .02, spec.len * .7, 8), metal(skin.steel), 0, y + .04, z, 0, 0, Math.PI / 2);
      }
    }
    root.position.set(0, 0, BERTH);
    root.rotation.y = SHIP_YAW;
    root.userData = { comps, body, index, wood };
    return root;
  }
  const lineGeo = pts => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)); return g; };
  /** Shows a component fitted (solid) or still wanted (faint; a wooden hull's frames standing where it isn't planked). */
  function showFitted(ship, fitted) {
    ship.userData.comps.forEach((list, k) => list.forEach((g, j) => {
      const on = j < fitted[k];
      g.traverse(o => {
        if (!o.isMesh) { if (o.userData.ink) o.visible = on; return; }
        if (!o.userData.mat) o.userData.mat = o.material;
        o.material = on ? o.userData.mat : ghostMat;
        o.castShadow = on;
      });
      if (g.userData.frames) g.userData.frames.visible = !on;
    }));
  }

  // ---------- the scene ----------
  function build() {
    skin = skinNow();
    for (const m of [...mats.values(), ...owned.splice(0)]) m.dispose();
    mats.clear();
    for (const g of geos.values()) g.dispose();
    geos.clear();
    for (const e of edges.values()) e.dispose();
    edges.clear();
    scene = new THREE.Scene();
    renderer.toneMappingExposure = skin.exposure;
    edgeMat = skin.edge ? new THREE.LineBasicMaterial({ color: skin.edge[0], transparent: true, opacity: skin.edge[1] }) : null;
    ghostMat = new THREE.MeshStandardMaterial({ color: skin.night ? 0xbfd0e0 : skin.ink ? skin.edge[0] : 0x8fa3b4, transparent: true, opacity: skin.ink ? .12 : .2, depthWrite: false, roughness: 1, side: DOUBLE });
    owned.push(edgeMat, ghostMat);
    // the yard's squares, the apron round them and the dock's place in front
    yardGroup = new THREE.Group();
    scene.add(yardGroup);
    add(yardGroup, box(W + .5, .3, H + 2.2), mat(skin.apron), 0, -.16, H / 2 + .72);
    for (let i = 0; i < W * H; i++) { const p = square(i); add(yardGroup, box(.94, .06, .94), mat((i + Math.floor(i / W)) % 2 ? skin.tile2 : skin.tile), p.x, -.02, p.z).castShadow = false; }
    for (const [name, x] of Object.entries(SLOTS)) {
      const r = name === "next" ? .36 : .5;
      add(yardGroup, cyl(r, r, .04, 32), mat(name === "hand" ? skin.quay : skin.tile2), x, -.0, DOCK_Z).castShadow = false;
    }
    // the berth, the quay's edge and the water
    add(yardGroup, box(W + 3.5, .3, 2.2), mat(skin.quay), 0, -.16, BERTH + .25);
    const sea = mat(skin.water, { roughness: .25, emissive: skin.water, emissiveIntensity: skin.seaGlow || 0 });
    add(yardGroup, box(W + 3.5, .12, 3.4), sea, 0, -.4, BERTH - 2.55).castShadow = false;
    add(yardGroup, box(W + 3.5, .05, .08), mat(skin.far), 0, -.33, BERTH - 4.2).castShadow = false;
    if (skin.night) for (const x of [-(W + 3) / 2, (W + 3) / 2]) {
      add(yardGroup, cyl(.03, .03, 1.1, 6), mat(skin.iron), x, .55, BERTH + 1);
      add(yardGroup, ball(.07), new THREE.MeshBasicMaterial({ color: skin.lamp }), x, 1.12, BERTH + 1);
    }
    // the light: a sun (a moon at night) casting soft shadows, and a sky-and-ground fill
    scene.add(new THREE.HemisphereLight(skin.sky, skin.ground, skin.hemi));
    const sun = new THREE.DirectionalLight(skin.sun, skin.sunI);
    sun.position.set(...skin.sunAt);
    sun.target.position.set(0, 0, 1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 3;
    sun.shadow.bias = -.0006;
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    scene.add(sun, sun.target);
    fxGroup = new THREE.Group();
    dockGroup = new THREE.Group();
    scene.add(fxGroup, dockGroup);
    cursor = new THREE.Group();
    const ringM = skin.night ? glowMat(skin.lamp) : mat(skin.ink ? skin.edge[0] : skin.grout);
    for (const [w, d, x, z] of [[.98, .05, 0, -.47], [.98, .05, 0, .47], [.05, .98, -.47, 0], [.05, .98, .47, 0]]) add(cursor, box(w, .02, d), ringM, x, .02, z).castShadow = false;
    cursor.visible = false;
    scene.add(cursor);
    pieces = new Array(W * H).fill(null);
    dock = { hand: null, hold: null, next: null };
    shipGroup = null;
    fit();
    if (last) set(last);
  }

  // ---------- what's shown ----------
  const era = s => (powered(s.ship) ? 1 : 0);
  function setPiece(i, c, s) {
    if (pieces[i]?.userData.code === c && pieces[i].userData.era === era(s)) return;
    if (pieces[i]) { yardGroup.remove(pieces[i]); pieces[i] = null; }
    if (c === EMPTY) return;
    const g = partModel(c, era(s));
    g.userData.era = era(s);
    g.position.copy(square(i));
    yardGroup.add(g);
    pieces[i] = g;
  }
  function setDock(slot, c, s) {
    const key = `${c}|${era(s)}`;
    if (dock[slot]?.userData.key === key) return;
    if (dock[slot]) dockGroup.remove(dock[slot]);
    dock[slot] = null;
    if (c === null || c === undefined) return;
    const g = partModel(c, era(s));
    g.userData.key = key;
    g.position.set(SLOTS[slot], .02, DOCK_Z);
    if (slot === "next") g.scale.setScalar(.7);
    dockGroup.add(g);
    dock[slot] = g;
  }
  // a ship's own geometry (her lofted hull, her sails) goes with her; the shared pieces stay
  function release(group) {
    const shared = new Set([...geos.values()]);
    group.traverse(o => { if (o.geometry && !shared.has(o.geometry) && !o.userData.ink) o.geometry.dispose(); });
  }
  function setShip(s) {
    if (!shipGroup || shipGroup.userData.index !== s.ship) {
      if (shipGroup) { scene.remove(shipGroup); release(shipGroup); }
      shipGroup = buildShip(s.ship);
      scene.add(shipGroup);
    }
    showFitted(shipGroup, s.fitted);
  }
  /** Shows a game as it stands. */
  function set(s) {
    last = s;
    s.cells.forEach((c, i) => setPiece(i, c, s));
    setDock("hand", s.hand, s);
    setDock("hold", s.hold, s);
    setDock("next", s.next, s);
    setShip(s);
    hover(null);
    invalidate();
  }

  // ---------- holding a part ----------
  /** Marks a square the part in hand would go on, lifting the parts it would join (or nothing). */
  function hover(at, group = []) {
    for (const g of glowing) { g.position.y = 0; g.traverse(o => { if (o.isMesh && o.userData.lit) { o.material = o.userData.lit; o.userData.lit = null; } }); }
    glowing = [];
    cursor.visible = at != null;
    if (at == null) { invalidate(); return; }
    cursor.position.copy(square(at));
    for (const j of group) {
      const g = pieces[j];
      if (!g) continue;
      g.position.y = .08;
      glowing.push(g);
    }
    invalidate();
  }
  /** The part in hand held over the yard at a point on the screen (null puts it back in the dock). */
  function lift(clientX, clientY, offset = 0) {
    const g = dock.hand;
    if (!g) return null;
    if (clientX == null) { g.position.set(SLOTS.hand, .02, DOCK_Z); lifted = null; invalidate(); return null; }
    const p = onGround(clientX, clientY);
    if (!p) return null;
    p.z -= offset;
    g.position.set(p.x, .45, p.z);
    lifted = g;
    invalidate();
    return squareAt(p.x, p.z);
  }
  const ndc = (x, y) => { const r = canvas.getBoundingClientRect(); return new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1); };
  const onGround = (x, y) => { ray.setFromCamera(ndc(x, y), cam); return ray.ray.intersectPlane(ground, new THREE.Vector3()); };
  const squareAt = (x, z) => { const cx = Math.floor(x + W / 2), cz = Math.floor(z); return cx >= 0 && cx < W && cz >= 0 && cz < H ? cz * W + cx : null; };
  /** What's at a point on the screen: { square } in the yard, { dock: "hand" | "hold" | "next" }, or null. */
  function pick(x, y, offset = 0) {
    const p = onGround(x, y);
    if (!p) return null;
    for (const [name, sx] of Object.entries(SLOTS)) if (Math.hypot(p.x - sx, p.z - DOCK_Z) < (name === "next" ? .5 : .62)) return { dock: name };
    const at = squareAt(p.x, p.z - offset);
    return at == null ? null : { square: at };
  }
  /** Where a square's middle (or a dock slot) is on the screen, in page pixels. */
  function where(at) {
    const v = (typeof at === "string" ? new THREE.Vector3(SLOTS[at], .1, DOCK_Z) : square(at).setY(.2)).project(cam), r = canvas.getBoundingClientRect();
    return { clientX: r.left + (v.x + 1) / 2 * r.width, clientY: r.top + (1 - v.y) / 2 * r.height };
  }
  /** Where the ship's middle is on the screen. */
  function shipWhere() {
    const v = new THREE.Vector3(0, 1.2, BERTH).project(cam), r = canvas.getBoundingClientRect();
    return { clientX: r.left + (v.x + 1) / 2 * r.width, clientY: r.top + (1 - v.y) / 2 * r.height };
  }

  // ---------- playing a turn out ----------
  const ease = k => k * k * (3 - 2 * k);
  function tween(ms, step) {
    return new Promise(done => { tweens.push({ t0: performance.now(), ms, step, done }); invalidate(); });
  }
  const wait = ms => tween(ms, () => {});
  /** Plays out a turn's steps (place.steps) on the way from the game before it to the game after. */
  async function play(steps, before, after, onStep) {
    hover(null);
    let s = structuredClone(before);
    const handFrom = lifted ? lifted.position.clone() : new THREE.Vector3(SLOTS.hand, .02, DOCK_Z);
    lifted = null;
    for (const st of steps) {
      onStep?.(st);
      if (st.type === "place") {
        s.cells[st.at] = st.part;
        if (dock.hand) { dockGroup.remove(dock.hand); dock.hand = null; }
        setPiece(st.at, st.part, s);
        const g = pieces[st.at], to = square(st.at);
        await tween(150, k => { const e = ease(k); g.position.lerpVectors(handFrom, to, e); g.position.y = handFrom.y * (1 - e) + Math.sin(Math.PI * k) * .25; });
      } else if (st.type === "merge") {
        const to = square(st.at), moving = st.from.filter(j => j !== st.at).map(j => ({ g: pieces[j], from: square(j) }));
        await tween(200, k => { const e = ease(k); for (const m of moving) if (m.g) { m.g.position.lerpVectors(m.from, to, e); m.g.position.y = Math.sin(Math.PI * k) * .3; m.g.scale.setScalar(1 - e * .5); } });
        for (const j of st.from) { s.cells[j] = EMPTY; setPiece(j, EMPTY, s); }
        s.cells[st.at] = st.part;
        setPiece(st.at, st.part, s);
        burst(to, skin.kinds[kindOf(st.part)]);
        const g = pieces[st.at];
        await tween(170, k => g.scale.setScalar(.6 + .4 * ease(Math.min(1, k * 1.2)) + Math.sin(Math.PI * k) * .18));
      } else if (st.type === "fit") {
        const g = pieces[st.at];
        pieces[st.at] = null;
        s.cells[st.at] = EMPTY;
        const comps = shipGroup.userData.comps[kindOf(st.part)], target = comps[Math.min(comps.length - 1, s.fitted[kindOf(st.part)])];
        const dest = new THREE.Vector3(0, 1, 0);
        if (target) { const b = target.children.find(o => o.isMesh || o.isGroup); if (b) b.getWorldPosition(dest); }
        const from = g.position.clone();
        await tween(520, k => { const e = ease(k); g.position.lerpVectors(from, dest, e); g.position.y += Math.sin(Math.PI * k) * 1.4; g.scale.setScalar(1 - e * .7); });
        yardGroup.remove(g);
        s.fitted[kindOf(st.part)]++;
        showFitted(shipGroup, s.fitted);
        flash(target);
        await wait(80);
      } else if (st.type === "launch") {
        await launch();
        s.fitted = new Array(KINDS).fill(0);
      } else if (st.type === "lay") {
        s.ship = st.ship;
        s.fitted = new Array(KINDS).fill(0);
        setShip(s);
        const g = shipGroup;
        await tween(420, k => g.scale.set(1, Math.max(.01, ease(k)), 1));
        // the yard's parts, made for the new era
        s.cells.forEach((c, i) => setPiece(i, c, s));
      }
    }
    set(after);
  }
  // a little burst of brass dust where parts go together
  function burst(at, colour) {
    const bits = [];
    for (let k = 0; k < 10; k++) {
      const m = new THREE.Mesh(ball(.035), mat(colour, { emissive: colour, emissiveIntensity: .6 }));
      const a = k / 10 * Math.PI * 2;
      m.position.copy(at).setY(.25);
      m.userData.v = new THREE.Vector3(Math.cos(a) * .9, 1.2 + (k % 3) * .3, Math.sin(a) * .9);
      fxGroup.add(m);
      bits.push(m);
    }
    tween(420, k => { for (const m of bits) { m.position.set(at.x + m.userData.v.x * k * .5, .25 + m.userData.v.y * k * .5 - k * k * .6, at.z + m.userData.v.z * k * .5); m.scale.setScalar(1 - k); } })
      .then(() => { for (const m of bits) fxGroup.remove(m); });
  }
  // a component lighting up as it's fitted
  function flash(target) {
    if (!target) return;
    const lit = [];
    target.traverse(o => { if (o.isMesh) { lit.push([o, o.material]); o.material = glowMat(skin.night ? skin.lamp : skin.brass); } });
    tween(260, () => {}).then(() => { for (const [o, m] of lit) o.material = m; invalidate(); });
  }
  // she slides off her cradle down the ways into the water, rights herself, turns to her course and sails away, while
  // the next is laid down on the empty cradle's place
  async function launch() {
    const g = shipGroup, body = g.userData.body;
    scene.attach(body);                              // she leaves the cradle: moved in the world from here
    const from = body.position.clone(), yaw = body.rotation.y;
    await tween(850, k => { const e = k * k; body.position.set(from.x, from.y - Math.max(0, e - .35) * 1.55, from.z - e * 2.5); body.rotation.x = -Math.sin(Math.min(1, k * 1.25) * Math.PI) * .14; });
    splash(new THREE.Vector3(body.position.x, -.32, body.position.z));
    const at = body.position.clone();
    await tween(450, k => { body.rotation.x = Math.sin(k * Math.PI * 2) * .06 * (1 - k); body.position.y = at.y + Math.sin(k * Math.PI * 2) * .07 * (1 - k); });
    scene.remove(g);
    shipGroup = null;
    tween(1500, k => { const e = k * k; body.rotation.y = yaw * (1 - ease(Math.min(1, k * 2))); body.position.set(at.x + e * 5.5, at.y, at.z - e * .6); body.scale.setScalar(1 - e * .75); })
      .then(() => { scene.remove(body); release(body); });
  }
  function splash(at) {
    const bits = [];
    for (let k = 0; k < 26; k++) {
      const m = new THREE.Mesh(ball(.07), mat(0xffffff, { roughness: .2, transparent: true, opacity: .9 }));
      const a = k / 26 * Math.PI * 2, r = .6 + (k % 4) * .5;
      m.userData.v = new THREE.Vector3(Math.cos(a) * r, 2.2 + (k % 5) * .4, Math.sin(a) * r * .5);
      m.position.copy(at);
      fxGroup.add(m);
      bits.push(m);
    }
    tween(800, k => { for (const m of bits) { m.position.set(at.x + m.userData.v.x * k * 1.6, at.y + m.userData.v.y * k - 3.2 * k * k, at.z + m.userData.v.z * k); m.scale.setScalar(1 - k * .7); } })
      .then(() => { for (const m of bits) fxGroup.remove(m); invalidate(); });
  }
  /** The hold and the hand trading places, on the way to the game after the swap. */
  async function swapped(after) {
    const a = dock.hand, b = dock.hold;
    await tween(220, k => {
      const e = ease(k);
      if (a) a.position.set(SLOTS.hand + (SLOTS.hold - SLOTS.hand) * e, .02 + Math.sin(Math.PI * k) * .5, DOCK_Z);
      if (b) b.position.set(SLOTS.hold + (SLOTS.hand - SLOTS.hold) * e, .02 + Math.sin(Math.PI * k) * .3, DOCK_Z);
    });
    if (a) a.userData.key = null;
    if (b) b.userData.key = null;
    set(after);
  }

  // ---------- drawing: only while something moves ----------
  const invalidate = () => { if (!frame) frame = requestAnimationFrame(paint); };
  function paint(now) {
    frame = 0;
    for (let k = tweens.length - 1; k >= 0; k--) {
      const t = tweens[k], p = Math.min(1, (now - t.t0) / t.ms);
      t.step(p);
      if (p >= 1) { tweens.splice(k, 1); t.done(); }
    }
    renderer.render(scene, cam);
    if (tweens.length) invalidate();
  }

  // the camera: orthographic (far squares as big as near ones, so as easy to tap), looking over the yard at the berth;
  // framed so the yard, the dock and the tallest ship all fit, the same for every ship so nothing jumps between them
  function fit() {
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    canvas.style.width = "100%"; canvas.style.height = "100%";
    const el = THREE.MathUtils.degToRad(EL), mid = new THREE.Vector3(0, 0, 1.6);
    cam.position.copy(mid).add(new THREE.Vector3(0, Math.sin(el), Math.cos(el)).multiplyScalar(30));
    cam.lookAt(mid);
    cam.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const v = new THREE.Vector3(), keep = [[-W / 2 - .15, 0, H + .1], [W / 2 + .15, 0, H + .1], [0, 0, DOCK_Z + .7], [-3.1, 0, BERTH], [3.1, 0, BERTH], [0, 4.75, BERTH - .3], [-W / 2, 0, 0], [W / 2, 0, 0]];
    for (const [x, y, z] of keep) { v.set(x, y, z).applyMatrix4(cam.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const cx = (x0 + x1) / 2;
    let hw = (x1 - x0) / 2 + .1, hh = (y1 - y0) / 2 + .1;
    if (hw / hh > w / h) hh = hw * h / w; else hw = hh * w / h;
    Object.assign(cam, { left: cx - hw, right: cx + hw, bottom: y0 - .1, top: y0 - .1 + hh * 2 });
    cam.updateProjectionMatrix();
    invalidate();
  }
  const resizing = new ResizeObserver(() => { if (scene) fit(); });
  resizing.observe(host);

  function dispose() {
    cancelAnimationFrame(frame);
    resizing.disconnect();
    for (const g of geos.values()) g.dispose();
    for (const m of [...mats.values(), ...owned]) m.dispose();
    renderer.dispose();
    canvas.remove();
  }
  try { build(); } catch (err) { dispose(); throw err; }
  return { set, play, swapped, hover, lift, pick, where, shipWhere, theme: build, resize: fit, dispose, busy: () => tweens.length > 0, flat: false };
}
