// Reckoning in 3D, drawn with three.js (vendor/three-run.js): the quay as boxes, for now. Every shape here is a stand-in
// for a model that will come (README, Reckoning: the asset list): the hero, a crab, a gull, a warehouse, a bollard, each
// built in one place (`makeFoe`, the hero's block, the scenery's) so a glTF can take over one at a time. What stays when the models arrive is the look:
//  - a world that curves away below the horizon (a vertex patch on every material: the further from the camera, the
//    lower), which is what makes a straight run read as a run over the top of something;
//  - the Almanac's palette, read from the page's own colours (style.css's tokens), so the three themes, day and night,
//    each get their quay: pale stone and brass in the day, navy and brass at night. Colour is held down; the Brim look
//    is a candy one and this one is dusk in a Hanse port;
//  - fog to the sky's colour, a hemisphere light and one sun, no shadows (a soft disc under each thing instead).
// The page (reckoning.js) steps the rules and calls frame(S, dt) each time it draws; ping(ev) turns the rules' events
// into what is seen (a burst, a ring, a shake).
import * as THREE from "./vendor/three-run.js";
import { LANE_W, WALL_X, KINDS } from "./reckoning-engine.js";

const BEND = 0.0013;                    // how fast the world drops away: metres of fall per metre-squared of distance
const BEND_FROM = 9;                    // from this far in front of the camera (the hero is nearer, and stays level)
const QUAY_W = 3 * LANE_W + 0.9;
const SEAM = 1.2;                       // metres between plank seams
const AHEAD = 105, BEHIND = 12;

