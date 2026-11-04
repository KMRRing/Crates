// Manifest's harbour in 3D (three.js): the water, the quay's stone and the land behind it with its stepped brick gables, the
// bollards and ropes, a wooden treadwheel crane that lowers the cargo, and a cog moored alongside that takes it away. All of it
// sits where it cannot stand in front of a piece: the camera looks along (-1, -1, -1), so a point is in front of a cell only if
// it is further out in x, y and z (the ray to the camera raises all three), so everything that stands is at x < 0 or z < 0 or
// lower than the quay's floor. Only the jib's swing and the ropes, while the cargo is coming down or going aboard, cross the
// stack; once it holds, the jib points along -z over the land at x < 0. The gables are dimmer than the cargo (they take the
// haze), so nothing competes with it.
// One merged mesh for what stands still, one each for what moves (the crane's jib, its wheel, the cog), a few lines for ropes.
import * as THREE from "./vendor/three.js";

const hex = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// ---------- a merged geometry made of boxes, cylinders and cones, each with a colour, a material number and how much haze it takes ----------
/** Where the land behind the quay begins along z (it runs from here to the quay's near edge). */
const BACK = -3.6;
const MAT = { plain: 0, brick: 1, stone: 2, plank: 3, glass: 4, sail: 5, tile: 6 };
class Builder {
  constructor() { this.pos = []; this.nor = []; this.col = []; this.m = []; this.index = []; }
  /** A primitive geometry moved by position p, euler r (radians, x y z) and scale s. */
  add(geo, { p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] }, color, mat = MAT.plain, far = 0) {
    const g = geo.clone(), M = new THREE.Matrix4().compose(new THREE.Vector3(...p), quat(r), new THREE.Vector3(...s));
    g.applyMatrix4(M);
    const base = this.pos.length / 3, P = g.attributes.position, N = g.attributes.normal, c = typeof color === "number" ? hex(color) : color;
    for (let i = 0; i < P.count; i++) { this.pos.push(P.getX(i), P.getY(i), P.getZ(i)); this.nor.push(N.getX(i), N.getY(i), N.getZ(i)); this.col.push(...c); this.m.push(mat, far); }
    const ix = g.index ? Array.from(g.index.array) : Array.from({ length: P.count }, (_, i) => i);
    for (const i of ix) this.index.push(base + i);
    g.dispose();
    return this;
  }
  box(p, s, color, mat, far, r) { return this.add(BOX, { p, s, r }, color, mat, far); }
  cyl(p, rad, h, color, mat, far, r, seg = 10) { return this.add(seg === 10 ? CYL : new THREE.CylinderGeometry(1, 1, 1, seg), { p, s: [rad, h, rad], r }, color, mat, far); }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("aM", new THREE.Float32BufferAttribute(this.m, 2));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    return g;
  }
}
// a rotation by euler angles x then y then z about the world's axes (the bundle has no Euler)
const AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const quat = r => r.reduce((q, a, i) => (a ? new THREE.Quaternion().setFromAxisAngle(AX[i], a).multiply(q) : q), new THREE.Quaternion());
const BOX = new THREE.BoxGeometry(1, 1, 1), CYL = new THREE.CylinderGeometry(1, 1, 1, 10);

