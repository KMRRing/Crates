// Harbour's map in 3D: hex tiles, the quays' warehouses and yards, a few gabled houses and little cogs, drawn with
// three.js (vendor/three.js, kept on the device like every other file, so it plays offline). Everything is built in
// code, no models and no textures, so every colour comes from the skin: Codex or Office (the suite's
// theme), each by day and by night, and the metals' colours from the stylesheet, as the flat map has them. It answers
// the same calls as the flat map (harbour-flat.js): setLevel, draw, pick, drag, release, theme, resize, dispose. It
// draws only while something moves.
import * as THREE from "./vendor/three.js";
import { CLASSES, neighbour } from "./harbour-engine.js";

const R = 1, W = Math.sqrt(3) * R;                       // a hex: centre to corner, and across its flats
const centre = (x, y) => new THREE.Vector3(W * (x + 0.5 + (y & 1) / 2), 0, 1.5 * R * y);
const EL = 52, YAW = 18;                                  // the camera: degrees above the sea, and turned off south
const SHIP = { coaster: { len: 1.12, beam: .42 }, handy: { len: 1.5, beam: .5 } };      // a Schnigge and a Cog

// The skins. Codex: a chart in brass and navy, oak ships with a red-striped sail and brick warehouses. Office: a
// drawing office, every edge inked, flat greys and blue. At night, in both, windows and quay lamps are lit, ships carry a stern lantern, the castles glow a little, and the sea has a glow
// of its own, as moonlit water does, so it always reads against the land. Keys: hull, boot (the waterline), deck, house
// (the castles), glass (windows and lanterns), funnel (the mast and yard), band (the sail's stripe), sail; wall and roof
// are the warehouses' and the town's; pier, empty (an empty hold) and the rest are the scene's.
const SKINS = {
  codex: {
    day: { land: 0xd9cda6, grass: 0x9aae74, side: .8, plate: 0x2c3a40, water: [0x6b9aa3, 0x63929c], decor: "pine", leaf: 0x5f7f4a,
      hull: 0x5a4130, boot: 0x1d1814, deck: 0xb08f66, house: 0xc4a574, glass: 0x2b2018, funnel: 0x3a2a1f, band: 0x9b3a2d, sail: 0xf1e9d6,
      wall: 0xb3664a, roof: 0x6a4234, pier: 0x8b7b63, empty: 0xd9d4c7, sky: 0xfff4e2, ground: 0x7d745f, hemi: 1.25, sun: 0xfff0d6, sunI: 2.4, sunAt: [6, 10, 7], exposure: 1.05 },
    night: { land: 0x5c5a4a, grass: 0x3f4d3a, side: .7, plate: 0x06090b, water: [0x2b5f78, 0x285a72], seaGlow: .22, decor: "pine", leaf: 0x2b3d30,
      hull: 0x4d3828, boot: 0x120f0d, deck: 0x8c7352, house: 0xa88b5f, houseGlow: .18, glass: 0xffcf7a, funnel: 0x2a1f18, band: 0x8c3a2e, sail: 0xd8cfb8,
      wall: 0x94553f, roof: 0x4a3027, pier: 0x6d604c, empty: 0x5c5a4a, sky: 0x9fb6dd, ground: 0x2a2f36, hemi: 1.2, sun: 0xbcd2f2, sunI: 2, sunAt: [-6, 10, -3], exposure: 1.25,
      night: true, lamp: 0xffc56a },
  },
  // Office: Fluent's neutrals and its blue; flat light greys by day, charcoal at night
  office: {
    day: { land: 0xf5f5f5, grass: null, side: .92, plate: 0x8a8a8a, water: [0xdcebfa, 0xd3e5f8], decor: null,
      hull: 0x242424, boot: 0x0f6cbd, deck: 0x424242, house: 0xffffff, glass: 0x242424, funnel: 0x242424, band: 0x0f6cbd, sail: 0xffffff,
      wall: 0xffffff, roof: 0xd1d1d1, pier: 0x8a8a8a, empty: 0xd1d1d1, edge: [0x0f6cbd, .45], landEdge: [0x616161, .14], sky: 0xffffff, ground: 0xd1d1d1, hemi: 1.75, sun: 0xffffff, sunI: 1.25, sunAt: [4, 12, 6], exposure: 1 },
    night: { land: 0x2e2e2e, grass: null, side: .8, plate: 0x0a0a0a, water: [0x163454, 0x14304e], seaGlow: .25, decor: null,
      hull: 0x1f1f1f, boot: 0x479ef5, deck: 0x2b2b2b, house: 0x333333, houseGlow: .18, glass: 0x9ccbfa, funnel: 0x1f1f1f, band: 0x479ef5, sail: 0x4a4a4a,
      wall: 0x2b2b2b, roof: 0x3d3d3d, pier: 0x3d3d3d, empty: 0x333333, edge: [0x479ef5, .9], landEdge: [0x479ef5, .18], sky: 0x3a4c60, ground: 0x141414, hemi: .9, sun: 0xcfe4fb, sunI: 1.2, sunAt: [-4, 12, -3], exposure: 1,
      night: true, lamp: 0x9ccbfa },
  },
};
/** The skin in force: the suite's theme (Codex or Office) and day or night (as set, else as the device). */
export function skinNow() {
  const root = document.documentElement, theme = SKINS[root.dataset.theme] ? root.dataset.theme : "codex";
  const night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  const css = getComputedStyle(root), v = (name, or) => new THREE.Color((css.getPropertyValue(name) || "").trim() || or);
  return { name: `${theme} ${night ? "night" : "day"}`, ...SKINS[theme][night ? "night" : "day"], c0: v("--c0", "#d9a21b"), c1: v("--c1", "#3f8a55"), c2: v("--c2", "#2f6690") };
}

