// Columbiad's globes: the Earth and the moons as lit spheres, drawn into a small off-screen canvas by an orthographic mapping of an
// equirectangular map (the maths is columbiad-sphere.js, which has no page in it; this file owns the canvases and the maps). The
// page asks for a globe's picture at a spin and a Sun and gets the cached canvas back unless the spin has moved by a fraction of a
// pixel or the Sun, the size or a map changed; a globe turns smoothly because a render is a bilinear read of the map at the exact
// spin, so the page can ask on every frame. Nothing here touches a rule: the game's physics is columbiad-engine.js and never reads
// a picture.
//
// The Earth's map is NASA's Blue Marble (public domain, see docs/licences-images-and-engines.md), 1024 x 512, loaded lazily from
// its own file and painted over (columbiad-sphere.js, `paintEarth`); until it arrives, and if it never does, the Earth is a plain
// ocean-blue sphere. The clouds and the moons' maps are made here from noise and craters, the first time they are wanted.
import { buildSphere, renderSphere, sunOf, turnForPixels, withMips } from "./columbiad-sphere.js";
export { sunOf };
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

let earthMap = null, earthAsked = false, moonTex = null, cloudTex = null, warming = null;
// ---------- the Earth's worker ----------
// The Earth is the one big sphere (a whole disc of pixels, thirty times a second), so once its map has arrived it is drawn by a
// worker (columbiad-earth-worker.js, the same columbiad-sphere.js maths) and the page only puts the finished bytes on a canvas.
// Where there is no Worker (an old browser, a Node test) or it fails, the page draws the Earth itself, as it always did.
let wk = null, wkBroken = typeof Worker === "undefined" || typeof document === "undefined", wkMap = false, wkClouds = false;
function earthWorker() {
  if (wkBroken || !earthMap) return null;
  if (!wk) {
    try {
      wk = new Worker(new URL("./columbiad-earth-worker.js", import.meta.url), { type: "module" });
      wk.addEventListener("error", () => { wkBroken = true; wk = null; });
    } catch { wkBroken = true; return null; }
  }
  toWorker();
  return wk;
}
/** Sends the worker the maps it has not been sent (messages are in order, so a picture asked for afterwards has them). */
function toWorker() {
  if (!wk) return;
  if (earthMap && !wkMap) { wk.postMessage({ map: { w: earthMap.w, h: earthMap.h, data: earthMap.data } }); wkMap = true; }
  if (cloudTex && !wkClouds) { wk.postMessage({ clouds: { w: cloudTex.w, h: cloudTex.h, a: cloudTex.a } }); wkClouds = true; }
}
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
        earthMap = withMips({ w: c.width, h: c.height, data: d.data });
        toWorker();
        for (const f of waiting) f();
        waiting.clear();
      } catch { /* a map that will not read leaves the plain sphere */ }
    };
    img.onerror = () => { earthAsked = false; };
    img.src = "columbiad-earth.jpg";
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
    toWorker();
    for (let j = 0; j < 256; j += 8) { moonRows(mt, j, j + 8); await later(); }
    moonTex = withMips(mt);
    for (const f of waiting) f();
    waiting.clear();
  })();
}

/**
 * A globe: `kind` "earth" (the map, painted, clouds, a graticule, a rim of air) or "moon" (cratered grey, the Sun's phase).
 * picture(spin, sun, S) is the off-screen canvas of the sphere (its disc takes S / pad of the canvas; pad is 1.12 for the Earth, the
 * room its air needs, else 1). It is drawn again when the spin has moved by `look` of a pixel at the rim (and not sooner than
 * `gap` milliseconds after the last drawing, so a busy page is not asked for every frame), and at once when the Sun, the size or
 * a map changed. `onFresh` is called when the worker has brought a new picture (for a page that is not drawing by itself).
 */
