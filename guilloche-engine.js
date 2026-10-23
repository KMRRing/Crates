// Guilloché's workshop, pure (no page: the tests run it in Node). A rose engine cuts these patterns: the plate turns, and
// a cutting point rides in and out as the plate turns, pushed by a rosette, a disc with a wavy edge that a rubbing block
// follows. The point stays at one distance from the centre except for what the rosette gives it, so one pass is a ring
// with as many waves as the rosette has lobes, as deep as the rosette's throw. The pattern comes from many passes: between
// one pass and the next the rosette is turned a little (the index), so each ring's waves sit a little round from the last
// and the rings cross, and the crossings are the lattice a guilloché is. A feed that steps the cut outward on each pass
// makes a ribbon of it, a second rosette riding on the first weaves a basket, and a dial is several such cuts, each in its
// own zone of the plate.
//
// So the game gives a target, engraved, and a machine with its settings bare: set the rosette's lobes and throw, how many
// passes and how far to index between them, until the plate you cut is the target's. Each cut is one radius R; a pass j
// is r(θ) = R + j·feed + throw · rosette(lobes·θ + j·index) + throw2 · sin(lobes2·θ), all on a plate of radius 1. The
// plates are compared as pictures (rasters), so what is checked is the engraving, not the settings: any way of
// setting the machine that engraves the same plate is as good.
export const G = 192;                                       // a plate is drawn on a grid of G squares across, for comparing
export const WIN = 0.99;                                    // how much alike two plates must be to be the same (1 is alike to a pixel)
export const STARS = [1, 2, 3];
export const SLACK = { three: [1.5, 2], two: [3, 4] };      // taps allowed over par for three stars and for two, as in Loom

/** The rosettes' edges: a wave, scallops (arches meeting at cusps, the barleycorn's grain) and points (a triangle wave). */
export const SHAPES = [{ id: "wave", name: "Wave" }, { id: "scallop", name: "Scallop" }, { id: "point", name: "Point" }];
const EDGE = [p => Math.sin(p), p => 2 * Math.abs(Math.sin(p / 2)) - 1, p => (2 / Math.PI) * Math.asin(Math.sin(p))];
const UNIT = { a: 0.02, feed: 0.006 };                      // plate radii a step of throw, and of feed, is

/** The machine's knobs: every one a whole number of steps, so a setting is exact and two settings are the same or they aren't. */
export const KNOBS = {
  k: { name: "Lobes", min: 2, max: 24, def: 2, say: v => `${v}` },
  a: { name: "Throw", min: 1, max: 10, def: 1, say: v => `${v}` },
  shape: { name: "Rosette", min: 0, max: 2, def: 0, say: v => SHAPES[v].name },
  n: { name: "Passes", min: 1, max: 40, def: 1, say: v => `${v}` },
  index: { name: "Index", min: -180, max: 180, step: 5, def: 0, say: v => `${v}°` },
  feed: { name: "Feed", min: -8, max: 8, def: 0, say: v => `${v}` },
  k2: { name: "Lobes 2", min: 1, max: 12, def: 1, say: v => `${v}` },
  a2: { name: "Throw 2", min: 0, max: 8, def: 0, say: v => `${v}` },
};
export const stepOf = name => KNOBS[name].step || 1;
export const clampKnob = (name, v) => { const K = KNOBS[name], s = stepOf(name); return Math.max(K.min, Math.min(K.max, Math.round(v / s) * s)); };
const BARE = { k: 2, a: 1, shape: 0, n: 1, index: 0, feed: 0, k2: 1, a2: 0 };

