// Harbour: the rules, case by case; the program edits; and every level's reference solutions, which must reach the
// level's par on each measure (so a change to the rules can't quietly make a level easier, harder or impossible).
import { start, step, run, score, period, invalid, flatten, total, instructions } from "../harbour-engine.js";
import * as T from "../harbour-tape.js";
import { LEVELS } from "../harbour-levels.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };
const prog = s => [...s].map(c => (c === " " ? null : c));
const sol = (...ships) => ({ ships: ships.map(([x, y, p]) => ({ x, y, prog: typeof p === "string" ? prog(p) : p })) });
const lp = (n, op) => ({ n, body: [op] });
const hours = (level, s, n) => { let st = start(level, s); for (let k = 0; k < n; k++) st = step(level, s, st); return st; };
const toy = { map: ["....", "L..D", "..#."], target: 1, shipCost: 10, maxShips: 4, maxCycles: 50 };

// moving
check(period(sol([0, 0, "EE  "], [1, 0, "E"])) === 2, "the loop is the longest program, trailing blanks not counted");
check(run(toy, sol([0, 2, "E"])).crash?.kind === "aground", "running onto land ends the run");
check(run(toy, sol([0, 0, "N"])).crash?.kind === "aground", "leaving the map ends the run");
check(run(toy, sol([0, 0, "E"], [1, 0, "W"])).crash?.kind === "collision", "two ships passing through each other collide");
check(run(toy, sol([0, 0, "E"], [2, 0, "W"])).crash?.kind === "collision", "two ships ending on one tile collide");
check(run(toy, sol([0, 0, "E"], [1, 0, " "])).crash?.kind === "collision", "moving onto a ship that stays put collides");
{ const s = hours(toy, sol([0, 0, "E"], [1, 0, "E"]), 1); check(!s.crash && s.ships[0].x === 1 && s.ships[1].x === 2, "a ship may follow another onto the tile it leaves"); }
check(invalid(toy, sol([2, 2, ""])) !== null, "a ship can't start on land");
check(invalid(toy, sol([0, 0, ""], [0, 0, ""])) !== null, "two ships can't start on one tile");

// transfers: whole parcels or nothing, and nothing when they can't happen
check(hours(toy, sol([0, 1, "D"]), 1).delivered === 0, "discharging an empty ship does nothing");
check(total(hours(toy, sol([1, 1, "L"]), 1).ships[0].cargo) === 0, "loading off a jetty does nothing");
{ const r = run(toy, sol([0, 1, "LEEED"])); check(r.done === 5 && score(toy, sol([0, 1, "LEEED"]), r).water === 4, `load, three moves, discharge: 5 hours, 4 tiles (${r.done})`); }
const tankToy = (startLevel, cap = 8) => ({ map: ["L.D"], target: 1, shipCost: 10, maxShips: 2, maxCycles: 50, shipCap: 4,
  products: { diesel: { name: "Diesel", price: 2 } }, jetties: { L: { kind: "load", product: "diesel", tank: { start: startLevel, rate: 1, cap } }, D: { kind: "discharge" } } });
{
  const lvl = tankToy(3), s1 = hours(lvl, sol([0, 0, "LL"]), 1), s2 = hours(lvl, sol([0, 0, "LL"]), 2);
  check(total(s1.ships[0].cargo) === 0 && total(s2.ships[0].cargo) === 4, "a load waits for the whole parcel: three in the tank lifts nothing, four lifts four");
  check(s2.bought === 8, "product lifted is paid for");
}
{ const s = hours(tankToy(8), sol([0, 0, "LL"]), 2); check(total(s.ships[0].cargo) === 4 && s.tanks.L === 6, `a full ship lifts no more (tank ${s.tanks.L})`); }
check(hours(tankToy(7), sol([1, 0, " "]), 3).tanks.L === 8, "a refinery waits when its tank is full");
const L3 = LEVELS.find(l => l.id === "first-blend");
{
  const short = hours(L3, sol([2, 1, "LL"]), 2), shortD = hours(L3, sol([2, 1, ["L", "L", "E", "E", "E", "E", "S", "S", "W", "W", "D"]]), 11);
  check(total(short.ships[0].cargo) === 4 && shortD.delivered === 0 && /carries 4/.test(shortD.events[0]?.why), `a cargo the wrong size is refused and stays aboard (${shortD.events[0]?.why})`);
  const noFame = hours(L3, sol([2, 1, ["L", "L", "E", "E", "E", "E", "S", "S", "W", "W", "D"]]), 11);
  check(noFame.ships[0].cargo.gasoil === 4, "two gasoil lifts make four units");
}
{
  const lvl = { ...L3, jetties: { ...L3.jetties, G: { kind: "load", product: "gasoil", parcel: 5 } } };
  const s = hours(lvl, sol([2, 1, ["L", "E", "E", "E", "E", "S", "S", "W", "W", "D"]]), 10);
  check(s.delivered === 0 && /FAME 0%, needs at least 20%/.test(s.events[0]?.why), `a cargo off spec is refused (${s.events[0]?.why})`);
}
check(instructions(sol([0, 0, ["L", { n: 3, body: ["E", null] }, ".", null]])) === 3, "instructions: a loop's body counts once, empty hours not at all");

