// Hearts' 3D table (hearts-3d.js): what a seat's plate shows (the fan and count of the cards left, the points taken this
// hand, a word, the one that took the trick), and that the page offers the choice with the flat table the default.
import { readFileSync } from "node:fs";
import { plateOf } from "../hearts-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const base = { name: "Mira", seat: 1, count: 13, score: 12 };

const a = plateOf({ ...base, turn: true });
check(a.fan === 5 && a.state === "on" && a.tally.includes("13") && !a.meta.includes(">12<") && a.label.includes("12 points") && !a.crown, "a seat on turn shows a fan of five and its count; its score is the brass plate's (and said to a screen reader)");
check(plateOf({ ...base, mine: true }).fan === 0 && plateOf({ ...base, mine: true }).tally === "", "your own seat has no fan or count");
check(plateOf({ ...base, count: 1 }).tally.includes("low") && plateOf({ ...base, count: 1 }).fan === 1, "one card left is marked low");
check(plateOf({ ...base, taken: 14 }).meta.includes("♥ 14") && !plateOf({ ...base }).meta.includes("♥"), "points taken this hand show at the seat, none when there are none");
check(plateOf({ ...base, word: "Passed" }).act === "Passed" && plateOf({ ...base, win: true }).crown && plateOf({ ...base, win: true }).state === "tobeat", "a word is said at the seat; the one that took the trick is crowned");
check(plateOf({ ...base, turn: true, think: true }).state === "on thinking", "a thinking seat thinks");
check(plateOf({ ...base, count: 0, over: true }).fan === 0, "a hand that's over shows no fan");

const page = readFileSync(new URL("../hearts.js", import.meta.url), "utf8"), html = readFileSync(new URL("../hearts.html", import.meta.url), "utf8");
check(/tableView\("hearts"\)/.test(page) && /view\.choice\(/.test(page), "the menu offers View through the shared tableView");
check(/view\.get\(\) === "3d"/.test(page) && /three\.dispose\(\)/.test(page) && /onPause\(.*three/.test(page), "flat unless 3D is chosen; 3D disposed on the way back; paused with the menu");
check(html.includes("table3d.css") && html.includes("hearts-3d.css"), "the page links the cloth's stylesheet and its own");
check(/voice: \(\) => false/.test(page) && !/SPOKEN_TABLES/.test(page), "the narrator stays silent");
const css = readFileSync(new URL("../hearts-3d.css", import.meta.url), "utf8");
check(!/[^\d.]([3-9]|\d\d+)px/.test(css.replace(/\d+px solid/g, "").replace(/\(max-height: \d+px\)/g, "")), "sizes in rem, not px");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
