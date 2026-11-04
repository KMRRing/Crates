// Gin rummy's course (Learn, in the Menu): the game taught from nothing, on the course's sheet (course.js) with the card
// stage (course-cards.js), in three chapters: the game (the aim and the variant played, sets and runs, deadwood), a turn
// (the draw, the throw, knocking and gin) and scoring and play (laying off, undercuts and gin, discarding safely), then
// a first game against Easy. Every number a lesson states is the engine's (meld-rules.js): tests/meld-course.mjs
// recomputes each deadwood count, best throw and knock outcome, and has the Hard player choose what a lesson teaches.
//
// Cards are written as course-cards.js writes them (rank 2-9, T or 10, J, Q, K, A; suit d c h s), always with a suit.
// Course-cards numbers the ranks with the ace high; gin rummy has it low, so toGin() translates before the rules look.
//
//   { say }                                  words over the cards, and Next
//   { say, goal, answer, then, wrong }       pick cards from the hand: goal says what's asked (below); answer is what Hint
//                                            picks; then the words for a right pick; wrong words for particular wrong
//                                            ones (keyed by the cards: "Ts")
//   { say, quiz: [options], answer, why }    choose
//
// A goal: { meld: "set" | "run" | true, n } one meld; { rest } every card in no meld; { throw } the card that leaves the
// least deadwood; { knock } the throw that knocks with the least; { gin } the throw that goes gin; { lay } every card that
// goes on the melds shown (rows marked meld); { cards } exactly these, with why for any other.
// Facts the test checks: dead (a hand's deadwood), gain (what taking the pile's card saves), ways, outs, scene (a hand
// knocked and scored), bot (the Hard player's throw), took.
import { deadCount, arrangements, bestLayoff, rankOf, suitOf, pts, short, RANKS, BONUS, TO } from "./meld-rules.js";
import { cardsOf, sameCards } from "./course-cards.js";

const R = ["3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A", "2"];     // course-cards' ranks, by index
/** A card of course-cards (rank index x 4 + suit) as the rules number it (suit x 13 + rank, the ace low). */
export const toGin = id => (id & 3) * 13 + (((id >> 2) + 2) % 13);
export const fromGin = id => ((rankOf(id) + 11) % 13) * 4 + suitOf(id);
/** Cards written as text as the rules number them. */
export const ginOf = text => cardsOf({ hand: text }).hand.map(toGin);
const MARK = { d: "♦", c: "♣", h: "♥", s: "♠" };
/** "4h 5h Ts" as it is read on screen: "4♥ 5♥ 10♠". */
export const show = text => text.trim().split(/\s+/).map(t => `${t.slice(0, -1).replace("T", "10")}${MARK[t.slice(-1)]}`).join(" ");
const uniq = ids => [...new Set(ids)];

// ---------- the judge ----------
const without = (hand, c) => hand.filter(x => x !== c);
/** "set" or "run" if the cards are one meld, else null. */
export function meldKind(ids) {
  if (ids.length < 3) return null;
  if (ids.length <= 4 && ids.every(c => rankOf(c) === rankOf(ids[0])) && uniq(ids.map(suitOf)).length === ids.length) return "set";
  const r = ids.map(rankOf).sort((a, b) => a - b);
  if (ids.every(c => suitOf(c) === suitOf(ids[0])) && r.every((x, i) => !i || x === r[i - 1] + 1)) return "run";
  return null;
}
function notMeld(ids) {
  if (ids.length < 3) return "A meld is three cards at least.";
  if (ids.every(c => suitOf(c) === suitOf(ids[0]))) return "One suit, but not in a row. The ace is low only.";
  if (ids.every(c => rankOf(c) === rankOf(ids[0]))) return "A set is three or four cards of one rank.";
  return "A set is one rank, a run one suit in a row. Those are neither.";
}
const sameSet = (a, b) => a.length === b.length && a.every(c => b.includes(c));
/** The throws of an eleven-card hand with what each leaves: [{ card, dead }] and the least. */
function throwsOf(hand) {
  const all = hand.map(card => ({ card, dead: deadCount(without(hand, card)) }));
  return { all, best: all.reduce((a, b) => (b.dead < a.dead ? b : a)) };
}
const hold = ids => ids;

