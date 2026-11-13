// Columbiad's solution measures and bots (columbiad-bots.js), on small samples: the design doc asks of every level a solution
// fraction of 0.2% to 5% (below it a level frustrates, above it is trivial), at least two solution families where the level allows,
// and a best solution that holds under the scatter; and a gap between a blind bot (random shots) and a careful one (the most robust
// solution it finds), which is what thinking is worth. A full sweep is what tools/columbiad-bench.mjs does and says; here a coarse grid.
import { LEVELS, SECTIONS } from "../columbiad-levels.js";
import { PROOFS } from "../columbiad-proofs.js";
import { sweep, fraction, families, robustness, blindRate, careful, play, survey } from "../columbiad-bots.js";
import { shoot } from "../columbiad-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const rows = [];
for (const lvl of SECTIONS.slice(0, 3).flatMap(s => s.levels)) {
  const sw = sweep(lvl, 4, 0.75), frac = fraction(sw), fams = families(sw).filter(f => f.size >= 3);
  rows.push({ lvl, sw, frac, fams: fams.length });
}
check(rows.every(r => r.frac >= 0.002 && r.frac <= 0.1), `every level can be won, none by more than a tenth of the dial's moves: ${rows.map(r => `${r.lvl.id} ${(r.frac * 100).toFixed(1)}%`).join(", ")} of a coarse grid`);
const mean = sec => { const r = rows.filter(x => SECTIONS[sec].levels.includes(x.lvl)); return r.reduce((a, x) => a + x.frac, 0) / r.length; };
check(mean(0) > mean(1) && mean(1) > mean(2), `a ramp: the share of moves that win falls from section to section (${[0, 1, 2].map(k => (mean(k) * 100).toFixed(1) + "%").join(", ")})`);
check(rows.filter(r => r.fams >= 1).length >= 10 && rows.filter(r => r.fams >= 2).length >= 6, `the families the winners fall in: ${rows.map(r => r.fams).join(", ")} (a coarse grid sees fewer than the bench's fine one)`);

// robustness of the stored shots, and the blind bot against them
const gap = [];
for (const lvl of SECTIONS.slice(0, 3).flatMap(s => s.levels)) {
  const best = PROOFS[lvl.id][0], rob = robustness(lvl, best, 20, 5), blind = blindRate(lvl, 200, 17);
  gap.push({ id: lvl.id, rob, blind });
}
check(gap.every(g => g.rob >= 0.5), `the best solution holds under the level's scatter: ${gap.map(g => `${g.id} ${(g.rob * 100).toFixed(0)}%`).join(", ")} of 20 runs`);
check(gap.every(g => g.rob > g.blind * 8), `a careful shot beats a blind one many times over (${gap.map(g => `${(g.rob * 100).toFixed(0)} against ${(g.blind * 100).toFixed(1)}`).join(", ")} per cent)`);
check(gap[0].blind > gap[gap.length - 1].blind, "the first level is the easier for a blind bot, the last the harder");

// the bots play whole levels
{
  const lvl = LEVELS[5], c = careful(lvl, { da: 2, dc: 0.25 }), won = [];
  for (let seed = 1; seed <= 6; seed++) won.push(play(lvl, seed, "careful", 6).shots);
  const blindShots = [];
  for (let seed = 1; seed <= 8; seed++) { const p = play(LEVELS[0], seed, "blind", 90); blindShots.push(p.won ? p.shots : 91); }
  const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  check(shoot(lvl, c, [0, 0]).won && Math.max(...won) <= 6 && median(won) <= 2, `the careful bot's shot wins level ${lvl.id} (${c.angle} degrees, ${c.charge} power) and it needs ${won.join(", ")} shots over six games`);
  check(median(blindShots) <= 60, `the blind bot wins level 1 in a median of ${median(blindShots)} shots (${blindShots.join(", ")})`);
  const sv = survey(lvl, { da: 2, dc: 0.25, runs: 20, per: 3 });
  check(sv.best && sv.best.rob >= 0.5 && sv.picks.length >= 2, "the survey's best pick is a robust one among several");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("columbiad bots: solution fractions, families and robustness on small samples, the careful bot against the blind");
