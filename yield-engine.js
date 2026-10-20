// Yield: Spelling Bee's genre (README, Yield). Seven letters in a hive, words of four letters or more that use only
// them, each with the centre letter, letters as often as you like; at least one pangram uses all seven. The Wheel is
// the genre's other half, the newspapers' Target and Polygon: nine tiles, each used once at most, and a nine-letter word
// among them. The words that count are yield-words.js's (ordinary English, the same on both sides of the Atlantic);
// a puzzle's yield is every one of them its letters make, found exhaustively here. Pure: no page, tested in Node.
import { WORDS, BAND, BLOCKED, DAYS } from "./yield-words.js";

// ---------- the boards and the levels ----------
export const BOARDS = { hive: "Hive", wheel: "Wheel" };
export const LEVELS = { light: "Light", medium: "Medium", heavy: "Heavy" };
export const DAILY = { board: "hive", level: "medium" };   // today's, the same for everyone
export const MIN_LEN = 4, FULL_BONUS = 7;
const A = 97;

// The crude grades: a level is the depth of vocabulary its Master refiner needs (depth, below), with a size and a
// pangram that suit it. Light reaches the coveted rank on everyday words; Heavy needs words people use less.
// Sizes are counts of words: a hive gives more than a wheel, whose letters are spent as they're used.
const BANDS = {
  hive: {
    light: { words: [20, 42], depth: [2.75, 9], full: 3.0 },
    medium: { words: [26, 55], depth: [2.35, 2.75], full: 2.5 },
    heavy: { words: [30, 75], depth: [0, 2.35], full: 0 },
  },
  wheel: {
    light: { words: [16, 36], depth: [2.75, 9], full: 3.0 },
    medium: { words: [20, 45], depth: [2.35, 2.75], full: 2.5 },
    heavy: { words: [22, 55], depth: [0, 2.35], full: 0 },
  },
};
// two centres or more, the team's yield is every word with any player's letter: larger, so a band of its own
const TEAM_WORDS = { light: [30, 64], medium: [38, 80], heavy: [45, 96] };
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
const hashText = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

// ---------- the words ----------
export const maskOf = w => { let m = 0; for (let i = 0; i < w.length; i++) m |= 1 << (w.charCodeAt(i) - A); return m; };
const bitsOf = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
const lettersOf = m => { let s = ""; for (let i = 0; i < 26; i++) if ((m >> i) & 1) s += String.fromCharCode(A + i); return s; };
const countsOf = w => { const c = new Uint8Array(26); for (let i = 0; i < w.length; i++) c[w.charCodeAt(i) - A]++; return c; };

let IDX = null;
/** The counted words, unpacked once: how common each is, and by letter set the ones a hive or a wheel can hold. */
function index() {
  if (IDX) return IDX;
  const band = new Map([...BAND].map((c, i) => [c, (i + 15) / 10]));
  const zipf = new Map(), hive = new Map(), wheel = new Map(), sets = new Set(), nines = [];
  const add = (map, m, w) => { const l = map.get(m); if (l) l.push(w); else map.set(m, [w]); };
  for (const [n, [run, bands]] of Object.entries(WORDS)) {
    const len = Number(n);
    for (let i = 0; i < bands.length; i++) {
      const w = run.slice(i * len, i * len + len), m = maskOf(w), b = bitsOf(m);
      zipf.set(w, band.get(bands[i]));
      if (b <= 7) add(hive, m, w);
      if (b === 7) sets.add(m);
      if (len <= 9) add(wheel, m, w);
      if (len === 9) nines.push(w);
    }
  }
  IDX = { zipf, hive, wheel, sets: [...sets].sort((a, b) => a - b), nines: nines.sort(), blocked: new Set(BLOCKED.split(" ")) };
  return IDX;
}
/** Every hive's letters that have a pangram, each as its seven letters: the sets a hive is dealt from. */
export const hiveSets = () => index().sets.map(lettersOf);
/** Whether Yield counts a word anywhere (any case). */
export const counts = w => index().zipf.has(String(w || "").toLowerCase());
/** How often a counted word is used: its Zipf frequency (0 for a word Yield doesn't count). */
export const zipfOf = w => index().zipf.get(w) ?? 0;
/** How readily a person thinks of a word: how common it is, less for every letter past four. */
export const ease = w => zipfOf(w) - 0.2 * (w.length - MIN_LEN);