/** A pick of cards judged against a step's goal: { ok, msg } or { ok: false, why }. */
export function judge(step, picked) {
  const g = step.goal || {}, ids = picked.map(toGin), hand = cardsOf(step).hand.map(toGin);
  const wrong = Object.entries(step.wrong || {}).find(([k]) => sameCards(picked, k));
  if (wrong) return { ok: false, why: wrong[1] };
  const yes = (calc = "") => ({ ok: true, msg: [calc, step.then].filter(Boolean).join(" ") });
  const no = why => ({ ok: false, why });
  if (g.meld) {
    const kind = meldKind(ids);
    if (!kind) return no(notMeld(ids));
    if (g.meld !== true && g.meld !== kind) return no(`That's a ${kind}: pick a ${g.meld}.`);
    if (g.n && ids.length !== g.n) return no(`That's ${ids.length} cards: pick the ${g.meld} of ${g.n}.`);
    return yes();
  }
  if (g.rest) {
    const want = arrangements(hand, 1)[0].rest;
    if (arrangements(hand, 40).some(a => sameSet(a.rest, ids))) return yes(`${arrangements(hand, 1)[0].dead} in deadwood.`);
    const inMeld = ids.find(c => !want.includes(c));
    if (inMeld != null) return no(`${short(inMeld)} is in a meld.`);
    return no("There is more deadwood than that.");
  }
  if (g.throw || g.knock || g.gin) {
    if (ids.length !== 1) return no("Throw one card.");
    const { all, best } = throwsOf(hand), me = all.find(x => x.card === ids[0]);
    if (g.gin) return me.dead === 0 ? yes("Gin: nothing left over.") : no(`That leaves ${me.dead}. Gin needs none.`);
    if (g.knock && me.dead > 10) return no(`That leaves ${me.dead}. Knocking needs 10 or less.`);
    if (me.dead > best.dead) return no(`That leaves ${me.dead}; the ${short(best.card)} leaves ${best.dead}.`);
    return yes(g.knock ? `Knock with ${me.dead}.` : `Leaves ${me.dead}.`);
  }
  if (g.lay) {
    const melds = (step.rows || []).filter(r => r.meld).map(r => ginOf(r.cards)), lay = bestLayoff(hand, melds).lay;
    if (sameSet(ids, lay)) return yes();
    const extra = ids.find(c => !lay.includes(c));
    if (extra != null) return no(`The ${short(extra)} goes on no meld.`);
    return no("Another card goes on a meld.");
  }
  if (g.cards) return sameCards(picked, g.cards) ? yes() : no(step.why || "Not that one.");
  return yes();
}

// ---------- the lessons ----------
/** A question about which cards are a meld: the options are written as cards, the answer the one that is. */
const melds = (say, options, answer, why) => ({ say, options, quiz: options.map(show), answer, why });
const LAY = { k: "8d 8c 8h 4s 5s 6s 7s Ad 2c 3h Kd", f: "8s 3s 9h 9c 9d 4h 5h 6h Kc 2d", card: "Kd", kind: "knock", winner: 0, points: 6, dead: [6, 12], lay: "8s 3s" };
const LAYROWS = [{ label: "Their set", cards: "8d 8c 8h", meld: true }, { label: "Their run", cards: "4s 5s 6s 7s", meld: true }];

