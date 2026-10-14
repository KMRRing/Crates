// Gammon's board, its moves and its plays, with nothing of the game round it (the match, the cube, the turns are
// gammon-rules.js's; the computer's judgement gammon-bot.js's), so both can use it.
//
// Each side's checkers are counted in its own numbering: pos[i] for i 1..24 is how many of its checkers stand on its
// point i (24 the farthest from home, 1 the last before bearing off), [25] its bar and [0] those borne off. The other
// side's checkers on my point i are on its point 25 − i. A move is [from, to] in the mover's numbering (25 the bar, 0
// off), with the die it used.
/** The start: two on the 24, five on the 13, three on the 8, five on the 6. */
export const start = () => { const p = Array(26).fill(0); p[24] = 2; p[13] = 5; p[8] = 3; p[6] = 5; return p; };
export const pips = p => p.reduce((a, n, i) => a + n * i, 0);
export const allHome = me => me[25] === 0 && me.slice(7, 25).every(n => !n);

/** The single moves one die allows. */
export function singles(me, op, d) {
  const out = [];
  if (me[25] > 0) { if (op[d] < 2) out.push([25, 25 - d]); return out; }          // entering: its point 25 − d is their d
  const home = allHome(me);
  let highest = 0;
  if (home) for (let k = 6; k >= 1; k--) if (me[k]) { highest = k; break; }
  for (let from = 24; from >= 1; from--) {
    if (!me[from]) continue;
    const to = from - d;
    if (to >= 1) { if (op[25 - to] < 2) out.push([from, to]); }
    else if (home && (to === 0 || from === highest)) out.push([from, 0]);         // off exactly, or the highest with more
  }
  return out;
}
/** A move made, on copies: the mover's checkers and the other's (a blot hit goes to its bar). */
export function apply(me, op, [from, to]) {
  const m = me.slice(), o = op.slice();
  m[from]--;
  if (to === 0) m[0]++;
  else {
    if (o[25 - to] === 1) { o[25 - to] = 0; o[25]++; }
    m[to]++;
  }
  return [m, o];
}
export const keyOf = (me, op) => `${me.join(",")}|${op.join(",")}`;

/**
 * Every legal play for a roll: each a list of moves [from, to, die] and the position after it. The most dice that can
 * be used must be; of two different dice, if only one can be, the larger where it can. Each order of the same moves is
 * kept (a play on a phone is made a move at a time, in any order), with `unique` marking one play for each position.
 */
export function plays(me, op, dice) {
  const dbl = dice[0] === dice[1], seqs = [];
  const rec = (m, o, left, moves) => {
    let moved = false;
    const tried = new Set();
    for (let i = 0; i < left.length; i++) {
      const d = left[i];
      if (tried.has(d)) continue;
      tried.add(d);
      for (const mv of singles(m, o, d)) {
        moved = true;
        const [m2, o2] = apply(m, o, mv);
        rec(m2, o2, [...left.slice(0, i), ...left.slice(i + 1)], [...moves, [mv[0], mv[1], d]]);
      }
    }
    if (!moved) seqs.push({ moves, me: m, op: o });
  };
  rec(me, op, dbl ? [dice[0], dice[0], dice[0], dice[0]] : [dice[0], dice[1]], []);
  const most = Math.max(...seqs.map(s => s.moves.length));
  let legal = seqs.filter(s => s.moves.length === most);
  if (!dbl && most === 1) {
    const big = Math.max(...dice);
    if (legal.some(s => s.moves[0][2] === big)) legal = legal.filter(s => s.moves[0][2] === big);
  }
  const seen = new Set();
  for (const s of legal) { const k = keyOf(s.me, s.op); s.unique = !seen.has(k); seen.add(k); }
  return legal;
}
/** Whether the side has any checker left to bear off (0 when it has won). */
export const won = me => me[0] === 15;
/** A game won: 1 single, 2 a gammon (none of theirs off), 3 a backgammon (and one still on the bar or in the winner's home). */
export function kindOf(winner, loser) {
  if (loser[0] > 0) return 1;
  return loser[25] > 0 || loser.slice(19, 25).some(n => n) ? 3 : 2;
}
