// Harbour: the rules, case by case; the program edits; and every level's reference solutions, which must reach the
// level's par on each measure (so a change to the rules can't quietly make a level easier, harder or impossible).
import { start, step, run, score, period, invalid, flatten, total, instructions } from "../harbour-engine.js";
import * as T from "../harbour-tape.js";
import { LEVELS, CHAPTERS, program } from "../harbour-levels.js";

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
const blend = { map: ["GFD"], target: 10, fleet: { coaster: 1, handy: 1 }, maxCycles: 30, products: { gasoil: { name: "Gasoil", price: 1 }, fame: { name: "FAME", price: 3 } },
  jetties: { G: { kind: "load", product: "gasoil", parcel: 2 }, F: { kind: "load", product: "fame", parcel: 1 }, D: { kind: "discharge", parcel: 2, spec: { fame: [0.2, 1] } } } };
const typed = (type, x, y, p) => ({ ships: [{ x, y, h: 0, type, prog: prog(p) }] });
{
  const short = hours(blend, typed("coaster", 1, 0, "LAD"), 3);
  check(total(short.ships[0].cargo) === 1 && short.delivered === 0 && /carries 1, the jetty takes 2/.test(short.events[0]?.why), `less than the jetty's parcel is refused and stays aboard (${short.events[0]?.why})`);
  const noFame = hours(blend, typed("coaster", 0, 0, "LLAAD"), 5);
  check(noFame.delivered === 0 && /FAME 0%, needs at least 20%/.test(noFame.events[0]?.why), `a cargo off spec is refused (${noFame.events[0]?.why})`);
  const full = hours(blend, typed("coaster", 0, 0, "LLL"), 3);
  check(total(full.ships[0].cargo) === 4, "a coaster holds four: a third lift of two doesn't fit");
  const rich = hours(blend, typed("coaster", 0, 0, "LALLADD"), 7);
  check(rich.delivered === 4 && total(rich.ships[0].cargo) === 0, "a coaster's best blend on spec here: two gasoil, two FAME, 50%, delivered two an hour");
  const handy = typed("handy", 0, 0, "LLLLALLADDDDD"), h7 = hours(blend, handy, 7), h9 = hours(blend, handy, 9);
  check(total(h7.ships[0].cargo) === 10 && h7.ships[0].cargo.fame === 2, "a Handy holds ten: eight gasoil, two FAME, exactly 20%");
  check(h9.delivered === 2 && Math.abs(total(h9.ships[0].cargo) - 8) < 1e-9 && Math.abs(h9.ships[0].cargo.fame - 1.6) < 1e-9, "a discharge takes the jetty's two out of the blend, every product in its share; the rest stays aboard, still 20%");
  check(run(blend, handy).done === 13 && run(blend, handy).delivered === 10, "five parcels of two, every one on spec: ten delivered");
  check(invalid(blend, { ships: [{ x: 0, y: 0, h: 0, type: "handy", prog: [] }, { x: 1, y: 0, h: 0, type: "handy", prog: [] }] })?.includes("1 Handy"), "no more of a class than the fleet has");
  check(invalid(sea, typed("handy", 0, 0, "")) !== null, "no class the harbour doesn't offer");
  check(score(blend, { ships: [{ x: 0, y: 0, h: 0, type: "coaster", prog: [] }, { x: 1, y: 0, h: 0, type: "handy", prog: [] }] }, { bought: 0, done: 1, visited: new Set() }).cost === 50, "hire is each ship's class: a coaster $20k, a Handy $30k");
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
// a coaster's blends, half FAME (four units) or a third (three, its heel topped up every lap), are on spec and dearer
// than the Handy's exact B20: what the level teaches
for (const prog of ["L(2A)(2L)A(3S)(2D)(3A)(3S)", "L(2A)LA(3S)(2D)(3A)(3S)"]) {
  const coaster = { ships: [{ x: 2, y: 1, h: 0, type: "coaster", prog: program(prog) }] }, r = run(L3, coaster), c = r.done && score(L3, coaster, r).cost;
  check(r.done && c > L3.par.cost, `level 3: a coaster's blend (${prog}) is on spec and dearer than the Handy's exact B20 ($${c}k against $${L3.par.cost}k)`);
}
{ const lead = L1.plans[0].ships[0], flat = flatten(lead.prog), next = hours(L1, { ships: [lead] }, 1).ships[0];
  const close = { ships: [lead, { x: next.x, y: next.y, h: next.h, prog: flat.slice(1).concat(flat.slice(0, 1)) }] };
  check(run(L1, close).crash?.kind === "collision", "level 1: two ships an hour apart meet at the jetty"); }
// a delivery window: the Handy alone on the far run takes 117 hours, so Two refineries' 100-hour window stops it there
{ const TR = LEVELS.find(l => l.id === "two-refineries"), handy = { ships: [{ x: 2, y: 3, h: 2, type: "handy", prog: program("DDDDDSSSPAAAAPSSLLLLLSSSPAAAAPSS") }] };
  const r = run(TR, handy);
  check(!r.done && !r.crash && r.t === TR.deadline, `two refineries: the Handy alone is stopped by the window at hour ${TR.deadline} (${r.t}, ${r.delivered} delivered)`);
  check(run({ ...TR, deadline: undefined }, handy).done > TR.deadline, "two refineries: without the window, the Handy alone gets there, late"); }
// each customer its own target: a plan that serves only A never finishes Heels, however much it delivers
{ const H = LEVELS.find(l => l.id === "heels"), onlyA = { ships: [{ x: 3, y: 2, h: 2, type: "handy", prog: program("(5L)(2S)A(5D)A(3S)(2A)S") }] };
  const r = run(H, onlyA);
  check(!r.done && r.got.A >= 12 && !r.got.B, `heels: serving only A delivers ${r.got.A} there and never finishes`); }
// the heel: B30 first leaves FAME aboard, so the pure grade is refused at A
{ const H = LEVELS.find(l => l.id === "heels"), wrong = { ships: [{ x: 3, y: 2, h: 2, type: "handy", prog: program("(3L)(2S)A.ASL(2S)(3D)(2A)S(2L)(2S)A(3D)ASA(2S)(2A)S") }] };
  let st = start(H, wrong), refused = null;
  for (let t = 0; t < 60 && !refused; t++) { st = step(H, wrong, st); refused = st.events.find(e => e.kind === "refused"); }
  check(refused && /FAME/i.test(refused.why), `heels: a FAME heel is refused by the pure customer (${refused?.why})`); }
// the regions, a week at a time: the par run reaches both regions' engines, ARA's lane is what lets the Baltic finish,
// a region is fed a drop a week for every par met in its chapter's harbours, two drops more a week are worth a star (and
// a contract) in the Baltic's first season, and the rules case by case
{ const S = await import("../harbour-season.js");
  const B = S.regionOf("baltic"), A = S.regionOf("ara");
  const { company: C, weeks } = S.parRun();
  check(C.regions.baltic.solved && C.regions.ara.solved, "the par run solves both regions");
  check(C.regions.baltic.solvedAt === 14 && weeks[13].reports.baltic.solved, `the par run: the Baltic solved in its 14th week, the week after ARA's first cargo lands (${C.regions.baltic.solvedAt})`);
  for (const id of ["baltic", "ara"]) { const e = S.engineOf(C, id, S.PAR.feeds); check(Math.abs(e - S.PAR.engine[id]) < 0.05, `${id}: the par run's engine is the par (${e} against ${S.PAR.engine[id]})`); }
  check(weeks.every(w => Object.values(w.reports).every(r => r.age < 4 || r.star >= 0 || r.event)), "the par run breaks no contract outside an event week");
  // without the lane: the same moves, no MR on it, and the Baltic's long-term contracts can't be kept
  { let c = S.startRegion(S.newCompany(), "baltic");
    for (const w of S.PAR.weeks) { for (const id of ["baltic", "ara"]) for (const a of w[id] || []) c = S.act(c, id, a); c = S.playCompany(c, S.PAR.feeds).company; }
    check(!c.regions.baltic.solved && c.regions.baltic.held.some(h => h.endsWith("-2")), "without ARA's lane the Baltic takes its long-term contracts and can't keep them: never solved"); }
  // the Baltic runs on its own only with ARA's diesel landing and 8 of its harbours' 12 drops, however much else comes in
  { const play = (feed, lane = true) => { let c = S.startRegion(S.newCompany(), "baltic"), short = [];
      for (const w of S.PAR.weeks) {
        for (const id of ["world", "baltic", "ara"]) for (const a of w[id] || []) if (lane || id !== "world") c = S.act(c, id, a);
        const out = S.playCompany(c, { ...S.PAR.feeds, baltic: feed }); c = out.company; short = out.reports.baltic.short.length ? out.reports.baltic.short : short;
      }
      return { solved: c.regions.baltic.solved, short: short.join() }; };
    check(S.dropsToSolve(B) === 8 && S.dropsToSolve(A) === 0, "the Baltic wants 2.5 drops of 4 a harbour (8 of 12) to run on its own; ARA asks nothing more");
    const alone = play(12, false), seven = play(7), eight = play(8);
    check(!alone.solved && /lane/.test(alone.short), `without ARA's lane, even all twelve drops (enough to keep its contracts) don't solve it (short of: ${alone.short})`);
    check(!seven.solved && seven.short === "drops" && eight.solved, "with the lane, seven drops keep its contracts and still don't solve it; eight do"); }
  // net a week, not a balance: a region keeps no running total; rented tank costs its rent every week, and the par's
  // room is the right size, a tank more only rent and stock, a tank fewer short of its contracts
  { check(!("coins" in S.newRegion(B)), "a region keeps no running balance, only each week's net");
    // steady: a region's net a week over two seasons' offers, once a change of room has settled (its stock drawn down
    // or filled), from where the par run ends
    const steady = (k, d) => { let c = JSON.parse(JSON.stringify(C)), sum = 0; const r = c.regions[k]; r.cap += d; r.tank = Math.min(r.tank, r.cap);
      for (let w = 0; w < 12; w++) { const out = S.playCompany(c, S.PAR.feeds); c = out.company; if (w >= 4) sum += out.reports[k].net; } return Math.round(sum / 8 * 10) / 10; };
    for (const k of ["baltic", "ara"]) { const [fewer, par, more] = [-6, 0, 6].map(d => steady(k, d));
      check(par > fewer && par > more, `${k}: the par's room, ${C.regions[k].cap}, is the best size: ${par} a week, a tank fewer ${fewer}, a tank more ${more}`); }
    const r = { ...S.newRegion(B), cap: 24 }, out = S.playWeek(B, r, {}).report;
    check(S.tanksOf(B, r) === 2 && out.rent === 6 && out.net === -6, "two rented tanks cost 6 a week, whatever comes in");
    check(S.unrent(B, { ...r, tank: 18 }).cap === 18 && S.unrent(B, { ...r, tank: 19 }).cap === 24 && S.unrent(B, S.newRegion(B)).cap === 12, "a tank goes back when what's in the terminal fits without it, and only a rented one"); }
  // the feed: a drop a week for every par met in the region's own chapter's harbours, and no other's
  { const chapterOf = id => LEVELS.find(l => l.id === id).chapter, drops = { "first-cargo": 2, "up-the-creek": 3, rundown: 3, "first-blend": 4, "two-refineries": 3, trickle: 1, roundabout: 4 };
    check(S.REGIONS.every(R => R.feed.levels.length && R.feed.levels.join() === LEVELS.filter(l => l.chapter === R.chapter).map(l => l.id).join()), "each region is fed by its own chapter's harbours, all of them");
    check(S.feedOf(B, id => drops[id]) === 8 && S.feedOf(A, id => drops[id]) === 8 && S.feedOf(B, () => 0) === 0 && S.feedOf(B, () => 4) === 12 && S.feedOf(A, () => 4) === 20,
      "a drop a week for every par met: the Baltic's 2 + 3 + 3 feed 8, ARA's 4 + 3 + 1 feed 8 (the Straits' drops feed neither); none, nothing; every par, 12 and 20"); }
  { const stars = feed => { let c = S.startRegion(S.newCompany(), "baltic"); for (const w of S.PAR.weeks.slice(0, 4)) { for (const a of w.baltic || []) c = S.act(c, "baltic", a); c = S.playCompany(c, { baltic: feed }).company; } return c.regions.baltic.stars; };
    check(stars(8) === 3 && stars(6) === 2, `the first season: ★${stars(8)} on eight drops a week, ★${stars(6)} on six (Rakvere's contract wants ★3)`); }
  // the rules, case by case
  let s = S.newRegion(B);
  check(S.pick(B, S.pick(B, s, "truck"), "tank") === S.pick(B, s, "truck") || S.pick(B, S.pick(B, s, "truck"), "tank").pool.truck === 2 && S.pick(B, S.pick(B, s, "truck"), "tank").cap === 12, "one offer a week");
  check(S.pick(B, s, "ship") === s, "only this week's offers can be taken");
  { const full = { ...S.newRegion(B), tank: 12 }, out = S.playWeek(B, full, { feed: 8 }).report;
    check(out.arrived.feed === 0 && out.turned === 8 && out.net === 0, `a full tank turns the plant away and pays nothing for it (${JSON.stringify(out.arrived)}, ${out.net})`); }
  { let r = S.newRegion(B); r.stars = 3; r.age = 4; r = S.accept(B, r, "tallinn-1");
    const out = S.playWeek(B, r, { feed: 8 });
    check(out.report.towns.tallinn.got === 0 && out.report.star === -1 && out.state.stars === 2, "a contract left short (no vehicle on the road) costs a star");
    check(S.accept(B, { ...S.newRegion(B), age: 4, stars: 1 }, "tallinn-1").held.length === 0, "a contract wants its stars"); }
  { let c = S.startRegion(S.startRegion(S.newCompany(), "baltic"), "ara"); c = S.setMRs(c, "ara-baltic", 1);
    c = S.act(c, "ara", ["place", "rotterdam", "truck"]);
    const room = x => ({ ...x, regions: { ...x.regions, baltic: { ...x.regions.baltic, tank: 0 } } });
    const w1 = S.playCompany(c, { ara: 7 }), w2 = S.playCompany(room(w1.company), { ara: 7 });
    check(w1.reports.ara.exported > 0 && !w1.reports.baltic.arrived.lane && w2.reports.baltic.arrived.lane === w1.reports.ara.exported, `a lane's cargo loads one week and lands the next (${w1.reports.ara.exported} loaded, ${w2.reports.baltic.arrived.lane} landed)`);
    const w2full = S.playCompany(w1.company, { ara: 7 });       // the Baltic's tank, six in twelve: room for six
    check(w2full.reports.baltic.arrived.lane === 6 && w2full.reports.ara.exported === 6 && w2full.company.lanes["ara-baltic"].aboard === 8, "lane cargo that doesn't fit waits aboard, and the MR loads only what it has room for");
    check(w1.company.regions.baltic.age === 1 && w1.company.regions.ara.age === 1 && w1.company.week === 1, "a company week plays every region started"); }
  check(!S.playCompany(S.startRegion(S.newCompany(), "baltic"), {}).company.regions.ara, "a region not opened yet doesn't run");
  check(S.setMRs(S.startRegion(S.newCompany(), "baltic"), "ara-baltic", 1).lanes["ara-baltic"].mrs === 0, "no MR on a lane until both its ends run"); }
// the campaign: a new player meets one level; each finish opens the next; the regions, North-West Europe, the world and
// the Straits open when they should; Continue passes over the Baltic while it waits on ARA
{ const K = await import("../harbour-campaign.js"), S = await import("../harbour-season.js");
  const run = S.parRun(), f = (done, company = S.newCompany()) => ({ finished: id => done.includes(id), company });
  const open = x => K.STEPS.filter(s => K.isOpen(s, x)).map(s => s.id);
  check(new Set(K.STEPS.map(s => s.id)).size === K.STEPS.length && LEVELS.every(l => K.STEPS.some(s => s.id === l.id)) && S.REGIONS.every(r => K.STEPS.some(s => s.id === `region:${r.id}`)), "every level and region is in the campaign once");
  check(K.STEPS.every(s => CHAPTERS.some(c => c.id === K.chapterOf(s.id))), "every step is in a chapter");
  check(open(f([])).join() === "first-cargo" && K.continueTo(f([])) === "first-cargo" && K.chaptersShown(f([])).length === 1, "a new player meets First cargo alone");
  check(open(f(["first-cargo", "up-the-creek", "rundown"])).includes("region:baltic") && !open(f(["first-cargo", "up-the-creek"])).includes("region:baltic"), "the Baltic opens with Rundown finished");
  const harbours = ["first-cargo", "up-the-creek", "rundown"];
  check(!open(f(harbours, run.weeks[6].after)).includes("first-blend") && open(f(harbours, run.weeks[7].after)).includes("first-blend"), "North-West Europe opens when the Baltic reaches its long-term contracts");
  const nwe = [...harbours, "first-blend", "two-refineries"];
  check(["region:ara", "world", "trickle"].every(id => open(f(nwe, run.weeks[8].after)).includes(id)) && K.continueTo(f(nwe, run.weeks[8].after)) === "region:ara", "ARA, the world and Trickle open with Two refineries; Continue goes to ARA, not the waiting Baltic");
  check(K.continueTo(f(nwe, run.weeks[12].after)) === "region:baltic", "with the lane running, Continue goes back to the Baltic");
  check(!open(f(nwe, run.weeks[12].after)).includes("roundabout") && open(f(nwe, run.weeks[13].after)).includes("roundabout"), "the Straits open when the Baltic runs on its own");
  check(/^Finish Up the creek$/.test(K.lockedWhy(K.stepOf("rundown"))) && /the Baltic/.test(K.lockedWhy(K.stepOf("first-blend"))), "a locked step says why");
  // drops: a par met is one; the plan that met it is kept, and only a better one on that measure replaces it
  const R3 = LEVELS.find(l => l.id === "rundown"), par = R3.par;
  check(K.parsMet(R3, {}).length === 0 && K.parsMet(R3, { ...par }).join() === "cost,hours,water,instructions" && K.parsMet(R3, { cost: par.cost, hours: par.hours + 1 }).join() === "cost", "a par met is a drop: at par or under, each measure on its own");
  const shipsA = [{ x: 1, y: 1, h: 0, prog: ["A"] }], shipsB = [{ x: 2, y: 2, h: 0, prog: ["L"] }];
  const k1 = K.keepPlans({}, { cost: par.cost, hours: par.hours + 5, water: par.water, instructions: par.instructions + 2 }, par, shipsA);
  check(Object.keys(k1).join() === "cost,water" && k1.cost.v === par.cost && k1.cost.ships[0].prog[0] === "A" && k1.cost.ships !== shipsA, "a run keeps its plan for each par it meets, a copy");
  const k2 = K.keepPlans(k1, { cost: par.cost, hours: par.hours, water: par.water - 1, instructions: par.instructions }, par, shipsB);
  check(k2.cost === k1.cost && k2.water.v === par.water - 1 && k2.water.ships[0].prog[0] === "L" && k2.hours.v === par.hours && k2.instructions,
    "a later run keeps its plan where it meets a new par or does better, and leaves an equal one as it was");
  check(K.keepPlans(k2, { cost: par.cost + 1, hours: par.hours + 1, water: par.water, instructions: par.instructions }, par, shipsA) === k2, "a run that does no better keeps nothing new");
  // the menu's glimpse of the chapter ahead, and what opens it
  const ahead = x => { const c = K.nextChapter(x); return c && `${c.id}: ${c.why}`; };
  check(ahead(f([])) === "nwe: when the Baltic reaches its long-term contracts" && ahead(f(harbours, run.weeks[7].after)) === "world: when you finish Two refineries"
    && ahead(f(nwe, run.weeks[8].after)) === "straits: when the Baltic runs on its own" && ahead(f(nwe, run.weeks[13].after)) === null, `the chapter ahead, and what opens it (${ahead(f([]))})`); }
console.log(bad ? `${bad} FAILED` : `harbour: rules, tape, ${LEVELS.length} levels' pars, the regions' engines and the campaign hold`);
process.exitCode = bad ? 1 : 0;
