// L'Attaque's rules (attaque-rules.js puts them on seats.js, attaque-ai.js plays them). L'Attaque (Hermance Edan, 1909) is the
// game Stratego grew from; this is played by today's tournament rules: a 10 x 10 board with two lakes, forty pieces a side set
// up hidden in your four rows, Red moving first. A piece steps one square up, down or sideways; a Scout runs any distance
// along a line and may attack at its end; Bombs and the Flag never move. An attack shows both pieces: the higher rank wins
// and an equal one takes both off, except that the Spy attacking the Marshal takes it, a Miner takes a Bomb and a Bomb
// takes anything else that attacks it. Taking the Flag wins, and so does leaving the other side without a move.
// Squares count from Blue's back row: square = row * 10 + column, row 0 at the top (Blue's back row), row 9 Red's back row.
// Pieces 0 to 39 are Red's, 40 to 79 Blue's; a setup is written as each side sees it (front row first, its left first).

export const SIZE = 10, N = 100, ARMY = 40;
export const FLAG = 0, SPY = 1, SCOUT = 2, MINER = 3, MARSHAL = 10, BOMB = 11;
/** A kind as one character in a saved game: F S 2 3 4 5 6 7 8 9 T(en) B. */
export const KCH = "FS23456789TB";
/** How many of each kind an army has, by kind. */
export const COUNT = [1, 1, 8, 5, 4, 4, 4, 3, 2, 1, 1, 6];
export const NAMES = ["Flag", "Spy", "Scout", "Miner", "Sergeant", "Lieutenant", "Captain", "Major", "Colonel", "General", "Marshal", "Bomb"];
/** The mark a piece wears: its rank, or a letter for the three without one. */
export const LABEL = ["F", "S", "2", "3", "4", "5", "6", "7", "8", "9", "10", "B"];
export const SIDES = ["Red", "Blue"];
const FILES = "abcdefghij";

export const LAKE = (() => { const a = new Uint8Array(N); for (const r of [4, 5]) for (const c of [2, 3, 6, 7]) a[r * SIZE + c] = 1; return a; })();
export const sideOf = id => (id >= ARMY ? 1 : 0);
export const movable = k => k !== FLAG && k !== BOMB;
/** A square's name as on the board's edges: files a to j from Red's left, ranks 1 to 10 from Red's back row. */
export const squareName = sq => `${FILES[sq % SIZE]}${SIZE - Math.floor(sq / SIZE)}`;

/** The square of the i-th place of a side's setup (front row first, its own left first), and back. */
export const placeSquare = (side, i) => {
  const fr = Math.floor(i / SIZE), c = i % SIZE;
  return side === 0 ? (6 + fr) * SIZE + c : (3 - fr) * SIZE + (SIZE - 1 - c);
};
export function placeOf(side, sq) {
  const r = Math.floor(sq / SIZE), c = sq % SIZE;
  if (side === 0) return r >= 6 ? (r - 6) * SIZE + c : -1;
  return r <= 3 ? (3 - r) * SIZE + (SIZE - 1 - c) : -1;
}
/** How far a square lies from a side's own back row: 0 there, 9 on the other side's. */
export const depthFrom = (side, sq) => (side === 0 ? 9 - Math.floor(sq / SIZE) : Math.floor(sq / SIZE));

/** An attack: 1 the attacker wins, -1 the defender does, 0 both go. */
export function fight(a, d) {
  if (d === FLAG) return 1;
  if (d === BOMB) return a === MINER ? 1 : -1;
  if (a === SPY && d === MARSHAL) return 1;
  return a > d ? 1 : a < d ? -1 : 0;
}

/** A setup is forty kinds as characters, each kind as many times as an army has. */
export function validSetup(text) {
  if (typeof text !== "string" || text.length !== ARMY) return false;
  const n = Array(COUNT.length).fill(0);
  for (const ch of text) { const k = KCH.indexOf(ch); if (k < 0) return false; n[k]++; }
  return n.every((v, k) => v === COUNT[k]);
}

/**
 * A sensible setup (as a side sees it), by `rng`: the Flag on the back row, nearer a corner, with Bombs beside it and the
 * rest of the Bombs behind the front; the Marshal and General forward, the Spy near the General, Scouts on the front row
 * and the Miners at the back. Not a fixed pattern: every draw differs, so no setup tells another.
 */
