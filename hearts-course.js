// Hearts' course (Learn, in Menu): the game taught from nothing, in the variant the engine plays (hearts-rules.js:
// four players, three cards passed left, right, across, then none; the 2♣ leads; a heart is a point, the Q♠ thirteen;
// the Q♠ alone doesn't break hearts; no points on the first trick unless every card you hold has some; a moon scores
// the shooter nothing and the others 26), in two chapters, ending in a first game against Easy. The lessons are data on
// the card stage (course-cards.js), which orders ranks 3 lowest … 2 highest; Hearts has the 2 lowest, so cards are
// written as the stage does (rank 2–9, T, J, Q, K, A, then a suit d c h s, always) and turned into the engine's ids here.
// A step is
//
//   { say }                                   words (and rows / table / hand to look at), then Next
//   { say, quiz: [options], answer, why }     a choice; trick: { plays: "8c 3c Kc Qc", win: 2 | pts: 14 } says the
//                                             answer is that trick's (the test works the trick out)
//   { say, goal, answer, then, wrong, miss }  play one card of the hand (goal.pass: pass three), judged by the rules
//                                             (whyNot); goal.cards lists the right picks ("Qs Ks Ah" for a pass), then
//                                             is the words for a right pick, wrong the words for particular wrong
//                                             ones (keyed by the cards), miss for any other legal pick
//
// table: the cards already played to the trick, first led first, which puts you in the seat after them; first: true is
// the first trick of the hand, broken: true hearts already played; a lead has no table.
import { whyNot, cardName, RANKS, rankOf, suitOf, byHand } from "./hearts-rules.js";
import { cardsOf, sameCards } from "./course-cards.js";

/** A card as the course stage writes it (3 lowest … 2 highest) as Hearts' id (2 lowest … A highest). */
export const toId = id => (((id >> 2) + 1) % 13) * 4 + (id & 3);
export const face = id => ({ rank: RANKS[rankOf(toId(id))], suit: suitOf(toId(id)) });
export const label = id => cardName(toId(id));
/** A hand held as the table holds it: spades, hearts, clubs, diamonds, low to high. */
export const hold = ids => [...ids].sort((a, b) => byHand(toId(a), toId(b)));

/** A step's table as the rules see it: your hand at the seat after the cards played. */
export function stateOf(step) {
  const { hand, table } = cardsOf(step), me = table.length;
  const hands = [[], [], [], []];
  hands[me] = hand.map(toId);
  return { me, s: { hands, done: step.first ? 0 : 1, broken: !!step.broken, trick: { plays: table.map((c, seat) => ({ seat, card: toId(c) })), lead: 0 } } };
}

/** A pick judged against a step's goal: { ok, msg } or { ok: false, why }. */
export function judge(step, ids) {
  const g = step.goal || {}, wrong = Object.entries(step.wrong || {}).find(([k]) => sameCards(ids, k));
  if (wrong) return { ok: false, why: wrong[1] };
  if (g.pass) {
    if (ids.length !== 3) return { ok: false, why: "Pass three cards." };
  } else {
    if (ids.length !== 1) return { ok: false, why: "Play one card." };
    const { me, s } = stateOf(step), why = whyNot(s, me, toId(ids[0]));
    if (why) return { ok: false, why };
  }
  if (g.cards && ![].concat(g.cards).some(k => sameCards(ids, k))) return { ok: false, why: step.miss || "Legal, but not the best one here: try again." };
  return { ok: true, msg: step.then || "Right." };
}
/** The card stage with Hearts' own words on its button. */
export const withLabels = stage => ({ ...stage, label: (s, t) => (s.goal?.pass ? (t.sel?.size === 3 ? "Pass these 3" : "Pass") : t.sel?.size ? "Play it" : "Play") });