// ---------- a puzzle and its yield ----------
// A puzzle is { board, letters, centre, level, seed } (and a team's, centres: one for each seat, in seat order).
// letters: a hive's seven, alphabetical; a wheel's nine tiles, alphabetical, a letter twice when the word has it twice.
const tilesOf = p => countsOf(p.letters);
/** Whether a word uses every letter: a hive's pangram (all seven), a wheel's nine-letter word (every tile). */
export const isFull = (p, w) => (p.board === "wheel" ? w.length === p.letters.length : bitsOf(maskOf(w)) === 7);
/** A word's points: one for four letters, one a letter for more, seven more for using every letter. */
export const pointsOf = (p, w) => (w.length === MIN_LEN ? 1 : w.length) + (isFull(p, w) ? FULL_BONUS : 0);
/**
 * Every counted word the puzzle's letters make with at least one of `centres` in it (one centre alone, a team's
 * several), in alphabetical order. Found by every subset of the letters, so nothing is missed: a hive has 128.
 */
export function yieldOf(p, centres = [p.centre]) {
  const { hive, wheel } = index(), M = maskOf(p.letters), need = maskOf(centres.join("")), out = [];
  const tiles = p.board === "wheel" ? tilesOf(p) : null, map = tiles ? wheel : hive;
  for (let sub = M; sub; sub = (sub - 1) & M) {
    if (!(sub & need)) continue;
    for (const w of map.get(sub) || []) {
      if (tiles) { const c = countsOf(w); let ok = true; for (let i = 0; i < 26 && ok; i++) if (c[i] > tiles[i]) ok = false; if (!ok) continue; }
      out.push(w);
    }
  }
  return out.sort();
}
export const totalOf = (p, words) => words.reduce((s, w) => s + pointsOf(p, w), 0);

// ---------- difficulty ----------
/**
 * How deep a puzzle's vocabulary goes: finding its words in order of ease (the commonest and shortest first, as a
 * person tends to), the ease of the word that takes the points past the Master refiner's 70%. A low depth means the
 * coveted rank needs words people use rarely; it is the level's measure, the size only a range for it.
 */
export function depthOf(p, words) {
  const total = totalOf(p, words), sorted = [...words].sort((a, b) => ease(b) - ease(a) || (a < b ? -1 : 1));
  let acc = 0;
  for (const w of sorted) { acc += pointsOf(p, w); if (acc >= RANKS[8][0] * total) return ease(w); }
  return 0;
}
/** What a puzzle is like: its size, points, depth, its pangrams' commonness, and how much of it is one ending. */
export function statsOf(p, words = yieldOf(p)) {
  const fulls = words.filter(w => isFull(p, w));
  return { words: words.length, points: totalOf(p, words), depth: depthOf(p, words), full: Math.max(0, ...fulls.map(zipfOf)), fulls: fulls.length,
    ing: words.filter(w => w.endsWith("ing")).length / (words.length || 1), ed: words.filter(w => w.endsWith("ed")).length / (words.length || 1) };
}
/** Whether a puzzle's stats suit a level (team: the team's yield, with its own sizes). */
function suits(board, level, s, team = false) {
  const b = BANDS[board][level], [lo, hi] = team ? TEAM_WORDS[level] : b.words;
  return s.fulls > 0 && s.words >= lo && s.words <= hi && s.depth >= b.depth[0] && s.depth < b.depth[1] && s.full >= b.full && s.ing <= MAX_ING && s.ed <= MAX_ED;
}
/** How far a puzzle is from a level, for the nearest when none suits in the tries allowed. */
function distance(board, level, s, team = false) {
  const b = BANDS[board][level], [lo, hi] = team ? TEAM_WORDS[level] : b.words;
  const off = (x, a, z) => (x < a ? a - x : x > z ? x - z : 0);
  return (s.fulls ? 0 : 100) + off(s.words, lo, hi) / 10 + off(s.depth, b.depth[0], b.depth[1] - 0.001) * 4 + off(s.full, b.full, 99) + Math.max(0, s.ing - MAX_ING) * 5 + Math.max(0, s.ed - MAX_ED) * 5;
}

