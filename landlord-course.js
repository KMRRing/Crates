// Landlord's course (Learn, in the header): 斗地主 taught from nothing, for a newcomer who means to sit down at a real
// table in China, in three chapters: the game (the sides, the deal, the cards' order, the simplest plays, the trick,
// the bidding), the plays (threes with kickers, straights, pairs in a row and airplanes, fours with two, bombs and the
// rocket) and playing well (counting a hand's plays, following without breaking it, leading, the last card, playing
// as peasants, counting the cards, when to bid), then a first game against Easy. The lessons are data on the card
// stage (course-cards.js: cards written as text, "7 7 7 4", "SJ BJ"), drawn by course.js; a step is
//
//   { say }                                  words over the cards, and Next
//   { say, goal, answer, then, wrong }       pick cards from the hand and play them: goal says what's asked (below),
//                                            answer is what Hint picks, then the words for a right play, wrong words
//                                            for particular wrong ones (keyed by the cards: "8 8 J J J J")
//   { say, quiz: [options], answer, why }    choose
//
// A goal: { any } any play; { type } a kind of play (or kinds); { beat } a play that beats the table's; { n } of so
// many cards; { cards } exactly these (or any of a list), with why for a play that's right in kind but not the one.
// Steps where the computer players' rules (landlord-bot.js) would choose too carry bot: { me, landlord, counts, by,
// last, expect }, and tests/landlord-course.mjs checks they choose what the lesson teaches; a bidding question carries
// bid (the computer's bid for the hand) and a hand counted in plays carries plays (the fewest it goes in).
import { readings, beats, countsOf } from "./landlord-rules.js";
import { cardsOf, sameCards } from "./course-cards.js";

const NAME = {
  single: "a single", pair: "a pair", triple: "three of a kind", trio1: "three with one", trio2: "three with a pair",
  straight: "a straight", pairs: "pairs in a row", plane: "an airplane", plane1: "an airplane with wings",
  plane2: "an airplane with pairs", four2: "four with two", four22: "four with two pairs", bomb: "a bomb", rocket: "the rocket",
};
const NUM = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
/** What beats a play, in words: "a higher pair", "a higher straight of five". */
function higher(p) {
  switch (p.type) {
    case "straight": return `a higher straight of ${NUM[p.n]}`;
    case "pairs": return `${NUM[p.len]} higher pairs in a row`;
    case "plane": case "plane1": case "plane2": return `a higher airplane of ${NUM[p.len]} threes${p.type === "plane1" ? " with wings" : p.type === "plane2" ? " with pairs" : ""}`;
    default: return `a higher ${NAME[p.type].replace(/^an? /, "")}`;
  }
}
const four = p => p.type === "four2" || p.type === "four22";

/** Why cards that aren't a play aren't one. */
function notAPlay(ids) {
  const c = countsOf(ids), n = ids.length, kinds = c.filter(k => k), has = k => c.some(x => x === k);
  if (n >= 5 && kinds.length === n && (c[12] || c[13] || c[14])) return "Twos and jokers can't be in a straight.";
  if (n >= 5 && kinds.length === n) return "A straight's cards run in a row, with no gaps.";
  if (n === 2 && c[13] + c[14] === 1) return "A joker pairs only with the other joker, as the rocket.";
  if (n === 2) return "Two cards make a play only as a pair.";
  if (has(4)) return "A four goes alone (a bomb), with two different cards, or with two pairs.";
  if (c.filter(k => k >= 3).length >= 2) return "An airplane's threes run in a row, and take a card for each three, or a pair for each.";
  if (has(3) && kinds.length > 1) return "Three alike take one card along, or one pair.";
  if (kinds.every(k => k === 2) && kinds.length === 2) return "Two pairs aren't a play: pairs in a row need three pairs or more.";
  if (kinds.every(k => k === 2)) return "Pairs in a row run with no gaps, and stop at the ace.";
  return "Those cards aren't a play.";
}
/** Why a play doesn't beat the table's. */
function notHigher(all, t) {
  if (t.type === "rocket") return "Nothing beats the rocket.";
  if (t.type === "bomb") return all.some(p => p.type === "bomb") ? "A bomb beats a bomb only if it's higher." : "Only a higher bomb, or the rocket, beats a bomb.";
  if (all.some(four) && !four(t)) return "With cards along, four alike are four with two, not a bomb: a bomb is four alike alone.";
  if (all.some(p => p.type === t.type && p.n === t.n)) return `That doesn't beat it: ${/straight|pairs|plane/.test(t.type) ? "a chain goes by its lowest card" : /trio|plane|four/.test(t.type) ? "it goes by its own rank, the kickers never counting" : "it has to be higher"}.`;
  if (all.some(p => p.type === t.type)) return `It has to be as long: ${NUM[t.n]} cards.`;
  return `That's ${NAME[all[0].type]}. To beat ${NAME[t.type]}, play ${higher(t)}.`;
}

