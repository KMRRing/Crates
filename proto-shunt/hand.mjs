import { solve, greedyBot, greedyGoalBot, randomBot, value } from "./bots.js";
import { show, start, place, judge } from "./engine.js";

const g1 = (f, n) => Array(n).fill({ k: "g1", f }), br = (f, g, n = 1) => Array(n).fill({ k: "br", f, g }), g2 = (f, n = 1) => Array(n).fill({ k: "g2", f });
export const LEVELS = {
  // 1. TWO CLOCKS: two motors, two outputs, one family each; the trains must stay apart
  one: { w: 5, h: 4, box: ["....." , ".....", ".....", "....."], door: "N",
    fixed: [{ t: "motor", x: 0, y: 3, f: 0, id: 0 }, { t: "motor", x: 4, y: 3, f: 1, id: 1 }, { t: "out", x: 0, y: 0, f: 0, id: 0 }, { t: "out", x: 4, y: 0, f: 1, id: 1 }],
    supply: [...g1(0, 7), ...g1(1, 7)] },
  // 2. THE BRIDGE: motor A must drive an output of family B through a bridge; motor B has its own output and must stay apart
  two: { w: 5, h: 4, box: [".....", ".....", ".....", "....."], door: "N",
    fixed: [{ t: "motor", x: 0, y: 3, f: 0, id: 0 }, { t: "out", x: 4, y: 3, f: 1, id: 0 }, { t: "motor", x: 4, y: 0, f: 1, id: 1 }, { t: "out", x: 2, y: 0, f: 1, id: 1 }],
    supply: [...g1(0, 5), ...g1(1, 4), ...br(0, 1, 1)] },
  // 3. THREE FAMILIES: A -> B -> C needs two bridges; the third bridge (C -> A) is the odd loop
  three: { w: 4, h: 4, box: ["....", "....", "....", "...."], door: "N",
    fixed: [{ t: "motor", x: 0, y: 3, f: 0, id: 0 }, { t: "out", x: 3, y: 0, f: 2, id: 0, dir: +(process.env.DIR || 0) }, { t: "post", x: 1, y: 1 }],
    supply: [...g1(0, 3), ...g1(1, 2), ...g1(2, 2), ...br(0, 1, 1), ...br(1, 2, 1), ...br(2, 0, 1)] },
};
const name = process.argv[2], L = LEVELS[name];
if (name) {
const t0 = Date.now(), sol = solve(L, 400000);
console.log(name, "boards", sol.boards, "capped", sol.capped, "par", sol.score, "won", sol.won, "optimal sets", sol.optimal, Date.now() - t0, "ms");
console.log(show(sol.s.P, sol.s.placed)); console.log("order:", sol.s.placed.map(id => { const p = sol.s.P.places[id]; return `${sol.s.P.kinds[p.kind].key}@${p.x},${p.y}o${p.o}`; }).join(" "));
for (const [n, f] of [["greedy", greedyBot], ["greedyGoal", greedyGoalBot]]) { const r = f(L); console.log(n, "won", r.won, "score", r.score, "placed", r.placed); console.log(show(r.s.P, r.s.placed)); }
const rs = Array.from({ length: 50 }, (_, i) => randomBot(L, i + 1)); console.log("random: wins", rs.filter(r => r.won).length, "/50, best", Math.max(...rs.map(r => r.won ? r.score : -1)), "mean score", (rs.reduce((a, r) => a + r.score, 0) / 50).toFixed(1));
}
