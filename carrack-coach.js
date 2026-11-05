// Carrack's coach in words, for the page's Hint, Check and Always: what the expert planner (carrack-expert.js) makes of a
// year. Orders by name, the planner's choice and what a year of it comes to on average (ports, factors, monopolies, silver
// against your own orders), and the check's verdict on yours: as good, or how much worse and why. `handle` is the one door
// the worker (carrack-worker.js) and the page's fallback both use. Pure, so the tests read it as the page does.
import { PORTS } from "./carrack-map.js";
import { POWERS } from "./carrack-rules.js";
import { expertOrders } from "./carrack-expert.js";
import { seeded } from "./seats.js";

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** One order by name: "Sail 2 fleets from Lübeck to Reval", "Found a factor at Calicut". */
export function orderWord(s, o) {
  const at = p => PORTS[p].name;
  switch (o.t) {
    case "move": {
      if (o.atk == null) return `Sail ${plural(o.n, "fleet")} from ${at(o.from)} to ${at(o.to)}`;
      const name = POWERS[s.pw[o.atk]]?.name, target = o.atk === -2 ? `the people of ${at(o.to)}` : s.own[o.to] === o.atk ? `${name}'s port ${at(o.to)}` : `${name}'s fleets at ${at(o.to)}`;
      return `Attack ${target} with ${plural(o.n, "fleet")} from ${at(o.from)}`;
    }
    case "factor": return `Found a factor at ${at(o.port)}`;
    case "build": return `Build a fleet at ${at(o.port)}`;
    case "fort": return `Raise a fort at ${at(o.port)}`;
    case "claim": return `Claim ${at(o.port)}`;
    case "refit": return "Buy ocean ships";
    case "redress": return "Pay compensation for a grievance token";
    default: return "Pass";
  }
}
export const ordersWords = (s, os) => os.map(o => orderWord(s, o));

const num = v => (Math.abs(v) < 10 ? +Math.abs(v).toFixed(1) : Math.round(Math.abs(v)));
/** What the best orders do differently from yours, in words: the biggest two differences in the average year's end. */
export function whyBetter(best, mine) {
  const a = best.after, b = mine.after;
  const kinds = [["ports", "port", "ports"], ["factors", "factor", "factors"], ["monos", "monopoly", "monopolies"], ["silver", "silver", "silver"], ["grief", "grievance token", "grievance tokens"], ["fleets", "fleet", "fleets"]];
  const parts = kinds.map(([k, one, many]) => {
    const d = a[k] - b[k], n = num(d);
    return { d: k === "grief" ? -d : d, text: `${n} ${d > 0 ? "more" : k === "silver" ? "less" : "fewer"} ${n === 1 ? one : many}` };
  }).filter(x => Math.abs(x.d) >= 0.34).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 2);
  return parts.length ? `ends the year with ${parts.map(x => x.text).join(" and ")}` : "stands better a year on";
}

/** Standing points one option is worth more than another, by the planner's score. */
export const GAP = 0.6;
/**
 * The coach's weighing of a seat's year, with the player's draft among its options: { best (orders), mine (orders), better
 * (the planner's score margin, 0 when the draft is as good), why, options }. The draft may be empty (a hint asked before any
 * orders are set).
 */
export function weigh(s, seat, draft, { rng, seed = 1, ...tune } = {}) {
  const mine = draft?.length ? draft : null;
  const r = expertOrders(s, seat, { rng: rng || seeded(seed), report: true, extra: mine ? [mine] : [], budget: 700, scenarios: 8, deep: 5, ...tune });
  const key = os => JSON.stringify(os.map(o => [o.t, o.port, o.from, o.to, o.n, o.atk]).sort());
  const best = r.options.find(o => key(o.orders) === key(r.orders)) || r.options[0];
  const me = mine ? r.options.find(o => key(o.orders) === key(mine)) : null;
  const margin = me && me.score != null ? Math.max(0, best.score - me.score) : 0;
  const same = !me || margin < GAP || key(best.orders) === key(mine);
  return { best: r.orders, mine, margin, same, why: me && !same ? whyBetter(best, me) : "", after: best.after, options: r.options.length };
}

/** A weighing in words for the page: { line, said (the orders, one to a line) }. */
export function adviceLine(s, seat, r) {
  const orders = ordersWords(s, r.best);
  return { orders, line: r.options <= 1 ? "Pass is the only sensible year" : `${orders.join("; ")}.` };
}
/** The check's word on the orders you set. */
export function verdict(s, seat, r) {
  if (!r.mine) return "";
  if (r.same) return "The coach would set the same, or as good.";
  return `The coach prefers ${ordersWords(s, r.best).join("; ")}: against the others' likely orders it ${r.why}.`;
}

/** The worker's one door: { op: "bot" | "weigh", state, seat, seed, ... } → the answer. */
export function handle(m) {
  const s = m.state, seed = m.seed ?? 1;
  if (m.op === "bot") return expertOrders(s, m.seat, { rng: seeded(seed), ...(m.tune || {}) });
  if (m.op === "weigh") return weigh(s, m.seat, m.draft, { seed, ...(m.tune || {}) });
  return null;
}
