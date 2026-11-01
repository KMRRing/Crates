// Slate's engine: the rule catalogue, judging letters / pairs / whole fields, generating boards whose
// intended fill is the only one made of common words, and replaying a board's history into notes.
import { WORDS } from "./slate-words.js";

// ---------- words ----------
const unpack = packed => Object.fromEntries(Object.entries(packed).map(([L, s]) => {
  const out = [];
  for (let i = 0; i < s.length; i += +L) out.push(s.slice(i, i + +L).toUpperCase());
  return [L, out];
}));
export const EASY = unpack(WORDS.easy);                             // intended fills use only these
export const VALID = new Set(Object.values(unpack(WORDS.val)).flat());  // players may place any of these
const sig = w => [...w].sort().join("");
const SIGS = new Set([...VALID].map(sig));

// ---------- letters ----------
const VOWELS = "AEIOU";
const SET = {
  straight: "AEFHIKLMNTVWXYZ", curved: "BCDGJOPQRSU", enclosed: "ABDOPQR",
  top: "QWERTYUIOP", mid: "ASDFGHJKL", bottom: "ZXCVBNM",
  left: "QWERTASDFGZXCVB", right: "YUIOPHJKLNM",
  mirrorLR: "AHIMOTUVWXY", mirrorTB: "BCDEHIKOX", odd: "ACEGIKMOQSUWY", rare: "BCDFGHJKMPQVWXYZ",
};
const row = c => (SET.top.includes(c) ? 0 : SET.mid.includes(c) ? 1 : 2);
const shape = c => (SET.straight.includes(c) ? 0 : 1);
const hand = c => (SET.left.includes(c) ? 0 : 1);
const isVowel = c => VOWELS.includes(c);
const pos = c => c.charCodeAt(0) - 64;

// letter frequency in English text, for estimating how often a rule passes
const FREQ = { E: 12.7, T: 9.1, A: 8.2, O: 7.5, I: 7.0, N: 6.7, S: 6.3, H: 6.1, R: 6.0, D: 4.3, L: 4.0, C: 2.8, U: 2.8, M: 2.4,
  W: 2.4, F: 2.2, G: 2.0, Y: 2.0, P: 1.9, B: 1.5, V: 1.0, K: 0.8, J: 0.15, X: 0.15, Q: 0.1, Z: 0.07 };

// Hidden-keyword rules: words with five or six different letters.
const KEYWORDS = ["PLANET", "STORM", "BRIGHT", "FOLDER", "CANDLE", "MOUSE", "THING", "PRISM", "WALTZ", "GLOBE", "CHAIR",
  "FROSTY", "MARBLE", "SPRING", "TOWEL", "DRAFT", "QUILT", "HONEY", "BLAZE", "CORNET"];

// ---------- the rule catalogue ----------
// level 1 = easy to spot, 2 = medium, 3 = hard. Singles judge each letter alone; pairs judge neighbouring
// letters read left to right and top to bottom; wholes judge the field's letters once it's full, as a multiset
// (which letters, repeats counted) and never their order, which the keyboard's colours rely on (keyVerdicts;
// tests/slate.mjs holds every whole rule to it).
const single = (id, level, text, test) => ({ id, type: "single", level, text, test });
const pair = (id, level, text, test) => ({ id, type: "pair", level, text, test });
const whole = (id, level, text, test) => ({ id, type: "whole", level, text, test });
const inSet = s => c => s.includes(c);

