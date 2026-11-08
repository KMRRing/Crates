// Fathom (id yield; the on-screen name is Constellation): seven letters as seven stars joined by sight-lines. A word counts if
// every step from one letter to the next follows a sight-line (or stays on the star, for a doubled letter), so the sky, not a
// rule to remember, is what limits the words. The words are yield-words.js's (ordinary English, the same on both sides of
// the Atlantic); a puzzle's yield is every one of them its sky allows, found exhaustively, 50 to 100 of them. At least one
// word is a full tour (visits all seven stars). Pure: no page, tested in Node.
// Korbi, 8 November 2026: replaces the Spelling Bee clone. Two mechanisms, a skin on top: the sight-lines (what limits the
// words) and the shadows (what tells you where the missing ones are). Space is the skin.
import { WORDS, BAND, BLOCKED } from "./yield-words.js";

export const LEVELS = { light: "Light", medium: "Medium", heavy: "Heavy" };
export const DAILY = { level: "medium" };   // today's, the same for everyone
export const MIN_LEN = 4, FULL_BONUS = 7, STARS = 7;
const A = 97;

// The levels: a size in words and the depth of vocabulary the rank to aim for needs (depthOf). Light gets there on everyday
// words; Heavy needs words people use less. Every level is inside 50 to 100 words, the range Korbi asked for.
const BANDS = {
  light: { words: [50, 72], depth: [2.75, 9] },
  medium: { words: [58, 86], depth: [2.35, 2.75] },
  heavy: { words: [70, 100], depth: [0, 2.35] },
};
const MAX_ING = 0.3, MAX_ED = 0.45;     // a yield that is mostly -ing or -ed forms is one trick, not a puzzle

// ---------- randomness that is the same on every device ----------
/** A seeded generator (mulberry32): integer arithmetic only, so every phone deals the same puzzle from a seed. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffled = (xs, r) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the words ----------
export const maskOf = w => { let m = 0; for (let i = 0; i < w.length; i++) m |= 1 << (w.charCodeAt(i) - A); return m; };
const bitsOf = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
const lettersOf = m => { let s = ""; for (let i = 0; i < 26; i++) if ((m >> i) & 1) s += String.fromCharCode(A + i); return s; };

let IDX = null;
/** The counted words, unpacked once: how common each is, by letter set the ones seven stars can hold, and the full tours. */
function index() {
  if (IDX) return IDX;
  const band = new Map([...BAND].map((c, i) => [c, (i + 15) / 10]));
  const zipf = new Map(), sets = new Map(), tours = [];
  for (const [n, [run, bands]] of Object.entries(WORDS)) {
    const len = Number(n);
    for (let i = 0; i < bands.length; i++) {
      const w = run.slice(i * len, i * len + len), m = maskOf(w), b = bitsOf(m);
      zipf.set(w, band.get(bands[i]));
      if (b > STARS) continue;
      const l = sets.get(m);
      if (l) l.push(w); else sets.set(m, [w]);
      if (b === STARS) tours.push(w);
    }
  }
  IDX = { zipf, sets, tours: tours.sort(), blocked: new Set(BLOCKED.split(" ")), pools: new Map() };
  return IDX;
}
/** Whether Constellation counts a word anywhere (any case). */
export const counts = w => index().zipf.has(String(w || "").toLowerCase());
/** How often a counted word is used: its Zipf frequency (0 for a word that isn't counted). */
export const zipfOf = w => index().zipf.get(w) ?? 0;
/** How readily a person thinks of a word: how common it is, less for every letter past four. */
export const ease = w => zipfOf(w) - 0.2 * (w.length - MIN_LEN);
/** Every counted word made of (some of) a letter set, sight-lines aside: what a sky's yield is picked from. */
function poolOf(mask) {
  const idx = index();
  let pool = idx.pools.get(mask);
  if (!pool) {
    pool = [];
    for (let sub = mask; sub; sub = (sub - 1) & mask) pool.push(...(idx.sets.get(sub) || []));
    idx.pools.set(mask, pool);
  }
  return pool;
}