// ---------- the surfaces: brick, stone, planks, glass and sailcloth, worked out in the shader from where on the object a point is ----------
const SCENERY = {
  vertexHead: `attribute vec2 aM; varying vec2 vM; varying vec3 vP; varying vec3 vNo;`,
  vertexBody: `vM = aM; vP = position; vNo = normal;`,
  fragmentHead: `varying vec2 vM; varying vec3 vP; varying vec3 vNo; uniform vec3 uHaze;
float mh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
  color: `
  {
    float m = vM.x; vec3 an = abs(vNo);
    vec2 uv = an.y > .5 ? vP.xz : (an.x > an.z ? vP.zy : vP.xy);
    if (m > .5 && m < 1.5) {                                          // brick in courses, each a little different
      float row = floor(uv.y / .14), off = mod(row, 2.) * .5, cx = uv.x / .36 + off, bx = fract(cx), by = fract(uv.y / .14);
      float mort = min(1., step(bx, .05) + step(by, .1));
      diffuseColor.rgb *= .8 + .4 * mh(vec2(floor(cx), row));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.72, .68, .6) * (.5 + .5 * dot(diffuseColor.rgb, vec3(.33))), mort * .65);
    } else if (m > 1.5 && m < 2.5) {                                  // dressed stone in blocks
      float row = floor(uv.y / .3), cx = uv.x / .62 + mh(vec2(row, 1.)) * 3., bx = fract(cx), by = fract(uv.y / .3);
      float mort = min(1., step(bx, .03) + step(by, .06));
      diffuseColor.rgb *= .84 + .3 * mh(vec2(floor(cx), row));
      diffuseColor.rgb *= 1. - .35 * mort;
    } else if (m > 2.5 && m < 3.5) {                                  // planks
      float pl = floor(uv.x / .2), f = fract(uv.x / .2);
      diffuseColor.rgb *= (.85 + .3 * mh(vec2(pl, 4.))) * (1. - .4 * step(f, .06));
    } else if (m > 3.5 && m < 4.5) {                                  // a window: dark glass with a pale sky in it
      diffuseColor.rgb = mix(vec3(.1, .13, .17), vec3(.45, .55, .62), smoothstep(.2, 1., vP.y * 2. + .5)) * .8;
    } else if (m > 4.5 && m < 5.5) {                                  // sailcloth, in strips
      diffuseColor.rgb *= .92 + .08 * sin(uv.x * 34.);
    } else if (m > 5.5) {                                             // roof tiles
      float row = floor(vP.y * 9.);
      diffuseColor.rgb *= .85 + .25 * mh(vec2(floor(vP.x * 5. + row), row));
    }
    diffuseColor.rgb = mix(diffuseColor.rgb, uHaze, vM.y);
  }`,
};
const WATER = {
  vertexHead: `varying vec3 vW;`,
  vertexBody: `vW = (modelMatrix * vec4(position, 1.)).xyz;`,
  fragmentHead: `varying vec3 vW; uniform vec3 uDeep; uniform vec3 uSea; uniform vec3 uGleam; uniform float uTime; uniform vec2 uQ0; uniform vec2 uQ1; uniform vec2 uL0; uniform vec2 uL1;
float wh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float wn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }
float rect(vec2 p, vec2 a, vec2 b) { vec2 c = (a + b) * .5, h = (b - a) * .5, d = abs(p - c) - h; return length(max(d, 0.)) + min(max(d.x, d.y), 0.); }`,
  color: `
  {
    vec2 p = vW.xz;
    float t = uTime * .00055;
    float a = wn(p * 1.6 + vec2(t * 3., t * 2.)), b = wn(p * 3.1 - vec2(t * 2.4, -t * 3.));
    float swell = a * .6 + b * .4;
    vec3 col = mix(uDeep, uSea, smoothstep(.25, .75, swell));
    float streak = smoothstep(.78, .95, wn(vec2(p.x * 1.4 + t * 4., p.y * 3.2 - t * 2.)));  // wind-ruffled glints
    col = mix(col, uGleam, streak * .22);
    float dq = min(rect(p, uQ0, uQ1), rect(p, uL0, uL1));                    // the quay's shadow and the lapping at its foot
    col *= mix(.55, 1., smoothstep(0., 1.3, dq));
    float lap = smoothstep(.14, 0., abs(dq - .12 - .05 * sin(uTime * .0021 + p.x * 2. + p.y * 3.)));
    col = mix(col, uGleam, lap * .5);
    diffuseColor.rgb = col;
  }`,
};

function inject(shader, S, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>\n${S.vertexHead}`).replace("#include <begin_vertex>", `#include <begin_vertex>\n${S.vertexBody}`);
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${S.fragmentHead}`).replace("#include <color_fragment>", `#include <color_fragment>\n${S.color}`);
}

