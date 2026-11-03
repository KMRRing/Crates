// Pipes on a solid: the solver that proves a level has its answer (and how many), as pipes-puzzle-solve.js does for the flat
// Puzzle. It runs the oil from the wellhead and, at every empty tile, tries each kind of the hand that takes the oil in and
// each way that kind can turn it, so every route it finds uses the hand exactly, passes all the old pipe and the stakes in
// order, and ends in the terminal's inlet. Used by the generator and tests/pipes-solid.mjs; no page loads it.
import { KINDS, across, channelOf, exitsOf, pieceJoining } from "./pipes-solid.js";

/** Every route that solves L, up to `cap`: { routes: ["0123…"], nodes, capped, aborted }. */
export function solve(L, cap = 2, limit = 4e6) {
  const S = L.S, n = S.count, hand = { ...L.hand };
  const filled = new Uint8Array(n), placed = Array(n).fill(null), dirs = [], routes = [];
  // tiles between each tile and the terminal's way in, for the prune "the oil can't reach the terminal with the pieces left"
  const [goal] = across(L, L.terminal.c, L.terminal.d), dist = new Int16Array(n).fill(-1), q = [goal];
  dist[goal] = 0;
  for (let i = 0; i < q.length; i++) for (const [t] of S.tiles[q[i]].nb) if (dist[t] < 0) { dist[t] = dist[q[i]] + 1; q.push(t); }
  const doubles = (L.hand.x || 0) + L.cells.filter(f => f?.k === "old" && f.piece[0] === "x").length;
  let nodes = 0, left = L.total, oldsLeft = L.olds, nextStake = 1, aborted = false;
  const kinds = KINDS.filter(k => L.hand[k]);

  function go(c, a) {
    if (aborted || routes.length >= cap) return;
    if (++nodes > limit) { aborted = true; return; }
    const f = L.cells[c];
    if (f) {
      if (f.k === "terminal") { if (f.d === a && !left && !oldsLeft && nextStake === L.stakes.length + 1) routes.push(dirs.join("")); return; }
      if (f.k !== "old") return;
    }
    if (dist[c] + 1 > left + oldsLeft + doubles) return;
    const stake = L.stakeAt[c], first = !filled[c];
    if (stake && first && stake !== nextStake) return;
    const T = S.tiles[c];
    const step = (ch, isOld) => {
      filled[c] |= 1 << ch.i;
      dirs.push(ch.out);
      if (stake && first) nextStake++;
      if (isOld && first) oldsLeft--;
      const [next, side] = T.nb[ch.out];
      go(next, side);
      if (isOld && first) oldsLeft++;
      if (stake && first) nextStake--;
      dirs.pop();
      filled[c] &= ~(1 << ch.i);
    };
    if (f) { const ch = channelOf(T.n, f.piece, a); if (ch && !(filled[c] & (1 << ch.i))) step(ch, true); return; }
    if (placed[c]) {                                           // a crossing laid on the way in, passed the other way
      if (placed[c] !== "x0") return;
      const ch = channelOf(T.n, "x0", a);
      if (!(filled[c] & (1 << ch.i))) step(ch, false);
      return;
    }
    for (const k of kinds) {
      if (!hand[k]) continue;
      for (const b of exitsOf(T.n, k, a)) {
        const piece = k === "x" ? "x0" : pieceJoining(T.n, a, b);
        hand[k]--; left--; placed[c] = piece;
        step(channelOf(T.n, piece, a), false);
        hand[k]++; left++; placed[c] = null;
      }
    }
  }
  const [first, side] = across(L, L.source.c, L.source.d);
  go(first, side);
  return { routes, nodes, capped: routes.length >= cap || aborted, aborted };
}
