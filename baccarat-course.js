// Baccarat's course (Learn, in the header): everything a Macau table shows and says, from nothing, for someone about to
// sit down at one. The game (two hands dealt by rules nobody chooses), the bets and what they pay, the scoreboard's
// roads (how each is drawn, and what the ask buttons say), and the floor (the shoe, the squeeze, chips, the calls,
// manners). Data on the course sheet (course.js), drawn by baccarat-stage.js; tests/baccarat-course.mjs checks every
// card, road and answer against the rules.
//
// A step: { say } words; { say, quiz, answer, why } a choice; with hands, road, layout, sign, tableau or terms for the
// stage to draw (baccarat-stage.js). Every pair of hands shown is one the rules deal, unless it's marked free (the first two
// cards, before any third); answers that rest on the rules carry what the test needs to check them: check: { pays } (a
// payout worked out), { road } (a road's marks, or the ask road's next one).

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
            { say: "Cards count by their pips: an ace 1, two to nine as they are, a ten or a court card (J, Q, K) nothing. A hand counts only the last digit of its total: 7 and 8 make 15, which counts 5.", hands: { player: "7 8", banker: "K 9" } },
            { say: "The Player's 7 and 8 count…", hands: { player: "7 8", banker: "K 9" }, quiz: ["15", "5", "8"], answer: 1, why: "Only the last digit counts: 15 is 5. The Banker's K and 9 is 9, the best a hand can be." },
            { say: "A 6 and a 4 count…", hands: { player: "6 4", banker: "A 2" }, free: true, quiz: ["10", "0", "1"], answer: 1, why: "10 counts 0, the worst a hand can be." },
            { say: "The higher total wins. Equal totals are a tie (和, wo4): a bet on Player or Banker is neither won nor lost, it stays (a push)." },
          ],
        },
        {
          id: "naturals", title: "Naturals", zh: "天牌",
          steps: [
            { say: "Two cards each first: Player, Banker, Player, Banker. If either hand has 8 or 9 on its two cards, that's a natural (天牌, tin1 paai4): nobody draws, and the totals are compared at once.", hands: { player: "8 K", banker: "5 Q" } },
            { say: "Player 8, Banker 5: does the Banker draw a third card?", hands: { player: "8 K", banker: "5 Q" }, quiz: ["Yes, on 5", "No: the Player has a natural"], answer: 1, why: "A natural on either side ends the hand: the Player wins 8 to 5." },
            { say: "A natural 9 beats a natural 8; two equal naturals tie.", hands: { player: "4 4", banker: "9 K" } },
          ],
        },
        {
          id: "player3", title: "The Player's third card", zh: "閒補牌",
          steps: [
            { say: "No natural: the Player goes first. On 0 to 5 it draws a third card; on 6 or 7 it stands. The third card is dealt sideways, so the table can see at a glance whose it is.", hands: { player: "3 2 6", banker: "K 7" } },
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
            { say: "The layout: Player and Banker in the big boxes, the Tie and the pairs above. Player pays 1 to 1. Banker pays 0.95 to 1 at a commission table: the house keeps 5% of a Banker win. A Tie pays 8 to 1.", layout: { table: "commission" } },
            { say: "HK$1,000 on Banker, and Banker wins at a commission table. You get back your HK$1,000 and…", layout: { table: "commission", stakes: { banker: 1000 } }, quiz: ["HK$1,000", "HK$950", "HK$500"], answer: 1, why: "0.95 to 1: HK$950. The dealer pays it with a HK$50 chip in the change.", check: { pays: { spot: "banker", stake: 1000, hand: "2 3 2 3 7 A", table: "commission", net: 950 } } },
            { say: "HK$1,000 on Player, and the hand is a tie. Your HK$1,000…", layout: { table: "commission", stakes: { player: 1000 } }, quiz: ["Is lost", "Stays: a push", "Wins 8 to 1"], answer: 1, why: "A tie returns Player and Banker bets. Only a bet on the Tie wins, 8 to 1.", check: { pays: { spot: "player", stake: 1000, hand: "Q 4 7 3", table: "commission", net: 0 } } },
            { say: "Why does Banker pay less? The Banker's rule, drawing after seeing the Player's card, makes it win a little more often: 45.9% of hands against the Player's 44.6% (9.5% tie). The commission evens that out, and a bit more for the house." },
          ],
        },
        {
          id: "commission", title: "Commission or none", zh: "佣金 · 免佣",
          steps: [
            { say: "Tables come in two kinds, written on the sign: commission (佣金, jung2 gam1) and no commission (免佣, min5 jung2). Without commission the Banker pays 1 to 1, except when it wins with a total of 6: then it pays half.", layout: { table: "nocommission" } },
            { say: "No-commission table, HK$1,000 on Banker, and Banker wins 6 to 2. You win…", layout: { table: "nocommission", stakes: { banker: 1000 } }, hands: { player: "2 2 8", banker: "3 3" }, quiz: ["HK$1,000", "HK$950", "HK$500"], answer: 2, why: "A Banker win with 6 pays half at a no-commission table.", check: { pays: { spot: "banker", stake: 1000, hand: "2 3 2 3 8", table: "nocommission", net: 500 } } },
            { say: "Which is better for you? Commission Banker loses 1.06% of what you stake on average; no-commission Banker 1.46%. Commission is the better bet; no commission is simpler, with no HK$50 change." },
          ],
        },
        {
          id: "pairs", title: "The pairs", zh: "閒對 · 莊對",
          steps: [
            { say: "The Player pair (閒對, haan4 deoi3) and Banker pair (莊對, zong1 deoi3) win if that hand's first two cards are the same rank: two 7s, two kings. They pay 11 to 1, whoever wins the hand.", hands: { player: "7 7", banker: "K Q" }, free: true },
            { say: "A 10 and a king both count nothing. Are they a pair?", hands: { player: "10 K", banker: "4 4" }, free: true, quiz: ["Yes", "No"], answer: 1, why: "A pair is two of the same rank, not the same count. The Banker's two 4s are a pair." },
            { say: "The pairs are side bets: the house keeps about 10% of what's staked on them over time, ten times what it keeps on Banker." },
          ],
        },
        {
          id: "super6", title: "Super 6", zh: "超級六",
          steps: [
            { say: "At a no-commission table there's a side bet on the Banker winning with 6: Super 6, paying 12 to 1. It's the half the Banker bet gives up, sold back as a long shot.", layout: { table: "nocommission" } },
            { say: "Banker wins 6 to 2 and you had HK$500 on Super 6. You win…", layout: { table: "nocommission", stakes: { super6: 500 } }, hands: { player: "2 2 8", banker: "3 3" }, quiz: ["HK$500", "HK$6,000", "Nothing"], answer: 1, why: "12 to 1: HK$6,000.", check: { pays: { spot: "super6", stake: 500, hand: "2 3 2 3 8", table: "nocommission", net: 6000 } } },
          ],
        },
        {
          id: "limits", title: "The limits sign", zh: "限紅",
          steps: [
            { say: "Every table has a sign with its limits (限紅, haan6 hung4): the least and most on Player or Banker, and a lower most on the Tie and pairs. Macau tables are in Hong Kong dollars; patacas are taken at par at the cage but the chips are HK$.", sign: { min: 500, max: 100000, side: 10000 } },
            { say: "This table: can you bet HK$300 on Banker?", sign: { min: 500, max: 100000, side: 10000 }, quiz: ["Yes", "No"], answer: 1, why: "HK$500 is the least on Player or Banker." },
          ],
        },
        {
          id: "edge", title: "What the house keeps", zh: "莊家優勢",
          steps: [
            { say: "On average, of every HK$100 staked: Banker (commission) loses HK$1.06, Player HK$1.24, Tie HK$14.36 at 8 to 1, the pairs about HK$10.36. No system or road changes these: each hand is dealt from the shoe as it is, whatever came before." },
            { say: "The best bet on the layout is…", quiz: ["The Tie: it pays 8 to 1", "Banker at a commission table", "Whichever side the roads favour"], answer: 1, why: "Banker at a commission table gives the house the least: 1.06%. The Tie's 8 to 1 is well short of the 9.5 to 1 its chance would deserve." },
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
          id: "patterns", title: "The patterns people bet", zh: "路型",
          steps: [
            { say: "The names you'll hear: a long dragon (長龍) is a long run of one side; ping-pong (單跳, daan1 tiu3) is B P B P, one each in turn; double jump (雙跳, soeng1 tiu3) is BB PP BB PP.", road: { kind: "big", seq: "B P B P B P B B P P B B P P", w: 12 } },
            { say: "Each hand comes from what's left in the shoe; with eight decks what came before barely changes it. The patterns are how the floor talks, and why the screens are there. Bet them for fun, not for an edge." },
          ],
        },
      ],
    },
  ],
};