export const BASE_RULES = [
  single("vowel", 1, "Vowels only (A E I O U)", isVowel),
  single("consonant", 1, "Consonants only", c => !isVowel(c)),
  single("firstHalf", 1, "First half of the alphabet (A to M)", c => c <= "M"),
  single("secondHalf", 1, "Second half of the alphabet (N to Z)", c => c >= "N"),
  single("third1", 2, "First third of the alphabet (A to I)", c => c <= "I"),
  single("third2", 2, "Middle third of the alphabet (J to R)", c => c >= "J" && c <= "R"),
  single("third3", 2, "Last third of the alphabet (S to Z)", c => c >= "S"),
  single("straight", 2, "Letters drawn only with straight lines", inSet(SET.straight)),
  single("curved", 2, "Letters with a curve", inSet(SET.curved)),
  single("enclosed", 2, "Letters with an enclosed space (A B D O P Q R)", inSet(SET.enclosed)),
  single("top", 2, "Top keyboard row (Q W E R T Y U I O P)", inSet(SET.top)),
  single("mid", 2, "Middle keyboard row (A S D F G H J K L)", inSet(SET.mid)),
  single("bottom", 2, "Bottom keyboard row (Z X C V B N M)", inSet(SET.bottom)),
  single("left", 3, "Letters typed with the left hand", inSet(SET.left)),
  single("right", 3, "Letters typed with the right hand", inSet(SET.right)),
  single("mirrorLR", 3, "Letters that look the same in a mirror (A H I M O T U V W X Y)", inSet(SET.mirrorLR)),
  single("mirrorTB", 3, "Letters that look the same upside down in a mirror (B C D E H I K O X)", inSet(SET.mirrorTB)),
  single("odd", 3, "Letters in odd positions of the alphabet (A, C, E, G…)", inSet(SET.odd)),
  single("rare", 3, "Less common letters (worth 2 or more in Scrabble)", inSet(SET.rare)),

  pair("asc", 1, "Each letter comes later in the alphabet than the one before it", (a, b) => b > a),
  pair("desc", 1, "Each letter comes earlier in the alphabet than the one before it", (a, b) => b < a),
  pair("mixed", 1, "One vowel and one consonant in every pair", (a, b) => isVowel(a) !== isVowel(b)),
  pair("sameClass", 2, "Both vowels or both consonants in every pair", (a, b) => isVowel(a) === isVowel(b)),
  pair("sameShape", 2, "Both straight-lined or both curved in every pair", (a, b) => shape(a) === shape(b)),
  pair("sameRow", 2, "Both from the same keyboard row in every pair", (a, b) => row(a) === row(b)),
  pair("sameHand", 3, "Both typed with the same hand in every pair", (a, b) => hand(a) === hand(b)),
  pair("near", 3, "Every pair is at most three letters apart in the alphabet", (a, b) => Math.abs(pos(a) - pos(b)) <= 3),
  pair("double", 3, "Every pair is the same letter twice", (a, b) => a === b),

  whole("noDup", 1, "No letter appears twice", ls => new Set(ls).size === ls.length),
  whole("noVowels", 1, "No vowels at all", ls => !ls.some(isVowel)),
  whole("oneVowel", 1, "Exactly one vowel", ls => ls.filter(isVowel).length === 1),
  whole("repeat", 2, "Some letter appears at least twice", ls => new Set(ls).size < ls.length),
  whole("oneShape", 2, "All straight-lined or all curved", ls => new Set(ls.map(shape)).size === 1),
  whole("anagram", 2, "The letters can be rearranged into a real word", ls => SIGS.has(sig(ls.join("")))),
  whole("oneRow", 3, "All from one keyboard row", ls => new Set(ls.map(row)).size === 1),
  whole("evenSum", 3, "The letters' alphabet positions add up to an even number", ls => ls.reduce((s, c) => s + pos(c), 0) % 2 === 0),
];
const keywordRule = w => single(`kw:${w}`, 3, `Only letters from the word ${w}`, inSet(w));

export function ruleById(id) {
  if (id.startsWith("kw:")) return keywordRule(id.slice(3));
  return BASE_RULES.find(r => r.id === id);
}

// What a rule is called in the list of rules in play (the legend), short enough to sit several to a line; the
// rule's own text is what a revealed or worked-out field spells out.
const SHORT = {
  vowel: "Vowels", consonant: "Consonants", firstHalf: "A to M", secondHalf: "N to Z", third1: "A to I", third2: "J to R",
  third3: "S to Z", straight: "Straight", curved: "Curved", enclosed: "Enclosed", top: "Top row", mid: "Middle row",
  bottom: "Bottom row", left: "Left hand", right: "Right hand", mirrorLR: "Mirror", mirrorTB: "Upside down", odd: "Odd places",
  rare: "Rarer letters",
  asc: "Climbing", desc: "Falling", mixed: "Vowel + consonant", sameClass: "Same class", sameShape: "Same shape", sameRow: "Same row",
  sameHand: "Same hand", near: "Close", double: "Doubled",
  noDup: "No repeats", noVowels: "No vowels", oneVowel: "One vowel", repeat: "A repeat", oneShape: "One shape", anagram: "Anagram",
  oneRow: "One row", evenSum: "Even sum",
};
/** A rule's short name, for the legend. */
export const shortOf = rule => (rule.id.startsWith("kw:") ? `Letters of ${rule.id.slice(3)}` : SHORT[rule.id]);

// How often a rule passes ordinary letters (for a whole, at the field's size).
const passCache = new Map();
function passRate(rule, size) {
  const k = `${rule.id}:${size}`;
  if (passCache.has(k)) return passCache.get(k);
  const letters = Object.keys(FREQ), total = Object.values(FREQ).reduce((a, b) => a + b, 0);
  const draw = r => { let x = r * total; for (const c of letters) { x -= FREQ[c]; if (x <= 0) return c; } return "E"; };
  const rnd = rng32(12345);
  let hits = 0;
  const N = 600;
  for (let i = 0; i < N; i++) {
    if (rule.type === "single") hits += rule.test(draw(rnd())) ? 1 : 0;
    else if (rule.type === "pair") hits += rule.test(draw(rnd()), draw(rnd())) ? 1 : 0;
    else hits += rule.test(Array.from({ length: size }, () => draw(rnd()))) ? 1 : 0;
  }
  passCache.set(k, hits / N);
  return hits / N;
}