// the tape: loops, and every edit on them
const RING = "LENEEEEESEDWSWWWWWNW", OUT_AND_BACK = "LENEEEEESEDWNWWWWWSW";
const L1 = LEVELS.find(l => l.id === "first-cargo");
{
  const ring = ["L", "E", "N", lp(5, "E"), "S", "E", "D", "W", "S", lp(5, "W"), "N", "W"];
  const plays = p => flatten(p).map(op => op || " ").join("");
  check(plays(ring) === RING && T.width(ring) === 20, "a loop plays its body n times");
  const one = { ships: [{ x: 0, y: 2, prog: ring }] }, flat = sol([0, 2, RING]);
  const a1 = score(L1, one, run(L1, one)), a2 = score(L1, flat, run(L1, flat));
  check(a1.hours === a2.hours && a1.cost === a2.cost && a1.instructions === 12 && a2.instructions === 20, "a looped program runs as its hours written out, in fewer instructions");
  const a = T.at(ring, 4);
  check(a.kind === "ghost" && a.badge && a.n === 5 && a.op === "E", "the first ghost of a loop carries its count");
  check(plays(T.paint(ring, 5, "N")) === "LENNNNNNSEDWSWWWWWNW", "painting a ghost paints every pass");
  check(plays(T.insert(ring, 5, ["S"])) === "LENESESESESESSEDWSWWWWWNW", "inserting into a ghost grows the body");
  check(plays(T.insert(ring, 3, ["S"])) === "LENSEEEEESEDWSWWWWWNW", "inserting at a loop's first hour goes before the loop");
  check(plays(T.remove(ring, 6, 7)) === "LENEEESEDWSWWWWWNW", "removing later passes takes passes away");
  check(plays(T.remove(ring, 3, 3)) === "LENSEDWSWWWWWNW", "removing the whole body removes the loop");
  check(JSON.stringify(T.slice(ring, 3, 7)) === JSON.stringify([lp(5, "E")]), "copying a whole loop keeps the loop");
  check(JSON.stringify(T.slice(ring, 5, 9)) === JSON.stringify(["E", "E", "E", "S", "E"]), "copying part of a loop copies the hours it plays");
  check(JSON.stringify(T.slice(["L"], 0, 2)) === JSON.stringify(["L", null, null]), "copying past the end keeps the empty hours");
  check(JSON.stringify(T.loop(["L", "E", "E"], 1, 2)) === JSON.stringify(["L", { n: 2, body: ["E", "E"] }]), "picked hours become a loop played twice");
  check(T.loop(ring, 4, 9) === null, "a loop can't start inside another");
  check(plays(T.loop(ring, 2, 8)) === "LE" + "NEEEEES".repeat(2) + "EDWSWWWWWNW", "a loop wholly inside the pick is unrolled into the new body");
  check(plays(T.setCount(ring, 3, 1)) === "LENESEDWSWWWWWNW", "a count of one unrolls the loop");
  check(T.backwards(["E", "N", lp(2, "E")]).join("") === "WWSW", "the way back: reversed, every move turned round");
  let p = ring;
  for (let k = 0; k < 4; k++) p = T.shift(p, 20, true);
  check(plays(p) === RING.slice(16) + RING.slice(0, 16), "four hours later: the same loop, four hours behind");
  for (let k = 0; k < 4; k++) p = T.shift(p, 20, false);
  check(plays(p) === RING, "and four hours earlier puts it back");
  check(plays(T.shift(["E"], 3, true)) === " E", "a short row shifts inside the longest row's loop");
  check(invalid(L1, { ships: [{ x: 0, y: 2, prog: [{ n: 2, body: [lp(2, "E")] }] }] }) !== null, "loops don't nest");
  check(invalid(L1, { ships: [{ x: 0, y: 2, prog: [lp(1, "E")] }] }) !== null, "a loop plays at least twice");
}

