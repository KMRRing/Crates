// Rack's computer player (README, Rack). It finds every play there is with Appel and Jacobson's method: for each row (and,
// on the board turned on its side, each column) take the squares a word could start from, which are the empty squares next
// to a tile (the star, for the first word); build the part of the word to the left of that square out of the rack, then run
// to the right through the tiles already there, laying a rack tile on each empty square only if it makes a word with the
// letters above and below it (the square's "cross-check"). Words are found in one sorted list: the words that begin with
// some letters are one stretch of it, found by bisection, so no word is tried that cannot be finished.
//
// The levels differ in the words they know (Easy the everyday ones, Hard every word the game accepts) and in how they
// choose: Easy a middling play, Medium one of the best few, Hard the best by score plus what the tiles it keeps are worth.
import { SIZE, CELLS, CENTER, HAND, VALUES, TWO, EXTRA, evaluate, isPlay, isEmptyBoard } from "./rack-rules.js";
import { wordsOf, isWord, RAREST } from "./wordlist.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
const LEVELS = { easy: { upto: 2 }, medium: { upto: 5 }, hard: { upto: RAREST } };

const A = 97, ALL = (1 << 26) - 1;
const UP = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
const LOW = UP.map(c => c.toLowerCase());

// ---------- the word list, as the bot reads it ----------
const dicts = new Map();
/** The words a level knows (and how to ask whether one is a word), the words sorted together as one list. */
export function dictionary(level) {
  const upto = (LEVELS[level] || LEVELS.medium).upto;
  let d = dicts.get(upto);
  if (!d) {
    const all = new Set([...TWO, ...EXTRA]);
    for (let n = 3; n <= 15; n++) for (const w of wordsOf(n, upto)) all.add(w);
    d = { words: [...all].sort(), has: w => (w.length === 2 ? TWO.has(w) : EXTRA.has(w) || isWord(w, upto)) };
    dicts.set(upto, d);
  }
  return d;
}
/** Builds a level's list ahead of its first move (a page does it when it is idle). */
export const warm = level => void dictionary(level);

/** The first index after `k` whose letter at depth d isn't c, within the stretch ending at hi. */
function endOf(words, k, hi, d, c) {
  let a = k + 1, b = hi;
  while (a < b) { const m = (a + b) >> 1; if (words[m].charCodeAt(d) === c) a = m + 1; else b = m; }
  return a;
}
/** The stretch of [lo, hi) (all beginning with the same d letters) whose next letter is c, or null. */
function narrow(words, lo, hi, d, c) {
  let a = lo, b = hi;
  while (a < b) { const m = (a + b) >> 1, x = words[m].length > d ? words[m].charCodeAt(d) : 0; if (x < c) a = m + 1; else b = m; }
  if (a >= hi || words[a].charCodeAt(d) !== c) return null;
  return [a, endOf(words, a, hi, d, c)];
}
/** Each letter that can come next after the prefix of [lo, hi): fn(letter 0–25, from, to). */
function each(words, lo, hi, d, fn) {
  let k = lo;
  if (k < hi && words[k].length === d) k++;                        // the prefix itself is a word: the longer ones follow
  while (k < hi) {
    const c = words[k].charCodeAt(d), e = endOf(words, k, hi, d, c);
    fn(c - A, k, e);
    k = e;
  }
}

