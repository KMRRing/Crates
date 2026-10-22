// The grid filler (README, Classics): fills a crossword grid with real words. Codeword made it, for its dense grids
// where most letters cross; Crossword uses it, for British-style blocked grids with its knowledge-base answers seeded
// first. Pure: no page, no clock, so it runs the same in Node, on a page or in a worker, and the same seed fills the
// same grid on every device (every limit is a count of search steps, never a time).
//
// A grid is an array of equal-length strings, one a row: "#" a black cell, "." a white cell to fill, a to z a white
// cell already lettered. Every across and down run of two or more white cells is a slot; a run of exactly two is
// refused (wordlist.js has no two-letter words), and so is a white cell in no slot.
//
//   makeGrid({ size, style, seed, lengths, tries, maxLen })
//                                              a grid symmetric under a half turn, made from the seed, or null:
//                                              style "dense" (most letters crossed, as a codeword wants: about a quarter
//                                              black, never four blacks in a square or three in a row, words of 3 to 8
//                                              letters, 9 from 13 across) or "british" (a blocked crossword's: the
//                                              lattice of black squares with more added, every word at least half
//                                              crossed); lengths: slot lengths it must have room for, a slot each
//                                              ([6, 6] wants two slots of six: a crossword's answers); maxLen: the
//                                              longest run it may leave, if not the style's (Crossword's 15 by 15
//                                              grids, whose words stop at 12 letters)
//   slotsOf(grid)                              its slots, across then down: { id, dir, row, col, len, cells, num },
//                                              cells as indices (row × columns + column), num the clue number a
//                                              printed crossword gives it
//   gridProblems(grid)                         what's wrong with a grid, in words; [] for a good one
//   shape(grid), halfCrossed(slots)            { black, crossed }: its share of black cells, and of white cells in
//                                              two slots; whether every slot has half its letters crossed
//   fillGrid(grid, { words, place, fixed, seed, budget, starts, distinct, cover })
//                                              fills every slot with a word, null if it can't within the budget.
//                                              words: where they come from: a function of a length giving its words
//                                              in order of preference (an array, or bands: an array of arrays, each
//                                              shuffled by the seed, earlier bands tried first), or a plain array of
//                                              words of any length; wordSource() makes one from wordlist.js.
//                                              place: words to put in first, each in a slot of its length that the
//                                              search chooses (Crossword's answers; a word not in `words` is fine);
//                                              fixed: [{ word, slot }] words for given slots (a slot's id, or { row,
//                                              col, dir }); distinct: no word twice (the default); cover: letters the
//                                              fill must use somewhere (Codeword's whole alphabet); budget: search
//                                              steps in all (20,000 fill a 13×13 grid in well under a second),
//                                              shared out over `starts` fresh starts. Returns { grid (the rows,
//                                              lettered), slots (each with its word), placed ([{ word, slot }], where
//                                              `place` went), nodes (the steps it took) }.
//   wordSource({ upto, variants, extra, exclude })
//                                              wordlist.js's words of each length in bands by tier, the commonest
//                                              first: tiers 0 to upto, leaving out the words only one spelling has
//                                              unless variants; extra words ahead of them all (a band of their own);
//                                              exclude, words to leave out.
//   seeded(seed), mix(a, b), shuffled(list, rnd)
//                                              the seeded numbers it runs on, for a caller that wants the same.
//
// How it fills: depth first, the open slot with fewest words left first (the longest among equals). A slot's words
// are a bitset over its length's list, and a crossing letter narrows it with one AND per 32 words; after each word,
// every slot it crosses must still have a word, and each of their open crossings a letter both sides can take. A
// search that runs long is usually lost early, so the budget is split over several starts, each choosing its own
// first words (every slot starts from its own point in the commonest band). A word to place goes first where it
// leaves the slots it crosses the most words. A cover is met in two goes: the fill tries the rare letters it lacks
// on cells no other slot crosses (where they cost nothing), then each letter still missing is brought in by
// emptying a 6×6 window of the grid and filling it again with that letter required and none lost, a window at a
// time, until every letter is there. Measured on this machine: a dense 13×13 grid with all 26 letters about three
// times in four (a third of a second each), British 13×13 grids with four or five answers placed nine times in ten.
import { wordsOf } from "./wordlist.js";

export const BLACK = "#";

