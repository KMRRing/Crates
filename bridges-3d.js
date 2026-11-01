// Bridges as a model, drawn with three.js (vendor/three.js, kept on the device, so it works offline): the chart's islands as
// a relief map's, hills in terraces like contour lines, timber bridges on piles, a viaduct as a stone arcade high over the low
// bridges, and on the water, slowly, seventeenth-century merchantmen: one on each part of a fairway, to and fro between its
// buoys, and others sailing right round the archipelago. It is a view of the puzzle, not a second way to play: the page
// (bridges.js) builds bridges on the chart, and this shows what stands. Drag to turn it.
// The page calls set(layout, grid, …) for a new puzzle and update(marks, breaks) after a change; this file builds every
// link's bridges once (a single and a double), and a change only shows and hides them. It draws only while it is on screen
// and nothing has paused it (the menu, a hidden tab), at most thirty frames a second: the ships go slowly.
// Throws where there is no WebGL (the page then keeps the chart).
import * as THREE from "./vendor/three.js";
import { cellXZ, labelOf, routesOf, shipAt, buoysOf, piersOf, wallOutline } from "./bridges-model.js";

const DEG = Math.PI / 180;
const DOUBLE_SIDE = 2;                           // THREE.DoubleSide (not in the bundle's exports)
const MIN_EL = 24 * DEG, MAX_EL = 80 * DEG, FOV = 30 * DEG;
const FRAME_MS = 1000 / 30;
const DECK = 0.17, VIADUCT = 0.8;               // the heights of a low bridge's deck and of the top of a viaduct
const WAVE = (x, z, t) => 0.028 * Math.sin(x * 0.9 + t * 0.8) + 0.02 * Math.sin(z * 1.3 - t * 0.6) + 0.012 * Math.sin((x + z) * 2.1 + t * 1.7);

// ---------- the skins ----------
const MODES = {
  day: { sea: 0x3f8db4, sand: 0xe6d6ab, hill: [0xd8c28f, 0xc4a870, 0xa98b55], copper: 0xd9a27a, timber: 0x9a6a3b, stone: 0xd9d0bc, deck: 0xbfb394, rock: 0x6f6a62, hemi: 1.15, sky: 0xfff4dc, ground: 0x6d8fa6, key: 0xfff0d2, keyI: 2.5, exposure: 1.0, lantern: false },
  night: { sea: 0x3a6684, sand: 0xbdb292, hill: [0xb3a47c, 0x9d8e68, 0x857852], copper: 0xc08a68, timber: 0x84603a, stone: 0xb4aea0, deck: 0x9a9380, rock: 0x625e58, hemi: 1.3, sky: 0xa5b4d2, ground: 0x1c2a38, key: 0xcfdcf6, keyI: 2.1, exposure: 1.1, lantern: true },
};
function skinNow() {
  const root = document.documentElement, night = root.dataset.mode ? root.dataset.mode === "night" : matchMedia("(prefers-color-scheme: dark)").matches;
  return { night, ...MODES[night ? "night" : "day"] };
}

/** An extruded outline: points [x, y] along and up, `depth` thick (centred on z = 0). */
function wall(points, depth) {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)));
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/**
 * The model in `host`. Calls: set(puzzle) for a new puzzle (its layout `lay`, `grid`, `lanes`, `hills`), update(marks, br) when the
 * bridges or the islands' state changed, show(on) to start or stop drawing, spin() after a win, orbit(az, el) / angles for the
 * camera, dispose().
 */