export function createGlobe(kind, { tilt = 22, roll = 0, tint = [1, 1, 1], look = 0.12, gap = 0, onFresh = null } = {}) {
  const earth = kind === "earth", pad = earth ? 1.12 : 1;
  const mine = new Map();                                      // size -> { cv, g (2d context), img, geo, sk, key, spin, at }
  const plainMap = { w: 2, h: 1, data: new Uint8ClampedArray([22, 52, 96, 255, 22, 52, 96, 255]) };
  const mapNow = () => (earth ? earthMap || plainMap : moonTex || GREY);
  function entry(S, sun) {
    const sk = `${S}|${sun[0].toFixed(3)},${sun[1].toFixed(3)}|${mapNow().w}`;     // the map's width too: how many reads a pixel needs depends on it
    let e = mine.get(S);
    if (e && e.sk === sk) { mine.delete(S); mine.set(S, e); return e; }          // most recent last
    if (!e) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = S;
      e = { cv, g: cv.getContext("2d", { willReadFrequently: true }) };
      while (mine.size >= 2) mine.delete(mine.keys().next().value);              // the geometry is big: only the two sizes in use are kept
    } else mine.delete(S);
    e.img = e.g.createImageData(S, S);
    const m = mapNow();
    let air = null;
    if (earth) {                                                // the air round the Earth: its own canvas, drawn once
      if (!e.air) { e.air = document.createElement("canvas"); e.air.width = e.air.height = S; }
      const ag = e.air.getContext("2d"), ai = ag.createImageData(S, S);
      air = ai.data;
      e.geo = buildSphere(S, { pad, tilt, roll, sun, earth, texW: m.w, texH: m.h, mips: m.mips?.length }, air);
      ag.putImageData(ai, 0, 0);
    } else e.geo = buildSphere(S, { pad, tilt, roll, sun, earth, texW: m.w, texH: m.h, mips: m.mips?.length }, null);
    e.sk = sk; e.key = ""; e.at = -1e9; e.spin = 0;
    mine.set(S, e);
    return e;
  }
  // The Earth through the worker: one picture asked for at a time, and the page shows the latest that has come back (the Earth turns
  // slowly, so a picture a moment old is the same picture to the eye). A size nobody has drawn yet shows the nearest size that is
  // drawn, scaled by the page, until its own arrives.
  const far = new Map();                                       // size -> { cv, g, air (canvas), spin, key, ok }
  let busy = null, spare = null, askedAt = -1e9, serial = 0, version = 0, seen = 0, lastS = 0, lastSun = null, listening = null;
  function listen(w) {
    if (listening === w) return;
    listening = w;
    w.addEventListener("message", ({ data }) => {
      if (!busy || data.id !== busy.id) return;
      const { S, key } = busy, e = far.get(S);
      busy = null; spare = data.buf;
      if (!e) return;
      if (data.air) {
        if (!e.air) { e.air = document.createElement("canvas"); e.air.width = e.air.height = S; }
        e.air.getContext("2d").putImageData(new ImageData(new Uint8ClampedArray(data.air), S, S), 0, 0);
      }
      e.g.putImageData(new ImageData(new Uint8ClampedArray(data.buf), S, S), 0, 0);
      e.spin = data.turn; e.key = key; e.ok = true; version++;
      mine.clear();                                            // the plain sphere this thread drew and its geometry are not wanted now
      onFresh?.();
    });
  }
  function ask(w, spin, sun, S, e) {
    if (busy) return;
    const key = wkClouds ? "c" : "n", now = performance.now();
    if (e.ok && key === e.key && !(Math.abs(spin - e.spin) >= turnForPixels(S, pad, look) && now - askedAt >= gap)) return;
    busy = { id: ++serial, S, key }; askedAt = now;
    w.postMessage({ draw: { id: busy.id, S, sun, tilt, roll, pad, turn: spin, tint }, buf: spare }, spare ? [spare] : []);
    spare = null;
  }
  function remote(w, spin, sun, S) {
    listen(w);
    lastS = S; lastSun = sun;
    let e = far.get(S);
    if (e) { far.delete(S); far.set(S, e); }
    else {
      const cv = document.createElement("canvas");
      cv.width = cv.height = S;
      e = { cv, g: cv.getContext("2d"), air: null, spin: 0, key: "", ok: false };
      far.set(S, e);
      while (far.size > 3) far.delete(far.keys().next().value);
    }
    ask(w, spin, sun, S, e);
    seen = version;
    if (e.ok) return e.cv;
    let near = null;
    for (const o of far.values()) if (o.ok && (!near || Math.abs(o.cv.width - S) < Math.abs(near.cv.width - S))) near = o;
    // nothing of the Earth is drawn yet: what this thread drew before (the plain sphere) stands, and failing that it draws one itself
    return near ? near.cv : mine.get(S)?.cv || picture(spin, sun, S, true);
  }
  function picture(spin, sun, S, here) {
    const w = earth && !here && earthWorker();
    if (w) return remote(w, spin, sun, S);
    const e = entry(S, sun), key = `${earthMap ? 1 : 0}${cloudTex ? 1 : 0}${moonTex ? 1 : 0}`, now = performance.now();
    if (key !== e.key || (Math.abs(spin - e.spin) >= turnForPixels(S, pad, look) && now - e.at >= gap)) {
      renderSphere(e.geo, e.img.data, mapNow(), earth ? cloudTex : null, spin, tint);
      e.g.putImageData(e.img, 0, 0);
      e.key = key; e.spin = spin; e.at = now;
    }
    return e.cv;
  }
  return {
    pad,
    /** The sphere's canvas at `spin` (turns, any real number), lit from `sun`, `S` pixels across (the whole canvas, the air included). */
    picture: (spin, sun, S) => picture(spin, sun, S, false),
    /**
     * Whether the picture on show is out of date at `spin`, for a page that has nothing else to draw (and so draws only when this
     * says so). The Earth's worker is asked here too, so a picture is on its way when the page next looks.
     */
    changed(spin) {
      const w = earth && earthWorker(), e = w && far.get(lastS);
      if (!e || !lastSun) return true;
      ask(w, spin, lastSun, lastS, e);
      return version !== seen;
    },
    /** The air round the Earth, a canvas the size of the picture (null for a moon), once it has been drawn. */
    air(S) { return far.get(S)?.air || mine.get(S)?.air || null; },
    /** Whether the Earth's map is still to come. */
    get plain() { return earth && !earthMap; },
  };
}
