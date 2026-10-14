// Big Two's course (Learn, in the header): 鋤大D taught from nothing, as Hong Kong plays it, in three chapters: the
// game (the deal, the cards' order with its suits, the small plays, passing and the lead, paying for cards), the
// five-card hands (straights, flushes, full houses, four of a kind and straight flushes) and playing well (taking a
// hand apart, following, keeping the twos, leading, a player down to one card and 頂大, counting the cards, cutting
// your losses), then a first game against Easy. The lessons are data on the card stage (course-cards.js), every card
// with its suit ("3d", "Th", "2s": suits matter here), drawn by course.js; a step is
//
//   { say }                                  words over the cards, and Next
//   { say, goal, answer, then, wrong }       pick cards from the hand and play them: goal says what's asked (below),
//                                            answer is what Hint picks, then the words for a right play, wrong words
//                                            for particular wrong ones (keyed by the cards: "Jd Js")
//   { say, quiz: [options], answer, why }    choose
//
// A goal: { any } any play; { kind } a kind of play; { beat } a play that beats the table's; { must } a play with this
// card in it (the first play's three of diamonds); { n } of so many cards; { cards } exactly these (or any of a list),
// with why for a play that's right in kind but not the one. next: 1 says the player after you has one card (頂大: a
// single you play must be your highest). Steps where the computer players' rules (bigtwo-bot.js) would choose too
// carry bot: { me, counts, by, expect }, and tests/bigtwo-course.mjs checks they choose what the lesson teaches; a
// hand counted in plays carries plays (the fewest it goes in).
import { classify, beats, value, rankOf, KIND, DEFAULTS, cardName } from "./bigtwo-rules.js";
import { cardsOf, sameCards, pickFrom } from "./course-cards.js";

const O = DEFAULTS;
const NAME = {
  single: "a single", pair: "a pair", triple: "a triple", straight: "a straight", flush: "a flush", fullhouse: "a full house",
  four: "four of a kind", straightflush: "a straight flush",
};
const SIZE = n => (n === 1 ? "a single" : n === 2 ? "a pair" : n === 3 ? "a triple" : "five cards");
const cap = s => s[0].toUpperCase() + s.slice(1);

/** Why cards that aren't a play aren't one. */
function notAPlay(ids) {
  const n = ids.length, ranks = ids.map(rankOf);
  if (n === 4) return "Four cards aren't a play: four of a kind goes with a fifth card.";
  if (n === 2) return "Two cards are a play only as a pair.";
  if (n === 3) return "Three cards are a play only as a triple.";
  if (n === 5 && new Set(ranks).size === 5 && [10, 11, 12].every(r => ranks.includes(r))) return "No straight goes round the corner from the king through the ace to the two.";
  if (n === 5) return "Five cards play only as a straight, a flush, a full house, four of a kind with one, or a straight flush.";
  return "A play is one card, a pair, a triple or five cards.";
}
/** Why a play doesn't beat the table's. */
function notHigher(k, t, ids) {
  if (k.n !== t.n) return `Play ${SIZE(t.n)}: as many cards as the play to beat.`;
  if (k.n === 1) return rankOf(ids[0]) === rankOf(t.cards[0]) ? "One rank: the suit decides, diamonds lowest, then clubs, hearts and spades." : "That doesn't beat it: it has to be higher.";
  if (k.n === 2 && k.key[0] === t.key[0]) return "A pair of one rank goes by its higher suit.";
  if (k.n < 5) return "That doesn't beat it: it has to be higher.";
  if (KIND[k.kind] < KIND[t.kind]) return `${cap(NAME[k.kind])} doesn't beat ${NAME[t.kind]}: from the lowest, a straight, a flush, a full house, four of a kind, a straight flush.`;
  if (KIND[k.kind] > KIND[t.kind]) return "That beats it.";
  return {
    straight: "A straight goes by its place (34567 lowest, then up to 10JQKA, 23456 and A2345), then its top card's suit.",
    flush: "A flush goes by its highest card, then the next, and its suit only when every rank is the same.",
    fullhouse: "A full house goes by its three.", four: "Four of a kind goes by its four.",
    straightflush: "A straight flush goes by its place, then its top card's suit.",
  }[k.kind];
}