// every level: references that reach its par on each measure, and nothing better among them
const phased = (level, lead, phases) => {
  const flat = flatten(lead.prog);
  return { ships: phases.map(h => { const s = hours(level, { ships: [lead] }, h).ships[0]; return { x: s.x, y: s.y, prog: h ? flat.slice(h).concat(flat.slice(0, h)) : lead.prog }; }) };
};
const ring1 = { x: 0, y: 2, prog: prog(RING) };
const ring2 = { x: 3, y: 1, prog: ["L", lp(2, "E"), lp(2, "S"), lp(2, "W"), "D", lp(2, "W"), lp(2, "N"), lp(2, "E")] };
const ring3 = { x: 2, y: 1, prog: [lp(2, "L"), lp(2, "E"), "L", lp(2, "E"), lp(2, "S"), lp(2, "W"), "D", lp(3, "W"), lp(2, "N"), "E"] };
const REFS = {
  // level 1: out and back by the north channel; or round the island one way, each ship four hours behind the one before
  // (the jetties are dead ends, and four hours is the least between two ships loading at one: in, load, out, clear)
  "first-cargo": {
    "one ship, looped": [{ ships: [{ x: 0, y: 2, prog: ["L", "E", "N", lp(5, "E"), "S", "E", "D", "W", "N", lp(5, "W"), "S", "W"] }] }, { cost: 20, hours: 71, water: 10, instructions: 12 }],
    "two ships": [phased(L1, ring1, [0, 16]), { cost: 40, hours: 35, water: 16 }],
    "four ships": [phased(L1, ring1, [0, 16, 12, 8]), { cost: 80, hours: 23, water: 16 }],
  },
  // level 2: the tank starts empty, so a lone ship starting at the jetty wastes a loop; started ten hours round the
  // ring it arrives as the fourth unit does. Four ships, at the refinery's rhythm rather than evenly spaced, are fastest
  rundown: {
    "one ship, at the jetty": [{ ships: [ring2] }, { cost: 20, hours: 92 }],
    "one ship, ten hours round": [{ ships: [{ x: 1, y: 3, prog: [lp(2, "N"), lp(2, "E"), "L", lp(2, "E"), lp(2, "S"), lp(2, "W"), "D", lp(2, "W")] }] }, { cost: 20, hours: 82, instructions: 8 }],
    "one ship, out and back": [{ ships: [{ x: 3, y: 1, prog: ["L", lp(2, "E"), lp(2, "S"), lp(2, "W"), "D", lp(2, "E"), lp(2, "N"), lp(2, "W")] }] }, { water: 7, instructions: 8 }],
    "four ships": [phased(LEVELS[1], ring2, [0, 4, 6, 8]), { cost: 80, hours: 32 }],
  },
  // level 3: two gasoil lifts and one FAME make exactly 20% FAME, the cheapest blend on spec; 60% is on spec too, dearer
  "first-blend": {
    "one ship, exactly 20%": [{ ships: [ring3] }, { cost: 48, hours: 66, instructions: 10 }],
    "one ship, 60% FAME": [{ ships: [{ x: 2, y: 1, prog: ["L", lp(2, "E"), lp(3, "L"), lp(2, "E"), lp(2, "S"), lp(2, "W"), "D", lp(3, "W"), lp(2, "N"), "E"] }] }, { cost: 64 }],
    "one ship, out and back": [{ ships: [{ x: 2, y: 1, prog: [lp(2, "L"), lp(2, "E"), "L", lp(2, "E"), lp(2, "S"), lp(2, "W"), "D", lp(2, "E"), lp(2, "N"), lp(4, "W")] }] }, { water: 9 }],
    "three ships": [phased(L3, ring3, [0, 11, 14]), { hours: 30 }],
  },
};
for (const level of LEVELS) {
  const best = {}, refs = REFS[level.id] || {};
  check(Object.keys(refs).length > 0, `${level.id}: has reference solutions`);
  for (const [name, [s, expect]] of Object.entries(refs)) {
    const r = run(level, s), sc = score(level, s, r);
    check(!r.crash && r.done, `${level.id}, ${name}: runs clean (${r.crash ? r.crash.kind : "not done"})`);
    for (const [k, v] of Object.entries(expect)) check(sc[k] === v, `${level.id}, ${name}: ${k} ${sc[k]}, expected ${v}`);
    if (r.done && !r.crash) for (const k of Object.keys(sc)) best[k] = Math.min(best[k] ?? Infinity, sc[k]);
  }
  check(JSON.stringify(best) === JSON.stringify(level.par), `${level.id}: par is what the references reach (${JSON.stringify(best)})`);
  check(new Set(level.map.map(r => r.length)).size === 1, `${level.id}: every row of the map is as wide`);
}
check(run(L1, phased(L1, ring1, [0, 18])).crash?.kind === "collision", "level 1: two ships two hours apart meet at the jetty");
console.log(bad ? `${bad} FAILED` : `harbour: rules, tape and ${LEVELS.length} levels' pars hold`);
process.exitCode = bad ? 1 : 0;
