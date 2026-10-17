// Sic Bo's betting layout, as markup: the page bets on it (a tap on a cell puts the chip there) and the course shows it
// (cells that don't answer a tap). The 50 bets in the order a Macau table lays them out, nearest the dealer first:
// Small, Any triple and Big across the head; the six triples (圍骰) and the six doubles (短牌); the totals, 4 to 10 under
// Small and 11 to 17 under Big; the fifteen pairs of numbers (長牌); and the six single numbers (三軍) at the foot, nearest
// the player. Each cell has its dice and what it pays; a stake on it is a badge at its corner, and once a round is paid,
// the cells the dice win are ringed and a bet's badge says what it won or lost.
import { TOTALS, PAIRS, DOUBLES, TRIPLES, SINGLES, kindOf, nameOf, paysShort, paysText, KINDS, totalOf, sizeOf } from "./sicbo-engine.js";
import { dieSvg } from "./casino-dice.js";
import { short } from "./casino.js";

/** The rows of cells, by group: each a list of rows of bet keys. */
export const GROUPS = {
  main: [["small", "any", "big"]],
  triples: [TRIPLES],
  doubles: [DOUBLES],
  totals: [TOTALS.slice(0, 7), TOTALS.slice(7)],
  pairs: [PAIRS.slice(0, 5), PAIRS.slice(5, 10), PAIRS.slice(10)],
  singles: [SINGLES],
};
export const GROUP_IDS = Object.keys(GROUPS);

/** The faces a cell shows: a triple's three, a double's two, a pair's two, a single's one. */
export function facesOf(key) {
  const kind = kindOf(key), a = Number(key.slice(1));
  if (kind === "t") return [a, a, a];
  if (kind === "d") return [a, a];
  if (kind === "c") return [Number(key[1]), Number(key[2])];
  if (kind === "s") return [a];
  return [];
}
function inner(key) {
  const kind = kindOf(key), pay = paysShort(key);
  if (kind === "small") return `<span class="zh">小</span><span class="en">Small</span><span class="pay">4–10 · ${pay}</span>`;
  if (kind === "big") return `<span class="zh">大</span><span class="en">Big</span><span class="pay">11–17 · ${pay}</span>`;
  if (kind === "any") return `<span class="zh">全骰</span><span class="en">Any triple</span><span class="pay">${pay}</span>`;
  if (kind === "n") return `<b class="num">${key.slice(1)}</b><span class="pay">${pay}</span>`;
  return `<span class="dice">${facesOf(key).map(f => dieSvg(f, "mini")).join("")}</span><span class="pay">${pay}</span>`;
}
/** What a cell says to someone who can't see it: the bet's name and what it pays. */
export const labelOf = key => `${nameOf(key)}${KINDS[kindOf(key)].zh ? ` (${KINDS[kindOf(key)].zh})` : ""}, pays ${paysText(key)}`;

/**
 * The layout as markup. bets: { key: HK$ } on the table; lit: the bets the dice win (ringed); results: { key: net } for
 * the bets just settled (a badge of what each won or lost, where the stake was); groups: which groups to draw (all by
 * default); plain: cells that aren't buttons (the course).
 */
export function layoutHtml({ bets = {}, lit = new Set(), results = null, groups = GROUP_IDS, plain = false } = {}) {
  const tag = plain ? "span" : "button", type = plain ? "" : ' type="button"';
  const cell = key => {
    const stake = bets[key] || 0, net = results && key in results ? results[key] : null;
    const badge = net != null ? `<span class="sb-stake ${net > 0 ? "win" : "lose"}">${net > 0 ? `+${short(net)}` : `−${short(-net)}`}</span>` : stake ? `<span class="sb-stake">${short(stake)}</span>` : "";
    const cls = ["sb-cell", `k-${kindOf(key)}`, lit.has(key) && "hit", (stake || net != null) && "has"].filter(Boolean).join(" ");
    return `<${tag}${type} class="${cls}" data-bet="${key}" title="${labelOf(key)}" aria-label="${labelOf(key)}${stake ? `, HK$${stake} on it` : ""}">${inner(key)}${badge}</${tag}>`;
  };
  const rows = groups.flatMap(id => GROUPS[id].map(row => `<div class="sb-row ${id}" style="--n:${row.length}">${row.map(cell).join("")}</div>`));
  return `<div class="sb-grid">${rows.join("")}</div>`;
}

// ---------- the screen over the table ----------
/** A round's ball on the screen: its total, coloured for Big, Small or a triple. */
export const ballHtml = d => `<span class="sb-ball ${sizeOf(d)}" title="${d.join("-")}">${totalOf(d)}</span>`;
/** The screen's last totals, newest first (st: sicbo-engine's stats). */
export const lastHtml = st => (st.last.length ? st.last.map(ballHtml).join("") : `<span class="sb-none">No rounds yet</span>`);
/** The screen's counts: Big, Small and triples as shares of the rounds counted, and the hottest and coldest totals. */
export function statsHtml(st) {
  if (!st.rounds) return `<span>The last hundred rounds are counted here</span>`;
  const pct = n => `${Math.round((100 * n) / st.rounds)}%`;
  return `<span><i class="big">Big</i> ${pct(st.big)}</span><span><i class="small">Small</i> ${pct(st.small)}</span><span><i class="triple">Triple</i> ${pct(st.triple)}</span><span>Hot ${st.hot.slice(0, 3).join(" ")}</span><span>Cold ${st.cold.slice(0, 3).join(" ")}</span>`;
}
/** What the screen says to someone who can't see it. */
export const statsLabel = st => (st.rounds ? `Of the last ${st.rounds}: big ${st.big}, small ${st.small}, triples ${st.triple}; hottest totals ${st.hot.join(", ")}; coldest ${st.cold.join(", ")}` : "No rounds yet");
