// Settle's rules (settle-engine.js): the deal from a seed, a parcel settling by density (lifting the lighter ones),
// lines of a grade at one level in neighbouring tanks, shipping them (what's above dropping, wave after wave), the
// points, a spill past eight (unless the pump ships its own tank down first), the deliveries (making no line, more
// often), slops (FAME souring on water, never lining up), the draw-off, the tankers (three of the jetty's grade in a
// line, four of any other; the next coming in every ten pumps and shipping what stands ready for it), the end at the
// third spill, a game saved and opened again, and whole games played out to their end.
import { TANKS, LEVELS, GRADES, LIVES, START, NAMES, DENSITY, PACE, WATER, FAME, SLOP, SOUR, DRAW, TANKER, deliveryEvery, deliveryCount, newGame, upgrade, pumped, foot, need, lines, ship, pump, drawOff, draws, worth, moves, filled } from "../settle-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sorted = t => t.every((g, k) => k === 0 || DENSITY[t[k - 1]] >= DENSITY[g]);
const DIESEL = 2, NAPHTHA = 3;
/** A farm drawn by hand, the tanker at the jetty for water (so water ships by threes) and staying, no delivery coming. */
const game = (tanks, hand = [0, 0], extra = {}) => Object.assign(newGame(1), { tanks: [...tanks, ...Array(TANKS - tanks.length).fill(null).map(() => [])], hand, untilDelivery: 99, want: WATER, next: FAME, untilTanker: 99 }, extra);

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.tanks) !== JSON.stringify(c.tanks), "the same seed deals the same farm, another seed another");
  check(filled(a) === START && a.tanks.every(sorted) && lines(a.tanks).length === 0 && a.hand.length === 2 && a.lives === LIVES, `${START} parcels, every tank in order, no line standing, two parcels offered`);
  check(DENSITY.slice(0, GRADES).every((d, k) => k === 0 || DENSITY[k - 1] > d) && NAMES[SLOP] === "Slops" && DENSITY[WATER] > DENSITY[SLOP] && DENSITY[SLOP] > DENSITY[FAME], "four grades, heaviest first: water, FAME, diesel, naphtha; and slops, between water and FAME");
  check(a.sour.every(x => x === 0) && a.untilDraw === DRAW && draws(a).length === 0, `nothing souring yet, the first draw-off ${DRAW} pumps away`);
}

// ---------- settling ----------
{
  const t = [[0, 2, 3]];
  check(pumped(t, 0, 1)[0].join() === "0,1,2,3" && pumped(t, 0, 3)[0].join() === "0,2,3,3" && pumped(t, 0, 0)[0].join() === "0,0,2,3", "a parcel sinks below everything lighter and settles on what's as heavy or heavier");
  check(t[0].join() === "0,2,3", "pumping shows the tanks after without changing them");
}

// ---------- lines and shipping ----------
{
  const flat = [[0], [0], [0], [1], [0], [0]];
  check(lines(flat).map(([t, l]) => `${t}:${l}`).join() === "0:0,1:0,2:0", "three of a grade at one level in neighbouring tanks; two aren't enough");
  check(lines([[0], [], [0], [0]]).length === 0 && lines([[1, 2], [0, 2], [0, 2], [3]]).map(x => x.join(":")).join() === "0:1,1:1,2:1", "a tank without that level breaks the line; any level counts");
  const r = ship([[0, 2], [0, 3], [0], [1]]);
  check(r.waves.length === 1 && r.waves[0].length === 3 && r.tanks.map(t => t.join()).join("|") === "2|3||1", "they ship out, and what floated above drops into their place");
  let cascades = 0;
  for (let g = 0; g < 40; g++) {
    let s = newGame(300 + g);
    for (let k = 0; k < 80 && !s.over; k++) { const m = moves()[(k * 7 + g) % 12], o = pump(s, m.slot, m.t); if (o.waves.length > 1) cascades++; s = o.state; }
  }
  check(cascades > 0, `and what drops can line up again, a second wave (${cascades} seen)`);
  check(worth(3) === 90 && worth(6) === 360 && worth(9) === 810, "ten times the square of all a pump ships, its waves together");
}

