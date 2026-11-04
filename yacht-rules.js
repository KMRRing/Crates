// Yacht (yacht.html): the five-dice game, in its old public-domain form (a commercial version of it carries a trademark,
// and that name is written nowhere in this game). Twelve rounds; in each, a player rolls five dice up to three times, holding any
// they like between rolls, then writes the result in one category of their score sheet, each category once:
//   Ones to Sixes   the sum of the dice showing that face; 63 or more in all six earns a bonus of 35
//   Full house      three of one face and two of another (not five alike): the sum of all five dice
//   Four of a kind  at least four alike: the sum of all five dice
//   Little straight 1-2-3-4-5: 30        Big straight 2-3-4-5-6: 30
//   Choice          any five dice: the sum
//   Yacht           five alike: 50
// A category may be taken for 0 when nothing fits. The highest total wins.
//
// A game is a module of seats.js: deal, toMove, act, bot (yacht-bot.js), over, restore. The dice are not drawn from the
// move's own stream but from the game's base and the place of the die (whose turn, which roll, which die), so the same
// base gives the same dice to anyone however they hold: that is what makes the daily comparable.
import { mix, seeded } from "./seats.js";
import { botMove } from "./yacht-bot.js";

export const ROUNDS = 12;
export const BONUS_AT = 63, BONUS = 35;
export const CATS = [
  { id: "ones", name: "Ones", face: 1 }, { id: "twos", name: "Twos", face: 2 }, { id: "threes", name: "Threes", face: 3 },
  { id: "fours", name: "Fours", face: 4 }, { id: "fives", name: "Fives", face: 5 }, { id: "sixes", name: "Sixes", face: 6 },
  { id: "house", name: "Full house" }, { id: "four", name: "Four of a kind" },
  { id: "little", name: "Little straight" }, { id: "big", name: "Big straight" },
  { id: "choice", name: "Choice" }, { id: "yacht", name: "Yacht" },
];
export const HOUSE = 6, FOUR = 7, LITTLE = 8, BIG = 9, CHOICE = 10, YACHT = 11;
export const CAT_HELP = [
  "Add up the ones", "Add up the twos", "Add up the threes", "Add up the fours", "Add up the fives", "Add up the sixes",
  "Three alike and two alike: all five added", "At least four alike: all five added", "1-2-3-4-5: 30", "2-3-4-5-6: 30", "Any dice: all five added", "Five alike: 50",
];
export const DEFAULTS = { daily: 0 };

export const countsOf = dice => { const c = [0, 0, 0, 0, 0, 0, 0]; for (const d of dice) c[d]++; return c; };
const sum = dice => dice.reduce((a, b) => a + b, 0);

/** What five dice score in a category (their face-value rules; 0 when they don't fit). */
export function scoreOf(c, dice) {
  const n = countsOf(dice);
  if (c < 6) return n[c + 1] * (c + 1);
  switch (c) {
    case HOUSE: return n.includes(3) && n.includes(2) ? sum(dice) : 0;
    case FOUR: return n.some(x => x >= 4) ? sum(dice) : 0;
    case LITTLE: return [1, 2, 3, 4, 5].every(f => n[f]) ? 30 : 0;
    case BIG: return [2, 3, 4, 5, 6].every(f => n[f]) ? 30 : 0;
    case CHOICE: return sum(dice);
    case YACHT: return n.includes(5) ? 50 : 0;
    default: return 0;
  }
}

/** A score sheet (12 numbers, -1 where a category is still open): the upper total, the bonus and the total. */
export function totals(sheet) {
  const upper = sheet.slice(0, 6).reduce((a, v) => a + Math.max(0, v), 0);
  const bonus = upper >= BONUS_AT ? BONUS : 0;
  const lower = sheet.slice(6).reduce((a, v) => a + Math.max(0, v), 0);
  return { upper, bonus, total: upper + bonus + lower };
}
export const openOf = sheet => sheet.map((v, c) => (v < 0 ? c : -1)).filter(c => c >= 0);

/** The die at a place in the game's sequence: 1 to 6 from the base, the turn (round and seat), the roll and the die. */
export const dieAt = (base, round, seat, roll, i) => 1 + Math.floor(seeded(mix(mix(base, round * 8 + seat), roll * 8 + i))() * 6);

const seatsDone = s => s.sheets.every(sh => sh.every(v => v >= 0));
const blank = () => [0, 0, 0, 0, 0];

function startTurn(s, seat) {
  s.turn = seat;
  s.left = 3;
  s.dice = blank();
  s.held = blank();
}

export const rules = {
  id: "yacht",
  seats: { min: 1, max: 4 },

  deal({ seats, options = {}, rng }) {
    const daily = Number(options.daily) || 0;
    const s = {
      seats: daily ? 1 : seats, opts: { daily }, base: daily ? mix(daily, 0x59414348) : Math.floor(rng() * 4294967296) >>> 0,
      sheets: Array.from({ length: daily ? 1 : seats }, () => Array(12).fill(-1)), step: "play", last: null,
    };
    startTurn(s, 0);
    return s;
  },

  toMove: s => (s.step === "play" ? s.turn : null),

  act(s, seat, m) {
    const round = s.sheets[seat].filter(v => v >= 0).length;
    if (m?.t === "roll" || m?.t === "hold") {
      const keep = Array.isArray(m.hold) && m.hold.length === 5 ? m.hold.map(v => (v ? 1 : 0)) : null;
      if (m.t === "hold") {
        if (s.left === 3) return "Roll first";
        if (!keep) return "Hold which dice?";
        s.held = keep;
        return s;
      }
      if (s.left === 0) return "No rolls left: write the dice in a category";
      if (s.left < 3 && keep) s.held = keep;
      if (s.left === 3) s.held = blank();
      const roll = 4 - s.left;                                                  // 1, 2 or 3
      if (s.held.every(Boolean)) return "Let at least one die go to roll";
      s.dice = s.dice.map((d, i) => (s.held[i] ? d : dieAt(s.base, round, seat, roll, i)));
      s.left--;
      return s;
    }
    if (m?.t === "score") {
      const c = m.c;
      if (s.left === 3) return "Roll first";
      if (!Number.isInteger(c) || c < 0 || c > 11) return "Which category?";
      if (s.sheets[seat][c] >= 0) return "That category is taken";
      const pts = scoreOf(c, s.dice);
      s.sheets[seat][c] = pts;
      s.last = { seat, c, pts, dice: [...s.dice] };
      if (seatsDone(s)) { s.step = "over"; s.dice = blank(); s.held = blank(); s.left = 0; return s; }
      startTurn(s, (seat + 1) % s.seats);
      return s;
    }
    return "Roll, hold or score";
  },

  bot: (s, seat, ctx) => botMove(s, seat, ctx),
  over: s => s.step === "over",
  restore(s) {
    s.dice ||= blank();
    s.held ||= blank();
    return s;
  },
};

/** Who won: every seat with the top total. */
export function winners(s) {
  const t = s.sheets.map(sh => totals(sh).total), top = Math.max(...t);
  return t.map((v, i) => (v === top ? i : -1)).filter(i => i >= 0);
}
/** The turns each seat has played (rounds finished). */
export const roundOf = (s, seat) => s.sheets[seat].filter(v => v >= 0).length;
