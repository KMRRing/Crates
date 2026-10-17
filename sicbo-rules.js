// Sic Bo on one page (the course's map and the menu open it): the dice and the cup, the bets with what they pay and what
// each keeps for the house, the triple rule, the rules' bets the layout doesn't carry, how a round runs at the table,
// and the words of the floor, Cantonese with Jyutping.
import { KINDS, LIMITS, UNIT, TOTAL_PAYS, RANGE, edgeOf } from "./sicbo-engine.js";
import { hk } from "./casino.js";

export const WORDS = [
  ["骰寶", "sik1 bou2", "sic bo, 'precious dice' (the rules' name; the floor says 大小)"],
  ["大小", "daai6 siu2", "big, small"],
  ["骰 · 三粒骰", "sik1 · saam1 nap1 sik1", "a die · the three dice"],
  ["骰盅", "sik1 zung1", "the cup the dice are shaken in"],
  ["按鐘", "on3 zung1", "the bell: betting closed"],
  ["開骰", "hoi1 sik1", "the call to open the dice"],
  ["莊荷", "zong1 ho4", "the croupier (the rules' word)"],
  ["通吃", "tung1 hek3", "the house takes all: a triple takes Big and Small"],
  ["圍骰 · 全骰", "wai4 sik1 · cyun4 sik1", "a named triple · any triple"],
  ["三軍", "saam1 gwan1", "a single number"],
  ["點數", "dim2 sou3", "the total"],
  ["長牌 · 短牌", "coeng4 paai4 · dyun2 paai4", "two numbers · a double"],
  ["賠率", "pui4 leot6", "what a bet pays"],
  ["無效", "mou4 haau6", "a void round"],
];
const pct = x => `${(100 * x).toFixed(2)}%`;
const edge = key => pct(edgeOf(key));

export function rulesHtml() {
  const row = (k, covers, pays, keeps) => `<tr><td><b>${KINDS[k].zh}</b> ${KINDS[k].name}<br><i>${KINDS[k].jp}</i></td><td>${covers}</td><td class="cs-odds">${pays}</td><td class="cs-odds">${keeps}</td></tr>`;
  const bigSmall = `<tr><td><b>小 · 大</b> Small · Big<br><i>siu2 · daai6</i></td><td>the total, 4 to 10 · 11 to 17</td><td class="cs-odds">1 to 1</td><td class="cs-odds">${edge("small")}</td></tr>`;
  return `
    <p><b>The dice.</b> Three of them, balanced, opposite faces adding to seven, in a cup: a black base under a glass dome, shaken by a lever or an electronic shaker. They fall 216 ways, and every bet below is a count of those ways. A round is thrown when the croupier has covered the dome, shaken the cup and rung the bell; the croupier lifts the cover and calls what the dice show.</p>
    <h3>The bets</h3>
    <table class="cs-pays"><thead><tr><th>Bet</th><th>Wins when</th><th>Pays</th><th>Keeps</th></tr></thead><tbody>
      ${bigSmall}
      ${row("s", "a die shows the number you chose", "1, 2 or 3 to 1 for one, two or three dice", edge("s1"))}
      ${row("n", "the three dice add up to it, 4 to 17", `${TOTAL_PAYS[4]} on 4 or 17 · ${TOTAL_PAYS[5]} on 5 or 16 · ${TOTAL_PAYS[6]} on 6 or 15 · ${TOTAL_PAYS[7]} on 7 or 14 · ${TOTAL_PAYS[8]} on 8 or 13 · ${TOTAL_PAYS[9]} on 9 to 12`, `${edge("n7")} (7, 14) to ${edge("n5")} (5, 16)`)}
      ${row("t", "all three show the number you chose", `${KINDS.t.pays} to 1`, edge("t1"))}
      ${row("any", "all three show the same number", `${KINDS.any.pays} to 1`, edge("any"))}
      ${row("d", "two or more dice show the number you chose", `${KINDS.d.pays} to 1`, edge("d1"))}
      ${row("c", "both numbers you chose show among the dice", `${KINDS.c.pays} to 1`, edge("c12"))}
    </tbody></table>
    <p class="cs-note">Unlike roulette, where every bet keeps the house the same, each bet here is priced on its own: the house keeps ${edge("small")} on Small and Big, which is why they're the plain choice, and the more a bet pays the more it keeps, up to ${edge("n5")} on a 5 or 16. <b>A triple takes Big and Small</b> (通吃, the rules' Article 7); without it each would win 108 throws of 216 and the house would keep nothing. A total can't be 3 or 18 but as a triple (1-1-1, 6-6-6), so the totals run from 4 to 17; a total wins on a triple that makes it, and so does a single number, a double and any triple. For the totals on 5 or 16 the rules say anything from ${RANGE[5][0]} to ${RANGE[5][1]} to 1, and on 6 or 15 from ${RANGE[6][0]} to ${RANGE[6][1]}; this table pays the least of each (at ${RANGE[5][1]} the 5 or 16 would keep 13.89%, at ${RANGE[6][1]} the 6 or 15 would keep 12.04%).</p>
    <h3>The rules' others</h3>
    <p>The rules list three more bets that no layout seems to carry, so none is played here: a double with a different single (say 4-4-2) at 50 to 1, which keeps ${edge("ds42")}; three different numbers you name, 30 to 1, ${edge("h123")}; and any three of four numbers you name, 7 to 1, ${edge("q1234")}. They list 單 and 雙 as well, an odd or even total at 1 to 1; since Article 7 takes only Big and Small on a triple, as written they'd be a fair coin (an odd total is 108 throws of 216), and a table that carried them would have to say what a triple does to them.</p>
    <h3>At the table</h3>
    <p>Betting opens as the croupier presses the lever three times, or starts the shaker, and closes at the bell with the call to open the dice (開骰). After that nothing is placed or moved. If a die rests on another or leans on one, the round is void (無效) and another is thrown at once. The dome isn't covered again until every winning bet has been paid. Here: at least ${hk(LIMITS.min)} on each bet, in ${hk(UNIT)}s; up to ${hk(LIMITS.even)} on Small or Big, ${hk(LIMITS.single)} on a single number, ${hk(LIMITS.pair)} on two numbers, ${hk(LIMITS.double)} on a double or a total, ${hk(LIMITS.any)} on any triple and ${hk(LIMITS.triple)} on a triple. The rules set no limits; no table's were found.</p>
    <h3>The house's rules</h3>
    <p>21 and over. Everything in Hong Kong dollars.</p>
    <h3>The words</h3>
    <table class="cs-words"><tbody>${WORDS.map(([zh, jp, en]) => `<tr><td><b>${zh}</b></td><td><i>${jp}</i></td><td>${en}</td></tr>`).join("")}</tbody></table>`;
}