// ---------- the colours ----------
const BRICKS = [0xA4553F, 0x8E4B38, 0xB8664A, 0x9A5A45, 0xC07A55];
const STONE = 0xA9A396, STONE_DARK = 0x7D786D, TIMBER = 0x8A6A42, TIMBER_DARK = 0x5E4528, IRON = 0x2B2B2E, TILE = 0x6B3B2F, SLATE = 0x4A4E57, CREAM = 0xE9DDBB, HULL = 0x5A3F27, HULL_LIGHT = 0x7A5634, RIM = 0x3A2818;

// ---------- the pieces of it ----------
/** A row of stepped gables standing on `y0`, the row along the world axis `along` (x or z), the gables facing `face` (+1 toward the camera's side, -1 away), starting at `from`. */
function gables(B, { along, at, from, to, y0, far, seed, scale = 1 }) {
  let u = from, i = 0;
  while (u < to - 0.4) {
    const w = (1.35 + hash(seed + i) * 0.7) * scale, h = (2 + hash(seed + i * 3.1) * 1.5) * scale, depth = 1.5 * scale, steps = 4, step = 0.3 * scale;
    const brick = BRICKS[Math.floor(hash(seed + i * 7.7) * BRICKS.length)], uw = Math.min(w, to - u);
    const cu = u + uw / 2, P = (a, y, d) => (along === "z" ? [at + d, y, a] : [a, y, at + d]);
    const S = (a, y, d) => (along === "z" ? [d, y, a] : [a, y, d]);
    B.box(P(cu, y0 + h / 2, depth / 2), S(uw * 0.96, h, depth), brick, MAT.brick, far);            // the body
    for (let k = 0; k < steps; k++) {                                                               // the crow-step gable, narrowing by a step on each side
      const sw = uw * 0.96 - 2 * step * (k + 1) * 1.2, sh = 0.34 * scale;
      if (sw <= 0.15) break;
      B.box(P(cu, y0 + h + sh * (k + 0.5), depth * 0.5), S(sw, sh, depth), brick, MAT.brick, far);
    }
    B.box(P(cu, y0 + h + 0.05, depth * 0.5), S(uw * 0.99, 0.1, depth * 1.03), STONE_DARK, MAT.stone, far);   // the string course under the steps
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {                                       // windows, on the face toward the camera's side
      const wa = cu + (c - 0.5) * uw * 0.45, wy = y0 + 0.5 * scale + r * h * 0.3;
      B.box(P(wa, wy, depth + 0.012), S(0.2 * scale, 0.34 * scale, 0.04), 0x20262c, MAT.glass, far * 0.8);
      B.box(P(wa, wy, depth + 0.02), S(0.26 * scale, 0.05, 0.02), STONE, MAT.stone, far);
    }
    u += uw + 0.12 * scale; i++;
  }
}
const bollard = (B, p, tall = 0.34) => { B.cyl([p[0], p[1] + tall / 2, p[2]], 0.1, tall, IRON, 0, 0, undefined, 10); B.cyl([p[0], p[1] + tall + 0.03, p[2]], 0.155, 0.07, IRON, 0, 0, undefined, 10); };

/** Everything that stands still, for a stack of sx by sz cells and sy high. */
function statics(sx, sz, sy, depth) {
  const B = new Builder(), landX = -3.8, wall = 0.14;
  // the quay's coping and the land it joins: dressed stone, its edge a hand's breadth proud of the cargo's floor
  B.box([sx / 2, 0.025, -wall / 2], [sx + 2 * wall, 0.05, wall], STONE, MAT.stone);   // behind the cargo; the near edges are flush with the floor, so no cargo is hidden by them
  B.box([sx + wall / 2, 0.006, sz / 2], [wall, 0.012, sz + 2 * wall], STONE, MAT.stone);
  B.box([sx / 2, 0.006, sz + wall / 2], [sx + 2 * wall, 0.012, wall], STONE, MAT.stone);
  const z0 = BACK, zc = (z0 + sz + wall) / 2, zl = sz + wall - z0;                                  // the land runs back past the quay's far edge
  B.box([(landX - wall) / 2, -depth / 2 - 0.005, zc], [-wall - landX, depth - 0.01, zl + 0.02], STONE_DARK, MAT.stone);
  B.box([(landX - wall) / 2, -0.012, zc], [-wall - landX, 0.02, zl], STONE, MAT.stone);
  for (const z of [0.55, sz - 0.55]) bollard(B, [-0.5, 0, z]);
  for (const x of [sx * 0.22, sx * 0.78]) bollard(B, [x, 0.05, -wall / 2]);
  // the town: a row of stepped gables on the land at the back, another across the water, dimmer still
  gables(B, { along: "z", at: landX + 0.1, from: z0 + 0.2, to: sz + wall, y0: 0, far: 0.42, seed: 3 });
  gables(B, { along: "x", at: -9.5, from: -2, to: sx + 5, y0: -0.2, far: 0.62, seed: 11, scale: 1.25 });
  // stacks of barrels and sacks are cargo, not scenery: only a coil of rope and a mooring post on the land
  B.cyl([-1.5, 0.06, sz + 0.5], 0.28, 0.12, TIMBER, MAT.plank, 0.1);
  return B.build();
}

