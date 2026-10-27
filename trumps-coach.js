// Schafkopf's coach in words, for the page's Hint, Check and Always: what trumps-think.js's weighing of a decision
// comes to. A card: how often it wins the game over the deals of the cards you can't see, what it comes to on the
// table's score on average, and what it does (the course's motifs, said as the puzzle rush says them). A game to
// play: its chance and what it's worth by trumps-bids.js, and what in the hand speaks for it. Pure, so the tests
// read it as the page does.
import { GAMES, sTrump } from "./trumps-games.js";
import { cid, suitOf, rankOf } from "./trumps-cards.js";
import { stepOfState, motifsOf, cardWords, contractWords } from "./trumps-course.js";
import { whyText } from "./trumps-rush.js";
import { gapOf, conventionalLead } from "./trumps-think.js";

const S = GAMES.schafkopf;
export const pct = x => `${Math.round(100 * x)}%`;
/** A change on the table's score, signed: "+12", "−3.5". */
export const signed = v => `${v < -0.05 ? "−" : "+"}${Math.abs(v) >= 10 ? Math.round(Math.abs(v)) : Math.abs(v).toFixed(1)}`;
/** What a worth in tariffs (to a seat's side) comes to on the table's score for that seat: the tariff for each, three
 *  times over for a soloist, who is paid by (or pays) all three. */
export function scoreOf(s, seat, worth) {
  const c = s.contract, mult = c.type !== "sau" && c.declarer === seat ? 3 : 1;
  return worth * (s.opts?.tariff ?? 10) * mult;
}
/** How much a gap in tariffs has to be before the coach calls it: an eighth of a game's base. */
const unitOf = c => (c.type === "sau" ? 1 : 5);

/** What a card does, in a sentence or two: a trump led, the called Farbe searched, a Sau cashed, schmieren, stechen…;
 *  or, where it does none of those, what it is: a Farbe led, the trick left to your side, points given away, a small
 *  card on a trick it can't take. */
export function cardWhy(s, seat, card) {
  const step = stepOfState(s, seat), said = whyText({ ...step, why: motifsOf(step, card) });
  if (said) return said;
  const c = s.contract, pts = S.points(null, card);
  if (!s.trick.length) return sTrump(c, card) ? "A trump led." : `${FARBEN[suitOf(card)]} led, the trumps kept back.`;
  const t = [...s.trick, { seat, card }], takes = t[S.winner({ contract: c }, t)].seat === seat;
  if (takes) return "It takes the trick.";
  const holder = s.trick[S.winner({ contract: c }, s.trick)].seat, { side, known } = sidesKnown(s, seat);
  if (known && side(holder) === side(seat)) return "It leaves the trick to your side.";
  return pts >= 10 ? `It gives the trick its ${pts} points.` : "A small card on a trick it can't take.";
}
const FARBEN = ["Schellen", "Herz", "Gras", "Eichel"];
/** The sides as a seat knows them: the caller's and the called Sau's holder once it's out (or it's yours), else only its own. */
function sidesKnown(s, seat) {
  const c = s.contract;
  if (c.type !== "sau") return { side: p => (p === c.declarer ? 0 : 1), known: true };
  const ace = cid(c.ace, "A"), out = [...s.tricks.flatMap(x => x.cards), ...s.trick].find(x => x.card === ace);
  const partner = s.hands[seat].includes(ace) ? seat : out ? out.seat : -1;
  return { side: p => (p === c.declarer || p === partner ? 0 : 1), known: partner >= 0 };
}
/** What a card does, in a few words for the coach's line: "a trump led, to draw theirs". */
export function cardDoes(s, seat, card) {
  const step = stepOfState(s, seat), playing = s.contract.declarer === seat || (s.contract.type === "sau" && s.hands[seat].includes(cid(s.contract.ace, "A")));
  // the partner's trump lead the conventions call for tells the caller who its partner is (trumps-think.js, signalFirst)
  const tags = [...motifsOf(step, card), ...(conventionalLead(s, seat)?.includes(card) ? ["signal"] : [])];
  const said = {
    trumpf: playing ? "a trump led, to draw theirs" : "a trump led, to take theirs before they're used",
    suchen: "the called Farbe searched while its Sau is out",
    sau: "a Sau cashed while it stands",
    schmieren: "points on your side's trick",
    stechen: "the Farbe trumped, the trick yours",
    take: "it takes the trick",
    duck: "it lets the trick go, keeping what takes one later",
    signal: "it tells the caller you're the partner",
  };
  return tags.map(t => said[t]).filter(Boolean).join("; ");
}
const the = id => `the ${cardWords(id)}`;
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

/** The coach's card in words (Hint, Always), a line or two: what it does and how it fares against the next best. */
export function adviceWords(s, seat, list) {
  const best = list[0], next = list[1];
  if (!best) return "";
  if (!next) return `${cap(the(best.card))}: the only card you may play.`;
  if (best.n && list.every(x => Math.abs(x.worth - best.worth) < unitOf(s.contract) / 100)) {
    // the first trick is weighed for the game, and Schneider only where it's lost (a whole hand is long to search)
    return `Any card does as well${s.tricks.length ? "" : " for the game"}: your side wins in ${pct(best.win)} of the deals whatever you play.`;
  }
  const does = cardDoes(s, seat, best.card);
  let odds = "";
  if (best.n) {
    if (Math.abs(best.win - next.win) >= 0.03) odds = ` It wins in ${pct(best.win)} of the deals, ${the(next.card)} in ${pct(next.win)}.`;
    else {
      const more = scoreOf(s, seat, best.worth - next.worth);
      odds = more >= 0.5 ? ` It wins as often as ${the(next.card)} (${pct(best.win)}) and comes to ${signed(more).slice(1)} more on average.` : ` ${cap(the(next.card))} does as well.`;
    }
  }
  return `${cap(the(best.card))}${does ? `: ${does}` : ""}.${odds}`;
}