/** A pick of cards judged against a step's goal: { ok, msg } or { ok: false, why }. */
export function judge(step, ids) {
  const g = step.goal || {};
  const wrong = Object.entries(step.wrong || {}).find(([k]) => sameCards(ids, k));
  if (wrong) return { ok: false, why: wrong[1] };
  const all = readings(countsOf(ids));
  if (!all.length) return { ok: false, why: notAPlay(ids) };
  let fits = all;
  if (g.beat) {
    const t = readings(countsOf(cardsOf(step).table))[0];
    fits = all.filter(p => beats(p, t));
    if (!fits.length) return { ok: false, why: notHigher(all, t) };
  }
  if (g.type) {
    const types = [].concat(g.type);
    fits = fits.filter(p => types.includes(p.type));
    if (!fits.length) return { ok: false, why: `That's ${NAME[all[0].type]}: play ${NAME[types[0]]}.` };
  }
  if (g.n) {
    fits = fits.filter(p => p.n === g.n);
    if (!fits.length) return { ok: false, why: g.why || "Not that one: try again." };
  }
  if (g.cards && ![].concat(g.cards).some(k => sameCards(ids, k))) return { ok: false, why: g.why || "That's a play, but not the best one here: try again." };
  return { ok: true, msg: step.then || "Right." };
}

