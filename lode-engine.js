// Lode's rules and boards, pure (lode.js draws them; tests/lode.mjs checks them). Strands' genre: a board of 48
// letters hides the theme's words, each a path of touching letters, and between them they use every letter once; one
// of them, the spanning word (the mother lode), names the theme and touches two opposite sides. The themes are the
// knowledge base's countries and commodities, their words the clues that point to them (Crates' bank, bank.js). A
// board is made from its seed alone, the same on every device: the words are chosen, packed into the board as paths
// that never cross, lettered, and kept only if every word can be traced in exactly one way (so however you trace a
// word, it is the board's own) and the words cover the board in exactly one way. Nothing here reads the clock, a
// random number of its own or the page.
import { BANK, GROUPS } from "./core.js";
import { KB_TOPICS, drawWeighted } from "./topics.js";
import { isWord } from "./wordlist.js";
import { SPAN } from "./lode-themes.js";

export const COLS = 6, ROWS = 8, CELLS = COLS * ROWS;
export const MIN_WORD = 4, MAX_WORD = 10;
export const MAX_TWICE = 2;           // words on a board that may also trace a second way (they're found either way)
export const PER_HINT = 3;            // other words found for one hint, as in Strands
export const HINT_COST = 30;          // seconds a hint adds to the score
export const SHOW_COST = 120;         // seconds each word shown by giving up adds: more than earning a hint ever costs
export const KINDS = { country: "country", commodity: "commodity" };
export const POOLS = { countries: ["country"], commodities: ["commodity"], mixed: ["country", "commodity"] };
export { GROUPS };

// ---------- seeded randomness: the same seed, the same numbers, on every device ----------
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
const shuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** A string's own number (FNV-1a), so a theme or a level stirs a seed the same way everywhere. */
export const hashOf = s => { let h = 0x811C9DC5; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0; return h; };

// ---------- the boards' shapes ----------
// Square: 8 rows of 6, a letter touching the eight around it, diagonals included; two paths' diagonals never cross,
// so every word can be drawn as a line. Hex: the same 48 as a honeycomb, rows of 6 with every other row set half a
// cell to the right, each letter touching six; hexes' links never cross.
const geos = {};
export function geometry(shape = "square") {
  if (geos[shape]) return geos[shape];
  const hex = shape === "hex", nbrs = [], x2 = [], y = [];
  for (let i = 0; i < CELLS; i++) {
    const r = Math.floor(i / COLS), c = i % COLS, out = [];
    const offs = hex ? (r % 2 ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]])
      : [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    for (const [dr, dc] of offs) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) out.push(rr * COLS + cc); }
    nbrs.push(out);
    x2.push(2 * c + (hex && r % 2 ? 1 : 0));    // twice the column, so a hex row's half step stays a whole number
    y.push(r);
  }
  const touch = nbrs.map(list => new Set(list));
  return (geos[shape] = { shape, hex, cols: COLS, rows: ROWS, n: CELLS, nbrs, touch, x2, y });
}
export const rowOf = i => Math.floor(i / COLS), colOf = i => i % COLS;
/** The 2×2 block a square board's diagonal step lies in (its two diagonals cross), or -1 for any other step. */
function blockOf(geo, a, b) {
  if (geo.hex) return -1;
  const ra = rowOf(a), rb = rowOf(b), ca = colOf(a), cb = colOf(b);
  return ra !== rb && ca !== cb ? Math.min(ra, rb) * (COLS - 1) + Math.min(ca, cb) : -1;
}
/** A step read the way a page is: rightwards, or straight down. Words that run so are the easiest to see. */
const forward = (geo, a, b) => geo.x2[b] > geo.x2[a] || (geo.x2[b] === geo.x2[a] && geo.y[b] > geo.y[a]);
const dirOf = (geo, a, b) => `${geo.x2[b] - geo.x2[a]},${geo.y[b] - geo.y[a]}`;

// ---------- the themes and their words ----------
/** A name as letters on the board: accents dropped, ß as SS, Ø as O, soft hyphens gone, A to Z. */
export function letters(name) {
  return String(name || "").replace(/­/g, "").replace(/ß/g, "ss").replace(/[Øø]/g, "o").replace(/[Ææ]/g, "ae").replace(/[Œœ]/g, "oe")
    .replace(/[Łł]/g, "l").replace(/[Đđ]/g, "d").replace(/[Þþ]/g, "th").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}
