import { LEVELS } from "./hand.mjs";
import { solve } from "./bots.js";
import { place, start, rng } from "./engine.js";

const R = rng(5);
for (const name of ["one", "two", "three"]) {
  const L = LEVELS[name], sol = solve(L, 400000), ids = sol.s.placed; let okN = 0; const N = 2000;
  for (let t = 0; t < N; t++) {
    const p = ids.slice(); for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    let s = start(L), good = true; for (const id of p) { const r = place(s, id); if (!r.ok) { good = false; break; } s = r.state; }
    if (good) okN++;
  }
  console.log(name, "pieces", ids.length, "random orders that work:", (100 * okN / N).toFixed(1) + "%");
}
