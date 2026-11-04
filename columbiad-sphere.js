// The maths of Columbiad's lit spheres, with no page in it (so a Node test can run it): which map point each pixel of a globe
// looks at, how much light it gets, and the resampling of an equirectangular map at a turn that can be any fraction of a texel.
// columbiad-globe.js owns the canvases and the maps; this owns what must be even.
//
// Why a globe turns smoothly here: the pixel to map-point work (asin, atan2, sqrt) does not depend on the turn, because the globe
// spins about its own pole and a spin only adds to the longitude. So it is done once per size in `buildSphere`, and a turn costs
// `renderSphere` a bilinear read of the map at (longitude + turn), at any fraction of a texel, with several reads along the
// stretch of map a pixel covers near the limb (where a whole coast is squeezed into a pixel and would otherwise shimmer). The
// turn itself is whatever the caller says; nothing here rounds it.
export const TAU = Math.PI * 2;
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = t => t * t * (3 - 2 * t);
/** The map's reads per pixel at most, along the stretch it covers. */
export const MAX_TAPS = 16;

/** Graticule: a line every 15 degrees of longitude and latitude, as on an engraved globe. */
const GRID_LON = 24, GRID_LAT = 12;

/** The Sun's direction in the picture (x right, y up, z toward the viewer), from a bearing in degrees round from the right and a lift toward the viewer. */
export function sunOf(deg = 135, lift = 0.5) {
  const a = deg * Math.PI / 180, c = Math.sqrt(1 - lift * lift);
  return [Math.cos(a) * c, Math.sin(a) * c, lift];
}

/**
 * The geometry of a globe S pixels across (the disc takes S / pad of that; pad above 1 leaves room for the Earth's air).
 * o: { pad, tilt, roll (degrees), sun, earth (true: air, the Earth's light), texW, texH (the map's size, to know how many reads a
 * pixel needs) }. `air` is the RGBA bytes of a second canvas (or null): the Earth's air round the disc is written into it once. The
 * disc's own edge is not softened here: the page clips the disc's canvas to an exact circle, which is cleaner than any pixel's alpha.
 * Returns the per-pixel arrays of the disc, in reading order.
 */
