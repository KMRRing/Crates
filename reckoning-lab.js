// Courier's Feel lab, the part without a page: what can be tuned and how each test is asked, the search that narrows a value
// down from "better with 1 or 2?" answers, the stretch of quay made for each test, and the text of the results. Pure (no page,
// no clock), so it is tested in Node (tests/reckoning-feel.mjs); reckoning.js draws it and plays the stretches.
//
// The search is a bisection with a window: a pair is the value below the centre and the one above it, `d` away. The answer
// says which is better; the better half of the window becomes the window (so each answer halves it), "same" halves it
// without moving the centre, and "both too low / too high" moves the window one pair along without shrinking it.
import { DEFAULTS } from "./reckoning-tune.js";

const f2 = x => (+x.toFixed(2)).toString();

/** The tests. `key` is the tunable (reckoning-tune.js); `lo`..`hi` the range searched; `start` where the first pair is centred
 *  (today's value unless said); `more`/`less` say what the second tap means when both of a pair want to be higher/lower;
 *  `stretch` is the kind of quay it is asked on; `core` marks the ones in the short round; `how` is the one line shown while it plays. */
export const TESTS = [
  { id: "lane", name: "Lane change", key: "LANE_OMEGA", lo: 14, hi: 70, unit: "/s", fmt: v => String(Math.round(v)), more: "Both too slow", less: "Both too sharp", stretch: "lanes", core: true, how: "Swipe left and right round the carts." },
  { id: "jumpH", name: "Jump height", key: "JUMP_H", lo: 1.0, hi: 2.6, unit: "m", fmt: f2, more: "Both too low", less: "Both too high", stretch: "jump", core: true, how: "Jump the gaps; take the coins in the air." },
  { id: "air", name: "Jump hang time", key: "AIR_T", lo: 0.5, hi: 1.0, unit: "s", fmt: f2, more: "Both too short", less: "Both too floaty", stretch: "jump", how: "Jump the gaps." },
  { id: "fall", name: "Fall speed", key: "FALL", lo: 1, hi: 2.4, start: 1.4, unit: "x", fmt: f2, more: "Both too floaty", less: "Both too heavy", stretch: "jump", core: true, how: "Jump the gaps; feel the way down." },
  { id: "landing", name: "Landing memory", key: "LAND_BUFFER", lo: 0.1, hi: 0.6, unit: "s", fmt: f2, more: "Both drop my early jump", less: "Both jump when I did not mean to", stretch: "double", core: true, how: "Jump, and swipe up again just before you land." },
  { id: "swipePx", name: "Swipe distance", key: "SWIPE_PX", lo: 8, hi: 60, unit: "px", fmt: v => String(Math.round(v)), more: "Both too twitchy", less: "Both too stiff", stretch: "lanesFast", core: true, how: "Swipe left and right, short and quick." },
  { id: "swipeMid", name: "Swipe on the move or on release", key: "SWIPE_MID", binary: [1, 0], trials: 2, names: ["as the finger moves", "when the finger lifts"], stretch: "lanesFast", core: true, how: "Swipe left and right." },
  { id: "front", name: "Cut a crab in front", key: "FRONT_WIN", lo: 0.12, hi: 0.5, unit: "s", fmt: f2, more: "Both too tight", less: "Both too forgiving", stretch: "front", core: true, how: "Swipe up at each crab." },
  { id: "side", name: "Cut a crab beside", key: "SIDE_WIN", lo: 0.25, hi: 1.0, unit: "s", fmt: f2, more: "Both too tight", less: "Both too forgiving", stretch: "side", core: true, how: "Swipe towards each crab." },
  { id: "above", name: "Cut a gull", key: "ABOVE_WIN", lo: 0.25, hi: 1.0, unit: "s", fmt: f2, more: "Both too tight", less: "Both too forgiving", stretch: "gulls", how: "Swipe up at each gull." },
  { id: "buffer", name: "Swipe memory", key: "BUFFER", lo: 0.04, hi: 0.35, unit: "s", fmt: f2, more: "Both drop my early swipes", less: "Both act on old swipes", stretch: "quick", how: "Swipe at the crabs a little early." },
  { id: "roll", name: "Roll", key: "ROLL_T", lo: 0.25, hi: 0.8, unit: "s", fmt: f2, more: "Both too short", less: "Both too long", stretch: "roll", core: true, how: "Swipe down under the beams and through the crabs." },
  { id: "wall", name: "Wall jump height", key: "WALLJUMP_H", lo: 1.4, hi: 3.6, unit: "m", fmt: f2, more: "Both too low", less: "Both too high", stretch: "wall", how: "Jump, then sideways into the wall; up leaves it." },
  { id: "hitstop", name: "Hit-stop on a kill", key: "HITSTOP", lo: 0, hi: 0.12, start: 0.04, unit: "s", fmt: v => v.toFixed(3), more: "Both too short", less: "Both too long", stretch: "crabs", core: true, how: "Cut the crabs." },
  { id: "follow", name: "Camera follow", key: "CAM_FOLLOW", lo: 0.5, hi: 2.2, unit: "x", fmt: f2, more: "Both too lazy", less: "Both too stiff", stretch: "lanes", core: true, how: "Swipe left and right; watch the camera." },
  { id: "kick", name: "Camera kick", key: "CAM_KICK", lo: 0, hi: 2.5, unit: "x", fmt: f2, more: "Both too calm", less: "Both too jolty", stretch: "jump", how: "Jump the gaps; watch the landings." },
  { id: "coyote", name: "Coyote time", key: "COYOTE", lo: 0, hi: 0.2, start: 0.08, unit: "s", fmt: v => v.toFixed(3), more: "Both too strict", less: "Both too lenient", stretch: "gaps", core: true, how: "Run to the edge and jump as late as you can." },
];
export const testOf = id => TESTS.find(t => t.id === id);

