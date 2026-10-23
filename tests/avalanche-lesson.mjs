// Avalanche's danger shading (avalanche-engine.js `danger`) and the first-days lesson (avalanche-lesson.js): that the
// hatched squares are exactly the ones a layer would bury the road from, that they follow the charges, that the
// scripted night plays the same, that each lesson day does what its words say, and that a saved game of before opens.
import { W, H, BURY, CHARGES, newGame, upgrade, settle, laid, lay, lift, foresee, fire, danger, rocksOf } from "../avalanche-engine.js";
import { LESSONS, LESSON_DAYS, lessonGame, lessonOf, nightOf, ready, instruction, told } from "../avalanche-lesson.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const N = W * H;

// ---------- the shading ----------
// brute force: add the layer, let the slope settle, count what reached the road
const brute = (g, plan = g.plan) => {
  const rocks = rocksOf(g), after = foresee(g, plan).slide.cells, out = [];
  for (let i = 0; i < N; i++) { if (rocks.includes(i)) continue; const c = after.slice(); c[i]++; if (settle(c, rocks).foot >= BURY) out.push(i); }
  return out;
};
{
  let same = true, any = 0, games = 0;
  for (const rocky of [false, true]) for (let seed = 1; seed <= 40; seed++) {
    let g = newGame(seed, rocky);
    for (let d = 0; d < 6 && !g.over; d++) {
      const plan = [(seed * 7 + d) % N, (seed * 11 + d * 5) % N];
      const h = { ...g, plan }, a = danger(h), b = brute(h);
      if (a.join() !== b.join()) same = false;
      any += a.length > 0; games++;
      g = fire(h).state;
    }
  }
  check(same, `the hatched squares are the ones where one layer buries the road, on ${games} slopes (some rocky)`);
  check(any > 0 && any < games, `and some slopes have none (${games - any} of ${games}) and some have them`);
}
{
  const g = lessonGame(2), d0 = danger(g);
  check(d0.length > 0 && d0.every(k => laid(g)[k] === 3 || laid(g)[k] === 2), `a loaded foot is hatched: ${d0.length} squares`);
  // it is what is dangerous after today's charges fire: charge the block and the hatching goes
  const cleared = lay(g, d0[Math.floor(d0.length / 2)]);
  check(danger(cleared).length === 0, "laying a charge that clears the foot clears the hatching");
  check(danger(lift(cleared)).join() === d0.join(), "and lifting it brings it back");
  check(danger({ ...g, over: true }).length === 0, "a finished game has none");
  const rocky = newGame(9, true);
  check(danger(rocky).every(k => !rocksOf(rocky).includes(k)), "rock is never hatched");
}

// ---------- the scripted night ----------
{
  const g = { ...lessonGame(2), plan: [51] };
  const a = fire(g, nightOf(2)), b = fire(g, nightOf(2));
  check(JSON.stringify(a) === JSON.stringify(b), "a scripted night plays the same every time");
  check(a.night.length === nightOf(2).length && a.night.every((n, k) => n.at === nightOf(2)[k]), "and the snow falls where the script says");
  check(fire(lessonGame(0, 0), []).night.length === 0, "an empty script is a night with no snow");
  check(fire({ ...lessonGame(0), plan: [17] }, []).state.lesson === 0, "the lesson day rides through a fire");
}