export function buildSphere(S, o, air) {
  const { pad, earth, sun: [sx, sy, sz], texW, texH } = o, mips = o.mips || 1;
  const tilt = o.tilt * Math.PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt), rl = (o.roll || 0) * Math.PI / 180, cr = Math.cos(rl), sr = Math.sin(rl);
  const hx = sx, hy = sy, hz = sz + 1, hl = Math.sqrt(hx * hx + hy * hy + hz * hz);
  const cap = Math.ceil(Math.PI / 4 * (S / pad) * (S / pad) + 4 * S / pad + 16);
  const pix = new Uint32Array(cap), u0 = new Float32Array(cap), v = new Float32Array(cap), tu = new Float32Array(cap), tv = new Float32Array(cap);
  const nt = new Uint8Array(cap), lod = new Uint8Array(cap), f = new Float32Array(cap), lit = new Float32Array(cap), haze = new Float32Array(cap), glint = new Float32Array(cap);
  const gu = new Float32Array(cap), gv = new Float32Array(cap), zz = new Float32Array(cap);
  const h = 2 * pad / S;                                                    // one pixel, in the disc's own units
  let n = 0;
  for (let j = 0; j < S; j++) {
    const yr = (1 - 2 * (j + 0.5) / S) * pad;
    for (let i = 0; i < S; i++) {
      const xr = (2 * (i + 0.5) / S - 1) * pad, r2 = xr * xr + yr * yr, k = (j * S + i) * 4;
      if (r2 > pad * pad) continue;
      const r = Math.sqrt(r2);
      if (r > 1 - 2 * h && earth && air) {                                          // the air round the Earth: a blue glow that fades outward, brighter on the Sun's side (laid two pixels under the disc too, so its inner edge is no staircase)
        const t = Math.max(0, r - 1) / (pad - 1), a = (1 - t) * (1 - t) * (1 - t), side = (xr * sx + yr * sy) / r, fa = 0.22 + 0.78 * clamp01(side * 0.8 + 0.45);
        air[k] = 96 + 40 * fa; air[k + 1] = 150 + 50 * fa; air[k + 2] = 245; air[k + 3] = 255 * a * fa * 0.9;
      }
      // the disc reaches two pixels past the limb (its edge pixels are laid on the limb itself), so the page's exact circle clips onto pixels, never onto gaps
      if (r > 1 + 2 * h) continue;
      const x = r > 1 ? xr / r : xr, y = r > 1 ? yr / r : yr, z = r > 1 ? 0 : Math.sqrt(1 - r2), zc = z > 0.03 ? z : 0.03;
      // from the picture's axes to the globe's: a roll about the view axis, then the pole tilted toward the viewer
      const x1 = x * cr + y * sr, y1 = -x * sr + y * cr, y2 = y1 * ct + z * st, z2 = -y1 * st + z * ct;
      const lat = Math.asin(y2 > 1 ? 1 : y2 < -1 ? -1 : y2), lon = Math.atan2(x1, z2);
      // how far the longitude and the latitude move across one pixel along x and along y: what a pixel covers on the map
      const den = Math.max(x1 * x1 + z2 * z2, 1e-4), cl = Math.max(Math.sqrt(1 - y2 * y2), 0.02);
      let bu = 0, bv = 0, bn = -1, sm = 1e9, gU = 0, gV = 0;
      for (let q = 0; q < 2; q++) {
        const dz = q ? -y / zc : -x / zc, dx1 = q ? sr : cr, dy1 = q ? cr : -sr;
        const dy2 = dy1 * ct + dz * st, dz2 = -dy1 * st + dz * ct;
        const dU = (z2 * dx1 - x1 * dz2) / den / TAU * h, dV = -(dy2 / cl) / Math.PI * h, m = Math.hypot(dU * texW, dV * texH);
        gU += dU * dU; gV += dV * dV;
        if (m < sm) sm = m;
        if (m > bn) { bn = m; bu = dU; bv = dV; }
      }
      // a smaller copy of the map when even the short side of the pixel's patch covers several texels (the long side is then read along)
      let lv = 0;
      while (lv + 1 < mips && sm >= 2 << lv) lv++;
      const major = bn / (1 << lv);
      let taps = 1;
      if (major > 1) { taps = Math.min(MAX_TAPS, Math.ceil(major)); if (major > MAX_TAPS) { const c = MAX_TAPS / major; bu *= c; bv *= c; } }
      const ndl = x * sx + y * sy + z * sz;
      let li, ff, hz2 = 0, gl = 0;
      if (earth) {
        li = clamp01((ndl + 0.1) / 0.62); li = li * li * (3 - 2 * li);
        ff = (0.07 + 0.93 * li) * (0.5 + 0.5 * Math.sqrt(z));
        hz2 = (1 - z) * (1 - z) * (0.25 + 0.75 * li) * 0.9;
        let s = (x * hx + y * hy + z * hz) / hl; s = s > 0 ? s : 0;
        const s2 = s * s, s4 = s2 * s2, s8 = s4 * s4, s16 = s8 * s8;
        gl = s16 * s16 * 0.55 * li;
      } else {
        li = clamp01((ndl + 0.03) / 0.34);
        ff = 0.035 + 0.965 * li * (0.82 + 0.18 * z);
      }
      pix[n] = k; u0[n] = lon / TAU + 0.5; v[n] = 0.5 - lat / Math.PI; tu[n] = bu; tv[n] = bv; nt[n] = taps; lod[n] = lv;
      f[n] = ff; lit[n] = li; haze[n] = hz2; glint[n] = gl; zz[n] = z;
      gu[n] = Math.sqrt(gU); gv[n] = Math.sqrt(gV);
      n++;
    }
  }
  return { S, pad, earth, n, pix, u0, v, tu, tv, nt, lod, f, lit, haze, glint, gu, gv, z: zz, sun: [sx, sy, sz] };
}

// ---------- reading the map ----------
const acc = new Float64Array(3);
/**
 * Adds the bilinear colour of an RGBA map at (u, v) (u in turns, any value, wrapping; v from 0 at the north pole to 1 at the south,
 * held at the ends) into acc[0..2].
 */
