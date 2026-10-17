// Craps' betting layout, as markup: the page bets on it (a tap on a cell puts the chip there) and the course shows it
// (cells that don't answer a tap). In the order a table lays it out, the bets you make first at the top: the pass line and
// don't pass with the odds behind them, come and don't come, the six numbers where come bets travel (the puck, ON, sits
// on the point), the field, Small and Big, the Big 6, 8, 5, 9, 4 and 10, the hard ways, the one-roll bets. A stake on a
// cell is a badge at its corner; once a roll is paid, the cells it wins are ringed and a bet's badge says what it won or
// lost. A cell the game won't take a chip on now (pass once there's a point, odds before one) is dimmed.
import { POINTS, kindOf, nameOf, paysText, paysShort, whyNot, totalOf } from "./craps-engine.js";
import { dieSvg } from "./casino-dice.js";
import { short } from "./casino.js";

/** The rows of cells, by group: each a list of rows of bet keys (a number's come bet and don't come bet are halves of its box). */
export const GROUPS = {
  line: [["pass", "dont"], ["passo", "donto"]],
  come: [["come", "dcome"]],
  numbers: [POINTS],
  field: [["field"]],
  size: [["small", "big"]],
  bigs: [["b4", "b5", "b6", "b8", "b9", "b10"]],
  hards: [["hard4", "hard6", "hard8", "hard10"]],
  props: [["seven", "craps", "horn"], ["eleven", "acedeuce", "aces", "boxcars"]],
};
export const GROUP_IDS = Object.keys(GROUPS);

const FACES = { eleven: [5, 6], acedeuce: [1, 2], aces: [1, 1], boxcars: [6, 6], hard4: [2, 2], hard6: [3, 3], hard8: [4, 4], hard10: [5, 5] };
const WORDS = {
  pass: ["派司拉", "Pass line", "1:1"], dont: ["東派司", "Don't pass", "bar 12 · 1:1"], come: ["襟", "Come", "1:1"], dcome: ["東襟", "Don't come", "bar 12 · 1:1"],
  passo: ["", "Pass odds", "2:1 · 3:2 · 6:5"], donto: ["", "Lay", "1:2 · 2:3 · 5:6"],
  small: ["", "Small", "2–6 · 1:1"], big: ["", "Big", "8–12 · 1:1"],
  seven: ["", "Any seven", "4:1"], craps: ["", "Any craps", "7:1"], horn: ["", "Horn", "27:4 · 3:1"],
};
/** The faces a cell shows: the dice a one-roll or hard-way bet is on, else none. */
export const facesOf = key => FACES[key] || [];
function inner(key) {
  if (key === "field") return `<span class="en">Field</span><span class="rg">2 3 4 9 10 11 12</span><span class="pay">1:1 · 2 and 12 pay 2:1</span>`;
  const [zh, en, pay] = WORDS[key] || [];
  if (/^b\d/.test(key)) return `<span class="en">Big ${key.slice(1)}</span><span class="pay">${paysShort(key)}</span>`;
  if (/^hard/.test(key) || FACES[key]) return `<span class="dice">${FACES[key].map(f => dieSvg(f, "mini")).join("")}</span><span class="en">${nameOf(key)}</span><span class="pay">${paysShort(key)}</span>`;
  return `${zh ? `<span class="zh">${zh}</span>` : ""}<span class="en">${en}</span><span class="pay">${pay}</span>`;
}
/** What a cell says to someone who can't see it: the bet's name and what it pays. */
export const labelOf = key => `${nameOf(key)}${WORDS[key]?.[0] ? ` (${WORDS[key][0]})` : ""}, pays ${paysText(key)}`;

/**
 * The layout as markup. bets: { key: HK$ } on the table; lit: the bets (and numbers) the roll wins, ringed; results:
 * { key: net } for the bets just settled; point: the point, where the puck sits; groups: which groups to draw (all by
 * default); plain: cells that aren't buttons (the course); placeable(key): whether a chip may go there now (default yes).
 */
