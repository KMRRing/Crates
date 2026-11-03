// Columbiad's globes: the Earth and the moons as lit spheres, drawn once into a small off-screen canvas by an orthographic
// mapping of an equirectangular map (the sphere's pixel found on the map, shaded by Lambert from the Sun with a soft
// terminator, darkened toward the limb, a blue haze at the rim; the Earth with a faint cloud layer and a glint on the sea). The
// page asks for a globe's picture at a spin and a Sun, gets the cached canvas back unless one of them moved, and scales it
// with drawImage; so a camera zoom costs nothing and only a turn of the globe costs a render (about 15 ms at 448 px).
// Nothing here touches a rule: the game's physics is columbiad-engine.js and never reads a picture.
//
// The Earth's map is NASA's Blue Marble (public domain, see docs/licences-images-and-engines.md), 1024 x 512, loaded lazily from
// its own file; until it arrives, and if it never does, the Earth is a plain ocean-blue sphere. The clouds and the moons' maps are
// made here from noise and craters, the first time they are wanted.
const TAU = Math.PI * 2;
export const EARTH_MAP = "columbiad-earth.jpg";

// ---------- noise (a picture's, not a rule's: Math.sin and friends are fine here) ----------
function hash(x, y, z, s) {
  let h = Math.imul(x | 0, 0x27D4EB2D) ^ Math.imul(y | 0, 0x165667B1) ^ Math.imul(z | 0, 0x9E3779B1) ^ Math.imul(s | 0, 0x85EBCA6B);
  h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D); h = Math.imul(h ^ (h >>> 12), 0x297A2D39);
  return (h ^ (h >>> 15)) >>> 0;
}
const smooth = t => t * t * (3 - 2 * t);
function vnoise(x, y, z, s) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz);
  const v = (a, b, c) => hash(ix + a, iy + b, iz + c, s) / 4294967296;
  const x00 = v(0, 0, 0) + (v(1, 0, 0) - v(0, 0, 0)) * fx, x10 = v(0, 1, 0) + (v(1, 1, 0) - v(0, 1, 0)) * fx;
  const x01 = v(0, 0, 1) + (v(1, 0, 1) - v(0, 0, 1)) * fx, x11 = v(0, 1, 1) + (v(1, 1, 1) - v(0, 1, 1)) * fx;
  const y0 = x00 + (x10 - x00) * fy, y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}
function fbm(x, y, z, oct, s) {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) { sum += a * vnoise(x * f, y * f, z * f, s + i * 31); norm += a; a *= 0.5; f *= 2.03; }
  return sum / norm;
}
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const step = (a, b, v) => smooth(clamp01((v - a) / (b - a)));
/** The unit direction of texel (i, j) of a w x h equirectangular map: longitude 0 faces +z, the pole is +y. */
function dirOf(i, j, w, h) {
  const lon = ((i + 0.5) / w - 0.5) * TAU, lat = (0.5 - (j + 0.5) / h) * Math.PI, c = Math.cos(lat);
  return [c * Math.sin(lon), Math.sin(lat), c * Math.cos(lon)];
}

