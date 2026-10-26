// Hold'em's coach in words, for the page's Hint, Check and Always: what holdem-think.js's weighing of a decision comes to.
// A move by name ("raise to 900", "call 400", "all in 9,600"), the coach's line at a decision (its move, how often the hand
// wins against what the others have shown, what a call costs against that, how often a raise takes the pot at once), and the
// check's verdict on a move of yours: as good, or how many chips worse and why. Pure, so the tests read it as the page does.
import { legal, sizes } from "./holdem-rules.js";
import { sameMove, asGood, MARGIN } from "./holdem-think.js";

export { MARGIN };

const fmt = n => Math.round(n).toLocaleString("en-GB");
const pc = x => `${Math.round(100 * x)}%`;
/** Chips to the nearest ten (five hundred and up to the nearest fifty): a figure of rollouts is never exact to the chip. */
export const near = x => { const a = Math.abs(x), step = a >= 1000 ? 50 : 10; return Math.round(a / step) * step; };
/** Chips beyond folding, signed: "+HK$420", "−HK$60", "±HK$0". */
export const gain = x => (near(x) === 0 ? "±HK$0" : `${x < 0 ? "−" : "+"}HK$${fmt(near(x))}`);

/** A move by name: "fold", "check", "call 400", "bet 600", "raise to 900", "all in 9,600". */
export function moveName(m, s, seat) {
  if (!m) return "";
  if (m.t === "fold" || m.t === "check") return m.t;
  const me = legal(s, seat);
  if (m.t === "call") return me.toCall >= s.stacks[seat] ? `call, all in for ${fmt(me.toCall)}` : `call ${fmt(me.toCall)}`;
  if (m.to >= me.maxTo) return `all in for ${fmt(m.to)}`;
  return s.bet ? `raise to ${fmt(m.to)}` : `bet ${fmt(m.to)}`;
}
/** A move as an instruction: "Fold", "Call 400", "Raise to 900". */
export const moveSaid = (m, s, seat) => { const w = moveName(m, s, seat); return w[0].toUpperCase() + w.slice(1); };
/** Which of the page's sizes a raise is, if it's one: "⅓ pot", "2½ BB", "3×", "geometric, 110%" ("" for all in, or a size of its own). */
export function sizeName(m, s, seat) {
  if (m?.t !== "raise") return "";
  const x = sizes(s, seat).find(x => x.to === m.to);
  return !x || x.key === "all" ? "" : x.key === "geo" ? `geometric, ${x.label}` : x.label;
}
/** A move with its size: "Bet 200 (⅓ pot)", "Raise to 1,200 (3×)". */
export const moveSized = (m, s, seat) => { const n = sizeName(m, s, seat); return `${moveSaid(m, s, seat)}${n ? ` (${n})` : ""}`; };

/** What the others have shown, for how the hand's chances are put: against the hands that bet once anyone has, else against any hand they could hold. */
const against = s => (s.log.some(e => e.t === "raise") ? "the hands that bet" : "the hands they could hold");
const entry = (r, m) => r.list.find(c => sameMove(c.move, m));

/** What the coach makes of a decision, in a line: its move, how the hand stands against the price or how often a raise takes the pot, and what it's worth. */
export function adviceLine(r, s, seat) {
  const m = r.best, c = entry(r, m);
  if (r.only) return `${moveSaid(m, s, seat)}: the only move`;
  const parts = [moveSized(m, s, seat)];
  if (m.t === "raise" && c.alone >= 0.1) parts.push(`everyone folds ${pc(c.alone)} of the time`);
  else if (r.equity != null) parts.push(`about ${pc(r.equity)} to win${r.toCall && m.t !== "raise" ? `, a call needs ${pc(r.needs)}` : ""}`);
  if (m.t !== "fold") parts.push(`worth ${gain(c.mean)} on average`);
  return parts.join(" · ");
}

/** The (at most) two things that tell most against a move of yours, set against the coach's, in words, from the figures alone. */
function why(r, mine, best, m, b, s) {
  const out = [];
  const eq = r.equity, bigger = mine.t === "raise" && best.t === "raise" && mine.to > best.to;
  if (mine.t === "call" && best.t === "fold") out.push(eq != null && eq < r.needs ? `You win about ${pc(eq)} against ${against(s)} and the call needs ${pc(r.needs)}.` : "The later bets cost more than the pot gives back.");
  else if (mine.t === "fold") out.push(eq != null && eq > r.needs ? `You win about ${pc(eq)} against ${against(s)}; the call needs ${pc(r.needs)}.` : "It gives up chips the hand would have won back.");
  else if (bigger) out.push(b.alone + 0.05 >= m.alone ? `The smaller raise takes the pot about as often (${pc(b.alone)} against ${pc(m.alone)}) for less.` : `It risks more than its extra folds are worth (${pc(m.alone)} fold, against ${pc(b.alone)}).`);
  else if (mine.t === "raise" && best.t !== "raise") out.push(m.alone < 0.25 ? `Everyone folds only ${pc(m.alone)} of the time; the rest call or raise with hands that do better.` : "The hands that stay in beat yours more often than the folds pay.");
  else if (mine.t !== "raise" && best.t === "raise") out.push(b.alone >= 0.2 ? `A raise takes the pot at once ${pc(b.alone)} of the time, and gets paid by worse hands when it doesn't.` : "Betting gets paid by worse hands and makes the better ones pay to see more.");
  else if (mine.t !== "fold" && best.t === "fold") out.push("The hand doesn't win enough of the time for what it costs to see the end.");
  return out.slice(0, 2);
}

/**
 * The check's verdict on a move of yours, from the coach's weighing of the position before it (`r`, with your move in it):
 * null when it's the coach's or as good, as near as the deals can tell; else { gap (chips), se, words, best }.
 */
export function verdict(r, mine, s, seat) {
  const best = r.list[0], m = entry(r, mine);
  if (!m || sameMove(best.move, mine) || r.only) return null;
  if (asGood({ gap: m.gap, se: m.gapSe })) return null;
  const b = best.move, theirs = b.t === "fold" ? "folding" : moveName(b, s, seat);
  const yours = mine.t === "fold" ? "fold" : moveName(mine, s, seat);
  const reasons = why(r, mine, b, m, best, s);
  return { gap: m.gap, se: m.gapSe, best: b, words: `Your ${yours}: about HK$${fmt(near(m.gap))} worse than ${theirs}.${reasons.length ? ` ${reasons.join(" ")}` : ""}` };
}