function addTexel(t, u, v) {
  const w = t.w, hh = t.h, d = t.data;
  const x = (u - Math.floor(u)) * w - 0.5, y = (v < 0 ? 0 : v > 1 ? 1 : v) * hh - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const xa = x0 < 0 ? w - 1 : x0, xb = xa + 1 >= w ? 0 : xa + 1, ya = y0 < 0 ? 0 : y0, yb = y0 + 1 >= hh ? hh - 1 : y0 + 1;
  const a = (ya * w + xa) * 4, b = (ya * w + xb) * 4, c = (yb * w + xa) * 4, e = (yb * w + xb) * 4;
  const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
  acc[0] += d[a] * w00 + d[b] * w10 + d[c] * w01 + d[e] * w11;
  acc[1] += d[a + 1] * w00 + d[b + 1] * w10 + d[c + 1] * w01 + d[e + 1] * w11;
  acc[2] += d[a + 2] * w00 + d[b + 2] * w10 + d[c + 2] * w01 + d[e + 2] * w11;
}
/** The pyramid of an RGBA map: `mips[k]` is the map halved k times (a box average), for a pixel that covers many texels. */
export function withMips(t) {
  const mips = [t];
  for (let l = mips[0]; l.w >= 8 && l.h >= 4;) {
    const w = l.w >> 1, h = l.h >> 1, d = new Uint8ClampedArray(w * h * 4), s = l.data, W = l.w;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) for (let c = 0; c < 4; c++) {
      const a = ((2 * j) * W + 2 * i) * 4 + c;
      d[(j * w + i) * 4 + c] = (s[a] + s[a + 4] + s[a + W * 4] + s[a + W * 4 + 4] + 2) >> 2;
    }
    l = { w, h, data: d }; mips.push(l);
    if (mips.length >= 6) break;
  }
  t.mips = mips;
  return t;
}
/** The colour of `t` at pixel p of `g` and a turn, filtered along the pixel's stretch of map, into acc. */
function read(t0, g, p, turn) {
  const n = g.nt[p], t = t0.mips ? t0.mips[g.lod[p]] : t0;
  acc[0] = acc[1] = acc[2] = 0;
  if (n === 1) { addTexel(t, g.u0[p] + turn, g.v[p]); return; }
  const tuu = g.tu[p], tvv = g.tv[p];
  for (let i = 0; i < n; i++) { const o = (i + 0.5) / n - 0.5; addTexel(t, g.u0[p] + turn + tuu * o, g.v[p] + tvv * o); }
  acc[0] /= n; acc[1] /= n; acc[2] /= n;
}
/** Bilinear value of a one-channel float map (the clouds) at (u, v), the same way. */
export function flat(t, u, v) {
  const w = t.w, hh = t.h, x = (u - Math.floor(u)) * w - 0.5, y = (v < 0 ? 0 : v > 1 ? 1 : v) * hh - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const xa = x0 < 0 ? w - 1 : x0, xb = xa + 1 >= w ? 0 : xa + 1, ya = y0 < 0 ? 0 : y0 >= hh ? hh - 1 : y0, yb = y0 + 1 >= hh ? hh - 1 : y0 + 1, d = t.a;
  return (d[ya * w + xa] * (1 - fx) + d[ya * w + xb] * fx) * (1 - fy) + (d[yb * w + xa] * (1 - fx) + d[yb * w + xb] * fx) * fy;
}

/** The Earth's painted look: the photograph's colours pulled toward enamel; see `paintEarth`. */
const SEA_DEEP = [9, 28, 64], SEA_SHALLOW = [40, 98, 156];
/** Photograph colour in acc -> painted colour in out (a plain object { r, g, b }) and whether it is sea. */
export function paintEarth(R, G, B, o) {
  // the sea, as a soft 0..1
  const l = 0.3 * R + 0.59 * G + 0.11 * B;
  const sw = Math.max(clamp01((B - 1.2 * R - 4) / 70), clamp01((58 - l) / 24));     // blue, or so dark that only deep water is that dark; a soft ramp, so a coast stays anti-aliased however far the map is magnified
  // the sea: a gradient from deep navy to a clear blue, by how bright the sea floor shows in the map (its depth), without the map's hard steps
  const depth = clamp01((B + G * 0.4 - 30) / 150), d = depth * depth * (3 - 2 * depth);
  const sr = SEA_DEEP[0] + (SEA_SHALLOW[0] - SEA_DEEP[0]) * d, sg = SEA_DEEP[1] + (SEA_SHALLOW[1] - SEA_DEEP[1]) * d, sb = SEA_DEEP[2] + (SEA_SHALLOW[2] - SEA_DEEP[2]) * d;
  // the land: the map's colours, calmer (less saturated, a little warmer), the ice kept bright
  const ice = clamp01((l - 130) / 100) * clamp01((R + G + B) / 3 / 170);
  let lr = (R * 0.8 + l * 0.2) * 1.05 + 4, lg = (G * 0.8 + l * 0.2) * 1.0 + 2, lb = (B * 0.8 + l * 0.2) * 0.86;
  lr += (246 - lr) * ice * 0.6; lg += (244 - lg) * ice * 0.6; lb += (238 - lb) * ice * 0.6;
  o.r = lr + (sr - lr) * sw; o.g = lg + (sg - lg) * sw; o.b = lb + (sb - lb) * sw; o.sea = sw;
}
const painted = { r: 0, g: 0, b: 0, sea: 0 };