// ---------- the maps ----------
/** Clouds: patchy, banded a little by latitude. Rows j0 up to j1 of { w, h, a (0..1 floats) }. */
function cloudRows(t, j0, j1) {
  const { w, h, a } = t;
  for (let j = j0; j < j1; j++) for (let i = 0; i < w; i++) {
    const [x, y, z] = dirOf(i, j, w, h), lat = Math.abs(y);
    const n = fbm(x * 3.1 + 5, y * 4.6 + 1, z * 3.1 - 2, 5, 17), band = 0.06 * Math.cos(lat * 9) - 0.05 * lat;
    a[j * w + i] = step(0.5, 0.74, n + band);
  }
}
/** The Moon: highlands, dark maria on the near side, craters at two sizes with a bright rim. Rows j0 up to j1 of { w, h, data (RGBA bytes) }. */
function moonRows(t, j0, j1) {
  const { w, h, data } = t;
  // a crater reaches 1.35 radii at most and a radius is 0.34 cells at most, so the eight cells nearest the point hold every crater that touches it
  const crater = (px, py, pz, s) => {
    const ix = Math.floor(px), iy = Math.floor(py), iz = Math.floor(pz), sx = px - ix < 0.5 ? -1 : 1, sy = py - iy < 0.5 ? -1 : 1, sz = pz - iz < 0.5 ? -1 : 1;
    let v = 0;
    for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) for (let c = 0; c < 2; c++) {
      const cx = ix + a * sx, cy = iy + b * sy, cz = iz + c * sz, g = hash(cx, cy, cz, s);
      if ((g & 3) > 1) continue;
      const ox = cx + ((g >>> 8) & 255) / 255, oy = cy + ((g >>> 16) & 255) / 255, oz = cz + ((g >>> 24) & 255) / 255;
      const r0 = ((g >>> 4) & 15) / 15, rad = 0.12 + 0.22 * r0 * r0, d = Math.sqrt((px - ox) * (px - ox) + (py - oy) * (py - oy) + (pz - oz) * (pz - oz)) / rad;
      if (d < 1) v -= 0.17 * (1 - d * d);
      else if (d < 1.35) v += 0.2 * (1 - (d - 1) / 0.35) * (1 - (d - 1) / 0.35);
    }
    return v;
  };
  for (let j = j0; j < j1; j++) for (let i = 0; i < w; i++) {
    const [x, y, z] = dirOf(i, j, w, h);
    let m = step(0.5, 0.6, fbm(x * 1.5 + 3, y * 1.5 + 1, z * 1.5 + 2, 4, 5));
    m *= 0.3 + 0.7 * step(-0.25, 0.45, z);                     // the maria lie mostly on the near side
    let g = 0.66 + 0.16 * (fbm(x * 4 + 9, y * 4, z * 4 + 4, 3, 9) - 0.5) * 2;
    g += crater(x * 5.2, y * 5.2, z * 5.2, 3) + 0.7 * crater(x * 11.5, y * 11.5, z * 11.5, 7);
    g *= 1 - 0.44 * m;
    const k = (j * w + i) * 4;
    data[k] = 255 * g * (1 - 0.02 * m); data[k + 1] = 255 * g * (0.985 - 0.015 * m) * 0.99; data[k + 2] = 255 * g * (0.95 + 0.02 * m) * 0.97; data[k + 3] = 255;
  }
}

// ---------- the sampler ----------
/** Bilinear colour of an RGBA map at u (0..1 round), v (0..1 pole to pole) into o[0..2]. */
function texel(t, u, v, o) {
  const x = u * t.w - 0.5, y = v * t.h - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const xa = ((x0 % t.w) + t.w) % t.w, xb = (xa + 1) % t.w, ya = y0 < 0 ? 0 : y0 >= t.h ? t.h - 1 : y0, yb = y0 + 1 >= t.h ? t.h - 1 : y0 + 1 < 0 ? 0 : y0 + 1;
  const d = t.data, a = (ya * t.w + xa) * 4, b = (ya * t.w + xb) * 4, c = (yb * t.w + xa) * 4, e = (yb * t.w + xb) * 4;
  for (let k = 0; k < 3; k++) o[k] = (d[a + k] * (1 - fx) + d[b + k] * fx) * (1 - fy) + (d[c + k] * (1 - fx) + d[e + k] * fx) * fy;
}
function flat(t, u, v) {
  const x = u * t.w - 0.5, y = v * t.h - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const xa = ((x0 % t.w) + t.w) % t.w, xb = (xa + 1) % t.w, ya = y0 < 0 ? 0 : y0 >= t.h ? t.h - 1 : y0, yb = y0 + 1 >= t.h ? t.h - 1 : y0 + 1 < 0 ? 0 : y0 + 1;
  const d = t.a;
  return (d[ya * t.w + xa] * (1 - fx) + d[ya * t.w + xb] * fx) * (1 - fy) + (d[yb * t.w + xa] * (1 - fx) + d[yb * t.w + xb] * fx) * fy;
}

/** The Sun's direction in the picture (x right, y up, z toward the viewer), from a bearing in degrees round from the right and a lift toward the viewer. */
export function sunOf(deg = 135, lift = 0.5) {
  const a = deg * Math.PI / 180, c = Math.sqrt(1 - lift * lift);
  return [Math.cos(a) * c, Math.sin(a) * c, lift];
}

