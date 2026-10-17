// Blackjack on one page (the menu and the course's map open it), the words the felt prints, and basic strategy's chart
// as a table (the course's stage draws it too). The rules are the engine's (blackjack-engine.js), the chart the
// strategy's (blackjack-strategy.js), worked out for them; the Chinese is the DICJ's, from the rules for the game.
import { RULES, MIN, MAX, SIDE, strategyFor } from "./blackjack-engine.js";

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const hk = n => `HK$${n.toLocaleString("en-GB")}`;
const WORD = { 1: "one", 2: "two", 4: "four", 5: "five", 6: "six", 8: "eight" }, inWords = n => WORD[n] || String(n);

/** The rules as the felt prints them, in two arcs: what a blackjack pays, then the dealer's rule and insurance. */
export function feltWords(rules) {
  return [`BLACKJACK PAYS ${rules.bjPays === 1.5 ? "3 TO 2" : "6 TO 5"}`, `DEALER ${rules.s17 ? "MUST STAND ON ALL 17s" : "HITS SOFT 17"} · INSURANCE PAYS 2 TO 1`];
}

// ---------- the chart ----------
const UPS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 1];
const ROWS = { hard: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17], soft: [13, 14, 15, 16, 17, 18, 19, 20], pairs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
const rowName = (kind, n) => (kind === "soft" ? `A,${n - 11}` : kind === "pairs" ? (n === 1 ? "A,A" : n === 10 ? "T,T" : `${n},${n}`) : n === 8 ? "5–8" : n === 17 ? "17+" : `${n}`);
export const KEY = { H: "hit", S: "stand", D: "double, else hit", Ds: "double, else stand", P: "split", R: "surrender, else hit", Rs: "surrender, else stand", Rp: "surrender, else split" };
const CAPTION = { hard: "Hard totals", soft: "Soft totals", pairs: "Pairs" };
/**
 * Basic strategy's chart for these rules: a row a hand, a column the dealer's up card, each cell its play, coloured by
 * it, and a key to the plays it uses. `c` is "hard", "soft" or "pairs", or { kind, row, up } to pick out one cell.
 */
export function chartHtml(c, rules = RULES) {
  const kind = typeof c === "string" ? c : c.kind, pick = typeof c === "object" ? c : null, chart = strategyFor(rules)[kind], used = new Set();
  const head = `<tr><th></th>${UPS.map(u => `<th class="${pick && pick.up === u ? "on" : ""}">${u === 1 ? "A" : u === 10 ? "T" : u}</th>`).join("")}</tr>`;
  const body = ROWS[kind].map(n => `<tr class="${pick && pick.row === n ? "on" : ""}"><th>${rowName(kind, n)}</th>${UPS.map(u => {
    const cell = chart[`${n},${u}`] || "S";
    used.add(cell);
    return `<td class="p-${cell}${pick && pick.row === n && pick.up === u ? " here" : ""}">${cell}</td>`;
  }).join("")}</tr>`).join("");
  const key = Object.keys(KEY).filter(k => used.has(k)).map(k => `<span><i class="p-${k}">${k}</i> ${KEY[k]}</span>`).join(" ");
  return `<table class="bjs-chart"><caption>${CAPTION[kind]} · the dealer's card →</caption><thead>${head}</thead><tbody>${body}</tbody></table><p class="bjs-key">${key}</p>`;
}

// ---------- the words ----------
/** The words of the game as the DICJ's rules write them: characters, Cantonese Jyutping, English. */
export const WORDS = [
  ["二十一點", "ji6 sap6 jat1 dim2", "blackjack, the game"],
  ["莊家", "zong1 gaa1", "the dealer"],
  ["門", "mun4", "a box: a place to bet, and the hand dealt to it"],
  ["博牌", "bok3 paai4", "hit: take a card"],
  ["不博牌", "bat1 bok3 paai4", "stand"],
  ["加注", "gaa1 zyu3", "double"],
  ["分門", "fan1 mun4", "split"],
  ["放棄牌局", "fong3 hei3 paai4 guk6", "surrender"],
  ["保險", "bou2 him2", "insurance"],
  ["和局", "wo4 guk6", "a push: a tie, the bet back"],
  ["開牌", "hoi1 paai4", "show the cards: what a hand over 21 must do at once"],
  ["軟牌十七點", "jyun5 paai4 sap6 cat1 dim2", "soft 17"],
  ["倍半", "pui5 bun3", "one and a half times: what a blackjack pays"],
  ["底牌", "dai2 paai4", "the hole card"],
  ["自動洗派牌機", "zi6 dung6 sai2 paai3 paai4 gei1", "the shuffler that deals"],
  ["牌靴", "paai4 hoe1", "the shoe"],
  ["白咭", "baak6 kaat1", "the cut card"],
  ["同門搭注", "tung4 mun4 daap3 zyu3", "betting on another's box"],
  ["13以上 · 13以下", "sap6 saam1 ji5 soeng6 · ji5 haa6", "over 13 · under 13"],
];

