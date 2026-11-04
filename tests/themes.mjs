// The suite has two looks: Codex (day and night, following the phone unless set) and Office (night only). Modern and
// Kontor were removed on 4 November 2026; this keeps them out: no stylesheet or script names either as a theme, theme.js
// turns a saved one into Codex, Office is night whatever the phone or `suite:mode` says, and the Settings choice offers two.
import fs from "node:fs";
import vm from "node:vm";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;
const read = p => fs.readFileSync(root + p, "utf8");
const top = fs.readdirSync(root).filter(f => /\.(css|js|html)$/.test(f) && f !== "sw.js");

// ---------- nothing refers to Modern or Kontor as a theme ----------
const THEME_WORDS = [
  /data-theme\s*=\s*["']?(modern|kontor)\b/,                 // a selector or an attribute
  /\bdata-theme[^\n]{0,40}\b(modern|kontor)\b/,              // a list of them
  /\b(?:LOOK|look|theme|th|t)\s*===?\s*["'](modern|kontor)["']/,   // a branch on one
  /["'](modern|kontor)["']\s*(?:\|\||\)|\?)\s*[^\n]{0,30}(?:LOOK|theme|look)/,
  /\b(MODERN|KONTOR)_(LOGOS|MENU)\b|\b[A-Z]+_(MODERN|KONTOR)\b/,   // the old icon and logo maps
  /\bSKINS\.(modern|kontor)\b|\b(modern|kontor)\s*:\s*\{\s*(?:day|\n\s*day)/,   // a 3D skin of one
];
const hits = [];
for (const f of top) {
  const text = read(f);
  text.split("\n").forEach((line, i) => { if (THEME_WORDS.some(re => re.test(line))) hits.push(`${f}:${i + 1}`); });
}
check(hits.length === 0, `no stylesheet or script refers to Modern or Kontor as a theme${hits.length ? ": " + hits.slice(0, 8).join(", ") : ""}`);
check(!/modern|kontor/i.test(read("themes.css")), "themes.css is Office's alone");
check(!/data-theme="(?!office")/.test(read("themes.css")), "…every rule in it is Office's");
check(!/\[data-mode="day"\]/.test(read("themes.css").split("\n").filter(l => /data-theme="office"/.test(l)).join("\n")), "…and none of them is for day");

// ---------- theme.js ----------
function run(saved) {
  const store = { ...saved };
  const el = { dataset: {}, appendChild() {} };
  const ctx = {
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { documentElement: el, createElement: () => ({ className: "", setAttribute() {}, appendChild() {}, style: {} }), addEventListener() {} },
    location: { search: "", pathname: "/x.html" }, Image: function () {}, addEventListener() {}, ResizeObserver: undefined,
  };
  try { vm.runInNewContext(read("theme.js"), ctx); } catch { /* the loader below the look needs a real page */ }
  return { theme: el.dataset.theme, mode: el.dataset.mode, store };
}
let r = run({});
check(r.theme === undefined && r.mode === undefined, "nothing saved: Codex, following the phone");
r = run({ "suite:mode": "night" });
check(r.theme === undefined && r.mode === "night", "Codex night, as set");
r = run({ "suite:mode": "day" });
check(r.theme === undefined && r.mode === "day", "Codex day, as set");
r = run({ "suite:theme": "office" });
check(r.theme === "office" && r.mode === "night", "Office is night with nothing else saved");
r = run({ "suite:theme": "office", "suite:mode": "day" });
check(r.theme === "office" && r.mode === "night", "Office ignores a saved day: it is night only");
for (const old of ["modern", "kontor"]) {
  r = run({ "suite:theme": old, "suite:mode": "day" });
  check(r.theme === undefined && r.mode === "day" && !("suite:theme" in r.store), `a saved ${old} becomes Codex, and the key is cleared`);
}
r = run({ "suite:theme": "nonsense" });
check(r.theme === undefined && !("suite:theme" in r.store), "anything else is Codex too");

// ---------- Settings ----------
const apps = read("apps.js");
check(/const THEMES = \[\["deco", "Codex"\], \["office", "Office"\]\];/.test(apps), "Settings offers Codex and Office");
check(/theme\(\) === "office" \? \[\] : \[choice\("Appearance"/.test(apps), "…and the day or night choice only for Codex");
check(/const OFFICE_ICONS = \{/.test(apps) && !/MODERN_LOGOS|KONTOR_LOGOS/.test(apps), "Office's games screen wears its own line icons; there is no Modern logo map");

console.log(bad ? `\n${bad} FAILED` : "\nthemes: Codex and Office only");
process.exit(bad ? 1 : 0);