let earthMap = null, earthAsked = false, moonTex = null, cloudTex = null, warming = null;
const GREY = { w: 1, h: 1, data: [168, 166, 158, 255] };
const waiting = new Set();
/** Starts loading the Earth's map (once); `then` is called when it has arrived (a redraw), and never if it cannot be had. */
export function loadEarth(then) {
  if (then) waiting.add(then);
  if (earthMap || earthAsked) return;
  earthAsked = true;
  try {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        const d = g.getImageData(0, 0, c.width, c.height);
        earthMap = { w: c.width, h: c.height, data: d.data };
        for (const f of waiting) f();
        waiting.clear();
      } catch { /* a map that will not read leaves the plain sphere */ }
    };
    img.onerror = () => { earthAsked = false; };
    img.src = EARTH_MAP;
  } catch { /* no Image: nothing to load */ }
}

/**
 * Makes the clouds and the Moon's map a slice of rows at a time, between the page's frames (a map built at once stops it for a
 * second), and calls `then` once when they are ready. Until then a globe is drawn without them.
 */
export function warm(then) {
  if (then) waiting.add(then);
  if (warming) return;
  warming = (async () => {
    const later = () => new Promise(r => setTimeout(r, 0));
    const mt = { w: 512, h: 256, data: new Uint8ClampedArray(512 * 256 * 4) }, ct = { w: 256, h: 128, a: new Float32Array(256 * 128) };
    for (let j = 0; j < 128; j += 8) { cloudRows(ct, j, j + 8); await later(); }
    cloudTex = ct;
    for (let j = 0; j < 256; j += 8) { moonRows(mt, j, j + 8); await later(); }
    moonTex = mt;
    for (const f of waiting) f();
    waiting.clear();
  })();
}

/**
 * A globe: `kind` "earth" (the map, clouds, a rim of air) or "moon" (cratered grey, the Sun's phase). picture(spin, sun, size)
 * is the off-screen canvas of the sphere (its disc takes size / pad of the canvas; pad is 1.12 for the Earth, the room its
 * air needs, else 1), redrawn only when the spin (in turns), the Sun or the size changed.
 */
