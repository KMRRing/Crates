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

// together: the answer is on the other shelf, and tapping it there clears the sum
const duo = S.timeline(11, 2, 10000);
const first = duo[0];
const right = S.play({ seed: 11, seats: 2 }, [{ id: "x", t: first.at + 800, seat: first.shelf, token: `s${first.id}` }], first.at + 1000);
const wrongShelf = S.play({ seed: 11, seats: 2 }, [{ id: "y", t: first.at + 800, seat: first.seat, token: `s${first.id}` }], first.at + 1000);
check(right.cleared === 1 && wrongShelf.cleared === 0, "together: the answer is cleared from the partner's shelf, not the asker's");
const pd = perfect({ seed: 12, seats: 2 }, 150000);
check(pd.lives === S.LIVES && pd.missed === 0, `a perfect pair clears everything too (${pd.cleared} sums)`);
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
