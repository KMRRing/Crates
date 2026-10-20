// Nonogram's rules and its solver, pure (no page): a grid hides a picture, and each row and column carries its clue,
// the runs of filled cells along it in order ("3 1 2": three filled, a gap, one, a gap, two). In colour (the flags)
// every run has its colour too: two runs of different colours may touch, two of the same colour need a gap. Colour 0
// is the background, the blank. nonogram-pictures.js makes the pictures and proves each has one answer with this;
// the page (nonogram.js) draws it; tests/nonogram.mjs checks it.
//
// While solving, a cell is a bit mask of the colours it may still be: bit 0 the blank, bit c colour c; it is known
// when one bit is left. Lines are numbered rows first (0 … h-1), then columns (h … h+w-1).

export const BG = 0;

// ---------- the clues ----------
/** The runs of a line of colour indices: [[length, colour], …]. */
export function runsOf(line) {
  const out = [];
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (!c) continue;
    if (i > 0 && line[i - 1] === c) out[out.length - 1][0]++;
    else out.push([1, c]);
  }
  return out;
}
const LINES = new Map();
/** The cell numbers of every line of a w×h grid, rows first: [[i, …], …]. */
export function linesOf(w, h) {
  const key = `${w}x${h}`;
  if (!LINES.has(key)) {
    const out = [];
    for (let r = 0; r < h; r++) out.push(Array.from({ length: w }, (_, c) => r * w + c));
    for (let c = 0; c < w; c++) out.push(Array.from({ length: h }, (_, r) => r * w + c));
    LINES.set(key, out);
  }
  return LINES.get(key);
}
/** Every line's runs, rows first: the puzzle's clues. */
export const cluesOf = (w, h, cells) => linesOf(w, h).map(l => runsOf(l.map(i => cells[i])));
/** The two lines through a cell: its row and its column. */
export const linesThrough = (w, h, i) => [Math.floor(i / w), h + (i % w)];

export const fullMask = colours => (1 << (colours + 1)) - 1;
export const isKnown = m => m !== 0 && (m & (m - 1)) === 0;
export const colourOf = m => 31 - Math.clz32(m);          // a known cell's colour
const bits = m => { let n = 0; for (; m; m &= m - 1) n++; return n; };

// ---------- one line ----------
// The line solver's tables, kept between calls and grown as needed: probing a hard puzzle solves lines tens of
// thousands of times. F[j·W + i]: the first i cells can hold the first j runs (blanks after them); G[j·W + i]: the
// cells from i on can hold runs j onward (blanks before them). COUNT[c·W + i]: how many of the first i cells may be
// colour c (0 the blank).
let F = new Uint8Array(64), G = new Uint8Array(64), COUNT = new Int32Array(64), DIFF = new Int32Array(64);
let line = null, clue = null, W = 0;

