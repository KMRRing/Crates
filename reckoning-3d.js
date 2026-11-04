// Courier in 3D, drawn with three.js (vendor/three-run.js): the quay as boxes, for now. Every shape here is a stand-in
// for a model that will come (docs/courier.md: the asset list): the hero, a crab, a gull, a warehouse, a bollard, each
// built in one place (`makeFoe`, the hero's block, the scenery's) so a glTF can take over one at a time. What stays when the models arrive is the look:
//  - a world that curves away below the horizon (a vertex patch on every material: the further from the camera, the
//    lower), which is what makes a straight run read as a run over the top of something;
//  - the Codex's palette, read from the page's own colours (style.css's tokens), so the three themes, day and night,
//    each get their quay: pale stone and brass in the day, navy and brass at night. Colour is held down; the Brim look
//    is a candy one and this one is dusk in a Hanse port;
//  - fog to the sky's colour, a hemisphere light and one sun, no shadows (a soft disc under each thing instead).
// The page (reckoning.js) steps the rules and calls frame(S, dt, opts) each time it draws; ping(ev) turns the rules' events
// into what is seen (a burst, a ring, dust, spray, a kick to the camera or the hero's body). How the camera and the hero's
// body move between the rules' steps (springs, a pose carried over from the one before, the scarf and coat tails dragged by the
// air) is reckoning-move.js; here it is only drawn.
import * as THREE from "./vendor/three-run.js";
import { LANE_W, WALL_X, KINDS, ROLL_T, JUMP_V, speed, solid, tide, bridgeUp } from "./reckoning-engine.js";
import { Spring, Inertia, Streamer, CameraRig, clamp, lerp, ease } from "./reckoning-move.js";

