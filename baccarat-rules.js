// Baccarat on one page (the course's map and the menu open it): the game, the bets and what they pay and keep, the
// Banker's chart, the shoe and the squeeze, how to read the screen over the table, the house's rules, and the words the
// floor uses, Cantonese with Jyutping. For a glance at the table, where the course is for learning it.
import { bankerDraws, SPOTS, EDGES, MIN, MAX, SIDE_MAX } from "./baccarat-engine.js";
import { hk } from "./casino.js";

// the words of the floor: [characters, Jyutping, what it means]
export const WORDS = [
  ["莊 · 閒 · 和局", "zong1 · haan4 · wo4 guk6", "Banker (the box, not the house) · Player · a tie"],
  ["莊贏 · 閒贏", "zong1 jeng4 · haan4 jeng4", "Banker wins · Player wins"],
  ["莊對 · 閒對", "zong1 deoi3 · haan4 deoi3", "Banker pair · Player pair (in the rules 莊對子, 閒對子)"],
  ["例牌", "lai6 paai2", "a natural: 8 or 9 on two cards"],
  ["補牌", "bou2 paai2", "drawing a third card"],
  ["公", "gung1", "a court card (J, Q, K), counting nothing"],
  ["佣金 · 免佣", "jung2 gam1 · min5 jung2", "commission · no commission"],
  ["幸運六點", "hang6 wan6 luk6 dim2", "Lucky 6"],
  ["限紅", "haan6 hung4", "the table's limits"],
  ["牌靴 · 白咭 · 銷牌", "paai4 hoe1 · baak6 kaat1 · siu1 paai2", "the shoe · the cut card · the burn"],
  ["買定離手", "maai5 ding6 lei4 sau2", "bets set, hands off: no more bets"],
  ["咪牌 · 持牌", "mi1 paai2 · ci4 paai2", "the squeeze · holding the cards (the rules' word)"],
  ["二邊 · 三邊 · 四邊", "ji6 bin1 · saam1 bin1 · sei3 bin1", "two, three, four pips down a long side: 4–5, 6–8, 9–10"],
  ["開 · 吹 · 頂", "hoi1 · ceoi1 · deng2", "open it! · blow (the bad numbers away) · hold (a bad card) back"],
  ["籌碼", "cau4 maa5", "chips"],
  ["路紙 · 路", "lou6 zi2 · lou6", "the scoreboard · a road"],
  ["大路 · 珠盤路", "daai6 lou6 · zyu1 pun4 lou6", "big road · bead plate"],
  ["大眼仔 · 小路 · 曱甴路", "daai6 ngaan5 zai2 · siu2 lou6 · gaat6 zaat2 lou6", "big eye boy · small road · cockroach road"],
  ["問路", "man6 lou6", "the ask buttons: what the roads would show next"],
  ["長龍", "coeng4 lung4", "a long dragon: a long run of one side"],
  ["單跳 · 雙跳", "daan1 tiu3 · soeng1 tiu3", "ping-pong (B P B P) · double jump (BB PP)"],
];

function chart() {
  const heads = [..."0123456789"];
  const rows = [3, 4, 5, 6].map(bt => `<tr><th>${bt}</th>${heads.map(v => {
    const card = Number(v) === 0 ? 9 * 4 + 3 : (Number(v) - 1) * 4 + 3;
    return `<td class="${bankerDraws(bt, card) ? "d" : "s"}">${bankerDraws(bt, card) ? "D" : "S"}</td>`;
  }).join("")}</tr>`).join("");
  return `<table class="bs-tableau"><thead><tr><th></th>${heads.map(v => `<th>${v}</th>`).join("")}</tr></thead><tbody><tr><th>0–2</th><td colspan="10" class="d">always draws</td></tr>${rows}<tr><th>7</th><td colspan="10" class="s">always stands</td></tr></tbody></table>`;
}

const pct = n => `${n.toFixed(2)}%`;
// the bets as rows: [how it's lettered, the bet, what it pays, what the house keeps]
function bets() {
  const sp = id => SPOTS.find(x => x.id === id);
  const row = (zh, cls, name, pays, ...edges) => `<tr><td>${zh ? `<b${cls ? ` class="${cls}"` : ""}>${zh}</b> ` : ""}${name}</td><td>${pays}</td><td>${edges.map(pct).join(" · ")}</td></tr>`;
  return [
    row("閒", "p", "Player", "1 to 1", EDGES.player),
    row("莊", "b", "Banker, commission (佣金)", "0.95 to 1", EDGES.banker),
    row("莊", "b", "Banker, no commission (免佣)", "1 to 1; half on a win with 6", EDGES.nocommission),
    row("和", "t", "Tie", "8 to 1 (Player and Banker stay)", EDGES.tie),
    row("對", "", "Player pair, Banker pair: a hand's first two cards alike", "11 to 1", EDGES.ppair),
    row("", "", "Pairs+: a pair in either hand", sp("pairsplus").pays, EDGES.pairsplus),
    row("幸運六點", "b", "Lucky 6: the Banker wins with 6", sp("lucky6").pays, EDGES.lucky6),
    row("", "", "Small 6, Big 6: the Banker wins with 6 on two cards, on three", "22 to 1 · 50 to 1", EDGES.small6, EDGES.big6),
    row("", "", "Lucky 7: the Player wins with 7", sp("lucky7").pays, EDGES.lucky7),
    row("", "", "Small 7, Big 7: the Player wins with 7 on two cards, on three", "15 to 1 · 30 to 1", EDGES.small7, EDGES.big7),
    row("", "", "Super Lucky 7: the Player's 7 beats the Banker's 6", sp("superlucky7").pays, EDGES.superlucky7),
    row("", "", "Monkey no Monkey: court cards (J, Q, K) among the first four", sp("monkey").pays, EDGES.monkey),
  ].join("");
}