/** A seeded source of numbers in [0, 1) (mulberry32): the same seed gives the same numbers everywhere. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** A seed made from two numbers, for a stream of its own that doesn't repeat its parent's. */
export const mix = (a, b) => (Math.imul((a >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) + Math.imul((b >>> 0) + 0x632BE5AB, 0xC2B2AE35)) >>> 0;
/** A copy of `list` in an order the seed shuffles (Fisher-Yates). */
export function shuffled(list, rnd) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- grids and their slots ----------
const isWhite = ch => ch !== BLACK;
/** The slots of a grid, across first then down, each { id, dir, row, col, len, cells, num }. Runs of one aren't slots. */
export function slotsOf(grid) {
  const R = grid.length, C = grid[0]?.length || 0, out = [];
  const white = (r, c) => r >= 0 && c >= 0 && r < R && c < C && isWhite(grid[r][c]);
  for (const dir of ["across", "down"]) {
    const [dr, dc] = dir === "across" ? [0, 1] : [1, 0];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (!white(r, c) || white(r - dr, c - dc) || !white(r + dr, c + dc)) continue;   // a run starts here
      const cells = [];
      for (let k = 0; white(r + k * dr, c + k * dc); k++) cells.push((r + k * dr) * C + c + k * dc);
      out.push({ id: out.length, dir, row: r, col: c, len: cells.length, cells, num: 0 });
    }
  }
  // the clue numbers, as a printed crossword gives them: reading the grid row by row, each cell that starts a slot
  let n = 0;
  const numAt = new Map();
  for (const s of [...out].sort((a, b) => a.cells[0] - b.cells[0])) {
    if (!numAt.has(s.cells[0])) numAt.set(s.cells[0], ++n);
    s.num = numAt.get(s.cells[0]);
  }
  return out;
}
/** What's wrong with a grid, in words: rows of different lengths, runs of two, white cells in no slot or cut off. */
export function gridProblems(grid) {
  const R = grid.length, C = grid[0]?.length || 0, out = [];
  if (!R || grid.some(row => row.length !== C)) return ["the rows aren't all the same length"];
  const slots = slotsOf(grid), inSlot = new Uint8Array(R * C);
  for (const s of slots) {
    if (s.len === 2) out.push(`a run of two at row ${s.row + 1}, column ${s.col + 1} (${s.dir})`);
    for (const k of s.cells) inSlot[k] = 1;
  }
  let whites = 0, first = -1;
  for (let k = 0; k < R * C; k++) if (isWhite(grid[(k / C) | 0][k % C])) {
    whites++;
    if (first < 0) first = k;
    if (!inSlot[k]) out.push(`a white cell in no word at row ${((k / C) | 0) + 1}, column ${(k % C) + 1}`);
  }
  if (whites && reached(grid, first) !== whites) out.push("the white cells aren't all joined up");
  return out;
}
/** How many white cells can be reached from cell k through white neighbours. */
function reached(grid, k) {
  const R = grid.length, C = grid[0].length, seen = new Uint8Array(R * C), todo = [k];
  seen[k] = 1;
  let n = 0;
  while (todo.length) {
    const x = todo.pop(), r = (x / C) | 0, c = x % C;
    n++;
    for (const [rr, cc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      if (rr < 0 || cc < 0 || rr >= R || cc >= C) continue;
      const y = rr * C + cc;
      if (!seen[y] && isWhite(grid[rr][cc])) { seen[y] = 1; todo.push(y); }
    }
  }
  return n;
}
/** A grid's share of black cells, and of its white cells crossed (in two slots). */
export function shape(grid, slots = slotsOf(grid)) {
  const cells = grid.length * grid[0].length, seen = new Map();
  for (const s of slots) for (const k of s.cells) seen.set(k, (seen.get(k) || 0) + 1);
  const whites = grid.join("").split("").filter(isWhite).length;
  return { black: 1 - whites / cells, crossed: [...seen.values()].filter(n => n > 1).length / Math.max(1, whites) };
}

// ---------- making a grid ----------
// Both styles are symmetric under a half turn, as printed crosswords are, and never have a run of two.
//  - British: the lattice every blocked crossword grows from (black wherever row and column are both odd, so every
//    other letter of an entry is crossed), with black squares added to cut its long runs into entries.
//  - Dense: an open grid with black squares scattered in, never four in a square or three in a row, every run of
//    three or more an entry and most letters in two; a single white cell between blacks is an uncrossed letter.
// black: the share of the grid that's black; maxLen: the longest run; squares: whether four blacks may make a square;
// bars: the most blacks in a row; threes: how often a black square that would leave a run of three is passed over as
// the grid thins out; crossed: the share of white cells in two slots a grid must have; pick: how many good grids to
// make and choose the best of (fewest runs of three, nearest the share of black it aims for)
// half: every slot has at least half its letters crossed (rounded down), as blocked grids promise their solvers
const STYLES = {
  british: { start: "lattice", black: [0.34, 0.42], maxLen: s => s, squares: true, bars: 3, threes: 0.3, crossed: [0.25, 0.5], half: true, pick: 3 },
  dense: { start: "open", black: [0.24, 0.3], maxLen: s => Math.min(s, s <= 11 ? 8 : 9), squares: false, bars: 2, threes: 0.65, crossed: [0.7, 0.9], half: false, pick: 4 },
};
export const STYLE_NAMES = Object.keys(STYLES);
/**
 * A grid of the given size (odd sizes suit the British lattice): style "dense" or "british", made from the seed;
 * lengths, slot lengths it must have room for, one slot each ([6, 6] wants two slots of six); maxLen, the longest run
 * it may leave (the style's own if not given). Tries up to `tries` patterns; null if none would do.
 */
export function makeGrid({ size = 13, rows = size, cols = size, style = "dense", seed = 1, lengths = [], tries = 400, maxLen = null } = {}) {
  const S = STYLES[style];
  if (!S) throw new Error(`gridfill: no grid style ${style}`);
  const rnd = seeded(mix(seed, 0x6A11)), mid = (S.black[0] + S.black[1]) / 2;
  let best = null, bestScore = Infinity, good = 0;
  for (let t = 0; t < tries && good < S.pick; t++) {
    const g = S.start === "lattice" ? lattice(rows, cols) : open(rows, cols);
    const target = S.black[0] + rnd() * (S.black[1] - S.black[0]);
    if (!grow(g, rows, cols, target, maxLen ?? S.maxLen(Math.max(rows, cols)), rnd, S)) continue;
    const grid = g.map(row => row.join(""));
    if (gridProblems(grid).length) continue;
    const slots = slotsOf(grid), lens = slots.map(s => s.len);
    if (!roomFor(lens, lengths)) continue;
    if (S.half && !halfCrossed(slots)) continue;
    const { black, crossed } = shape(grid, slots);
    if (black < S.black[0] - 0.03 || black > S.black[1] + 0.03 || crossed < S.crossed[0] || crossed > S.crossed[1]) continue;
    good++;
    const score = lens.filter(n => n === 3).length / lens.length * 10 + Math.abs(black - mid) * 20;
    if (score < bestScore) { best = grid; bestScore = score; }
  }
  return best;
}
/** Whether every slot has at least half its letters (rounded down) in another slot too. */
export function halfCrossed(slots) {
  const seen = new Map();
  for (const s of slots) for (const k of s.cells) seen.set(k, (seen.get(k) || 0) + 1);
  return slots.every(s => s.cells.filter(k => seen.get(k) > 1).length >= Math.floor(s.len / 2));
}
const lattice = (R, C) => Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => (r % 2 && c % 2 ? BLACK : ".")));
const open = (R, C) => Array.from({ length: R }, () => Array(C).fill("."));
/** Whether slot lengths `have` hold each of `want` in a slot of its own. */
function roomFor(have, want) {
  const left = new Map();
  for (const n of have) left.set(n, (left.get(n) || 0) + 1);
  for (const n of want) { const k = left.get(n) || 0; if (!k) return false; left.set(n, k - 1); }
  return true;
}
/**
 * Adds black squares, a pair at a time (a cell and its partner across the centre), until about `target` of the grid
 * is black and no run is longer than maxLen: a pair goes in only if it leaves no run of two and no white cell out of
 * every word. Long runs are cut first, so the grid ends up with no run over maxLen. False if it couldn't.
 */
