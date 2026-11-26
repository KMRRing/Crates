// Traverse's Atlas on the screen: the view round you and the map. The view is drawn column by column, each column marching out
// from the eye along its bearing and painting each stretch of ground that rises above everything nearer (as old flight games
// drew their hills), lit by the sun and fading into the haze with distance. The map is the area's fine grid as shaded relief
// with contours every 100 m. Both read the terrain through landfall-terrain.js and know nothing of the play.
import { EYE, drop, inside, smoothIn } from "./landfall-terrain.js";

const DEG = 180 / Math.PI, RAD = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// ---------- the view ----------
/** Smooth value noise in [0, 1) on a unit lattice, for the ground's grain. */
function noise(x, y) {
  const h = (i, j) => { const n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); };
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v;
}

/**
 * Places labels without overlap: most important first, each at its own point or lifted up to `lifts` rows above it (with a stalk
 * down to the point), else left out. `items` are {x, y, w, h, rank}; returns them with `ly`, the label's top, for those placed.
 */
export function declutter(items, { lifts = 2, row = 16, bounds = null, gap = 3 } = {}) {
  const placed = [], out = [];
  for (const it of [...items].sort((a, b) => b.rank - a.rank)) {
    for (let k = 0; k <= lifts; k++) {
      const box = { x: it.x - it.w / 2, y: it.y - it.h - k * row, w: it.w, h: it.h };
      if (bounds && (box.x < bounds.x || box.y < bounds.y || box.x + box.w > bounds.x + bounds.w || box.y + box.h > bounds.y + bounds.h)) continue;
      if (placed.some(p => box.x < p.x + p.w + gap && p.x < box.x + box.w + gap && box.y < p.y + p.h && p.y < box.y + box.h)) continue;
      placed.push(box); out.push({ ...it, ly: box.y, lx: box.x }); break;
    }
  }
  return out;
}
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/**
 * The ground's colour by height, slope and the way it faces: forest, meadow, scree and rock, then snow, which fades in over a band
 * of height and off faces too steep to hold it, so its edge is soft rather than a stair of samples. Late summer: snow lies from
 * about 2950 m, lower on faces turned north (`north`, -1 to 1), and high ice clings to steeper faces than low snow does.
 */
function ground(h, slope, north, x, night) {
  const snowline = 2950 - 380 * north + 150 * Math.sin(x * 0.0007);
  let c = h < 1500 ? [58, 82, 46] : h < 2100 ? mix([58, 82, 46], [104, 120, 70], smooth(1500, 2100, h)) : mix([104, 120, 70], [124, 117, 106], smooth(2100, 2700, h));
  c = mix(c, [100, 94, 88], smooth(0.7, 0.95, slope));                                     // cliffs: bare rock
  const holds = h > 3300 ? 1.15 : 0.8, snow = smooth(snowline - 90, snowline + 90, h) * (1 - smooth(holds - 0.25, holds, slope));
  c = mix(c, mix([238, 241, 246], [200, 206, 214], smooth(0.3, 0.7, slope)), snow);
  return night ? c.map(v => v * 0.45) : c;
}

/**
 * Draws the view from `from` ({lat, lon, h}) into a canvas 2D context, `w` x `h` pixels: centred on bearing `az` (degrees), `fov`
 * degrees wide, the middle of the picture `pitch` degrees above the horizontal. `haze` is the distance (m) at which the ground is
 * two thirds lost in the air; `sun` its bearing and height. `fine`, the area's own grid, lights the near ground smoothly; its
 * shape stays the plain lookup's, so what the picture hides is what the sight lines (landfall-terrain.js `visible`) hide: a spline's
 * overshoot hid 2% of the summits listed as seen, by up to 3.7 degrees. `cloud`, a base in metres, wraps all ground above it in
 * cloud. Returns the screen's mapping, for labels and taps.
 */