const acronym = name => name.length > 1 && /^[A-Z0-9]+$/.test(name);
export const THEMES = BANK.map((a, i) => ({ i, id: a.entity, name: a.name, kind: a.cat, group: a.group, span: SPAN[a.entity] || null })).filter(t => t.span);
const BY_ID = new Map(THEMES.map(t => [t.id, t]));
export const themeById = id => BY_ID.get(id) || null;
const FILLER = new Set(["THE", "AND", "FOR"]);   // in other names ("the netherlands"), but in every clue too
/** The name's pieces and its other names, as the words a title mustn't say (Iran, and so Iranian). */
function namesOf(t) {
  const a = BANK[t.i], parts = new Set();
  for (const s of [a.name, ...(a.aliases || []), ...t.span]) for (const p of letters(s).split(/[^A-Z]+/)) if (p.length >= 3 && !FILLER.has(p)) parts.add(p);
  for (const s of t.span) parts.add(s);
  return [...parts];
}
const wordsCache = new Map();
/** A theme's words that fit on a board: one word of 4 to 10 letters (Björk as BJORK), each once, the easier link kept. */
export function wordsOf(t) {
  if (wordsCache.has(t.id)) return wordsCache.get(t.id);
  const own = namesOf(t), seen = new Map();
  BANK[t.i].words.forEach((w, k) => {
    const text = letters(w.w);
    if (!/^[A-Z]+$/.test(text) || text.length < MIN_WORD || text.length > MAX_WORD) return;
    if (own.some(n => n.length >= 4 && (text.includes(n) || n.includes(text)))) return;   // Copperbelt under Copper
    const x = { k, text, shown: w.w, hint: w.hint || "", d: w.d || 2, topics: w.topics || [], entity: w.entity || null, acr: acronym(w.w) };
    if (!seen.has(text) || seen.get(text).d > x.d) seen.set(text, x);
  });
  const out = [...seen.values()];
  wordsCache.set(t.id, out);
  return out;
}

// ---------- levels ----------
// What makes a board hard is knowing its words and finding them. Knowing: each word's link carries the knowledge
// base's difficulty, 1 (well known) to 3 (specialist), and a level weights its choice by it (Easy never deals a 3, Hard
// leans on them); acronyms (RTFO, CFPP) read as no word does, so Easy leaves them out. Finding: a level shapes the
// paths (Easy's run straight and read rightwards or down, Hard's turn and run back), and every board is graded on both
// (grade() below) and kept only inside its level's band. The title, a clue to the theme, is an easier one at Easy.
// lean: what a word read against the level's direction costs the lettering, against 100 for a word that traces twice
export const LEVELS = {
  easy: { label: "Easy", weight: { 1: 6, 2: 2, 3: 0 }, acronyms: 0, straight: 0.7, turn: 0, reads: "forward", lean: 30, title: 1 },
  medium: { label: "Medium", weight: { 1: 3, 2: 4, 3: 1 }, acronyms: 0.5, straight: 0.25, turn: 0, reads: "either", lean: 0, title: 2 },
  hard: { label: "Hard", weight: { 1: 1, 2: 3, 3: 4 }, acronyms: 1, straight: 0, turn: 0.45, reads: "back", lean: 10, title: 3 },
};
export const SHAPES = { square: "Square", hex: "Hex" };

/** A mix of topics (KB_TOPICS, out 0, in 1, more 2) as the weight of a word: its likeliest topic's. */
const topicWeight = (w, mix) => (!mix || !w.topics.length ? 1 : Math.max(...w.topics.map(t => mix[t] ?? 1)));

/**
 * Picks the theme's words for a board: a spanning word of the theme's, then words whose lengths add up to the rest of
 * the 48 letters, five to seven of them (four to eight if it must), drawn by the level's and the mix's weights. No word
 * holds another (COPPER in COPPERBELT would trace twice). null when the theme can't fill a board so.
 */
function chooseWords(r, t, level, mix, spanText) {
  const L = LEVELS[level], target = CELLS - spanText.length;
  const pool = wordsOf(t).filter(w => !spanText.includes(w.text) && !w.text.includes(spanText));
  const level0 = w => (L.weight[w.d] ?? 1) * (w.acr ? L.acronyms : 1);
  // the mix's words first, by weight; a word only of topics left out comes after them all, used only if the theme
  // can't fill a board without it
  const order = [...drawWeighted(r, pool, w => level0(w) * topicWeight(w, mix)), ...drawWeighted(r, pool, w => (topicWeight(w, mix) ? 0 : level0(w)))];
  for (const [lo, hi] of [[5, 7], [4, 8]]) {
    const pick = [];
    let budget = 4000;
    const go = (k, sum) => {
      if (sum === target) return pick.length >= lo;
      if (pick.length >= hi || k >= order.length || --budget < 0) return false;
      const w = order[k];
      if (sum + w.text.length <= target && !pick.some(p => p.text.includes(w.text) || w.text.includes(p.text))) {
        pick.push(w);
        if (go(k + 1, sum + w.text.length)) return true;
        pick.pop();
      }
      return go(k + 1, sum);
    };
    if (go(0, 0)) return pick;
  }
  return null;
}