// ---------- the lessons ----------
const HEARTS = "2h 3h 4h 5h 6h 7h 8h 9h Th Jh Qh Kh Ah";
export const COURSE = {
  title: "Learn Hearts", zh: "",
  chapters: [
    {
      id: "game", title: "The game",
      lessons: [
        {
          id: "deal", title: "Thirteen cards, 26 points",
          steps: [
            { rows: [{ label: "You", backs: 13 }, { label: "Each of the others", backs: 13 }], say: "Hearts: four players, each for themselves, thirteen cards each. Take as few points as you can. This is the usual game with this table's rules; where they differ from other tables, it says so." },
            { rows: [{ label: "A point each", cards: HEARTS }, { label: "Thirteen", cards: "Qs" }], say: "Every heart costs one point and the queen of spades (Q♠) thirteen: 26 in a hand. No other card costs anything." },
            { rows: [{ label: "A point each", cards: HEARTS }, { label: "Thirteen", cards: "Qs" }], quiz: ["13", "26", "39"], answer: 1, say: "How many points are there in a hand?", why: "13 hearts and the 13 of the Q♠." },
            { rows: [{ label: "Scores", text: "61 · 74 · 98 · 100" }], quiz: ["The lowest", "The highest"], answer: 0, say: "Hands are played until someone reaches 100 points (Menu: 50 or 150). Whose score wins?", why: "The lowest. A tie for the lowest plays another hand." },
          ],
        },
        {
          id: "pass", title: "Passing three cards",
          steps: [
            { rows: [{ label: "Hand 1", text: "Pass left" }, { label: "Hand 2", text: "Pass right" }, { label: "Hand 3", text: "Pass across" }, { label: "Hand 4", text: "No pass" }], say: "Before the play everyone passes three cards face down to one neighbour and gets three from another: left in the first hand, right in the second, across in the third, none in the fourth. Then round again." },
            { rows: [{ label: "The order", text: "left · right · across · none" }], quiz: ["Left", "Right", "Across", "Nobody"], answer: 1, deal: 6, dir: "right", say: "In the sixth hand, who gets your three cards?", why: "The player on your right: the order goes left, right, across, none, and the fifth hand is a left again." },
            { rows: [{ label: "The order", text: "left · right · across · none" }], quiz: ["Left", "Right", "Across", "Nobody"], answer: 3, deal: 8, dir: "hold", say: "And in the eighth?", why: "Nobody: every fourth hand is played as dealt." },
            { rows: [{ label: "You pass", text: "3 cards" }, { label: "You get", text: "3 cards" }], say: "You choose your three before you see the three you get, and so do the computer players. What to pass is in the next chapter." },
          ],
        },
        {
          id: "tricks", title: "Tricks and following suit",
          steps: [
            { rows: [{ label: "Led", cards: "8c" }, { label: "Next", cards: "3c" }, { label: "Next", cards: "Kc" }, { label: "Last", cards: "Qc" }], say: "A hand is thirteen tricks. One player leads a card, each in turn plays one, and the highest card of the suit led takes all four and leads the next trick. Play goes round to the left." },
            { rows: [{ label: "Led", cards: "9d" }, { label: "Next", cards: "2d" }, { label: "Next", cards: "Ah" }, { label: "Last", cards: "Jd" }], quiz: ["9♦", "2♦", "A♥", "J♦"], answer: 3, trick: { plays: "9d 2d Ah Jd", win: 3 }, say: "Who takes this trick?", why: "The J♦, the highest diamond. The A♥ isn't a diamond, so it can't win." },
            { table: "8c 3c", hand: "Jc 4c 6d Qs Ah", goal: { cards: ["Jc", "4c"] }, answer: "4c", say: "You must follow the suit led if you can. Clubs were led: play a club.", then: "Either club follows. With no club in your hand you could play anything." },
          ],
        },
        {
          id: "points", title: "Taking points",
          steps: [
            { rows: [{ label: "Led", cards: "5c" }, { label: "Next", cards: "Jh" }, { label: "Next", cards: "Ac" }, { label: "Last", cards: "Qs" }], quiz: ["1", "13", "14"], answer: 2, trick: { plays: "5c Jh Ac Qs", pts: 14 }, say: "Points go to whoever wins the trick, not whoever played them. What does the A♣ take?", why: "The J♥ (1) and the Q♠ (13): the two players who couldn't follow suit gave their points away." },
            { rows: [{ label: "Led", cards: "6d" }, { label: "Next", cards: "4h" }, { label: "Next", cards: "2d" }, { label: "Last", cards: "Kh" }], quiz: ["0", "2", "3"], answer: 1, trick: { plays: "6d 4h 2d Kh", pts: 2 }, say: "What does the 6♦ take?", why: "Two points, the 4♥ and the K♥. A high card of the suit led is a danger when points are in the trick; a low one is safe." },
          ],
        },
        {
          id: "lead", title: "Leading, and breaking hearts",
          steps: [
            { hand: "2c 5c 9c Kc 4d 8d Qd 3s 7s Js Ah 6h 9h", goal: { cards: ["2c"] }, first: true, answer: "2c", say: "The holder of the 2♣ opens the hand with it. You hold it.", then: "The 2♣ always leads the first trick." },
            { table: "2c Tc", hand: "4d 9d Js Qs Ah 5h", first: true, goal: { cards: ["4d", "9d", "Js"] }, answer: "9d", say: "You have no clubs. On the first trick nothing with points may be played: no heart, no Q♠, unless every card you hold has points.", then: "A diamond or the J♠. Had you held only hearts and the Q♠, anything would do." },
            { hand: "Ah 6h 3d 8s Kc", goal: { cards: ["3d", "8s", "Kc"] }, answer: "3d", say: "Hearts can't be led until one has been played (hearts are broken), unless you hold nothing else. None has. Lead.", then: "Any card but a heart." },
            { rows: [{ label: "Led, then dumped", cards: "4c Qs" }], quiz: ["Yes", "No"], answer: 1, say: "Someone dumps the Q♠ on a club trick. Are hearts broken?", why: "No: at this table only a heart breaks them." },
          ],
        },
      ],
    },
    {
      id: "well", title: "Playing well",
      lessons: [
        {
          id: "give", title: "What to pass",
          steps: [
            { rows: [{ label: "Pass", cards: "Qs Ks Ah" }, { label: "Keep", cards: "2h 3c 4d" }], say: "Pass what can hurt you: the Q♠, and the A♠ and K♠ that would catch it, unless you hold five or more spades to guard it; high hearts; and the cards of a short suit, to empty it (a void), so that when it's led you can play any card on it." },
            { hand: "Qs Ks 5s Ah 8h 3h Qc 9c 6c Jd 7d 4d 2d", goal: { pass: true, cards: ["Qs Ks Ah"] }, answer: "Qs Ks Ah", say: "Three spades only. Pass three.", then: "The Q♠ and the K♠ that would catch it, and the A♥, the heart that takes most.", miss: "Not those three: the Q♠ with only two small spades behind it is the worst card to keep." },
            { hand: "Js 8s 5s 2s Kh Qh Ac 9c 6c 3c Kd 7d 2d", goal: { pass: true, cards: ["Qh Kh Kd"] }, answer: "Qh Kh Kd", say: "No Q♠ here, and only two hearts. Pass three.", then: "Both hearts and the K♦: you hold no hearts now, so any heart led is a card to dump on.", miss: "Not those three: the two high hearts go, and with them the suit is empty." },
            { hand: "Qs 9s 6s 4s 2s Kh 7h 3h Ac 8c 5c Jd 4d", goal: { pass: true, cards: ["Kh Ac Jd"] }, answer: "Kh Ac Jd", say: "Now you hold the Q♠ and four spades behind her. Pass three.", then: "Keep her: five spades guard her, because you can play a low one when spades are led. The high cards in the other suits go.", miss: "Not those three: with five spades the Q♠ is safe in your hand; pass high cards in the other suits." },
          ],
        },
        {
          id: "duck", title: "Ducking and taking",
          steps: [
            { table: "8c Qc Th", hand: "5c 9c Kc 3d 7s", goal: { cards: ["9c"] }, answer: "9c", say: "To duck is to play under the card that is winning. You play last; the T♥ is a point. Duck with the highest card that does.", then: "The 9♣ ducks the Q♣ and gets rid of your bigger club.", wrong: { Kc: "The K♣ beats the Q♣: you take the trick and the point.", "5c": "That ducks, but the 9♣ does too and is the bigger card to be rid of." } },
            { table: "4c 7c 9c", hand: "5c Kc 2d", goal: { cards: ["Kc"] }, answer: "Kc", say: "Last again, and nothing in the trick. Taking it costs nothing.", then: "Take it with the K♣: a free trick, and the big card is gone.", wrong: { "5c": "It ducks, but nothing is at stake: win it with your highest and be rid of it." } },
          ],
        },
        {
          id: "dump", title: "Dumping",
          steps: [
            { table: "Kc 5c", hand: "Qs Ah 9d 4d 7s", goal: { cards: ["Qs"] }, answer: "Qs", say: "You have no clubs, so any card is allowed. The K♣ is winning. What goes on it?", then: "The Q♠: its player takes thirteen, not you." },
            { table: "Jd 6d", hand: "Ks Ah 9h 3h 4c 2c", goal: { cards: ["Ks"] }, answer: "Ks", say: "No diamonds. The Q♠ is still out. Which card is your biggest danger?", then: "The K♠: while the Q♠ is out, it's the card that would catch her.", wrong: { Ah: "A heart is a point to someone else, yes, but the K♠ is the card to be rid of while the Q♠ is out." } },
            { table: "Jd 6d", hand: "Ah 9h 3h 4c 2c 8s", goal: { cards: ["Ah"] }, answer: "Ah", say: "No diamonds again, and no high spade. Now?", then: "The highest heart: every heart you shed is one you won't take later." },
          ],
        },
        {
          id: "queen", title: "The queen of spades",
          steps: [
            { rows: [{ label: "The queen of spades", cards: "Qs" }], say: "Thirteen points: as much as all the hearts. Don't take her; if you hold her, put her under a higher spade or on a trick you can't win. To find her, lead a low spade: she has to come out under it, or stay home." },
            { hand: "3s Ks 6d Jd 2c Kc 8h 4h", goal: { cards: ["3s"] }, answer: "3s", say: "You hold no Q♠, and she hasn't been played. Lead.", then: "The 3♠ smokes her out and costs nothing.", wrong: { Ks: "The K♠ would catch the Q♠ if she is on the next player's hand: lead the low spade." } },
            { table: "Ks 4s", hand: "Qs 5s 8d", goal: { cards: ["Qs"] }, answer: "Qs", say: "Spades are led and you hold the Q♠.", then: "Under the K♠ she goes to its player, who takes the 13.", wrong: { "5s": "It ducks, but the Q♠ stays in your hand to be caught later: unload her now." } },
          ],
        },
        {
          id: "moon", title: "Shooting the moon",
          steps: [
            { rows: [{ label: "All taken by one player", cards: HEARTS }, { label: "And", cards: "Qs" }], quiz: ["0", "13", "26"], answer: 2, say: "One player takes every heart and the Q♠, all 26. They score nothing; what do each of the other three add?", why: "26 each (Menu can turn this into 26 off the shooter's own score)." },
            { rows: [{ label: "All the points so far are Mira's", cards: "Qs 7h 9h" }], table: "Td 3h Jd", hand: "Kd 5d 2c", goal: { cards: ["Kd"] }, moon: 1, answer: "Kd", say: "Mira has taken the Q♠ and two hearts, and nobody else any: she may be shooting. You play last. Spoil it.", then: "The K♦ takes the heart. One point to you, but Mira's run is over.", wrong: { "5d": "It ducks, and Mira's run goes on: a trick with a point in it is the one to take from her." } },
            { rows: [{ label: "Every point", cards: HEARTS }, { label: "And", cards: "Qs" }], say: "To shoot yourself you want aces, kings and long suits, and high hearts that take every point. Shooting and failing costs what you took on the way, so decide early; the others will try to stop you with the cheapest point they can find." },
          ],
        },
        {
          id: "first", title: "A first game",
          steps: [
            { say: "That's the game. Play one against Easy, who passes high cards and ducks when it can; the Menu can raise it.", play: true },
          ],
        },
      ],
    },
  ],
};
