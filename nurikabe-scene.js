// The scenery round Dujiang's 3D board, after a Song landscape painting: layers of ink-wash mountains in mist (painted once on a 2D canvas
// behind the board, since the camera looks down and never sees a real horizon), a ground that fades into the mist, willows on the
// banks, a pavilion on a mound, lanterns along the levee for the night. Colours come from a skin (nurikabe-3d.js's SKINS).
import * as THREE from "./vendor/three.js";
import { CanvasTexture } from "./vendor/three-tex.js";

/** A small repeatable random: the same scenery on every phone. */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}
const hex = c => "#" + c.toString(16).padStart(6, "0");

/**
 * Paints the backdrop: a pale sky, three ridges of mountains each in more mist than the last, a mist band and the ground's paper.
 * `w`, `h` in pixels; `sk` the skin. The ridges are sums of sines from a fixed seed, so a resize repaints the same hills.
 */
export function paintBackdrop(ctx, w, h, sk) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, hex(sk.skyTop)); g.addColorStop(0.5, hex(sk.skyLow)); g.addColorStop(1, hex(sk.paper));
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  if (sk.night) {                                                      // the moon, behind the farthest ridge
    const mx = w * 0.7, my = h * 0.15, r = Math.min(w, h) * 0.045;
    const halo = ctx.createRadialGradient(mx, my, r * 0.6, mx, my, r * 4);
    halo.addColorStop(0, "rgba(235,240,225,.35)"); halo.addColorStop(1, "rgba(235,240,225,0)");
    ctx.fillStyle = halo; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hex(sk.moon); ctx.beginPath(); ctx.arc(mx, my, r, 0, 7); ctx.fill();
  }
  const rand = rng(20261104);
  const layers = [
    { base: 0.3, amp: 0.2, tone: sk.far, mist: 0.0 },
    { base: 0.4, amp: 0.2, tone: sk.mid, mist: 0.0 },
    { base: 0.5, amp: 0.16, tone: sk.near, mist: 0.0 },
  ];
  layers.forEach((L, i) => {
    const ph = [rand() * 6, rand() * 6, rand() * 6], k = [1.3 + i * 0.5, 3.1 + i, 7.7 + i * 2];
    const y = x => h * (L.base - L.amp * (0.55 * Math.max(0, Math.sin(x / w * k[0] * 6.28 + ph[0]) * 0.5 + 0.5) ** 1.6 + 0.3 * (Math.sin(x / w * k[1] * 6.28 + ph[1]) * 0.5 + 0.5) + 0.15 * (Math.sin(x / w * k[2] * 6.28 + ph[2]) * 0.5 + 0.5)));
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 3) ctx.lineTo(x, y(x));
    ctx.lineTo(w, h); ctx.closePath();
    const f = ctx.createLinearGradient(0, h * (L.base - L.amp), 0, h * (L.base + 0.12));
    f.addColorStop(0, hex(L.tone)); f.addColorStop(1, hex(sk.skyLow));
    ctx.fillStyle = f; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1;
    // a few dry brush strokes down the ridge, and the mist lying between this layer and the next
    ctx.strokeStyle = hex(L.tone); ctx.globalAlpha = 0.25; ctx.lineWidth = 1;
    for (let j = 0; j < 26; j++) { const x = rand() * w, y0 = y(x) + 3; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x + (rand() - 0.5) * 6, y0 + 8 + rand() * h * 0.06); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const m = ctx.createLinearGradient(0, h * (L.base + 0.02), 0, h * (L.base + 0.14));
    m.addColorStop(0, hex(sk.mist) + "00"); m.addColorStop(0.5, hex(sk.mist) + "cc"); m.addColorStop(1, hex(sk.mist) + "00");
    ctx.fillStyle = m; ctx.fillRect(0, h * (L.base + 0.02), w, h * 0.12);
  });
  const ground = ctx.createLinearGradient(0, h * 0.5, 0, h * 0.72);
  ground.addColorStop(0, hex(sk.paper) + "00"); ground.addColorStop(1, hex(sk.paper));
  ctx.fillStyle = ground; ctx.fillRect(0, h * 0.5, w, h * 0.5);
}

