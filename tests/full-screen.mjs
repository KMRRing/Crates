// Full screen (Korbi, 3 November 2026: "all games should be full screen by default ... no title etc, settings icon in the top
// right is used to navigate back to menu always ... buttons exist inside the full screen, not outside"). A page opens
// with no title bar: its #app has the class `full` (style.css, menu.js; CLAUDE.md, "Full screen"), which hides the header's
// title and buttons, fixes the menu's mark at the top right, and puts Back to menu first in the menu. A page that still
// has its header is listed in STILL; the list only shrinks (a page that has gone full and is still listed fails too).
// A full page keeps the two buttons the mechanism leans on: #appsBtn (Back to menu clicks it) and #menuBtn.
import fs from "fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("..", import.meta.url).pathname;
const STILL = new Set([
  "acrostic.html", "almanac.html", "assay.html", "avalanche.html", "baccarat.html", "banquet.html",
  "bigtwo.html", "blackjack.html", "blend.html", "boast.html", "bones.html", "bridges.html",
  "bulls.html", "calcudoku.html", "calibre.html", "cartel.html", "chart.html", "codeword.html",
  "columbiad.html", "contract.html", "craps.html", "crossword.html", "cue.html", "deck.html",
  "delta.html", "drift.html", "factor.html", "gambit.html", "gammon.html", "guilloche.html",
  "harbour.html", "heliograph.html", "holdem.html", "hong.html", "isomer.html", "kakuro.html",
  "ladder.html", "landfall.html", "ledger.html", "lode.html", "loom.html", "lots.html",
  "manifest.html", "masyu.html", "meld.html", "mines.html", "netting.html", "nexus.html",
  "nonogram.html", "nurikabe.html", "order.html", "origin.html", "orrery.html", "parley.html",
  "party.html", "pegs.html", "pipes.html", "polder.html", "punt.html", "quest.html",
  "quote.html", "rack.html", "reckoning.html", "refinery.html", "river.html", "roulette.html",
  "rush.html", "settle.html", "shunt.html", "sicbo.html", "silo.html", "slate.html",
  "slipway.html", "slitherlink.html", "soon.html", "speedfuels.html", "speedmaths.html", "spot.html",
  "stow.html", "sudoku.html", "survey.html", "timegrapher.html", "tribute.html", "trumps.html",
  "yield.html",
]);
const pages = fs.readdirSync(root).filter(f => f.endsWith(".html")).sort();
const withHeader = [], full = [], unlisted = [], stale = [], broken = [];
for (const p of pages) {
  const html = fs.readFileSync(root + p, "utf8");
  if (!/<header class="top"/.test(html)) continue;
  withHeader.push(p);
  const isFull = /<div id="app"[^>]*class="[^"]*\bfull\b/.test(html);
  if (isFull) {
    full.push(p);
    if (!/id="appsBtn"/.test(html) || !/id="menuBtn"/.test(html)) broken.push(p);
    if (STILL.has(p)) stale.push(p);
  } else if (!STILL.has(p)) unlisted.push(p);
}
check(!unlisted.length, `every page with a header is full screen, or listed as not yet${unlisted.length ? `: not ${unlisted.join(", ")}` : ""}`);
check(!stale.length, `no page is both full screen and in STILL${stale.length ? `: ${stale.join(", ")}` : ""}`);
check(!broken.length, `a full-screen page keeps #appsBtn and #menuBtn${broken.length ? `: ${broken.join(", ")}` : ""}`);
check([...STILL].every(p => pages.includes(p)), "STILL names pages that exist");
console.log(`${full.length} of ${withHeader.length} pages with a header are full screen`);
process.exit(bad ? 1 : 0);