/** Fills the tables for a line (its masks a, its runs); false if no arrangement fits it. */
function tables(a, runs) {
  const n = a.length, k = runs.length;
  W = n + 1; line = a; clue = runs;
  let top = 0;
  for (const [, c] of runs) if (c > top) top = c;
  if (F.length < (k + 1) * W) { F = new Uint8Array((k + 1) * W * 2); G = new Uint8Array((k + 1) * W * 2); }
  if (COUNT.length < (top + 1) * W) COUNT = new Int32Array((top + 1) * W * 2);
  if (DIFF.length < W) DIFF = new Int32Array(W * 2);
  for (let c = 0; c <= top; c++) {
    const b = c * W;
    COUNT[b] = 0;
    for (let i = 0; i < n; i++) COUNT[b + i + 1] = COUNT[b + i] + ((a[i] >> c) & 1);
  }
  for (let i = 0; i <= n; i++) F[i] = COUNT[i] === i ? 1 : 0;
  for (let j = 1; j <= k; j++) {
    const L = runs[j - 1][0], c = runs[j - 1][1], row = j * W;
    for (let i = 0; i <= n; i++) F[row + i] = (i > 0 && (a[i - 1] & 1) && F[row + i - 1]) || (i >= L && fits(i - L, L, c) && before(j - 1, i - L)) ? 1 : 0;
  }
  if (!F[k * W + n]) return false;
  for (let i = 0; i <= n; i++) G[k * W + i] = COUNT[n] - COUNT[i] === n - i ? 1 : 0;
  for (let j = k - 1; j >= 0; j--) {
    const L = runs[j][0], c = runs[j][1], row = j * W;
    for (let i = n; i >= 0; i--) G[row + i] = (i < n && (a[i] & 1) && G[row + i + 1]) || (i + L <= n && fits(i, L, c) && after(j, i + L)) ? 1 : 0;
  }
  return true;
}
/** Run j's cells may all take its colour from s. */
const fits = (s, L, c) => COUNT[c * W + s + L] - COUNT[c * W + s] === L;
/** The runs before run j fit in the cells before s, with a blank between when the last of them has run j's colour. */
function before(j, s) {
  if (j === 0) return F[s] === 1;
  if (clue[j - 1][1] !== clue[j][1]) return F[j * W + s] === 1;
  return s > 0 && (line[s - 1] & 1) === 1 && F[j * W + s - 1] === 1;
}
/** The runs after run j fit in the cells from e on, with a blank between when the first of them has run j's colour. */
function after(j, e) {
  const k = clue.length;
  if (j === k - 1) return G[k * W + e] === 1;
  if (clue[j + 1][1] !== clue[j][1]) return G[(j + 1) * W + e] === 1;
  return e < line.length && (line[e] & 1) === 1 && G[(j + 1) * W + e + 1] === 1;
}

/**
 * The complete line logic: every cell's mask cut to the colours some arrangement of the runs that fits what is known
 * gives it (nothing this line alone can say is missed), as a new array; null if no arrangement fits. a: the line's
 * masks; runs: its clue.
 */
export function settle(a, runs) {
  if (!tables(a, runs)) return null;
  const n = a.length, k = runs.length, out = new Uint8Array(n);
  for (let x = 0; x < n; x++) {                                   // a blank at x: j runs before it, the rest after
    if (!(a[x] & 1)) continue;
    for (let j = 0; j <= k; j++) if (F[j * W + x] && G[j * W + x + 1]) { out[x] = 1; break; }
  }
  for (let j = 0; j < k; j++) {                                   // run j where it fits with the others round it
    const L = runs[j][0], c = runs[j][1];
    DIFF.fill(0, 0, n + 1);
    for (let s = 0; s + L <= n; s++) if (fits(s, L, c) && before(j, s) && after(j, s + L)) { DIFF[s]++; DIFF[s + L]--; }
    for (let x = 0, on = 0; x < n; x++) { on += DIFF[x]; if (on > 0) out[x] |= 1 << c; }
  }
  for (let x = 0; x < n; x++) if (!out[x]) return null;
  return out;
}

/**
 * Where each run can lie: the arrangement with every run pushed as far left as it will go, and as far right
 * ({ left: [start…], right: [start…] }), respecting what is known; null if none fits. Every arrangement has run j
 * starting between left[j] and right[j].
 */
export function pushes(a, runs) {
  if (!tables(a, runs)) return null;
  const n = a.length, k = runs.length, left = [], right = new Array(k);
  for (let j = 0, from = 0; j < k; j++) {
    const [L, c] = runs[j];
    let s = from + (j > 0 && runs[j - 1][1] === c ? 1 : 0);
    while (!(fits(s, L, c) && after(j, s + L))) {
      if (!(a[s] & 1)) return null;                               // a cell that can't be blank stops the push
      s++;
      if (s + L > n) return null;
    }
    for (let x = from; x < s; x++) if (!(a[x] & 1)) return null;
    left.push(s);
    from = s + L;
  }
  for (let j = k - 1, to = n; j >= 0; j--) {
    const [L, c] = runs[j];
    let e = to - (j < k - 1 && runs[j + 1][1] === c ? 1 : 0);
    while (!(e - L >= 0 && fits(e - L, L, c) && before(j, e - L))) {
      if (!(a[e - 1] & 1)) return null;
      e--;
      if (e - L < 0) return null;
    }
    for (let x = e; x < to; x++) if (!(a[x] & 1)) return null;
    right[j] = e - L;
    to = e - L;
  }
  return { left, right };
}

