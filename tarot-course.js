// Tarot's course (Learn, in the header), on the card stage (tarot-stage.js): the pack and its points, the deal, the bids
// and the dog, the play, the score, then how to bid, what to put in the dog, and the last tricks. What a lesson asks of the
// cards is judged by the rules themselves (which cards are lawful, which the dog refuses), a trick's winner and a deal's
// pay are worked out by them as the lesson loads, a bid by the computer players' own strength rule, and a puzzle's
// answer is proved by searching the cards (tarot-solve.js): tests/tarot-course.mjs checks that every step says what the
// game would do.
//
//   { say }                                  words over the cards, and Next
//   { say, quiz: [options], answer, why }    choose
//   { say, goal, hand, table, answer, why }  pick cards on the stage (tarot-stage.js)
//   { say, play: true }                      the last step: a game against Easy
import { BIDS, TARGETS, POIGNEE, dealValue, payments, winnerOf, cardName, boutsOf } from "./tarot-rules.js";
import { strength, BID_AT } from "./tarot-bot.js";
import { solve } from "./tarot-solve.js";
import { parseCards, tokenOf } from "./tarot-stage.js";

const NAMES = ["North", "East", "South", "West"];

/** A trick written as cards in the order played, led by seat 0: the quiz asking which wins. */
function whoWins(say, table, why) {
  const cards = parseCards(table), plays = cards.map((card, i) => ({ seat: i, card })), w = winnerOf(plays);
  return { say, table, tableLabel: "In the order played", quiz: cards.map((c, i) => `${["First", "Second", "Third", "Fourth"][i]}: ${cardName(c)}`), answer: w, why: why(cards, w) };
}
/** A bid asked of a hand: the computer players' rule says which. */
function bidHand(say, hand, high = 0) {
  const st = strength(parseCards(hand), 4), at = BID_AT[4];
  let best = 0;
  for (let b = 1; b <= 4; b++) if (st >= at[b - 1]) best = b;
  const bid = best > high ? best : 0;
  const options = ["Pass", "Petite", "Garde", "Garde sans le chien"];
  const bouts = boutsOf(parseCards(hand)), trumps = parseCards(hand).filter(c => c < 21).length;
  return {
    say, hand, handLabel: "Your eighteen cards", quiz: options, answer: bid,
    why: `${bid ? options[bid] : "Pass"}: ${bouts} bout${bouts === 1 ? "" : "s"} and ${trumps} trumps count ${st.toFixed(0)} in the computer players' reckoning (Petite from ${at[0]}, Garde from ${at[1]}, sans le chien from ${at[2]}).`,
  };
}
/** A puzzle on the last tricks, every hand known: the answer is the card the search finds best for the one to move. */
function puzzle(say, { hands, att, lead = 0, plays = "", me, label }, why, wrong) {
  const cards = hands.map(parseCards), played = parseCards(plays).map((card, i) => ({ seat: (lead + i) % hands.length, card }));
  const best = solve({ hands: cards, att, lead, plays: played })[0].card;
  return {
    say, rows: hands.map((h, i) => (i === me ? null : { label: `${NAMES[i]}${att.includes(i) ? " (taker)" : ""}`, cards: h })).filter(Boolean),
    table: plays, hand: hands[me], handLabel: label || `You are ${NAMES[me]}`, goal: "pick", answer: tokenOf(best), why, wrong,
    puzzle: { hands, att, lead, plays, me },
  };
}

const pay = dealValue({ made: true, margin: 10, bid: 2 });
const pays = payments(4, 0, null, pay);
const slip = dealValue({ made: false, margin: 6, bid: 1 });

