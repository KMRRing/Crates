// Full screen, and its titled state (Korbi, 3 November 2026: "all games should be full screen by default ... no title etc"
// and, the same evening, "I may have gone too far asking every game to be full screen without the title ... a lot of the
// games look better with the title there - just maybe not some of the card and idle games that should be a bit more
// ambient. the puzzles however, should probably keep the title layout"). A page with a header has `full` on its #app
// (style.css, menu.js; CLAUDE.md, "Full screen"): a quiet band, the Codex mark top right, Back to menu first in the menu.
// Puzzles, quizzes, text and form pages and tools also have `titled`: the game's name shows in the band. Cards, boards,
// idle games and pictures are `full` alone, ambient. The lists below say which is which; a new page goes in one of them.
// A full page keeps the two buttons the mechanism leans on: #appsBtn (Back to menu clicks it) and #menuBtn.
import fs from "fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("..", import.meta.url).pathname;
const EXEMPT = new Set(["soon.html"]);   // the placeholder for a game to come: a card with a name, no game and no menu

// TITLED: knowledge, puzzles, classics, courses, tools and word games, and Party (its Sketch drops the title in party.js)
const TITLED = new Set(`crates lots punt quote census origin order crossing spyglass chart ledger nexus isomer lode acrostic crossword nonogram
  slate delta spot speedmaths pipes survey stow shunt slipway
  sudoku calcudoku kakuro hitori masyu nurikabe slitherlink lanterns asterism moor mines ladder bridges bulls codeword assay yield
  calibre parley arthistory wine firmament trade constitutions statecraft music maths speedfuels blend refinery rack cartel deck rush
  party quest cue tribute
  contract trumps landlord bigtwo hearts meld pegs boast yacht solitaire holdem blackjack baccarat tarot`.split(/\s+/).map(n => n + ".html"));
// (tribute: Guandan became titled on 7 Nov 2026, Korbi: it should state its name and logo, which go back to the games)
// (the card and dice games became titled on 7 Nov 2026, Korbi: "implement it across the board"; Craps, Sic Bo, Roulette and Shoe stay full)
// FULL alone: board games, idle and ambient games, pictures (Manifest, Almanac, Guilloché, Timegrapher)
const FULL = new Set(`shoe carrack hong bones banquet   craps roulette sicbo factor gambit flank morris crown go river silo gammon carrom
  avalanche columbiad reckoning drift heliograph landfall netting orrery polder settle topple harbour ingot
  almanac manifest guilloche timegrapher`.split(/\s+/).map(n => n + ".html"));

const pages = fs.readdirSync(root).filter(f => f.endsWith(".html")).sort();
const withHeader = [], notFull = [], broken = [], unlisted = [], wrong = [], noTitle = [], stale = [];
for (const p of pages) {
  const html = fs.readFileSync(root + p, "utf8");
  if (!/<header class="top"/.test(html) || EXEMPT.has(p)) continue;
  withHeader.push(p);
  const cls = (html.match(/<div id="app"[^>]*class="([^"]*)"/) || [])[1]?.split(/\s+/) || [];
  if (!cls.includes("full")) { notFull.push(p); continue; }
  if (!/id="appsBtn"/.test(html) || !/id="menuBtn"/.test(html)) broken.push(p);
  const titled = cls.includes("titled");
  if (!TITLED.has(p) && !FULL.has(p)) unlisted.push(p);
  else if (TITLED.has(p) !== titled) wrong.push(`${p} (${TITLED.has(p) ? "should be full titled" : "should be full alone"})`);
  if (titled) {
    // the name is the page's own title element, h1.mark with the logo and the word; `titled` shows the word
    const name = (html.match(/<h1 class="mark"[^>]*>([\s\S]*?)<\/h1>/) || [])[1]?.replace(/<[^>]*>/g, "").trim();
    if (!name) noTitle.push(p);
  }
}
for (const p of [...TITLED, ...FULL]) if (!pages.includes(p) || EXEMPT.has(p)) stale.push(p);
check(!notFull.length, `every page with a header is full screen: #app has the class full (CLAUDE.md, "Full screen")${notFull.length ? `: not ${notFull.join(", ")}` : ""}`);
check(!broken.length, `a full-screen page keeps #appsBtn and #menuBtn${broken.length ? `: ${broken.join(", ")}` : ""}`);
check(!unlisted.length, `every full page is in the TITLED or the FULL list of this test${unlisted.length ? `: add ${unlisted.join(", ")}` : ""}`);
check(!wrong.length, `a page's classes match its list: titled pages are full titled, the rest full alone${wrong.length ? `: ${wrong.join(", ")}` : ""}`);
check(!noTitle.length, `a titled page has its name in the header's title${noTitle.length ? `: ${noTitle.join(", ")}` : ""}`);
check(!stale.length, `the lists name only pages that exist with a header${stale.length ? `: ${stale.join(", ")}` : ""}`);
// the stylesheet that shows the name: titled turns the hidden title back on, in the band, and keeps the logo and the pill off it
const css = fs.readFileSync(root + "style.css", "utf8");
check(/#app\.full\.titled > \.top > \.mark \{[^}]*display: block !important/.test(css) && /#app\.full\.titled > \.top :is\(\.mark-icon, \.partner-pill/.test(css), "style.css shows a titled page's name in the band, without the logo or the pill");
// the title's logo (menu.js, titleLogo): menu.js finds a titled page's tile in apps.js by its file name, so every titled page must have one,
// and it shows only on titled pages (menu.js asks for `#app.full.titled`; a FULL page never has the class, checked above)
const tiles = new Set([...fs.readFileSync(root + "apps.js", "utf8").matchAll(/href: "\.\/([^"?]+\.html)/g)].map(m => m[1]));
const noLogo = [...TITLED].filter(p => !tiles.has(p));
check(!noLogo.length, `every titled page has a tile in apps.js, so a logo above its title${noLogo.length ? `: ${noLogo.join(", ")}` : ""}`);
const menu = fs.readFileSync(root + "menu.js", "utf8");
check(/classList\.contains\("titled"\)\) return drop\(\)/.test(menu) && /"Back to the games"/.test(menu) && /games\.click\(\)/.test(menu), "menu.js shows the logo only on a titled page, named Back to the games, and clicks #appsBtn");
// Korbi, 7 Nov 2026: on a titled page the name is Back to the games as well as the logo (both are #appsBtn, so the name must take taps)
const titledRule = css.split("\n").filter(l => /#app\.full\.titled > \.top[^{]*\.mark-btn/.test(l)).join(" ");
check(titledRule && !/pointer-events:\s*none/.test(titledRule), "a titled page's name takes taps (Back to the games), like its logo");
check(withHeader.length >= 90, `the pages with a header (${withHeader.length})`);
process.exit(bad ? 1 : 0);
