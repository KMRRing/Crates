// No game asks with the browser's confirm(), prompt() or alert() (2 November 2026, Korbi: "don't use alerts. just do in-app
// pop ups. feels budget."): they ask with sure.js (sure, typed, notice), which draws the suite's own pop-up and stops a
// game's clock while it's open. The games not yet changed are listed with how many native calls each still has; the list
// only shrinks (a file that's cleaner than its number fails too, so the number is lowered with the change that cleans it).
import fs from "fs";

const root = new URL("..", import.meta.url).pathname;
const STILL = {
};

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const CALL = /(^|[^.\w$])(?:window\.)?(alert|confirm|prompt)\s*\(/g;
const files = fs.readdirSync(root).filter(f => /\.(js|html)$/.test(f) && f !== "sw.js" && !/-bank\.js$|^(bank|kb-index|chart-geo|pics-list)\.js$/.test(f));
const found = {};
for (const f of files) {
  let text = fs.readFileSync(root + f, "utf8");
  text = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\w])\/\/.*$/gm, "$1");   // comments, but not a URL's //
  const own = new Set([...text.matchAll(/function\s+(alert|confirm|prompt)\s*\(/g)].map(m => m[1]));   // a game's own function of that name
  let n = 0;
  for (const m of text.matchAll(CALL)) if (!own.has(m[2])) n++;
  if (n) found[f] = n;
}
for (const f of new Set([...Object.keys(found), ...Object.keys(STILL)])) {
  const n = found[f] || 0, allowed = STILL[f] || 0;
  if (n > allowed) check(false, `${f} asks with the browser's own pop-up ${n} time${n > 1 ? "s" : ""}: use sure(), typed() or notice() from sure.js`);
  else if (n < allowed) check(false, `${f} has ${n} native pop-up${n === 1 ? "" : "s"} left, fewer than the ${allowed} listed: lower its number in tests/no-native-dialogs.mjs`);
}
check(bad === 0, `no game asks with confirm(), prompt() or alert() beyond the ${Object.keys(STILL).length} still to change`);
process.exit(bad ? 1 : 0);
