// Boast's course (Learn, in the header): liar's dice as it's played round a table in Hong Kong and on the mainland
// (大話骰, 吹牛), taught from nothing in three chapters: the game (the cups, bidding up, ones wild, plain bids, opening,
// chopping, the house rules), playing well (what to expect under the cups, how likely a bid is, opening the bidding,
// raising or opening, reading the bids, the plain trap, chopping when sure) and a first game against Easy. The lessons
// are data on the dice stage (course-dice.js), drawn by course.js; a step is
//
//   { say }                                  words over the cups, and Next
//   { say, tap, then }                       tap every die that counts for the bid tap ("6 4": six 4s; "4 4 z" plain)
//   { say, goal, prev, answer, then, wrong } set a bid and make it: prev the last bid (none: you open the round), goal
//                                            what's asked (below), answer the bid Hint sets, wrong words for bids
//   { say, quiz: [options], answer, why }    choose
//
// A goal: { beat } any bid that may follow; { face } on this face; { plain } plain or wild; { least } as few dice as
// may follow on that face; { max } no more dice than this, with why. A table has 4 players unless seats says. The
// figures a step quotes carry what tests/boast-course.mjs checks them against: odds { bid, shown } (the chance the bid
// holds, from your cup, the step's first, and the others' dice unseen; or { k, shown }, k of the unseen dice showing a
// face or a one) and expect { face, plain, shown } (how many of a face to expect on the table, your cup's and the rest).
import { canFollow, leastAfter, plain, bidWords, opening } from "./boast-rules.js";
import { parseBid, bidText } from "./course-dice.js";

const FACES = ["", "ones", "twos", "threes", "fours", "fives", "sixes"];
export const words = b => bidWords(b).en;

/** A bid made, judged against a step's goal: { ok, msg } or { ok: false, why }. */
export function judge(step, bid) {
  const g = step.goal || {}, seats = step.seats || 4, prev = parseBid(step.prev), b = { ...bid, z: bid.f === 1 || !!bid.z };
  const wrong = Object.entries(step.wrong || {}).find(([k]) => bidText(parseBid(k)) === bidText(b));
  if (wrong) return { ok: false, why: wrong[1] };
  if (!canFollow(prev, b, seats)) {
    if (!prev) return { ok: false, why: `The first bid names at least ${opening(seats)} dice, one for each player.` };
    if (plain(prev) && !plain(b) && b.n < prev.n + 2) return { ok: false, why: `Back to wild ones (飞) after a plain bid takes two dice more: ${prev.n + 2} at least.` };
    return { ok: false, why: `That doesn't beat ${words(prev)}: more dice, or as many of a higher face.` };
  }
  if (g.face && b.f !== g.face) return { ok: false, why: g.faceWhy || `Bid on ${FACES[g.face]}.` };
  if (g.plain === true && !plain(b)) return { ok: false, why: "Make it plain (斋): no ones counted." };
  if (g.plain === false && plain(b)) return { ok: false, why: "Leave the ones wild: a plain bid counts only the face itself." };
  if (g.least && b.n !== leastAfter(prev, b.f, plain(b), seats)) return { ok: false, why: "That beats it, but fewer dice would too." };
  if (g.max && b.n > g.max) return { ok: false, why: g.why || "That's more than you can expect." };
  return { ok: true, msg: step.then || "Right." };
}