/** The rules on one page, for the table's rules. */
export function rulesHtml(rules = RULES) {
  const edge = strategyFor(rules).edge, macau = strategyFor({ ...rules, doubleOn11Lost: false }).edge, pc = x => `${(x * 100).toFixed(2)}%`;
  const plays = [
    ["Hit", "博牌", "Take a card, as many as you like until you stand or go over 21."],
    ["Stand", "不博牌", "Take no more."],
    ["Double", "加注", "Your first two cards, any total, after a split too: as much again on the bet, and one card only."],
    ["Split", "分門", `Two cards of one rank (a jack and a queen aren't a pair): each the first card of a hand, the same bet on each, up to ${rules.maxHands} hands. Split aces take one card each; an ace and a ten after a split is 21, not a blackjack.`],
    ["Surrender", "放棄牌局", "Your first two cards, before anything else, against a 2 to a 10 (never an ace): half the bet back, the hand given up."],
    ["Insurance", "保險", "When the dealer shows an ace: half your bet more (the rules let it be up to all of it), paid 2 to 1 if the dealer's next card makes blackjack."],
  ];
  return `<p><b>The game.</b> Get nearer 21 than the dealer without going over. Cards count their pips, a ten or a court card 10, an ace 1 or 11; a hand with an ace counting 11 is soft (A,6 is soft 17), one without hard. An ace and a ten-value card as your first two is a blackjack. Played by the chart below, the house keeps ${pc(edge)} of what you bet.</p>
  <h3>A round</h3>
  <p>Bets go down (a side bet too, before the first card), then a card to each box, one face up to the dealer, a second to each box. The boxes play in turn, the dealer calling each one's total aloud. The dealer's second card comes only then (there's no hole card), and the dealer ${rules.s17 ? "draws to 16 and stands on every 17, soft 17 too" : "draws to 16 and to soft 17, standing on hard 17"}; no choices. ${rules.continuous ? `The cards then go back into a continuous shuffler: every round is dealt from all ${inWords(rules.decks)} decks.` : `${inWords(rules.decks)} decks in a shoe, changed once the cut card comes out.`}</p>
  <h3>What it pays</h3>
  <table class="cs-pays"><thead><tr><th>Bet</th><th>Pays</th><th></th></tr></thead><tbody>
    <tr><td>A hand nearer 21</td><td class="cs-odds">1 to 1</td><td>The dealer busting, every hand still in.</td></tr>
    <tr><td>Blackjack</td><td class="cs-odds">3 to 2</td><td>倍半, pui5 bun3. A push against the dealer's blackjack.</td></tr>
    <tr><td>Insurance</td><td class="cs-odds">2 to 1</td><td>Against an ace. It loses ${pc(0.068)} or more: never take it, nor even money with a blackjack.</td></tr>
    <tr><td>Over/Under 13</td><td class="cs-odds">1 to 1</td><td>Your first two cards, an ace one; 13 loses either. Over keeps the house 6.55%, Under 10.07%.</td></tr>
  </tbody></table>
  <h3>Your plays</h3>
  <table class="cs-pays"><tbody>${plays.map(([name, zh, what]) => `<tr><td><b>${name}</b><br>${zh}</td><td>${esc(what)}</td></tr>`).join("")}</tbody></table>
  <p class="cs-note">Say it, or show it: tap the felt to hit, wave a flat hand over your cards to stand, chips beside your bet to double or split.</p>
  <h3>The dealer's blackjack</h3>
  <p>With no hole card, a dealer's blackjack shows only after everyone has played. Macau's rules let it take your original bet only: what you put out to split comes back${rules.doubleOn11Lost ? ", and so does a double, but for a double on 11: Sands China's tables, the Venetian's among them, keep that whole. So there 11 against a ten is hit, not doubled" : ", and so does a double"}.${rules.doubleOn11Lost ? ` (Where a double on 11 comes back too, as at most of Macau's casinos, the edge is ${pc(macau)}.)` : ""}</p>
  <h3>The chart</h3>
  <p class="cs-note">The play that loses least on average for every hand against every up card, worked out for this table's rules. Pairs first, then the total.</p>
  ${chartHtml("hard", rules)}${chartHtml("soft", rules)}${chartHtml("pairs", rules)}
  <h3>At the table</h3>
  <p>Bets from ${hk(MIN)} to ${hk(MAX)} a box (HK$300 was the Venetian's minimum in 2026, HK$500 to HK$1,000 in its busiest weeks); Over/Under 13 from ${hk(SIDE.min)} to ${hk(SIDE.max)} here. You may bet more than one box, and up to three may bet on one (同門搭注): the seated player decides how it's played, or at some tables the biggest bet. The rules also allow other side bets (any pair, the 7s, a streak of wins), half the bet paid for five cards that haven't gone over 21 against anything but an ace, and three times it for a suited 6, 7, 8 or three 7s: each casino chooses, so look at the felt.</p>
  <h3>The house's rules</h3>
  <p>21 and over on the floor. No phone at the table, no photographs. Once the cards are coming out, leave your bet alone.</p>
  <h3>Words</h3>
  <table class="cs-words"><tbody>${WORDS.map(([zh, jp, en]) => `<tr><td>${zh}</td><td><i>${jp}</i><br>${esc(en)}</td></tr>`).join("")}</tbody></table>`;
}
