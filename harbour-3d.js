// Harbour's map in 3D: hex tiles, the jetties' shore tanks and little ships, drawn with three.js (vendor/three.js, kept
// on the device like every other file, so it plays offline). Everything is built in code, no models and no textures, so
// every colour comes from the skin: Almanac, Modern or Kontor (the suite's theme), each by day and by night, and the
// products' colours from the theme itself. It answers the same calls as the flat map (harbour-flat.js): setLevel, draw,
// pick, drag, release, theme, resize, dispose. It draws only while something moves.
import * as THREE from "./vendor/three.js";
import { CLASSES, neighbour } from "./harbour-engine.js";

const R = 1, W = Math.sqrt(3) * R;                       // a hex: centre to corner, and across its flats
const centre = (x, y) => new THREE.Vector3(W * (x + 0.5 + (y & 1) / 2), 0, 1.5 * R * y);
const EL = 52, YAW = 18;                                  // the camera: degrees above the sea, and turned off south
const SHIP = { coaster: { len: 1.12, beam: .42 }, handy: { len: 1.5, beam: .5 } };

// The skins. Almanac: a chart in brass and navy, ships with red boot-topping. Modern: an architect's white model.
// Kontor: a drawing office, every edge inked; at night a green trace on black. At night, in all three, windows and
// jetty lamps are lit, ships carry their sidelights (red to port, green to starboard), deckhouses glow a little, and the
// sea has a glow of its own, as moonlit water does, so it always reads against the land.
const SKINS = {
  almanac: {
    day: { land: 0xd9cda6, grass: 0x9aae74, side: .8, plate: 0x2c3a40, water: [0x5f97ab, 0x5891a5], decor: "pine", leaf: 0x5f7f4a,
      hull: 0x24323e, boot: 0x9b4434, deck: 0x9b4434, house: 0xf4efe3, glass: 0x2b3a47, funnel: 0x24323e, band: 0xc8892a,
      tank: 0xf2eee4, pier: 0x8b7b63, empty: 0xd9d4c7, sky: 0xfff4e2, ground: 0x7d745f, hemi: 1.25, sun: 0xfff0d6, sunI: 2.4, sunAt: [6, 10, 7], exposure: 1.05 },
    night: { land: 0x5c5a4a, grass: 0x3f4d3a, side: .7, plate: 0x06090b, water: [0x2b5f78, 0x285a72], seaGlow: .22, decor: "pine", leaf: 0x2b3d30,
      hull: 0x24323e, boot: 0x7a3a2e, deck: 0x7a3a2e, house: 0xe6dcc6, houseGlow: .18, glass: 0xffcf7a, funnel: 0x1a2530, band: 0xc8892a,
      tank: 0xc9c0a8, pier: 0x6d604c, empty: 0x5c5a4a, sky: 0x9fb6dd, ground: 0x2a2f36, hemi: 1.2, sun: 0xbcd2f2, sunI: 2, sunAt: [-6, 10, -3], exposure: 1.25,
      night: true, lamp: 0xffc56a },
  },
  modern: {
    day: { land: 0xf3f4f2, grass: 0xe8ecea, side: .86, plate: 0xbcc6cb, water: [0x8fbfd3, 0x88b8cc], decor: "shrub", leaf: 0xc4d4cb,
      hull: 0xfbfbf9, boot: 0x1c2a34, deck: 0xc9d1d5, house: 0xffffff, glass: 0x1c2a34, funnel: 0x1c2a34, band: 0xa23c30,
      tank: 0xffffff, pier: 0xc9d1d5, empty: 0xe4e7e7, sky: 0xffffff, ground: 0xb9c3c8, hemi: 1.45, sun: 0xffffff, sunI: 2, sunAt: [3, 12, 5], exposure: 1 },
    night: { land: 0x3a4651, grass: 0x36424c, side: .75, plate: 0x080c0f, water: [0x27566e, 0x245168], seaGlow: .22, decor: "shrub", leaf: 0x3b5249,
      hull: 0xdce3e8, boot: 0x0b1014, deck: 0x46545f, house: 0xf2f5f7, houseGlow: .15, glass: 0xcfe8ff, funnel: 0x1c2a34, band: 0xa23c30,
      tank: 0x52606b, pier: 0x46545f, empty: 0x3a4651, sky: 0xa4b8c9, ground: 0x1a2228, hemi: 1.15, sun: 0xc8dbef, sunI: 1.8, sunAt: [-5, 11, -3], exposure: 1.2,
      night: true, lamp: 0xcfe8ff },
  },
  kontor: {
    day: { land: 0xe4eae6, grass: null, side: .9, plate: 0x93a39a, water: [0xb2cabd, 0xabc4b6], decor: null,
      hull: 0x111a15, boot: 0x2eb36a, deck: 0x2e3b33, house: 0xffffff, glass: 0x111a15, funnel: 0x111a15, band: 0x2eb36a,
      tank: 0xffffff, pier: 0x93a39a, empty: 0xc9d2cc, edge: [0x1e7a45, .55], sky: 0xffffff, ground: 0xc9d2cc, hemi: 1.75, sun: 0xffffff, sunI: 1.25, sunAt: [4, 12, 6], exposure: 1 },
    night: { land: 0x18231c, grass: null, side: .8, plate: 0x030504, water: [0x1d4a33, 0x1b452f], seaGlow: .3, decor: null,
      hull: 0x15201a, boot: 0x3dd884, deck: 0x1f2c24, house: 0x22302a, houseGlow: .2, glass: 0x6bffb0, funnel: 0x15201a, band: 0x3dd884,
      tank: 0x1f2c24, pier: 0x2c3d33, empty: 0x22302a, edge: [0x3dd884, .95], sky: 0x4f7a60, ground: 0x0b100d, hemi: .9, sun: 0xa8f0c8, sunI: 1.2, sunAt: [-4, 12, -3], exposure: 1.25,
      night: true, lamp: 0x6bffb0 },
  },
};
/** The skin in force: the suite's theme (Almanac unless Modern or Kontor) and day or night (as set, else as the device). */
export function skinNow() {
  const root = document.documentElement, theme = SKINS[root.dataset.theme] ? root.dataset.theme : "almanac";
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
  let ships = [], last = null, ring = null, wreck = null, tankLevels = {}, tags = [], frame = 0, dragging = -1;
  const mats = new Map(), owned = [];
  const mat = (colour, extra = {}) => {                                     // one material per look, shared
    const key = `${new THREE.Color(colour).getHex()}|${JSON.stringify(extra)}`;
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: colour, roughness: .8, metalness: 0, ...extra }));
    return mats.get(key);
  };
  const glow = colour => mat(colour, { emissive: colour, emissiveIntensity: 1.2, roughness: .4 });
  const productColour = p => (p === "fame" ? skin.c1 : skin.c0);
  const tag = (text, at, cls, colour) => {
    const el = document.createElement("span");
    el.className = `hb-tag ${cls}`;
    el.textContent = text;
    if (colour) el.style.setProperty("--tag", `#${colour.getHexString()}`);
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
    labels.replaceChildren(); tags = []; ships = []; tankLevels = {}; ashore = [];
    scene = new THREE.Scene();
    renderer.toneMappingExposure = skin.exposure;
    const at = (x, y) => (x < 0 || y < 0 || x >= G.w || y >= G.h ? "land" : G.at(x, y));
    const cells = [];
    for (let y = -1; y <= G.h; y++) for (let x = -1; x <= G.w; x++) cells.push({ x, y, k: at(x, y), p: centre(x, y) });
    const land = cells.filter(c => c.k === "land"), wet = cells.filter(c => c.k !== "land");
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
    // the board: a dark plate under every tile, the gaps between tiles its grout
    instanced(hexGeo(R * 1.002, .3), mat(skin.plate, { roughness: .95 }), cells, (c, m) => m.makeTranslation(c.p.x, -.31, c.p.z));
    // land, raised and a little uneven, its sides darker than its top; the sea low, in two tones
    const height = c => .42 + hash(c.x, c.y) * .16;
    const sideTone = new THREE.Color(skin.side, skin.side, skin.side);
    instanced(hexGeo(R * .985, 1), [mat(sideTone), mat(0xffffff), mat(sideTone)], land,
      (c, m) => m.compose(new THREE.Vector3(c.p.x, height(c) / 2 - .14, c.p.z), new THREE.Quaternion(), new THREE.Vector3(1, height(c), 1)),
      c => (skin.grass && hash(c.x, c.y, 1) < .45 ? skin.grass : skin.land));
    instanced(hexGeo(R * .965, .16), mat(0xffffff, { roughness: .35, emissive: skin.water[0], emissiveIntensity: skin.seaGlow || 0 }), wet, (c, m) => m.makeTranslation(c.p.x, -.08, c.p.z),
      c => skin.water[(c.x + c.y) & 1]);
    // trees on Almanac's land, shrubs on Modern's, none on Kontor's
    if (skin.decor) {
      const spots = [];
      for (const c of land) if (hash(c.x, c.y, 2) < .5) for (let i = 0; i < 1 + Math.floor(hash(c.x, c.y, 3) * 3); i++) {
        const a = hash(c.x, c.y, 4 + i) * Math.PI * 2, d = hash(c.x, c.y, 9 + i) * .5;
        spots.push({ x: c.p.x + Math.cos(a) * d, z: c.p.z + Math.sin(a) * d, y: height(c) - .14, s: .8 + hash(c.x, c.y, 13 + i) * .5 });
      }
      const geo = skin.decor === "pine" ? new THREE.ConeGeometry(.17, .46, 6) : new THREE.IcosahedronGeometry(.17, 0);
      instanced(geo, mat(skin.leaf), spots, (s, m) => m.compose(new THREE.Vector3(s.x, s.y + (skin.decor === "pine" ? .23 : .12) * s.s, s.z), new THREE.Quaternion(), new THREE.Vector3(s.s, s.s, s.s)));
    }
    // Kontor inks every tile's top edge, and the land's corners down to the sea
    if (skin.edge) {
      const pts = [];
      for (const c of cells) {
        const top = c.k === "land" ? height(c) - .14 : .0, r = c.k === "land" ? R * .985 : R * .965;
        for (let i = 0; i < 6; i++) {
          const a0 = Math.PI / 3 * i, a1 = Math.PI / 3 * (i + 1);
          pts.push(c.p.x + Math.sin(a0) * r, top, c.p.z + Math.cos(a0) * r, c.p.x + Math.sin(a1) * r, top, c.p.z + Math.cos(a1) * r);
          if (c.k === "land") pts.push(c.p.x + Math.sin(a0) * r, top, c.p.z + Math.cos(a0) * r, c.p.x + Math.sin(a0) * r, -.14, c.p.z + Math.cos(a0) * r);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: skin.edge[0], transparent: true, opacity: skin.edge[1] })));
    }
    // the jetties: a rim in the jetty's colour round its berth, a pier to the shore, and a shore tank banded in the same
    // colour; a refinery's tank is glass, so its level shows
    for (const c of wet) {
      const j = G.jetty(c.x, c.y);
      if (!j) continue;
      const colour = j.kind === "load" ? productColour(j.product) : skin.c2;
      const rim = new THREE.Mesh(hexRing(R * .965, R * .8, .07), mat(colour, { roughness: .5 }));
      rim.position.set(c.p.x, -.01, c.p.z); rim.castShadow = rim.receiveShadow = true; scene.add(rim);
      let shore = null;
      for (const h of [2, 1, 3, 0, 4, 5]) { const n = neighbour(c.x, c.y, h); if (at(n.x, n.y) === "land") { shore = n; break; } }
      const s = shore ? centre(shore.x, shore.y) : c.p.clone().add(new THREE.Vector3(0, 0, -1.5)), ground = shore ? height({ x: shore.x, y: shore.y }) - .14 : 0;
      const half = c.p.clone().lerp(s, .5), pier = new THREE.Mesh(new THREE.BoxGeometry(.18, .08, c.p.distanceTo(s) * .7), mat(skin.pier));
      pier.position.set(half.x, .06, half.z); pier.lookAt(s.x, .06, s.z); pier.castShadow = pier.receiveShadow = true; scene.add(pier);
      const towards = s.clone().sub(c.p).normalize(), end = c.p.clone().addScaledVector(towards, .32);
      if (skin.night) { const lamp = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), new THREE.MeshBasicMaterial({ color: skin.lamp })); lamp.position.set(end.x, .2, end.z); scene.add(lamp); }
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .55, 24), j.tank ? mat(skin.tank, { transparent: true, opacity: .4, roughness: .2 }) : mat(skin.tank, { roughness: .5 }));
      shell.position.set(s.x, ground + .275, s.z); shell.castShadow = true; scene.add(shell);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.346, .346, .1, 24), skin.night ? glow(colour) : mat(colour, { roughness: .5 }));
      band.position.set(s.x, ground + .5, s.z); scene.add(band);
      if (skin.edge) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(shell.geometry, 30), new THREE.LineBasicMaterial({ color: skin.edge[0], transparent: true, opacity: skin.edge[1] })); e.position.copy(shell.position); scene.add(e); }
      if (j.tank) {
        const liquid = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, 1, 24), mat(colour, { roughness: .3 }));
        liquid.position.set(s.x, ground, s.z); liquid.scale.y = .001; scene.add(liquid);
        tankLevels[G.at(c.x, c.y)] = { liquid, ground, cap: j.tank.cap };
      }
      tag(G.at(c.x, c.y), new THREE.Vector3(s.x, ground + .85, s.z), "hb-tag-jetty", colour);
      ashore.push(new THREE.Vector3(s.x, ground + 1, s.z));                       // the framing keeps the tank and its label in view
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
    const reach = Math.max(G.w, G.h) * 1.6 + 3;
    Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: 40 });
    scene.add(sun, sun.target);
    // the picked ship's ring on the water, and the crash's
    ring = new THREE.Mesh(hexRing(R * .93, R * .8, .03), skin.night ? glow(skin.glass) : mat(skin.funnel));   // in ink by day, lit by night
    ring.visible = false; scene.add(ring);
    wreck = new THREE.Mesh(hexRing(R * .99, R * .74, .06), new THREE.MeshBasicMaterial({ color: 0xd8432f }));
    wreck.visible = false; scene.add(wreck);
    fit();
    if (last) draw({ ...last, still: true });
  }

  // ---------- ships ----------
  function makeShip(type, i) {
    const { len, beam } = SHIP[type], g = new THREE.Group(), shape = new THREE.Shape();
    shape.moveTo(-len / 2, -beam / 2); shape.lineTo(len / 2 - beam * .7, -beam / 2);
    shape.quadraticCurveTo(len / 2, -beam / 2, len / 2, 0); shape.quadraticCurveTo(len / 2, beam / 2, len / 2 - beam * .7, beam / 2);
    shape.lineTo(-len / 2, beam / 2); shape.lineTo(-len / 2, -beam / 2);
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
    solid(new THREE.BoxGeometry(.24, .26, beam * .78), mat(skin.house, { roughness: .5, emissive: skin.house, emissiveIntensity: skin.houseGlow || 0 }), .3).position.x = -len / 2 + .2;
    solid(new THREE.BoxGeometry(.02, .05, beam * .62), skin.night ? glow(skin.glass) : mat(skin.glass), .38).position.x = -len / 2 + .325;
    solid(new THREE.CylinderGeometry(.055, .065, .2, 12), mat(skin.funnel), .52).position.x = -len / 2 + .12;
    solid(new THREE.CylinderGeometry(.059, .061, .05, 12), mat(skin.band), .56).position.x = -len / 2 + .12;
    if (skin.night) for (const [z, colour] of [[-beam * .42, 0xff3b2f], [beam * .42, 0x3dff7a]]) {        // port red, starboard green
      const light = new THREE.Mesh(new THREE.SphereGeometry(.035, 8, 6), new THREE.MeshBasicMaterial({ color: colour }));
      light.position.set(-len / 2 + .3, .38, z); g.add(light);
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
   *  refinery tank's level by its jetty's letter, still: no gliding (an edit), ms: how long a glide takes. */
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
    for (const s of ships) s.tag.at.copy(s.g.position).setY(s.g.position.y + .78);
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
      v.set(p.x + Math.sin(a) * R * 1.2, up, p.z + Math.cos(a) * R * 1.2).applyMatrix4(cam.matrixWorldInverse);
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
    canvas.remove(); labels.remove();
  }
  return { setLevel, draw, pick, drag, release, where, theme: () => { if (L) build(); }, resize: fit, dispose, flat: false };
}
