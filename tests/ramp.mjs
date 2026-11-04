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
process.exit(bad ? 1 : 0);