/** The grid's two spin-independent factors per pixel, made once for a geometry: the latitude lines' coverage and the longitude lines' fade. */
function gridFactors(g) {
  const N = g.n, { v, gu, gv } = g, cv = new Float64Array(N), fadeU = new Float64Array(N), wu = new Float64Array(N);
  const half = 0.65;
  for (let p = 0; p < N; p++) {
    const w1 = Math.max(gu[p], 1e-7), w2 = Math.max(gv[p], 1e-7), fv = v[p] * GRID_LAT, dv = Math.abs(fv - Math.round(fv)) / GRID_LAT;
    wu[p] = w1; fadeU[p] = clamp01((1 / GRID_LON / w1 - 3) / 5);
    cv[p] = clamp01(half - dv / w2 + 0.5) * clamp01((1 / GRID_LAT / w2 - 3) / 5);
  }
  g.grid = { cv, fadeU, wu };
  return g.grid;
}

/**
 * Draws the globe `g` (from buildSphere) into px (RGBA bytes) at `turn` (the globe's spin, in turns, any real number): the map `tex`
 * (an Earth: its photograph, painted; a moon: its grey map, tinted by `tint`) and, for an Earth, the `clouds` (a one-channel
 * map, drifting a little faster than the ground).
 *
 * This is the one hot loop of the page (a whole sphere, thirty times a second), so it is written flat: the bilinear read, the
 * painting and the clouds are inlined, nothing is allocated, and what does not depend on the turn is made once (`gridFactors`,
 * and buildSphere's arrays). The arithmetic is the same expression for expression as the plain version it replaced, so the
 * pictures are byte for byte the same (`paintEarth` and `flat` are that plain version, kept for the tests).
 */
