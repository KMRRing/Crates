// Harbour: the rules, case by case, and the reference solutions for every level, which must reach the level's par
// (so a change to the rules can't quietly make a level harder, easier or impossible).
import { start, step, run, score, period, invalid, flatten } from "../harbour-engine.js";
import * as T from "../harbour-tape.js";
import { LEVELS } from "../harbour-levels.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };
const prog = s => [...s].map(c => (c === " " ? null : c));
const sol = (...ships) => ({ ships: ships.map(([x, y, p]) => ({ x, y, prog: prog(p) })) });
const toy = { map: ["....", "L..D", "..#."], target: 1, shipCost: 10, maxShips: 4, maxCycles: 50 };

// rules
check(period(sol([0, 0, "EE  "], [1, 0, "E"])) === 2, "the loop is the longest program, trailing blanks not counted");
check(run(toy, sol([0, 2, "E"])).crash?.kind === "aground", "running onto land ends the run");
check(run(toy, sol([0, 0, "N"])).crash?.kind === "aground", "leaving the map ends the run");
check(run(toy, sol([0, 0, "E"], [1, 0, "W"])).crash?.kind === "collision", "two ships passing through each other collide");
check(run(toy, sol([0, 0, "E"], [2, 0, "W"])).crash?.kind === "collision", "two ships ending on one tile collide");
check(run(toy, sol([0, 0, "E"], [1, 0, " "])).crash?.kind === "collision", "moving onto a ship that stays put collides");
{
  let s = start(toy, sol([0, 0, "E"], [1, 0, "E"]));
  s = step(toy, sol([0, 0, "E"], [1, 0, "E"]), s);
  check(!s.crash && s.ships[0].x === 1 && s.ships[1].x === 2, "a ship may follow another onto the tile it leaves");
}
{
  const s1 = step(toy, sol([0, 1, "D"]), start(toy, sol([0, 1, "D"])));
  check(!s1.crash && s1.delivered === 0, "discharging an empty ship does nothing");
  const s2 = step(toy, sol([1, 1, "L"]), start(toy, sol([1, 1, "L"])));
  check(!s2.ships[0].laden, "loading off a jetty does nothing");
}
{
  const r = run(toy, sol([0, 1, "LEEED"]));
  check(r.done === 5 && r.delivered === 1, `load, three moves, discharge: done in 5 hours (got ${r.done})`);
  check(score(toy, sol([0, 1, "LEEED"]), r).water === 4, "water counts every tile a ship was on");
}
check(invalid(toy, sol([2, 2, ""])) !== null, "a ship can't start on land");
check(invalid(toy, sol([0, 0, ""], [0, 0, ""])) !== null, "two ships can't start on one tile");

// Level 1. One ship out and back by the north channel; or ships round the island one way (north channel east, south
// channel west), each four hours behind the one before: the refinery's jetty is a dead end, and four hours is the
// least between two ships loading there (in, load, out, and clear of the tile in front of it).
const L1 = LEVELS.find(l => l.id === "first-cargo");
const OUT_AND_BACK = "LENEEEEESEDWNWWWWWSW", RING = "LENEEEEESEDWSWWWWWNW";
const behind = d => {                               // the ring, d hours behind a ship that starts at the jetty
  const lead = sol([0, 2, RING]);
  let s = start(L1, lead);
  for (let t = 0; t < RING.length - d; t++) s = step(L1, lead, s);
  return [s.ships[0].x, s.ships[0].y, RING.slice(RING.length - d) + RING.slice(0, RING.length - d)];
};
const refs = {
  "one ship": sol([0, 2, OUT_AND_BACK]),
  "two ships": sol(behind(0), behind(4)),
  "four ships": sol(behind(0), behind(4), behind(8), behind(12)),
};
const expect = { "one ship": { hire: 20, hours: 71, water: 10 }, "two ships": { hire: 40, hours: 35, water: 16 }, "four ships": { hire: 80, hours: 23, water: 16 } };
const best = { hire: Infinity, hours: Infinity, water: Infinity };
for (const [name, s] of Object.entries(refs)) {
  const r = run(L1, s), sc = score(L1, s, r);
  check(!r.crash && r.done, `${name}: runs clean (${r.crash ? r.crash.kind : "not done"})`);
  check(JSON.stringify(sc) === JSON.stringify(expect[name]), `${name}: ${JSON.stringify(sc)}`);
  for (const k of Object.keys(best)) best[k] = Math.min(best[k], sc[k]);
}
check(JSON.stringify(best) === JSON.stringify(L1.par), `level 1's par is what the references reach: ${JSON.stringify(best)}`);
check(run(L1, sol(behind(0), behind(2))).crash?.kind === "collision", "two ships only two hours apart meet at the jetty");


