// Settings' "2D mode (battery saver)" (Korbi, 4 November 2026: "add a setting in main menu settings: '2D mode (battery saver)'.
// this does the default across all games - user's choices for specific app preferences (3d vs 2d) are still remembered").
// mode3d.js holds the setting; a game with a 2D/3D choice keeps it under its own key, written only when the player chooses, and asks
// defaultIs3D() / wants3D() when it has none. Here: the setting itself, the toggle in Settings, the key staying on the device, and
// that every file drawing in WebGL (or a 3D scene) reaches mode3d.js, on its own or through the page that loads it.
import fs from "fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("..", import.meta.url).pathname;
const src = f => fs.readFileSync(root + f, "utf8");

// ---------- the setting ----------
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
let fired = 0;
globalThis.addEventListener = (type, fn) => { if (type === "settings:flat") globalThis.__h = fn; };
globalThis.removeEventListener = () => {};
globalThis.dispatchEvent = e => { if (e.type === "settings:flat") fired++, globalThis.__h?.(); };
globalThis.Event = class { constructor(type) { this.type = type; } };
const { flatMode, setFlatMode, defaultIs3D, wants3D, onDefaultChange } = await import("../mode3d.js");

check(defaultIs3D() && !flatMode(), "with nothing set the default is 3D");
check(wants3D(null, "3d") && wants3D("", "3d") && wants3D("3d", "3d") && !wants3D("flat", "3d"), "a game with no choice follows the default, a choice stands");
let heard = null;
onDefaultChange(is3D => { heard = is3D; });
setFlatMode(true);
check(flatMode() && !defaultIs3D() && store.get("settings:flat") === "1" && fired === 1 && heard === false, "2D mode on: the default is flat, the key is kept, games are told at once");
check(!wants3D(null, "model") && wants3D("model", "model") && !wants3D("2d", "model"), "2D mode: no choice means flat, a kept 3D choice still means 3D, a kept flat one flat");
setFlatMode(false);
check(defaultIs3D() && store.get("settings:flat") === "0" && heard === true, "2D mode off again: the default is 3D");

// ---------- the toggle, and the key staying on the device ----------
const apps = src("apps.js");
check(/toggle\("2D mode \(battery saver\)", flatMode\(\), setFlatMode\)/.test(apps) && /Every game opens flat unless you chose 3D in it\./.test(apps), "Settings has the toggle, with its line");
check(/const LOCAL = \/\^\([^)]*settings:flat[^)]*\)\//.test(src("suite.js")), "settings:flat stays on this device (a phone's battery is its own)");

// ---------- every file that draws in 3D reaches the setting ----------
const files = fs.readdirSync(root).filter(f => f.endsWith(".js") && f !== "sw.js");
const text = new Map(files.map(f => [f, src(f)]));
const READERS = new Set(["mode3d.js", "table3d-view.js", "gambit-view.js"]);
const reads = f => [...READERS].some(r => new RegExp(`["']\\./${r.replace(".", "\\.")}["']`).test(text.get(f)));
const importersOf = f => files.filter(g => g !== f && new RegExp(`["']\\./${f.replace(".", "\\.")}["']`).test(text.get(g)));
const draws3D = f => /new THREE\.WebGLRenderer|getContext\(["'](experimental-)?webgl/.test(text.get(f)) && f !== "vendor/three.js";
// Files with a 3D scene that follow the setting through the page that loads them need no listing; one that does not is listed with why.
const EXEMPT = {
  "bridges-batch.js": "the build tool's batch renderer for pictures, not a page",
  // being built by other sessions on 4 November 2026, who read defaultIs3D() themselves; take each off this list once it does
  "party-coup-3d.js": "Cabal's 3D table, in progress",
};
const unreached = [];
for (const f of files.filter(draws3D)) {
  if (EXEMPT[f]) continue;
  const seen = new Set([f]), queue = [f];
  let ok = reads(f);
  while (!ok && queue.length) {
    const g = queue.shift();
    for (const h of importersOf(g)) {
      if (seen.has(h)) continue;
      seen.add(h);
      if (reads(h)) { ok = true; break; }
      queue.push(h);
    }
  }
  if (!ok) unreached.push(f);
}
check(files.filter(draws3D).length >= 20, `${files.filter(draws3D).length} files draw a 3D scene`);
check(!unreached.length, `every 3D scene is reached from a page that asks mode3d.js for the default${unreached.length ? ` (not: ${unreached.join(", ")})` : ""}`);

// ---------- a game's own key is written only on a choice ----------
const tv = src("table3d-view.js"), gv = src("gambit-view.js");
check(/wants3D\(kept\(\), "3d"\)/.test(tv) && /setItem\(key, v === "3d" \? "3d" : "flat"\)/.test(tv) && !/removeItem/.test(tv), "the card tables keep a choice (3d or flat) and read the default when there is none");
check(/wants3D\(kept, "3d"\)/.test(gv) && !/removeItem/.test(gv), "Chess keeps a choice and reads the default when there is none");
for (const [f, what] of [["bridges.js", "Bridges"], ["lanterns.js", "Lanterns"], ["moor.js", "Moor"], ["nurikabe.js", "Dujiang"]]) {
  const t = text.get(f);
  check(/delete prefs\.view/.test(t) && /if \(remember\) \{ prefs\.view = /.test(t) && !/view: "(chart|flat|board)"/.test(t), `${what}: the view is kept only when the player picks it (the automatic restore does not write it)`);
}

if (bad) { console.log(`\n${bad} failed`); process.exit(1); }
console.log("\nall passed");