// ---------- a puzzle: seven stars, their sight-lines, and what they allow ----------
// A puzzle is { letters (seven, alphabetical), edges ("ab ad ce": the sight-lines, each a pair of letters, alphabetical
// within and between), level, seed } and a daily's day. Strings, not arrays, so it survives the database's round trip.
const pairKey = (a, b) => (a < b ? a + b : b + a);
/** The sight-lines of a puzzle as a lookup over letter codes: [a * 26 + b] is true when a step from a to b is allowed. */
const reach = new Map();
function reachOf(p) {
  const key = `${p.letters}|${p.edges}`;
  let t = reach.get(key);
  if (!t) {
    t = new Uint8Array(26 * 26);
    for (const c of p.letters) t[(c.charCodeAt(0) - A) * 27] = 1;          // a doubled letter stays on its star
    for (const e of p.edges.split(" ")) if (e) { const a = e.charCodeAt(0) - A, b = e.charCodeAt(1) - A; t[a * 26 + b] = 1; t[b * 26 + a] = 1; }
    if (reach.size > 40) reach.clear();
    reach.set(key, t);
  }
  return t;
}
/** Whether a step from one letter to the next is allowed: a sight-line joins them, or they are the same star. */
export const canStep = (p, a, b) => reachOf(p)[(a.charCodeAt(0) - A) * 26 + b.charCodeAt(0) - A] === 1;
/** Whether every step of a word follows a sight-line (and its letters are all on the board). */
export function traces(p, w) {
  const t = reachOf(p);
  for (let i = 0; i < w.length; i++) {
    const c = w.charCodeAt(i) - A;
    if (!p.letters.includes(w[i])) return false;
    if (i && t[(w.charCodeAt(i - 1) - A) * 26 + c] !== 1) return false;
  }
  return true;
}
/** The stars a word visits, in order, as indices into p.letters (a doubled letter repeats its star). */
export const trailOf = (p, w) => [...w].map(c => p.letters.indexOf(c));
/** Whether a word is a full tour: it visits all seven stars. */
export const isFull = (p, w) => bitsOf(maskOf(w)) === STARS;
/** A word's points: one for four letters, one a letter for more, seven more for a full tour. */
export const pointsOf = (p, w) => (w.length === MIN_LEN ? 1 : w.length) + (isFull(p, w) ? FULL_BONUS : 0);
export const totalOf = (p, words) => words.reduce((s, w) => s + pointsOf(p, w), 0);
/** Every counted word the sky allows, alphabetical. */
export function yieldOf(p) {
  return poolOf(maskOf(p.letters)).filter(w => traces(p, w)).sort();
}

