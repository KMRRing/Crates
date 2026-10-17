// Craps on one page (the course's map and the menu open it): the dice and how they're thrown, the come-out roll and the
// point, the bets with what they pay and what each keeps for the house, what this table chooses where the rules are
// silent, and the words of the floor, Cantonese with Jyutping.
import { ODDS, LIMITS, POINTS, edgeOf, edgeWithOdds, FIELD } from "./craps-engine.js";
import { hk } from "./casino.js";

export const WORDS = [
  ["花旗骰", "faa1 kei4 sik1", "craps (the rules' name: 花旗骰法定規章, the official craps regulation)"],
  ["派司拉", "paai3 si1 laai1", "the pass line"],
  ["東派司", "dung1 paai3 si1", "don't pass"],
  ["襟 · 東襟", "kam1 · dung1 kam1", "come · don't come"],
  ["附加投注", "fu6 gaa1 tau4 zyu3", "the additional bet behind a line or come bet: the odds"],
  ["出場擲骰", "ceot1 coeng4 zaak6 sik1", "the come-out roll, before the point"],
  ["主客", "zyu2 haak3", "the shooter"],
  ["莊荷", "zong1 ho4", "the croupier; the one who presents the dice is the stickman"],
  ["點數", "dim2 sou3", "the total; the point"],
  ["和局", "wo4 guk6", "a push: the bet stands and nothing is won or lost (bar 12)"],
  ["無效 · 重擲", "mou4 haau6 · cung4 zaak6", "void · throw again"],
];
const pct = x => `${(100 * x).toFixed(2)}%`;
const edge = key => pct(edgeOf(key));

