// Blackjack's course (Learn, in the header): what a Macau blackjack table shows and says, from nothing, and the chart.
// The game (counting a hand, blackjack, the dealer, no hole card and what the dealer's blackjack takes), your plays
// (hit and stand, doubling, splitting, surrender, insurance), basic strategy for the Venetian's rules, and the table (the
// shuffler, your box and others' bets on it, the calls, Over/Under 13, money, the house's rules, the words). Macau's
// rules are the gaming regulator's (the DICJ's Despacho 57/2009); what's said of the Venetian and its neighbours comes
// from the sources README.md names. Data on the course sheet (course.js), drawn by blackjack-stage.js;
// tests/blackjack-course.mjs checks every answer against the engine.
//
// A step: { say } words; { say, quiz, answer, why } a choice; with hands, chart, felt, signals or terms for the stage.
// What a step claims of the rules carries what the test needs to check it: check: { total: { cards, total } } a hand's
// total; { round: { shoe, moves, net, dealer } } a round dealt from that shoe (you, the dealer's card, you, then on),
// what it comes to and how many cards the dealer ends with; { play: { cards, up, moves, want } } what the chart plays;
// { surrender: { shoe, moves, open } } whether surrender is open; { side: { cards, total } } Over/Under 13's total;
// { edge } the house's edge playing the chart; { bust: { up, p } } how often the dealer busts under that card;
// { insurance: p } the chance a dealer's ace has a ten under it.

