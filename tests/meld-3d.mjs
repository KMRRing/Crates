// Gin rummy's 3D table (meld-3d.js): the plates (the other's fan, count and score; yours without a fan) and that the page offers the
// choice with the flat table the default.
import { readFileSync } from "node:fs";
import { plateOf, myPlate } from "../meld-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const a = plateOf({ name: "Rowan", seat: 1, count: 10, score: 25, turn: true });
check(a.fan === 5 && a.tally.includes("10") && !a.meta.includes("25") && a.label.includes("25 points") && a.state === "on thinking", "the other player shows a fan of five, its ten cards and that it's thinking (its score is the brass plate's)");
check(plateOf({ name: "Rowan", seat: 1, count: 3 }).fan === 3, "three cards fan as three");
const o = plateOf({ name: "Rowan", seat: 1, count: 10, over: true });
check(o.fan === 0 && o.tally === "", "once the hand is over the cards come out of the fan");
const me = myPlate({ seat: 0, score: 40, turn: true });
check(me.name === "You" && me.fan === 0 && me.state === "on" && !me.meta && me.label.includes("40"), "your plate has your name and no fan (the score is the brass plate's)");

const page = readFileSync(new URL("../meld.js", import.meta.url), "utf8"), html = readFileSync(new URL("../meld.html", import.meta.url), "utf8");
check(/tableView\("meld"\)/.test(page) && /view\.choice\(/.test(page), "the menu offers View through the shared tableView");
check(/view\.get\(\) === "3d"/.test(page) && /three\.dispose\(\)/.test(page) && /onPause\(.*three/.test(page), "flat unless 3D is chosen; 3D disposed on the way back; paused with the menu");
check(html.includes("table3d.css") && html.includes("meld-3d.css"), "the page links the cloth's stylesheet and its own");
const css = readFileSync(new URL("../meld-3d.css", import.meta.url), "utf8");
check(!/[^\d.]([3-9]|\d\d+)px/.test(css.replace(/\d+px solid/g, "").replace(/\((max|min)-(height|width): \d+px\)/g, "")), "sizes in rem, not px (a query's px are a screen's)");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