// ---------- cutting ----------
/** The passes of one cut, as lists of points [x0, y0, x1, y1, …] on a plate of radius 1 (a point's angle 0 at twelve o'clock, clockwise). */
export function passes(cut) {
  const { R, k, a, shape, n, index, feed, k2, a2 } = cut, edge = EDGE[shape] || EDGE[0], out = [];
  const M = 720, step = (index * Math.PI) / 180;
  for (let j = 0; j < n; j++) {
    const pts = new Float32Array((M + 1) * 2), base = R + feed * UNIT.feed * j;
    for (let m = 0; m <= M; m++) {
      const t = (m / M) * 2 * Math.PI;
      let r = base + a * UNIT.a * edge(k * t + j * step);
      if (a2) r += a2 * UNIT.a * Math.sin(k2 * t);
      r = Math.max(0.01, Math.min(0.99, r));
      pts[2 * m] = r * Math.sin(t);
      pts[2 * m + 1] = -r * Math.cos(t);
    }
    out.push(pts);
  }
  return out;
}
/** A plate as a picture: G squares across, in each the number of times a pass crosses it (so a pass more or less shows). */
export function raster(cuts) {
  const img = new Uint16Array(G * G), c = G / 2;
  for (const cut of cuts) for (const pts of passes(cut)) {
    for (let m = 0; m < pts.length - 2; m += 2) {
      const x0 = c + pts[m] * c, y0 = c + pts[m + 1] * c, x1 = c + pts[m + 2] * c, y1 = c + pts[m + 3] * c;
      const len = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
      for (let q = 0; q <= len; q++) {
        const x = Math.floor(x0 + ((x1 - x0) * q) / len), y = Math.floor(y0 + ((y1 - y0) * q) / len);
        if (x >= 0 && y >= 0 && x < G && y < G) img[y * G + x]++;
      }
    }
  }
  return img;
}
/**
 * How alike two plates are, 0 to 1: one less what the two differ by, as a share of the more engraved. It is the same
 * only for the same engraving (the settings that cut a plate are exact, and one step of any of them shows), not for one
 * that merely looks near, as a dense rose would, but a pass more or less and every pixel's count would tell.
 */
export function alike(a, b) {
  let na = 0, nb = 0, diff = 0;
  for (let i = 0; i < a.length; i++) { na += a[i]; nb += b[i]; diff += Math.abs(a[i] - b[i]); }
  return na && nb ? Math.max(0, 1 - diff / Math.max(na, nb)) : 0;
}

/** A picture with each square's count spread over the squares within `r` of it (a box blur), as numbers. */
function blur(img, r = 3) {
  const tmp = new Float32Array(G * G), out = new Float32Array(G * G);
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { let t = 0; for (let d = -r; d <= r; d++) { const X = x + d; if (X >= 0 && X < G) t += img[y * G + X]; } tmp[y * G + x] = t; }
  for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) { let t = 0; for (let d = -r; d <= r; d++) { const Y = y + d; if (Y >= 0 && Y < G) t += tmp[Y * G + x]; } out[y * G + x] = t; }
  return out;
}
/**
 * How near a plate is to another, 0 to 1, for telling a hand which way to go: `alike` of the two with each spread over a
 * few squares round it. Unlike `alike` it forgives a little, so a step off still reads as near and a ring cut a little
 * out of true overlaps its target, but a plate is the target's only when `alike` says so.
 */
export function near(a, b, blurA = blur(a), blurB = blur(b)) {
  let na = 0, nb = 0, diff = 0;
  for (let i = 0; i < blurA.length; i++) { na += blurA[i]; nb += blurB[i]; diff += Math.abs(blurA[i] - blurB[i]); }
  return na && nb ? Math.max(0, 1 - diff / Math.max(na, nb)) : 0;
}

// ---------- the levels ----------
/**
 * Each level teaches a part of the machine. A cut: its radius R, the knobs fixed for it (shown, not yours), and the knobs
 * that are yours (`free`), each with the range the target's value is drawn from.
 */
