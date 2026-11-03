// The rules of Go, Chinese style: area scoring, a stone with no liberty is taken, no suicide, and no move may bring back a
// whole-board position that has stood before (positional superko). Pure functions and plain data, no page and no network,
// so the tests, the search worker and the page all use these.
//
// A game is plain JSON: { size, komi, handicap, moves: [point | -1 for a pass...], resigned: null | "b" | "w" }.
// A point is y * size + x, y counted from the top. Black moves first, unless there is a handicap: then the black stones
// stand already and White moves first. Colours alternate, so a move carries no colour of its own.

export const EMPTY = 0, BLACK = 1, WHITE = 2, PASS = -1;
export const SIZES = [9, 13, 19];
export const opp = c => 3 - c;
export const colourName = c => (c === BLACK ? "Black" : "White");

// ---------- the board ----------
const NEIGHBOURS = new Map();
export function neighbours(n) {
  if (NEIGHBOURS.has(n)) return NEIGHBOURS.get(n);
  const out = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = [];
    if (y > 0) a.push((y - 1) * n + x);
    if (x > 0) a.push(y * n + x - 1);
    if (x < n - 1) a.push(y * n + x + 1);
    if (y < n - 1) a.push((y + 1) * n + x);
    out.push(Int16Array.from(a));
  }
  NEIGHBOURS.set(n, out);
  return out;
}

// Zobrist keys (a random number for each colour on each point, xor-ed together into a position's key), from a fixed seed
// so a saved game and a replay agree. Two 32-bit halves are folded into one number below 2^53.
const Z1 = new Uint32Array(2 * 361), Z2 = new Uint32Array(2 * 361);
{
  let s = 0x9e3779b9;
  const next = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s; };
  for (let i = 0; i < Z1.length; i++) { Z1[i] = next(); Z2[i] = next(); }
}

const mark = new Int32Array(361), libMarks = new Int32Array(361);
let stamp = 0;

export class Position {
  constructor(size) {
    this.n = size;
    this.b = new Uint8Array(size * size);
    this.toMove = BLACK;
    this.ko = -1;               // the point a simple ko forbids right now
    this.h1 = 0; this.h2 = 0;
    this.caps = [0, 0, 0];      // stones taken by each colour
    this.passes = 0;            // passes in a row
  }
  copy() {
    const p = new Position(this.n);
    p.b.set(this.b);
    p.toMove = this.toMove; p.ko = this.ko; p.h1 = this.h1; p.h2 = this.h2; p.passes = this.passes;
    p.caps = this.caps.slice();
    return p;
  }
  get key() { return this.h1 * 2097152 + (this.h2 >>> 11); }
  // (positional superko ignores whose turn it is, so a position's key is its board alone)

  /** The group at `pt`: its stones in `stones` (cleared first) and its liberty count. */
  group(pt, stones) {
    const b = this.b, nb = neighbours(this.n), c = b[pt];
    const libMark = ++stamp;
    stones.length = 0;
    stones.push(pt);
    mark[pt] = libMark;
    let libs = 0;
    for (let i = 0; i < stones.length; i++) {
      for (const q of nb[stones[i]]) {
        if (b[q] === EMPTY) { if (libMarks[q] !== libMark) { libMarks[q] = libMark; libs++; } }
        else if (b[q] === c && mark[q] !== libMark) { mark[q] = libMark; stones.push(q); }
      }
    }
    return libs;
  }
  liberties(pt) { return this.group(pt, []); }

  /** Could `colour` play `pt`, as far as the board goes (empty, not a ko recapture, not suicide)? Superko is `play`'s to judge. */
  playable(pt, colour = this.toMove) {
    const b = this.b;
    if (pt < 0 || b[pt] !== EMPTY) return false;
    if (pt === this.ko && colour === this.toMove) return false;
    const stones = [];
    for (const q of neighbours(this.n)[pt]) {
      const v = b[q];
      if (v === EMPTY) return true;
      const libs = this.group(q, stones);
      if (v === colour ? libs > 1 : libs === 1) return true;
    }
    return false;
  }

  /** Plays `pt` (or a pass, PASS) for the side to move. `seen` is the set of keys of earlier positions: a move making one
   *  of them is refused. Returns the stones taken, or -1 if the move is not allowed (the position is then unchanged). */
  play(pt, seen = null) {
    const colour = this.toMove;
    if (pt === PASS) {
      this.toMove = opp(colour); this.ko = -1; this.passes++;
      return 0;
    }
    if (!this.playable(pt, colour)) return -1;
    const b = this.b, nb = neighbours(this.n), o = opp(colour);
    const before = seen ? { b: b.slice(), h1: this.h1, h2: this.h2 } : null;
    b[pt] = colour;
    this.h1 ^= Z1[colour === BLACK ? pt : 361 + pt]; this.h2 ^= Z2[colour === BLACK ? pt : 361 + pt];
    let taken = 0, lastTaken = -1;
    const stones = [];
    for (const q of nb[pt]) {
      if (b[q] !== o) continue;
      if (this.group(q, stones) === 0) {
        for (const s of stones) {
          b[s] = EMPTY;
          this.h1 ^= Z1[o === BLACK ? s : 361 + s]; this.h2 ^= Z2[o === BLACK ? s : 361 + s];
          lastTaken = s; taken++;
        }
      }
    }
    if (seen && seen.has(this.key)) {
      b.set(before.b); this.h1 = before.h1; this.h2 = before.h2;
      return -1;
    }
    // a simple ko: one stone taken by a lone stone left with one liberty (the superko rule covers the rest)
    this.ko = -1;
    if (taken === 1 && this.group(pt, stones) === 1 && stones.length === 1) this.ko = lastTaken;
    this.caps[colour] += taken;
    this.toMove = o; this.passes = 0;
    return taken;
  }