export const COURSE = {
  title: "Learn Tarot",
  zh: "",
  chapters: [
    {
      id: "pack", title: "The cards", lessons: [
        { id: "pack", title: "The pack", steps: [
          { say: "French tarot is played with 78 cards: four suits of 14, twenty-one numbered trumps (atouts), and one card with no number, the Excuse (l'Excuse, the fool). A suit runs ace to ten, then jack (valet), knight (cavalier), queen (dame), king (roi).", rows: [{ label: "A suit", cards: "1h 2h 3h 4h 5h 6h 7h 8h 9h 10h Jh Ch Qh Kh" }] },
          { say: "The trumps beat every suit card, the higher beating the lower. The Excuse is a card of its own, in no suit and no rank.", rows: [{ label: "Trumps, low to high", cards: "t1 t2 t3 t4 t5 t6 t7 t8 t9 t10" }, { label: "", cards: "t11 t12 t13 t14 t15 t16 t17 t18 t19 t20 t21 ex" }] },
          { say: "How many cards are in each suit?", quiz: ["10", "12", "14", "16"], answer: 2, why: "Fourteen: ten numbered cards and four court cards. 4 × 14 + 21 + 1 = 78." },
          { say: "Which card is highest in a suit?", rows: [{ label: "Court cards, in a mixed order", cards: "Qs Js Ks Cs" }], quiz: ["The king", "The queen", "The knight", "The jack"], answer: 0, why: "King, queen, knight, jack, then ten down to the ace." },
        ] },
        { id: "points", title: "Points and the three bouts", steps: [
          { say: "Cards are worth points. The king is 4½, the queen 3½, the knight 2½, the jack 1½. Every other suit card, and every trump but two, is worth ½.", rows: [{ label: "4½", cards: "Kh" }, { label: "3½", cards: "Qh" }, { label: "2½", cards: "Ch" }, { label: "1½", cards: "Jh" }, { label: "½", cards: "5h t9" }] },
          { say: "Three cards are bouts (oudlers), worth 4½ each: the 1 of trumps (the petit), the 21 and the Excuse. They matter twice: for their points, and because the number of bouts a side holds sets the points it needs.", rows: [{ label: "The three bouts", cards: "t1 t21 ex" }] },
          { say: "The whole pack is worth 91 points. How many points does the king of a suit and its queen make together?", quiz: ["7", "8", "8½", "9"], answer: 1, why: "4½ + 3½ = 8." },
          { say: "Points are counted in pairs: a card worth more than half a point is paired with a ½-point card, and the two count one point more than the big card alone. In practice you count the big cards and the pairs, then halves.", rows: [{ label: "King and a low card: 5 points", cards: "Kh 4s" }, { label: "Queen and a low card: 4 points", cards: "Qd t8" }] },
          { say: "A side needs 56 points with no bout, 51 with one, 41 with two, 36 with three. With the 21 and the Excuse and 43 points, does a side make its contract?", quiz: ["Yes, by 2", "Yes, by 7", "No, short by 2", "No, short by 8"], answer: 0, why: "Two bouts need 41, and 43 − 41 = 2 over. The fewer bouts, the more points a side needs." },
        ] },
      ],
    },
    {
      id: "deal", title: "The deal and the bids", lessons: [
        { id: "deal", title: "The deal and the dog", steps: [
          { say: "Everyone is dealt the same number of cards, three at a time; the rest, the dog (chien), is set face down. With four players: 18 cards each and a dog of 6. With three: 24 each and 6. With five: 15 each and 3.", rows: [{ label: "The dog", backs: 6 }] },
          { say: "Each player bids once, each bid above the last. A player who bids is saying 'I will take the dog and play alone against the rest': the highest bid is the taker (preneur). Nobody bids: the hands are thrown in and dealt again." },
          { say: "With four players, how many cards does each one hold?", quiz: ["15", "18", "21", "24"], answer: 1, why: "78 − 6 = 72 cards, shared by four: 18 each." },
        ] },
        { id: "bids", title: "The four bids", steps: [
          { say: `A bid is a contract with a price, the multiplier of the deal's score: Petite ×${BIDS[1].mult}, Garde ×${BIDS[2].mult}, Garde sans le chien ×${BIDS[3].mult}, Garde contre le chien ×${BIDS[4].mult}.` },
          { say: "With Petite or Garde the taker turns the dog up, takes it into the hand, and puts the same number of cards aside (the écart, the discard). With Garde sans le chien the dog is not looked at, and its points go to the taker. With Garde contre le chien they go to the defence." },
          { say: "Which bid pays most, and runs the most risk?", quiz: ["Petite", "Garde", "Garde sans le chien", "Garde contre le chien"], answer: 3, why: `Garde contre le chien: ×${BIDS[4].mult}, and the taker plays without the dog's help against a dog that scores for the defence.` },
        ] },
        { id: "ecart", title: "The discard", steps: [
          { say: "After taking the dog the taker holds too many cards and puts the same number aside, face down. Their points count for the taker at the end. Never a king, never a bout; and trumps only when there is nothing else to put aside (any trumps put aside are shown to the others).", hand: "t21 t15 t9 Kh Qh 4h 3h Ks 7s 5s 2s Qd 8d 3d Jc 6c 2c 1d", handLabel: "The 18 cards, with the dog taken in" },
          { say: "Tap every card of this hand the dog refuses. There are cards you may not discard even though you want to keep them anyway.", hand: "t21 t15 t9 Kh Qh 4h 3h Ks 7s 5s 2s Qd 8d 3d Jc 6c 2c 1d", goal: "barred", why: "Right: the three trumps (the 21 is a bout) and the two kings." },
        ] },
      ],
    },
    {
      id: "play", title: "Playing the cards", lessons: [
        { id: "follow", title: "Following suit", steps: [
          { say: "The player to the dealer's right leads, and the winner of each trick leads the next. Others must follow suit if they can. A trump led must be followed by a trump. Tap every card you may play.", hand: "Qh 4h 9s 2d t7 t3", table: "5h", tableLabel: "Hearts led", goal: "legal", why: "You hold hearts, so a heart it must be. Any heart will do, high or low." },
          { say: "You have no heart: you must play a trump, the lowest or any, if you hold one. Which cards may you play?", hand: "9s 2d 7c t7 t3", table: "5h", tableLabel: "Hearts led", goal: "legal", why: "No heart, so you must cut: either trump. A suit card would be illegal while you hold a trump." },
          { say: "Someone has already cut with the 12. If you can beat it you must (over-trump); if you cannot, you still must play a trump.", hand: "9s 2d 7c t15 t3", table: "5h t12", tableLabel: "Hearts led, cut with the 12", goal: "legal", why: "The 15 must go on top of the 12: the 3 would not beat it. If the 15 were smaller than the 12, any trump could go." },
          { say: "No heart and no trump: anything goes. And the Excuse can always be played, whatever is led.", hand: "9s 2d 7c ex", table: "5h", tableLabel: "Hearts led", goal: "legal", why: "Every card is lawful: with neither hearts nor trumps you cannot follow, so you throw what you like." },
        ] },
        { id: "wins", title: "Who takes the trick", steps: [
          { say: "The highest trump wins; with no trump, the highest card of the suit led. A card of another suit never wins.", rows: [{ label: "Led: hearts. The king wins.", cards: "7h Kh 2s" }] },
          whoWins("Who takes this trick?", "9d Kd 3h Qd", (c, w) => `The ${cardName(c[w])}: the best of the suit led. The 3 of hearts is another suit and cannot win.`),
          whoWins("And this one, with a cut?", "10s 2d t4 Ks", (c, w) => `The ${cardName(c[w])}: any trump beats every suit card, even the king.`),
          whoWins("The highest trump wins.", "Jh t9 t14 t3", (c, w) => `The ${cardName(c[w])}: of the trumps, the highest.`),
        ] },
        { id: "excuse", title: "The Excuse", steps: [
          { say: "The Excuse may be played at any time, to a suit led or to a trump, and wins nothing: whoever played it still follows the trick's winner, and the card goes back to its owner's side; a half-point card goes in exchange to the side that took the trick.", rows: [{ label: "The Excuse never wins", cards: "5h ex Kh" }] },
          { say: "Played to the very last trick of the deal the Excuse loses its protection: it goes to whoever wins that trick. Keep it for a trick you would lose, but not for the last.", quiz: ["Lead it early", "Keep it as the last card", "Play it in the last trick", "Never play it"], answer: 0, why: "Early, when it saves a card you would otherwise have to give. In the last trick it is no longer safe." },
        ] },
      ],
    },
    {
      id: "score", title: "The score", lessons: [
        { id: "make", title: "Making the contract", steps: [
          { say: "At the end, the taker's side adds its points (the tricks it won, the dog or discard) and compares them with what its bouts require: 56, 51, 41 or 36. The difference, up or down, is the margin." },
          { say: `The taker holds the 1 and the 21 and wins ${43} points. What is the margin?`, quiz: ["+2", "+7", "−3", "+43"], answer: 0, why: "Two bouts need 41. 43 − 41 = +2." },
          { say: "And with one bout, 46 points?", quiz: ["+5", "−5", "+46", "−10"], answer: 1, why: "One bout needs 51. 46 − 51 = −5: the contract is lost by five." },
        ] },
        { id: "pay", title: "What a deal pays", steps: [
          { say: "The deal's value is 25, plus the margin if it is made, or 25 plus the points short if it is lost, times the bid's multiplier. Every defender pays that, or if it is lost, receives it. With four players the taker takes it three times over, each defender once." },
          { say: `Garde (×2), made by 10 points: (25 + 10) × 2 = ${pay}. How much does the taker score in all, with three defenders?`, quiz: [`${pay}`, `${2 * pay}`, `${pays[0]}`, `${4 * pay}`], answer: 2, why: `Each of the three defenders pays ${pay}: ${pays[0]} in all for the taker, −${pay} to each of them. The four scores always add to zero.` },
          { say: `Petite (×1), lost by 6: (25 + 6) × 1 = ${-slip}. What does the taker score?`, quiz: [`−${-slip}`, `−${3 * -slip}`, `+${3 * -slip}`, `−${-slip - 25}`], answer: 1, why: `The taker pays each of the three defenders ${-slip}: −${3 * -slip}.` },
        ] },
        { id: "bonus", title: "Bonuses", steps: [
          { say: "The petit au bout: the 1 of trumps played in the last trick and winning it. 10 points, times the bid's multiplier, to the side that wins it, even if the other side makes the contract. The 1 is a bout, and the lowest of trumps: only safe to play last when the others' trumps are gone." },
          { say: "A handful (poignée): with enough trumps in hand the player shows them before the first card is played, for 20 points (a simple handful), 30 (double) or 40 (triple), paid to the side that wins the deal. With four players: 10, 13 or 15 trumps; with three: 13, 15, 18; with five: 8, 10, 13. The Excuse may stand as a trump." },
          { say: "With four players, what is the smallest number of trumps for a simple handful?", quiz: ["8", "10", "13", "15"], answer: 1, why: `${POIGNEE[4][0]}: the simple handful, ${POIGNEE[4][1]} for the double and ${POIGNEE[4][2]} for the triple.` },
          { say: "The slam (chelem): winning every trick. Announced before the first card it pays 400 if it is made and costs 200 if it fails; unannounced it pays 200. The announcer leads." },
        ] },
      ],
    },
    {
      id: "strategy", title: "Playing well", lessons: [
        { id: "bid", title: "When to bid", steps: [
          { say: "A taker plays alone against three. What wins is trumps, bouts and kings: a hand with half a dozen trumps, the 21 or the petit and a king or two is a good bid; a hand of low cards in every suit is a pass. A very short suit helps: your trumps can cut it. The bid is asked for the hand shown, and the answer is the computer players' own." },
          bidHand("Your bid, as first to speak?", "t21 t20 t17 t15 t13 t11 t9 t7 t4 t1 Kh Qh Ks 5s 3d 9d 2c 6c"),
          bidHand("And with this hand, in turn?", "t18 t14 t8 t3 Kc Qc 10c 7c Kd 4d 2d 9s 6s 3h 5h 8h 2s 1h"),
          bidHand("And with this hand?", "t16 t12 t9 t5 t2 Kh Qs Ks 7s 4s Qd 8d 3d Jc 5c 2c 9h 6h"),
          { say: "A bid must beat the last. When you cannot pass nor raise, pass: a contract lost costs three defenders' share at once." },
        ] },
        { id: "dog", title: "What goes in the dog", steps: [
          { say: "Put aside the cards that win nothing for you and keep the ones that do. The best discard makes a suit empty (a void): your trumps then cut the others' cards in it. The 'short' suits go first; the kings and the bouts stay.", hand: "t21 t15 t9 Kh Qh 4h 3h Ks 7s 5s 2s Qd 8d 3d Jc 6c 2c 1d", handLabel: "Your hand, with the dog taken in" },
          { say: "Which of these is the best card to put aside first?", hand: "Kh Qh 4h Ks 7s 5s Qd 3d Jc", quiz: ["The king of hearts", "The 3 of diamonds", "The knight of clubs", "The queen of diamonds"], answer: 2, why: "The knight of clubs is alone in its suit: put it aside and the clubs are void. A void means your trumps cut that suit. The 3 of diamonds would leave the queen alone." },
        ] },
        { id: "end", title: "The last tricks", steps: [
          { say: "These puzzles show every hand, and the card asked for is the one a search of every way the rest can be played proves best. The taker plays alone against the rest. Draw their trumps before you cash a high card they can cut." },
          puzzle("Four cards a player, and you are North, the taker, on lead. East has a trump, the 5, and no heart. Which card?", { hands: ["t20 Kh Qh", "t5 3s 4s", "6h 7s 8s", "5h 9s 5d"], att: [0], me: 0, label: "You are North, the taker" }, "The 20: East must follow with the 5, his only trump. Then the king and queen of hearts are safe. Lead the king first and East cuts it with the 5, taking 4½ points.", "Look at who can cut hearts: someone is out of them."),
          puzzle("You defend as South. North, the taker, led a spade, East played a jack, and you are out of spades. Which card?", { hands: ["9h t9", "Qh 5h", "t2 5d t16", "Qd Qs Kh"], att: [0], lead: 0, plays: "7s Js", me: 2, label: "You are South" }, "Cut with the lowest trump that wins: the 2. West must follow suit and cannot over-trump. The 16 would win too but costs a high trump.", "You have no spade, so you must trump. Which of your two trumps do you want to keep?"),
          { say: "Last, a rule of thumb for any trick: if your side is winning, give points to it; if not, give the least. Win with the cheapest winning card; lead the master of a suit before it is cut." },
        ] },
        { id: "five", title: "With five players", steps: [
          { say: "Five players: 15 cards each and a dog of 3. The taker calls a king before taking the dog; whoever holds that king is the taker's partner, but nobody knows who until it is played. The partner may be the taker, called a king in their own hand: that is playing alone, and pays double." },
          { say: "The taker's partner sits among the other four; the three others defend. The taker may not lead the called suit in the first trick, except the king itself.", quiz: ["The partner is announced", "The partner is secret until the king is played", "The partner is the dealer", "The partner is chosen by the dog"], answer: 1, why: "Until the called king falls, only its holder knows. A defender who guesses wrong can throw points to the taker." },
          { say: "Score: the taker has twice the value, the partner once, each of the three defenders pays once; alone, the taker takes four times." },
        ] },
      ],
    },
    {
      id: "game", title: "A game", lessons: [
        { id: "first", title: "A first game", steps: [
          { say: "You know enough to sit down. A game of four players against Easy computer players, eight deals. Ask for a Hint whenever you like.", play: true },
        ] },
      ],
    },
  ],
};
void TARGETS;