/**
 * The simple rules a person starts with: push the runs left and right (pushes); a cell inside the same run both ways
 * is that run's colour (the overlap), a cell no run can reach is blank, and a cell can only be the colour of a run that
 * reaches it. A line whose runs are all placed fills the rest with blanks; a known cell near an edge pins its run.
 * Weaker than settle(): it never strikes off a colour settle() would keep. Returns the new masks, or null on a
 * contradiction.
 */
export function overlap(a, runs) {
  const p = pushes(a, runs);
  if (!p) return null;
  const n = a.length, k = runs.length, out = new Uint8Array(n);
  for (let x = 0; x < n; x++) out[x] = a[x] & 1;                 // the blank, until a run's reach says otherwise
  const reach = new Uint8Array(n);
  for (let j = 0; j < k; j++) {
    const [L, c] = runs[j];
    for (let x = p.left[j]; x < p.right[j] + L; x++) { out[x] |= (a[x] >> c & 1) << c; reach[x] = 1; }
  }
  for (let x = 0; x < n; x++) if (!reach[x]) out[x] = a[x] & 1;
  for (let j = 0; j < k; j++) {                                   // the overlap: covered by run j however it's pushed
    const [L, c] = runs[j];
    for (let x = p.right[j]; x < p.left[j] + L; x++) out[x] = 1 << c;
  }
  for (let x = 0; x < n; x++) { out[x] &= a[x]; if (!out[x]) return null; }
  return out;
}

// ---------- the grid ----------
/** A puzzle as the solver takes it: { w, h, colours (how many besides the blank), clues (cluesOf) }. */
export const unknownState = p => new Uint8Array(p.w * p.h).fill(fullMask(p.colours));
export const solved = st => st.every(isKnown);
export const knownCount = st => st.reduce((n, m) => n + (isKnown(m) ? 1 : 0), 0);
/** The cells a solved state shows, as colour indices. */
export const cellsOfState = st => Array.from(st, colourOf);

/** A line's masks as the state has them. */
const masksOf = (st, cells) => { const a = new Uint8Array(cells.length); for (let x = 0; x < cells.length; x++) a[x] = st[cells[x]]; return a; };

/**
 * Applies a line rule until no line says more: changes `st` in place and returns the cells it settled, in the order
 * they were settled, or null on a contradiction. start: the lines to look at first (every line by default); a line is
 * looked at again whenever a cell on it changes. A line with every cell known is still checked against its clue.
 * allow(k): whether line k's clue may be used (a player who sees only the rows reasons only along them).
 */
export function propagate(p, st, rule = settle, start = null, allow = null) {
  const L = linesOf(p.w, p.h), queued = new Uint8Array(L.length), queue = [], settled = [];
  for (const k of start ?? L.keys()) if (!queued[k] && (!allow || allow(k))) { queued[k] = 1; queue.push(k); }
  for (let q = 0; q < queue.length; q++) {
    const k = queue[q];
    queued[k] = 0;
    const cells = L[k], a = masksOf(st, cells);
    const got = a.every(isKnown) ? settle(a, p.clues[k]) : rule(a, p.clues[k]);
    if (!got) return null;
    for (let x = 0; x < cells.length; x++) {
      if (got[x] === a[x]) continue;
      const i = cells[x];
      st[i] = got[x];
      if (isKnown(st[i])) settled.push(i);
      for (const m of linesThrough(p.w, p.h, i)) if (m !== k && !queued[m] && (!allow || allow(m))) { queued[m] = 1; queue.push(m); }
    }
  }
  return settled;
}

/**
 * The first line on which `rule` says something new, in order: { line, cells: [cell whose mask it cut…], settled:
 * [cell it made known…] } with `st` changed; null if no line does; false on a contradiction. order: the lines to look
 * at, in turn. (In colour a rule can strike a colour off a cell without settling it, and that counts: the simple rules
 * may then go on.)
 */
