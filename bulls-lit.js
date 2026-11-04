// Conjunction's bodies, lit: each of the eight is shaded pixel by pixel as a real sphere (its surface a procedural map on the
// sphere, one key light from the upper left, a specular glint, a soft night side, a gilt rim light from behind), and the
// rings are planes that cast a shadow on the globe and take one from it. Pure maths: the pixels come back as RGBA, so Node
// tests them; `bakeBodies` (browser only) turns them into pictures the pegs use as backgrounds, once per page load (~8
// small canvases, no WebGL: nothing to lose a context, nothing to redraw, and the same on every phone). If a canvas is
// missing the pegs keep bulls-bodies.js's flat drawings.
import { BODIES } from "./bulls-bodies.js";

const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** The key light (toward the light, screen space: x right, y down, z at the viewer): upper left, a little in front. */
export const LIGHT = norm([-0.56, -0.62, 0.55]);
const RIM = norm([0.78, 0.5, -0.25]);                 // the gilt rim light, from behind and below right
const HALF = norm([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);
const WARM = [1, 0.96, 0.88], NIGHT = [0.05, 0.07, 0.15], GILT = [1, 0.8, 0.42];

// value noise in 3D: smooth, seeded by integers only, so every device paints the same planet
const hash = (x, y, z) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t, H = (i, j, k) => hash(ix + i, iy + j, iz + k);
  return L(L(L(H(0, 0, 0), H(1, 0, 0), u), L(H(0, 1, 0), H(1, 1, 0), u), v), L(L(H(0, 0, 1), H(1, 0, 1), u), L(H(0, 1, 1), H(1, 1, 1), u), v), w);
}
const fbm = (p, f, o = 3) => { let s = 0, a = 0.5, n = 0; for (let i = 0; i < o; i++) { s += a * noise(p[0] * f + i * 7.3, p[1] * f - i * 3.1, p[2] * f + i * 5.7); n += a; a /= 2; f *= 2.03; } return s / n; };

// craters of the Moon: a centre, an angular radius
const CRATERS = [[-0.35, -0.3, 0.88, 0.3], [0.5, -0.45, 0.74, 0.17], [0.28, 0.4, 0.87, 0.34], [-0.62, 0.35, 0.7, 0.2], [0.12, -0.78, 0.62, 0.15], [0.78, 0.15, 0.6, 0.18], [-0.1, 0.1, 0.99, 0.09], [-0.75, -0.2, 0.62, 0.12], [0.45, 0.75, 0.48, 0.14]]
  .map(([x, y, z, r]) => [...norm([x, y, z]), r]);

// Each body: the sphere's radius (a fraction of the picture's half width: a ringed or rayed one is smaller, so it reads by its
// shape), its look, and a ring if it has one { tilt from face-on, major axis angle, inner and outer radius in planet radii }.
export const SPECS = [
  { S: 0.88, ks: 0.18, sh: 18, atmo: [0.95, 0.5, 0.32, 0.5] },                                                                   // 0 Mars
  { S: 0.56, sun: true },                                                                                                          // 1 Sun
  { S: 0.64, ks: 0.3, sh: 26, atmo: [0.5, 0.95, 0.95, 0.8], ring: { tilt: 1.3, rot: -1.36, r1: 1.34, r2: 1.66 } },            // 2 Uranus
  { S: 0.88, ks: 0.6, sh: 44, atmo: [0.35, 0.62, 1, 1] },                                                                         // 3 Earth
  { S: 0.88, ks: 0.04, sh: 8, atmo: null },                                                                                        // 4 Moon
  { S: 0.88, ks: 0.5, sh: 30, atmo: null, gilt: true },                                                                           // 5 Mercury
  { S: 0.5, ks: 0.25, sh: 22, atmo: [0.8, 0.6, 0.95, 0.4], ring: { tilt: 1.12, rot: -0.35, r1: 1.28, r2: 1.9 } },              // 6 Saturn
  { S: 0.88, ks: 0.2, sh: 18, atmo: [0.95, 0.7, 0.45, 0.35] },                                                                    // 7 Jupiter
];