/** The crane: a timber tower tapering up (posts, braces, a tiled hood) and the jib, a beam out of the hood with its block, that swings; the wheel is its own mesh (it turns). */
function crane(sx, sz, sy) {
  const T = new Builder(), J = new Builder(), W = new Builder();
  const base = [-1.0, 0, sz * 0.42], H = sy + 1.15, w0 = 1.1, w1 = 0.62;
  const post = (sxn, szn) => {
    const bx = base[0] + sxn * w0 / 2, bz = base[2] + szn * w0 / 2, tx = base[0] + sxn * w1 / 2, tz = base[2] + szn * w1 / 2;
    const dx = tx - bx, dz = tz - bz, len = Math.hypot(dx, H, dz);
    T.box([(bx + tx) / 2, H / 2, (bz + tz) / 2], [0.1, len, 0.1], TIMBER_DARK, MAT.plank, 0.05, [Math.atan2(dz, H), 0, -Math.atan2(dx, H)]);
  };
  for (const a of [-1, 1]) for (const c of [-1, 1]) post(a, c);
  for (let k = 1; k <= 4; k++) {                                                                   // cross frames and diagonal braces
    const y = H * k / 5, w = w0 + (w1 - w0) * (y / H);
    for (const [dx, dz, sx2, sz2] of [[w / 2, 0, 0.06, w], [-w / 2, 0, 0.06, w], [0, w / 2, w, 0.06], [0, -w / 2, w, 0.06]]) T.box([base[0] + dx, y, base[2] + dz], [sx2, 0.06, sz2], TIMBER, MAT.plank, 0.05);
  }
  T.box([base[0], H + 0.05, base[2]], [w1 + 0.4, 0.12, w1 + 0.4], TIMBER_DARK, MAT.plank, 0.05);
  // the jib (turns about the tower's axis): beam, tail with its counterweight, the hood and the block at its tip
  const reach = base[0] * -1 + sx / 2;
  J.box([reach / 2 - 0.4, H + 0.35, 0], [reach + 0.8, 0.16, 0.2], TIMBER, MAT.plank, 0.05);
  J.box([-0.8, H + 0.3, 0], [1.2, 0.14, 0.18], TIMBER, MAT.plank, 0.05);
  J.box([-1.4, H + 0.15, 0], [0.4, 0.4, 0.4], STONE_DARK, MAT.stone, 0.05);
  J.add(new THREE.ConeGeometry(1, 1, 4), { p: [0, H + 0.82, 0], r: [0, Math.PI / 4, 0], s: [0.62, 0.9, 0.62] }, TILE, MAT.tile, 0.05);
  J.box([0, H + 0.48, 0], [0.62, 0.3, 0.62], TIMBER_DARK, MAT.plank, 0.05);
  J.box([reach - 0.05, H + 0.15, 0], [0.12, 0.34, 0.12], IRON, 0, 0);
  // the treadwheel: a drum of slats between two rims on the tower's side, big enough for two men to walk in
  const R = 0.95, spokes = 8;
  W.cyl([0, 0, -0.38], R, 0.06, TIMBER_DARK, MAT.plank, 0.05, [Math.PI / 2, 0, 0], 16);
  W.cyl([0, 0, 0.38], R, 0.06, TIMBER_DARK, MAT.plank, 0.05, [Math.PI / 2, 0, 0], 16);
  for (let k = 0; k < spokes * 2; k++) { const a = k / (spokes * 2) * Math.PI * 2; W.box([Math.cos(a) * R, Math.sin(a) * R, 0], [0.1, 0.1, 0.8], TIMBER, MAT.plank, 0.05, [0, 0, a]); }
  for (let k = 0; k < 4; k++) W.box([0, 0, 0], [R * 2, 0.07, 0.05], TIMBER_DARK, 0, 0.05, [0, 0, k * Math.PI / 4]);
  return { tower: T.build(), jib: J.build(), wheel: W.build(), base, H, reach, wheelAt: [base[0], H * 0.5, base[2] + w0 / 2 + 0.5], tip: [reach, H + 0.15, 0] };
}

