// The court cards' art (court-art.js, Korbi, 7 Nov 2026: one detailed set, used wherever the ordinary pack is): twelve distinct figures,
// each double-ended, and the card renderers (cards.js, tribute-3d.js) use it instead of drawing their own.
import fs from "fs";
import { courtArt } from "../court-art.js";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const all = ["K", "Q", "J"].flatMap(r => ["♠", "♥", "♦", "♣"].map(s => courtArt(r, s)));
check(new Set(all).size === 12, "twelve different court cards");
check(all.every(s => s.startsWith("<svg") && s.endsWith("</svg>") && s.includes('rotate(180 30 52)')), "each is an SVG with its figure turned about the middle");
check(all.every(s => (s.match(/<svg/g) || []).length === 1 && !/[<]script|href=/.test(s)), "nothing in them but drawing");
const src = f => fs.readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
check(/courtArt\(/.test(src("cards.js")) && /courtArt\(/.test(src("tribute-3d.js")), "cards.js and Guandan's 3D cards both draw courts with it");
process.exit(bad ? 1 : 0);