// ---------- every play along one row ----------
function rowPlays(grid, r, rack, dict, out, first) {
  const { words, has } = dict, row = r * SIZE;
  const cross = new Array(SIZE).fill(ALL), anchor = new Array(SIZE).fill(false);
  for (let c = 0; c < SIZE; c++) {
    const i = row + c;
    if (grid[i] !== ".") continue;
    const up = r > 0 && grid[i - SIZE] !== ".", down = r < SIZE - 1 && grid[i + SIZE] !== ".";
    anchor[c] = up || down || (c > 0 && grid[i - 1] !== ".") || (c < SIZE - 1 && grid[i + 1] !== ".");
    if (!up && !down) continue;
    let a = r, b = r, pre = "", post = "";
    while (a > 0 && grid[(a - 1) * SIZE + c] !== ".") a--;
    while (b < SIZE - 1 && grid[(b + 1) * SIZE + c] !== ".") b++;
    for (let k = a; k < r; k++) pre += grid[k * SIZE + c].toLowerCase();
    for (let k = r + 1; k <= b; k++) post += grid[k * SIZE + c].toLowerCase();
    let m = 0;
    for (let x = 0; x < 26; x++) if (has(pre + LOW[x] + post)) m |= 1 << x;
    cross[c] = m;
  }
  if (first) { anchor.fill(false); anchor[CENTER % SIZE] = true; }
  if (!anchor.some((v, c) => v && cross[c])) return;

  const cnt = new Int8Array(26);
  let blanks = 0;
  for (const ch of rack) { if (ch === "?") blanks++; else cnt[ch.charCodeAt(0) - 65]++; }
  const lefts = [], rights = [];
  let c0 = 0;

  const record = () => {
    const mv = [];
    for (let k = 0; k < lefts.length; k++) mv.push([c0 - lefts.length + k, lefts[k]]);
    for (let k = 0; k < rights.length; k += 2) mv.push([rights[k], rights[k + 1]]);
    out.push(mv);
  };
  // d letters of the word are down up to col-1 (tiles on the board or laid from the rack); it may go on from col
  const extend = (lo, hi, d, col) => {
    if (col >= SIZE || grid[row + col] === ".") {
      if (col > c0 && d >= 2 && words[lo].length === d) record();
      if (col >= SIZE) return;
      each(words, lo, hi, d, (x, l2, h2) => {
        if (!((cross[col] >> x) & 1)) return;
        if (cnt[x] > 0) { cnt[x]--; rights.push(col, UP[x]); extend(l2, h2, d + 1, col + 1); rights.length -= 2; cnt[x]++; }
        if (blanks > 0) { blanks--; rights.push(col, LOW[x]); extend(l2, h2, d + 1, col + 1); rights.length -= 2; blanks++; }
      });
    } else {
      const rg = narrow(words, lo, hi, d, grid[row + col].toLowerCase().charCodeAt(0));
      if (rg) extend(rg[0], rg[1], d + 1, col + 1);
    }
  };
  // the part of the word before the anchor, made from the rack, at most `limit` tiles (the squares that are not anchors)
  const left = (lo, hi, d, limit) => {
    extend(lo, hi, d, c0);
    if (d >= limit) return;
    each(words, lo, hi, d, (x, l2, h2) => {
      if (cnt[x] > 0) { cnt[x]--; lefts.push(UP[x]); left(l2, h2, d + 1, limit); lefts.pop(); cnt[x]++; }
      if (blanks > 0) { blanks--; lefts.push(LOW[x]); left(l2, h2, d + 1, limit); lefts.pop(); blanks++; }
    });
  };

  for (c0 = 0; c0 < SIZE; c0++) {
    if (!anchor[c0] || !cross[c0]) continue;
    if (c0 > 0 && grid[row + c0 - 1] !== ".") {                    // tiles already stand to the left: the word begins with them
      let s = c0, lo = 0, hi = words.length, d = 0;
      while (s > 0 && grid[row + s - 1] !== ".") s--;
      for (let k = s; k < c0 && hi > lo; k++, d++) {
        const rg = narrow(words, lo, hi, d, grid[row + k].toLowerCase().charCodeAt(0));
        if (rg) [lo, hi] = rg; else hi = lo;
      }
      if (hi > lo) extend(lo, hi, d, c0);
    } else {
      let limit = 0;
      for (let c = c0 - 1; c >= 0 && grid[row + c] === "." && !anchor[c]; c--) limit++;
      left(0, words.length, 0, limit);
    }
  }
}

const turn = board => { let t = ""; for (let c = 0; c < SIZE; c++) for (let r = 0; r < SIZE; r++) t += board[r * SIZE + c]; return t; };

/** Every play the rack makes on the board with the words of `dict`: [[square, letter]…] each, a letter in lower case for a blank. */
export function findPlays(board, rack, dict) {
  const first = isEmptyBoard(board), found = new Map();
  for (const side of first ? [0] : [0, 1]) {
    const grid = side ? turn(board) : board;
    for (let r = 0; r < SIZE; r++) {
      if (first && r !== ((CENTER / SIZE) | 0)) continue;
      const raw = [];
      rowPlays(grid, r, rack, dict, raw, first);
      for (const mv of raw) {
        const put = mv.map(([c, ch]) => [side ? c * SIZE + r : r * SIZE + c, ch]).sort((a, b) => a[0] - b[0]);
        found.set(put.map(p => p[0] + p[1]).join(), put);
      }
    }
  }
  return [...found.values()];
}