/** The value a test starts from: the one in use, or its own `start` while that is still today's. */
export const startOf = (t, current) => (t.start != null && current === DEFAULTS[t.key] ? t.start : current);

/** One test's search. `pair()` gives { lo, hi } (the two values to compare), `answer(a)` takes "lo", "hi", "same", "more" or "less". */
export class Search {
  constructor(test, current, trials = test.trials || 3) {
    this.test = test; this.max = trials; this.n = 0; this.sames = 0; this.done = false; this.limit = false;
    if (test.binary) { this.c = null; this.d = 0; this.wins = [0, 0]; return; }
    this.c = Math.min(test.hi, Math.max(test.lo, startOf(test, current)));
    this.d = (test.hi - test.lo) * 0.25;
    this.tol = (test.hi - test.lo) * 0.01;
    this.value = this.c;
  }
  /** The next two values, low then high. A pair that has closed up (to the end of the range) ends the search. */
  pair() {
    const t = this.test;
    if (t.binary) return { lo: t.binary[0], hi: t.binary[1] };
    const lo = Math.max(t.lo, this.c - this.d), hi = Math.min(t.hi, this.c + this.d);
    return { lo, hi };
  }
  answer(a) {
    const t = this.test, { lo, hi } = this.pair();
    this.n++;
    if (t.binary) {
      if (a === "lo") this.wins[0]++; else if (a === "hi") this.wins[1]++;
      this.value = this.wins[1] > this.wins[0] ? t.binary[1] : t.binary[0];
      if (this.n >= this.max) this.done = true;
      return this;
    }
    if (a === "hi") { this.d = (hi - this.c) / 2; this.c += this.d; this.sames = 0; }
    else if (a === "lo") { this.d = (this.c - lo) / 2; this.c -= this.d; this.sames = 0; }
    else if (a === "same") { this.d /= 2; this.sames++; }
    else if (a === "more") { if (hi >= t.hi) this.limit = true; this.c = Math.min(t.hi, hi + this.d); this.sames = 0; }
    else if (a === "less") { if (lo <= t.lo) this.limit = true; this.c = Math.max(t.lo, lo - this.d); this.sames = 0; }
    this.value = this.c;
    if (this.n >= this.max || this.sames >= 2 || this.d < this.tol || this.limit) this.done = true;
    return this;
  }
  /** The converged value, rounded to what a person could tell apart. */
  result() {
    const t = this.test;
    if (t.binary) return this.value;
    const r = (t.hi - t.lo) / 200;
    return Math.round(this.value / r) * r;
  }
}