const cut = (R, fixed, ranges) => ({ R, fixed: { ...BARE, ...fixed }, ranges, free: Object.keys(ranges) });
export const LEVELS = [
  { id: "wave", name: "Wave ring",
    story: "One pass of a rose engine: the plate turns once while a rosette pushes the cutting point in and out. The rosette's lobes are the waves in the ring; its throw is how deep they go.",
    cuts: [cut(0.55, {}, { k: [3, 12], a: [2, 6] })] },
  { id: "edge", name: "Scallops and points",
    story: "The edge of the rosette is the shape of the wave: a smooth wave cuts a sine, scallops (the barleycorn's grain) cut arches that meet in cusps, points cut a zigzag.",
    cuts: [cut(0.55, {}, { k: [6, 16], a: [3, 7], shape: [1, 2] })] },
  { id: "rose", name: "Rose", closed: true,
    story: "Many passes, the rosette turned a little between each (the index): the rings cross, and the crossings are the pattern. Turned a whole lobe in all, the passes come round and the rose closes: passes times index is 360°.",
    cuts: [cut(0.5, { shape: 0 }, { k: [3, 8], a: [3, 6], n: [6, 24], index: [15, 60] })] },
  { id: "ribbon", name: "Ribbon",
    story: "A feed steps each pass a little outward: the rings no longer share a radius, and the passes lay out a band, a ribbon of crossings, rather than a rose.",
    cuts: [cut(0.3, { shape: 0 }, { k: [3, 9], a: [2, 4], n: [8, 22], index: [10, 40], feed: [1, 4] })] },
  { id: "basket", name: "Basket",
    story: "A second rosette riding on the first adds its own waves to the pass: the ring is woven, a basket, and every pass is woven alike.",
    cuts: [cut(0.5, { shape: 0 }, { k: [4, 10], a: [2, 4], k2: [2, 7], a2: [1, 3], n: [8, 20], index: [10, 45] })] },
  { id: "dial", name: "Two zones",
    story: "A dial is cuts in zones: a rose in the centre and a scalloped ring round it, each its own cut with its own rosette. Tap a cut's tab to set it.",
    cuts: [cut(0.28, { shape: 0 }, { k: [3, 7], a: [2, 3], n: [6, 16], index: [15, 60] }), cut(0.78, { shape: 1 }, { k: [10, 24], a: [2, 5] })] },
  { id: "three", name: "Three zones",
    story: "Rose, ribbon and ring: a centre, a band and an edge, each cut with its own settings. What reads as one pattern is three cuts that happen to meet.",
    cuts: [cut(0.2, { shape: 0 }, { k: [3, 6], a: [2, 2], n: [6, 14], index: [20, 60] }), cut(0.45, { shape: 0 }, { k: [4, 9], a: [2, 3], n: [6, 16], index: [10, 40], feed: [1, 3] }), cut(0.85, { shape: 2 }, { k: [12, 24], a: [2, 4] })] },
  { id: "master", name: "Master dial",
    story: "The full engine: a woven centre, a ribbon, and a barleycorn rim, three cuts, two of them with a second rosette. Someone who can set this knows how every guilloché is made.",
    cuts: [cut(0.2, { shape: 0 }, { k: [3, 6], a: [2, 2], n: [6, 14], index: [20, 60], k2: [2, 5], a2: [1, 2] }), cut(0.45, { shape: 0 }, { k: [4, 9], a: [2, 3], n: [6, 16], index: [10, 40], feed: [1, 3] }), cut(0.85, { shape: 1 }, { k: [12, 24], a: [2, 4], k2: [2, 6], a2: [1, 2] })] },
];

