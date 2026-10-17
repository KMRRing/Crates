// Roulette's course (Learn, in the header): what a Macau roulette table shows and says, from nothing. The wheel, the
// bets and what they pay (and why every one of them keeps the house the same), how a spin runs at the table, the screen
// over it, and the words. Macau's rules are the gaming regulator's (the DICJ's Despacho 60/2004); what's said of the
// Venetian and its neighbours comes from the sources README.md names. Data on the course sheet (course.js), drawn by
// roulette-stage.js; tests/roulette-course.mjs checks every answer against the rules.
//
// A step: { say } words; { say, quiz, answer, why } a choice; with wheel, layout, screen or terms for the stage to draw.
// Answers that rest on the rules carry what the test needs to check them: check: { pays: { key, stake, pocket, net } }.

export const COURSE = {
  title: "Learn roulette",
  zh: "輪盤",
  chapters: [
    {
      id: "wheel", title: "The wheel", zh: "輪盤",
      lessons: [
        {
          id: "pockets", title: "37 pockets", zh: "分格",
          steps: [
            { say: "Roulette (輪盤, leon4 pun4) is a wheel of 37 pockets (格, gaak3): the numbers 1 to 36, red and black by turns, and a green zero. Macau's rules allow only this wheel; the American one, with a 00 as well, isn't played here.", wheel: true },
            { say: "The numbers aren't in order round the wheel: 32 sits to zero's right and 26 to its left, and high and low, odd and even, are mixed all the way round, so no stretch of the wheel favours any outside bet.", wheel: { pocket: 0, around: 2 } },
            { say: "How many pockets does a Macau wheel have?", wheel: true, quiz: ["36", "37", "38"], answer: 1, why: "1 to 36 and the zero: 37. A wheel with a 00 too has 38, and isn't allowed in Macau." },
          ],
        },
        {
          id: "spin", title: "A spin", zh: "擲珠",
          steps: [
            { say: "The croupier (莊荷, zong1 ho4, in the rules; 荷官, ho4 gun1, on the floor) spins the wheel one way and the ball (珠子, zyu1 zi2) the other. The number is the pocket where the ball comes to rest. The croupier calls it and its colour aloud and stands the marker, the dolly (標記, biu1 gei3, in the rules), on that number on the layout.", wheel: { pocket: 17 }, layout: { dolly: 17 } },
            { say: "A chip falls into the wheel while the ball is running. What happens?", wheel: true, quiz: ["The number still counts", "The spin is void: the ball is spun again", "Bets on that chip's number win"], answer: 1, why: "The rules: the croupier stops the coup, calls it void (無效, mou4 haau6), puts the ball back in the last winning pocket and spins again." },
          ],
        },
      ],
    },
    {
      id: "bets", title: "The bets", zh: "投注",
      lessons: [
        {
          id: "inside", title: "On the numbers", zh: "孤丁",
          steps: [
            { say: "Chips on the numbers are the inside bets. On one number, straight up (孤丁, gu1 ding1), it pays 35 to 1. On the line between two, a split (兩門騎綫, loeng5 mun4 ke4 sin3), 17 to 1.", layout: { bets: { n17: 100, "s20-23": 100 } } },
            { say: "At the end of a row of three, a street (三門一列, saam1 mun4 jat1 lit6), 11 to 1. On the corner of four, a corner (四門騎綫, sei3 mun4 ke4 sin3), 8 to 1. At the end of the line between two rows, a six line (六門, luk6 mun4), 5 to 1.", layout: { bets: { t1: 100, c26: 100, l31: 100 } } },
            { say: "HK$100 on the split 17–20, and 20 comes up. You win…", layout: { bets: { "s17-20": 100 }, dolly: 20, lit: ["s17-20"] }, quiz: ["HK$800", "HK$1,700", "HK$3,500"], answer: 1, why: "A split pays 17 to 1: HK$1,700, and your HK$100 back with it.", check: { pays: { key: "s17-20", stake: 100, pocket: 20, net: 1700 } } },
            { say: "HK$100 on the corner 25, 26, 28, 29, and 28 comes up. You win…", layout: { bets: { c25: 100 }, dolly: 28, lit: ["c25"] }, quiz: ["HK$500", "HK$800", "HK$1,100"], answer: 1, why: "A corner pays 8 to 1.", check: { pays: { key: "c25", stake: 100, pocket: 28, net: 800 } } },
          ],
        },
        {
          id: "outside", title: "Outside", zh: "紅黑 · 單雙 · 大小",
          steps: [
            { say: "The outside bets, round the edge: a dozen pays 2 to 1, and the rules name them small, middle and big (小, 中, 大: siu2, zung1, daai6), 1–12, 13–24, 25–36. A column (直綫十二門, zik6 sin3 sap6 ji6 mun4), the twelve in a line down the layout, also 2 to 1.", layout: { bets: { d2: 500, k3: 500 } } },
            { say: "Even money: red or black (紅, hung4; 黑, hak1), odd or even (單, daan1; 雙, soeng1), and 1–18 or 19–36, which the rules call small and big again (小, 大). So 小 is 1–12 on the dozens and 1–18 on the halves.", layout: { bets: { red: 500, odd: 500, high: 500 } } },
            { say: "HK$500 on black, HK$500 on the third dozen, and 26 comes up (black). You win…", layout: { bets: { black: 500, d3: 500 }, dolly: 26, lit: ["black", "d3"] }, quiz: ["HK$500", "HK$1,000", "HK$1,500"], answer: 2, why: "Black pays 500, the dozen 2 to 1, 1,000: HK$1,500 in all.", check: { pays: { key: "d3", stake: 500, pocket: 26, net: 1000 } } },
          ],
        },
        {
          id: "zero", title: "Zero", zh: "開出0號",
          steps: [
            { say: "When zero comes up (開出0號, hoi1 ceot1 ling4 hou6), the rules are short: bets straight up on 0 win, and every other bet loses to the house. Even money too: Macau gives no half back on zero (la partage, as some European casinos do).", layout: { dolly: 0 } },
            { say: "And zero can only be bet straight up: the rules list no split, trio or first four with it, so the layout takes none.", layout: { bets: { n0: 100 } } },
            { say: "HK$500 on red, and the ball lands on 0. You…", layout: { bets: { red: 500 }, dolly: 0 }, quiz: ["Get half back", "Lose it", "Keep it for the next spin"], answer: 1, why: "Zero takes everything but a straight bet on 0.", check: { pays: { key: "red", stake: 500, pocket: 0, net: -500 } } },
          ],
        },
        {
          id: "edge", title: "What the house keeps", zh: "場方",
          steps: [
            { say: "Every bet pays as if the wheel had 36 pockets: a bet on n numbers pays 36 divided by n, less the stake. The 37th pocket, the zero, is the house's (場方, coeng4 fong1). So every bet, a straight up or red, keeps the house the same 1 in 37: HK$2.70 of every HK$100 staked." },
            { say: "Which bet keeps the house least?", quiz: ["Straight up: it pays 35 to 1", "Red: it wins nearly half the time", "They keep the same"], answer: 2, why: "All of them keep 2.70%: the pay is cut in proportion to the chance. Bigger odds only mean wilder swings." },
            { say: "Roulette is a small game in Macau: in 2023 it took under half a per cent of what the casinos won, baccarat 85%. Expect a handful of tables, at higher minimums than the electronic seats." },
          ],
        },
      ],
    },
    {
      id: "table", title: "At the table", zh: "賭枱",
      lessons: [
        {
          id: "close", title: "No more bets", zh: "停止投注",
          steps: [
            { say: "Betting opens once the last spin is fully paid. The rules let a table close it one of two ways: before the ball is spun (the croupier presses a bell, 按鐘, on3 zung1, or a timer runs out), or while it runs, until the croupier calls no more bets (停止投注, ting4 zi2 tau4 zyu3). On the floor you'll also hear 買定離手 (maai5 ding6 lei4 sau2): bets placed, hands off.", terms: [["停止投注", "ting4 zi2 tau4 zyu3", "no more bets (the rules' call)"], ["買定離手", "maai5 ding6 lei4 sau2", "bets placed, hands off"], ["按鐘", "on3 zung1", "the bell: betting closed"]] },
            { say: "After the call, may you move a chip from red to black?", quiz: ["Yes, before the ball drops", "No: nothing may be placed or changed", "Only if the croupier says so"], answer: 1, why: "After either cut-off nothing goes down and nothing moves." },
          ],
        },
        {
          id: "payout", title: "The pay-out", zh: "派彩",
          steps: [
            { say: "With the dolly on the number, the losing bets are swept away first. Then the winners are paid in the rules' order: the columns and dozens, the even-money bets, the six lines, the corners, the streets, the splits, and straight up last. Leave your chips alone until the dolly comes off.", layout: { bets: { n17: 100, "s16-17": 100, red: 500, d2: 500 }, dolly: 17, lit: ["n17", "s16-17", "d2"] } },
            { say: "17 has come up. Which of your bets is paid last?", layout: { bets: { n17: 100, "s16-17": 100, d2: 500 }, dolly: 17, lit: ["n17", "s16-17", "d2"] }, quiz: ["The second dozen", "The split 16–17", "17 straight up"], answer: 2, why: "Straight up is paid last; the dozen first." },
          ],
        },
        {
          id: "screen", title: "The screen", zh: "顯示屏",
          steps: [
            { say: "Over a Macau table, a screen shows the numbers that have come, newest first, and counts of the last hundred: red and black, odd and even, the hottest numbers and the coldest (those longest away).", screen: "4 21 2 32 0 17 23 36 11 30 8 23 10 5 24 16 33 1 20 14 31 9 22 18 29 7 28 12 35 3 26 17 17 32" },
            { say: "17 has come three times in the last few spins. On the next spin it is…", screen: "4 21 2 32 0 17 23 36 11 30 8 23 10 5 24 16 33 1 20 14 31 9 22 18 29 7 28 12 35 3 26 17 17 32", quiz: ["More likely: it's hot", "Less likely: it's due a rest", "As likely as any other: 1 in 37"], answer: 2, why: "The wheel keeps no memory. The screen tells you what happened, never what's next." },
          ],
        },
        {
          id: "elsewhere", title: "Screens and machines", zh: "直播",
          steps: [
            { say: "Beyond the tables: rows of seats with their own screens, betting on a live croupier's wheel or an automatic one (the Venetian has had such stadiums since 2011), at minimums well below the tables'. They pay as the table does. Sands China planned an automatic Free Fall Roulette, the ball dropped from above the wheel, for Golden Week 2026." },
          ],
        },
      ],
    },
  ],
};
