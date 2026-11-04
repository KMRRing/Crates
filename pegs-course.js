// Cribbage's course (Learn, in the Menu): the deal and the crib, counting a hand, the play, what to throw and how to peg,
// the board, then a first game against Easy. The lessons are data on the card stage (course-cards.js), drawn by course.js;
// a step is
//
//   { say }                                  words over the cards, and Next
//   { say, quiz: [options], answer, why }    choose; a count carries is: the total the engine's countHand gives
//   { say, goal, hand, table, answer, then, wrong }   pick cards from the hand; answer is what Hint picks, then the
//                                            words for a right pick, wrong the words for particular wrong ones
//
// A goal: { sum } cards adding to this (fifteen); { cards: [texts] } exactly one of these picks (each text as
// course-cards.js writes cards: "5 K" is any five and any king); { not: [texts] } any one card but these.
// Cards are written as course-cards.js does ("5h", "Td", "A", rank 2 and ace included); the course's ids are its own,
// toPegs() turns one into the engine's (pegs-rules.js), and every number a lesson states is worked by the engine's
// scoring: tests/pegs-course.mjs checks them, and that the computer players choose what the lessons teach.
import { countHand, value, cardName, rankOf as pegRank, suitOf, RANKS } from "./pegs-rules.js";
import { cardsOf, sameCards } from "./course-cards.js";

// course-cards ranks run 3..K, A, 2; Cribbage's run A, 2..K
const PEG_RANK = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 1];
/** A course-cards id as the engine's card (rank = id % 13, ace 0; suit = id / 13, ♦ ♣ ♥ ♠). */
export const toPegs = id => (id & 3) * 13 + PEG_RANK[id >> 2];
export const face = id => ({ rank: RANKS[pegRank(toPegs(id))], suit: suitOf(toPegs(id)) });
export const label = id => cardName(toPegs(id));
export const hold = ids => [...ids].sort((a, b) => pegRank(toPegs(a)) - pegRank(toPegs(b)) || (a & 3) - (b & 3));
/** Cards written as text, as the engine's ids. */
export const pegsOf = text => cardsOf({ hand: text }).hand.map(toPegs);

const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
/** What a count is made of, in words, from the engine's own count. */
export function describe(c) {
  const out = [];
  if (c.fifteens) out.push(`${plural(c.fifteens, "fifteen")} = ${c.fifteens * 2}`);
  if (c.pairs) out.push(`${plural(c.pairs, "pair")} = ${c.pairs * 2}`);
  if (c.run) out.push(c.run.n === 1 ? `a run of ${c.run.len} = ${c.run.len}` : `${c.run.n} runs of ${c.run.len} = ${c.run.len * c.run.n}`);
  if (c.flush) out.push(`flush of ${c.flush} = ${c.flush}`);
  if (c.nobs) out.push("his nobs = 1");
  return `${out.length ? out.join("; ") : "Nothing"}. Total ${c.total}.`;
}
const countOf = (hand, starter, o) => countHand(pegsOf(hand), pegsOf(starter)[0], o);
/** The sets of cards adding to 15, as "5+K, 6+9". */
function fifteensOf(text) {
  const cards = pegsOf(text), out = [];
  for (let m = 1; m < 1 << cards.length; m++) {
    const set = cards.filter((_, i) => m & (1 << i));
    if (set.reduce((a, c) => a + value(c), 0) === 15) out.push(set.map(c => RANKS[pegRank(c)]).join("+"));
  }
  return out;
}
/** A hand and its starter counted: the quiz is the engine's total (is), the explanation its parts. */
function countQuiz(say, hand, starter, options, extra = {}) {
  const c = countOf(hand, starter, extra), is = c.total;
  return {
    say, oneDeck: true, rows: [{ label: "Hand", cards: hand }, { label: "Starter", cards: starter }], quiz: options.map(String),
    answer: options.indexOf(is), is, count: { hand, starter }, why: describe(c),
  };
}
/** What keeping four of six averages over every starter that could turn up, for the best keep. */
export function keepAverage(handText, throwText) {
  const hand = pegsOf(handText), out = pegsOf(throwText), keep = hand.filter(c => !out.includes(c));
  let v = 0, n = 0;
  for (let c = 0; c < 52; c++) if (!hand.includes(c)) { v += countHand(keep, c).total; n++; }
  return v / n;
}
const avg = (hand, out) => keepAverage(hand, out).toFixed(1);