/** The cog: a clinker hull with a stem and a sternpost, a castle at each end, a mast with its yard and a sail (furled until it leaves). */
function cog(len) {
  const hull = new Builder(), sail = new Builder(), N = 14, top = 0.12, keel = -0.85, half = 0.8;
  const pos = [], idx = [];
  // the half-breadth along the hull, t 0 at the stern to 1 at the bow: full amidships, drawn in toward both ends, finer at the bow
  const section = t => half * (0.35 + 0.65 * Math.sqrt(Math.min(1, Math.min(t, 1 - t) * 3.2)) * (t > 0.5 ? 1 - (t - 0.5) * 0.7 : 1));
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = (t - 0.5) * len, w = section(t), lift = Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.25;
    const ring = [[-w, top + lift], [-w * 0.93, -0.25], [-w * 0.55, keel + 0.18], [0, keel], [w * 0.55, keel + 0.18], [w * 0.93, -0.25], [w, top + lift]];
    for (const [z, y] of ring) pos.push(x, y, z);
  }
  const n = 7;
  for (let i = 0; i < N; i++) for (let j = 0; j < n - 1; j++) {
    const a = i * n + j, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(), colour = new Float32Array(pos.length), mm = new Float32Array(pos.length / 3 * 2);
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  for (let i = 0; i < pos.length / 3; i++) { const j = i % n, c = hex(j === 0 || j === n - 1 ? RIM : (j % 2 ? HULL : HULL_LIGHT)); colour.set(c, i * 3); mm[i * 2] = MAT.plank; mm[i * 2 + 1] = 0.05; }
  g.setAttribute("color", new THREE.Float32BufferAttribute(colour, 3));
  g.setAttribute("aM", new THREE.Float32BufferAttribute(mm, 2));
  // deck, castles, posts, mast
  const deck = new Builder();
  deck.box([0, top - 0.02, 0], [len * 0.84, 0.05, half * 1.55], TIMBER, MAT.plank, 0.05);
  deck.box([-len * 0.4, top + 0.32, 0], [len * 0.2, 0.62, half * 1.35], HULL_LIGHT, MAT.plank, 0.05);                 // the stern castle
  deck.box([len * 0.41, top + 0.24, 0], [len * 0.12, 0.46, half * 1.1], HULL_LIGHT, MAT.plank, 0.05);                 // the fore castle
  deck.box([-len * 0.49, top + 0.55, 0], [0.09, 1.2, 0.12], HULL, MAT.plank, 0.05, [0, 0, 0.18]);                      // sternpost
  deck.box([len * 0.5, top + 0.5, 0], [0.09, 1.1, 0.12], HULL, MAT.plank, 0.05, [0, 0, -0.5]);                         // stem
  deck.cyl([0, top + 1.7, 0], 0.07, 3.4, TIMBER_DARK, MAT.plank, 0.05);
  deck.box([0.05, top + 3.05, 0], [0.06, 0.06, 1.9], TIMBER_DARK, 0, 0.05);
  deck.box([0.05, top + 3.5, 0], [0.3, 0.2, 0.04], 0xB0402F, 0, 0.05);                                                  // a pennant
  deck.box([-0.5, top + 0.12, 0.3], [0.5, 0.2, 0.4], TIMBER_DARK, MAT.plank, 0.05);
  // the sail, hung from the yard: its own mesh so it can be let down (scaled from its top)
  sail.box([0.05, -0.8, 0], [0.04, 1.6, 1.8], CREAM, MAT.sail, 0.05);
  return { hull: g, deck: deck.build(), sail: sail.build(), top, sailAt: [0.05, top + 3.0, 0] };
}

