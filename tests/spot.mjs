// Spot's engine: timelines are sound (whole, positive results; no clashes on screen), replays are deterministic, a
// perfect player never loses a life, a careless one does, and together the answers sit on the other player's shelf.
const S = await import("../spot-engine.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// the timeline
for (const seats of [1, 2]) {
  for (let seed = 1; seed <= 30; seed++) {
    const sums = S.timeline(seed * 7919, seats, 180000);
    for (const s of sums) {
      if (!(Number.isInteger(s.answer) && s.answer > 0)) { bad++; console.log("not a whole positive answer", s); }
      if (s.kind === "div") { const [a, b] = s.text.split(" ÷ ").map(Number); if (a / b !== s.answer) { bad++; console.log("division not exact", s); } }
      const together = sums.filter(o => o !== s && Math.abs(o.at - s.at) < Math.max(o.life, s.life));
      if (together.some(o => o.answer === s.answer)) { bad++; console.log("two sums on screen share an answer", s.text); }
      if (together.some(o => o.fakes.some(f => f.value === s.answer)) || s.fakes.some(f => together.some(o => o.answer === f.value))) { bad++; console.log("a fake matches a sum on screen", s.text); }
      if (seats === 2 && s.shelf === s.seat) { bad++; console.log("together, an answer on the same player's shelf"); }
    }
  }
}
check(bad === 0, "timelines: whole positive answers, exact divisions, no answer or fake clashes on screen, answers on the partner's shelf");

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
check(p.lives === S.LIVES && !p.over && p.missed === 0 && p.cleared > 60, `a perfect player clears everything (${p.cleared} sums in 2½ minutes, score ${p.score}, best streak ${p.best})`);
const late = perfect({ seed: 7, seats: 1 }, 150000, 7000);
check(late.over && late.missed > 0, `a player who's too slow runs out of lives once sums speed up (out after ${Math.round(late.over.at / 1000)} s)`);

// wrong taps cost lives
const sums = S.timeline(9, 1, 20000);
const wrong = sums.slice(0, 3).map((s, k) => ({ id: `w${k}`, t: s.at + 500, seat: 0, token: s.fakes[0]?.id })).filter(x => x.token);
const w = S.play({ seed: 9, seats: 1 }, wrong, 20000);
check(w.wrong === wrong.length && w.lives === S.LIVES - wrong.length, `wrong taps cost a life each (${w.wrong} wrong, ${w.lives} lives left)`);

// a double tap counts once
const once = S.play({ seed: 9, seats: 1 }, [{ id: "a", t: sums[0].at + 400, seat: 0, token: "s0" }, { id: "b", t: sums[0].at + 450, seat: 0, token: "s0" }], 10000);
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
      if (p.seat === q.seat || p.answer !== q.answer || p.text === q.text || q.at - p.at < 600 || q.at - p.at > 4000) { problems++; console.log("a bad pair", p, q); }
    }
    for (const x of sums) {
      const clash = sums.find(o => o !== x && o.answer === x.answer && Math.abs(o.at - x.at) < 13000 && !(x.pair != null && o.pair === x.pair));
      if (clash) { problems++; console.log("a number that means two things", x.text, clash.text); break; }
    }
  }
  check(problems === 0, "together: pairs are two different sums making one number, one on each screen, 0.6–4 s apart; no number means two things");
}
{
  const until = 150000, sums = S.duoTimeline(21, until), taps = [];
  // a perfect pair: whoever sees the second sum of a pair taps it 0.8 s after it appears (the first was called out)
  const seenPair = new Set();
  for (const x of [...sums].reverse()) if (x.pair != null && !seenPair.has(x.pair)) { seenPair.add(x.pair); if (x.at + 800 <= until) taps.push({ id: `t${x.id}`, t: x.at + 800, seat: x.seat, sum: x.id }); }
  const st = S.play({ seed: 21, seats: 2 }, taps, until);
  check(st.lives === S.LIVES && st.missed === 0 && st.wrong === 0 && st.cleared > 30, `together: a perfect pair clears every pair (${st.cleared}) and leaves the decoys alone`);
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
