// Contract's computer players and its hints think here, off the page's thread: the double-dummy solver (DDS, as
// WebAssembly: contract-dds.js) is started once, then each question is a state and a seat in, an answer out.
//   "move": the computer's card for that seat (the table waits its pace, and its move takes this answer)
//   "hint": the card for a person's seat, with what each card was worth over the deals weighed
//   "par":  the tricks the contract makes with every card seen, for the review of a deal
// A deal of 13 cards a hand takes the solver a tenth of a second or so, a late trick a few milliseconds: each level
// weighs as many deals as its time allows.
import { chooseCard } from "./contract-play.js";
import { fetchSolver } from "./contract-dds.js";
import { sideOf, partnerOf } from "./contract-core.js";

/** How hard each level thinks: deals at most, and the time it may take (it weighs at least four whatever the time). */
export const THINK = {
  medium: { deals: 12, ms: 450 },
  hard: { deals: 48, ms: 1000, leadBySampling: true },
  hint: { deals: 48, ms: 1600, leadBySampling: true },
};
let solver = null, failed = null;
const ready = fetchSolver().then(s => { solver = s; }, e => { failed = String(e?.message || e); });

onmessage = async e => {
  const { id, kind, state, seat, level = "hard" } = e.data;
  let answer = null, error = null;
  try {
    await ready;
    if (!solver) throw new Error(failed || "no solver");
    if (kind === "move") answer = { t: "card", card: chooseCard(state, seat, solver, THINK[level] || THINK.hard).card };
    else if (kind === "hint") answer = chooseCard(state, seat, solver, THINK.hint);
    else if (kind === "par") {
      const c = state.contract, leader = (c.declarer + 1) % 4;
      const res = solver.solve(state.dealt, [], c.strain, leader);
      // the defenders' best lead: declarer's side takes the rest
      answer = { tricks: 13 - Math.max(...res.values()), declarer: c.declarer, side: sideOf(c.declarer), dummy: partnerOf(c.declarer) };
    }
  } catch (err) { error = String(err?.stack || err); }
  postMessage({ id, answer, error });
};