/**
 * Your card against the coach's (Check, Always): null when yours was as good, as near as the deals tell (within an
 * eighth of a game's base, or two standard errors of the gap); else { best, words }.
 */
export function verdictOf(s, seat, list, mine) {
  const best = list[0], yours = list.find(x => x.card === mine);
  if (!best || !yours || best.card === mine || !best.n) return null;
  const { gap, se } = gapOf(best, yours);
  if (gap < unitOf(s.contract) / 8 || gap < 2 * se) return null;
  const does = cardDoes(s, seat, best.card);
  const odds = Math.abs(best.win - yours.win) >= 0.03
    ? `it wins in ${pct(best.win)} of the deals, ${the(mine)} in ${pct(yours.win)}`
    : `as often won (${pct(best.win)}), it comes to ${signed(scoreOf(s, seat, gap)).slice(1)} more on average`;
  return { best: best.card, words: `${cap(the(best.card))} was better${does ? ` (${does})` : ""}: ${odds}.` };
}

/** A card's line in the Why sheet: what it wins, what it comes to, what it does. */
export function cardRows(s, seat, list) {
  return list.map(x => ({ card: x.card, name: cardWords(x.card), win: x.win, score: scoreOf(s, seat, x.worth), what: cardWhy(s, seat, x.card) }));
}

// ---------- bidding ----------
/** A game as said at the table: "Sauspiel auf die Gras-Sau", "Wenz", "Eichel-Solo"; or passing, "Weiter". */
export const bidName = b => (b.t !== "play" ? "Weiter" : contractWords({ type: b.type, trump: b.suit, ace: b.ace }));
const contractOfBid = (b, seat) => ({ type: b.type, declarer: seat, trump: b.type === "solo" ? b.suit : b.type === "sau" ? 1 : -1, ace: b.ace });
const NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];
/** What a hand holds for a game, in a few words: its trumps and the top of them, its Säue besides, its Laufende. */
export function handWords(hand, c) {
  const trumps = hand.filter(id => sTrump(c, id)), out = [];
  const obers = trumps.filter(id => rankOf(id) === "Q").length, unters = trumps.filter(id => rankOf(id) === "J").length;
  const tops = c.type === "wenz" ? (unters ? `${NUM[unters]} Unter${unters > 1 ? "s" : ""}` : "no Unter")
    : `${NUM[trumps.length]} trump${trumps.length === 1 ? "" : "s"}${obers || unters ? ` (${[obers ? `${NUM[obers]} Ober${obers > 1 ? "s" : ""}` : "", unters ? `${NUM[unters]} Unter${unters > 1 ? "s" : ""}` : ""].filter(Boolean).join(", ")})` : ""}`;
  out.push(tops);
  const saeue = hand.filter(id => rankOf(id) === "A" && !sTrump(c, id)).length;
  out.push(saeue ? `${NUM[saeue]} Sau${saeue > 1 ? "e" : ""} besides`.replace("Saue", "Säue") : "no Sau besides");
  if (c.type === "sau") {
    const called = hand.filter(id => suitOf(id) === c.ace && !sTrump(c, id)).length;
    out.push(`${NUM[called]} of the called Farbe`);
  }
  return out.join(", ").replace(/, ([^,]*)$/, " and $1");
}
/** The coach's game in words, two lines or so: what it's worth and what in the hand speaks for it. `list` is
 *  bidOptions's, best first. */
export function bidAdvice(s, seat, list) {
  const best = list[0], hand = s.hands[seat], tariff = s.opts?.tariff ?? 10;
  const games = list.filter(o => o.bid.t === "play");
  if (best.bid.t !== "play") {
    if (!games.length) return "Weiter: there's no game you may play over what's been said.";
    const g = games[0];
    return `Weiter: no game pays here. The best, ${bidName(g.bid)}, wins about ${pct(g.win)}, ${signed(g.worth * tariff)} on average.`;
  }
  return `${bidName(best.bid)}: wins about ${pct(best.win)}, ${signed(best.worth * tariff)} on average, with ${handWords(hand, contractOfBid(best.bid, seat))}.`;
}
/** Your game against the coach's: null when yours is as good (within a tenth of a Sauspiel), else the words. */
export function bidVerdict(s, seat, list, mine) {
  const same = (a, b) => a.t === b.t && a.type === b.type && a.ace === b.ace && a.suit === b.suit;
  const best = list[0], yours = list.find(o => same(o.bid, mine)), tariff = s.opts?.tariff ?? 10;
  if (!best || !yours || same(best.bid, mine) || best.worth - yours.worth < 0.1) return null;
  const what = o => (o.bid.t === "play" ? `${bidName(o.bid)} (about ${pct(o.win)}, ${signed(o.worth * tariff)})` : "Weiter (0)");
  return { best: best.bid, words: `${what(best)} was better than ${what(yours)}.` };
}
/** A game's line in the Why sheet. */
export function bidRows(s, seat, list) {
  const tariff = s.opts?.tariff ?? 10;
  return list.map(o => ({ bid: o.bid, name: bidName(o.bid), win: o.bid.t === "play" ? o.win : null, score: o.worth * tariff, what: o.bid.t === "play" ? cap(handWords(s.hands[seat], contractOfBid(o.bid, seat))) : "No game: the hand is thrown in if all pass, or you defend." }));
}
