// A module that apps.js loads must not import() a module that leads back to apps.js while the page is still loading:
// Safari then runs the page's own module before apps.js has finished, and every game reading APPS at start-up stops with
// "Cannot access 'APPS' before initialization" (5 November 2026, menu.js's title logo; Chrome never showed it). Such an
// import() waits for the page's load (menu.js's afterLoad), so it must sit on a line that says so.
import { readFileSync } from "node:fs";

let failed = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) failed++; };
const src = new Map();
const read = f => { if (!src.has(f)) { try { src.set(f, readFileSync(new URL(`../${f}`, import.meta.url), "utf8")); } catch { src.set(f, ""); } } return src.get(f); };
const STATIC = /(?:import|export)\s[^;]*?from\s*["']\.\/([^"'?]+\.js)["']|\bimport\s*["']\.\/([^"'?]+\.js)["']/g;
const DYNAMIC = /\bimport\(\s*["']\.\/([^"'?]+\.js)["']\s*\)/g;
const staticOf = f => [...read(f).matchAll(STATIC)].map(m => m[1] || m[2]);
const allOf = f => [...staticOf(f), ...[...read(f).matchAll(DYNAMIC)].map(m => m[1])];
const reach = (from, step) => { const out = new Set(), todo = [from]; while (todo.length) for (const n of step(todo.pop())) if (!out.has(n)) { out.add(n); todo.push(n); } return out; };

const loaded = reach("apps.js", staticOf);                 // what is evaluated with apps.js
const leadsBack = f => f === "apps.js" || reach(f, allOf).has("apps.js");
const bad = [];
for (const f of loaded) {
  read(f).split("\n").forEach((line, i) => {
    for (const m of line.matchAll(DYNAMIC)) if (leadsBack(m[1]) && !/afterLoad\(/.test(line)) bad.push(`${f}:${i + 1} import("./${m[1]}")`);
  });
}
check(loaded.size > 10, `apps.js loads ${loaded.size} modules with it`);
check(!bad.length, `no module loaded with apps.js imports one leading back to it before the page has loaded${bad.length ? ": " + bad.join(", ") : ""}`);
process.exit(failed ? 1 : 0);