export const COURSE = {
  title: "Learn Gin rummy",
  chapters: [
    { id: "game", title: "The game", lessons: [
      { id: "aim", title: "The aim", steps: [
        { say: "Gin rummy for two. Ten cards each. Group them in melds, keep what's left over small, and end the hand by knocking.",
          rows: [{ label: "Your ten cards", cards: "4h 5h 6h 8d 8c 8s Kd 3c 2s Ad" }] },
        { say: `This game plays the usual rules. Ace low only. Knock with 10 or less left over. Undercut ${BONUS.undercut}, gin ${BONUS.gin}, big gin ${BONUS.big}. Games to ${TO[1]} (${TO[0]} or ${TO[2]} in the Menu), ${BONUS.game} extra for the game, ${BONUS.box} for each hand won.`,
          rows: [{ label: "Knock", text: "10 or less" }, { label: "Undercut", text: `+${BONUS.undercut}` }, { label: "Gin", text: `+${BONUS.gin}` }, { label: "Big gin", text: `+${BONUS.big}` }] },
        { say: "Laying off, when the other player knocks, is done for you as well as it can be done. Your melds are set to leave them the least to lay off.",
          rows: [{ label: "Laying off", text: "done for you" }] },
        { say: "How much may you have left over to knock?", quiz: ["10 or less", "5 or less", "None"], answer: 0, why: "10 or less. With none it is gin." },
      ] },
      { id: "melds", title: "Sets and runs", steps: [
        { say: "A meld is three or more cards that belong together. A set is three or four of one rank. A run is three or more of one suit, in a row.",
          rows: [{ label: "Set", cards: "7d 7c 7h" }, { label: "Set of four", cards: "9d 9c 9h 9s" }, { label: "Run", cards: "4h 5h 6h 7h" }] },
        { say: "The ace is low only. A, 2, 3 is a run. Q, K, A is not: no going round the corner.",
          rows: [{ label: "A run", cards: "Ad 2d 3d" }, { label: "Not a run", cards: "Qs Ks As" }] },
        { say: "Pick a set.", hand: "7d 7c 7s 4h 5h 9s Kd 2c Jh 3s", goal: { meld: "set" }, answer: "7d 7c 7s", then: "Three sevens." },
        { say: "Pick the run of four.", hand: "8s 9s Ts Js Kd Kc 3h 3d 6c Ah", goal: { meld: "run", n: 4 }, answer: "8s 9s Ts Js", then: "8, 9, 10, J of spades." },
        melds("Which of these is a meld?", ["4h 5h 7h", "Qs Ks As", "3c 3d 3s", "5d 6c 7d"], 2, "Three threes. The others skip a card, wrap round or mix suits."),
      ] },
      { id: "deadwood", title: "Deadwood", steps: [
        { say: "Cards in no meld are deadwood. An ace is 1, a face card 10, the rest their number. Fewer points is better.",
          rows: [{ label: "1 point", cards: "Ad" }, { label: "Their number", cards: "2d 6c 9h" }, { label: "10 points", cards: "Td Jc Qh Ks" }] },
        { say: "Count this hand's deadwood: a set of fives, a run of 8, 9, 10, and what's left.", hand: "5c 5d 5h 8s 9s Ts Kd 3c 2h Qd", dead: 25,
          quiz: ["15", "25", "35", "45"], answer: 1, why: "K 10 + Q 10 + 3 + 2 = 25." },
        { say: "Tap the deadwood.", hand: "6c 6d 6h As 2s 3s 4s 9d Kh 5c", goal: { rest: true }, answer: "9d Kh 5c", then: "Everything else is in a meld.", dead: 24 },
        { say: "A card sits in one meld only. The 7♥ fits the set of sevens and the run 5, 6, 7. Which saves more?", hand: "7h 7c 7s 6h 5h Kc 2s Js 9d Ad",
          ways: [{ meld: "7h 7c 7s", dead: 43 }, { meld: "5h 6h 7h", dead: 46 }],
          quiz: ["The set of sevens", "The run 5, 6, 7"], answer: 0, why: "The set leaves 43, the run 46. The game lays your hand out the best way, but you choose what to keep." },
      ] },
    ] },
    { id: "turn", title: "A turn", lessons: [
      { id: "draw", title: "The draw", steps: [
        { say: "The next card is turned up. The player who didn't deal may take it or pass, then the dealer. If both pass, the first draws from the stock.",
          rows: [{ label: "Turned up", cards: "6h" }, { label: "The stock", backs: 1 }] },
        { say: "Each turn draws one card, then throws one. Take the stock's top (unseen) or the pile's top (the other player has seen it too).",
          rows: [{ label: "Pile's top", cards: "9c" }, { label: "The stock", backs: 1 }] },
        { say: "Your hand is 10 cards. The pile shows a 6♥. Take it or draw?", oneDeck: true, rows: [{ label: "Pile's top", cards: "6h" }], hand: "4h 5h 9s 9c Kd 2c 3d Jh Qs 7d", gain: 19,
          quiz: ["Take it", "Draw"], answer: 0, why: "It makes the run 4, 5, 6 and you throw the K♦: 19 less deadwood." },
        { say: "Now the pile shows a K♣. Take it or draw?", oneDeck: true, rows: [{ label: "Pile's top", cards: "Kc" }], hand: "4h 5h 9s 9c Kd 2c 3d Jh Qs 7d", gain: 0,
          quiz: ["Take it", "Draw"], answer: 1, why: "It joins nothing, and throwing another face card saves nothing. Draw." },
        { say: "Taking from the pile shows the other player what you want. A card you draw from the stock stays hidden. Take when the gain is real.",
          rows: [{ label: "You take", cards: "6h" }, { label: "They know you hold", text: "6♠? 7♥? 5♥?" }] },
      ] },
      { id: "throw", title: "The throw", steps: [
        { say: "After drawing you hold eleven. Throw the card that leaves the least deadwood: usually your highest card in no meld.",
          hand: "4h 5h 6h 8d 8c 8s Kd 3c 9s Ad 2c", goal: { throw: true }, answer: "Kd", then: "The king is the dearest dead card." },
        { say: "Two throws can leave the same deadwood. Keep the one that works with your other cards.",
          hand: "4h 5h 6h 8d 8c 8s Kd Qs Js 3c 2d", goal: { cards: "Kd" }, answer: "Kd", bot: "Kd",
          then: "Q♠ and J♠ can become a run with the K♠ or the 10♠.",
          wrong: { Qs: "Same deadwood, but Q♠ and J♠ are neighbours: two cards from a run.", Js: "Same deadwood, but Q♠ and J♠ are neighbours: two cards from a run." } },
        { say: "You took the 5♥ from the pile. Can you throw it straight back?", took: "5h", quiz: ["Yes", "No"], answer: 1, why: "No. The card you take from the pile stays." },
      ] },
      { id: "knock", title: "Knock or gin", steps: [
        { say: "With 10 or less left over after your throw, you may knock instead of throwing. The hand ends and is scored.",
          hand: "4h 5h 6h 8d 8c 8s Jc Jd Jh Kd 3c", goal: { knock: true }, answer: "Kd", then: "Three melds and a 3." },
        { say: "With nothing left over it is gin. Which throw goes gin?", hand: "4h 5h 6h 7h 8d 8c 8s Kc Kd Ks 2d", goal: { gin: true }, answer: "2d" },
        { say: "All eleven cards in melds, with no throw at all, is big gin.", hand: "3h 4h 5h 6h 9c 9d 9s Qc Qd Qs Qh", dead: 0, bigGin: true },
        { say: "Which knock is likelier to be undercut: with 2 or with 10?", quiz: ["With 2", "With 10"], answer: 1, why: "The other player only has to match your count to undercut. 10 is easy to match, 2 is not." },
        { say: "When the stock is down to two cards and you haven't knocked, the hand is a draw: nobody scores. Knock before that if you can.", wash: true,
          rows: [{ label: "Stock", backs: 2 }, { label: "Then", text: "A draw" }] },
      ] },
    ] },
    { id: "score", title: "Scoring and play", lessons: [
      { id: "layoff", title: "Laying off", steps: [
        { say: "They knock with 6. Now you lay off: put cards on their melds to cut your deadwood. The fourth of a set, or the card above or below a run.",
          oneDeck: true, rows: LAYROWS, hand: LAY.f, scene: LAY },
        { say: "Tap every card that goes on a meld.", oneDeck: true, rows: LAYROWS, scene: LAY,
          hand: LAY.f, goal: { lay: true }, answer: "8s 3s", then: "The 8♠ makes four eights, the 3♠ goes under the run." },
        { say: "You are left with K♣ + 2♦ = 12 after laying off. They knocked with 6. What do they score?", oneDeck: true,
          rows: [{ label: "Their deadwood", cards: "Ad 2c 3h" }, { label: "Yours after laying off", cards: "Kc 2d" }], scene: LAY,
          quiz: ["6", "12", "18", "31"], answer: 0, why: "The difference: 12 - 6 = 6." },
      ] },
      { id: "undercut", title: "Undercut and gin", steps: [
        { say: "They knock with 10. You have a set of nines, a set of kings and a run, and an ace left: 1. You can't lay off. What do you score?",
          oneDeck: true, rows: [{ label: "Their set", cards: "3d 3c 3h", meld: true }, { label: "Their run", cards: "6s 7s 8s 9s", meld: true }], hand: "9d 9c 9h Kd Ks Kc 2s 3s 4s Ac",
          scene: { k: "3d 3c 3h 6s 7s 8s 9s Ad 4c 5d Qh", f: "9d 9c 9h Kd Ks Kc 2s 3s 4s Ac", card: "Qh", kind: "knock", winner: 1, points: 34, dead: [10, 1], lay: "" },
          quiz: ["9", "10", "25", "34"], answer: 3, why: "An undercut: you match or beat their count. You score the difference, 10 - 1 = 9, and 25 more." },
        { say: "You go gin: every card melded. They hold 38 in deadwood, and could lay off the 7♥ and the 5♠, but not against gin. What do you score?",
          oneDeck: true, rows: [{ label: "Your set", cards: "3d 3c 3h", meld: true }, { label: "Your run", cards: "4h 5h 6h", meld: true }, { label: "Your run", cards: "6s 7s 8s 9s", meld: true }], hand: "Jd Jc Js 7h 5s Kh 2d 4c 9h Ac",
          scene: { k: "3d 3c 3h 6s 7s 8s 9s 4h 5h 6h Qc", f: "Jd Jc Js 7h 5s Kh 2d 4c 9h Ac", card: "Qc", kind: "gin", winner: 0, points: 63, dead: [0, 38], lay: "" },
          quiz: ["38", "63", "69", "100"], answer: 1, why: "Gin scores their deadwood, 38, and 25. No laying off." },
        { say: "Big gin: all eleven cards melded, no throw. Their deadwood is 38 again.",
          oneDeck: true, hand: "Jd Jc Js 7c 5s Kh 2d 4c 9h Ac",
          scene: { k: "3d 3c 3h 6s 7s 8s 9s 4h 5h 6h 7h", f: "Jd Jc Js 7c 5s Kh 2d 4c 9h Ac", card: null, kind: "big", winner: 0, points: 69, dead: [0, 38], lay: "" },
          quiz: ["38", "63", "69", "100"], answer: 2, why: "38 + 31 = 69." },
        { say: "A hand is worth little beside the game. Whoever reaches the target adds the game bonus, and each hand won adds a little. Knocking low and often wins games.",
          rows: [{ label: "The game", text: `${TO[1]} points` }, { label: "Bonus", text: `+${BONUS.game}, +${BONUS.box} a hand won` }] },
      ] },
      { id: "safe", title: "Discarding safely", steps: [
        { say: "Every card the other player takes from the pile shows a meld in the making. Remember them, and don't throw what they can use: the same rank, or a neighbour in the suit.",
          rows: [{ label: "They took from the pile", cards: "8s 9s" }] },
        { say: "They took the 8♠ and the 9♠. Throw one card: Kc and Ts leave the same deadwood.", oneDeck: true, rows: [{ label: "They took from the pile", cards: "8s 9s" }],
          hand: "4h 5h 6h Jd Jc Jh Kc Ts 8d 2c 3d", goal: { cards: "Kc" }, answer: "Kc", bot: "Kc",
          then: "Kc is safe. They want spades near the 8 and 9, or eights.",
          wrong: { Ts: "The 10♠ completes 8, 9, 10 of spades. Same deadwood as the K♣, but it feeds them.", "8d": "Two more deadwood, and the 8♦ is a card for the eights they may be collecting." } },
        { say: "You hold 7♥ 8♥ and want the 6♥ or the 9♥. The 6♥ sits under the top of the pile, and nobody can draw it. How many cards still complete the run?",
          hand: "7h 8h Kc Qd 2s 5c 9d 4d Js Ad", outs: { buried: "6h", count: 1 },
          quiz: ["0", "1", "2", "3"], answer: 1, why: "The 9♥ only. A buried card is gone, so count what can still come." },
        { say: "They threw a 9♦ at once after drawing from the stock. Is your 9♣ a likely safe throw?", quiz: ["Likely safe", "Dangerous"], answer: 0, why: "A card they throw is one they don't need. They are probably not collecting nines. It's a read, not a promise." },
      ] },
      { id: "play", title: "Your first game", steps: [
        { say: "Count your deadwood as you draw, take only what saves points, throw the dearest loose card, and knock when it's low. A game against Easy: go.", play: true },
      ] },
    ] },
  ],
};
export { hold };
