// Harbour: the rules, case by case; the program edits; and every level's reference solutions, which must reach the
// level's par on each measure (so a change to the rules can't quietly make a level easier, harder or impossible).
import { start, step, run, score, period, invalid, flatten, total, instructions } from "../harbour-engine.js";
import * as T from "../harbour-tape.js";
import { LEVELS, program } from "../harbour-levels.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };
const prog = s => [...s].map(c => (c === " " ? null : c));
const sol = (...ships) => ({ ships: ships.map(([x, y, p]) => ({ x, y, prog: typeof p === "string" ? prog(p) : p })) });
const lp = (n, op) => ({ n, body: [op] });
const hours = (level, s, n) => { let st = start(level, s); for (let k = 0; k < n; k++) st = step(level, s, st); return st; };

// moving: ships steer relative to their heading, on hexes (odd rows half a hex to the right)
const sea = { map: [".....", ".....", ".....", "....."], jetties: {}, fleet: { coaster: 4 }, target: 1, maxCycles: 50 };
const at = (lvl, s, n = 1) => hours(lvl, s, n).ships[0];
const ship = (x, y, h, p) => ({ ships: [{ x, y, h, prog: prog(p) }] });
{
  const e = at(sea, ship(1, 1, 0, "A")), p1 = at(sea, ship(1, 1, 0, "P")), s1 = at(sea, ship(1, 1, 0, "S")), b1 = at(sea, ship(1, 1, 0, "B"));
  check(e.x === 2 && e.y === 1 && e.h === 0, `ahead: a hex on, the same heading (${JSON.stringify(e)})`);
  check(p1.x === 2 && p1.y === 0 && p1.h === 1, `port: turned 60° to the left, a hex on (${JSON.stringify(p1)})`);
  check(s1.x === 2 && s1.y === 2 && s1.h === 5, `starboard: turned 60° to the right, a hex on (${JSON.stringify(s1)})`);
  check(b1.x === 0 && b1.y === 1 && b1.h === 0, `astern: a hex back, still facing ahead (${JSON.stringify(b1)})`);
  const round = at(sea, ship(2, 2, 0, "PPPPPP"), 6);
  check(round.x === 2 && round.y === 2 && round.h === 0, "six port turns come full circle, back where it started");
  const turned = at(sea, ship(2, 2, 3, "A"));
  check(turned.x === 1 && turned.y === 2, "ahead is whichever way the ship faces: west, here");
}
check(period(sol([0, 0, "AA  "], [1, 0, "A"])) === 2, "the loop is the longest program, trailing blanks not counted");
check(run(sea, ship(0, 0, 3, "A")).crash?.kind === "aground", "leaving the map ends the run");
check(run({ ...sea, map: ["..#..", ".....", ".....", "....."] }, ship(1, 0, 0, "A")).crash?.kind === "aground", "running onto land ends the run");
const two = (a, b) => ({ ships: [{ x: a[0], y: a[1], h: a[2], prog: prog(a[3]) }, { x: b[0], y: b[1], h: b[2], prog: prog(b[3]) }] });
check(run(sea, two([0, 0, 0, "A"], [1, 0, 3, "A"])).crash?.kind === "collision", "two ships passing through each other collide");
check(run(sea, two([0, 0, 0, "A"], [2, 0, 3, "A"])).crash?.kind === "collision", "two ships ending on one hex collide");
check(run(sea, two([0, 0, 0, "A"], [1, 0, 0, " "])).crash?.kind === "collision", "moving onto a ship that stays put collides");
{ const s = hours(sea, two([0, 0, 0, "A"], [1, 0, 0, "A"]), 1); check(!s.crash && s.ships[0].x === 1 && s.ships[1].x === 2, "a ship may follow another onto the hex it leaves"); }
check(invalid(sea, { ships: [{ x: 0, y: 0, h: 6, prog: [] }] }) !== null, "a heading is one of six");
check(invalid({ ...sea, map: ["#...."] }, sol([0, 0, ""])) !== null, "a ship can't start on land");
check(invalid(sea, sol([0, 0, ""], [0, 0, ""])) !== null, "two ships can't start on one hex");

// transfers: whole parcels or nothing, and nothing when they can't happen
const toy = { map: ["L..D"], products: { oil: { name: "Oil", price: 0 } }, jetties: { L: { kind: "load", product: "oil", parcel: 4 }, D: { kind: "discharge", parcel: 4 } },
  fleet: { coaster: 4 }, target: 1, maxCycles: 50 };
