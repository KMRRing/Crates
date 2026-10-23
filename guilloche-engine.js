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
export const CLUE_CAP = [3, 3, 2, 1];                       // the most stars a plate can earn after the clues taken (a clue of 0: none; 1: where to look; 2: which way; 3: the answer)
/** What each cut of a dial with two or three is called (the tabs). */
export const CUT_NAMES = { 2: ["Centre", "Ring"], 3: ["Centre", "Band", "Rim"] };
/** The tabs of a level: its own names if it has them (the registers), else by how many cuts it has. */
export const cutNames = index => LEVELS[index].names || CUT_NAMES[LEVELS[index].cuts.length] || [];

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
/**
 * The passes of one cut, as lists of points [x0, y0, x1, y1, …] on a plate of radius 1 (a point's angle 0 at twelve o'clock,
 * clockwise). A cut is usually round the plate's centre; a register (a small dial of its own) has `at`, where its centre is,
 * and `size`, its radius, and cuts everything (its radius R, its throw, its feed) to that scale.
 */
export function passes(cut) {
  const { R, k, a, shape, n, index, feed, k2, a2, at = [0, 0], size = 1 } = cut, edge = EDGE[shape] || EDGE[0], out = [];
  const M = 720, step = (index * Math.PI) / 180;
  for (let j = 0; j < n; j++) {
    const pts = new Float32Array((M + 1) * 2), base = R + feed * UNIT.feed * j;
    for (let m = 0; m <= M; m++) {
      const t = (m / M) * 2 * Math.PI;
      let r = base + a * UNIT.a * edge(k * t + j * step);
      if (a2) r += a2 * UNIT.a * Math.sin(k2 * t);
      r = Math.max(0.01, Math.min(0.99, r));
      pts[2 * m] = at[0] + size * r * Math.sin(t);
      pts[2 * m + 1] = at[1] - size * r * Math.cos(t);
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
const cut = (R, fixed, ranges, place = {}) => ({ R, ...place, fixed: { ...BARE, ...fixed }, ranges, free: Object.keys(ranges) });
/** Where a register sits on the plate: its centre and radius, in plate radii. */
const reg = (x, y, size) => ({ at: [x, y], size });
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
  // The registers: small dials of their own on the face, each cut as a plate in itself, so a face can carry several kinds of guilloché
  // side by side, as a chronograph's does (a rose in one, a ribbon in the next, a barleycorn rim round them all).
  { id: "registers", name: "Registers", names: ["Rim", "Left", "Right"],
    story: "A face can be several dials in one: two small registers, each cut as a plate of its own with its own rosette, inside a pointed rim. A register is set exactly as a whole plate is; only its place and size are fixed.",
    cuts: [cut(0.88, { shape: 2 }, { k: [12, 24], a: [2, 4] }),
      cut(0.5, { shape: 0 }, { k: [3, 7], a: [2, 4], n: [6, 16], index: [15, 60] }, reg(-0.4, 0.06, 0.3)),
      cut(0.3, { shape: 0 }, { k: [3, 8], a: [2, 4], n: [8, 18], index: [10, 40], feed: [1, 3] }, reg(0.4, 0.06, 0.3))] },
  { id: "chrono", name: "Chrono", names: ["Rim", "Left", "Right", "Base"],
    story: "The chronograph's face: a scalloped rim and three registers, a rose, a woven basket and a ribbon, three kinds of guilloché in three places. Read each register on its own.",
    cuts: [cut(0.9, { shape: 1 }, { k: [14, 24], a: [2, 4] }),
      cut(0.5, { shape: 0 }, { k: [3, 7], a: [2, 4], n: [6, 16], index: [15, 60] }, reg(-0.42, -0.04, 0.28)),
      cut(0.5, { shape: 0 }, { k: [4, 8], a: [2, 3], k2: [2, 6], a2: [1, 2], n: [8, 16], index: [10, 45] }, reg(0.42, -0.04, 0.28)),
      cut(0.3, { shape: 0 }, { k: [3, 8], a: [2, 4], n: [8, 18], index: [10, 40], feed: [1, 3] }, reg(0, 0.5, 0.28))] },
  { id: "grand", name: "Grand", names: ["Rim", "Hub", "Left", "Right", "Base"],
    story: "Five cuts: a barleycorn rim, a hub and three registers, with a second rosette in two of them. A face with several kinds of guilloché in its several places, each one read and set on its own.",
    cuts: [cut(0.9, { shape: 1 }, { k: [14, 24], a: [2, 4], k2: [2, 6], a2: [1, 2] }),
      cut(0.5, { shape: 0 }, { k: [3, 6], a: [2, 3], k2: [2, 5], a2: [1, 2], n: [6, 14], index: [20, 60] }, reg(0, -0.3, 0.27)),
      cut(0.5, { shape: 2 }, { k: [4, 10], a: [2, 4], n: [6, 14], index: [15, 60] }, reg(-0.42, 0.1, 0.26)),
      cut(0.5, { shape: 0 }, { k: [4, 8], a: [2, 3], k2: [2, 6], a2: [1, 2], n: [8, 16], index: [10, 45] }, reg(0.42, 0.1, 0.26)),
      cut(0.3, { shape: 0 }, { k: [3, 8], a: [2, 4], n: [8, 18], index: [10, 40], feed: [1, 3] }, reg(0, 0.5, 0.26))] },
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
export const settingsOf = (c, vals) => ({ R: c.R, at: c.at, size: c.size, ...c.fixed, ...vals });
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
  return { job: job.index, seed: job.seed, vals: job.cuts.map(c => Object.fromEntries(c.free.map(name => [name, BARE[name]]))), at: 0, taps: 0, clues: 0, done: null };
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
/** Stars by taps against par: up to a half over (and two) is three; up to three times (and four) two; any finish one. Clues cap them (CLUE_CAP). */
export function starsFor(job, taps, clues = 0) {
  const f = (k, a) => Math.ceil(job.par * k[0]) + k[1] + a;
  return Math.min(taps <= f(SLACK.three, 0) ? 3 : taps <= f(SLACK.two, 0) ? 2 : 1, CLUE_CAP[clues] ?? 1);
}
/** Closes the run once the plate is the target's: { taps, stars } once, then null. */
export function finish(job, run) {
  if (run.done || !solved(job, run)) return null;
  run.done = { taps: run.taps, stars: starsFor(job, run.taps, run.clues), clues: run.clues || 0 };
  return run.done;
}
/** What the line under the plate says. */
export function say(job, run) {
  if (run.done) return `Engraved in ${run.done.taps} tap${run.done.taps === 1 ? "" : "s"}; a hand that knows the machine sets it in ${job.par}.`;
  const m = closeness(job, run), pct = Math.floor(m * 100);
  return m >= 0.97 ? `${pct}% like the target: something is a step off.` : `${pct}% like the target. Hold the plate to see the target alone.`;
}

// ---------- clues ----------
// A clue is told from the answer and costs stars, by how much it gives away: where to look (free: it only says how to
// read the target), which way and how far (two stars at most), the setting itself (one). The knob it is about is the one
// that, set right, would bring the plate nearest the target, so a clue is never about a knob that doesn't matter.
const READ = {
  k: "Count the waves in the target's ring: that many is Lobes.",
  a: "Look at how deep the waves cut in and out of the ring: that is Throw.",
  shape: "Look at the shape of the waves: smooth, arches that meet in cusps, or a zigzag. That is the Rosette.",
  n: "Count the rings laid over one another: that many is Passes.",
  index: "Look at how far each ring sits round from the last: that is Index.",
  feed: "Do the rings spread outward into a band? How far apart they are is Feed.",
  k2: "Look for a small ripple riding on the big waves: its count is Lobes 2.",
  a2: "How strong is that small ripple? That is Throw 2.",
};
const EDGES = ["smooth, rounded waves", "arches meeting in sharp cusps", "straight runs meeting in sharp tips"];

/** The knob that, set right, would bring the plate nearest the target: { cut, name }, or null if every knob is right. */
function worstKnob(job, run) {
  const trial = { ...run, vals: run.vals.map(v => ({ ...v })) }, base = alike(job.goal, raster(platesOf(job, trial)));
  let best = null;
  job.cuts.forEach((c, i) => c.free.forEach(name => {
    const was = trial.vals[i][name], want = job.answer[i][name];
    if (was === want) return;
    trial.vals[i][name] = want;
    const gain = alike(job.goal, raster(platesOf(job, trial))) - base;
    trial.vals[i][name] = was;
    if (!best || gain > best.gain) best = { cut: i, name, gain };
  }));
  return best && { cut: best.cut, name: best.name };
}
/** The words of a clue of a tier (1 to 3) about a knob of a cut. */
export function clueText(job, run, cutNo, name, tier) {
  const K = KNOBS[name], was = run.vals[cutNo][name], want = job.answer[cutNo][name];
  const where = job.cuts.length > 1 ? `${cutNames(job.index)[cutNo]} cut, tab ${cutNo + 1}: ` : "";
  const closed = LEVELS[job.index].closed && (name === "n" || name === "index");
  if (tier === 1) return `${where}${READ[name]}${closed ? " On a closed rose, passes × index is 360°." : ""}`;
  if (tier === 2) {
    if (name === "shape") return `${where}the waves are ${EDGES[want]}.`;
    const span = (K.max - K.min) / stepOf(name), far = Math.abs(want - was) / stepOf(name) / span;
    return `${where}${K.name} needs to go ${want > was ? "up" : "down"}${far <= 0.15 ? " a little" : far <= 0.45 ? " a fair way" : " a long way"}.`;
  }
  const at = job.answer[cutNo];
  return `${where}${K.name} is ${K.say(want)}.${closed ? ` (${at.n} passes × ${at.index}° = 360°)` : ""}`;
}
/**
 * Takes a clue: about the knob that matters most, a tier on from `prev` (the clue before, if it was about the same knob),
 * and the run remembers the deepest tier taken, for the stars. Null when every knob is right.
 */
export function takeClue(job, run, prev = null) {
  if (run.done) return null;
  const w = worstKnob(job, run);
  if (!w) return null;
  const tier = prev && prev.cut === w.cut && prev.name === w.name ? Math.min(3, prev.tier + 1) : 1;
  run.clues = Math.max(run.clues || 0, tier);
  return { ...w, tier, text: clueText(job, run, w.cut, w.name, tier) };
}

// ---------- lessons ----------
// Each plate opens with a lesson on a plate of its own with no target: the machine at the level's own cuts, a few things to
// do (each a knob set to a value, checked) and what it showed. `start` gives each cut the settings it begins with (a lesson
// on the index needs a rose to turn); a step's `cut` is the tab it is done in.
const lesson = (start, steps) => ({ start, steps });
const doing = (cut, set, to, learn) => ({ cut, set, do: to, learn });
export const LESSONS = {
  wave: lesson([{ k: 2, a: 3 }], [
    doing(0, { k: 6 }, "This is one pass of a rose engine. Turn Lobes up to 6.", "Six lobes on the rosette, six waves in the ring: the cutting point rides in and out over each."),
    doing(0, { a: 6 }, "Now raise Throw to 6.", "Throw is how hard the rosette pushes the point. The waves get deeper; there are still six."),
    doing(0, { k: 14, a: 2 }, "Try Lobes 14 with Throw 2.", "Many lobes and a shallow throw: a fine ripple. Lobes and Throw are the whole ring."),
  ]),
  edge: lesson([{ k: 8, a: 5 }], [
    doing(0, { shape: 1 }, "Change the Rosette to Scallop.", "Arches that meet in sharp cusps pointing in: the barleycorn's grain."),
    doing(0, { shape: 2 }, "Now Point.", "Straight runs meeting in tips: a zigzag. The edge of the rosette is the shape of the wave."),
    doing(0, { shape: 0, k: 14 }, "Back to Wave, with Lobes at 14.", "Smooth again. A ring is its count, its depth and its edge: three things to read off a target."),
  ]),
  rose: lesson([{ k: 5, a: 5 }], [
    doing(0, { n: 8 }, "Set Passes to 8.", "Eight passes, and you still see one ring: they all lie on top of each other, the rosette not yet turned."),
    doing(0, { index: 30 }, "Set Index to 30°.", "Index turns the rosette a little between passes. Now each ring sits round from the last, and they cross."),
    doing(0, { n: 12 }, "Set Passes to 12.", "12 × 30° is 360°: the rosette has come all the way round and the rose closes. Passes × index = 360°."),
  ]),
  ribbon: lesson([{ k: 6, a: 3, n: 12, index: 30 }], [
    doing(0, { feed: 3 }, "This rose is closed. Set Feed to 3.", "Feed steps each pass a little outward, so the rings no longer share a radius and the rose opens."),
    doing(0, { n: 20, index: 15 }, "Set Passes to 20 and Index to 15°.", "More passes at a finer index fill the band with crossings. Feed sets how wide, passes how full."),
  ]),
  basket: lesson([{ k: 6, a: 3, n: 12, index: 30 }], [
    doing(0, { a2: 2 }, "A second rosette rides on the first. Raise Throw 2 to 2.", "With one lobe it only shifts each ring off the centre a little."),
    doing(0, { k2: 5 }, "Set Lobes 2 to 5.", "Five lobes of the second rosette ride on six of the first: the ring is woven, a basket."),
    doing(0, { k2: 9, a2: 3 }, "Try Lobes 2 at 9 and Throw 2 at 3.", "A fine second rosette weaves a close basket; a coarse one, a bold one."),
  ]),
  dial: lesson([{ k: 5, a: 3, n: 8, index: 45 }, { k: 16, a: 3 }], [
    doing(0, { n: 12, index: 30 }, "A dial is cuts, side by side. On the centre (tab 1) set Passes 12, Index 30°.", "A closed rose in the middle: 12 × 30° = 360°."),
    doing(1, { k: 20 }, "Tap tab 2, the ring, and set Lobes to 20.", "The ring is another cut at a bigger radius, with a rosette of its own. Each cut keeps its own knobs."),
  ]),
  three: lesson([{ k: 4, a: 2, n: 8, index: 45 }, { k: 6, a: 2, n: 10, index: 30 }, { k: 16, a: 3 }], [
    doing(1, { feed: 3 }, "Tap tab 2, the band, and set Feed to 3.", "The middle cut is a ribbon: its feed spreads the passes out into a band between centre and rim."),
    doing(2, { k: 22, a: 4 }, "Tap tab 3, the rim: Lobes 22, Throw 4.", "The rim's rosette has a pointed edge, fixed for this cut; its count and depth are yours. Three cuts read as one pattern."),
  ]),
  master: lesson([{ k: 4, a: 2, n: 8, index: 45 }, { k: 6, a: 2, n: 10, index: 30, feed: 2 }, { k: 20, a: 3 }], [
    doing(0, { a2: 2, k2: 3 }, "Tab 1, the centre: add a second rosette, Throw 2 at 2 and Lobes 2 at 3.", "A woven centre: the basket of a second rosette inside a closed rose."),
    doing(2, { a2: 2, k2: 4 }, "Tab 3, the rim: Throw 2 at 2 and Lobes 2 at 4.", "A ripple along the barleycorn. Each cut can carry two rosettes: every knob you have met is on this dial."),
  ]),
  registers: lesson([{ k: 16, a: 3 }, { k: 5, a: 3, n: 8, index: 45 }, { k: 5, a: 2, n: 12, index: 30 }], [
    doing(1, { n: 12, index: 30 }, "A face can hold dials of its own. Tab 2, the left register: Passes 12, Index 30°.", "A register is a small plate cut round its own centre, set as any rose: 12 × 30° = 360°, and it closes."),
    doing(2, { feed: 3 }, "Tab 3, the right register: set Feed to 3.", "The same machine, another cut: here the feed opens the rose into a ribbon. Each register keeps its own knobs."),
    doing(0, { k: 22 }, "Tab 1, the rim: Lobes 22.", "The rim is a pointed edge round the whole face, fixed for this cut. Three cuts in three places make one face."),
  ]),
  chrono: lesson([{ k: 20, a: 3 }, { k: 5, a: 3, n: 12, index: 30 }, { k: 6, a: 2, n: 12, index: 30 }, { k: 5, a: 3, n: 10, index: 20, feed: 2 }], [
    doing(2, { a2: 2, k2: 5 }, "Tab 3, the right register: Throw 2 at 2 and Lobes 2 at 5.", "A second rosette weaves this register into a basket, while the left one stays a plain rose."),
    doing(3, { feed: 3, n: 18 }, "Tab 4, the base: Feed 3 and Passes 18.", "The register at six is a ribbon. Read each register on its own in the target: its kind, then its count and depth."),
  ]),
  grand: lesson([{ k: 20, a: 3 }, { k: 4, a: 2, n: 8, index: 45 }, { k: 6, a: 3, n: 8, index: 45 }, { k: 6, a: 2, n: 12, index: 30 }, { k: 5, a: 3, n: 10, index: 20, feed: 2 }], [
    doing(1, { a2: 2, k2: 3 }, "Tab 2, the hub: Throw 2 at 2 and Lobes 2 at 3.", "A woven hub at the top, a basket in a small dial."),
    doing(2, { k: 9 }, "Tab 3, the left register is a pointed rosette: set Lobes to 9.", "Points cut a zigzag. Five cuts, five places: name the kind in each, then count."),
  ]),
};
/** The lesson of a level as a job: the level's cuts and no target. */
export function lessonJob(index) {
  const level = LEVELS[index];
  return { index, id: level.id, name: level.name, story: level.story, lesson: true, seed: 0, cuts: level.cuts, answer: null, goal: null, par: 0, steps: LESSONS[level.id].steps.length };
}
/** A lesson's run: the machine at the lesson's start, on its first step. */
export function lessonRun(job) {
  const run = newRun(job), start = LESSONS[job.id].start;
  run.vals.forEach((v, i) => Object.assign(v, start[i] || {}));
  run.step = 0;
  run.at = LESSONS[job.id].steps[0].cut;
  return run;
}
/** Whether the step in hand is done: every knob it names is where it asks. */
export const stepDone = (job, run) => {
  const s = LESSONS[job.id].steps[run.step];
  return !!s && Object.entries(s.set).every(([name, v]) => run.vals[s.cut][name] === v);
};
export const lessonStep = (job, run) => LESSONS[job.id].steps[run.step];