// ---------- geometry and materials ----------
const box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 10), cone4 = new THREE.ConeGeometry(0.5, 1, 4), cone = new THREE.ConeGeometry(0.5, 1, 7), ball = new THREE.SphereGeometry(0.5, 8, 6);
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...extra });
const put = (parent, geo, material, [x, y, z], [sx, sy, sz], rot = [0, 0, 0], shadow = true) => {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = shadow; m.receiveShadow = true;
  parent.add(m);
  return m;
};
/** A quad lying flat (or standing) from two triangles, with the UV a texture needs. */
export function quad(w, h) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-w / 2, 0, -h / 2, w / 2, 0, -h / 2, w / 2, 0, h / 2, -w / 2, 0, h / 2], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 3, 2, 0, 2, 1]);
  return g;
}
/** A radial fade as a texture: opaque in the middle, clear at the rim (the ground's edge into the mist, a lantern's glow). */
function fadeTexture(inner) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64);
  g.addColorStop(0, "#fff"); g.addColorStop(1, "#000");      // an alpha map reads the green channel
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new CanvasTexture(c);
  t.needsUpdate = true;
  return t;
}

/**
 * The scenery for a board of N cells, in `scene`. Returns { skin(sk), face(camera, az), dispose(), lanterns }.
 * Willows shrink away as the camera turns toward them (they would stand between the camera and the board).
 */
