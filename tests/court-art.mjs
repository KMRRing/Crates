// The court cards' art (court-art.js, Korbi, 7 Nov 2026: one detailed set, used wherever the ordinary pack is): twelve distinct figures,
// each double-ended, and the card renderers (cards.js, tribute-3d.js) use it instead of drawing their own.
import fs from "fs";
import { courtFile } from "../court-art.js";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const all = ["K", "Q", "J"].flatMap(r => ["♠", "♥", "♦", "♣"].map(s => courtFile(r, s)));
check(new Set(all).size === 12, "twelve different court cards");
check(all.every(f => fs.existsSync(new URL("../" + f, import.meta.url))), "each has its drawing in court/");
const COLOURS = new Set(["#000", "#df0000", "#e2d200", "#fff"]);
const bad4 = all.filter(f => (fs.readFileSync(new URL("../" + f, import.meta.url), "utf8").match(/#[0-9a-fA-F]{3,6}\b/g) || []).some(c => !COLOURS.has(c.toLowerCase())));
check(!bad4.length, `only black, red, yellow and white in them${bad4.length ? `: ${bad4.join(", ")}` : ""}`);
check(all.every(f => !/<script|href=|<image/.test(fs.readFileSync(new URL("../" + f, import.meta.url), "utf8"))), "nothing in them but drawing");
check(all.every(f => fs.statSync(new URL("../" + f, import.meta.url)).size < 400e3), "each under 400 KB");
const src = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
check(/courtArt\(/.test(src("cards.js")) && /courtArt\(/.test(src("tribute-3d.js")), "cards.js and Guandan's 3D cards both draw courts with it");
process.exit(bad ? 1 : 0);