export const COURSE = {
  title: "Learn blackjack",
  zh: "二十一點",
  chapters: [
    {
      id: "game", title: "The game", zh: "玩法",
      lessons: [
        {
          id: "count", title: "Counting a hand", zh: "點數",
          steps: [
            { say: "Blackjack (二十一點, ji6 sap6 jat1 dim2, in Macau's rules) is each box against the dealer (莊家, zong1 gaa1): get nearer 21 than the dealer without going over. Twos to nines count their pips, a ten or a court card 10, and an ace 1 or 11, whichever does you more good.", hands: { dealer: "9", you: "K 7" } },
            { say: "A hand with an ace counting 11 is soft: A,6 is soft 17, and no one card can take it over 21. Draw a 9 and the ace drops back to 1: hard 16. The table shows a soft hand both ways, 7/17.", hands: { dealer: "9", you: ["A 6", "A 6 9"] } },
            { say: "Your cards: A, 5 and 8. Your total…", hands: { dealer: "9", you: "A 5 8" }, quiz: ["14", "24: bust", "4 or 14"], answer: 0, why: "An ace counting 11 would make 24, so it counts 1: hard 14.", check: { total: { cards: "A 5 8", total: 14 } } },
          ],
        },
        {
          id: "blackjack", title: "Blackjack", zh: "倍半",
          steps: [
            { say: "An ace and a ten-value card as your first two cards is a blackjack, and pays 3 to 2: the rules say 倍半 (pui5 bun3), one and a half times the bet. It beats a 21 of three cards or more; against the dealer's blackjack it's a push (和局, wo4 guk6), your bet back.", hands: { dealer: "9", you: "A K" } },
            { say: "HK$1,000 in the circle, and you're dealt A, Q against a 9. You win…", hands: { dealer: "9", you: "A Q" }, quiz: ["HK$1,000", "HK$1,500", "HK$2,000"], answer: 1, why: "3 to 2: HK$1,500, and your HK$1,000 back with it.", check: { round: { shoe: "A 9 Q 8", net: 1500 } } },
            { say: "Split two aces and draw a ten to one of them: that's 21, not a blackjack, and it's paid even money.", hands: { dealer: "7", you: ["A K", "A 6"] } },
          ],
        },
        {
          id: "dealer", title: "The dealer", zh: "莊家",
          steps: [
            { say: "The dealer makes no choices: at the Venetian the dealer draws to 16 and stands on every 17, a soft 17 too, as the felt says. If the dealer goes over 21, every box still in the round wins.", felt: true },
            { say: "The dealer's cards: 6 and A. The dealer…", hands: { dealer: "6 A", you: "10 6" }, quiz: ["Draws: it's only 7 or 17", "Stands: soft 17 is 17", "Counts the ace 1 and draws"], answer: 1, why: "Every 17 stands, soft or hard. (Since 2007 Macau's rules have listed hitting soft 17 among the ways to deal, but every account of the tables, and the house edge published for them, has the dealer standing.)", check: { round: { shoe: "10 6 6 A 5", moves: ["stand"], net: -1000, dealer: 2 } } },
            { say: "The dealer shows a 6. How often does a 6 end in a bust?", hands: { dealer: "6", you: "10 3" }, quiz: ["About 1 time in 6", "About 2 times in 5", "About 3 times in 4"], answer: 1, why: "42%: a 6 has to draw, and often draws a ten to 16 and then busts. Hence standing on 13 against it and letting the dealer take the risk.", check: { bust: { up: 6, p: 0.42 } } },
          ],
        },
        {
          id: "hole", title: "No hole card", zh: "底牌",
          steps: [
            { say: "In Macau the dealer's second card comes only once every box has played: there's no hole card (底牌, dai2 paai4) to check, so a dealer showing an ace or a ten may turn a blackjack after you've put more out.", hands: { dealer: "10", you: "6 5" } },
            { say: "Macau's rules soften that: against the dealer's blackjack you lose only your original bet, and what you put out to double or split comes back. Sands China's tables, the Venetian's among them, make one exception: a double on 11 is lost whole." },
            { say: "HK$1,000 bet; you double 10 against a 10, and the dealer turns an ace. You lose…", hands: { dealer: "10 A", you: "6 4 K" }, quiz: ["HK$1,000", "HK$2,000", "Nothing: it's a push"], answer: 0, why: "Only the original bet: the HK$1,000 you doubled with comes back.", check: { round: { shoe: "6 10 4 K A", moves: ["double"], net: -1000 } } },
            { say: "And at the Venetian you double 11 against a 10, and the dealer turns an ace. You lose…", hands: { dealer: "10 A", you: "6 5 K" }, quiz: ["HK$1,000", "HK$2,000", "HK$1,500"], answer: 1, why: "A double on 11 is kept whole there. So at the Venetian 11 against a ten is hit: doubling would still win on average, but less than hitting. Elsewhere in Macau, double it.", check: { round: { shoe: "6 10 5 K A", moves: ["double"], net: -2000 } } },
          ],
        },
      ],
    },
    {
      id: "plays", title: "Your plays", zh: "博牌",
      lessons: [
        {
          id: "hit", title: "Hit or stand", zh: "博牌 · 不博牌",
          steps: [
            { say: "Your turn: hit (博牌, bok3 paai4), a card, as often as you like, or stand (不博牌, bat1 bok3 paai4). Go over 21 and you've bust: the rules say you must show it at once (開牌, hoi1 paai4), and the bet's lost there and then, whatever the dealer does after.", signals: true },
            { say: "You hit 16 and bust with 24. The dealer then busts too. You…", hands: { dealer: "7 6 10", you: "10 6 8" }, quiz: ["Win: the dealer bust as well", "Lose: you bust first", "Push"], answer: 1, why: "A bust loses at once. That's the house's edge: you play first, and your busts don't wait for the dealer's." },
          ],
        },
        {
          id: "double", title: "Doubling", zh: "加注",
          steps: [
            { say: "Double (加注, gaa1 zyu3): as much again beside your bet, and one card only, dealt face up. Any first two cards may be doubled, and so may the first two of a hand after a split.", hands: { dealer: "6", you: "6 5" } },
            { say: "HK$1,000 on 11 against a 6. You double and draw a 10; the dealer ends on 19. You win…", hands: { dealer: "6 K 3", you: "6 5 10" }, quiz: ["HK$1,000", "HK$2,000", "HK$3,000"], answer: 1, why: "21 beats 19, and the bet is HK$2,000 now: HK$2,000 won.", check: { round: { shoe: "6 6 5 10 K 3", moves: ["double"], net: 2000 } } },
          ],
        },
        {
          id: "split", title: "Splitting", zh: "分門",
          steps: [
            { say: "Two cards of one rank can be split (分門, fan1 mun4): each the first card of a hand, the same bet on each, each played on its own, and split again if a third comes, up to four hands. A jack and a queen are each worth 10 but aren't a pair.", hands: { dealer: "7", you: ["8 10", "8 A"] } },
            { say: "HK$1,000 on a pair of 8s against a 7. You split and end on 18 and 19; the dealer ends on 17. You win…", hands: { dealer: "7 K", you: ["8 10", "8 A"] }, quiz: ["HK$1,000", "HK$2,000", "HK$3,000"], answer: 1, why: "Two hands of HK$1,000, both beating 17.", check: { round: { shoe: "8 7 8 10 A K", moves: ["split", "stand", "stand"], net: 2000 } } },
            { say: "Split aces take one card each and no more.", hands: { dealer: "6", you: ["A 9", "A 4"] } },
          ],
        },
        {
          id: "surrender", title: "Surrender", zh: "放棄牌局",
          steps: [
            { say: "Surrender (放棄牌局, fong3 hei3 paai4 guk6): give up your first two cards before taking another, and half the bet comes back. Never against an ace. With no hole card, surrendering against a ten gives up half even when the dealer would have had blackjack.", hands: { dealer: "10", you: "10 6" } },
            { say: "HK$1,000 on 16 against a 10. You surrender, and the dealer turns an ace: blackjack. You lose…", hands: { dealer: "10 A", you: "10 6" }, quiz: ["HK$500", "HK$1,000", "Nothing"], answer: 0, why: "Half, as you chose; the blackjack takes nothing more.", check: { round: { shoe: "10 10 6 A", moves: ["surrender"], net: -500 } } },
            { say: "The dealer shows an ace, and you hold 16. May you surrender?", hands: { dealer: "A", you: "10 6" }, quiz: ["Yes, before taking a card", "No: never against an ace", "Only after taking insurance"], answer: 1, why: "The rules allow it only when the dealer's card isn't an ace.", check: { surrender: { shoe: "10 A 6 K", moves: ["noInsure"], open: false } } },
          ],
        },
        {
          id: "insurance", title: "Insurance", zh: "保險",
          steps: [
            { say: "When the dealer shows an ace you're offered insurance (保險, bou2 him2): half your bet more (the rules allow up to all of it), paid 2 to 1 if the dealer's next card is a ten. It's a bet that the dealer has blackjack, and from six decks that's under a third of the time: at 2 to 1 it loses about 7% of what goes on it.", hands: { dealer: "A", you: "9 7" }, check: { insurance: 0.31 } },
            { say: "HK$1,000 bet; you insure it with HK$500, and the dealer has blackjack. The round leaves you…", hands: { dealer: "A K", you: "9 7" }, quiz: ["HK$1,500 down", "Even: the insurance's HK$1,000 covers the bet", "HK$500 up"], answer: 1, why: "The bet's lost, the insurance pays HK$1,000: nothing changes hands. That's all insurance does when it wins.", check: { round: { shoe: "9 A 7 K", moves: ["insure", "stand"], net: 0 } } },
            { say: "With a blackjack against an ace, the dealer offers even money: paid 1 to 1 now, whatever comes. Waiting is worth more: 3 to 2 unless the dealer makes blackjack, about 1.04 times the bet on average. Macau's rules let you ask for even money against a ten too, and there waiting is worth more still.", hands: { dealer: "A", you: "A K" } },
            { say: "Should you insure a good hand, 20, against an ace?", hands: { dealer: "A", you: "K Q" }, quiz: ["Yes: protect it", "No: insurance loses on average whatever you hold", "Only with HK$1,000 or more on"], answer: 1, why: "Insurance is a bet of its own on the dealer's next card. Holding two tens it's worse still: two fewer tens left to make the dealer's blackjack." },
          ],
        },
      ],
    },
    {
      id: "chart", title: "The chart", zh: "策略",
      lessons: [
        {
          id: "basic", title: "Basic strategy", zh: "策略",
          steps: [
            { say: "For every hand you can hold against every card the dealer can show, one play loses least on average. Worked out for the Venetian's rules, they make a chart; play it every hand and the house keeps about 0.24% of what you bet, HK$2.40 in every HK$1,000.", chart: "hard", check: { edge: 0.0024 } },
            { say: "Read your total down the side and the dealer's card along the top: H hit, S stand, D double (else hit), R surrender (else hit). Pairs have their own chart, soft hands theirs. It's the same every round: with the shuffler taking the cards back, there's nothing else to go on.", chart: { kind: "hard", row: 16, up: 10 } },
          ],
        },
        {
          id: "hard", title: "Hard totals", zh: "硬牌",
          steps: [
            { say: "12 against a 3?", hands: { dealer: "3", you: "10 2" }, quiz: ["Hit", "Stand"], answer: 0, why: "Against a 2 or a 3, 12 hits; against a 4, 5 or 6 it stands.", check: { play: { cards: "10 2", up: "3", want: "hit" } } },
            { say: "13 against a 2?", hands: { dealer: "2", you: "10 3" }, quiz: ["Hit", "Stand"], answer: 1, why: "13 to 16 stand against a 2 to a 6, the dealer's weakest cards.", check: { play: { cards: "10 3", up: "2", want: "stand" } } },
            { say: "9 against a 4?", hands: { dealer: "4", you: "5 4" }, quiz: ["Hit", "Double", "Stand"], answer: 1, why: "9 doubles against a 3 to a 6.", check: { play: { cards: "5 4", up: "4", want: "double" } } },
            { say: "16 against a 10?", hands: { dealer: "10", you: "10 6" }, quiz: ["Hit", "Stand", "Surrender"], answer: 2, why: "Half back beats what 16 does against a ten either way. 14 and 15 surrender against a ten too, and 16 against a 9.", check: { play: { cards: "10 6", up: "10", want: "surrender" } } },
            { say: "11 against a 10, at the Venetian?", hands: { dealer: "10", you: "6 5" }, quiz: ["Double", "Hit", "Stand"], answer: 1, why: "Its double on 11 is lost whole to the dealer's blackjack, so hitting does better. Where the double would come back, double.", check: { play: { cards: "6 5", up: "10", want: "hit" } } },
            { say: "The pattern: against a 2 to a 6 stand on 13 and up (12 against a 4 to a 6); against a 7 or more hit to 17. Double 10 and 11 against a 2 to a 9 (11 against a ten as well, where a double on 11 comes back), 9 against a 3 to a 6. Surrender 14 to 16 against a ten, and 16 against a 9.", chart: "hard" },
          ],
        },
        {
          id: "soft", title: "Soft totals", zh: "軟牌",
          steps: [
            { say: "A soft hand can't bust on one card, so it doubles more and stands less. A,7 (soft 18) stands against a 2, a 7 or an 8, doubles against a 3 to a 6, and hits against a 9, a ten or an ace.", chart: "soft" },
            { say: "A,7 against a 9?", hands: { dealer: "9", you: "A 7" }, quiz: ["Stand: 18 is good", "Hit", "Double"], answer: 1, why: "Against a 9, a ten or an ace, 18 loses more often than it wins, and a soft 18 can take a card without busting.", check: { play: { cards: "A 7", up: "9", want: "hit" } } },
            { say: "A,6 against a 4?", hands: { dealer: "4", you: "A 6" }, quiz: ["Hit", "Stand", "Double"], answer: 2, why: "Soft 17 doubles against a 3 to a 6.", check: { play: { cards: "A 6", up: "4", want: "double" } } },
            { say: "A,2 against a 4?", hands: { dealer: "4", you: "A 2" }, quiz: ["Hit", "Double", "Stand"], answer: 0, why: "A,2 and A,3 double only against a 5 or a 6; A,4 and A,5 against a 4 to a 6.", check: { play: { cards: "A 2", up: "4", want: "hit" } } },
          ],
        },
        {
          id: "pairs", title: "Pairs", zh: "對子",
          steps: [
            { say: "Always split aces, and 8s against anything but a ten (there, surrender them); never split tens, nor 5s (5,5 is a 10, to double).", chart: "pairs" },
            { say: "8,8 against a 10?", hands: { dealer: "10", you: "8 8" }, quiz: ["Split", "Surrender", "Hit"], answer: 1, why: "Half back loses less than two hands against a ten. With surrender gone (after a split), split them.", check: { play: { cards: "8 8", up: "10", want: "surrender" } } },
            { say: "9,9 against a 7?", hands: { dealer: "7", you: "9 9" }, quiz: ["Split", "Stand", "Hit"], answer: 1, why: "A 7 makes 17 more than anything else, and 18 beats it.", check: { play: { cards: "9 9", up: "7", want: "stand" } } },
            { say: "K,K against a 6?", hands: { dealer: "6", you: "K K" }, quiz: ["Split: the dealer's weak", "Stand"], answer: 1, why: "20 wins most of the time already; two hands starting from a ten win less.", check: { play: { cards: "K K", up: "6", want: "stand" } } },
            { say: "4,4 against a 5?", hands: { dealer: "5", you: "4 4" }, quiz: ["Split", "Double", "Hit"], answer: 0, why: "Against a 5 or a 6, two hands each starting from a 4 do better than one 8.", check: { play: { cards: "4 4", up: "5", want: "split" } } },
          ],
        },
      ],
    },
    {
      id: "table", title: "At the table", zh: "賭枱",
      lessons: [
        {
          id: "shuffler", title: "The shuffler", zh: "自動洗派牌機",
          steps: [
            { say: "Macau's blackjack tables deal from a continuous shuffler (自動洗派牌機, zi6 dung6 sai2 paai3 paai4 gei1, in the rules: a machine that shuffles and deals). Five or six decks go in (six here), and after each round the cards go back in. Every round comes from all six decks, so what came before tells you nothing: counting cards has nothing to count." },
            { say: "The rules allow a shoe too (牌靴, paai4 hoe1), with a cut card (白咭, baak6 kaat1) near its end: the round it comes out in is the last. You'll see one at baccarat; at Macau's blackjack, the shuffler." },
            { say: "Two aces came out last round. With the shuffler, an ace this round is…", quiz: ["Less likely: two have gone", "As likely as ever: they're back in", "More likely: they come in runs"], answer: 1, why: "The round's cards went back into the machine: every round starts from all 24 aces." },
          ],
        },
        {
          id: "box", title: "Your box", zh: "門",
          steps: [
            { say: "Each place to bet is a box (門, mun4). You may bet more than one, and up to three people may bet on one (同門搭注, tung4 mun4 daap3 zyu3): the seated player decides how the hand is played, or at some tables whoever has the most on it, and the others go along." },
            { say: "You've a bet on a seated player's box, and they stand on 16 against a 10. You…", quiz: ["Go along: it's their call", "May ask the dealer for a card", "Get your bet back"], answer: 0, why: "The rules: nobody may meddle with another's choice to hit or stand." },
          ],
        },
        {
          id: "calls", title: "The calls", zh: "手勢",
          steps: [
            { say: "The dealer calls each box's total aloud and asks each in turn. Answer aloud or with your hand, as the rules allow: tap the felt for a card, wave a flat hand over your cards to stand; to double or split, put the chips beside your bet where the dealer can see them.", signals: true },
          ],
        },
        {
          id: "overunder", title: "Over/Under 13", zh: "13以上 · 13以下",
          steps: [
            { say: "The Venetian's side bet, Over/Under 13 (13以上 · 13以下, sap6 saam1 ji5 soeng6 · ji5 haa6): before the deal, chips on Over or Under, settled on your first two cards with an ace counting one. Over 13 or under it pays even money; exactly 13 loses either.", hands: { dealer: "9", you: "6 7" } },
            { say: "On Under 13, you're dealt A, K, a blackjack. The side bet…", hands: { dealer: "9", you: "A K" }, quiz: ["Loses: 21 is over 13", "Wins: the ace counts one, so 11", "Pushes"], answer: 1, why: "For the side bet an ace is one: A, K is 11, under 13. And the blackjack is paid as well.", check: { side: { cards: "A K", total: 11 } } },
            { say: "What it keeps: 6.55% of what goes on Over, 10.07% on Under, against 0.24% on a hand played by the chart. Other side bets the rules allow (any pair, 任何對子, jam6 ho4 deoi3 zi2, at 11 to 1, and the rest) you may meet at other casinos." },
          ],
        },
        {
          id: "money", title: "Money", zh: "籌碼",
          steps: [
            { say: "The Venetian's tables started at HK$300 in 2026 (Maven of Macau), HK$500 to HK$1,000 in the Golden Week and Chinese New Year crowds (GGRAsia's checks); the Parisian's at HK$300 too, the Londoner's from HK$300, the Plaza's at HK$1,000. Each table's sign says its minimum and maximum. Chips are Hong Kong dollars." },
            { say: "Blackjack is a small game in Macau: about 1% of what the casinos won in 2025. Expect a few tables among the baccarat." },
          ],
        },
        {
          id: "rules", title: "The house's rules", zh: "規則",
          steps: [
            { say: "21 and over on the floor. No phone in your hand at the table (an instruction since 2016), and no photographs. Once the cards are coming out, leave your bet alone: the dealer moves the chips." },
          ],
        },
        {
          id: "words", title: "Words", zh: "詞彙",
          steps: [
            { say: "The game's words, as Macau's rules write them.", terms: [["二十一點", "ji6 sap6 jat1 dim2", "blackjack"], ["莊家", "zong1 gaa1", "the dealer"], ["門", "mun4", "a box"], ["博牌", "bok3 paai4", "hit"], ["不博牌", "bat1 bok3 paai4", "stand"], ["加注", "gaa1 zyu3", "double"], ["分門", "fan1 mun4", "split"], ["放棄牌局", "fong3 hei3 paai4 guk6", "surrender"]] },
            { say: "And the rest.", terms: [["保險", "bou2 him2", "insurance"], ["和局", "wo4 guk6", "a push"], ["開牌", "hoi1 paai4", "show the cards (a bust)"], ["倍半", "pui5 bun3", "one and a half times"], ["底牌", "dai2 paai4", "the hole card"], ["軟牌十七點", "jyun5 paai4 sap6 cat1 dim2", "soft 17"], ["同門搭注", "tung4 mun4 daap3 zyu3", "betting on another's box"]] },
          ],
        },
      ],
    },
  ],
};
