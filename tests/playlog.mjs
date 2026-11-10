// The play log (playlog.js; Korbi, 11 November 2026: time on every level and across all minigames, a one-tap rating after each level).
// Here, with a stand-in browser: time counts only while the page is on screen and played, goes to the level in hand, a round's end counts a
// play, a rating is kept, the text to copy reads right, a watching page writes nothing; and every page loads it, Settings shows it, Gears
// and Jam name their levels.
import fs from "fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("..", import.meta.url).pathname;
const src = f => fs.readFileSync(root + f, "utf8");

// ---------- a stand-in browser ----------
const store = new Map(), handlers = {};
let now = 1_000_000, ticker = null;
Date.now = () => now;
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
globalThis.location = { pathname: "/crates/pipes.html", search: "" };
globalThis.document = { visibilityState: "visible", addEventListener: (t, f) => { (handlers["doc:" + t] ??= []).push(f); }, createElement: () => ({}), body: { appendChild() {} } };
globalThis.addEventListener = (t, f) => { (handlers[t] ??= []).push(f); };
globalThis.setInterval = f => { ticker = f; return 1; };
globalThis.requestAnimationFrame = () => 0;
const fire = (t, e = {}) => (handlers[t] || []).forEach(f => f(e));
const pass = ms => { const end = now + ms; while (now < end) { now += Math.min(5000, end - now); ticker(); } };

const P = await import("../playlog.js");
const log = () => JSON.parse(store.get("playlog:v1"));

// ---------- time ----------
P.levelOn("pipes", "wa21", "21 · Clack");
fire("pointerdown");
pass(40000);                                  // played for 40 s
fire("pagehide");
check(log().games.pipes.ms === 40000 && log().levels["pipes/wa21"].ms === 40000 && log().levels["pipes/wa21"].name === "21 · Clack", "40 s played: the game and the level in hand each have 40 s");
pass(120000);                                 // two minutes untouched: time counts up to two minutes after the last tap, then stops
fire("pagehide");
check(log().levels["pipes/wa21"].ms === 120000, "no tap for two minutes and the time stops (a phone put down is not time on the level)");
fire("pointerdown");
document.visibilityState = "hidden";
fire("doc:visibilitychange");
pass(30000);
document.visibilityState = "visible";
fire("doc:visibilitychange");
fire("pagehide");
check(log().levels["pipes/wa21"].ms === 120000, "a page out of sight counts nothing");

// ---------- levels and rounds ----------
fire("pointerdown");
pass(10000);
P.levelOn("pipes", "wa22", "22 · Seize");
pass(20000);
const quiet = console.error; console.error = () => {};     // the strip's section lookup needs the whole app, not here
fire("round-over", { detail: { app: "pipes" } });
await new Promise(r => setTimeout(r, 0));
console.error = quiet;
const L = log();
check(L.levels["pipes/wa21"].ms === 130000 && L.levels["pipes/wa22"].ms === 20000 && L.levels["pipes/wa22"].plays === 1 && !L.levels["pipes/wa21"].plays, "a level left keeps its time; the next one gets its own, and the round over counts a play for it");
check(L.games.pipes.ms === 150000, "the game has all of it");
P.rate("pipes", "wa22", 4);
P.rate("pipes", "wa22", 5);
check(log().levels["pipes/wa22"].rating === 5, "a rating is kept, the last tap standing");
const text = P.logText(id => (id === "pipes" ? "Gears" : id));
check(/^Play log, \d{4}-\d\d-\d\d\nAll games: 2 min\n\nGears: 2 min\n  21 · Clack: 2 min, 0 plays\n  22 · Seize: 20 s, 1 play, rated 5\/5$/.test(text), "the text to copy: all games, then each game and its levels");
check(P.clock(45000) === "45 s" && P.clock(12 * 60000) === "12 min" && P.clock(64 * 60000) === "1 h 04 min", "times in words");

// ---------- wired in ----------
check(/import "\.\/playlog\.js";/.test(src("pwa.js")), "every page loads the log (through pwa.js)");
check(/playLog\(\),\s*startOver\(\)/.test(src("apps.js")) && /Copy the log/.test(src("apps.js")), "Settings shows it, with a Copy");
check(/levelOn\("pipes", spec\.id/.test(src("pipes-gear-run.js")) && /levelOn\("shunt"/.test(src("shunt.js")), "Gears and Jam say which level is in hand");
check(/\.playlog-rate\b/.test(src("style.css")), "the rating strip has its look in style.css");

// ---------- a watching page writes nothing ----------
store.clear();
globalThis.location = { pathname: "/crates/pipes.html", search: "?watch=1&frame=1" };
const W = await import("../playlog.js?watching");
W.levelOn("pipes", "wa1", "1");
W.rate("pipes", "wa1", 3);
check(!store.has("playlog:v1"), "a partner's watching page keeps no log");

process.exit(bad ? 1 : 0);