export function createGlobe(kind, { tilt = 22, roll = 0, size = 448, tint = [1, 1, 1] } = {}) {
  const earth = kind === "earth", pad = earth ? 1.12 : 1;
  const cv = document.createElement("canvas"), g = cv.getContext("2d", { willReadFrequently: true });
  let img = null, key = "", map = null, clouds = null;
  const tilt1 = tilt * Math.PI / 180, ct = Math.cos(tilt1), st = Math.sin(tilt1), rl = roll * Math.PI / 180, cr = Math.cos(rl), sr = Math.sin(rl);
  const o = [0, 0, 0];
  function render(spin, sun, S) {
    if (!img || img.width !== S) { cv.width = cv.height = S; img = g.createImageData(S, S); }
    const px = img.data, [sx, sy, sz] = sun;
    map = earth ? earthMap : moonTex || GREY;
    clouds = cloudTex;
    const hx = sx, hy = sy, hz = sz + 1, hl = Math.sqrt(hx * hx + hy * hy + hz * hz), spinA = spin * TAU, cloudA = spin * TAU * 1.35 + 0.8;
    for (let j = 0; j < S; j++) {
      const y = (1 - 2 * (j + 0.5) / S) * pad;
      for (let i = 0; i < S; i++) {
        const x = (2 * (i + 0.5) / S - 1) * pad, r2 = x * x + y * y, k = (j * S + i) * 4;
        if (r2 > pad * pad) { px[k + 3] = 0; continue; }
        const r = Math.sqrt(r2);
        if (r > 1) {                                           // the air round the Earth: a blue glow that fades outward, brighter on the Sun's side
          const t = (r - 1) / (pad - 1), a = (1 - t) * (1 - t) * (1 - t), side = (x * sx + y * sy) / r, f = 0.22 + 0.78 * clamp01(side * 0.8 + 0.45);
          px[k] = 96 + 40 * f; px[k + 1] = 150 + 50 * f; px[k + 2] = 245; px[k + 3] = 255 * a * f * 0.9;
          continue;
        }
        const z = Math.sqrt(1 - r2), edge = clamp01((1 - r) * S / pad * 0.5 + 0.5);
        // from the picture's axes to the globe's: a roll about the view axis, then the pole tilted toward the viewer
        const x1 = x * cr + y * sr, y1 = -x * sr + y * cr, y2 = y1 * ct + z * st, z2 = -y1 * st + z * ct;
        const lat = Math.asin(y2 > 1 ? 1 : y2 < -1 ? -1 : y2), lon = Math.atan2(x1, z2) + spinA;
        let u = lon / TAU + 0.5; u -= Math.floor(u);
        const v = 0.5 - lat / Math.PI, ndl = x * sx + y * sy + z * sz;
        let R, G, B;
        if (earth) {
          if (map) { texel(map, u, v, o); R = o[0]; G = o[1]; B = o[2]; } else { R = 22; G = 52; B = 96; }
          let lit = clamp01((ndl + 0.1) / 0.62); lit = lit * lit * (3 - 2 * lit);
          // the deep sea in the map is nearly black, with hard steps where its depth changes: its contrast is flattened and lifted (by how blue a texel is), so an ocean in half-light still reads as water
          const sw = map ? clamp01((B - 1.2 * R - 4) / 40) : 1, sea = sw > 0.5 ? 1 : 0;
          R += sw * ((14 + R * 0.45) - R); G += sw * ((38 + G * 0.5) - G); B += sw * ((84 + B * 0.42) - B);
          // a cloud layer, drifting a little faster than the ground
          let ca = 0;
          if (clouds) { let cu = (lon - spinA + cloudA) / TAU + 0.5; cu -= Math.floor(cu); ca = flat(clouds, cu, v) * 0.62; }
          const f = 0.07 + 0.93 * lit, limb = 0.5 + 0.5 * Math.sqrt(z);
          R = R * (1 - ca) + 238 * ca; G = G * (1 - ca) + 242 * ca; B = B * (1 - ca) + 248 * ca;
          R *= f * limb; G *= f * limb; B *= f * limb;
          R += 4 * (1 - lit); G += 8 * (1 - lit); B += 20 * (1 - lit);
          if (sea) {                                             // the Sun's glint on the water
            let s = (x * hx + y * hy + z * hz) / hl; s = s > 0 ? s : 0;
            const s2 = s * s, s4 = s2 * s2, s8 = s4 * s4, s16 = s8 * s8, sp = s16 * s16 * (1 - ca) * 0.55 * lit;
            R += 255 * sp; G += 235 * sp; B += 200 * sp;
          }
          const haze = (1 - z) * (1 - z) * (0.25 + 0.75 * lit) * 0.9;
          R += (120 - R) * haze; G += (172 - G) * haze; B += (255 - B) * haze;
        } else {
          texel(map, u, v, o);
          const lit = clamp01((ndl + 0.03) / 0.34), f = 0.035 + 0.965 * lit * (0.82 + 0.18 * z);
          R = o[0] * f * tint[0]; G = o[1] * f * tint[1]; B = o[2] * f * tint[2] + 4 * (1 - lit);
        }
        px[k] = R > 255 ? 255 : R; px[k + 1] = G > 255 ? 255 : G; px[k + 2] = B > 255 ? 255 : B; px[k + 3] = 255 * edge;
      }
    }
    g.putImageData(img, 0, 0);
  }
  return {
    pad,
    /** The sphere's canvas at `spin` (turns), lit from `sun`, `S` pixels across (the whole canvas, the air included). */
    picture(spin, sun, S = size) {
      const k = `${S}|${Math.round(spin * 3600)}|${sun[0].toFixed(3)},${sun[1].toFixed(3)}|${earthMap ? 1 : 0}${cloudTex ? 1 : 0}${moonTex ? 1 : 0}`;
      if (k !== key) { key = k; render(spin, sun, S); }
      return cv;
    },
    /** Whether the Earth's map is still to come. */
    get plain() { return earth && !earthMap; },
  };
}
