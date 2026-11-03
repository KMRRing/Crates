// Crates' tiles (README, Crates): every word in the bank is drawn at the one type size, so none may need a longer run of
// letters than a line holds (crates-tile.js breaks the long ones), and the break leaves the word's letters as they were.
import fs from "node:fs";
import { tileText, runsOf, LINE } from "../crates-tile.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

globalThis.window = {};
new Function("window", fs.readFileSync(new URL("../bank.js", import.meta.url), "utf8"))(globalThis.window);
const bank = JSON.parse(Buffer.from(window.CRATES_BANK, "base64").toString("utf8"));
const words = [...new Set(bank.flatMap(a => a.w.map(w => w[0])))];

const long = words.filter(w => runsOf(w).some(r => r.length > LINE));
check(words.length > 1000 && long.length === 0, `no run on any of ${words.length} tiles is longer than ${LINE} letters${long.length ? `: ${long.slice(0, 5)}` : ""}`);
const changed = words.filter(w => tileText(w).replace(/­/g, "") !== w.replace(/­/g, ""));
check(changed.length === 0, "breaking a word never changes its letters");
check(tileText("Kangaroo") === "Kangaroo" && tileText("Hammerfest").includes("­"), "a word that fits stays whole, a longer one is cut");
check(tileText(tileText("Elbphilharmonie")) === tileText("Elbphilharmonie"), "cutting twice cuts once");

process.exit(bad ? 1 : 0);
