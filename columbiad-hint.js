// The model answer, for the owner only (23 November 2026, Korbi: "add a cone that shows how you intend the user to beat the level. for
// time based ones, also set the time to the median time when it's best to do it. if there's other global maxima ways of doing it, show
// them. I want to be able to see what each level is supposed to be before rating them poorly ... just make it so that there's a "hint"
// button when the user logged in is KORBIRUN"). The ways are the level's stored proofs (columbiad-proofs.js), one per family: a proof
// whose aim lies inside a better one's window, at a launch time that one may drift to, is the same way and is left out. The working
// out of each way (columbiad-hint-worker.js) takes up to two seconds on a moving level, so it runs off the page's thread.
import { PROOFS } from "./columbiad-proofs.js";

export const OWNER = "KORBIRUN";

const room = p => (p.win ? p.win.da * p.win.dc * (p.tw ? Math.min(p.tw, 3) / 3 : 1) : 0);
const inside = (p, q) => !!q.win && p.angle >= q.win.a0 && p.angle <= q.win.a1 && p.charge >= q.win.c0 && p.charge <= q.win.c1
  && Math.abs((p.t || 0) - (q.t || 0)) <= (q.tw ?? 0) + 0.05;

/** The level's distinct ways to win, the surest first (the share of scattered runs that win, then the size of its window). */
export function waysOf(lvl) {
  const ps = (PROOFS[lvl?.id] || []).slice().sort((a, b) => (b.rob ?? 0) - (a.rob ?? 0) || room(b) - room(a));
  const ways = [];
  for (const p of ps) if (!ways.some(q => inside(p, q) || inside(q, p))) ways.push(p);
  return ways;
}