function grow(g, R, C, target, maxLen, rnd, { squares, threes, bars }) {
  const cells = R * C, partner = k => cells - 1 - k;
  const at = k => g[(k / C) | 0][k % C], set = (k, v) => { g[(k / C) | 0][k % C] = v; };
  let blacks = 0;
  for (let k = 0; k < cells; k++) if (at(k) === BLACK) blacks++;
  const order = shuffled([...Array(cells).keys()].filter(k => k <= partner(k)), rnd);
  // the run through k, across or down
  const runLen = (k, dr, dc) => {
    const r = (k / C) | 0, c = k % C;
    let n = 1;
    for (let i = 1; r + i * dr < R && c + i * dc < C && g[r + i * dr][c + i * dc] !== BLACK; i++) n++;
    for (let i = 1; r - i * dr >= 0 && c - i * dc >= 0 && g[r - i * dr][c - i * dc] !== BLACK; i++) n++;
    return n;
  };
  /** Whether a black at k (already set) leaves a run of exactly three beside it. */
  const leavesThree = k => {
    const r = (k / C) | 0, c = k % C;
    return [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dr, dc]) => {
      const y = r + dr, x = c + dc;
      return y >= 0 && x >= 0 && y < R && x < C && g[y][x] !== BLACK && runLen(y * C + x, dr ? 1 : 0, dc ? 1 : 0) === 3;
    });
  };
  const long = () => order.filter(k => at(k) !== BLACK && (runLen(k, 0, 1) > maxLen || runLen(k, 1, 0) > maxLen));
  for (let round = 0; round < 6; round++) {
    let changed = false;
    for (const k of [...long(), ...order]) {
      if (at(k) === BLACK) continue;
      const over = runLen(k, 0, 1) > maxLen || runLen(k, 1, 0) > maxLen;
      if (!over && blacks / cells >= target) continue;
      const p = partner(k);
      set(k, BLACK); set(p, BLACK);
      const ok = fine(g, R, C, k, squares, bars) && fine(g, R, C, p, squares, bars) && (over || !(leavesThree(k) || leavesThree(p)) || rnd() >= threes);
      if (ok) { blacks += k === p ? 1 : 2; changed = true; }
      else { set(k, "."); set(p, "."); }
    }
    if (!long().length && blacks / cells >= target) return true;
    if (!changed) break;
  }
  return !long().length;
}
/**
 * Around cell k (just made black): no run of two beside it, each white neighbour still in some run of three, and,
 * where the style asks, no square of four blacks (a hole in the grid rather than a pattern) or bar longer than `bars`
 * (a wall across it).
 */