check(hours(toy, sol([3, 0, "D"]), 1).delivered === 0, "discharging an empty ship does nothing");
check(total(hours(toy, sol([1, 0, "L"]), 1).ships[0].cargo) === 0, "loading off a jetty does nothing");
{ const r = run(toy, sol([0, 0, "LAAAD"])); check(r.done === 5 && score(toy, sol([0, 0, "LAAAD"]), r).water === 4, `load, three hexes on, discharge: 5 hours, 4 hexes (${r.done})`); }
const tankToy = (startLevel, cap = 8) => ({ map: ["L.D"], target: 1, fleet: { coaster: 2 }, maxCycles: 50,
  products: { diesel: { name: "Diesel", price: 2 } }, jetties: { L: { kind: "load", product: "diesel", parcel: 4, tank: { start: startLevel, rate: 1, cap } }, D: { kind: "discharge", parcel: 4 } } });
{
  const lvl = tankToy(3), s1 = hours(lvl, sol([0, 0, "LL"]), 1), s2 = hours(lvl, sol([0, 0, "LL"]), 2);
  check(total(s1.ships[0].cargo) === 0 && total(s2.ships[0].cargo) === 4, "a load waits for the whole parcel: three in the tank lifts nothing, four lifts four");
  check(s2.bought === 8, "product lifted is paid for");
}
{ const s = hours(tankToy(8), sol([0, 0, "LL"]), 2); check(total(s.ships[0].cargo) === 4 && s.tanks.L === 6, `a full ship lifts no more (tank ${s.tanks.L})`); }
check(hours(tankToy(7), sol([1, 0, " "]), 3).tanks.L === 8, "a refinery waits when its tank is full");
const blend = { map: ["GFD"], target: 4, fleet: { coaster: 1, handy: 1 }, maxCycles: 20, products: { gasoil: { name: "Gasoil", price: 1 }, fame: { name: "FAME", price: 3 } },
  jetties: { G: { kind: "load", product: "gasoil", parcel: 2 }, F: { kind: "load", product: "fame", parcel: 1 }, D: { kind: "discharge", parcel: 4, spec: { fame: [0.25, 1] } } } };
const typed = (type, x, y, p) => ({ ships: [{ x, y, h: 0, type, prog: prog(p) }] });
{
  const short = hours(blend, typed("coaster", 0, 0, "LAAD"), 4);
  check(total(short.ships[0].cargo) === 2 && short.delivered === 0 && /carries 2, the jetty takes 4/.test(short.events[0]?.why), `less than the jetty's parcel is refused and stays aboard (${short.events[0]?.why})`);
  const noFame = hours(blend, typed("coaster", 0, 0, "LLAAD"), 5);
  check(noFame.delivered === 0 && /FAME 0%, needs at least 25%/.test(noFame.events[0]?.why), `a cargo off spec is refused (${noFame.events[0]?.why})`);
  const full = hours(blend, typed("coaster", 0, 0, "LLL"), 3);
  check(total(full.ships[0].cargo) === 4, "a coaster holds four: a third lift of two doesn't fit");
  const rich = hours(blend, typed("coaster", 0, 0, "LALLAD"), 6);
  check(rich.delivered === 1 && total(rich.ships[0].cargo) === 0, "a coaster's cheapest blend on spec: two gasoil, two FAME, 50%");
  const handy = typed("handy", 0, 0, "LLLALLADD"), h8 = hours(blend, handy, 7), h9 = hours(blend, handy, 8), h10 = hours(blend, handy, 9);
  check(total(h8.ships[0].cargo) === 8 && h8.ships[0].cargo.fame === 2, "a Handy holds eight: six gasoil, two FAME, exactly 25%");
  check(h9.delivered === 1 && total(h9.ships[0].cargo) === 4 && h9.ships[0].cargo.fame === 1, "a discharge takes the jetty's four out of the blend, every product in its share; the rest stays aboard");
  check(h10.delivered === 2 && total(h10.ships[0].cargo) === 0, "and the second four, on spec as the first was");
  check(invalid(blend, { ships: [{ x: 0, y: 0, h: 0, type: "handy", prog: [] }, { x: 1, y: 0, h: 0, type: "handy", prog: [] }] })?.includes("1 Handy"), "no more of a class than the fleet has");
  check(invalid(sea, typed("handy", 0, 0, "")) !== null, "no class the harbour doesn't offer");
  check(score(blend, { ships: [{ x: 0, y: 0, h: 0, type: "coaster", prog: [] }, { x: 1, y: 0, h: 0, type: "handy", prog: [] }] }, { bought: 0, done: 1, visited: new Set() }).cost === 46, "hire is each ship's class: a coaster $20k, a Handy $26k");
}
check(instructions(sol([0, 0, ["L", { n: 3, body: ["A", null] }, ".", null]])) === 3, "instructions: a loop's body counts once, empty hours not at all");

