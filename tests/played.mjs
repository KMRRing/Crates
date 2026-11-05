// The days a game was played (suite.js, notePlayed; kept as ledger:played = { game: [YYYYMMDD…] } for the Ledger): written once a
// day per game, when a result or sign of progress changes on the game's own page or a round is counted; capped; synced like any
// game's key (not a suite: key); and never written by a page that shows your partner's game.
import fs from "node:fs";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const root = new URL("../", import.meta.url).pathname;

const mem = new Map();
let writes = 0;
class Storage {
  getItem(k) { return mem.has(k) ? mem.get(k) : null; }
  setItem(k, v) { if (k === "ledger:played") writes++; mem.set(k, String(v)); }
  removeItem(k) { mem.delete(k); }
  key(i) { return [...mem.keys()][i]; }
  get length() { return mem.size; }
}
globalThis.Storage = Storage;
globalThis.localStorage = new Storage();
globalThis.location = { search: "", pathname: "/Crates/rack.html", hash: "", href: "http://x/Crates/rack.html" };
globalThis.addEventListener = () => {};
globalThis.window = { get parent() { return globalThis.window; } };
globalThis.document = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], readyState: "loading", getElementById: () => null };
const S = await import("../suite.js");
const log = () => JSON.parse(localStorage.getItem("ledger:played") || "{}");
const day = String(S.today());

localStorage.setItem("rack:settings", "{}");
localStorage.setItem("rack:best", "5");
check(JSON.stringify(log()) === JSON.stringify({ rack: [day] }), "a sign of progress on the game's own page (its best) notes today for the game; a setting does not");
localStorage.setItem("rack:best", "7"); localStorage.setItem("rack:streak", "{}"); S.notePlayed();
check(writes === 1, "and once a day: more results the same day write nothing more");
localStorage.setItem("punt:best", "9");
check(!log().punt, "a key of another game written on this page is not this page's play");
const pre = localStorage.getItem("ledger:played");
localStorage.setItem("rack:today", "same"); localStorage.setItem("rack:today", "same");
check(localStorage.getItem("ledger:played") === pre, "a figure rewritten unchanged, as a start-up might, isn't play");

// the cap: the last 120 days, oldest dropped, in order
mem.set("ledger:played", JSON.stringify({ glyph: Array.from({ length: 130 }, (_, i) => String(20200101 + i)) }));
S.notePlayed("glyph");
const g = log().glyph;
check(g.length === S.PLAYED_DAYS && S.PLAYED_DAYS === 120 && g[119] === day && g[0] === "20200112" && g.every((d, i) => !i || g[i - 1] < d), "capped at the last 120 days per game, oldest first");
S.notePlayed("glyph"); S.notePlayed("glyph");
check(log().glyph.length === 120, "a day already there isn't added twice");
mem.set("ledger:played", "{broken");
S.notePlayed("delta");
check(JSON.stringify(log()) === JSON.stringify({ delta: [day] }), "an unreadable log starts again rather than stopping the game");

// a page showing your partner's game writes nothing of yours
mem.clear();
globalThis.location = { ...location, search: "?watch=ABCD&frame=1" };
const W = await import("../suite.js?watching");
W.notePlayed("rack"); localStorage.setItem("rack:best", "5");
check(!mem.has("ledger:played"), "a watching page notes no day");

// the wiring
const suite = fs.readFileSync(root + "suite.js", "utf8"), random = fs.readFileSync(root + "random.js", "utf8");
check(!/suite:played/.test(suite) && /PLAYED = "ledger:played"/.test(suite) && !/\^\(suite:\|[^)]*ledger:/.test(suite), "kept under ledger:, which syncs with the solo code (a suite: key stays on the device)");
check(/if \(!IN_FRAME\) notePlayed\(/.test(random), "a round counted (roundOver) notes the day");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("played: a day per game, once, capped, never from a watching page");