/** Where the cog's deck is for a stack sx cells long: the point the cargo is carried to. */
export const deckAt = sx => [sx * 0.55, 0.3, -1.4];

/** Rope, as a catenary-ish polyline between two points, written into line-segment positions. */
const rope = (out, a, b, sag = 0.18, n = 8) => {
  for (let i = 0; i < n; i++) {
    const t0 = i / n, t1 = (i + 1) / n, q = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * sag, a[2] + (b[2] - a[2]) * t];
    out.push(...q(t0), ...q(t1));
  }
};

/**
 * The harbour's meshes in `scene`. `place(sx, sz, sy, depth, tk)` builds them for a stack's size (kept while it's the same);
 * `pose(...)` sets what moves; `visible(on)` shows or hides the lot (a picture that isn't a scene hides it).
 */
export function createHarbour(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const U = { uHaze: { value: new THREE.Color() } };
  const sceneryMat = () => {
    const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, vertexColors: true, side: 2 });   // 2: both faces, a hull is built from one side
    m.customProgramCacheKey = () => "manifest-scenery";
    m.onBeforeCompile = shader => inject(shader, SCENERY, U);
    return m;
  };
  const mat = sceneryMat();
  const WU = { uDeep: { value: new THREE.Color() }, uSea: { value: new THREE.Color() }, uGleam: { value: new THREE.Color() }, uTime: { value: 0 }, uQ0: { value: new THREE.Vector2() }, uQ1: { value: new THREE.Vector2() }, uL0: { value: new THREE.Vector2() }, uL1: { value: new THREE.Vector2() } };
  const waterMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.05 });
  waterMat.customProgramCacheKey = () => "manifest-water";
  waterMat.onBeforeCompile = shader => inject(shader, WATER, WU);
  const water = new THREE.Mesh(BOX, waterMat);
  water.receiveShadow = false;
  group.add(water);
  const mesh = () => { const m = new THREE.Mesh(BOX, mat); m.frustumCulled = false; group.add(m); return m; };
  const fixed = mesh(), tower = mesh(), jib = mesh(), wheel = mesh(), hull = mesh(), deck = mesh(), sail = mesh();
  const ropeLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x3a2a18 }));
  ropeLines.frustumCulled = false;
  group.add(ropeLines);
  const sling = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x2c2014 }));
  sling.frustumCulled = false;
  group.add(sling);
  const ship = new THREE.Group();
  ship.add(hull, deck, sail);
  group.add(ship);
  let key = "", C = null, S = null, slingBuf = null, mooredNow = null;

  const api = {
    group,
    /** Builds the harbour round a stack of sx by sz cells and sy high: the hull's depth is the quay's. */
    place(sx, sz, sy, depth) {
      const k = [sx, sz, sy, depth].join();
      if (k === key) return;
      key = k;
      mooredNow = null;
      if (fixed.geometry !== BOX) fixed.geometry.dispose();
      fixed.geometry = statics(sx, sz, sy, depth);
      C = crane(sx, sz, sy);
      for (const [m, g] of [[tower, C.tower], [jib, C.jib], [wheel, C.wheel]]) { if (m.geometry !== BOX) m.geometry.dispose(); m.geometry = g; }
      S = cog(Math.min(7, Math.max(4.4, sx * 0.9 + 1.2)));
      for (const [m, g] of [[hull, S.hull], [deck, S.deck], [sail, S.sail]]) { if (m.geometry !== BOX) m.geometry.dispose(); m.geometry = g; }
      jib.position.set(C.base[0], 0, C.base[2]);
      wheel.position.set(...C.wheelAt);
      water.scale.set(600, 0.02, 600);
      water.position.set(sx / 2, -depth * 0.7, sz / 2);
      WU.uQ0.value.set(0, 0); WU.uQ1.value.set(sx, sz);
      WU.uL0.value.set(-3.8, BACK); WU.uL1.value.set(0, sz);
      // the mooring lines: from the far bollards to the cog's bitts (set in pose, by where the cog is)
      api.dims = { sx, sz, sy, depth };
      slingBuf = new Float32Array(2 * 3 * 600);
      sling.geometry.dispose();
      sling.geometry = new THREE.BufferGeometry();
      sling.geometry.setAttribute("position", new THREE.Float32BufferAttribute(slingBuf, 3));
      sling.geometry.setDrawRange(0, 0);
    },
    /**
     * What moves. `time`: ms (the water). `swing` 0 to 1: the jib over the stack (0) to turned away (1). `hang`: the world points the ropes
     * hang from the jib's tip to (the pieces in the air), or null. `shipAt` 0 to 1: the cog at its mooring (0) to gone (1). `sailed` 0 to 1: the sail let down.
     */
    pose({ time = 0, swing = 0, hang = null, shipAt = 0, sailed = 0, wheelTurn = 0 }, tk) {
      const { sx, sz } = api.dims;
      WU.uTime.value = time;
      WU.uDeep.value.set(`rgb(${tk.deep})`); WU.uSea.value.set(`rgb(${tk.sea})`); WU.uGleam.value.set(`rgb(${tk.haze})`);
      U.uHaze.value.set(`rgb(${tk.haze})`);
      // the jib points at the stack's middle when over it, and swings back by a good right angle (and a bit more) when away
      const toX = sx / 2 - C.base[0], toZ = sz / 2 - C.base[2], aim = Math.atan2(-toZ, toX);       // three's rotation about y turns +x toward -z
      jib.rotation.y = aim + swing * (Math.PI / 2 - aim);
      wheel.rotation.z = wheelTurn;
      ship.position.set(deckAt(sx)[0] + shipAt * 7.5, 0, deckAt(sx)[2] - shipAt * 0.4);
      ship.rotation.y = -shipAt * 0.12;
      ship.rotation.z = Math.sin(time / 900) * 0.012;
      ship.position.y = Math.sin(time / 1100) * 0.025 - 0.04 * shipAt;
      sail.position.set(...S.sailAt);
      sail.scale.set(1, 0.12 + 0.88 * sailed, 1);
      sail.position.y = S.sailAt[1] - 0.0;
      // the hook: the jib's tip in the world
      const a = jib.rotation.y, tip = [C.base[0] + Math.cos(a) * C.tip[0], C.tip[1], C.base[2] - Math.sin(a) * C.tip[0]];
      api.tip = tip;
      const out = [];
      if (hang) for (const [x, y, z] of hang) out.push(tip[0], tip[1] - 0.15, tip[2], x, y, z);
      sling.geometry.attributes.position.array.set(out.slice(0, slingBuf.length));
      sling.geometry.setDrawRange(0, Math.min(out.length, slingBuf.length) / 3);
      sling.geometry.attributes.position.needsUpdate = true;
      // the mooring lines
      const moored = shipAt < 0.02;
      if (moored !== mooredNow) {                                                  // the lines hold while the cog lies there; built when that changes
        mooredNow = moored;
        const lines = [], bits = [ship.position.x - 0.9, S.top + 0.12, deckAt(sx)[2] + 0.3], bits2 = [ship.position.x + 0.9, bits[1], bits[2]];
        if (moored) { rope(lines, [sx * 0.22, 0.4, -0.07], bits, 0.12, 6); rope(lines, [sx * 0.78, 0.4, -0.07], bits2, 0.12, 6); }
        ropeLines.geometry.dispose();
        ropeLines.geometry = new THREE.BufferGeometry();
        ropeLines.geometry.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3));
        ropeLines.visible = lines.length > 0;
      }
    },
    visible(on) { group.visible = on; },
  };
  return api;
}
