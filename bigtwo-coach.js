// Big Two's coach in words, for the page's Hint, Check and Always: what bigtwo-think.js's weighing of a decision comes
// to. A move by name ("a pair of 7s", "a full house, 9s"), the plays the rest of the hand makes after it (as the coach
// plans a hand: the fewest leads it needs), what a choice comes to over the deals (the points the seat comes out of the
// deal with, on average), and the check's verdict on a move of yours: as good, or how much worse and why. Pure, so the
// tests read it as the page does.
import { classify, cardName, RANKS, KIND_NAMES, rankOf, value } from "./bigtwo-rules.js";
import { quickPlan, sameMove } from "./bigtwo-think.js";

const ARTICLE = { fullhouse: "a full house", four: "four of a kind" }, PLURAL = { fullhouse: "full houses", four: "fours of a kind", flush: "flushes", straightflush: "straight flushes" };
export const one = k => ARTICLE[k] || `a ${KIND_NAMES[k]}`;
const many = (k, n) => `${["", "", "two", "three", "four", "five", "six", "seven", "eight"][n] || n} ${PLURAL[k] || `${KIND_NAMES[k]}s`}`;
/** Plays in words, the longest first: "a straight, a pair and two singles". */
export function playsWords(groups) {
  const order = ["straightflush", "four", "fullhouse", "flush", "straight", "triple", "pair", "single"], counts = new Map();
  for (const g of groups) counts.set(g.kind, (counts.get(g.kind) || 0) + 1);
  const words = order.filter(k => counts.has(k)).map(k => (counts.get(k) === 1 ? one(k) : many(k, counts.get(k))));
  return words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}
const topOf = (cards, opts) => [...cards].sort((a, b) => value(b, opts) - value(a, opts))[0];
/** A move by name: "pass", "the 3♦", "a pair of 7s", "three 9s", "a straight to the Q♠", "a full house, 9s". */
export function moveName(m, opts) {
  if (!m || m.t === "pass") return "pass";
  const k = classify(m.cards, opts), top = topOf(m.cards, opts), r = RANKS[rankOf(top)];
  if (!k) return m.cards.map(cardName).join(" ");
  if (k.kind === "single") return `the ${cardName(top)}`;
  if (k.kind === "pair") return `a pair of ${r}s`;
  if (k.kind === "triple") return `three ${r}s`;
  if (k.kind === "straight") return `a straight to the ${cardName(top)}`;
  if (k.kind === "straightflush") return `a straight flush to the ${cardName(top)}`;
  if (k.kind === "flush") return `a flush, ${cardName(top)} high`;
  const counts = {};
  for (const c of m.cards) counts[rankOf(c)] = (counts[rankOf(c)] || 0) + 1;
  const big = Number(Object.keys(counts).find(x => counts[x] >= 3));
  return k.kind === "fullhouse" ? `a full house, ${RANKS[big]}s` : `four ${RANKS[big]}s`;
}
/** A move as an instruction: "Pass", "Lead the 3♦", "Play a pair of 7s". */
export function moveSaid(m, opts, leading) {
  if (!m || m.t === "pass") return "Pass";
  return `${leading ? "Lead" : "Play"} ${moveName(m, opts)}`;
}
/** The rest of a hand after a move, as the coach plans it: { plays (the plan's plays), n (how many: leads it needs) }. */
export function after(hand, m, opts) {
  const rest = m && m.t !== "pass" ? hand.filter(c => !m.cards.includes(c)) : hand;
  const plays = rest.length ? quickPlan(rest, opts).plays : [];
  return { plays, n: plays.length, rest };
}
/** Points a deal, signed: "+20.4", "−3.1", "±0". */
export const pts = v => (Math.abs(v) < 0.05 ? "±0" : `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(1)}`);

/** What the coach makes of a decision, in a line: its move and the plays it leaves ("Lead a flush, Q♦ high · then a
 *  straight, a pair and three singles"), or, with only one move possible, that. */
export function adviceLine(r, s, seat) {
  const m = r.best, leading = !s.trick.last, a = after(s.hands[seat], m, s.opts);
  if (r.only) return `${moveSaid(m, s.opts, leading)}: the only move`;
  if (!a.n) return `${moveSaid(m, s.opts, leading)}, and you're out`;
  return `${moveSaid(m, s.opts, leading)} · ${m.t === "pass" ? "your hand plays as" : "then"} ${playsWords(a.plays)}`;
}

/** The two (at most) things that tell most against a move of yours, set against the coach's, in words. */
function against(s, seat, mine, best, names) {
  const opts = s.opts, hand = s.hands[seat], out = [];
  const a = after(hand, mine, opts), b = after(hand, best, opts);
  const name = i => names?.[i] || `Seat ${i + 1}`;
  // a two spent where the coach keeps them
  const twos = m => (m.t === "pass" ? 0 : m.cards.filter(c => rankOf(c) === 12).length);
  if (twos(mine) > twos(best)) out.push(`It spends ${twos(mine) - twos(best) === 1 ? "a two" : "your twos"}, which win${twos(mine) - twos(best) === 1 ? "s" : ""} a lead back later.`);
  // a five-card hand of the plan broken
  const plan = quickPlan(hand, opts).plays.filter(p => p.n === 5);
  const breaks = m => m.t !== "pass" && plan.find(p => m.cards.some(c => p.cards.includes(c)) && !p.cards.every(c => m.cards.includes(c)));
  const broke = breaks(mine);
  if (broke && !breaks(best)) out.push(`It breaks your ${moveName({ t: "play", cards: broke.cards }, opts).replace(/^a /, "")}.`);
  // further from out
  if (a.n > b.n) out.push(`Your hand then needs ${a.n} plays to go out, against ${b.n}.`);
  // passing while someone is close to out
  if (mine.t === "pass" && best.t !== "pass") {
    const short = s.hands.map((h, i) => [i, h.length]).filter(([i, n]) => i !== seat && n <= 3).sort((x, y) => x[1] - y[1])[0];
    if (short) out.push(`${name(short[0])} has ${short[1] === 1 ? "one card" : `${short[1]} cards`} left: passing lets the trick run on.`);
  }
  if (best.t === "pass" && mine.t !== "pass" && !out.length) out.push("The coach keeps its cards for a better moment.");
  return out.slice(0, 2);
}
/** Below this a move is as good as the coach's (points a deal), and it must be twice its standard error clear. */
export const MARGIN = 0.3;
/**
 * The check's verdict on a move of yours, from the coach's weighing of the position before it (`r`, with your move in
 * it): null when it's the coach's or as good, as near as the deals can tell; else { gap (points a deal), se, words }.
 */
export function verdict(r, mine, s, seat, names) {
  const best = r.list[0], m = r.list.find(c => sameMove(c.move, mine));
  if (!m || sameMove(best.move, mine) || r.only) return null;
  if (!(m.gap > MARGIN && m.gap > 2 * m.gapSe)) return null;
  const opts = s.opts, leading = !s.trick.last, b = best.move;
  const theirs = b.t === "pass" ? "passing" : `${leading ? "leading" : "playing"} ${moveName(b, opts)}`;
  const why = against(s, seat, mine, b, names);
  const yours = mine.t === "pass" ? "pass" : moveName(mine, opts).replace(/^(a|the) /, "");
  const words = `Your ${yours}: about ${m.gap.toFixed(1)} points a deal worse than ${theirs}.${why.length ? ` ${why.join(" ")}` : ""}`;
  return { gap: m.gap, se: m.gapSe, words, best: b };
}