// ---------- dealing ----------
const TRIES = 400;
/** The candidates a seed tries, in order: [letters, centre]. A hive: a letter set with a pangram, then its centres in a random order; a wheel: a nine-letter word, then its letters. */
function* candidates(board, r) {
  const { sets, nines } = index();
  for (;;) {
    if (board === "wheel") {
      const nine = nines[Math.floor(r() * nines.length)];
      for (const c of shuffled([...new Set(nine)], r)) yield [[...nine].sort().join(""), c];
    } else {
      const m = sets[Math.floor(r() * sets.length)], letters = lettersOf(m);
      for (const c of shuffled([...letters], r)) yield [letters, c];
    }
  }
}
/** A puzzle for a seed at a level: the first candidate that suits it, else the nearest of the first TRIES. */
export function deal({ seed, level = "medium", board = "hive" }) {
  if (!BANDS[board]?.[level]) throw new Error(`no ${board} at ${level}`);
  const r = rng(seed);
  let best = null, tried = 0;
  for (const [letters, centre] of candidates(board, r)) {
    const p = { board, letters, centre, level, seed }, s = statsOf(p);
    if (suits(board, level, s)) return p;
    const d = distance(board, level, s);
    if (!best || d < best.d) best = { p, d };
    if (++tried >= TRIES) return best.p;
  }
}

/** A day (YYYYMMDD, the suite's today()) as a count of days, so the dailies walk through their letter sets in order. */
const dayNumber = day => Date.UTC(Math.floor(day / 10000), Math.floor(day / 100) % 100 - 1, day % 100) / 864e5;
export const FIRST_DAY = 20261020;       // the walk's first day
/** Whether a letter set has a centre that makes today's kind of puzzle: the sets the dailies walk through (DAYS). */
export function makesDaily(letters) {
  return [...letters].some(c => suits(DAILY.board, DAILY.level, statsOf({ board: DAILY.board, letters, centre: c })));
}
/**
 * Today's puzzle: a hive at Medium, the same for everyone. The days walk through DAYS, every letter set that can make
 * one, in the shuffled order yield-words.js keeps (deciding which sets can takes seconds, too long for a phone to
 * work out as it opens), so no set comes back until all thousand-odd have been used, nearly three years; each day
 * takes the first of its set's centres, in an order the day's seed sets, that makes a Medium puzzle.
 */
export function daily(day) {
  const n = DAYS.length / 7, at = (((dayNumber(day) - dayNumber(FIRST_DAY)) % n) + n) % n, k = Number.isInteger(at) ? at : 0;
  const letters = DAYS.slice(k * 7, k * 7 + 7);
  let best = null;
  for (const c of shuffled([...letters], rng(day))) {
    const p = { board: DAILY.board, letters, centre: c, level: DAILY.level, seed: day, day }, s = statsOf(p);
    if (suits(DAILY.board, DAILY.level, s)) return p;
    const d = distance(DAILY.board, DAILY.level, s);
    if (!best || d < best.d) best = { p, d };
  }
  return best.p;                     // only when the words have changed since DAYS was written (tests/yield.mjs says so)
}

/**
 * A puzzle for a team (README, Yield: Together): the same letters for everyone and a centre letter for each seat, so
 * each player's words are their own and the team's yield is all of them. The first two centres are the pair's, the
 * pair whose words only one of them can enter are the most even; the rest follow for a party's further seats.
 */
export function dealTeam({ seed, level = "medium", board = "hive" }) {
  const r = rng(seed ^ 0x5eed), b = BANDS[board][level];
  let best = null, tried = 0;
  for (const [letters] of candidates(board, r)) {
    if (++tried > TRIES) break;
    const base = { board, letters, centre: letters[0], level, seed };
    const own = new Map([...new Set(letters)].map(c => [c, new Set(yieldOf(base, [c]))]));
    let pick = null;
    for (const [a, wa] of own) for (const [c, wc] of own) {
      if (a >= c) continue;
      const union = new Set([...wa, ...wc]), onlyA = [...wa].filter(w => !wc.has(w)).length, onlyC = [...wc].filter(w => !wa.has(w)).length;
      const even = Math.min(onlyA, onlyC) / Math.max(1, union.size);
      if (!pick || even > pick.even) pick = { a, c, even, union };
    }
    if (!pick) continue;
    const p = { ...base, centre: pick.a, centres: [pick.a, pick.c] };
    const words = [...pick.union].sort(), s = statsOf(p, words);
    // the rest of the letters for more seats, those that add the most words of their own first
    p.centres.push(...[...own.keys()].filter(c => !p.centres.includes(c)).sort((x, y) => own.get(y).size - own.get(x).size || (x < y ? -1 : 1)));
    const fit = suits(board, level, s, true) && pick.even >= 0.22;
    const d = distance(board, level, s, true) + Math.max(0, 0.22 - pick.even) * 20;
    if (fit) return p;
    if (!best || d < best.d) best = { p, d };
  }
  return best?.p || { ...deal({ seed, level, board }), centres: null };
}
/**
 * A team's words, from every seat's run at the table (duel.js keeps each seat's run, s<slot>, and Yield puts in it
 * words: { word: ms into the match }): Map(word -> the seat that found it first, the lower seat on a tie). Each phone
 * writes only its own run, so two finds at once never collide; the team's yield is all of them together.
 */
