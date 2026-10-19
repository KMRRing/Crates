// Thimble's workroom: eight mending jobs, how a stitch is placed, how a darn is woven, and how a job is graded. No page
// in here (the tests run it in Node); thimble-draw.js draws what this decides and thimble.js takes the fingers.
//
// The cloth is a square 100 wide and 100 high, y down. A job is a list of steps done in order:
//   place  drag a part (button, belt loop, patch) onto its mark;
//   stitch tap the marks in order; every point is a place where the needle goes up through the cloth or down into it,
//          so the thread between point 0 and 1 lies on top of the cloth, between 1 and 2 under it, and so on;
//   darn   pull threads across a hole, lengthwise first (the warp, the way a knitted or woven cloth's own threads run),
//          then across them (the weft, over and under the warp), each starting and ending in sound cloth.
// What the player does is graded by how far from the ideal point each tap, drop or pull lands, and by how tidily.

export const SIZE = 100;
export const STARS = [50, 72, 88];                       // a star each, on a score of 100
export const REG = 1.5;                                  // a tap counts within this many radii of the mark; full marks only within one
const PLACE_W = 4;                                       // placing a part weighs as much as four stitches

export const starsOf = score => (score >= STARS[2] ? 3 : score >= STARS[1] ? 2 : score >= STARS[0] ? 1 : 0);

