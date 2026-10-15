// Schafkopf's puzzle rush without its page (trumps-rush-ui.js, on rush-sheet.js): the bank's puzzles (trumps-puzzles.js,
// found by tools/trumps-puzzles.mjs), the verdict on a card, and what a puzzle comes to in words. A puzzle is a position
// as its player saw it, written as the course writes its steps (trumps-course.js), so the course's stage draws it and
// the rules judge it; with it come the cards weighed and what each was worth over the deals of the cards that player
// couldn't see, each played to the end with every card seen (trumps-solve.js). Pure: the page and the tests share it.
import { contractOf, contractWords, cardWords, parseCards, tableOf, takenOf, NAMES } from "./trumps-course.js";

/** A puzzle as a course step: its table, the best card to find and those as good. */
export const stepOf = p => ({ ...p, answer: p.best, accept: p.ok.filter(n => n !== p.best) });
/** What a card was worth in the puzzle's deals: { name, value (in games), win (% of deals won) }, by its token ("GO"). */
const optOf = (p, name) => { const i = p.opts.indexOf(name); return i < 0 ? null : { name, value: p.vals[i], win: p.win[i] }; };

/**
 * The verdict on a card (its token): { verdict: "best" | "fine" | "wrong", mine, best, next }: best the puzzle's best,
 * next the best of the others, mine the card played; "fine" a card the puzzle counts as good as the best.
 */
export function judge(p, name) {
  const best = optOf(p, p.best), mine = optOf(p, name) || { name, value: null, win: null };
  const next = p.opts.filter(n => n !== p.best).map(n => optOf(p, n)).sort((a, b) => b.value - a.value)[0] || null;
  return { verdict: name === p.best ? "best" : p.ok.includes(name) ? "fine" : "wrong", mine, best, next };
}

// ---------- in words ----------
/** A card in words: "the Gras-Ober". */
export const playWords = name => `the ${cardWords(parseCards(name)[0])}`;
/** Whether two cards win about as often, so that a verdict tells them apart by what they come to instead. */
export const alike = (a, b) => !!b && Math.abs(a.win - b.win) < 4;
/** How often a card wins the game over the deals, as a verdict says it: "in 77%". */
export const worthText = o => `in ${o.win}%`;
/** What a card comes to on average, in games (a game won 1, Schneider and schwarz one more each, lost as much the other way): "+2.06". */
export const gamesText = o => `${o.value < -0.005 ? "−" : "+"}${Math.abs(o.value).toFixed(2)}`;
const side = p => {
  const { side: of, known } = takenOf(p), us = [1, 2, 3].filter(q => of(q) === of(0)).map(q => NAMES[q]);
  return { known, us };
};

/** The question a puzzle asks: whose game it is and what's wanted (the stage shows the tricks and the score). */
export function askText(p) {
  const c = contractOf(p), lead = !tableOf(p).trick.length, mine = c.declarer === 0;
  const game = mine ? `Your ${contractWords(c)}` : `${NAMES[c.declarer]}'s ${contractWords(c)}`;
  const { known, us } = side(p);
  const with_ = c.type === "sau" && known ? (us.length ? `, ${us[0]} your partner` : "") : "";
  return `${game}${with_}: ${lead ? "lead" : "play"} the best card.`;
}

/** What the best card does, in a sentence or two, by what the bank found it does (p.why). */
export function whyText(p) {
  const why = new Set(p.why || []), c = contractOf(p), out = [], { side: of } = takenOf(p);
  const playing = of(0) === 0, theCalled = c.type === "sau" ? `the ${cardWords(parseCards(["S", "H", "G", "E"][c.ace] + "A")[0])}` : "";
  if (why.has("trumpf")) out.push(playing ? "A trump led: each round takes trumps from the others, and your Säue stand once they have none." : "A trump led: it takes theirs before they can use them.");
  if (why.has("suchen")) out.push(`The called Farbe led while ${theCalled} is out: it has to come, and one of yours may trump it.`);
  if (why.has("sau")) out.push("A Sau cashed while it stands.");
  if (why.has("schmieren")) out.push("Your points on a trick your side takes.");
  if (why.has("stechen")) out.push("The Farbe trumped: the trick and its points are your side's.");
  if (why.has("take")) out.push("It takes the trick, where another card would let it go.");
  if (why.has("duck")) out.push("It lets the trick go, and keeps the card that takes one later.");
  return out.join(" ");
}