export function createModel(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = 1;                       // the plain PCF map
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "brg3-gl";
  const labels = document.createElement("div");
  labels.className = "brg3-labels";
  host.replaceChildren(canvas, labels);

  const scene = new THREE.Scene();
  // a perspective camera made from an orthographic one's parts (the bundle has none), as Survey's is
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  camera.isOrthographicCamera = false;
  camera.isPerspectiveCamera = true;
  camera.updateProjectionMatrix = () => {};
  const hemi = new THREE.HemisphereLight(0xffffff, 0x666666, 1), sun = new THREE.DirectionalLight(0xffffff, 2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);

  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });
  const M = {
    sea: mat(0x3f8db4, { roughness: 0.55, metalness: 0.05 }), sand: mat(0xe6d6ab), copper: mat(0xd9a27a), rock: mat(0x6f6a62),
    h0: mat(0xd8c28f), h1: mat(0xc4a870), h2: mat(0xa98b55), timber: mat(0x9a6a3b), stone: mat(0xd9d0bc), deck: mat(0xbfb394),
    hull: mat(0x6a4426), trim: mat(0xc9a23c, { metalness: 0.4, roughness: 0.4 }), sail: mat(0xf0e6cc, { side: DOUBLE_SIDE }), flag: mat(0xb5432f, { side: DOUBLE_SIDE }),
    red: mat(0xb5432f), white: mat(0xf4efe2), lamp: new THREE.MeshBasicMaterial({ color: 0xffd98a }),
  };
  const C = new THREE.Color();

  // ---------- the sea ----------
  let sea = null, seaTop = [], seaSize = 0;
  function buildSea(size) {
    if (sea) { scene.remove(sea); sea.geometry.dispose(); }
    seaSize = size + 40;                             // the camera sees a long way over it from a low angle
    const g = new THREE.BoxGeometry(seaSize, 0.5, seaSize, 64, 1, 64), pos = g.attributes.position;
    seaTop = [];
    for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) seaTop.push(i);
    g.translate(0, -0.25, 0);
    sea = new THREE.Mesh(g, M.sea);
    sea.receiveShadow = true;
    scene.add(sea);
  }
  function stirSea(t) {
    if (!sea) return;
    const pos = sea.geometry.attributes.position;
    for (const i of seaTop) pos.setY(i, WAVE(pos.getX(i), pos.getZ(i), t));
    pos.needsUpdate = true;
  }

  // ---------- a ship: a hull from a side profile, three masts, square sails, a lateen on the mizzen, a flag and a lantern ----------
  function ship() {
    const g = new THREE.Group(), hullShape = new THREE.Shape();
    [[-0.3, 0.17], [-0.31, 0.02], [-0.24, -0.05], [0.14, -0.05], [0.31, 0.07], [0.29, 0.09], [0.13, 0.075], [-0.12, 0.075], [-0.12, 0.11], [-0.2, 0.11], [-0.2, 0.17]]
      .forEach(([x, y], i) => (i ? hullShape.lineTo(x, y) : hullShape.moveTo(x, y)));
    hullShape.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.15, bevelEnabled: false });
    hullGeo.translate(0, 0, -0.075);
    const hull = new THREE.Mesh(hullGeo, M.hull);
    hull.castShadow = true;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.158), M.trim);
    stripe.position.set(0.02, 0.062, 0);
    g.add(hull, stripe);
    const mast = (x, h) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, h, 6), M.hull); m.position.set(x, 0.05 + h / 2, 0); m.castShadow = true; g.add(m); };
    mast(0.04, 0.42); mast(0.2, 0.31); mast(-0.17, 0.28);
    const sailBox = (x, y, w, h) => { const s = new THREE.Mesh(new THREE.BoxGeometry(0.008, h, w), M.sail); s.position.set(x, y, 0); s.castShadow = true; g.add(s); };
    sailBox(0.055, 0.2, 0.25, 0.15); sailBox(0.055, 0.37, 0.18, 0.1);
    sailBox(0.215, 0.17, 0.18, 0.12); sailBox(0.215, 0.29, 0.12, 0.07);
    const lateen = new THREE.Shape();
    lateen.moveTo(-0.17, 0.12); lateen.lineTo(-0.17, 0.3); lateen.lineTo(-0.33, 0.14); lateen.closePath();
    const lat = new THREE.Mesh(new THREE.ShapeGeometry(lateen), M.sail);
    lat.castShadow = true;
    g.add(lat);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.004), M.flag);
    flag.position.set(-0.01, 0.45, 0);
    g.add(flag);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), M.lamp);
    lamp.position.set(-0.3, 0.2, 0);
    g.add(lamp);
    g.userData = { flag, lamp };
    g.scale.setScalar(1.7);
    return g;
  }

  // ---------- the puzzle on show ----------
  let P = null, size = 0, lay = null;
  let world = null, linkMeshes = [], plates = [], ships = [], buoys = [], routes = [], marks = "";
  function disposeWorld() {
    if (world) { scene.remove(world); world.traverse(o => o.geometry?.dispose()); }
    world = null; linkMeshes = []; ships = []; buoys = [];
    labels.replaceChildren(); plates = [];
  }
  const place = (obj, x, y, z, ry = 0) => { obj.position.set(x, y, z); obj.rotation.y = ry; return obj; };
  const shadowed = obj => { obj.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return obj; };

  function island(i) {
    const isle = lay.isl[i], [x, z] = cellXZ(size, isle.r, isle.c), g = new THREE.Group(), top = isle.realm ? M.copper : M.sand;
    if (isle.hill) {
      // terraces: contour lines made solid
      const t = [[0.47, 0.44, 0.3, M.h0], [0.37, 0.36, 0.62, M.h1], [0.27, 0.26, 1.0, M.h2]];
      for (const [rb, rt, h, m] of t) { const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h + 0.1, 18), isle.realm ? M.copper : m); c.position.y = (h - 0.1) / 2; g.add(c); }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.05, 14), M.trim);
      cap.position.y = 1.02;
      g.add(cap);
    } else {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.47, 0.34, 18), top);
      c.position.y = 0.03;
      g.add(c);
    }
    g.position.set(x, 0, z);
    return shadowed(g);
  }
  /** A link's bridges, once: a single and a double of each, shown and hidden as the marks change. */
  function bridgesOf(l) {
    const link = lay.links[l], a = lay.isl[link.a], b = lay.isl[link.b], [x, z] = cellXZ(size, a.r, a.c), span = link.vertical ? b.r - a.r : b.c - a.c;
    const ry = link.vertical ? -Math.PI / 2 : 0, one = new THREE.Group(), two = new THREE.Group(), deckM = a.realm ? M.copper : M.timber;
    if (link.high) {
      const piers = piersOf(lay, l, P.lanes || "");
      const outline = wallOutline(span, piers, { top: VIADUCT - 0.04, rise: 0.7 });
      for (const [grp, lanes] of [[one, [0]], [two, [-0.1, 0.1]]]) for (const off of lanes) {
        const w = wall(outline, lanes.length === 1 ? 0.17 : 0.08), m = new THREE.Mesh(w, M.stone), d = new THREE.Mesh(new THREE.BoxGeometry(span - 0.6, 0.05, lanes.length === 1 ? 0.24 : 0.12), M.deck);
        m.position.z = off;
        d.position.set(span / 2, VIADUCT - 0.02, off);
        grp.add(m, d);
      }
    } else {
      for (const [grp, lanes] of [[one, [0]], [two, [-0.1, 0.1]]]) for (const off of lanes) {
        const w = lanes.length === 1 ? 0.15 : 0.085, len = span - 0.7, d = new THREE.Mesh(new THREE.BoxGeometry(len, 0.045, w), deckM);
        d.position.set(span / 2, DECK, off);
        grp.add(d);
        for (let s = 0.2; s <= len; s += 0.5) { const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 6), M.hull); pile.position.set(0.35 + s, 0.03, off + (w / 2 - 0.012)); const q = pile.clone(); q.position.z = off - (w / 2 - 0.012); grp.add(pile, q); }
      }
    }
    const out = new THREE.Group();
    out.add(one, two);
    place(out, x, 0, z, ry);
    one.visible = two.visible = false;
    shadowed(out);
    return { out, one, two };
  }

  /** Shows a puzzle: `p` is { lay, grid, lanes, hills, realms } (the page's P and its run's strings). */
  function set(p) {
    P = p; lay = p.lay; size = p.size;
    disposeWorld();
    world = new THREE.Group();
    buildSea(size);
    lay.isl.forEach((_, i) => {
      world.add(island(i));
      const el = document.createElement("span");
      el.className = "brg3-n";
      el.textContent = labelOf(lay.isl[i]);
      labels.appendChild(el);
      plates.push({ el, i, cls: "" });
    });
    for (let i = 0; i < p.grid.length; i++) {
      if (p.grid[i] !== "#") continue;
      const [x, z] = cellXZ(size, Math.floor(i / size), i % size), rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 0), M.rock);
      rock.scale.set(1, 0.7, 0.85);
      rock.rotation.y = i * 1.7;
      rock.position.set(x, 0.05, z);
      world.add(shadowed(rock));
    }
    linkMeshes = lay.links.map((_, l) => { const m = bridgesOf(l); world.add(m.out); return m; });
    // the sea's own: buoys round the fairways, merchantmen on them and round the board
    for (const b of p.lanes ? buoysOf(size, p.lanes) : []) {
      const buoy = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.12, 8), b.red ? M.red : M.white);
      buoy.position.set(b.x, 0.03, b.z);
      buoy.castShadow = true;
      world.add(buoy);
      buoys.push({ buoy, x: b.x, z: b.z });
    }
    routes = routesOf(size, p.lanes || "", p.lanes ? 1 : 2);
    ships = routes.map(route => { const s = ship(); world.add(s); return { s, route }; });
    scene.add(world);
    applySkin();
    fit();
    update(marks.length === lay.links.length ? marks : "0".repeat(lay.links.length), null);
    draw(performance.now());
  }
  /** Shows the bridges the marks say, and each island's state (met, over, cut) on its plate. */
  function update(m, br) {
    if (!lay) return;
    marks = m;
    linkMeshes.forEach(({ one, two }, l) => { one.visible = m[l] === "1"; two.visible = m[l] === "2"; });
    const over = new Set(br?.over), met = new Set(br?.met), cut = new Set(br?.cut);
    for (const pl of plates) {
      const isle = lay.isl[pl.i], cls = `brg3-n${isle.realm ? " r1" : ""}${isle.kind ? " rng" : ""}${over.has(pl.i) ? " over" : met.has(pl.i) ? " met" : ""}${cut.has(pl.i) ? " cut" : ""}`;
      if (cls !== pl.cls) { pl.cls = cls; pl.el.className = cls; }
    }
    wake();
  }

  // ---------- the skin ----------
  function applySkin() {
    const k = skinNow();
    M.sea.color.set(k.sea); M.sand.color.set(k.sand); M.copper.color.set(k.copper); M.rock.color.set(k.rock);
    M.h0.color.set(k.hill[0]); M.h1.color.set(k.hill[1]); M.h2.color.set(k.hill[2]);
    M.timber.color.set(k.timber); M.stone.color.set(k.stone); M.deck.color.set(k.deck);
    hemi.color.set(k.sky); hemi.groundColor.set(k.ground); hemi.intensity = k.hemi;
    sun.color.set(k.key); sun.intensity = k.keyI;
    renderer.toneMappingExposure = k.exposure;
    for (const { s } of ships) s.userData.lamp.visible = k.lantern;
    wake();
  }

  // ---------- the camera: round the board under a finger ----------
  let width = 1, height = 1, az = 32 * DEG, el = 52 * DEG, dist = 14, spinUntil = 0;
  const LOOK = new THREE.Vector3(0, 0.15, 0), V = new THREE.Vector3();
  function pose() {
    camera.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist).add(LOOK);
    camera.up.set(0, 1, 0);
    camera.lookAt(LOOK);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }
  function fit() {
    if (!size) return;
    const aspect = width / height, near = 0.5, far = 120, top = near * Math.tan(FOV / 2), right = top * aspect;
    camera.projectionMatrix.makePerspective(-right, right, top, -top, near, far);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // the board's circle (and the plates over its islands) in view from any side: the tighter of the two fields of view
    const reach = (size / 2 - 0.5) * Math.SQRT2 + 0.7, half = Math.min(FOV / 2, Math.atan(Math.tan(FOV / 2) * aspect));
    dist = reach / Math.sin(half);
    pose();
    const D = size * 3 + 8, la = az - 0.6, le = Math.min(el + 0.5, 1.3);
    sun.position.set(Math.sin(la) * Math.cos(le) * D, Math.sin(le) * D, Math.cos(la) * Math.cos(le) * D);
    sun.target.position.set(0, 0, 0);
    const s = size * 0.8 + 3;
    Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: D * 2 });
    sun.shadow.camera.updateProjectionMatrix();
  }
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, Math.round(r.width)); height = Math.max(1, Math.round(r.height));
    renderer.setSize(width, height, false);
    fit();
    wake();
  }
  function placePlates() {
    for (const pl of plates) {
      const isle = lay.isl[pl.i], [x, z] = cellXZ(size, isle.r, isle.c);
      V.set(x, isle.hill ? 1.35 : 0.55, z).project(camera);
      pl.el.style.transform = `translate(${((V.x + 1) / 2) * width}px, ${((1 - V.y) / 2) * height}px) translate(-50%, -50%)`;
    }
  }

  // ---------- drawing: only while it is shown and not paused, at thirty frames a second ----------
  let shown = false, held = false, frameId = 0, last = 0, t0 = performance.now(), still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function draw(now) {
    const t = still ? 0 : (now - t0) / 1000;
    if (spinUntil > now) { az += 0.35 * (FRAME_MS / 1000); fit(); }
    stirSea(t);
    for (const { buoy, x, z } of buoys) buoy.position.y = 0.02 + WAVE(x, z, t);
    for (const { s, route } of ships) {
      const at = shipAt(route, t), bob = WAVE(at.x, at.z, t);
      s.position.set(at.x, bob + 0.01, at.z);
      s.rotation.set(0.05 * Math.sin(t * 0.9 + at.x), at.heading, 0.04 * Math.sin(t * 0.7 + at.z));
      s.userData.flag.rotation.y = 0.35 * Math.sin(t * 3 + at.x * 4);
    }
    renderer.render(scene, camera);
    placePlates();
  }
  function frame(now) {
    frameId = 0;
    if (!shown || held || document.hidden) return;
    if (now - last >= FRAME_MS - 2) { last = now; draw(now); }
    if (!still || spinUntil > now) frameId = requestAnimationFrame(frame);
  }
  function wake() {
    if (!shown || held || !lay) return;
    if (still) draw(performance.now());
    if (!frameId) frameId = requestAnimationFrame(frame);
  }

  // ---------- turning it: a finger drags the board round ----------
  let drag = null;
  canvas.addEventListener("pointerdown", e => { drag = { id: e.pointerId, x: e.clientX, y: e.clientY }; try { canvas.setPointerCapture(e.pointerId); } catch { /* a synthetic event */ } });
  canvas.addEventListener("pointermove", e => {
    if (!drag || e.pointerId !== drag.id) return;
    az -= (e.clientX - drag.x) * 0.008;
    el = Math.max(MIN_EL, Math.min(MAX_EL, el + (e.clientY - drag.y) * 0.006));
    drag.x = e.clientX; drag.y = e.clientY;
    fit();
    wake();
  });
  const letGo = e => { if (drag && e.pointerId === drag.id) drag = null; };
  canvas.addEventListener("pointerup", letGo);
  canvas.addEventListener("pointercancel", letGo);
  canvas.style.touchAction = "none";

  new ResizeObserver(resize).observe(host);
  new MutationObserver(applySkin).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", applySkin);
  document.addEventListener("visibilitychange", wake);
  canvas.addEventListener("webglcontextlost", e => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => { applySkin(); wake(); });
  applySkin();
  resize();

  return {
    canvas, set, update,
    /** Draws (or stops drawing). */
    show(on) { shown = !!on; if (shown) { resize(); wake(); } else if (frameId) { cancelAnimationFrame(frameId); frameId = 0; } },
    /** Holds the drawing still while the menu is open, then lets it go on. */
    hold(on) { held = !!on; if (held && frameId) { cancelAnimationFrame(frameId); frameId = 0; } else wake(); },
    /** After a win: the board turns slowly for a few seconds. */
    spin(ms = 7000) { spinUntil = performance.now() + ms; wake(); },
    orbit(a, e) { az = a; el = Math.max(MIN_EL, Math.min(MAX_EL, e)); fit(); wake(); },
    get angles() { return [az, el]; },
    /** For tests: what is on show. */
    get live() { return { ships: ships.length, buoys: buoys.length, bridges: linkMeshes.filter(m => m.one.visible || m.two.visible).length, plates: plates.length, shown }; },
    dispose() { shown = false; if (frameId) cancelAnimationFrame(frameId); disposeWorld(); renderer.dispose(); },
  };
}