/** A pick of cards judged against a step's goal: { ok, msg } or { ok: false, why }. */
export function judge(step, ids) {
  const g = step.goal || {}, { hand, table } = cardsOf(step);
  const wrong = Object.entries(step.wrong || {}).find(([k]) => sameCards(ids, k));
  if (wrong) return { ok: false, why: wrong[1] };
  const k = classify(ids, O);
  if (!k) return { ok: false, why: notAPlay(ids) };
  if (g.must && !pickFrom(ids, g.must)) return { ok: false, why: `The first play must have the ${cardName(pickFrom(hand, g.must)[0])} in it.` };
  if (step.next === 1 && k.n === 1 && value(ids[0], O) !== Math.max(...hand.map(c => value(c, O)))) return { ok: false, why: "頂大: the next player has one card, so a single must be your highest." };
  if (g.beat) {
    const t = { ...classify(table, O), cards: table };
    if (!beats(k, t)) return { ok: false, why: notHigher(k, t, ids) };
  }
  if (g.kind && ![].concat(g.kind).includes(k.kind)) return { ok: false, why: `That's ${NAME[k.kind]}: play ${NAME[[].concat(g.kind)[0]]}.` };
  if (g.n && k.n !== g.n) return { ok: false, why: g.why || "Not that one: try again." };
  if (g.cards && ![].concat(g.cards).some(c => sameCards(ids, c))) return { ok: false, why: g.why || "That's a play, but not the best one here: try again." };
  return { ok: true, msg: step.then || "Right." };
}
/** A hand held as the game holds it: lowest first. */
export const hold = ids => [...ids].sort((a, b) => value(a, O) - value(b, O));