// ---------- a pump ----------
{
  const s = game([[0, 2], [0, 3], [2]], [0, 1]), r = pump(s, 0, 2);
  check(r.level === 0 && r.waves[0].length === 3 && r.gain === 90 && r.state.score === 90 && r.state.tanks[2].join() === "2", "water into the third tank settles under its diesel, the water ships out, 90");
  check(s.tanks[2].join() === "2" && s.hand[0] === 0 && s.pumps === 0, "the game pumped from is left as it was");
  check(r.state.hand[1] === 1 && r.state.hand[0] >= 0 && r.state.pumps === 1 && moves().length === 12, "the parcel used is replaced; two parcels, six tanks: twelve pumps");
  const full = game([[0, 0, 1, 1, 2, 2, 3, 3]], [2, 0]), sp = pump(full, 0, 0);
  check(sp.spilled === 3 && sp.state.lives === LIVES - 1 && sp.state.tanks[0].length === LEVELS && sp.state.tanks[0].join() === "0,0,1,1,2,2,2,3", "a ninth parcel: the tank spills its lightest over the top, a life");
  const saved = pump(game([[0, 0, 1, 1, 2, 2, 3, 3], [0], [0]], [0, 0]), 0, 0);
  check(saved.spilled < 0 && saved.state.lives === LIVES, "unless the pump ships some of that tank out first");
  let threw = 0;
  try { pump(s, 0, 6); } catch { threw++; }
  try { pump(Object.assign(structuredClone(s), { over: true }), 0, 0); } catch { threw++; }
  check(threw === 2, "no seventh tank, and nothing pumped once it's over");
}

// ---------- deliveries ----------
{
  const s = game([[1], [2]], [3, 3], { untilDelivery: 1, pumps: 10 }), r = pump(s, 0, 5);
  check(r.delivered.length === deliveryCount(10) && r.state.untilDelivery === deliveryEvery(11), "every few pumps a delivery comes in of its own, then the count starts again");
  let quiet = true, seen = 0;
  for (let g = 0; g < 30; g++) {
    let t = newGame(500 + g);
    for (let k = 0; k < 120 && !t.over; k++) {
      const m = moves()[(k * 5 + g) % 12], o = pump(t, m.slot, m.t);
      seen += o.delivered.length;
      if (lines(o.state.tanks, o.state.want).length || o.state.tanks.some(x => x.length > LEVELS) || !o.state.tanks.every(sorted)) quiet = false;
      t = o.state;
    }
  }
  check(quiet && seen > 200, `deliveries make no line that ships and fill no tank past eight; every tank stays in order (${seen} deliveries)`);
  check(deliveryEvery(0) > deliveryEvery(100) && deliveryCount(500) > deliveryCount(0) && PACE.every(([, e, c]) => e >= 1 && c >= 1), "they come more often, and more at once, as the game goes on");
}

// ---------- slops ----------
{
  // the same parcel offered every time, so a game can be played out exactly
  const offer = (s, g, t) => pump(Object.assign(structuredClone(s), { hand: [g, g] }), 0, t);
  let s = game([[WATER, FAME, 2], [3]]), r = null;
  for (let k = 1; k < SOUR; k++) { r = offer(s, 3, 5); s = r.state; }
  check(s.sour[0] === SOUR - 1 && s.tanks[0].join() === "0,1,2" && !r.soured.length, `FAME standing on water: a pump nearer souring each time (${SOUR - 1} so far)`);
  r = offer(s, 3, 5);
  check(r.soured.join() === "0,1" && r.state.tanks[0].join() === `0,${SLOP},2` && r.state.sour[0] === 0, `the ${SOUR}th pump, the FAME touching the water turns to slops`);
  check(lines([[SLOP], [SLOP], [SLOP]]).length === 0 && pumped([[0, SLOP, 1]], 0, 0)[0].join() === `0,0,${SLOP},1` && pumped([[0, SLOP, 1]], 0, 1)[0].join() === `0,${SLOP},1,1`, "slops never line up, and settle under FAME, on water");
  let t = r.state;
  for (let k = 0; k < SOUR + 2; k++) t = offer(t, FAME, 0).state;
  check(t.tanks[0].filter(g => g === SLOP).length === 1 && t.sour[0] === 0, "slops between water and FAME keep them apart: no more sour there");
  const apart = offer(game([[WATER, FAME], [WATER]], [0, 0], { sour: [SOUR - 1, 0, 0, 0, 0, 0] }), WATER, 2);
  check(apart.soured.length === 0 && apart.state.tanks[0].join() === "1" && apart.state.sour[0] === 0, "water shipped from under it, the FAME's clock stops");
}