const HAND6 = "4h 5d 6c 6s 9d Kh", FIVES = "As 2c 3d 5s 5d 9h";

export const COURSE = {
  title: "Learn Cribbage",
  zh: "",
  chapters: [
    {
      id: "count", title: "Counting", lessons: [
        { id: "deal", title: "The deal and the crib", steps: [
          { say: "Two players, six cards each. From your six you put two face down in the crib, and keep four. The crib is a fourth hand, counted at the end of the deal.", hand: HAND6, handLabel: "Your six", rows: [{ label: "The crib: two from each", backs: 4 }] },
          { say: "The crib belongs to the dealer, and the deal changes hands each time. Then the top card of the pack is turned: the starter. It counts in every hand and in the crib.", rows: [{ label: "The starter", cards: "7d" }] },
          { say: "You deal. Whose crib is it?", quiz: ["Yours", "Your opponent's", "The player behind on the board", "The one who cut the pack"], answer: 0, why: "The dealer's, every hand: the deal alternates, and so does the crib." },
          { say: "A jack as the starter is his heels: the dealer pegs 2 at once, before a card is played. Pegging is moving your peg along the board; 121 holes wins.", rows: [{ label: "His heels", cards: "Jh" }] },
          { say: "The starter is a jack and you are not the dealer. Who pegs, and how many?", quiz: ["The dealer, 2", "The dealer, 1", "You, 2", "Nobody"], answer: 0, why: "His heels is two for the dealer, at once.", heels: true },
        ] },
        { id: "fifteens", title: "Fifteens", steps: [
          { say: "Counting a hand: your four cards and the starter. Face cards count 10, an ace 1, the rest their number. Every set of cards adding to 15 scores 2.", hand: "5h Kd 6c 9s 4d", handLabel: "Four cards and the starter" },
          { say: "Tap cards adding to 15.", hand: "5h Kd 6c 9s 4d", handLabel: "Four cards and the starter", goal: { sum: 15 }, answer: "5 K", then: "Fifteen: 2 points. There are more in this hand." },
          { say: `How many fifteens are in this hand? (${fifteensOf("5h Kd 6c 9s 4d").join(", ")} are the sets.)`, oneDeck: true, rows: [{ label: "Hand", cards: "5h Kd 6c 9s" }, { label: "Starter", cards: "4d" }], quiz: ["2", "3", "4", "5"], answer: fifteensOf("5h Kd 6c 9s 4d").length - 2, why: `${fifteensOf("5h Kd 6c 9s 4d").join(", ")}: ${fifteensOf("5h Kd 6c 9s 4d").length} sets, 2 each.`, is: fifteensOf("5h Kd 6c 9s 4d").length },
          { say: "Sixteen cards in 52 count ten, so every five makes a fifteen with any of them. Fives are the best cards in cribbage; a ten-card and a five are the best pair to hold.", rows: [{ label: "Fifteen", cards: "5h Kd" }] },
        ] },
        { id: "runs", title: "Pairs and runs", steps: [
          { say: "A pair scores 2; three of a kind 6 (three pairs); four of a kind 12 (six pairs).", rows: [{ label: "Pair: 2", cards: "7h 7d" }, { label: "Three: 6", cards: "7h 7d 7c" }, { label: "Four: 12", cards: "7h 7d 7c 7s" }] },
          { say: "A run is three or more cards in a row by rank, whatever the suits: a point a card. The ace is low only.", rows: [{ label: "Run of 3: 3", cards: "4h 5d 6c" }, { label: "Run of 4: 4", cards: "9d Tc Jh Qs" }, { label: "Not a run: the ace is low", cards: "Qh Kd Ac" }] },
          { say: "A card that appears twice makes the run twice: a double run. Here, with the starter, two runs of 3, a pair and three fifteens.", oneDeck: true, rows: [{ label: "Hand", cards: "4h 4d 5c 6s" }, { label: "Starter", cards: "Kd" }] },
          countQuiz("What does it count?", "4h 4d 5c 6s", "Kd", [8, 10, 12, 14]),
          countQuiz("Four of a kind with the starter: what does this count?", "3h 3d 3c 9s", "3s", [12, 16, 20, 24]),
        ] },
        { id: "flush", title: "Flush and nobs", steps: [
          { say: "Four cards of one suit in your hand score 4; 5 if the starter is that suit too. A flush counts for the four in your hand even if the starter is another suit.", oneDeck: true, rows: [{ label: "Hand", cards: "2h 7h 9h Kh" }, { label: "Starter", cards: "4c" }] },
          countQuiz("What does it count?", "2h 7h 9h Kh", "4c", [4, 6, 8, 10]),
          { say: "In the crib a flush needs all five cards, the starter included: four of a suit is nothing there." },
          { say: "His nobs: the jack in your hand of the same suit as the starter scores 1.", oneDeck: true, rows: [{ label: "Hand", cards: "6h 7d 8c Jd" }, { label: "Starter", cards: "3d" }] },
          countQuiz("What does it count?", "6h 7d 8c Jd", "3d", [3, 5, 6, 8]),
          { say: `The best hand there is, 29: three fives and the jack of the starter's suit, the fourth five turned. ${describe(countOf("5h 5d 5c Js", "5s"))}`, oneDeck: true, rows: [{ label: "Hand", cards: "5h 5d 5c Js" }, { label: "Starter", cards: "5s" }] },
          countQuiz("Count it all: fifteens, pairs, runs, flush, nobs.", "5h Jc 8d 8s", "2s", [6, 8, 10, 12]),
          countQuiz("And this one?", "4h Jh 8c Ks", "2h", [0, 1, 3, 4]),
        ] },
      ],
    },
    {
      id: "play", title: "The play", lessons: [
        { id: "thirtyone", title: "Up to 31", steps: [
          { say: "After the crib is made, the play. The non-dealer leads a card face up; each plays one in turn, adding to a running count that may not pass 31. Make 15 and you peg 2; make 31, 2.", rows: [{ label: "7 and 8: count 15", cards: "7s 8d" }] },
          { say: "The count is 10. Play to make 15.", table: "7s 3d", tableLabel: "Played: count 10", hand: "5h 9c Kc 6d", goal: { cards: ["5"] }, answer: "5h", pts: 2, then: "15: 2 pegs.", wrong: { "9": "That makes 19: nothing.", "K": "That makes 20: nothing.", "6": "That makes 16: nothing." } },
          { say: "Count 28. Play to make 31.", table: "Kd Qs 8h", tableLabel: "Played: count 28", hand: "3d Kc 7h Ad", goal: { cards: ["3"] }, answer: "3d", pts: 2, then: "31: 2 pegs. The count starts again.", wrong: { "A": "That makes 29: nothing, and 31 is within reach." } },
          { say: "Can't play without passing 31? You say go (Cribbage does it for you). The other plays on while they can, and the last to play pegs 1 for go. Making exactly 31 pegs 2 instead. Then the count starts again, led by the other." },
          { say: "The count is 24. You play a 5 (29); neither of you can play again. What do you peg?", quiz: ["1, for go", "Nothing", "2", "3"], answer: 0, go: { seq: "Kd Qs 4h", mine: "5c", foe: "Kh Qh Jh" }, why: "One for go, to the last to play. Exactly 31 would have been 2." },
          { say: "The last card played in the whole play also pegs 1. Then the hands are counted: the non-dealer first, then the dealer, then the dealer counts the crib." },
        ] },
        { id: "playpairs", title: "Scoring in the play", steps: [
          { say: "Pairs and runs score in the play too. Play the rank just played: a pair, 2. A third makes 6, a fourth 12. Play the card that pairs.", table: "6h 9d", tableLabel: "Played: count 15", hand: "9h 4c Kd 2s", goal: { cards: ["9"] }, answer: "9h", pts: 2, then: "A pair: 2 pegs.", wrong: { "4": "Nothing pairs there.", "K": "Nothing pairs there.", "2": "Nothing pairs there." } },
          { say: "A run counts if the last three or more cards played make one, in any order. Play the card that makes both a run and 15.", table: "4h 6d", tableLabel: "Played: count 10", hand: "5c Kd 9s 2c", goal: { cards: ["5"] }, answer: "5c", pts: 5, then: "4, 6, 5 is a run of 3, and 15: 5 pegs." },
          { say: "Play to make a run of four.", table: "8h 6d 9c", tableLabel: "Played: count 23", hand: "7s Ks 2d 4h", goal: { cards: ["7"] }, answer: "7s", pts: 4, then: "6, 7, 8, 9 in any order: a run of 4 pegs 4.", wrong: { "2": "Nothing there.", "4": "Nothing there." } },
          { say: "A card in the middle that doesn't belong breaks the run. 5, 9, 6 are played and you hold a 7. What does the 7 peg?", table: "5h 9d 6c", tableLabel: "Played: count 20", hand: "7s", quiz: ["0", "3", "4", "5"], answer: 0, pts: 0, why: "The last three cards would be 9, 6, 7 and the last four 5, 9, 6, 7: neither is a run." },
        ] },
      ],
    },
    {
      id: "well", title: "Playing well", lessons: [
        { id: "throw", title: "What to throw", steps: [
          { say: "Start with your own hand: keep the four that average most over the starters that can turn up. Which two go to the crib?", hand: HAND6, handLabel: "Your six", crib: "none", goal: { cards: ["9 K"] }, answer: "9d Kh", then: `Keeping 4, 5, 6, 6 averages ${avg(HAND6, "9d Kh")} points with the starter; the next best keep averages ${avg(HAND6, "6c Kh")}.`, miss: `That keeps less: 4, 5, 6, 6, a double run, averages ${avg(HAND6, "9d Kh")}.` },
          { say: "Then the crib. If it is yours, send it cards that work together: a pair, a five, two cards adding to 15 (a five and a ten-card), neighbours in rank, one suit. If it is the other's, split those up: no fives, no pairs, no cards 1 or 2 apart.", rows: [{ label: "To your own crib", cards: "5h Kd" }, { label: "To theirs", cards: "Kc 2d" }] },
          { say: "You deal, so the crib is yours.", hand: FIVES, handLabel: "Your six", crib: "dealer", goal: { cards: ["5 5"] }, answer: "5s 5d", then: "A pair of fives for your own crib: a pair, and a fifteen with every ten-card that lands there.", miss: "Not the best: the two fives together are worth most in your crib.", wrong: { "A 9": "Keeping 2, 3, 5, 5 is right for the hand, but it is your crib: put the fives where you collect them." } },
          { say: "The same hand, but you don't deal: the crib is your opponent's.", hand: FIVES, handLabel: "Your six", crib: "other", goal: { cards: ["A 9"] }, answer: "As 9h", then: "You keep 2, 3, 5, 5: fifteens and a pair for your hand; the ace and the 9 do little together in their crib.", wrong: { "5 5": "That hands the dealer a pair of fives." } },
          { say: "You don't deal. Which two cards cost you least in the other's crib?", quiz: ["A five and a king", "A seven and an eight", "Two fours", "A king and a two"], answer: 3, cribPairs: ["5h Kd", "7s 8d", "4h 4d", "Kc 2c"], why: "King and two: they make no fifteen, no pair, no run together. A five and a king is a fifteen, two fours a pair, seven and eight a fifteen and a run start." },
        ] },
        { id: "tactics", title: "Pegging tactics", steps: [
          { say: "Don't leave a count of 5 or 21: any ten-card then makes 15 or 31, and 16 cards in 52 are tens. Play so the count isn't 5.", table: "4h", tableLabel: "Played: count 4", hand: "Ac 6s 8d Kc", leave: 5, goal: { not: ["A"] }, answer: "6s", then: "Right: 10, 12 or 14 gives them no easy 15.", wrong: { "A": "That makes the count 5: any ten-card makes 15 for them." } },
          { say: "Same at 21 (a ten makes 31).", table: "9h Qd", tableLabel: "Played: count 19", hand: "2s 4c 7d 9c", leave: 21, goal: { not: ["2"] }, answer: "4c", then: "Right.", wrong: { "2": "That makes 21: any ten-card makes 31 for them." } },
          { say: "Your opponent leads a five. Any ten-card makes 15.", table: "5s", tableLabel: "Played: count 5", hand: "Qd 3c 7h 8s", goal: { cards: ["Q"] }, answer: "Qd", pts: 2, then: "15: 2 pegs.", wrong: { "3": "Nothing there.", "7": "Nothing there.", "8": "Nothing there." } },
          { say: "You lead. Lead a card of a pair you hold: if they pair it, your second makes three of a kind, 6. Never lead a five.", hand: "4h 4s 9d Kc", handLabel: "Your hand", lead: true, goal: { cards: ["4"] }, answer: "4h", then: "If they pair your 4, your other 4 pegs 6. A low card also keeps the count away from 15.", miss: "Better to lead from the pair: if they match it, you peg 6.", wrong: {} },
        ] },
        { id: "board", title: "The board and the skunk", steps: [
          { say: "The board has 121 holes. Each side has two pegs: the front peg shows the score, the back peg where you stood before the last score. Move the back one to the front each time." },
          { say: "First to 121 wins at once, even in the middle of a count. The non-dealer counts first, so in a close finish they can win before the dealer counts. A short game is to 61." },
          { say: "Lose by a lot and you are skunked: under 91 at the end of a game to 121 (under 31 to 61). Under 61, a double skunk. It is only said at the end; it doesn't change the score. You win 121 to 88. What is that?", quiz: ["No skunk", "A skunk", "A double skunk"], answer: 1, skunk: { to: 121, loser: 88 }, why: "88 is under 91: a skunk. Under 61 would be a double." },
          { say: "And 121 to 59?", quiz: ["No skunk", "A skunk", "A double skunk"], answer: 2, skunk: { to: 121, loser: 59 }, why: "59 is under 61: a double skunk." },
        ] },
      ],
    },
    {
      id: "game", title: "A game", lessons: [
        { id: "first", title: "A first game", steps: [
          { say: "You know enough to sit down. A game against Easy. Ask for a Hint whenever you like.", play: true },
        ] },
      ],
    },
  ],
};

/** A pick of cards judged against a step's goal: { ok, msg } or { ok: false, why }. */
export function judge(step, ids) {
  const g = step.goal || {}, wrong = Object.entries(step.wrong || {}).find(([k]) => sameCards(ids, k));
  const ok = { ok: true, msg: step.then || "Right." };
  if (g.sum != null) {
    const n = ids.reduce((a, id) => a + value(toPegs(id)), 0);
    return n === g.sum ? ok : { ok: false, why: `Those add to ${n}.` };
  }
  if (g.cards) return g.cards.some(t => sameCards(ids, t)) ? ok : { ok: false, why: wrong?.[1] || step.miss || "Not that." };
  if (g.not) {
    if (ids.length !== 1) return { ok: false, why: "Play one card." };
    return wrong ? { ok: false, why: wrong[1] } : ok;
  }
  return ok;
}