export function teamFound(g) {
  const all = new Map();
  for (const x of Object.values(g?.players || {})) {
    if (!x || x.slot == null) continue;
    for (const [w, t] of Object.entries(g.runs?.[`s${x.slot}`]?.words || {})) {
      const had = all.get(w);
      if (!had || t < had.t || (t === had.t && x.slot < had.slot)) all.set(w, { t, slot: x.slot });
    }
  }
  return new Map([...all].map(([w, x]) => [w, x.slot]));
}
/** The words a seat found that nobody else at the table did (a race's result stars them). */
export function onlyMine(g, slot) {
  const others = new Set(), mine = Object.keys(g?.runs?.[`s${slot}`]?.words || {});
  for (const [k, r] of Object.entries(g?.runs || {})) if (k !== `s${slot}`) for (const w of Object.keys(r?.words || {})) others.add(w);
  return new Set(mine.filter(w => !others.has(w)));
}
/** The centre of the player in seat `slot` at a team's table (seats past the letters share them round). */
export const centreFor = (p, slot) => (p.centres?.length ? p.centres[(slot ?? 0) % p.centres.length] : p.centre);
/** The centres in play at a team's table of `people`. */
export const centresIn = (p, people) => (p.centres?.length ? p.centres.slice(0, Math.max(1, Math.min(people, p.centres.length))) : [p.centre]);

// ---------- ranks ----------
// A refinery's run, from crude to every drop of the barrel: each rank a share of the puzzle's points. Full yield is
// every word; Master refiner, the one to aim for, 70%.
export const RANKS = [[0, "Crude"], [0.02, "Warming up"], [0.05, "On stream"], [0.08, "On spec"], [0.15, "Steady"], [0.25, "Full rate"],
  [0.4, "Cracking"], [0.5, "Record run"], [0.7, "Master refiner"], [1, "Full yield"]];
/** The points each rank needs, for a puzzle of `total` points (rounded, as players count them; Full yield is all). */
export const needed = total => RANKS.map(([f], i) => (i === RANKS.length - 1 ? total : Math.round(f * total)));
/** The rank reached with `points` of `total`: its index in RANKS. */
export function rankOf(points, total) {
  const need = needed(total);
  let r = 0;
  for (let i = 0; i < need.length; i++) if (points >= need[i]) r = i;
  return r;
}

// ---------- a word typed ----------
/**
 * What a typed word is, for a puzzle (README, Yield: what a word gets): { kind, points, full, by }. kind is one of
 *   short (fewer than four letters), letters (a letter not on the board), tiles (a wheel's tile used twice),
 *   centre (no centre letter: by is the seat whose letter it has, at a team's table), found (already found: by
 *   whoever found it), word (it counts: its points), variant (one side of the Atlantic's spelling only), rare (a
 *   word, but rarer than Yield counts), unknown (not in Yield's list).
 * have: what's been found, Map(word -> seat) or a Set; centre: this player's letter; seats: the other players'
 * centres by seat at a team's table; dict: wordlist.js's isWord and isVariant, once loaded (else every word Yield
 * doesn't count is unknown).
 */
export function judge(p, typed, { have = new Set(), centre = p.centre, seats = null, dict = null } = {}) {
  const w = String(typed || "").toLowerCase();
  if (w.length < MIN_LEN) return { kind: "short" };
  const M = maskOf(p.letters), m = maskOf(w);
  if (!/^[a-z]+$/.test(w) || (m & ~M)) return { kind: "letters" };
  if (p.board === "wheel") { const c = countsOf(w), t = tilesOf(p); for (let i = 0; i < 26; i++) if (c[i] > t[i]) return { kind: "tiles" }; }
  if (!w.includes(centre)) {
    const by = seats ? [...seats].find(([, c]) => c !== centre && w.includes(c))?.[0] ?? null : null;
    return { kind: "centre", by };
  }
  if (have.has(w)) return { kind: "found", by: have instanceof Map ? have.get(w) : null };
  if (counts(w)) return { kind: "word", points: pointsOf(p, w), full: isFull(p, w) };
  if (index().blocked.has(w) || !dict) return { kind: "unknown" };
  if (dict.isVariant(w)) return { kind: "variant" };
  return { kind: dict.isWord(w) ? "rare" : "unknown" };
}