const bend = { value: BEND };
/** Patches a material so what it draws curves down with distance (the project_vertex chunk, with the bend added). */
function curved(mat) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uBend = bend;
    sh.vertexShader = "uniform float uBend;\n" + sh.vertexShader.replace("#include <project_vertex>", `
      vec4 mvPosition = vec4( transformed, 1.0 );
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      float bz = max( -mvPosition.z - ${BEND_FROM.toFixed(1)}, 0.0 );
      mvPosition.y -= uBend * bz * bz;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => "reckoning-curved";
  return mat;
}

// ---------- colour: the page's tokens, held down ----------

const swatch = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
swatch.canvas.width = swatch.canvas.height = 1;
/** Any CSS colour (a token may be color-mix(…)) as [r, g, b], 0 to 255. */
function rgb(css) {
  swatch.clearRect(0, 0, 1, 1);
  swatch.fillStyle = "#000";
  swatch.fillStyle = String(css).trim() || "#000";
  swatch.fillRect(0, 0, 1, 1);
  const d = swatch.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2]];
}
const token = name => rgb(getComputedStyle(document.documentElement).getPropertyValue(name));
const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
const grey = (a, t) => { const l = 0.3 * a[0] + 0.59 * a[1] + 0.11 * a[2]; return mix(a, [l, l, l], t); };   // t of the way to its own grey
const col = (a, into = new THREE.Color()) => into.setRGB(a[0] / 255, a[1] / 255, a[2] / 255, THREE.SRGBColorSpace);
const night = () => document.documentElement.dataset.mode === "night" || (document.documentElement.dataset.mode !== "day" && matchMedia("(prefers-color-scheme: dark)").matches);

/** The quay's colours for the theme showing now. Enamels are muted by a third and pulled toward the page. */
function palette() {
  const yard = token("--yard"), sheet = token("--sheet"), ink = token("--ink"), brass = token("--brass"), plate = token("--plate");
  const e = [0, 1, 2, 3].map(i => mix(grey(token(`--c${i}`), 0.45), yard, 0.25));
  const dark = night();
  const moon = c => (dark ? mix(c, [150, 172, 200], 0.3) : c);       // by night things are lit by a moon: the same colours, lifted towards a cool grey
  return {
    sky: dark ? mix(yard, [40, 62, 92], 0.6) : mix(yard, [236, 228, 208], 0.35),
    stone: moon(mix(sheet, yard, 0.35)),
    seam: mix(ink, yard, dark ? 0.75 : 0.8),
    plank: moon(mix(brass, yard, 0.62)),
    water: mix(mix(token("--c2"), yard, 0.3), [30, 70, 110], dark ? 0.3 : 0.2),
    brick: mix(e[3], yard, 0.45),
    tones: [mix(e[3], yard, 0.4), mix(e[0], sheet, 0.4), mix(e[2], sheet, 0.45), mix(sheet, e[3], 0.3), mix(e[1], sheet, 0.5)].map(moon),     // warehouse fronts: brick, ochre, slate, cream, sage
    wall: moon(mix(e[3], sheet, 0.5)),
    timber: moon(mix(brass, ink, 0.45)),
    roof: moon(mix(e[2], ink, 0.35)),
    hero: grey(plate, 0.1),
    gilt: brass,
    crab: moon(mix(e[3], ink, 0.15)),
    gull: moon(mix(sheet, ink, 0.12)),
    banner: e[0],
    ink,
    good: mix(e[1], yard, 0.1),
    ring: mix(brass, sheet, 0.3),
  };
}

// ---------- the scene ----------

export function createRunner(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });          // throws where there's no WebGL
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const canvas = renderer.domElement;
  canvas.className = "rk-gl";
  host.prepend(canvas);
  canvas.addEventListener("webglcontextlost", e => e.preventDefault());

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 160);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.5);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-4, 9, -3);
  scene.add(hemi, sun, sun.target);
  scene.fog = new THREE.Fog(0xffffff, 28, 105);

  let pal = palette();
  const mats = {};
  const mat = (key, opts = {}) => (mats[key] = curved(new THREE.MeshLambertMaterial(opts)));
  const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 12), sph = new THREE.SphereGeometry(0.5, 14, 10);
  const disc = new THREE.CircleGeometry(0.5, 20).rotateX(-Math.PI / 2);
  const cone = new THREE.ConeGeometry(0.5, 1, 10);

  const M = {
    stone: mat("stone"), plank: mat("plank"), seam: mat("seam"), water: mat("water"), brick: mat("brick"), wall: mat("wall"),
    timber: mat("timber"), roof: mat("roof"), hero: mat("hero"), gilt: mat("gilt"), crab: mat("crab"), gull: mat("gull"),
    banner: mat("banner"), skin: mat("skin"), good: mat("good"),
    shadow: curved(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })),
    ring: curved(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })),
  };
  function retheme() {
    pal = palette();
    const set = (m, a) => col(a, m.color);
    set(M.stone, pal.stone); set(M.plank, pal.plank); set(M.seam, pal.seam); set(M.water, pal.water); M.brick.color.set(0xffffff); set(M.wall, pal.wall);        // the warehouses take their own colours (instance colours multiply the material's)
    set(M.timber, pal.timber); set(M.roof, pal.roof); set(M.hero, pal.hero); set(M.gilt, pal.gilt); set(M.crab, pal.crab); set(M.gull, pal.gull);
    set(M.banner, pal.banner); set(M.skin, mix(pal.gull, pal.brick, 0.3)); set(M.good, pal.good); set(M.ring, pal.ring);
    scene.background = col(pal.sky);
    scene.fog.color = col(pal.sky);
    hemi.color = col(mix(pal.sky, [255, 255, 255], night() ? 0.1 : 0.4));
    hemi.groundColor = col(mix(pal.water, pal.sky, 0.5));
    hemi.intensity = night() ? 1.9 : 1.7;
    sun.color = col(night() ? [200, 215, 235] : [255, 244, 222]);
    sun.intensity = night() ? 1.3 : 1.5;
    scene.traverse(o => { if (o.isInstancedMesh && o.userData.tint) recolour(o); });
  }

  // the quay: solid stretches between the pits, seams across it, water below
  const solids = [];
  const solid = () => { const m = new THREE.Mesh(box, M.stone); m.frustumCulled = false; scene.add(m); solids.push(m); return m; };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 400).rotateX(-Math.PI / 2), M.water);
  water.position.y = -1.7; water.frustumCulled = false; scene.add(water);
  const SEAMS = Math.ceil((AHEAD + BEHIND) / SEAM) + 2;
  const seams = new THREE.InstancedMesh(box, M.seam, SEAMS); seams.frustumCulled = false; scene.add(seams);
  const edge = new THREE.InstancedMesh(box, M.plank, 2 * SEAMS);                         // a rail of planking down each side
  edge.frustumCulled = false; scene.add(edge);

  // scenery: warehouses (a body and two steps of gable) and bollards, placed from the distance alone, so they are the same every time
  const HOUSES = 15;                                                                     // each side, each a body and two steps
  const houses = new THREE.InstancedMesh(box, M.brick, HOUSES * 2 * 3); houses.frustumCulled = false; houses.userData.tint = true; scene.add(houses);
  const roofs = new THREE.InstancedMesh(box, M.roof, HOUSES * 2); roofs.frustumCulled = false; scene.add(roofs);
  const BOLLARDS = 24;
  const posts = new THREE.InstancedMesh(cyl, M.timber, BOLLARDS * 2); posts.frustumCulled = false; scene.add(posts);
  function recolour(inst) {
    const c = new THREE.Color();
    for (let i = 0; i < inst.count; i++) {
      const s = inst.userData.shade ? inst.userData.shade[i] : 0.5;
      col(mix(pal.tones[Math.min(pal.tones.length - 1, Math.floor(s * pal.tones.length))], pal.sky, 0.16), c);
      inst.setColorAt(i, c);
    }
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }
  const hash = n => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // walls that can be run along
  const wallBoxes = [];
  const wallBox = () => { const m = new THREE.Mesh(box, M.wall); m.frustumCulled = false; scene.add(m); wallBoxes.push(m); return m; };

  // the hero, in boxes
  const hero = new THREE.Group();
  const body = new THREE.Group(); hero.add(body);
  const torso = new THREE.Mesh(box, M.hero); torso.scale.set(0.62, 0.78, 0.38); torso.position.y = 0.88; body.add(torso);
  const belt = new THREE.Mesh(box, M.gilt); belt.scale.set(0.66, 0.1, 0.42); belt.position.y = 0.62; body.add(belt);
  const head = new THREE.Mesh(sph, M.skin); head.scale.set(0.34, 0.36, 0.34); head.position.y = 1.44; body.add(head);
  const hat = new THREE.Mesh(cyl, M.hero); hat.scale.set(0.5, 0.1, 0.5); hat.position.y = 1.62; body.add(hat);
  const hatTop = new THREE.Mesh(cyl, M.hero); hatTop.scale.set(0.3, 0.2, 0.3); hatTop.position.y = 1.75; body.add(hatTop);
  const blade = new THREE.Mesh(box, M.gilt); blade.scale.set(0.06, 0.06, 0.8); blade.position.set(0.36, 0.95, 0.35); body.add(blade);
  const legs = [-1, 1].map(s => { const g = new THREE.Group(); g.position.set(s * 0.15, 0.5, 0); const m = new THREE.Mesh(box, M.hero); m.scale.set(0.2, 0.5, 0.22); m.position.y = -0.25; g.add(m); hero.add(g); return g; });
  hero.traverse(o => { o.frustumCulled = false; });
  scene.add(hero);
  const heroShadow = new THREE.Mesh(disc, M.shadow); heroShadow.scale.set(1, 1, 1); heroShadow.frustumCulled = false; scene.add(heroShadow);

  // foes
  const foes = new Map();                                                                 // foe id -> { group, parts, born, died }
  const free = [];
  let runSeed = null;
  function makeFoe(f) {
    const g = new THREE.Group(), parts = {};
    if (f.kind === "crab") {
      const b = new THREE.Mesh(box, M.crab); b.scale.set(1.15, 0.5, 0.9); b.position.y = 0.4; g.add(b);
      const top = new THREE.Mesh(sph, M.crab); top.scale.set(0.9, 0.5, 0.7); top.position.y = 0.72; g.add(top);
      parts.claws = [-1, 1].map(s => { const c = new THREE.Mesh(box, M.crab); c.scale.set(0.34, 0.3, 0.6); c.position.set(s * 0.72, 0.62, 0.5); g.add(c); return c; });
      parts.legs = [-1, 1].map(s => { const l = new THREE.Mesh(box, M.crab); l.scale.set(0.5, 0.1, 0.12); l.position.set(s * 0.62, 0.18, 0); g.add(l); return l; });
    } else {
      const b = new THREE.Mesh(sph, M.gull); b.scale.set(0.5, 0.42, 1.0); b.position.y = 0.4; g.add(b);
      const beak = new THREE.Mesh(cone, M.gilt); beak.scale.set(0.12, 0.3, 0.12); beak.rotation.x = -Math.PI / 2; beak.position.set(0, 0.42, -0.55); g.add(beak);
      parts.wings = [-1, 1].map(s => { const pivot = new THREE.Group(); pivot.position.set(s * 0.22, 0.46, 0); const w = new THREE.Mesh(box, M.gull); w.scale.set(1.0, 0.06, 0.5); w.position.x = s * 0.5; pivot.add(w); g.add(pivot); return pivot; });
      parts.banner = new THREE.Mesh(box, M.banner); parts.banner.scale.set(0.5, 0.36, 0.04); parts.banner.position.set(0, -0.22, 0); g.add(parts.banner);
      const rope = new THREE.Mesh(box, M.timber); rope.scale.set(0.03, 0.4, 0.03); rope.position.set(0, 0.04, 0); g.add(rope);
    }
    g.traverse(o => { o.frustumCulled = false; });
    const shadow = new THREE.Mesh(disc, M.shadow); shadow.frustumCulled = false;
    scene.add(g, shadow);
    return { group: g, parts, shadow, kind: f.kind };
  }

  // effects: rings on the planks, bursts
  const fx = [];
  function ring(x, y, z, r, life) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 28).rotateX(-Math.PI / 2), M.ring.clone());
    m.material = curved(M.ring.clone());
    m.position.set(x, y, z); m.frustumCulled = false; scene.add(m);
    fx.push({ m, born: now, life, r, kind: "ring" });
  }
  function burst(x, y, z, n = 6) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(box, M.gilt); m.scale.setScalar(0.12); m.position.set(x, y, z); m.frustumCulled = false; scene.add(m);
      const a = (i / n) * Math.PI * 2 + hash(i + now) * 1.5;
      fx.push({ m, born: now, life: 0.45, kind: "spark", vx: Math.cos(a) * 2.6, vy: 2 + hash(i * 7 + now) * 2.6, vz: Math.sin(a) * 2.6 });
    }
  }

  // ---------- drawing ----------
  let now = 0, shake = 0, W = 1, H = 1, blink = 0;
  let camX = 0, camY = 3.4;
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
    canvas.style.width = "100%"; canvas.style.height = "100%";
    camera.aspect = W / H;
    // wide enough for the lanes and a wall at the phone's width, and not stretched on a tablet
    camera.fov = Math.max(50, Math.min(76, 2 * Math.atan(Math.tan(33 * Math.PI / 180) / camera.aspect) * 180 / Math.PI));
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);

  function frame(S, dt) {
    now += dt;
    const h = S.hero, W_ = S.world;
    shake = Math.max(0, shake - dt * 2.4);

    // the quay
    const z0 = h.z - BEHIND, z1 = h.z + AHEAD;
    const pits = W_.pits.filter(p => p.z1 > z0 && p.z0 < z1).sort((a, b) => a.z0 - b.z0);
    const spans = [];
    let at = z0;
    for (const p of pits) { if (p.z0 > at) spans.push([at, p.z0]); at = Math.max(at, p.z1); }
    if (at < z1) spans.push([at, z1]);
    while (solids.length < spans.length) solid();
    solids.forEach((m, i) => {
      const s = spans[i];
      m.visible = !!s;
      if (s) { m.scale.set(QUAY_W, 1.4, s[1] - s[0]); m.position.set(0, -0.7, (s[0] + s[1]) / 2); }
    });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    const inSpan = z => spans.some(s => z >= s[0] && z <= s[1]);
    const first = Math.floor(z0 / SEAM);
    for (let i = 0; i < SEAMS; i++) {
      const z = (first + i) * SEAM, on = inSpan(z);
      m4.compose(v.set(0, 0.011, z), q, on ? v.clone().set(QUAY_W, 0.02, 0.05) : one.clone().multiplyScalar(0));
      seams.setMatrixAt(i, m4);
      for (const s of [-1, 1]) {
        m4.compose(v.set(s * (QUAY_W / 2 - 0.12), 0.05, z + SEAM / 2), q, on ? v.clone().set(0.24, 0.1, SEAM - 0.08) : one.clone().multiplyScalar(0));
        edge.setMatrixAt(2 * i + (s > 0 ? 1 : 0), m4);
      }
    }
    seams.instanceMatrix.needsUpdate = edge.instanceMatrix.needsUpdate = true;

    // scenery, by slot: slot k is the house k * 11 metres along, the same wherever the hero is
    const SP = 11, base = Math.floor((h.z - BEHIND) / SP);
    houses.userData.shade = houses.userData.shade || new Array(houses.count).fill(0.5);
    let hi = 0, ri = 0;
    for (const side of [-1, 1]) {
      for (let k = 0; k < HOUSES; k++) {
        const n = base + k, r1 = hash(n * 2 + (side > 0 ? 1 : 0)), r2 = hash(n * 5 + 3 + side), r3 = hash(n * 7 + 1);
        const w = 4.6 + r1 * 2.6, hgt = 4.2 + r2 * 5, depth = 5.6 + r3 * 2.4, x = side * (6.4 + depth / 2), zc = n * SP + SP / 2;
        const parts = [[w, hgt, depth, hgt / 2, 0], [w * 0.72, 1.6, depth, hgt + 0.8, 0], [w * 0.4, 1.4, depth, hgt + 2.3, 0]];
        parts.forEach(([pw, ph, pd, py], j) => {
          m4.compose(v.set(x, py, zc), q, new THREE.Vector3(pw, ph, pd));
          houses.setMatrixAt(hi, m4);
          houses.userData.shade[hi] = r1 * 0.999;
          hi++;
        });
        m4.compose(v.set(x, hgt + 3.2, zc), q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3(w * 0.3, 0.7, depth + 0.5));
        roofs.setMatrixAt(ri++, m4);
        q.identity();
      }
    }
    houses.instanceMatrix.needsUpdate = roofs.instanceMatrix.needsUpdate = true;
    if (!houses.userData.tinted || houses.userData.tinted !== base) { recolour(houses); houses.userData.tinted = base; }
    for (let i = 0; i < BOLLARDS; i++) {
      for (const s of [-1, 1]) {
        const z = (Math.floor((h.z - BEHIND) / 6) + i) * 6 + 3;
        m4.compose(v.set(s * (QUAY_W / 2 - 0.2), 0.3, z), q, inSpan(z) ? new THREE.Vector3(0.28, 0.6, 0.28) : new THREE.Vector3(0, 0, 0));
        posts.setMatrixAt(2 * i + (s > 0 ? 1 : 0), m4);
      }
    }
    posts.instanceMatrix.needsUpdate = true;

    // walls to run along
    const walls = W_.walls.filter(w => w.z1 > z0 && w.z0 < z1);
    while (wallBoxes.length < walls.length) wallBox();
    wallBoxes.forEach((m, i) => {
      const w = walls[i];
      m.visible = !!w;
      if (w) { m.scale.set(1.0, 3.6, w.z1 - w.z0); m.position.set(w.side * (WALL_X + 0.5), 1.8, (w.z0 + w.z1) / 2); }
    });

    // foes (ids start again with each run, so a new run puts every foe back in the pool first)
    if (S.seed !== runSeed) { for (const o of foes.values()) { o.group.visible = o.shadow.visible = false; free.push(o); } foes.clear(); runSeed = S.seed; }
    const seen = new Set();
    for (const f of W_.foes) {
      if (f.z < z0 - 4 || f.z > z1) continue;
      seen.add(f.id);
      let o = foes.get(f.id);
      if (!o) { o = free.find(x => x.kind === f.kind) || makeFoe(f); const k = free.indexOf(o); if (k >= 0) free.splice(k, 1); o.born = now; o.died = 0; o.group.visible = o.shadow.visible = true; foes.set(f.id, o); }
      if (!f.alive && !o.died) o.died = now;
      const dying = o.died ? Math.min(1, (now - o.died) / 0.35) : 0;
      const g = o.group, bob = Math.sin(now * 5 + f.id) * 0.5 + 0.5;
      const lift = f.kind === "gull" ? f.y + 0.05 * Math.sin(now * 3 + f.id) : f.y;
      g.position.set(f.x, lift + dying * (f.kind === "gull" ? 3 : 0.6), f.z);
      g.rotation.set(0, Math.PI + (f.kind === "crab" ? 0.12 * Math.sin(now * 6 + f.id) : 0), 0);
      g.scale.setScalar(1 - dying * (f.alive ? 1 : 0.85));
      if (f.kind === "gull") o.parts.wings.forEach((w, i) => { w.rotation.z = (i ? 1 : -1) * Math.sin(now * 9 + f.id) * 0.55; });
      else { o.parts.claws.forEach((c, i) => { c.position.z = 0.5 + 0.08 * Math.sin(now * 7 + i * 2 + f.id); }); }
      if (f.spent && f.alive) g.rotation.z = Math.sin(now * 30) * 0.08;
      o.shadow.position.set(f.x, 0.025, f.z);
      o.shadow.scale.setScalar(f.kind === "crab" ? 1.2 : 0.8 + 0.1 * (2 - Math.min(2, f.y)));
      o.shadow.visible = inSpan(f.z) && !dying && f.y < 3;
    }
    for (const [id, o] of foes) if (!seen.has(id)) { o.group.visible = o.shadow.visible = false; free.push(o); foes.delete(id); }

    // the hero
    const run = Math.sin(now * 16);
    const air = h.mode === "air" || h.lunge;
    hero.position.set(h.x, h.y, h.z);
    hero.rotation.set(0, 0, 0); body.rotation.set(0, 0, 0); body.position.y = 0;
    let lean = 0, roll = 0;
    if (h.mode === "wall") { roll = -h.wall * 1.15; hero.position.x = h.x + h.wall * 0.1; }
    else if (h.lunge) lean = h.lunge.how === "bonk" ? 0.9 : -0.5;
    else if (h.slam) lean = 0.5;
    body.rotation.z = roll;
    body.rotation.x = lean + (air ? -0.15 : 0);
    body.position.y = air || h.mode === "wall" ? 0 : Math.abs(run) * 0.06;
    legs[0].rotation.x = air ? -0.7 : run * 0.9; legs[1].rotation.x = air ? 0.5 : -run * 0.9;
    const lanesLean = (h.x - (h.lane * LANE_W)) * -0.25;
    hero.rotation.z = h.mode === "wall" ? 0 : lanesLean;
    blink = h.hurt > 0 ? blink + dt : 0;
    hero.visible = h.hurt <= 0 || Math.floor(blink * 14) % 2 === 0;
    const floor = !pits.some(p => h.z > p.z0 && h.z < p.z1);
    heroShadow.visible = floor && h.y < 6;
    heroShadow.position.set(h.x, 0.03, h.z);
    heroShadow.scale.setScalar(Math.max(0.3, 1.1 - h.y * 0.12));

    // effects
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i], t = (now - e.born) / e.life;
      if (t >= 1) { scene.remove(e.m); if (e.kind === "ring") { e.m.geometry.dispose(); e.m.material.dispose(); } fx.splice(i, 1); continue; }
      if (e.kind === "ring") { e.m.scale.setScalar(0.4 + e.r * t); e.m.material.opacity = 0.8 * (1 - t); }
      else { e.m.position.x += e.vx * dt; e.m.position.z += e.vz * dt; e.vy -= 9 * dt; e.m.position.y += e.vy * dt; e.m.scale.setScalar(0.12 * (1 - t)); }
    }

    // the camera: behind and above, easing to the hero's lane, a little higher when he is
    camX += (h.x * 0.55 - camX) * Math.min(1, dt * 6);
    camY += ((3.2 + Math.min(h.y, 4) * 0.35) - camY) * Math.min(1, dt * 4);
    const sx = (Math.random() - 0.5) * shake * 0.3, sy = (Math.random() - 0.5) * shake * 0.3;
    camera.position.set(camX + sx, camY + sy, h.z - 5.4);
    camera.lookAt(camX * 0.6, 1.2 + Math.min(h.y, 4) * 0.25, h.z + 10);
    sun.position.set(h.x - 5, 10, h.z - 2); sun.target.position.set(h.x, 0, h.z + 8);
    water.position.z = h.z;
    renderer.render(scene, camera);
  }

  /** The rules' events, as something seen. */
  function ping(ev, S) {
    const h = S.hero;
    switch (ev.type) {
      case "kill": burst(h.x, h.y + 0.8, h.z + 0.5, ev.how === "slam" ? 4 : 7); shake = Math.max(shake, 0.4); break;
      case "shockwave": ring(h.x, 0.06, h.z, 5.5, 0.5); shake = 1; break;
      case "hurt": shake = 1.2; break;
      case "fall": shake = 0.8; burst(h.x, -1.5, h.z, 8); break;
      case "land": if (ev.slam) shake = Math.max(shake, 0.8); break;
      case "clang": shake = 1; break;
      case "wallrun": case "walljump": shake = Math.max(shake, 0.25); break;
    }
  }

  function dispose() { renderer.dispose(); canvas.remove(); }
  retheme();
  resize();
  const themeWatch = new MutationObserver(retheme);
  themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", retheme);
  return { frame, ping, resize, retheme, dispose, canvas, get stats() { return renderer.info.render; }, palette: () => pal };
}
