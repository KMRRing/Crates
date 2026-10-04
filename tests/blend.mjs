const B = await import("../blend-engine.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
check(B.recipes(3, 10).length === 66 && B.recipes(4, 10).length === 286 && B.recipes(3, 5).length === 231 && B.recipes(3, 10).every(r => r.reduce((a, b) => a + b, 0) === 100), "recipe grids: 66 for three components in tens, 286 for four, 231 for three in fives, all summing to 100");
const pars = {};
let problems = 0;
for (const level of Object.keys(B.LEVELS)) {
  pars[level] = [];
  for (let seed = 1; seed <= 25; seed++) {
    const p = B.makePuzzle(seed, level), q = B.makePuzzle(seed, level);
    if (JSON.stringify(p.secret) !== JSON.stringify(q.secret)) problems++;
    const fb = B.compare(p, p.secret);
    if (!fb.every(v => v === 0)) problems++;
    const sol = B.solve(p);
    if (!sol.length || !sol[sol.length - 1].feedback.every(v => v === 0) || JSON.stringify(sol[sol.length - 1].recipe) !== JSON.stringify(p.secret)) problems++;
    if (sol.length !== p.par) problems++;
    pars[level].push(p.par);
    // feedback is consistent with the table: raising a component's share moves a property the way the table says
    const [a, b] = p.props.length ? [0, 1] : [0, 0];
    if (p.comps[a].density !== p.comps[b].density) {
      const hi = p.comps.map((c, i) => (i === a ? 100 : 0)), lo = p.comps.map((c, i) => (i === b ? 100 : 0));
      if ((B.reading(p.comps, hi, "density") > B.reading(p.comps, lo, "density")) !== (p.comps[a].density > p.comps[b].density)) problems++;
    }
  }
}
const avg = xs => (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1);
check(problems === 0, `100 puzzles: repeatable, the secret reads "the same" on all properties, the solver finds it and its count is the par (average par easy ${avg(pars.easy)}, medium ${avg(pars.medium)}, hard ${avg(pars.hard)}, expert ${avg(pars.expert)})`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