// ---------- the lessons ----------
const FOUR = [{ label: "You", backs: 13 }, { label: "Each of the others", backs: 13 }];
export const COURSE = {
  title: "Learn Big Two", zh: "鋤大D",
  chapters: [
    {
      id: "game", title: "The game", zh: "玩法",
      lessons: [
        {
          id: "deal", title: "Thirteen cards each", zh: "鋤大D",
          steps: [
            { rows: FOUR, say: "Big Two (鋤大D, co4 daai6 di1, \"hoeing the big deuce\") is Hong Kong's card game: four players, each for themselves, thirteen cards each, no jokers. The first to play out every card wins the deal, and each of the others pays for the cards still in their hand." },
            { rows: [{ label: "Three players: seventeen each", backs: 17 }, { label: "And the last card", backs: 1 }], say: "Three can play too: seventeen cards each, and the fifty-second to whoever holds the three of diamonds. Menu, Players, sets it." },
            { rows: FOUR, quiz: ["Thirteen", "Seventeen", "Twelve"], answer: 0, say: "How many cards does each of four players get?", why: "Thirteen: the whole pack of fifty-two, four ways." },
          ],
        },
        {
          id: "order", title: "The cards in order", zh: "大細",
          steps: [
            { rows: [{ label: "Lowest to highest", cards: "3s 4s 5s 6s 7s 8s 9s Ts Js Qs Ks As 2s" }], say: "Threes are the lowest cards and twos the highest: 3, 4, 5 … K, A, 2. The two is the big deuce of the name (大D, daai6 di1)." },
            { rows: [{ label: "One rank, lowest to highest", cards: "3d 3c 3h 3s" }], say: "Between cards of one rank the suit decides: diamonds (階磚, gaai1 zyun1, \"floor tiles\") lowest, then clubs (梅花, mui4 faa1, \"plum blossom\"), hearts (紅心, hung4 sam1) and spades (葵扇, kwai4 sin3, \"palm-leaf fan\") highest. So the three of diamonds is the lowest card in the pack, the two of spades the highest. (Some tables put clubs lowest: Menu, Suits.)" },
            { table: "Ah", hand: "Kd Ad As 2c", goal: { beat: true, cards: "As", why: "That beats it, but a cheaper card does too." }, answer: "As", say: "Someone led the ace of hearts. Beat it as cheaply as you can.", wrong: { "2c": "That beats it, but so does the ace of spades, and a two is worth keeping.", Ad: "Diamonds are the lowest suit: the ace of diamonds is below the ace of hearts." }, then: "The ace of spades: the same rank, a higher suit." },
            { rows: [{ label: "The two of diamonds", cards: "2d" }, { label: "The ace of spades", cards: "As" }], quiz: ["The two of diamonds", "The ace of spades"], answer: 0, say: "Which is higher?", why: "The two. Rank comes first, and the suit decides only between cards of one rank: the lowest two is above every ace." },
          ],
        },
        {
          id: "basic", title: "The small plays", zh: "單張 · 一對 · 三條",
          steps: [
            { rows: [{ label: "A single", zh: "單張", cards: "9h" }, { label: "A pair", zh: "一對", cards: "9d 9s" }, { label: "A triple", zh: "三條", cards: "9c 9h 9s" }], say: "One card (單張, daan1 zoeng1), two of a rank (一對, jat1 deoi3), three of a rank (三條, saam1 tiu4). Whoever leads may play any play; each player after must play as many cards, higher, or pass." },
            { table: "9d 9h", hand: "5d 5h 9c 9s Jd Js", goal: { beat: true, cards: "9c 9s", why: "That beats it, but a cheaper pair does too." }, answer: "9c 9s", say: "A pair goes by its rank, then by its higher suit. Beat the nines as cheaply as you can.", wrong: { "Jd Js": "That beats it, but so do your nines, the spade above the heart: keep the jacks." }, then: "The other two nines: your spade beats their heart." },
            { table: "6d 6c 6h", hand: "4c 7d 7c 7s Ks", goal: { beat: true }, answer: "7d 7c 7s", say: "A triple goes by its rank. Beat the sixes.", then: "Three sevens." },
            { rows: [{ label: "Four of a rank", cards: "Qd Qc Qh Qs" }], quiz: ["Yes, on anything", "No: four cards aren't a play", "Only to lead"], answer: 1, say: "Can you play four of a kind on their own?", why: "No: a play is one card, two, three or five. Four of a kind goes with a fifth card, as a five-card hand. There are no bombs." },
          ],
        },
        {
          id: "trick", title: "Passing and the lead", zh: "過",
          steps: [
            { rows: [{ label: "You lead", cards: "5d 5c" }, { label: "The next player", cards: "8h 8s" }, { label: "The one after", text: "過" }, { label: "The last", cards: "Qd Qh" }], say: "Play goes round to the right. Each player plays as many cards, higher, or passes: 過 (gwo3). A pass doesn't keep you out: when your turn comes round again you may play." },
            { rows: [{ label: "You led", cards: "4d 4h" }, { label: "The next player", text: "過" }, { label: "The one after", text: "過" }, { label: "The last", text: "過" }], quiz: ["You lead again: anything you like", "You must beat your own pair", "The next player leads"], answer: 0, say: "You led a pair of fours, and the three others passed. What now?", why: "When everyone else has passed, the last to play leads anything. Even a low pair wins the lead when nobody wants to spend cards on it." },
            { hand: "3d 4c 5h 6s 7d 9c Kd 2h", handLabel: "You hold the three of diamonds", goal: { must: "3d", n: 5, why: "That has the three in it, but you can take more cards with it." }, answer: "3d 4c 5h 6s 7d", say: "The first play of a game is made by whoever holds the three of diamonds, and must have it in it: alone, in a pair, a triple or a five-card hand. Make it, and take as many cards with it as you can.", wrong: { "2h 3d 4c 5h 6s": "A straight, but it takes your two, the card that wins a lead back: three to seven keeps it." }, then: "Five cards gone in the first play. Each deal after, the winner of the last leads, anything." },
          ],
        },
        {
          id: "score", title: "Paying for cards", zh: "計分",
          steps: [
            { rows: [{ label: "Two left: pays 2", backs: 2 }, { label: "Five left: pays 5", backs: 5 }, { label: "Ten left: pays 20", backs: 10 }], say: "When someone goes out, each other player pays a point for each card left in their hand; two for each with ten or more (雙炒, soeng1 caau2, \"double fry\"), three for each with all thirteen (三炒, saam1 caau2). The winner takes it all." },
            { rows: [{ label: "Left with", backs: 2 }, { label: "Left with", backs: 5 }, { label: "Left with", backs: 13 }], quiz: ["20", "46", "33"], answer: 1, say: "Someone goes out, and the other three are left with two, five and thirteen cards. What does the winner take?", why: "2 + 5 + 39: thirteen cards pay three each (三炒)." },
            { rows: [{ label: "Eleven cards", backs: 11 }, { label: "After a straight: six", backs: 6 }], quiz: ["5", "16", "11"], answer: 1, say: "You hold eleven cards and play a straight just before someone goes out. What did the straight save you?", why: "Eleven cards pay 22 (雙炒), six pay 6. Getting under ten matters nearly as much as going out." },
          ],
        },
      ],
    },
    {
      id: "fives", title: "Five-card hands", zh: "五張牌",
      lessons: [
        {
          id: "straights", title: "Straights", zh: "蛇",
          steps: [
            { rows: [{ label: "A straight, the lowest", zh: "蛇", cards: "3d 4c 5h 6s 7d" }, { label: "The highest", cards: "Ad 2c 3h 4s 5d" }], say: "Five cards in rank order, of any suits, are a straight (蛇, se4, \"snake\"). Straights go by their place: 34567 lowest, up to 10JQKA, then 23456, then A2345, the highest. None goes round the corner from the king through the ace to the two." },
            { table: "4c 5d 6h 7s 8d", hand: "3h 5c 6d 7h 8c 9s Qd", goal: { beat: true }, answer: "5c 6d 7h 8c 9s", say: "Five cards are beaten only by five cards. Beat four to eight.", then: "Five to nine: a straight one place higher." },
            { table: "6d 7c 8h 9d Tc", hand: "6c 7d 8s 9h Ts Kd", goal: { beat: true }, answer: "6c 7d 8s 9h Ts", say: "Two straights of one place go by their top card's suit. Beat six to ten.", then: "Your ten of spades tops their ten of clubs." },
            { rows: [{ label: "Is this a straight?", cards: "Jd Qc Kh As 2d" }], quiz: ["Yes", "No: it goes round the corner", "Only to lead"], answer: 1, say: "Jack, queen, king, ace, two: a straight?", why: "No: no straight goes from the king through the ace to the two. The two belongs to 23456 and A2345, the two highest." },
          ],
        },
        {
          id: "flushes", title: "Flushes", zh: "花",
          steps: [
            { rows: [{ label: "A flush", zh: "花", cards: "3h 7h 9h Jh Kh" }], say: "Five cards of one suit, any ranks, are a flush (花, faa1, \"flower\"). Five-card hands go by their kind first: a straight, then a flush, a full house, four of a kind and a straight flush, each beating all those before it." },
            { table: "Tc Jh Qh Ks Ad", hand: "3c 4d 7d 8s 9d Jd Qd", goal: { beat: true }, answer: "4d 7d 9d Jd Qd", say: "Beat the straight: any flush will do.", then: "A queen-high flush beats any straight." },
            { rows: [{ label: "King high, hearts", cards: "3h 7h 9h Jh Kh" }, { label: "Queen high, spades", cards: "6s 8s 9s Ts Qs" }], quiz: ["The king-high hearts", "The queen-high spades: spades are higher"], answer: 0, say: "Which flush is higher?", why: "Flushes go by their highest card, then the next, and so on; the suit counts only when every rank is the same." },
          ],
        },
        {
          id: "fullhouse", title: "Full houses", zh: "俘虜",
          steps: [
            { rows: [{ label: "A full house", zh: "俘虜", cards: "8d 8c 8s 4h 4s" }], say: "Three of a rank and a pair of another are a full house (俘虜, fu1 lou5, \"prisoner\"). It beats any straight or flush, and goes by its three alone." },
            { table: "6c 6h 6s Kd Ks", hand: "3c 3d 5h 9d 9h 9s", goal: { beat: true }, answer: "9d 9h 9s 3c 3d", say: "Beat the full house of sixes.", then: "Three nines beat three sixes; the pairs don't count." },
          ],
        },
        {
          id: "top", title: "The top hands", zh: "四條 · 同花順",
          steps: [
            { rows: [{ label: "Four of a kind", zh: "四條", cards: "Jd Jc Jh Js 4c" }, { label: "A straight flush", zh: "同花順", cards: "5s 6s 7s 8s 9s" }], say: "Four of a rank with any fifth card (四條, sei3 tiu4) beats every straight, flush and full house, and goes by its four. A straight flush (同花順, tung4 faa1 seon6) beats everything, by its place and then its suit." },
            { table: "Ac Ah As 9c 9d", hand: "5d 5c 5h 5s 8h Qs", goal: { beat: true }, answer: "5d 5c 5h 5s 8h", say: "Beat the full house of aces.", then: "Four fives and a card: any four beats any full house." },
            { rows: [{ label: "Four kings", cards: "Kd Kc Kh Ks" }], quiz: ["Alone, on anything", "As four of a kind, with a fifth card", "Alone, to lead"], answer: 1, say: "How do you play four kings?", why: "With a fifth card, as four of a kind: four cards alone aren't a play. Or as two pairs, in two plays." },
          ],
        },
      ],
    },
    {
      id: "well", title: "Playing well", zh: "打法",
      lessons: [
        {
          id: "apart", title: "Take your hand apart", zh: "拆牌",
          steps: [
            { hand: "3d 3c 3h 5s 5d 8c 9h Th Jd Qs Kc 2d As", handLabel: "A hand", say: "Before you play a card, take your hand apart (拆牌, \"breaking up the cards\") into the plays it will go in. Five-card hands first: they carry awkward cards with them. The fewer plays a hand needs, the fewer leads you have to win." },
            { hand: "3d 3c 3h 5s 5d 8c 9h Th Jd Qs Kc 2d As", handLabel: "A hand", plays: 5, quiz: ["Five", "Seven", "Ten"], answer: 0, say: "How many plays does this hand need, at fewest?", why: "Five: a full house, a straight, and the king, the two and the ace alone." },
            { oneDeck: true, rows: [{ label: "A full house", cards: "3d 3c 3h 5s 5d" }, { label: "A straight", cards: "8c 9h Th Jd Qs" }, { label: "Three singles", cards: "Kc As 2d" }], say: "Taken apart: the threes and fives as a full house, eight to queen as a straight, and three high singles that can win their own tricks. Played as a triple, a pair and eight singles, the same cards take ten plays." },
          ],
        },
        {
          id: "follow", title: "Following", zh: "跟牌",
          steps: [
            { table: "8h", tableLabel: "The player before you led", hand: "3d 4c 5h 6s 7d Td Th Kc 2s", goal: { beat: true, cards: "Kc", why: "That beats it, but another card costs your hand less." }, answer: "Kc", say: "Beat the eight of hearts without breaking up your hand (跟牌: following).", wrong: { Td: "That breaks your pair of tens: the other ten would need a lead of its own.", Th: "That breaks your pair of tens: the other ten would need a lead of its own.", "2s": "That beats it, but your two wins a lead back: keep it." }, then: "The lone king: your straight and your pair stay whole.", bot: { me: 1, counts: [9, 9, 13, 11], by: 0 } },
            { table: "9c", tableLabel: "The player before you led", hand: "4d 6c 6h 8s 2h", quiz: ["Pass, and keep the two", "Play the two"], answer: 0, say: "Only your two beats the nine of clubs, and nobody is close to out. Do you play it?", why: "Pass. A two takes the lead back whenever you need it; spent on a nine, with everyone holding plenty, it buys a lead you'll have to spend on your low cards anyway. Spend it when someone is close to out.", bot: { me: 1, counts: [10, 5, 12, 11], by: 0, expect: "pass" } },
          ],
        },
        {
          id: "lead", title: "Leading", zh: "出牌",
          steps: [
            { hand: "4c 4d 8h Ts Jc Qd Kh 2s", handLabel: "Your lead", goal: { cards: "4c 4d", why: "Lead a play that needs the lead: a low pair." }, answer: "4c 4d", say: "Use your leads for the plays that need them: a low pair or a five-card hand gets few chances on others' tricks, while singles are what most tricks are played in. Lead.", wrong: { "2s": "Your two wins a lead back: spend it later." }, then: "The low pair: a single like the eight can still go on someone else's single.", bot: { me: 0, counts: [8, 9, 11, 10] } },
            { hand: "4d 4h 2s", handLabel: "Your lead, two plays left", goal: { cards: "2s", why: "Lead the play nobody can beat first." }, answer: "2s", say: "Two plays left: the pair of fours and the two of spades. Which first?", wrong: { "4d 4h": "If the pair is beaten, the lead is gone and your two may never get it back in time: the sure play first." }, then: "Nobody beats the two of spades, so the lead comes back to you, and the fours go out last.", bot: { me: 0, counts: [3, 8, 9, 6] } },
          ],
        },
        {
          id: "one", title: "One card left", zh: "頂大",
          steps: [
            { rows: [{ label: "The next player: one card left", backs: 1 }], say: "A player down to one card says so (剩一張, zing6 jat1 zoeng1). Hong Kong's rule 頂大 (ding2 daai6, \"top it with your biggest\"): when the player after you has one card, a single you play must be your highest, so you can't let them out cheaply. Menu turns it off." },
            { rows: [{ label: "The next player", backs: 1 }], next: 1, hand: "5d 5s 9c Kh", handLabel: "Your lead", goal: { kind: "pair" }, answer: "5d 5s", say: "The next player has one card left, and you lead. Lead something they can't follow.", wrong: { "9c": "頂大: the next player has one card, so a single must be your highest.", Kh: "Your highest single, but their last card may beat it, and they're out." }, then: "A pair: one card can't follow it.", bot: { me: 0, counts: [4, 1, 8, 6] } },
            { rows: [{ label: "The next player", backs: 1 }], next: 1, table: "7c", tableLabel: "To beat", hand: "4d 9h Jc As", goal: { beat: true }, answer: "As", say: "The seven of clubs is to beat, and the player after you has one card.", then: "Your highest: 頂大 made sure of it, and now only a two gets them out.", bot: { me: 1, counts: [8, 4, 1, 6], by: 0 } },
          ],
        },
        {
          id: "memory", title: "Counting the cards", zh: "記牌",
          steps: [
            { rows: [{ label: "Watch these go", cards: "2d 2c 2h 2s Ad Ac Ah As" }], say: "Every card is played face up, so the players who win remember them (記牌: keeping count). Watch the twos first, then the aces: once the two of spades is gone, the two of hearts is the highest card left, and so on down." },
            { oneDeck: true, rows: [{ label: "Played so far", cards: "2s 2h 2c" }], hand: "7c Kd Ac 2d", handLabel: "Your lead", goal: { cards: "2d", why: "Someone may still beat that." }, answer: "2d", say: "Three twos are out. Lead the single nobody can beat.", wrong: { Ac: "The aces of hearts and spades are still out: either beats your ace of clubs." }, then: "The two of diamonds, the lowest two, is the highest card left." },
          ],
        },
        {
          id: "losses", title: "Cutting your losses", zh: "雙炒",
          steps: [
            { rows: [{ label: "Someone: two cards left", backs: 2 }], hand: "3c 5d 6h 7s 8d 9c Jd Jh Qs Kc Ah", handLabel: "Your lead, eleven cards", goal: { n: 5, why: "Shed more: a play of more cards than they hold." }, answer: "5d 6h 7s 8d 9c", say: "Someone is down to two cards and you lead, with eleven: as they stand, they'd cost you 22. Lead what sheds most, and what they can't follow.", wrong: { "Jd Jh": "A pair: a player with two cards may follow it, and you're still on nine." }, then: "Five cards gone, and a player with two can't follow five: if they go out next, you pay 6.", bot: { me: 0, counts: [11, 2, 8, 9] } },
          ],
        },
        {
          id: "game", title: "A first game", zh: "第一鋪",
          steps: [
            { rows: FOUR, play: true, say: "That's the game. Play a first one against the computer players at Easy, who play as beginners do; Menu, Computer players sets them stronger when you're ready. Hint picks what the strongest of them would play, and shows how it would take the rest of your hand apart." },
          ],
        },
      ],
    },
  ],
};
