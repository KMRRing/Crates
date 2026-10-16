// Settle's rules (settle-engine.js): the deal from a seed, a parcel settling by density (lifting the lighter ones),
// lines of a grade at one level in neighbouring tanks, shipping them (what's above dropping, wave after wave), the
// points, a spill past eight (unless the pump ships its own tank down first), the deliveries (making no line, more
// often), the end at the third spill, a game saved and opened again, and whole games played out to their end.
import { TANKS, LEVELS, GRADES, LIVES, START, NAMES, DENSITY, PACE, deliveryEvery, deliveryCount, newGame, pumped, lines, ship, pump, worth, moves, filled } from "../settle-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sorted = t => t.every((g, k) => k === 0 || t[k - 1] <= g);
const game = (tanks, hand = [0, 0], extra = {}) => Object.assign(newGame(1), { tanks: [...tanks, ...Array(TANKS - tanks.length).fill(null).map(() => [])], hand, untilDelivery: 99 }, extra);

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.tanks) !== JSON.stringify(c.tanks), "the same seed deals the same farm, another seed another");
  check(filled(a) === START && a.tanks.every(sorted) && lines(a.tanks).length === 0 && a.hand.length === 2 && a.lives === LIVES, `${START} parcels, every tank in order, no line standing, two parcels offered`);
  check(NAMES.length === GRADES && DENSITY.every((d, k) => k === 0 || DENSITY[k - 1] > d), "four grades, heaviest first: water, FAME, diesel, naphtha");
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
      if (lines(o.state.tanks).length || o.state.tanks.some(x => x.length > LEVELS) || !o.state.tanks.every(sorted)) quiet = false;
      t = o.state;
    }
  }
  check(quiet && seen > 200, `deliveries make no line and fill no tank past eight; every tank stays in order (${seen} deliveries)`);
  check(deliveryEvery(0) > deliveryEvery(100) && deliveryCount(500) > deliveryCount(0) && PACE.every(([, e, c]) => e >= 1 && c >= 1), "they come more often, and more at once, as the game goes on");
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
  const random = [], greedy = [];
  for (let g = 0; g < 10; g++) {
    let s = newGame(100 + g);
    while (!s.over && s.pumps < 3000) { const m = moves()[Math.floor(rnd() * 12)]; s = pump(s, m.slot, m.t).state; }
    random.push(s.pumps);
    // the pump that ships most and keeps the tanks low and level
    let t = newGame(100 + g);
    while (!t.over && t.pumps < 3000) {
      let best = null, bv = -Infinity;
      for (const m of moves()) { const o = pump(t, m.slot, m.t), tall = Math.max(...o.state.tanks.map(x => x.length)), v = o.gain - 4 * filled(o.state) - 6 * tall * tall - (o.spilled >= 0 ? 600 : 0); if (v > bv) { bv = v; best = o; } }
      t = best.state;
    }
    greedy.push(t.pumps);
  }
  check(median(random) < 60, `pumping anywhere: three spills in about ${median(random)} pumps`);
  check(median(greedy) > 1.5 * median(random) && Math.max(...greedy) < 3000, `pumping with thought: about ${median(greedy)} pumps, and the deliveries coming faster still end it`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("settle: the deal, settling, lines, a pump, deliveries, the end, saving, whole games");