export function createScenery(scene, N) {
  const root = new THREE.Group();
  scene.add(root);
  const half = N / 2, own = [];
  const M = {
    ground: mat(0xffffff, { transparent: true, depthWrite: false }), trunk: mat(0x4b4237), leaf: mat(0x9db26a), strand: mat(0xa9bd77),
    pillar: mat(0xc8452d), roof: mat(0x3a4048), stoneS: mat(0xb9b4a4), mound: mat(0x8a9a68), paper: mat(0xf1e6c6, { emissive: 0xc8452d, emissiveIntensity: 0 }),
    post: mat(0x4b4237),
    glow: new THREE.MeshBasicMaterial({ color: 0xffb060, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
  };
  const fade = fadeTexture(0.4);
  M.ground.alphaMap = fade; M.ground.map = null;
  own.push(fade, ...Object.values(M));

  // the ground: paper, fading into the backdrop's mist
  const ground = new THREE.Mesh(quad(1, 1), M.ground);
  ground.scale.set(N + 6, 1, N + 6); ground.position.y = -0.145; ground.receiveShadow = true; ground.renderOrder = -2;
  root.add(ground);

  // willows on the banks: a bent trunk, a loose crown, and strands hanging from it
  const willows = [];
  const rand = rng(N * 977 + 5);
  const spots = [[-1, -0.8], [1, -0.9], [-1.05, 0.15], [1.05, 0.35], [-0.5, -1.1], [0.55, 1.08]];
  spots.forEach(([ux, uz], i) => {
    const g = new THREE.Group(), s = 0.85 + rand() * 0.35;
    const px = ux * (half + 0.95), pz = uz * (half + 0.95);
    put(g, cyl, M.trunk, [0, 0.45 * s, 0], [0.12 * s, 0.9 * s, 0.12 * s], [0, 0, 0.12 * (ux > 0 ? 1 : -1)]);
    put(g, ball, M.leaf, [0, 1.0 * s, 0], [0.9 * s, 0.5 * s, 0.9 * s]);
    for (let j = 0; j < 9; j++) {
      const a = (j / 9) * 6.283 + i, r = 0.38 * s, len = (0.45 + rand() * 0.4) * s;
      put(g, box, M.strand, [Math.cos(a) * r, 0.95 * s - len / 2, Math.sin(a) * r], [0.03, len, 0.03], [0, 0, 0], false);
    }
    g.position.set(px, -0.14, pz);
    root.add(g);
    willows.push({ g, dir: [ux, uz], s: 1 });
  });

  // a pavilion on a mound, on the far side of the board as the camera first sees it
  const pav = new THREE.Group(), pr = rng(11);
  put(pav, cone, M.mound, [0, 0.12, 0], [2.6, 0.5, 2.6]);
  put(pav, box, M.stoneS, [0, 0.4, 0], [1.2, 0.12, 1.2]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(pav, cyl, M.pillar, [sx * 0.46, 0.72, sz * 0.46], [0.07, 0.55, 0.07]);
  put(pav, cone4, M.roof, [0, 1.25, 0], [1.7, 0.45, 1.7], [0, Math.PI / 4, 0]);
  put(pav, cone4, M.roof, [0, 1.6, 0], [0.9, 0.3, 0.9], [0, Math.PI / 4, 0]);
  put(pav, cyl, M.pillar, [0, 1.84, 0], [0.04, 0.2, 0.04]);
  void pr;
  pav.position.set(-half * 0.5, -0.14, -half - 1.9);
  root.add(pav);

  // lanterns on posts along the levee, outside the rim: each corner and each fourth cell of the edges
  const lanterns = [], glows = [];
  const at = [];
  for (let i = 0; i <= N; i += Math.max(2, Math.round(N / 3))) { at.push([-half - 0.35 + 0, -half + i], [half + 0.35, -half + i], [-half + i, -half - 0.35], [-half + i, half + 0.35]); }
  const seen = new Set();
  for (const [x, z] of at) {
    const k = x.toFixed(2) + z.toFixed(2);
    if (seen.has(k) || Math.abs(x) > half + 0.4 || Math.abs(z) > half + 0.4) continue;
    seen.add(k);
    const g = new THREE.Group();
    put(g, cyl, M.post, [0, 0.22, 0], [0.05, 0.44, 0.05]);
    put(g, ball, M.paper, [0, 0.5, 0], [0.2, 0.26, 0.2]);
    const halo = put(g, ball, M.glow, [0, 0.5, 0], [0.5, 0.5, 0.5], [0, 0, 0], false);
    halo.renderOrder = 5; glows.push(halo);
    g.position.set(x, -0.14, z);
    root.add(g);
    lanterns.push(g);
  }

  return {
    lanterns: lanterns.length,
    /** Colours and lit lanterns for a skin. */
    skin(sk) {
      M.ground.color.set(sk.paper); M.trunk.color.set(sk.trunk); M.leaf.color.set(sk.willow); M.strand.color.set(sk.willow2);
      M.pillar.color.set(sk.vermilion); M.roof.color.set(sk.roof); M.mound.color.set(sk.mound); M.stoneS.color.set(sk.stone);
      M.paper.emissiveIntensity = sk.night ? 1.4 : 0; M.paper.color.set(sk.night ? 0xf3c98c : 0xf1e6c6);
      M.glow.opacity = sk.night ? 0.09 : 0;
      for (const g of glows) g.visible = !!sk.night;
    },
    /** Willows on the camera's side shrink away; the camera turned at `az` stands toward (sin az, cos az). */
    face(az) {
      const cx = Math.sin(az), cz = Math.cos(az);
      for (const w of willows) {
        const l = Math.hypot(...w.dir), d = (w.dir[0] * cx + w.dir[1] * cz) / l, k = Math.max(0, Math.min(1, 1 - (d - 0.05) / 0.5));
        if (Math.abs(k - w.s) > 0.01) { w.s = k; w.g.scale.setScalar(Math.max(0.001, k)); w.g.visible = k > 0.02; }
      }
    },
    dispose() { scene.remove(root); for (const o of own) o.dispose?.(); },
  };
}