// ---------- the lessons ----------
const YOURS = "2 5 5 1 6";
export const COURSE = {
  title: "Learn Boast", zh: "大話骰",
  chapters: [
    {
      id: "game", title: "The game", zh: "玩法",
      lessons: [
        {
          id: "cups", title: "Five dice under a cup", zh: "骰盅",
          steps: [
            { rows: [{ label: "Your cup, lifted for you alone", dice: "2 3 5 5 6" }, { label: "The others' cups", cups: 3 }], say: "Boast is liar's dice as it's played round a table in Hong Kong, Macau and Guangdong (大話骰, daai6 waa6 sik1, \"big-talk dice\") and on the mainland (吹牛, chuīniú, \"to brag\"). Everyone shakes five dice under a cup (骰盅, tóuzhōng) and looks only at their own." },
            { rows: [{ label: "A bid", bid: "5 5" }], say: "In turn, each bids how many dice of one face lie under all the cups together: \"five fives\" (五个五, wǔ gè wǔ; Cantonese 五粒五, ng5 nap1 ng5) means at least five 5s on the whole table, yours included." },
            { rows: [{ label: "Your cup", dice: "2 3 5 5 6" }, { label: "The others' cups", cups: 3 }], quiz: ["Five", "Twenty", "Fifteen"], answer: 1, say: "Four players: how many dice are the bids about?", why: "Twenty: five under each of the four cups. You see five of them; the bids count all twenty." },
          ],
        },
        {
          id: "bidding", title: "Bidding up", zh: "叫",
          steps: [
            { rows: [{ label: "The last bid", bid: "4 3" }, { label: "Beats it: more dice", bid: "5 2" }, { label: "Or as many, of a higher face", bid: "4 5" }], say: "Each bid must beat the last: more dice of any face, or as many dice of a higher face (2 lowest, 6 highest). The first bid of a round (起叫, qǐ jiào) names at least as many dice as there are players: four, at a table of four." },
            { rows: [{ label: "The last bid", bid: "4 3" }], prev: "4 3", goal: { face: 5, plain: false, least: true }, answer: "4 5", say: "Bid on fives, with as few dice as will beat the last bid.", then: "Four fives: as many dice, a higher face." },
            { rows: [{ label: "The last bid", bid: "4 6" }], prev: "4 6", goal: { face: 3, plain: false, least: true }, answer: "5 3", say: "Now the last bid is four sixes. Bid on threes, as few as will do.", then: "Five threes: a lower face needs a die more." },
            { rows: [{ label: "The last bid", bid: "6 4" }], quiz: ["Six threes", "Six sixes", "Five sixes"], answer: 1, say: "Which of these beats six fours?", why: "Six sixes: as many dice, a higher face. Six threes is a lower face, five sixes fewer dice." },
          ],
        },
        {
          id: "ones", title: "Ones are wild", zh: "百搭",
          steps: [
            { rows: [{ label: "Your cup", dice: "1 4 4 2 6" }, { label: "Bid", bid: "5 4" }], say: "Ones are wild (百搭, bǎidā, \"goes with anything\"): a 1 counts as whatever face is bid. For five fours, this cup holds three: its two 4s and its one." },
            { rows: [{ label: "Your cup", dice: "1 4 4 2 6" }, { label: "A cup lifted", dice: "3 4 1 5 5" }, { label: "Another", dice: "6 6 2 4 3" }], tap: "6 4", count: 6, say: "The cups are lifted. Tap every die that counts for six fours.", then: "Six in all, the ones with the fours: six fours held." },
            { rows: [{ label: "Your cup", dice: "1 1 3 5 6" }], quiz: ["Two", "Three", "None"], answer: 1, say: "For a bid on sixes, how many does this cup count?", why: "Three: the six and both ones." },
          ],
        },
        {
          id: "plain", title: "Plain bids", zh: "斋",
          steps: [
            { rows: [{ label: "Plain: only real fours", bid: "4 4 z" }, { label: "Your cup", dice: "1 4 4 2 6" }], say: "A plain bid (斋, zhāi, \"vegetarian\": nothing added; Cantonese 齋, zaai1) counts no ones: four fours, plain (四个四斋, sì gè sì zhāi) needs four real 4s. A bid on the ones themselves is plain by nature, and among plain bids the 1 ranks above the 6." },
            { rows: [{ label: "Your cup", dice: "1 4 4 2 6" }, { label: "A cup lifted", dice: "3 4 1 5 5" }, { label: "Another", dice: "6 6 2 4 3" }], tap: "4 4 z", count: 4, say: "The same cups. Tap every die that counts for four fours, plain.", then: "Four real fours: four fours, plain, held. The ones sat it out." },
            { rows: [{ label: "Wild", bid: "5 4" }, { label: "Then plain, as many", bid: "5 4 z" }, { label: "Back to wild: two more", bid: "7 4" }], say: "A plain bid may follow a wild one with as many dice, on any face. Going back to wild ones after a plain bid (飞, fēi, \"fly\"; Cantonese 飛, fei1) takes two dice more." },
            { rows: [{ label: "The last bid", bid: "5 4 z" }], prev: "5 4 z", goal: { face: 6, plain: false, least: true }, answer: "7 6", say: "The last bid is five fours, plain. Fly: bid sixes, wild, as few as will do.", then: "Seven sixes, wild: two more than the plain five." },
            { rows: [{ label: "The last bid", bid: "5 6 z" }], quiz: ["Five ones", "Six sixes, wild", "Five twos, plain"], answer: 0, say: "After five sixes, plain, which of these may follow?", why: "Five ones: among plain bids the one ranks above the six. Six sixes, wild, would need seven; five twos, plain, is a lower face." },
          ],
        },
        {
          id: "open", title: "Open!", zh: "开",
          steps: [
            { rows: [{ label: "The last bid", bid: "7 5" }, { label: "Your turn", text: "开！" }], say: "On your turn, instead of bidding you may call the last bid a lie: 开 (kāi, \"open\"; Cantonese 開, hoi1). Every cup is lifted and the face counted, with the ones unless the bid was plain. As many as bid, or more: the bid held, and the opener drinks. Fewer: the bidder drinks. Here a cup is a point; the game ends when someone reaches the limit, and whoever drank least wins." },
            { rows: [{ label: "Your cup", dice: "5 5 2 3 6" }, { label: "Lifted", dice: "1 4 4 6 2" }, { label: "Lifted", dice: "5 3 3 2 6" }, { label: "Lifted", dice: "1 5 6 6 4" }], tap: "7 5", count: 6, say: "You opened seven fives. Tap every die that counts.", then: "Six: one short. The bidder drinks." },
            { rows: [{ label: "The bid", bid: "5 3 z" }, { label: "Lifted", dice: "3 3 1 6 2" }, { label: "Lifted", dice: "4 3 5 1 6" }, { label: "Lifted", dice: "3 2 2 5 6" }], quiz: ["The bidder", "The one who opened"], answer: 0, say: "Five threes, plain, was opened. Who drinks?", why: "The bidder: plain, only real threes count, and there are four. With the ones it would have held, at six." },
          ],
        },
        {
          id: "chop", title: "Chop", zh: "劈",
          steps: [
            { rows: [{ label: "The last bid", bid: "8 6" }, { label: "Chop", text: "劈！" }, { label: "Chop back", text: "反劈！" }], say: "劈 (pī, \"chop\"; Cantonese pek3) opens with two cups riding on it. The bidder may answer 反劈 (fǎn pī, \"chop back\"; faan2 pek3), and then four do. Menu turns them off." },
            { rows: [{ label: "You", text: "劈！" }, { label: "The bidder", text: "反劈！" }], quiz: ["One", "Two", "Four"], answer: 2, say: "You chopped, the bidder chopped back, and the bid held. How many cups do you drink?", why: "Four: the chop made it two, the chop back four." },
          ],
        },
        {
          id: "house", title: "House rules", zh: "豹子 · 散",
          steps: [
            { rows: [{ label: "A leopard", zh: "豹子", dice: "5 5 5 5 5" }, { label: "Five alike, with ones", dice: "5 5 1 5 1" }], say: "Two house rules, off unless Menu turns them on. 豹子 (bàozi, \"leopard\"): five alike under one cup count seven, and five alike with ones among them six. 散 (sǎn, \"scattered\"): a cup of five different faces is rolled again before anyone bids." },
            { rows: [{ label: "A leopard", dice: "5 5 5 5 5" }], quiz: ["Five", "Six", "Seven"], answer: 2, say: "With leopards on, how many fives does this cup count?", why: "Seven: five alike count two extra." },
          ],
        },
      ],
    },
    {
      id: "well", title: "Playing well", zh: "打法",
      lessons: [
        {
          id: "expect", title: "What to expect", zh: "算",
          steps: [
            { rows: [{ label: "Your cup", dice: YOURS }, { label: "Fifteen dice you can't see", cups: 3 }], say: "You can't see the others' dice, but you know their odds: each shows a given face or a one a third of the time, a given face alone a sixth. So for a wild bid expect a third of the dice you can't see, plus what's in your cup (算, suàn: reckon)." },
            { rows: [{ label: "Your cup", dice: YOURS }, { label: "The others", cups: 3 }], expect: { face: 5, plain: false, shown: 8 }, quiz: ["Five", "Eight", "Eleven"], answer: 1, say: "Four players, and your cup is 2 5 5 1 6. How many fives, wild, should you expect on the table?", why: "Eight: your three (two fives and the one), and a third of the fifteen you can't see." },
            { rows: [{ label: "Your cup", dice: YOURS }, { label: "The others", cups: 3 }], expect: { face: 5, plain: true, shown: 4.5 }, quiz: ["About 4½", "About 8", "About 3"], answer: 0, say: "And how many fives, plain?", why: "About 4½: your two real fives, and a sixth of fifteen." },
          ],
        },
        {
          id: "odds", title: "How likely", zh: "概率",
          steps: [
            { rows: [{ label: "Fifteen dice you can't see", cups: 3 }], odds: { k: 5, shown: 0.6 }, say: "A bid at what you'd expect holds about half the time, and each die above it makes it much less likely. With fifteen dice unseen, a wild bid needing five of them (their average) holds 6 times in 10; needing six, 4 in 10; seven, 2 in 10; nine, 1 in 30." },
            { rows: [{ label: "Your cup", dice: YOURS }, { label: "The last bid", bid: "9 5" }], odds: { bid: "9 5", shown: 0.38 }, quiz: ["About 4 in 10", "About 8 in 10", "About 1 in 10"], answer: 0, say: "Your cup is 2 5 5 1 6 at a table of four, and the last bid is nine fives. How likely is it to hold?", why: "About 4 in 10: you hold three, so it needs six of the fifteen you can't see, where you'd expect five." },
          ],
        },
        {
          id: "start", title: "Opening the bidding", zh: "起叫",
          steps: [
            { rows: [{ label: "Your cup", dice: YOURS }, { label: "The others", cups: 3 }], goal: { face: 5, plain: false, max: 8, faceWhy: "Your cup holds fives best: three, with the one.", why: "More than you can expect: nine fives needs six of the fifteen dice you can't see, 4 times in 10." }, answer: "7 5", say: "You open the round. Bid on the face your cup holds best, wild, no more than you'd expect.", wrong: { "4 1": "A bid on ones is plain: it throws away your wild one." }, then: "Your best face, at or just under what you expect (eight): the boldest bid that's still likely leaves the next player the hardest choice." },
          ],
        },
        {
          id: "raise", title: "Raise or open", zh: "叫 · 开",
          steps: [
            { rows: [{ label: "Your cup", dice: "2 3 3 6 6" }, { label: "The last bid", bid: "7 5" }], odds: { bid: "7 5", shown: 0.2 }, quiz: ["开: open it", "Raise: seven sixes"], answer: 0, say: "Your cup is 2 3 3 6 6: no fives and no ones. The last bid is seven fives. Open, or raise?", why: "Open. It needs all seven fives from fifteen dice where you'd expect five: it holds about 2 times in 10, so opening costs you a cup 2 times in 10. Seven sixes would hold 6 times in 10: raised and opened, it'd cost you 4 times in 10." },
            { rows: [{ label: "Your cup", dice: "1 5 5 5 6" }, { label: "The last bid", bid: "7 5" }], odds: { bid: "7 5", shown: 0.92 }, quiz: ["开: open it", "Raise: eight fives"], answer: 1, say: "Now your cup is 1 5 5 5 6, and the last bid is seven fives. Open, or raise?", why: "Raise. You hold four, so seven needs only three of the fifteen you can't see: it holds 9 times in 10, and opening would almost surely cost you. Eight fives needs four, and holds 8 times in 10." },
          ],
        },
        {
          id: "read", title: "Reading the bids", zh: "读心",
          steps: [
            { rows: [{ label: "Lin bid", bid: "6 4" }, { label: "Round again, Lin bid", bid: "7 4" }], quiz: ["Fours, or ones", "No fours: it's a bluff", "Nothing can be told"], answer: 0, say: "Lin bid six fours and, when it came round again, seven fours. What's likely under Lin's cup?", why: "Fours or ones: a player bids the face they hold most more often than not, and twice says it twice. Count the fours under Lin's cup as likelier than a third. The strongest computer players weigh every bid so; and so a bid on a face you lack, now and then, keeps your cup from being read." },
          ],
        },
        {
          id: "trap", title: "The plain trap", zh: "斋",
          steps: [
            { rows: [{ label: "Your cup", dice: "3 3 3 3 2" }, { label: "The last bid", bid: "6 4" }], prev: "6 4", goal: { face: 3, plain: true, least: true }, answer: "6 3 z", odds: { bid: "6 3 z", shown: 0.74 }, say: "Your cup holds four threes; the last bid is six fours. A plain bid may follow a wild one at the same count: bid threes, plain, as few as will do.", then: "Six threes, plain: it needs two real threes among fifteen dice, about 3 times in 4. To a player without threes it looks thin, and they may open it wrongly." },
          ],
        },
        {
          id: "sure", title: "Chop when sure", zh: "劈",
          steps: [
            { rows: [{ label: "Your cup", dice: "2 3 3 6 6" }, { label: "The last bid", bid: "9 5" }], odds: { bid: "9 5", shown: 0.03 }, quiz: ["劈: chop", "开: open", "Raise: nine sixes"], answer: 0, say: "Your cup is 2 3 3 6 6, and the last bid is nine fives. What now?", why: "Chop. It needs nine fives from fifteen dice where you'd expect five: about 1 time in 30. Two cups ride on it, and you'll almost surely win them. If the bidder chops back, four." },
          ],
        },
        {
          id: "game", title: "A first game", zh: "第一局",
          steps: [
            { rows: [{ label: "Your cup", dice: "1 2 4 4 6" }, { label: "The others", cups: 3 }], play: true, say: "That's the game. Play a first one against the computer players at Easy, who play as beginners do; Menu, Computer players sets them stronger when you're ready, and Menu, Show the odds tells you how likely the last bid is as you play." },
          ],
        },
      ],
    },
  ],
};