// ---------- packing: the board cut into paths of the words' lengths ----------
// The spanning word goes first, a walk from one side to the side across; then the rest of the board is cut into paths
// of the other words' lengths, always from the free cell with the fewest free neighbours (a corner, a cell walled in),
// which has to be the end of whatever path takes it. After every path the free cells are checked: each patch left must
// be the size of some of the words still to place. A search that runs past its budget starts again from a new walk.
// Steps are tried in an order the level leans: Easy straight on, Hard turning.
function stepOrder(ctx, path, cand) {
  const { r, geo, style } = ctx;
  if (path.length < 2) return shuffle(r, cand);
  const a = path[path.length - 2], b = path[path.length - 1], d0 = dirOf(geo, a, b);
  const keyed = cand.map(j => ({ j, k: r() + (dirOf(geo, b, j) === d0 ? style.straight : style.turn) }));
  keyed.sort((p, q) => q.k - p.k);
  return keyed.map(x => x.j);
}
/** Marks cell j taken (and, on a square board, the diagonal block its step from i lies in); returns how to undo it. */
function take(ctx, i, j) {
  ctx.owner[j] = 1;
  const b = i < 0 ? -1 : blockOf(ctx.geo, i, j);
  if (b >= 0) ctx.diag[b] = 1;
  return b;
}
function untake(ctx, j, b) { ctx.owner[j] = 0; if (b >= 0) ctx.diag[b] = 0; }
const stepFree = (ctx, i, j) => { const b = blockOf(ctx.geo, i, j); return b < 0 || !ctx.diag[b]; };
/** Every walk of exactly n cells from `start` over free cells (no crossing), each handed to onWalk until it says stop. */
function walksFrom(ctx, start, n, onWalk, may = null) {
  const path = [start], undo = [take(ctx, -1, start)];
  let stop = false;
  const step = () => {
    if (path.length === n) { if (onWalk(path)) stop = true; return; }
    if (--ctx.budget < 0) { stop = true; return; }
    const last = path[path.length - 1];
    const cand = ctx.geo.nbrs[last].filter(j => !ctx.owner[j] && stepFree(ctx, last, j) && (!may || may(path, j)));
    for (const j of stepOrder(ctx, path, cand)) {
      undo.push(take(ctx, last, j)); path.push(j);
      step();
      path.pop(); untake(ctx, j, undo.pop());
      if (stop) return;
    }
  };
  step();
  untake(ctx, start, undo.pop());
}
/** The free cells in patches (neighbours by a step that crosses nothing), their sizes. */
function patches(ctx) {
  const { geo, owner } = ctx, seen = new Uint8Array(geo.n), sizes = [];
  for (let s = 0; s < geo.n; s++) {
    if (owner[s] || seen[s]) continue;
    let size = 0;
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop();
      size++;
      for (const j of geo.nbrs[i]) if (!owner[j] && !seen[j] && stepFree(ctx, i, j)) { seen[j] = 1; stack.push(j); }
    }
    sizes.push(size);
  }
  return sizes;
}
/** Whether word lengths can be shared out among patches so each patch is exactly filled. */
function fits(sizes, lengths) {
  if (sizes.some(s => s < MIN_WORD)) return false;
  const rem = [...sizes].sort((a, b) => b - a), ls = [...lengths].sort((a, b) => b - a);
  const place = k => {
    if (k === ls.length) return rem.every(x => x === 0);
    const tried = new Set();
    for (let i = 0; i < rem.length; i++) {
      if (rem[i] < ls[k] || tried.has(rem[i])) continue;
      tried.add(rem[i]);
      rem[i] -= ls[k];
      const ok = place(k + 1);
      rem[i] += ls[k];
      if (ok) return true;
    }
    return false;
  };
  return place(0);
}
const without = (xs, x) => { const i = xs.indexOf(x), a = [...xs]; a.splice(i, 1); return a; };
function fillRest(ctx, lengths, placed) {
  if (!lengths.length) return placed;
  if (ctx.budget < 0) return null;
  const { geo, owner, r } = ctx;
  let best = -1, bestDeg = 99, ties = 0;
  for (let i = 0; i < geo.n; i++) {
    if (owner[i]) continue;
    let deg = 0;
    for (const j of geo.nbrs[i]) if (!owner[j] && stepFree(ctx, i, j)) deg++;
    if (deg < bestDeg) { best = i; bestDeg = deg; ties = 1; }
    else if (deg === bestDeg && r() * ++ties < 1) best = i;
  }
  if (bestDeg === 0) return null;
  for (const n of shuffle(r, [...new Set(lengths)])) {
    const rest = without(lengths, n);
    let found = null, tries = 0;
    walksFrom(ctx, best, n, path => {
      if (!fits(patches(ctx), rest)) return ++tries >= 6;
      found = fillRest(ctx, rest, [...placed, [...path]]);
      return !!found || ++tries >= 3;
    });
    if (found) return found;
    if (ctx.budget < 0) return null;
  }
  return null;
}
/** The spanning word's walk: from a cell on one side to the side across (left to right, or top to bottom). */
function spanWalk(ctx, n, lengths) {
  const { r } = ctx, across = n >= COLS, down = n >= ROWS;
  const ways = shuffle(r, [...(across ? ["across", "across"] : []), ...(down ? ["down"] : [])]);
  for (const way of ways) {
    const starts = shuffle(r, Array.from({ length: way === "across" ? ROWS : COLS }, (_, k) => (way === "across" ? k * COLS : k))).slice(0, 3);
    const far = i => (way === "across" ? colOf(i) === COLS - 1 : rowOf(i) === ROWS - 1);
    const gap = i => (way === "across" ? COLS - 1 - colOf(i) : ROWS - 1 - rowOf(i));
    for (const s of starts) {
      let got = null, tries = 0;
      ctx.budget = 1500;
      walksFrom(ctx, s, n, path => {
        if (!path.some(far)) return false;
        if (!fits(patches(ctx), lengths)) return ++tries >= 8;
        got = [...path];
        return true;
      }, (path, j) => path.some(far) || far(j) || gap(j) <= n - path.length - 1);
      if (got) return got;
    }
  }
  return null;
}
/** The board cut into paths: the spanning word's first, then one for each other length. null if it didn't come off. */
function pack(r, geo, spanLen, lengths, style) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const ctx = { r, geo, style, owner: new Uint8Array(geo.n), diag: new Uint8Array((COLS - 1) * (ROWS - 1)), budget: 0 };
    const span = spanWalk(ctx, spanLen, lengths);
    if (!span) continue;
    for (const i of span) ctx.owner[i] = 1;
    for (let k = 1; k < span.length; k++) { const b = blockOf(geo, span[k - 1], span[k]); if (b >= 0) ctx.diag[b] = 1; }
    ctx.budget = 6000;
    const rest = fillRest(ctx, lengths, []);
    if (rest) return [span, ...rest];
  }
  return null;
}

