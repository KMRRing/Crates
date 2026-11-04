// Courier's Feel lab: the tuning object reproduces Korbi's Feel lab round (4 November 2026, 22:19 UTC) exactly, a tuned value reaches the rules (and a coyote jump works),
// the search converges for a simulated answerer, every test's stretch builds, and the results text holds everything.
import { DEFAULTS, airTime, T, setTune, resetTune } from "../reckoning-tune.js";
import { newGame, swipe, step, take, speed, GULL_UP_WIN, GATE_WIN, G, JUMP_V, HOP_V, CHAIN_V, BONK_V, WALLJUMP_V, PAD_V, SLAM_MIN_Y, LANE_T, LANE_W } from "../reckoning-engine.js";
import { TESTS, Search, stretch, cleanFeel, resultsText } from "../reckoning-lab.js";
import { copy } from "../reckoning-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const DT = 1 / 120;

// 1. the defaults are his lab round's, bit for bit
resetTune();
const g0 = 8 * 2.1 / (0.69 * 0.69), pk = h => Math.sqrt(2 * g0 * h);
check(T.G === g0 && G === g0 && T.JUMP_V === g0 * 0.69 / 2 && JUMP_V === T.JUMP_V, "gravity and the jump's speed come out as they did");
check(T.HOP_V === pk(0.9) && T.CHAIN_V === pk(1.7) && T.BONK_V === pk(1.9) && T.WALLJUMP_V === pk(2.27) && T.PAD_V === pk(4.3), "the hop, chain, bonk, wall jump and pad");
check(HOP_V === T.HOP_V && CHAIN_V === T.CHAIN_V && BONK_V === T.BONK_V && WALLJUMP_V === T.WALLJUMP_V && PAD_V === T.PAD_V && SLAM_MIN_Y === T.SLAM_MIN_Y && LANE_T === T.LANE_T, "and the engine's exported ones agree");
check(T.LANE_OMEGA === 45 && T.BUFFER === 0.22 && T.LAND_BUFFER === 0.27 && T.ROLL_T === 0.5 && T.FRONT_WIN === 0.3 && T.ABOVE_WIN === 0.83 && T.SIDE_WIN === 0.79 && T.FALL === 1.18 && T.COYOTE === 0.167, "the windows and times");
check(T.SWIPE_PX === 22 && T.SWIPE_MID === 1 && T.HITSTOP === 0.014 && T.CAM_FOLLOW === 1.22 && T.CAM_KICK === 0.45 && T.WALLJUMP_H === 2.27 && T.JUMP_H === 2.1 && T.AIR_T === 0.69, "and the page's and the view's");
check(GULL_UP_WIN >= T.ABOVE_WIN && GULL_UP_WIN <= GATE_WIN, "a gull in my own lane that has seen me is jumped at from at least as far as a plain one, and no further than a question's");

// 2. a plain jump is the same in every step with the defaults, and different when tuned
function jumpTrace() {
  const S = newGame({ seed: 5 }); S.world.foes = []; S.world.pits = []; S.world.walls = []; S.world.gates = []; S.world.z1 = 1e9;
  swipe(S, "up"); take(S);
  const ys = []; let peak = 0, t = 0;
  while (S.hero.mode === "air" && t < 3) { step(S, DT); take(S); ys.push(S.hero.y); peak = Math.max(peak, S.hero.y); t += DT; }
  return { peak, t, ys };
}
const base = jumpTrace();
check(Math.abs(base.peak - 2.1) < 0.09 && Math.abs(base.t - airTime()) < 0.03 && base.t < 0.69, "a jump peaks at 2.1 m and lasts 0.66 s (0.69 s up and down at equal gravity, less with the quicker fall)");
setTune({ FALL: 2 });
const heavy = jumpTrace();
check(Math.abs(heavy.peak - base.peak) < 0.06 && heavy.t < base.t - 0.03, "a stronger fall keeps the peak and shortens the jump");
setTune({ FALL: 1, JUMP_H: 2.6 });
check(jumpTrace().peak > 2.5, "a tuned jump height reaches the rules");
resetTune();
check(JSON.stringify(jumpTrace().ys) === JSON.stringify(base.ys), "back to the defaults, the same jump to the last digit");

// 3. coyote time: a jump a moment after the planks end
function edgeJump(coyote, wait) {
  resetTune(); setTune({ COYOTE: coyote });
  const S = newGame({ seed: 5 }); S.world.foes = []; S.world.walls = []; S.world.gates = []; S.world.z1 = 1e9;
  S.world.pits = [{ z0: 3, z1: 12 }];
  while (S.hero.mode === "run") { step(S, DT); take(S); }
  for (let t = 0; t < wait; t += DT) { step(S, DT); take(S); }
  swipe(S, "up"); const up = take(S).some(e => e.type === "jump");
  resetTune();
  return up && S.hero.vy > 0;
}
check(!edgeJump(0, 0.06), "with no coyote time a jump just after the edge does nothing");
check(edgeJump(0.1, 0.06), "with 0.1 s a jump 0.06 s after the edge is a jump");
check(!edgeJump(0.167, 0.25), "and not 0.25 s after it");

