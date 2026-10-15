// Contract's puzzle rush without its page (contract-rush-ui.js, on rush-sheet.js): the bank's puzzles
// (contract-puzzles.js, found by tools/contract-puzzles.mjs), each a position put back together from its deal, its
// auction and the cards played so far; the course's step that draws it (contract-course.js's stage); the verdict on a
// card; and the words. A puzzle is a decision late in a deal, from the computer players' own games, where one card makes
// (or beats) the contract clearly more often than any other over many deals of the cards its player can't see, each
// solved with every card seen. Pure: the page, the tool that finds them and the tests share it.
//
// A puzzle as kept, seats turned so that its player is South (declaring, or defending):
//   { id, r (rating, 1 easy to 10), dealer (0 S, 1 W, 2 N, 3 E), auction "1H P 2H P 4H P P P",
//     dealt [South, West, North, East] as a bridge column writes a hand, play (every card played so far, in order),
//     n (deals weighed), opts (the cards it may play), make (the % of deals each makes or beats the contract), best,
//     ok (the cards as good as the best), why (what the best does: take, duck, ruff, trumps, cash, discard) }
import { rules } from "./contract-rules.js";
import { parseCards } from "./contract-course.js";
import { SEATS, COMPASS, NT, suitOf, rankOf, sideOf, partnerOf, handText, callText, cardText, legalCards, trickWinner } from "./contract-core.js";
import { playedOf } from "./contract-play.js";

const STRAIN_MARK = ["♣", "♦", "♥", "♠", "NT"];
const still = { rng: () => 0.5, now: 0 };

/** A puzzle's position as the rules hold it: dealt, bid and played up to its player's card. */
export function stateOf(p) {
  let s = rules.deal({ options: { dealer: p.dealer }, rng: still.rng });
  s.hands = p.dealt.map(parseCards);
  s.dealt = s.hands.map(h => [...h]);
  for (const call of p.auction.split(/\s+/).filter(Boolean)) {
    s = rules.act(s, rules.toMove(s), { t: "call", call }, still);
    if (typeof s === "string") throw new Error(`${p.id}: the call ${call} refused (${s})`);
  }
  for (const card of parseCards(p.play)) {
    if (s.step === "trick") s = rules.wake(s, { ...still, now: 1e15 });
    s = rules.act(s, rules.toMove(s), { t: "card", card }, still);
    if (typeof s === "string") throw new Error(`${p.id}: ${cardText(card)} refused (${s})`);
  }
  if (s.step === "trick") s = rules.wake(s, { ...still, now: 1e15 });
  return s;
}

/** The cards its player can't see: not in South's hand, not dummy's once it's down, not played. */
export function outOf(s) {
  const dummy = partnerOf(s.contract.declarer), seen = new Set([...s.hands[0], ...(s.dummyShown ? s.hands[dummy] : []), ...playedOf(s).map(x => x.card)]);
  return Array.from({ length: 52 }, (_, i) => i).filter(c => !seen.has(c));
}

/** What a puzzle's player needs: { decl (your side declares), won (your side's tricks), need (to make or to beat it), left }. */
export function goalOf(s) {
  const decl = sideOf(s.contract.declarer) === 0, need = 6 + s.contract.level;
  return { decl, won: s.won[0], need: decl ? need : 14 - need, left: 13 - s.tricks.length };
}

/** The auction in a line, a seat before each call, the passes as dashes: "W 1♥ · N – · E 2♥". The last three passes go. */
export function auctionLine(s) {
  const a = s.auction.slice(0, -3);
  return a.map(x => `${COMPASS[x.seat]} ${x.call === "P" ? "–" : callText(x.call)}`).join(" · ");
}