// ---------- chance ----------
function draw(seed, n) {
  let a = (Math.imul((seed >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((n >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
  a = (a + 0x6D2B79F5) >>> 0;
  let t = Math.imul(a ^ (a >>> 15), a | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rng = seed => { let n = 0; return () => draw(seed, n++); };
const between = (r, [lo, hi], step = 1) => lo + step * Math.floor(r() * ((hi - lo) / step + 1));

/** A cut's settings in full: its radius, its fixed knobs, and the free ones from `vals`. */
export const settingsOf = (c, vals) => ({ R: c.R, ...c.fixed, ...vals });
const plateOf = (cuts, vals) => raster(cuts.map((c, i) => settingsOf(c, vals[i])));

/** The knobs a step either way of which should be told apart, as [cut, knob, step]. */
const neighbours = cuts => cuts.flatMap((c, i) => c.free.flatMap(name => [[i, name, -stepOf(name)], [i, name, stepOf(name)]]));

/**
 * A job: a level made from a seed. The answer is a hidden setting of every cut's free knobs, drawn from the level's
 * ranges so that every free knob differs from where the machine starts, and a step either way of any one of them changes
 * the plate enough to tell (no setting is nearly right but wrong); the best of sixty draws if none is quite that clear.
 * `par` is the knobs to set, a tap each, and `goal` the plate.
 */
export function makeJob(index, seed) {
  const L = LEVELS[index], r = rng(seed >>> 0);
  let best = null;
  for (let tries = 0; tries < 60; tries++) {
    const answer = L.cuts.map(c => {
      const v = {};
      for (const name of c.free) {
        do v[name] = between(r, c.ranges[name], stepOf(name)); while (v[name] === BARE[name]);
      }
      if (L.closed) { const ix = [15, 20, 30, 45, 60].filter(x => x >= c.ranges.index[0] && x <= c.ranges.index[1]); v.index = ix[Math.floor(r() * ix.length)]; v.n = 360 / v.index; }
      return v;
    });
    const goal = plateOf(L.cuts, answer);
    let worst = 0;
    for (const [i, name, d] of neighbours(L.cuts)) {
      const was = answer[i][name], now = clampKnob(name, was + d);
      if (now === was) continue;
      answer[i][name] = now;
      worst = Math.max(worst, alike(goal, plateOf(L.cuts, answer)));
      answer[i][name] = was;
    }
    if (!best || worst < best.worst) best = { answer, goal, worst };
    if (worst < WIN - 0.005) break;
  }
  const par = L.cuts.reduce((n, c) => n + c.free.length, 0);
  return { index, id: L.id, name: L.name, story: L.story, seed: seed >>> 0, cuts: L.cuts, answer: best.answer, goal: best.goal, blurGoal: blur(best.goal), par, clear: best.worst };
}

// ---------- a run ----------
/** A run: every cut's free knobs where the machine starts, a count of taps, and a note of the cut being set. */
export function newRun(job) {
  return { job: job.index, seed: job.seed, vals: job.cuts.map(c => Object.fromEntries(c.free.map(name => [name, BARE[name]]))), at: 0, taps: 0, done: null };
}
export const platesOf = (job, run) => job.cuts.map((c, i) => settingsOf(c, run.vals[i]));
/** How alike the target the plate is now, 0 to 1 (exact). */
export const match = (job, run) => alike(job.goal, raster(platesOf(job, run)));
export const solved = (job, run) => match(job, run) >= WIN;
/** How near to the target the plate is, for the line under it (forgiving; `solved` is not). */
export const closeness = (job, run) => near(job.goal, raster(platesOf(job, run)), job.blurGoal);
/**
 * A knob set to a value (clamped to its range and step). Returns what it was, for Undo, or null if it was there already.
 * `fresh` is a new tap: a hold that keeps stepping a knob goes on counting as the one.
 */
export function setKnob(job, run, cutNo, name, v, fresh = true) {
  const c = job.cuts[cutNo];
  if (run.done || !c || !c.free.includes(name)) return null;
  v = clampKnob(name, v);
  const was = run.vals[cutNo][name];
  if (v === was) return null;
  run.vals[cutNo][name] = v;
  if (fresh) run.taps++;
  return { cut: cutNo, name, was, fresh };
}
/** Takes a batch of changes back (what one finger did), last first; the tap it cost goes too. */
export function undo(job, run, batch) {
  if (run.done) return;
  for (const ch of [...batch].reverse()) run.vals[ch.cut][ch.name] = ch.was;
  if (batch.some(ch => ch.fresh)) run.taps = Math.max(0, run.taps - 1);
}

// ---------- the grade ----------
/** Stars by taps against par: up to a half over (and two) is three; up to three times (and four) two; any finish one. */
export function starsFor(job, taps) {
  const f = (k, a) => Math.ceil(job.par * k[0]) + k[1] + a;
  return taps <= f(SLACK.three, 0) ? 3 : taps <= f(SLACK.two, 0) ? 2 : 1;
}
/** Closes the run once the plate is the target's: { taps, stars } once, then null. */
export function finish(job, run) {
  if (run.done || !solved(job, run)) return null;
  run.done = { taps: run.taps, stars: starsFor(job, run.taps) };
  return run.done;
}
/** What the line under the plate says. */
export function say(job, run) {
  if (run.done) return `Engraved in ${run.done.taps} tap${run.done.taps === 1 ? "" : "s"}; a hand that knows the machine sets it in ${job.par}.`;
  const m = closeness(job, run), pct = Math.floor(m * 100);
  return m >= 0.97 ? `${pct}% like the target: something is a step off.` : `${pct}% like the target. Hold the plate to see the target alone.`;
}