/** The surface of body i at the point p of the unit sphere (turned by `rot` about its axis): [albedo r,g,b, shininess scale, cloud]. */
function surface(i, p) {
  switch (i) {
    case 0: {                                                    // Mars: rust, dark plains, a white cap
      const n = fbm(p, 2.4), m = fbm(p, 4.5, 2);
      let c = mixc([0.74, 0.34, 0.2], [0.52, 0.22, 0.14], smooth(0.4, 0.65, n));
      c = mixc(c, [0.3, 0.14, 0.11], smooth(0.52, 0.64, fbm([p[0] + 3, p[1], p[2]], 1.7, 3)) * 0.85);
      c = mixc(c, [0.92, 0.55, 0.38], smooth(0.55, 0.8, m) * 0.25);
      const cap = smooth(-0.78 - m * 0.1, -0.9 - m * 0.1, p[1]);
      return [...mixc(c, [0.98, 0.96, 0.92], cap), 1];
    }
    case 2: {                                                    // Uranus: a pale, glassy cyan with faint belts
      const b = 0.5 + 0.5 * Math.sin(p[1] * 9 + fbm(p, 2, 2) * 2);
      return [...mixc([0.5, 0.82, 0.84], [0.62, 0.9, 0.9], b * 0.7), 1];
    }
    case 3: {                                                    // Earth: ocean, land, ice, cloud
      const land = fbm(p, 1.7, 4), sea = smooth(0.5, 0.52, land);
      let c = mixc([0.04, 0.2, 0.52], [0.07, 0.3, 0.62], fbm(p, 6, 2));
      const lc = mixc([0.2, 0.5, 0.24], [0.62, 0.52, 0.3], smooth(0.55, 0.72, fbm(p, 5, 2)));
      c = mixc(c, lc, sea);
      c = mixc(c, [0.95, 0.97, 1], smooth(0.84, 0.94, Math.abs(p[1]) + (fbm(p, 5, 2) - 0.5) * 0.1));
      const cloud = smooth(0.54, 0.66, fbm([p[0] + 9, p[1] * 1.4, p[2] - 4], 2.6, 4)) * 0.85;
      return [...mixc(c, [1, 1, 1], cloud), 1 - sea * 0.85 - cloud * 0.8, cloud];
    }
    case 4: {                                                    // Moon: grey regolith and craters
      const n = fbm(p, 3, 3);
      let c = mixc([0.62, 0.6, 0.55], [0.82, 0.8, 0.74], n);
      c = mixc(c, [0.42, 0.42, 0.42], smooth(0.5, 0.66, fbm([p[0] - 5, p[1], p[2]], 1.5, 2)) * 0.55);
      for (const k of CRATERS) {
        const t = Math.acos(clamp(dot(p, k))) / k[3];
        if (t < 1) c = mixc(c, [0.36, 0.35, 0.33], (1 - t * t) * 0.6);
        else if (t < 1.22) c = mixc(c, [0.93, 0.92, 0.86], (1 - (t - 1) / 0.22) * 0.45);
      }
      return [...c, 1];
    }
    case 5: {                                                    // Mercury: slate, a basin of rings
      const n = fbm(p, 3.2, 3);
      let c = mixc([0.2, 0.24, 0.28], [0.36, 0.4, 0.44], n);
      const b = norm([0.35, 0.05, 0.93]), t = Math.acos(clamp(dot(p, b)));
      for (const r of [0.3, 0.17]) c = mixc(c, [0.68, 0.76, 0.82], smooth(0.025, 0, Math.abs(t - r)) * 0.8);
      c = mixc(c, [0.1, 0.12, 0.15], smooth(0.3, 0.17, t) * 0.5);
      for (const k of [[-0.62, 0.3, 0.72, 0.11], [0.1, -0.5, 0.86, 0.09], [-0.2, 0.62, 0.76, 0.08]]) {
        const tt = Math.acos(clamp(dot(p, norm(k)))) / k[3];
        if (tt < 1) c = mixc(c, [0.08, 0.1, 0.13], (1 - tt * tt) * 0.7);
      }
      return [...c, 1];
    }
    case 6: {                                                    // Saturn: soft lilac and gold belts
      const b = 0.5 + 0.5 * Math.sin(p[1] * 13 + fbm(p, 2.5, 2) * 2.4);
      return [...mixc([0.62, 0.42, 0.74], [0.9, 0.74, 0.86], b * 0.8), 1];
    }
    case 7: {                                                    // Jupiter: belts and the great red spot
      const warp = fbm(p, 3, 3) * 0.7, s = Math.sin(p[1] * 11 + warp * 4), s2 = Math.sin(p[1] * 27 + warp * 6);
      let c = mixc([0.95, 0.8, 0.58], [0.62, 0.32, 0.16], smooth(-0.3, 0.45, s));
      c = mixc(c, [0.98, 0.9, 0.75], smooth(0.2, 1, s2) * 0.35);
      const lon = Math.atan2(p[0], p[2]), lat = Math.asin(clamp(p[1]));
      const dl = (lon - 0.5) / 0.4, da = (lat - 0.3) / 0.17, q = dl * dl + da * da;
      c = mixc(c, [0.62, 0.17, 0.1], smooth(1, 0.35, q) * 0.95);
      c = mixc(c, [0.95, 0.75, 0.55], smooth(1.9, 1.1, q) * smooth(0.9, 1.1, q) * 0.5);
      return [...c, 1];
    }
  }
  return [0.8, 0.8, 0.8, 1];
}

