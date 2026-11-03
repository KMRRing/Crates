// Big Two's 3D table (bigtwo-3d.js): what a seat's plate shows (the fan and count of the cards left, a pass, the points paid or
// won), and that the page offers the choice with the flat table the default.
import { readFileSync } from "node:fs";
import { plateOf } from "../bigtwo-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const base = { name: "Kit", seat: 1, count: 13, score: 0 };

const a = plateOf({ ...base, turn: true });
check(a.fan === 5 && a.state === "on" && a.tally.includes("13") && !a.crown, "a seat on turn shows a fan of five and its count");
check(plateOf({ ...base, mine: true }).fan === 0 && plateOf({ ...base, mine: true }).tally === "", "your own seat has no fan or count");
check(plateOf({ ...base, count: 1 }).tally.includes("low") && plateOf({ ...base, count: 1 }).fan === 1, "one card left is marked low");
const pass = plateOf({ ...base, word: "Pass" });
check(pass.act === "Pass" && pass.pass === true, "a pass is said at the seat and drawn as a pass");
check(plateOf({ ...base, lead: true }).state === "tobeat" && plateOf({ ...base, turn: true, think: true }).state === "on thinking", "the seat holding the trick is marked, and a thinking one thinks");
const w = plateOf({ ...base, won: 12, over: true, count: 0 }), l = plateOf({ ...base, pay: 5, over: true, count: 5 });
check(w.crown && w.act === "Out" && w.meta.includes("+12") && !w.pass, "the winner is crowned, says Out and shows what it took");
check(l.meta.includes("−5") && l.fan === 0 && !l.crown, "a loser shows what it paid and no fan");
check(!plateOf({ ...base, name: "<b>", word: "<i>" }).meta.includes("<b>"), "nothing unescaped lands in the plate's markup");

const page = readFileSync(new URL("../bigtwo.js", import.meta.url), "utf8"), html = readFileSync(new URL("../bigtwo.html", import.meta.url), "utf8");
check(/tableView\("bigtwo"\)/.test(page) && /view\.choice\(/.test(page), "the menu offers View through the shared tableView");
check(/view\.get\(\) === "3d"/.test(page) && /three\.dispose\(\)/.test(page) && /onPause\(.*three/.test(page), "flat unless 3D is chosen; 3D disposed on the way back; paused with the menu");
check(html.includes("table3d.css") && html.includes("bigtwo-3d.css"), "the page links the cloth's stylesheet and its own");
const css = readFileSync(new URL("../bigtwo-3d.css", import.meta.url), "utf8");
check(!/[^\d.]([3-9]|\d\d+)px/.test(css.replace(/\d+px solid/g, "").replace(/\(max-height: \d+px\)/g, "")), "sizes in rem, not px");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
