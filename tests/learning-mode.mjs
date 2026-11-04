// The Choose sheet's learning modes (crates-mode.js): Crates' mode is read from its own key, else from its run, and the
// sheet's choices match what learn.js knows; no game's own menu sets a learning mode any more.
import { readFileSync, readdirSync } from "node:fs";
globalThis.localStorage = { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } };
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const L = await import("../crates-mode.js");
// learn.js needs the clue bank in a browser, so its list is read from the source
const MODES = /export const MODES = \[([^\]]*)\]/.exec(readFileSync(new URL("../learn.js", import.meta.url), "utf8"))[1].replace(/[" ]/g, "").split(",");

check(L.CRATES_MODES.map(([k]) => k).join() === MODES.join(), "the sheet offers the modes learn.js has, in its order");
check(L.cratesMode() === "off", "no key and no run: Off");
localStorage.setItem("crates:v2", JSON.stringify({ mode: "clues" }));
check(L.cratesMode() === "clues", "no key: the mode the run on this device has");
L.setCratesMode("norepeat");
check(L.cratesMode() === "norepeat" && localStorage.getItem("crates:mode") === "norepeat", "the key wins over the run");
L.setCratesMode("nonsense");
check(L.cratesMode() === "norepeat", "a mode that isn't one is ignored");
localStorage.setItem("crates:mode", "bad");
check(L.cratesMode() === "clues", "a bad key falls back to the run");

const own = readdirSync(new URL("..", import.meta.url)).filter(f => /\.js$/.test(f) && !/^(sw|pile)\.js$/.test(f))
  .filter(f => /choice\(\s*"Learning mode"/.test(readFileSync(new URL(`../${f}`, import.meta.url), "utf8")));
check(own.length === 0, `no game's menu has a Learning mode choice${own.length ? `: ${own.join(", ")}` : ""}`);
if (bad) process.exit(1);