// ---------- what a play is worth ----------
// A rough worth of keeping a tile for the next turn, and the penalties for doubles and a rack of all vowels or all consonants.
const KEEP = { "?": 25, S: 8, Z: 5, X: 4, R: 1.5, E: 1.5, D: .5, H: .5, T: .5, N: .5, O: -1, I: -1, G: -2, P: -.5, B: -2, F: -2, Y: -1, K: -2.5, W: -3, J: -3, U: -3, V: -5, Q: -7 };
export function leaveValue(tiles) {
  const seen = {};
  let v = 0, vowels = 0;
  for (const t of tiles) {
    v += KEEP[t] ?? 0;
    seen[t] = (seen[t] || 0) + 1;
    if ("AEIOU".includes(t)) vowels++;
  }
  for (const t in seen) if (seen[t] > 1 && t !== "?") v -= 2.2 * (seen[t] - 1);
  if (tiles.length >= 3) v -= 12 * Math.max(0, Math.abs(vowels / tiles.length - .42) - .2);
  return v;
}
const tileOf = ch => (ch === ch.toLowerCase() ? "?" : ch);
const without = (rack, put) => { const r = [...rack]; for (const [, ch] of put) r.splice(r.indexOf(tileOf(ch)), 1); return r; };

/** Every play scored, best equity first (score, plus the worth of the tiles kept; in the endgame, less the tiles stuck). */
export function rankPlays(s, seat, level) {
  const dict = dictionary(level), rack = s.racks[seat];
  const plays = [];
  for (const put of findPlays(s.board, rack, dict)) {
    const r = evaluate(s.board, put, null), keep = without(rack, put);
    let equity = r.score;
    if (s.bag.length === 0) {
      equity -= keep.reduce((n, t) => n + (VALUES[t] ?? 0), 0);
      if (!keep.length) equity += s.racks.reduce((n, k, i) => (i === seat ? n : n + [...k].reduce((m, t) => m + (VALUES[t] ?? 0), 0)), 0);
    } else equity += leaveValue(keep);
    plays.push({ put, score: r.score, equity });
  }
  return plays.sort((a, b) => b.equity - a.equity || b.score - a.score);
}

/** The best play there is, for a hint: { put, score } or null. */
export function bestPlay(s, seat) { return rankPlays(s, seat, "hard")[0] || null; }

/** Which tiles to swap: all but the few worth keeping. */
function toSwap(rack) {
  const keep = [...rack].filter(t => (KEEP[t] ?? 0) >= 4).slice(0, 2);
  const throwing = [...rack];
  for (const t of keep) throwing.splice(throwing.indexOf(t), 1);
  return throwing.join("");
}

/** The play a level makes: { t: "play", put }, or a swap, or a pass. */
export function botMove(s, seat, { level, rng }) {
  const lvl = LEVELS[level] ? level : "medium", rack = s.racks[seat], plays = rankPlays(s, seat, lvl);
  const canSwap = s.bag.length >= HAND;
  let pick = null;
  if (plays.length) {
    const best = plays[0];
    const swapWorth = canSwap ? leaveValue([...rack].filter(t => (KEEP[t] ?? 0) >= 4).slice(0, 2)) : -Infinity;
    if (lvl === "hard" && canSwap && best.score < 12 && best.equity < swapWorth) pick = null;
    else if (lvl === "medium" && canSwap && best.score <= 4) pick = null;
    else if (lvl === "easy") pick = plays[Math.floor(plays.length * (.35 + .3 * rng()))];
    else if (lvl === "medium") pick = plays[Math.floor(rng() * rng() * Math.min(6, plays.length))];
    else pick = best;
    // the word list a level reads is the narrower: the game's own list has the last say
    const order = pick ? [pick, ...plays.filter(p => p !== pick)] : [];
    for (const p of order) if (!evaluate(s.board, p.put, isPlay).error) return { t: "play", put: p.put };
  }
  return canSwap ? { t: "swap", tiles: toSwap(rack) } : { t: "pass" };
}
