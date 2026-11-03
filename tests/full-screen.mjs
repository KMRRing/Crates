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
  "gambit.html",
]);
const EXEMPT = new Set(["soon.html"]);   // the placeholder for a game to come: a card with a name, no game and no menu
const pages = fs.readdirSync(root).filter(f => f.endsWith(".html")).sort();
const withHeader = [], full = [], unlisted = [], stale = [], broken = [];
for (const p of pages) {
  const html = fs.readFileSync(root + p, "utf8");
  if (!/<header class="top"/.test(html) || EXEMPT.has(p)) continue;
  withHeader.push(p);
  const isFull = /<div id="app"[^>]*class="[^"]*\bfull\b/.test(html);
  if (isFull) {
    full.push(p);
    if (!/id="appsBtn"/.test(html) || !/id="menuBtn"/.test(html)) broken.push(p);
    if (STILL.has(p)) stale.push(p);
  } else if (!STILL.has(p)) unlisted.push(p);
}
// While the rollout is under way a page that arrives with its header (a game another Claude is landing now) is only
// said, not failed, so it doesn't hold the publish back; STRICT turns that into a failure when the rollout is done.
const STRICT = false;
if (!STRICT && unlisted.length) console.log(`note ${unlisted.join(", ")} still has its header: it should be full screen (CLAUDE.md, "Full screen")`);
else check(!unlisted.length, `every page with a header is full screen, or listed as not yet${unlisted.length ? `: not ${unlisted.join(", ")}` : ""}`);
check(!stale.length, `no page is both full screen and in STILL${stale.length ? `: ${stale.join(", ")}` : ""}`);
check(!broken.length, `a full-screen page keeps #appsBtn and #menuBtn${broken.length ? `: ${broken.join(", ")}` : ""}`);
check([...STILL].every(p => pages.includes(p)), "STILL names pages that exist");
console.log(`${full.length} of ${withHeader.length} pages with a header are full screen`);
process.exit(bad ? 1 : 0);
