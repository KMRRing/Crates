// Guandan's lessons (tribute-course.js is the stage and the judges): every rule in order, then a little strategy. Facts a
// question rests on are the referee's: a question may carry check(), which tests/tribute-course.mjs compares with its
// answer, and a step whose words quote figures carries proves(), which must hold. Cards: see tribute-course.js.
import * as E from "./tribute-engine.js";
import { cardsOf, finishWith, tributeAfter } from "./tribute-course.js";

const read = (text, level = 2) => E.readingFor(cardsOf(text), level, null);
const gain = order => finishWith(order).gain;
/** The first seed on which the order's tribute comes out as `kind`. */
const seedFor = (order, kind) => { for (let s = 1; s < 5000; s++) if (tributeAfter(order, s).tribute?.kind === kind) return s; return -1; };

export const COURSE = {
  title: "Learn Guandan", zh: "掼蛋",
  chapters: [
    {
      id: "game", title: "The game", zh: "牌局",
      lessons: [
        {
          id: "game", title: "Guandan", zh: "掼蛋",
          steps: [
            { rows: [{ label: "Players", text: "four, in two partnerships" }, { label: "Cards", text: "two decks, 27 each" }, { label: "Aim", text: "your side first to play through the ace" }], say: "Guandan (掼蛋, \"throw the egg\") is a climbing game for four from Jiangsu, played by the 2022 competition rules, which are the ones this game follows. Partners sit opposite. Each hand, play your cards out in combinations, trying to be out before the other side; the side that is out first moves up a level, and the first side to pass the ace wins." },
            { rows: [{ label: "Partners sit", text: "opposite" }], quiz: ["Opposite", "On your right", "On your left"], answer: 0, say: "Where does your partner sit?", why: "Across the table: seats 0 and 2 play against seats 1 and 3.", check: () => (E.partnerOf(0) === 2 ? "Opposite" : "?") },
          ],
        },
        {
          id: "cards", title: "The cards", zh: "牌",
          steps: [
            { rows: [{ label: "Low to high", cards: "2s 3h 4c 5d 6s 7h 8c 9d 10s Jh Qc Kd As" }, { label: "Above the ace", cards: "SJ BJ" }], say: "Two decks, 108 cards: the 2 is lowest, then up to the ace, and the small and big jokers above. In every hand one rank is the level: its cards rank above the ace (and below the jokers). The first hand's level is 2." },
            { goal: "high", level: 5, hand: "9s Kh As 5c Qd 2h 10c", say: "The level this hand is 5. Tap your highest card.", then: "The 5 of clubs: the level card beats the ace. (The 5 of hearts would be wild: the next lesson.)" },
            { rows: [{ label: "Level 7", text: "the 7 beats the ace" }], quiz: ["The ace", "The 7"], answer: 1, say: "The level is 7. Which beats the other, the ace or a 7?", why: "The level rank is above the ace, whichever suit.", check: () => (E.valueOf(cardsOf("7c")[0], 7) > E.valueOf(cardsOf("As")[0], 7) ? "The 7" : "The ace") },
          ],
        },
        {
          id: "wild", title: "Wild hearts", zh: "逢人配",
          steps: [
            { goal: "tiles", pred: "wild", what: "wild", level: 7, hand: "7h 7h 7s 9d Kh 2s", say: "The two hearts of the level are wild (逢人配): each stands in for any card you need, except a joker. The level is 7. Tap the wild cards.", then: "Both 7s of hearts, one from each deck. The 7 of spades is a level card but not wild; the king of hearts is no more than a king." },
            { rows: [{ label: "Level 9", text: "which cards are wild?" }], quiz: ["2", "4", "8"], answer: 0, say: "How many wild cards are there in the two decks?", why: "Two: the hearts of the level, one in each deck.", check: () => String([...Array(108).keys()].filter(id => E.isWild(id, 9)).length) },
          ],
        },
        {
          id: "deal", title: "The deal", zh: "发牌",
          steps: [
            { rows: [{ label: "Each player", text: "27 cards" }], quiz: ["25", "27", "36"], answer: 1, say: "All 108 cards are dealt. How many does each player get?", why: "108 divided between four.", check: () => String(E.newGame({}, 1).hands[0].length) },
            { rows: [{ label: "First hand", text: "a card is turned up" }, { label: "Its holder", text: "leads" }, { label: "Play passes", text: "to the right" }], quiz: ["The dealer", "The player who holds a card turned up at random", "Your partner"], answer: 1, say: "Who leads the first hand?", why: "A card is turned up at random (never a joker or a wild one) and its holder starts. Later hands begin with the tribute, below. Play then goes to the right.", check: () => { const s = E.newGame({}, 7); return s.hands[s.lead].includes(s.shown) ? "The player who holds a card turned up at random" : "?"; } },
          ],
        },
      ],
    },
    {
      id: "plays", title: "The plays", zh: "牌型",
      lessons: [
        {
          id: "simple", title: "Pairs and triples", zh: "单对三",
          steps: [
            { goal: "play", want: "pair", level: 8, hand: "4s 4h 9c Kd 7s Jc 2d", say: "A play is a single card, a pair, three of a kind, or a full house: three of a kind and a pair. Play a pair: two cards of one rank, any suits.", then: "The two 4s." },
            { goal: "play", want: "triple", level: 8, hand: "6s 6h 6c Qd 3s", say: "Three of a kind: three cards of one rank.", then: "Three 6s." },
            { goal: "play", want: "full", level: 8, hand: "5s 5h 5c Kd Kh 9c 3d", say: "A full house is five cards: three of one rank and two of another. Play it.", then: "5s and kings. Against another full house, the three decides." },
          ],
        },
        {
          id: "runs", title: "Straights and tubes", zh: "顺子",
          steps: [
            { goal: "play", want: "straight", level: 8, hand: "9s 10h Jc Qd Ks 3d 4c", say: "A straight is five in a row, any suits. Play one.", then: "9 to king. Higher by its top card." },
            { goal: "play", want: "straight", level: 8, hand: "As 2h 3c 4d 5s 9c Kd", say: "The ace is high or low: A-2-3-4-5 is the lowest straight, 10-J-Q-K-A the highest. Nothing goes round the corner (Q-K-A-2-3 is no straight).", then: "A to 5, the lowest straight." },
            { goal: "play", want: "tube", level: 8, hand: "9s 9h 10c 10d Js Jh Kc 3d", say: "Three pairs in a row make a tube (三连对).", then: "9s, 10s and jacks." },
            { goal: "play", want: "plate", level: 8, hand: "6s 6h 6c 7d 7s 7h 2c Kd", say: "Two triples in a row make a plate (钢板).", then: "Three 6s and three 7s." },
          ],
        },
        {
          id: "bombs", title: "Bombs", zh: "炸弹",
          steps: [
            { rows: [{ label: "Four alike", cards: "9s 9h 9c 9d" }, { label: "Five alike", cards: "9s 9h 9c 9d 9s" }, { label: "Straight flush", cards: "4s 5s 6s 7s 8s" }, { label: "The four jokers", cards: "SJ SJ BJ BJ" }], say: "Four or more of a rank is a bomb (炸弹), and so is a straight flush (同花顺): five in a row in one suit. A bomb beats everything that isn't a bigger bomb. From weakest: four alike, five alike, a straight flush, six, seven and more alike, and the four jokers (天王炸) on top." },
            { goal: "play", want: "bomb", level: 8, hand: "9s 9h 9c 9d 4s Kd 2c", say: "Play a bomb.", then: "Four 9s." },
            { rows: [{ label: "Straight flush", text: "beats five alike" }, { label: "Six alike", text: "beats a straight flush" }], quiz: ["Five alike", "A straight flush", "They tie"], answer: 1, say: "Which is the stronger: a straight flush or five of a kind?", why: "A straight flush; only six or more alike beat it.", check: () => (E.beats(read("4s 5s 6s 7s 8s"), read("9s 9h 9c 9d 9s")) && E.beats(read("9s 9h 9c 9d 9s 9h"), read("4s 5s 6s 7s 8s")) ? "A straight flush" : "?") },
          ],
        },
        {
          id: "beat", title: "Beating a play", zh: "压牌",
          steps: [
            { goal: "play", want: "pair", level: 8, top: "7s 7h", topBy: "The player on your right plays", hand: "5s 5h 9c 9d Kd Kh 3c", say: "A play is answered with the same kind and the same number of cards, higher (a pair beats a lower pair; a straight beats a lower straight: its top card decides). The player on your right plays a pair of 7s. Beat it.", then: "A higher pair. The pair of 5s would not do." },
            { goal: "play", want: "bomb", level: 8, top: "As Ah", topBy: "The player on your right plays", hand: "6s 6h 6c 6d 3c 4d", say: "A pair of aces is the highest pair, but a bomb beats it, and anything that isn't a bigger bomb.", then: "Four 6s over a pair of aces." },
            { rows: [{ label: "Cannot beat it, or won't", text: "pass" }, { label: "Everyone else passes", text: "the last player leads again" }], quiz: ["The play is taken back", "The player who made it leads again", "The dealer leads"], answer: 1, say: "You pass, and so do the other two. Who leads the next play?", why: "Whoever made the last play, which no one beat, leads: the trick is theirs.", check: () => { const s = E.newGame({}, 3); s.hands = [[...cardsOf("3s 4s")], [...cardsOf("5s 6s")], [...cardsOf("7s 8s")], [...cardsOf("9s 10s")]]; s.turn = s.lead = 0; E.act(s, 0, { t: "play", cards: [cardsOf("4s")[0]] }); E.act(s, 1, { t: "pass" }); E.act(s, 2, { t: "pass" }); E.act(s, 3, { t: "pass" }); return s.lead === 0 ? "The player who made it leads again" : "?"; } },
          ],
        },
        {
          id: "wilds", title: "Wild cards in plays", zh: "配",
          steps: [
            { goal: "play", want: "bomb", level: 9, hand: "6s 6h 6c 9h 3d 4c Jd", say: "A wild heart stands in for any card but a joker, in any play. The level is 9. You hold three 6s and the 9 of hearts: play a bomb.", then: "Three 6s and a wild one for the fourth." },
            { goal: "play", want: "straight", level: 9, hand: "4s 5h 7c 8d 9h Kc", say: "The wild fills a gap: you have 4, 5, 7 and 8, and the 9 of hearts is wild. Play a straight.", then: "The wild is the 6." },
            { rows: [{ label: "A wild and a joker", text: "?" }], quiz: ["A pair of jokers", "Nothing: jokers go only with the same joker"], answer: 1, say: "Can a wild card pair with a joker?", why: "No: a joker is only ever in a pair with its twin, or the pair of a full house.", check: () => (E.classify(cardsOf("SJ 9h"), 9).length === 0 ? "Nothing: jokers go only with the same joker" : "A pair of jokers") },
          ],
        },
      ],
    },
    {
      id: "match", title: "A hand and a match", zh: "比赛",
      lessons: [
        {
          id: "out", title: "Going out", zh: "出完",
          steps: [
            { rows: [{ label: "Your partner is out", text: "your partner leads next" }, { label: "Two of a side out first and second", text: "the hand ends" }, { label: "Three are out", text: "the hand ends" }], quiz: ["Whoever played next", "Your partner leads (接风)", "The dealer"], answer: 1, say: "You play your last card and nobody beats it. Who leads next?", why: "When the player who wins a trick is out, their partner leads (接风).", check: () => { const s = E.newGame({}, 3); s.hands = [[cardsOf("As")[0]], cardsOf("3s 4s"), cardsOf("5s 6s"), cardsOf("7s 8s")]; s.turn = s.lead = 0; E.act(s, 0, { t: "play", cards: [cardsOf("As")[0]] }); for (const seat of [1, 2, 3]) E.act(s, seat, { t: "pass" }); return s.lead === 2 ? "Your partner leads (接风)" : "?"; } },
            { rows: [{ label: "First and second out", text: "the hand ends there" }], quiz: ["The hand ends at once", "The others play it out"], answer: 0, say: "You go out first and your partner second. Do the others play on?", why: "No: both losers are last, and the hand is over.", check: () => (finishWith([0, 2]) ? "The hand ends at once" : "?") },
          ],
        },
        {
          id: "levels", title: "Rising a level", zh: "升级",
          steps: [
            { rows: [{ label: "First and second out", text: "+3 levels" }, { label: "First and third", text: "+2" }, { label: "First and last", text: "+1" }], quiz: ["+3", "+2", "+1"], answer: 0, say: "You and your partner go out first and second. How many levels does your side rise?", why: "Three: a one-two. First and third is two; first and last, one.", check: () => `+${gain([0, 2])}` },
            { rows: [{ label: "First and third", text: "+2" }], quiz: ["+3", "+2", "+1"], answer: 1, say: "You go out first, an opponent second, your partner third. How many levels?", why: "Two levels.", check: () => `+${gain([0, 1, 2, 3])}` },
            { rows: [{ label: "At the ace", text: "out first, partner not last" }], quiz: ["The match is won", "Your side moves up another level", "You start again at 2"], answer: 0, say: "Your side plays at the level of the ace, and you go out first with your partner third. What happens?", why: "Passing the ace wins the match: a side at the ace must go out first with its partner not last.", check: () => (finishWith([0, 1, 2, 3], { levels: [14, 2], level: 14, declarer: 0 }).passedA ? "The match is won" : "?") },
          ],
        },
        {
          id: "tribute", title: "Tribute", zh: "进贡",
          steps: [
            { goal: "tribute", level: 8, hand: "3s 9h Kd Ac 8c 8h 2d 5s Qs 6h", handLabel: "Your cards (part of 27)", say: "From the second hand on, the side that lost pays tribute (进贡) before play: the last-out player gives the first-out player the highest card they hold (never a wild heart). The level is 8: pay your tribute.", then: "The 8 of clubs: a level card is above the ace. The 8 of hearts is wild: the one card you never pay." },
            { rows: [{ label: "One loser pays", text: "the last to the first out" }, { label: "A one-two", text: "both losers pay" }], quiz: ["The last out pays the first out", "The first out pays the last", "Nobody"], answer: 0, say: "The hand ended 1, 2, 3, 4 (you were first). Who pays tribute, and to whom?", why: "The last player gives you the highest card.", check: () => { const t = tributeAfter([0, 1, 2, 3], 1).tribute; return t.kind === "single" && t.pays[0].from === 3 && t.pays[0].to === 0 ? "The last out pays the first out" : "?"; } },
            { rows: [{ label: "A one-two", text: "both losers pay" }], quiz: ["Both opponents pay, the higher card to the first out", "Only the last pays, two cards", "Both pay you the same"], answer: 0, say: "Your side went out first and second last hand. What is paid?", why: "Each of the two pays a card: the higher goes to the first out, the lower to the second.", check: () => { const t = tributeAfter([0, 2, 1, 3], 1).tribute; const hi = t.pays.find(p => p.to === 0), lo = t.pays.find(p => p.to === 2); return t.kind === "double" && E.valueOf(hi.card, 2) >= E.valueOf(lo.card, 2) ? "Both opponents pay, the higher card to the first out" : "?"; } },
          ],
        },
        {
          id: "return", title: "Giving back", zh: "还贡",
          steps: [
            { goal: "return", level: 8, hand: "3s 5h 10d Jc Kd 8c 9s 2h 4d Qh", handLabel: "Your cards (part of 27)", say: "You received tribute and must give a card back (还贡): a 10 or lower, and not a level card. The level is 8. Tap a card to return.", then: "A low card for the high one. The jokers, the picture cards, aces and level cards stay." },
            { rows: [{ label: "Both big jokers in the payers' hands", text: "no tribute: 抗贡" }], quiz: ["The tribute is paid anyway", "The payers need not pay: resistance (抗贡)", "The jokers must be paid"], answer: 1, say: "The player who would pay tribute holds both big jokers. What happens?", why: "They resist: no tribute is paid, and the first out leads. In a double tribute it is the two payers' jokers together.", check: () => (tributeAfter([0, 1, 2, 3], seedFor([0, 1, 2, 3], "resisted")).tribute?.kind === "resisted" ? "The payers need not pay: resistance (抗贡)" : "?") },
          ],
        },
      ],
    },
    {
      id: "well", title: "A little strategy", zh: "策略",
      lessons: [
        {
          id: "partner", title: "Your partner", zh: "配合",
          steps: [
            { goal: "choose", options: ["Beat it with the ace", "Pass"], answer: "Pass", top: "Ks", topBy: "Your partner plays", level: 8, hand: "Ad 9s 4c 3h", say: "You and your partner are one: your cards are both your hands. Your partner plays a king, a high single, and the opponents have passed. You hold an ace.", then: "Pass: your partner's king is winning, and beating it spends your ace and gives them nothing. Let them lead on.", not: { "Beat it with the ace": "You can, but your partner's king is already the play to beat." }, proves: () => E.beats(read("Ad", 8), read("Ks", 8)) },
            { goal: "choose", options: ["Lead your lowest single", "Lead your ace"], answer: "Lead your lowest single", level: 8, hand: "Ad 9s 4c 3h", say: "Now it is your lead with the same cards. Lead small: it gives your partner a chance to win with a card of their own, and keeps your ace for a trick that matters.", then: "A low lead costs you least, and your partner may take it.", proves: () => E.readingFor(cardsOf("3h"), 8, null) !== null && E.readingFor(cardsOf("Ad"), 8, null) !== null },
          ],
        },
        {
          id: "bomb-when", title: "When to bomb", zh: "用炸",
          steps: [
            { goal: "choose", options: ["Bomb it", "Pass"], answer: "Bomb it", top: "Js Jh", topBy: "An opponent with four cards left plays", level: 8, hand: "6s 6h 6c 6d 3c 4d Ah", say: "A bomb is best spent to take the lead from a side that is close to going out. An opponent with few cards left leads a pair of jacks. You hold a bomb.", then: "Bomb: the lead is yours, and they are not out.", not: { Pass: "You can, but that hands them the lead, and they are close to out." }, proves: () => E.beats(read("6s 6h 6c 6d", 8), read("Js Jh", 8)) },
            { rows: [{ label: "The four jokers 天王炸", text: "beat everything" }], quiz: ["Everything", "Everything but a straight flush", "Only bombs"], answer: 0, say: "What does the bomb of all four jokers beat?", why: "Every play, any bomb included.", check: () => (E.beats(read("SJ SJ BJ BJ"), read("9s 9h 9c 9d 9s 9h 9c 9d")) ? "Everything" : "?") },
          ],
        },
        {
          id: "first", title: "A first match", zh: "开局",
          steps: [{ say: "That is the game. Play a match against the computer players; the Menu's coach will comment on your plays if you ask it to.", play: true }],
        },
      ],
    },
  ],
};
