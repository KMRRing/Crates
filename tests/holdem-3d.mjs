// Hold'em's 3D table (holdem-3d.js): what a plate shows for a seat (the fan of backs only for a hand held face down, the state
// classes, the bet and the chips won), the board's five places, the width a card of the board is drawn at, and that the
// page offers the choice, keeps the flat table and the choice local to the device. The drawing is looked at in a browser.
import { readFileSync } from "node:fs";
import { plateOf, boardRow, boardWidth } from "../holdem-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const base = { name: "Mei Ling", seat: 1, stack: 9950 };

const a = plateOf({ ...base, hidden: true, turn: true, button: true, tags: ["SB"], bet: 50, act: "Raise" });
check(a.fan === 2 && a.mark === "D" && a.state === "on" && a.meta.includes("SB") && a.meta.includes("50"), "a seat with two cards down shows a fan of two, the button, its blind and its bet");
check(a.tally.includes("9,950") && !a.crown && !a.pass, "the stack is written with its thousands");
check(plateOf({ ...base, hidden: true, out: true, act: "Fold" }).fan === 0, "a folded seat holds no fan");
check(plateOf({ ...base, hidden: true, out: true, act: "Fold" }).pass === true, "a fold is drawn as a pass");
check(plateOf({ ...base, hidden: true, mine: true }).fan === 0, "your own seat shows no fan (your cards are the page's own, below)");
const shown = plateOf({ ...base, hidden: true, held: "<i>AS</i><i>KD</i>", act: "Pair of aces" });
check(shown.fan === 0 && shown.tally.includes("hd3-held") && shown.tally.includes("AS"), "at a showdown the cards are shown and the fan is not");
const won = plateOf({ ...base, win: true, delta: 450 }), lost = plateOf({ ...base, delta: -100, bet: 100 });
check(won.crown && won.state.includes("tobeat") && won.meta.includes("+450"), "a winner is crowned and shows what it won");
check(lost.meta.includes("−100") && !lost.meta.includes("hd3-bet"), "a loser shows what it lost, and no bet once the hand is paid");
check(plateOf({ ...base, thinking: true, turn: true }).state === "on thinking", "a computer player's turn is ringed and thinks");
check(plateOf({ ...base, out: true, turn: true }).state === "out", "a folded seat is never ringed");
check(/9,950 chips/.test(a.label) && /bet 50/.test(a.label) && /the button/.test(a.label), "its label for a screen reader says its stack, bet and button");
check(!plateOf({ name: "<b>x</b>", seat: 0, tags: ["<i>"] }).meta.includes("<i>"), "a tag is escaped");

const row = boardRow([0, 1, 2, 3, 4], 3, id => `<c${id}>`);
check((row.match(/hd3-slot"/g) || []).length === 3 && (row.match(/hd3-slot empty/g) || []).length === 2, "three cards of a flop and two empty places");
check(boardRow([], 0, () => "").split("empty").length === 6, "before the flop all five places are empty");
check(boardRow([0, 1, 2, 3, 4], 5, id => `<c${id}>`).includes("data-i=\"4\"><c4>"), "the river is the fifth place");

const w = boardWidth({ w: 220, h: 200 });
check(w > 0 && w * 5 + w * 0.14 * 4 <= 220.001, "five cards fit the room across");
check(boardWidth({ w: 2000, h: 2000 }) === 3.4 * 16 && boardWidth({ w: 220, h: 40 }) <= 40 / 1.4 + 0.001, "never wider than 3.4rem, nor taller than the room");
check(boardWidth({ w: 0, h: 0 }) === 0, "no room draws nothing");

// the page: a View choice that keeps the flat table the default, kept on the device, and the table's one stylesheet
const page = readFileSync(new URL("../holdem.js", import.meta.url), "utf8"), html = readFileSync(new URL("../holdem.html", import.meta.url), "utf8");
check(/tableView\("holdem"\)/.test(page) && /view\.choice\(/.test(page), "the menu offers View through the shared tableView");
check(/view\.get\(\) === "3d"/.test(page) && /three\.dispose\(\)/.test(page), "the flat table is drawn unless 3D is chosen, and 3D is disposed on switching back");
check(/onPause\(.*three/.test(page), "the 3D table stands still while a menu is open");
check(html.includes("table3d.css") && html.includes("holdem-3d.css"), "the page links the cloth's stylesheet and its own");
const css = readFileSync(new URL("../holdem-3d.css", import.meta.url), "utf8");
for (const cls of ["hd3-board", "hd3-slot", "hd3-tag", "hd3-delta", "hd3-held", "hd3-bet"]) check(css.includes(`.${cls}`), `a rule for ${cls}`);
check(!/[^\d.]([3-9]|\d\d+)px/.test(css.replace(/\d+px solid/g, "").replace(/\(max-height: \d+px\)/g, "")), "sizes in rem, not px");

if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
