// Draughts's board: draughts (checkers) as pure functions, no DOM. The rule sets are data (SETS): the board's size, how many
// rows of men, whether a man may capture backwards, whether a king flies, whether the most pieces must be taken, and
// what a man does when it reaches the far row in the middle of a capture. Everything else (a capture is compulsory,
// a multi-jump must be played to its end, the captured pieces come off only when the move is complete and none is
// jumped twice, the side that cannot move loses) is the same in all of them.
//
// A position is a string, one character per dark square, row by row from the top of the board (the first mover's
// opponent's end): "o" a man of side 0 (Ink, who moves first), "O" its king, "x" a man of side 1 (Ivory), "X" its king,
// "." empty. A move is { path: [from, landing, landing…], caps: [squares jumped], crown: bool } (a step is a path of
// two with no caps). The squares are numbered 0..N-1 over the dark squares, row-major from the top left; the dark square
// is at each player's own left (the bottom left for side 0).
//
// Sources: English draughts, the World Draughts Federation's rules (wcdf.net: forced capture, any route, a man crowned
// in a jump stops); International draughts, FMJD (fmjd.org, "Rules of the game": men capture backwards, flying kings,
// the majority rule, a man passing the far row in a capture is not crowned); Brazilian is the International rules on
// the 8×8 board; Russian is the Russian federation's (free choice among captures, a man reaching the far row in a
// capture is crowned and goes on as a king).

export const SETS = {
  english: {
    id: "english", name: "English", also: "American checkers", size: 8, rows: 3, menBack: false, flying: false, most: false, crown: "stop",
    quiet: 80,
    blurb: "8×8. Men step and jump forward only; kings one square either way. A jump is compulsory, any route may be chosen. A man crowned in a jump stops there.",
  },
  international: {
    id: "international", name: "International", also: "Polish draughts", size: 10, rows: 4, menBack: true, flying: true, most: true, crown: "pass",
    quiet: 50,
    blurb: "10×10. Men jump backwards too; kings fly along a diagonal. The jump taking the most pieces is compulsory.",
  },
  brazilian: {
    id: "brazilian", name: "Brazilian", also: "International rules on 8×8", size: 8, rows: 3, menBack: true, flying: true, most: true, crown: "pass",
    quiet: 40,
    blurb: "8×8 with the International rules: men jump backwards, kings fly, the most pieces must be taken.",
  },
  russian: {
    id: "russian", name: "Russian", also: "shashki", size: 8, rows: 3, menBack: true, flying: true, most: false, crown: "continue",
    quiet: 30,
    blurb: "8×8. Men jump backwards, kings fly, any route may be chosen; a man reaching the far row in a jump is crowned and goes on as a king.",
  },
};
export const SET_IDS = Object.keys(SETS);

const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];   // up-left, up-right, down-left, down-right
const geoCache = new Map();

/** The board's geometry for a set: squares, neighbours and rays, built once. */
export function geo(setId) {
  const set = SETS[setId];
  if (!set) throw new Error(`no rule set "${setId}"`);
  let g = geoCache.get(set.size);
  if (g) return g;
  const S = set.size, half = S / 2, N = S * half;
  const row = new Int8Array(N), col = new Int8Array(N), at = Array.from({ length: S }, () => new Int16Array(S).fill(-1));
  for (let i = 0; i < N; i++) {
    const r = Math.floor(i / half), k = i % half, c = 2 * k + (r % 2 === 0 ? 1 : 0);
    row[i] = r; col[i] = c; at[r][c] = i;
  }
  const ray = Array.from({ length: N }, () => [[], [], [], []]);
  for (let i = 0; i < N; i++) {
    for (let d = 0; d < 4; d++) {
      let r = row[i] + DIRS[d][0], c = col[i] + DIRS[d][1];
      while (r >= 0 && r < S && c >= 0 && c < S) { ray[i][d].push(at[r][c]); r += DIRS[d][0]; c += DIRS[d][1]; }
    }
  }
  g = { S, N, half, row, col, at, ray, near: ray.map(rs => rs.map(r => (r.length ? r[0] : -1))) };
  geoCache.set(set.size, g);
  return g;
}

// ---------- positions ----------
const CH = { o: 1, O: 2, x: -1, X: -2, ".": 0 };
const PIECE = { 1: "o", 2: "O", "-1": "x", "-2": "X", 0: "." };
/** A position string as the array the generator works on (1 Ink man, 2 Ink king, -1 Ivory man, -2 Ivory king). */
export const toArray = text => Int8Array.from(text, ch => CH[ch] ?? 0);
export const toText = arr => Array.from(arr, p => PIECE[p]).join("");
/** The starting position of a set. */
export function startText(setId) {
  const set = SETS[setId], g = geo(setId);
  let out = "";
  for (let i = 0; i < g.N; i++) out += g.row[i] < set.rows ? "x" : g.row[i] >= g.S - set.rows ? "o" : ".";
  return out;
}
/** The side of a piece: 0 (Ink), 1 (Ivory). */
export const sideOf = p => (p > 0 ? 0 : 1);
/** The row a side's men are crowned on. */
export const crownRowOf = (g, side) => (side === 0 ? 0 : g.S - 1);

// ---------- moves ----------
const makers = new Map();

/**
 * Every legal move for a side, as { path, caps, crown }. A capture is compulsory (and, in the sets with the majority
 * rule, the one taking the most pieces), so a list of captures or a list of steps, never a mixture.
 */