// the tape: loops, and every edit on them
const RING = "LANAAAAASADWSWWWWWNW";
const L1 = LEVELS.find(l => l.id === "first-cargo");
{
  const ring = ["L", "A", "N", lp(5, "A"), "S", "A", "D", "W", "S", lp(5, "W"), "N", "W"];
  const plays = p => flatten(p).map(op => op || " ").join("");
  check(plays(ring) === RING && T.width(ring) === 20, "a loop plays its body n times");
  const a = T.at(ring, 4);
  check(a.kind === "ghost" && a.badge && a.n === 5 && a.op === "A", "the first ghost of a loop carries its count");
  check(plays(T.paint(ring, 5, "N")) === "LANNNNNNSADWSWWWWWNW", "painting a ghost paints every pass");
  check(plays(T.insert(ring, 5, ["S"])) === "LANASASASASASSADWSWWWWWNW", "inserting into a ghost grows the body");
  check(plays(T.insert(ring, 3, ["S"])) === "LANSAAAAASADWSWWWWWNW", "inserting at a loop's first hour goes before the loop");
  check(plays(T.remove(ring, 6, 7)) === "LANAAASADWSWWWWWNW", "removing later passes takes passes away");
  check(plays(T.remove(ring, 3, 3)) === "LANSADWSWWWWWNW", "removing the whole body removes the loop");
  check(JSON.stringify(T.slice(ring, 3, 7)) === JSON.stringify([lp(5, "A")]), "copying a whole loop keeps the loop");
  check(JSON.stringify(T.slice(ring, 5, 9)) === JSON.stringify(["A", "A", "A", "S", "A"]), "copying part of a loop copies the hours it plays");
  check(JSON.stringify(T.slice(["L"], 0, 2)) === JSON.stringify(["L", null, null]), "copying past the end keeps the empty hours");
  check(JSON.stringify(T.loop(["L", "A", "A"], 1, 2)) === JSON.stringify(["L", { n: 2, body: ["A", "A"] }]), "picked hours become a loop played twice");
  check(T.loop(ring, 4, 9) === null, "a loop can't start inside another");
  check(plays(T.loop(ring, 2, 8)) === "LA" + "NAAAAAS".repeat(2) + "ADWSWWWWWNW", "a loop wholly inside the pick is unrolled into the new body");
  check(plays(T.setCount(ring, 3, 1)) === "LANASADWSWWWWWNW", "a count of one unrolls the loop");
  check(T.backwards(["A", "P", lp(2, "A"), "S"]).join("") === "PAASA", "the way back, once turned round: reversed, port and starboard swapped");
  let p = ring;
  for (let k = 0; k < 4; k++) p = T.shift(p, 20, true);
  check(plays(p) === RING.slice(16) + RING.slice(0, 16), "four hours later: the same loop, four hours behind");
  for (let k = 0; k < 4; k++) p = T.shift(p, 20, false);
  check(plays(p) === RING, "and four hours earlier puts it back");
  check(plays(T.shift(["A"], 3, true)) === " A", "a short row shifts inside the longest row's loop");
  check(invalid(L1, { ships: [{ x: 0, y: 2, prog: [{ n: 2, body: [lp(2, "A")] }] }] }) !== null, "loops don't nest");
  check(invalid(L1, { ships: [{ x: 0, y: 2, prog: [lp(1, "A")] }] }) !== null, "a loop plays at least twice");
}

// every level: the plans it carries (the ones the page shows when a par is tapped) reach its par on the measures they
// are for, none of them beats the par on any measure, and every measure has a plan to show
for (const level of LEVELS) {
  const best = {}, plans = level.plans || [];
  check(plans.length > 0, `${level.id}: carries its par plans`);
  for (const [i, plan] of plans.entries()) {
    const r = run(level, plan), sc = score(level, plan, r);
    check(invalid(level, plan) === null && !r.crash && r.done, `${level.id}, plan ${i + 1}: runs clean (${r.crash ? r.crash.kind : "not done"})`);
    for (const k of plan.par) check(sc[k] === level.par[k], `${level.id}, plan ${i + 1}: ${k} ${sc[k]}, par ${level.par[k]}`);
    if (r.done && !r.crash) for (const k of Object.keys(sc)) best[k] = Math.min(best[k] ?? Infinity, sc[k]);
  }
  check(JSON.stringify(best) === JSON.stringify(level.par), `${level.id}: par is what its plans reach (${JSON.stringify(best)})`);
  for (const k of Object.keys(level.par)) check(plans.some(p => p.par.includes(k)), `${level.id}: a plan to show for ${k}`);
  check(new Set(level.map.map(r => r.length)).size === 1, `${level.id}: every row of the map is as wide`);
}
// around the pars: a coaster's blend is on spec too, and dearer; two ships an hour apart meet at the jetty
const [L3] = ["first-blend"].map(id => LEVELS.find(l => l.id === id));
{ const coaster = { ships: [{ x: 2, y: 1, h: 0, type: "coaster", prog: program("L(2A)(2L)A(3S)D(3A)(3S)") }] }, r = run(L3, coaster);
  check(r.done && score(L3, coaster, r).cost === 52, `level 3: a coaster can only blend 50% FAME, on spec but dearer than the Handy's 25% ($${score(L3, coaster, r).cost}k)`); }
{ const lead = L1.plans[0].ships[0], flat = flatten(lead.prog), next = hours(L1, { ships: [lead] }, 1).ships[0];
  const close = { ships: [lead, { x: next.x, y: next.y, h: next.h, prog: flat.slice(1).concat(flat.slice(0, 1)) }] };
  check(run(L1, close).crash?.kind === "collision", "level 1: two ships an hour apart meet at the jetty"); }
console.log(bad ? `${bad} FAILED` : `harbour: rules, tape and ${LEVELS.length} levels' pars hold`);
process.exitCode = bad ? 1 : 0;
