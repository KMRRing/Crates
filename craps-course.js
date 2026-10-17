// Craps' course (Learn, in the header): what a Macau craps table shows and says, from nothing. The two dice, the come-out
// roll and the point, the pass and don't pass lines, the odds behind them (the one bet that keeps the house nothing), come
// bets, and then the traps: the one-roll bets, the field, the hard ways, and what each of them keeps. Macau's rules are the
// gaming regulator's (the DICJ's Despacho 53/2010). Data on the course sheet (course.js), drawn by craps-stage.js;
// tests/craps-course.mjs checks every answer against the rules.
//
// A step: { say } words; { say, quiz, answer, why } a choice; with dice ("3 4") and call ({ before, after }: the point
// before the throw and after), ways, odds, edges, layout, screen or terms for the stage to draw. Answers that rest on the
// rules carry what the test needs to check them:
//   check: { pays: { key | bets, stake, point, dice, net } } | { edge: { key, pct } } | { ways: { total, n } } |
//          { fair: true } | { odds: [[times, pct]] } | { moves: { key, point, dice, to } } | { stays: { key, point, dice } } |
//          { point: { before, dice, after } } | { losing: { key, n } } | { sides: [pass, dont] }.

export const COURSE = {
  title: "Learn craps",
  zh: "花旗骰",
  chapters: [
    {
      id: "dice", title: "The dice", zh: "骰",
      lessons: [
        {
          id: "two", title: "Two dice", zh: "兩粒骰",
          steps: [
            { say: "Craps (花旗骰, faa1 kei4 sik1) is played with two dice. The shooter (主客, zyu2 haak3) picks two from the four or five the stickman presents and throws both with one hand to the far wall of the table. Macau's rules for it are the gaming regulator's (the DICJ's Despacho 53/2010).", dice: "3 4" },
            { say: "Two dice fall 6 × 6 = 36 ways, each as likely as any other. Every bet on the table is a count of those 36. The totals aren't equally likely: a 7 falls 6 ways, a 6 or 8 only 5, a 2 or a 12 just once.", ways: true },
            { say: "How many of the 36 throws make a 7?", ways: { pick: 7, ask: true }, quiz: ["5", "6", "7"], answer: 1, why: "6: 1-6, 2-5, 3-4 and the same turned round. No other total has as many.", check: { ways: { total: 7, n: 6 } } },
            { say: "Which total is thrown as often as a 6?", ways: { pick: 6, ask: true }, quiz: ["7", "8", "10"], answer: 1, why: "An 8: a 6 and an 8 each fall 5 ways. A 7 falls 6, a 10 only 3.", check: { ways: { total: 8, n: 5 } } },
          ],
        },
        {
          id: "throw", title: "The throw", zh: "擲骰",
          steps: [
            { say: "The throw must carry past the middle of the table and the dice must roll. If a die leaves the table, or doesn't roll, the throw is void (無效, mou4 haau6) and thrown again (重擲, cung4 zaak6): Article 3.", terms: [["無效", "mou4 haau6", "void"], ["重擲", "cung4 zaak6", "throw again"], ["主客", "zyu2 haak3", "the shooter"], ["莊荷", "zong1 ho4", "the croupier (the stickman is one)"]] },
            { say: "A die flies off the table. The throw…", quiz: ["Counts the face it last showed", "Is void and thrown again", "Stands if the other die shows 7"], answer: 1, why: "A die off the table voids the throw (Article 3)." },
          ],
        },
      ],
    },
    {
      id: "line", title: "The line", zh: "派司拉",
      lessons: [
        {
          id: "comeout", title: "The come-out roll", zh: "出場擲骰",
          steps: [
            { say: "A round starts with the come-out roll (出場擲骰, ceot1 coeng4 zaak6 sik1). A 7 or 11, a natural, wins the pass line (派司拉, paai3 si1 laai1); a 2, 3 or 12, craps, loses it. Both pay 1 to 1.", dice: "3 4", call: { before: null, after: null }, layout: { groups: ["line"], bets: { pass: 100 }, lit: ["pass"] } },
            { say: "The come-out roll is 5, 6. Your HK$100 on the pass line…", dice: "5 6", call: { before: null, after: null }, quiz: ["Wins HK$100", "Loses HK$100", "Waits for a point"], answer: 0, why: "5 + 6 = 11: a natural.", check: { pays: { key: "pass", stake: 100, point: null, dice: "5 6", net: 100 } } },
            { say: "The come-out roll is 1, 1. Your HK$100 on the pass line…", dice: "1 1", call: { before: null, after: null }, quiz: ["Wins HK$100", "Loses HK$100", "Waits for a point"], answer: 1, why: "A 2 is craps.", check: { pays: { key: "pass", stake: 100, point: null, dice: "1 1", net: -100 } } },
            { say: "Any other total, 4, 5, 6, 8, 9 or 10, is the point, and the puck goes ON on it. The shooter throws on until the point comes again, which wins the pass line, or a 7, which loses it.", dice: "3 3", call: { before: null, after: 6 }, layout: { groups: ["numbers"], point: 6 }, check: { point: { before: null, dice: "3 3", after: 6 } } },
            { say: "The point is 6. The shooter throws 3, 4. Your pass line bet…", dice: "3 4", call: { before: 6, after: null }, layout: { groups: ["numbers"], point: 6 }, quiz: ["Wins", "Loses: a seven out", "Waits"], answer: 1, why: "A 7 before the point loses the pass line.", check: { pays: { key: "pass", stake: 100, point: 6, dice: "3 4", net: -100 } } },
            { say: "The point is 6. The shooter throws 2, 4. Your pass line bet…", dice: "2 4", call: { before: 6, after: null }, layout: { groups: ["numbers"], point: 6 }, quiz: ["Wins: the point", "Loses", "Waits"], answer: 0, why: "A 6 any way makes the point, hard or easy.", check: { pays: { key: "pass", stake: 100, point: 6, dice: "2 4", net: 100 } } },
            { say: "The point is 6. The shooter throws 4, 5. Your pass line bet…", dice: "4 5", call: { before: 6, after: 6 }, layout: { groups: ["numbers"], point: 6 }, quiz: ["Wins", "Loses", "Waits: a 9 decides nothing"], answer: 2, why: "Only the point or a 7 ends it.", check: { stays: { key: "pass", point: 6, dice: "4 5" } } },
          ],
        },
        {
          id: "dont", title: "Don't pass", zh: "東派司",
          steps: [
            { say: "Don't pass (東派司, dung1 paai3 si1) is the other side. It wins on a 2 or 3 on the come-out roll, loses on a 7 or 11, and after the point wins on a 7 and loses on the point. A 12 on the come-out is a push (和局, wo4 guk6): the bet stands, nothing is won or lost. The layout calls it bar 12.", layout: { groups: ["line"], bets: { dont: 100 } } },
            { say: "The come-out roll is 6, 6. Your HK$100 on don't pass…", dice: "6 6", call: { before: null, after: null }, quiz: ["Wins HK$100", "Loses HK$100", "Is a push: nothing won or lost"], answer: 2, why: "Bar 12: a 12 only pushes don't pass.", check: { pays: { key: "dont", stake: 100, point: null, dice: "6 6", net: 0 } } },
            { say: "The point is 8. The shooter throws 3, 4. Your HK$100 on don't pass…", dice: "3 4", call: { before: 8, after: null }, layout: { groups: ["numbers"], point: 8 }, quiz: ["Wins HK$100", "Loses HK$100", "Waits"], answer: 0, why: "A 7 before the point wins don't pass.", check: { pays: { key: "dont", stake: 100, point: 8, dice: "3 4", net: 100 } } },
            { say: "Which keeps the house more, pass or don't pass?", edges: [["pass", "Pass line"], ["dont", "Don't pass"]], quiz: ["Pass: 1.41%", "Don't pass: 1.36%", "Neither: the same"], answer: 0, why: "Pass keeps 1.41%, don't pass 1.36%: the bar 12 gives the don't side its small edge.", check: { sides: ["pass", "dont"] } },
          ],
        },
        {
          id: "odds", title: "The odds", zh: "附加投注",
          steps: [
            { say: "Once there's a point you may put a second bet behind your pass line bet: the additional bet (附加投注, fu6 gaa1 tau4 zyu3), the odds. It pays what the point is truly worth against a 7: a 4 or 10 has 3 ways to the 7's 6, so it pays 2 to 1; a 5 or 9, 4 ways, 3 to 2; a 6 or 8, 5 ways, 6 to 5.", ways: { pick: 4 }, layout: { groups: ["line"], bets: { pass: 100, passo: 200 }, point: 4 } },
            { say: "The point is 4. You have HK$100 behind your pass line bet and the 4 comes. The odds win…", dice: "2 2", call: { before: 4, after: null }, quiz: ["HK$100", "HK$200", "HK$300"], answer: 1, why: "2 to 1 on a 4 or 10, plus the line bet's own HK$100 as well.", check: { pays: { key: "passo", stake: 100, point: 4, dice: "2 2", net: 200 } } },
            { say: "The point is 5. HK$100 behind the line and the 5 comes. The odds win…", dice: "1 4", call: { before: 5, after: null }, quiz: ["HK$100", "HK$150", "HK$200"], answer: 1, why: "3 to 2 on a 5 or 9.", check: { pays: { key: "passo", stake: 100, point: 5, dice: "1 4", net: 150 } } },
            { say: "The point is 8. HK$100 behind the line and the 8 comes. The odds win…", dice: "3 5", call: { before: 8, after: null }, quiz: ["HK$100", "HK$120", "HK$200"], answer: 1, why: "6 to 5 on a 6 or 8.", check: { pays: { key: "passo", stake: 100, point: 8, dice: "3 5", net: 120 } } },
            { say: "Why does the house keep nothing of the odds?", edges: [["passo", "Odds behind pass"], ["pass", "Pass line"], ["dont", "Don't pass"]], quiz: ["They pay what the point is worth against a 7", "The line bet pays the house back", "The casino adds a bonus"], answer: 0, why: "A 4 comes 3 times to the 7's 6 and pays 2 to 1: exactly even. The one bet that keeps nothing.", check: { fair: true } },
            { say: "The odds don't lower what the line keeps, but they put more money on a bet that keeps nothing, so the house keeps less of all you stake: 1.41% with none, 0.85% with 1 times the line behind it, 0.61% with 2, 0.33% with 5, 0.18% with 10. Here the odds go up to 5 times.", odds: [0, 1, 2, 5, 10], check: { odds: [[0, 1.41], [1, 0.85], [2, 0.61], [5, 0.33], [10, 0.18]] } },
            { say: "HK$100 on the pass line with the most odds this table takes, 5 times. About how much of all the money you put down does the house keep?", odds: [0, 5], quiz: ["1.41%", "0.33%", "Nothing"], answer: 1, why: "0.33%: the line still costs the same 1.41 of every 100 it risks, but 5 times odds behind it put far more money on the table, so the same cost is a smaller share of it.", check: { odds: [[5, 0.33]] } },
            { say: "Behind don't pass the additional bet is a lay: you give odds, since the 7 is likelier than the point. On a 6 you lay HK$300 to win HK$250, on a 4 HK$200 to win HK$100.", layout: { groups: ["line"], bets: { dont: 100, donto: 300 }, point: 6 } },
            { say: "The point is 6. You lay HK$300 behind don't pass and a 7 comes. The lay wins…", dice: "3 4", call: { before: 6, after: null }, quiz: ["HK$250", "HK$300", "HK$180"], answer: 0, why: "5 to 6 on a 6 or 8: HK$300 wins HK$250.", check: { pays: { key: "donto", stake: 300, point: 6, dice: "3 4", net: 250 } } },
          ],
        },
        {
          id: "come", title: "Come bets", zh: "襟",
          steps: [
            { say: "A come bet (襟, kam1) is a pass line bet that starts with the next throw. Once there's a point, put a chip on Come: the next throw is its own come-out roll. A 7 or 11 wins, a 2, 3 or 12 loses, and any other total moves the bet to that number, where it waits for the number again (a win) or a 7 (a loss).", layout: { groups: ["come", "numbers"], bets: { come: 100 }, point: 6 } },
            { say: "The point is 6. You bet HK$100 on Come and the shooter throws 2, 2. What happens?", dice: "2 2", layout: { groups: ["numbers"], bets: { come4: 100 }, point: 6 }, quiz: ["It wins HK$100", "It loses HK$100", "It goes to the 4 and waits"], answer: 2, why: "A 4 only moves a come bet to the 4.", check: { moves: { key: "come", point: 6, dice: "2 2", to: 4 } } },
            { say: "Your come bet is on the 4 and the next throw is 3, 4. It…", dice: "3 4", call: { before: 6, after: null }, layout: { groups: ["numbers"], bets: { come4: 100 } }, quiz: ["Wins HK$100", "Loses HK$100", "Waits"], answer: 1, why: "A 7 takes every come bet on a number.", check: { pays: { key: "come4", stake: 100, point: 6, dice: "3 4", net: -100 } } },
            { say: "Don't come (東襟, dung1 kam1) is the other side: it moves to a number the same way, then wins on a 7 and loses when the number comes again.", layout: { groups: ["numbers"], bets: { dcome5: 100, dcome9: 100 } } },
            { say: "A 7 comes. You have HK$100 on don't come on the 5 and HK$100 on the 9. You win…", dice: "3 4", call: { before: 6, after: null }, layout: { groups: ["numbers"], bets: { dcome5: 100, dcome9: 100 }, point: 6 }, quiz: ["HK$200", "HK$100", "Nothing: only don't pass wins on a 7"], answer: 0, why: "A 7 pays every don't come bet on a number.", check: { pays: { bets: { dcome5: 100, dcome9: 100 }, point: 6, dice: "3 4", net: 200 } } },
            { say: "Odds go behind a come bet once it has moved. HK$100 on the come bet on the 6 with HK$100 odds behind it, and the 6 comes. Altogether you win…", dice: "3 3", layout: { groups: ["numbers"], bets: { come6: 100, come6o: 100 }, point: 8 }, quiz: ["HK$220", "HK$200", "HK$100"], answer: 0, why: "HK$100 on the come bet at 1 to 1 and HK$120 on the odds at 6 to 5.", check: { pays: { bets: { come6: 100, come6o: 100 }, point: 8, dice: "3 3", net: 220 } } },
          ],
        },
      ],
    },
    {
      id: "traps", title: "The traps", zh: "",
      lessons: [
        {
          id: "oneroll", title: "One-roll bets", zh: "",
          steps: [
            { say: "Besides the lines there are bets decided on the next throw alone: Any seven, Any craps, Eleven, Ace-deuce, Aces, Boxcars and the Horn. They pay big and they are the traps: each keeps the house 11 to 17% of what you stake.", layout: { groups: ["props"] } },
            { say: "Any seven wins on 6 throws of 36 and pays 4 to 1. What would be a fair payout?", ways: { pick: 7, ask: true }, quiz: ["4 to 1", "5 to 1", "6 to 1"], answer: 1, why: "30 throws lose and 6 win: 30 ÷ 6 = 5 to 1. At 4 to 1 the house keeps 16.67%.", check: { edge: { key: "seven", pct: 16.67 } } },
            { say: "Which of these keeps the house most?", edges: [["craps", "Any craps"], ["horn", "The Horn"], ["aces", "Aces or Boxcars"], ["seven", "Any seven"]], quiz: ["Any seven", "Aces or Boxcars", "The Horn"], answer: 0, why: "Any seven keeps 16.67%; Aces and Boxcars 13.89%, the Horn 12.5%, Any craps 11.11%.", check: { edge: { key: "seven", pct: 16.67 } } },
            { say: "The Horn is four bets in one, on 2, 3, 11 and 12: 27 to 4 on a 2 or 12 and 3 to 1 on a 3 or 11. HK$100 on the Horn and the shooter throws 1, 2 (a 3). You win…", dice: "1 2", call: { before: null, after: null }, layout: { groups: ["props"], bets: { horn: 100 }, lit: ["horn"] }, quiz: ["HK$300", "HK$675", "HK$100"], answer: 0, why: "3 to 1 on a 3: HK$300. A 2 or 12 would have won HK$675.", check: { pays: { key: "horn", stake: 100, point: null, dice: "1 2", net: 300 } } },
          ],
        },
        {
          id: "field", title: "The field", zh: "",
          steps: [
            { say: "The field wins on a 3, 4, 9, 10 or 11 at 1 to 1, and a 2 or 12 pay double (the rules let a table pay 3 to 1 on the 12; this one pays 2 to 1). It looks generous: 16 of the 36 throws win. But the 5, 6, 7 and 8 lose, and they're the commonest.", layout: { groups: ["field"], bets: { field: 100 } } },
            { say: "HK$100 on the field and the shooter throws 2, 2 (a 4). You win…", dice: "2 2", quiz: ["HK$200", "HK$100", "Nothing"], answer: 1, why: "A 4 pays 1 to 1.", check: { pays: { key: "field", stake: 100, point: null, dice: "2 2", net: 100 } } },
            { say: "HK$100 on the field and the shooter throws 6, 6. You win…", dice: "6 6", quiz: ["HK$100", "HK$200", "HK$300"], answer: 1, why: "A 12 pays 2 to 1 here, HK$300 where a table pays 3 to 1.", check: { pays: { key: "field", stake: 100, point: null, dice: "6 6", net: 200 } } },
            { say: "How many of the 36 throws lose the field?", ways: { ask: true }, quiz: ["16", "20", "12"], answer: 1, why: "20: the 5, 6, 7 and 8 fall 4 + 5 + 6 + 5 ways. The house keeps 5.56%.", check: { losing: { key: "field", n: 20 }, edge: { key: "field", pct: 5.56 } } },
          ],
        },
        {
          id: "hard", title: "Hard ways and Big bets", zh: "",
          steps: [
            { say: "A hard way bet is on a 4, 6, 8 or 10 made as a pair: 3-3 for the hard 6. It wins if the pair comes before a 7 and before the number comes any other way (2-4 or 1-5 for a 6). It pays 9 to 1 on a 6 or 8 and 7 to 1 on a 4 or 10.", dice: "3 3", layout: { groups: ["hards"], bets: { hard6: 100 }, lit: ["hard6"] } },
            { say: "HK$100 on a hard 6 and the shooter throws 2, 4. The bet…", dice: "2 4", quiz: ["Loses: a 6 the easy way", "Wins HK$900", "Waits"], answer: 0, why: "Any 6 but 3-3 loses it, as a 7 does.", check: { pays: { key: "hard6", stake: 100, point: 6, dice: "2 4", net: -100 } } },
            { say: "A hard 6 pays 9 to 1. What are the true odds?", quiz: ["9 to 1", "10 to 1", "11 to 1"], answer: 1, why: "One way wins; the 4 easy ways to a 6 and the 6 sevens lose: 10 to 1. At 9 the house keeps 1 in 11: 9.09%.", check: { edge: { key: "hard6", pct: 9.09 } } },
            { say: "The Big bets are the number before a 7 (anything else leaves them standing). A 6 or 8 has 5 ways to the 7's 6: true odds 6 to 5, and it pays 7 to 6. A 5 or 9, 3 to 2, pays 7 to 5. A 4 or 10, 2 to 1, pays 9 to 5. The house keeps what the short pay costs.", edges: [["b6", "Big 6 or 8"], ["b5", "Big 5 or 9"], ["b4", "Big 4 or 10"]], layout: { groups: ["bigs"], bets: { b6: 300 } } },
            { say: "Which of these keeps the house least?", quiz: ["A hard 8", "Any seven", "Big 6"], answer: 2, why: "Big 6 keeps 1.52%, about what the pass line does. A hard 8 keeps 9.09%, Any seven 16.67%.", check: { edge: { key: "b6", pct: 1.52 } } },
          ],
        },
        {
          id: "rank", title: "Every bet ranked", zh: "",
          steps: [
            { say: "What the house keeps of every bet, from least to most. The odds keep nothing; the lines and the Big 6 and 8 about 1.4 to 1.5%; everything else from 4% up.", edges: [["passo", "Odds"], ["dont", "Don't pass"], ["pass", "Pass line"], ["b6", "Big 6 or 8"], ["b5", "Big 5 or 9"], ["field", "Field"], ["b4", "Big 4 or 10"], ["hard6", "Hard 6 or 8"], ["hard4", "Hard 4 or 10"], ["craps", "Any craps"], ["horn", "Horn"], ["aces", "Aces, Boxcars"], ["big", "Big or Small"], ["seven", "Any seven"]] },
            { say: "Which keeps the house least?", quiz: ["The odds", "Don't pass", "Big 6"], answer: 0, why: "The odds keep nothing. Don't pass keeps 1.36%, the pass line 1.41%, Big 6 1.52%.", check: { fair: true } },
            { say: "You stake HK$100 a roll on Any seven for 100 rolls. About how much does the house expect to keep?", quiz: ["HK$1,667", "HK$167", "HK$16,670"], answer: 0, why: "HK$10,000 staked at 16.67%: HK$1,667. A pass line bet of HK$100 for 100 rounds costs about HK$141.", check: { edge: { key: "seven", pct: 16.67 } } },
          ],
        },
      ],
    },
    {
      id: "floor", title: "On the floor", zh: "賭場",
      lessons: [
        {
          id: "words", title: "The words", zh: "術語",
          steps: [
            { say: "The table's words, as the rules print them.", terms: [["派司拉", "paai3 si1 laai1", "the pass line"], ["東派司", "dung1 paai3 si1", "don't pass"], ["襟", "kam1", "come"], ["東襟", "dung1 kam1", "don't come"], ["附加投注", "fu6 gaa1 tau4 zyu3", "the additional bet: the odds"]] },
            { say: "And what's said at the table.", terms: [["出場擲骰", "ceot1 coeng4 zaak6 sik1", "the come-out roll"], ["主客", "zyu2 haak3", "the shooter"], ["莊荷", "zong1 ho4", "the croupier; the stickman is one"], ["和局", "wo4 guk6", "a push: bar 12"], ["無效", "mou4 haau6", "void"]] },
          ],
        },
      ],
    },
  ],
};