export function layoutHtml({ bets = {}, lit = new Set(), results = null, point = null, groups = GROUP_IDS, plain = false, placeable = () => true } = {}) {
  const tag = plain ? "span" : "button", type = plain ? "" : ' type="button"';
  const badge = (stake, net) => (net != null ? `<span class="cr-stake ${net > 0 ? "win" : net < 0 ? "lose" : ""}">${net > 0 ? `+${short(net)}` : net < 0 ? `−${short(-net)}` : "="}</span>` : stake ? `<span class="cr-stake">${short(stake)}</span>` : "");
  const resultOf = (...keys) => (results && keys.some(k => k in results) ? keys.reduce((a, k) => a + (results[k] || 0), 0) : null);
  const cell = key => {
    const stake = bets[key] || 0, net = resultOf(key);
    const cls = ["cr-cell", `k-${kindOf(key)}`, lit.has(key) && "hit", (stake || net != null) && "has", !placeable(key) && "off"].filter(Boolean).join(" ");
    return `<${tag}${type} class="${cls}" data-bet="${key}" title="${labelOf(key)}" aria-label="${labelOf(key)}${stake ? `, HK$${stake} on it` : ""}">${inner(key)}${badge(stake, net)}</${tag}>`;
  };
  // a number's box: the number (the puck on it when it's the point) over the come bet's half and the don't come bet's
  const half = (side, n) => {
    const flat = `${side}${n}`, odds = `${flat}o`, key = odds;
    const stake = bets[flat] || 0, extra = bets[odds] || 0, net = resultOf(flat, odds);
    const cls = ["cr-half", side === "come" ? "come" : "dcome", (stake || extra || net != null) && "has", !placeable(key) && "off"].filter(Boolean).join(" ");
    const chips = net != null ? badge(0, net) : `${stake ? `<span class="cr-st">${short(stake)}</span>` : ""}${extra ? `<span class="cr-st o">+${short(extra)}</span>` : ""}`;
    const label = `${nameOf(flat)}${stake ? `, HK$${stake} on it` : ""}${extra ? `, odds HK$${extra}` : ""}; a tap puts odds behind it, pays ${paysText(odds)}`;
    return `<${tag}${type} class="${cls}" data-bet="${key}" title="${label}" aria-label="${label}"><span class="cr-lbl">${side === "come" ? "come" : "don't"}</span>${chips}</${tag}>`;
  };
  const box = n => `<div class="cr-box${point === n ? " on" : ""}${lit.has(`n${n}`) ? " hit" : ""}" data-n="${n}"><span class="cr-n">${n}${point === n ? `<i class="cr-puck" aria-label="the point">ON</i>` : ""}</span>${half("come", n)}${half("dcome", n)}</div>`;
  const rows = groups.flatMap(id => GROUPS[id].map(row => `<div class="cr-row ${id}" style="--n:${row.length}">${row.map(k => (id === "numbers" ? box(k) : cell(k))).join("")}</div>`));
  return `<div class="cr-grid">${rows.join("")}</div>`;
}

/** The cells a chip may go on now, for the page to dim the rest: whyNot says no for the others. */
export const placeableNow = (bets, point) => key => !whyNot(key, bets, point);

// ---------- the screen over the table ----------
/** A roll's ball on the screen: its total, a seven picked out (it ends the shooter's point). */
export const ballHtml = d => `<span class="cr-ball${totalOf(d) === 7 ? " seven" : ""}" title="${d.join("-")}">${totalOf(d)}</span>`;
/** The screen's last totals, newest first (st: craps-engine's stats). */
export const lastHtml = st => (st.last.length ? st.last.map(ballHtml).join("") : `<span class="cr-none">No rolls yet</span>`);
/** The screen's counts: sevens as a share of the rolls, and the hottest and coldest totals. */
export function statsHtml(st) {
  if (!st.rolls) return `<span>The last hundred rolls are counted here</span>`;
  return `<span><i class="seven">Sevens</i> ${Math.round((100 * st.sevens) / st.rolls)}%</span><span>Hot ${st.hot.slice(0, 3).join(" ")}</span><span>Cold ${st.cold.slice(0, 3).join(" ")}</span>`;
}
/** What the screen says to someone who can't see it. */
export const statsLabel = st => (st.rolls ? `Of the last ${st.rolls} rolls: ${st.sevens} sevens; hottest totals ${st.hot.join(", ")}; coldest ${st.cold.join(", ")}` : "No rolls yet");