// ---------- small things ----------
const rng = seed => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const jit = (R, a) => (R() * 2 - 1) * a;
const pick = (R, list) => list[Math.floor(R() * list.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** How well a point landed, 1 on the mark, 0.35 at the radius, 0 at REG radii. */
export function accOf(d, r) {
  if (d <= r) return 1 - 0.65 * (d / r) ** 1.7;
  return Math.max(0, 0.35 * (1 - (d - r) / (r * (REG - 1))));
}

export const THREADS = {
  cream: "#EFE4C8", white: "#F6F3EC", red: "#B03A2E", navy: "#243A63", mustard: "#D29B2D", black: "#232326", teal: "#2B7C76", orange: "#C8662C",
};
const BUTTONS = ["#E8E0CC", "#3B3E47", "#A8682F", "#2F6150", "#8E2F3A", "#C7B88C"];

/** A ragged hole: a ring of points round an ellipse, each pulled in or pushed out a little. */
function blob(R, cx, cy, rx, ry) {
  const n = 12, ph = R() * Math.PI * 2, poly = [];
  for (let i = 0; i < n; i++) {
    const a = ph + (i / n) * Math.PI * 2, k = 0.78 + R() * 0.32;
    poly.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return poly;
}
function boxOf(poly) {
  const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
/** Evenly spaced lanes from a to b, about `pitch` apart, the ends included. */
function lanes(a, b, pitch) {
  const n = Math.max(2, Math.round((b - a) / pitch) + 1), step = (b - a) / (n - 1);
  return Array.from({ length: n }, (_, i) => a + i * step);
}
/** The first point of a run of stitches is a needle coming up; the thread then lies on the cloth up to the next. */
export const visible = i => i % 2 === 0;

// ---------- the jobs ----------
function buttonJob(R, four) {
  const cx = 50 + jit(R, 9), cy = 42 + jit(R, 6), rad = four ? 16 : 15, off = four ? 5.4 : 5.5, ang = R() * Math.PI;
  const rot = (dx, dy) => ({ dx: dx * Math.cos(ang) - dy * Math.sin(ang), dy: dx * Math.sin(ang) + dy * Math.cos(ang) });
  const rel = four ? [rot(-off, -off), rot(off, -off), rot(-off, off), rot(off, off)] : [rot(-off, 0), rot(off, 0)];
  const holes = rel.map(h => ({ x: cx + h.dx, y: cy + h.dy }));
  const order = four ? [0, 3, 2, 1] : [0, 1], rounds = four ? 3 : 4;      // the four-hole button is crossed: corner to opposite corner
  const pts = [];
  for (let k = 0; k < rounds; k++) for (const o of order) pts.push({ ...holes[o] });
  const side = R() < 0.5 ? -1 : 1;
  return {
    cloth: { kind: "plain", base: pick(R, ["#BCD0E6", "#E9DFC9", "#D9C3C8", "#C9D9C4"]) },
    thread: pick(R, ["cream", "red", "navy", "mustard", "black", "teal"]),
    scene: [{ t: "chalk", x: cx, y: cy }, { t: "ends", x: cx, y: cy, seed: Math.floor(R() * 1e6) }],
    steps: [
      { type: "place", what: "button", r: 6, from: { x: clamp(cx + side * 28, rad + 2, 98 - rad), y: clamp(cy + 34, rad + 2, 98 - rad) }, to: { x: cx, y: cy },
        color: pick(R, BUTTONS), rad, rel, four },
      { type: "stitch", kind: "button", r: four ? 4.2 : 5, show: 99, pts },
    ],
  };
}

function hemJob(R) {
  const ly = 56 + jit(R, 5), slope = jit(R, 0.05), n = 8, pitch = 10.4, vis = 6, x0 = (100 - ((n - 1) * pitch + vis)) / 2;
  const at = x => ({ x, y: ly + slope * (x - 50) });
  const pts = [];
  for (let k = 0; k < n; k++) pts.push(at(x0 + k * pitch), at(x0 + k * pitch + vis));
  return {
    cloth: { kind: "twill", base: pick(R, ["#B9A67E", "#8F8D73", "#A9A08A"]) },
    thread: pick(R, ["cream", "navy", "black", "red", "teal"]),
    scene: [{ t: "hem", y: ly, slope, h: 17 }],
    steps: [{ type: "stitch", kind: "run", r: 3.4, show: 99, pts }],
  };
}

function tearJob(R) {
  const xl = 44 + jit(R, 3), xr = xl + 12 + jit(R, 1), n = 6, y0 = 20 + jit(R, 2), gap = (92 - y0 - 18) / (n - 1);
  const edge = x => { const e = []; for (let y = 4; y <= 98; y += 4.7) e.push([x + jit(R, 1.5), y]); return e; };
  const pts = [];
  for (let k = 0; k < n; k++) {
    const y = y0 + k * gap + jit(R, 0.8), l = { x: xl - 2.8, y }, r = { x: xr + 2.8, y };
    pts.push(...(k % 2 ? [r, l] : [l, r]));                            // across, down the edge under the cloth, back across
  }
  return {
    cloth: { kind: "plain", base: pick(R, ["#BCD0E6", "#E9DFC9", "#D9C3C8", "#C9D9C4"]) },
    thread: pick(R, ["red", "navy", "mustard", "black", "teal"]),
    scene: [{ t: "tear", xl, xr, edgeL: edge(xl), edgeR: edge(xr) }],
    steps: [{ type: "stitch", kind: "ladder", r: 3.4, show: 99, pts }],
  };
}

function loopJob(R) {
  const cx = 50 + jit(R, 10), endY = 78 + jit(R, 3), top = { x: cx + jit(R, 2), y: 12 }, side = R() < 0.5 ? -1 : 1, rows = 5;
  const pts = [];
  for (let k = 0; k < rows; k++) {
    const y = endY - 2.8 - k * 3.4;
    pts.push({ x: cx - 4.2, y }, { x: cx + 4.2, y });
  }
  return {
    cloth: { kind: "denim", base: pick(R, ["#35507B", "#2A3F66", "#4B6A94"]) },
    thread: pick(R, ["mustard", "orange", "cream"]),
    scene: [{ t: "band", y0: endY - 18 }, { t: "tack", x: top.x, y: top.y + 5, w: 8.4 }],
    steps: [
      { type: "place", what: "loop", r: 5, from: { x: cx + side * (20 + R() * 6), y: endY - 30 + R() * 6 }, to: { x: cx, y: endY }, anchor: top, width: 11, color: null },
      { type: "stitch", kind: "tack", r: 3.2, show: 2, pts },
    ],
  };
}

function darnJob(R, holes, pad, pitch, cloth, thread) {
  const steps = [], scene = [];
  for (const h of holes) {
    const poly = blob(R, h.x, h.y, h.rx, h.ry), box = boxOf(poly);
    scene.push({ t: "hole", poly, box });
    steps.push({
      type: "darn", pad, pitch, box,
      warp: lanes(box.x - pad, box.x + box.w + pad, pitch),               // x of each lengthwise thread
      weft: lanes(box.y - pad, box.y + box.h + pad, pitch),               // y of each crosswise thread
    });
  }
  return { cloth, thread, scene, steps };
}
const sockJob = R => darnJob(R, [{ x: 50 + jit(R, 6), y: 46 + jit(R, 5), rx: 11.5, ry: 9.5 }], 7, 5,
  { kind: "knit", base: pick(R, ["#8A8E94", "#6B7078", "#9A8F82"]), fine: true }, pick(R, ["red", "mustard", "cream", "teal"]));
const sweaterJob = R => darnJob(R, [{ x: 31 + jit(R, 3), y: 33 + jit(R, 3), rx: 7.5, ry: 6.5 }, { x: 68 + jit(R, 3), y: 67 + jit(R, 3), rx: 7, ry: 8 }], 5.5, 4.6,
  { kind: "knit", base: pick(R, ["#8E3A46", "#2F5D62", "#C58A3E"]), fine: false }, pick(R, ["cream", "navy", "mustard", "white"]));

function patchJob(R) {
  const to = { x: 50 + jit(R, 5), y: 48 + jit(R, 5) }, hw = 20, hh = 15, ihw = 16, ihh = 11, side = R() < 0.5 ? -1 : 1;
  const per = 2 * (2 * ihw + 2 * ihh), n = 9, pitch = per / n, vis = 7, off = pitch * 0.3;
  // a point a distance s along the stitching line, walked clockwise from the top left corner
  const at = s => {
    s = ((s % per) + per) % per;
    const w = 2 * ihw, h = 2 * ihh;
    if (s < w) return { x: to.x - ihw + s, y: to.y - ihh };
    if (s < w + h) return { x: to.x + ihw, y: to.y - ihh + (s - w) };
    if (s < 2 * w + h) return { x: to.x + ihw - (s - w - h), y: to.y + ihh };
    return { x: to.x - ihw, y: to.y + ihh - (s - 2 * w - h) };
  };
  const pts = [];
  for (let k = 0; k < n; k++) pts.push(at(off + k * pitch), at(off + k * pitch + vis));
  return {
    cloth: { kind: "tweed", base: pick(R, ["#7D7461", "#6A6F5C", "#8B6E5A"]) },
    thread: pick(R, ["cream", "black", "mustard", "red"]),
    scene: [{ t: "worn", x: to.x, y: to.y, seed: Math.floor(R() * 1e6) }],
    steps: [
      { type: "place", what: "patch", r: 6, from: { x: clamp(to.x + side * 26, 24, 76), y: 82 }, to, hw, hh, color: pick(R, ["#6B4A2E", "#3C4A3A", "#4A3B52", "#8A6A3C"]) },
      { type: "stitch", kind: "patch", r: 3.4, show: 3, pts },
    ],
  };
}

export const JOBS = [
  { id: "shirt-button", name: "Shirt button", story: "Two holes: up, down, up, down.", make: R => buttonJob(R, false) },
  { id: "four-hole", name: "Four-hole button", story: "Cross it, corner to opposite corner.", make: R => buttonJob(R, true) },
  { id: "hem", name: "Trouser hem", story: "A running stitch along the fold.", make: hemJob },
  { id: "seam", name: "Torn seam", story: "Ladder stitch across the tear.", make: tearJob },
  { id: "belt-loop", name: "Belt loop", story: "Set the loose end on the band, tack it.", make: loopJob },
  { id: "sock", name: "Darn a sock", story: "Warp first, then weft over and under.", make: sockJob },
  { id: "patch", name: "Elbow patch", story: "Lay it on the worn place, stitch round.", make: patchJob },
  { id: "moth", name: "Moth holes", story: "Two holes in a sweater, both darned.", make: sweaterJob },
];

/** Job number `index` as it comes from `seed`: the same every time. */
export function makeJob(index, seed) {
  const def = JOBS[index], R = rng((seed ^ Math.imul(index + 1, 0x9E3779B1)) >>> 0);
  return { index, id: def.id, name: def.name, story: def.story, seed, ...def.make(R) };
}

// ---------- a run ----------
export function newRun(job) {
  return {
    v: 1, job: job.index, seed: job.seed, step: 0, misses: 0, unpicks: 0,
    st: job.steps.map(s => (s.type === "place" ? { done: false, acc: 0 } : s.type === "stitch" ? { pts: [] } : { warp: [], weft: [] })),
  };
}
export const finished = (job, run) => run.step >= job.steps.length;
export const stepOf = (job, run) => job.steps[run.step] || null;
const advance = (job, run) => { run.step++; return finished(job, run); };

/** The run's phase in a darn: the warp until every lengthwise thread is in, then the weft. */
export const phaseOf = (job, run) => {
  const s = stepOf(job, run);
  return s?.type === "darn" ? (run.st[run.step].warp.length < s.warp.length ? "warp" : "weft") : null;
};

/** How far along: the actions done and the actions in all. */
export function progress(job, run) {
  let done = 0, all = 0;
  job.steps.forEach((s, i) => {
    const st = run.st[i];
    if (s.type === "place") { all++; done += st.done ? 1 : 0; }
    else if (s.type === "stitch") { all += s.pts.length; done += st.pts.length; }
    else { all += s.warp.length + s.weft.length; done += st.warp.length + st.weft.length; }
  });
  return { done, all };
}

export const WHY = {
  mark: "Not on the mark.", hole: "Missed: the ringed hole is the next.",
  tap: "", short: "Start and end in sound cloth, past the hole.", axis: "Lengthwise first: the warp.", wild: "Draw it straighter.",
  taken: "That thread's laid already.", outside: "Too far out: keep to the darn.", nothing: "",
};

/** The ringed hole / the worn place: what to do now, in a line. */
export function say(job, run) {
  const s = stepOf(job, run);
  if (!s) return "Done.";
  const st = run.st[run.step];
  if (s.type === "place") return { button: "Drag the button onto the chalk cross.", loop: "Drag the loose end down onto the band.", patch: "Drag the patch onto the worn place." }[s.what];
  if (s.type === "stitch") {
    const k = st.pts.length, up = k === 0 || !visible(k - 1);
    return `${up ? "Needle up" : "Needle down"} at the ringed mark: ${k + 1} of ${s.pts.length}.`;
  }
  const ph = phaseOf(job, run), n = ph === "warp" ? s.warp.length : s.weft.length, k = st[ph].length + 1;
  const hole = job.steps.filter(x => x.type === "darn").length > 1 ? ` (hole ${job.steps.filter(x => x.type === "darn").indexOf(s) + 1})` : "";
  return ph === "warp"
    ? `Warp${hole}: pull a thread lengthwise, from sound cloth to sound cloth: ${k} of ${n}.`
    : `Weft${hole}: now across, over and under the warp: ${k} of ${n}.`;
}

/** The marks to draw: the next point of a stitch step and as many after it as the step shows. */
export function marks(job, run) {
  const s = stepOf(job, run);
  if (s?.type !== "stitch") return [];
  const k = run.st[run.step].pts.length;
  return s.pts.slice(k, k + s.show).map((p, j) => ({ ...p, i: k + j, next: j === 0 }));
}

// ---------- the player's moves ----------
/** A part set down at (x, y). Within the step's radius it sits on its mark; otherwise nothing is done. */
export function place(job, run, x, y) {
  const s = stepOf(job, run);
  if (s?.type !== "place") return { ok: false, why: "nothing" };
  const d = dist({ x, y }, s.to);
  if (d > s.r) { run.misses++; return { ok: false, why: "mark", d }; }
  const st = run.st[run.step];
  st.done = true;
  st.acc = accOf(d, s.r);
  advance(job, run);
  return { ok: true, d, acc: st.acc };
}

/** The needle goes in at (x, y). Within REG radii of the next mark it is taken, and the stitch lies where it went. */
export function stitch(job, run, x, y) {
  const s = stepOf(job, run);
  if (s?.type !== "stitch") return { ok: false, why: "nothing" };
  const st = run.st[run.step], k = st.pts.length, d = dist({ x, y }, s.pts[k]);
  if (d > s.r * REG) { run.misses++; return { ok: false, why: "hole", d }; }
  const acc = accOf(d, s.r);
  st.pts.push([x, y, acc]);
  const over = st.pts.length === s.pts.length ? advance(job, run) : false;
  return { ok: true, d, acc, k, up: k === 0 || !visible(k - 1), over, stepDone: st.pts.length === s.pts.length };
}

/** Pulls out the last stitch (or darning thread) of the step in hand. A step finished stays finished. */
export function unpick(job, run) {
  const s = stepOf(job, run);
  if (!s || s.type === "place") return false;
  const st = run.st[run.step];
  let took = false;
  if (s.type === "stitch") took = !!st.pts.pop();
  else took = !!(st.weft.length ? st.weft.pop() : st.warp.pop());
  if (took) run.unpicks++;
  return took;
}

/**
 * A thread pulled across the hole along `path` (points [x, y]). The warp runs up and down, the weft across; it has to
 * start and end in good cloth, past the hole by half the darn's margin, and it lands on the nearest lane if that is free.
 */
export function darn(job, run, path) {
  const s = stepOf(job, run);
  if (s?.type !== "darn") return { ok: false, why: "nothing" };
  const ph = phaseOf(job, run), warp = ph === "warp", st = run.st[run.step], box = s.box, need = s.pad * 0.5;
  const xs = path.map(p => p[0]), ys = path.map(p => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (Math.hypot(x1 - x0, y1 - y0) < 4) return { ok: false, why: "tap" };       // a touch, not a pull
  const reject = why => { run.misses++; return { ok: false, why }; };
  const along = warp ? [y0, y1] : [x0, x1], across = warp ? xs : ys;
  if (warp ? x1 - x0 > (y1 - y0) : y1 - y0 > (x1 - x0)) return reject("axis");
  const lo = warp ? box.y : box.x, hi = lo + (warp ? box.h : box.w);
  if (along[0] > lo - need || along[1] < hi + need) return reject("short");
  const mean = across.reduce((a, b) => a + b, 0) / across.length, wob = Math.max(...across.map(v => Math.abs(v - mean)));
  if (wob > s.pitch * 1.6) return reject("wild");
  const list = warp ? s.warp : s.weft, mine = st[warp ? "warp" : "weft"];
  let lane = 0;
  for (let i = 1; i < list.length; i++) if (Math.abs(list[i] - mean) < Math.abs(list[lane] - mean)) lane = i;
  if (Math.abs(list[lane] - mean) > s.pitch * 0.75) return reject("outside");
  if (mine.some(l => l[0] === lane)) return reject("taken");
  const acc = 0.6 * accOf(Math.abs(list[lane] - mean), s.pitch * 0.5) + 0.4 * accOf(wob, s.pitch * 0.9);
  mine.push([lane, acc]);
  const full = st.warp.length === s.warp.length && st.weft.length === s.weft.length;
  const over = full ? advance(job, run) : false;
  return { ok: true, lane, acc, phase: ph, over, stepDone: full, warpDone: warp && st.warp.length === s.warp.length };
}

// ---------- the grade ----------
export function grade(job, run) {
  let wp = 0, sp = 0, ws = 0, ss = 0, wd = 0, sd = 0;
  job.steps.forEach((s, i) => {
    const st = run.st[i];
    if (s.type === "place") { if (st.done) { sp += st.acc * PLACE_W; wp += PLACE_W; } }
    else if (s.type === "stitch") for (const p of st.pts) { ss += p[2]; ws++; }
    else for (const l of [...st.warp, ...st.weft]) { sd += l[1]; wd++; }
  });
  const w = wp + ws + wd, raw = w ? (sp + ss + sd) / w : 0;
  const tidy = Math.min(10, run.misses * 0.8) + Math.min(6, run.unpicks * 1.2);
  const score = clamp(Math.round(raw * 100 - tidy), 0, 100);
  return {
    place: wp ? sp / wp : null, stitch: ws ? ss / ws : null, darn: wd ? sd / wd : null,
    misses: run.misses, unpicks: run.unpicks, tidy: Math.round(tidy * 10) / 10, score, stars: starsOf(score),
  };
}
