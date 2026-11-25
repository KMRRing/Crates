// ramp.js: the hidden automatic level. Up after a clean win, down after a loss, kept under the game's own prefix.
import { ramp } from "../ramp.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const S = ["easy", "medium", "hard"];
check(ramp("t", S, { start: "medium" }) === "medium", "a player with nothing kept starts on the saved choice");
check(ramp("t2", S) === "easy" && ramp("t2", S, { start: "nonsense" }) === "easy", "no start, or an unknown one: the first step");
ramp("t", S, { start: "medium" });
check(ramp.won(true) === "hard" && store.get("t:ramp") === "hard", "a clean win steps up, kept as <game>:ramp");
check(ramp.won(true) === "hard", "the top step stays");
check(ramp("t", S, { start: "easy" }) === "hard", "the kept step beats the start");
check(ramp.won(false) === "hard", "an unclean win keeps the step");
check(ramp.lost() === "medium" && ramp.lost() === "easy" && ramp.lost() === "easy", "a loss steps down to the bottom");
check(ramp("n", [8, 10, 12], { start: 10 }) === 10 && ramp.won() === 12 && ramp("n", [8, 10, 12]) === 12, "numeric steps");
store.set("n:ramp", "99");
check(ramp("n", [8, 10, 12], { start: 10 }) === 10, "a kept step no longer in the list falls back to the start");
ramp("a", S, { id: "size" }); ramp.won();
check(store.has("a:ramp:size") && !store.has("a:ramp"), "a second ramp in a game has its own key");
// the shared menu row (7 Nov 2026; Auto added 22 Nov 2026): Easy / Medium / Hard / Auto set the ramp read last
ramp("lv", ["a", "b", "c", "d", "e"], { start: "a" });
check(ramp.levels().join() === "easy,medium,hard,auto" && ramp.level() === "auto" && ramp.near() === "easy", "five steps: three levels and Auto, Auto by default, standing on the first");
ramp.won(); ramp.won();
check(store.get("lv:ramp") === "c" && ramp.near() === "medium", "on Auto, wins climb");
check(ramp.pick("hard") === "e" && ramp.level() === "hard" && store.get("lv:ramp") === "e" && store.get("lv:ramp-pick") === "hard", "Hard is the last step, and the pick is kept");
ramp.lost(); ramp.lost(); ramp.won();
check(store.get("lv:ramp") === "e" && ramp.level() === "hard", "a picked level stays put: losses and wins don't move it");
check(ramp.pick("medium") === "c" && ramp.level() === "medium" && ramp.won() === "c", "Medium is the middle step, and stays");
check(ramp.pick("auto") === "c" && ramp.level() === "auto" && ramp.won() === "d" && ramp.lost() === "c", "back on Auto: from where it stood, climbing and falling again");
ramp("lv2", S, { id: "x" }); ramp.pick("easy");
check(store.get("lv2:ramp:x-pick") === "easy" && ramp("lv2", S, { id: "y" }) && ramp.level() === "auto", "each ramp of a game keeps its own pick");
ramp("lw", ["x", "y"], { start: "x" });
check(ramp.levels().join() === "easy,hard,auto" && ramp.pick("medium") === null && ramp.pick("hard") === "y", "two steps: Easy, Hard and Auto");
ramp("lx", ["only"]);
check(ramp.levels().length === 0 && ramp.level() === null && ramp.pick("easy") === null, "one step: no row");
// 25 Nov 2026 (Korbi: Schafkopf's "Monte zero"): an extra level after Hard, with its own label, picked only, never reached by Auto
ramp("mz", S, { start: "hard", extra: [["monte", "Monte zero"]] });
check(ramp.levels().join() === "easy,medium,hard,monte,auto" && ramp.label("monte") === "Monte zero" && ramp.label("hard") === "Hard", "an extra level: after Hard, before Auto, with its own label");
ramp.won(); ramp.won();
check(ramp("mz", S, { extra: [["monte", "Monte zero"]] }) === "hard", "Auto climbs to Hard and no further");
check(ramp.pick("monte") === "monte" && ramp.level() === "monte" && ramp("mz", S, { extra: [["monte", "Monte zero"]] }) === "monte", "picked, the ramp plays it");
check(ramp.lost() === "monte" && ramp.won() === "monte", "and it stays put");
check(ramp.pick("auto") === "hard" && ramp("mz", S, { extra: [["monte", "Monte zero"]] }) === "hard", "Auto again: back on the last step");
check(ramp("mz", S) === "hard" && !ramp.levels().includes("monte"), "a ramp read without it offers no extra level");
// 7 Nov 2026 (Korbi: the Level row showed three times in Lode): the row sits inside the Settings part, so menu.js must look
// for an existing one anywhere in the menu, not only among its direct children.
{ const { readFileSync } = await import("node:fs");
  check(/!body\.querySelector\("\[data-level\]"\)/.test(readFileSync(new URL("../menu.js", import.meta.url), "utf8")), "menu.js adds the Level row once, wherever the first one sits"); }
process.exit(bad ? 1 : 0);
