// Reckoning in 3D, drawn with three.js (vendor/three-run.js): the quay as boxes, for now. Every shape here is a stand-in
// for a model that will come (README, Reckoning: the asset list): the hero, a crab, a gull, a warehouse, a bollard, each
// built in one place (`makeFoe`, the hero's block, the scenery's) so a glTF can take over one at a time. What stays when the models arrive is the look:
//  - a world that curves away below the horizon (a vertex patch on every material: the further from the camera, the
//    lower), which is what makes a straight run read as a run over the top of something;
//  - the Codex's palette, read from the page's own colours (style.css's tokens), so the three themes, day and night,
//    each get their quay: pale stone and brass in the day, navy and brass at night. Colour is held down; the Brim look
//    is a candy one and this one is dusk in a Hanse port;
//  - fog to the sky's colour, a hemisphere light and one sun, no shadows (a soft disc under each thing instead).
// The page (reckoning.js) steps the rules and calls frame(S, dt) each time it draws; ping(ev) turns the rules' events
// into what is seen (a burst, a ring, a shake).
import * as THREE from "./vendor/three-run.js";
import { LANE_W, WALL_X, KINDS, ROLL_T, speed } from "./reckoning-engine.js";

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
  const moon = c => (dark ? mix(c, [150, 172, 200], 0.3) : c);
  const glow = c => (dark ? mix(c, [235, 140, 105], 0.35) : c);        // the foes are lit more than the quay by night: they have to be seen       // by night things are lit by a moon: the same colours, lifted towards a cool grey
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
    hero: dark ? [84, 120, 182] : mix(plate, [36, 66, 124], 0.75),        // the coat: navy, a lighter blue by night so he is seen against the water
    scarf: moon(mix(e[3], [200, 56, 48], 0.55)),
    boot: dark ? [176, 112, 68] : mix(ink, [96, 62, 40], 0.45),     // leather: brown by night too (the ink turns pale then, and the moon's blue light washes a dark brown to grey)
    steel: moon(mix(sheet, [150, 172, 196], 0.55)),
    hair: dark ? [168, 112, 62] : mix(ink, [92, 60, 34], 0.45),
    shirt: moon(mix(sheet, [255, 250, 238], 0.3)),
    skin: dark ? [255, 200, 150] : mix([228, 186, 152], yard, 0.1),
    gilt: brass,
    crab: glow(moon(mix(mix(e[3], [205, 84, 58], 0.5), sheet, 0.05))),   // a boiled-red shell, its claws a shade towards orange, its belly pale
    claw: glow(moon(mix(mix(e[3], [205, 84, 58], 0.5), e[0], 0.4))),
    belly: moon(mix(sheet, e[0], 0.35)),
    eye: mix(sheet, [255, 255, 255], 0.4),
    pupil: ink,
    alert: token("--rk-bad"),                                  // the mark over a foe that has seen me
    mark: sheet,
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
  // The camera looks down +z, where a right-handed world's +x falls on the screen's left. The rules put lane +1 on the
  // right of the hero (a swipe right, the third answer), so everything is drawn in engine coordinates inside a group
  // mirrored in x, and only the camera is told the mirrored x. (three flips the faces of a mirrored object itself.)
  const world = new THREE.Group(); world.scale.x = -1; scene.add(world);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.3, 160);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.5);
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-4, 9, -3);
  world.add(hemi, sun, sun.target);
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
    banner: mat("banner"), skin: mat("skin"), good: mat("good"), claw: mat("claw"), belly: mat("belly"), eye: mat("eye"), pupil: mat("pupil"),
    markBg: curved(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), markSees: curved(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })),
    markWind: curved(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })),
    scarf: mat("scarf"), boot: mat("boot"), steel: mat("steel"), hair: mat("hair"), shirt: mat("shirt"),
    shadow: curved(new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false })),
    ring: curved(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })),
  };
  function retheme() {
    pal = palette();
    const set = (m, a) => col(a, m.color);
    set(M.stone, pal.stone); set(M.plank, pal.plank); set(M.seam, pal.seam); set(M.water, pal.water); M.brick.color.set(0xffffff); set(M.wall, pal.wall);        // the warehouses take their own colours (instance colours multiply the material's)
    set(M.timber, pal.timber); set(M.roof, pal.roof); set(M.hero, pal.hero); set(M.gilt, pal.gilt); set(M.crab, pal.crab); set(M.gull, pal.gull);
    set(M.banner, pal.banner); set(M.skin, pal.skin);
    set(M.scarf, pal.scarf); set(M.boot, pal.boot); set(M.steel, pal.steel); set(M.hair, pal.hair); set(M.shirt, pal.shirt); set(M.good, pal.good); set(M.ring, pal.ring);
    set(M.claw, pal.claw); set(M.belly, pal.belly); set(M.eye, pal.eye); set(M.pupil, pal.pupil);
    set(M.markBg, pal.mark); set(M.markSees, pal.gilt); set(M.markWind, pal.alert);
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
  const solid = () => { const m = new THREE.Mesh(box, M.stone); m.frustumCulled = false; world.add(m); solids.push(m); return m; };
  const water = new THREE.Mesh(new THREE.PlaneGeometry(60, 400).rotateX(-Math.PI / 2), M.water);
  water.position.y = -1.7; water.frustumCulled = false; world.add(water);
  const SEAMS = Math.ceil((AHEAD + BEHIND) / SEAM) + 2;
  const seams = new THREE.InstancedMesh(box, M.seam, SEAMS); seams.frustumCulled = false; world.add(seams);
  const edge = new THREE.InstancedMesh(box, M.plank, 2 * SEAMS);                         // a rail of planking down each side
  edge.frustumCulled = false; world.add(edge);

  // scenery: warehouses (a body and two steps of gable) and bollards, placed from the distance alone, so they are the same every time
  const HOUSES = 15;                                                                     // each side, each a body and two steps
  const houses = new THREE.InstancedMesh(box, M.brick, HOUSES * 2 * 3); houses.frustumCulled = false; houses.userData.tint = true; world.add(houses);
  const roofs = new THREE.InstancedMesh(box, M.roof, HOUSES * 2); roofs.frustumCulled = false; world.add(roofs);
  const BOLLARDS = 24;
  const posts = new THREE.InstancedMesh(cyl, M.timber, BOLLARDS * 2); posts.frustumCulled = false; world.add(posts);
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
  const wallBox = () => { const m = new THREE.Mesh(box, M.wall); m.frustumCulled = false; world.add(m); wallBoxes.push(m); return m; };

  // The hero: a young merchant-adventurer of the Hanse in a tricorn with a plume, a navy coat with gilt trim and a red sash,
  // cream breeches and tall boots, a red scarf streaming behind him, a rapier in his right hand and its scabbard at his left
  // hip. He is built round joints (hips, knees, shoulders, elbows, neck, and the tails of the coat and the scarf) so that a run,
  // a jump, a thrust and a roll are only poses of them (poseHero), and a glTF with joints of these names can take over.
  const hero = new THREE.Group();
  const body = new THREE.Group(); hero.add(body);
  const tp = (rt, rb, h, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const mesh = (geo, m, x, y, z, to, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); to.add(o); return o; };
  const joint = (to, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); to.add(g); return g; };
  const J = {};
  // legs: cream breeches to the knee, tall boots below it
  J.hip = [-1, 1].map(s => {
    const hip = joint(body, s * 0.1, 0.86, 0), knee = joint(hip, 0, -0.42, 0);
    mesh(tp(0.085, 0.07, 0.43), M.shirt, 0, -0.21, 0, hip);
    mesh(tp(0.07, 0.055, 0.4), M.boot, 0, -0.19, 0, knee);
    mesh(tp(0.092, 0.08, 0.1), M.boot, 0, 0.0, 0, knee);
    mesh(tp(0.097, 0.097, 0.025), M.gilt, 0, 0.045, 0, knee);
    mesh(box, M.boot, 0, -0.4, 0.07, knee, 0.13, 0.09, 0.28);
    hip.userData.knee = knee;
    return hip;
  });
  // the torso, from the waist up: the coat's chest and its skirt, the sash, the belt, the strap and the scabbard
  J.torso = joint(body, 0, 0.86, 0);
  mesh(tp(0.24, 0.19, 0.5), M.hero, 0, 0.27, 0, J.torso, 1.1, 1, 0.78);
  mesh(tp(0.21, 0.3, 0.34, 14), M.hero, 0, -0.12, 0, J.torso, 1.12, 1, 0.88);
  mesh(tp(0.305, 0.305, 0.025, 14), M.gilt, 0, -0.29, 0, J.torso, 1.12, 1, 0.88);
  mesh(tp(0.206, 0.206, 0.09), M.scarf, 0, 0.07, 0, J.torso, 1.12, 1, 0.82);
  mesh(tp(0.2, 0.2, 0.03), M.gilt, 0, 0.0, 0, J.torso, 1.12, 1, 0.82);
  mesh(box, M.gilt, 0, 0.0, 0.17, J.torso, 0.09, 0.08, 0.03);
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) mesh(sph, M.gilt, s * 0.045, 0.2 + i * 0.1, 0.152, J.torso, 0.035, 0.035, 0.035);
  mesh(box, M.boot, 0, 0.3, -0.172, J.torso, 0.07, 0.64, 0.02).rotation.z = 0.5;
  mesh(box, M.gilt, 0, 0.3, -0.18, J.torso, 0.09, 0.07, 0.015);
  J.tails = [-1, 1].map(s => {                                     // the coat's two tails behind, split down the middle
    const t = joint(J.torso, s * 0.1, -0.02, -0.19);
    mesh(box, M.hero, 0, -0.27, 0, t, 0.17, 0.54, 0.03);
    mesh(box, M.gilt, 0, -0.545, 0, t, 0.17, 0.025, 0.036);
    return t;
  });
  J.sheath = joint(J.torso, -0.23, -0.03, -0.05); J.sheath.rotation.x = -0.6;
  mesh(box, M.boot, 0, 0, -0.34, J.sheath, 0.045, 0.045, 0.68);
  mesh(sph, M.gilt, 0, 0, -0.69, J.sheath, 0.06, 0.06, 0.06);
  mesh(box, M.gilt, 0, 0, -0.02, J.sheath, 0.06, 0.06, 0.05);
  // the neck: scarf round it, two tails streaming from it
  mesh(tp(0.07, 0.08, 0.1), M.skin, 0, 0.58, 0, J.torso);
  mesh(tp(0.14, 0.16, 0.09), M.scarf, 0, 0.54, 0, J.torso, 1, 1, 0.95);
  J.scarf = [-1, 1].map(s => { const t = joint(J.torso, s * 0.07, 0.53, -0.14); mesh(box, M.scarf, 0, -0.23, 0, t, 0.1, 0.46, 0.02); mesh(box, M.gilt, 0, -0.465, 0, t, 0.1, 0.02, 0.025); return t; });
  // the head: a face, the hair tied back in a tail, and the tricorn with its plume
  J.head = joint(J.torso, 0, 0.74, 0);
  mesh(sph, M.skin, 0, 0, 0, J.head, 0.33, 0.35, 0.33);
  mesh(sph, M.hair, 0, 0.025, -0.04, J.head, 0.36, 0.34, 0.34);
  for (const s of [-1, 1]) mesh(sph, M.pupil, s * 0.058, 0.0, 0.153, J.head, 0.04, 0.05, 0.03);
  J.ponytail = joint(J.head, 0, -0.02, -0.17);
  mesh(tp(0.045, 0.02, 0.3), M.hair, 0, -0.15, 0, J.ponytail);
  mesh(sph, M.scarf, 0, 0.0, 0, J.ponytail, 0.1, 0.1, 0.1);
  J.hat = joint(J.head, 0, 0.1, 0);
  mesh(tp(0.35, 0.35, 0.035, 18), M.hero, 0, 0.03, 0, J.hat);
  mesh(tp(0.17, 0.2, 0.14, 16), M.hero, 0, 0.11, 0, J.hat);
  mesh(tp(0.206, 0.206, 0.035, 16), M.gilt, 0, 0.065, 0, J.hat);
  for (const s of [-1, 1]) mesh(box, M.hero, s * 0.3, 0.1, 0, J.hat, 0.16, 0.03, 0.3).rotation.z = -s * 0.55;     // the brim turned up on three sides
  mesh(box, M.hero, 0, 0.1, -0.3, J.hat, 0.3, 0.03, 0.16).rotation.x = 0.55;
  mesh(box, M.hero, 0, 0.08, 0.32, J.hat, 0.3, 0.03, 0.1).rotation.x = -0.35;
  J.plume = joint(J.hat, 0.2, 0.14, -0.05); J.plume.rotation.set(-0.5, 0, -0.7);
  mesh(cone, M.shirt, 0, 0.21, 0, J.plume, 0.07, 0.44, 0.05);
  mesh(cone, M.scarf, 0.03, 0.1, 0.01, J.plume, 0.05, 0.22, 0.04);
  // arms: coat sleeves, cream cuffs under gilt, gloves; the right hand holds the rapier, which runs along its forearm
  J.arm = [-1, 1].map(s => {
    const sh = joint(J.torso, s * 0.3, 0.46, 0), el = joint(sh, 0, -0.31, 0);
    mesh(sph, M.hero, 0, 0, 0, sh, 0.16, 0.16, 0.16);
    mesh(tp(0.062, 0.052, 0.3), M.hero, 0, -0.16, 0, sh);
    mesh(tp(0.052, 0.04, 0.27), M.shirt, 0, -0.13, 0, el);
    mesh(tp(0.064, 0.064, 0.03), M.gilt, 0, -0.24, 0, el);
    mesh(sph, M.boot, 0, -0.29, 0, el, 0.1, 0.1, 0.1);
    sh.userData.elbow = el;
    return sh;
  });
  {
    const hand = joint(J.arm[1].userData.elbow, 0, -0.29, 0);
    mesh(tp(0.02, 0.02, 0.16), M.boot, 0, -0.02, 0, hand);
    mesh(box, M.gilt, 0, -0.1, 0, hand, 0.2, 0.025, 0.05);
    mesh(sph, M.gilt, 0, 0.07, 0, hand, 0.05, 0.05, 0.05);
    mesh(box, M.steel, 0, -0.56, 0, hand, 0.035, 0.9, 0.012);
  }
  hero.traverse(o => { o.frustumCulled = false; });
  world.add(hero);
  const heroShadow = new THREE.Mesh(disc, M.shadow); heroShadow.scale.set(1, 1, 1); heroShadow.frustumCulled = false; world.add(heroShadow);

  // foes
  const foes = new Map();                                                                 // foe id -> { group, parts, born, died }
  const free = [];
  let runSeed = null;
  function makeFoe(f) {
    const g = new THREE.Group(), parts = {};
    const rig = new THREE.Group(); g.add(rig); parts.rig = rig;                         // what pitches, rears and hops; the group above it only turns
    const put = (geo, m, sx, sy, sz, x, y, z, to = rig) => { const o = new THREE.Mesh(geo, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); to.add(o); return o; };
    if (f.kind === "crab") {
      // a crab, so that it is read as one: a wide low shell over a pale belly, two eyes on stalks, six legs, and two big
      // claws with a thumb and a finger each, held up in front (all of it under 1.5 m across, the asset list's size)
      put(sph, M.crab, 1.0, 0.5, 0.78, 0, 0.46, 0);
      put(sph, M.belly, 0.86, 0.2, 0.66, 0, 0.3, 0.02);
      put(sph, M.crab, 0.5, 0.2, 0.3, 0, 0.66, 0.2);                                    // the brow
      parts.eyes = [-1, 1].map(s => {
        const e = new THREE.Group(); e.position.set(s * 0.17, 0.68, 0.34); rig.add(e);
        put(cyl, M.belly, 0.05, 0.2, 0.05, 0, 0.1, 0, e);
        put(sph, M.eye, 0.15, 0.15, 0.15, 0, 0.23, 0, e);
        put(sph, M.pupil, 0.08, 0.08, 0.08, 0, 0.24, 0.07, e);
        return e;
      });
      parts.arms = [-1, 1].map(s => {
        const arm = new THREE.Group(); arm.position.set(s * 0.46, 0.52, 0.28); rig.add(arm);
        put(cyl, M.crab, 0.11, 0.34, 0.11, 0, 0, 0.17, arm).rotation.x = Math.PI / 2;
        const claw = new THREE.Group(); claw.position.set(0, 0.03, 0.4); arm.add(claw);
        put(sph, M.claw, 0.42, 0.3, 0.46, 0, 0, 0.08, claw);
        const jaw = d => { const piv = new THREE.Group(); piv.position.set(d * 0.09, 0, 0.2); claw.add(piv); put(cone, M.claw, 0.17, 0.46, 0.12, 0, 0, 0.22, piv).rotation.x = Math.PI / 2; return piv; };
        arm.userData.jaws = [jaw(-1), jaw(1)];
        return arm;
      });
      parts.legs = [];
      for (const s of [-1, 1]) for (const k of [-1, 0, 1]) {
        const leg = new THREE.Group(); leg.position.set(s * 0.46, 0.34, k * 0.2 + 0.02); rig.add(leg);
        const up = put(cyl, M.crab, 0.06, 0.3, 0.06, s * 0.13, 0.04, 0, leg); up.rotation.z = -s * 1.1;
        const low = put(cyl, M.crab, 0.05, 0.3, 0.05, s * 0.3, -0.1, 0, leg); low.rotation.z = s * 0.25;
        parts.legs.push(leg);
        leg.userData = { s, k };
      }
    } else {
      put(sph, M.gull, 0.5, 0.42, 1.0, 0, 0.4, 0);
      put(cone, M.gilt, 0.12, 0.3, 0.12, 0, 0.42, 0.55).rotation.x = Math.PI / 2;
      parts.wings = [-1, 1].map(s => { const pivot = new THREE.Group(); pivot.position.set(s * 0.22, 0.46, 0); const w = new THREE.Mesh(box, M.gull); w.scale.set(0.6, 0.06, 0.5); w.position.x = s * 0.3; pivot.add(w); rig.add(pivot); return pivot; });
      parts.banner = put(box, M.banner, 0.5, 0.36, 0.04, 0, -0.22, 0);
      parts.rope = put(box, M.timber, 0.03, 0.4, 0.03, 0, 0.04, 0);
    }
    g.traverse(o => { o.frustumCulled = false; });
    const shadow = new THREE.Mesh(disc, M.shadow); shadow.frustumCulled = false;
    // the mark over a foe that has seen me: an exclamation point on a pale plate, facing the camera (behind the hero, so
    // facing -z), brass when it has just seen me and red when it is winding up
    const mark = new THREE.Group();
    put(cyl, M.markBg, 0.62, 0.05, 0.62, 0, 0, 0, mark).rotation.x = Math.PI / 2;
    const bar = put(box, M.markSees, 0.12, 0.3, 0.04, 0, 0.1, -0.05, mark), dot = put(sph, M.markSees, 0.13, 0.13, 0.06, 0, -0.17, -0.05, mark);
    mark.visible = false; mark.traverse(o => { o.frustumCulled = false; });
    world.add(g, shadow, mark);
    return { group: g, parts, shadow, mark, markParts: [bar, dot], kind: f.kind };
  }

  // effects: rings on the planks, bursts
  const fx = [];
  function ring(x, y, z, r, life) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 28).rotateX(-Math.PI / 2), M.ring.clone());
    m.material = curved(M.ring.clone());
    m.position.set(x, y, z); m.frustumCulled = false; world.add(m);
    fx.push({ m, born: now, life, r, kind: "ring" });
  }
  function burst(x, y, z, n = 6) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(box, M.gilt); m.scale.setScalar(0.12); m.position.set(x, y, z); m.frustumCulled = false; world.add(m);
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

  // ---------- the hero's poses ----------
  /** The hero's joints for what the rules say he is doing: running (the stride follows the quay, a stride to each 3.3 m), up
   *  in a jump (a knee drawn up, the arms high), coming down (arms out), at a foe (a lunge, the rapier out in front), in a
   *  roll (tucked), a slam (rapier down), or on a wall. Coat tails and scarf stream the way the wind from the run takes them. */
  function poseHero(h, dt) {
    const phi = h.z * 1.9, sn = Math.sin(phi), cs = Math.cos(phi), tt = now;
    const rolling = h.roll > 0 && h.mode === "run" && !h.lunge;
    // [hip x, knee x] of the left and the right leg; the shoulders' x and z, the elbows' x, of the left and the right arm
    let legs = [[-sn * 0.9, 0.2 + 0.85 * Math.max(0, cs)], [sn * 0.9, 0.2 + 0.85 * Math.max(0, -cs)]];
    let arms = [[sn * 0.8, 0, -1.0 + 0.3 * sn], [-0.55 + 0.15 * sn, 0, -1.25]];
    let lean = 0.16, twist = sn * 0.12, bob = Math.abs(sn) * 0.05, tails = 0.3 + 0.3 * Math.abs(sn), scarf = 1.15, headDip = 0, roll = 0;
    const fwd = h.lunge ? Math.sign(h.lunge.dir || 0) : 0;
    if (h.mode === "wall") { roll = -h.wall * 1.15; lean = 0.1; }
    else if (h.lunge) {
      const bonk = h.lunge.how === "bonk";
      lean = bonk ? 0.9 : 0.5; twist = -fwd * 0.3; bob = 0; tails = 0.7; scarf = 1.35;
      legs = [[-1.05, 0.75], [0.8, 0.12]];
      arms = [[0.9, 0, -0.6], [bonk ? -0.2 : -1.45, 0, bonk ? 0 : -0.08]];
    } else if (h.mode === "air") {
      bob = 0; twist = 0;
      if (h.slam) { lean = 0.4; legs = [[0.1, 0.25], [0.2, 0.25]]; arms = [[0.7, 0.2, -0.4], [0.15, -0.2, 0]]; tails = 2.3; scarf = 2.4; }
      else if (h.vy > 0) { lean = -0.05; legs = [[-1.0, 1.35], [0.4, 0.55]]; arms = [[-2.4, 0.3, -0.5], [-2.2, -0.2, -0.3]]; tails = 0.9; scarf = 0.7; }
      else { lean = 0.1; legs = [[-0.5, 0.45], [0.45, 0.4]]; arms = [[-0.2, 0.9, -0.3], [-0.2, -0.9, -0.3]]; tails = 2.0; scarf = 2.1; }
    }
    if (rolling) {
      const a = (1 - h.roll / ROLL_T) * Math.PI * 2;
      body.rotation.x = a;
      body.position.set(0, 0.9 * (1 - Math.cos(a)) - 0.3, -0.9 * Math.sin(a));
      legs = [[-1.55, 2.3], [-1.55, 2.3]]; arms = [[-1.2, 0.2, -1.7], [-1.2, -0.2, -1.7]];
      lean = 0; twist = 0; bob = 0; headDip = 0.5; tails = 0.3; scarf = 0.9;
    } else {
      body.rotation.x = lean * 0.5;                                  // the rest of the lean is in the waist, so the legs do not lean with it
      body.rotation.z = roll;
      body.position.y = bob;
    }
    J.hip.forEach((hip, i) => { hip.rotation.x = legs[i][0]; hip.userData.knee.rotation.x = legs[i][1]; });
    J.arm.forEach((a, i) => { a.rotation.set(arms[i][0], 0, arms[i][1] * (i ? 1 : -1)); a.userData.elbow.rotation.x = arms[i][2]; });
    J.torso.rotation.set(rolling ? 0 : lean * 0.5, twist, 0);
    J.head.rotation.set(headDip - (rolling ? 0 : lean * 0.35), -twist * 0.8, 0);
    J.tails.forEach((t, i) => { t.rotation.set(tails + 0.12 * Math.sin(tt * 12 + i * 1.9), 0, (i ? 1 : -1) * 0.08 * Math.sin(tt * 9 + i)); });
    J.scarf.forEach((t, i) => { t.rotation.set(scarf + 0.13 * Math.sin(tt * 11 + i * 1.7), 0, (i ? 1 : -1) * (0.12 + 0.1 * Math.sin(tt * 8 + i))); });
    J.ponytail.rotation.x = 0.45 + 0.25 * Math.sin(phi * 2 + 1) + (h.mode === "air" ? 0.3 : 0);
    J.plume.rotation.set(-0.5 + 0.12 * Math.sin(tt * 7), 0, -0.7 + 0.1 * Math.sin(tt * 5));
  }

  // ---------- the foes' poses ----------
  const ease = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
  const hideFoe = o => { o.group.visible = o.shadow.visible = o.mark.visible = false; };

  /** A foe at rest, or seeing me (f.ph 1: it turns to look, the claws go up and snap, the mark pops over its head), winding
   *  up (2: it rears, the mark is red and shakes) or launched (3: it springs, a crab hopping at me, a gull diving). The rules
   *  put the foe where it is (f.x and f.y move as it launches); this is only how it holds itself. */
  function poseFoe(o, f, S) {
    const g = o.group, rig = o.parts.rig, P = o.parts;
    const ph = f.ph || 0, since = S.t - (f.pt || 0), p = f.p || 0, e3 = ease(p), look = f.look || 0;
    const crab = f.kind === "crab", id = f.id;
    let yaw = 0, pitch = 0, hop = 0, adv = 0, rise = 0, shiver = 0, marked = 0;
    if (ph === 1) { yaw = look * 0.75 * ease(since / 0.15); marked = 1; }
    else if (ph === 2) { yaw = look * 0.75; pitch = -(crab ? 0.4 : 0.55) * ease(since / 0.2); rise = crab ? 0 : 0.45 * ease(since / 0.25); shiver = Math.sin(now * 70) * 0.03; marked = 2; }
    else if (ph === 3) { yaw = look * 0.5 * (1 - e3); pitch = (crab ? 0.5 : 1.0) * e3 - (crab ? 0.4 : 0.55) * (1 - e3); hop = crab ? 0.45 * Math.sin(Math.PI * p) : 0; adv = crab ? 0.8 * e3 : 0; rise = crab ? 0 : 0.45 * (1 - e3); }
    const lift = f.kind === "gull" ? f.y + rise + 0.05 * Math.sin(now * 3 + id) : f.y;
    g.visible = true;
    g.position.set(f.x + shiver, lift, f.z - adv);
    g.rotation.set(0, Math.PI - yaw, 0);
    g.scale.setScalar(1);
    rig.rotation.set(-pitch, 0, 0);
    rig.position.set(0, hop, 0);
    if (f.spent && f.alive) g.rotation.z = Math.sin(now * 30) * 0.08;
    if (crab) {
      let raise = 0.4 + 0.12 * Math.sin(now * 5 + id), spread = 0.15, jaw = 0.18 + 0.12 * Math.sin(now * 7 + id);
      if (ph === 1) { raise = 0.75; jaw = 0.1 + 0.4 * (0.5 + 0.5 * Math.sin(now * 20)); }
      else if (ph === 2) { raise = 0.75 + 0.6 * ease(since / 0.2); spread = 0.65; jaw = 0.55; }
      else if (ph === 3) { raise = 1.35 * (1 - e3) - 0.25 * e3; spread = 0.65 * (1 - e3); jaw = 0.55 * (1 - e3) + 0.05; }
      P.arms.forEach((a, i) => { const s = i ? 1 : -1; a.rotation.set(-raise, s * spread, 0); a.userData.jaws.forEach((j, n) => { j.rotation.y = (n ? -1 : 1) * jaw; }); });
      P.eyes.forEach((e, i) => { e.rotation.z = (i ? 1 : -1) * (ph ? 0.1 : 0.25 + 0.1 * Math.sin(now * 3 + id)); e.position.y = 0.68 + (ph ? 0.06 : 0); });
      P.legs.forEach(l => { l.rotation.y = Math.sin(now * (ph === 3 ? 30 : 12) + l.userData.k * 2 + l.userData.s + id) * 0.3; });
    } else {
      const fast = ph === 1 ? 14 : ph === 2 ? 5 : 9, amp = ph === 2 ? 0.95 : 0.55;
      P.wings.forEach((w, i) => {
        const s = i ? 1 : -1;
        w.rotation.z = s * (ph === 3 ? 0.45 : Math.sin(now * fast + id) * amp + (ph === 2 ? 0.3 : 0));
        w.rotation.y = ph === 3 ? s * 0.9 * e3 : 0;
      });
      P.banner.visible = P.rope.visible = !!f.gate;                                         // only the gulls of a question carry a banner
    }
    // the mark
    const m = o.mark;
    m.visible = !!marked;
    if (marked) {
      const pop = ease(since / 0.15) * (1 + 0.3 * Math.sin(Math.min(1, since / 0.15) * Math.PI)), beat = marked === 2 ? 1 + 0.12 * Math.sin(now * 26) : 1;
      m.position.set(f.x, lift + (crab ? 1.5 : 1.15), f.z - adv);
      m.scale.setScalar(Math.max(0.01, pop * beat) * (marked === 2 ? 1.15 : 1));
      o.markParts.forEach(x => { x.material = marked === 2 ? M.markWind : M.markSees; });
    }
  }

  /** How a foe is thrown when it is cut down, from the way the cut came: a cut from in front sends it on ahead, one from the
   *  side to that side, a roll along the planks, a slam outward from me, a bonk straight up. */
  function knock(o, f, S) {
    const h = S.hero, v = speed(S), side = Math.sign(f.x - h.x) || 1;
    const how = o.how, dir = o.dir;
    let vx = side * 2.5, vy = 5, vz = v + 3, sx = -9, sz = side * 4;
    if (how === "side") { vx = (dir || side) * 8; vy = 4.5; vz = v + 1; sx = -4; sz = -(dir || side) * 12; }
    else if (how === "front" || how === "above" || how === "up") { vx = 0; vy = 7.5; vz = v + 4; sx = -9; sz = side * 3; }
    else if (how === "roll") { vx = 0; vy = 4; vz = v + 9; sx = -14; sz = 0; }
    else if (how === "slam") { vx = side * 7; vy = 9; vz = v + 3; sx = -8; sz = side * 9; }
    else if (how === "bonk") { vx = side * 1.5; vy = 3; vz = v + 1; sx = -5; sz = side * 4; }
    return { x: f.x, y: f.y, z: f.z, vx, vy, vz, sx, sz, r: 0, q: 0, flat: how === "bonk" };
  }

  /** A foe that has been cut down flies off the way it was thrown, tumbling, and shrinks away. */
  function flyBack(o, f, dt) {
    const k = o.fly, t = (now - o.died) / 0.85;
    if (!k || t >= 1) { hideFoe(o); return; }
    k.vy -= 16 * dt; k.x += k.vx * dt; k.y = Math.max(0, k.y + k.vy * dt); k.z += k.vz * dt; k.r += k.sx * dt; k.q += k.sz * dt;
    const g = o.group;
    g.visible = true;
    g.position.set(k.x, k.y, k.z);
    g.rotation.set(0, Math.PI, 0);
    o.parts.rig.rotation.set(k.r, 0, k.q);
    o.parts.rig.position.set(0, 0.3, 0);
    g.scale.set(1, k.flat && t < 0.2 ? 0.3 : 1, 1).multiplyScalar(t < 0.55 ? 1 : 1 - ease((t - 0.55) / 0.45));
    o.mark.visible = false;
    o.shadow.visible = false;
  }

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
    if (S.seed !== runSeed) { for (const o of foes.values()) { hideFoe(o); free.push(o); } foes.clear(); runSeed = S.seed; }
    const seen = new Set();
    for (const f of W_.foes) {
      if (f.z < z0 - 4 || f.z > z1) continue;
      seen.add(f.id);
      let o = foes.get(f.id);
      if (!o) { o = free.find(x => x.kind === f.kind) || makeFoe(f); const k = free.indexOf(o); if (k >= 0) free.splice(k, 1); o.born = now; o.died = 0; o.fly = null; o.how = ""; o.dir = 0; o.group.visible = o.shadow.visible = true; foes.set(f.id, o); }
      if (!f.alive && !o.died) { o.died = now; o.fly = knock(o, f, S); }
      if (o.died) { flyBack(o, f, dt); continue; }
      poseFoe(o, f, S);
      o.shadow.position.set(f.x, 0.025, f.z);
      o.shadow.scale.setScalar(f.kind === "crab" ? 1.2 : 0.8 + 0.1 * (2 - Math.min(2, f.y)));
      o.shadow.visible = inSpan(f.z) && f.y < 3;
    }
    for (const [id, o] of foes) if (!seen.has(id)) { hideFoe(o); free.push(o); foes.delete(id); }

    // the hero
    hero.position.set(h.x, h.y, h.z);
    hero.rotation.set(0, 0, 0); body.rotation.set(0, 0, 0); body.position.set(0, 0, 0);
    if (h.mode === "wall") hero.position.x = h.x + h.wall * 0.1;
    poseHero(h, dt);
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
      if (t >= 1) { world.remove(e.m); if (e.kind === "ring") { e.m.geometry.dispose(); e.m.material.dispose(); } fx.splice(i, 1); continue; }
      if (e.kind === "ring") { e.m.scale.setScalar(0.4 + e.r * t); e.m.material.opacity = 0.8 * (1 - t); }
      else { e.m.position.x += e.vx * dt; e.m.position.z += e.vz * dt; e.vy -= 9 * dt; e.m.position.y += e.vy * dt; e.m.scale.setScalar(0.12 * (1 - t)); }
    }

    // the camera: behind and above, easing to the hero's lane, a little higher when he is
    camX += (h.x * 0.55 - camX) * Math.min(1, dt * 6);
    camY += ((3.2 + Math.min(h.y, 4) * 0.35) - camY) * Math.min(1, dt * 4);
    const sx = (Math.random() - 0.5) * shake * 0.3, sy = (Math.random() - 0.5) * shake * 0.3;
    camera.position.set(-(camX + sx), camY + sy, h.z - 5.4);
    camera.lookAt(-camX * 0.6, 1.2 + Math.min(h.y, 4) * 0.25, h.z + 10);
    sun.position.set(h.x - 5, 10, h.z - 2); sun.target.position.set(h.x, 0, h.z + 8);
    water.position.z = h.z;
    renderer.render(scene, camera);
  }

  /** The rules' events, as something seen. */
  function ping(ev, S) {
    const h = S.hero;
    switch (ev.type) {
      case "jump": if (ev.air) ring(h.x, h.y + 0.1, h.z, 1.6, 0.35); break;
      case "kill": {
        const o = foes.get(ev.id); if (o) { o.how = ev.how; o.dir = ev.dir || 0; }
        burst(h.x, h.y + 0.8, h.z + 0.5, ev.how === "slam" ? 4 : 7); shake = Math.max(shake, 0.4); break;
      }
      case "launch": shake = Math.max(shake, 0.12); break;
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
