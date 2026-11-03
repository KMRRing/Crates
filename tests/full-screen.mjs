// Full screen (Korbi, 3 November 2026: "all games should be full screen by default ... no title etc, settings icon in the top
// right is used to navigate back to menu always ... buttons exist inside the full screen, not outside"). A page opens
// with no title bar: its #app has the class `full` (style.css, menu.js; CLAUDE.md, "Full screen"), which hides the header's
// title and buttons, fixes the menu's mark at the top right, and puts Back to menu first in the menu. So a page that has a
// header and isn't `full` fails here: a new game adds `full` to its #app (and `full-pull` to its first row of status).
// A full page keeps the two buttons the mechanism leans on: #appsBtn (Back to menu clicks it) and #menuBtn.
import fs from "fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("..", import.meta.url).pathname;
const EXEMPT = new Set(["soon.html"]);   // the placeholder for a game to come: a card with a name, no game and no menu
const pages = fs.readdirSync(root).filter(f => f.endsWith(".html")).sort();
const withHeader = [], notFull = [], broken = [];
for (const p of pages) {
  const html = fs.readFileSync(root + p, "utf8");
  if (!/<header class="top"/.test(html) || EXEMPT.has(p)) continue;
  withHeader.push(p);
  if (!/<div id="app"[^>]*class="[^"]*\bfull\b/.test(html)) notFull.push(p);
  else if (!/id="appsBtn"/.test(html) || !/id="menuBtn"/.test(html)) broken.push(p);
}
check(!notFull.length, `every page with a header is full screen: #app has the class full (CLAUDE.md, "Full screen")${notFull.length ? `: not ${notFull.join(", ")}` : ""}`);
check(!broken.length, `a full-screen page keeps #appsBtn and #menuBtn${broken.length ? `: ${broken.join(", ")}` : ""}`);
check(withHeader.length >= 90, `the pages with a header (${withHeader.length})`);
process.exit(bad ? 1 : 0);