// the tape: loops, and every edit on them
{
  const ring = ["L", "E", "N", { n: 5, body: ["E"] }, "S", "E", "D", "W", "S", { n: 5, body: ["W"] }, "N", "W"];
  const plays = p => flatten(p).map(op => op || " ").join("");
  check(plays(ring) === RING && T.width(ring) === 20, "a loop plays its body n times");
  const one = { ships: [{ x: 0, y: 2, prog: ring }] }, flat = sol([0, 2, RING]);
  check(JSON.stringify(score(L1, one, run(L1, one))) === JSON.stringify(score(L1, flat, run(L1, flat))), "a looped program runs exactly as its hours written out");
  const a = T.at(ring, 4);
  check(a.kind === "ghost" && a.badge && a.n === 5 && a.op === "E", "the first ghost of a loop carries its count");
  check(plays(T.paint(ring, 5, "N")) === "LENNNNNNSEDWSWWWWWNW", "painting a ghost paints every pass");
  check(plays(T.insert(ring, 5, ["S"])) === "LENESESESESESSEDWSWWWWWNW", "inserting into a ghost grows the body");
  check(plays(T.insert(ring, 3, ["S"])) === "LENSEEEEESEDWSWWWWWNW", "inserting at a loop's first hour goes before the loop");
  check(plays(T.remove(ring, 6, 7)) === "LENEEESEDWSWWWWWNW", "removing later passes takes passes away");
  check(plays(T.remove(ring, 3, 3)) === "LENSEDWSWWWWWNW", "removing the whole body removes the loop");
  check(JSON.stringify(T.slice(ring, 3, 7)) === JSON.stringify([{ n: 5, body: ["E"] }]), "copying a whole loop keeps the loop");
  check(JSON.stringify(T.slice(ring, 5, 9)) === JSON.stringify(["E", "E", "E", "S", "E"]), "copying part of a loop copies the hours it plays");
  check(JSON.stringify(T.slice(["L"], 0, 2)) === JSON.stringify(["L", null, null]), "copying past the end keeps the empty hours");
  check(JSON.stringify(T.loop(["L", "E", "E"], 1, 2)) === JSON.stringify(["L", { n: 2, body: ["E", "E"] }]), "picked hours become a loop played twice");
  check(T.loop(ring, 4, 9) === null, "a loop can't start inside another");
  check(plays(T.loop(ring, 2, 8)) === "LE" + "NEEEEES".repeat(2) + "EDWSWWWWWNW", "a loop wholly inside the pick is unrolled into the new body");
  check(plays(T.setCount(ring, 3, 1)) === "LENESEDWSWWWWWNW", "a count of one unrolls the loop");
  check(T.backwards(["E", "N", { n: 2, body: ["E"] }]).join("") === "WWSW", "the way back: reversed, every move turned round");
  let p = ring;
  for (let k = 0; k < 4; k++) p = T.shift(p, 20, true);
  check(plays(p) === RING.slice(16) + RING.slice(0, 16), "four hours later: the same loop, four hours behind");
  for (let k = 0; k < 4; k++) p = T.shift(p, 20, false);
  check(plays(p) === RING, "and four hours earlier puts it back");
  check(plays(T.shift(["E"], 3, true)) === " E", "a short row shifts inside the longest row's loop");
  check(invalid(L1, { ships: [{ x: 0, y: 2, prog: [{ n: 2, body: [{ n: 2, body: ["E"] }] }] }] }) !== null, "loops don't nest");
  check(invalid(L1, { ships: [{ x: 0, y: 2, prog: [{ n: 1, body: ["E"] }] }] }) !== null, "a loop plays at least twice");
}

for (const l of LEVELS) {
  const widths = new Set(l.map.map(r => r.length));
  check(widths.size === 1, `${l.id}: every row of the map is as wide`);
  check(/^[#.LD]+$/.test(l.map.join("")), `${l.id}: only known tiles`);
}
console.log(bad ? `${bad} FAILED` : `harbour: rules and ${LEVELS.length} level's par hold`);
process.exitCode = bad ? 1 : 0;
