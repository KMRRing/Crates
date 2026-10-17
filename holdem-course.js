// Hold'em's course (Learn, in the header): the game from nothing, as Macau's regulation has it (Despacho 11/2008, the
// Article numbers are its), and then what a good player counts: the share of the pot a hand wins (equity), the cards
// that make it (outs), what a call costs (pot odds), and which two cards to play from where. Data on the course sheet
// (course.js), drawn by holdem-stage.js; tests/holdem-course.mjs checks every answer and every figure against the rules
// and the evaluator, by counting every board still to come.
//
// A step: { say } words; { say, quiz, answer, why } a choice; { say, pick: 5, hole, board } an exercise on the cards; { say, play: true }
// the last step, a game against Easy. What the stage draws with it: hole, foes, board, backs, lit, equity, outs, odds, bets,
// layers, rake, rule, chen, ring, ranks, terms (holdem-stage.js). Each figure a step states carries what the test works out
// from the engine (check; tests/holdem-course.mjs):
//   { hand: "Straight, five high" } what hole + board make | { best: "…" } what a pick's best five is | { wins: 0 | 1 | "tie" }
//   who wins between hole and foes[0] | { plays: "board" } the best five is the board | { ring: { sb, bb, first, ask? } } the
//   blinds and who acts first on the step's ring (seats from 0; ask: which one the quiz asks) | { last: true } the button acts last
//   after the flop | { minTo: { raises, to } } the least the next raise may be | { layers: { put, amounts, back, ask? } } |
//   { rake: { pot, pct, amount } } | { price: { pot, call, pct, engine? } } | { equity: [mine, theirs] } | { outs: "flush" |
//   "straight" | "pair" } the step's outs are the cards that make it | { rule: true } the quick rule against the count |
//   { exact: { outs, street, pct } } | { chen: [[hand, count]] } | { opens: [{ place, hand, raise }] } what Hard does first in |
//   { short: { raise, allin } } an all-in short of a full raise does not let the raiser raise again.