function fine(g, R, C, k, squares = true, bars = Infinity) {
  const r = (k / C) | 0, c = k % C;
  const white = (y, x) => y >= 0 && x >= 0 && y < R && x < C && g[y][x] !== BLACK;
  const black = (y, x) => y >= 0 && x >= 0 && y < R && x < C && g[y][x] === BLACK;
  if (!squares) for (const [dy, dx] of [[-1, -1], [-1, 0], [0, -1], [0, 0]]) {
    if (black(r + dy, c + dx) && black(r + dy + 1, c + dx) && black(r + dy, c + dx + 1) && black(r + dy + 1, c + dx + 1)) return false;
  }
  const bar = (dy, dx) => { let n = 1; for (let i = 1; black(r + i * dy, c + i * dx); i++) n++; for (let i = 1; black(r - i * dy, c - i * dx); i++) n++; return n; };
  if (bar(0, 1) > bars || bar(1, 0) > bars) return false;
  const run = (y, x, dy, dx) => { let n = 0; while (white(y + n * dy, x + n * dx)) n++; return n; };   // from (y, x) on
  for (const [dy, dx] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const y = r + dy, x = c + dx;
    if (!white(y, x)) continue;
    const along = run(y, x, dy, dx) + run(y, x, -dy, -dx) - 1;           // the run the neighbour is in, this way
    if (along === 2) return false;
    const across = run(y, x, dx, dy) + run(y, x, -dx, -dy) - 1;          // and the other way
    if (along < 3 && across < 3) return false;                             // in no word at all
  }
  return true;
}

// ---------- where the words come from ----------
/**
 * wordlist.js as a source: each length's words in bands by tier, the commonest first (tiers 0 to upto). variants:
 * whether to keep the words only one spelling has (colour, color); extra: words of any length, ahead of them all in
 * a band of their own; exclude: words to leave out.
 */
export function wordSource({ upto = 2, variants = false, extra = [], exclude = [] } = {}) {
  const out = new Set(exclude.map(w => w.toLowerCase())), cache = new Map();
  const ex = extra.map(w => w.toLowerCase()).filter(w => /^[a-z]+$/.test(w) && !out.has(w));
  return len => {
    if (cache.has(len)) return cache.get(len);
    const bands = [ex.filter(w => w.length === len)], had = new Set(bands[0]);
    for (let t = 0; t <= upto; t++) {
      const band = wordsOf(len, t, { variants }).filter(w => !had.has(w) && !out.has(w));
      band.forEach(w => had.add(w));
      bands.push(band);
    }
    const b = bands.filter(x => x.length);
    cache.set(len, b);
    return b;
  };
}
/** A source's words of one length in the order a fill tries them, bands in turn, each shuffled; and the first band's size. */
function ordered(words, len, rnd) {
  const got = Array.isArray(words) ? [words.filter(w => w.length === len)] : words(len) || [];
  const bands = got.length && Array.isArray(got[0]) ? got : [got];
  const seen = new Set(), out = [];
  let first = 0;
  for (const band of bands) {
    for (const w of shuffled(band, rnd)) { const x = String(w).toLowerCase(); if (x.length === len && /^[a-z]+$/.test(x) && !seen.has(x)) { seen.add(x); out.push(x); } }
    if (!first) first = out.length;
  }
  return { words: out, first };
}