export function drawView(ctx, w, hgt, at, from, { az = 0, fov = 60, pitch = 3, haze = 60000, far = 150000, sun = { az: 220, alt: 35 }, night = false, scale = 1, fine = null, cloud = 0 } = {}) {
  const W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(hgt * scale));
  const img = ctx.createImageData(W, H), px = new Uint32Array(img.data.buffer);
  const pxPerDeg = W / fov, horizon = H / 2 + pitch * pxPerDeg;
  const eye = (from.h ?? at(from.lat, from.lon)) + EYE;
  const skyTop = night ? [12, 18, 30] : [92, 140, 196], skyLow = night ? [30, 40, 58] : [196, 214, 228], hazeC = night ? [26, 34, 48] : [190, 206, 220];
  const cloudC = night ? [62, 68, 80] : [214, 218, 224];
  if (cloud) { skyTop.splice(0, 3, ...mix(skyTop, cloudC, 0.75)); skyLow.splice(0, 3, ...mix(skyLow, cloudC, 0.6)); }   // overcast: a grey sky
  const pack = c => (255 << 24) | (clamp(c[2] | 0, 0, 255) << 16) | (clamp(c[1] | 0, 0, 255) << 8) | clamp(c[0] | 0, 0, 255);
  // the sky, bright at the horizon
  for (let y = 0; y < H; y++) {
    const t = clamp((horizon - y) / (H * 0.9), 0, 1), c = pack(mix(skyLow, skyTop, Math.sqrt(t)));
    px.fill(c, y * W, (y + 1) * W);
  }
  const sx = Math.sin(sun.az * RAD) * Math.cos(sun.alt * RAD), sy = Math.cos(sun.az * RAD) * Math.cos(sun.alt * RAD), sz = Math.sin(sun.alt * RAD);
  const kLat = 1 / 111320, kLon = 1 / (111320 * Math.cos(from.lat * RAD));
  const near = fine ? (la, lo) => (inside(fine, la, lo) ? Math.max(0, smoothIn(fine, la, lo)) : at(la, lo)) : at;
  for (let col = 0; col < W; col++) {
    const b = (az + (col / W - 0.5) * fov) * RAD, cb = Math.cos(b), sb = Math.sin(b);
    let top = H, last = null, shown = false;
    // from 120 m out, as the sight lines are judged (landfall-terrain.js `visible`): the ground at your feet, which the 90 m grid
    // can't draw (a hut's slope, a summit's top), would otherwise fill the picture with one flat colour
    for (let x = 120; x < far; x += Math.max(12, x * 0.008)) {
      const la = from.lat + x * cb * kLat, lo = from.lon + x * sb * kLon, hAt = x < 5000 ? near : at, h = at(la, lo);
      const y = horizon - Math.atan2(h - eye - drop(x), x) * DEG * pxPerDeg;
      if (y < top) {
        // the slope and how the sun falls on it, from the ground's lean east and north over a span that grows with distance
        const dd = Math.max(30, x * 0.006), hx = hAt(la, lo + dd * kLon) - hAt(la, lo - dd * kLon), hy = hAt(la + dd * kLat, lo) - hAt(la - dd * kLat, lo);
        const nx = -hx / (2 * dd), ny = -hy / (2 * dd), nl = Math.hypot(nx, ny, 1);
        const lit = clamp((nx * sx + ny * sy + sz) / nl, 0.18, 1), slope = Math.hypot(nx, ny);
        const grain = 0.9 + 0.12 * noise(la * 9000, lo * 9000) + 0.08 * noise(la * 1500, lo * 1500);   // texture, so near slopes are not flat paint
        let c = ground(h, slope, ny / Math.max(1e-6, slope), x, night).map(v => v * (0.45 + 0.65 * lit) * grain);
        if (cloud) c = mix(c, cloudC.map(v => v * (0.93 + 0.1 * noise(la * 400, lo * 400))), smooth(cloud - 60, cloud + 20, h));
        c = mix(c, hazeC, 1 - Math.exp(-x / haze));
        const y0 = Math.max(0, Math.floor(y));
        // a stretch continuing the ground just painted shades smoothly into it; one rising behind a ridge keeps the ridge's edge
        if (shown && last && top - y0 > 1) for (let r = y0; r < top; r++) { const t = (r - y0) / (top - y0); px[r * W + col] = pack(mix(c, last, t)); }
        else { const p = pack(c); for (let r = y0; r < top; r++) px[r * W + col] = p; }
        top = y0; last = c; shown = true;
        if (top <= 0) break;
      } else shown = false;
    }
  }
  if (scale === 1) ctx.putImageData(img, 0, 0);
  else { const off = new OffscreenCanvas(W, H); off.getContext("2d").putImageData(img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, w, hgt); }
  const ppd = w / fov, hz = hgt / 2 + pitch * ppd;
  return {
    /** The screen point of a bearing and an angle above the horizontal, or null off the picture. */
    toScreen(bearing, alt) { const d = ((bearing - az + 540) % 360) - 180; if (Math.abs(d) > fov / 2 + 2) return null; return { x: w / 2 + d * ppd, y: hz - alt * ppd }; },
    /** The bearing and angle under a screen point. */
    fromScreen(x, y) { return { bearing: (az + (x - w / 2) / ppd + 360) % 360, alt: (hz - y) / ppd }; },
    eye,
  };
}

