// Sic Bo's course (Learn, in the header): what a Macau sic bo table shows and says, from nothing. The three dice and the
// cup, the bets and what they pay, why each keeps the house something different (the point the roulette course makes the
// other way round), the screen, and the words. Macau's rules are the gaming regulator's (the DICJ's Despacho 57/2004);
// what's said of the Venetian and its neighbours comes from the sources README.md names. Data on the course sheet
// (course.js), drawn by sicbo-stage.js; tests/sicbo-course.mjs checks every answer against the rules.
//
// A step: { say } words; { say, quiz, answer, why } a choice; with dice ("4 4 2"), ways, edges, layout, screen or terms
// for the stage to draw. Answers that rest on the rules carry what the test needs to check them:
//   check: { pays: { key, stake, dice, net } } | { edge: { key, pct } } | { ways: { key, n } } | { ceiling: { total, pays, pct } } | { odd: 108 }.

export const COURSE = {
  title: "Learn sic bo",
  zh: "骰寶",
  chapters: [
    {
      id: "dice", title: "The dice", zh: "骰",
      lessons: [
        {
          id: "three", title: "Three dice", zh: "三粒骰",
          steps: [
            { say: "Sic bo (骰寶, sik1 bou2, 'precious dice'; on the floor 大小, daai6 siu2, 'big small') is played with three dice, shaken in a cup (骰盅, sik1 zung1): a black base under a glass dome, shaken by a lever or an electronic shaker, with a cover over it. Macau's rules for it are the gaming regulator's (the DICJ's Despacho 57/2004).", dice: "345" },
            { say: "Three dice fall 6 × 6 × 6 = 216 ways, each as likely as any other. Every bet on the layout is a count of those 216. The totals aren't equally likely: a 10 or an 11 falls 27 ways, a 4 or a 17 only 3, and a 3 or an 18 just one.", ways: true },
            { say: "How many of the 216 ways make a total of 10?", ways: { pick: 10, ask: true }, quiz: ["15", "25", "27"], answer: 2, why: "27, the most of any total: an 11 falls 27 ways too. A 9 or a 12 falls 25, an 8 or a 13 only 21.", check: { ways: { key: "n10", n: 27 } } },
            { say: "Why does no total bet cover a 3 or an 18?", ways: { pick: 3 }, quiz: ["They can't be thrown", "Only a triple makes them, and triples have their own bets", "The rules ban totals that rare"], answer: 1, why: "Only 1-1-1 makes a 3, only 6-6-6 an 18: triples. The totals run from 4 to 17." },
          ],
        },
        {
          id: "cup", title: "The cup", zh: "骰盅",
          steps: [
            { say: "A round starts when the croupier (莊荷, zong1 ho4) covers the glass dome with the cover, fastens it, and presses the lever three times or starts the shaker. Then betting opens. The croupier rings the bell (按鐘, on3 zung1) and calls to open the dice (開骰, hoi1 sik1): after that nothing is placed or moved. The cover comes off and the croupier calls what the dice show.", terms: [["按鐘", "on3 zung1", "the bell: betting closed"], ["開骰", "hoi1 sik1", "the call to open the dice"], ["莊荷", "zong1 ho4", "the croupier (the rules' word)"]] },
            { say: "One die comes to rest leaning on another. The croupier…", terms: [["無效", "mou4 haau6", "a void round"]], quiz: ["Calls the nearer face", "Declares the round void and throws again", "Throws the leaning die again by hand"], answer: 1, why: "A stacked or leaning die voids the round, and the dice are thrown again at once (Article 3)." },
          ],
        },
      ],
    },
    {
      id: "bets", title: "The bets", zh: "投注",
      lessons: [
        {
          id: "bigsmall", title: "Big and Small", zh: "大小",
          steps: [
            { say: "Small (小, siu2) wins when the three dice add up to 4 to 10, Big (大, daai6) when they add up to 11 to 17. Both pay 1 to 1: HK$100 wins HK$100. Each wins on 105 of the 216 throws.", layout: { groups: ["main"], bets: { big: 500 } } },
            { say: "The dice show 6, 4, 1. Your HK$500 is on Big. You…", dice: "641", layout: { groups: ["main"], bets: { big: 500 }, lit: ["big"] }, quiz: ["Win HK$500", "Lose HK$500", "Get it back"], answer: 0, why: "6 + 4 + 1 = 11: Big.", check: { pays: { key: "big", stake: 500, dice: "641", net: 500 } } },
            { say: "A triple takes both (通吃, tung1 hek3, 'the house takes all'). 4-4-4 adds to 12, which would be Big, but it loses for Big and for Small alike. That is the whole of the house's edge on these two bets: 6 throws in 216, one in 36, which is 2.78% of what you stake.", dice: "444" },
            { say: "The dice show 4, 4, 4. Your HK$500 is on Big. You…", dice: "444", layout: { groups: ["main"], bets: { big: 500 } }, quiz: ["Win HK$500", "Lose HK$500", "Get it back"], answer: 1, why: "A triple takes Big and Small.", check: { pays: { key: "big", stake: 500, dice: "444", net: -500 } } },
            { say: "Why not put HK$100 on Big and HK$100 on Small, so one of them always wins?", layout: { groups: ["main"], bets: { small: 100, big: 100 } }, quiz: ["A triple takes both", "The house pays double for both", "The table doesn't allow it"], answer: 0, why: "On the 6 triples both stakes go: the same 2.78% of what you put down." },
          ],
        },
        {
          id: "singles", title: "Single numbers", zh: "三軍",
          steps: [
            { say: "Chips on a number (三軍, saam1 gwan1, 'three armies') win when a die shows it, and pay by how many show it: 1 to 1 for one die, 2 to 1 for two, 3 to 1 for all three.", layout: { groups: ["singles"], bets: { s4: 100 } } },
            { say: "HK$100 on 4, and the dice show 4, 4, 2. You win…", dice: "442", layout: { groups: ["singles"], bets: { s4: 100 }, lit: ["s4"] }, quiz: ["HK$100", "HK$200", "HK$300"], answer: 1, why: "Two dice show a 4: 2 to 1.", check: { pays: { key: "s4", stake: 100, dice: "442", net: 200 } } },
            { say: "HK$100 on 4, and the dice show 4, 4, 4. You win…", dice: "444", layout: { groups: ["singles"], bets: { s4: 100 }, lit: ["s4"] }, quiz: ["HK$200", "HK$300", "HK$15,000"], answer: 1, why: "Three dice show it: 3 to 1. The HK$15,000 is a named triple's, another bet.", check: { pays: { key: "s4", stake: 100, dice: "444", net: 300 } } },
          ],
        },
        {
          id: "totals", title: "Totals", zh: "點數",
          steps: [
            { say: "A total (點數, dim2 sou3) wins when the three dice add up to the number you chose, 4 to 17. The rarer the total, the more it pays: 4 or 17, 50 to 1; 5 or 16, 18; 6 or 15, 14; 7 or 14, 12; 8 or 13, 8; 9 to 12, 6.", layout: { groups: ["totals"], bets: { n11: 100 } } },
            { say: "Which total comes up most often?", ways: { ask: true }, quiz: ["7", "10 and 11, equally", "12"], answer: 1, why: "10 and 11 each fall 27 ways in 216. The middle totals pay least, 6 to 1." },
            { say: "HK$100 on the total 12, and the dice show 4, 4, 4. You win…", dice: "444", layout: { groups: ["totals"], bets: { n12: 100 }, lit: ["n12"] }, quiz: ["Nothing: a triple takes it", "HK$600", "HK$15,000"], answer: 1, why: "A triple takes only Big and Small; a total still wins, 6 to 1.", check: { pays: { key: "n12", stake: 100, dice: "444", net: 600 } } },
          ],
        },
        {
          id: "pairs", title: "Doubles and pairs", zh: "短牌 · 長牌",
          steps: [
            { say: "A double (短牌, dyun2 paai4) wins when two or more dice show the number you chose: 8 to 1. Two numbers (長牌, coeng4 paai4) win when both numbers you chose show among the dice, whatever the third die is: 5 to 1.", layout: { groups: ["doubles", "pairs"], bets: { d4: 100, c25: 100 } } },
            { say: "HK$100 on 2 and 5, and the dice show 2, 2, 5. You win…", dice: "225", layout: { groups: ["pairs"], bets: { c25: 100 }, lit: ["c25"] }, quiz: ["Nothing: the 2 shows twice", "HK$500", "HK$800"], answer: 1, why: "Both a 2 and a 5 show among the dice: 5 to 1.", check: { pays: { key: "c25", stake: 100, dice: "225", net: 500 } } },
            { say: "HK$100 on the double 4, and the dice show 4, 4, 1. You win…", dice: "441", layout: { groups: ["doubles"], bets: { d4: 100 }, lit: ["d4"] }, quiz: ["HK$800", "HK$500", "HK$100"], answer: 0, why: "Two dice show a 4: 8 to 1.", check: { pays: { key: "d4", stake: 100, dice: "441", net: 800 } } },
          ],
        },
        {
          id: "triples", title: "Triples", zh: "圍骰 · 全骰",
          steps: [
            { say: "A named triple (圍骰, wai4 sik1, 'surrounded dice') wins when all three dice show the number you chose: 150 to 1, the most a live table in Macau may pay. Any triple (全骰, cyun4 sik1) wins on any of the six: 24 to 1.", layout: { groups: ["main", "triples"], bets: { t3: 100, any: 100 } } },
            { say: "A named triple wins on 1 throw in 216, any triple on 6. What would be a fair payout for any triple, one that leaves the house nothing?", quiz: ["35 to 1", "24 to 1", "6 to 1"], answer: 0, why: "210 throws lose and 6 win: 210 ÷ 6 = 35. At 24 to 1 the house keeps 30.56%.", check: { edge: { key: "any", pct: 30.56 } } },
            { say: "HK$100 on any triple, and the dice show 5, 5, 5. You win…", dice: "555", layout: { groups: ["main"], bets: { any: 100 }, lit: ["any"] }, quiz: ["HK$2,400", "HK$3,000", "HK$15,000"], answer: 0, why: "Any triple pays 24 to 1.", check: { pays: { key: "any", stake: 100, dice: "555", net: 2400 } } },
          ],
        },
        {
          id: "others", title: "Other bets", zh: "",
          steps: [
            { say: "The rules list three more bets that no layout seems to carry, so none is played here. A double and a different single (4-4-2, in any order) pays 50 to 1. Three different numbers you name pay 30 to 1. Any three of four numbers you name, 7 to 1. They list 單 and 雙 as well (daan1, soeng1): the total odd or even, 1 to 1.", dice: "442" },
            { say: "Half of the 216 throws have an odd total. If 單 paid 1 to 1 and a triple didn't take it, the house would keep…", quiz: ["2.78%", "Nothing: a fair coin", "7.87%"], answer: 1, why: "Article 7 takes only Big and Small on a triple, so as written 單 and 雙 would be a fair coin.", check: { odd: 108 } },
          ],
        },
      ],
    },
    {
      id: "edge", title: "What the house keeps", zh: "場方",
      lessons: [
        {
          id: "each", title: "Every bet its own", zh: "場方",
          steps: [
            { say: "Roulette keeps every bet the same 2.70%. Sic bo prices each bet on its own, so which one you pick matters. What each keeps (the house is 場方, coeng4 fong1), from least to most:", edges: [["small", "Small or Big"], ["s4", "A single number"], ["n7", "A total of 7 or 14"], ["n10", "A total of 10 or 11"], ["c25", "Two numbers"], ["n9", "A total of 9 or 12"], ["n4", "A total of 4 or 17"], ["t3", "A named triple"], ["any", "Any triple"], ["d4", "A double"], ["n5", "A total of 5 or 16"]] },
            { say: "Which bet on the layout keeps the house most?", edges: [["t3", "A named triple"], ["any", "Any triple"], ["n5", "A total of 5 or 16"]], quiz: ["A named triple, 150 to 1", "Any triple, 24 to 1", "A total of 5 or 16, 18 to 1"], answer: 2, why: "47.22%: it falls on 6 throws in 216 and pays 18 to 1, the least the rules allow. A named triple keeps 30.09%.", check: { edge: { key: "n5", pct: 47.22 } } },
            { say: "Which bet keeps the house least?", quiz: ["A single number", "Small", "A total of 7 or 14"], answer: 1, why: "Small keeps 2.78%, a single number 7.87%, a 7 or 14 9.72%. Big costs the same as Small.", check: { edge: { key: "small", pct: 2.78 } } },
            { say: "You stake HK$100 on Big for 100 rounds. About how much does the house expect to keep?", quiz: ["HK$28", "HK$278", "HK$2,780"], answer: 1, why: "HK$10,000 staked at 2.78%: HK$278. The dice can be kind for a while, but that's what the house is paid for being there." },
            { say: "The rules let a table pay a 5 or 16 anything from 18 to 30 to 1. A table pays 30. What does the house keep on it?", quiz: ["47.22%", "13.89%", "2.78%"], answer: 1, why: "13.89%, against 47.22% at 18: the same bet costs several times more at one table than another. Read the layout.", check: { ceiling: { total: 5, pays: 30, pct: 13.89 } } },
          ],
        },
        {
          id: "screen", title: "The screen", zh: "",
          steps: [
            { say: "A screen over a table lists what the dice have shown lately and counts it: Big, Small and triples, the hottest totals and the coldest. The one in this game does the same.", screen: "345 641 444 235 665 123 664 421 552 336 543 431 662 114 456 624 226 531 463 365" },
            { say: "Big has come up six times running. On the next round Big is…", screen: "665 456 645 546 655 664", quiz: ["More likely: it's hot", "Less likely: Small is due", "As likely as ever"], answer: 2, why: "The dice keep no memory: every round is 105 in 216 for Big, 105 for Small, 6 for a triple." },
          ],
        },
      ],
    },
    {
      id: "floor", title: "On the floor", zh: "賭場",
      lessons: [
        {
          id: "machines", title: "Screens and machines", zh: "",
          steps: [
            { screen: "345 641 444 235 665 123 664 421", say: "Macau's casinos also run sic bo on screens: a live croupier's cup or an automatic one, the bets placed and paid electronically. Sands China's Rapid Sic Bo at the Venetian Macao and Sands Macao started a row in 2011. Electronic sic bo had paid triples up to 190 to 1; the live tables may pay at most 150 to 1; the DICJ decided automated games must pay what live tables do (Inside Asian Gaming, May 2011)." },
            { say: "What may a live sic bo table in Macau pay a named triple, at most?", layout: { groups: ["triples"] }, quiz: ["150 to 1", "190 to 1", "1,000 to 1"], answer: 0, why: "150 to 1, as the rules say, and the cap automated games were held to.", check: { pays: { key: "t3", stake: 100, dice: "333", net: 15000 } } },
          ],
        },
        {
          id: "words", title: "The words", zh: "術語",
          steps: [
            { say: "The layout's words, as the rules print them.", terms: [["小 · 大", "siu2 · daai6", "small · big"], ["三軍", "saam1 gwan1", "a single number"], ["點數", "dim2 sou3", "a total"], ["圍骰", "wai4 sik1", "a named triple"], ["全骰", "cyun4 sik1", "any triple"], ["短牌", "dyun2 paai4", "a double"], ["長牌", "coeng4 paai4", "two numbers"]] },
            { say: "And what's said at the table.", terms: [["骰盅", "sik1 zung1", "the cup"], ["按鐘", "on3 zung1", "the bell: betting closed"], ["開骰", "hoi1 sik1", "open the dice"], ["通吃", "tung1 hek3", "the house takes all"], ["無效", "mou4 haau6", "a void round"], ["賠率", "pui4 leot6", "what a bet pays"]] },
          ],
        },
      ],
    },
  ],
};
