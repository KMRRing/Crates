// Landfall's deck at night, in three.js: a barque's quarterdeck with a chart table in front of the navigator, the true sky over the
// horizon, a sea that moves the ship, and a lamp whose warm light stops where the cold starlight begins. One continuous scene: the
// chart on the table is the page's own chart drawn on a canvas and laid on it, so everything the chart does still works there.
//
// What is drawn, and how it is kept cheap for a phone: the stars are ONE instanced mesh of 500-odd quads (a points mesh the bundle
// lacks), the cloud and spray are one instanced mesh each, the rigging is one instanced mesh of ropes, the sea is one polar grid whose
// vertices are moved on the CPU, and the deck's lamp is not a light at all but a falloff written into the materials (`lit`), so the
// renderer runs with no lights. landfall-look.js has the arithmetic; landfall-stage.js turns fingers into looks.
//
// Axes: x east, y up, z south. The ship (a Group) is turned by her heading and rolls; the camera is her child.
import * as THREE from "./vendor/three-run.js";
import { dirOf, D2R, clamp, lerp, smooth, shipMotion, windOf, starLook, dayLight, vfovOf } from "./landfall-look.js";
import { skyColours, landColour } from "./landfall-skyview.js";
import { parseChar, lightOn, flashTimes, lightColour } from "./landfall-lights.js";

const SKY_R = 1800, EYE_Y = 2.0;                     // metres: the dome, and how high the deck stands above the sea
export const TABLE = { x: 0, y: 0.94, z: 5.1 };      // the chart table's top, in the ship's frame (the bow is -z, the navigator stands at +z)
export const STAND = { eye: [0, 1.62, 6.55] };       // where the navigator's eye is on the deck
const CHART_Y = TABLE.y + 0.03;
const lin = c => Math.pow(clamp(c, 0, 255) / 255, 2.2);

// ---------- textures ----------
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const noise = (ctx, w, h, n, a, dark = true) => {
  for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${dark ? "0,0,0" : "255,235,200"},${Math.random() * a})`; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 14); }
};
const glowTex = () => canvasTex(64, 64, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.12, "rgba(255,255,255,.95)"); g.addColorStop(0.3, "rgba(255,255,255,.28)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}, false);
const ringTex = (dash = false) => canvasTex(128, 128, (ctx, w) => {
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 5; if (dash) ctx.setLineDash([9, 11]);
  ctx.beginPath(); ctx.arc(w / 2, w / 2, w / 2 - 6, 0, 6.283); ctx.stroke();
}, false);
// A cloud puff: a cumulus heap of overlapping soft discs (so the edge is ragged and bright at the top), its underside shaded by
// a grey wash. White, so that the instance colour (setClouds) gives it the sky's own light; the variants are drawn once each.
const puffTex = seed => canvasTex(256, 256, (ctx, w, h) => {
  const hash = n => { const x = Math.sin((n + seed * 17) * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  for (let i = 0; i < 26; i++) {
    const a = hash(i * 3) * 6.283, d = Math.sqrt(hash(i * 3 + 1)) * 0.3, r = w * (0.11 + 0.15 * hash(i * 3 + 2) * (1 - d));
    const x = w / 2 + Math.cos(a) * d * w, y = h / 2 + Math.sin(a) * d * h * 0.8 - h * 0.03;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.55, "rgba(255,255,255,.6)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.globalCompositeOperation = "source-atop";
  const under = ctx.createLinearGradient(0, h * 0.25, 0, h * 0.8);
  under.addColorStop(0, "rgba(150,160,180,0)"); under.addColorStop(1, "rgba(150,160,180,.55)");
  ctx.fillStyle = under; ctx.fillRect(0, 0, w, h);
}, false);
const plankTex = () => canvasTex(256, 1024, (ctx, w, h) => {
  ctx.fillStyle = "#8a6a45"; ctx.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) { ctx.fillStyle = `rgba(${40 + Math.random() * 30},${25 + Math.random() * 20},10,${0.08 + Math.random() * 0.12})`; ctx.fillRect(x, 0, 32, h); ctx.fillStyle = "rgba(20,12,6,.7)"; ctx.fillRect(x, 0, 2, h); }
  noise(ctx, w, h, 900, 0.12);
  for (let y = 60; y < h; y += 150 + Math.random() * 120) { ctx.fillStyle = "rgba(20,12,6,.5)"; ctx.fillRect(0, y, w, 2); }
});
const woodTex = () => canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = "#6a4829"; ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 3) { ctx.fillStyle = `rgba(${20 + Math.random() * 40},${10 + Math.random() * 20},4,${Math.random() * 0.2})`; ctx.fillRect(0, y, w, 2); }
  noise(ctx, w, h, 400, 0.1, false);
});
// the bulwarks' inner face: varnished strakes a fifth of a metre deep, butted end to end at staggered joints, with a paler grain
const strakeTex = () => canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = "#5a3c22"; ctx.fillRect(0, 0, w, h);
  const n = 6, sh = h / n;
  for (let i = 0; i < n; i++) {
    const y = i * sh, g = ctx.createLinearGradient(0, y, 0, y + sh);
    g.addColorStop(0, "rgba(255,220,170,.10)"); g.addColorStop(0.5, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.22)");
    ctx.fillStyle = `rgba(${70 + Math.random() * 25},${44 + Math.random() * 16},${22 + Math.random() * 8},.5)`; ctx.fillRect(0, y, w, sh);
    ctx.fillStyle = g; ctx.fillRect(0, y, w, sh);
    for (let k = 0; k < 14; k++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? "20,10,4" : "230,190,140"},${0.05 + Math.random() * 0.08})`; ctx.fillRect(0, y + 3 + Math.random() * (sh - 6), w, 1 + Math.random()); }
    ctx.fillStyle = "rgba(18,10,4,.8)"; ctx.fillRect(0, y, w, 2);
    const jx = ((i * 97) % 5) / 5 * w; ctx.fillRect(jx, y, 2, sh);
  }
  noise(ctx, w, h, 300, 0.08);
});
const bookTex = () => canvasTex(128, 128, (ctx, w, h) => {
  ctx.fillStyle = "#f1e6c6"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(60,40,20,.5)"; ctx.lineWidth = 1;
  for (let y = 14; y < h - 6; y += 9) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(w / 2 - 6, y); ctx.moveTo(w / 2 + 6, y); ctx.lineTo(w - 10, y); ctx.stroke(); }
  ctx.fillStyle = "rgba(60,40,20,.45)"; ctx.fillRect(w / 2 - 1, 0, 2, h);
});

// ---------- the lamp's light, written into the materials ----------
const LIT = {
  uLampPos: { value: new THREE.Vector3(0.6, 1.3, 4.7) }, uLampCol: { value: new THREE.Vector3(1.0, 0.66, 0.34) }, uLamp: { value: 1 }, uAmb: { value: new THREE.Vector3(0.1, 0.13, 0.2) },
};
/** Makes a basic material take the deck's light: starlight everywhere (`uAmb`), and the lamp's warm falloff by the distance from it and the way a face turns toward it. */
function lit(mat) {
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, LIT);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLW; varying vec3 vLN;")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvLW = (modelMatrix * vec4(transformed, 1.0)).xyz; vLN = normalize(mat3(modelMatrix) * normal);");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uLampPos; uniform vec3 uLampCol; uniform vec3 uAmb; uniform float uLamp; varying vec3 vLW; varying vec3 vLN;")
      .replace("#include <dithering_fragment>", `vec3 lv = uLampPos - vLW; float ld = dot(lv, lv);
        float nl = 0.5 + 0.5 * max(dot(normalize(vLN), normalize(lv)), 0.0);
        gl_FragColor.rgb *= uAmb + uLampCol * (uLamp * nl * 0.62 / (0.2 + 2.6 * ld));
        #include <dithering_fragment>`);
  };
  mat.customProgramCacheKey = () => "lf-lit";
  return mat;
}
const M = (color, opts = {}) => lit(new THREE.MeshBasicMaterial({ color, ...opts }));

// ---------- shapes ----------
function sailGeo(w, h, bulge, nx = 8, ny = 5) {
  const pos = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx - 0.5, v = j / ny;
    pos.push(u * w * (1 - 0.06 * v), v * h, -bulge * (1 - 4 * u * u) * Math.sin(Math.PI * (0.15 + 0.7 * v)));
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + nx + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function triGeo(a, b, c) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  g.setIndex([0, 1, 2]);
  g.computeVertexNormals();
  return g;
}
const between = (a, b) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); return { mid: A.clone().add(B).multiplyScalar(0.5), len: A.distanceTo(B), dir: B.clone().sub(A).normalize() }; };

