// Roulette on one page (the course's map and the menu open it): the wheel, the bets with what they pay and their names
// in the rules, zero, how a spin runs at the table, and the words of the floor, Cantonese with Jyutping.
import { KINDS, LIMITS } from "./roulette-engine.js";
import { hk } from "./casino.js";

export const WORDS = [
  ["輪盤", "leon4 pun4", "roulette, the wheel"],
  ["莊荷 · 荷官", "zong1 ho4 · ho4 gun1", "the croupier (the rules' word · the floor's)"],
  ["珠子 · 擲珠", "zyu1 zi2 · zaak6 zyu1", "the ball · to spin it"],
  ["格", "gaak3", "a pocket"],
  ["標記", "biu1 gei3", "the marker (the dolly) on the winning number"],
  ["籌碼", "cau4 maa5", "chips"],
  ["投注", "tau4 zyu3", "a bet; to bet"],
  ["停止投注", "ting4 zi2 tau4 zyu3", "no more bets"],
  ["買定離手", "maai5 ding6 lei4 sau2", "bets placed, hands off"],
  ["無效", "mou4 haau6", "a void spin"],
  ["紅 · 黑", "hung4 · hak1", "red · black"],
  ["單 · 雙", "daan1 · soeng1", "odd · even"],
  ["小 · 中 · 大", "siu2 · zung1 · daai6", "the dozens (and 小, 大 for 1–18, 19–36)"],
  ["場方", "coeng4 fong1", "the house"],
];

export function rulesHtml() {
  const row = (k, covers) => `<tr><td><b>${KINDS[k].zh}</b> ${KINDS[k].name}<br><i>${KINDS[k].jp}</i></td><td>${covers}</td><td>${KINDS[k].pays} to 1</td></tr>`;
  return `
    <p><b>The wheel.</b> 37 pockets: 1 to 36, red and black by turns, and a green zero, the only wheel Macau's rules allow. The croupier spins the wheel one way and the ball the other; the number is the pocket the ball comes to rest in, called with its colour, and the dolly stands on it. A chip falling into the wheel voids the spin, which is spun again.</p>
    <h3>The bets</h3>
    <table class="cs-pays"><thead><tr><th>Bet</th><th>Covers</th><th>Pays</th></tr></thead><tbody>
      ${row("n", "one number")}${row("s", "two side by side")}${row("t", "a row of three")}${row("c", "four round a corner")}${row("l", "two rows, six")}${row("d", "1–12, 13–24, 25–36")}${row("k", "a line of twelve")}${row("even", "red or black, odd or even, 1–18 or 19–36")}
    </tbody></table>
    <p class="cs-note">Every bet pays 36 over the numbers it covers, less the stake, and keeps the house 1 in 37: 2.70%. Zero takes every bet but a straight one on 0, even money too (no half back), and can only be bet straight up. The rules also allow a nine-number bet at 3 to 1 and two set twelve-number bets at 2 to 1, which no layout seems to carry. Here: at least ${hk(LIMITS.inside)} on the numbers a spin and ${hk(LIMITS.outside)} on each outside bet; up to ${hk(LIMITS.number)} a number (a bet on several numbers takes as many times that), ${hk(LIMITS.dozen)} on a dozen or column, ${hk(LIMITS.even)} on an even-money bet; in HK$50s.</p>
    <h3>At the table</h3>
    <p>Betting opens once the last spin is paid, and closes before the spin (a bell or a timer) or during it, at the call 停止投注; after that nothing is placed or moved. Losing bets are swept first; then winners are paid, columns and dozens first, straight up last. The screen counts what has come; the wheel remembers nothing.</p>
    <h3>The house's rules</h3>
    <p>21 and over. No photographs on the floor, no phone in use at the table. Everything in Hong Kong dollars.</p>
    <h3>The words</h3>
    <table class="cs-words"><tbody>${WORDS.map(([zh, jp, en]) => `<tr><td><b>${zh}</b></td><td><i>${jp}</i></td><td>${en}</td></tr>`).join("")}</tbody></table>`;
}