const BEND = 0.0013;                    // how fast the world drops away: metres of fall per metre-squared of distance
const BEND_FROM = 9;                    // from this far in front of the camera (the hero is nearer, and stays level)
const QUAY_W = 3 * LANE_W + 0.9;
const WATER_Y = -1.7;                  // the water under the quay
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
const sky_ = (yard, dark) => (dark ? mix(yard, [40, 62, 92], 0.6) : mix(yard, [236, 228, 208], 0.35));
function palette() {
  const yard = token("--yard"), sheet = token("--sheet"), ink = token("--ink"), brass = token("--brass"), plate = token("--plate");
  const e = [0, 1, 2, 3].map(i => mix(grey(token(`--c${i}`), 0.45), yard, 0.25));
  const dark = night();
  const moon = c => (dark ? mix(c, [150, 172, 200], 0.3) : c);
  const glow = c => (dark ? mix(c, [235, 140, 105], 0.35) : c);        // the foes are lit more than the quay by night: they have to be seen       // by night things are lit by a moon: the same colours, lifted towards a cool grey
  return {
    sky: sky_(yard, dark),
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
    plank2: moon(mix(mix(sheet, yard, 0.35), mix(ink, yard, 0.8), 0.1)),     // every other plank a shade darker, so the quay strobes under the eye as it goes by
    dust: dark ? [178, 196, 224] : mix([255, 252, 244], brass, 0.12),     // what the planks give up: a pale warm dust, a cool one by night
    spray: mix(mix(token("--c2"), [255, 255, 255], 0.7), yard, 0.1),
    streak: dark ? mix(sky_(yard, dark), [215, 230, 255], 0.55) : mix(sky_(yard, dark), [255, 255, 255], 0.75),
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
    plank2: mat("plank2"), pole: mat("pole"),
    dust: curved(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false })),
    spray: curved(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, depthWrite: false })),
    streak: curved(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, fog: false })),
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
    set(M.plank2, pal.plank2); set(M.pole, pal.timber); set(M.dust, pal.dust); set(M.spray, pal.spray); set(M.streak, pal.streak);
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
  water.position.y = WATER_Y; water.frustumCulled = false; world.add(water);
  const SEAMS = Math.ceil((AHEAD + BEHIND) / SEAM) + 2;
  const seams = new THREE.InstancedMesh(box, M.seam, SEAMS); seams.frustumCulled = false; world.add(seams);
  const edge = new THREE.InstancedMesh(box, M.plank, 2 * SEAMS);                         // a rail of planking down each side
  edge.frustumCulled = false; world.add(edge);

  // every other plank a shade darker, so the deck strobes under the eye as it goes by; and tall posts with lanterns standing in the
  // water beside the quay: what sweeps past at the edges of the picture is what tells the eye how fast it is going
  const darkPlanks = new THREE.InstancedMesh(box, M.plank2, Math.ceil(SEAMS / 2) + 2); darkPlanks.frustumCulled = false; world.add(darkPlanks);
  const LAMPS = 9, LAMP_GAP = 13;
  const poles = new THREE.InstancedMesh(cyl, M.pole, LAMPS * 2); poles.frustumCulled = false; world.add(poles);
  const lanterns = new THREE.InstancedMesh(box, M.gilt, LAMPS * 2); lanterns.frustumCulled = false; world.add(lanterns);
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
    } else if (f.kind === "barrel") {
      put(cyl, M.timber, 0.85, 0.85, 0.85, 0, 0.425, 0);
      for (const y of [0.17, 0.68]) put(cyl, M.gilt, 0.9, 0.07, 0.9, 0, y, 0);
      put(cyl, M.seam, 0.5, 0.02, 0.5, 0, 0.855, 0);                                       // the lid
    } else if (f.kind === "balloon") {
      parts.body = put(sph, M.good, 0.8, 0.98, 0.8, 0, 0.66, 0);
      put(sph, M.eye, 0.2, 0.28, 0.14, -0.14, 0.86, -0.3);                                  // the shine, on the side the camera sees
      put(cone, M.timber, 0.14, 0.16, 0.14, 0, 0.12, 0).rotation.x = Math.PI;               // the knot
      put(box, M.ring, 0.018, 0.85, 0.018, 0, -0.32, 0);                                    // and the string
    } else {
      put(sph, M.gull, 0.5, 0.42, 1.0, 0, 0.4, 0);
      put(cone, M.gilt, 0.12, 0.3, 0.12, 0, 0.42, 0.55).rotation.x = Math.PI / 2;
      parts.wings = [-1, 1].map(s => { const pivot = new THREE.Group(); pivot.position.set(s * 0.22, 0.46, 0); const w = new THREE.Mesh(box, M.gull); w.scale.set(0.6, 0.06, 0.5); w.position.x = s * 0.3; pivot.add(w); rig.add(pivot); return pivot; });
      parts.banner = put(box, M.banner, 0.5, 0.36, 0.04, 0, -0.22, 0);
      parts.rope = put(box, M.timber, 0.03, 0.4, 0.03, 0, 0.04, 0);
    }
    g.traverse(o => { o.frustumCulled = false; });
    if (f.heavy) { put(cone, M.steel, 0.5, 0.35, 0.5, 0, 0.95, 0.05); put(box, M.steel, 0.95, 0.12, 0.7, 0, 0.78, 0.12); g.traverse(o => { o.frustumCulled = false; }); }
    const shadow = new THREE.Mesh(disc, M.shadow); shadow.frustumCulled = false;
    // the mark over a foe that has seen me: an exclamation point on a pale plate, facing the camera (behind the hero, so
    // facing -z), brass when it has just seen me and red when it is winding up
    const mark = new THREE.Group();
    put(cyl, M.markBg, 0.62, 0.05, 0.62, 0, 0, 0, mark).rotation.x = Math.PI / 2;
    const bar = put(box, M.markSees, 0.12, 0.3, 0.04, 0, 0.1, -0.05, mark), dot = put(sph, M.markSees, 0.13, 0.13, 0.06, 0, -0.17, -0.05, mark);
    mark.visible = false; mark.traverse(o => { o.frustumCulled = false; });
    world.add(g, shadow, mark);
    return { group: g, parts, shadow, mark, markParts: [bar, dot], kind: f.kind, heavy: !!f.heavy };
  }

  // ---------- a section's things: what blocks the quay, what is picked up, the finish ----------
  // Boxes and cylinders, like everything else here; their colours are the goods' own, the same in every theme.
  const GOODC = { salt: 0xEDE6D3, herring: 0x7F9CB4, furs: 0x7A5230, wax: 0xE2C24A, grog: 0xB5651D, amber: 0xF0A12B, meal: 0xC4573A, lever: 0xB8892B };
  const MARKC = [0x808080, 0xC5483A, 0x3E9A6B, 0x3E78B5];
  const flats = {};
  const flat = (hex, glow = 0) => (flats[`${hex}:${glow}`] ||= curved(new THREE.MeshLambertMaterial({ color: hex, emissive: glow ? hex : 0x000000, emissiveIntensity: glow })));
  const things = new Map(), thingFree = [];
  const part = (to, geo, m, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(geo, m); o.scale.set(sx, sy, sz); o.position.set(x, y, z); to.add(o); return o; };

  const BRIDGEC = [0xC5483A, 0x3E78B5];                                                  // red and blue: the lever's two colours
  const basic = hex => curved(new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide }));
  const BASIC = { green: basic(0x2F9E6B), red: basic(0xC8402F), amber: basic(0xE8A21A), gold: basic(0xF2C230) };
  const triGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 3), discGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 18);
  /** A bridge colour's mark, in shape as well as colour: a triangle for red and a disc for blue (flat on a deck, or `upright` on a board). */
  function glyph(i, size, thick, upright = false) {
    const m_ = new THREE.Mesh(i ? discGeo : triGeo, flat(BRIDGEC[i ? 1 : 0], 0.35));
    m_.scale.set(size * 2, thick, size * 2); if (upright) m_.rotation.x = Math.PI / 2;
    const g_ = new THREE.Group(); g_.add(m_);
    if (upright) { const back = new THREE.Mesh(box, M.timber); back.scale.set(size * 2.6, size * 2.6, 0.04); back.position.z = 0.04; g_.add(back); }
    return g_;
  }

  /** The shape of one thing: `pose` is what moves in it (a bridge lies down, an arm lifts), `base` where it stands. */
  function makeThing(kind, o) {
    const g = new THREE.Group(), T = { group: g, kind, mark: o.mark || 0 };
    if (kind === "barrel") {
      part(g, cyl, M.timber, 0.85, 0.85, 0.85, 0, 0.425, 0);
      for (const y of [0.18, 0.68]) part(g, cyl, M.gilt, 0.9, 0.07, 0.9, 0, y, 0);
    } else if (kind === "beam") {
      part(g, box, M.timber, 0.06, 2.6, 0.06, 0, 3.4, 0);                                // the rope it hangs by
      part(g, box, M.timber, 1.5, 1.35, 0.95, 0, 1.5, 0);
      part(g, box, M.gilt, 1.56, 0.08, 1.0, 0, 1.0, 0); part(g, box, M.gilt, 1.56, 0.08, 1.0, 0, 2.0, 0);
    } else if (kind === "cart") {
      part(g, box, M.wall, 1.5, 1.4, 1.5, 0, 0.7, 0); part(g, box, M.timber, 1.4, 1.1, 1.3, 0, 1.95, 0);
      part(g, box, M.gilt, 1.55, 0.08, 1.55, 0, 1.4, 0);
    } else if (kind === "toll") {
      // a toll booth: two posts and a bar that lifts for the token of its number (the plate over it shows the number)
      for (const s of [-1, 1]) part(g, cyl, M.timber, 0.16, 2.7, 0.16, s * 0.78, 1.35, 0);
      T.leaf = new THREE.Group(); g.add(T.leaf);
      T.leaf.position.set(-0.78, 1.15, 0);
      part(T.leaf, box, M.crab, 1.56, 0.2, 0.14, 0.78, 0, 0); part(T.leaf, box, M.shirt, 0.3, 0.2, 0.16, 0.3, 0, 0); part(T.leaf, box, M.shirt, 0.3, 0.2, 0.16, 1.1, 0, 0);
      part(g, box, flat(MARKC[o.mark]), 1.5, 0.5, 0.1, 0, 2.45, 0);
      for (let i = 0; i < o.mark; i++) part(g, sph, M.shirt, 0.2, 0.2, 0.12, (i - (o.mark - 1) / 2) * 0.34, 2.45, -0.07);
      T.k = 1;
    } else if (kind === "bridge") {
      // a drawbridge over a channel: a span hinged at its far end that lies flat (cross it) or stands on end (a wall). Its colour and
      // mark (red triangle, blue disc) are the lever's: stepping on a lever lowers the bridges of the colour it shows
      const col_ = o.flip ? BRIDGEC[1] : BRIDGEC[0];
      part(g, box, flat(0x1d4a6e), 1.62, 0.05, 2.4, 0, 0.025, 0);                          // the channel under it
      part(g, box, M.wall, 0.3, 0.7, 2.4, -0.88, 0.35, 0); part(g, box, M.wall, 0.3, 0.7, 2.4, 0.88, 0.35, 0);       // its banks
      part(g, box, M.wall, 1.7, 0.45, 0.4, 0, 0.22, 1.1);                                     // the sill the leaf rests on at the far end
      T.hinge = new THREE.Group(); T.hinge.position.set(0, 0.3, 1.2); g.add(T.hinge);
      part(T.hinge, box, M.timber, 1.46, 0.12, 2.3, 0, 0, -1.15);
      for (const s_ of [-1, 1]) part(T.hinge, box, flat(col_, 0.2), 0.1, 0.16, 2.3, s_ * 0.68, 0.06, -1.15);        // coloured rails
      part(T.hinge, box, M.gilt, 1.46, 0.05, 0.1, 0, 0.07, -0.1); part(T.hinge, box, M.gilt, 1.46, 0.05, 0.1, 0, 0.07, -2.2);
      const top_ = glyph(o.flip, 0.3, 0.03); top_.position.set(0, 0.09, -1.15); T.hinge.add(top_);                       // the mark on both faces of the span
      const under_ = glyph(o.flip, 0.3, 0.03); under_.position.set(0, -0.09, -1.15); T.hinge.add(under_);
      for (const s_ of [-1, 1]) part(g, box, M.wall, 0.32, 2.2, 0.32, s_ * 0.88, 1.1, 1.3);                         // the tower on the far bank
      const sign = glyph(o.flip, 0.28, 0.06, true); sign.position.set(-0.88, 1.35, -1.25); g.add(sign);               // and a board at the near bank
      part(g, box, M.timber, 0.07, 1.3, 0.07, -0.88, 0.65, -1.25);
      T.k = 1;
    } else if (kind === "tide") {
      // a sluice gate: a grating on a frame that is raised clear over the lane (open: green lamp and a ring) or lowered to the planks (shut:
      // red lamp and a cross), half way and flashing amber for the last moments before it changes; water runs in the channel when it is open
      for (const s_ of [-1, 1]) part(g, cyl, M.timber, 0.18, 3.0, 0.18, s_ * 0.8, 1.5, 0);
      part(g, box, M.timber, 1.9, 0.3, 0.3, 0, 3.0, 0);
      part(g, box, flat(0x1d4a6e), 1.62, 0.05, 1.3, 0, 0.025, 0);
      T.water = part(g, box, flat(0x4FA3D8, 0.35), 1.5, 0.04, 1.2, 0, 0.06, 0);
      T.leaf = new THREE.Group(); g.add(T.leaf);
      for (let i = -2; i <= 2; i++) part(T.leaf, box, M.steel, 0.09, 2.5, 0.09, i * 0.3, 1.25, 0);
      part(T.leaf, box, M.steel, 1.5, 0.1, 0.12, 0, 2.45, 0); part(T.leaf, box, M.steel, 1.5, 0.1, 0.12, 0, 1.2, 0);
      for (let i = 0; i < 6; i++) part(T.leaf, box, flat(i & 1 ? 0xF2F2EC : 0xC8402F), 0.25, 0.14, 0.15, (i - 2.5) * 0.25, 0.1, 0);     // a hazard stripe on its lower rail
      T.lamp = part(g, sph, BASIC.green, 0.3, 0.3, 0.3, 0, 3.3, 0);
      T.ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.31, 20), BASIC.green); T.ring.position.set(0, 3.85, 0); g.add(T.ring);                          // passable
      T.cross = new THREE.Group(); T.cross.position.set(0, 3.85, 0); g.add(T.cross);                                                                          // blocked
      for (const a of [Math.PI / 4, -Math.PI / 4]) { const b_ = part(T.cross, box, BASIC.red, 0.1, 0.62, 0.05, 0, 0, 0); b_.rotation.z = a; }
      T.k = 1;
    } else if (kind === "token") {
      T.spin = part(g, cyl, flat(MARKC[o.mark], 0.25), 0.7, 0.1, 0.7, 0, 0, 0); T.spin.rotation.x = Math.PI / 2;
      for (let i = 0; i < o.mark; i++) part(g, sph, M.shirt, 0.11, 0.11, 0.11, (i - (o.mark - 1) / 2) * 0.2, 0, -0.07);
    } else if (kind === "lever") {
      // a lever on a plate with a red pad (triangle) and a blue pad (disc): the handle leans to the colour whose bridges are down now,
      // the pad of the colour the next step will lower pulses, and a dashed line of that colour runs down the quay to the bridges
      part(g, box, M.timber, 1.0, 0.16, 0.7, 0, -0.36, 0);
      T.pads = [0, 1].map(i => { const pd = part(g, box, flat(BRIDGEC[i], 0.2), 0.34, 0.07, 0.34, (i ? 1 : -1) * 0.3, -0.26, 0); const gl = glyph(i, 0.16, 0.05); gl.position.set((i ? 1 : -1) * 0.3, -0.2, 0); g.add(gl); return pd; });
      T.spin = new THREE.Group(); T.spin.position.set(0, -0.26, 0); g.add(T.spin);
      part(T.spin, box, M.steel, 0.1, 0.8, 0.1, 0, 0.4, 0);
      T.knobs = [0, 1].map(i => { const kn = part(T.spin, sph, flat(BRIDGEC[i], 0.3), 0.28, 0.28, 0.28, 0, 0.85, 0); kn.visible = false; return kn; });
      T.wire = Array.from({ length: 14 }, () => { const w_ = part(g, box, flat(BRIDGEC[0], 0.4), 0.22, 0.03, 0.55, 0, -0.43, 1); w_.visible = false; return w_; });
    } else if (kind === "coin") {
      T.spin = new THREE.Group(); g.add(T.spin);
      const c_ = part(T.spin, cyl, flat(0xF2C230, 0.55), 0.46, 0.07, 0.46, 0, 0, 0); c_.rotation.x = Math.PI / 2;
      const r_ = part(T.spin, cyl, flat(0xC9961A, 0.3), 0.32, 0.09, 0.32, 0, 0, 0); r_.rotation.x = Math.PI / 2;
    } else if (kind === "gem") {
      // amber: a big faceted drop with a ring round it, glowing, so it is seen from far off
      T.spin = new THREE.Group(); g.add(T.spin);
      part(T.spin, sph, flat(0xF0A12B, 0.75), 0.5, 0.74, 0.5, 0, 0, 0);
      part(T.spin, cone, flat(0xFFD27A, 0.8), 0.34, 0.4, 0.34, 0, 0.38, 0); part(T.spin, cone, flat(0xC9761A, 0.6), 0.34, 0.4, 0.34, 0, -0.38, 0).rotation.x = Math.PI;
      T.halo = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 24), BASIC.gold); g.add(T.halo);
    } else if (kind === "amber") {
      T.spin = part(g, sph, flat(GOODC.amber, 0.55), 0.46, 0.62, 0.46, 0, 0, 0);
    } else if (kind === "herring" || kind === "grog") {
      T.spin = new THREE.Group(); g.add(T.spin);
      part(T.spin, cyl, flat(GOODC[kind]), 0.55, 0.62, 0.55, 0, 0, 0); part(T.spin, cyl, M.gilt, 0.58, 0.07, 0.58, 0, 0.17, 0); part(T.spin, cyl, M.gilt, 0.58, 0.07, 0.58, 0, -0.17, 0);
    } else if (kind === "meal") {
      T.spin = new THREE.Group(); g.add(T.spin);
      part(T.spin, sph, flat(GOODC.meal), 0.6, 0.4, 0.5, 0, 0, 0); part(T.spin, sph, M.shirt, 0.2, 0.14, 0.2, 0, 0.2, 0);
    } else {                                                                              // a sack: salt, furs, wax
      T.spin = new THREE.Group(); g.add(T.spin);
      part(T.spin, sph, flat(GOODC[kind] || 0xcccccc), 0.62, 0.56, 0.5, 0, 0, 0); part(T.spin, cyl, M.timber, 0.2, 0.14, 0.2, 0, 0.3, 0);
    }
    g.traverse(x => { x.frustumCulled = false; });
    world.add(g);
    return T;
  }
  const hideThing = T => { T.group.visible = false; };
  /** Draws what a section lays on the quay near the hero; things leave and enter as he runs. */
  function drawThings(S, hz, z1, dt) {
    const W_ = S.world, seen = new Set();
    const put1 = (it, keyKind, y0) => {
      if (it.z < hz - 1.6 || it.z > z1) return null;                                   // one behind the hero is gone: the camera is close behind him
      const key = (it.kind === "salt" || it.kind === "furs" || it.kind === "wax" ? "sack:" : "") + keyKind + ":" + (it.mark || 0) + ":" + (it.flip ?? "");
      seen.add(it.id);
      let T = things.get(it.id);
      if (!T) {
        const i = thingFree.findIndex(x => x.key === key);
        if (i >= 0) T = thingFree.splice(i, 1)[0]; else { T = makeThing(keyKind, it); T.key = key; }
        T.group.visible = true; T.id = it.id; things.set(it.id, T);
      }
      return T;
    };
    for (const o of W_.obs) {
      const T = put1(o, o.kind === "toll" || o.kind === "bridge" || o.kind === "tide" ? o.kind : o.shape, 0);
      if (!T) continue;
      T.group.position.set(o.lane * LANE_W, 0, o.z);
      const ease_ = (want, rate = 12) => (T.k += (want - T.k) * Math.min(1, (dt || 0.016) * rate));
      if (o.kind === "toll") { const k = ease_(solid(S, o) ? 1 : 0); T.leaf.rotation.z = (1 - k) * 1.35; }
      else if (o.kind === "bridge") {
        const k = ease_(bridgeUp(S, o) ? 1 : 0, 7);                                          // 1: up, on end; 0: down, flat
        T.hinge.rotation.x = k * 1.5;
      } else if (o.kind === "tide") {
        const ts = tide(S, o), shut = ts.state === "shut" || ts.state === "opening", warn = ts.state === "closing" || ts.state === "opening";
        const k = ease_(ts.state === "open" ? 0 : ts.state === "shut" ? 1 : 0.5, 9);
        T.leaf.position.y = (1 - k) * 2.55;                                                  // raised clear when open, on the planks when shut
        const flash = Math.sin(now * (warn ? 22 : 0)) > 0;
        T.lamp.material = warn ? (flash ? BASIC.amber : BASIC.red) : shut ? BASIC.red : BASIC.green;
        T.ring.visible = !shut; T.cross.visible = shut;
        T.ring.material = warn ? (flash ? BASIC.amber : BASIC.green) : BASIC.green;
        T.cross.children.forEach(c_ => { c_.material = warn ? (flash ? BASIC.amber : BASIC.red) : BASIC.red; });
        T.water.scale.set(1.5, 0.04 + (shut ? 0 : 0.03 * Math.sin(now * 8 + o.id)), 1.2);
        T.water.position.y = shut ? 0.04 : 0.07;
      }
    }
    const nextBridge = (z) => { let b = null; for (const o of W_.obs) if (o.kind === "bridge" && o.z > z && (!b || o.z < b.z)) b = o; return b; };
    for (const p of W_.pick) {
      const T = put1(p, p.kind, p.y);
      if (!T) continue;
      T.group.visible = !p.taken;
      const bob = p.kind === "coin" || p.kind === "gem" ? Math.sin(now * 3 + p.id) * 0.05 : Math.sin(now * 3 + p.id) * 0.07;
      T.group.position.set(p.lane * LANE_W, p.kind === "lever" ? 0.5 : p.y + bob, p.z);
      if (T.spin && p.kind !== "lever" && p.kind !== "token") T.spin.rotation.y = now * (p.kind === "coin" ? 3 : 1.6) + p.id;
      if (T.halo) { T.halo.rotation.y = 0; T.halo.scale.setScalar(1 + 0.12 * Math.sin(now * 4 + p.id)); }
      if (p.kind === "lever" && T.spin) {
        const lower = S.flip;                                                                // the colour the next step lowers: the one that is up now
        T.spin.rotation.z = lower ? 0.7 : -0.7;                                              // the handle leans to the pad that is lowered now's opposite: toward what it will set
        T.knobs.forEach((kn, i) => { kn.visible = i === lower; });
        T.pads.forEach((pd, i) => { const pulse = i === lower ? 0.6 + 0.4 * Math.sin(now * 6) : 0; pd.scale.set(0.34 * (1 + 0.25 * pulse), 0.07, 0.34 * (1 + 0.25 * pulse)); });
        const nb = nextBridge(p.z), n = nb ? Math.min(T.wire.length, Math.floor((nb.z - p.z - 1.4) / 0.85)) : 0;
        T.wire.forEach((w_, i) => { w_.visible = i < n; if (i < n) { w_.position.set(0, -0.43, 0.9 + i * 0.85); w_.material = flat(BRIDGEC[lower], 0.4); } });
      }
    }
    for (const [id, T] of things) if (!seen.has(id)) { hideThing(T); thingFree.push(T); things.delete(id); }
  }
  // the finish: a gilt arch across the quay with a banner, and a line of checks on the planks
  const finish = new THREE.Group();
  for (const s of [-1, 1]) part(finish, cyl, M.gilt, 0.3, 5.4, 0.3, s * (QUAY_W / 2 - 0.1), 2.7, 0);
  part(finish, box, M.gilt, QUAY_W, 0.3, 0.3, 0, 5.4, 0); part(finish, box, M.banner, QUAY_W - 0.6, 1.0, 0.08, 0, 4.7, 0);
  for (let i = 0; i < 12; i++) part(finish, box, i & 1 ? M.shirt : M.hero, QUAY_W / 12, 0.03, 0.6, (i - 5.5) * (QUAY_W / 12), 0.03, 0);
  finish.visible = false; finish.traverse(o => { o.frustumCulled = false; }); world.add(finish);

  // effects: rings on the planks, bursts
  const fx = [];
  function ring(x, y, z, r, life, water = false) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 28).rotateX(-Math.PI / 2), M.ring.clone());
    m.material = curved(M.ring.clone());
    if (water) m.material.color.copy(M.spray.color);
    m.position.set(x, y, z); m.frustumCulled = false; world.add(m);
    fx.push({ m, born: now, life, r, kind: "ring" });
  }
  function burst(x, y, z, n = 6, mat = M.gilt, size = 0.12, power = 1, life = 0.45) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(box, mat); m.scale.setScalar(size); m.position.set(x, y, z); m.frustumCulled = false; world.add(m);
      const a = (i / n) * Math.PI * 2 + hash(i + now) * 1.5;
      fx.push({ m, born: now, life, size, kind: "spark", vx: Math.cos(a) * 2.6 * power, vy: (2 + hash(i * 7 + now) * 2.6) * power, vz: Math.sin(a) * 2.6 * power });
    }
  }
  /** A broken barrel flies apart in staves and hoops; a popped balloon in scraps of its own colour (and a ring, the air going out). */
  function smash(ev) {
    if (ev.kind === "barrel") { burst(ev.x, ev.y + 0.45, ev.z, 9, M.timber, 0.22, 1.5, 0.7); burst(ev.x, ev.y + 0.6, ev.z, 4, M.gilt, 0.14, 1.3, 0.6); }
    else { burst(ev.x, ev.y + 0.6, ev.z, 8, balloonMat[(ev.id || 0) % BALLOONC.length], 0.16, 1.2, 0.55); ring(ev.x, ev.y + 0.6, ev.z, 1.4, 0.3); }
  }
  /** Coins thrown up out of a broken thing. */
  function coinsUp(ev) { burst(ev.x, ev.y + 0.3, ev.z, Math.min(8, 3 + ev.n * 2), flat(0xF2C230, 0.7), 0.17, 1.35, 0.8); }

  // dust off the planks and spray off the water: two pools of little solids, one instanced mesh each, moved by hand (gravity, drag, and
  // a puff that swells and then shrinks away: a material has one opacity, so what fades is the size)
  const ico = new THREE.SphereGeometry(0.5, 6, 4);
  const pool = (m, n) => { const mesh = new THREE.InstancedMesh(ico, m, n); mesh.frustumCulled = false; world.add(mesh); return { mesh, at: 0, ps: Array.from({ length: n }, () => ({ t: 9, life: 1, x: 0, y: -9, z: 0, vx: 0, vy: 0, vz: 0, size: 0, g: 0, drag: 0, grow: 0 })) }; };
  const dusts = pool(M.dust, 80), sprays = pool(M.spray, 72);
  function emit(P, x, y, z, vx, vy, vz, size, life, o = {}) {
    const p = P.ps[P.at]; P.at = (P.at + 1) % P.ps.length;
    p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.size = size; p.life = life; p.t = 0; p.g = o.g || 0; p.drag = o.drag ?? 2.5; p.grow = o.grow ?? 0;
  }
  const mP = new THREE.Matrix4(), qP = new THREE.Quaternion(), vP = new THREE.Vector3(), sP = new THREE.Vector3();
  let nearZ = -1e9;                                      // what is behind this is by the camera: it thins out before it fills the picture's edge
  function tickPool(P, dt, spray) {
    for (let i = 0; i < P.ps.length; i++) {
      const p = P.ps[i];
      let sz = 0;
      if (p.t < p.life) {
        p.t += dt;
        const u = Math.min(1, p.t / p.life), d = Math.exp(-p.drag * dt);
        p.vy -= p.g * dt; p.vx *= d; p.vz *= d; if (!spray) p.vy *= d;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (spray && p.y < WATER_Y - 0.02 && p.vy < 0) p.t = p.life;                                   // back in the water
        sz = p.size * (0.5 + p.grow * Math.min(1, u * 2.2)) * (1 - u * u);
        sz *= clamp((p.z - nearZ) / 2.5, 0, 1);
      }
      mP.compose(vP.set(p.x, p.y, p.z), qP, sP.setScalar(Math.max(0, sz)));
      P.mesh.setMatrixAt(i, mP);
    }
    P.mesh.instanceMatrix.needsUpdate = true;
  }
  /** `n` puffs of dust at a place on the planks, thrown out sideways by `spread` (m/s) and carried on by (vx, vz): a footfall, a landing, a push-off. */
  function puff(x, z, n, spread, size = 0.28, vx = 0, vz = 0, up = 0.9, y = 0.06) {
    for (let i = 0; i < n; i++) {
      const a = hash(now * 31 + i * 7.3 + z) * Math.PI * 2, r = spread * (0.4 + hash(now * 17 + i * 3.1 + x));
      emit(dusts, x + Math.cos(a) * 0.1, y, z + Math.sin(a) * 0.1, vx + Math.cos(a) * r, up * (0.5 + hash(i + now)), vz + Math.sin(a) * r, size * (0.7 + 0.6 * hash(i * 5 + now)), 0.5 + 0.25 * hash(i * 2 + now), { drag: 3.2, grow: 1.6 });
    }
  }
  /** Spray thrown up from the water at a place: a splash. */
  function splash(x, z, n = 14, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + hash(i + now) * 2, r = (1 + 2.6 * hash(i * 3 + now)) * power;
      emit(sprays, x + Math.cos(a) * 0.15, WATER_Y, z + Math.sin(a) * 0.15, Math.cos(a) * r, (4.5 + 5 * hash(i * 7 + now)) * power, Math.sin(a) * r, 0.14 + 0.12 * hash(i * 11 + now), 0.9, { g: 15, drag: 0.6 });
    }
    ring(x, WATER_Y + 0.02, z, 2.4 * power, 0.7, true);
  }

  // streaks: thin lines in the air that run by at the sides, set in the world and wrapped about the hero, longer and clearer the faster he goes
  const STREAKS = 40, STREAK_R = 56;
  const streaks = new THREE.InstancedMesh(box, M.streak, STREAKS); streaks.frustumCulled = false; world.add(streaks);
  const streakAt = Array.from({ length: STREAKS }, (_, i) => ({ x: (i % 2 ? 1 : -1) * (2.2 + hash(i * 5.7 + 1) * 4.8), y: 0.4 + hash(i * 9.3 + 2) * 4.4, z: hash(i * 2.3 + 3) * STREAK_R, len: 0.6 + hash(i * 7.7 + 4) * 1.1 }));

  // ---------- drawing ----------
  let now = 0, shake = 0, W = 1, H = 1, blink = 0, baseFov = 70, idleT = 0;
  const cam = new CameraRig();
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
    canvas.style.width = "100%"; canvas.style.height = "100%";
    camera.aspect = W / H;
    // wide enough for the lanes and a wall at the phone's width, and not stretched on a tablet
    baseFov = Math.max(50, Math.min(76, 2 * Math.atan(Math.tan(33 * Math.PI / 180) / camera.aspect) * 180 / Math.PI));
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);

  // ---------- the hero's poses ----------
  // The pose is numbers on the named joints (J). What the rules say he is doing picks a target pose (a stride that follows the
  // quay, a jump that is a rise, a hang at the top and a fall, a lunge that is drawn back and then thrust, a roll, a wall run,
  // standing ready); `D.pose` carries the pose before over into it (Inertia), a crouch rings after a take-off and a landing, the
  // whole body banks and turns into a lane change, and the scarf, the coat tails, the plume and the hair are dragged by the air he
  // runs through (Streamer). The joints keep the names an animator will want, so a glTF with joints of these names can take over.
  //            lh    lk    rh    rk    las   laz   lae   ras   raz   rae   lean  twist head  wall    (hip x, knee x; shoulder x, z, elbow x of each arm; the body's)
  const RISE  = [-1.0, 1.35, 0.4, 0.55, -2.4, 0.3, -0.5, -2.2, -0.2, -0.3, -0.05, 0, 0, 0];
  const APEX  = [-0.55, 0.15, 0.6, 0.25, -1.5, 1.25, -0.12, -1.4, 0.7, -0.12, -0.02, 0, -0.12, 0];     // the top of a jump: stretched out, the arms wide
  const FALL  = [-0.5, 0.45, 0.45, 0.4, -0.2, 0.9, -0.3, -0.2, -0.5, -0.3, 0.1, 0, 0, 0];
  const READY = [-0.75, 0.25, -0.3, 0.2, 0.3, 0.5, -0.3, 0.2, -0.3, -0.3, 0.12, 0, 0, 0];             // reaching for the planks
  const ROLLP = [-1.55, 2.3, -1.55, 2.3, -1.2, 0.2, -1.7, -1.2, -0.2, -1.7, 0, 0, 0.5, 0];
  const SLAMP = [0.1, 0.25, 0.2, 0.25, 0.7, 0.2, -0.4, 0.15, -0.2, 0, 0.4, 0, 0, 0];
  const mixP = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  const idlePose = t => [-0.08 + 0.02 * Math.sin(t * 1.7), 0.12, 0.1 - 0.02 * Math.sin(t * 1.7), 0.14, 0.06, 0.15, -0.25, -0.45, 0, -1.15,
    0.03 + 0.015 * Math.sin(t * 1.9), 0.06 * Math.sin(t * 0.6), 0.05 * Math.sin(t * 0.6 + 1), 0];

  const D = {                                                       // the hero's body in motion (reckoning-move.js)
    bank: new Spring(), yaw: new Spring(), crouch: new Spring(), crouchW: 20, stretch: new Spring(), recoil: new Spring(),
    tails: [new Streamer(0.075, 15, 0.3), new Streamer(0.085, 14, 0.28)], scarf: [new Streamer(0.2, 20, 0.22), new Streamer(0.23, 18, 0.2)],
    plume: new Streamer(0.11, 18, 0.25), pony: new Streamer(0.12, 17, 0.3),
    pose: new Inertia(14, [22, 22, 22, 22, 18, 18, 18, 18, 18, 18, 16, 16, 16, 14], 0.75),
    step: 0, rollAcc: 0, wallAcc: 0,
  };
  function resetHero() {
    for (const k of ["bank", "yaw", "crouch", "stretch", "recoil"]) D[k].set(0);
    for (const s of [...D.tails, ...D.scarf, D.plume, D.pony]) { s.a.set(0); s.b.set(0); }
    D.pose.key = null; D.crouchW = 20; D.step = 0;
  }

  /** The pose the rules ask for now, as [a name for which pose it is, its numbers]: the name changing is what carries the old one over. */
  function targetPose(h, c) {
    const { sn, cs, k } = c, amp = 0.55 + 0.45 * k;
    const stride = (m = 1) => [-sn * 0.9 * amp * m, 0.2 + 0.85 * amp * m * Math.max(0, cs), sn * 0.9 * amp * m, 0.2 + 0.85 * amp * m * Math.max(0, -cs),
      sn * 0.8 * amp * m, 0, -1.0 + 0.3 * sn * amp, -0.55 + 0.15 * sn, 0, -1.25, 0.1 + 0.08 * k, sn * 0.12, 0, 0];
    if (h.mode === "wall") { const v = stride(1.15); v[10] = 0.1; v[13] = h.wall * 1.05; return ["wall", v]; }       // feet on the wall, the body out from it (leaning into it put him inside the box)
    if (h.lunge) return lungePose(h.lunge);
    if (h.mode === "air") {
      if (h.slam) return ["slam", SLAMP];
      let v = c.u >= 0 ? mixP(APEX, RISE, ease(c.u)) : mixP(APEX, FALL, ease(-c.u));
      if (c.u < 0) v = mixP(v, READY, c.near);
      return ["air", v];
    }
    if (c.rolling) return ["roll", ROLLP];
    if (c.idle) return ["idle", idlePose(c.t)];
    return ["run", stride()];
  }

  /** A cut: the rapier arm is drawn back as it sets off and thrust out as the foe arrives (`left` of `total` seconds to go), so the blow
   *  lands with the arm at full reach; a cut upward goes up with both arms, a bonk tucks and then stoops onto the foe. */
  function lungePose(L) {
    const tau = clamp(1 - L.left / L.total, 0, 1), th = ease((tau - 0.3) / 0.7), fwd = Math.sign(L.dir || 0);
    if (L.how === "bonk") {
      const e = ease(tau * 2);
      return ["bonk", [lerp(-0.7, -1.05, e), lerp(1.3, 0.75, e), lerp(0.7, 0.8, e), lerp(1.0, 0.12, e), 0.9, 0, -0.6, lerp(-1.2, -0.2, e), 0, lerp(-1.0, 0, e), lerp(0.4, 0.9, e), 0, 0, 0]];
    }
    const up = L.how === "above";
    return [up ? "cut-up" : "cut", [up ? -0.5 : -1.05, up ? 0.9 : 0.75, up ? 0.5 : 0.8, up ? 0.9 : 0.12, up ? -2.0 : 0.9, up ? 0.3 : 0, up ? -0.2 : -0.6,
      lerp(0.8, up ? -2.5 : -1.45, th), 0, lerp(-1.3, -0.08, th), lerp(0.2, up ? 0.0 : 0.6, th), lerp(0.3, -0.3, th) * (fwd || 1) * (fwd ? 1 : 0.4), 0, 0]];
  }

  /** Puts the hero's joints, and his whole body, where this frame has them. `k` is the hero as drawn: where he is (extrapolated a
   *  little past the last step, to the moment of the frame), his speed along the quay and up, and whether he is standing ready. */
  function poseHero(h, k, dt) {
    const phi = k.z * 1.9, sn = Math.sin(phi), cs = Math.cos(phi), tt = idleT + now;
    const rolling = h.roll > 0 && h.mode === "run" && !h.lunge;
    const kk = clamp((k.speed - 4) / 12, 0, 1);                      // a stride is shorter and lower at the start of a run
    const [key, tgt] = targetPose(h, { sn, cs, k: kk, u: clamp(k.vy / 9, -1, 1), near: ease(1 - k.y / 1.0) * ease(-k.vy / 4), idle: k.idle, rolling, t: tt });
    const P = D.pose.step(key, tgt, dt);
    let [lh, lk, rh, rk, las, laz, lae, ras, raz, rae, lean, twist, head, wallRoll] = P;
    // a crouch (a landing's, a take-off's) bends both legs and the waist; below zero it is a stretch
    const cr = D.crouch.to(0, dt, D.crouchW, 0.5);
    lh -= 0.9 * cr; rh -= 0.9 * cr; lk = Math.max(0.03, lk + 1.5 * cr); rk = Math.max(0.03, rk + 1.5 * cr); lean += 0.3 * cr; las -= 0.5 * cr; ras -= 0.5 * cr;
    // the blow's recoil: the rapier arm and the shoulders
    const rc = D.recoil.to(0, dt, 14, 0.35);
    ras += rc * 0.7; twist += rc * 0.3;
    // the body leans into a lane change and turns to where he is heading (a spring, so it overshoots and settles)
    const wall = h.mode === "wall";
    D.bank.to(wall ? 0 : -clamp(k.vx * 0.02, -0.5, 0.5), dt, 18, 0.5);
    D.yaw.to(wall ? 0 : Math.atan2(k.vx, Math.max(k.speed, 4)) * 0.55, dt, 22, 0.7);
    D.stretch.to(0, dt, 20, 0.35);
    hero.rotation.set(0, D.yaw.x, D.bank.x);
    const sc = clamp(1 + D.stretch.x, 0.8, 1.18);
    body.scale.set(1 / Math.sqrt(sc), sc, 1 / Math.sqrt(sc));
    // his feet are on the planks while he runs: the pelvis goes as low as the legs' bend asks
    const depth = (a, b) => 0.42 * Math.cos(a) + 0.445 * Math.cos(a + b);
    const drop = h.mode === "run" && !h.lunge && !rolling ? clamp(0.865 - Math.max(depth(lh, lk), depth(rh, rk)), 0, 0.45) : 0;
    if (rolling) {
      const p = 1 - h.roll / ROLL_T, a = p * Math.PI * 2;
      body.rotation.set(a, 0, 0);
      body.position.set(0, 0.9 * (1 - Math.cos(a)) - 0.3 * Math.sin(Math.PI * p), -0.9 * Math.sin(a));
    } else {
      body.rotation.set(lean * 0.5, 0, wallRoll);                    // the rest of the lean is in the waist, so the legs do not lean with it
      body.position.set(0, -drop, 0);
    }
    const splay = clamp(k.vx * 0.012, -0.3, 0.3);
    J.hip.forEach((hip, i) => { hip.rotation.set(i ? rh : lh, 0, splay); hip.userData.knee.rotation.x = i ? rk : lk; });
    J.arm.forEach((a, i) => { a.rotation.set(i ? ras : las, 0, (i ? raz : laz) * (i ? 1 : -1)); a.userData.elbow.rotation.x = i ? rae : lae; });
    J.torso.rotation.set(rolling ? 0 : lean * 0.5, twist, 0);
    J.head.rotation.set(head - (rolling ? 0 : lean * 0.35), -twist * 0.8, 0);
    // the cloth: dragged by the air he is moving through, with a flutter that grows with his speed
    const fl = 0.04 + 0.09 * kk, wind = { speed: k.speed, vy: k.vy, vx: k.vx };
    D.tails.forEach((s, i) => { s.update(dt, { ...wind, flutter: fl * Math.sin(tt * 12 + i * 1.9) }); J.tails[i].rotation.set(s.a.x, 0, s.b.x + (i ? 1 : -1) * 0.08 * Math.sin(tt * 9 + i)); });
    D.scarf.forEach((s, i) => { s.update(dt, { ...wind, flutter: 1.4 * fl * Math.sin(tt * 11 + i * 1.7) }); J.scarf[i].rotation.set(s.a.x, 0, s.b.x + (i ? 1 : -1) * (0.12 + 0.1 * Math.sin(tt * 8 + i))); });
    D.plume.update(dt, { ...wind, flutter: fl * Math.sin(tt * 7) });
    J.plume.rotation.set(-0.3 - 0.45 * D.plume.a.x, 0, -0.7 + D.plume.b.x + 0.1 * Math.sin(tt * 5));
    D.pony.update(dt, { ...wind, flutter: 0.7 * fl * Math.sin(phi * 2 + 1) });
    J.ponytail.rotation.set(0.1 + 0.55 * D.pony.a.x, 0, D.pony.b.x);
    return { drop, rolling, key };
  }

  // ---------- the foes' poses ----------
  const hideFoe = o => { o.group.visible = o.shadow.visible = o.mark.visible = false; };

  /** A foe at rest, or seeing me (f.ph 1: it turns to look, the claws go up and snap, the mark pops over its head), winding
   *  up (2: it rears, the mark is red and shakes) or launched (3: it springs, a crab hopping at me, a gull diving). The rules
   *  put the foe where it is (f.x and f.y move as it launches); this is only how it holds itself. */
  const BALLOONC = [0xD6453A, 0xE6B422, 0x2F9E8F, 0x7A5CC4];
  const balloonMat = BALLOONC.map(c => curved(new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.18 })));
  /** A barrel stands; a balloon floats where it was hung, swaying on its string. Neither looks at me: they are not out to get me. */
  function poseInert(o, f) {
    const g = o.group, rig = o.parts.rig;
    g.visible = true;
    if (f.kind === "balloon") {
      o.parts.body.material = balloonMat[f.id % BALLOONC.length];
      g.position.set(f.x + Math.sin(now * 1.3 + f.id) * 0.08, f.y + Math.sin(now * 1.9 + f.id * 2) * 0.07, f.z);
      rig.rotation.set(0, 0, Math.sin(now * 1.5 + f.id) * 0.09);
    } else g.position.set(f.x, f.y, f.z);
    g.rotation.set(0, Math.PI, 0);
    g.scale.setScalar(1);
    o.mark.visible = false;
  }

  function poseFoe(o, f, S) {
    if (KINDS[f.kind].inert) return poseInert(o, f);
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
    g.scale.setScalar(f.heavy ? 1.35 : 1);
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

  // what the hero was, a frame ago: his height then, so his climb can be read off what is drawn (the rules hold no climb in a cut)
  const vis = { y: 0, vy: 0, seed: null };

  /** Draws the run as it is now. `dt` is the game's seconds since the last frame (0 while it is paused). `o.lead` is the time the rules
   *  have not run yet (a frame is rarely a whole number of their steps), which the hero and the camera are carried on by, so the motion
   *  is even at any rate of drawing; `o.idle` that the run has not begun, and `o.real` the real seconds, for him to stand ready by. */
  function frame(S, dt, o = {}) {
    now += dt;
    const h = S.hero, W_ = S.world, spd = speed(S);
    const idle = !!o.idle, pdt = idle ? (o.real || 0) : dt;           // the body's own clock: it breathes while the run waits, and stands still when paused
    if (idle) idleT += pdt;
    shake = Math.max(0, shake - dt * 2.4);

    // where the hero is drawn: where the rules have him, carried on by the time they have not yet run
    const lead = Math.min(o.lead || 0, 1 / 60);
    const hx = h.x + (h.vx || 0) * lead, hz = h.z + spd * lead;
    let hy = h.y;
    if (h.mode === "air" && !h.lunge) {
      hy = h.y + h.vy * lead;
      if (h.y >= 0 && !W_.pits.some(p => h.z > p.z0 && h.z < p.z1)) hy = Math.max(hy, 0);          // not through the planks he is about to land on
    }
    if (S.seed !== vis.seed) { vis.seed = S.seed; vis.y = hy; vis.vy = 0; cam.reset(h.x); resetHero(); }
    if (pdt > 1e-4) {
      if (dt > 0 && vis.y > WATER_Y && hy <= WATER_Y) splash(hx, hz, 22, clamp(-vis.vy / 9, 0.8, 1.5));     // he goes in: the rules call it a fall only a metre lower
      vis.vy += (clamp((hy - vis.y) / pdt, -30, 30) - vis.vy) * Math.min(1, pdt * 40); vis.y = hy;
    }
    const kin = { x: hx, y: hy, z: hz, vx: h.vx || 0, vy: vis.vy, speed: spd, idle: idle && h.mode === "run" };

    // the quay
    const z0 = hz - BEHIND, z1 = hz + AHEAD;
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
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), nil = new THREE.Vector3(0, 0, 0);
    const inSpan = z => spans.some(s => z >= s[0] && z <= s[1]);
    const first = Math.floor(z0 / SEAM);
    let dark = 0;
    for (let i = 0; i < SEAMS; i++) {
      const z = (first + i) * SEAM, on = inSpan(z);
      m4.compose(v.set(0, 0.017, z), q, on ? v.clone().set(QUAY_W, 0.02, 0.05) : nil);
      seams.setMatrixAt(i, m4);
      if (((first + i) & 1) === 0 && dark < darkPlanks.count) {
        m4.compose(v.set(0, 0.01, z + SEAM / 2), q, on ? v.clone().set(QUAY_W - 0.02, 0.02, SEAM - 0.03) : nil);
        darkPlanks.setMatrixAt(dark++, m4);
      }
      for (const s of [-1, 1]) {
        m4.compose(v.set(s * (QUAY_W / 2 - 0.12), 0.05, z + SEAM / 2), q, on ? v.clone().set(0.24, 0.1, SEAM - 0.08) : nil);
        edge.setMatrixAt(2 * i + (s > 0 ? 1 : 0), m4);
      }
    }
    for (; dark < darkPlanks.count; dark++) { m4.compose(v.set(0, -9, 0), q, nil); darkPlanks.setMatrixAt(dark, m4); }
    seams.instanceMatrix.needsUpdate = edge.instanceMatrix.needsUpdate = darkPlanks.instanceMatrix.needsUpdate = true;

    // scenery, by slot: slot k is the house k * 11 metres along, the same wherever the hero is
    const SP = 11, base = Math.floor((hz - BEHIND) / SP);
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
        const z = (Math.floor((hz - BEHIND) / 6) + i) * 6 + 3;
        m4.compose(v.set(s * (QUAY_W / 2 - 0.2), 0.3, z), q, inSpan(z) ? new THREE.Vector3(0.28, 0.6, 0.28) : nil);
        posts.setMatrixAt(2 * i + (s > 0 ? 1 : 0), m4);
      }
    }
    posts.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < LAMPS; i++) {
      for (const s of [-1, 1]) {
        const j = 2 * i + (s > 0 ? 1 : 0), z = (Math.floor((hz - BEHIND) / LAMP_GAP) + i) * LAMP_GAP + 5;
        m4.compose(v.set(s * (QUAY_W / 2 + 0.75), 1.3, z), q, new THREE.Vector3(0.22, 4.2, 0.22));
        poles.setMatrixAt(j, m4);
        m4.compose(v.set(s * (QUAY_W / 2 + 0.75), 3.55, z), q, new THREE.Vector3(0.42, 0.5, 0.42));
        lanterns.setMatrixAt(j, m4);
      }
    }
    poles.instanceMatrix.needsUpdate = lanterns.instanceMatrix.needsUpdate = true;

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
      if (!o) { o = free.find(x => x.kind === f.kind && x.heavy === !!f.heavy) || makeFoe(f); const k = free.indexOf(o); if (k >= 0) free.splice(k, 1); o.born = now; o.died = 0; o.fly = null; o.how = ""; o.dir = 0; o.group.visible = o.shadow.visible = true; foes.set(f.id, o); }
      if (KINDS[f.kind].inert && !f.alive) { o.died = o.died || now; hideFoe(o); continue; }       // (broken: its pieces fly in ping)
      if (!f.alive && !o.died) { o.died = now; o.fly = knock(o, f, S); }
      if (o.died) { flyBack(o, f, dt); continue; }
      poseFoe(o, f, S);
      o.shadow.position.set(f.x, 0.025, f.z);
      o.shadow.scale.setScalar(f.kind === "crab" ? 1.2 : f.kind === "barrel" ? 0.95 : f.kind === "balloon" ? 0.75 : 0.8 + 0.1 * (2 - Math.min(2, f.y)));
      o.shadow.visible = inSpan(f.z) && f.y < 3;
    }
    for (const [id, o] of foes) if (!seen.has(id)) { hideFoe(o); free.push(o); foes.delete(id); }

    // a section's things, its finish, and its fog
    drawThings(S, hz, z1, dt);
    finish.visible = S.sec > 0 && W_.finish > z0 && W_.finish < z1;
    finish.position.z = W_.finish || 0;
    const fogFar = S.mods?.fog ? S.mods.fog : 105, fogNear = S.mods?.fog ? 4 : 28;
    scene.fog.far += (fogFar - scene.fog.far) * Math.min(1, (dt || 1) * 3); scene.fog.near += (fogNear - scene.fog.near) * Math.min(1, (dt || 1) * 3);

    // the hero
    hero.position.set(hx, hy, hz);
    hero.rotation.set(0, 0, 0); body.rotation.set(0, 0, 0); body.position.set(0, 0, 0);
    if (h.mode === "wall") hero.position.x = hx + h.wall * 0.5;                         // his feet on the wall's face
    const st = poseHero(h, kin, pdt);
    blink = h.hurt > 0 ? blink + dt : 0;
    hero.visible = h.hurt <= 0 || Math.floor(blink * 14) % 2 === 0;
    const floor = !pits.some(p => hz > p.z0 && hz < p.z1);
    heroShadow.visible = floor && hy < 6;
    heroShadow.position.set(hx, 0.03, hz);
    heroShadow.scale.setScalar(Math.max(0.3, 1.1 - hy * 0.12) * (1 + D.stretch.x * -0.5));

    // dust under his feet: a puff at each footfall, a trail behind a roll, a scrape along a wall
    const grounded = h.mode === "run" && !h.lunge && hy < 0.05;
    if (dt > 0) {
      const stepN = Math.floor(hz * 1.9 / Math.PI);
      if (grounded && !st.rolling && spd > 6 && stepN !== D.step && floor) puff(hx + (stepN & 1 ? 0.14 : -0.14), hz - 0.2, 1, 0.7, 0.13, 0, -spd * 0.12, 0.5);
      D.step = stepN;
      D.rollAcc = st.rolling ? D.rollAcc + dt : 0;
      if (st.rolling && D.rollAcc > 0.05) { D.rollAcc = 0; puff(hx, hz - 0.3, 2, 1.2, 0.2, 0, -spd * 0.25, 0.7); }
      D.wallAcc = h.mode === "wall" ? D.wallAcc + dt : 0;
      if (h.mode === "wall" && D.wallAcc > 0.05) { D.wallAcc = 0; puff(hx + h.wall * 0.5, hz - 0.2, 2, 1, 0.16, 0, -spd * 0.2, 1.3, hy + 0.1); }
    }

    // streaks in the air at the sides, clearer and longer with speed, and a little more in a cut or a dive
    const fast = clamp((spd - 9) / 7, 0, 1) + (h.lunge ? 0.35 : 0) + (h.mode === "air" && h.slam ? 0.5 : 0);
    M.streak.opacity = 0.62 * ease(fast);
    for (let i = 0; i < STREAKS; i++) {
      const a = streakAt[i], rel = (((a.z - hz) % STREAK_R) + STREAK_R) % STREAK_R, u = rel / STREAK_R;
      const fade = Math.min(1, u * 8, (1 - u) * 4);
      m4.compose(v.set(a.x, a.y, hz - 6 + rel), q, fast > 0.01 ? v.clone().set(0.035, 0.035, Math.max(0.01, (a.len + spd * 0.06) * fade)) : nil);
      streaks.setMatrixAt(i, m4);
    }
    streaks.instanceMatrix.needsUpdate = true;
    streaks.visible = fast > 0.01;

    // particles and effects
    nearZ = hz - cam.out.back + 0.8;
    tickPool(dusts, dt, false); tickPool(sprays, dt, true);
    for (let i = fx.length - 1; i >= 0; i--) {
      const e = fx[i], t = (now - e.born) / e.life;
      if (t >= 1) { world.remove(e.m); if (e.kind === "ring") { e.m.geometry.dispose(); e.m.material.dispose(); } fx.splice(i, 1); continue; }
      if (e.kind === "ring") { e.m.scale.setScalar(0.4 + e.r * t); e.m.material.opacity = 0.8 * (1 - t); }
      else { e.m.position.x += e.vx * dt; e.m.position.z += e.vz * dt; e.vy -= 9 * dt; e.m.position.y += e.vy * dt; e.m.scale.setScalar((e.size || 0.12) * (1 - t)); e.m.rotation.x += dt * 9; e.m.rotation.z += dt * 7; }
    }

    // the camera (reckoning-move.js): it follows his lane late and leans the way he goes, draws back and widens with speed, and settles after a landing
    const c = cam.update(pdt, { x: hx, y: hy, vx: kin.vx, speed: spd, wall: h.mode === "wall" ? h.wall : 0, rolling: st.rolling, lunging: !!h.lunge });
    const fov = clamp(baseFov + c.fov, 40, 90);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    camera.up.set(Math.sin(c.roll), Math.cos(c.roll), 0);
    const sx = (Math.random() - 0.5) * shake * 0.3, sy = (Math.random() - 0.5) * shake * 0.3;
    camera.position.set(-(c.x + sx), c.y + sy, hz - c.back);
    camera.lookAt(-c.lookX, c.lookY, hz + c.ahead);
    sun.position.set(hx - 5, 10, hz - 2); sun.target.position.set(hx, 0, hz + 8);
    water.position.z = hz;
    if (o.draw !== false) renderer.render(scene, camera);
  }

  /** The rules' events, as something seen: dust and spray, a kick to the camera, a push on the hero's body, and what was already there
   *  (a burst, a ring, a shake). */
  function ping(ev, S) {
    const h = S.hero, spd = speed(S);
    const flop = (a, b) => { D.tails.forEach(t => t.kick(a)); D.scarf.forEach(t => t.kick(b)); };    // the cloth is thrown by a change of pace
    switch (ev.type) {
      case "jump":
        if (ev.air) { ring(h.x, h.y + 0.1, h.z, 1.6, 0.35); D.stretch.kick(1.6); flop(-2, -2.5); break; }
        D.crouch.set(0.75); D.crouchW = 22; D.stretch.kick(2.4); flop(-3, -4);
        puff(h.x, h.z - 0.2, 5, 2.2, 0.26, 0, -spd * 0.25, 0.8);
        break;
      case "land": {
        const v = ev.v ?? 8;
        D.crouch.set(clamp(v / 10, 0.25, ev.slam ? 1.5 : 1.15)); D.crouchW = ev.slam ? 12 : 15;
        D.stretch.kick(-clamp(v * 0.3, 1.5, 6));
        flop(-clamp(v * 0.7, 3, 14), -clamp(v * 0.9, 4, 16));
        cam.land(v);
        puff(h.x, h.z - 0.1, clamp(Math.round(v / 1.8), 3, 14), 1.4 + v * 0.2, 0.3, 0, -spd * 0.2, 0.8);
        if (ev.slam) shake = Math.max(shake, 0.8);
        break;
      }
      case "lane":
        puff(h.x - ev.dir * 0.25, h.z - 0.3, 3, 1.4, 0.22, -ev.dir * 2.2, -spd * 0.2, 0.7);
        cam.punch(0.8);
        break;
      case "lunge": cam.punch(2.2); D.stretch.kick(1.4); break;
      case "roll": D.crouch.set(0.45); D.crouchW = 18; puff(h.x, h.z - 0.2, 4, 1.6, 0.24, 0, -spd * 0.2, 0.8); break;
      case "dive": cam.punch(3); D.stretch.kick(2.2); break;
      case "kill": {
        const o = foes.get(ev.id); if (o) { o.how = ev.how; o.dir = ev.dir || 0; }
        if (KINDS[ev.kind]?.inert) { smash(ev); D.recoil.set(ev.reward === false ? 0 : 1); shake = Math.max(shake, ev.how === "crash" ? 0.9 : 0.3); break; }
        D.recoil.set(1);
        burst(h.x, h.y + 0.8, h.z + 0.5, ev.how === "slam" ? 4 : 7); shake = Math.max(shake, 0.4); break;
      }
      case "launch": shake = Math.max(shake, 0.12); break;
      case "shockwave":
        ring(h.x, 0.06, h.z, 5.5, 0.5); shake = 1;
        puff(h.x, h.z + 0.4, 16, 5, 0.34, 0, 0, 1.2);
        break;
      case "hurt": shake = 1.2; break;
      case "fall": shake = 0.8; break;
      case "clang": shake = 1; break;
      case "stagger": shake = Math.max(shake, 0.7); burst(h.x, h.y + 0.8, h.z + 0.8, 5); break;
      case "coins": coinsUp(ev); break;
      case "pick":
        if (ev.what === "coin") { burst(h.x, h.y + 0.9, h.z + 0.5, 2, flat(0xF2C230, 0.7), 0.1, 0.8, 0.3); break; }
        ring(h.x, h.y + 0.4, h.z + 0.4, ev.what === "gem" ? 2 : 1.3, ev.what === "gem" ? 0.5 : 0.3); burst(h.x, h.y + 0.9, h.z + 0.6, ev.what === "gem" ? 10 : 4); break;
      case "heart": if (ev.gem) { ring(h.x, h.y + 0.6, h.z + 0.4, 2.2, 0.5); burst(h.x, h.y + 1, h.z + 0.6, 10, flat(0xF0A12B, 0.8), 0.15, 1.2, 0.7); } break;
      case "seized": shake = 1; break;
      case "finish": shake = 0.5; burst(h.x, h.y + 1, h.z + 1, 12); break;
      case "wallrun": shake = Math.max(shake, 0.25); puff(h.x + ev.side * 0.4, h.z, 4, 1.6, 0.22, 0, -spd * 0.1, 1.2, 1.2); break;
      case "walljump": shake = Math.max(shake, 0.25); D.crouch.set(0.6); D.crouchW = 20; D.stretch.kick(2); cam.punch(1.5); puff(h.x + ev.side * 0.4, h.z, 5, 2, 0.24, -ev.side * 1.5, 0, 1.4, h.y); break;
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
