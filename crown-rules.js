// Crown: draughts for two on seats.js (solo against the computer, two on one phone, a partner's match, a table).
// The board and its rule sets are crown-board.js's, the computer crown-search.js's. A game is one state:
//   { set, board, ply, sides: [side of seat 0, side of seat 1], turn (the seat to move), hist: [every position],
//     mv: [every move, "from.landing…" 0-based], quiet (plies since a capture or a man's move), last, result }
// Side 0 (Ink) always moves first; which seat is Ink is the deal's choice (you: "ink" | "ivory" | "swap").
import { SETS, SET_IDS, startText, toArray, toText, movesOf, play, findMove, moveText, counts, sideOf } from "./crown-board.js";
import { think, engineFor } from "./crown-search.js";

export { SETS, SET_IDS, movesOf, findMove, moveText, counts, toArray, toText, play, startText };
export { LEVELS, LEVEL_NAMES } from "./crown-search.js";

/** Moves the page's worker has already worked out, by position (so the table's turn comes without a pause). */
export const ready = new Map();
export const readyKey = (s, level) => `${s.set}|${s.board}|${s.ply}|${level}`;

const sideToMove = s => s.ply % 2;
/** The seat playing a side. */
export const seatOf = (s, side) => s.sides.indexOf(side);

/** The legal moves of the position in hand. */
export const legalMoves = s => movesOf(s.set, toArray(s.board), sideToMove(s));

/** Plies since the last capture or move of a man, read back from the record (for a position taken back to). */
export function quietAt(s, ply) {
  let q = 0;
  for (let j = ply; j >= 1; j--) {
    const before = s.hist[j - 1], after = s.hist[j], from = Number(String(s.mv[j - 1]).split(".")[0]);
    const man = before[from] === "o" || before[from] === "x";
    let n0 = 0, n1 = 0;
    for (let i = 0; i < before.length; i++) { if (before[i] !== ".") n0++; if (after[i] !== ".") n1++; }
    if (man || n0 !== n1) break;
    q++;
  }
  return q;
}

/** How many times the position (and side to move) has stood in the game. */
const timesSeen = (s, ply = s.ply) => s.hist.reduce((n, b, i) => n + (i <= ply && i % 2 === ply % 2 && b === s.hist[ply] ? 1 : 0), 0);

/** A new position for a state: a game from the start, or from a given position (a puzzle, the course). */
function fresh(set, board, ply = 0) {
  return { set, board, ply, hist: [board], mv: [], quiet: 0 };
}

/** Whether a game is over and how: { winner (seat | null), why } or null. */
function verdict(s) {
  const side = sideToMove(s);
  if (!movesOf(s.set, toArray(s.board), side).length) {
    const mine = counts(toArray(s.board)), left = mine[side * 2] + mine[side * 2 + 1];
    return { winner: seatOf(s, 1 - side), why: left ? "blocked" : "captured" };
  }
  if (timesSeen(s) >= 3) return { winner: null, why: "repetition" };
  if (s.quiet >= SETS[s.set].quiet) return { winner: null, why: "quiet" };
  return null;
}

const SIDE_NAMES = ["Ink", "Ivory"];
const nameLine = (s, seat) => `{s${seat}} (${SIDE_NAMES[s.sides[seat]]})`;
function ending(s) {
  const v = verdict(s);
  if (!v) return s;
  s.result = v;
  s.say = v.winner == null ? (v.why === "repetition" ? "A draw: the same position a third time." : "A draw: no capture or man moved for too long.")
    : v.why === "resigned" ? `{s${1 - v.winner}} resigns. {s${v.winner}} wins.` : `{s${v.winner}} wins${v.why === "captured" ? ": every piece taken" : ": no move left"}.`;
  return s;
}

