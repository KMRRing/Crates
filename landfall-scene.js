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
import { skyColours } from "./landfall-skyview.js";

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
const puffTex = () => canvasTex(128, 128, (ctx, w, h) => {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.62, "rgba(255,255,255,.96)"); g.addColorStop(0.82, "rgba(255,255,255,.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
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

  // a lighthouse on the horizon: a warm flash at the bearing of the light, as the sea shows it, and a steady glow for those who ask for less motion
  const beacon = new THREE.Mesh(quad, new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, color: 0xffe2a0 }));
  beacon.renderOrder = 2; beacon.frustumCulled = false; beacon.visible = false; skyRoot.add(beacon);

  const NPUFF = 72;
  const puffMat = new THREE.MeshBasicMaterial({ map: puffTex(), transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
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
  const RINGS = 42, SEGS = 72, R0 = 4, GROW = 1.16;
  const sp = [], si = [], seaR = [];
  for (let r = 0; r <= RINGS; r++) for (let k = 0; k <= SEGS; k++) { const rad = R0 * Math.pow(GROW, r), a = k / SEGS * 6.2832; sp.push(rad * Math.cos(a), 0, rad * Math.sin(a)); seaR.push(rad); }
  for (let r = 0; r < RINGS; r++) for (let k = 0; k < SEGS; k++) { const a = r * (SEGS + 1) + k, b = a + SEGS + 1; si.push(a, b, a + 1, a + 1, b, b + 1); }
  const seaGeo = new THREE.BufferGeometry();
  seaGeo.setAttribute("position", new THREE.Float32BufferAttribute(sp, 3));
  seaGeo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(sp.length), 3));
  seaGeo.setIndex(si);
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }));
  sea.frustumCulled = false;
  scene.add(sea);
  const seaBase = sp.slice();

  // ---------- the ship ----------
  const deckMat = M(0xffffff, { map: plankTex() }), woodMat = M(0xffffff, { map: woodTex() }), darkMat = M(0x2a1d12), brassMat = M(0xc9a24a), ironMat = M(0x2b2b2e);
  const add = (geo, mat, x, y, z, parent = ship) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (r, h, n = 8, r2 = r) => new THREE.CylinderGeometry(r2, r, h, n);
  add(box(6, 0.3, 24), deckMat, 0, -0.15, -2);
  const rail = M(0x3a2a1b);
  for (const s of [-1, 1]) {                                                               // bulwarks, hull sides
    add(box(0.16, 1.2, 24), rail, s * 3, 0.55, -2);
    add(box(0.3, 0.12, 24), darkMat, s * 3, 1.2, -2);
    add(box(0.14, 4.5, 24), darkMat, s * 3.06, -1.9, -2);
  }
  add(box(6.2, 1.2, 0.16), rail, 0, 0.55, 10);                                              // the taffrail
  add(box(6.2, 0.12, 0.3), darkMat, 0, 1.2, 10);
  add(box(6.2, 4.5, 0.14), darkMat, 0, -1.9, 10.05);
  add(box(5, 1.2, 0.16), rail, 0, 0.55, -14.2);
  add(box(6, 0.8, 0.12), rail, 0, 0.2, -13.9);
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
    stars: [], clouds: [], figure: null, ring: null, picked: null, pickedName: "", sextant: 0, wire: null, light: null,
    chartDirty: false, ratio: cap, aspect: 1, hfov: 64,
  };
  let skyKey = "", lampFlick = 0, lastSeaT = -1, sextLevel = 0;

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
    seaCol = { dark: col.hor.map(x => x * 0.2 + 3), hor: far };
    // the deck's own light: starlight, then twilight, then day
    const dl = dayLight(S.sunAlt);
    LIT.uAmb.value.set(lerp(0.1, 0.95, dl) + 0.04 * (1 - dl) * 0, lerp(0.135, 0.95, dl), lerp(0.21, 0.92, dl));
    ropeMat.color.setRGB(lerp(0.01, 0.05, dl), lerp(0.008, 0.04, dl), lerp(0.006, 0.03, dl));
    flag.material.color.setRGB(lerp(0.05, 0.4, dl), lerp(0.02, 0.1, dl), lerp(0.015, 0.08, dl));
    sailMat.opacity = lerp(0.46, 0.8, dl);
    sunGlow.visible = sunDisc.visible = S.sunAlt > -4;
  }
  let seaCol = { dark: [10, 20, 26], hor: [30, 40, 50] };

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
      stars.setColorAt(n, tmpC.setRGB(warm[0] * look.a, warm[1] * look.a, warm[2] * look.a));
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
  function setSun() {
    if (!(S.sunAlt > -4)) return;
    const k = clamp((S.sunAlt + 4) / 6, 0, 1);
    placeBillboard(sunGlow, S.sunAz, S.sunAlt, 34, SKY_R - 20);
    placeBillboard(sunDisc, S.sunAz, S.sunAlt, 2.4, SKY_R - 25);
    sunMat.opacity = 0.9 * k; sunDisc.material.opacity = k;
    sunDisc.visible = S.sunAlt > -1.5 && !S.sunHidden;
  }
  /** Puffs for each cloud disc: a soft heap that covers the disc's radius, so that what it hides is what the engine says it hides. */
  function setClouds() {
    const day = S.sunAlt > 2;
    const col = skyColours(S.sunAlt), body = day ? [226, 230, 238] : col.top.map(x => x * 0.5 + 12), edge = day ? [210, 216, 228] : col.hor.map(x => x * 0.4 + 8);
    let n = 0;
    S.clouds.forEach((c, ci) => {
      const lobes = [[0, 0, 1.12], [0.55, 0.15, 0.62], [-0.5, -0.2, 0.66], [0.2, -0.55, 0.58], [-0.25, 0.55, 0.58], [0.72, -0.4, 0.45], [-0.78, 0.3, 0.45]];
      lobes.forEach(([dx, dy, k], li) => {
        if (n >= NPUFF) return;
        const cosA = Math.max(0.25, Math.cos(c.alt * D2R)), az = c.az + (dx * c.r * 0.7) / cosA, alt = clamp(c.alt + dy * c.r * 0.7, 1, 89);
        const d = dirOf(az, alt), R = SKY_R - 90 - ci * 3 - li;
        dummy.position.set(d[0] * R, d[1] * R, d[2] * R);
        dummy.lookAt(0, 0, 0);
        const w = 2 * R * Math.tan(c.r * k * 1.28 * D2R / 2);
        dummy.scale.set(w, w, 1); dummy.updateMatrix();
        puffs.setMatrixAt(n, dummy.matrix);
        const sh = li === 0 ? 1 : 0.86 + 0.14 * ((li * 37) % 5) / 5, cc = (li % 2 ? edge : body).map(x => lin(x * sh));
        puffs.setColorAt(n, tmpC.setRGB(cc[0], cc[1], cc[2]));
        n++;
      });
    });
    puffs.count = n; puffs.instanceMatrix.needsUpdate = true; if (puffs.instanceColor) puffs.instanceColor.needsUpdate = true;
  }

  function setSea(t) {
    const pos = seaGeo.attributes.position.array, col = seaGeo.attributes.color.array;
    const A = (0.1 + 0.3 * S.swell) * (1 + 0.8 * S.storm) * (reduced() ? 0.5 : 1), ts = reduced() ? 0 : t;
    const sl = dirOf(S.sunAz, 0), lx = sl[0], lz = sl[2];
    const dk = seaCol.dark, hr = seaCol.hor;
    for (let i = 0; i < seaR.length; i++) {
      const x = seaBase[i * 3], z = seaBase[i * 3 + 2], r = seaR[i], f = A / (1 + r / 260);
      const p1 = 0.45 * x + 0.2 * z - ts * 1.9, p2 = -0.3 * x + 0.5 * z - ts * 2.5, p3 = 0.9 * x - 0.6 * z - ts * 3.4;
      const h = f * (Math.sin(p1) + 0.55 * Math.sin(p2) + 0.25 * Math.sin(p3));
      const gx = f * (0.45 * Math.cos(p1) - 0.165 * Math.cos(p2) + 0.225 * Math.cos(p3)), gz = f * (0.2 * Math.cos(p1) + 0.275 * Math.cos(p2) - 0.15 * Math.cos(p3));
      pos[i * 3 + 1] = h;
      const shade = clamp(1 + 3.2 * (gx * lx + gz * lz) / (0.4 + f * 0.6), 0.35, 2.2), far = clamp(r / 1400, 0, 1) * 0.35;
      for (let j = 0; j < 3; j++) col[i * 3 + j] = lin(lerp(dk[j] * shade, hr[j], far));
    }
    seaGeo.attributes.position.needsUpdate = true; seaGeo.attributes.color.needsUpdate = true;
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
    // the light: on for a moment in every five seconds (a group-flashing light is told by its pattern), steady and dim when motion is reduced
    beacon.visible = !!S.light;
    if (S.light) {
      const ph = (t + S.light.az * 0.013) % 5, on = reduced() ? 0.55 : ph < 0.5 ? Math.sin(ph / 0.5 * Math.PI) : ph > 1.0 && ph < 1.5 ? Math.sin((ph - 1.0) / 0.5 * Math.PI) * 0.8 : 0.06;
      placeBillboard(beacon, S.light.az, 0.6 + 0.3 * Math.sin(t * 0.7), 0.9 + 1.6 * on, SKY_R - 40); beacon.material.opacity = clamp(0.15 + on, 0, 1);
    }
    // the sea, the flag, the spray
    if (t - lastSeaT > (reduced() ? 1e9 : 1 / 30)) { setSea(t); lastSeaT = t; }
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
