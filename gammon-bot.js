// Gammon's computer player: a judgement of a position (my chances of winning it, with the other side to roll), and the
// play chosen by it. Easy picks among the better plays with a wobble; Medium plays the best by the judgement; Hard
// looks a roll further, the other side's best answer to each of its 21 rolls, for the plays that judged best.
//
// The judgement is hand-made, not learnt: in a race, the pip counts (the side to roll worth about four pips); in
// contact, the pips and what a backgammon player weighs: points made (the home board's, the bar point, an anchor in
// the other's home), primes and the checkers trapped behind them, blots and the shots at them (counted over all 36
// rolls) and what being hit there costs, checkers on the bar, stacks.
import { plays, pips } from "./gammon-board.js";

export const LEVEL_NAMES = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
// a made point's worth, by where it stands in my numbering: the home board's 4 and 5 most, the bar point (7), an anchor
// on the other's 5 or 4 point (my 20, 21)
const POINT = [0, 0.04, 0.06, 0.08, 0.12, 0.14, 0.12, 0.1, 0.06, 0.04, 0.03, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.03, 0.07, 0.05, 0.1, 0.08, 0.05, 0.03, 0.03];
const PRIME = [0, 0, 0, 0.03, 0.08, 0.16, 0.3];
const ROLLS = [];
for (let a = 1; a <= 6; a++) for (let b = a; b <= 6; b++) ROLLS.push([a, b, a === b ? 1 : 2]);

/** Whether the two sides can still meet: my farthest checker hasn't passed the other's farthest. */
export function contact(me, op) {
  let mine = 0, theirs = 0;
  for (let i = 25; i >= 1; i--) if (me[i]) { mine = i; break; }
  for (let i = 25; i >= 1; i--) if (op[i]) { theirs = i; break; }
  return mine + theirs > 25;
}
const madeHome = side => { let n = 0; for (let i = 1; i <= 6; i++) if (side[i] >= 2) n++; return n; };

/** Of the 36 rolls, how many let the other side hit my blot on my point i (their checkers move up my numbering). */
function shotsAt(i, me, op) {
  const from = [];
  if (op[25]) from.push(0);                                   // from their bar they enter onto my points 1–6
  for (let k = 1; k < i; k++) if (op[25 - k]) from.push(k);
  if (!from.length) return 0;
  const open = k => k > 0 && k < 25 && me[k] < 2;
  let n = 0;
  for (const [a, b, w] of ROLLS) {
    let hit = false;
    for (const k of from) {
      const gap = i - k;
      if (a === b) {
        for (let s = 1; s <= 4; s++) { const at = k + a * s; if (at === i) { hit = true; break; } if (at > i || !open(at)) break; }
      }
      else if (gap === a || gap === b) hit = true;
      else if (gap === a + b && (open(k + a) || open(k + b))) hit = true;
      if (hit) break;
    }
    if (hit) n += w;
  }
  return n;
}

/** My chances of winning (0 to 1) with this position after my move, the other side to roll. */
export function judge(me, op) {
  if (me[0] === 15) return 1;
  if (op[0] === 15) return 0;
  const myPips = pips(me), opPips = pips(op);
  if (!contact(me, op)) {
    // a race: the other side, on roll, is worth about four pips more; a lead counts for more in a short race
    const lead = opPips - 4 - myPips, x = (3 * lead) / Math.sqrt(myPips + opPips + 1);
    return 1 / (1 + Math.exp(-x));
  }
  let v = (opPips - myPips) * 0.011;
  for (let i = 1; i <= 24; i++) if (me[i] >= 2) v += POINT[i];
  for (let i = 1; i <= 24; i++) if (op[i] >= 2) v -= POINT[i];
  v += primeWorth(me, op) - primeWorth(op, me);
  const theirHome = madeHome(op), myHome = madeHome(me);
  // blots: the shots at each, and what a hit costs there (far from home and against a strong board, more)
  for (let i = 1; i <= 24; i++) if (me[i] === 1) {
    const s = shotsAt(i, me, op);
    if (s) v -= (s / 36) * (0.12 + (25 - i) * 0.006) * (1 + theirHome * 0.15);
  }
  v += op[25] * 0.05 * (myHome / 6 + 0.3) - me[25] * 0.05 * (theirHome / 6 + 0.3);
  for (let i = 1; i <= 12; i++) if (me[i] > 3) v -= (me[i] - 3) * 0.008;
  return 1 / (1 + Math.exp(-2.4 * v));
}
/** The longest run of made points, and more when the other side has checkers behind it. */
function primeWorth(me, op) {
  let best = 0, end = 0, run = 0;
  for (let i = 1; i <= 24; i++) { run = me[i] >= 2 ? run + 1 : 0; if (run > best) { best = run; end = i; } }
  if (best < 3) return 0;
  const startAt = end - best + 1;
  let behind = op[25];                                        // their checkers below my prime, in my numbering
  for (let k = 1; k < startAt; k++) behind += op[25 - k];
  return PRIME[Math.min(6, best)] * (behind ? 1.5 : 0.6);
}

/** The play to make: its moves, as [from, to]. */
export function botTurn(me, op, dice, { level = "medium", rng = Math.random } = {}) {
  const legal = plays(me, op, dice).filter(p => p.unique);
  if (!legal[0].moves.length) return [];
  const scored = legal.map(p => ({ p, v: judge(p.me, p.op) })).sort((a, b) => b.v - a.v);
  let pick = scored[0];
  if (level === "easy") {
    // a wobble on each judgement: sometimes the second or third best, now and then worse
    pick = scored.map(x => ({ ...x, w: x.v + (rng() - 0.5) * 0.25 })).sort((a, b) => b.w - a.w)[0];
  } else if (level === "hard" && scored.length > 1) {
    // a roll further for the few that judged best: the other side's best answer to each roll, averaged
    let best = -1;
    for (const c of scored.slice(0, 4)) {
      let sum = 0;
      for (const [a, b, w] of ROLLS) {
        const answers = plays(c.p.op, c.p.me, [a, b]).filter(p => p.unique);
        let theirs = 0;
        for (const r of answers) theirs = Math.max(theirs, judge(r.me, r.op));
        sum += w * (1 - theirs);
      }
      const v = sum / 36;
      if (v > best) { best = v; pick = c; }
    }
  }
  return pick.p.moves.map(m => [m[0], m[1]]);
}

/** My chances on roll, before the dice: the judgement of the position as if the other side had just moved. */
export const onRoll = (me, op) => 1 - judge(op, me);
/** Whether to offer the cube: strong enough that a take is a mistake to come, and not so strong it should play on for a gammon. */
export function botCube(s, seat, level = "medium") {
  if (level === "easy") return false;
  const p = onRoll(s.pos[seat], s.pos[1 - seat]);
  return p >= 0.7 && p < 0.9;
}
/** Whether to take: a fair chance left (about a quarter is the line). */
export function botTake(s, seat) {
  return 1 - onRoll(s.pos[1 - seat], s.pos[seat]) >= 0.24;
}