// ---------- the sky's shape: where the stars stand ----------
// The hub and six round it, or all seven round a ring (whichever is clearer), a little off true by the seed so it looks like
// a sky; of the 5040 ways to stand the letters on those seven places, one with the fewest sight-lines crossing (picked among the best by the seed), so the drawing is
// as clear as the sky allows (a line that runs through another star counts against a layout too, as eight crossings). Pure and the same on every device, so a table sees one sky.
const HUB = [[0, 0], ...Array.from({ length: 6 }, (_, k) => [Math.cos(Math.PI / 2 + (k * Math.PI) / 3), -Math.sin(Math.PI / 2 + (k * Math.PI) / 3)])];
const RING = Array.from({ length: 7 }, (_, k) => [Math.cos(-Math.PI / 2 + (k * 2 * Math.PI) / 7), Math.sin(-Math.PI / 2 + (k * 2 * Math.PI) / 7)]);   // seven round a circle: no line can run through a star
const cross = (a, b, c, d) => {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
};
/** Whether a point is within a star's width of a segment (the drawn size of a star, in the sky's own units). */
const near = (c, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((c[0] - a[0]) * dx + (c[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(a[0] + t * dx - c[0], a[1] + t * dy - c[1]) < 0.22;
};
const THROUGH = 8;
const PERMS = (() => {
  const out = [], go = (rest, got) => { if (!rest.length) { out.push(got); return; } rest.forEach((x, i) => go([...rest.slice(0, i), ...rest.slice(i + 1)], [...got, x])); };
  go([0, 1, 2, 3, 4, 5, 6], []);
  return out;
})();
const skies = new Map();
/** { stars: [{ ch, x, y }] in letter order (x and y between -1 and 1), links: [[i, j]] } for a puzzle. */
export function skyOf(p) {
  const key = `${p.letters}|${p.edges}|${p.seed}`;
  if (skies.has(key)) return skies.get(key);
  const r = rng((p.seed ^ 0x57a25) >>> 0), links = p.edges.split(" ").filter(Boolean).map(e => [p.letters.indexOf(e[0]), p.letters.indexOf(e[1])]);
  let best = Infinity, picks = [], spots = null;
  for (let tryNo = 0; tryNo < 4 && best > 0; tryNo++) {            // a few different leanings of the sky; the clearest wins
    const slots = tryNo % 2 ? RING : HUB;
    const here = slots.map(([x, y], i) => (slots === HUB && !i ? [(r() - 0.5) * 0.16, (r() - 0.5) * 0.16] : [x * (0.9 + r() * 0.14) + (r() - 0.5) * 0.14, y * (0.9 + r() * 0.14) + (r() - 0.5) * 0.14]));
    let found = Infinity, hits = [];
    for (const perm of PERMS) {                                  // perm[i]: the place of star i
      let n = 0;
      for (let a = 0; a < links.length && n <= found; a++) {
        const [i, j] = links[a];
        for (let s = 0; s < STARS; s++) if (s !== i && s !== j && near(here[perm[s]], here[perm[i]], here[perm[j]])) n += THROUGH;   // a line through a star reads as a step to it, and a drag would take it
        for (let b = a + 1; b < links.length; b++) {
          const [k, l] = links[b];
          if (i === k || i === l || j === k || j === l) continue;
          if (cross(here[perm[i]], here[perm[j]], here[perm[k]], here[perm[l]])) n++;
        }
      }
      if (n < found) { found = n; hits = [perm]; } else if (n === found) hits.push(perm);
    }
    if (found < best) { best = found; picks = hits; spots = here; }
  }
  const perm = picks[Math.floor(r() * picks.length)];
  const at = i => spots[perm[i]];
  let crossings = 0, through = 0;
  links.forEach(([i, j], a) => {
    for (let s = 0; s < STARS; s++) if (s !== i && s !== j && near(at(s), at(i), at(j))) through++;
    for (const [k, l] of links.slice(a + 1)) if (i !== k && i !== l && j !== k && j !== l && cross(at(i), at(j), at(k), at(l))) crossings++;
  });
  const sky = { stars: [...p.letters].map((ch, i) => ({ ch, x: at(i)[0], y: at(i)[1] })), links, crossings, through };
  if (skies.size > 20) skies.clear();
  skies.set(key, sky);
  return sky;
}

// ---------- difficulty ----------
/**
 * How deep a puzzle's vocabulary goes: finding its words in order of ease (the commonest and shortest first, as a
 * person tends to), the ease of the word that takes the points past the share of the rank to aim for (MASTER). A low
 * depth means that rank needs words people use rarely; it is the level's measure, the size only a range for it.
 */
export function depthOf(p, words) {
  const total = totalOf(p, words), sorted = [...words].sort((a, b) => ease(b) - ease(a) || (a < b ? -1 : 1));
  let acc = 0;
  for (const w of sorted) { acc += pointsOf(p, w); if (acc >= RANKS[MASTER][0] * total) return ease(w); }
  return 0;
}
/** What a puzzle is like: its size, points, depth, its full tours, and how much of it is one ending. */
export function statsOf(p, words = yieldOf(p)) {
  const tours = words.filter(w => isFull(p, w));
  return { words: words.length, points: totalOf(p, words), depth: depthOf(p, words), tours: tours.length,
    ing: words.filter(w => w.endsWith("ing")).length / (words.length || 1), ed: words.filter(w => w.endsWith("ed")).length / (words.length || 1) };
}
/** Whether a puzzle's stats suit a level. */
function suits(level, s) {
  const b = BANDS[level];
  return s.tours > 0 && s.words >= b.words[0] && s.words <= b.words[1] && s.depth >= b.depth[0] && s.depth < b.depth[1] && s.ing <= MAX_ING && s.ed <= MAX_ED;
}
/** How far a puzzle is from a level, for the nearest when none suits in the tries allowed. */
function distance(level, s) {
  const b = BANDS[level], off = (x, a, z) => (x < a ? a - x : x > z ? x - z : 0);
  return (s.tours ? 0 : 100) + off(s.words, b.words[0], b.words[1]) / 10 + off(s.depth, b.depth[0], b.depth[1] - 0.001) * 4 + Math.max(0, s.ing - MAX_ING) * 5 + Math.max(0, s.ed - MAX_ED) * 5;
}

// ---------- dealing ----------
const TRIES = 3000, EXTRAS = 10, MAX_LINES = 14;      // no more than 14 sight-lines: more cross too much to read
/**
 * The skies a seed tries, in order. A full tour is picked first (a word with seven different letters) and its steps are
 * the sight-lines that make it a tour, so every sky has at least one; then a random few more lines, for the size.
 */
function* candidates(r) {
  const { tours } = index();
  for (;;) {
    const w = tours[Math.floor(r() * tours.length)], letters = lettersOf(maskOf(w)), base = new Set();
    for (let i = 1; i < w.length; i++) if (w[i] !== w[i - 1]) base.add(pairKey(w[i - 1], w[i]));
    const rest = [];
    for (let i = 0; i < letters.length; i++) for (let j = i + 1; j < letters.length; j++) if (!base.has(letters[i] + letters[j])) rest.push(letters[i] + letters[j]);
    for (let k = 0; k < EXTRAS; k++) {
      const more = shuffled(rest, r).slice(0, Math.floor(r() * (Math.min(rest.length, MAX_LINES - base.size) + 1)));
      yield { letters, edges: [...base, ...more].sort().join(" ") };
    }
  }
}
/** A puzzle for a seed at a level: the first sky that suits it, else the nearest of the first TRIES. */
export function deal({ seed, level = "medium" }) {
  if (!BANDS[level]) throw new Error(`no level ${level}`);
  const r = rng(seed);
  let best = null, tried = 0;
  for (const c of candidates(r)) {
    const p = { ...c, level, seed }, s = statsOf(p);
    if (suits(level, s)) return p;
    const d = distance(level, s);
    if (!best || d < best.d) best = { p, d };
    if (++tried >= TRIES) return best.p;
  }
}
/** Today's puzzle: a Medium sky, the same for everyone; the day (YYYYMMDD, the suite's today()) is its seed. */
export const daily = day => ({ ...deal({ seed: day, level: DAILY.level }), day });

// ---------- the shadows: where what's missing hides ----------
/**
 * The sight-lines the words not yet found travel along, and how many of them use each: Map("i-j" (star indices, i < j) ->
 * count) and the busiest line's count. A doubled letter stays on its star, so it adds no line. Drawn as a glow, the
 * clue that says where to look without saying what is there.
 */
export function shadowsOf(p, words, found = new Set()) {
  const lines = new Map();
  let max = 0;
  for (const w of words) {
    if (found.has(w)) continue;
    const used = new Set(), trail = trailOf(p, w);
    for (let i = 1; i < trail.length; i++) if (trail[i] !== trail[i - 1]) used.add(trail[i] < trail[i - 1] ? `${trail[i]}-${trail[i - 1]}` : `${trail[i - 1]}-${trail[i]}`);
    for (const k of used) { const n = (lines.get(k) || 0) + 1; lines.set(k, n); if (n > max) max = n; }
  }
  return { lines, max };
}
/** The word a hint is about: the easiest one not found yet (the commonest and shortest), alphabetical on a tie. */
export function easiestLeft(words, found = new Set()) {
  let best = null;
  for (const w of words) if (!found.has(w) && (best === null || ease(w) > ease(best) || (ease(w) === ease(best) && w < best))) best = w;
  return best;
}

// ---------- ranks ----------
// From the dark sky to the whole galaxy, each rank a share of the puzzle's points. Galaxy is every word; Nova, the one to
// aim for, 70% (the levels' grading is measured at it).
export const RANKS = [[0, "Dark sky"], [0.03, "Glimmer"], [0.06, "Spark"], [0.1, "Meteor"], [0.18, "Comet"], [0.28, "Planet"],
  [0.4, "Star"], [0.55, "Giant"], [0.7, "Nova"], [1, "Galaxy"]];
/** Where Nova (the rank to aim for) and Galaxy (every word) are in RANKS. */
export const MASTER = 8, TOP = RANKS.length - 1;
/** The points each rank needs, for a puzzle of `total` points (rounded, as players count them; Galaxy is all). */
export const needed = total => RANKS.map(([f], i) => (i === TOP ? total : Math.round(f * total)));
/** The rank reached with `points` of `total`: its index in RANKS. */
export function rankOf(points, total) {
  const need = needed(total);
  let r = 0;
  for (let i = 0; i < need.length; i++) if (points >= need[i]) r = i;
  return r;
}

// ---------- a word traced ----------
/**
 * What a traced word is, for a puzzle: { kind, points, full, at }. kind is one of
 *   short (fewer than four letters), letters (a letter that is not a star), line (a step with no sight-line: at is the
 *   index of the step), found (already found), word (it counts: its points), variant (one side of the Atlantic's
 *   spelling only), rare (a word, but rarer than Constellation counts), unknown (not in the list).
 * have: what's been found (a Set); dict: wordlist.js's isWord and isVariant, once loaded (else every word that isn't
 * counted is unknown).
 */
export function judge(p, typed, { have = new Set(), dict = null } = {}) {
  const w = String(typed || "").toLowerCase();
  if (w.length < MIN_LEN) return { kind: "short" };
  if (!/^[a-z]+$/.test(w) || [...w].some(c => !p.letters.includes(c))) return { kind: "letters" };
  for (let i = 1; i < w.length; i++) if (!canStep(p, w[i - 1], w[i])) return { kind: "line", at: i };
  if (have.has(w)) return { kind: "found" };
  if (counts(w)) return { kind: "word", points: pointsOf(p, w), full: isFull(p, w) };
  if (index().blocked.has(w) || !dict) return { kind: "unknown" };
  if (dict.isVariant(w)) return { kind: "variant" };
  return { kind: dict.isWord(w) ? "rare" : "unknown" };
}
/** How a word is grouped in the lists: by its length, four to seven then eight and more (an index). */
export const groupOf = w => Math.min(4, Math.max(0, w.length - MIN_LEN));
export const GROUPS = ["Four letters", "Five letters", "Six letters", "Seven letters", "Eight or more"];

/** The words a seat found that nobody else at the table did (a race's result stars them); duel.js keeps each seat's run, s<slot>. */
export function onlyMine(g, slot) {
  const others = new Set(), mine = Object.keys(g?.runs?.[`s${slot}`]?.words || {});
  for (const [k, r] of Object.entries(g?.runs || {})) if (k !== `s${slot}`) for (const w of Object.keys(r?.words || {})) others.add(w);
  return new Set(mine.filter(w => !others.has(w)));
}