/** The page, for a table of this kind. */
export function rulesHtml(table = "nocommission") {
  return `
    <p><b>The game.</b> Two hands, the Player (閒) and the Banker (莊), two cards each (Player first), dealt by rules nobody chooses. Cards count: ace 1, two to nine their pips, ten and court cards (公) 0; a hand counts the last digit of its total. Nearer 9 wins; equal is a tie. A natural (例牌: 8 or 9 on two cards, either side) ends the hand.</p>
    <p><b>Third cards.</b> The Player draws on 0–5 and stands on 6–7. If the Player stood, the Banker does the same; if the Player drew, the Banker goes by the chart (its total down the side, the Player's third card across; D draws, S stands). The third card is laid sideways.</p>
    ${chart()}
    <h3>The bets</h3>
    <table class="cs-pays"><thead><tr><th>Bet</th><th>Pays</th><th>House keeps</th></tr></thead><tbody>${bets()}</tbody></table>
    <p class="cs-note">Not every table carries every side bet: the Venetian has had Small and Big 6 since 2024, Pairs+ (in place of the two pairs) and Monkey no Monkey since April 2026. Here: ${table === "commission" ? "a commission table" : "a no-commission table, the main floor's usual kind"}, ${hk(MIN)} to ${hk(MAX)} on Player or Banker, up to ${hk(SIDE_MAX)} on each side bet, in HK$100s. Banker wins 45.9% of hands, Player 44.6%, a tie 9.5%; whatever the roads show, the next hand's odds are the same.</p>
    <h3>The shoe and the squeeze</h3>
    <p><b>The shoe</b> (牌靴), usually eight decks, is cut by a player or the dealer; the white cut card (白咭) goes in at least about twelve cards from the end. The burn (銷牌) takes cards off the top unseen: as many as there are decks, a set number, or what the first card counts, turned up. When the cut card comes out, that hand is the last, or one more is dealt. After a tie a Player or Banker bet may be left, taken back or moved.</p>
    <p><b>The squeeze</b> (咪牌; the rules' 持牌): at a squeeze table each side's cards go face down to its biggest seated bet, who alone touches them, at the table, a third card never with the first two. Peel a long side first: no pips, A–3 or a court card; two down it (二邊) 4–5; three (三邊) 6–8; four (四邊) 9–10. Then an end, for the middle: 6 none, 7 one, 8 two; 9 one, 10 two.</p>
    <h3>The screen</h3>
    <p><b>Bead plate</b> (珠盤路): every hand in order, down columns of six. <b>Big road</b> (大路): a column for each run of one side, red rings Banker, blue Player; a tie is a green slash on the ring before it; dots are pairs (red top left Banker, blue bottom right Player); a run past six rows turns along the foot (the dragon's tail).</p>
    <p><b>Derived roads</b>, small, under it: red where the big road repeats a pattern, blue where it breaks one. The <b>big eye boy</b> (大眼仔, rings) compares each ring with the column before; the <b>small road</b> (小路, dots) with the column two back; the <b>cockroach road</b> (曱甴路, slashes) three back. Down a column: red if that column reaches this row, blue if it stops one short, red if it stops two or more short. A new column: red if the two columns before it are the same length.</p>
    <p><b>Ask buttons</b> (莊問 · 閒問): the marks each derived road would make if the next hand went Banker or Player. A road's two answers are always opposite colours.</p>
    <h3>The house's rules</h3>
    <p>21 and over (proof of age may be asked). No photographs or video on the floor, no phone in use at the table. No smoking but in the approved lounges; no e-cigarettes. Only the squeezer touches the cards; nobody touches a bet once the cards come out. Everything is in Hong Kong dollars.</p>
    <h3>The words</h3>
    <table class="cs-words"><tbody>${WORDS.map(([zh, jp, en]) => `<tr><td><b>${zh}</b></td><td><i>${jp}</i></td><td>${en}</td></tr>`).join("")}</tbody></table>`;
}
