// Spot's engine: timelines are sound (whole, positive results; no clashes on screen), replays are deterministic, a
// perfect player never loses a life, a careless one does, the shelf gives nothing away (each number comes early, at a
// moment and in a slot of its own), and together the answers sit on the other player's shelf.
const S = await import("../spot-engine.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// the solo timeline: what the shelf shows (the answer as modified) never clashes with another sum's or a fake's
let modded = 0, total = 0;
for (let seed = 1; seed <= 30; seed++) {
  const sums = S.timeline(seed * 7919, 1, 180000);
  for (const s of sums) {
    total++;
    if (s.mod) modded++;
    if (!(Number.isInteger(s.answer) && s.answer > 0)) { bad++; console.log("not a whole positive answer", s); }
    if (s.kind === "div") { const [a, b] = s.text.split(" ÷ ").map(Number); if (a / b !== s.answer) { bad++; console.log("division not exact", s); } }
    if (s.value !== S.applyMod(s.mod, s.answer)) { bad++; console.log("the value isn't the modified answer", s); }
    const together = sums.filter(o => o !== s && Math.abs(o.at - s.at) < Math.max(o.life, s.life));
    const lately = sums.filter(o => o !== s && o.at > s.at - S.NEAR && o.at <= s.at);          // the engine's own window
    if (s.mod && !lately.some(o => o.value === s.answer) && !s.fakes.some(f => f.value === s.answer)) { bad++; console.log("with a modifier, the unmodified answer should be a fake", s.text); }
    if (together.some(o => o.value === s.value)) { bad++; console.log("two sums on screen show the same value", s.text); }
    if (together.some(o => o.fakes.some(f => f.value === s.value)) || s.fakes.some(f => together.some(o => o.value === f.value))) { bad++; console.log("a fake matches a value on screen", s.text); }
    if (s.at < 45000 && s.mod) { bad++; console.log("a modifier before 45 s"); }
  }
}
check(bad === 0, `solo timelines: whole positive answers, exact divisions, modified values never clash, the unmodified answer is planted as a fake (${modded} of ${total} sums under a modifier)`);
// the pace: a slow rise in difficulty, with cheap sums coming quickly and dear ones buying time (over twenty runs: one
// run's thirty seconds hold only a dozen sums)
{
  const BASE = { add: 1, sub: 1, mul: 2, div: 3 };
  const costOf = s => { const mod = s.mod ? 1 : 0, big = s.points - mod - BASE[s.kind]; return BASE[s.kind] + big + mod; };   // the engine's: kind, bigger numbers, modifier
  const avg = xs => xs.reduce((t, x) => t + x, 0) / xs.length;
  let loadEarly = 0, loadLate = 0, nEarly = 0, nLate = 0, divEarly = 0;
  const gapsCostly = [], gapsCheap = [];
  for (let seed = 1; seed <= 20; seed++) {
    const sums = S.timeline(seed * 31 + 3, 1, 240000);
    const gapAfter = s => { const n = sums.find(o => o.at > s.at); return n ? n.at - s.at : null; };
    const early = sums.filter(s => s.at < 30000), late = sums.filter(s => s.at > 180000 && s.at < 210000);
    loadEarly += early.reduce((t, s) => t + costOf(s), 0) / 30 / 20; loadLate += late.reduce((t, s) => t + costOf(s), 0) / 30 / 20;
    nEarly += early.length / 20; nLate += late.length / 20; divEarly += early.filter(s => s.kind === "div").length;
    gapsCostly.push(...sums.filter(s => s.kind === "div" && gapAfter(s)).map(gapAfter));
    gapsCheap.push(...sums.filter(s => s.kind === "add" && !s.mod && gapAfter(s)).map(gapAfter));
  }
  const gapCostly = avg(gapsCostly), gapCheap = avg(gapsCheap);
  console.log(`pace: ${nEarly.toFixed(1)} sums in the first 30 s, ${nLate.toFixed(1)} in 180–210 s; difficulty a second ${loadEarly.toFixed(2)} then ${loadLate.toFixed(2)}; after a division the next sum waits ${(gapCostly / 1000).toFixed(1)} s, after a plain addition ${(gapCheap / 1000).toFixed(1)} s`);
  check(loadLate > loadEarly * 1.8 && nLate >= nEarly * 0.7 && nLate <= nEarly * 3 && gapCostly > gapCheap * 1.8 && divEarly === 0, "pace: difficulty a second roughly doubles by three minutes without the count exploding, divisions buy time, none in the first 30 s");
}

// replays are deterministic and depend only on seed and taps
const run = { seed: 42, seats: 1 };
const a = JSON.stringify(S.play(run, [], 60000)), b = JSON.stringify(S.play(run, [], 60000));
check(a === b, "the same seed and taps give the same game");

// a perfect player: taps every answer 1.5 s after its sum appears
function perfect(runDef, until, delay = 1500) {
  const taps = [];
  for (const s of S.timeline(runDef.seed, runDef.seats, until)) if (s.at + delay <= until) taps.push({ id: `t${s.id}`, t: s.at + delay, seat: s.shelf, token: `s${s.id}` });
  return S.play(runDef, taps, until);
}
const p = perfect({ seed: 7, seats: 1 }, 150000);
check(p.lives === S.LIVES && !p.over && p.missed === 0 && p.cleared > 35, `a perfect player clears everything (${p.cleared} sums in 2½ minutes, score ${p.score}, best streak ${p.best})`);
const late = perfect({ seed: 7, seats: 1 }, 240000, 5000);
check(late.over && late.missed > 0 && late.over.at > 40000, `a player who takes 5 s a sum is fine at first and runs out of lives as sums quicken (out after ${Math.round(late.over?.at / 1000)} s)`);

// wrong taps cost lives
const sums = S.timeline(9, 1, 20000);
const wrong = sums.slice(0, 3).map((s, k) => ({ id: `w${k}`, t: s.at + 500, seat: 0, token: s.fakes[0]?.id })).filter(x => x.token);
const w = S.play({ seed: 9, seats: 1 }, wrong, 20000);
check(w.wrong === wrong.length && w.lives === S.LIVES - wrong.length, `wrong taps cost a life each (${w.wrong} wrong, ${w.lives} lives left)`);

// a double tap counts once
const once = S.play({ seed: 9, seats: 1 }, [{ id: "a", t: sums[0].at + 400, seat: 0, token: "s0" }, { id: "b", t: sums[0].at + 450, seat: 0, token: "s0" }], sums[0].at + 1000);
check(once.cleared === 1 && once.lives === S.LIVES, "a double tap clears once and costs nothing");

// the shelf gives nothing away: each number (an answer or a fake) comes onto it at a moment of its own, 0.3–3.5 s
// before its sum flies in, in a free slot picked at random; so where an answer sits, and whether it's the newest
// number, say no more than chance (the answer used to land in the first slot nine times in ten)
{
  let early = 0, numbers = 0;
  for (let seed = 1; seed <= 30; seed++) for (const s of S.timeline(seed * 7919, 1, 180000)) for (const x of [s, ...s.fakes]) {
    numbers++;
    if (x.shown === Math.max(0, Math.round(x.shown)) && x.shown <= s.at - S.LEAD[0] && (x.shown >= s.at - S.LEAD[1] || x.shown === 0)) early++;
  }
  check(early === numbers, `every number comes onto the shelf 0.3–3.5 s before its sum (${early} of ${numbers})`);
  let n = 0, newest = 0, missing = 0;
  const slots = Array(S.SHELF).fill(0);
  for (let seed = 1; seed <= 12; seed++) {
    const run = { seed: seed * 7919, seats: 1 }, sums = S.timeline(run.seed, 1, 150000);
    const taps = sums.map(s => ({ id: `t${s.id}`, t: s.at + 1500, seat: 0, token: `s${s.id}` }));   // a perfect player
    for (const s of sums) {
      const st = S.play(run, taps.filter(x => x.t < s.at), s.at), shelf = st.shelves[0];
      const k = shelf.findIndex(x => x && x.id === `s${s.id}`);
      if (k < 0) { missing++; continue; }
      n++; slots[k]++;
      const born = shelf.filter(Boolean).map(x => x.born), max = Math.max(...born);
      if (shelf[k].born === max && born.filter(b => b === max).length === 1) newest++;
    }
    // and while a sum is on screen, its answer is on the shelf
    for (let t = 2000; t < 150000; t += 700) {
      const st = S.play(run, taps.filter(x => x.t <= t), t);
      for (const s of st.sums) if (!st.shelves[0].some(x => x && x.id === `s${s.id}`)) missing++;
    }
  }
  console.log(`shelf: ${n} answers as their sums appeared, by slot ${slots.map(c => Math.round(100 * c / n)).join("/")}%, the newest number on the shelf ${Math.round(100 * newest / n)}%, ${missing} missing`);
  check(!missing && Math.max(...slots) < n * 0.25 && newest < n * 0.4, "the shelf gives nothing away: every sum on screen has its answer there, in a slot no likelier than the others, and seldom the newest number");
}

// an answer tapped before its sum arrives answers nothing yet: a wrong tap, once however fast the taps, and the number
// stays on the shelf for when its sum comes
{
  const run = { seed: 9, seats: 1 }, sums = S.timeline(run.seed, 1, 60000);
  const s = sums.find(x => x.shown < x.at - 600 && x.shown > 0);
  const tooSoon = [{ id: "e1", t: s.shown + 100, seat: 0, token: `s${s.id}` }, { id: "e2", t: s.shown + 150, seat: 0, token: `s${s.id}` }];
  const before = S.play(run, tooSoon, s.at - 1);
  const after = S.play(run, [...tooSoon, { id: "e3", t: s.at + 400, seat: 0, token: `s${s.id}` }], s.at + 800);
  check(before.wrong === 1 && before.lives === S.LIVES - 1 && before.shelves[0].some(x => x && x.id === `s${s.id}`) && after.cleared === 1 && after.lives === S.LIVES - 1,
    "an answer tapped before its sum arrives is one wrong tap (a double tap counts once) and stays for when its sum comes");
}

// together: pairs across the two screens, decoys with no partner
{
  let problems = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const sums = S.duoTimeline(seed * 104729, 180000);
    const pairs = new Map();
    for (const x of sums) if (x.pair != null) pairs.set(x.pair, [...(pairs.get(x.pair) || []), x]);
    for (const [, two] of pairs) {
      if (two.length !== 2) continue;                                   // the partner may be due after the cut-off
      const [p, q] = two;
      if (p.seat === q.seat || p.value !== q.value || S.applyMod(p.mod, p.answer) !== p.value || S.applyMod(q.mod, q.answer) !== q.value || q.at - p.at < 600 || q.at - p.at > 4000) { problems++; console.log("a bad pair", p, q); }
      if (p.mod && p.mod === q.mod && p.text === q.text) { problems++; console.log("a pair of identical sums", p, q); }
    }
    for (const x of sums) {
      const clash = sums.find(o => o !== x && o.value === x.value && Math.abs(o.at - x.at) < 13000 && !(x.pair != null && o.pair === x.pair));
      if (clash) { problems++; console.log("a number that means two things", x.text, clash.text); break; }
    }
  }
  check(problems === 0, "together: pairs are two sums making one number after each seat's own modifier, one on each screen, 0.6–4 s apart; no number means two things");
}
{
  const until = 150000, sums = S.duoTimeline(21, until), taps = [];
  // a perfect pair: whoever sees the second sum of a pair taps it 0.8 s after it appears (the first was called out)
  const seenPair = new Set();
  for (const x of [...sums].reverse()) if (x.pair != null && !seenPair.has(x.pair)) { seenPair.add(x.pair); if (x.at + 800 <= until) taps.push({ id: `t${x.id}`, t: x.at + 800, seat: x.seat, sum: x.id }); }
  const st = S.play({ seed: 21, seats: 2 }, taps, until);
  check(st.lives === S.LIVES && st.missed === 0 && st.wrong === 0 && st.cleared > 20, `together: a perfect pair clears every pair (${st.cleared}) and leaves the decoys alone`);
  const decoy = sums.find(x => x.pair == null);
  // the same perfect play, plus one tap on a decoy
  const d = S.play({ seed: 21, seats: 2 }, [...taps, { id: "d", t: decoy.at + 300, seat: decoy.seat, sum: decoy.id }], until);
  check(d.wrong === 1 && d.lives === S.LIVES - 1, "together: tapping a decoy costs a life");
  const early = sums.find(x => x.pair != null);
  const later = sums.find(x => x.pair === early.pair && x.id !== early.id);
  const e = S.play({ seed: 21, seats: 2 }, [{ id: "e", t: early.at + 300, seat: early.seat, sum: early.id }], later.at + 500);
  check(e.cleared === 1 && !e.sums.some(x => x.id === later.id), "together: tapping a sum clears its partner too, even one still to appear");
  const idle = S.play({ seed: 21, seats: 2 }, [], 40000);
  check(idle.missed > 0 && idle.lives < S.LIVES, `together: pairs nobody taps cost lives (${idle.missed} missed by 40 s)`);
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