// ---------- levels ----------
// Difficulty comes from the rules: each level draws its rules by rating, every level mixes all three field types.
export const LEVELS = {
  easy: { label: "Easy", ratings: { 1: 1 }, lives: 5, decoys: 2,
    shapes: ["e01", "e02", "e03", "e04", "e05", "e06", "e07", "e08", "e09", "e10", "e11", "e12"] },
  medium: { label: "Medium", ratings: { 1: 0.35, 2: 0.65 }, lives: 6, decoys: 2,
    shapes: ["m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09", "m10", "m11", "m12"] },
  hard: { label: "Hard", ratings: { 2: 0.45, 3: 0.55 }, lives: 7, decoys: 3,
    shapes: ["h01", "h02", "h03", "h04", "h05", "h06", "h07", "h08", "h09", "h10", "h11", "h12"] },
};
// Every horizontal and every vertical run of two or more cells is a word of three to five letters: no
// two-letter runs, so rows stacked on each other are always joined by real down words too. Each board
// turns or mirrors its shape at random. (Boards store their rows, so shapes can change without breaking saves.)
export const SHAPES = {
  // Easy: five or six words
  e01: ["#...#", ".#.#.", ".#.#.", ".....", ".#.#."],
  e02: ["###...", "#.#.#.", "....#.", "#.#.#.", "###..."],
  e03: ["##.###", "##....", "#...##", "##...#", "....##", "###.##"],
  e04: ["##....", "##.#.#", "...#.#", "##.#.#", "##...."],
  e05: [".#####", ".#....", "...##.", ".#....", ".#####"],
  e06: [".....", "#.#.#", "#...#", "#...#", "##.##"],
  e07: [".....", ".#.#.", ".....", "##.##"],
  e08: ["....#", ".#.##", ".....", "##.#.", "#...."],
  e09: [".....", ".###.", ".....", ".#.#.", "##.##"],
  e10: ["##.##.", "##....", "...##.", "##....", "##.##."],
  e11: ["##.##", "#...#", ".....", "#.#.#", "#.#.#"],
  e12: ["###...", "....##", ".##.##", "....##", "###..."],
  // Medium: six to eight words
  m01: [".#....", "...#.#", ".#...#", "...#.#", ".#...."],
  m02: ["#.....", "##.##.", "...##.", ".##...", ".##.##", ".....#"],
  m03: ["#.#...", "#.#.#.", "....#.", "#.#.#.", "#.#..."],
  m04: ["...###", ".#....", ".#.###", ".#....", "...###"],
  m05: [".....#", ".##.##", ".#...#", "#...#.", "##.##.", "#....."],
  m06: [".....", ".###.", ".....", ".#.#.", "#...#"],
  m07: ["...##.", "#.#...", "....#.", "#.#...", "...##."],
  m08: ["##.#.#", "#....#", "...#.#", "#.#...", "#....#", "#.#.##"],
  m09: ["#....#", ".##...", ".....#", ".##...", "#....#"],
  m10: [".#....", ".#.##.", "...##.", ".#.##.", ".#...."],
  m11: ["##...", "...#.", ".#.#.", ".#...", "...##"],
  m12: ["....##", "#.#...", "#.#.##", "#.#...", "....##"],
  // Hard: eight to ten words, with rows stacked into blocks
  h01: [".....", ".###.", ".....", ".....", "#...#"],
  h02: ["#.....", "#.#.#.", "....#.", ".#....", ".#.#.#", ".....#"],
  h03: ["###...", "#...#.", "....#.", "#...#.", "###..."],
  h04: [".....#", ".#.#.#", "...#.#", "#.#...", "#.#.#.", "#....."],
  h05: ["....#.", ".##...", "....#.", ".##...", "....#."],
  h06: [".....#", "##.##.", "....#.", ".#....", ".##.##", "#....."],
  h07: [".#....", "...#.#", "...#.#", "...#.#", ".#...."],
  h08: ["...#.#", ".#....", ".#...#", ".#....", "...#.#"],
  h09: [".##...", "....##", ".#...#", "#...#.", "##....", "...##."],
  h10: ["#.....", ".##.##", "....#.", ".#....", "##.##.", ".....#"],
  h11: ["#....#", "...#.#", "#....#", "#.#...", "#....#"],
  h12: ["....##", "#.#...", ".....#", "#.....", "...#.#", "##...."],
  // the first four shapes, kept so boards saved with them still open
  ring4: ["....", ".##.", ".##.", "...."],
  frame5: [".....", ".###.", ".###.", ".###.", "....."],
  ladder: [".....", ".#.#.", ".#.#.", "....."],
  waffle: [".....", ".#.#.", ".....", ".#.#.", "....."],
};

/** A board's rows: stored on it (turned or mirrored when it was made), or looked up for older boards. */
export const rowsOf = board => board.rows || SHAPES[board.shape];

/** One of the eight ways to turn or mirror a shape. */
export function orient(rows, n) {
  let out = rows.map(r => [...r]);
  for (let i = 0; i < n % 4; i++) out = out[0].map((_, c) => out.map(row => row[c]).reverse());   // a quarter turn
  if (n >= 4) out = out.map(row => [...row].reverse());
  return out.map(row => row.join(""));
}

// ---------- grids ----------
export const key = (r, c) => `${r},${c}`;
export const unkey = k => k.split(",").map(Number);