/** The ring's colour and opacity at ρ planet radii from the centre: [r,g,b,a]. */
function ringAt(i, rho, r1, r2, p) {
  const t = (rho - r1) / (r2 - r1);
  if (i === 2) return [0.82, 0.96, 0.96, 0.9];
  const gap = smooth(0.43, 0.46, t) * smooth(0.55, 0.52, t);   // the Cassini division
  const dens = (0.45 + 0.55 * noise(t * 38, 0, 3)) * (1 - gap * 0.92) * smooth(0, 0.04, t) * smooth(1, 0.94, t);
  const col = mixc([0.72, 0.56, 0.34], [0.96, 0.85, 0.6], noise(t * 17, 5, 1));
  return [...col, clamp(dens * (t < 0.32 ? 0.55 : 1) * 1.15)];
}

/** Body i drawn into an n by n RGBA picture, its surface turned `rot` radians about its axis. */
export function renderBody(i, n, rot = 0.5) {
  const sp = SPECS[i], S = sp.S, px = new Uint8ClampedArray(n * n * 4), cr = Math.cos(rot), sr = Math.sin(rot);
  let nr = null, e1, ew;
  if (sp.ring) {                                                 // the ring's plane: its major axis e1 in the picture, tilted by `tilt` from face-on
    const { tilt, rot: phi } = sp.ring, c = Math.cos(phi), s = Math.sin(phi);
    e1 = [c, s, 0]; const e2 = [-s, c, 0];
    ew = [e2[0] * Math.cos(tilt), e2[1] * Math.cos(tilt), Math.sin(tilt)];
    nr = [e1[1] * ew[2] - e1[2] * ew[1], e1[2] * ew[0] - e1[0] * ew[2], e1[0] * ew[1] - e1[1] * ew[0]];
    if (nr[2] < 0) nr = nr.map(x => -x);
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const u = ((x + 0.5) / n) * 2 - 1, v = ((y + 0.5) / n) * 2 - 1;
    const d = Math.hypot(u, v) / S, inside = d <= 1;
    let col = [0, 0, 0], a = 0;
    // the sphere
    const edge = clamp((1 - d) * S * n * 0.5 + 0.5);
    if (edge > 0 && !sp.sun) {
      const nx = u / S / Math.max(d, 1), ny = v / S / Math.max(d, 1), nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), N = [nx, ny, nz];
      const p = [N[0] * cr + N[2] * sr, N[1], -N[0] * sr + N[2] * cr];
      const [ar, ag, ab, sk, cloud] = surface(i, p);
      let lam = dot(N, LIGHT);
      // a ring across the light shades the globe
      if (nr) {
        const ql = [N[0] * S, N[1] * S, nz * S], den = dot(nr, LIGHT);
        if (Math.abs(den) > 1e-3) {
          const s = -dot(nr, ql) / den;
          if (s > 0) { const q = [ql[0] + s * LIGHT[0], ql[1] + s * LIGHT[1], ql[2] + s * LIGHT[2]], rho = Math.hypot(...q) / S;
            if (rho > sp.ring.r1 && rho < sp.ring.r2) lam -= ringAt(i, rho, sp.ring.r1, sp.ring.r2)[3] * 0.85 * clamp(lam * 4 + 0.5); }
        }
      }
      const diff = Math.pow(smooth(-0.14, 1, lam), 0.9), light = clamp(diff);
      let c = [ar * (NIGHT[0] + diff * WARM[0]), ag * (NIGHT[1] + diff * WARM[1]), ab * (NIGHT[2] + diff * WARM[2])];
      const spec = Math.pow(Math.max(0, dot(N, HALF)), sp.sh) * sp.ks * (sk ?? 1) * light;
      c = [c[0] + spec, c[1] + spec * 0.98, c[2] + spec * 0.94];
      const fres = Math.pow(1 - nz, 2.6);
      if (sp.atmo) { const k = fres * sp.atmo[3] * (0.25 + 0.75 * clamp(lam + 0.35)); c = [c[0] + sp.atmo[0] * k, c[1] + sp.atmo[1] * k, c[2] + sp.atmo[2] * k]; }
      const rim = Math.pow(1 - nz, 3) * clamp(dot(N, RIM) + 0.45) * (sp.gilt ? 2.4 : 1.05) + (sp.gilt ? Math.pow(1 - nz, 5) * 1.2 : 0);
      c = [c[0] + GILT[0] * rim, c[1] + GILT[1] * rim, c[2] + GILT[2] * rim];
      col = c; a = edge;
    }
    if (sp.sun) {
      const dd = Math.hypot(u, v), ang = Math.atan2(v, u);
      if (inside) {
        const nz = Math.sqrt(Math.max(0, 1 - d * d)), p = [u / S * cr + nz * sr, v / S, -u / S * sr + nz * cr];
        const gran = fbm(p, 6, 3), limb = 0.55 + 0.45 * Math.pow(nz, 0.6), core = Math.pow(nz, 3);
        let c = mixc([1, 0.62, 0.14], [1, 0.86, 0.34], gran * 0.8 + 0.2);
        c = mixc(c, [1, 0.97, 0.78], core * 0.65);
        c = [c[0] * limb * 1.08, c[1] * limb * 1.04, c[2] * limb];
        const hl = Math.pow(Math.max(0, dot([u / S, v / S, nz], HALF)), 24) * 0.35;
        col = [c[0] + hl, c[1] + hl, c[2] + hl]; a = edge;
      }
      // the corona and sixteen rays, long and short, drawn over the dark: a gilt glow that fades out
      const o = dd - S, glow = o > -0.02 ? Math.exp(-Math.max(0, o) * 7.5) * 0.62 : 0;
      const long = Math.pow(Math.abs(Math.cos(ang * 4)), 46), short = Math.pow(Math.abs(Math.sin(ang * 4)), 54) * 0.62;
      const reach = (dd > S * 0.9) ? Math.max(long * smooth(S + 0.42, S + 0.02, dd), short * smooth(S + 0.27, S + 0.02, dd)) : 0;
      const ga = clamp(glow + reach * 0.95) * smooth(1, 0.78, dd);
      if (ga > 0) {
        const gc = [1, 0.74 + reach * 0.1, 0.26 + reach * 0.1];
        if (a >= 1) { /* the disc is opaque */ } else { col = a > 0 ? mixc(gc, col, a) : gc; a = Math.max(a, ga); }
      }
    }
    // the ring, in front of the globe or past it
    if (nr) {
      const z = -(nr[0] * u + nr[1] * v) / nr[2], rho = Math.hypot(u, v, z) / S;
      if (rho > sp.ring.r1 && rho < sp.ring.r2 && (d > 1 || z > Math.sqrt(Math.max(0, 1 - d * d)) * S)) {
        const [rr, rg, rb, ra] = ringAt(i, rho, sp.ring.r1, sp.ring.r2, null);
        // the globe's shadow, and the ring's own side to the light
        const P = [u, v, z], b = dot(P, LIGHT), cc = dot(P, P) - S * S, disc = b * b - cc;
        const shade = (disc > 0 && b < 0 && cc > 0) ? 0.22 : 1;
        const side = 0.55 + 0.45 * Math.abs(dot(nr, LIGHT)) ** 0.5;
        const rc = [rr * side * shade + 0.04, rg * side * shade + 0.05, rb * side * shade + 0.08];
        const k = ra * smooth(0, 0.03, Math.min(rho - sp.ring.r1, sp.ring.r2 - rho) / (sp.ring.r2 - sp.ring.r1));
        col = a > 0 ? mixc(col, rc, k) : rc; a = a + (1 - a) * k;
      }
    }
    const o = (y * n + x) * 4;
    px[o] = clamp(col[0]) * 255; px[o + 1] = clamp(col[1]) * 255; px[o + 2] = clamp(col[2]) * 255; px[o + 3] = clamp(a) * 255;
  }
  return px;
}

/** Browser: paint the eight bodies one at a time between frames (so the page is never held up) and hand each to CSS as
 *  `--bu-img-<colour>` with the class `bu-lit<colour>` on <html>; until its turn a body keeps its flat drawing. */
export function bakeBodies(n = 112) {
  const next = i => {
    if (i >= BODIES.length) return;
    try {
      const cv = document.createElement("canvas"); cv.width = cv.height = n;
      cv.getContext("2d").putImageData(new ImageData(renderBody(i, n), n, n), 0, 0);
      document.documentElement.style.setProperty(`--bu-img-${i}`, `url("${cv.toDataURL("image/png")}")`);
      document.documentElement.classList.add(`bu-lit${i}`);
    } catch { return; }                                          // no canvas: the flat bodies stay
    setTimeout(() => next(i + 1), 30);
  };
  setTimeout(() => next(0), 0);
}