  /** Every point the side to move may play (ignoring superko), then it can always pass. */
  legalPoints() {
    const out = [];
    for (let i = 0; i < this.b.length; i++) if (this.playable(i)) out.push(i);
    return out;
  }
}

// ---------- handicap ----------
/** The points of the black handicap stones for `n` stones on a board of `size`, in the usual order. */
export function handicapPoints(size, n) {
  if (n < 2) return [];
  const lo = size === 9 ? 2 : 3, hi = size - 1 - lo, mid = (size - 1) / 2;
  const at = (x, y) => y * size + x;
  const corners = [at(hi, lo), at(lo, hi), at(hi, hi), at(lo, lo)];   // the lower right, upper left... as a book draws them
  const left = at(lo, mid), right = at(hi, mid), top = at(mid, lo), bottom = at(mid, hi), centre = at(mid, mid);
  const k = Math.min(n, 9);
  if (k <= 4) return corners.slice(0, k);
  if (k === 5) return [...corners, centre];
  if (k === 6) return [...corners, left, right];
  if (k === 7) return [...corners, left, right, centre];
  if (k === 8) return [...corners, left, right, top, bottom];
  return [...corners, left, right, top, bottom, centre];
}
export const MAX_HANDICAP = 9;

// ---------- games ----------
export function newGame({ size = 19, komi = 7.5, handicap = 0 } = {}) {
  return { size, komi: handicap >= 2 ? 0.5 : komi, handicap: handicap >= 2 ? handicap : 0, moves: [], resigned: null };
}

/** Replays a game: the position now, the list of {c, pt} moves made, and the keys of every position so far. */
export function replay(game, upTo = game.moves.length) {
  const pos = new Position(game.size);
  const seen = new Set([pos.key]);
  const made = [];
  for (const pt of handicapPoints(game.size, game.handicap)) {
    pos.b[pt] = BLACK;
    pos.h1 ^= Z1[pt]; pos.h2 ^= Z2[pt];
  }
  if (game.handicap >= 2) pos.toMove = WHITE;
  seen.add(pos.key);
  for (let i = 0; i < upTo; i++) {
    const pt = game.moves[i], c = pos.toMove;
    if (pos.play(pt, seen) < 0) throw new Error(`go-rules: move ${i} (${pt}) is not legal`);
    made.push({ c, pt });
    seen.add(pos.key);
  }
  return { pos, seen, made };
}

/** Is `pt` (or a pass) a legal move for the side to move in this replayed game? */
export function isLegal(r, pt) {
  if (pt === PASS) return true;
  if (!r.pos.playable(pt)) return false;
  const t = r.pos.copy();
  return t.play(pt, r.seen) >= 0;
}

/** The game is over for want of moves: two passes in a row, or a resignation. */
export const isOver = (game, r = replay(game)) => !!game.resigned || r.pos.passes >= 2;

export function ptName(size, pt) {
  if (pt === PASS) return "Pass";
  const L = "ABCDEFGHJKLMNOPQRST";    // no I
  return L[pt % size] + (size - Math.floor(pt / size));
}

// ---------- scoring ----------
/** The Chinese area score of a board with `dead` (a Set of points whose stones are taken off first): each colour's stones
 *  plus the empty regions only it touches. Returns { black, white, owner: Uint8Array of who each point counts for }. */
export function areaScore(pos, dead = new Set()) {
  const n = pos.n, nb = neighbours(n), b = pos.b.slice();
  for (const d of dead) b[d] = EMPTY;
  const owner = new Uint8Array(n * n);
  let black = 0, white = 0;
  const seen = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    if (b[i] === BLACK) { owner[i] = BLACK; black++; }
    else if (b[i] === WHITE) { owner[i] = WHITE; white++; }
  }
  for (let i = 0; i < n * n; i++) {
    if (b[i] !== EMPTY || seen[i]) continue;
    const region = [i];
    seen[i] = 1;
    let touchB = false, touchW = false;
    for (let k = 0; k < region.length; k++) {
      for (const q of nb[region[k]]) {
        if (b[q] === EMPTY) { if (!seen[q]) { seen[q] = 1; region.push(q); } }
        else if (b[q] === BLACK) touchB = true;
        else touchW = true;
      }
    }
    const who = touchB && !touchW ? BLACK : touchW && !touchB ? WHITE : EMPTY;
    for (const q of region) owner[q] = who;
    if (who === BLACK) black += region.length; else if (who === WHITE) white += region.length;
  }
  return { black, white, owner };
}

/** The result: { winner: "b" | "w", margin, text } for a position and its dead stones, komi going to White. */
export function result(game, pos, dead = new Set()) {
  if (game.resigned) {
    const winner = game.resigned === "b" ? "w" : "b";
    return { winner, margin: null, text: `${winner === "b" ? "Black" : "White"} wins by resignation` };
  }
  const s = areaScore(pos, dead);
  const diff = s.black - s.white - game.komi;
  const winner = diff > 0 ? "b" : "w";
  const m = Math.abs(diff);
  return { winner, margin: m, black: s.black, white: s.white, owner: s.owner,
    text: `${winner === "b" ? "Black" : "White"} wins by ${m % 1 === 0 ? m : m.toFixed(1)}` };
}

/** The group of stones at `pt` (to mark dead or alive together). */
export function groupAt(pos, pt) {
  const stones = [];
  if (pos.b[pt] === EMPTY) return stones;
  pos.group(pt, stones);
  return stones;
}