// ---------- the draw-off ----------
{
  const s = game([[WATER, SLOP, 2], [2], [2], [WATER]], [3, 3], { untilDraw: 0, want: DIESEL }), r = drawOff(s, 0);
  check(r.drained.join() === `0,${SLOP}` && r.waves.length === 1 && r.waves[0].length === 3 && r.gain === 90 && r.state.tanks[0].length === 0, "a draw-off drains the water and slops from a tank's foot; the diesel drops level with its neighbours' and ships, 90");
  check(r.state.untilDraw === DRAW && r.state.pumps === 1 && r.state.hand.join() === "3,3" && draws(r.state).length === 0, `it counts as a pump, leaves the parcels offered as they were, and the next is ${DRAW} pumps away`);
  check(foot([WATER, WATER, SLOP, 1, 3]) === 3 && foot([1, 2]) === 0 && draws(s).join() === "0,3", "it takes only from a tank with water or slops at its foot");
  let threw = 0;
  try { drawOff(s, 1); } catch { threw++; }
  try { drawOff(Object.assign(structuredClone(s), { untilDraw: 2 }), 0); } catch { threw++; }
  check(threw === 2, "not on a tank with nothing at its foot, nor before it's ready");
  const counting = pump(game([[1]], [3, 3], { untilDraw: 3 }), 0, 4);
  check(counting.state.untilDraw === 2 && pump(game([[1]], [3, 3], { untilDraw: 0 }), 0, 4).state.untilDraw === 0, "each pump brings it nearer; once ready it waits");
  const was = newGame(3);
  delete was.sour; delete was.untilDraw;
  const up = upgrade(was);
  check(up.sour.length === TANKS && up.untilDraw === DRAW && !("sour" in was) && upgrade(up) === up, "a game saved before slops and draw-offs is given them");
}

// ---------- the tankers ----------
{
  const s = newGame(11);
  check(s.want >= 0 && s.want < GRADES && s.next >= 0 && s.next < GRADES && s.next !== s.want && s.untilTanker === TANKER, `a tanker at the jetty for one grade from the start, the next for another, ${TANKER} pumps away`);
  check(need(DIESEL, DIESEL) === 3 && need(NAPHTHA, DIESEL) === 4 && need(NAPHTHA) === 3, "three of the tanker's grade make a line, four of any other");
  const three = [[DIESEL], [DIESEL], [DIESEL]], four = [[NAPHTHA], [NAPHTHA], [NAPHTHA], [NAPHTHA]];
  check(lines(three, DIESEL).length === 3 && lines(three, NAPHTHA).length === 0 && lines(four, DIESEL).length === 4 && lines(three).length === 3, "three diesel ship with diesel's tanker in, not with another's; four naphtha ship with any; with none given, the three stand ready");
  check(ship(three, NAPHTHA).waves.length === 0 && ship(three, DIESEL).waves[0].length === 3, "so they stay in the tanks until diesel's tanker comes");
  // naphtha's three standing ready, diesel's tanker in, naphtha's next, after this pump
  const ready = game([[NAPHTHA], [NAPHTHA], [NAPHTHA], [DIESEL], [DIESEL]], [DIESEL, 0], { want: DIESEL, next: NAPHTHA, untilTanker: 1 });
  const r = pump(ready, 0, 5);
  check(r.waves.length === 1 && r.waves[0].every(([t, , g]) => t >= 3 && g === DIESEL) && r.gain === 90, "the pump ships what lines up with the tanker it finds: three diesel, 90");
  check(r.tanker && r.tanker.want === NAPHTHA && r.tanker.waves[0].length === 3 && r.tanker.waves[0].every(([, , g]) => g === NAPHTHA) && r.tanker.gain === 90 && r.state.score === 180, "then naphtha's tanker comes in, and the three naphtha standing ready for it ship: 90 more");
  check(r.state.want === NAPHTHA && r.state.next !== NAPHTHA && r.state.untilTanker === TANKER && r.state.tanks.slice(0, 5).every(t => !t.length), `it's at the jetty now, the next for another grade, ${TANKER} pumps away`);
  const quiet = pump(game([[NAPHTHA], [NAPHTHA], [NAPHTHA]], [DIESEL, 0], { want: DIESEL, next: FAME, untilTanker: 3 }), 0, 5);
  check(!quiet.tanker && quiet.state.untilTanker === 2 && quiet.state.tanks[0].length === 1, "until then the tanker stays, a pump nearer its next, and naphtha's three wait");
  // every tenth pump a tanker comes in, never for the grade before it, and every grade in its turn
  let comes = [], same = 0;
  const grades = new Set();
  const emptiest = u => u.tanks.findIndex(x => x.length === Math.min(...u.tanks.map(y => y.length)));
  let t = newGame(77);
  for (let k = 0; k < 4 * TANKER; k++) { const o = pump(t, 0, emptiest(t)); if (o.tanker) { comes.push(t.pumps + 1); if (o.tanker.want === t.want) same++; } t = o.state; }
  for (let g = 0; g < 40; g++) { let u = newGame(900 + g); grades.add(u.want); for (let k = 0; k < 3 * TANKER && !u.over; k++) { u = pump(u, k % 2, emptiest(u)).state; grades.add(u.want); } }
  check(comes.join() === [1, 2, 3, 4].map(k => k * TANKER).join() && !same && grades.size === GRADES, `a tanker every ${TANKER} pumps (${comes.join(", ")}), never for the grade of the one before it, and every grade in its turn`);
  const was = newGame(3);
  delete was.want; delete was.next; delete was.untilTanker;
  const up = upgrade(was), older = upgrade({ ...was, sour: undefined, untilDraw: undefined });
  check(up.want >= 0 && up.next !== up.want && up.untilTanker === TANKER && !("want" in was) && upgrade(up) === up && older.sour.length === TANKS && older.want >= 0, "a game saved before the tankers is given its first, one saved before slops as well both");
}