// ---------- tracing: every way a word can be traced on a board ----------
/**
 * The ways `text` traces on the board's letters, as lists of cells (each step to a touching cell, no cell twice; a
 * player's trace may cross itself), at most `limit` of them, a way and its reverse counted once. `blocked`: cells that
 * can't be used (words already found).
 */
export function tracings(board, text, limit = 2, blocked = null) {
  const geo = geometry(board.shape), L = board.letters, out = [], keys = new Set(), path = [], on = new Uint8Array(geo.n);
  const go = k => {
    if (out.length >= limit) return;
    if (k === text.length) {
      const key = [...path].sort((a, b) => a - b).join(".");
      if (!keys.has(key)) { keys.add(key); out.push([...path]); }
      return;
    }
    const from = k ? geo.nbrs[path[k - 1]] : geo.nbrs.map((_, i) => i);
    for (const j of from) {
      if (on[j] || L[j] !== text[k] || blocked?.[j]) continue;
      on[j] = 1; path.push(j);
      go(k + 1);
      path.pop(); on[j] = 0;
      if (out.length >= limit) return;
    }
  };
  go(0);
  return out;
}
/**
 * How many ways the theme's words cover the board, counted up to `limit`: each word laid along one of the ways it
 * traces, none overlapping. A board is made only if this is exactly one, and every word traces exactly one way.
 */
export function countCovers(board, limit = 2) {
  const ways = board.words.map(w => tracings(board, w.text, 64));
  const order = ways.map((_, i) => i).sort((a, b) => ways[a].length - ways[b].length);
  const used = new Uint8Array(CELLS);
  let count = 0;
  const go = k => {
    if (count >= limit) return;
    if (k === order.length) { if (used.every(Boolean)) count++; return; }
    for (const way of ways[order[k]]) {
      if (way.some(i => used[i])) continue;
      for (const i of way) used[i] = 1;
      go(k + 1);
      for (const i of way) used[i] = 0;
      if (count >= limit) return;
    }
  };
  go(0);
  return count;
}

// ---------- grading ----------
// A word is as hard to find as its path is to follow and its letters are to tell apart: the times the path turns,
// the steps it takes against the reading direction (leftwards, or up), and its false starts, the traces of two or more
// of its letters a search for it would follow that aren't the word (every A beside an F, looking for FJORDS). A board
// is graded on what its words take to know (the mean difficulty of their links, 1 to 3) and to find (the mean of the
// three counts), in hundredths so every device makes the same comparisons; its grade is the two together, a quarter of
// the finding (whose counts run about four times the knowing's 1 to 3) to all of the knowing.
function findOf(board, w) {
  const geo = geometry(board.shape), cells = w.cells, text = w.text;
  let turns = 0, back = 0;
  for (let k = 1; k < cells.length; k++) {
    if (!forward(geo, cells[k - 1], cells[k])) back++;
    if (k > 1 && dirOf(geo, cells[k - 2], cells[k - 1]) !== dirOf(geo, cells[k - 1], cells[k])) turns++;
  }
  // the search tree for the word: every trace of its first letters, two letters long or more
  let nodes = 0;
  const on = new Uint8Array(geo.n), L = board.letters;
  const go = (i, k) => {
    if (k >= 1) nodes++;
    if (k + 1 >= text.length || nodes > 400) return;
    for (const j of geo.nbrs[i]) if (!on[j] && L[j] === text[k + 1]) { on[j] = 1; go(j, k + 1); on[j] = 0; }
  };
  for (let i = 0; i < geo.n; i++) if (L[i] === text[0]) { on[i] = 1; go(i, 0); on[i] = 0; }
  const lures = Math.max(0, nodes - (text.length - 1));
  return { turns, back, lures, find: turns + back + lures };
}
export function grade(board) {
  const words = board.words.map(w => findOf(board, w)), others = board.words.slice(1);
  const know = Math.round(100 * others.reduce((n, w) => n + w.d, 0) / others.length);
  const find = Math.round(100 * words.reduce((n, w) => n + w.find, 0) / words.length);
  return { know, find, score: know + Math.round(find / 4), words };
}
// A level's band of grades. The levels' word weights and path shapes already set their boards apart (graded over every
// theme, the middle Easy board is about 320, Medium 430, Hard 520: tests/lode.mjs prints the spread); the bands cut
// what still strays (an Easy board whose words happen to twist, a Hard one with nothing specialist on it), so no Easy
// board is ever graded as hard as a Hard one. A board outside its band is made again, up to a point.
export const BANDS = { easy: [0, 390], medium: [360, 480], hard: [450, 99999] };
export const outside = (g, level) => { const [lo, hi] = BANDS[level]; return g.score < lo ? lo - g.score : g.score > hi ? g.score - hi : 0; };