export function rulesHtml() {
  const row = (name, wins, pays, keeps) => `<tr><td>${name}</td><td>${wins}</td><td class="cs-odds">${pays}</td><td class="cs-odds">${keeps}</td></tr>`;
  return `
    <p><b>The dice.</b> Two of them, balanced, opposite faces adding to seven, picked by the shooter (主客) from the four or five the stickman presents. The shooter throws both with one hand to the far wall of the table, past the middle, and they must roll. A throw is void if a die leaves the table, doesn't pass the middle without touching a wall, or doesn't roll (Article 3), and is thrown again. Only a player with at least the minimum on the table may throw, and the shooter changes when they stop betting or the first roll loses all their bets (Article 4); here you are always the shooter. They fall 36 ways: a 7 in 6 of them, a 6 or 8 in 5, a 5 or 9 in 4, a 4 or 10 in 3, a 3 or 11 in 2, a 2 or 12 in 1.</p>
    <p><b>The come-out roll and the point.</b> Before there's a point, the shooter's first roll is the come-out roll (出場擲骰). A 7 or 11 (a natural) wins the pass line and a 2, 3 or 12 (craps) loses it; any other total, 4, 5, 6, 8, 9 or 10, is the point. Now the shooter throws on until the point comes again, which wins the pass line, or a 7, which loses it (a seven out) and brings the next come-out roll. Don't pass is the other side: it wins on a 2 or 3 and loses on a 7 or 11 on the come-out roll, a 12 is a push (bar 12, 和局), and after the point it wins on a 7 and loses on the point.</p>
    <h3>The bets</h3>
    <table class="cs-pays"><thead><tr><th>Bet</th><th>Wins when</th><th>Pays</th><th>Keeps</th></tr></thead><tbody>
      ${row("<b>派司拉</b> Pass line<br><i>paai3 si1 laai1</i>", "a natural on the come-out roll; the point before a 7", "1 to 1", edge("pass"))}
      ${row("<b>東派司</b> Don't pass<br><i>dung1 paai3 si1</i>", "a 2 or 3 on the come-out roll (12 pushes); a 7 before the point", "1 to 1", edge("dont"))}
      ${row("<b>附加投注</b> Odds behind pass<br><i>fu6 gaa1 tau4 zyu3</i>", "the point before a 7, once there is a point", "2 to 1 on 4 or 10 · 3 to 2 on 5 or 9 · 6 to 5 on 6 or 8", "nothing")}
      ${row("Lay behind don't pass", "a 7 before the point", "1 to 2 on 4 or 10 · 2 to 3 on 5 or 9 · 5 to 6 on 6 or 8", "nothing")}
      ${row("<b>襟</b> Come<br><i>kam1</i> · <b>東襟</b> Don't come<br><i>dung1 kam1</i>", "as pass and don't pass, from the next roll once there is a point; then the bet goes to the number thrown and waits there for it (come) or a 7 (don't come), with its own odds behind it", "1 to 1; the odds as behind the lines", `${edge("come")} · ${edge("dcome")}`)}
      ${row("Field", "a 3, 4, 9, 10 or 11 (a 2 or 12 pays double), one roll", "1 to 1, 2 to 1 on a 2 or 12", edge("field"))}
      ${row("Big · Small", "an 8 to 12 · a 2 to 6, one roll (a 7 loses both)", "1 to 1", edge("big"))}
      ${row("Any seven", "a 7, one roll", "4 to 1", edge("seven"))}
      ${row("Any craps", "a 2, 3 or 12, one roll", "7 to 1", edge("craps"))}
      ${row("Eleven · Ace-deuce", "an 11 · a 3, one roll", "15 to 1", edge("eleven"))}
      ${row("Aces · Boxcars", "a 2 (1-1) · a 12 (6-6), one roll", "30 to 1", edge("aces"))}
      ${row("Horn", "a 2, 3, 11 or 12: four bets in one, one roll", "27 to 4 on 2 or 12 · 3 to 1 on 3 or 11", edge("horn"))}
      ${row("Hard way 6 or 8 · 4 or 10", "the number as a pair (3-3, 4-4 · 2-2, 5-5) before a 7 or the number any other way", "9 to 1 · 7 to 1", `${edge("hard6")} · ${edge("hard4")}`)}
      ${row("Big 6 or 8", "the number before a 7 (anything else leaves it standing)", "7 to 6", edge("b6"))}
      ${row("Big 5 or 9 · Big 4 or 10", "the number before a 7", "7 to 5 · 9 to 5", `${edge("b5")} · ${edge("b4")}`)}
    </tbody></table>
    <p class="cs-note">A line bet pays even money, and the house keeps ${edge("pass")} of a pass line bet and ${edge("dont")} of don't pass. The additional bet behind it (附加投注, the odds, after a point) pays what the point is truly worth against a 7: a 4 or 10 has 3 ways to the 7's 6, so 2 to 1; a 5 or 9 has 4, so 3 to 2; a 6 or 8 has 5, so 6 to 5. That makes it a bet the house keeps nothing of, and the only one: every other bet keeps something. Taking the odds does not change what the line keeps, but it puts more money on a fair bet, so what the house keeps of all you stake falls: ${pct(edgeWithOdds(0))} with none, ${pct(edgeWithOdds(1))} with 1 times the line behind it, ${pct(edgeWithOdds(2))} with 2, ${pct(edgeWithOdds(5))} with 5, ${pct(edgeWithOdds(10))} with 10. The other bets are the traps: the one-roll bets keep 11 to 17%, the hard ways 9 to 11%, the field 5.56%; only the Big 6 and 8 (${edge("b6")}) keep about what the line does, and the Big 5 and 9 (${edge("b5")}) and Big 4 and 10 (${edge("b4")}) more.</p>
    <h3>This table's choices</h3>
    <p>The rules say what each bet wins, loses and pays; where they say nothing, this table chooses. <b>Every bet works on every roll</b>, the come-out roll too (the rules don't say any is off then). <b>A bet that is decided comes down</b>, whether it wins or loses; a bet that isn't (a line bet at its point, a come bet on its number, a hard way, a Big bet and what's behind them) stays up for the next roll. Rebet puts back what came down. The odds, the hard ways and the Big bets may be taken down at any time (Clear becomes Take down); a line or come bet may not once the roll is thrown. <b>The odds go up to ${ODDS} times the bet behind them</b> (a lay, to win ${ODDS} times it); the rules name no limit. A pass or don't pass bet goes down before the come-out roll and a come bet once there is a point (Article 5). <b>The field pays 2 to 1 on a 12</b>; the rules let a table pay 3 to 1, which would keep ${pct((20 - 14 - FIELD.two - 3) / 36)} (20 throws lose, 14 win 1, a 2 wins ${FIELD.two}, a 12 wins 3).</p>
    <h3>At the table</h3>
    <p>Here: at least ${hk(LIMITS.min)} on each bet (a first chip below it is raised by the next), in ${hk(50)}s; the Horn in ${hk(100)}s (27 to 4), a Big 6 or 8 in ${hk(300)}s (7 to 6) and a lay in ${hk(100)}s, ${hk(150)}s or ${hk(300)}s on 4 or 10, 5 or 9, 6 or 8 (1 to 2, 2 to 3, 5 to 6), so that every bet pays whole dollars. At most ${hk(LIMITS.line)} on a line or come bet, ${hk(LIMITS.field)} on the field, Small or Big, ${hk(LIMITS.bigN)} on a Big 6, 8, 5, 9, 4 or 10, ${hk(LIMITS.hard)} on a hard way, ${hk(LIMITS.seven)} on Any seven or Any craps, ${hk(LIMITS.eleven)} on Eleven or Ace-deuce, ${hk(LIMITS.aces)} on Aces or Boxcars and ${hk(LIMITS.horn)} on the Horn. The rules set no limits and no table's were found. The rules list no place, buy or lay bets and no C and E, so none is played.</p>
    <h3>The house's rules</h3>
    <p>21 and over. Everything in Hong Kong dollars. The points: ${POINTS.join(", ")}.</p>
    <h3>The words</h3>
    <table class="cs-words"><tbody>${WORDS.map(([zh, jp, en]) => `<tr><td><b>${zh}</b></td><td><i>${jp}</i></td><td>${en}</td></tr>`).join("")}</tbody></table>`;
}