// ---------- the end ----------
{
  const r = pump(game([[0, 0, 1, 1, 2, 2, 3, 3]], [2, 0], { lives: 1 }), 0, 0);
  check(r.over && r.state.over && r.state.lives === 0, "the third spill ends the game");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 9; k++) { const m = moves()[(k * 5) % 12]; s = pump(s, m.slot, m.t).state; }
  const again = JSON.parse(JSON.stringify(s));
  check(JSON.stringify(pump(s, 1, 3)) === JSON.stringify(pump(again, 1, 3)), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  let z = 3;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const random = [], careful = [], habit = [], pairing = [];
  // two of a grade side by side at one level: a line one parcel short
  const pairs = tanks => { let n = 0; for (let t = 0; t + 1 < TANKS; t++) for (let l = 0; l < tanks[t].length; l++) if (tanks[t][l] !== SLOP && tanks[t][l] === tanks[t + 1][l]) n++; return n; };
  // the pump (or draw-off) that ships most and keeps the tanks low and level and the slops few
  const value = o => { const tall = Math.max(...o.state.tanks.map(x => x.length)); return o.gain - 4 * filled(o.state) - 6 * tall * tall - (o.spilled >= 0 ? 600 : 0) - 15 * o.state.tanks.flat().filter(x => x === SLOP).length; };
  const play = (s, pick) => { while (!s.over && s.pumps < 3000) s = pick(s, [...moves().map(m => pump(s, m.slot, m.t)), ...draws(s).map(k => drawOff(s, k))]); return s; };
  const best = (all, v) => all.reduce((a, o) => (v(o) > v(a) ? o : a)).state;
  for (let g = 0; g < 10; g++) {
    let s = newGame(100 + g);
    while (!s.over && s.pumps < 3000) { const m = moves()[Math.floor(rnd() * 12)]; s = pump(s, m.slot, m.t).state; }
    random.push(s.pumps);
    careful.push(play(newGame(100 + g), (t, all) => best(all, value)).pumps);
    // the habit: whatever ships most, else the left parcel into the emptiest tank
    habit.push(play(newGame(100 + g), (t, all) => {
      const top = all.reduce((a, o) => (o.gain > a.gain ? o : a));
      return top.gain ? top.state : pump(t, 0, t.tanks.findIndex(x => x.length === Math.min(...t.tanks.map(y => y.length)))).state;
    }).score);
    pairing.push(play(newGame(100 + g), (t, all) => best(all, o => value(o) + 25 * pairs(o.state.tanks))).score);
  }
  check(median(random) < 60, `pumping anywhere: three spills in about ${median(random)} pumps`);
  check(median(careful) > 1.5 * median(random) && Math.max(...careful) < 3000, `pumping with thought: about ${median(careful)} pumps, and the deliveries coming faster still end it`);
  check(median(pairing) > 1.25 * median(habit), `shipping when it can, else filling the emptiest tank, scores about ${median(habit).toLocaleString("en-GB")}; laying pairs for lines to come, about ${median(pairing).toLocaleString("en-GB")}`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("settle: the deal, settling, lines, a pump, deliveries, slops, the draw-off, the tankers, the end, saving, whole games");