// ---------- the title: a clue to the theme ----------
// One of the theme's own clues that isn't on the board, as a riddle ("Awarded in its capital, unlike the other
// Nobels"): never one that names the theme, its people or another of its names, nor a word on the board. Easy's is a
// well-known link, Hard's a specialist's.
function says(text, words) {
  const toks = letters(text).split(/[^A-Z]+/).filter(Boolean);
  return words.some(w => toks.some(t => t.startsWith(w) || (w.length >= 5 && t.includes(w))));
}
function titleOf(r, t, onBoard, level) {
  const want = LEVELS[level].title, banned = [...namesOf(t), ...onBoard];
  const pool = BANK[t.i].words.filter(w => w.hint && w.hint.length <= 80 && !onBoard.includes(letters(w.w)) && !says(w.hint, banned) && !says(w.w, banned));
  if (!pool.length) return { text: `A ${t.kind}`, d: 1, word: null };
  const near = Math.min(...pool.map(w => Math.abs((w.d || 2) - want)));
  const best = pool.filter(w => Math.abs((w.d || 2) - want) === near);
  const w = best[Math.floor(r() * best.length)];
  return { text: w.hint, d: w.d || 2, word: w.w };
}

// ---------- a board ----------
/**
 * The board for a deal: { seed, theme, level, shape, mix }. Returns { seed, theme, name, kind, level, shape, letters
 * (48, row by row), words: [{ text, shown, cells, hint, d, entity }] with the spanning word first, title, grade }, or
 * null if the theme can't make one (too few words for the level, say).
 */
export function makeBoard({ seed, theme, level = "medium", shape = "square", mix = null }, stats = null) {
  const t = themeById(theme);
  if (!t || !LEVELS[level]) return null;
  const L = LEVELS[level], geo = geometry(shape === "hex" ? "hex" : "square");
  const r = seeded((seed >>> 0) ^ hashOf(`${theme}/${level}/${geo.shape}`));
  const style = { straight: L.straight, turn: L.turn };
  let best = null, bestKey = Infinity;
  for (let attempt = 0; attempt < 12; attempt++) {
    // Easy spans with the plainest name, unless its words can't fill the board around it
    const spanText = level === "easy" && attempt < 4 ? t.span[0] : t.span[Math.floor(r() * t.span.length)];
    const picked = chooseWords(r, t, level, mix, spanText);
    const paths = picked && pack(r, geo, spanText.length, picked.map(w => w.text.length), style);
    const board = paths && letter(r, geo, paths, spanText, picked, L);
    if (stats) { const k = !picked ? "words" : !paths ? "pack" : !board ? "letter" : "made"; stats[k] = (stats[k] || 0) + 1; }
    if (!board) continue;
    Object.assign(board, { seed: seed >>> 0, theme: t.id, name: t.name, kind: t.kind, level, shape: geo.shape });
    board.grade = grade(board);
    // inside the level's band first, then the fewest words that also trace a second way
    const key = outside(board.grade, level) * 10 + board.twice;
    if (key < bestKey) { best = board; bestKey = key; }
    if (bestKey === 0 || (attempt >= 1 && bestKey <= 1) || (attempt >= 3 && bestKey < 10)) break;
  }
  if (!best) return null;
  best.title = titleOf(r, t, best.words.map(w => w.text), level);
  return best;
}
// How many ways a word traces (0, 1, or 2 for more than one), kept lean for the lettering's climb below, which asks it
// thousands of times a board: letters as character codes, a way's cells as one 48-bit number (each cell a power of
// two, exact in a double), the search's state in the module rather than a closure.
const POW2 = Array.from({ length: CELLS }, (_, i) => 2 ** i);
const way = { geo: null, L: null, T: null, on: new Uint8Array(CELLS), path: new Int8Array(32), first: 0, count: 0 };
function wayStep(k) {
  const T = way.T;
  if (k === T.length) {
    let key = 0;
    for (let i = 0; i < k; i++) key += POW2[way.path[i]];
    if (!way.count) { way.first = key; way.count = 1; } else if (key !== way.first) way.count = 2;
    return;
  }
  const nb = way.geo.nbrs[way.path[k - 1]], ch = T[k];
  for (let x = 0; x < nb.length; x++) {
    const j = nb[x];
    if (way.on[j] || way.L[j] !== ch) continue;
    way.on[j] = 1; way.path[k] = j;
    wayStep(k + 1);
    way.on[j] = 0;
    if (way.count > 1) return;
  }
}
function countWays(geo, L, T) {
  way.geo = geo; way.L = L; way.T = T; way.count = 0;
  for (let i = 0; i < CELLS && way.count < 2; i++) {
    if (L[i] !== T[0]) continue;
    way.on[i] = 1; way.path[0] = i;
    wayStep(1);
    way.on[i] = 0;
  }
  return way.count;
}
/**
 * Writes the words along their paths, the spanning word on the first, and keeps the lettering only if every word then
 * traces exactly one way. A word that traces twice almost always does so at an end (BALI's I has another I beside
 * the L), which turning that word round, or a neighbour, or swapping two words of a length, puts right: so the
 * lettering is climbed towards none, a move at a time, the best move first, a move re-checking only the words beside
 * what it changed (the whole board is checked at the end). The level's reading direction breaks ties: Easy's words
 * run rightwards or down, Hard's against it.
 */
