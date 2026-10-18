// Hold'em's computer players. Before the flop a hand is weighed by Bill Chen's count (a rank's points, doubled for a pair,
// two for suited, less for a gap) against where the player sits and what has been bet: raise the strong ones, open
// wider the nearer the button, call a raise only with a hand worth its price, fight back against a re-raise only with the
// best, and with few chips push in or fold. After the flop a player counts how often its hand would win against hands
// dealt at random to everyone still in (holdem-eval.js's vsRandom), makes it worth less the bigger the bet it faces
// (whoever bets has more than a random hand), and sets that against the price the pot offers (pot odds: what it costs to
// call over the pot it would win): call when the hand wins more often than it must, bet and raise for value when it wins
// a good deal more, and now and then bet a hand that won't win, to take the pot. A computer player knows only what its
// seat may: its own cards, the board turned up, and what everyone has bet.
//   Hard weighs all of it and bluffs now and then; Medium is a little tighter and bluffs less; Easy is a calling
//   station: it plays too many hands, calls too often, and bets only the best.
import { vsRandom } from "./holdem-eval.js";
import { alive, legal, placeOf, sizeTo, BLINDS } from "./holdem-rules.js";

export const LEVELS = {
  hard: { samples: 500, shrink: 0.8, margin: 0.02, value: 0.66, raise: 0.8, bluff: 0.2, loose: 0, trap: 0.15, rebet: 11 },
  medium: { samples: 250, shrink: 0.45, margin: 0.04, value: 0.7, raise: 0.85, bluff: 0.08, loose: 0, trap: 0.1, rebet: 10 },
  easy: { samples: 80, shrink: 0, margin: -0.06, value: 0.8, raise: 1.1, bluff: 0, loose: 2.5, trap: 0, rebet: 8 },
};
export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];

const rankOf = id => id >> 2, suitOf = id => id & 3;
/** Bill Chen's count of a starting hand: AA 20, KK 16, AKs 12, 72o −1 (rounded up). */
export function chen(hole) {
  const [a, b] = hole.map(rankOf), hi = Math.max(a, b), lo = Math.min(a, b);
  const pts = r => (r === 12 ? 10 : r === 11 ? 8 : r === 10 ? 7 : r === 9 ? 6 : (r + 2) / 2);
  if (hi === lo) return Math.ceil(Math.max(5, 2 * pts(hi)));
  let sc = pts(hi);
  if (suitOf(hole[0]) === suitOf(hole[1])) sc += 2;
  const gap = hi - lo - 1;
  sc -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5;
  if (gap <= 1 && hi < 10) sc += 1;                             // both below a queen and close: the straight chances
  return Math.ceil(sc);
}

/** A raise to `to` as the move, all in when it would leave too little behind. */
function raiseTo(s, seat, me, to) {
  const left = me.maxTo - to;
  return { t: "raise", to: left < Math.max(BLINDS.big, 0.35 * (me.pot + to)) ? me.maxTo : Math.min(me.maxTo, Math.max(me.minTo, to)) };
}

/**
 * A computer player's move. `equity`, `samples` and `tune` are for the coach, which plays hands out against these rules many
 * times over: it gives the count of chances a faster, remembered one (the same cards, board and opponents, the same number),
 * and may change a level's settings for the seat it speaks for.
 */