export function gridOf(rows) {
  const H = rows.length, W = rows[0].length, cells = [];
  const open = (r, c) => r >= 0 && c >= 0 && r < H && c < W && rows[r][c] === ".";
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (open(r, c)) cells.push(key(r, c));
  const slots = [];
  for (const [dr, dc, dir] of [[0, 1, "Across"], [1, 0, "Down"]]) {
    for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
      if (!open(r, c) || open(r - dr, c - dc)) continue;
      const run = [];
      for (let rr = r, cc = c; open(rr, cc); rr += dr, cc += dc) run.push(key(rr, cc));
      if (run.length >= 3) slots.push({ dir, cells: run });
    }
  }
  slots.forEach((s, i) => { s.id = i; s.num = slots.filter(t => t.dir === s.dir && t.id <= i).length; });
  const neighbours = k => { const [r, c] = unkey(k);
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([a, b]) => open(a, b)).map(([a, b]) => key(a, b)); };
  return { H, W, rows, cells, slots, open, neighbours };
}

/** A pair field's joints: each pair of neighbouring cells inside it, in reading order (left→right, top→bottom). */
export function jointsOf(cells) {
  const inside = new Set(cells), out = [];
  for (const k of cells) {
    const [r, c] = unkey(k);
    if (inside.has(key(r, c + 1))) out.push([k, key(r, c + 1)]);
    if (inside.has(key(r + 1, c))) out.push([k, key(r + 1, c)]);
  }
  return out;
}

// ---------- randomness (seeded, so a board link means the same board everywhere) ----------
export function rng32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (xs, rnd) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickWeighted = (weights, rnd) => { const entries = Object.entries(weights); let x = rnd() * entries.reduce((s, [, w]) => s + w, 0);
  for (const [k, w] of entries) { x -= w; if (x <= 0) return k; } return entries[entries.length - 1][0]; };

// ---------- the solver ----------
// Per word length: for each position and letter, a bitset of the easy words with that letter there.
const INDEX = {};
function indexFor(L) {
  if (INDEX[L]) return INDEX[L];
  const words = EASY[L], n = Math.ceil(words.length / 32);
  const pos = Array.from({ length: +L }, () => ({}));
  words.forEach((w, j) => {
    for (let i = 0; i < w.length; i++) (pos[i][w[i]] ||= new Uint32Array(n))[j >> 5] |= 1 << (j & 31);
  });
  const all = new Uint32Array(n).fill(0xFFFFFFFF);
  if (words.length % 32) all[n - 1] = (1 << (words.length % 32)) - 1;
  return (INDEX[L] = { words, pos, all, n });
}
const andInto = (a, b) => { for (let i = 0; i < a.length; i++) a[i] &= b ? b[i] : 0; return a; };
const bitsOf = function* (mask) {
  for (let i = 0; i < mask.length; i++) for (let m = mask[i]; m; m &= m - 1) yield (i << 5) | (31 - Math.clz32(m & -m));
};
const anyBit = mask => mask.some(x => x !== 0);

/**
 * Fills the slots with distinct easy words that obey the given fields. With rnd: returns one fill (random order).
 * With cap: returns how many fills exist, up to cap. A step budget keeps it bounded and identical on every device.
 */
function solve(grid, fields, { rnd = null, cap = 0, budget = 20000 } = {}) {
  const letters = {}, used = new Set(), placed = new Set();
  const constraints = [];                     // [cells, test(lettersArray)] for pairs and wholes
  const allowed = {};
  for (const f of fields) {
    if (f.rule.type === "single") f.cells.forEach(k => { allowed[k] = f.rule.test; });
    else if (f.rule.type === "pair") jointsOf(f.cells).forEach(([a, b]) => constraints.push([[a, b], ls => f.rule.test(ls[0], ls[1])]));
    else constraints.push([f.cells, f.rule.test]);
  }
  const slotInfo = grid.slots.map(s => {
    const ix = indexFor(s.cells.length);
    const base = ix.all.slice();
    s.cells.forEach((k, i) => {
      if (!allowed[k]) return;
      const m = new Uint32Array(ix.n);
      for (const [c, bits] of Object.entries(ix.pos[i])) if (allowed[k](c)) for (let j = 0; j < m.length; j++) m[j] |= bits[j];
      andInto(base, m);
    });
    return { ix, base, touching: constraints.filter(([cells]) => cells.some(k => s.cells.includes(k))) };
  });
  const maskFor = s => {
    const { ix, base } = slotInfo[s.id], m = base.slice();
    s.cells.forEach((k, i) => { if (letters[k]) andInto(m, ix.pos[i][letters[k]]); });
    return m;
  };
  const fits = (s, w) => slotInfo[s.id].touching.every(([cells, test]) => {
    const ls = cells.map(k => letters[k] || (s.cells.includes(k) ? w[s.cells.indexOf(k)] : null));
    return ls.some(x => !x) || test(ls);
  });
  let found = null, count = 0, steps = 0;
  const stop = () => (cap ? count >= cap : !!found) || steps > budget;
  (function go() {
    if (stop()) return;
    steps++;
    let best = null, bestMask = null, bestN = Infinity;
    for (const s of grid.slots) {
      if (placed.has(s.id)) continue;
      const m = maskFor(s);
      if (!anyBit(m)) return;
      let n = 0; for (const x of m) n += popcount(x);
      if (n < bestN) { best = s; bestMask = m; bestN = n; }
    }
    if (!best) { count++; if (!found) found = { ...letters }; return; }
    const words = [...bitsOf(bestMask)].map(j => slotInfo[best.id].ix.words[j]).filter(w => !used.has(w) && fits(best, w));
    const fresh = best.cells.filter(k => !letters[k]);
    for (const w of rnd ? shuffle(words, rnd) : words) {
      fresh.forEach(k => { letters[k] = w[best.cells.indexOf(k)]; });
      used.add(w); placed.add(best.id);
      go();
      used.delete(w); placed.delete(best.id);
      fresh.forEach(k => { delete letters[k]; });
      if (stop()) return;
    }
  })();
  if (steps > budget) return cap ? Infinity : null;
  return cap ? count : found;
}
const popcount = x => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };

// ---------- fields ----------
const SIZE = { single: [2, 4], pair: [2, 4], whole: [3, 5] };

function pickRule(level, type, rnd, ok, taken) {
  for (let tries = 0; tries < 12; tries++) {
    const rating = +pickWeighted(level.ratings, rnd);
    let pool = BASE_RULES.filter(r => r.type === type && r.level === rating && !taken.has(r.id));
    if (type === "single" && rating === 3) pool = [...pool, keywordRule(KEYWORDS[Math.floor(rnd() * KEYWORDS.length)])];
    const good = shuffle(pool, rnd).filter(ok);
    if (good.length) return good[0];
  }
  return null;
}

/** One field grown around the intended fill's letters, so the intended fill always obeys it. */
function growField(grid, sol, owner, level, type, rnd, taken) {
  const free = shuffle(grid.cells.filter(k => owner[k] == null), rnd);
  for (const seedCell of free) {
    const [lo, hi] = SIZE[type];
    const target = lo + Math.floor(rnd() * (hi - lo + 1));
    if (type === "single") {
      const rule = pickRule(level, type, rnd, r => r.test(sol[seedCell]) && passRate(r) <= 0.68, taken);
      if (!rule) continue;
      const cells = bfs(grid, owner, seedCell, target, rnd, k => rule.test(sol[k]));
      if (cells.length >= lo) return { rule, cells };
    } else if (type === "pair") {
      const rule = pickRule(level, type, rnd, r => grid.neighbours(seedCell).some(n => owner[n] == null && pairOk(r, seedCell, n, sol)), taken);
      if (!rule) continue;
      const cells = bfs(grid, owner, seedCell, target, rnd, (k, cur) => jointsOf([...cur, k]).every(([a, b]) => rule.test(sol[a], sol[b])));
      if (cells.length >= lo) return { rule, cells };
    } else {
      const cells = bfs(grid, owner, seedCell, target, rnd, () => true);
      if (cells.length < lo) continue;
      const rule = pickRule(level, type, rnd, r => r.test(cells.map(k => sol[k])) && passRate(r, cells.length) <= 0.85, taken);
      if (rule) return { rule, cells };
    }
  }
  return null;
}
const pairOk = (rule, a, b, sol) => { const [x, y] = [a, b].sort(readingOrder); return rule.test(sol[x], sol[y]); };
const readingOrder = (a, b) => { const [r1, c1] = unkey(a), [r2, c2] = unkey(b); return r1 - r2 || c1 - c2; };

function bfs(grid, owner, start, target, rnd, accept) {
  const cells = [start], seen = new Set([start]);
  for (let i = 0; i < cells.length && cells.length < target; i++) {
    for (const n of shuffle(grid.neighbours(cells[i]), rnd)) {
      if (cells.length >= target) break;
      if (seen.has(n) || owner[n] != null) continue;
      seen.add(n);
      if (accept(n, cells)) cells.push(n);
    }
  }
  return cells;
}

/**
 * A board: a shape, an intended fill of easy words, and fields with hidden rules that the intended fill obeys.
 * Fields cover most of the board and every level mixes all three field types; any other fill that obeys
 * every rule and makes real words also wins (checks only say whether letters match the intended fill).
 */
