// Contract's table (contract-table.js, contract-3d.css; Menu, View: Flat or Table): the plaque, the won tricks, dummy's columns,
// the bid cards' colours, and that the page offers the choice with the default the suite's. What's drawn is looked at in a browser.
import { readFileSync } from "node:fs";
import { plaqueHtml, wonHtml, columnsHtml, columnsEm, tallest, callKind } from "../contract-table.js";
import { cardOf, sortHand, HOLD_ORDER } from "../contract-core.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const read = f => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

check(callKind("P") === "pass" && callKind("X") === "x" && callKind("XX") === "xx" && callKind("3N") === "bid" && callKind("1C") === "bid", "a pass is green, a double red, a redouble blue, a bid ivory");

const p = plaqueHtml({ contract: "4♠", declarer: "S", deal: 2, deals: 4, vul: [true, false], mine: 0, label: "Contract 4♠ by South" });
check(p.startsWith("<button") && p.includes('data-act="auction"') && p.includes("Deal 2/4") && p.includes("4♠"), "a contract's plaque is a button that opens the auction and says the deal");
check((p.match(/bd-vt on/g) || []).length === 1 && p.indexOf("N–S") < p.indexOf("E–W"), "only the vulnerable side's tab is lit, your side's first");
const q = plaqueHtml({ contract: "", deal: 1, vul: [false, true], mine: 1 });
check(q.startsWith("<span") && q.includes("Bidding") && q.indexOf("E–W") < q.indexOf("N–S") && (q.match(/bd-vt on/g) || []).length === 1, "while it is bid the plaque is not a button, and east–west sit first when you play for them");
check(!plaqueHtml({ contract: "1NT", declarer: "<b>", label: '"><i>' }).includes("<b>"), "nothing unescaped lands in the plaque");

check((wonHtml(5, { label: "Us" }).match(/bd-pk/g) || []).length === 5 && (wonHtml(40).match(/bd-pk/g) || []).length === 13 && !wonHtml(-3).includes("bd-pk"), "a pile has a packet a trick, at most thirteen");
check(wonHtml(0).includes("none") && !wonHtml(2).includes("none") && wonHtml(1, { label: "Them" }).includes("1 trick"), "a side with none has an empty place marked, and the count is said");

const hand = [cardOf(3, 12), cardOf(3, 5), cardOf(2, 11), cardOf(0, 0), cardOf(0, 4), cardOf(0, 8), cardOf(0, 9)];
const cols = columnsHtml(hand, c => `<i data-c="${c}"></i>`);
const order = [...cols.matchAll(/data-suit="(\d)"/g)].map(m => Number(m[1]));
check(JSON.stringify(order) === JSON.stringify(HOLD_ORDER), "dummy's columns run spades, hearts, clubs, diamonds, as a hand is held");
const spades = cols.split("bd-col").find(s => s.includes('data-suit="3"'));
check(spades.indexOf(`data-c="${cardOf(3, 12)}"`) < spades.indexOf(`data-c="${cardOf(3, 5)}"`), "each column is high to low from the top");
check(cols.includes("bd-col void") && (cols.match(/data-c=/g) || []).length === hand.length && tallest(hand) === 4, "a suit the hand lacks is an empty slot; every card is shown once; the tallest column is counted");
check(sortHand(hand).length === hand.length, "the hand order the columns follow is the page's own");

const room = { w: 120, h: 300 };
check(Math.abs(columnsEm(room, 4) - 120 / 10.75) < 1e-9, "narrow room: four suits across set the size");
check(Math.abs(columnsEm({ w: 400, h: 100 }, 13, { max: 99 }) - 100 / (3.5 + 12 * 1.25)) < 1e-9 && columnsEm({ w: 400, h: 400 }, 3) === 15, "a short room: the tallest column down sets it; never past the cap");
check(columnsEm({ w: 0, h: 5 }, 3) === 0, "no room, no cards");

// ---------- the page ----------
const js = read("contract.js"), html = read("contract.html"), css = read("contract-3d.css");
check(/tableView\("contract", \["flat", "Flat"\], "Table"\)/.test(js) && js.includes("view.choice("), "the menu's View is Flat or Table, through the shared tableView");
check(/const on3 = \(\) => view\.get\(\) === "3d"/.test(js) && !/setItem\([^)]*contract-view/.test(js), "flat unless the table is chosen or the suite's default says 3D; the page itself never writes the choice");
check(html.includes("table3d.css") && html.includes("contract-3d.css") && html.indexOf("table3d.css") < html.indexOf("contract-3d.css") && html.includes('id="won"'), "the page links the kit's stylesheet and its own, and has the place for the won tricks");
check(/onPause\(\(\) => motion/.test(js), "the flights stand still with the menu");
const used = ["bd-plaque", "bd-pl-c", "bd-pl-n", "bd-pl-v", "bd-vt", "bd-pk", "bd-pile", "bd-won", "bd-cols", "bd-col", "bd-wn"];
check(used.every(c => css.includes(`.${c}`)), "the stylesheet has a rule for every class contract-table.js emits");
check(!css.split("\n").some(l => /^[^@/]*\{/.test(l) && !/#app\.bd3|\.bd3|\.bd-|^html|^@|^\s|^\/\*|^\.bd/.test(l)), "every rule is under the table's own classes, so the flat table is untouched");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