// ---------- the lessons ----------
const SIDES = [{ label: "The landlord", zh: "地主", backs: 20 }, { label: "A peasant", zh: "农民", backs: 17 }, { label: "A peasant", zh: "农民", backs: 17 }];
export const COURSE = {
  title: "Learn Landlord", zh: "斗地主",
  chapters: [
    {
      id: "game", title: "The game", zh: "玩法",
      lessons: [
        {
          id: "sides", title: "One against two", zh: "地主 · 农民",
          steps: [
            { rows: SIDES, say: "Landlord (斗地主, dòu dìzhǔ, \"fight the landlord\") is China's most played card game. Three play, one against two: the landlord (地主, dìzhǔ) alone against the two peasants (农民, nóngmín), who play as a side. The first to play out every card wins, and a peasant going out wins for both." },
            { rows: [{ label: "Each player", backs: 17 }, { label: "The kitty", zh: "底牌", backs: 3 }], say: "All 54 cards are dealt, both jokers in: seventeen to each player and three face down, the kitty (底牌, dǐpái). One card is turned face up as they're dealt, and whoever gets it bids first." },
            { rows: [{ label: "The kitty, shown to all", cards: "BJ 9 4" }, { label: "Into the landlord's hand", backs: 20 }], say: "Whoever bids highest is the landlord: the kitty is shown to everyone, goes into the landlord's hand, and the landlord leads. Three cards more is the landlord's edge; seeing them is everyone's, for you know three of the landlord's cards from the start." },
            { rows: [{ label: "The landlord", zh: "地主", backs: 20 }], quiz: ["Seventeen", "Twenty", "Eighteen"], answer: 1, say: "How many cards does the landlord start with?", why: "Twenty: seventeen and the kitty's three. Each peasant has seventeen, and there are two of them." },
          ],
        },
        {
          id: "order", title: "The cards in order", zh: "大小",
          steps: [
            { rows: [{ label: "Highest to lowest", cards: "BJ SJ 2 A K Q J T 9 8 7 6 5 4 3" }], say: "From the top: the big joker (大王, dàwáng), the small joker (小王, xiǎowáng), the two, the ace, then the king down to the three. The two is high: it beats an ace. Suits never matter: any seven is a seven." },
            { table: "A", hand: "5 9 Q K 2", goal: { beat: true }, answer: "2", say: "Someone led an ace. Beat it.", wrong: { K: "A king is below an ace: from the top, it's the jokers, then 2, A, K." }, then: "The two: above the ace, and only the jokers are above it." },
            { table: "2", hand: "6 J A A SJ", goal: { beat: true }, answer: "SJ", say: "Now someone led a two. Beat that.", wrong: { A: "An ace is below a two." }, then: "The small joker: only the big joker beats it now." },
            { rows: [{ label: "The seven of hearts", cards: "7h" }, { label: "The seven of spades", cards: "7s" }], quiz: ["The spade", "The heart", "Neither: suits never matter"], answer: 2, say: "Which is higher: the seven of hearts or the seven of spades?", why: "Neither. A seven doesn't beat a seven, whatever its suit: to beat one you need an eight or higher." },
          ],
        },
        {
          id: "basic", title: "The simple plays", zh: "单张 · 对子 · 三张",
          steps: [
            { rows: [{ label: "A single", zh: "单张", cards: "9" }, { label: "A pair", zh: "对子", cards: "9 9" }, { label: "Three of a kind", zh: "三张", cards: "9 9 9" }], say: "The simplest plays: one card (单张, dān zhāng), two alike (对子, duìzi) and three alike (三张, sān zhāng). Whoever leads may play any play; each player after must beat it with the same kind of play, higher, or pass." },
            { table: "9 9", hand: "4 4 8 8 J J 2", goal: { beat: true }, answer: "J J", say: "A pair is beaten only by a higher pair. Beat the nines.", then: "A pair of jacks. A two wouldn't do: alone it's a single, however high." },
            { table: "6 6 6", hand: "3 3 3 7 7 7 K", goal: { beat: true }, answer: "7 7 7", say: "Three alike beat lower three alike. Beat the sixes.", then: "Three sevens over three sixes." },
            { rows: [{ label: "The two jokers", cards: "SJ BJ" }], quiz: ["Yes: the highest pair", "No: together they're the rocket", "Only with a two"], answer: 1, say: "Are the two jokers a pair?", why: "No. Together they're the rocket (王炸, wángzhà), which beats every play, as the bombs lesson will show. A joker pairs with nothing." },
          ],
        },
        {
          id: "trick", title: "Passing and the lead", zh: "不要 · 要不起",
          steps: [
            { rows: [{ label: "The landlord leads", cards: "5 5" }, { label: "A peasant", cards: "9 9" }, { label: "The other peasant", text: "不要" }, { label: "The landlord", cards: "K K" }], say: "The landlord leads, and play goes round to the right. Each player beats the last play or passes: 不要 (bú yào, \"don't want it\"). A pass doesn't keep you out: when it comes round again you may play." },
            { rows: [{ label: "The landlord leads", cards: "Q" }, { label: "The next player", text: "要不起" }], say: "要不起 (yào bu qǐ, \"can't afford it\") is the pass of a player with nothing that beats the play. It tells the table something true: a player who couldn't beat a queen holds no king, ace, two or joker, and no bomb." },
            { rows: [{ label: "You led", cards: "3 3" }, { label: "The next player", text: "不要" }, { label: "The one after", text: "不要" }], quiz: ["You lead again: anything you like", "You must beat your own pair", "The next player leads"], answer: 0, say: "You led a pair of threes, and both the others passed. What now?", why: "Two passes in a row end the trick, and whoever played last leads anything. The lead is what wins the game: whoever has it chooses what the others must beat." },
            { hand: "4 4 8 J", handLabel: "Your lead", goal: { any: true }, answer: "4 4", say: "The lead is yours: play anything you like.", then: "Anything goes when you lead: a single, a pair, a straight, whatever your hand holds." },
          ],
        },
        {
          id: "bidding", title: "Bids and the stake", zh: "叫分",
          steps: [
            { hand: "BJ 2 2 A K K Q J T 9 7 7 6 5 5 4 3", handLabel: "Your seventeen", say: "Before play, the bidding picks the landlord. Once round, from the player with the face-up card: each bids 1, 2 or 3 points (1分, 2分, 3分: yì fēn, liǎng fēn, sān fēn), more than the last bid, or passes (不叫, bú jiào). A 3 ends it at once." },
            { rows: [{ label: "The kitty", zh: "底牌", backs: 3 }], say: "The highest bidder is the landlord, and the bid is the stake. If nobody bids, the cards are thrown in and dealt again." },
            { rows: [{ label: "The landlord wins", text: "+2 · −1 · −1" }, { label: "The peasants win", text: "−2 · +1 · +1" }], say: "The landlord wins the stake from each peasant, or pays it to each: twice the stake either way. And it grows: it doubles (翻倍, fān bèi) for each bomb and rocket played, as the next chapter shows, and for a spring (春天, chūntiān: the landlord out before either peasant has played a card) or an anti-spring (反春, fǎnchūn: the peasants out with the landlord having played only the first lead)." },
            { rows: [{ label: "The landlord bid", text: "2分" }], quiz: ["2 to each peasant: 4 in all", "1 to each peasant: 2 in all", "4 to each peasant"], answer: 0, say: "The landlord bid 2, and a peasant went out first. What does the landlord pay?", why: "The stake to each: 2 to each peasant, 4 in all. Had the landlord won, each peasant would have paid 2." },
            { rows: [{ label: "Calling and robbing", text: "叫地主 · 抢地主 · 不抢" }], say: "Many apps bid another way, calling and robbing (叫地主, jiào dìzhǔ; 抢地主, qiǎng dìzhǔ): the first to call is the landlord unless a player after them robs it, each rob doubling the stake, and the caller has the last word. Menu, Bidding has both." },
          ],
        },
      ],
    },
    {
      id: "plays", title: "The plays", zh: "牌型",
      lessons: [
        {
          id: "trios", title: "Threes with kickers", zh: "三带一 · 三带一对",
          steps: [
            { rows: [{ label: "Three with one", zh: "三带一", cards: "7 7 7 4" }, { label: "Three with a pair", zh: "三带一对", cards: "7 7 7 4 4" }], say: "Three alike may take one other card along (三带一, sān dài yī) or a pair (三带一对, sān dài yí duì; also 三带二). What's taken along is the kicker: any other card or pair, even a joker." },
            { hand: "5 5 5 9 K", goal: { type: "trio1" }, answer: "5 5 5 9", say: "Play three with one.", then: "Four cards in one play: a lone card you'd have had to lead by itself rode along for free." },
            { table: "8 8 8 A", hand: "9 9 9 3 4 4 Q", goal: { beat: true }, answer: "9 9 9 3", say: "A three goes by the three alone: the kicker never counts. Beat three eights with an ace.", then: "Three nines beat three eights, whatever rides along: the ace counted for nothing." },
            { rows: [{ label: "Three with a pair", cards: "7 7 7 4 4" }, { label: "Three with one", cards: "6 6 6 3" }], quiz: ["Yes: sevens are higher", "No: it's another kind of play", "Yes: it has more cards"], answer: 1, say: "Do three sevens with a pair beat three sixes with one?", why: "No. A play is beaten only by the same kind with as many cards: three with one by three with one, three with a pair by three with a pair." },
          ],
        },
        {
          id: "straights", title: "Straights", zh: "顺子",
          steps: [
            { rows: [{ label: "A straight", zh: "顺子", cards: "3 4 5 6 7" }, { label: "The longest", cards: "3 4 5 6 7 8 9 T J Q K A" }], say: "Five or more cards in a row are a straight (顺子, shùnzi), from the three up to the ace at most: twos and jokers never go in one." },
            { hand: "3 4 5 6 7 8 9 9 K 2", goal: { type: "straight", n: 7, why: "A straight, but a longer one is there: the more cards a play sheds, the better." }, answer: "3 4 5 6 7 8 9", say: "Play your longest straight.", then: "Seven cards in one play." },
            { table: "4 5 6 7 8", hand: "3 6 7 8 9 T J", goal: { beat: true }, answer: "6 7 8 9 T", say: "A straight is beaten only by a straight of as many cards, higher by its lowest card. Beat four to eight.", then: "Six to ten: five cards, starting higher." },
            { rows: [{ label: "Is this a straight?", cards: "J Q K A 2" }], quiz: ["Yes", "No: a two can't be in one", "Only for the landlord"], answer: 1, say: "Is jack, queen, king, ace, two a straight?", why: "No: a straight stops at the ace. Twos and jokers are for singles, pairs, threes and bombs." },
          ],
        },
        {
          id: "chains", title: "Chains and airplanes", zh: "连对 · 飞机",
          steps: [
            { rows: [{ label: "Pairs in a row", zh: "连对", cards: "3 3 4 4 5 5" }, { label: "An airplane", zh: "飞机", cards: "7 7 7 8 8 8" }], say: "Three or more pairs in a row are pairs in a row (连对, liánduì); two or more threes in a row are an airplane (飞机, fēijī). Like straights they stop at the ace, and they're beaten only by the same play, as long and higher." },
            { hand: "5 5 6 6 7 7 9 Q", goal: { type: "pairs" }, answer: "5 5 6 6 7 7", say: "Play your pairs in a row.", then: "Six cards, three pairs, in one play." },
            { rows: [{ label: "With wings", zh: "带翅膀", cards: "7 7 7 8 8 8 3 9" }, { label: "With pairs", zh: "带对", cards: "7 7 7 8 8 8 3 3 9 9" }], say: "An airplane may carry a card for each three, its wings (翅膀, chìbǎng), or a pair for each three. As with a three's kicker, the wings never count." },
            { hand: "8 8 8 9 9 9 3 K 2", goal: { type: "plane1" }, answer: "8 8 8 9 9 9 3 K", say: "Fly your airplane with wings: two threes in a row, and a card for each.", then: "Eight cards in one play, and an airplane is hard to beat: few hands hold a higher one." },
          ],
        },
        {
          id: "fours", title: "Four with two", zh: "四带二",
          steps: [
            { rows: [{ label: "Four with two", zh: "四带二", cards: "7 7 7 7 3 9" }, { label: "Four with two pairs", zh: "四带两对", cards: "7 7 7 7 3 3 9 9" }], say: "Four alike may take two other cards along (四带二, sì dài èr) or two pairs (四带两对, sì dài liǎng duì). The two cards are of different ranks, and so are the two pairs." },
            { hand: "J J J J 4 8 8", goal: { type: "four2" }, answer: "J J J J 4 8", say: "Play four with two.", wrong: { "8 8 J J J J": "Two cards alike don't go with a four: take two different cards, or two pairs." }, then: "Four jacks with two." },
            { rows: [{ label: "Four with two", cards: "7 7 7 7 3 9" }], quiz: ["Yes", "No: with cards along, it's an ordinary play", "Only if the landlord plays it"], answer: 1, say: "Are four sevens with a three and a nine a bomb?", why: "No. Four alike are a bomb only alone: with cards along they're beaten by a higher four with two, and they don't double the stake. A four is usually worth more as a bomb, kept for when it's needed." },
          ],
        },
        {
          id: "bombs", title: "Bombs and the rocket", zh: "炸弹 · 王炸",
          steps: [
            { rows: [{ label: "A bomb", zh: "炸弹", cards: "6 6 6 6" }, { label: "The rocket", zh: "王炸", cards: "SJ BJ" }], say: "Four alike alone are a bomb (炸弹, zhàdàn): it beats any play but a higher bomb. The two jokers are the rocket (王炸, wángzhà; also 火箭, huǒjiàn), which beats everything, a bomb included. Each one played doubles the stake." },
            { table: "2 2", hand: "5 6 6 6 6 9 K", goal: { beat: true }, answer: "6 6 6 6", say: "No pair is above twos, but a bomb beats anything. Bomb them.", then: "炸弹！ The stake doubles, and the lead is yours." },
            { table: "Q Q Q Q", hand: "3 3 3 3 8 K K K K", goal: { beat: true }, answer: "K K K K", say: "A bomb is beaten only by a higher bomb, or the rocket. Beat four queens.", then: "Four kings over four queens, and the stake doubles again." },
            { table: "2 2 2 2", hand: "4 9 A SJ BJ", goal: { beat: true }, answer: "SJ BJ", say: "Four twos are the highest bomb. Beat them.", then: "王炸！ The rocket beats everything, and nothing beats it." },
            { rows: [{ label: "A bomb", cards: "8 8 8 8" }, { label: "The rocket", cards: "SJ BJ" }], quiz: ["4", "8", "16"], answer: 1, say: "The bid was 2. A bomb and the rocket were played, and the landlord went out first. What does each peasant pay?", why: "2, doubled to 4 by the bomb and to 8 by the rocket: each peasant pays the landlord 8, 16 in all." },
          ],
        },
      ],
    },
    {
      id: "well", title: "Playing well", zh: "打法",
      lessons: [
        {
          id: "count", title: "Count your plays", zh: "手数",
          steps: [
            { hand: "BJ 2 2 A K K Q J T 9 8 8 8 7 6 5 4", handLabel: "A hand", say: "A hand is as good as its big cards and the number of plays it takes to shed: its 手数 (shǒushù, \"hands\"). With the same big cards, seventeen that go in six plays beat seventeen that need nine. So the first thing to do with a new hand is take it apart into plays (拆牌, chāi pái)." },
            { hand: "BJ 2 2 A K K Q J T 9 8 8 8 7 6 5 4", handLabel: "A hand", plays: 5, quiz: ["Five", "Seven", "Nine"], answer: 0, say: "How many plays does this hand need, at fewest?", why: "Five: the straight from four to ace, the pair of eights, the king, the pair of twos and the big joker." },
            { oneDeck: true, rows: [{ label: "A straight", cards: "4 5 6 7 8 9 T J Q K A" }, { label: "Two pairs", cards: "8 8 2 2" }, { label: "Two singles", cards: "K BJ" }], say: "Taken apart: a straight only a bomb can beat (four to ace is the highest straight of eleven there is), two pairs, two singles. Only the eights and the king may need a lead they won't win; the twos and the joker win the lead back." },
            { rows: [{ label: "A low card as a kicker", cards: "9 9 9 3" }, { label: "Or in a straight", cards: "3 4 5 6 7" }], say: "Low singles are what sink a hand: each needs a lead of its own, and leads are what you're short of. Hide them as kickers, on a three or an airplane, or in a straight." },
          ],
        },
        {
          id: "follow", title: "Following", zh: "跟牌",
          steps: [
            { table: "8", tableLabel: "The landlord led", hand: "3 4 5 6 7 Q Q K 2", goal: { beat: true, cards: "K", why: "That beats it, but another card costs your hand less." }, answer: "K", say: "The landlord led an eight. Beat it without breaking up your hand (跟牌, gēn pái: following).", wrong: { Q: "That breaks your pair of queens: the other queen would need a lead of its own.", 2: "That beats it, but your two is a card to win the lead back with: keep it." }, then: "The lone king: your straight and your pair stay whole.", bot: { me: 1, landlord: 0, counts: [14, 9, 17], by: 0 } },
            { table: "5 5", tableLabel: "The landlord led", hand: "6 6 6 9 9 J Q K", goal: { beat: true, cards: "9 9" }, answer: "9 9", say: "Beat the fives, again without breaking up your hand.", wrong: { "6 6": "That breaks your three sixes: three alike carry a kicker away, a pair doesn't." }, then: "The nines: your sixes can still carry a kicker.", bot: { me: 1, landlord: 0, counts: [12, 8, 15], by: 0 } },
            { table: "7", tableLabel: "The landlord led", hand: "4 4 9 J 2", say: "When all that beats a play is a card you'd rather keep, passing is a play too: a two spent on a seven is a lead you may want later. And as a peasant, never beat your partner's play once the landlord has passed on it: the trick is already your side's." },
          ],
        },
        {
          id: "lead", title: "Leading", zh: "出牌",
          steps: [
            { rows: [{ label: "Cards that win the lead back", cards: "BJ SJ 2 2" }], say: "The lead (出牌权, chū pái quán: the right to play first) is what wins, and the jokers and twos win it back. So spend your leads on what nobody would let through, the low singles and pairs, and keep the big cards to take the lead again." },
            { hand: "4 9 9 K 2 2 SJ", handLabel: "Your lead", goal: { cards: "4", why: "That can wait: lead the card that would never win a trick by itself." }, answer: "4", say: "Your lead. Get the weakest card out of the way first.", wrong: { 2: "Your twos win the lead back: spend them later.", "2 2": "Your twos win the lead back: spend them later.", SJ: "The joker wins the lead back: keep it for later." }, then: "The four: it would never win a trick by itself, so it goes while the lead is yours to give.", bot: { me: 0, landlord: 0, counts: [7, 10, 12] } },
            { hand: "3 4 5 6 7 8 J J Q", handLabel: "Your lead", goal: { cards: "3 4 5 6 7 8", why: "Lead the play that sheds the most: the long one." }, answer: "3 4 5 6 7 8", say: "Your lead again. Long plays first: the more cards a play has, the fewer hands can follow it.", wrong: { "3 4 5 6 7": "A straight, but take the eight too: alone it would need a lead of its own." }, then: "Six cards gone in one lead, and few hands hold a higher straight of six.", bot: { me: 0, landlord: 0, counts: [9, 13, 12] } },
            { oneDeck: true, rows: [{ label: "Played so far", cards: "SJ 2 2" }], hand: "5 2 2 BJ", handLabel: "Your lead", goal: { cards: ["2 2", "BJ"], why: "Lead a play nobody can beat: then the lead comes back to you." }, answer: "2 2", say: "Near the end, turn it round: when every play but one is sure to win the trick, play the sure ones first and the last one after. The small joker and two twos are out. Lead.", wrong: { 5: "The five may be beaten, and then the lead is gone: play the sure ones first." }, then: "Short of a bomb nobody beats that, so the lead comes back: then the other sure play, and the five last." },
          ],
        },
        {
          id: "one", title: "One card left", zh: "报单",
          steps: [
            { rows: [{ label: "The landlord: one card left", backs: 1 }], say: "A player down to one card says so (剩一张, shèng yì zhāng, \"one card left\"; at a table, 报单, bào dān), and the game changes: any single led now may be the one they go out on." },
            { rows: [{ label: "The landlord", backs: 1 }], hand: "4 7 7 J Q", handLabel: "Your lead", goal: { type: "pair" }, answer: "7 7", say: "The landlord has one card left, and the lead is yours. Lead something the landlord can't follow.", wrong: { 4: "A single: the landlord's last card may beat it, and they're out.", J: "A single: the landlord's last card may beat it, and they're out.", Q: "A single: the landlord's last card may beat it, and they're out." }, then: "A pair: one card can't follow it.", bot: { me: 1, landlord: 0, counts: [1, 5, 9] } },
            { rows: [{ label: "The landlord, after you", backs: 1 }], table: "5", tableLabel: "Your partner led", hand: "8 K 2", goal: { beat: true, cards: "2" }, answer: "2", say: "Your partner led a five, and the landlord, down to one card, plays after you. Top it (顶, dǐng) so high the last card can't beat it.", wrong: { 8: "The landlord's last card may beat an eight: top it with your highest.", K: "The landlord's last card may beat a king: top it with your highest." }, then: "Now only a joker gets the landlord out.", bot: { me: 1, landlord: 2, counts: [6, 3, 1], by: 0 } },
            { hand: "3 9 9 K", handLabel: "Your lead, as the landlord", rows: [{ label: "A peasant: one card left", backs: 1 }], quiz: ["The pair of nines", "The three", "The king"], answer: 0, say: "Now you're the landlord, and a peasant is down to one card. What do you lead?", why: "The pair: one card can't follow it. And when you must lead a single, lead your highest.", bot: { me: 0, landlord: 0, counts: [4, 1, 8], expect: "9 9" } },
          ],
        },
        {
          id: "team", title: "Playing as peasants", zh: "配合",
          steps: [
            { rows: [{ label: "Your partner led", cards: "K" }, { label: "The landlord", text: "不要" }], hand: "A 9 9 6 3", quiz: ["Pass: your partner's king wins the trick", "Beat it with your ace"], answer: 0, say: "Peasants play as a side (配合, pèihé: playing together). Your partner led a king, and the landlord passed. Your turn: what do you do?", why: "Pass. The trick is your side's, and your partner leads next; beating it would spend your ace to take the lead from your own side.", bot: { me: 2, landlord: 1, counts: [8, 12, 5], by: 0, last: "K", expect: "pass" } },
            { rows: [{ label: "Your partner, after you: one card left", backs: 1 }], hand: "3 9 9 K K 2", handLabel: "Your lead", goal: { cards: "3", why: "Give them your lowest single." }, answer: "3", say: "Your partner has one card left, plays right after you, and the lead is yours. Feed them (送牌, sòng pái): lead what their last card is likeliest to beat.", wrong: { "9 9": "Your partner has one card: they can't follow a pair.", "K K": "Your partner has one card: they can't follow a pair.", K: "Your partner's last card may not beat a king: give them your lowest.", 2: "Your partner's last card won't beat a two: give them your lowest." }, then: "The three: any card but a three beats it, and your partner plays next.", bot: { me: 1, landlord: 0, counts: [10, 6, 1] } },
            { rows: [{ label: "The landlord, after you", backs: 12 }], table: "4", tableLabel: "Your partner led", hand: "6 9 9 J J A", goal: { beat: true, cards: "A", why: "That lets the landlord in nearly as cheaply as the four." }, answer: "A", say: "Your partner led a four, and the landlord plays after you: a four lets the landlord in cheaply. Top it (顶, dǐng) so the landlord must spend a big card to get past.", wrong: { 9: "That breaks your pair of nines.", J: "That breaks your pair of jacks." }, then: "The ace: now the landlord needs a two or a joker, or your side keeps the lead.", bot: { me: 1, landlord: 2, counts: [9, 6, 12], by: 0 } },
            { rows: SIDES, say: "So the peasant who plays just before the landlord (the landlord's 上家, shàngjiā: the player before) is the one who presses, topping a partner's low plays so the landlord can't slip cheap cards through. The other, just after the landlord (its 下家, xiàjiā), meets the landlord's plays first." },
          ],
        },
        {
          id: "memory", title: "Counting the cards", zh: "记牌",
          steps: [
            { rows: [{ label: "Watch these go", cards: "BJ SJ 2 2 2 2 A A A A" }], say: "Every card is played face up, so the players who win remember them (记牌, jì pái). Watch the jokers first, then the twos, then the aces: once they're gone, a lower card is the highest left, and a single you'd thought weak can't be beaten." },
            { oneDeck: true, rows: [{ label: "Played so far", cards: "BJ SJ 2 2 2 2 A A" }], hand: "7 J K A", handLabel: "Your lead", goal: { cards: "A", why: "Someone may still beat that." }, answer: "A", say: "Both jokers, all four twos and two aces have been played. Lead the single nobody can beat.", wrong: { K: "One ace is still out: it beats your king." }, then: "The ace: with the jokers and twos gone, only a bomb beats it." },
            { rows: [{ label: "The counter", zh: "记牌器", text: "大王 0 · 小王 0 · 2 0 · A 1 · K 3" }], say: "The counter under the table (记牌器, jìpáiqì, as the apps call it) remembers for you: for each rank, how many you haven't seen. And remember 要不起 too: a player who couldn't beat a queen holds nothing above a queen, and no bomb." },
          ],
        },
        {
          id: "bid", title: "When to bid", zh: "牌力",
          steps: [
            { hand: "BJ SJ 2 2 A K Q Q J T 9 8 7 7 7 4 3", handLabel: "A hand", say: "Bid on a hand's strength (牌力, pái lì): what wins the lead back, and how few plays it goes in. The computer players count the big joker 2½, the small 2 (and 1 more for both), each two 1½, each ace ½ and a bomb 3, less about half a point for each play that may not win its trick. They bid 1 where, in 4,500 hands played out, the landlord won half the deals, 2 where they won 58% and 3 where they won 65%." },
            { hand: "BJ SJ 2 2 A K Q Q J T 9 8 7 7 7 4 3", handLabel: "You bid first", bid: 3, quiz: ["Bid 3", "Bid 1", "Pass"], answer: 0, say: "What do you bid?", why: "Three: the rocket, two twos and a hand that goes in six plays. A 3 ends the bidding, and as landlord this hand wins most deals." },
            { hand: "SJ 2 A K Q J T 9 8 8 6 5 5 4 3 3 7", handLabel: "You bid first", bid: 1, quiz: ["Bid 3", "Bid 1", "Pass"], answer: 1, say: "And with this?", why: "One: a joker, a two and an ace, and two straights to shed the rest. Worth a try at the lowest stake, not more." },
            { hand: "SJ 2 K Q J 9 7 6 6 5 4 4 3 J K 8 3", handLabel: "You bid first", bid: 0, quiz: ["Bid 3", "Bid 1", "Pass"], answer: 2, say: "And this one?", why: "Pass (不叫). A joker and a two, but the rest takes seven plays more, and the landlord plays them alone against two." },
          ],
        },
        {
          id: "game", title: "A first game", zh: "第一局",
          steps: [
            { rows: SIDES, play: true, say: "That's the game. Play a first one against the computer players at Easy, who play as beginners do; Menu, Computer players sets them stronger when you're ready. Hint picks what the strongest of them would play, and the counter under the table remembers the cards for you." },
          ],
        },
      ],
    },
  ],
};