export function stepLine(p, st, rule = settle, order = null) {
  const L = linesOf(p.w, p.h);
  for (const k of order ?? L.keys()) {
    const cells = L[k], a = masksOf(st, cells);
    if (a.every(isKnown)) continue;
    const got = rule(a, p.clues[k]);
    if (!got) return false;
    const cut = [], settled = [];
    for (let x = 0; x < cells.length; x++) {
      if (got[x] === a[x]) continue;
      st[cells[x]] = got[x];
      cut.push(cells[x]);
      if (isKnown(got[x])) settled.push(cells[x]);
    }
    if (cut.length) return { line: k, cells: cut, settled };
  }
  return null;
}

/** The open cells, those whose row and column are most settled first: where a supposition is likeliest to clash soon
 *  (and where a person would look). */
function constrained(p, st) {
  const L = linesOf(p.w, p.h), known = L.map(cells => cells.reduce((n, i) => n + (isKnown(st[i]) ? 1 : 0), 0) / cells.length);
  const open = [];
  for (let i = 0; i < st.length; i++) if (!isKnown(st[i])) { const [r, c] = linesThrough(p.w, p.h, i); open.push([i, known[r] + known[c]]); }
  return open.sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(([i]) => i);
}

/**
 * Looking ahead, the contradiction: suppose an open cell is one of its colours and follow the complete line logic; if
 * that ends in a clash, the cell can't be that colour. Returns { cell, colour (struck off) } with `st` changed, or null
 * if no supposition clashes. order: the cells to try, in turn (every open cell by default).
 */
export function contradiction(p, st, order = null, allow = null) {
  for (const i of order ?? constrained(p, st)) {
    const m = st[i];
    if (isKnown(m)) continue;
    for (let c = 0; c <= p.colours; c++) {
      if (!((m >> c) & 1)) continue;
      const trial = Uint8Array.from(st);
      trial[i] = 1 << c;
      if (propagate(p, trial, settle, linesThrough(p.w, p.h, i), allow) !== null) continue;
      st[i] = m & ~(1 << c);
      return { cell: i, colour: c };
    }
  }
  return null;
}

/** The most contradictions a puzzle may need: one that needs more is a slog no one would enjoy, and isn't dealt. */
export const PROBES = 30;

/**
 * How a person would solve it, the simplest way first: the simple rules on every line until they say no more, then the
 * complete line logic on one line, then a contradiction; each time a harder rule settles something, back to the simple
 * ones. Returns { solved, st, level, simple, line, probes, rounds }: level 1 when the simple rules alone finish it, 2
 * when it needs the complete line logic, 3 when it needs a contradiction, 4 when even that gets stuck (it would need a
 * guess, or has more than one answer), 0 when the clues contradict themselves; simple: the cells the simple rules
 * settled; line, probes: how many times each harder rule was needed; rounds: how many times the simple rules started
 * again.
 */
export function grade(p, { probeLimit = PROBES } = {}) {
  const st = unknownState(p);
  let simple = 0, line = 0, probes = 0, rounds = 0;
  const out = level => ({ solved: level > 0 && level < 4, st, level, simple, line, probes, rounds });
  for (;;) {
    rounds++;
    const a = propagate(p, st, overlap);
    if (a === null) return out(0);
    simple += a.length;
    if (solved(st)) return out(probes ? 3 : line ? 2 : 1);
    const b = stepLine(p, st, settle);
    if (b === false) return out(0);
    if (b) { line++; continue; }
    if (probes >= probeLimit) return out(4);
    if (!contradiction(p, st)) return out(4);
    probes++;
  }
}

/**
 * How far the line reasoning has to reach: rounds in which every line is worked from what the round before settled
 * (as two people taking turns at the rows and the columns would), until nothing more follows. A puzzle whose first
 * round settles most of it is shallow; one whose cells come one round at a time, each from the last, is deep. Returns
 * { depth, first (the share of cells the clues alone settle), solved }.
 */
