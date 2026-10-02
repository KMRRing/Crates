// Delta boards: every level deals boards; each has exactly one drawable way of pairing the numbers and sharing
// out the operations, it is the one the board was built from, and the arithmetic alone allows ones the space
// rules out. Run: node tests/delta.mjs
const G = await import("../delta-gen.js");
let bad = 0;
const pairing = s => s.map(x => [x.from, x.to].sort().join("~")).sort().join("|");
for (const lvl of Object.keys(G.LEVELS)) {
  let made = 0, ms = 0, worst = 0;
  for (let seed = 1; seed <= 15; seed++) {
    const t = Date.now(), b = G.generate(seed * 7919, lvl), d = Date.now() - t;
    ms += d; worst = Math.max(worst, d);
    if (!b) { bad++; console.log(`${lvl} seed ${seed}: no board`); continue; }
    made++;
    const { solutions, opKeys } = G.arithmeticSolutions(b, 100);
    const drawable = solutions.filter(s => { const r = G.routeAll(b, opKeys, s); return r && r !== "unknown"; });
    const intended = pairing(b.sol);
    if (drawable.length !== 1 || pairing(drawable[0]) !== intended) { bad++; console.log(`${lvl} seed ${seed}: ${drawable.length} drawable answers`); }
    if (!G.isSolved(b, b.sol.map(p => p.cells))) { bad++; console.log(`${lvl} seed ${seed}: its own solution doesn't check out`); }
    if (solutions.length - drawable.length < G.LEVELS[lvl].decoys) { bad++; console.log(`${lvl} seed ${seed}: too few ruled-out pairings`); }
  }
  console.log(`${lvl}: ${made}/15 boards, average ${Math.round(ms / 15)} ms, slowest ${worst} ms`);
}
console.log(bad ? `${bad} problems` : "all boards check out");
if (bad) process.exitCode = 1;
