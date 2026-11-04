import { generate } from "./gen.js";
import { show } from "./engine.js";
const tier = +(process.argv[2] ?? 0), n = +(process.argv[3] ?? 5);
for (let seed = 1; seed <= n; seed++) {
  const t0 = Date.now(), g = generate(seed, tier, 300);
  if (!g) { console.log(`seed ${seed}: none`); continue; }
  console.log(`seed ${seed} tries ${g.tries} par ${g.par} win ${g.sol.won} boards ${g.sol.boards} optimal ${g.sol.optimal} greedy ${g.greedy} greedyGoal ${g.greedyGoal} randBest ${g.randBest} randMean ${g.randMean.toFixed(0)} ${Date.now() - t0}ms`);
}