// a tile's height and look come from where it is, so the harbour looks the same every time it's drawn
const hash = (x, y, k = 0) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const hexGeo = (r, h) => new THREE.CylinderGeometry(r, r, h, 6, 1);       // a corner towards +z: pointy side up on the chart
const hexRing = (outer, inner, depth) => {
  const shape = new THREE.Shape(), hole = new THREE.Path();
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI / 3 * i + Math.PI / 6;
    if (i) { shape.lineTo(Math.cos(a) * outer, Math.sin(a) * outer); hole.lineTo(Math.cos(a) * inner, Math.sin(a) * inner); }
    else { shape.moveTo(Math.cos(a) * outer, Math.sin(a) * outer); hole.moveTo(Math.cos(a) * inner, Math.sin(a) * inner); }
  }
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  return g;
};

/** A gable end: a triangle w either side of its middle and `rise` high, extruded `depth` along z and centred on it. */
const tri = (w, rise, depth) => {
  const shape = new THREE.Shape();
  shape.moveTo(-w, 0); shape.lineTo(0, rise); shape.lineTo(w, 0); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
};

export function create3D(box) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });     // throws where there's no WebGL: the page draws flat
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const canvas = renderer.domElement;
  canvas.className = "hb-3d";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "The harbour");
  const labels = document.createElement("div");
  labels.className = "hb-labels";
  box.append(canvas, labels);

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100), ray = new THREE.Raycaster(), sea = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let scene = null, skin = null, L = null, G = null, mid = new THREE.Vector3(), water = [], ashore = [];
  let ships = [], last = null, ring = null, wreck = null, tankLevels = {}, tags = [], frame = 0, dragging = -1, trailGroup = null, lastTrails = null;
  const mats = new Map(), owned = [];
  const mat = (colour, extra = {}) => {                                     // one material per look, shared
    const key = `${new THREE.Color(colour).getHex()}|${JSON.stringify(extra)}`;
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: colour, roughness: .8, metalness: 0, ...extra }));
    return mats.get(key);
  };
  const glow = colour => mat(colour, { emissive: colour, emissiveIntensity: 1.2, roughness: .4 });
  // A metal's colour is the one the flat map paints it in, asked of the stylesheet (harbour.css: .pr-copper { --pr }), by
  // day or by night as the page is. One of no colour there is drawn in the theme's ochre.
  const probe = Object.assign(document.createElement("i"), { hidden: true });
  box.append(probe);
  const metals = new Map();
  const productColour = p => {
    if (!metals.has(p)) { probe.className = `pr-${p}`; const v = getComputedStyle(probe).getPropertyValue("--pr").trim(); metals.set(p, v ? new THREE.Color(v) : skin.c0.clone()); }
    return metals.get(p);
  };
  const tag = (text, at, cls, colour) => {
    const el = document.createElement("span");
    el.className = `hb-tag ${cls}`;
    el.textContent = text;
    if (colour) {                                                         // the tag takes the colour, its letters whichever of white or ink reads on it
      const h = colour.getHex();
      el.style.setProperty("--tag", `#${colour.getHexString()}`);
      el.style.setProperty("--tag-ink", ((h >> 16) & 255) * .299 + ((h >> 8) & 255) * .587 + (h & 255) * .114 > 150 ? "#1c2a34" : "#fff");
    }
    labels.appendChild(el);
    const t = { el, at };
    tags.push(t);
    return t;
  };

  // ---------- the harbour ----------
  function setLevel(level, g) {
    L = level; G = g;
    build();
  }
  function build() {
    skin = skinNow();
    for (const m of [...mats.values(), ...owned.splice(0)]) m.dispose();
    mats.clear();
    scene?.traverse(o => o.geometry?.dispose());
    labels.replaceChildren(); tags = []; ships = []; tankLevels = {}; ashore = []; metals.clear();
    scene = new THREE.Scene();
    renderer.toneMappingExposure = skin.exposure;
    const at = (x, y) => (x < 0 || y < 0 || x >= G.w || y >= G.h ? "land" : G.at(x, y));
    // The board: the water and the land round it to FADE hexes out, each ring past the first a little lower and more
    // see-through, so the land dissolves into the page rather than stopping at an edge. d: hexes from the water.
    const FADE = 4, alphaAt = d => [1, 1, .7, .4, .15][Math.min(d, FADE)], cells = [], byKey = new Map();
    for (let y = -FADE - 1; y < G.h + FADE + 1; y++) for (let x = -FADE - 1; x < G.w + FADE + 1; x++) {
      const c = { x, y, k: at(x, y), p: centre(x, y), d: Infinity };
      cells.push(c); byKey.set(`${x},${y}`, c);
    }
    const queue = cells.filter(c => c.k !== "land");
    for (const c of queue) c.d = 0;
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      if (c.d >= FADE) continue;
      for (let h = 0; h < 6; h++) { const n = neighbour(c.x, c.y, h), nc = byKey.get(`${n.x},${n.y}`); if (nc && nc.d === Infinity) { nc.d = c.d + 1; queue.push(nc); } }
    }
    const board = cells.filter(c => c.d <= FADE), land = board.filter(c => c.k === "land"), wet = board.filter(c => c.k !== "land");
    const rings = list => { const out = new Map(); for (const c of list) { const a = c.k === "land" ? alphaAt(c.d) : 1; if (!out.has(a)) out.set(a, []); out.get(a).push(c); } return out; };
    const faded = a => (a < 1 ? { transparent: true, opacity: a, depthWrite: false } : {});
    water = wet.map(c => c.p);
    mid = water.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(water.length);
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    const instanced = (geo, material, list, place, colour) => {
      const mesh = new THREE.InstancedMesh(geo, material, list.length);
      list.forEach((c, i) => { place(c, m4); mesh.setMatrixAt(i, m4); if (colour) mesh.setColorAt(i, col.set(colour(c, i))); });
      mesh.castShadow = mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    };
    // the board: a dark plate under every tile, the gaps between tiles its grout (fading with the land above it)
    for (const [a, list] of rings(board)) instanced(hexGeo(R * 1.002, .3), mat(skin.plate, { roughness: .95, ...faded(a) }), list, (c, m) => m.makeTranslation(c.p.x, -.31, c.p.z));
    // land, raised and a little uneven, its sides darker than its top, lower ring by ring away from the water; the sea
    // low, in two tones
    const height = c => (.42 + hash(c.x, c.y) * .16) * (c.d <= 1 ? 1 : 1 - .18 * (c.d - 1));
    const sideTone = new THREE.Color(skin.side, skin.side, skin.side);
    for (const [a, list] of rings(land)) {
      const mesh = instanced(hexGeo(R * .985, 1), [mat(sideTone, faded(a)), mat(0xffffff, faded(a)), mat(sideTone, faded(a))], list,
        (c, m) => m.compose(new THREE.Vector3(c.p.x, height(c) / 2 - .14, c.p.z), new THREE.Quaternion(), new THREE.Vector3(1, height(c), 1)),
        c => (skin.grass && hash(c.x, c.y, 1) < .45 ? skin.grass : skin.land));
      if (a < 1) mesh.castShadow = false;
    }
    instanced(hexGeo(R * .965, .16), mat(0xffffff, { roughness: .35, emissive: skin.water[0], emissiveIntensity: skin.seaGlow || 0 }), wet, (c, m) => m.makeTranslation(c.p.x, -.08, c.p.z),
      c => skin.water[(c.x + c.y) & 1]);
    // trees on Codex's land, none on Office's
    if (skin.decor) {
      const spots = [];
      for (const c of land) if (c.d <= 1 && hash(c.x, c.y, 2) < .5) for (let i = 0; i < 1 + Math.floor(hash(c.x, c.y, 3) * 3); i++) {
        const a = hash(c.x, c.y, 4 + i) * Math.PI * 2, d = hash(c.x, c.y, 9 + i) * .5;
        spots.push({ x: c.p.x + Math.cos(a) * d, z: c.p.z + Math.sin(a) * d, y: height(c) - .14, s: .8 + hash(c.x, c.y, 13 + i) * .5 });
      }
      const geo = new THREE.ConeGeometry(.17, .46, 6);
      instanced(geo, mat(skin.leaf), spots, (s, m) => m.compose(new THREE.Vector3(s.x, s.y + .23 * s.s, s.z), new THREE.Quaternion(), new THREE.Vector3(s.s, s.s, s.s)));
    }
    // where a quay meets the shore: the first land hex round its berth, those towards the camera first
    const shoreOf = c => { for (const h of [2, 1, 3, 0, 4, 5]) { const n = neighbour(c.x, c.y, h); if (at(n.x, n.y) === "land") return n; } return null; };
    const quays = wet.filter(c => G.jetty(c.x, c.y)), taken = new Set(quays.map(shoreOf).filter(Boolean).map(n => `${n.x},${n.y}`));
    // the town on the coast: a few gabled houses, wherever a quay's building doesn't stand
    const homes = land.filter(c => c.d <= 1 && !taken.has(`${c.x},${c.y}`) && hash(c.x, c.y, 20) < .25);
    if (homes.length) {
      const place = lift => (c, m) => {
        const a = hash(c.x, c.y, 21) * Math.PI * 2, d = .1 + hash(c.x, c.y, 22) * .25, turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.floor(hash(c.x, c.y, 23) * 6) * Math.PI / 3 + .3);
        m.compose(new THREE.Vector3(c.p.x + Math.cos(a) * d, height(c) - .14 + lift, c.p.z + Math.sin(a) * d), turn, new THREE.Vector3(1, 1, 1));
      };
      instanced(new THREE.BoxGeometry(.2, .16, .24), mat(0xffffff, { roughness: .85 }), homes, place(.08), c => col.set(skin.wall).offsetHSL(0, 0, (hash(c.x, c.y, 24) - .5) * .1));
      instanced(tri(.14, .1, .27), mat(skin.roof, { roughness: .8 }), homes, place(.16));
    }
    // Office inks every tile's top edge, and the land's corners down to the sea: the sea's lines in full, the land's faint
    // (and fading with it)
    const ink = (list, [colour, opacity]) => {
      const pts = [];
      for (const c of list) {
        const top = c.k === "land" ? height(c) - .14 : .0, r = c.k === "land" ? R * .985 : R * .965;
        for (let i = 0; i < 6; i++) {
          const a0 = Math.PI / 3 * i, a1 = Math.PI / 3 * (i + 1);
          pts.push(c.p.x + Math.sin(a0) * r, top, c.p.z + Math.cos(a0) * r, c.p.x + Math.sin(a1) * r, top, c.p.z + Math.cos(a1) * r);
          if (c.k === "land") pts.push(c.p.x + Math.sin(a0) * r, top, c.p.z + Math.cos(a0) * r, c.p.x + Math.sin(a0) * r, -.14, c.p.z + Math.cos(a0) * r);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: colour, transparent: true, opacity })));
    };
    if (skin.edge) {
      ink(wet, skin.edge);
      for (const [a, list] of rings(land)) ink(list, [skin.landEdge[0], skin.landEdge[1] * a]);
    }
    // the quays: a rim in the metal's colour round the berth, a pier to the shore and, on the shore, the trade's own
    // building. A load with a stockpile has an open yard, railed in, with the pile in it (it rises and falls with the
    // stockpile); a load with none, a warehouse, its gable to the water and a hoist under the gable; a buyer's quay, a
    // foundry (the same, with a chimney). A treadwheel crane stands beside each.
    for (const c of quays) {
      const j = G.jetty(c.x, c.y);
      const colour = j.kind === "load" ? productColour(j.product) : skin.c2;
      const rim = new THREE.Mesh(hexRing(R * .965, R * .8, .07), mat(colour, { roughness: .5 }));
      rim.position.set(c.p.x, -.01, c.p.z); rim.castShadow = rim.receiveShadow = true; scene.add(rim);
      const shore = shoreOf(c);
      const s = shore ? centre(shore.x, shore.y) : c.p.clone().add(new THREE.Vector3(0, 0, -1.5)), ground = shore ? height(byKey.get(`${shore.x},${shore.y}`)) - .14 : 0;
      const half = c.p.clone().lerp(s, .5), pier = new THREE.Mesh(new THREE.BoxGeometry(.18, .08, c.p.distanceTo(s) * .7), mat(skin.pier));
      pier.position.set(half.x, .06, half.z); pier.lookAt(s.x, .06, s.z); pier.castShadow = pier.receiveShadow = true; scene.add(pier);
      const towards = s.clone().sub(c.p).normalize(), end = c.p.clone().addScaledVector(towards, .32);
      if (skin.night) { const lamp = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: skin.lamp })); lamp.position.set(end.x, .2, end.z); scene.add(lamp); }
      const yard = new THREE.Group();
      yard.position.set(s.x, ground, s.z);
      yard.rotation.y = Math.atan2(-towards.x, -towards.z);                       // its front, local +z, faces the berth
      scene.add(yard);
      const put = (geo, material, x, y, z) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; yard.add(m); return m; };
      const inked = m => {                                                          // Office draws every edge
        if (skin.edge) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), new THREE.LineBasicMaterial({ color: skin.edge[0], transparent: true, opacity: skin.edge[1] })); e.position.copy(m.position); e.rotation.copy(m.rotation); yard.add(e); }
        return m;
      };
      const lit = colour => (skin.night ? glow(colour) : mat(colour, { roughness: .5 }));
      if (j.tank) {
        const rail = mat(skin.pier);
        for (const [x, z, w, d] of [[0, .3, .64, .04], [0, -.3, .64, .04], [.32, 0, .04, .6], [-.32, 0, .04, .6]]) inked(put(new THREE.BoxGeometry(w, .12, d), rail, x, .06, z));
        const pile = put(new THREE.CylinderGeometry(.15, .27, 1, 4), mat(colour, { roughness: .35, metalness: .3 }), 0, .03, 0);   // a squat pyramid of ingots
        pile.rotation.y = Math.PI / 4; pile.scale.y = .001;
        tankLevels[G.at(c.x, c.y)] = { liquid: pile, ground: 0, cap: j.tank.cap };
      } else {
        inked(put(new THREE.BoxGeometry(.46, .5, .5), mat(skin.wall, { roughness: .85 }), 0, .25, 0));
        inked(put(tri(.28, .24, .58), mat(skin.roof, { roughness: .8 }), 0, .5, 0));
        put(new THREE.BoxGeometry(.48, .07, .02), lit(colour), 0, .36, .255);                // the stripe, in the metal's colour
        put(new THREE.BoxGeometry(.12, .2, .02), mat(skin.funnel), 0, .1, .26);              // the door
        for (const x of [-.14, .14]) put(new THREE.BoxGeometry(.07, .09, .02), skin.night ? glow(skin.glass) : mat(skin.glass), x, .2, .26);
        put(new THREE.BoxGeometry(.04, .04, .22), mat(skin.pier), 0, .66, .31);                 // the hoist under the gable
        put(new THREE.CylinderGeometry(.006, .006, .14, 6), mat(skin.funnel), 0, .58, .4);
        if (j.kind !== "load") {
          put(new THREE.CylinderGeometry(.045, .055, .34, 10), mat(skin.roof), .14, .72, -.12);   // the foundry's chimney, lit at its mouth by night
          if (skin.night) put(new THREE.CylinderGeometry(.04, .04, .02, 10), glow(skin.lamp), .14, .89, -.12);
        }
      }
      put(new THREE.BoxGeometry(.07, .6, .07), mat(skin.pier), .55, .3, .05);                // the crane: mast, jib, rope
      const jib = put(new THREE.BoxGeometry(.045, .045, .46), mat(skin.pier), .55, .66, .27);
      jib.rotation.x = -.2;
      put(new THREE.CylinderGeometry(.007, .007, .2, 6), mat(skin.funnel), .55, .53, .48);
      tag(G.at(c.x, c.y), new THREE.Vector3(s.x, ground + .95, s.z), "hb-tag-jetty", colour);
      ashore.push(new THREE.Vector3(s.x, ground + 1.1, s.z));                       // the framing keeps the building and its label in view
    }
    // the light: a sun (a moon at night) casting soft shadows, and a sky-and-ground fill
    scene.add(new THREE.HemisphereLight(skin.sky, skin.ground, skin.hemi));
    const sun = new THREE.DirectionalLight(skin.sun, skin.sunI);
    sun.position.copy(mid).add(new THREE.Vector3(...skin.sunAt));
    sun.target.position.copy(mid);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.radius = 3;
    sun.shadow.bias = -.0005;
    const reach = Math.max(G.w, G.h) * 1.6 + 2 * FADE + 3;
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 40 });
    scene.add(sun, sun.target);
    // the picked ship's ring on the water, and the crash's
    ring = new THREE.Mesh(hexRing(R * .93, R * .8, .03), skin.night ? glow(skin.glass) : mat(skin.funnel));   // in ink by day, lit by night
    ring.visible = false; scene.add(ring);
    wreck = new THREE.Mesh(hexRing(R * .99, R * .74, .06), new THREE.MeshBasicMaterial({ color: 0xd8432f }));
    wreck.visible = false; scene.add(wreck);
    trailGroup = new THREE.Group();
    scene.add(trailGroup);
    fit();
    if (last) draw({ ...last, still: true });
    if (lastTrails) trails(...lastTrails);
  }

  /** Each ship's route over a loop, as a faint line on the water through the hexes it passes; the picked ship's stronger. */
  function trails(paths, sel = -1, dot = false) {
    lastTrails = [paths, sel, dot];
    if (!trailGroup) return;
    for (const c of trailGroup.children) { c.geometry.dispose(); c.material.dispose(); }
    trailGroup.clear();
    paths.forEach((pts, i) => {
      const xyz = [];
      for (let k = 1; k < pts.length; k++) {
        const a = centre(pts[k - 1].x, pts[k - 1].y), b = centre(pts[k].x, pts[k].y);
        if (a.equals(b)) continue;                                  // an hour waited or loaded: no line
        xyz.push(a.x, .05, a.z, b.x, .05, b.z);
      }
      if (!xyz.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(xyz, 3));
      trailGroup.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: skin.night ? skin.glass : skin.funnel, transparent: true, opacity: i === sel ? 1 : .45 })));
    });
    if (dot && paths[sel]?.length) {                       // where the picked ship's route goes on from
      const e = paths[sel].at(-1), c = centre(e.x, e.y);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(.24, .24, .03, 24), new THREE.MeshBasicMaterial({ color: skin.night ? skin.glass : skin.funnel }));
      m.position.set(c.x, .06, c.z);
      trailGroup.add(m);
    }
    invalidate();
  }

  // ---------- ships ----------
  function makeShip(type, i) {
    const { len, beam } = SHIP[type], g = new THREE.Group(), shape = new THREE.Shape();
    // a cog's plan: a flat stern, full sides, a rounded bow
    shape.moveTo(-len / 2, -beam * .42); shape.lineTo(-len * .22, -beam / 2); shape.lineTo(len * .14, -beam / 2);
    shape.quadraticCurveTo(len * .44, -beam * .46, len / 2, 0); shape.quadraticCurveTo(len * .44, beam * .46, len * .14, beam / 2);
    shape.lineTo(-len * .22, beam / 2); shape.lineTo(-len / 2, beam * .42); shape.lineTo(-len / 2, -beam * .42);
    const solid = (geo, material, y) => { const m = new THREE.Mesh(geo, material); m.position.y = y; m.castShadow = true; g.add(m); return m; };
    const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: .2, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 2 });
    hullGeo.rotateX(-Math.PI / 2);
    const hullMat = mat(skin.hull, { roughness: .55 }).clone();                 // its own, so a crash or a scrap can tint it
    owned.push(hullMat);
    const hull = solid(hullGeo, hullMat, -.05);
    const bootGeo = new THREE.ExtrudeGeometry(shape, { depth: .05, bevelEnabled: false });
    bootGeo.rotateX(-Math.PI / 2);
    solid(bootGeo, mat(skin.boot), -.07).scale.set(1.04, 1, 1.08);
    const deckGeo = new THREE.ShapeGeometry(shape);
    deckGeo.rotateX(-Math.PI / 2);
    const deck = solid(deckGeo, mat(skin.deck), .171);
    deck.scale.set(.94, 1, .86); deck.castShadow = false;
    // the stern castle with its window slit, the forecastle, and the one mast with its yard and square sail (striped)
    solid(new THREE.BoxGeometry(.24, .22, beam * .8), mat(skin.house, { roughness: .6, emissive: skin.house, emissiveIntensity: skin.houseGlow || 0 }), .3).position.x = -len / 2 + .17;
    solid(new THREE.BoxGeometry(.02, .05, beam * .6), skin.night ? glow(skin.glass) : mat(skin.glass), .36).position.x = -len / 2 + .295;
    solid(new THREE.BoxGeometry(.16, .13, beam * .62), mat(skin.house, { roughness: .6 }), .245).position.x = len / 2 - .2;
    const mast = -len * .04;
    solid(new THREE.CylinderGeometry(.026, .034, .66, 8), mat(skin.funnel), .5).position.x = mast;
    solid(new THREE.BoxGeometry(.03, .03, beam * 1.05), mat(skin.funnel), .8).position.x = mast;
    solid(new THREE.BoxGeometry(.02, .3, beam * .94), mat(skin.sail, { roughness: .95 }), .64).position.x = mast + .025;
    solid(new THREE.BoxGeometry(.026, .075, beam * .94), mat(skin.band, { roughness: .8 }), .64).position.x = mast + .025;
    if (skin.night) for (const [x, y] of [[-len / 2 + .06, .46], [mast, .87]]) {        // a lantern aft and one at the masthead
      const light = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshBasicMaterial({ color: skin.lamp }));
      light.position.set(x, y, 0); g.add(light);
    }
    if (skin.edge) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(hullGeo, 30), new THREE.LineBasicMaterial({ color: skin.edge[0], transparent: true, opacity: skin.edge[1] }));
      e.position.y = -.05; g.add(e);
    }
    const cargo = new THREE.Group();
    g.add(cargo);
    g.userData = { type, hullMat, cargo, cargoKey: null };
    scene.add(g);
    return { g, type, tag: tag(String(i + 1), new THREE.Vector3(), "hb-tag-ship"), from: null, to: null, t0: 0, dur: 0, x: 0, y: 0 };
  }
  // the cargo: a trunk along the deck, a stretch per product as long as its share of the ship, the rest empty
  function loadCargo(s, cargo) {
    const key = JSON.stringify(cargo || {});
    if (s.g.userData.cargoKey === key) return;
    s.g.userData.cargoKey = key;
    const box = s.g.userData.cargo, { len, beam } = SHIP[s.type], cap = CLASSES[s.type].cap, long = len * .56;
    box.children.forEach(m => m.geometry.dispose());
    box.clear();
    let x = -len * .2 - long / 2 + .1;
    const piece = (w, colour) => {
      if (w <= .001) return;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, .1, beam * .5), mat(colour, { roughness: .6 }));
      m.position.set(x + w / 2, .22, 0); m.castShadow = true; box.add(m);
      x += w;
    };
    let full = 0;
    for (const [p, u] of Object.entries(cargo || {})) { if (u > 0) { piece(long * u / cap, productColour(p)); full += u; } }
    piece(long * (1 - full / cap), skin.empty);
  }
  const angle = h => (h ?? 0) * Math.PI / 3;

  /** ships: [{ x, y, h, type, cargo }], sel: the picked ship (or -1), crash: the run's crash (or null), tanks: each
   *  stockpile's level by its quay's letter, still: no gliding (an edit), ms: how long a glide takes. */
  function draw(state) {
    last = { ...state };
    const { ships: list, sel, crash, tanks, still, ms } = state, now = performance.now();
    while (ships.length > list.length) { const s = ships.pop(); scene.remove(s.g); s.tag.el.remove(); tags.splice(tags.indexOf(s.tag), 1); }
    list.forEach((p, i) => {
      if (ships[i] && ships[i].type !== p.type) { scene.remove(ships[i].g); ships[i].tag.el.remove(); tags.splice(tags.indexOf(ships[i].tag), 1); ships[i] = null; }
      const fresh = !ships[i];
      const s = ships[i] ||= makeShip(p.type, i);
      loadCargo(s, p.cargo);
      const to = { pos: centre(p.x, p.y), rot: angle(p.h) };
      if (fresh || still || dragging === i) { s.g.position.copy(to.pos); s.g.rotation.y = to.rot; s.from = s.to = null; }
      else { s.from = { pos: s.g.position.clone(), rot: s.g.rotation.y }; s.to = to; s.t0 = now; s.dur = ms; }
      s.x = p.x; s.y = p.y;
      const hit = !!crash?.ships.includes(i);
      s.g.userData.hullMat.emissive.set(hit ? 0xd8432f : 0x000000);
      s.g.userData.hullMat.emissiveIntensity = hit ? .6 : 0;
    });
    const picked = sel >= 0 && list[sel];
    ring.visible = !!picked;
    if (picked) ring.position.copy(centre(picked.x, picked.y)).setY(.012);
    wreck.visible = !!crash;
    if (crash) wreck.position.copy(centre(crash.at[0], crash.at[1])).setY(.02);
    for (const [k, t] of Object.entries(tankLevels)) {
      const f = Math.max(.001, Math.min(1, (tanks?.[k] || 0) / t.cap)) * .5;
      t.liquid.scale.y = f;
      t.liquid.position.y = t.ground + .03 + f / 2;
    }
    dragging = -1;
    invalidate();
  }

  // ---------- drawing: only while something glides ----------
  const invalidate = () => { if (!frame) frame = requestAnimationFrame(paint); };
  const ease = k => k * k * (3 - 2 * k);
  function paint(now) {
    frame = 0;
    let moving = false;
    for (const s of ships) {
      if (!s.to || dragging === ships.indexOf(s)) continue;
      const k = Math.min(1, (now - s.t0) / Math.max(1, s.dur)), e = ease(k);
      s.g.position.lerpVectors(s.from.pos, s.to.pos, e);
      const d = Math.atan2(Math.sin(s.to.rot - s.from.rot), Math.cos(s.to.rot - s.from.rot));   // the short way round
      s.g.rotation.y = s.from.rot + d * e;
      if (k < 1) moving = true; else s.from = s.to = null;
    }
    renderer.render(scene, cam);
    for (const s of ships) s.tag.at.copy(s.g.position).setY(s.g.position.y + 1.02);      // over the mast's head
    const w = canvas.clientWidth, h = canvas.clientHeight, v = new THREE.Vector3();
    for (const t of tags) { v.copy(t.at).project(cam); t.el.style.transform = `translate(${((v.x + 1) / 2 * w).toFixed(1)}px, ${((1 - v.y) / 2 * h).toFixed(1)}px) translate(-50%, -50%)`; }
    if (moving) invalidate();
  }

  // the camera: orthographic (far hexes as big as near ones, so as easy to tap), tilted and turned, fitted to the water
  function fit() {
    const w = Math.max(1, box.clientWidth), h = Math.max(1, box.clientHeight);
    renderer.setSize(w, h, false);
    canvas.style.width = "100%"; canvas.style.height = "100%";
    const el = THREE.MathUtils.degToRad(EL), yaw = THREE.MathUtils.degToRad(YAW);
    cam.position.copy(mid).add(new THREE.Vector3(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el)).multiplyScalar(30));
    cam.lookAt(mid);
    cam.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const v = new THREE.Vector3();
    for (const p of water) for (let i = 0; i < 6; i++) for (const up of [.6, -.2]) {
      const a = Math.PI / 3 * i;
      v.set(p.x + Math.sin(a) * R * 1.5, up, p.z + Math.cos(a) * R * 1.5).applyMatrix4(cam.matrixWorldInverse);   // room for the edge's fade
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    for (const p of ashore) { v.copy(p).applyMatrix4(cam.matrixWorldInverse); x0 = Math.min(x0, v.x - .5); x1 = Math.max(x1, v.x + .5); y0 = Math.min(y0, v.y - .5); y1 = Math.max(y1, v.y + .35); }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    let hw = (x1 - x0) / 2, hh = (y1 - y0) / 2;
    if (hw / hh > w / h) hh = hw * h / w; else hw = hh * w / h;
    Object.assign(cam, { left: cx - hw, right: cx + hw, top: cy + hh, bottom: cy - hh });
    cam.updateProjectionMatrix();
    invalidate();
  }
  const resizing = new ResizeObserver(() => { if (scene) fit(); });
  resizing.observe(box);

  // ---------- taps and drags ----------
  const ndc = e => { const r = canvas.getBoundingClientRect(); return new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
  const onSea = e => { ray.setFromCamera(ndc(e), cam); return ray.ray.intersectPlane(sea, new THREE.Vector3()); };
  function hexAt(px, pz) {
    const y0 = Math.round(pz / 1.5);
    let best = null;
    for (let y = y0 - 1; y <= y0 + 1; y++) {
      const x0 = Math.round(px / W - .5 - (y & 1) / 2);
      for (let x = x0 - 1; x <= x0 + 1; x++) { const c = centre(x, y), d = (c.x - px) ** 2 + (c.z - pz) ** 2; if (!best || d < best.d) best = { x, y, d }; }
    }
    return { x: best.x, y: best.y };
  }
  // a tap on a ship is that ship's hex (its deckhouse stands above the hex behind it); anywhere else, the hex under it
  function pick(e) {
    ray.setFromCamera(ndc(e), cam);
    const hit = ray.intersectObjects(ships.map(s => s.g), true)[0];
    if (hit && dragging < 0) { let o = hit.object; while (o.parent && !ships.some(s => s.g === o)) o = o.parent; const s = ships.find(t => t.g === o); if (s) return { x: s.x, y: s.y }; }
    const p = onSea(e);
    return p ? hexAt(p.x, p.z) : null;
  }
  function drag(i, e, scrap) {
    const s = ships[i], p = onSea(e);
    if (!s || !p) return;
    dragging = i;
    s.from = s.to = null;
    s.g.position.set(p.x, .14, p.z);
    s.g.userData.hullMat.emissive.set(scrap ? 0xd8432f : 0x000000);
    s.g.userData.hullMat.emissiveIntensity = scrap ? .7 : 0;
    invalidate();
  }
  function release() { dragging = -1; }
  /** Where a hex's centre is on screen, in page pixels (for tests, and hints that point at a hex). */
  function where(x, y) {
    const v = centre(x, y).project(cam), r = canvas.getBoundingClientRect();
    return { clientX: r.left + (v.x + 1) / 2 * r.width, clientY: r.top + (1 - v.y) / 2 * r.height };
  }

  function dispose() {
    cancelAnimationFrame(frame);
    resizing.disconnect();
    scene?.traverse(o => o.geometry?.dispose());
    for (const m of [...mats.values(), ...owned]) m.dispose();
    renderer.dispose();
    canvas.remove(); labels.remove(); probe.remove();
  }
  return { setLevel, draw, pick, drag, release, where, trails, theme: () => { if (L) build(); }, resize: fit, dispose, flat: false };
}
