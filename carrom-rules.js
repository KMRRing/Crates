// Carrom for two as a seats.js game (seats.js): pure functions on a state that is plain numbers, so the table's database
// keeps it whole. A move is a shot, { x, ax, ay, p } (the striker's place on the baseline, an aim as an integer vector, a
// power 1..1000); the move is played out here by carrom-engine.js and the state holds where the men came to rest, so every
// phone that replays the same shot from the state before it sees the same thing.
//
// House rules (docs/carrom.md): seat 0 plays white from the bottom baseline and seat 1 black from the top; the queen must be
// covered; a man of yours down keeps your turn going; the striker down is a foul.
import { shotError, simulate, colourIds, layout, freeSpot, freeXs, MEN } from "./carrom-engine.js";
import { LEVEL_NAMES, chooseShot } from "./carrom-bot.js";

export { LEVEL_NAMES };

const other = seat => 1 - seat;
const down = (s, i) => s.st[i] > 0;

/** The men of a colour that are down, and how many are left on the table. */
export const downOf = (s, seat) => colourIds(seat).filter(i => down(s, i));
export const leftOf = (s, seat) => colourIds(seat).filter(i => !down(s, i));

/** The colours by seat. */
export const NAME = ["White", "Black"];

export const rules = {
  id: "carrom",
  seats: { min: 2, max: 2 },

  deal({ options = {}, prev }) {
    const { x, y } = layout();
    // who breaks: set by the menu, else the other from last game (white the first time)
    const first = options.first === 0 || options.first === 1 ? options.first : prev && Number.isInteger(prev.first) ? other(prev.first) : 0;
    return {
      px: x, py: y, st: new Array(MEN).fill(0), n: 0, first, turn: first, queen: 0, qs: 0, shots: 0,
      last: null, over: false, winner: -1, points: 0,
    };
  },

  toMove: s => (s.over ? null : s.turn),
  over: s => !!s.over,

  /** The database keeps no empty lists, and may leave a hole in a list. */
  restore(s) {
    for (const k of ["px", "py", "st"]) s[k] = Array.from({ length: MEN }, (_, i) => Number(s[k]?.[i]) || 0);
    if (s.last) { s.last.pocketed ||= []; s.last.returned ||= []; }
    return s;
  },

  act(s, seat, move) {
    if (move && move.pass) {
      if (freeXs(seat, s.px, s.py, s.st).length) return "The striker can stand somewhere";
      s.turn = other(seat);
      s.last = { seat, shot: null, pocketed: [], returned: [], foul: false, pass: true };
      return s;
    }
    const err = shotError(move, seat, s.px, s.py, s.st);
    if (err) return err;
    const shot = { x: move.x, ax: move.ax, ay: move.ay, p: move.p };
    const sim = simulate(s.px, s.py, s.st, shot, seat);
    // the men where they came to rest; the ones that went down, in the order they fell
    const pocketed = [];
    for (const e of sim.events) if (e.id < MEN) pocketed.push(e.id);
    for (let i = 0; i < MEN; i++) if (!down(s, i)) { s.px[i] = sim.x[i]; s.py[i] = sim.y[i]; }
    return settle(s, seat, shot, pocketed, sim.strikerDown, sim.steps);
  },

  /** A computer player's shot (carrom-bot.js samples shots by playing them). */
  bot(s, seat, { level, rng }) {
    return chooseShot(s, seat, level || "medium", rng);
  },
};

/**
 * What a shot that pocketed `pocketed` (men, in the order they fell) and, if `foul`, the striker, does to the game: the men down,
 * the queen's fate, the men that come back, whose turn it is, whether the board is won. s has the men already at rest.
 */
export function settle(s, seat, shot, pocketed, foul, steps = 0) {
  for (const i of pocketed) { s.st[i] = ++s.n; s.px[i] = 0; s.py[i] = 0; }

  const mine = new Set(colourIds(seat));
  const ownNow = pocketed.filter(i => mine.has(i));
  const returned = [];
  const bringBack = i => {
    s.st[i] = 0;
    const [fx, fy] = freeSpot(s.px, s.py, s.st, i);
    s.px[i] = fx; s.py[i] = fy;
    returned.push(i);
  };

  // a queen down from the shot before (this turn) is covered by a man of yours now, or goes back
  if (s.queen === 1 && s.qs === seat) {
    if (ownNow.length && !foul) s.queen = 2;
    else { s.queen = 0; bringBack(0); }
  }
  // a queen down just now
  if (pocketed.includes(0)) {
    if (foul) { s.queen = 0; bringBack(0); }
    else if (ownNow.length) { s.queen = 2; s.qs = seat; }
    else { s.queen = 1; s.qs = seat; }
  }

  if (foul) {
    // one of yours comes back: the one that went down last (this shot's included)
    const mineDown = downOf(s, seat).sort((a, b) => s.st[b] - s.st[a]);
    if (mineDown.length) bringBack(mineDown[0]);
  }

  // the last man of a colour cannot go down before the queen is settled: it comes back
  for (const c of [seat, other(seat)]) {
    if (s.queen !== 2 && colourIds(c).every(i => down(s, i))) {
      const last = colourIds(c).sort((a, b) => s.st[b] - s.st[a])[0];
      bringBack(last);
    }
  }

  // your turn goes on while a man of yours stays down, or the queen waits for its cover; a foul ends it
  const carryOn = !foul && (ownNow.some(i => down(s, i)) || (s.queen === 1 && s.qs === seat));
  s.shots++;
  s.last = { seat, shot, pocketed, returned, foul, queen: s.queen, steps };

  // a colour with all its men down has won (the shooter's, if both went on the same shot)
  const cleared = [0, 1].filter(c => colourIds(c).every(i => down(s, i)));
  if (cleared.length) {
    s.over = true;
    s.winner = cleared.includes(seat) ? seat : cleared[0];
    s.points = leftOf(s, other(s.winner)).length + (s.queen === 2 && s.qs === s.winner ? 3 : 0);
    return s;
  }
  s.turn = carryOn ? seat : other(seat);
  return s;
}