function letter(r, geo, paths, spanText, picked, { reads, lean: leanCost }) {
  const slots = [{ text: spanText, shown: spanText, hint: "", d: 1, entity: null }];
  const byLen = new Map();
  for (const w of shuffle(r, picked)) { if (!byLen.has(w.text.length)) byLen.set(w.text.length, []); byLen.get(w.text.length).push(w); }
  for (const p of paths.slice(1)) slots.push(byLen.get(p.length).pop());
  const n = paths.length, flip = new Array(n).fill(false), at = paths.map((_, k) => k);   // at[k]: the path word k is on
  const T = slots.map(w => Uint8Array.from(w.text, ch => ch.charCodeAt(0))), L = new Uint8Array(CELLS);
  const fwd = paths.map(p => p.slice(1).filter((c, k) => forward(geo, p[k], c)).length - (p.length - 1) / 2);
  const lean = k => { const f = flip[k] ? -fwd[at[k]] : fwd[at[k]]; return reads === "forward" ? (f < 0 ? 1 : 0) : reads === "back" ? (f > 0 ? 1 : 0) : 0; };
  const write = k => { const p = paths[at[k]], t = T[k]; for (let i = 0; i < p.length; i++) L[flip[k] ? p[p.length - 1 - i] : p[i]] = t[i]; };
  // paths that touch: a change to one can change how the other's word traces
  const pathOf = new Int8Array(CELLS), near = paths.map((_, k) => paths.map((__, j) => j === k));
  paths.forEach((p, k) => { for (const c of p) pathOf[c] = k; });
  paths.forEach((p, k) => { for (const c of p) for (const j of geo.nbrs[c]) near[k][pathOf[j]] = near[pathOf[j]][k] = true; });
  const bad = new Array(n).fill(false);
  const check = k => { bad[k] = countWays(geo, L, T[k]) !== 1; };
  // the spanning word's way counts four times: on Easy it outweighs a word that traces twice, which is found either way
  const cost = () => bad.reduce((s, b, k) => s + (b ? 100 : 0) + lean(k) * leanCost * (k ? 1 : 4), 0);
  const recheck = changed => { for (let k = 0; k < n; k++) if (changed.some(c => near[at[k]][c])) check(k); };
  for (let k = 0; k < n; k++) flip[k] = reads === "either" ? r() < 0.5 : lean(k) > 0 ? true : fwd[k] === 0 && r() < 0.5;
  for (let k = 0; k < n; k++) write(k);
  for (let k = 0; k < n; k++) check(k);
  const flipMove = k => () => { flip[k] = !flip[k]; write(k); recheck([at[k]]); };
  const swapMove = (a, b) => () => { [at[a], at[b]] = [at[b], at[a]]; write(a); write(b); recheck([at[a], at[b]]); };
  let now = cost();
  for (let step = 0; step < 20 && now > 0; step++) {
    // the moves worth trying: turning round a word that traces twice or one beside it, swapping one of those; once
    // none does, turning a word that reads against the level
    const hot = new Set(), sound = !bad.some(Boolean);
    for (let k = 0; k < n; k++) if (sound ? lean(k) : bad[k]) for (let j = 0; j < n; j++) if (sound ? j === k : near[at[k]][at[j]]) hot.add(j);
    const moves = [...hot].map(flipMove);
    for (const a of hot) for (let b = 1; b < n; b++) if (a > 0 && b !== a && paths[at[a]].length === paths[at[b]].length) moves.push(swapMove(a, b));
    let best = null, bestCost = now;
    for (const m of moves) {
      m();
      const c = cost();
      if (c < bestCost) { best = m; bestCost = c; }
      m();                                                      // a flip or a swap undoes itself
    }
    if (best) { best(); now = bestCost; continue; }
    if (sound || !hot.size) break;                              // only the reading left, and nothing betters it
    const pick = [...hot][Math.floor(r() * hot.size)];         // stuck: a random turn, and on
    flipMove(pick)();
    now = cost();
  }
  for (let k = 0; k < n; k++) check(k);
  const twice = bad.filter(Boolean).length;
  if (twice > MAX_TWICE) return null;
  const words = slots.map((w, k) => ({ text: w.text, shown: w.shown, hint: w.hint, d: w.d, entity: w.entity, cells: flip[k] ? [...paths[at[k]]].reverse() : [...paths[at[k]]] }));
  const board = { shape: geo.shape, letters: String.fromCharCode(...L), words, twice };
  return twice && countCovers(board, 2) !== 1 ? null : board;
}