export function generate(seed, levelId) {
  const level = LEVELS[levelId], rnd = rng32(seed);
  for (let attempt = 0; attempt < 30; attempt++) {
    const shapeId = level.shapes[Math.floor(rnd() * level.shapes.length)];
    const rows = orient(SHAPES[shapeId], Math.floor(rnd() * 8));
    const grid = gridOf(rows);
    const sol = solve(grid, [], { rnd });
    if (!sol) continue;
    for (let t = 0; t < 8; t++) {
      const owner = {}, fields = [];
      const covered = () => Object.keys(owner).length / grid.cells.length;
      // one of each type first, then whatever fits until most of the board is covered
      const order = [...shuffle(["single", "pair", "whole"], rnd), ...shuffle(["single", "pair", "whole", "single", "pair", "whole"], rnd)];
      for (const type of order) {
        if (covered() >= COVERAGE) break;
        const f = growField(grid, sol, owner, level, type, rnd, new Set(fields.map(x => x.rule.id)));
        if (!f) continue;
        f.cells.forEach(k => { owner[k] = fields.length; });
        fields.push(f);
      }
      const types = new Set(fields.map(f => f.rule.type));
      if (fields.length >= 3 && types.size === 3 && covered() >= COVERAGE - 0.15) {
        return { level: levelId, shape: shapeId, rows, sol, fields: fields.map(f => ({ rule: f.rule.id, cells: f.cells })),
          legend: legendFor(level, fields, rnd), lives: level.lives };
      }
    }
  }
  return null;
}
const COVERAGE = 0.75;

/**
 * The rules in play, as the player is told them (README): every field's rule and, for each type of field, a few
 * others of the level that could have been, so a field's rule is one of a short list to work out rather than anything
 * in the catalogue. In the catalogue's order, which gives no field away.
 */
function legendFor(level, fields, rnd) {
  const taken = new Set(fields.map(f => f.rule.id)), ids = [...taken];
  for (const type of ["single", "pair", "whole"]) {
    const pool = BASE_RULES.filter(r => r.type === type && level.ratings[r.level] && !taken.has(r.id));
    if (type === "single" && level.ratings[3]) pool.push(...shuffle(KEYWORDS, rnd).slice(0, 3).map(keywordRule).filter(r => !taken.has(r.id)));
    ids.push(...shuffle(pool, rnd).slice(0, level.decoys).map(r => r.id));
  }
  const at = id => (id.startsWith("kw:") ? BASE_RULES.length : BASE_RULES.findIndex(r => r.id === id));
  return ids.sort((a, b) => at(a) - at(b) || (a < b ? -1 : 1));
}

// ---------- judging ----------
export const fieldsOf = board => board.fields.map(f => ({ ...f, rule: ruleById(f.rule) }));

/** Marks for the current letters: per letter (singles), per joint (pairs), per field once full (wholes). */
export function judge(board, letters) {
  const out = { cells: {}, joints: [], wholes: {} };
  fieldsOf(board).forEach((f, i) => {
    if (f.rule.type === "single") {
      f.cells.forEach(k => { if (letters[k]) out.cells[k] = { field: i, ok: f.rule.test(letters[k]) }; });
    } else if (f.rule.type === "pair") {
      jointsOf(f.cells).forEach(([a, b]) => {
        if (letters[a] && letters[b]) out.joints.push({ field: i, a, b, ok: f.rule.test(letters[a], letters[b]) });
      });
    } else if (f.cells.every(k => letters[k])) {
      out.wholes[i] = f.rule.test(f.cells.map(k => letters[k]));
    }
  });
  return out;
}

/**
 * The failing marks the letters show, each named by what it failed on: a single letter in its cell, a pair of
 * neighbours, a whole field by its letters (never their order, which a whole rule doesn't read). Only judged letters
 * (those in a complete real word) can fail, as only they wear a mark on the board.
 */
export function failingMarks(board, fields, letters) {
  const ok = eligibleCells(board, letters), j = judge(board, letters), out = new Set();
  fields.forEach((f, i) => {
    if (f.rule.type === "single") f.cells.forEach(k => { if (ok.has(k) && j.cells[k] && !j.cells[k].ok) out.add(`${i}:${k}:${letters[k]}`); });
    else if (f.rule.type === "pair") j.joints.forEach(x => { if (x.field === i && ok.has(x.a) && ok.has(x.b) && !x.ok) out.add(`${i}:${x.a}>${x.b}:${letters[x.a]}${letters[x.b]}`); });
    else if (i in j.wholes && !j.wholes[i] && f.cells.every(k => ok.has(k))) out.add(`${i}:${f.cells.map(k => letters[k]).sort().join("")}`);
  });
  return out;
}

/**
 * Everything the board has told you, replayed from the placements and checks in order: what each field passed and
 * failed (notes), and which entries of the log put up a failing mark that wasn't on the board before (lost: one
 * life each, however many marks it put up, with the fields that failed; a mark that stays up costs nothing again).
 */
