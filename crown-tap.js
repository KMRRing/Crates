// How a move is made by taps, for the game's page and the course's stage alike (pure, so it is tested in Node). A move is a
// piece picked up and then its landing squares: a step is one tap on the square; a jump is a tap on each landing in turn, or
// on the last square only when that is where just one move ends. A piece that is part-way along a run of jumps is the
// square it has reached; tapping that square again stops there when a move may end there.

/** Where the piece in hand may go: the moves that begin with the squares visited, the next landings and the squares a move may end on. */
export function inHand(list, ui) {
  if (ui.sel == null) return { cands: [], hops: [], ends: [], P: [], n: 0 };
  const P = [ui.sel, ...ui.partial], n = P.length;
  const cands = list.filter(m => m.path.length > n && P.every((q, i) => m.path[i] === q));
  return {
    cands, P, n,
    hops: [...new Set(cands.map(m => m.path[n]))],
    ends: [...new Set(cands.map(m => m.path[m.path.length - 1]))],
  };
}

/** The pieces that must jump: the squares of the pieces with a jump to make, when a jump is compulsory. */
export const mustSquares = list => (list.length && list[0].caps.length ? [...new Set(list.map(m => m.path[0]))] : []);

/**
 * A tap on square `sq`: the state of the piece in hand after it, and what the tap did. ui: { sel, partial };
 * list: the legal moves; mine(sq): whether a piece of the side to move stands there.
 * Returns { ui, play (the path of a move made), say (words for the player), flash (show the pieces that must jump) }.
 */
export function tapSquare(list, ui, sq, mine) {
  const same = { sel: ui.sel, partial: ui.partial.slice() }, own = mine(sq);
  if (ui.sel == null || (own && !ui.partial.length)) {
    if (!own) return { ui: { sel: null, partial: [] } };
    if (ui.sel === sq) return { ui: { sel: null, partial: [] } };
    if (!list.some(m => m.path[0] === sq)) {
      return list[0]?.caps.length
        ? { ui: { sel: null, partial: [] }, say: "A jump is compulsory: the ringed pieces can jump.", flash: true }
        : { ui: { sel: null, partial: [] }, say: "That piece can't move." };
    }
    return { ui: { sel: sq, partial: [] } };
  }
  const h = inHand(list, ui), here = ui.partial.length ? ui.partial[ui.partial.length - 1] : ui.sel;
  if (sq === here) {
    const stop = list.find(m => m.path.length === h.n && m.path.every((q, i) => q === h.P[i]));
    if (stop) return { ui: { sel: null, partial: [] }, play: stop.path };
    return ui.partial.length ? { ui: same } : { ui: { sel: null, partial: [] } };
  }
  const hops = h.cands.filter(m => m.path[h.n] === sq);
  if (hops.length === 1) return { ui: { sel: null, partial: [] }, play: hops[0].path };
  if (hops.length > 1) return { ui: { sel: ui.sel, partial: [...ui.partial, sq] } };      // several moves pass this landing: on to the next
  const finals = h.cands.filter(m => m.path[m.path.length - 1] === sq);
  if (finals.length === 1) return { ui: { sel: null, partial: [] }, play: finals[0].path };
  if (finals.length > 1) return { ui: same, say: "Two routes end there: tap the first landing." };
  if (own) return { ui: { sel: sq, partial: [] } };
  return { ui: { sel: null, partial: [] } };
}