// ---------- the map ----------
/** Shaded relief of a grid, one pixel a sample, tinted by height: made once per area and kept. */
export function relief(g, { night = false } = {}) {
  const c = new OffscreenCanvas(g.cols, g.rows), cx = c.getContext("2d"), img = cx.createImageData(g.cols, g.rows), d = img.data;
  const lo = night ? [34, 44, 40] : [214, 222, 196], mid = night ? [70, 66, 56] : [226, 212, 176], hi = night ? [150, 150, 156] : [246, 246, 244];
  const stepM = (g.n - g.s) / (g.rows - 1) * 111320;
  for (let r = 0; r < g.rows; r++) for (let q = 0; q < g.cols; q++) {
    const i = r * g.cols + q, h = g.data[i];
    const e = g.data[r * g.cols + Math.min(g.cols - 1, q + 1)] - g.data[r * g.cols + Math.max(0, q - 1)];
    const n = g.data[Math.max(0, r - 1) * g.cols + q] - g.data[Math.min(g.rows - 1, r + 1) * g.cols + q];
    const shade = clamp(0.72 + (-e * 0.7 + n * 0.7) / (4 * stepM), 0.25, 1.15);            // lit from the north-west, as maps are
    const t = clamp((h - 500) / 3500, 0, 1), base = t < 0.5 ? mix(lo, mid, t * 2) : mix(mid, hi, (t - 0.5) * 2);
    const c2 = h <= 0 ? (night ? [20, 34, 48] : [170, 196, 214]) : base.map(v => v * shade);
    d[4 * i] = c2[0]; d[4 * i + 1] = c2[1]; d[4 * i + 2] = c2[2]; d[4 * i + 3] = 255;
  }
  cx.putImageData(img, 0, 0);
  return c;
}

/** Contour lines of a grid every `every` metres, by marching squares on every `skip`th sample, as one path in grid units. */
export function contours(g, { every = 100, skip = 2 } = {}) {
  const thin = new Path2D(), bold = new Path2D(), H = (r, q) => g.data[Math.min(g.rows - 1, r) * g.cols + Math.min(g.cols - 1, q)];
  for (let r = 0; r < g.rows - skip; r += skip) for (let q = 0; q < g.cols - skip; q += skip) {
    const a = H(r, q), b = H(r, q + skip), c = H(r + skip, q + skip), d = H(r + skip, q);
    const lo = Math.min(a, b, c, d), hi = Math.max(a, b, c, d);
    for (let lv = Math.ceil(lo / every) * every; lv <= hi; lv += every) {
      if (lv <= 0) continue;
      const pts = [];
      const edge = (h1, h2, x1, y1, x2, y2) => { if ((h1 < lv) !== (h2 < lv)) { const t = (lv - h1) / (h2 - h1); pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]); } };
      edge(a, b, q, r, q + skip, r); edge(b, c, q + skip, r, q + skip, r + skip); edge(c, d, q + skip, r + skip, q, r + skip); edge(d, a, q, r + skip, q, r);
      const p = lv % 500 === 0 ? bold : thin;
      for (let k = 0; k + 1 < pts.length; k += 2) { p.moveTo(pts[k][0], pts[k][1]); p.lineTo(pts[k + 1][0], pts[k + 1][1]); }
    }
  }
  return { thin, bold };
}

/** One contour, at `level` metres, by marching squares on every sample: the line your altimeter puts you on. */
export function contourAt(g, level) {
  const p = new Path2D(), H = (r, q) => g.data[r * g.cols + q];
  for (let r = 0; r < g.rows - 1; r++) for (let q = 0; q < g.cols - 1; q++) {
    const a = H(r, q), b = H(r, q + 1), c = H(r + 1, q + 1), d = H(r + 1, q);
    if (Math.min(a, b, c, d) > level || Math.max(a, b, c, d) < level) continue;
    const pts = [], edge = (h1, h2, x1, y1, x2, y2) => { if ((h1 < level) !== (h2 < level)) { const t = (level - h1) / (h2 - h1); pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]); } };
    edge(a, b, q, r, q + 1, r); edge(b, c, q + 1, r, q + 1, r + 1); edge(c, d, q + 1, r + 1, q, r + 1); edge(d, a, q, r + 1, q, r);
    for (let k = 0; k + 1 < pts.length; k += 2) { p.moveTo(pts[k][0], pts[k][1]); p.lineTo(pts[k + 1][0], pts[k + 1][1]); }
  }
  return p;
}

/** The map's frame: grid units to screen and back, for a centre (grid units) and a zoom (screen pixels a grid unit). */
export function mapFrame(g, w, h, { cx, cy, k }) {
  const kx = k * Math.cos(((g.s + g.n) / 2) * RAD) * ((g.e - g.w) / (g.cols - 1)) / ((g.n - g.s) / (g.rows - 1));   // a column is narrower on the ground than a row
  return {
    k, kx,
    toScreen: (lat, lon) => ({ x: w / 2 + ((lon - g.w) / (g.e - g.w) * (g.cols - 1) - cx) * kx, y: h / 2 + ((g.n - lat) / (g.n - g.s) * (g.rows - 1) - cy) * k }),
    fromScreen: (x, y) => ({ lat: g.n - (cy + (y - h / 2) / k) / (g.rows - 1) * (g.n - g.s), lon: g.w + (cx + (x - w / 2) / kx) / (g.cols - 1) * (g.e - g.w) }),
    gridToScreen: (q, r) => ({ x: w / 2 + (q - cx) * kx, y: h / 2 + (r - cy) * k }),
  };
}
