// Dou Dizhu's 3D table (landlord-3d.js): what a seat's plate shows (the crown on the landlord, the fan and count of the others'
// cards, the word it said, the points paid), and that the page offers the choice with the flat table the default.
import { readFileSync } from "node:fs";
import { plateOf } from "../landlord-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const base = { name: "Lao Wang", seat: 1, count: 17, score: 0 };

const a = plateOf({ ...base, role: "landlord", roleWord: "Landlord", turn: true });
check(a.crown && a.state === "on" && a.fan === 5 && a.tally.includes("17") && a.meta.includes("Landlord"), "the landlord is crowned, on turn, with a fan and its count");
check(!plateOf({ ...base, role: "peasant", roleWord: "Peasant" }).crown, "a peasant has no crown");
check(plateOf({ ...base, mine: true }).fan === 0 && plateOf({ ...base, mine: true }).tally === "", "your own seat has no fan or count (your cards are the page's own)");
check(plateOf({ ...base, count: 2 }).fan === 2 && plateOf({ ...base, count: 2 }).tally.includes("low"), "two cards left is marked low and fans as two");
check(plateOf({ ...base, word: "Pass" }).act === "Pass", "a pass is said at the seat");
check(plateOf({ ...base, lead: true }).state === "tobeat" && plateOf({ ...base, think: "thinking", turn: true }).state === "on thinking", "the seat holding the trick is marked, and a thinking one thinks");
const paid = plateOf({ ...base, pay: -6, over: true, count: 3, out: false });
check(paid.meta.includes("−6") && paid.fan === 0, "once paid the loss is shown and the fan goes");
check(plateOf({ ...base, over: true, out: true }).act === "Out", "a seat out of cards says so");
check(/Landlord/.test(plateOf({ ...base, role: "Landlord" }).label) || plateOf({ ...base, role: "landlord" }).label.includes("landlord"), "its label names its side for a screen reader");
check(!plateOf({ ...base, roleWord: "<b>" }).meta.includes("<b>"), "the words are escaped");

const page = readFileSync(new URL("../landlord.js", import.meta.url), "utf8"), html = readFileSync(new URL("../landlord.html", import.meta.url), "utf8");
check(/tableView\("landlord"\)/.test(page) && /view\.choice\(/.test(page), "the menu offers View through the shared tableView");
check(/view\.get\(\) === "3d"/.test(page) && /three\.dispose\(\)/.test(page) && /onPause\(.*three/.test(page), "flat unless 3D is chosen; 3D disposed on the way back; paused with the menu");
check(html.includes("table3d.css") && html.includes("landlord-3d.css"), "the page links the cloth's stylesheet and its own");
const css = readFileSync(new URL("../landlord-3d.css", import.meta.url), "utf8");
check(!/[^\d.]([3-9]|\d\d+)px/.test(css.replace(/\d+px solid/g, "")), "sizes in rem, not px");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