export function replay(board, log) {
  const fields = fieldsOf(board);
  const notes = fields.map(() => ({ ok: new Set(), no: new Set() }));
  const grid = gridOf(rowsOf(board));
  const letters = {}, lost = [];
  const record = placed => {
    // judged: letters in complete real words. A placement also judges crossing words it just completed.
    const ok = eligibleCells(board, letters), j = judge(board, letters);
    const touched = new Set(placed);
    grid.slots.filter(s => s.cells.every(k => ok.has(k)) && s.cells.some(k => placed.has(k))).forEach(s => s.cells.forEach(k => touched.add(k)));
    fields.forEach((f, i) => {
      if (f.rule.type === "single") {
        f.cells.forEach(k => { if (touched.has(k) && ok.has(k) && j.cells[k]) (j.cells[k].ok ? notes[i].ok : notes[i].no).add(letters[k]); });
      } else if (f.rule.type === "pair") {
        j.joints.filter(x => x.field === i && ok.has(x.a) && ok.has(x.b) && (touched.has(x.a) || touched.has(x.b)))
          .forEach(x => (x.ok ? notes[i].ok : notes[i].no).add(`${letters[x.a]}→${letters[x.b]}`));
      } else if (i in j.wholes && f.cells.every(k => ok.has(k)) && f.cells.some(k => touched.has(k))) {
        (j.wholes[i] ? notes[i].ok : notes[i].no).add(f.cells.slice().sort(readingOrder).map(k => letters[k]).join(""));
      }
    });
  };
  let marks = new Set();
  log.forEach((e, n) => {
    if (e.check || (!e.clear && !e.draft && !e.word)) return;       // a check judges the board as a whole, not a field; a rule reveal
    if (e.clear) Object.values(e.clear).forEach(k => { delete letters[k]; });
    else if (e.draft) { Object.assign(letters, e.draft); record(new Set(Object.keys(e.draft))); }   // a frame is judged only where it completes a word
    else { const slot = grid.slots[e.slot]; slot.cells.forEach((k, i) => { letters[k] = e.word[i]; }); record(new Set(slot.cells)); }
    const now = failingMarks(board, fields, letters), fresh = [...now].filter(m => !marks.has(m));
    if (fresh.length) lost.push({ n, fields: [...new Set(fresh.map(m => +m.split(":")[0]))] });
    marks = now;
  });
  return { notes, lost };
}

/** What each field has told you: a replay's notes. */
export const notesFrom = (board, log) => replay(board, log).notes;

/** Lives: how many a board has (none, for a board dealt before lives), and how many the log has cost. */
export const livesOf = (board, log) => {
  const total = board.lives || 0, lost = total ? replay(board, log).lost.length : 0;
  return { total, lost, left: total - lost };
};

// ---------- the legend: which rule each field could be ----------
const TYPES = ["single", "pair", "whole"];
/** Whether a rule agrees with everything a field has passed and failed. */
function agrees(rule, note) {
  const test = s => (rule.type === "single" ? rule.test(s) : rule.type === "pair" ? rule.test(...s.split("→")) : rule.test([...s]));
  return [...note.ok].every(test) && ![...note.no].some(test);
}

/**
 * The ways the legend's rules can be dealt to the fields, as far as the notes and the rules revealed say (shown: the
 * fields whose rule is known), type by type: [{ type, fields: [field index…], deals: [[rule id per field]…] }]. Every
 * rule is one field's at most, so a rule that one field must have is taken from the others. Null for a board without
 * a legend.
 */
export function dealsOf(board, notes, shown = new Set()) {
  if (!board.legend) return null;
  const fs = fieldsOf(board), legend = board.legend.map(ruleById);
  return TYPES.map(type => {
    const at = fs.flatMap((f, i) => (f.rule.type === type ? [i] : []));
    const options = at.map(i => (shown.has(i) ? [fs[i].rule] : legend.filter(r => r.type === type && agrees(r, notes[i]))));
    const deals = [], cur = [], used = new Set();
    (function pick(n) {
      if (n === at.length) { deals.push(cur.map(r => r.id)); return; }
      for (const r of options[n]) if (!used.has(r.id)) { used.add(r.id); cur.push(r); pick(n + 1); cur.pop(); used.delete(r.id); }
    })(0);
    return { type, fields: at, deals };
  });
}

/** Per field, the rules it could be (legend order), or null for a board without a legend. */
export function candidates(board, notes, shown = new Set()) {
  const dealt = dealsOf(board, notes, shown);
  if (!dealt) return null;
  const out = board.fields.map(() => []);
  for (const { fields, deals } of dealt) fields.forEach((i, n) => { out[i] = board.legend.filter(id => deals.some(d => d[n] === id)).map(ruleById); });
  return out;
}

/** The rules in play of one type (a field's kind), in the legend's order: what a field of that kind could be. */
export const legendOf = (board, type) => (board.legend ? board.legend.map(ruleById).filter(r => r.type === type) : []);

/**
 * Per field, the rules it could be as the player has worked it out: every rule of its type in play except those they
 * crossed off (struck: field index -> rule ids), and a field whose rule was revealed has that alone. The player does the
 * eliminating (`candidates` is what the notes allow, which the game no longer tells). Null for a board without a legend.
 */
export function optionsOf(board, struck = {}, shown = new Set()) {
  if (!board.legend) return null;
  return fieldsOf(board).map((f, i) => (shown.has(i) ? [f.rule] : legendOf(board, f.rule.type).filter(r => !(struck[i] || []).includes(r.id))));
}

/**
 * The keyboard's colours: what each letter would do typed into one cell (at) of a field, as far as the player can
 * know, from what the field has told them (its notes) or from its rule once revealed. Every judgement of the field
 * that takes this cell and has a letter in each of its other cells (letters: placed and typed) is a test: a single
 * field judges the letter alone; a pair field each pair with a lettered neighbour, read in reading order; a whole
 * field its letters, once every other cell has one. A letter is true (green) when it's known to pass every test,
 * false (red) when it's known to fail one, otherwise null. Null in place of the function when there's nothing to
 * test: a pair cell with no lettered neighbour, a whole field with another cell empty (its letter could change the
 * verdict).
 */
