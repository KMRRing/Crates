// Four in a row's board: seven columns, six high, discs dropped into a column to rest on the one below. A game is the columns
// played, in order, as a string of digits ("33442"): the first mover's disc, the second's, and so on, so the position
// is always the move list and nothing else, and a reader can replay it. Pure and plain, no DOM; the solver
// (silo-solver.js) works on bitboards made from the same string.
//
// Cells are (c, r): column 0..6 from the left, row 0..5 from the bottom. A disc is 1 (the first mover's) or 2.
export const W = 7, H = 6, N = W * H;
/** The columns from the middle out: the order everything is tried and ties are broken in. */
export const ORDER = [3, 2, 4, 1, 5, 0, 6];
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

/** The columns of a move string, as numbers. */
export const colsOf = moves => Array.from(moves || "", ch => ch.charCodeAt(0) - 48);

/** A position replayed: grid[c * H + r] (0 empty, 1 the first mover's disc, 2 the second's), the height of each
 *  column, the cell of the last disc. */
export function replay(moves) {
  const grid = new Int8Array(N), height = new Int8Array(W);
  let last = null, k = 0;
  for (const c of colsOf(moves)) {
    if (!(c >= 0 && c < W) || height[c] >= H) throw new Error(`bad move ${c} at ${k}`);
    grid[c * H + height[c]] = 1 + (k & 1);
    last = [c, height[c]];
    height[c]++;
    k++;
  }
  return { grid, height, n: k, last };
}

/** The move string with a disc dropped in column c, or null if the column is full or isn't one. */
export function drop(moves, c) {
  if (!Number.isInteger(c) || c < 0 || c >= W) return null;
  let h = 0;
  for (const x of moves) if (x.charCodeAt(0) - 48 === c) h++;
  return h >= H ? null : moves + c;
}

/** The columns with room, middle out. */
export function legal(moves) {
  const h = new Int8Array(W);
  for (const x of moves) h[x.charCodeAt(0) - 48]++;
  return ORDER.filter(c => h[c] < H);
}

/** Every cell in a run of four or more through (c, r), for the disc there: [] when it makes none. */
export function runsThrough(grid, c, r) {
  const who = grid[c * H + r];
  if (!who) return [];
  const cells = new Map();
  for (const [dc, dr] of DIRS) {
    const line = [[c, r]];
    for (const s of [1, -1]) {
      for (let x = c + s * dc, y = r + s * dr; x >= 0 && x < W && y >= 0 && y < H && grid[x * H + y] === who; x += s * dc, y += s * dr) line.push([x, y]);
    }
    if (line.length >= 4) for (const [x, y] of line) cells.set(x * H + y, [x, y]);
  }
  return [...cells.values()].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

/**
 * Where a game stands: { over, winner (1 or 2: the first or the second mover's disc; 0 for none or a draw), draw,
 * line (the cells of the four, or of all of a longer run) }. The game ends the moment a four is made, so only the
 * last disc can have made one.
 */
export function outcome(moves) {
  const { grid, n, last } = replay(moves);
  if (last) {
    const line = runsThrough(grid, last[0], last[1]);
    if (line.length) return { over: true, winner: grid[last[0] * H + last[1]], draw: false, line };
  }
  if (n >= N) return { over: true, winner: 0, draw: true, line: [] };
  return { over: false, winner: 0, draw: false, line: [] };
}

/** The disc (1 or 2) that moves next. */
export const moverAt = n => 1 + (n & 1);

/** The position as rows of text, top row first ("." empty, "x" the first mover's, "o" the second's): for the tests
 *  and the course, which write positions the way a reader draws them. */
export function toText(moves) {
  const { grid } = replay(moves), rows = [];
  for (let r = H - 1; r >= 0; r--) {
    let row = "";
    for (let c = 0; c < W; c++) row += ".xo"[grid[c * H + r]];
    rows.push(row);
  }
  return rows.join("\n");
}

/**
 * A move string for a position drawn as text (rows top first, 6 rows of 7; "x" the first mover's, "o" the second's,
 * "." empty), or null if no order of play makes it: the discs of each column are the order they were dropped in, and
 * the two sides alternate, so the order is found by placing, at each step, a disc the mover owns at the bottom of
 * some column's remaining discs (a small search, since the board fills only so far).
 */
export function fromText(text) {
  const rows = String(text).trim().split(/\s*\n\s*/);
  if (rows.length !== H || rows.some(r => r.length !== W)) return null;
  const cols = Array.from({ length: W }, (_, c) => {
    let s = "";
    for (let r = H - 1; r >= 0; r--) if (rows[r][c] !== ".") s += rows[r][c];
    return s;
  });
  if (cols.some(s => !/^[xo]*$/.test(s))) return null;
  // gravity: no gap under a disc
  for (let c = 0; c < W; c++) {
    let seenEmpty = false;
    for (let r = 0; r < H; r++) {
      const ch = rows[H - 1 - r][c];
      if (ch === ".") seenEmpty = true; else if (seenEmpty) return null;
    }
  }
  const total = cols.reduce((a, s) => a + s.length, 0), xs = cols.join("").split("x").length - 1;
  if (xs !== Math.ceil(total / 2)) return null;
  const at = new Int8Array(W), memo = new Set();
  function go(k, out) {
    if (k === total) return out;
    const key = `${at.join("")}`;
    if (memo.has(key)) return null;
    const want = k & 1 ? "o" : "x";
    for (let c = 0; c < W; c++) {
      if (at[c] < cols[c].length && cols[c][at[c]] === want) {
        at[c]++;
        const r = go(k + 1, out + c);
        at[c]--;
        if (r) return r;
      }
    }
    memo.add(key);
    return null;
  }
  return go(0, "");
}
