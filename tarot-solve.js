// An exhaustive search of the last tricks with every hand known (double dummy): what the attack side takes from here
// whatever the defence does, and the defence the least it can. The course's puzzles are proved with it, so a lesson never
// teaches a card the cards don't bear out. Points in half-points, as the rules count them; the Excuse and the petit au
// bout's bonus are left out (a puzzle with the Excuse is not one to search).
import { legalCards, winnerOf, PTS, EXCUSE } from "./tarot-rules.js";

/**
 * hands: the cards each seat still holds (not those already in `plays`); att: the seats on the attack side; lead: who leads (or, with `plays`, who led the trick
 * under way); plays: the trick so far [{ seat, card }]. Returns [{ card, value }] for the seat to move: value = the
 * attack's half-points from the cards still to be played, both sides playing as well as they can (the trick under way
 * counts), best first for that seat.
 */
export function solve({ hands, att, lead, plays = [] }) {
  const n = hands.length, isAtt = new Set(att);
  if (hands.some(h => h.includes(EXCUSE))) throw new Error("the search does not take the Excuse");
  const h = hands.map(x => [...x]);
  // value of the rest from the position: hands, the trick so far and who leads it
  function go(trick, ledBy, alpha, beta) {
    if (trick.length === n) {
      const w = trick[winnerOf(trick)].seat, pts = trick.reduce((t, p) => t + PTS[p.card], 0);
      const gain = isAtt.has(w) ? pts : 0;
      if (h.every(x => !x.length)) return gain;
      return gain + go([], w, alpha - gain, beta - gain);
    }
    const seat = (ledBy + trick.length) % n, mine = isAtt.has(seat);
    let best = mine ? -1 : 1e9;
    for (const c of [...legalCards(h[seat], trick)]) {
      h[seat].splice(h[seat].indexOf(c), 1);
      trick.push({ seat, card: c });
      const v = go(trick, ledBy, alpha, beta);
      trick.pop();
      h[seat].push(c);
      if (mine) { if (v > best) best = v; if (best > alpha) alpha = best; } else { if (v < best) best = v; if (best < beta) beta = best; }
      if (alpha >= beta) break;
    }
    return best;
  }
  const seat = (lead + plays.length) % n, mine = isAtt.has(seat), out = [];
  for (const c of [...legalCards(h[seat], plays)]) {
    h[seat].splice(h[seat].indexOf(c), 1);
    // each card on its own full window, so the values compare exactly
    out.push({ card: c, value: go([...plays, { seat, card: c }], lead, -1, 1e9) });
    h[seat].push(c);
  }
  return out.sort((a, b) => (mine ? b.value - a.value : a.value - b.value));
}
