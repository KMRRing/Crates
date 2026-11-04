// Courier's sections (reckoning-sections.js, and "sections" in reckoning-engine.js): each thing a section lays on the quay does what it says,
// and all twenty sections are played through by a bot that swipes by the rules (tests/reckoning-bot.js): each must reach its finish with
// its aim met and no more hearts lost than its par allows, so a section nobody can win does not get in.
import { SECTIONS, byId } from "../reckoning-sections.js";
import { newGame, valid, copy, swipe, step, take, speed, goalValue, starsOf, solid, loadFactor, sectionSig, JUMP_V, LANE_W, TIDE_P, STAGGER_Z, GROG_T } from "../reckoning-engine.js";
import { playSection } from "./reckoning-bot.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const DT = 1 / 120;
const run = (S, secs) => { for (let t = 0; t < secs - 1e-9 && !S.over; t += DT) step(S, DT); };
const q = n => ({ id: `Q${n}`, bank: "test", q: "?", o: ["a", "b", "c"], a: n % 3, x: "", about: [] });

/** A section of one's own: rows and a few settings; the hero is on its quay with no hurry (a start at pace). */
function make(rows, extra = {}) {
  const S = newGame({ seed: 1, section: { id: 1, name: "t", v0: 10, v1: 10, gap: 10, rows, goal: { kind: "none", n: 0 }, par: { hits: 0 }, lead: 10, ...extra } });
  S.fwd = 1;
  return S;
}

// ---------- what blocks ----------
{
  let S = make([". b ."]); swipe(S, "right"); run(S, 4);
  check(S.hero.lane === 1 && S.hits === 0 && S.won, "a section is a few rows and a finish: running past a lane with nothing in it costs nothing");
  S = make([". b ."]); run(S, 4);
  check(S.hits === 1 && S.hearts === 2, "a barrel in my lane hurts");
  S = make([". b ."]); run(S, 0.55); swipe(S, "up"); run(S, 4);
  check(S.hits === 0 && S.won, "and a jump clears it");
  S = make([". B ."]); run(S, 0.5); swipe(S, "up"); run(S, 4);
  check(S.hits === 1, "a beam hangs where a jump would hit it");
  S = make([". B ."]); run(S, 0.7); swipe(S, "down"); run(S, 4);
  check(S.hits === 0 && S.won, "and a roll goes under it");
  S = make([". X ."]); run(S, 0.5); swipe(S, "up"); run(S, 4);
  check(S.hits === 1, "a cart is too high to jump: go round");
  S = make([". X ."]); swipe(S, "left"); run(S, 4);
  check(S.hits === 0 && S.hero.lane === -1, "(a swipe sideways goes round it)");
}

// ---------- goods, tokens, levers, gates ----------
{
  let S = make([". s ."], { bill: { want: ["salt"] }, goal: { kind: "goods", n: 1 } }); run(S, 4);
  check(S.carried.salt === 1 && goalValue(S) === 1 && S.won, "running through a good picks it up, and a section's aim is counted in them");
  S = make([". . ."], { bill: { want: ["salt"] }, goal: { kind: "goods", n: 1 } }); run(S, 4);
  check(S.over && !S.won, "a finish short of the aim does not pass");
  S = make([". a ."], { bill: { want: ["amber"] }, goal: { kind: "goods", n: 1 } }); run(S, 4);
  check(!S.carried.amber, "amber hangs too high to take from the planks");
  S = make([". a ."], { bill: { want: ["amber"] }, goal: { kind: "goods", n: 1 } }); run(S, 0.7); swipe(S, "up"); run(S, 4);
  check(S.carried.amber === 1, "and a jump takes it at the top");
  S = make([". f ."], { bill: { want: ["salt"], bad: ["furs"] } }); run(S, 4);
  check(S.hits === 1 && !S.carried.furs, "what the bill forbids is seized, and costs a heart");
  S = make(["1 . .", "T1 T1 T1"]); swipe(S, "left"); run(S, 4);
  check(S.token === 1 && S.hits === 0, "a token opens the booth of its number");
  S = make(["2 . .", "T1 T1 T1"]); swipe(S, "left"); run(S, 4);
  check(S.token === 2 && S.hits === 1, "and none opens another's");
  S = make(["L . .", "F0 F0 F0"]); swipe(S, "left"); run(S, 4);
  check(S.flip === 1 && S.hits === 0, "a lever turns the bridges over: the ones that were up are down");
  S = make(["F0 F0 F0"]); run(S, 4);
  check(S.hits === 1, "a bridge that is up stops the hero");
  S = make(["H . ."], { hearts: 3 }); S.hearts = 1; swipe(S, "left"); run(S, 3);
  check(S.hearts === 2, "a meal gives a heart back");
}
{
  const S = make(["W0 W1 W2"]), o = S.world.obs;
  const open = t => { S.t = t; return o.filter(x => !solid(S, x)).length; };
  const counts = []; for (let t = 0; t < TIDE_P * 2; t += 0.05) counts.push(open(t));
  check(Math.min(...counts) >= 1 && Math.max(...counts) <= 2, "the three sluice gates are a third of a beat apart, so one is always open");
}