/** A seeded stream (the same stretch for A and for B, and for a replay). */
function stream(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** A row with `cell` in the lanes listed and `fill` elsewhere. */
const row = (cells, fill = ".") => [0, 1, 2].map(i => cells[i] ?? fill).join(" ");

/** The quay for a test, as a section (reckoning-engine.js's beginSection takes it): about eight to fifteen seconds of the one thing, many times over. */
export function stretch(kind, seed = 1) {
  const r = stream(seed), pick = a => a[Math.floor(r() * a.length)];
  const rows = [];
  let gap = 10, v = 10;
  const free = prev => { let l; do l = Math.floor(r() * 3); while (l === prev); return l; };
  switch (kind) {
    case "lanes": case "lanesFast": {
      gap = kind === "lanes" ? 8 : 6; v = kind === "lanes" ? 10 : 9;
      let prev = 1;
      for (let i = 0; i < 12; i++) {
        const l = free(prev);
        rows.push([0, 1, 2].map(k => (k === l ? "$" : "X")).join(" "));
        prev = l;
      }
      break;
    }
    case "jump": {
      gap = 6;
      for (let i = 0; i < 6; i++) { rows.push(row({ [Math.floor(r() * 3)]: "^" }), "!gap 4", "!rest 4"); }
      break;
    }
    case "double": {
      for (let i = 0; i < 5; i++) rows.push("!gap 4", "!rest 2.2", "!gap 4", "!rest 7");
      break;
    }
    case "gaps": {
      for (let i = 0; i < 7; i++) rows.push("!gap " + (4 + Math.round(r() * 3) / 2), "!rest 6");
      break;
    }
    case "front": gap = 9; for (let i = 0; i < 11; i++) rows.push(". c ."); break;
    case "side": {
      gap = 9;
      let prev = -1;
      for (let i = 0; i < 11; i++) { const l = pick([0, 2].filter(x => x !== prev)); rows.push(row({ [l]: "c" })); prev = l; }
      break;
    }
    case "gulls": gap = 9; for (let i = 0; i < 11; i++) rows.push(". g ."); break;
    case "quick": gap = 5.5; for (let i = 0; i < 14; i++) rows.push(row({ [Math.floor(r() * 3)]: "c" })); break;
    case "crabs": gap = 7.5; for (let i = 0; i < 12; i++) rows.push(row({ [Math.floor(r() * 3)]: "c" })); break;
    case "roll": {
      gap = 8;
      for (let i = 0; i < 6; i++) rows.push("B B B", row({ [Math.floor(r() * 3)]: "c" }));
      break;
    }
    case "wall": rows.push("!rest 2", "!wall 0", "!rest 2", "!wall 0", "!rest 2", "!wall 0"); break;
    default: throw new Error(`Courier lab: no stretch "${kind}"`);
  }
  return { id: 900, name: "Feel lab", place: "", idea: "", brief: "", v0: v, v1: v, gap, rows, lead: 12, coins: kind === "lanes" || kind === "lanesFast" ? true : false, hearts: 5, goal: { kind: "none", n: 0 }, par: { hits: 0 } };
}

// ---------- what is kept (reckoning:feel) ----------

export const FEEL_KEY = "reckoning:feel";
export const MAX_RESULTS = 400, MAX_FLAGS = 60;

/** A kept record of any shape (or none) as a whole one. */
export function cleanFeel(x) {
  const f = x && typeof x === "object" ? x : {};
  const num = o => Object.fromEntries(Object.entries(o && typeof o === "object" ? o : {}).filter(([k, v]) => k in DEFAULTS && typeof v === "number" && Number.isFinite(v)));
  return {
    use: !!f.use, values: num(f.values), done: num(f.done),
    results: Array.isArray(f.results) ? f.results.slice(-MAX_RESULTS) : [],
    flags: Array.isArray(f.flags) ? f.flags.slice(-MAX_FLAGS) : [],
  };
}

/** The text to paste into a chat: every comparison, the converged values and the flagged moments. */
export function resultsText(feel, head = "") {
  const out = [`Courier feel lab${head ? `, ${head}` : ""}`, "Each line: test, A, B, answer (A/B are the values shown first and second; 'both too X' means neither was enough)."];
  const byTest = new Map();
  for (const r of feel.results) { if (!byTest.has(r.t)) byTest.set(r.t, []); byTest.get(r.t).push(r); }
  out.push("", "COMPARISONS");
  for (const [id, list] of byTest) {
    const t = testOf(id); if (!t) continue;
    out.push(`${t.name} (${t.key}${t.unit ? `, ${t.unit}` : ""}):`);
    list.forEach((r, i) => out.push(`  ${i + 1}. A ${show(t, r.a)}  B ${show(t, r.b)}  ->  ${words(t, r)}${r.again ? `  (replayed ${r.again}x)` : ""}`));
  }
  if (!byTest.size) out.push("(none)");
  out.push("", "CONVERGED (default in brackets)");
  const keys = Object.keys(feel.done);
  for (const k of keys) { const t = TESTS.find(x => x.key === k); out.push(`  ${t ? t.name : k}: ${t ? show(t, feel.done[k]) : feel.done[k]}${t ? t.unit ? " " + t.unit : "" : ""} [${t ? show(t, DEFAULTS[k]) : DEFAULTS[k]}]${feel.use && k in feel.values ? "" : "  (not in use)"}`); }
  if (!keys.length) out.push("(none)");
  out.push("", "FLAGGED MOMENTS (\"that felt wrong\")");
  feel.flags.forEach((fl, i) => {
    out.push(`  ${i + 1}. ${fl.at}${fl.where ? `, ${fl.where}` : ""}${fl.note ? `, note: ${fl.note}` : ""}`);
    for (const l of fl.lines || []) out.push(`       ${l}`);
  });
  if (!feel.flags.length) out.push("(none)");
  return out.join("\n");
}
function show(t, v) { return t.binary ? t.names[v === t.binary[0] ? 0 : 1] : t.fmt(v); }
function words(t, r) {
  if (r.ans === "A" || r.ans === "B") return `${r.ans} (${show(t, r.ans === "A" ? r.a : r.b)})`;
  if (r.ans === "same") return "same";
  return r.ans === "more" ? t.more.toLowerCase() : t.less.toLowerCase();
}