// ---------- the index: a length's words as bitsets ----------
const popcount = x => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24; };
const countOf = d => { let n = 0; for (let i = 0; i < d.length; i++) if (d[i]) n += popcount(d[i]); return n; };
/** The first set bit of d at or after `from` and before `to`, or -1. */
function nextIn(d, from, to) {
  if (from >= to) return -1;
  let x = from >>> 5;
  const last = (to - 1) >>> 5;
  let v = (d[x] & (0xFFFFFFFF << (from & 31))) >>> 0;
  for (;;) {
    if (v) { const j = (x << 5) | (31 - Math.clz32(v & -v)); return j < to ? j : -1; }
    if (++x > last) return -1;
    v = d[x];
  }
}
/**
 * One length's words with, per position and letter, a bitset of the words that have it there (pos), and per letter a
 * bitset of the words that have it anywhere (has).
 */
function indexOf({ words, first }, L) {
  const n = words.length, nw = (n + 31) >>> 5, pos = new Uint32Array(L * 26 * nw), has = new Uint32Array(26 * nw);
  for (let j = 0; j < n; j++) {
    const w = words[j], bit = (1 << (j & 31)) >>> 0, at = j >>> 5;
    for (let i = 0; i < L; i++) { const ch = w.charCodeAt(i) - 97; pos[(i * 26 + ch) * nw + at] |= bit; has[ch * nw + at] |= bit; }
  }
  const full = new Uint32Array(nw).fill(0xFFFFFFFF);
  if (n & 31) full[nw - 1] = ((1 << (n & 31)) - 1) >>> 0;
  return { L, n, nw, words, first: first || n, pos, has, full };
}

// ---------- filling ----------
const A = 97;
/** Fills a grid (see the top of the file). Deterministic: the same grid, words and seed fill the same way anywhere. */
export function fillGrid(grid, { words = wordSource(), place = [], fixed = [], seed = 1, budget = 60000, starts = 30, distinct = true, cover = "" } = {}) {
  const problems = gridProblems(grid);
  if (problems.length) throw new Error(`gridfill: ${problems[0]}`);
  const R = grid.length, C = grid[0].length, slots = slotsOf(grid);
  const placing = place.map(w => String(w).toLowerCase());
  const coverMask = [...String(cover).toLowerCase()].filter(ch => /[a-z]/.test(ch)).reduce((m, ch) => m | (1 << (ch.charCodeAt(0) - A)), 0);
  const fixedAt = fixed.map(f => ({ word: String(f.word).toLowerCase(), slot: slotFor(slots, f.slot) }));
  for (const f of fixedAt) if (!f.slot || f.slot.len !== f.word.length) throw new Error(`gridfill: no slot of ${f.word.length} for ${f.word}`);
  const order = seeded(mix(seed, 0x1D3)), ix = new Map();
  for (const L of new Set(slots.map(s => s.len))) ix.set(L, indexOf(ordered(words, L, order), L));
  const rareOrder = rareLetters(ix), rare = rareOrder.reduce((m, ch) => m | (1 << ch), 0) & coverMask, prep = prepare(slots);
  /** The letter of `mask` to go after first: the rarest. */
  const first = mask => { const ch = rareOrder.find(c => mask >> c & 1); return 1 << (ch ?? 31 - Math.clz32(mask & -mask)); };
  const toRows = letters => Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => (isWhite(grid[r][c]) ? String.fromCharCode(A + letters[r * C + c]) : BLACK)).join(""));
  const lettersOf = rows => [...rows.join("")].reduce((m, ch) => (ch === BLACK ? m : m | (1 << (ch.charCodeAt(0) - A))), 0);
  let nodes = 0, rows = null, placed = [];
  // the fill itself, the cover only steering it (rare letters it lacks tried first where no other slot crosses)
  for (let start = 0; start < starts && !rows; start++) {
    const got = search({ grid, R, C, slots, prep, ix, placing, fixedAt, rnd: seeded(mix(seed, start + 1)), distinct, need: 0, want: rare, budget: Math.ceil(budget / starts) });
    nodes += got.nodes;
    if (got.letters) { rows = toRows(got.letters); placed = got.placed; }
  }
  if (!rows) return null;
  // then the letters it missed, a window of the grid at a time: every white cell in it emptied (but for the words that
  // were placed or fixed) and the slots through it filled again around the letters they keep outside it, with the
  // missing letter somewhere and nothing the grid had lost, until none is missing
  const keep = new Set([...fixedAt.map(f => f.slot.id), ...placed.map(p => p.slot)]);
  const kept = new Set([...keep].flatMap(id => slots[id].cells)), W = Math.min(6, R), H = Math.min(6, C);
  for (let tries = 0; coverMask & ~lettersOf(rows) && tries < 150; tries++) {
    const rnd = seeded(mix(seed, 0x5EED + tries)), lack = coverMask & ~lettersOf(rows);
    const top = Math.floor(rnd() * (R - W + 1)), left = Math.floor(rnd() * (C - H + 1));
    const inside = (r, c) => r >= top && r < top + W && c >= left && c < left + H && !kept.has(r * C + c);
    const part = rows.map((row, r) => [...row].map((ch, c) => (ch !== BLACK && inside(r, c) ? "." : ch)).join(""));
    const outside = slots.filter(t => !t.cells.some(k => inside((k / C) | 0, k % C))).map(t => ({ word: t.cells.map(k => rows[(k / C) | 0][k % C]).join(""), slot: t }));
    const got = search({ grid: part, R, C, slots, prep, ix, placing: [], fixedAt: outside, rnd, distinct, need: lettersOf(rows) | first(lack), want: rare, budget: 300 });
    nodes += got.nodes;
    if (got.letters) rows = toRows(got.letters);
  }
  if (coverMask & ~lettersOf(rows)) return null;
  return {
    grid: rows,
    slots: slots.map(s => ({ ...s, word: s.cells.map(k => rows[(k / C) | 0][k % C]).join("") })),
    placed: placed.map(p => ({ word: p.word, slot: p.slot })),
    nodes,
  };
}
function slotFor(slots, at) {
  if (typeof at === "number") return slots[at] || null;
  return slots.find(s => s.row === at?.row && s.col === at?.col && s.dir === at?.dir) || null;
}
/** The letters few of the grid's words have (in under one word in eight), rarest first: the ones a cover goes looking for. */
function rareLetters(ix) {
  let total = 0;
  const n = new Array(26).fill(0);
  for (const I of ix.values()) {
    total += I.n;
    for (let ch = 0; ch < 26; ch++) n[ch] += countOf(I.has.subarray(ch * I.nw, (ch + 1) * I.nw));
  }
  return n.map((k, ch) => [ch, k]).filter(([, k]) => k < total / 8).sort((a, b) => a[1] - b[1]).map(([ch]) => ch);
}