export function movesOf(setId, board, side) {
  let make = makers.get(setId);
  if (!make) makers.set(setId, make = maker(setId));
  return make(board, side);
}

/** The move generator of a set: its closures built once, working on the board and side of the call in hand. */
function maker(setId) {
  const set = SETS[setId], g = geo(setId), N = g.N, all = [0, 1, 2, 3], marked = new Uint8Array(N);
  const flying = set.flying, most = set.most, crownMode = set.crown;
  let board = null, sg = 1, crownRow = 0, king0 = false, out = [], path = [], caps = [], capDirs = all;

  const record = king => out.push({ path: path.slice(), caps: caps.slice(), crown: !king0 && (king || g.row[path[path.length - 1]] === crownRow) });

  // every jump from `at`, as a man (king false) or a king; whether there was one. A landing from which there is none
  // ends the move, and is recorded.
  function go(at, king) {
    let continued = false;
    const dirs = king ? all : capDirs;
    for (let di = 0; di < dirs.length; di++) {
      const d = dirs[di];
      if (king && flying) {
        const ray = g.ray[at][d];
        let k = 0;
        while (k < ray.length && board[ray[k]] === 0) k++;
        if (k >= ray.length) continue;
        const over = ray[k], q = board[over];
        if (q * sg >= 0 || marked[over]) continue;       // own piece, or one already jumped (it still stands in the way)
        let m = k + 1;
        if (m >= ray.length || board[ray[m]] !== 0) continue;
        marked[over] = 1; caps.push(over);
        const ends = [];
        let any = false;
        for (; m < ray.length && board[ray[m]] === 0; m++) {
          path.push(ray[m]);
          if (go(ray[m], true)) any = true; else ends.push(path.slice());
          path.pop();
        }
        // a king that can go on from some landing must take one of those, not stop short on another
        if (!any) for (const e of ends) out.push({ path: e, caps: caps.slice(), crown: !king0 });
        marked[over] = 0; caps.pop();
        continued = true;
      } else {
        const over = g.near[at][d];
        if (over < 0) continue;
        const q = board[over];
        if (q * sg >= 0 || marked[over]) continue;
        const to = g.near[over][d];
        if (to < 0 || board[to] !== 0) continue;
        marked[over] = 1; caps.push(over); path.push(to);
        let isKing = king, stop = false;
        if (!king && g.row[to] === crownRow) {
          if (crownMode === "continue") isKing = true;
          else if (crownMode === "stop") stop = true;
        }
        if (stop || !go(to, isKing)) record(isKing || stop);
        path.pop(); caps.pop(); marked[over] = 0;
        continued = true;
      }
    }
    return continued;
  }

  return function make(b, side) {
    board = b; sg = side === 0 ? 1 : -1; out = []; path = []; caps = [];
    crownRow = crownRowOf(g, side);
    capDirs = !set.menBack ? (side === 0 ? [0, 1] : [2, 3]) : all;
    for (let i = 0; i < N; i++) {
      const p = b[i];
      if (p * sg <= 0) continue;
      king0 = Math.abs(p) === 2;
      b[i] = 0; path.length = 0; path.push(i); caps.length = 0;
      go(i, king0);
      b[i] = p;
    }
    if (out.length) return most ? mostOf(out) : out;
    const forward = side === 0 ? [0, 1] : [2, 3];
    for (let i = 0; i < N; i++) {
      const p = b[i];
      if (p * sg <= 0) continue;
      if (Math.abs(p) === 1) {
        for (const d of forward) {
          const to = g.near[i][d];
          if (to >= 0 && b[to] === 0) out.push({ path: [i, to], caps: [], crown: g.row[to] === crownRow });
        }
      } else if (flying) {
        for (const d of all) for (const to of g.ray[i][d]) { if (b[to] !== 0) break; out.push({ path: [i, to], caps: [], crown: false }); }
      } else {
        for (const d of all) { const to = g.near[i][d]; if (to >= 0 && b[to] === 0) out.push({ path: [i, to], caps: [], crown: false }); }
      }
    }
    return out;
  };
}

/** The majority rule: only the captures taking the most pieces (a king counts one). */
function mostOf(list) {
  let best = 0;
  for (const m of list) if (m.caps.length > best) best = m.caps.length;
  return list.filter(m => m.caps.length === best);
}

/** A move made on a copy of the board. */
export function play(board, move) {
  const next = board.slice(), p = board[move.path[0]];
  next[move.path[0]] = 0;
  for (const c of move.caps) next[c] = 0;
  next[move.path[move.path.length - 1]] = move.crown ? p * 2 : p;
  return next;
}

/** The pieces of each side: [men, kings] of Ink, then of Ivory. */
export function counts(board) {
  const c = [0, 0, 0, 0];
  for (let i = 0; i < board.length; i++) { const p = board[i]; if (p) c[(p > 0 ? 0 : 2) + (Math.abs(p) === 2 ? 1 : 0)]++; }
  return c;
}

// ---------- reading and writing moves ----------
/** A move written as the squares it visits, 1-based, joined by "-" (a step) or "x" (a jump): "11-15", "22x15x8". */
export const moveText = m => m.path.map(s => s + 1).join(m.caps.length ? "x" : "-");
/** The legal move that visits these squares in order (0-based), or null. */
export const findMove = (moves, path) => moves.find(m => m.path.length === path.length && m.path.every((s, i) => s === path[i])) || null;