// ---------- which theme ----------
const makeable = new Map();
/** Whether a theme can make a board at a level: some of its words, as the level weighs them, fill the board. */
export function canMake(t, level) {
  const key = `${t.id}/${level}`;
  if (!makeable.has(key)) {
    const r = seeded(hashOf(key));
    makeable.set(key, t.span.some(s => !!chooseWords(r, t, level, null, s)));
  }
  return makeable.get(key);
}
/** The themes a choice deals from: a pool (countries, commodities or both), regions and sectors left out. */
export function themesFor({ pool = "mixed", off = [], level = "medium" } = {}) {
  const kinds = POOLS[pool] || POOLS.mixed;
  return THEMES.filter(t => kinds.includes(t.kind) && !off.includes(t.group) && canMake(t, level));
}
/** The theme for a seed, from a list, passing over those dealt lately where it can. */
export function pickTheme(seed, list, avoid = []) {
  if (!list.length) return null;
  const fresh = list.filter(t => !avoid.includes(t.id)), from = fresh.length ? fresh : list;
  return from[Math.floor(seeded(seed ^ 0x51ED270B)() * from.length)].id;
}
export const SLACK = 40;              // how far outside its band a dealt board may grade (beyond that, another theme)
/**
 * A board for a deal ({ seed, level, shape, mix, theme } or, without a theme, { pool, off, avoid } to pick one): the
 * seed's theme, or, if that theme can't make a board inside the level's band (Freight's words make no Easy board),
 * the next the seed picks, and so on: the same on every device. Returns { deal (with its theme), board }, or null.
 */
export function boardFor({ seed, level = "medium", shape = "square", mix = null, theme = null, pool = "mixed", off = [], avoid = [] }) {
  if (theme) { const board = makeBoard({ seed, theme, level, shape, mix }); return board ? { deal: { seed, theme, level, shape, mix }, board } : null; }
  const list = themesFor({ pool, off, level }), passed = [...avoid];
  let best = null;
  for (let k = 0; k < 6 && list.length; k++) {
    const id = pickTheme(seed + k, list, passed), board = makeBoard({ seed, theme: id, level, shape, mix });
    passed.push(id);
    if (!board) continue;
    const o = outside(board.grade, level);
    if (!best || o < best.o) best = { deal: { seed, theme: id, level, shape, mix }, board, o };
    if (o <= SLACK) break;
  }
  return best && { deal: best.deal, board: best.board };
}
/** Today's deal, the same for everyone (day: YYYYMMDD): Medium, square, every theme, every topic, nobody's settings. */
export const dailyDeal = day => ({ seed: day, level: "medium", shape: "square", mix: null, pool: "mixed" });

// ---------- a run: one player's progress on a board ----------
// found and revealed are the words' places in board.words (0, the spanning word); extra, the other words found, for
// hints; meter counts them towards the next hint, charges the hints in hand, hints those used; hint is the word a hint
// is showing ({ w, step }: 1 its letters lit, 2 numbered in order); hinted every word a hint showed.
export const newRun = () => ({ found: [], extra: [], meter: 0, charges: 0, hints: 0, hint: null, hinted: [], revealed: [], ms: 0, done: false, gaveUp: false });
/** A run read back from storage or the database (lists may come back missing), made whole; changes it, and returns it. */
export function tidyRun(run) {
  const list = x => Object.values(x || {}).filter(v => v != null);
  run.found = list(run.found).map(Number); run.extra = list(run.extra).map(String); run.hinted = list(run.hinted).map(Number); run.revealed = list(run.revealed).map(Number);
  run.meter = run.meter || 0; run.charges = run.charges || 0; run.hints = run.hints || 0; run.ms = run.ms || 0;
  run.hint = run.hint && Number.isInteger(run.hint.w) ? { w: run.hint.w, step: run.hint.step === 2 ? 2 : 1 } : null;
  run.done = !!run.done; run.gaveUp = !!run.gaveUp;
  return run;
}
/** The cells of words found or shown: they can't be traced again. */
export function lockedCells(board, run) {
  const out = new Uint8Array(CELLS);
  for (const w of [...run.found, ...run.revealed]) for (const c of board.words[w].cells) out[c] = 1;
  return out;
}
const sameCells = (a, b) => a.length === b.length && [...a].sort((x, y) => x - y).join() === [...b].sort((x, y) => x - y).join();
/** Whether `cells` is a trace a finger could make: touching cells, none twice, none locked. */
export function traceable(board, run, cells) {
  const geo = geometry(board.shape), locked = lockedCells(board, run);
  return cells.length > 0 && new Set(cells).size === cells.length && cells.every((c, k) => c >= 0 && c < CELLS && !locked[c] && (!k || geo.touch[cells[k - 1]].has(c)));
}
/**
 * A trace submitted (the run changes): { kind, text, w, moved }. kind: "span" or "theme" (a word of the board, w its
 * place), "again" (found already), "word" (another English word, towards a hint; earned: true when it completes one),
 * "had" (that word again), "short" (under four letters), "not" (no word), "bad" (not a trace), "done" (the board is
 * over). A theme word traced through other letters than its own (a twin letter beside its end) is found all the same,
 * on its own cells, the words' one cover of the board: moved says so, for the page to show where it runs.
 */
