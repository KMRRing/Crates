// Every game page makes sound: from its own sound module, or from sfx.js (taps, right and wrong, a round's end, a Sound switch).
// Korbi, 8 November 2026: "everything should get sound". A page found in apps.js whose scripts reach no Web Audio code fails.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const rd = f => (existsSync(join(root, f)) ? readFileSync(join(root, f), "utf8") : "");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const reach = (f, seen = new Set()) => {
  if (seen.has(f)) return seen;
  seen.add(f);
  for (const m of rd(f).matchAll(/(?:from|import)\s*\(?\s*"\.\/([^"]+\.js)"/g)) reach(m[1], seen);
  return seen;
};
const apps = [...rd("apps.js").matchAll(/\{ id: "([^"]+)", sec: "[^"]+", name: "[^"]+", href: "\.\/([^"?#]+)"/g)].map(m => ({ id: m[1], page: m[2] }));
check(apps.length > 50, `found the games' pages (${apps.length})`);
const silent = [];
for (const a of apps) {
  const scripts = [...rd(a.page).matchAll(/src="([^"]+\.js)"/g)].map(m => m[1].replace("./", "")).filter(s => !/^(theme|pwa)\.js$/.test(s));
  const files = new Set();
  for (const s of scripts) reach(s, files);
  if (![...files].some(f => /AudioContext|webkitAudioContext/.test(rd(f)))) silent.push(a.id);
}
check(!silent.length, `every game has sound${silent.length ? `; silent: ${silent.join(", ")}` : ""}`);
process.exit(bad ? 1 : 0);