export function randomSetup(rng = Math.random) {
  const g = Array(ARMY).fill(-1);
  const free = () => g.map((k, i) => (k < 0 ? i : -1)).filter(i => i >= 0);
  const pick = (weight, kind) => {
    const opts = free(), ws = opts.map(weight), sum = ws.reduce((a, b) => a + b, 0);
    let x = rng() * sum, at = opts[opts.length - 1];
    for (let j = 0; j < opts.length; j++) { x -= ws[j]; if (x <= 0) { at = opts[j]; break; } }
    g[at] = kind;
    return at;
  };
  const fr = i => Math.floor(i / SIZE), col = i => i % SIZE;
  const near = (a, b) => Math.abs(fr(a) - fr(b)) + Math.abs(col(a) - col(b));
  const edge = [3, 2, 1, 1, 1, 1, 1, 1, 2, 3];
  const flag = pick(i => (fr(i) === 3 ? 6 : fr(i) === 2 ? 1 : 0) * edge[col(i)], FLAG);
  let bombs = COUNT[BOMB];
  for (const n of [flag - 1, flag + 1, flag - SIZE, flag + SIZE]) {
    if (n < 0 || n >= ARMY || near(n, flag) !== 1 || g[n] >= 0 || rng() < 0.12) continue;
    g[n] = BOMB; bombs--;
  }
  for (; bombs > 0; bombs--) pick(i => [0.25, 1, 1.3, 1.1][fr(i)], BOMB);
  pick(i => [1, 2, 0.6, 0.1][fr(i)], MARSHAL);
  const general = pick(i => [1.2, 2, 1, 0.2][fr(i)], 9);
  pick(i => (near(i, general) <= 2 ? 4 : 1) * [0.3, 1, 1.2, 0.6][fr(i)], SPY);
  for (let n = 0; n < COUNT[8] + COUNT[7]; n++) pick(i => [1, 1.4, 1, 0.4][fr(i)], n < COUNT[8] ? 8 : 7);
  for (let n = 0; n < COUNT[SCOUT]; n++) pick(i => [2.2, 1, 0.8, 1][fr(i)], SCOUT);
  for (let n = 0; n < COUNT[MINER]; n++) pick(i => [0.3, 0.7, 1.6, 2][fr(i)], MINER);
  const rest = [];
  for (const k of [4, 5, 6]) for (let n = 0; n < COUNT[k]; n++) rest.push(k);
  for (const k of rest) pick(() => 1, k);
  return g.map(k => KCH[k]).join("");
}

// ---------- positions ----------
/**
 * A position: kind (80: each piece's kind, -1 where it is unknown), pos (80: its square, -1 once taken), seen (80: shown to
 * the other side in an attack, or by a Scout's run), moved (80: has moved, so is no Bomb or Flag), board (100: the piece on
 * each square, -1 for none), t (the side to move).
 */
export function makePosition(kind, pos, seen, moved, t) {
  const board = new Int8Array(N).fill(-1);
  for (let id = 0; id < 2 * ARMY; id++) if (pos[id] >= 0) board[pos[id]] = id;
  return { kind: Int8Array.from(kind), pos: Int8Array.from(pos), seen: Uint8Array.from(seen), moved: Uint8Array.from(moved), board, t };
}
/** A game's state as a position. */
export function positionOf(s) {
  const kind = [...s.pk].map(ch => KCH.indexOf(ch));
  const pos = Array.from({ length: 2 * ARMY }, (_, id) => { const v = s.at.slice(2 * id, 2 * id + 2); return v === "--" ? -1 : Number(v); });
  return makePosition(kind, pos, [...s.sn].map(Number), [...s.mv].map(Number), s.t);
}
/** A position written back into a state's text (kinds do not change, so they are written only by a setup). */
export function writePosition(s, p) {
  s.at = Array.from(p.pos, v => (v < 0 ? "--" : String(v).padStart(2, "0"))).join("");
  s.sn = p.seen.join(""); s.mv = p.moved.join(""); s.t = p.t;
}
/** A side's setup as it sees it, from a state. */
export function setupOf(s, side) {
  const out = Array(ARMY).fill("?");
  for (let i = 0; i < ARMY; i++) out[i] = s.pk[side * ARMY + i];
  return out.join("");
}
/** A side's pieces put down from a setup: piece side*40 + i on the setup's place i. */
export function placeSetup(s, side, text) {
  const pk = [...s.pk], at = [];
  for (let id = 0; id < 2 * ARMY; id++) at.push(s.at.slice(2 * id, 2 * id + 2));
  for (let i = 0; i < ARMY; i++) { pk[side * ARMY + i] = text[i]; at[side * ARMY + i] = String(placeSquare(side, i)).padStart(2, "0"); }
  s.pk = pk.join(""); s.at = at.join("");
}

