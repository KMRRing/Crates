// Baccarat's course (Learn, in the header): everything a Macau table shows and says, from nothing, for someone about to
// sit down at one. The game (two hands dealt by rules nobody chooses), the bets and what they pay (the side bets Sands
// China's tables carry among them), the scoreboard's roads (how each is drawn, and what the ask buttons say), and the
// floor (the shoe, the squeeze, money, the words across the table, the house's rules). Data on the course sheet
// (course.js), drawn by baccarat-stage.js; tests/baccarat-course.mjs checks every card, road and answer against the rules.
// What it says of Macau comes from the DICJ's rules for baccarat (the gaming regulator's) and from site checks and
// studies named in README.md.
//
// A step: { say } words; { say, quiz, answer, why } a choice; with hands, road, layout, sign, tableau, terms, peel or burn
// for the stage to draw (baccarat-stage.js). Every pair of hands shown is one the rules deal, unless it's marked free
// (the first two cards, before any third); answers that rest on the rules carry what the test needs to check them:
// check: { pays } (a payout worked out), { road } (a road's marks, or the ask road's next one), { count } and { longest }
// (a screen read), { side } (the pips down a card's long side), { burn } (what a first card burns).

const SCREEN = "B P P B B B T P B B P P P P B T B P B B B B B P P B P T B B";
export const COURSE = {
  title: "Learn baccarat",
  zh: "百家樂",
  chapters: [
    {
      id: "game", title: "The game", zh: "玩法",
      lessons: [
        {
          id: "hands", title: "Two hands, nobody's choice", zh: "閒 · 莊",
          steps: [
            { say: "Baccarat deals two hands, the Player (閒, haan4) and the Banker (莊, zong1). Neither is a person: they're two boxes on the layout, and you bet on the one you think will end nearer nine. Once the bets are down nobody decides anything; the cards are dealt by fixed rules.", hands: { player: "7 K", banker: "4 3" } },
            { say: "Cards count by their pips: an ace 1, two to nine as they are, a ten or a court card (J, Q, K: 公, gung1, on the floor) nothing. A hand counts only the last digit of its total: 7 and 8 make 15, which counts 5.", hands: { player: "7 8", banker: "K 9" } },
            { say: "The Player's 7 and 8 count…", hands: { player: "7 8", banker: "K 9" }, quiz: ["15", "5", "8"], answer: 1, why: "Only the last digit counts: 15 is 5. The Banker's K and 9 is 9, the best a hand can be." },
            { say: "A 6 and a 4 count…", hands: { player: "6 4", banker: "A 2" }, free: true, quiz: ["10", "0", "1"], answer: 1, why: "10 counts 0, the worst a hand can be." },
            { say: "The higher total wins. Equal totals are a tie (和, wo4): a bet on Player or Banker is neither won nor lost. It stays on the table for the next hand, and you may leave it, take it back or move it to the other side." },
          ],
        },
        {
          id: "naturals", title: "Naturals", zh: "例牌",
          steps: [
            { say: "Two cards each first: Player, Banker, Player, Banker. If either hand has 8 or 9 on its two cards, that's a natural (例牌, lai6 paai2): nobody draws, and the totals are compared at once.", hands: { player: "8 K", banker: "5 Q" } },
            { say: "Player 8, Banker 5: does the Banker draw a third card?", hands: { player: "8 K", banker: "5 Q" }, quiz: ["Yes, on 5", "No: the Player has a natural"], answer: 1, why: "A natural on either side ends the hand: the Player wins 8 to 5." },
            { say: "A natural 9 beats a natural 8; two equal naturals tie.", hands: { player: "4 4", banker: "9 K" } },
          ],
        },
        {
          id: "player3", title: "The Player's third card", zh: "閒補牌",
          steps: [
            { say: "No natural: the Player goes first. On 0 to 5 it draws a third card (補牌, bou2 paai2); on 6 or 7 it stands. The third card is dealt sideways, so the table can see at a glance whose it is.", hands: { player: "3 2 6", banker: "K 7" } },
            { say: "The Player holds 6. Does it draw?", hands: { player: "J 6", banker: "2 2" }, free: true, quiz: ["It draws", "It stands"], answer: 1, why: "6 and 7 stand. Only 0–5 draw." },
            { say: "The Player holds 5. Does it draw?", hands: { player: "2 3", banker: "K 6" }, free: true, quiz: ["It draws", "It stands"], answer: 0, why: "0 to 5 always draw for the Player." },
          ],
        },
        {
          id: "banker3", title: "The Banker's third card", zh: "莊補牌",
          steps: [
            { say: "The Banker's rule depends on what the Player did. If the Player stood (two cards), the Banker plays the same rule: draws on 0–5, stands on 6 or 7.", hands: { player: "7 K", banker: "5 Q 2" } },
            { say: "If the Player drew, the Banker looks at the Player's third card. The chart: on 0–2 the Banker always draws, on 7 it stands; on 3 it draws unless the Player's third card was an 8; on 4 against a 2–7; on 5 against a 4–7; on 6 against a 6 or 7. D draws, S stands.", tableau: true },
            { say: "Banker holds 3; the Player's third card was an 8. The Banker…", tableau: { bt: 3, v: 8 }, quiz: ["Draws", "Stands"], answer: 1, why: "On 3 the Banker draws against anything but an 8." },
            { say: "Banker holds 6; the Player's third card was a 7. The Banker…", tableau: { bt: 6, v: 7 }, quiz: ["Draws", "Stands"], answer: 0, why: "On 6 the Banker draws only against a 6 or 7, and this is one." },
            { say: "Banker holds 4; the Player's third card was an ace (1). The Banker…", tableau: { bt: 4, v: 1 }, quiz: ["Draws", "Stands"], answer: 1, why: "On 4 the Banker draws against 2 to 7: an ace is outside it." },
            { say: "You never need this to play: the dealer deals it. But it's how you know, during a squeeze, whether a third card is coming, and the floor talks about it card by card." },
          ],
        },
      ],
    },
    {
      id: "bets", title: "The bets", zh: "投注",
      lessons: [
        {
          id: "main", title: "Player, Banker, Tie", zh: "閒 · 莊 · 和",
          steps: [
            { say: "The layout: Player and Banker in the big boxes nearest you, the Tie and the side bets above. Player pays 1 to 1. Banker pays 0.95 to 1 at a commission table: the house keeps 5% of a Banker win. A Tie pays 8 to 1.", layout: { table: "commission" } },
            { say: "HK$1,000 on Banker, and Banker wins at a commission table. You get back your HK$1,000 and…", layout: { table: "commission", stakes: { banker: 1000 } }, quiz: ["HK$1,000", "HK$950", "HK$500"], answer: 1, why: "0.95 to 1: HK$950, the house keeping HK$50 of the win.", check: { pays: { spot: "banker", stake: 1000, hand: "2 3 2 3 7 A", table: "commission", net: 950 } } },
            { say: "HK$1,000 on Player, and the hand is a tie. Your HK$1,000…", layout: { table: "commission", stakes: { player: 1000 } }, quiz: ["Is lost: the hand wasn't won", "Stays: to leave, take back or move", "Is paid 8 to 1, as the Tie is"], answer: 1, why: "A tie settles nothing between Player and Banker: Macau's rules let you leave the bet for the next hand, take it back, or change it, to the other side too. Only a bet on the Tie wins, 8 to 1.", check: { pays: { spot: "player", stake: 1000, hand: "Q 4 7 3", table: "commission", net: 0 } } },
            { say: "Why does Banker pay less? The Banker's rule, drawing after seeing the Player's card, makes it win a little more often: 45.9% of hands against the Player's 44.6% (9.5% tie). The commission evens that out, and a bit more for the house." },
          ],
        },
        {
          id: "commission", title: "Commission or none", zh: "佣金 · 免佣",
          steps: [
            { say: "Tables come in two kinds, written on the sign: commission (佣金, jung2 gam1) and no commission (免佣, min5 jung2). Without commission the Banker pays 1 to 1, except when it wins with a total of 6: then it pays half.", layout: { table: "nocommission" } },
            { say: "No-commission table, HK$1,000 on Banker, and Banker wins 6 to 2. You win…", layout: { table: "nocommission", stakes: { banker: 1000 } }, hands: { player: "2 2 8", banker: "3 3" }, quiz: ["HK$1,000", "HK$950", "HK$500"], answer: 2, why: "A Banker win with 6 pays half at a no-commission table.", check: { pays: { spot: "banker", stake: 1000, hand: "2 3 2 3 8", table: "nocommission", net: 500 } } },
            { say: "No commission is the usual table on Macau's main floors now, Cotai's above all; commission tables are mostly in the high-limit rooms. Commission Banker loses 1.06% of what you stake on average, no-commission Banker 1.46%: commission is the better bet, no commission the quicker to pay." },
          ],
        },
        {
          id: "pairs", title: "The pairs, and Pairs+", zh: "閒對 · 莊對",
          steps: [
            { say: "The Player pair (閒對, haan4 deoi3) and Banker pair (莊對, zong1 deoi3) win if that hand's first two cards are the same rank: two 7s, two kings. They pay 11 to 1, whoever wins the hand.", hands: { player: "7 7", banker: "K Q" }, free: true, layout: { table: "nocommission", sides: ["pairs"] } },
            { say: "A 10 and a king both count nothing. Are they a pair?", hands: { player: "10 K", banker: "4 4" }, free: true, quiz: ["Yes", "No"], answer: 1, why: "A pair is two of the same rank, not the same count. The Banker's two 4s are a pair." },
            { say: "Since April 2026 many of Sands China's tables, the Venetian's among them, have Pairs+ in place of the two: one bet on a pair in either hand, 3 to 1; a pair in each hand, 30 to 1; the same pair in each, 300 to 1.", layout: { table: "nocommission", sides: ["pairsplus"] } },
            { say: "HK$100 on Pairs+, and the Player's first two are 7s, the Banker's 9s. You win…", hands: { player: "7 7", banker: "9 9" }, layout: { table: "nocommission", sides: ["pairsplus"], stakes: { pairsplus: 100 } }, quiz: ["HK$300", "HK$3,000", "HK$30,000"], answer: 1, why: "A pair in each hand, of different ranks: 30 to 1. Two pairs of 7s would have paid 300 to 1.", check: { pays: { spot: "pairsplus", stake: 100, hand: "7 9 7 9", table: "nocommission", net: 3000 } } },
          ],
        },
        {
          id: "sixes", title: "The sixes", zh: "幸運六點",
          steps: [
            { say: "Three bets on the Banker winning with 6, the hand a no-commission table pays half on. Lucky 6 (幸運六點, hang6 wan6 luk6 dim2): 12 to 1 if the Banker's six is on two cards, 20 to 1 on three. Small 6: only on two cards, 22 to 1. Big 6: only on three, 50 to 1.", layout: { table: "nocommission", sides: ["lucky6", "six"] } },
            { say: "Banker wins 6 to 2, its six on two cards. HK$100 on Small 6 wins…", hands: { player: "2 2 8", banker: "3 3" }, layout: { table: "nocommission", sides: ["lucky6", "six"], stakes: { small6: 100 } }, quiz: ["HK$1,200", "HK$2,200", "HK$5,000"], answer: 1, why: "Small 6 pays 22 to 1 on a two-card six. Lucky 6 would have paid 12 to 1; Big 6 loses.", check: { pays: { spot: "small6", stake: 100, hand: "2 3 2 3 8", table: "nocommission", net: 2200 } } },
            { say: "Now the Banker's six comes on three cards. HK$100 on Lucky 6 wins…", hands: { player: "K K 2", banker: "2 2 2" }, quiz: ["HK$1,200", "HK$2,000", "HK$5,000"], answer: 1, why: "Lucky 6 pays 20 to 1 on three cards; Big 6 would have paid 50 to 1.", check: { pays: { spot: "lucky6", stake: 100, hand: "K 2 K 2 2 2", table: "nocommission", net: 2000 } } },
            { say: "The Banker wins with a six about one hand in nineteen: on two cards one in twenty-seven, on three one in sixty. GGRAsia found Small 6 and Big 6 on every Venetian table in October 2024." },
          ],
        },
        {
          id: "sevens", title: "The sevens", zh: "幸運7",
          steps: [
            { say: "The same for the Player winning with 7. Lucky 7: 6 to 1 on two cards, 15 to 1 on three. Small 7: two cards, 15 to 1; Big 7: three, 30 to 1. Super Lucky 7 wants the Player's 7 to beat the Banker's 6: 30 to 1, 40 to 1 if one of them took a third card, 100 to 1 if both did.", layout: { table: "nocommission", sides: ["lucky7", "seven", "superlucky7"] } },
            { say: "Player 7 on three cards, Banker 6 on two. HK$100 on Super Lucky 7 wins…", hands: { player: "2 3 2", banker: "K 6" }, layout: { table: "nocommission", sides: ["lucky7", "seven", "superlucky7"], stakes: { superlucky7: 100 } }, quiz: ["HK$3,000", "HK$4,000", "HK$10,000"], answer: 1, why: "One third card between them: 40 to 1. Lucky 7 pays 15 to 1 here and Big 7 30 to 1; Small 7 loses.", check: { pays: { spot: "superlucky7", stake: 100, hand: "2 K 3 6 2", table: "nocommission", net: 4000 } } },
          ],
        },
        {
          id: "monkey", title: "Monkey no Monkey", zh: "公",
          steps: [
            { say: "A monkey is a court card: J, Q or K. Monkey no Monkey looks at the first four cards dealt: none a court card, it pays even money; all four, 50 to 1; anything between loses. The Venetian has had it since April 2026.", layout: { table: "nocommission", sides: ["monkey", "pairsplus"] } },
            { say: "The first four cards are 10, 3, 4 and 5. Monkey no Monkey…", hands: { player: "10 4", banker: "3 5" }, free: true, quiz: ["Wins even money", "Loses: a ten is a monkey", "Pays 50 to 1"], answer: 0, why: "A ten counts nothing but isn't a court card: no monkey among the four.", check: { pays: { spot: "monkey", stake: 100, hand: "10 3 4 5 2 2", table: "nocommission", net: 100 } } },
          ],
        },
        {
          id: "limits", title: "The limits sign", zh: "限紅",
          steps: [
            { say: "Every table has a sign with its limits (限紅, haan6 hung4): the least and most on Player or Banker, and its own on the side bets. Macau's casinos play in Hong Kong dollars: the chips and the signs are HK$.", sign: { min: 500, max: 100000, side: 10000 } },
            { say: "This table: can you bet HK$300 on Banker?", sign: { min: 500, max: 100000, side: 10000 }, quiz: ["Yes", "No"], answer: 1, why: "HK$500 is the least on Player or Banker." },
            { say: "This year the main floors of Sands China's Cotai casinos, the Venetian's among them, have had minimums from HK$500 to HK$3,000, their high-limit rooms mostly HK$2,000 to HK$5,000, and side bets from HK$100 (GGRAsia's site checks)." },
          ],
        },
        {
          id: "edge", title: "What the house keeps", zh: "莊家優勢",
          steps: [
            { say: "On average, of every HK$100 staked: Banker (commission) loses HK$1.06, Banker (no commission) HK$1.46, Player HK$1.24, the Tie HK$14.36, a pair HK$10.36. The newer side bets keep between HK$13 and HK$18: Small 7 13.05, Small 6 14.33, Super Lucky 7 14.83, Big 6 15.25, Big 7 15.41, Monkey 16.50, Lucky 6 16.68, Pairs+ 17.14, Lucky 7 18.30." },
            { say: "No system or road changes these: each hand is dealt from the shoe as it is, whatever came before. The best bet on the layout is…", quiz: ["The Tie: it pays 8 to 1", "Banker at a commission table", "Whichever side the roads favour"], answer: 1, why: "Banker at a commission table gives the house the least: 1.06%. The Tie's 8 to 1 is well short of the 9.5 to 1 its chance would deserve." },
          ],
        },
      ],
    },
    {
      id: "roads", title: "The scoreboard", zh: "路紙",
      lessons: [
        {
          id: "bead", title: "The bead plate", zh: "珠盤路",
          steps: [
            { say: "The screen over the table shows the shoe so far in several ways, the roads (路, lou6). The bead plate (珠盤路, zyu1 pun4 lou6) is the simplest: every hand in order, down a column of six then on to the next. Red 莊 a Banker win, blue 閒 a Player win, green 和 a tie.", road: { kind: "bead", seq: "B B P T B P P B P B B T", w: 6 } },
            { say: "Little dots are the pairs: red at the top left a Banker pair, blue at the bottom right a Player pair.", road: { kind: "bead", seq: "B Bb P Pp T B", w: 6 } },
            { say: "Which hand came fourth?", road: { kind: "bead", seq: "B B P T B P P B", w: 6 }, quiz: ["Banker", "Player", "Tie"], answer: 2, why: "Down the first column: Banker, Banker, Player, then the tie." },
          ],
        },
        {
          id: "big", title: "The big road", zh: "大路",
          steps: [
            { say: "The big road (大路, daai6 lou6) is the one players watch. Each column is a run of one side: a ring for each win, red for Banker, blue for Player. When the other side wins, a new column starts. Ties don't get a ring.", road: { kind: "big", seq: "B B B P B B P P P P B", w: 10 } },
            { say: "B B B, P, B B, P P P P, B: so far five columns. If the Banker wins the next hand, its ring goes…", road: { kind: "big", seq: "B B B P B B P P P P B", w: 10, flash: "B" }, quiz: ["Under the last red ring", "At the top of a new column"], answer: 0, why: "The Banker's run goes on, so down the same column. A Player win would start a new one." },
            { say: "A tie is a green slash across the ring before it (a number if several); pairs are dots, as on the bead plate.", road: { kind: "big", seq: "B T P Pp T T B Bb", w: 8 } },
          ],
        },
        {
          id: "dragon", title: "The dragon's tail", zh: "長龍",
          steps: [
            { say: "A column is six rings high. A run longer than that turns right along the bottom row: the dragon's tail. A long run of one side is a long dragon (長龍, coeng4 lung4), and tables full of people chase it.", road: { kind: "big", seq: "P B B B B B B B B B P", w: 10 } },
            { say: "This run of nine Banker wins: how many columns does it take up on the screen?", road: { kind: "big", seq: "P B B B B B B B B B P", w: 10 }, quiz: ["One", "Four", "Nine"], answer: 1, why: "Six down, then three more along the foot: four columns across, though it's still one column of the road." },
          ],
        },
        {
          id: "bigeye", title: "The big eye boy", zh: "大眼仔",
          steps: [
            { say: "Under the big road are three derived roads, drawn small. They don't record wins: each records whether the big road is repeating itself (red) or breaking its pattern (blue). The big eye boy (大眼仔, daai6 ngaan5 zai2) compares each new ring with the column just before.", road: { kind: "big", seq: "B B B P P B P P P B B", w: 8 } },
            { say: "Going down a column, it asks: does the column to the left reach this row? Yes: red. It stops exactly one row short: blue. It stopped two or more short: red again (two rows of nothing is a pattern too).", road: { kind: "big", seq: "B B B P P B P P P B B", w: 8 } },
            { say: "Starting a new column, it asks: were the two columns before it the same length? Yes: red. No: blue.", road: { kind: "big", seq: "B B B P P B P P P B B", w: 8 } },
            { say: "So for this big road the big eye boy reads, from where it starts (the second ring of the second column): red, blue, blue, blue, red, blue, red.", road: { kind: 1, seq: "B B B P P B P P P B B", w: 8 }, check: { road: { k: 1, seq: "B B B P P B P P P B B", marks: "red blue blue blue red blue red" } } },
            { say: "The second column (P P) is two long; the first (B B B) is three. When the third column started with a single B, the big eye boy marked…", road: { kind: "big", seq: "B B B P P B", w: 8 }, quiz: ["Red: same lengths", "Blue: different lengths"], answer: 1, why: "The two columns before it, 3 and 2, differ: blue.", check: { road: { k: 1, seq: "B B B P P B", marks: "red blue" } } },
          ],
        },
        {
          id: "small", title: "The small road and the cockroach road", zh: "小路 · 曱甴路",
          steps: [
            { say: "The small road (小路, siu2 lou6) asks the same questions two columns back; the cockroach road (曱甴路, gaat6 zaat2 lou6) three columns back. The big eye boy is drawn as rings, the small road as dots, the cockroach road as slashes.", road: { kind: "board", seq: "B B B P P B P P P B B T P", w: 20 } },
            { say: "Each starts later than the one before: the small road at the second ring of the third column, the cockroach road at the second ring of the fourth.", road: { kind: 2, seq: "B B B P P B P P P B B", w: 8 }, check: { road: { k: 2, seq: "B B B P P B P P P B B", marks: "blue red blue blue blue" } } },
            { say: "Players read lots of red as a shoe that repeats (runs and steady patterns) and lots of blue as a choppy one. It describes the past; it doesn't move the odds of the next hand." },
          ],
        },
        {
          id: "ask", title: "The ask buttons", zh: "問路",
          steps: [
            { say: "Two buttons on the screen, 莊問路 (Banker ask) and 閒問路 (Player ask), show what each derived road would mark if the next hand went that way: the big eye boy's ring, the small road's dot and the cockroach road's slash, in red or blue.", road: { kind: "board", seq: "B B B P P B P P P B B", w: 20 } },
            { say: "Here, if the Banker wins next, the big eye boy would mark…", road: { kind: "board", seq: "B B B P P B P P P B B", w: 20, flash: "B" }, quiz: ["Red", "Blue"], answer: 0, why: "The Banker's column would reach a third ring, and the column before it (P P P) reaches its third row: red.", check: { road: { ask: "B", k: 1, seq: "B B B P P B P P P B B", mark: "red" } } },
            { say: "Each road's two answers are always opposite colours: whatever a Banker win would mark red, a Player win would mark blue. Hold one of the buttons over the table to see the next marks blink.", road: { kind: "board", seq: "B B B P P B P P P B B", w: 20, flash: "P" }, check: { road: { ask: "P", k: 1, seq: "B B B P P B P P P B B", mark: "blue" } } },
          ],
        },
        {
          id: "read", title: "Reading a whole screen", zh: "睇路",
          steps: [
            { say: "A screen thirty hands into a shoe, as you'd see it walking past a table. Read it as the table does: the big road for who's winning and how, the bead plate for the order, the small roads for the shoe's character.", road: { kind: "board", seq: SCREEN, w: 20 } },
            { say: "How many hands has the Banker won this shoe?", road: { kind: "board", seq: SCREEN, w: 20 }, quiz: ["11", "16", "30"], answer: 1, why: "Sixteen red; eleven blue, and three ties (the green slashes and beads): thirty hands.", check: { count: { seq: SCREEN, w: "B", n: 16 } } },
            { say: "The longest run so far is…", road: { kind: "big", seq: SCREEN, w: 14 }, quiz: ["3 Banker wins", "4 Player wins", "5 Banker wins"], answer: 2, why: "The longest column is five red rings, Banker after Banker.", check: { longest: { seq: SCREEN, w: "B", n: 5 } } },
            { say: "If the Player wins the next hand, the big eye boy marks…", road: { kind: "board", seq: SCREEN, w: 20, flash: "P" }, quiz: ["Red", "Blue"], answer: 1, why: "The 閒問 button would show a blue ring first: a Player win would break the big road's pattern as the big eye boy reads it.", check: { road: { ask: "P", k: 1, seq: SCREEN, mark: "blue" } } },
          ],
        },
        {
          id: "patterns", title: "The patterns people bet", zh: "路型",
          steps: [
            { say: "The names you'll hear: a long dragon (長龍) is a long run of one side; ping-pong (單跳, daan1 tiu3) is B P B P, one each in turn; double jump (雙跳, soeng1 tiu3) is BB PP BB PP.", road: { kind: "big", seq: "B P B P B P B B P P B B P P", w: 12 } },
            { say: "Each hand comes from what's left in the shoe; with eight decks what came before barely changes it. The patterns are how the floor talks, and why the screens are there. Bet them for fun, not for an edge." },
          ],
        },
      ],
    },
    {
      id: "floor", title: "On the floor", zh: "場內",
      lessons: [
        {
          id: "shoe", title: "The shoe", zh: "牌靴",
          steps: [
            { say: "The cards come from a shoe (牌靴, paai4 hoe1), usually of eight decks: Macau's rules allow six to twelve. After the shuffle a player or the dealer cuts, and the white cut card (白咭, baak6 kaat1) goes in near the back, at least about twelve cards from the end." },
            { say: "Then the burn (銷牌, siu1 paai2): cards taken off the top unseen. The house picks how many: as many as there are decks, a set number, or what the first card counts, turned face up for all to see. Here a 7: seven more go. (This game burns ten for a ten or a court card.)", burn: "7", check: { burn: { card: "7", n: 7 } } },
            { say: "The cut card comes out of the shoe in the middle of a hand. What happens?", quiz: ["The hand stops, and the shoe is changed", "The hand finishes: it's the last, or one more", "The shoe is dealt on to its last card"], answer: 1, why: "Macau's rules: when the cut card comes, that hand is the last, or one more is dealt (the house's choice, and the dealer says which). Then a new shoe." },
            { say: "Every one of Sands China's 1,100-odd mass-floor baccarat tables has been a smart table since January 2025: the shoe reads each card as it comes out, and the screen over the table fills itself in." },
          ],
        },
        {
          id: "squeeze", title: "The squeeze", zh: "咪牌",
          steps: [
            { say: "At a squeeze table each side's cards come face down to the biggest bet on that side, who turns them as slowly as the table can bear: the squeeze (咪牌, mi1 paai2; the rules say 持牌, ci4 paai2, holding the cards). Only that player touches them, they can't leave the table, and a third card can't be looked at with the first two." },
            { say: "Squeezed cards get bent, so a squeeze table opens new decks for every shoe. The biggest bettor may hand the honour to someone the table thinks lucky." },
            { say: "Thumbs keep the corners down (the index there would give the card away) and a long side is peeled first. No pips along it: an ace, 2 or 3, or a court card. Two pips down the side (二邊, ji6 bin1): a 4 or 5. Three (三邊, saam1 bin1): a 6, 7 or 8. Four (四邊, sei3 bin1): a 9 or 10.", peel: [{ card: "3", label: "none: A, 2, 3" }, { card: "5", label: "二邊: 4, 5" }, { card: "7", label: "三邊: 6, 7, 8" }, { card: "9", label: "四邊: 9, 10" }],
              check: { side: [{ cards: "A 2 3 J Q K", n: 0 }, { cards: "4 5", n: 2 }, { cards: "6 7 8", n: 3 }, { cards: "9 10", n: 4 }] } },
            { say: "A long side peeled: three pips down it. The card is…", peel: [{ card: "8", label: "?" }], quiz: ["A 4 or 5", "A 6, 7 or 8", "A 9 or 10"], answer: 1, why: "三邊, three down the side: a 6, 7 or 8. The middle decides which.", check: { side: [{ cards: "6 7 8", n: 3 }, { cards: "4 5 9 10", not: 3 }] } },
            { say: "Then an end, for the middle. Of the three-pip cards a 6 has nothing in the middle, a 7 one pip nearer one end, an 8 one near each end. Peeled from the foot: the 6 and this 7 show nothing yet, the 8 a pip.", peel: [{ card: "6", edge: "bottom", at: .5, label: "6" }, { card: "7", edge: "bottom", at: .5, label: "7" }, { card: "8", edge: "bottom", at: .5, label: "8" }],
              check: { middle: { cards: "6 7 8", n: "0 1 2", foot: .5, shows: "0 0 1" } } },
            { say: "The Player has 2; the Banker stands on 7. You're on the Player, squeezing its third card, and it's 三邊. What do you want to see?", hands: { player: "K 2", banker: "4 3" }, free: true, quiz: ["A 6 or 7: 8 or 9 wins", "An 8: 10 beats 7", "Any of them: all three win"], answer: 0, why: "2 and 6 make 8, 2 and 7 make 9: both beat 7. An 8 makes 10, which counts nothing. So you peel an end hoping for no pip in the middle near it.", check: { third: { hand: "K 4 2 3", wins: "6 7", loses: "8" } } },
            { say: "And the table shouts at it: 開 (hoi1), open it! 吹 (ceoi1), blow, to blow away the numbers it doesn't want; 頂 (deng2), to hold a bad card back." },
          ],
        },
        {
          id: "money", title: "Money and chips", zh: "籌碼",
          steps: [
            { say: "Macau's casinos play in Hong Kong dollars: the limits, the chips (籌碼, cau4 maa5) and the payouts are all HK$. The pataca (MOP) is Macau's own money, and some casinos have pataca chips, but the tables count in HK$." },
            { say: "A sign says 1,000. That's…", sign: { min: 1000, max: 100000, side: 10000 }, quiz: ["HK$1,000", "1,000 patacas", "1,000 yuan"], answer: 0, why: "Hong Kong dollars: Macau's gaming currency." },
            { say: "Chips come from the cage, the casino's cashier. Reports differ on whether the Venetian's tables take cash, and in which currency, so ask before you sit down. A transaction of MOP500,000 or more is reported to the regulator." },
          ],
        },
        {
          id: "calls", title: "What you'll hear", zh: "術語",
          steps: [
            { say: "Words you'll hear at a Macau table, in Cantonese.", terms: [["買定離手", "maai5 ding6 lei4 sau2", "bets are set, hands off: the old call that closes the betting"], ["例牌", "lai6 paai2", "a natural, 8 or 9 on two cards"], ["補牌", "bou2 paai2", "drawing a third card"], ["莊贏", "zong1 jeng4", "Banker wins"], ["閒贏", "haan4 jeng4", "Player wins"], ["和局", "wo4 guk6", "a tie"], ["開", "hoi1", "open it! (at the squeeze)"]] },
            { say: "The dealer says 閒贏. Who won?", quiz: ["The Banker", "The Player", "Nobody: a tie"], answer: 1, why: "閒 (haan4) is the Player; 贏 (jeng4) is to win. A tie is 和局 (wo4 guk6)." },
            { say: "買定離手: your hand goes…", quiz: ["To your chips, to add a bet", "Away from the layout: bets are closed", "To the cards, to squeeze them"], answer: 1, why: "Literally: bought and settled, leave with your hands. Once the cards come out, nobody touches a bet." },
          ],
        },
        {
          id: "manners", title: "The house's rules", zh: "規矩",
          steps: [
            { say: "Nobody under 21 on the floor, since 2012: staff may ask for proof of age, and the Cotai casinos often check passports at the door. Nor may Macau's public servants or off-duty casino staff play." },
            { say: "No photographs or video on the floor: the Venetian's staff will have you delete them, selfies too. And no phone in use at the table while you bet." },
            { say: "No smoking on the floor, VIP rooms included since 2019: only in the casino's approved smoking lounges. E-cigarettes may not be made, imported or sold in Macau, nor used wherever smoking is banned." },
            { say: "Only the squeezer touches the cards. Never touch anyone else's chips, and leave yours alone once the cards come out. Smart casual dress; staff may ask for hats and sunglasses off. Water, tea and coffee are free." },
            { say: "You'd like a picture of a long dragon on the screen, to show a friend. You…", quiz: ["Take it quickly, without the flash", "Don't: cameras aren't allowed on the floor", "Ask the dealer to take it for you"], answer: 1, why: "Macau's law keeps cameras off the gaming floor unless the casino allows it, and it doesn't." },
          ],
        },
      ],
    },
  ],
};