// the default: a jump pressed at the very end of the grace still clears a 4 m gap, the narrowest Courier lays, and one pressed at the lip clears the widest (6 m), at the speed it is laid for
function clears(wait, width) {
  resetTune();
  const S = newGame({ seed: 5 }); S.world.foes = []; S.world.walls = []; S.world.gates = []; S.world.z1 = 1e9;
  S.world.pits = [{ z0: 3, z1: 3 + width }];
  while (S.hero.mode === "run") { step(S, DT); take(S); }
  for (let t = 0; t < wait; t += DT) { step(S, DT); take(S); }
  swipe(S, "up");
  for (let t = 0; t < 3 && !S.over && S.hero.z < 3 + width + 2; t += DT) { step(S, DT); take(S); }
  return !S.over && S.hearts === S.maxHearts && S.hero.z > 3 + width;
}
check(clears(0.15, 4), "with the default grace a jump 0.15 s after the lip clears a 4 m gap");
check(clears(0, 6), "and one at the lip clears a 6 m gap");
check(!clears(0.25, 4), "and one 0.25 s after it does not");

// 4. the search converges on a simulated answerer
const rng = seed => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function simulate(test, target, noise, trials, r) {
  const s = new Search(test, test.start ?? DEFAULTS[test.key], trials);
  let asked = 0;
  while (!s.done && asked < 12) {
    const { lo, hi } = s.pair(); asked++;
    const dl = Math.abs(lo - target) + (r() - 0.5) * noise, dh = Math.abs(hi - target) + (r() - 0.5) * noise;
    let a;
    if (target > hi) a = "more"; else if (target < lo) a = "less";
    else a = Math.abs(dl - dh) < (test.hi - test.lo) * 0.01 ? "same" : dl < dh ? "lo" : "hi";
    s.answer(a);
  }
  return { value: s.result(), asked, range: test.hi - test.lo };
}
{
  const r = rng(7); let worst = 0, most = 0;
  for (const t of TESTS.filter(t => !t.binary)) {
    for (const f of [0.2, 0.5, 0.8]) {
      const target = t.lo + (t.hi - t.lo) * f;
      const out = simulate(t, target, 0, 4, r);
      worst = Math.max(worst, Math.abs(out.value - target) / out.range); most = Math.max(most, out.asked);
    }
  }
  check(worst < 0.1, `a handful of answers lands within a tenth of the range of what the answerer wants (worst ${(worst * 100).toFixed(1)}%)`);
  check(most <= 4, `and takes at most 4 comparisons (${most})`);
  const t = TESTS.find(x => x.id === "lane");
  const out = simulate(t, 50, 0, 8, r);
  check(Math.abs(out.value - 50) < 0.04 * out.range, "given more comparisons it closes in");
  const a = simulate(t, 41, 0, 3, rng(1)).value, b = simulate(t, 41, 0, 3, rng(1)).value;
  check(a === b, "and is repeatable");
  const bin = TESTS.find(x => x.binary), sb = new Search(bin, 1);
  sb.answer("hi"); sb.answer("hi");
  check(sb.done && sb.result() === 0, "the two-way test goes to the one preferred");
  const lim = new Search(t, 34); lim.answer("more"); lim.answer("more"); lim.answer("more");
  check(lim.done && lim.result() > 34, "both too slow, three times, moves the value up");
}

// 5. every stretch builds, is the same from the same seed, and lasts 8 to 15 seconds
{
  const kinds = [...new Set(TESTS.map(t => t.stretch))];
  let ok = true, msg = "";
  for (const k of kinds) {
    const def = stretch(k, 3);
    if (JSON.stringify(def) !== JSON.stringify(stretch(k, 3))) { ok = false; msg = `${k} differs`; }
    const S = newGame({ seed: 1, section: def, launch: true });
    const secs = (S.world.finish - def.lead) / def.v0 + def.lead / def.v0;
    if (secs < 7 || secs > 16) { ok = false; msg = `${k} is ${secs.toFixed(1)} s`; }
  }
  check(ok, `all ${kinds.length} stretches build, repeat and last 8 to 15 s${msg ? " (" + msg + ")" : ""}`);
}

// 6. what is kept, and the text
{
  const feel = cleanFeel({ use: 1, values: { LANE_OMEGA: 40, bogus: 3 }, done: { LANE_OMEGA: 40 }, results: [{ t: "lane", a: 28, b: 48, ans: "B" }, { t: "lane", a: 40, b: 44, ans: "more" }], flags: [{ at: "2026-11-04 10:00:00", where: "run, 100 m", lines: ["#1 t=1.00 | swipe UP"], note: "late" }] });
  check(feel.use === true && !("bogus" in feel.values) && cleanFeel(null).results.length === 0, "a kept record is cleaned");
  const text = resultsText(feel, "test");
  check(/Lane change/.test(text) && /A 28 {2}B 48 {2}->  B \(48\)/.test(text) && /both too slow/.test(text) && /note: late/.test(text) && /#1 t=1.00/.test(text) && /CONVERGED/.test(text), "the text has the comparisons, the values and the flags");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("courier feel lab: defaults exact, the tunables reach the rules, the search converges");