export const COURSE = {
  title: "Learn Texas Hold'em",
  zh: "德州撲克",
  chapters: [
    {
      id: "hand", title: "The hand",
      lessons: [
        {
          id: "board", title: "Two cards and a board",
          steps: [
            { say: "Texas Hold'em (德州撲克, dak1 zau1 pok3 haak1) is played with one pack of 52, as Macau's regulation has it (Despacho 11/2008). You get two cards face down, your hole cards. Everyone else gets two too.", hole: "Ah Kd", backs: 3, terms: [["德州撲克", "dak1 zau1 pok3 haak1", "Texas Hold'em"]] },
            { say: "Five more go face up in the middle, the board, and everyone shares them: three at once (the flop), then one (the turn), then one (the river). There's a round of betting before the flop and after each stage.", hole: "Ah Kd", board: "7c 8d Qs 2h 2s" },
            { say: "Your hand is the best five of your seven cards. Tap five.", hole: "Ah Ad", board: "As 9c 4d 7h 2c", pick: 5, check: { best: "Three of a kind, aces" } },
            { say: "You may use both hole cards, one, or neither. Here the best five is the board itself, a royal flush, and anyone who reaches the showdown plays it: the pot is split.", hole: "2h 3d", board: "Ts Js Qs Ks As", lit: true, check: { plays: "board", hand: "Royal flush" } },
            { say: "How many of your hole cards must you use?", hole: "2h 3d", board: "Ts Js Qs Ks As", lit: true, quiz: ["Both", "At least one", "None: any five of the seven"], answer: 2, why: "Any five of the seven. When the board is the best hand, everyone left plays it.", check: { plays: "board" } },
          ],
        },
        {
          id: "ranks", title: "The hands",
          steps: [
            { say: "From best to worst. Suits never rank (Article 14). The Cantonese names are the regulation's own; a royal flush is the top straight flush, listed apart.", ranks: true },
            { say: "Who wins?", hole: "Ah 9h", foes: ["6d 4s"], board: "2h 5h Jh Kd 3c", quiz: ["You: a flush", "Them: a straight", "A tie"], answer: 0, why: "A flush beats a straight.", check: { wins: 0 } },
            { say: "Who wins?", hole: "Kh Kd", foes: ["Ah 3h"], board: "Ks 4h 4d 9h 2h", quiz: ["You: a full house", "Them: a flush", "A tie"], answer: 0, why: "Kings full of fours beats a flush. Three of a kind and a pair outrank five of a suit.", check: { wins: 0 } },
            { say: "The ace counts high, or low in A-2-3-4-5, the wheel: the lowest straight, five high.", hole: "Ad 2c", board: "3h 4s 5d Kc 9h", lit: true, check: { hand: "Straight, five high" } },
            { say: "Both have a straight. Who wins?", hole: "Ad 2c", foes: ["6d 2h"], board: "3h 4s 5d Kc 9h", quiz: ["You: the wheel", "Them: six high", "A tie"], answer: 1, why: "Six high beats five high: the ace is low in the wheel, so it's the smallest straight.", check: { wins: 1 } },
          ],
        },
        {
          id: "kickers", title: "Kickers and ties",
          steps: [
            { say: "When two hands are the same kind the cards outside the pair, the kickers, decide. The regulation counts them (Article 15): one for four of a kind, two for three of a kind, one for two pair, three for a pair. Here the pair of kings plays with three kickers.", hole: "Ah Kd", board: "Ks 9c 4d 7h 2c", lit: true, check: { hand: "Pair of kings" } },
            { say: "Both have a pair of kings. Who wins?", hole: "Ah Kd", foes: ["Kc Qd"], board: "Ks 9c 4d 7h 2c", quiz: ["You: the ace kicker", "Them: the queen kicker", "A tie"], answer: 0, why: "The kickers are the best three other cards: A, 9, 7 against Q, 9, 7.", check: { wins: 0 } },
            { say: "Both have a pair of aces. Who wins?", hole: "Ah 3d", foes: ["Ac 5s"], board: "Ad Kc Qh 9d 2s", quiz: ["You: the 3", "Them: the 5", "A tie"], answer: 2, why: "The board's K, Q, 9 are the best three kickers for both: your 3 and their 5 don't play. The pot is split.", check: { wins: "tie" } },
            { say: "Equal hands split the pot, and the odd chips go to the first of them left of the button (Article 10): in play after the flop, the seat marked 1st.", ring: { seats: 6, button: 2, order: true } },
          ],
        },
      ],
    },
    {
      id: "betting", title: "The betting",
      lessons: [
        {
          id: "button", title: "The button and the blinds", zh: "指示器",
          steps: [
            { say: "A disc, the button (指示器, zi2 si6 hei3), marks the dealer and moves one seat clockwise every hand. The player to its left posts the small blind (小盲注), the next the big blind (大盲注): forced bets, HK$50 and HK$100 here (Article 5).", ring: { seats: 6, button: 2 }, terms: [["指示器", "zi2 si6 hei3", "the button"], ["小盲注", "siu2 maang4 zyu3", "the small blind"], ["大盲注", "daai6 maang4 zyu3", "the big blind"]] },
            { say: "The button is on seat 3 of six. Who posts the big blind?", ring: { seats: 6, button: 2 }, quiz: ["Seat 4", "Seat 5", "Seat 6"], answer: 1, why: "Seat 4 posts the small blind, seat 5 the big blind.", check: { ring: { sb: 3, bb: 4, first: 5, ask: "bb" } } },
            { say: "Before the flop the player left of the big blind acts first, and the big blind last (Article 6). Who acts first here?", ring: { seats: 6, button: 2 }, quiz: ["Seat 4", "Seat 6", "Seat 3"], answer: 1, why: "Seat 6, left of the big blind; the big blind may check if nobody has raised.", check: { ring: { sb: 3, bb: 4, first: 5, ask: "first" } } },
            { say: "After the flop the first player left of the button acts first and the button last. Being last is worth a lot: you see what everyone does before you.", ring: { seats: 6, button: 2, order: true }, check: { last: true } },
            { say: "Heads-up, two players, the button is also the small blind: it acts first before the flop and last after it.", ring: { seats: 2, button: 0 }, check: { ring: { sb: 0, bb: 1, first: 0 } } },
          ],
        },
        {
          id: "moves", title: "Fold, check, call, raise", zh: "蓋牌",
          steps: [
            { say: "Fold (蓋牌, goi3 paai2) gives up the hand and what you've put in (Article 13). Check passes when nothing is owed. Call matches the bet. Raise makes it more, by at least the last bet or raise (Article 12).", terms: [["蓋牌", "goi3 paai2", "fold"]] },
            { say: "Nobody has bet and it's your turn, with a weak hand. Fold or check?", hole: "7c 2d", board: "Ks 9h 4d", quiz: ["Fold", "Check", "Call"], answer: 1, why: "Checking is free and keeps your cards: a fold with nothing to call can't be right. The table switches Fold off then." },
            { say: "With blinds of 50 and 100, the first player to act raises to 300: 200 over the big blind. The least the next player can raise to?", bets: [["Big blind", 100], ["Opens to", 300, "200 more"], ["Next raise", null, "at least to"]], quiz: ["HK$400", "HK$500", "HK$600"], answer: 1, why: "A raise is at least the size of the last one: 300 + 200 = 500.", check: { minTo: { raises: [300], to: 500 } } },
            { say: "Now a raise to 1,000, which is 700 over the 300. The next raise is to at least…", bets: [["Opens to", 300], ["Raises to", 1000, "700 more"], ["Next raise", null, "at least to"]], quiz: ["HK$1,300", "HK$1,700", "HK$2,000"], answer: 1, why: "1,000 + 700 = 1,700: each raise sets the least for the next.", check: { minTo: { raises: [300, 1000], to: 1700 } } },
          ],
        },
        {
          id: "allin", title: "All in and side pots", zh: "全押",
          steps: [
            { say: "All in (全押, cyun4 aat3) is a bet of every chip you have; there's no limit on a bet but those (Article 11). A player all in can win only what the others matched, and the rest is played for in a side pot.", terms: [["全押", "cyun4 aat3", "all in"]] },
            { say: "A is all in for 1,000, B for 3,000, C bets 5,000. The main pot is 3 × 1,000: all three can win it. The side pot, 2 × 2,000, is B's and C's. C's last 2,000 nobody matched: it goes back.", layers: { put: [1000, 3000, 5000] }, check: { layers: { put: [1000, 3000, 5000], amounts: [3000, 4000, 2000], back: true } } },
            { say: "A has the best hand. The most A can win is…", bets: [["A all in", 1000], ["B all in", 3000], ["C bets", 5000]], quiz: ["HK$1,000", "HK$3,000", "HK$9,000"], answer: 1, why: "The main pot: 1,000 from each of the three. Nothing beyond what A put in could be matched by A.", check: { layers: { put: [1000, 3000, 5000], amounts: [3000, 4000, 2000], back: true, ask: 0 } } },
            { say: "B has the next best hand. B wins the side pot of…", bets: [["A all in", 1000], ["B all in", 3000], ["C bets", 5000]], quiz: ["HK$2,000", "HK$4,000", "HK$6,000"], answer: 1, why: "2,000 from B and 2,000 from C. A isn't in it.", check: { layers: { put: [1000, 3000, 5000], amounts: [3000, 4000, 2000], back: true, ask: 1 } } },
            { say: "A raises to 1,000, which is 900 more than the big blind, so a full raise is to 1,900. B goes all in for 1,400: only 400 more, a short raise. A may call or fold, but not raise again.", bets: [["A raises to", 1000, "900 more"], ["B all in", 1400, "400 more: short"], ["A's full raise", 1900, "900 more"]], check: { short: { raise: 1000, allin: 1400 } } },
          ],
        },
        {
          id: "house", title: "The house's commission", zh: "佣金",
          steps: [
            { say: "The house takes a commission (佣金, jung6 gam1) of 3 to 5% of the pot, never more than five big blinds, HK$500 here (Article 16). A bet nobody called isn't counted. This table takes 5% unless the menu says otherwise.", rake: [200, 800, 4000, 30000], terms: [["佣金", "jung6 gam1", "the commission"]], check: { rake: { pot: 800, pct: 5, amount: 40 } } },
            { say: "A pot of HK$800 at 5%: the house takes…", rake: [800], quiz: ["HK$40", "HK$80", "HK$400"], answer: 0, why: "5% of 800 is 40. The winner has 760 for the 400 they put in.", check: { rake: { pot: 800, pct: 5, amount: 40 } } },
            { say: "A pot of HK$30,000 at 5% would be 1,500. The house takes…", rake: [30000], quiz: ["HK$1,500", "HK$500", "HK$300"], answer: 1, why: "The cap: five big blinds, 500. A big pot pays the house under 2%.", check: { rake: { pot: 30000, pct: 5, amount: 500 } } },
          ],
        },
      ],
    },
    {
      id: "counting", title: "Counting",
      lessons: [
        {
          id: "equity", title: "Equity",
          steps: [
            { say: "Your equity is your share of the pot if the cards were dealt out from here, over every way the board can fall: a win counts 1, a tie its share. Ace-king suited against queens:", hole: "Ah Kh", foes: ["Qs Qd"], equity: [46, 54], check: { equity: [46, 54] } },
            { say: "Who's the favourite?", hole: "Ah Kh", foes: ["Qs Qd"], equity: [46, 54], quiz: ["Ace-king suited, by a lot", "Queens, but only just", "It's exactly even"], answer: 1, why: "Two high cards run close to a pair: the queens win 54%.", check: { equity: [46, 54] } },
            { say: "The best pair against the second best: aces against kings. Even so the kings win 17% of the time.", hole: "Ah Ad", foes: ["Kh Kd"], equity: [83, 17], check: { equity: [83, 17] } },
            { say: "The smallest pair against two higher cards is a coin flip with a slight edge: 53%.", hole: "2h 2d", foes: ["As Kc"], equity: [53, 47], check: { equity: [53, 47] } },
            { say: "Ace-king against ace-queen shares the ace: it's dominated. Who's the favourite, and by how much?", hole: "Ah Kd", foes: ["As Qc"], equity: [74, 26], quiz: ["Ace-king, about 74%", "Ace-king, about 55%", "It's even"], answer: 0, why: "The king beats the queen whenever an ace lands.", check: { equity: [74, 26] } },
          ],
        },
        {
          id: "outs", title: "Outs",
          steps: [
            { say: "An out is a card still to come that makes your hand a likely winner. A♥ 9♥ with two hearts on the flop is four to a flush. Nine hearts are left, 13 less the four you can see: nine outs.", hole: "Ah 9h", board: "Kh 5h 2c", outs: "2h 3h 4h 6h 7h 8h Th Jh Qh", check: { outs: "flush" } },
            { say: "9♦ 8♣ on a 7♥ 6♠ K♦ flop: a 5 or a 10 makes a straight. How many outs?", hole: "9d 8c", board: "7h 6s Kd", outs: "5d 5c 5h 5s Td Tc Th Ts", quiz: ["4", "8", "9"], answer: 1, why: "Four fives and four tens. An open-ended draw has eight.", check: { outs: "straight" } },
            { say: "The same hand on a 6♥ 5♠ K♦ flop needs a 7 and only a 7, an inside straight draw. How many outs?", hole: "9d 8c", board: "6h 5s Kd", outs: "7d 7c 7h 7s", quiz: ["4", "8", "12"], answer: 0, why: "Four sevens.", check: { outs: "straight" } },
            { say: "A♥ K♦ has no pair on a 9♠ 5♣ 2♥ flop. Any ace or king pairs a hole card. How many outs?", hole: "Ah Kd", board: "9s 5c 2h", outs: "Ac Ad As Kc Kh Ks", quiz: ["3", "6", "8"], answer: 1, why: "Three aces and three kings. A pair may still not be best, so count them with care.", check: { outs: "pair" } },
            { say: "The rule of 4 and 2: on the flop, with two cards to come, outs × 4 is the chance of hitting by the river; on the turn, with one, outs × 2. It runs a little high above eight outs.", rule: [4, 6, 8, 9, 12, 15], check: { rule: true } },
            { say: "A flush draw on the flop has nine outs. About how often does it hit by the river?", hole: "Ah 9h", board: "Kh 5h 2c", quiz: ["About 18%", "About 35%", "About 52%"], answer: 1, why: "9 × 4 = 36 by the rule; counted exactly it's 34.97%.", check: { exact: { outs: 9, street: "flop", pct: 35 } } },
            { say: "The same draw on the turn, with one card to come, hits…", hole: "Ah 9h", board: "Kh 5h 2c 7d", quiz: ["About 10%", "About 20%", "About 35%"], answer: 1, why: "9 of the 46 unseen cards: 19.6%. The rule says 18%.", check: { exact: { outs: 9, street: "turn", pct: 20 } } },
          ],
        },
      ],
    },
    {
      id: "price", title: "The price of a call",
      lessons: [
        {
          id: "pot-odds", title: "Pot odds",
          steps: [
            { say: "Pot odds are the price of a call: what it costs against what you can win. A player bets 200 into 600, so the pot is 800 and calling costs 200. The call must win 200 ÷ (800 + 200) = 20% of the time to break even.", odds: { pot: 800, call: 200 }, check: { price: { pot: 800, call: 200, pct: 20 } } },
            { say: "The pot is 1,000, the bet in it, and the call is 500. What share of the time must the call win?", odds: { pot: 1000, call: 500 }, quiz: ["25%", "33%", "50%"], answer: 1, why: "500 ÷ (1,000 + 500) = 33%.", check: { price: { pot: 1000, call: 500, pct: 33 } } },
            { say: "Before the flop you're first to act in a six-seat game. The pot holds the blinds, 150, and calling costs 100: you need 100 ÷ 250 = 40%. That is why most hands fold.", odds: { pot: 150, call: 100 }, check: { price: { pot: 150, call: 100, pct: 40, engine: true } } },
          ],
        },
        {
          id: "price-equity", title: "Equity against price",
          steps: [
            { say: "Call when your equity is more than the price. A♥ 9♥ on K♥ 5♥ 2♣ against the top pair K♠ Q♦ has 46%. Facing 200 into 800 you need 20%: an easy call.", hole: "Ah 9h", foes: ["Ks Qd"], board: "Kh 5h 2c", odds: { pot: 800, call: 200, equity: 46 }, check: { equity: [46, 54], price: { pot: 800, call: 200, pct: 20 } } },
            { say: "Now a bet of 800 into 800: the pot is 1,600 and the call is 800, so you need 33%. You have 46%. Call or fold?", hole: "Ah 9h", foes: ["Ks Qd"], board: "Kh 5h 2c", odds: { pot: 1600, call: 800, equity: 46 }, quiz: ["Call: 46% beats 33%", "Fold: it's a big bet"], answer: 0, why: "A bigger bet raises the price, not your equity. 46% is still more than the 33% it costs.", check: { equity: [46, 54], price: { pot: 1600, call: 800, pct: 33 } } },
            { say: "9♦ 8♣ on 6♥ 5♠ K♦, an inside straight draw, has 19% against K♠ Q♣. The same bet: 800 into 800, needing 33%. Call or fold?", hole: "9d 8c", foes: ["Ks Qc"], board: "6h 5s Kd", odds: { pot: 1600, call: 800, equity: 19 }, quiz: ["Call", "Fold: 19% is less than 33%"], answer: 1, why: "The call loses money over time: it needs 33% and wins 19%.", check: { equity: [19, 81], price: { pot: 1600, call: 800, pct: 33 } } },
            { say: "Pot odds are the floor of a decision, not all of it. Bets still to come can make a call worth more (implied odds), and a raise can win the pot where a call can't.", hole: "Ah 9h", foes: ["Ks Qd"], board: "Kh 5h 2c" },
          ],
        },
      ],
    },
    {
      id: "start", title: "Which two cards",
      lessons: [
        {
          id: "chen", title: "Counting a starting hand",
          steps: [
            { say: "How good are two cards? The computer players use Bill Chen's count. Score the higher card (A 10, K 8, Q 7, J 6, then half its number), double it for a pair (at least 5), add 2 if suited.", chen: ["Ah Ad", "Ah Kh", "Th 9h", "7h 2d"], check: { chen: [["Ah Ad", 20], ["Ah Kh", 12], ["Th 9h", 8], ["7h 2d", -1]] } },
            { say: "Then take off 1 for a gap of one card between them, 2 for two, 4 for three, 5 for more; add 1 if the cards are close (a gap of 0 or 1) and both below a queen. Round up: J♥ 9♥ is 6 + 2 − 1 + 1 = 8.", chen: ["Jh 9h", "Ah 5d", "Kd Jc"], check: { chen: [["Jh 9h", 8], ["Ah 5d", 5], ["Kd Jc", 7]] } },
            { say: "What is K♥ Q♥ worth?", chen: ["Kh Qh"], quiz: ["8", "10", "12"], answer: 1, why: "A king is 8, suited adds 2, no gap: 10.", check: { chen: [["Kh Qh", 10]] } },
            { say: "And 7♥ 6♥?", chen: ["7h 6h"], quiz: ["5", "7", "9"], answer: 1, why: "A 7 is 3.5, suited adds 2, close and below a queen adds 1: 6.5, rounded up to 7.", check: { chen: [["7h 6h", 7]] } },
            { say: "The Hard computer players open the betting with a hand worth 9 or more from an early seat, and 6 or more from the button. A♥ Q♦ (9) opens early, A♥ J♦ (8) doesn't; 7♥ 6♥ (7) opens on the button, Q♦ 9♣ (5) doesn't.", chen: ["Ah Qd", "Ah Jd", "7h 6h", "Qd 9c"], check: { chen: [["Ah Qd", 9], ["Ah Jd", 8], ["7h 6h", 7], ["Qd 9c", 5]], opens: [{ place: "early", hand: "Ah Qd", raise: true }, { place: "early", hand: "Ah Jd", raise: false }, { place: "button", hand: "7h 6h", raise: true }, { place: "button", hand: "Qd 9c", raise: false }] } },
          ],
        },
        {
          id: "position", title: "Position",
          steps: [
            { say: "Acting last is an edge: you see what everyone does first. After the flop the button acts last, so the seats just behind it, the cutoff to its right and the button itself, are the best to play from.", ring: { seats: 6, button: 2, order: true }, check: { last: true } },
            { say: "Which seat acts last after the flop?", ring: { seats: 6, button: 2, order: true }, quiz: ["The small blind", "The big blind", "The button"], answer: 2, why: "The button. The small blind acts first.", check: { last: true } },
            { say: "Why open wider from the button?", ring: { seats: 6, button: 2, order: true }, quiz: ["Fewer players are left to act behind you", "The button is dealt better cards", "The button pays no blind"], answer: 0, why: "Only the blinds act after the button; an early seat has five players behind it." },
            { say: "That's the game. Next is a game of ten hands against Easy computer players: count your two cards, and look at where you sit.", chen: ["Ah Kh", "9h 8h", "Kd 4c", "6s 6d"], play: true, check: { chen: [["Ah Kh", 12], ["9h 8h", 8], ["Kd 4c", 3], ["6s 6d", 6]] } },
          ],
        },
      ],
    },
  ],
};