export function keyVerdicts(field, note, letters, at, revealed = false) {
  const { rule, cells } = field;
  let tests;                // each: the letters it judges, given the letter c in this cell, in the order the rule reads them
  if (rule.type === "single") tests = [c => [c]];
  else if (rule.type === "pair") tests = jointsOf(cells).filter(([a, b]) => (a === at && letters[b]) || (b === at && letters[a]))
    .map(([a, b]) => (a === at ? c => [c, letters[b]] : c => [letters[a], c]));
  else tests = cells.every(k => k === at || letters[k]) ? [c => cells.map(k => (k === at ? c : letters[k]))] : [];
  if (!tests.length) return null;
  // the notes name a letter, a pair (A→B), or a whole field by its letters in reading order; since a whole rule never
  // reads order, a whole field is matched by its letters sorted, so ABC failing fails BCA too
  const named = rule.type === "whole" ? s => [...s].sort().join("") : s => s;
  const passed = new Set([...note.ok].map(named)), failed = new Set([...note.no].map(named));
  const known = ls => {
    if (revealed) return rule.type === "whole" ? rule.test(ls) : rule.test(...ls);
    const name = named(ls.join(rule.type === "pair" ? "→" : ""));
    return passed.has(name) ? true : failed.has(name) ? false : null;
  };
  return c => {
    let all = true;
    for (const test of tests) {
      const ok = known(test(c));
      if (ok === false) return false;
      if (ok !== true) all = false;
    }
    return all || null;
  };
}

/**
 * The keyboard's colours when a field could be any of several rules (the legend, narrowed by the notes): a letter is
 * green when every one of them passes it, red when every one fails it, else uncoloured. Down to one rule, it's the
 * field's rule revealed.
 */
export function keyVerdictsAmong(field, rules, note, letters, at) {
  const each = rules.map(rule => keyVerdicts({ ...field, rule }, note, letters, at, true));
  if (!each.length || each.some(f => f === null)) return null;
  return c => {
    const v = each.map(f => f(c));
    return v.every(x => x === true) ? true : v.every(x => x === false) ? false : null;
  };
}

/** The letters on the board after a list of placements. */
export function lettersFrom(board, log) {
  const grid = gridOf(rowsOf(board)), letters = {};
  for (const e of log) {
    if (e.clear) e.clear.forEach(k => { delete letters[k]; });
    else if (e.draft) Object.assign(letters, e.draft);
    else if (e.word) grid.slots[e.slot].cells.forEach((k, i) => { letters[k] = e.word[i]; });
  }
  return letters;
}

/** The word in a slot, or null while any of its cells is empty (gaps must never close up into a shorter word). */
export const wordAt = (slot, letters) => (slot.cells.every(k => letters[k]) ? slot.cells.map(k => letters[k]).join("") : null);

/** Cells whose letters count: those in at least one complete real word. Anything else is a draft, not judged. */
export function eligibleCells(board, letters) {
  const grid = gridOf(rowsOf(board));
  return new Set(grid.slots.filter(s => VALID.has(wordAt(s, letters))).flatMap(s => s.cells));
}

export function isSolved(board, letters) {
  const grid = gridOf(rowsOf(board));
  if (!grid.slots.every(s => VALID.has(wordAt(s, letters)))) return false;
  const j = judge(board, letters);
  return fieldsOf(board).every((f, i) => (f.rule.type === "single" ? f.cells.every(k => j.cells[k]?.ok)
    : f.rule.type === "pair" ? jointsOf(f.cells).every(([a, b]) => j.joints.find(x => x.a === a && x.b === b)?.ok)
      : j.wholes[i] === true));
}


/**
 * Cells a Clear would empty. Level 1: letters in no complete real word. Level 2: also words that break a rule
 * of a field you can see (visible(i)). Level 3: everything.
 */
export function clearable(board, letters, level, visible = () => true) {
  const grid = gridOf(rowsOf(board));
  const filled = grid.cells.filter(k => letters[k]);
  if (level >= 3) return filled;
  let keep = grid.slots.filter(s => VALID.has(wordAt(s, letters)));
  if (level === 2) {
    const j = judge(board, letters), broken = new Set();
    for (const [k, v] of Object.entries(j.cells)) if (!v.ok && visible(v.field)) broken.add(k);
    for (const x of j.joints) if (!x.ok && visible(x.field)) { broken.add(x.a); broken.add(x.b); }
    for (const [i, ok] of Object.entries(j.wholes)) if (!ok && visible(+i)) board.fields[i].cells.forEach(k => broken.add(k));
    keep = keep.filter(s => !s.cells.some(k => broken.has(k)));
  }
  const kept = new Set(keep.flatMap(s => s.cells));
  return filled.filter(k => !kept.has(k));
}