// ---------- the yield chart: what's left, by first letter and length ----------
/**
 * The hints Spelling Bee's players know as the grid: for every first letter, how many words are left of each length,
 * and how many are left by their first two letters. rows: [{ letter, n: { length: count }, total }]; lengths: the
 * lengths with any word (longer than 9 counted as 9, so the grid stays narrow); starts: [[two letters, count]].
 */
export function chartOf(words, found = new Set()) {
  const left = words.filter(w => !found.has(w)), rows = new Map(), starts = new Map(), lengths = new Set();
  for (const w of words) { lengths.add(Math.min(9, w.length)); if (!rows.has(w[0])) rows.set(w[0], { letter: w[0], n: {}, total: 0 }); }
  for (const w of left) {
    const r = rows.get(w[0]), n = Math.min(9, w.length);
    r.n[n] = (r.n[n] || 0) + 1;
    r.total++;
    starts.set(w.slice(0, 2), (starts.get(w.slice(0, 2)) || 0) + 1);
  }
  return { rows: [...rows.values()].sort((a, b) => (a.letter < b.letter ? -1 : 1)), lengths: [...lengths].sort((a, b) => a - b), left: left.length,
    starts: [...starts.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)) };
}

// ---------- the computer player ----------
// It plays as a person does: it knows a word with a chance that falls with the word's ease below its vocabulary, and
// finds what it knows the commonest and shortest first, with some luck in the order; each word takes a while to think
// of, longer for rarer words and longer as the easy ones run out, and a moment to tap in. Its whole game is planned
// from the seed at the start, a time for every word it will find, so it plays the same on a reload and every phone.
// Fitted to how people play (tests/yield.mjs holds them to it): on a Medium hive, Novice finds about half the points
// in half an hour and never reaches Master refiner; Steady reaches it in thirty-odd minutes, Sharp in about fifteen;
// in a three-minute sprint they make about 30, 40 and 55 points.
export const RIVALS = {
  novice: { label: "Novice", vocab: 3.05, think: 19, luck: 0.6 },
  steady: { label: "Steady", vocab: 2.5, think: 13, luck: 0.5 },
  sharp: { label: "Sharp", vocab: 2.05, think: 7.5, luck: 0.4 },
};
/** The rival's game on a puzzle: [{ w, t }], t its seconds from the start, in the order it finds them. */
export function planFor(p, words, level, seed = p.seed) {
  const R = RIVALS[level];
  if (!R) return [];
  const r = rng((seed ^ hashText(level) ^ hashText(p.letters + p.centre)) >>> 0);
  const normal = () => { const u = Math.max(1e-9, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const known = [];
  for (const w of words) {
    const e = ease(w) + (isFull(p, w) ? 0.6 : 0);          // a pangram is what a good player looks for
    if (r() < 1 / (1 + Math.exp(-(e - R.vocab) / 0.25))) known.push({ w, sal: e + R.luck * normal() });
  }
  known.sort((a, b) => b.sal - a.sal || (a.w < b.w ? -1 : 1));
  let t = 0;
  return known.map((k, i) => {
    const late = 1 + 9 * (i / known.length) ** 2.5;          // the last words it knows come ten times slower than the first
    t += Math.max(2.5, R.think * Math.exp(0.6 * (3.6 - k.sal)) * late * (0.6 + 0.8 * r())) + 0.8 + 0.2 * k.w.length;
    return { w: k.w, t: Math.round(t * 10) / 10 };
  });
}
/** What the rival has found by `secs` into the game: { words, points }. */
export function rivalAt(p, plan, secs) {
  const got = plan.filter(x => x.t <= secs).map(x => x.w);
  return { words: got, points: totalOf(p, got) };
}

// ---------- the hive's outer letters, shuffled ----------
/** The letters round the centre in the order shown: the board's letters less one centre tile, shuffled by r. */
export function outerOf(p, r = Math.random) {
  const rest = [...p.letters], at = rest.indexOf(p.centre);
  if (at >= 0) rest.splice(at, 1);
  return shuffled(rest, r).join("");
}