export function botMove(s, seat, { level = "hard", rng = Math.random, samples = null, equity = vsRandom, tune = null } = {}) {
  const L = { ...(LEVELS[level] || LEVELS.hard), ...tune }, me = legal(s, seat), hole = s.hole[seat];
  const foes = alive(s).filter(i => i !== seat);
  const stack = s.stacks[seat], bb = BLINDS.big;
  const fold = () => (me.canCheck ? { t: "check" } : { t: "fold" });

  // ---------- before the flop ----------
  if (s.seen === 0) {
    const c = chen(hole) + L.loose, place = placeOf(s, seat), toCallBB = me.toCall / bb;
    const late = place === "button" || place === "button and small blind" || place === "cutoff";
    // a hand worth a stack calls an all-in: the price rules below turn every shove down, aces included
    if (me.toCall && !me.canRaise && c >= 12) return { t: "call" };
    // the least a hand must count to open the betting from each place: the nearer the button the wider
    const open = place === "button" || place === "button and small blind" ? 5.5 : place === "cutoff" ? 6.5 : place === "small blind" ? 7 : place === "hijack" ? 7.5 : place === "big blind" ? 99 : 8.5;
    if (me.maxTo <= 15 * bb) {                                  // fifteen big blinds or fewer: all in or out
      if (c >= (s.raises ? 10 : 7.5) && me.canRaise) return { t: "raise", to: me.maxTo };
      if (me.toCall && c >= 9) return { t: "call" };
      return fold();
    }
    if (s.raises === 0) {                                       // nobody has raised: open, limp or check
      const limps = foes.filter(i => s.last[i].startsWith("call")).length;
      if (c >= 10 + (level === "hard" ? 0 : 1) && me.canRaise) return raiseTo(s, seat, me, (3 + limps) * bb);
      if (c >= open && me.canRaise && (level !== "easy" || rng() < 0.2)) return raiseTo(s, seat, me, (late ? 2.5 : 3) * bb + limps * bb);
      if (!me.toCall) return { t: "check" };
      if (c >= 3 && me.toCall <= bb && (level === "easy" || c >= open - 2)) return { t: "call" };   // limp in cheaply
      return { t: "fold" };
    }
    if (s.raises >= 2) {                                        // a raise has been raised
      if (c >= 16 && me.canRaise) return { t: "raise", to: me.maxTo };
      if (c >= 12 && toCallBB <= 0.25 * (stack + me.toCall) / bb) return rng() < 0.4 && me.canRaise && level !== "easy" ? raiseTo(s, seat, me, 3 * s.bet) : { t: "call" };
      if (c >= L.rebet && toCallBB <= 12) return { t: "call" };
      if (level === "hard" && c >= 8 && c < 11 && me.canRaise && rng() < L.bluff * 0.5 && foes.length <= 2) return raiseTo(s, seat, me, 3 * s.bet);   // a light re-raise now and then
      return fold();
    }
    // one raise, to me
    if (c >= 14 && me.canRaise) return raiseTo(s, seat, me, 3.2 * s.bet);
    if (c >= 11 && me.canRaise && rng() < 0.6) return raiseTo(s, seat, me, 3 * s.bet);
    if (c >= 9 + (place === "big blind" ? -1.5 : 0) - (late ? 1 : 0) && toCallBB <= 7 + c) return { t: "call" };
    if (c >= 6.5 - (place === "big blind" ? 1 : 0) && toCallBB <= 3.5 && (level === "easy" || place === "big blind" || late)) return { t: "call" };
    if (level === "hard" && late && c >= 6 && c < 9 && me.canRaise && rng() < L.bluff * 0.4 && foes.length <= 2) return raiseTo(s, seat, me, 3 * s.bet);
    return fold();
  }

  // ---------- after the flop ----------
  const board = s.board.slice(0, s.seen);
  const eq = equity(hole, board, foes.length, { rng, samples: samples ?? L.samples });
  const potBefore = Math.max(1, me.pot - me.toCall), bet = me.toCall / potBefore;   // the bet faced, as a share of the pot before it
  // whoever bets or raises holds more than a random hand: the bigger the bet, the less the hand is worth
  const eAdj = me.toCall ? Math.pow(eq, 1 + L.shrink * Math.min(bet, 1.5)) : eq;
  const spr = me.maxTo / Math.max(1, me.pot);                                         // chips left against the pot
  if (!me.toCall) {                                                                    // first to bet, or checked to
    const need = L.value + 0.03 * (foes.length - 1);
    if (eq >= need && me.canRaise && !(rng() < L.trap)) return raiseTo(s, seat, me, sizeTo(s, seat, me, eq > 0.85 ? 0.75 : 0.55));
    if (eq >= need + 0.12 && me.canRaise) return raiseTo(s, seat, me, sizeTo(s, seat, me, 0.4));   // a monster, slow-played this time
    if (me.canRaise && foes.length <= 2 && eq < 0.5 && eq > 0.22 && rng() < L.bluff) return raiseTo(s, seat, me, sizeTo(s, seat, me, 0.5));
    return { t: "check" };
  }
  // facing a bet
  if (me.canRaise && eAdj >= L.raise && eq >= 0.7 && (rng() < 0.7 || spr < 1.5)) return raiseTo(s, seat, me, sizeTo(s, seat, me, 0.9));
  if (eAdj >= me.odds + L.margin) return { t: "call" };
  if (me.canRaise && level === "hard" && foes.length === 1 && eq > 0.25 && eq < 0.45 && s.seen < 5 && rng() < L.bluff * 0.3) return raiseTo(s, seat, me, sizeTo(s, seat, me, 0.9));   // a semi-bluff with a draw
  return { t: "fold" };
}