// ---------- each day does what it says ----------
check(LESSON_DAYS === 3, "three days");
for (let k = 0; k < LESSON_DAYS; k++) {
  const g = lessonGame(k);
  check(g.cells.length === N && g.plan.length === 0 && g.lives === 3 && !g.over && g.wind === 0 && !rocksOf(g).length, `day ${k + 1} starts on its own slope, no charges, calm, bare of rock`);
  check(lessonOf(g) === k && !ready(g), `day ${k + 1} is the lesson's and isn't ready with nothing laid`);
  check(instruction(g) === LESSONS[k].start && instruction({ ...g, plan: [0] }) === LESSONS[k].hint, `day ${k + 1} says what to do, and with the wrong charge, what is missing`);
  check(LESSONS[k].start.length <= 110 && LESSONS[k].hint.length <= 140, `day ${k + 1}'s words are short enough for their lines (${LESSONS[k].start.length}, ${LESSONS[k].hint.length})`);
}
check(!lessonOf(newGame(3)) && lessonOf({ lesson: 3 }) == null && lessonOf({ lesson: -1 }) == null && lessonOf(null) == null, "an ordinary game, or a lesson that isn't one, is not in the lesson");
{
  // every plan of up to three charges: what makes a day ready, and that doing it can't go wrong
  const plans = [];
  for (let a = 0; a < N; a++) { plans.push([a]); for (let b = a; b < N; b++) { plans.push([a, b]); if (b % 3 === 0) for (let c = b; c < N; c += 3) plans.push([a, b, c]); } }
  for (let k = 0; k < LESSON_DAYS; k++) {
    const g = lessonGame(k), good = plans.filter(p => ready({ ...g, plan: p }));
    check(good.length > 0, `day ${k + 1} can be done (${good.length} plans of up to ${CHARGES} charges)`);
    let buried = 0, flat = 0, wrong = 0;
    for (const p of good.slice(0, 600)) {
      const h = { ...g, plan: p }, r = fire(h, nightOf(k));
      buried += r.buried || r.state.lives < 3 || r.over;
      flat += r.gain <= 0;
      const words = told(h, r);
      if (!words || /undefined|NaN/.test(words)) wrong++;
    }
    check(buried === 0, `day ${k + 1}: doing it never buries the road, even with the night's snow`);
    check(flat === 0 && wrong === 0, `day ${k + 1}: doing it scores, and what is told of it is whole`);
  }
  const d0 = lessonGame(0), one = plans.filter(p => p.length === 1 && ready({ ...d0, plan: p }));
  const f = fire({ ...d0, plan: one[0] }, nightOf(0));
  check(f.slide.size === 3 && f.gain === 90, "day 1: one charge sets the three off together for 90, three times what three singles would");
  const d1 = lessonGame(1);
  check(!ready({ ...d1, plan: [22] }) && ready({ ...d1, plan: [22, 24] }), "day 2: one stretch isn't enough, one charge on each is");
  const r1 = fire({ ...d1, plan: [22, 24] }, nightOf(1));
  check(r1.relays.length === 1 && r1.reach === 6 && r1.gain === 360, "day 2: the gap slides as a bridge and the reach is 6, 360 points");
  check(foresee(d1, [22]).gain < r1.gain / 4, "day 2: a stretch alone scores a fraction of it");
  const d2 = lessonGame(2), h2 = { ...d2, plan: [danger(d2)[3]] };
  check(!ready(d2) && !ready({ ...d2, plan: [0] }) && ready(h2), "day 3: a charge that leaves the foot hatched isn't it, one that clears the foot is");
  check(ready({ ...h2, told: "x" }) === false, "a day that has been told is not ready again");
  const r2 = fire(h2, nightOf(2));
  check(!r2.buried && r2.state.lives === 3 && r2.road < BURY, "day 3: the night passes and the road is not buried");
  // the same night without clearing the block buries it: that is what the hatching is for
  const idle = fire({ ...d2, plan: [0] }, nightOf(2));
  check(idle.road >= BURY && idle.buried, "day 3: with the block left, the same night buries the road");
}

// ---------- saves ----------
{
  const old = newGame(5), saved = JSON.parse(JSON.stringify(old));
  check(upgrade(saved).lesson === undefined && lessonOf(upgrade(saved)) == null, "a game saved before the lesson opens as an ordinary game");
  const mid = JSON.parse(JSON.stringify({ ...lessonGame(1, 90), plan: [22], told: "words" }));
  const back = upgrade(mid);
  check(back.lesson === 1 && back.told === "words" && back.score === 90 && back.plan.join() === "22", "a lesson in progress survives saving and opening again");
  const next = lessonGame(2, back.score);
  check(next.score === 90 && next.lesson === 2 && !next.told, "the next day carries the points and clears what was told");
  // the same seeds still deal the same games
  check(newGame(1).cells.join("") === newGame(1).cells.join("") && fire({ ...newGame(2), plan: [3] }).state.n === fire({ ...newGame(2), plan: [3] }).state.n, "an ordinary game plays as it did, from its seed");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("avalanche lesson: the danger shading, the scripted night, the three days, saves");
