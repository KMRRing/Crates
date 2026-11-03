// Liar's dice's 3D table (boast-3d.js): what a player's plate shows (the cups, the last bid or the word it called with, the dice once
// the cups are lifted, whose turn), and that the page offers the choice with the flat table the default.
import { readFileSync } from "node:fs";
import { plateOf } from "../boast-3d.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const base = { name: "Lin", seat: 1, cups: "<span>c</span>", bid: "<b>6x3</b>" };

const a = plateOf({ ...base, turn: true });
check(a.state === "on" && a.meta === "<span>c</span>" && a.tally.includes("6x3") && a.fan === 0, "a player to bid is ringed and shows its cups and last bid");
check(plateOf({ ...base, mine: true }).name === "You", "your own plate says You");
check(plateOf({ ...base, call: "开" }).tally.includes("bo3-call") && !plateOf({ ...base, call: "开" }).tally.includes("6x3"), "a call replaces the bid on the plate");
check(plateOf({ ...base, dice: "<i>d</i>" }).tally.includes("bo3-dice"), "the dice show once the cups are lifted");
check(plateOf({ ...base, loser: true }).state === "mate" && plateOf({ ...base, loser: true }).label.includes("drinks"), "the one who drinks is marked and named for a screen reader");
check(plateOf({ ...base, turn: true, thinking: true }).state === "on thinking", "a thinking player thinks");
check(plateOf({ ...base, away: true }).state === "out", "an absent player's plate is dimmed");
check(!plateOf({ ...base, name: "<b>", call: "<i>" }).tally.includes("<i>") && !plateOf({ ...base, name: "<b>" }).label.includes("<b>x"), "a called word is escaped");

const page = readFileSync(new URL("../boast.js", import.meta.url), "utf8"), html = readFileSync(new URL("../boast.html", import.meta.url), "utf8");
check(/tableView\("boast"\)/.test(page) && /view\.choice\(/.test(page), "the menu offers View through the shared tableView");
check(/view\.get\(\) === "3d"/.test(page) && /three\.dispose\(\)/.test(page) && /onPause\(.*three/.test(page), "flat unless 3D is chosen; 3D disposed on the way back; paused with the menu");
check(html.includes("table3d.css") && html.includes("boast-3d.css"), "the page links the cloth's stylesheet and its own");
const css = readFileSync(new URL("../boast-3d.css", import.meta.url), "utf8");
check(!/[^\d.]([3-9]|\d\d+)px/.test(css.replace(/\d+px solid/g, "")), "sizes in rem, not px");
if (bad) { console.log(`${bad} failed`); process.exit(1); }
console.log("all passed");
