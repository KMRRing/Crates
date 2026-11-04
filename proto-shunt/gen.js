// Level generator for SHUNT-PACK: random box + fixed parts + supply, accepted only when the exact solver finds a win
// and the bots lose to it. The daily is generate(seedOfTheDay, tier).
import { rng } from "./engine.js";
import { solve, greedyBot, greedyGoalBot, randomBot, value } from "./bots.js";

const TIERS = [
  { w: [4, 5], h: [4, 5], walls: 1, fams: 2, motors: 1, supply: [7, 9], bridges: [1, 2], big: 0, posts: 1 },
  { w: [5, 6], h: [5, 6], walls: 3, fams: 2, motors: 2, supply: [9, 11], bridges: [2, 3], big: 1, posts: 2 },
  { w: [6, 6], h: [6, 6], walls: 4, fams: 3, motors: 2, supply: [10, 12], bridges: [3, 4], big: 2, posts: 2 },
];
const ri = (R, [a, b]) => a + Math.floor(R() * (b - a + 1));

export function candidate(seed, tier = 0) {
  const R = rng(seed * 7919 + tier), T = TIERS[tier], w = ri(R, T.w), h = ri(R, T.h);
  const door = "NSEW"[Math.floor(R() * 4)], grid = Array.from({ length: h }, () => Array(w).fill("."));
  for (let k = 0; k < T.walls; k++) grid[Math.floor(R() * h)][Math.floor(R() * w)] = "#";
  const free = () => { for (let t = 0; t < 99; t++) { const x = Math.floor(R() * w), y = Math.floor(R() * h); if (grid[y][x] === "." && !taken.has(x + "," + y)) return [x, y]; } return null; };
  const taken = new Set(), fixed = [];
  const claim = (x, y, s) => { for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) taken.add((x + dx) + "," + (y + dy)); };
  for (let m = 0; m < T.motors; m++) {
    const f = m % T.fams, p = free(); if (!p) return null; claim(p[0], p[1], 1);
    fixed.push({ t: "motor", x: p[0], y: p[1], size: 1, f, id: m });
  }
  for (let m = 0; m < T.motors; m++) {
    // output: of a different family than its motor half the time, which forces a bridge
    const f = R() < 0.5 ? (m + 1) % T.fams : m % T.fams, p = free(); if (!p) return null; claim(p[0], p[1], 1);
    fixed.push({ t: "out", x: p[0], y: p[1], size: 1, f, id: m, dir: R() < 0.5 ? 0 : (R() < 0.5 ? 1 : -1) });
  }
  for (let k = 0; k < T.posts; k++) { const p = free(); if (p) { claim(p[0], p[1], 1); fixed.push({ t: "post", x: p[0], y: p[1] }); } }
  const supply = [], n = ri(R, T.supply), nb = ri(R, T.bridges);
  for (let k = 0; k < nb; k++) { const f = Math.floor(R() * T.fams); let g = Math.floor(R() * T.fams); if (R() < 0.8) g = (f + 1 + Math.floor(R() * (T.fams - 1))) % T.fams; supply.push({ k: "br", f, g }); }
  for (let k = 0; k < T.big; k++) supply.push({ k: "g2", f: Math.floor(R() * T.fams) });
  while (supply.length < n) supply.push({ k: "g1", f: Math.floor(R() * T.fams) });
  return { w, h, box: grid.map(r => r.join("")), door, fixed, supply, seed, tier };
}

/** A level worth playing: winnable, solver result stated, and it beats every bot by at least `margin`. */
export function judgeLevel(L, opts = {}) {
  const sol = solve(L, opts.cap || 150000);
  if (sol.capped || !sol.won) return null;
  const g1 = greedyBot(L), g2 = greedyGoalBot(L), rs = Array.from({ length: 20 }, (_, i) => randomBot(L, i + 1));
  const rBest = Math.max(...rs.map(value)), rMean = rs.reduce((a, r) => a + value(r), 0) / rs.length;
  const gBest = Math.max(value(g1), value(g2));
  return { sol, greedy: value(g1), greedyGoal: value(g2), randBest: rBest, randMean: rMean, gap: sol.best - gBest, par: sol.score };
}

export function generate(seed, tier = 0, tries = 400) {
  for (let t = 0; t < tries; t++) {
    const L = candidate(seed * 1000 + t, tier); if (!L) continue;
    const r = judgeLevel(L, { cap: 60000 });
    if (r && r.gap >= 3 && r.sol.optimal <= 6 && r.par >= 6 + tier * 2) return { level: L, ...r, tries: t + 1 };
  }
  return null;
}