export function depthOf(p, rule = settle) {
  const st = unknownState(p), L = linesOf(p.w, p.h);
  let depth = 0, first = 0;
  for (;;) {
    const next = Uint8Array.from(st);
    for (let k = 0; k < L.length; k++) {
      const got = rule(masksOf(st, L[k]), p.clues[k]);
      if (!got) return { depth, first, solved: false };
      for (let x = 0; x < L[k].length; x++) next[L[k][x]] &= got[x];
    }
    if (next.every((m, i) => m === st[i])) break;
    st.set(next);
    depth++;
    if (depth === 1) first = knownCount(st) / st.length;
  }
  return { depth, first, solved: solved(st) };
}

/**
 * How many answers the clues allow, up to `limit` (two tells one from several): the complete line logic, then a guess
 * on an open cell, each way followed. Returns { count, found: [state…], nodes, gaveUp } (gaveUp: the search passed
 * maxNodes before it could tell). from: a state to start from.
 */
export function countSolutions(p, { limit = 2, maxNodes = 20000, from = null } = {}) {
  const found = [];
  let nodes = 0, gaveUp = false;
  (function go(st) {
    if (found.length >= limit || gaveUp) return;
    if (++nodes > maxNodes) { gaveUp = true; return; }
    if (propagate(p, st, settle) === null) return;
    let pick = -1, few = 99;
    for (let i = 0; i < st.length; i++) {
      if (isKnown(st[i])) continue;
      const b = bits(st[i]);
      if (b < few) { few = b; pick = i; if (b === 2) break; }
    }
    if (pick < 0) { found.push(st); return; }
    for (let c = 0; c <= p.colours && found.length < limit && !gaveUp; c++) {
      if (!((st[pick] >> c) & 1)) continue;
      const next = Uint8Array.from(st);
      next[pick] = 1 << c;
      go(next);
    }
  })(from ? Uint8Array.from(from) : unknownState(p));
  return { count: found.length, found, nodes, gaveUp };
}

// ---------- the next step, for a hint or the computer ----------
/**
 * The easiest thing to see next, the way a person looks for it: the line where the simple rules settle the most
 * cells, else the line where the complete line logic does, else a contradiction. `st` (what is known) takes in what
 * it works out, the cells it settles too; colours struck off without a cell settled are kept quietly, as a person
 * keeps them in mind. allow(k): the lines whose clues may be used (in a split game, a player's own). Returns { rule:
 * "simple" | "line" | "contradiction", line, cells: [[cell, colour]…] (colour 0: blank) }, or null when nothing more
 * follows from those lines.
 */
export function nextStep(p, st, allow = null) {
  const L = linesOf(p.w, p.h);
  for (let again = 0; again < 50; again++) {
    let narrowed = false;
    for (const [rule, name] of [[overlap, "simple"], [settle, "line"]]) {
      let best = null;
      for (let k = 0; k < L.length; k++) {
        if (allow && !allow(k)) continue;
        const a = masksOf(st, L[k]);
        if (a.every(isKnown)) continue;
        const got = rule(a, p.clues[k]);
        if (!got) return null;
        const cells = [];
        for (let x = 0; x < a.length; x++) {
          if (got[x] === a[x]) continue;
          if (isKnown(got[x])) cells.push([L[k][x], colourOf(got[x])]);
          else { st[L[k][x]] = got[x]; narrowed = true; }
        }
        if (cells.length && (!best || cells.length > best.cells.length)) best = { rule: name, line: k, cells };
      }
      if (best) { for (const [i, c] of best.cells) st[i] = 1 << c; return best; }
    }
    if (narrowed) continue;                                     // what was struck off may let a line settle a cell
    const hit = contradiction(p, st, null, allow);
    if (!hit) return null;
    if (isKnown(st[hit.cell])) return { rule: "contradiction", line: linesThrough(p.w, p.h, hit.cell)[0], cells: [[hit.cell, colourOf(st[hit.cell])]] };
  }
  return null;
}

// ---------- a player's grid ----------
// The grid as the page keeps it: one character a cell, "." empty, "x" crossed out (blank for sure), "1"… a colour.
export const EMPTY = 0, CROSS = -1;
export const emptyGrid = p => ".".repeat(p.w * p.h);
export const cellAt = (grid, i) => (grid[i] === "." ? EMPTY : grid[i] === "x" ? CROSS : Number(grid[i]));
export const withCell = (grid, i, v) => grid.slice(0, i) + (v === EMPTY ? "." : v === CROSS ? "x" : String(v)) + grid.slice(i + 1);