export function renderSphere(g, px, tex, clouds, turn, tint = [1, 1, 1]) {
  const N = Math.min(g.n, g.pix.length), { pix, u0, v, f, lit, haze, glint, nt, lod, tu, tv } = g, earth = g.earth;
  const mips = tex.mips;
  const cloudTurn = turn * 1.35 + 0.127;
  const gf = earth ? g.grid || gridFactors(g) : null;
  const cvA = gf && gf.cv, fadeUA = gf && gf.fadeU, wuA = gf && gf.wu;
  const cd = clouds ? clouds.a : null, cw = clouds ? clouds.w : 0, ch = clouds ? clouds.h : 0;
  const t0 = tint[0], t1 = tint[1], t2 = tint[2];
  for (let p = 0; p < N; p++) {
    const k = pix[p], li = lit[p], n = nt[p], t = mips ? mips[lod[p]] : tex, d = t.data, w = t.w, hh = t.h;
    let r = 0, gg = 0, b = 0;
    const base = u0[p] + turn, vv = v[p];
    // the map at this pixel: one bilinear read, or the average of several along the pixel's stretch of map
    for (let i = 0; i < n; i++) {
      let u = base, vq = vv;
      if (n > 1) { const o = (i + 0.5) / n - 0.5; u = base + tu[p] * o; vq = vv + tv[p] * o; }
      const x = (u - Math.floor(u)) * w - 0.5, y = (vq < 0 ? 0 : vq > 1 ? 1 : vq) * hh - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      const xa = x0 < 0 ? w - 1 : x0, xb = xa + 1 >= w ? 0 : xa + 1, ya = y0 < 0 ? 0 : y0, yb = y0 + 1 >= hh ? hh - 1 : y0 + 1;
      const a = (ya * w + xa) * 4, bq = (ya * w + xb) * 4, c = (yb * w + xa) * 4, e = (yb * w + xb) * 4;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      r += d[a] * w00 + d[bq] * w10 + d[c] * w01 + d[e] * w11;
      gg += d[a + 1] * w00 + d[bq + 1] * w10 + d[c + 1] * w01 + d[e + 1] * w11;
      b += d[a + 2] * w00 + d[bq + 2] * w10 + d[c + 2] * w01 + d[e + 2] * w11;
    }
    if (n > 1) { r /= n; gg /= n; b /= n; }
    let R, G, B;
    if (earth) {
      // paintEarth, inlined
      const l = 0.3 * r + 0.59 * gg + 0.11 * b;
      const s1 = (b - 1.2 * r - 4) / 70, s2 = (58 - l) / 24;
      const sw = Math.max(s1 < 0 ? 0 : s1 > 1 ? 1 : s1, s2 < 0 ? 0 : s2 > 1 ? 1 : s2);
      const dp0 = (b + gg * 0.4 - 30) / 150, dp = dp0 < 0 ? 0 : dp0 > 1 ? 1 : dp0, dd = dp * dp * (3 - 2 * dp);
      const sr = SEA_DEEP[0] + (SEA_SHALLOW[0] - SEA_DEEP[0]) * dd, sg = SEA_DEEP[1] + (SEA_SHALLOW[1] - SEA_DEEP[1]) * dd, sb = SEA_DEEP[2] + (SEA_SHALLOW[2] - SEA_DEEP[2]) * dd;
      const i1 = (l - 130) / 100, i2 = (r + gg + b) / 3 / 170;
      const ice = (i1 < 0 ? 0 : i1 > 1 ? 1 : i1) * (i2 < 0 ? 0 : i2 > 1 ? 1 : i2);
      let lr = (r * 0.8 + l * 0.2) * 1.05 + 4, lg = (gg * 0.8 + l * 0.2) * 1.0 + 2, lb = (b * 0.8 + l * 0.2) * 0.86;
      lr += (246 - lr) * ice * 0.6; lg += (244 - lg) * ice * 0.6; lb += (238 - lb) * ice * 0.6;
      R = lr + (sr - lr) * sw; G = lg + (sg - lg) * sw; B = lb + (sb - lb) * sw;
      let ca = 0;
      if (cd) {                                                             // flat(): the clouds' bilinear read
        const cu = u0[p] + cloudTurn, x = (cu - Math.floor(cu)) * cw - 0.5, y = (vv < 0 ? 0 : vv > 1 ? 1 : vv) * ch - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
        const xa = x0 < 0 ? cw - 1 : x0, xb = xa + 1 >= cw ? 0 : xa + 1, ya = y0 < 0 ? 0 : y0 >= ch ? ch - 1 : y0, yb = y0 + 1 >= ch ? ch - 1 : y0 + 1;
        ca = ((cd[ya * cw + xa] * (1 - fx) + cd[ya * cw + xb] * fx) * (1 - fy) + (cd[yb * cw + xa] * (1 - fx) + cd[yb * cw + xb] * fx) * fy) * 0.6;
      }
      R = R * (1 - ca) + 238 * ca; G = G * (1 - ca) + 242 * ca; B = B * (1 - ca) + 248 * ca;
      {                                                                     // the brass graticule, fading out where its lines would crowd
        const fu = (u0[p] + turn) * GRID_LON, du = Math.abs(fu - Math.round(fu)) / GRID_LON;
        const cu = (0.65 - du / wuA[p] + 0.5), cuc = (cu < 0 ? 0 : cu > 1 ? 1 : cu) * fadeUA[p], cvv = cvA[p];
        const c = (cuc > cvv ? cuc : cvv) * 0.22 * (1 - ca * 0.8);
        R += (232 - R) * c; G += (190 - G) * c; B += (104 - B) * c;
      }
      const ff = f[p];
      R *= ff; G *= ff; B *= ff;
      R += 4 * (1 - li); G += 8 * (1 - li); B += 20 * (1 - li);
      const sp = glint[p] * (1 - ca) * sw * sw;                             // the Sun's glint on the water
      R += 255 * sp; G += 235 * sp; B += 200 * sp;
      const hz = haze[p];
      R += (120 - R) * hz; G += (172 - G) * hz; B += (255 - B) * hz;
    } else {
      const ff = f[p];
      R = r * ff * t0; G = gg * ff * t1; B = b * ff * t2 + 4 * (1 - li);
    }
    px[k] = R > 255 ? 255 : R; px[k + 1] = G > 255 ? 255 : G; px[k + 2] = B > 255 ? 255 : B; px[k + 3] = 255;
  }
}

/** How far a turn must change to move the picture by `fraction` of a pixel at the disc's rim (where it moves fastest). */
export function turnForPixels(S, pad, fraction) { return fraction / (S / (2 * pad)) / TAU; }
