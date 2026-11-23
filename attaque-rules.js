// L'Attaque for two on seats.js: against the computer, two on one phone, or a partner's table. The moves are attaque-board.js's,
// the computer attaque-ai.js's. A game is plain JSON:
//   { seats: 2, red (the seat playing Red, who moves first), phase ("setup", then "play"), rdy ("00": which sides are set up,
//     Red's first), pk (80 kinds, a character each: Red's pieces, then Blue's), at (80 squares, two digits each, "--" once
//     taken), at0 (the same, as play began), sn and mv (80 flags each: shown to the other side, has moved), t (the side to move: 0 Red, 1 Blue), moves [every
//     move in play, from * 100 + to], quiet (moves since the last attack), fx { n (the move it was), f, t, a, d (the pieces), ak,
//     dk (their kinds as characters), r (1 the attacker won, -1 lost, 0 both fell), by (the attacking side) } the last attack, over,
//     result { winner (a side, or -1 for a draw), why: "flag" | "stuck" | "quiet" | "resign" } }
// Both armies are dealt a setup; a side puts its own in with { setup } (its forty kinds as it sees them), and the game starts
// when both have. Hidden pieces are hidden by the page and the computer, not the state: the computer plays from what its side
// has seen (viewOf), never from the other side's kinds.
import { ARMY, KCH, randomSetup, validSetup, placeSetup, setupOf, positionOf, writePosition, makePosition, movesOf, bannedOf, play } from "./attaque-board.js";
import { think } from "./attaque-ai.js";

/** Moves without an attack that make the game a draw: two hundred (a hundred each). */
export const QUIET = 200;
export const TWO_SQUARE = "A piece may not go back and forth between the same two squares a fourth time";
export const sideOfSeat = (s, seat) => (seat === s.red ? 0 : 1);
export const seatOfSide = (s, side) => (side === 0 ? s.red : 1 - s.red);

/** Moves the page's worker has already worked out, by position (so the computer's turn comes without a pause). */
export const ready = new Map();
export const readyKey = (s, level) => `${level}|${s.moves.length}|${s.at}`;

/** What a side knows: { side, p (the position with the other side's unshown kinds unknown, -1), banned (the move the two-square
 *  rule bars it now), last (its own last move) }. */
export function viewOf(s, side) {
  const p = positionOf(s), kind = Int8Array.from(p.kind), lo = (1 - side) * ARMY;
  for (let id = lo; id < lo + ARMY; id++) if (!p.seen[id]) kind[id] = -1;
  return { side, p: makePosition(kind, p.pos, p.seen, p.moved, p.t), banned: s.t === side ? bannedOf(s.moves) : -1, last: lastOwn(s.moves) };
}
/** The side to move's own last move (two plies back), or -1. */
const lastOwn = moves => (moves.length >= 2 ? moves[moves.length - 2] : -1);

function end(s, winner, why) {
  s.over = true;
  s.result = { winner, why };
  return s;
}

export const rules = {
  id: "attaque",
  seats: { min: 2, max: 2 },

  /** options: { colour: "red" | "blue" | "either" (yours: Red moves first) }. Each army is dealt a setup. */
  deal({ options = {}, rng }) {
    const red = options.colour === "blue" ? 1 : options.colour === "either" ? (rng() < 0.5 ? 0 : 1) : 0;
    const s = { seats: 2, red, phase: "setup", rdy: "00", pk: "?".repeat(2 * ARMY), at: "--".repeat(2 * ARMY), sn: "0".repeat(2 * ARMY), mv: "0".repeat(2 * ARMY), t: 0, moves: [], quiet: 0 };
    placeSetup(s, 0, randomSetup(rng));
    placeSetup(s, 1, randomSetup(rng));
    return s;
  },

  toMove: s => (s.over || s.phase !== "play" ? null : seatOfSide(s, s.t)),
  /** While the armies set up, both sides at once: the seats still to put theirs in. */
  toMoveAll: s => (s.over || s.phase !== "setup" ? [] : [0, 1].filter(seat => s.rdy[sideOfSeat(s, seat)] === "0")),

  /** A move is from * 100 + to, { setup } (a side's forty kinds, while setting up) or { resign: true }. */
  act(s, seat, m) {
    if (m && typeof m === "object" && m.resign) {
      if (s.over) return "The game is over";
      return end(s, 1 - sideOfSeat(s, seat), "resign");
    }
    if (m && typeof m === "object" && "setup" in m) {
      if (s.phase !== "setup") return "The armies are set up";
      const side = sideOfSeat(s, seat);
      if (s.rdy[side] === "1") return "Your army is set up";
      if (!validSetup(m.setup)) return "That isn't a whole army";
      placeSetup(s, side, m.setup);
      s.rdy = side === 0 ? `1${s.rdy[1]}` : `${s.rdy[0]}1`;
      if (s.rdy === "11") { s.phase = "play"; s.t = 0; s.at0 = s.at; }      // at0: where play began (the deep computer replays the game from it)
      return s;
    }
    if (!Number.isInteger(m) || m < 0) return "Tap a piece";
    if (s.phase !== "play") return "The armies are still setting up";
    if (seatOfSide(s, s.t) !== seat) return "It isn't your turn";
    const p = positionOf(s);
    if (!movesOf(p, p.t, bannedOf(s.moves)).includes(m)) return movesOf(p).includes(m) ? TWO_SQUARE : "That isn't a legal move";
    const { p: next, fx } = play(p, m);
    writePosition(s, next);
    s.moves = [...s.moves, m];
    s.quiet = fx ? 0 : (s.quiet || 0) + 1;
    if (fx) s.fx = { n: s.moves.length, f: Math.floor(m / 100), t: m % 100, a: fx.a, d: fx.d, ak: KCH[fx.ak], dk: KCH[fx.dk], r: fx.r, by: p.t };
    if (fx?.flag) return end(s, p.t, "flag");
    // a side that cannot move on its turn loses; if neither can, it is a draw
    const ban = bannedOf(s.moves);
    if (!movesOf(next, next.t, ban).length) return end(s, movesOf(next, p.t).length ? p.t : -1, "stuck");
    if (s.quiet >= QUIET) return end(s, -1, "quiet");
    return s;
  },

  anytime: m => !!(m && typeof m === "object" && (m.resign || "setup" in m)),

  bot(s, seat, { level, rng }) {
    const side = sideOfSeat(s, seat);
    if (s.phase === "setup") return { setup: setupOf(s, side) };
    const L = level || "medium", key = readyKey(s, L), hit = ready.get(key);
    if (hit != null) { ready.delete(key); return hit; }
    return think(viewOf(s, side), L, { rng }).code;
  },

  over: s => !!s.over,

  restore(s) {
    s.moves = s.moves ? Object.values(s.moves) : [];
    return s;
  },
};
export { validSetup, randomSetup, setupOf };
