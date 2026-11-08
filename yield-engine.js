// Fathom (id yield; the on-screen name is Constellation): seven to eleven letters as stars joined by sight-lines. A word counts if
// every step from one letter to the next follows a sight-line (or stays on the star, for a doubled letter), so the sky, not a
// rule to remember, is what limits the words. The words are yield-words.js's (ordinary English, the same on both sides of
// the Atlantic); a puzzle's yield is every one of them its sky allows, found exhaustively, 40 to 100 of them. At least one
// word is a full tour (visits every star). Pure: no page, tested in Node.
// Korbi, 8 November 2026: replaces the Spelling Bee clone. Two mechanisms, a skin on top: the sight-lines (what limits the
// words) and the shadows (what tells you where the missing ones are). Space is the skin.
import { WORDS, BAND, BLOCKED } from "./yield-words.js";

export const LEVELS = { light: "Light", medium: "Medium", heavy: "Heavy" };
export const DAILY = { level: "medium" };   // today's, the same for everyone
export const MIN_LEN = 4, FULL_BONUS = 7, STARS = 7, MAX_STARS = 11;   // a sky has STARS to MAX_STARS stars (its letters' length)
const A = 97;

// The levels: a size in words and the depth of vocabulary the rank to aim for needs (depthOf). Light gets there on everyday
// words; Heavy needs words people use less. Every level is inside 40 to 100 words (Korbi, 8 Nov 2026: "40-60 words perfectly valid, just make sure the long ones are there").
const BANDS = {
  light: { words: [40, 72], depth: [2.75, 9] },
  medium: { words: [42, 86], depth: [2.35, 2.75] },
  heavy: { words: [44, 100], depth: [0, 2.35] },
};
// Korbi, 8 November 2026: "-ER and -EG make the game a bit unfun" (a pile of words on one ending is one trick, not a puzzle),
// and "the very long words are the most fun ones". So no two-letter ending may take more than this share (or this many) of
// the words, and a sky must hold enough long words (SEVEN or more letters, SIX or more).
const FAIR_END = 0.3, FAIR_END_N = 16, FAIR_SEVEN = 0.07, FAIR_SIX = 0.2;
const MAX_END = 0.25, MAX_END_N = 14, MIN_SEVEN = 0.14, MIN_SIX = 0.32;
// Korbi, 8 Nov 2026, after ten skies that all had -ER biggest: the endings every English word seems to carry (-ED, -ER, -ING, -LY, -IC,
// -AL, -NESS, -OUS, -TION, -ABLE) must not be the biggest pile in most skies (three in four), and none of them may take more than a tenth.
// A sky may have them, but not every time. The letters are picked evenly too (see which letters, below).
// (narrowed to the four Korbi named after the wide list proved unavoidable: no two banned lines keep -ON, -LE or -AL from leading)
const COMMON_ENDS = new Set(["ed", "er", "ng", "ly"]);
const pairKey = (a, b) => (a < b ? a + b : b + a);
const COMMON_PAIRS = new Set([...COMMON_ENDS].map(e => pairKey(e[0], e[1])));
const MAX_COMMON = 0.2, STRICT = 1;

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
/** The counted words, unpacked once: how common each is, by letter set the ones up to nine stars can hold (a set's words all use every one of its letters: its tours). */
function index() {
  if (IDX) return IDX;
  const band = new Map([...BAND].map((c, i) => [c, (i + 15) / 10]));
  const zipf = new Map(), sets = new Map();
  for (const [n, [run, bands]] of Object.entries(WORDS)) {
    const len = Number(n);
    for (let i = 0; i < bands.length; i++) {
      const w = run.slice(i * len, i * len + len), m = maskOf(w), b = bitsOf(m);
      zipf.set(w, band.get(bands[i]));
      if (b > MAX_STARS) continue;
      const l = sets.get(m);
      if (l) l.push(w); else sets.set(m, [w]);
    }
  }
  IDX = { zipf, sets, blocked: new Set(BLOCKED.split(" ")), pools: new Map() };
  return IDX;
}
// ---------- which letters ----------
// Korbi, 8 Nov 2026: "pick letters first and then use as many as are needed ... AEIOUY, two or three of these per constellation, and
// roughly even probabilities", and "more stars is better than excessive connections". So a sky starts as seven, eight or nine letters
// drawn flat: two or three vowels, each of AEIOUY as likely as the others, and the consonants each as likely as the others. A set is
// kept if its letters make words enough (POOL_MIN, every sight-line drawn); the rarer letters (J, Q, X, Z) mostly fail that, which is
// the only way the words tilt the draw. (A full tour, one word with every star, is no longer asked of a sky: only one set in four has
// one, and asking made E, T and R belong to nearly every sky.)
const POOL_MIN = 50, EXTRA_WORDS = 6, VOWELS = "aeiouy", CONSONANTS = "bcdfghjklmnpqrtvwxz", ALPHABET = "abcdefghijklmnopqrtuvwxyz", SIZES = [[7, 0.3], [8, 0.7], [9, 1]];   // (cumulative shares of skies; the word list has no S)
/** How many counted words some of a letter set (any sight-lines) makes. */
function poolSize(mask) {
  const sets = index().sets;
  let n = 0;
  for (let sub = mask; sub; sub = (sub - 1) & mask) n += sets.get(sub)?.length || 0;
  return n;
}
// The words do tilt the draw (a sky needs 40 words, and E, T, A and R are in most of the words that make them), so each letter's chance of
// being drawn is bent by LEAN until the skies that are kept have every vowel, and every consonant, about as often as its kind (found by
// dealing a few hundred skies and nudging: `node tests/yield-letters.mjs --fit`).
const LEAN = {"a":0.28,"b":0.69,"c":0.52,"d":0.87,"e":0.2,"f":1.03,"g":0.9,"h":1.41,"i":0.91,"j":2,"k":1.37,"l":0.12,"m":0.52,"n":0.18,"o":0.8,"p":0.66,"q":2,"r":0.18,"t":0.11,"u":2,"v":1.53,"w":1.2,"x":2,"y":2,"z":2};
let lean = LEAN;
/** For fitting (tests/yield-letters.mjs): use another table. */
export const setLean = table => { lean = table; };
/** k of the letters, without repeats, each drawn in proportion to its lean. */
function drawn(letters, k, r) {
  const pool = [...letters], out = [];
  while (out.length < k) {
    let total = 0;
    for (const c of pool) total += lean[c] ?? 1;
    let x = r() * total, i = 0;
    for (; i < pool.length - 1; i++) { x -= lean[pool[i]] ?? 1; if (x < 0) break; }
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
/**
 * The letters of a sky: a core of seven to nine, drawn evenly (bent by LEAN) and kept if they make words enough, and then none, one or two
 * more stars drawn from any letter at all, each hung off the end by a single line (Korbi, 8 Nov 2026: "11 stars also ok ... even if it
 * just adds 1-3 words"). The extras are what let J, Q, X, Z, and the less usual letters in, and keep E and T from every sky.
 * { core, letters } (both alphabetical).
 */
function pickLetters(r) {
  for (;;) {
    const x = r(), n = SIZES.find(([, c]) => x < c)[0], v = 2 + (r() < 0.5 ? 0 : 1);
    const chosen = [...drawn(VOWELS, v, r), ...drawn(CONSONANTS, n - v, r)];
    const mask = maskOf(chosen.join(""));
    if (poolSize(mask) < POOL_MIN) continue;
    const core = lettersOf(mask), y = r(), more = y < 0.3 ? 0 : y < 0.65 ? 1 : 2;
    // an extra star must earn its place: some words use it (else its one line would carry nothing, and vanish, and leave the star adrift)
    const extra = [], base = poolSize(mask);
    for (const c of shuffled([...ALPHABET].filter(c => !core.includes(c)), r)) {
      if (extra.length === more) break;
      if (poolSize(mask | maskOf(c)) - base >= EXTRA_WORDS) extra.push(c);
    }
    return { core, letters: lettersOf(maskOf(core + extra.join(""))) };
  }
}
/** For tests and tuning: how often each letter is among a sky's, over `n` draws. */
export function letterOdds(n = 2000) {
  const r = rng(99), odds = {};
  for (let i = 0; i < n; i++) for (const c of pickLetters(r).letters) odds[c] = (odds[c] || 0) + 1 / n;
  return odds;
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
/** Whether a word is a full tour: it visits every star. */
export const isFull = (p, w) => bitsOf(maskOf(w)) === p.letters.length;
/** A word's points: one for four letters, one a letter for more, seven more for a full tour. */
export const pointsOf = (p, w) => (w.length === MIN_LEN ? 1 : w.length) + (isFull(p, w) ? FULL_BONUS : 0);
export const totalOf = (p, words) => words.reduce((s, w) => s + pointsOf(p, w), 0);
/** Every counted word the sky allows, alphabetical. */
export function yieldOf(p) {
  const t = reachOf(p), out = [];
  next: for (const w of poolOf(maskOf(p.letters))) {      // (every pool word is made of the sky's letters: only the steps need looking at)
    for (let i = 1, prev = w.charCodeAt(0) - A; i < w.length; i++) {
      const c = w.charCodeAt(i) - A;
      if (t[prev * 26 + c] !== 1) continue next;
      prev = c;
    }
    out.push(w);
  }
  return out.sort();
}

// ---------- the sky's shape: where the stars stand ----------
// Korbi, 8 Nov 2026: "less polyhedron, more odd shape". Places scattered the way a constellation's are, from the seed: spread across
// the picture, none close enough to crowd another. Of the ways to stand the letters on them, one (a swap search finds it) with the fewest sight-lines
// crossing (picked among the best by the seed), so the drawing is as clear as the sky allows (a line that runs through another
// star counts against a layout too, as eight crossings). Pure and the same on every device, so a table sees one sky.
const APART = 0.56;                                              // the nearest two stars may stand (seven of them), in the sky's units
/** n places, irregular and spread: scattered at random, each clear of the others, and wide and tall enough to fill the picture. */
function scatter(r, n) {
  const apart = APART * Math.sqrt(STARS / n) * (n > 9 ? 0.92 : 1);   // more stars, a little closer
  for (;;) {
    const pts = [];
    for (let tries = 0; pts.length < n && tries < 300; tries++) {
      const c = [(r() * 2 - 1) * 0.95, (r() * 2 - 1) * 0.92];
      if (pts.every(q => Math.hypot(q[0] - c[0], q[1] - c[1]) >= apart)) pts.push(c);
    }
    if (pts.length < n) continue;
    const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (x1 - x0 > 1.3 && y1 - y0 > 1.1) return pts.map(([x, y]) => [((x - x0) / (x1 - x0) * 2 - 1) * 0.97, ((y - y0) / (y1 - y0) * 2 - 1) * 0.94]);   // stretched to fill the picture
  }
}
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
/** How badly a standing of the stars (perm[i]: the place of star i) reads: crossings, and lines that run through another star (eight each). */
function untidy(perm, here, links) {
  const n = perm.length;
  let bad = 0;
  for (let a = 0; a < links.length; a++) {
    const [i, j] = links[a];
    for (let s = 0; s < n; s++) if (s !== i && s !== j && near(here[perm[s]], here[perm[i]], here[perm[j]])) bad += THROUGH;   // a line through a star reads as a step to it, and a drag would take it
    for (let b = a + 1; b < links.length; b++) {
      const [k, l] = links[b];
      if (i === k || i === l || j === k || j === l) continue;
      if (cross(here[perm[i]], here[perm[j]], here[perm[k]], here[perm[l]])) bad++;
    }
  }
  return bad;
}
/** The standings a few restarts of swap-two-stars settle on (nine stars have 362880, too many to try them all): { best, picks }. */
function tidiest(here, links, r) {
  const n = here.length;
  let best = Infinity, picks = [];
  for (let start = 0; start < 14 && best > 2; start++) {
    let perm = shuffled([...Array(n).keys()], r), cur = untidy(perm, here, links);
    for (let moved = true; moved && cur > 0;) {
      moved = false;
      for (let i = 0; i < n && cur > 0; i++) for (let j = i + 1; j < n; j++) {
        [perm[i], perm[j]] = [perm[j], perm[i]];
        const c = untidy(perm, here, links);
        if (c < cur) { cur = c; moved = true; } else [perm[i], perm[j]] = [perm[j], perm[i]];
      }
    }
    if (cur < best) { best = cur; picks = [perm]; } else if (cur === best) picks.push(perm);
  }
  return { best, picks };
}
const skies = new Map();
/** { stars: [{ ch, x, y }] in letter order (x and y between -1 and 1), links: [[i, j]] } for a puzzle. */
export function skyOf(p) {
  const key = `${p.letters}|${p.edges}|${p.seed}`;
  if (skies.has(key)) return skies.get(key);
  const r = rng((p.seed ^ 0x57a25) >>> 0), links = p.edges.split(" ").filter(Boolean).map(e => [p.letters.indexOf(e[0]), p.letters.indexOf(e[1])]);
  let best = Infinity, picks = [], spots = null;
  for (let tryNo = 0; tryNo < 6 && best > 2; tryNo++) {            // a few different scatterings; the clearest wins
    const here = scatter(r, p.letters.length), found = tidiest(here, links, r);
    if (found.best < best) { best = found.best; picks = found.picks; spots = here; }
  }
  const perm = picks[Math.floor(r() * picks.length)];
  const at = i => spots[perm[i]];
  let crossings = 0, through = 0;
  links.forEach(([i, j], a) => {
    for (let s = 0; s < p.letters.length; s++) if (s !== i && s !== j && near(at(s), at(i), at(j))) through++;
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
/** The most words that end on the same two letters. */
export function endings(words, only = null) {
  const n = new Map();
  let top = 0;
  for (const w of words) { const k = w.slice(-2); if (only && !only.has(k)) continue; const c = (n.get(k) || 0) + 1; n.set(k, c); if (c > top) top = c; }
  return top;
}
/** What a puzzle is like: its size, points, depth, its full tours, and how much of it is one ending. */
export function statsOf(p, words = yieldOf(p)) {
  const tours = words.filter(w => isFull(p, w)), top = endings(words), common = endings(words, COMMON_ENDS);
  const used = new Set(words.join(""));
  return { words: words.length, points: totalOf(p, words), depth: depthOf(p, words), tours: tours.length, dead: [...p.letters].filter(c => !used.has(c)).length,
    end: top, common, commonTop: top === common, seven: words.filter(w => w.length >= 7).length / (words.length || 1), six: words.filter(w => w.length >= 6).length / (words.length || 1) };
}
/** Whether a puzzle's stats suit a level. */
function suits(level, s, strict = true) {
  const b = BANDS[level];
  return (!strict || (!s.commonTop && s.common <= Math.max(6, MAX_COMMON * s.words))) && !s.dead && s.words >= b.words[0] && s.words <= b.words[1] && s.depth >= b.depth[0] && s.depth < b.depth[1]
    && s.end <= Math.min(MAX_END_N, MAX_END * s.words) && s.seven >= (strict ? 0.1 : MIN_SEVEN) && s.six >= (strict ? 0.22 : MIN_SIX);
}
/**
 * Whether a sky is fair for a level even if it is not the best: the same tests a little looser. Which letter sets can meet every test
 * is itself uneven (without T there are fewer long words, say), and holding out for the best sky would leave the skies on the same few
 * letters (Korbi, 8 Nov 2026: "roughly even probabilities"); so each set gets its nearest sky, and this says whether it will do.
 */
function fair(level, s, strict) {
  const b = BANDS[level];
  return !s.dead && s.words >= b.words[0] && s.words <= b.words[1] && s.depth >= b.depth[0] - 0.3 && s.depth < b.depth[1] + 0.3
    && s.end <= Math.min(FAIR_END_N, FAIR_END * s.words) && s.seven >= FAIR_SEVEN && s.six >= FAIR_SIX && !(strict && s.commonTop);
}
/** How far a puzzle is from a level, for the nearest when none suits in the tries allowed. */
function distance(level, s, strict = true) {
  const b = BANDS[level], off = (x, a, z) => (x < a ? a - x : x > z ? x - z : 0);
  return s.dead * 30 + (off(s.words, b.words[0], b.words[1]) ? 50 + off(s.words, b.words[0], b.words[1]) : 0) + off(s.depth, b.depth[0], b.depth[1] - 0.001) * 4 + Math.max(0, s.end - Math.min(MAX_END_N, MAX_END * s.words))
    + Math.max(0, (strict ? 0.1 : MIN_SEVEN) - s.seven) * 10 + Math.max(0, (strict ? 0.22 : MIN_SIX) - s.six) * 10
    + (strict ? Math.max(0, s.common - Math.max(6, MAX_COMMON * s.words)) + (s.commonTop ? 3 : 0) : 0);
}

// ---------- dealing ----------
const TRIES = 20000, STEPS = 150, WANDER = 60;
const maxLines = letters => letters.length + 6;     // 13 lines on seven stars, 17 on eleven (two of them single lines to the extra stars)
/** The lines the three commonest of the common endings, among every word these letters make, need: two letters each. */
function bannedFor(letters) {
  const n = new Map();
  for (const w of poolOf(maskOf(letters))) { const k = w.slice(-2); if (COMMON_ENDS.has(k)) n.set(k, (n.get(k) || 0) + 1); }
  return new Set([...n].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 2).map(([k]) => pairKey(k[0], k[1])));
}
/** Every pair of the letters, the stars' possible sight-lines. */
const pairsOf = letters => [...letters].flatMap((a, i) => [...letters].slice(i + 1).map(b => a + b));
/** A suiting sky drifted a few lines on while it still suits, so that two seeds that settle on the same letters don't deal the same sky. */
function wander(level, p, base, on, rest, r, strict) {
  const MAX_LINES = maxLines(p.letters);
  const make = set => ({ ...p, edges: [...base, ...set].sort().join(" ") });
  let at = p;
  // first the lines it can do without come away (Korbi, 8 Nov 2026: less polyhedron, a few stars hanging off the ends), then a few
  // swaps of one line for another, so that two seeds that settle on the same letters don't deal the same sky
  if (r() < 0.5) for (const k of shuffled([...on], r)) {
    const next = new Set(on); next.delete(k);
    const q = make(next);
    if (suits(level, statsOf(q), strict)) { at = q; on = next; }
  }
  for (let i = 0; i < WANDER; i++) {
    const out = [...on], k = rest[Math.floor(r() * rest.length)];
    if (on.has(k) || (!out.length && base.size + on.size >= MAX_LINES)) continue;
    const next = new Set(on);
    if (base.size + on.size >= MAX_LINES || r() < 0.5) next.delete(out[Math.floor(r() * out.length)]);   // a swap, or (with room) just one more line
    next.add(k);
    const q = make(next);
    if (suits(level, statsOf(q), strict)) { at = q; on = next; }
  }
  return at;
}
/**
 * A puzzle for a seed at a level. A full tour is picked first (a word with a sky's every letter, seven to nine of them) and its steps are the
 * sight-lines that make it a tour, so every sky has at least one. Then a few lines are added or taken away, one at a time,
 * keeping a change whenever the sky gets no further from the level: lines are what pick the words, so this is how a sky
 * loses its pile of one ending. The first sky that suits, else the nearest of the first TRIES.
 */
export function deal({ seed, level = "medium" }) {
  if (!BANDS[level]) throw new Error(`no level ${level}`);
  const r = rng(seed);
  let strict = r() < STRICT;          // (a strict sky that no search finds in the first half of the tries gives its rules up, so a deal always makes its words)
  let best = null, tried = 0;
  for (;;) {
    const { core, letters } = pickLetters(r);          // the letters first, evenly (pickLetters)
    const got = climb(letters, core, level, seed, strict, r, STEPS);
    tried += got.steps;
    if (got.found) return wander(level, got.found.p, got.base, got.found.on, got.rest, r, strict);
    if (got.best && (!best || got.best.d < best.d)) best = got.best;
    if (tried >= TRIES) return (best || { p: got.fallback }).p;
    if (strict && tried >= Math.floor(TRIES * 0.5)) { strict = false; best = null; }
  }
}
/**
 * The sight-lines every sky of a letter set keeps, so no star is cut off: the steps of the word that visits the most of its stars
 * (a long one, for the long words), and each star it misses hung off the end of a star it visits by a single line (Korbi, 8 Nov
 * 2026: "throw 1-2 letters at one end and not connect it to many other letters").
 */
function backbone(letters, core, r, banned = new Set()) {
  const mask = maskOf(core), sets = index().sets, cover = new Map();
  for (let sub = mask; sub; sub = (sub - 1) & mask) for (const w of sets.get(sub) || []) { const k = bitsOf(sub); (cover.get(k) || cover.set(k, []).get(k)).push(w); }
  // the longest-reaching word whose steps use none of the banned lines, if there is one within two stars of the best
  const clean = w => { for (let i = 1; i < w.length; i++) if (banned.has(pairKey(w[i - 1], w[i]))) return false; return true; };
  const best = Math.max(...cover.keys());
  let top = best, pick = cover.get(best).filter(clean);
  for (let k = best - 1; !pick.length && k >= best - 2 && cover.has(k); k--) { pick = cover.get(k).filter(clean); top = k; }
  if (!pick.length) pick = cover.get(best);
  const w = pick[Math.floor(r() * pick.length)], base = new Set(), seen = [...new Set(w)];
  for (let i = 1; i < w.length; i++) if (w[i] !== w[i - 1]) base.add(pairKey(w[i - 1], w[i]));
  for (const c of letters) if (!seen.includes(c)) {
    // hung on the line the most words walk (never a banned one, if it can help it), so the star is used
    const words = poolOf(maskOf(letters)), use = x => words.reduce((n, w) => n + (w.includes(c + x) || w.includes(x + c) ? 1 : 0), 0);
    const ok = seen.filter(x => !banned.has(pairKey(c, x))), from = ok.length ? ok : seen, score = from.map(use), top = Math.max(...score);
    const best = from.filter((x, i) => score[i] === top);
    base.add(pairKey(c, best[Math.floor(r() * best.length)]));
    seen.push(c);
  }
  return base;
}
/**
 * One letter set's search: the backbone's lines, a few more drawn, then one at a time added or taken away,
 * keeping a change whenever the sky gets no further from the level. { found: { p, on } } when one suits, else the nearest it saw.
 */
export function climb(letters, core, level, seed, strict, r, steps) {
  const MAX_LINES = maxLines(letters), ban = strict ? bannedFor(letters) : new Set(), base = backbone(letters, core, r, ban), rest = [], extra = [...letters].filter(c => !core.includes(c));
  // a strict sky draws no extra line for the two common endings these letters would make most of (-ER and -ED, say); the tour's own
  // steps stay (skipping the tours that walk one dropped most letter sets, and favoured the odd ones)
  const banned = new Set([...ban].filter(k => !base.has(k)));
  const make = extra => ({ letters, edges: [...base, ...extra].sort().join(" "), level, seed });
  for (const k of pairsOf(letters)) if (!base.has(k) && !banned.has(k) && !extra.some(c => k.includes(c))) rest.push(k);   // an extra star keeps its one line
  let on = new Set(shuffled(rest, r).slice(0, Math.floor(r() * r() * (Math.max(0, Math.min(rest.length, MAX_LINES - base.size)) + 1))));
  let cur = null, prev = on, best = null, done = 0;
  for (let step = 0; step <= steps; step++) {
    if (step) {                                      // one line toggled: a new one in, or an extra one out
      const next = new Set(on), k = rest[Math.floor(r() * rest.length)];
      if (next.has(k)) next.delete(k);
      else {
        if (base.size + next.size >= MAX_LINES) { const out = [...next]; if (!out.length) continue; next.delete(out[Math.floor(r() * out.length)]); }   // full: one out for the one in
        next.add(k);
      }
      prev = on; on = next;
    }
    const p = make(on), s = statsOf(p);
    done++;
    if (suits(level, s, strict)) return { steps: done, base, rest, found: { p, on }, best };
    const d = distance(level, s, strict);
    if (!best || d < best.d) best = { p, d, s, on };
    if (cur !== null && d > cur) { on = prev; } else cur = d;
  }
  if (best && fair(level, best.s, strict)) return { steps: done, base, rest, found: { p: best.p, on: best.on }, best };   // the nearest it saw is fair
  return { steps: done, base, rest, best, fallback: best.p };
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
/** How many of the words not yet found start on each star (an array by star index), and the most on any one. */
export function startsOf(p, words, found = new Set()) {
  const n = Array(p.letters.length).fill(0);
  let max = 0;
  for (const w of words) if (!found.has(w)) { const i = trailOf(p, w)[0]; if (++n[i] > max) max = n[i]; }
  return { n, max };
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
 *   spelling only), bonus (a dictionary word the sky does not list: it scores all the same), unknown (not in the list).
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
  return dict.isWord(w) ? { kind: "bonus", points: pointsOf(p, w), full: isFull(p, w) } : { kind: "unknown" };
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
