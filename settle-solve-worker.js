// Crucible's solver off the page's thread (23 November 2026: the later chapters' capstones reach a hundred thousand states, a second
// or more of search, too long to hold a pour's animation for). The page asks once a level, for every state reachable from its start,
// and from then on knows after any pour whether the moulds can still all be cast, and the Hint's best pour, by looking it up.
import { solve, startOf } from "./settle-engine.js";
import { playOf } from "./settle-levels.js";

onmessage = ({ data: { n, lv } }) => {
  const L = playOf(lv), { toWin } = solve(L, startOf(L));
  postMessage({ n, ids: toWin.ids, d: toWin.d }, [toWin.d.buffer]);
};
