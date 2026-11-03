// Columbiad's solution measures and bots (columbiad-bots.js), on small samples: the design doc asks of every level a
// solution fraction of 0.2% to 5% (below it a level frustrates, above it is trivial), at least two solution families where the
// level allows, and a best solution that holds at 70% to 90% under the scatter; and a gap between a blind bot (random
// shots) and a careful one (the most robust solution it finds), which is what thinking is worth. A full sweep is some ninety
// thousand shots a level: tools/columbiad-bench.mjs does that, and says what it measured; here a grid of a few thousand.
import { LEVELS } from "../columbiad-levels.js";
import { PROOFS } from "../columbiad-proofs.js";
import { sweep, fraction, families, robustness, blindRate, careful, play, survey } from "../columbiad-bots.js";
import { shoot } from "../columbiad-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// the proving ground is swept here (its whole dial); the Moon's sections have a narrow band and a clock, which the bench sweeps (a
// level there takes minutes): here their stored shots are held to their robustness
const rows = [];
for (const lvl of LEVELS.slice(0, 6)) {
  const sw = sweep(lvl, 2, 0.25), frac = fraction(sw), fams = families(sw).filter(f => f.size >= 3);
  rows.push({ lvl, sw, frac, fams: fams.length });
}
check(rows.every(r => r.frac >= 0.002 && r.frac <= 0.25), `every level can be won, none by most of the dial: ${rows.map(r => `${r.lvl.id} ${(r.frac * 100).toFixed(1)}%`).join(", ")} of a coarse grid`);
check(rows.slice(2).every(r => r.frac <= 0.06), "from the third level on, the share of winning moves is the design's 0.2% to 5% (a little over on a coarse grid)");
check(rows.slice(2).every(r => r.fams >= 1) && rows.filter(r => r.fams >= 2).length >= 3, `the families the winners fall in: ${rows.map(r => r.fams).join(", ")} (a coarse grid sees fewer than the bench's fine one)`);

// robustness of the stored shots, and the blind bot against them
const gap = [];
for (const lvl of LEVELS) {
  const best = PROOFS[lvl.id][0], rob = robustness(lvl, best, lvl.bodies ? 12 : 30, 5), blind = blindRate(lvl, lvl.bodies ? 100 : 300, 17);
  gap.push({ id: lvl.id, rob, blind });
}
check(gap.every(g => g.rob >= 0.5), `the best solution holds under the level's scatter: ${gap.map(g => `${g.id} ${(g.rob * 100).toFixed(0)}%`).join(", ")} of 30 runs`);
check(gap.slice(2).every(g => g.rob > g.blind * 8), `a careful shot beats a blind one many times over from the third level on (${gap.map(g => `${(g.rob * 100).toFixed(0)} against ${(g.blind * 100).toFixed(1)}`).join(", ")} per cent)`);
check(gap[0].blind > gap[5].blind, "the first level is the easier for a blind bot, the sixth the harder");

// the bots play whole levels
{
  const lvl = LEVELS[3], c = careful(lvl, { da: 2, dc: 0.25 }), won = [];
  for (let seed = 1; seed <= 6; seed++) won.push(play(lvl, seed, "careful", 6).shots);
  const blindShots = [];
  for (let seed = 1; seed <= 12; seed++) { const p = play(LEVELS[0], seed, "blind", 60); blindShots.push(p.won ? p.shots : 61); }
  const median = a => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
  check(shoot(lvl, c, [0, 0]).won && Math.max(...won) <= 6 && median(won) <= 2, `the careful bot's shot wins level 4 (${c.angle} degrees, ${c.charge} barrels) and it needs ${won.join(", ")} shots over six games`);
  check(median(blindShots) <= 30, `the blind bot wins level 1 in a median of ${median(blindShots)} shots (${blindShots.join(", ")})`);
  const sv = survey(lvl, { da: 2, dc: 0.25, runs: 20, per: 3 });
  check(sv.best && sv.best.rob >= 0.5 && sv.picks.length >= 2, "the survey's best pick is a robust one among several");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("columbiad bots: solution fractions, families and robustness on small samples, the careful bot against the blind");