export function submit(board, run, cells) {
  if (run.done) return { kind: "done" };
  if (!traceable(board, run, cells)) return { kind: "bad" };
  const text = cells.map(c => board.letters[c]).join("");
  const w = board.words.findIndex(x => x.text === text);
  if (w >= 0) {
    if (run.found.includes(w) || run.revealed.includes(w)) return { kind: "again", text, w };
    run.found.push(w);
    if (run.hint?.w === w) run.hint = null;
    if (run.found.length + run.revealed.length >= board.words.length) run.done = true;
    return { kind: w === 0 ? "span" : "theme", text, w, moved: !sameCells(board.words[w].cells, cells) };
  }
  if (text.length < MIN_WORD) return { kind: "short", text };
  if (!isWord(text)) return { kind: "not", text };
  if (run.extra.includes(text)) return { kind: "had", text };
  run.extra.push(text);
  if (++run.meter >= PER_HINT) { run.meter = 0; run.charges++; return { kind: "word", text, earned: true }; }
  return { kind: "word", text };
}
const open = (run, i) => !run.found.includes(i) && !run.revealed.includes(i);
/** The word a fresh hint shows: the hardest still to find (the most specialist link, then the hardest to find); the
 *  spanning word only when it's all that's left. */
export function hintTarget(board, run) {
  const left = board.words.map((_, i) => i).filter(i => open(run, i));
  const pool = left.filter(i => i !== 0).length ? left.filter(i => i !== 0) : left;
  const g = board.grade?.words;
  return pool.sort((a, b) => board.words[b].d - board.words[a].d || (g ? g[b].find - g[a].find : 0) || a - b)[0] ?? null;
}
/** Uses a hint in hand (the run changes): lights a word's letters, or, while one is lit, numbers them. null if none. */
export function useHint(board, run) {
  if (run.done || run.charges <= 0) return null;
  if (run.hint && open(run, run.hint.w) && run.hint.step === 1) run.hint = { w: run.hint.w, step: 2 };
  else {
    const w = hintTarget(board, run);
    if (w == null) return null;
    run.hint = { w, step: 1 };
    if (!run.hinted.includes(w)) run.hinted.push(w);
  }
  run.charges--;
  run.hints++;
  return run.hint;
}
/** Gives up: every word still hidden is shown, at SHOW_COST each. */
export function giveUp(board, run) {
  if (run.done) return false;
  run.revealed = board.words.map((_, i) => i).filter(i => open(run, i));
  run.hint = null;
  run.done = true;
  run.gaveUp = true;
  return true;
}
/** The score: seconds on the clock, HINT_COST a hint and SHOW_COST a word shown. Lower is better. */
export const scoreOf = run => Math.round((run.ms || 0) / 1000) + HINT_COST * (run.hints || 0) + SHOW_COST * (run.revealed?.length || 0);
/** The words a run needed help with, which go to the pile: those a hint showed and those shown at the end. */
export const missesOf = (board, run) => board.words.map((_, i) => i).filter(i => i > 0 && (run.hinted.includes(i) || run.revealed.includes(i)));

// ---------- the computer: a rival that finds words at a person's pace ----------
// It takes the words in the order a person would: the best-known and easiest to find first, the spanning word once a
// few are in (the theme is clear by then), the last two quicker, as the board left narrows them down. Each word takes
// the level's pace, longer for a specialist link and a path that's hard to follow, give or take a fifth. Its plan is
// made from the board's seed, so every phone at a table sees the same rival.
export const RIVALS = {
  steady: { label: "Steady", per: 48000 },
  sharp: { label: "Sharp", per: 31000 },
  ace: { label: "Ace", per: 18000 },
};
/** When the rival finds each word: [{ w, at }] (ms from the start), in the order it finds them. */
export function rivalPlan(board, level) {
  const R = RIVALS[level];
  if (!R) return [];
  const r = seeded(board.seed ^ hashOf(`rival/${level}`)), g = board.grade.words;
  const ease = i => board.words[i].d * 4 + g[i].find;
  const rest = board.words.map((_, i) => i).filter(i => i > 0).sort((a, b) => ease(a) - ease(b) || a - b);
  const order = [...rest];
  order.splice(Math.min(2, order.length), 0, 0);              // the spanning word, once the theme is plain
  let at = 0;
  return order.map((i, k) => {
    const left = order.length - k;
    const know = i === 0 ? 0.8 : 0.55 + 0.2 * board.words[i].d, follow = 0.8 + g[i].find / (g[i].find + 10) * 0.6;
    at += Math.round(R.per * know * follow * (0.8 + 0.4 * r()) * (left <= 2 ? 0.6 : 1));
    return { w: i, at };
  });
}
/** How many words the rival has by `ms` into the board, and whether it has them all. */
export function rivalAt(plan, ms) {
  const n = plan.filter(p => p.at <= ms).length;
  return { found: n, done: plan.length > 0 && n === plan.length, at: plan.length ? plan[plan.length - 1].at : 0 };
}

// ---------- together: the letters shared out ----------
/**
 * Who holds each letter when a table plays one board as a team, k of them: the t-th letter of the j-th word goes to
 * seat (t + j) mod k, so every word runs through every seat's hands (each sees one letter in k of every word, and no
 * word of four or more letters can be read alone), and each seat holds a k-th of the board, give or take a letter
 * a word. Returns the seat for each cell.
 */
export function shares(board, k) {
  const out = new Array(CELLS).fill(0);
  if (k < 2) return out;
  board.words.forEach((w, j) => w.cells.forEach((c, t) => { out[c] = (t + j) % k; }));
  return out;
}