export const rules = {
  id: "crown",
  seats: { min: 2, max: 2 },

  deal({ options = {}, prev }) {
    const set = SETS[options.set] ? options.set : "english";
    const you = options.you || "ink";
    // seat 0 is the human on this phone (or the host); `swap` turns the colours round from the last game
    let mine = you === "ivory" ? 1 : 0;
    if (you === "swap") mine = prev && prev.sides ? 1 - prev.sides[0] : 0;
    const s = { ...fresh(set, options.position || startText(set), options.ply || 0), sides: [mine, 1 - mine], hot: !!options.hot };
    s.turn = seatOf(s, sideToMove(s));
    s.say = `${SETS[set].name} draughts. {s${seatOf(s, 0)}} plays Ink and moves first.`;
    return ending(s);
  },

  toMove: s => (s.result ? null : seatOf(s, sideToMove(s))),

  act(s, seat, m) {
    if (m?.t === "resign") {
      if (s.result) return "The game is over";
      s.result = { winner: 1 - seat, why: "resigned" };
      s.say = `{s${seat}} resigns. {s${1 - seat}} wins.`;
      return s;
    }
    if (s.result) return "The game is over";
    if (m?.t === "back") {
      const n = m.plies === 2 ? 2 : 1;
      if (s.ply < n) return "Nothing to take back";
      const ply = s.ply - n;
      s.hist = s.hist.slice(0, ply + 1); s.mv = s.mv.slice(0, ply);
      s.board = s.hist[ply]; s.ply = ply; s.quiet = quietAt(s, ply);
      s.turn = seatOf(s, sideToMove(s));
      s.last = ply ? lastOf(s, ply) : null;
      delete s.say;
      return s;
    }
    if (s.turn !== seat) return "It isn't your turn";
    const path = Array.isArray(m?.path) ? m.path.map(Number) : null;
    if (!path) return "Make your move";
    const side = sideToMove(s), board = toArray(s.board), legal = movesOf(s.set, board, side);
    const mv = findMove(legal, path);
    if (!mv) return legal[0]?.caps.length ? "A jump is compulsory" : "That isn't a legal move";
    const man = Math.abs(board[mv.path[0]]) === 1;
    const next = play(board, mv);
    const text = toText(next);
    s.last = { seat, path: mv.path.slice(), caps: mv.caps.slice(), crown: mv.crown, before: s.board };
    s.board = text; s.ply++;
    s.hist.push(text); s.mv.push(mv.path.join("."));
    s.quiet = man || mv.caps.length ? 0 : s.quiet + 1;
    s.turn = seatOf(s, sideToMove(s));
    delete s.say;
    return ending(s);
  },

  bot(s, seat, { level, rng }) {
    const key = readyKey(s, level || "medium");
    const hit = ready.get(key);
    if (hit) { ready.delete(key); return { path: hit }; }
    const side = sideToMove(s);
    const r = think(s.set, s.board, side, level || "medium", { rng, quiet: s.quiet, seen: seenOf(s) });
    return { path: r.move.path };
  },

  over: s => !!s.result,
  anytime: m => m?.t === "resign",

  restore(s) {
    s.hist = s.hist ? Object.values(s.hist) : [s.board];
    s.mv = s.mv ? Object.values(s.mv) : [];
    s.sides = s.sides ? [s.sides[0], s.sides[1]] : [0, 1];
    if (s.last) { s.last.path = Object.values(s.last.path || {}); s.last.caps = s.last.caps ? Object.values(s.last.caps) : []; }
    return s;
  },
};

/** The last move as the record keeps it, for a position taken back to. */
function lastOf(s, ply) {
  const path = String(s.mv[ply - 1]).split(".").map(Number), before = s.hist[ply - 1], after = s.hist[ply];
  // the pieces that stood in `before` and are gone from `after`, other than the mover's own start, were taken
  const caps = [];
  for (let i = 0; i < before.length; i++) if (before[i] !== "." && after[i] === "." && i !== path[0] && !path.includes(i)) caps.push(i);
  return { seat: seatOf(s, (ply - 1) % 2), path, caps, crown: false, before };
}

/** Positions the game has stood in, by search hash, for the search to see a repetition coming. */
export function seenOf(s) {
  const e = engineFor(s.set), seen = new Map();
  for (let i = 0; i <= s.ply; i++) {
    const k = e.hashOf(toArray(s.hist[i]), i % 2)[0];
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  return seen;
}

/** Ink's lead, in men, by the search (the coach's "who is ahead"); { lead, best (a move's path), depth }. */
export { sideOf };
export const SIDE_LABEL = SIDE_NAMES;
export { nameLine };