const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
/** The moves of the side to move (or `side`): codes from * 100 + to, attacks included; `banned` is one move the two-square
 *  rule forbids (bannedOf). The enemy's kinds do not matter, so a side's moves are known to both. */
export function movesOf(p, side = p.t, banned = -1) {
  const out = [], lo = side * ARMY;
  for (let id = lo; id < lo + ARMY; id++) {
    const sq = p.pos[id];
    if (sq < 0 || !movable(p.kind[id])) continue;
    const r = Math.floor(sq / SIZE), c = sq % SIZE, far = p.kind[id] === SCOUT;
    for (const [dr, dc] of DIRS) {
      for (let k = 1, rr = r + dr, cc = c + dc; rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE; k++, rr += dr, cc += dc) {
        const t = rr * SIZE + cc;
        if (LAKE[t]) break;
        const o = p.board[t];
        if (o >= 0 && sideOf(o) === side) break;
        if (sq * 100 + t !== banned) out.push(sq * 100 + t);
        if (o >= 0 || !far) break;
      }
    }
  }
  return out;
}
/** Whether a side can move at all (cheaper than listing its moves). */
export function canMove(p, side, banned = -1) {
  const lo = side * ARMY;
  for (let id = lo; id < lo + ARMY; id++) {
    const sq = p.pos[id];
    if (sq < 0 || !movable(p.kind[id])) continue;
    const r = Math.floor(sq / SIZE), c = sq % SIZE;
    for (const [dr, dc] of DIRS) {
      const rr = r + dr, cc = c + dc, t = rr * SIZE + cc;
      if (rr < 0 || rr >= SIZE || cc < 0 || cc >= SIZE || LAKE[t]) continue;
      const o = p.board[t];
      if ((o < 0 || sideOf(o) !== side) && sq * 100 + t !== banned) return true;
    }
  }
  return false;
}
/**
 * The two-square rule: a piece may not go between the same two squares more than three times running. With the plies of the
 * game so far (the side to move made every other one, ending two back), the one move it may not make now, or -1.
 */
export function bannedOf(moves) {
  const n = moves.length;
  if (n < 6) return -1;
  const [m1, m2, m3] = [moves[n - 2], moves[n - 4], moves[n - 6]];
  const a = Math.floor(m1 / 100), b = m1 % 100;
  return Math.floor(m2 / 100) === b && m2 % 100 === a && Math.floor(m3 / 100) === a && m3 % 100 === b ? b * 100 + a : -1;
}

/**
 * A move made on a copy of a position (every kind on the board known): { p, fx } where fx is the attack it was, or null:
 * { a, d (the pieces), ak, dk (their kinds), r (fight's result), flag (the Flag was taken) }.
 */
export function play(p0, code) {
  const p = { kind: p0.kind, pos: Int8Array.from(p0.pos), seen: Uint8Array.from(p0.seen), moved: Uint8Array.from(p0.moved), board: Int8Array.from(p0.board), t: 1 - p0.t };
  const f = Math.floor(code / 100), t = code % 100, a = p.board[f], d = p.board[t];
  p.moved[a] = 1;
  const dist = Math.abs(Math.floor(f / SIZE) - Math.floor(t / SIZE)) + Math.abs((f % SIZE) - (t % SIZE));
  if (dist > 1) p.seen[a] = 1;                                     // only a Scout runs: running shows it
  p.board[f] = -1;
  if (d < 0) { p.board[t] = a; p.pos[a] = t; return { p, fx: null }; }
  const ak = p.kind[a], dk = p.kind[d], r = fight(ak, dk);
  p.seen[a] = 1; p.seen[d] = 1;
  if (r > 0) { p.pos[d] = -1; p.board[t] = a; p.pos[a] = t; }
  else if (r < 0) p.pos[a] = -1;
  else { p.pos[a] = -1; p.pos[d] = -1; p.board[t] = -1; }
  return { p, fx: { a, d, ak, dk, r, flag: dk === FLAG } };
}