/** A puzzle as a course step (contract-course.js), drawn by the course's stage: the best its answer, as good accepted. */
export function stepOf(p) {
  const s = stateOf(p), c = s.contract, dummy = partnerOf(c.declarer);
  const step = {
    contract: `${c.level}${STRAIN_MARK[c.strain]}${c.doubled === 2 ? "XX" : c.doubled ? "X" : ""} ${COMPASS[c.declarer]}`,
    contractRow: false,
    rows: [{ label: `${c.level}${STRAIN_MARK[c.strain]}${c.doubled === 2 ? " XX" : c.doubled ? " X" : ""} by ${c.declarer === 0 ? "you" : SEATS[c.declarer]}: the bidding`, text: auctionLine(s) }],
    hand: handText(s.hands[0]),
    goal: "play", answer: p.best, accept: p.ok.filter(x => x !== p.best),
  };
  if (s.dummyShown) { step.dummy = handText(s.hands[dummy]); if (dummy !== 2) step.dummyLabel = `Dummy, ${SEATS[dummy]}`; }
  if (s.trick.length) { step.trick = s.trick.map(x => cardText(x.card)).join(" "); step.led = COMPASS[s.trick[0].seat]; }
  else { step.trick = ""; step.from = COMPASS[s.turn]; }          // a lead: yours, or dummy's
  return step;
}

/** What a card was worth in the puzzle's deals: { name, make (% of deals it makes or beats the contract) }. */
const optOf = (p, name) => { const i = p.opts.indexOf(name); return i < 0 ? null : { name, make: p.make[i] }; };
/**
 * The verdict on a card (as the course writes one, "♠Q"): { verdict: "best" | "fine" | "wrong", mine, best, next }:
 * next the best card not as good as the best, mine the card played; "fine" a card as good as the best.
 */
export function judge(p, name) {
  const best = optOf(p, p.best), mine = optOf(p, name) || { name, make: null };
  const next = p.opts.filter(n => !p.ok.includes(n)).map(n => optOf(p, n)).sort((a, b) => b.make - a.make)[0] || null;
  return { verdict: name === p.best ? "best" : p.ok.includes(name) ? "fine" : "wrong", mine, best, next };
}

// ---------- in words ----------
/** The question (the contract and the auction are on the stage): where the tricks stand, the cards still out, whose card. */
export function askText(p) {
  const s = stateOf(p), g = goalOf(s), more = Math.max(0, g.need - g.won);
  const tricks = `Your side has ${g.won} ${g.won === 1 ? "trick" : "tricks"} and needs ${more} of the last ${g.left} to ${g.decl ? "make it" : "beat it"}.`;
  const card = s.turn === 0 ? "Your card." : "Dummy's card.";
  return `${tricks} Still out: ${handText(outOf(s)).replace(/ ?[♠♥♦♣]—/g, "").trim() || "nothing"}. ${card}`;
}

/** What the best card does, in a sentence, by what the tool found it does (p.why). */
export function whyText(p) {
  const why = new Set(p.why || []), out = [];
  if (why.has("take")) out.push("It takes the trick, where the cards behind it would let it go.");
  if (why.has("duck")) out.push("It lets the trick go, and keeps the card that takes one later.");
  if (why.has("ruff")) out.push("It trumps the trick.");
  if (why.has("trumps")) out.push("A trump led: it draws theirs.");
  if (why.has("cash")) out.push("A winner cashed while it stands.");
  if (why.has("discard")) out.push("Of the cards it could throw, the one that isn't needed.");
  return out.join(" ");
}

/** What the best card does, found from the position: the tags whyText says (the tool keeps them with the puzzle). */
export function motifsOf(s, card) {
  const out = [], strain = s.contract.strain, t = s.trick, hand = s.hands[s.turn];
  if (t.length) {
    const led = suitOf(t[0].card), beats = c => trickWinner([...t, { seat: s.turn, card: c }], strain) === t.length;
    const legal = legalCards(hand, t);
    if (suitOf(card) !== led && strain !== NT && suitOf(card) === strain) out.push("ruff");
    else if (suitOf(card) !== led) out.push("discard");
    else if (beats(card) && legal.some(c => !beats(c))) out.push("take");
    else if (!beats(card) && legal.some(beats)) out.push("duck");
  } else if (strain !== NT && suitOf(card) === strain) out.push("trumps");
  // a master: no card of its suit still out is higher
  else if (!outOf(s).some(c => suitOf(c) === suitOf(card) && rankOf(c) > rankOf(card))) out.push("cash");
  return out;
}