/**
 * One start of the search: { letters (by cell), placed, nodes } on success, { nodes } when its budget ran out. need:
 * letters the fill must have somewhere; want: rare letters it should bring in where it can, at no cost to the rest.
 */
/** What every search of a grid shares: which cells each slot crosses (cross[s][i]: [slot, its position] or null). */
function prepare(slots) {
  const byCell = new Map();
  for (const s of slots) s.cells.forEach((k, i) => { if (!byCell.has(k)) byCell.set(k, []); byCell.get(k).push([s.id, i]); });
  return { byCell, cross: slots.map(s => s.cells.map(k => byCell.get(k).find(([t]) => t !== s.id) || null)) };
}
// the trail of every search: each narrowed slot's words before, kept in one buffer that grows and is reused (a search
// is never started inside another)
let arena = new Uint32Array(1 << 16);
function search({ grid, R, C, slots, prep, ix, placing, fixedAt, rnd, distinct, need, want, budget }) {
  const N = slots.length, cells = R * C, { byCell, cross } = prep;
  const letter = new Int8Array(cells).fill(-1), count = new Int32Array(26);
  const dom = slots.map(s => ix.get(s.len).full.slice()), cnt = slots.map(s => ix.get(s.len).n);
  const ver = new Int32Array(N);                                              // bumped whenever a slot's words change
  const seenAt = slots.map(s => new Int32Array(s.len).fill(-1)), maskAt = slots.map(s => new Int32Array(s.len));
  const word = new Int32Array(N).fill(-1), text = new Array(N).fill(null);   // a word of the index, or one put in
  const used = new Set();
  const tie = slots.map(() => rnd());                                         // the order among equally hard slots
  let top = 0;
  const trail = [];                                                           // slot, where its words are kept, count
  let nodes = 0;

  const isOpen = s => word[s] < 0 && text[s] == null;
  const narrow = (t, j, ch) => {
    const I = ix.get(slots[t].len), d = dom[t], off = (j * 26 + ch) * I.nw;
    if (top + d.length > arena.length) { const bigger = new Uint32Array(Math.max(arena.length * 2, top + d.length)); bigger.set(arena); arena = bigger; }
    arena.set(d, top);
    trail.push(t, top, cnt[t]);
    top += d.length;
    let n = 0;
    for (let x = 0; x < d.length; x++) { const v = (d[x] &= I.pos[off + x]); if (v) n += popcount(v); }
    cnt[t] = n;
    ver[t]++;
    return n;
  };
  const undo = mark => {
    while (trail.length > mark) {
      const n = trail.pop(), at = trail.pop(), t = trail.pop(), d = dom[t];
      d.set(arena.subarray(at, at + d.length));
      cnt[t] = n; ver[t]++; top = at;
    }
  };
  const write = (k, ch, wrote) => { letter[k] = ch; count[ch]++; wrote.push(k); };
  const unwrite = wrote => { for (const k of wrote) { count[letter[k]]--; letter[k] = -1; } wrote.length = 0; };
  /** Puts a word's letters in; false if one clashes or leaves a crossing slot with nothing (the trail keeps the changes). */
  const put = (s, w, wrote) => {
    const sl = slots[s];
    for (let i = 0; i < sl.len; i++) {
      const k = sl.cells[i], ch = w.charCodeAt(i) - A;
      if (letter[k] >= 0) { if (letter[k] !== ch) return false; continue; }
      write(k, ch, wrote);
      const x = cross[s][i];
      if (x && isOpen(x[0]) && !narrow(x[0], x[1], ch)) return false;
    }
    return true;
  };
  /** The letters slot t's words can have at its j-th cell, as a mask (kept until the slot's words change). */
  const lettersAt = (t, j) => {
    if (seenAt[t][j] === ver[t]) return maskAt[t][j];
    const I = ix.get(slots[t].len), d = dom[t];
    let m = 0;
    if (cnt[t] <= 48) {                            // few words: read them
      for (let x = 0; x < d.length; x++) for (let v = d[x]; v; v &= v - 1) m |= 1 << (I.words[(x << 5) | (31 - Math.clz32(v & -v))].charCodeAt(j) - A);
    } else {
      for (let ch = 0; ch < 26; ch++) {
        const off = (j * 26 + ch) * I.nw;
        for (let x = 0; x < d.length; x++) if (d[x] & I.pos[off + x]) { m |= 1 << ch; break; }
      }
    }
    seenAt[t][j] = ver[t]; maskAt[t][j] = m;
    return m;
  };
  /** After slot s took a word: each open slot it crosses still meets each of its own open crossings on a letter. */
  const consistent = s => {
    for (const x of cross[s]) {
      if (!x || !isOpen(x[0])) continue;
      const t = x[0], sl = slots[t];
      for (let i = 0; i < sl.len; i++) {
        const y = cross[t][i];
        if (!y || letter[sl.cells[i]] >= 0 || !isOpen(y[0])) continue;
        if (!(lettersAt(t, i) & lettersAt(y[0], y[1]))) return false;
      }
    }
    return true;
  };
  const absent = () => { let m = 0; for (let ch = 0; ch < 26; ch++) if (!count[ch]) m |= 1 << ch; return m; };
  const missing = () => absent() & need;
  /** Whether every letter the fill needs and lacks can still go in some open slot. */
  const coverable = () => {
    const lack = missing();
    for (let ch = 0; ch < 26; ch++) {
      if (!(lack >> ch & 1)) continue;
      let found = false;
      for (let t = 0; t < N && !found; t++) {
        if (!isOpen(t)) continue;
        const I = ix.get(slots[t].len), d = dom[t], off = ch * I.nw;
        for (let x = 0; x < d.length; x++) if (d[x] & I.has[off + x]) { found = true; break; }
      }
      if (!found) return false;
    }
    return true;
  };

  // the words that go in given slots (all taken first, so only the open slots they cross are narrowed), then the
  // letters already in the grid
  for (const f of fixedAt) text[f.slot.id] = f.word;
  for (const f of fixedAt) {
    if (!put(f.slot.id, f.word, [])) return { nodes };
    used.add(f.word);
  }
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const ch = grid[r][c];
    if (!/[a-z]/i.test(ch)) continue;
    const k = r * C + c, v = ch.toLowerCase().charCodeAt(0) - A;
    if (letter[k] >= 0) { if (letter[k] !== v) return { nodes }; continue; }
    write(k, v, []);
    for (const [t, j] of byCell.get(k)) if (isOpen(t) && !narrow(t, j, v)) return { nodes };
  }

  /** The open slot with fewest words left (then the longest, then the seed's order); -1 when every slot is filled. */
  const pick = () => {
    let best = -1;
    for (let s = 0; s < N; s++) {
      if (!isOpen(s)) continue;
      if (best < 0 || cnt[s] < cnt[best] || (cnt[s] === cnt[best] && (slots[s].len > slots[best].len || (slots[s].len === slots[best].len && tie[s] < tie[best])))) best = s;
    }
    return best;
  };
  /**
   * The order a frame tries slot s's words in (see nextWord), each set from a point of its own. While a rare letter is
   * wanted, the words that bring one in on a cell no other slot crosses go first (they cost the grid nothing); while
   * one is needed, then those that bring one in anywhere; then the rest.
   */
  const wordsFrame = (kind, s) => {
    const I = ix.get(slots[s].len), d = dom[s], off = Math.floor(rnd() * I.first), lack = absent() & (want | need), needed = missing();
    let sets = [d];
    if (lack) {
      const free = new Uint32Array(I.nw), any = new Uint32Array(I.nw), rest = new Uint32Array(I.nw);
      for (let ch = 0; ch < 26; ch++) {
        if (!(lack >> ch & 1)) continue;
        if (needed >> ch & 1) for (let x = 0; x < I.nw; x++) any[x] |= I.has[ch * I.nw + x];
        for (let i = 0; i < slots[s].len; i++) {
          if (cross[s][i] || letter[slots[s].cells[i]] >= 0) continue;
          const at = (i * 26 + ch) * I.nw;
          for (let x = 0; x < I.nw; x++) free[x] |= I.pos[at + x];
        }
      }
      for (let x = 0; x < I.nw; x++) { free[x] &= d[x]; any[x] &= d[x] & ~free[x]; rest[x] = d[x] & ~free[x] & ~any[x]; }
      sets = [free, any, rest];
    }
    return { kind, s, sets, si: 0, rg: [[off, I.first], [0, off], [I.first, I.n]], ri: 0, at: off };
  };
  /** The next word a frame tries: the commonest band from the frame's own point round to where it began, then the rest. */
  const nextWord = f => {
    while (f.si < f.sets.length) {
      const [from, to] = f.rg[f.ri], j = nextIn(f.sets[f.si], Math.max(f.at, from), to);
      if (j >= 0) { f.at = j + 1; return j; }
      if (++f.ri === f.rg.length) { f.ri = 0; f.si++; }
      f.at = f.rg[f.ri][0];
    }
    return -1;
  };
  const placed = [];
  /**
   * A frame for a word to place: the open slots of its length where it fits, the one that leaves the slots it crosses
   * the most words first (the seed's order among equals), so an awkward word goes where it costs the grid least.
   */
  const placeFrame = p => {
    const w = placing[p], scored = [];
    for (const s of shuffled(slots.filter(x => x.len === w.length && isOpen(x.id)).map(x => x.id), rnd)) {
      const mark = trail.length, wrote = [];
      text[s] = w;
      if (put(s, w, wrote) && consistent(s)) scored.push([s, Math.min(Infinity, ...cross[s].filter(x => x && isOpen(x[0])).map(([t]) => cnt[t]))]);
      text[s] = null; undo(mark); unwrite(wrote);
    }
    return { kind: "place", p, order: scored.sort((a, b) => b[1] - a[1]).map(([s]) => s), at: 0 };
  };
  const nextFrame = () => {
    if (placed.length < placing.length) return placeFrame(placed.length);
    const s = pick();
    return s < 0 ? null : wordsFrame("fill", s);
  };

  /** Tries word j of slot s; true if it holds (the frame's changes are on its marks). */
  const tryWord = (f, s, j) => {
    const w = ix.get(slots[s].len).words[j];
    if (distinct && used.has(w)) return false;
    word[s] = j; used.add(w);
    if (put(s, w, f.wrote) && consistent(s) && (!need || coverable())) { f.s = s; return true; }
    undo(f.mark); unwrite(f.wrote); used.delete(w); word[s] = -1;
    return false;
  };
  const stack = [];
  const first = nextFrame();
  if (!first) return missing() ? { nodes } : { letters: Int8Array.from(letter), placed, nodes };
  stack.push(first);
  while (stack.length) {
    const f = stack[stack.length - 1];
    if (f.on) {                                    // back at this frame: take its last try out
      undo(f.mark); unwrite(f.wrote);
      if (f.kind === "place") { const p = placed.pop(); text[p.slot] = null; used.delete(p.word); }
      else { used.delete(ix.get(slots[f.s].len).words[word[f.s]]); word[f.s] = -1; }
      f.on = false;
    }
    if (++nodes > budget) return { nodes };
    f.mark = trail.length; f.wrote = [];
    let ok = false;
    if (f.kind === "place") {
      const w = placing[f.p];
      while (f.at < f.order.length && !ok) {
        const s = f.order[f.at++];
        if (!isOpen(s) || (distinct && used.has(w))) continue;
        text[s] = w;
        if (put(s, w, f.wrote) && consistent(s) && (!need || coverable())) { used.add(w); placed.push({ word: w, slot: s }); ok = true; }
        else { text[s] = null; undo(f.mark); unwrite(f.wrote); }
      }
    } else {
      while (!ok) {
        const j = nextWord(f);
        if (j < 0) break;
        ok = tryWord(f, f.s, j);
      }
    }
    if (!ok) { stack.pop(); continue; }
    f.on = true;
    const next = nextFrame();
    if (!next) {
      if (!missing()) return { letters: Int8Array.from(letter), placed, nodes };
      continue;                                    // every slot filled, but a letter the cover wants is missing
    }
    stack.push(next);
  }
  return { nodes };
}