/** What a grid says for sure, as solver masks: a filled cell its colour, a crossed one blank. Where an answer is given,
 *  a cell that disagrees with it is left open, so a hint never builds on a mistake. */
export function knownFrom(p, grid, answer = null) {
  const st = unknownState(p);
  for (let i = 0; i < st.length; i++) {
    const v = cellAt(grid, i), c = v === CROSS ? 0 : v;
    if (v === EMPTY || (answer && answer[i] !== c)) continue;
    st[i] = 1 << c;
  }
  return st;
}
/** The cells of a grid that disagree with the answer: filled where it's blank, crossed where it's filled, or the wrong colour. */
export const wrongCells = (grid, answer) => [...answer.keys()].filter(i => { const v = cellAt(grid, i); return v !== EMPTY && (v === CROSS ? answer[i] !== 0 : answer[i] !== v); });
/** Whether every row and column agrees with its clue (crossed cells counting as blank): the puzzle done, by its clues alone. */
export function agrees(p, grid) {
  return linesOf(p.w, p.h).every((cells, k) => {
    const runs = runsOf(cells.map(i => Math.max(0, cellAt(grid, i)))), clue = p.clues[k];
    return runs.length === clue.length && runs.every((r, j) => r[0] === clue[j][0] && r[1] === clue[j][1]);
  });
}
/** How much of the picture is drawn: the share of its filled cells filled with their colour. */
export function drawn(grid, answer) {
  let n = 0, of = 0;
  for (let i = 0; i < answer.length; i++) if (answer[i]) { of++; if (cellAt(grid, i) === answer[i]) n++; }
  return of ? n / of : 1;
}
/** Whether a line's filled cells already make its clue (its numbers can be greyed). */
export function lineDone(p, grid, k) {
  const cells = linesOf(p.w, p.h)[k], runs = runsOf(cells.map(i => Math.max(0, cellAt(grid, i)))), clue = p.clues[k];
  return runs.length === clue.length && runs.every((r, j) => r[0] === clue[j][0] && r[1] === clue[j][1]);
}

// ---------- scoring ----------
export const MISTAKE = 20;     // seconds added for a mistake, where mistakes are shown
export const HINT = 30;        // and for a hint
export const WRONG_NAME = 30;  // and for naming the picture wrong before it's finished
/** Naming it right before it's finished takes off up to this many seconds, in proportion to how much was still hidden. */
export const CREDIT = { small: 30, medium: 60, large: 120 };
/** The seconds a name early takes off: the size's credit times the share of the picture not yet drawn. */
export const creditFor = (size, hidden) => Math.round((CREDIT[size] ?? CREDIT.medium) * Math.max(0, Math.min(1, hidden)));
/**
 * A run's score, lower better: seconds on the clock, plus the penalties, less the credit for naming it early. run: {
 * ms, mistakes, hints, name: { early, right, credit } | null }.
 */
export function scoreOf(run) {
  const n = run.name, name = n?.early ? (n.right ? -(n.credit || 0) : WRONG_NAME) : 0;
  return Math.round((run.ms || 0) / 1000) + MISTAKE * (run.mistakes || 0) + HINT * (run.hints || 0) + name;
}

// ---------- the clues split between players ----------
/**
 * Who reads line k when the clues are split between the seats at a table (seats: the seat numbers there, any order):
 * one alone reads every line; two, the rows to the first and the columns to the second (the classic split, easy to
 * talk about: "my row 3 is 2 5"); more, the rows dealt round the table and the columns round it one seat on, so each
 * has some of both. h: the rows the puzzle has.
 */
export function ownerOf(k, h, seats) {
  const s = [...seats].sort((a, b) => a - b);
  if (s.length < 2) return s[0] ?? 0;
  if (s.length === 2) return k < h ? s[0] : s[1];
  return k < h ? s[k % s.length] : s[(k - h + 1) % s.length];
}