/**
 * Builds the scene into `host`. Returns the controller; `host` is an element the canvas is put in. Throws where there is no WebGL
 * (the page then stays flat).
 */
export function createScene(host, { reduced = () => false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: (devicePixelRatio || 1) < 1.5, powerPreference: "low-power" });
  const cap = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(cap);
  renderer.setClearColor(0x05090d, 1);
  const canvas = renderer.domElement;
  canvas.className = "lf-gl";
  host.prepend(canvas);

  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.05, 5000);
  camera.rotation.order = "YXZ";
  scene.fog = new THREE.Fog(0x16222c, 200, 2200);
  const ship = new THREE.Group();
  ship.rotation.order = "YXZ";
  ship.position.y = EYE_Y;
  ship.add(camera);
  scene.add(ship);
  const world = { t: 0 };

  // ---------- the sky: a dome, the stars, a sun, the clouds ----------
  const skyRoot = new THREE.Group();                         // follows the camera, so the stars are at infinity and the horizon is where the eye is
  scene.add(skyRoot);
  const domeGeo = new THREE.SphereGeometry(SKY_R + 100, 28, 18), dn = domeGeo.attributes.position.count;
  domeGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(dn * 3), 3));
  const dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  dome.renderOrder = -10; dome.frustumCulled = false;
  skyRoot.add(dome);
  const domeDirs = [];
  for (let i = 0; i < dn; i++) { const p = domeGeo.attributes.position; const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize(); domeDirs.push(v); }

  const quad = new THREE.PlaneGeometry(1, 1);
  const NSTAR = 560;
  const starMat = new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const stars = new THREE.InstancedMesh(quad, starMat, NSTAR);
  stars.renderOrder = 1; stars.frustumCulled = false;
  skyRoot.add(stars);
  const dummy = new THREE.Object3D(), tmpC = new THREE.Color();
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < NSTAR; i++) { stars.setMatrixAt(i, zero); stars.setColorAt(i, tmpC.setRGB(0, 0, 0)); }

  const sunMat = new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, color: 0xfff0c0 });
  const sunGlow = new THREE.Mesh(quad, sunMat), sunDisc = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false, color: 0xfffbe8 }));
  for (const m of [sunGlow, sunDisc]) { m.renderOrder = 2; m.frustumCulled = false; m.visible = false; skyRoot.add(m); }

  // the lighthouses on the horizon (up to three): each a flash at its bearing in its own character (landfall-lights.js), and a steady
  // glow for those who ask for less motion. 13 November 2026 (Korbi: "beauty and sound are top priorities"): a flashing light's beams,
  // one for each flash of its group, sweep the haze over the sea and flash as they point at the ship.
  const rayTex = canvasTex(32, 256, (ctx, w, h) => { const g = ctx.createLinearGradient(0, h, 0, 0); g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(w / 2 - 2, h); ctx.lineTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w / 2 + 2, h); ctx.fill(); }, false);
  const glowMap = glowTex(), towers = [0, 1, 2].map(() => {
    const beacon = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: glowMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, color: 0xffe2a0 }));
    beacon.renderOrder = 2; beacon.frustumCulled = false; beacon.visible = false; skyRoot.add(beacon);
    const rays = [0, 1, 2].map(() => { const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, color: 0xffe2a0 })); m.renderOrder = 2; m.frustumCulled = false; m.visible = false; skyRoot.add(m); return m; });
    return { beacon, rays, ch: "" };
  });
  // the land: the summits behind a coast standing over the horizon, a ring of quads every half degree whose tops are the skyline (S.land,
  // landfall-land.js), dark against a twilight sky and blue-grey by day; the sea in front hides its foot as the real sea would
  const NL = 720, landIdx = [];
  for (let i = 0; i < NL; i++) { const a = i * 2; landIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const landGeo = new THREE.BufferGeometry();                // the bundle's attribute copies its array: write into the attribute's own
  landGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array((NL + 1) * 6), 3)); landGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array((NL + 1) * 6), 3)); landGeo.setIndex(landIdx);
  const landPos = landGeo.attributes.position.array, landCols = landGeo.attributes.color.array;
  const landMesh = new THREE.Mesh(landGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false }));
  landMesh.frustumCulled = false; landMesh.visible = false; skyRoot.add(landMesh);
  let landFor = null;
  function setLand() {
    landFor = S.land; landMesh.visible = !!S.land;
    if (!S.land) return;
    const RL = SKY_R - 150;
    for (let i = 0; i <= NL; i++) {
      const az = i * 0.5, alt = S.land[i % NL], b = dirOf(az, -0.5), t = dirOf(az, alt > 0.01 ? alt : -0.5);
      landPos.set([b[0] * RL, b[1] * RL, b[2] * RL, t[0] * RL, t[1] * RL, t[2] * RL], i * 6);
    }
    landGeo.attributes.position.needsUpdate = true;
    landGeo.computeBoundingSphere();
  }
  function paintLand() {
    const col = skyColours(S.sunAlt), top = landColour(col.hor, S.sunAlt), foot = top.map((x, i) => x + (col.hor[i] - x) * 0.3);
    for (let i = 0; i <= NL; i++) landCols.set([...foot.map(lin), ...top.map(lin)], i * 6);
    landGeo.attributes.color.needsUpdate = true;
  }
  // the moon: her disc lit as the sun lights her (the lit side towards the sun), a glow about her, and her light on the water (setSea)
  const moonCanvas = document.createElement("canvas"); moonCanvas.width = moonCanvas.height = 128;
  const moonTex = new THREE.CanvasTexture(moonCanvas); moonTex.colorSpace = THREE.SRGBColorSpace;
  const moonDisc = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  const moonGlow = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, color: 0x9fb2d8 }));
  for (const m of [moonGlow, moonDisc]) { m.renderOrder = 2; m.frustumCulled = false; m.visible = false; skyRoot.add(m); }
  let moonDrawn = "";
  /** The moon's face for how much of her is lit: the lit limb on the right (setMoon turns the disc so the right faces the sun), the
   *  terminator an ellipse, a few dark seas on her. */
  function drawMoon(lit, waxing = true) {
    const key = `${Math.round(lit * 40)}|${waxing}`;
    if (key === moonDrawn) return;
    moonDrawn = key;
    const ctx = moonCanvas.getContext("2d"), c = 64, r = 56;
    ctx.clearRect(0, 0, 128, 128);
    ctx.save(); ctx.beginPath(); ctx.arc(c, c, r, 0, 6.2832); ctx.clip();
    ctx.fillStyle = "rgba(40,48,66,.35)"; ctx.fillRect(0, 0, 128, 128);                         // earthshine on the dark part
    ctx.beginPath();
    const side = waxing ? 1 : -1, k = 1 - 2 * lit;                                              // the terminator's half-width, as a share of r
    ctx.ellipse(c, c, r, r, 0, -Math.PI / 2, Math.PI / 2, side < 0);
    ctx.ellipse(c, c, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === (side > 0));
    const g = ctx.createRadialGradient(c - 14 * side, c - 12, 4, c, c, r); g.addColorStop(0, "#fbf6e6"); g.addColorStop(1, "#cfc8b4");
    ctx.fillStyle = g; ctx.fill();
    ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "rgba(150,146,140,.55)";
    for (const [x, y, rr] of [[52, 44, 13], [72, 54, 10], [60, 74, 15], [82, 76, 8], [44, 64, 7]]) { ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.2832); ctx.fill(); }
    ctx.restore();
    moonTex.needsUpdate = true;
  }

  const NPUFF = 160;
  const puffMat = new THREE.MeshBasicMaterial({ map: puffTex(1), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const puffs = new THREE.InstancedMesh(quad, puffMat, NPUFF);
  puffs.renderOrder = 3; puffs.frustumCulled = false; puffs.count = 0;
  skyRoot.add(puffs);
  for (let i = 0; i < NPUFF; i++) { puffs.setMatrixAt(i, zero); puffs.setColorAt(i, tmpC.setRGB(1, 1, 1)); }

  // a hint's figure (line segments), the ring round a star, and a name
  const NSEG = 24;
  const segMat = new THREE.MeshBasicMaterial({ color: 0xe2be78, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const segs = new THREE.InstancedMesh(quad, segMat, NSEG);
  segs.renderOrder = 4; segs.frustumCulled = false; segs.count = 0;
  skyRoot.add(segs);
  const ring = (dash, color) => {
    const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: ringTex(dash), color, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.renderOrder = 4; m.frustumCulled = false; m.visible = false; skyRoot.add(m);
    return m;
  };
  const hintRing = ring(true, 0xecd096), pickRing = ring(false, 0xffffff);
  const label = text => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.renderOrder = 4; m.frustumCulled = false; m.visible = false; skyRoot.add(m);
    m.userData = { c, t, text: "" };
    return m;
  };
  const setLabel = (m, text) => {
    if (m.userData.text === text) return;
    m.userData.text = text;
    const ctx = m.userData.c.getContext("2d");
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = "italic 30px Georgia, serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "#000"; ctx.shadowBlur = 6; ctx.fillStyle = "rgba(240,214,150,.95)"; ctx.fillText(text, 128, 34);
    m.userData.t.needsUpdate = true;
  };
  const figLabel = label(), pickLabel = label();

  // ---------- the sea ----------
  // 13 November 2026 (Korbi: "beauty and sound are top priorities"): the sea is drawn on the GPU. The grid only carries the long swell
  // (the vertex shader lifts it); every pixel then works out its own ripples, reflects the sky by the Fresnel law (water mirrors the sky
  // at a glancing look and shows its own dark body when looked into), and takes the sun's or the moon's glitter, the lighthouse's flash
  // and the whitecaps. The ripples fade as a pixel covers more than they can show, and the glitter widens to keep their light.
  const RINGS = 46, SEGS = 96, R0 = 3, GROW = 1.155;
  const sp = [], si = [];
  for (let r = 0; r <= RINGS; r++) for (let k = 0; k <= SEGS; k++) { const rad = R0 * Math.pow(GROW, r), a = k / SEGS * 6.2832; sp.push(rad * Math.cos(a), 0, rad * Math.sin(a)); }
  for (let r = 0; r < RINGS; r++) for (let k = 0; k < SEGS; k++) { const a = r * (SEGS + 1) + k, b = a + SEGS + 1; si.push(a, a + 1, b, a + 1, b + 1, b); }
  const seaGeo = new THREE.BufferGeometry();
  seaGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  seaGeo.setIndex(si);
  const SEA = {
    uT: { value: 0 }, uA: { value: 0.3 }, uWind: { value: 0.5 }, uFoam: { value: 0 }, uDrift: { value: { x: 0, y: 0 } },
    uHor: { value: new THREE.Vector3(0.1, 0.15, 0.2) }, uTop: { value: new THREE.Vector3(0.02, 0.03, 0.06) }, uGlow: { value: new THREE.Vector3() },
    uDeep: { value: new THREE.Vector3(0.01, 0.02, 0.03) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Vector3() }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) }, uMoonCol: { value: new THREE.Vector3() },
    uBeaconDir: { value: new THREE.Vector3(1, 0, 0) }, uBeacon: { value: 0 },
  };
  const seaMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
  seaMat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, SEA);
    // the swell: four long waves, the same in both shaders, flatter far off so the horizon stays a line
    const swell = `
      uniform float uT; uniform float uA; uniform vec2 uDrift;
      const vec3 SW[4] = vec3[4](vec3(0.45, 0.2, 1.0), vec3(-0.3, 0.5, 0.55), vec3(0.9, -0.6, 0.25), vec3(0.16, 0.31, 0.6));
      const float SP[4] = float[4](1.9, 2.5, 3.4, 1.2);
      vec3 swellAt(vec2 w) {                      // height, and its slope in x and z
        float f = uA / (1.0 + length(w) / 260.0); vec2 p = w + uDrift; vec3 o = vec3(0.0);
        for (int i = 0; i < 4; i++) { float ph = dot(SW[i].xy, p) - uT * SP[i]; o += SW[i].z * f * vec3(sin(ph), SW[i].xy * cos(ph)); }
        return o;
      }`;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>\n${swell}\nvarying vec3 vSW; varying float vH;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vec2 w0 = (modelMatrix * vec4(transformed, 1.0)).xz; vec3 sw0 = swellAt(w0); transformed.y += sw0.x; vH = sw0.x / max(uA, 0.02);`)
      .replace("#include <project_vertex>", "#include <project_vertex>\nvSW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\n${swell}
        uniform float uWind; uniform float uFoam; uniform vec3 uHor; uniform vec3 uTop; uniform vec3 uGlow; uniform vec3 uDeep;
        uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uMoonDir; uniform vec3 uMoonCol; uniform vec3 uBeaconDir; uniform float uBeacon;
        varying vec3 vSW; varying float vH;
        vec3 skyIn(vec3 r) {                      // the dome's colour along a ray: as paintDome mixes it, in the same light
          float a = clamp(asin(clamp(r.y, 0.0, 1.0)) / 1.309, 0.0, 1.0);
          float g = acos(clamp(dot(r, normalize(vec3(uSunDir.x, max(uSunDir.y, -0.2), uSunDir.z))), -1.0, 1.0)) * 57.2958;
          vec3 c = mix(uHor, uTop, pow(a, 0.55)) + uGlow * exp(-g * g / 1800.0);
          return pow(c, vec3(2.2));
        }
        // a light's glitter: tilted ripples swing the reflected ray up and down freely but sideways only by the sine of how low we look
        // (at a glancing look a facet must tilt far to send light aside), so a low light makes a narrow road towards the eye
        float lobe(vec3 r, vec3 l, float m, float an) {
          float dv = r.y - l.y, dh = r.x * l.z - r.z * l.x;
          return exp(-(dv * dv + dh * dh / (an * an)) / (2.0 * m)) * 0.0035 / (m * an);
        }`)
      .replace("vec4 diffuseColor = vec4( diffuse, opacity );", `
        vec2 w = vSW.xz; vec3 sw = swellAt(w); vec2 pd = w + uDrift;
        float fp = max(length(fwidth(w)), 1e-4);                   // how much sea one pixel covers, in metres
        vec2 g = sw.yz; float rough = 0.0003; float sl = 0.035 + 0.09 * uWind;
        for (int i = 0; i < 7; i++) {                                // ripples: shorter, steeper and quicker each time, turned each time
          float fi = float(i), k = 1.1 * pow(1.62, fi), a = 2.399 * fi + 0.7;
          vec2 d = vec2(cos(a), sin(a)); float ph = k * dot(d, pd) - uT * sqrt(9.8 * k) + fi * 1.7;
          float fade = clamp(1.4 - fp * k * 0.45, 0.0, 1.0), s = sl * (1.0 - 0.07 * fi);
          g += d * (s * fade * cos(ph)); rough += 0.5 * s * s * (1.0 - fade);
        }
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
        vec3 v = normalize(cameraPosition - vSW), r = reflect(-v, n); r.y = abs(r.y);
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
        vec3 body = uDeep * (0.75 + 0.5 * clamp(vH * 0.5 + 0.5, 0.0, 1.0));
        vec3 sun2 = normalize(vec3(uSunDir.x, 0.0, uSunDir.z));
        body += uDeep * 2.5 * pow(max(dot(-v, sun2), 0.0), 4.0) * clamp(vH, 0.0, 1.0) * clamp(uSunDir.y * 8.0 + 0.5, 0.0, 1.0);   // light through the crests
        vec3 col = mix(body, skyIn(r), F);
        float m = rough + 0.0004 * uWind;
        float an = clamp(v.y * 3.0 + 0.1, 0.1, 1.0);
        col += uSunCol * lobe(r, uSunDir, m, an) + uMoonCol * lobe(r, uMoonDir, m * 1.5, an) + vec3(1.0, 0.8, 0.5) * uBeacon * lobe(r, uBeaconDir, m * 2.0, an);
        float crest = vH + 0.35 * sin(pd.x * 1.9 + pd.y * 0.7 + uT * 0.8) * sin(pd.y * 2.6 - pd.x * 0.4 - uT * 0.6);
        float foam = uFoam * smoothstep(1.05, 1.6, crest) * clamp(1.2 - fp * 0.6, 0.0, 1.0);
        col = mix(col, pow(mix(uHor, uTop, 0.35), vec3(2.2)) * 1.6 + 0.02, foam * 0.85);
        vec4 diffuseColor = vec4(col, 1.0);`);
  };
  seaMat.customProgramCacheKey = () => "lf-sea";
  const sea = new THREE.Mesh(seaGeo, seaMat);
  sea.frustumCulled = false;
  scene.add(sea);

  // ---------- the ship ----------
  const deckMat = M(0xffffff, { map: plankTex() }), woodMat = M(0xffffff, { map: woodTex() }), darkMat = M(0x2a1d12), brassMat = M(0xc9a24a), ironMat = M(0x2b2b2e);
  const add = (geo, mat, x, y, z, parent = ship) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r, h, n = 8, r2 = r) => new THREE.CylinderGeometry(r2, r, h, n);
  add(box(6, 0.3, 24), deckMat, 0, -0.15, -2);
  const strakes = strakeTex(), railOf = n => { const t = strakes.clone(); t.wrapS = THREE.RepeatWrapping; t.repeat.set(n, 1); t.needsUpdate = true; return M(0xffffff, { map: t }); };
  const rail = railOf(20), capMat = M(0xffffff, { map: woodTex() });
  for (const s of [-1, 1]) {                                                               // bulwarks, hull sides
    add(box(0.16, 1.2, 24), rail, s * 3, 0.55, -2);
    add(box(0.3, 0.12, 24), capMat, s * 3, 1.2, -2);
    add(box(0.14, 4.5, 24), darkMat, s * 3.06, -1.9, -2);
  }
  add(box(6.2, 1.2, 0.16), railOf(5), 0, 0.55, 10);                                         // the taffrail
  add(box(6.2, 0.12, 0.3), capMat, 0, 1.2, 10);
  add(box(6.2, 4.5, 0.14), darkMat, 0, -1.9, 10.05);
  const fore = railOf(4);
  add(box(5, 1.2, 0.16), fore, 0, 0.55, -14.2);
  add(box(6, 0.8, 0.12), fore, 0, 0.2, -13.9);
  add(box(5.6, 0.16, 4), deckMat, 0, 0.5, 8).scale.set(1, 1, 0.6);                          // a raised quarterdeck
  // the masts, yards and sails
  const masts = [{ z: 2.0, h: 15, yards: [[6.5, 6.8], [11, 5.2], [14.2, 3.6]] }, { z: -4.0, h: 21, yards: [[7.5, 9.5], [13, 7.2], [17.4, 5], [20, 3]] }, { z: -9.6, h: 17.5, yards: [[6.6, 8], [11.2, 6], [14.6, 4]] }];
  const sailMat = lit(new THREE.MeshBasicMaterial({ color: 0xcfc8b4, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }));
  const ropes = [];
  const sailMeshes = [];
  masts.forEach((m, mi) => {
    add(cyl(0.2, m.h, 8, 0.13), darkMat, 0, m.h / 2, m.z);
    m.yards.forEach(([y, w], yi) => {
      const yard = add(cyl(0.09, w, 6), darkMat, 0, y, m.z + 0.1);
      yard.rotation.z = Math.PI / 2;
      if (mi === 0 && yi === 0) return;                                                        // the mizzen course is furled: the navigator's head would be in it
      const h = yi === 0 ? 4.6 : yi === 1 ? 4.2 : 3.4, sail = new THREE.Mesh(sailGeo(w * 0.94, h, 0.9 + yi * 0.1), sailMat);
      sail.position.set(0, y - h - 0.1, m.z + 0.05);
      sail.rotation.y = (mi % 2 ? 1 : -1) * 0.09;
      ship.add(sail); sailMeshes.push(sail);
    });
    // shrouds to the rails, with ratlines across them
    const top = m.h * 0.7;
    for (const s of [-1, 1]) for (const dz of [-0.5, 0, 0.5]) {
      ropes.push([[0.05 * s, top, m.z], [s * 2.9, 1.2, m.z + dz * 1.6], 0.016]);
    }
    for (let y = 2.2; y < top - 1; y += 0.55) for (const s of [-1, 1]) { const k = (top - y) / (top - 1.2), x = s * (0.05 + 2.85 * k); ropes.push([[x, y, m.z - 0.8 * k], [x, y, m.z + 0.8 * k], 0.01]); }
  });
  // stays between the mastheads, to the bow and to the stern
  ropes.push([[0, 15, 2.0], [0, 21, -4.0], 0.02], [[0, 21, -4.0], [0, 17.5, -9.6], 0.02], [[0, 17.5, -9.6], [0, 1.8, -17], 0.022], [[0, 15, 2.0], [0, 1.4, 9.8], 0.02], [[0, 21, -4], [0, 1.4, 9.7], 0.016]);
  for (const s of [-1, 1]) ropes.push([[0, 21, -4], [s * 2.9, 1.2, 8.6], 0.014], [[0, 17.5, -9.6], [s * 2.8, 1.2, -6], 0.014]);
  const jib = new THREE.Mesh(triGeo([0, 17.3, -9.6], [0, 1.9, -16.7], [0, 5, -9.6]), sailMat);
  ship.add(jib); sailMeshes.push(jib);
  add(cyl(0.14, 7, 6, 0.1), darkMat, 0, 1.4, -16.5).rotation.x = Math.PI / 2 - 0.12;       // the bowsprit
  const ropeGeo = new THREE.CylinderGeometry(1, 1, 1, 4, 1);
  const ropeMat = new THREE.MeshBasicMaterial({ color: 0x14100c });
  const ropeMesh = new THREE.InstancedMesh(ropeGeo, ropeMat, ropes.length);
  {
    const up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion(), mtx = new THREE.Matrix4();
    ropes.forEach(([a, b, r], i) => { const { mid, len, dir } = between(a, b); q.setFromUnitVectors(up, dir); mtx.compose(mid, q, new THREE.Vector3(r, len, r)); ropeMesh.setMatrixAt(i, mtx); });
    ropeMesh.frustumCulled = false;
    ship.add(ropeMesh);
  }
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.5, 6, 1), new THREE.MeshBasicMaterial({ color: 0x6b2a22, side: THREE.DoubleSide }));
  flag.position.set(0.8, 21.4, -4); ship.add(flag);
  const flagBase = flag.geometry.attributes.position.array.slice();
  // the binnacle (the compass) and a coil of rope, so that the quarterdeck is lived on
  add(cyl(0.2, 1.0, 10, 0.28), woodMat, 0, 0.5, 8.3);
  add(new THREE.SphereGeometry(0.2, 10, 6), brassMat, 0, 1.12, 8.3);
  add(cyl(0.3, 0.12, 10), M(0x3a2d1e), -2.2, 0.06, 6.4);
  add(cyl(0.3, 0.12, 10), M(0x3a2d1e), 2.2, 0.06, 3.2);
  for (const z of [-1, -6, -11]) for (const s of [-1, 1]) add(cyl(0.08, 0.7, 6), darkMat, s * 2.7, 0.9, z);         // belaying pins

  // ---------- the chart table ----------
  const table = new THREE.Group();
  ship.add(table);
  add(box(1.9, 0.07, 1.3), woodMat, TABLE.x, TABLE.y - 0.035, TABLE.z, table);
  for (const [dx, dz] of [[-0.82, -0.55], [0.82, -0.55], [-0.82, 0.55], [0.82, 0.55]]) add(box(0.09, 0.9, 0.09), woodMat, dx, TABLE.y - 0.5, TABLE.z + dz, table);
  for (const [w, d, dx, dz] of [[1.9, 0.05, 0, -0.64], [1.9, 0.05, 0, 0.64], [0.05, 1.3, -0.93, 0], [0.05, 1.3, 0.93, 0]]) add(box(w, 0.045, d), M(0x4a3320), TABLE.x + dx, TABLE.y + 0.02, TABLE.z + dz, table);
  // the chart: a plane carrying the page's chart canvas
  const chart = { cw: 0.66, ch: 0.84, canvas: document.createElement("canvas"), tex: null, w: 0, h: 0 };
  chart.tex = new THREE.CanvasTexture(chart.canvas);
  chart.tex.colorSpace = THREE.SRGBColorSpace;
  const chartMat = lit(new THREE.MeshBasicMaterial({ map: chart.tex }));
  const chartMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), chartMat);
  chartMesh.rotation.x = -Math.PI / 2;
  chartMesh.position.set(TABLE.x, CHART_Y, TABLE.z);
  table.add(chartMesh);
  const edge = add(box(1, 0.012, 1), M(0xcab98f), TABLE.x, CHART_Y - 0.008, TABLE.z, table);                // the chart's paper edge, under it
  // the lamp: a lantern on the table's far corner
  const lamp = new THREE.Group();
  lamp.position.set(0.7, TABLE.y, TABLE.z - 0.38);
  table.add(lamp);
  add(cyl(0.07, 0.04, 10, 0.09), brassMat, 0, 0.02, 0, lamp);
  add(cyl(0.05, 0.22, 10, 0.05), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.55, depthWrite: false }), 0, 0.15, 0, lamp);
  const flame = add(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a8 }), 0, 0.13, 0, lamp);
  add(new THREE.ConeGeometry(0.075, 0.07, 10), brassMat, 0, 0.29, 0, lamp);
  add(new THREE.SphereGeometry(0.02, 6, 4), brassMat, 0, 0.34, 0, lamp);
  const halo = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
  halo.position.set(0, 0.14, 0); halo.scale.set(0.5, 0.5, 1); halo.renderOrder = 8; lamp.add(halo);
  // the log book, the sextant, a chronometer, a pencil
  const book = new THREE.Group();
  book.position.set(-0.68, TABLE.y + 0.02, TABLE.z + 0.22); book.rotation.y = 0.35; table.add(book);
  add(box(0.3, 0.035, 0.42), M(0x3a2a22), 0, 0, 0, book);
  add(box(0.27, 0.03, 0.39), M(0xffffff, { map: bookTex() }), 0.005, 0.012, 0, book);
  add(cyl(0.007, 0.2, 6), M(0xc9a24a), 0.11, 0.045, 0.1, book).rotation.z = Math.PI / 2;
  const sext = new THREE.Group();
  {
    const arc = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.125, 24, 1, 0, 1.15), brassMat);
    arc.rotation.x = -Math.PI / 2; sext.add(arc);
    add(box(0.19, 0.012, 0.012), brassMat, 0.05, 0.01, 0.02, sext).rotation.y = -0.5;
    add(cyl(0.012, 0.16, 8), ironMat, -0.07, 0.03, -0.01, sext).rotation.z = Math.PI / 2;
    add(box(0.03, 0.03, 0.01), M(0x9fb4c0), 0.0, 0.03, 0.0, sext);
    add(cyl(0.012, 0.04, 8), woodMat, 0.1, 0.03, 0.09, sext);
  }
  const sextHome = new THREE.Vector3(0.57, TABLE.y + 0.012, TABLE.z + 0.36);
  sext.position.copy(sextHome); sext.rotation.y = -0.4; ship.add(sext);
  const chrono = new THREE.Group();
  chrono.position.set(-0.7, TABLE.y, TABLE.z - 0.36); table.add(chrono);
  add(box(0.24, 0.12, 0.24), woodMat, 0, 0.06, 0, chrono);
  const dial = { c: document.createElement("canvas"), tex: null, last: "" };
  dial.c.width = dial.c.height = 128;
  dial.tex = new THREE.CanvasTexture(dial.c); dial.tex.colorSpace = THREE.SRGBColorSpace;
  const dialMesh = new THREE.Mesh(new THREE.CircleGeometry(0.095, 24), lit(new THREE.MeshBasicMaterial({ map: dial.tex })));
  dialMesh.rotation.x = -Math.PI / 2; dialMesh.position.set(0, 0.123, 0); chrono.add(dialMesh);
  add(new THREE.RingGeometry(0.095, 0.108, 24), brassMat, 0, 0.124, 0, chrono).rotation.x = -Math.PI / 2;
  // the dividers (legs and a pivot) and the parallel rules, placed by the page
  const dividers = new THREE.Group(), legGeo = cyl(0.0045, 1, 5);
  const legA = new THREE.Mesh(legGeo, brassMat), legB = new THREE.Mesh(legGeo, brassMat), pivot = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), brassMat), knob = new THREE.Mesh(cyl(0.006, 0.07, 6), brassMat);
  dividers.add(legA, legB, pivot, knob); dividers.visible = false; ship.add(dividers);
  const rules = new THREE.Group();
  {
    const r1 = add(box(0.34, 0.01, 0.03), M(0xcdbf9c), 0, 0, -0.03, rules), r2 = add(box(0.34, 0.01, 0.03), M(0xcdbf9c), 0, 0, 0.03, rules);
    add(box(0.012, 0.006, 0.09), brassMat, -0.12, 0.006, 0, rules); add(box(0.012, 0.006, 0.09), brassMat, 0.12, 0.006, 0, rules);
    void r1; void r2;
  }
  ship.add(rules);

  // ---------- spray and wind ----------
  const NSPRAY = 140;
  const sprayMat = new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xbfd2e0, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const sprayMesh = new THREE.InstancedMesh(quad, sprayMat, NSPRAY);
  sprayMesh.renderOrder = 9; sprayMesh.frustumCulled = false; sprayMesh.count = 0;
  ship.add(sprayMesh);
  const drops = Array.from({ length: NSPRAY }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, size: 0.05 }));

  // ---------- state the page sets ----------
  const S = {
    heading: 0, headingTo: 0, swell: 0.6, weather: "clear", storm: 0, sunAlt: -10, sunAz: 270, limMag: 5, lamp: true, lampLevel: 1, day: false,
    stars: [], clouds: [], figure: null, ring: null, picked: null, pickedName: "", sextant: 0, wire: null, light: null, lights: null, land: null, moon: null,
    chartDirty: false, ratio: cap, aspect: 1, hfov: 64,
  };
  let skyKey = "", lampFlick = 0, sextLevel = 0;

  // ---------- setters ----------
  function paintDome() {
    const col = skyColours(S.sunAlt), sd = dirOf(S.sunAz, Math.max(-12, S.sunAlt)), sdv = new THREE.Vector3(...sd), c = domeGeo.attributes.color, glow = clamp((S.sunAlt + 16) / 14, 0, 1) * 0.5;
    for (let i = 0; i < dn; i++) {
      const d = domeDirs[i], alt = Math.asin(clamp(d.y, -1, 1)) / D2R, t = Math.pow(clamp(alt / 75, 0, 1), 0.55);
      const ang = Math.acos(clamp(d.dot(sdv), -1, 1)) / D2R, g = glow * Math.exp(-(ang * ang) / 1800);
      for (let j = 0; j < 3; j++) {
        const horJ = alt < 0 ? col.hor[j] * 0.6 : col.hor[j];
        const v = lerp(horJ, col.top[j], t) + col.hor[j] * g * 0.7;
        c.array[i * 3 + j] = lin(v);
      }
    }
    c.needsUpdate = true;
    const far = col.hor.map(x => x * 0.7 + 4);
    scene.fog.color.setRGB(lin(far[0]), lin(far[1]), lin(far[2]));
    renderer.setClearColor(scene.fog.color, 1);
    SEA.uHor.value.set(...col.hor.map(x => x / 255)); SEA.uTop.value.set(...col.top.map(x => x / 255)); SEA.uGlow.value.set(...col.hor.map(x => x / 255 * glow * 0.7));
    const dl0 = dayLight(S.sunAlt);                                       // the water's own body: a deep green-blue by day, nearly black at night
    SEA.uDeep.value.set(lerp(0.0014, 0.007, dl0), lerp(0.0024, 0.03, dl0), lerp(0.004, 0.06, dl0));
    // the deck's own light: starlight, then twilight, then day
    const dl = dayLight(S.sunAlt);
    LIT.uAmb.value.set(lerp(0.1, 0.95, dl) + 0.04 * (1 - dl) * 0, lerp(0.135, 0.95, dl), lerp(0.21, 0.92, dl));
    ropeMat.color.setRGB(lerp(0.01, 0.05, dl), lerp(0.008, 0.04, dl), lerp(0.006, 0.03, dl));
    flag.material.color.setRGB(lerp(0.05, 0.4, dl), lerp(0.02, 0.1, dl), lerp(0.015, 0.08, dl));
    sailMat.opacity = lerp(0.46, 0.8, dl);
    sunGlow.visible = sunDisc.visible = S.sunAlt > -4;
    paintLand();
  }

  function placeBillboard(obj, az, alt, sizeDeg, r = SKY_R - 60) {
    const d = dirOf(az, alt);
    obj.position.set(d[0] * r, d[1] * r, d[2] * r);
    obj.lookAt(0, 0, 0);
    const s = 2 * r * Math.tan(sizeDeg * D2R / 2);
    obj.scale.set(s, s, 1);
  }
  function setStars() {
    const list = S.stars;
    let n = 0;
    for (const s of list) {
      if (n >= NSTAR) break;
      const look = starLook(s.mag, s.alt, S.limMag, S.lamp, world.t, s.hr);
      if (look.a <= 0.01) continue;
      const d = dirOf(s.az, s.alt), px = SKY_R;
      dummy.position.set(d[0] * px, d[1] * px, d[2] * px);
      dummy.lookAt(0, 0, 0);
      const w = 2 * px * Math.tan(look.size * 2.2 * D2R / 2);
      dummy.scale.set(w, w, 1);
      dummy.updateMatrix();
      stars.setMatrixAt(n, dummy.matrix);
      const warm = (s.hr === 2061 || s.hr === 6134 || s.hr === 1457 || s.hr === 5340) ? [1, 0.72, 0.5] : (s.hr === 1713 || s.hr === 7001 || s.hr === 2491 || s.hr === 5056) ? [0.8, 0.88, 1] : [1, 0.95, 0.86];
      // low down the air splits the light as it flickers: a red, then a blue flash (13 November 2026)
      const deep = reduced() ? 0 : clamp((22 - s.alt) / 20, 0, 1) * 0.35, ch = Math.sin(world.t * 7.3 + s.hr * 2.1);
      stars.setColorAt(n, tmpC.setRGB(warm[0] * look.a * (1 + deep * ch), warm[1] * look.a, warm[2] * look.a * (1 - deep * ch)));
      s._i = n; n++;
    }
    stars.count = Math.max(n, 1);
    stars.instanceMatrix.needsUpdate = true;
    if (stars.instanceColor) stars.instanceColor.needsUpdate = true;
  }
  function setFigure() {
    const f = S.figure, byHr = new Map(S.stars.map(s => [s.hr, s]));
    let n = 0;
    const m = new THREE.Matrix4(), x = new THREE.Vector3(), y = new THREE.Vector3(), z = new THREE.Vector3();
    if (f) for (const line of f.lines) for (let i = 1; i < line.length; i++) {
      const a = byHr.get(line[i - 1]), b = byHr.get(line[i]);
      if (!a || !b || n >= NSEG) continue;
      const A = new THREE.Vector3(...dirOf(a.az, a.alt)), B = new THREE.Vector3(...dirOf(b.az, b.alt)), mid = A.clone().add(B).normalize();
      const len = Math.acos(clamp(A.dot(B), -1, 1)) * (SKY_R - 40);
      x.copy(B).sub(A); x.sub(mid.clone().multiplyScalar(x.dot(mid))).normalize();
      z.copy(mid); y.crossVectors(z, x).normalize();
      m.makeBasis(x.multiplyScalar(len), y.multiplyScalar(2.6), z);
      m.setPosition(mid.multiplyScalar(SKY_R - 40));
      segs.setMatrixAt(n++, m);
    }
    segs.count = n; segs.instanceMatrix.needsUpdate = true;
    if (f?.label) {
      const pts = f.keys.map(hr => byHr.get(hr)).filter(Boolean);
      if (pts.length) {
        const az = Math.atan2(pts.reduce((t, p) => t + Math.sin(p.az * D2R), 0), pts.reduce((t, p) => t + Math.cos(p.az * D2R), 0)) / D2R, lo = Math.min(...pts.map(p => p.alt));
        setLabel(figLabel, f.label); placeBillboard(figLabel, az, Math.max(2, lo - 3.5), 10); figLabel.scale.y = figLabel.scale.x / 4; figLabel.visible = true;
      } else figLabel.visible = false;
    } else figLabel.visible = false;
  }
  function setMarks() {
    const find = hr => S.stars.find(s => s.hr === hr);
    const r = S.ring && find(S.ring), p = S.picked && S.picked > 0 && find(S.picked);
    hintRing.visible = !!r; if (r) placeBillboard(hintRing, r.az, r.alt, 2.4, SKY_R - 30);
    pickRing.visible = !!p; if (p) placeBillboard(pickRing, p.az, p.alt, 1.7, SKY_R - 30);
    if (p && S.pickedName) { setLabel(pickLabel, S.pickedName); placeBillboard(pickLabel, p.az, p.alt - 2.2, 7); pickLabel.scale.y = pickLabel.scale.x / 4; pickLabel.visible = true; } else pickLabel.visible = false;
  }
  function setMoon() {
    const m = S.moon, up = !!m && m.alt > -1 && m.lit > 0.03;
    moonDisc.visible = moonGlow.visible = up;
    if (!up) return;
    drawMoon(m.lit);
    const dim = clamp(1 - (S.sunAlt + 6) / 10, 0.25, 1);                                         // pale by day, bright at night
    placeBillboard(moonGlow, m.az, m.alt, 9 + 10 * m.lit, SKY_R - 30);
    placeBillboard(moonDisc, m.az, m.alt, 1.5, SKY_R - 35);
    // turn the disc so its lit side faces the sun, whatever the hemisphere and the hour
    const md = new THREE.Vector3(...dirOf(m.az, m.alt)), sd = new THREE.Vector3(...dirOf(S.sunAz, S.sunAlt)), pr = sd.addScaledVector(md, -sd.dot(md));
    const ax = new THREE.Vector3(1, 0, 0).applyQuaternion(moonDisc.quaternion), ay = new THREE.Vector3(0, 1, 0).applyQuaternion(moonDisc.quaternion);
    moonDisc.rotateZ(Math.atan2(pr.dot(ay), pr.dot(ax)));
    moonGlow.material.opacity = 0.35 * m.lit * dim; moonDisc.material.opacity = 0.35 + 0.65 * dim;
  }
  function setSun() {
    setMoon();
    if (!(S.sunAlt > -4)) return;
    const k = clamp((S.sunAlt + 4) / 6, 0, 1);
    placeBillboard(sunGlow, S.sunAz, S.sunAlt, 34, SKY_R - 20);
    placeBillboard(sunDisc, S.sunAz, S.sunAlt, 2.4, SKY_R - 25);
    sunMat.opacity = 0.9 * k; sunDisc.material.opacity = k;
    sunDisc.visible = S.sunAlt > -1.5 && !S.sunHidden;
  }
  /** Puffs for each cloud disc: a ragged heap of lobes that covers the disc's radius, so that what it hides is what the engine says it hides.
   *  The cloud takes the sky's own light: pale by day, and at dusk and night a darker shade of the sky behind it (never a second hue),
   *  lighter on top and darker underneath. Each lobe is turned and sized a little differently, from the cloud's own number. */
  function setClouds() {
    const day = S.sunAlt > 2, col = skyColours(S.sunAlt), mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
    const lit = day ? [238, 241, 248] : mix(col.top, col.hor, 0.45).map(x => x * 0.62 + 20), shade = day ? [176, 186, 206] : lit.map(x => x * 0.62);
    const hash = n => { const x = Math.sin(n * 91.7 + 17.3) * 43758.5453; return x - Math.floor(x); };
    let n = 0;
    S.clouds.forEach((c, ci) => {
      const seed = ci * 19 + Math.round(c.az);
      for (let li = 0; li < 12; li++) {
        if (n >= NPUFF) return;
        const a = hash(seed + li) * 6.283, d = li === 0 ? 0 : 0.35 + 0.5 * hash(seed + li + 40), dx = Math.cos(a) * d, dy = Math.sin(a) * d * 0.7;
        const k = li === 0 ? 1.12 : 0.74 - 0.3 * d + 0.18 * hash(seed + li + 80);
        const cosA = Math.max(0.25, Math.cos(c.alt * D2R)), az = c.az + (dx * c.r * 0.7) / cosA, alt = clamp(c.alt + dy * c.r * 0.7, 1, 89);
        const dv = dirOf(az, alt), R = SKY_R - 90 - ci * 3 - li * 0.5;
        dummy.position.set(dv[0] * R, dv[1] * R, dv[2] * R);
        dummy.lookAt(0, 0, 0);
        dummy.rotateZ(hash(seed + li + 120) * 6.283);
        const w = 2 * R * Math.tan(c.r * k * 1.55 * D2R / 2);
        dummy.scale.set(w, w, 1); dummy.updateMatrix();
        puffs.setMatrixAt(n, dummy.matrix);
        const up = clamp(0.5 + dy * 0.6, 0, 1), cc = mix(shade, lit, up).map(x => lin(x * (0.94 + 0.12 * hash(seed + li + 160))));
        puffs.setColorAt(n, tmpC.setRGB(cc[0], cc[1], cc[2]));
        n++;
      }
    });
    puffs.count = n; puffs.instanceMatrix.needsUpdate = true; if (puffs.instanceColor) puffs.instanceColor.needsUpdate = true;
  }

  /** The sea's state for its shader: the time, the swell and the wind, and what lights the water. */
  function setSea(t) {
    const wind = windOf(S.swell, S.weather), still = reduced();
    SEA.uT.value = still ? 0 : t;
    SEA.uA.value = (0.1 + 0.3 * S.swell) * (1 + 0.8 * S.storm) * (still ? 0.5 : 1);
    SEA.uWind.value = clamp(wind + 0.4 * S.storm, 0, 1.4);
    SEA.uFoam.value = clamp((wind - 0.45) * 1.6 + S.storm * 0.6, 0, 1) * (still ? 0.5 : 1);
    // the water runs aft past her at some five knots: the pattern is drawn where the ship has come to
    const h = S.heading * D2R, run = still ? 0 : t * 2.6;
    SEA.uDrift.value.x = Math.sin(h) * run; SEA.uDrift.value.y = -Math.cos(h) * run;   // a plain pair: the bundle has no Vector2
    const sunUp = S.sunAlt > -1.5 && !S.sunHidden, sk = clamp((S.sunAlt + 1.5) / 3, 0, 1);
    SEA.uSunDir.value.set(...dirOf(S.sunAz, Math.max(S.sunAlt, 0.3)));
    const warm = clamp(S.sunAlt / 20, 0, 1);
    SEA.uSunCol.value.set(1, lerp(0.62, 0.95, warm), lerp(0.32, 0.85, warm)).multiplyScalar(sunUp ? 9 * sk : 0);
    const m = S.moon, moonUp = !!m && m.alt > 0 && S.sunAlt < -3;
    if (moonUp) SEA.uMoonDir.value.set(...dirOf(m.az, m.alt));
    SEA.uMoonCol.value.set(0.78, 0.84, 0.95).multiplyScalar(moonUp ? 1.1 * m.lit * clamp((-3 - S.sunAlt) / 6, 0, 1) : 0);
  }

  function stepSpray(dt, t) {
    const wind = windOf(S.swell, S.weather), want = reduced() ? 0 : Math.round(NSPRAY * clamp((wind - 0.35) * 1.5 + S.storm * 0.5, 0, 1));
    let live = 0;
    const q = camera.quaternion, m = new THREE.Matrix4(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    for (let i = 0; i < NSPRAY; i++) {
      const d = drops[i];
      if (d.life <= 0 && i < want && Math.random() < dt * 3) {                         // thrown up by the weather bow and sent across the deck
        d.p.set(-3.1, 1.0 + Math.random() * 0.6, -6 + Math.random() * 14);
        d.v.set(3 + Math.random() * 5 * (0.5 + wind), 1.5 + Math.random() * 3, (Math.random() - 0.5) * 1.5 - 1);
        d.life = 0.6 + Math.random() * 0.9; d.size = 0.03 + Math.random() * 0.05;
      }
      if (d.life > 0) {
        d.life -= dt; d.v.y -= 9.8 * dt * 0.6; d.p.addScaledVector(d.v, dt);
        if (d.life > 0) { sc.set(d.size, d.size * 1.3, 1); m.compose(d.p, q, sc); sprayMesh.setMatrixAt(live++, m); }
      }
    }
    // the camera is the ship's child, so the billboards face it in the ship's frame: its quaternion is the ship-local one
    sprayMesh.count = live; sprayMesh.instanceMatrix.needsUpdate = true;
    void t; void v;
  }

  function drawDial(gmt) {
    if (dial.last === gmt) return;
    dial.last = gmt;
    const ctx = dial.c.getContext("2d"), w = 128, c = 64;
    ctx.fillStyle = "#efe5c8"; ctx.fillRect(0, 0, w, w);
    ctx.strokeStyle = "#3a2d1e"; ctx.fillStyle = "#3a2d1e";
    for (let i = 0; i < 60; i++) { const a = i / 60 * 6.283, r1 = i % 5 ? 54 : 48; ctx.lineWidth = i % 5 ? 1 : 2; ctx.beginPath(); ctx.moveTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1); ctx.lineTo(c + Math.sin(a) * 58, c - Math.cos(a) * 58); ctx.stroke(); }
    const [h, mi, s] = gmt.split(":").map(Number);
    const hand = (a, l, wd) => { ctx.lineWidth = wd; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.sin(a) * l, c - Math.cos(a) * l); ctx.stroke(); };
    hand(((h % 12) + mi / 60) / 12 * 6.283, 28, 4); hand((mi + s / 60) / 60 * 6.283, 42, 3); ctx.strokeStyle = "#a8382b"; hand(s / 60 * 6.283, 46, 1.5);
    dial.tex.needsUpdate = true;
  }

  // ---------- the camera ----------
  const tmpV = new THREE.Vector3();
  function pose(p) {
    ship.rotation.set(p.motion.pitch * D2R, -S.heading * D2R, p.motion.roll * D2R);
    ship.position.y = EYE_Y + p.motion.heave;
    camera.position.set(p.eye[0], p.eye[1], p.eye[2]);
    camera.rotation.set(p.pitch * D2R, (-(p.az - S.heading)) * D2R, 0);
    camera.fov = vfovOf(S.aspect, S.hfov);
    camera.aspect = S.aspect;
    camera.updateProjectionMatrix();
    ship.updateMatrixWorld(true);
    camera.getWorldPosition(skyRoot.position);
  }

  // ---------- the chart canvas on the table ----------
  /** Sizes the chart plane and its canvas for the window's shape; returns { canvas, w, h } (CSS px) when the canvas changed. */
  function sizeChart(portrait, dpr = 1) {
    const cw = portrait ? 0.66 : 1.0, ch = portrait ? 0.84 : 0.62, W = portrait ? 400 : 620, H = portrait ? 510 : 384;
    if (chart.cw === cw && chart.ch === ch && chart.w === W) return null;
    Object.assign(chart, { cw, ch, w: W, h: H });
    chart.canvas.width = Math.round(W * dpr); chart.canvas.height = Math.round(H * dpr);
    chartMesh.scale.set(cw, ch, 1); edge.scale.set(cw + 0.04, 1, ch + 0.04);
    return { canvas: chart.canvas, w: W, h: H, dpr };
  }

  /** Metres on the table for a point of the chart canvas (css px). */
  const onChart = (px, py) => new THREE.Vector3(TABLE.x + (px / chart.w - 0.5) * chart.cw, CHART_Y + 0.002, TABLE.z + (py / chart.h - 0.5) * chart.ch);

  function setDividers(t) {
    if (!t) { dividers.visible = false; return; }
    const a = onChart(t.a[0], t.a[1]), b = onChart(t.b[0], t.b[1]), sep = a.distanceTo(b), L = Math.max(0.2, sep * 0.62);
    const hgt = Math.sqrt(Math.max(0.004, L * L - sep * sep / 4)), top = a.clone().add(b).multiplyScalar(0.5);
    top.y += hgt;
    const up = new THREE.Vector3(0, 1, 0), set = (leg, p) => { const { mid, len, dir } = between([p.x, p.y, p.z], [top.x, top.y, top.z]); leg.position.copy(mid); leg.scale.set(1, len, 1); leg.quaternion.setFromUnitVectors(up, dir); };
    set(legA, a); set(legB, b);
    pivot.position.copy(top); knob.position.copy(top).add(new THREE.Vector3(0, 0.035, 0));
    dividers.visible = true;
  }
  function setRules(t) {
    if (!t) { rules.position.set(TABLE.x + 0.55, CHART_Y + 0.015, TABLE.z - 0.3); rules.rotation.set(0, 0.5, 0); return; }
    const p = onChart(t.at[0], t.at[1]);
    rules.position.set(p.x, CHART_Y + 0.012, p.z);
    rules.rotation.set(0, Math.atan2(Math.cos(t.course * D2R), Math.sin(t.course * D2R)), 0);
  }

  // ---------- the sextant raised ----------
  function placeSextant(level, p) {
    const k = smooth(level);
    sext.visible = true;
    if (k < 0.001) { sext.position.copy(sextHome); sext.rotation.set(0, -0.4, 0); sext.scale.setScalar(1); return; }
    const e = new THREE.Euler(p.pitch * D2R, -(p.az - S.heading) * D2R, 0, "YXZ"), q = new THREE.Quaternion().setFromEuler(e);
    const front = new THREE.Vector3(0.1, -0.13, -0.5).applyQuaternion(q).add(new THREE.Vector3(...p.eye));
    const qHome = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -0.4, 0)), qRaise = q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 * 0.9, 0, 0)));
    sext.position.lerpVectors(sextHome, front, k);
    sext.quaternion.copy(qHome).slerp(qRaise, k);
    sext.scale.setScalar(lerp(1, 1.9, k));
  }

  // ---------- one frame ----------
  function frame(t, dt, p) {
    world.t = t;
    S.heading += ((((S.headingTo - S.heading) % 360) + 540) % 360 - 180) * Math.min(1, dt * 0.8);
    const motion = shipMotion(t, S.swell, S.storm, reduced());
    world.motion = motion;
    pose({ ...p, motion });
    // the lamp: a flicker, and out when it is put out
    lampFlick = reduced() ? 0 : Math.sin(t * 9.1) * 0.04 + Math.sin(t * 23.7) * 0.025 + Math.sin(t * 3.3) * 0.03;
    S.lampLevel += ((S.lamp ? 1 : 0.07) - S.lampLevel) * Math.min(1, dt * 5);
    LIT.uLamp.value = S.lampLevel * (1 + (S.lamp ? lampFlick : 0));
    flame.visible = halo.visible = S.lampLevel > 0.3;
    halo.material.opacity = clamp(S.lampLevel, 0, 1) * 0.8;
    lamp.updateMatrixWorld(true);
    lamp.getWorldPosition(LIT.uLampPos.value); LIT.uLampPos.value.y += 0.16;
    // the lights: each flashes in its own character; a single light of the old levels shows two flashes in five seconds
    const shown = S.lights ?? (S.light ? [{ az: S.light.az, ch: "Fl(2) 5s", off: S.light.az * 0.013 }] : []);
    let brightest = 0;
    for (const [k, T] of towers.entries()) {
      const g = shown[k];
      T.beacon.visible = !!g;
      if (!g) { for (const ray of T.rays) ray.visible = false; continue; }
      if (T.ch !== g.ch) { T.ch = g.ch; const c = lightColour(g.ch).map(x => x / 255); T.beacon.material.color.setRGB(...c); for (const ray of T.rays) ray.material.color.setRGB(...c); }
      const P = parseChar(g.ch), u = t + g.off, on = reduced() ? 0.55 : lightOn(P, u), ph = P.period ? ((u % P.period) + P.period) % P.period : 0, beams = reduced() ? [] : flashTimes(P);
      placeBillboard(T.beacon, g.az, 0.6 + 0.3 * Math.sin(t * 0.7 + k), 0.9 + 1.6 * on, SKY_R - 40 - k);
      T.beacon.material.opacity = clamp(0.15 + on, 0, 1);
      // the optic turns once a period, a panel for each flash: a beam sweeps along the horizon and flashes as it points at the ship
      for (const [j, ray] of T.rays.entries()) {
        ray.visible = j < beams.length;
        if (!ray.visible) continue;
        const th = 2 * Math.PI * (ph - beams[j]) / P.period, sn = Math.sin(th), cs = Math.cos(th);
        placeBillboard(ray, g.az, 0.75, 1, SKY_R - 45 - k);
        const len = ray.scale.y * (1.5 + 14 * Math.abs(sn));
        ray.rotateZ(sn > 0 ? -Math.PI / 2 + 0.06 : Math.PI / 2 - 0.06);
        ray.scale.set(ray.scale.x * 0.9, len, 1); ray.translateY(len * 0.5);
        ray.material.opacity = 0.04 + 0.36 * Math.pow(Math.max(cs, 0), 3);
      }
      if (on > brightest) { brightest = on; SEA.uBeaconDir.value.set(...dirOf(g.az, 0.6)); }
    }
    SEA.uBeacon.value = 1.4 * brightest;
    if (S.land !== landFor) setLand();
    // the sea, the flag, the spray
    setSea(t);
    if (!reduced()) {
      const fp = flag.geometry.attributes.position, wind = windOf(S.swell, S.weather);
      for (let i = 0; i < fp.count; i++) { const x = flagBase[i * 3] + 0.8, w = Math.sin(t * (5 + 6 * wind) - x * 4) * 0.12 * x * (0.5 + wind); fp.setZ(i, w); }
      fp.needsUpdate = true;
      stepSpray(dt, t);
    }
    // the pose of the sextant, and the chronometer
    placeSextant(S.sextant, p);
    if (S.gmt) drawDial(S.gmt);
    renderer.render(scene, camera);
  }

  /** Called when the sky changes (every quarter minute of the watch, or the sun's height, the lamp, the weather): the heavy rebuilds. */
  function refreshSky(force = false) {
    const key = `${S.sunAlt.toFixed(1)}|${S.lamp}`;
    if (force || key !== skyKey) { skyKey = key; paintDome(); }
    setStars(); setFigure(); setMarks(); setSun();
  }

  // ---------- asking the scene ----------
  function ndc(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    return [((clientX - r.left) / r.width) * 2 - 1, -(((clientY - r.top) / r.height) * 2 - 1)];
  }
  /** The star nearest a tap (screen px) among `list` ({ az, alt, hr }), within `radius` px; the brighter of two close ones. */
  function pickStar(clientX, clientY, list, radius) {
    const r = canvas.getBoundingClientRect(), v = new THREE.Vector3();
    let best = null, bd = radius * radius;
    for (const s of list) {
      const d = dirOf(s.az, s.alt);
      v.set(d[0] * 1000, d[1] * 1000, d[2] * 1000).add(skyRoot.position).project(camera);
      if (v.z > 1 || v.z < -1) continue;
      const x = (v.x * 0.5 + 0.5) * r.width + r.left, y = (-v.y * 0.5 + 0.5) * r.height + r.top, dd = (x - clientX) ** 2 + (y - clientY) ** 2;
      const score = dd + (s.mag ?? 0) * 6;
      if (dd < bd && (best === null || score < best.score)) best = { s, score };
    }
    return best ? best.s : null;
  }
  /** Where a tap lands on the chart: { x, y } in the chart canvas's css px, or null. */
  function chartAt(clientX, clientY) {
    const [nx, ny] = ndc(clientX, clientY);
    camera.updateMatrixWorld(true); chartMesh.updateMatrixWorld(true);
    const o = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld), far = new THREE.Vector3(nx, ny, 0.5).unproject(camera);
    const inv = chartMesh.matrixWorld.clone().invert(), lo = o.clone().applyMatrix4(inv), lf = far.clone().applyMatrix4(inv), dir = lf.sub(lo);
    if (Math.abs(dir.z) < 1e-9) return null;
    const k = -lo.z / dir.z;
    if (k < 0) return null;
    const lx = lo.x + dir.x * k, ly = lo.y + dir.y * k;
    if (Math.abs(lx) > 0.5 || Math.abs(ly) > 0.5) return null;
    return { x: (lx + 0.5) * chart.w, y: (0.5 - ly) * chart.h };
  }
  /** Which prop a tap lands on, by its place on the screen: "log", "sextant", "lamp" or "chrono". */
  function propAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect(), v = new THREE.Vector3();
    camera.updateMatrixWorld(true);
    let best = null, bd = Infinity;
    for (const [id, obj, rad] of [["log", book, 0.2], ["sextant", sext, 0.14], ["lamp", lamp, 0.17], ["chrono", chrono, 0.14]]) {
      obj.getWorldPosition(v);
      const cam = v.clone().applyMatrix4(camera.matrixWorldInverse);
      if (cam.z > -0.2) continue;
      const c = v.clone().project(camera), px = (c.x * 0.5 + 0.5) * r.width + r.left, py = (-c.y * 0.5 + 0.5) * r.height + r.top;
      const rpx = rad / (-cam.z * Math.tan(camera.fov * D2R / 2)) * r.height / 2, d = Math.hypot(px - clientX, py - clientY);
      if (d < rpx * 1.2 && d < bd) { best = id; bd = d; }
    }
    return best;
  }
  /** Pixels to a degree at the middle of the view, for dragging. */
  const pxPerDeg = () => canvas.getBoundingClientRect().height / camera.fov;
  /** The screen position of a bearing and height (client px), or null when it is behind the viewer. */
  function screenOf(az, alt) {
    const d = dirOf(az, alt), v = new THREE.Vector3(d[0] * 1000, d[1] * 1000, d[2] * 1000).add(skyRoot.position), r = canvas.getBoundingClientRect();
    camera.updateMatrixWorld(true);
    if (v.clone().applyMatrix4(camera.matrixWorldInverse).z > 0) return null;
    v.project(camera);
    return { x: (v.x * 0.5 + 0.5) * r.width + r.left, y: (-v.y * 0.5 + 0.5) * r.height + r.top };
  }

  function resize(w, h) {
    S.aspect = w / Math.max(1, h);
    renderer.setSize(w, h, false);
  }
  function setRatio(r) { S.ratio = r; renderer.setPixelRatio(r); const c = canvas.getBoundingClientRect(); renderer.setSize(c.width, c.height, false); }

  return {
    S, canvas, chart, frame, refreshSky, setClouds, sizeChart, setDividers, setRules, resize, setRatio, pickStar, chartAt, propAt, screenOf, pxPerDeg, camera,
    get motion() { return world.motion || { roll: 0, pitch: 0, heave: 0 }; },
    chartTexture: () => { chart.tex.needsUpdate = true; },
    setSextant(v) { S.sextant = v; },
    dispose() { renderer.dispose(); canvas.remove(); },
    get info() { return renderer.info; },
  };
}