// ---------- the bruiser, the grog, the load, the gap ----------
{
  const S = make(["C . ."]); run(S, 0.6); swipe(S, "left");
  run(S, 0.45);
  const b = S.world.foes[0];
  check(b.hp === 1 && b.alive && b.z > 10 + 3, `a bruiser takes the first cut and is thrown back (${STAGGER_Z} m)`);
  take(S);
  swipe(S, "up"); run(S, 1);
  check(!b.alive && S.hits === 0, "the second cut kills it");
}
{
  const S = make([". . ."]); S.inv = S.t + GROG_T; swipe(S, "left");
  check(S.hero.lane === 1, "after the grog left is right");
  S.inv = 0; swipe(S, "left");
  check(S.hero.lane === 0, "and then it is as it was");
}
{
  const S = make([". . ."], { laden: 1 });
  const v0 = loadFactor(S); S.carried.total = 6;
  check(v0 === 1 && loadFactor(S) < 1 && loadFactor(S) >= 0.8, "a laden hero jumps lower with each good, to a floor");
  swipe(S, "up"); run(S, 0.01);
  check(S.hero.vy < JUMP_V * 0.95, "(the jump's speed)");
}
{
  let S = make(["!gap 5", ". . ."]); run(S, 3);
  check(S.falls === 1, "a gap in the planks: left alone, the hero falls into the water");
  S = make(["!gap 5", ". . ."]); run(S, 0.95); swipe(S, "up"); run(S, 3);
  check(S.falls === 0 && S.won, "and a jump at its edge clears it");
}

// ---------- stars, and what is kept ----------
{
  const S = make([". . ."], { par: { hits: 0 } }); run(S, 4);
  check(starsOf(S) === 3, "a section passed with no heart lost is three stars");
  const T = make([". b ."], { par: { hits: 0 } }); run(T, 4);
  check(starsOf(T) === 2, "one heart lost is two");
  const U = make([". b ."], { par: { hits: 0 } }); U.hits = 3; run(U, 4);
  check(starsOf(U) === 1, "and more is one");
  const w = copy(S);
  check(JSON.stringify(w.world.rows) === JSON.stringify(S.world.rows), "a section's run copies through JSON");
  const def = SECTIONS[2], G = newGame({ section: def });
  check(valid(JSON.parse(JSON.stringify(G)), SECTIONS) && !valid({ ...JSON.parse(JSON.stringify(G)), sig: "x" }, SECTIONS) && !valid({ ...JSON.parse(JSON.stringify(G)), sec: 99 }, SECTIONS), "a kept run of a section that has since changed, or is gone, is not valid");
  const old = JSON.parse(JSON.stringify(newGame({ seed: 4 })));
  delete old.world.obs; delete old.world.pick; delete old.sec; delete old.hits;
  check(valid(old, SECTIONS) && old.sec === 0 && old.world.obs.length === 0, "an endless run kept before sections is still valid, and given what it lacks");
  check(sectionSig(SECTIONS[0]) !== sectionSig(SECTIONS[1]) && sectionSig(SECTIONS[0]) === sectionSig(byId(1)), "a section's signature follows its rows");
}

// ---------- the twenty ----------
check(SECTIONS.length === 20 && SECTIONS.every((d, i) => d.id === i + 1 && d.name && d.place && d.brief && d.idea && d.par && Number.isFinite(d.par.hits) && d.rows.length >= 15), "twenty sections, numbered, each with a name, a place, a line of what it is, a par and rows");
check(new Set(SECTIONS.map(d => d.name)).size === 20, "no two share a name");
check(SECTIONS.every(d => d.brief.length <= 80), "each brief fits a line under the hearts");
check(SECTIONS.every(d => d.goal.kind === "none" || d.par.more >= d.goal.n), "the third star asks at least what passing does");
const only = process.argv[2] ? +process.argv[2] : 0;
for (const def of SECTIONS) {
  if (only && def.id !== only) continue;
  let n = 0;
  const S = playSection(def, { deal: () => q(n++) });
  const goal = goalValue(S), stars = starsOf(S);
  console.log(`     ${String(def.id).padStart(2)} ${def.name.padEnd(22)} ${Math.round(S.hero.z)} m, hits ${S.hits}, aim ${goal}/${def.goal.n}${def.par.more ? ` (par ${def.par.more})` : ""}, ${stars} stars, ${S.t.toFixed(0)} s`);
  check(S.won && S.hits <= def.par.hits && stars === 3, `section ${def.id}, ${def.name}: won at par with the full aim by a bot`);
}
{
  // a run under the rules is the same each time: a section's quay does not depend on the seed, only its questions do
  const a = newGame({ seed: 1, section: SECTIONS[4], deal: () => q(0) }), b = newGame({ seed: 2, section: SECTIONS[4], deal: () => q(1) });
  check(JSON.stringify(a.world.foes) === JSON.stringify(b.world.foes) && JSON.stringify(a.world.pits) === JSON.stringify(b.world.pits), "a section's quay is the same on every run");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("courier sections: the things on the quay, twenty sections made and won by a bot at par");
