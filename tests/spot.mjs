// Spot's engine: timelines are sound (whole, positive results; no clashes on screen), replays are deterministic, a
// perfect player never loses a life, a careless one does, and together the answers sit on the other player's shelf.
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
    const lately = sums.filter(o => o !== s && o.at > s.at - 12100 && o.at <= s.at);          // the engine's own window
    if (s.mod && !lately.some(o => o.value === s.answer) && !s.fakes.some(f => f.value === s.answer)) { bad++; console.log("with a modifier, the unmodified answer should be a fake", s.text); }
    if (together.some(o => o.value === s.value)) { bad++; console.log("two sums on screen show the same value", s.text); }
    if (together.some(o => o.fakes.some(f => f.value === s.value)) || s.fakes.some(f => together.some(o => o.value === f.value))) { bad++; console.log("a fake matches a value on screen", s.text); }
    if (s.at < 45000 && s.mod) { bad++; console.log("a modifier before 45 s"); }
  }
}
check(bad === 0, `solo timelines: whole positive answers, exact divisions, modified values never clash, the unmodified answer is planted as a fake (${modded} of ${total} sums under a modifier)`);
// the pace: a slow rise in difficulty, with cheap sums coming quickly and dear ones buying time
{
  const sums = S.timeline(3, 1, 240000);
  const gapAfter = s => { const n = sums.find(o => o.at > s.at); return n ? n.at - s.at : null; };
  const early = sums.filter(s => s.at < 30000), late = sums.filter(s => s.at > 180000 && s.at < 210000);
  const costly = sums.filter(s => s.kind === "div" && gapAfter(s)), cheap = sums.filter(s => s.kind === "add" && !s.mod && gapAfter(s));
  const avg = xs => xs.reduce((t, x) => t + x, 0) / xs.length;
  const gapCostly = avg(costly.map(gapAfter)), gapCheap = avg(cheap.map(gapAfter));
  const COST = { add: 1, sub: 1, mul: 2, div: 3 }, costOf = s => COST[s.kind] + (s.mod ? 1 : 0) + (/\d\d/.test(s.text) && s.kind !== "div" ? 0 : 0);
  const loadEarly = early.reduce((t, s) => t + costOf(s), 0) / 30, loadLate = late.reduce((t, s) => t + costOf(s), 0) / 30;
  console.log(`pace: ${early.length} sums in the first 30 s, ${late.length} in 180–210 s; difficulty a second ${loadEarly.toFixed(2)} then ${loadLate.toFixed(2)}; after a division the next sum waits ${(gapCostly / 1000).toFixed(1)} s, after a plain addition ${(gapCheap / 1000).toFixed(1)} s`);
  check(loadLate > loadEarly * 1.8 && late.length >= early.length * 0.7 && late.length <= early.length * 3 && gapCostly > gapCheap * 1.8 && early.every(s => s.kind !== "div"), "pace: difficulty a second roughly doubles by three minutes without the count exploding, divisions buy time, none in the first 30 s");
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
