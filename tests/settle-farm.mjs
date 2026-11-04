// Settle's Farm (settle-farm-engine.js): nine tanks in a 3x3 grid, each a column of up to eight parcels settling by density;
// a pickup at one level when one grade fills a rectangle of neighbouring tanks (2x2 for the vessel's grade, 3x2, 2x3 or 3x3
// for any; an L, a diagonal or a straight line of three never), what floats above dropping into cascades, the deliveries
// making no rectangle by themselves, the draw-off, a game saved and opened again, and whole games played by the tuning players.
import { TANKS, LEVELS, LIVES, START, PACE, WATER, FAME, SLOP, DENSITY, DRAW, deliveryEvery, deliveryCount, newGame, upgrade, pumped, lines, ship, pump, drawOff, draws, worth, moves, filled, tankOf } from "../settle-farm-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sorted = t => t.every((g, k) => k === 0 || DENSITY[t[k - 1]] >= DENSITY[g]);
const DIESEL = 2, NAPHTHA = 3;
/** Nine tanks drawn by hand, the vessel at the jetty for water (the barge) unless given, staying, no delivery coming. */
const game = (tanks, hand = [0, 0], extra = {}) => Object.assign(newGame(1), { tanks: [...tanks, ...Array(TANKS - tanks.length).fill(null).map(() => [])], hand, untilDelivery: 99, want: WATER, next: FAME, untilTanker: 99 }, extra);
/** One level of the grid, rows by columns: w f d n for a grade, s for slops, a dot for an empty tank. */
const plane = (...rows) => rows.join("").split("").map(c => ("wfdns".includes(c) ? ["wfdns".indexOf(c) === 4 ? SLOP : "wfdn".indexOf(c)] : []));
// pairs: two of a grade side by side or one behind the other at one level, part of a rectangle made
const pairsOf = tanks => { let n = 0; for (let t = 0; t < TANKS; t++) for (let l = 0; l < tanks[t].length; l++) if (tanks[t][l] !== SLOP) n += (t % 3 < 2 && tanks[t + 1][l] === tanks[t][l]) + (t < 6 && tanks[t + 3][l] === tanks[t][l]); return n; };
const shipped = (tanks, want) => lines(tanks, want).map(([t]) => t).join();

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.tanks) !== JSON.stringify(c.tanks), "the same seed deals the same farm, another seed another");
  check(a.tanks.length === 9 && filled(a) === START && a.tanks.every(sorted) && lines(a.tanks, a.want).length === 0 && a.hand.length === 2 && a.lives === LIVES, `nine tanks in a 3x3, ${START} parcels, every tank in order, no rectangle standing, two parcels offered`);
  check(moves().length === 18 && tankOf(1, 2) === 5 && a.want !== a.next, "two parcels, nine tanks: eighteen pumps; a vessel in, another next");
}

// ---------- settling ----------
{
  const t = Array.from({ length: 9 }, (_, k) => (k === 4 ? [0, 2, 3] : []));
  check(pumped(t, 4, 1)[4].join() === "0,1,2,3" && pumped(t, 4, 3)[4].join() === "0,2,3,3" && pumped(t, 4, 0)[4].join() === "0,0,2,3" && t[4].join() === "0,2,3", "in the middle tank as in any: a parcel sinks below the lighter and settles on what's as heavy or heavier");
}

// ---------- rectangles ----------
{
  const D = DIESEL;
  check(shipped(plane("dd.", "dd.", "..."), D) === "0,1,3,4", "a 2x2 of the vessel's grade ships");
  check(shipped(plane("dd.", "dd.", "..."), NAPHTHA) === "" && lines(plane("dd.", "dd.", "...")).length === 4, "a 2x2 of another grade doesn't: it stands ready for its vessel (shown with none given)");
  check(shipped(plane("nnn", "nn.", "..."), D) === "" && shipped(plane("nnn", "nnn", "..."), D) === "0,1,2,3,4,5", "a 3x2 of any grade ships, laid across; five of the six don't");
  check(shipped(plane("nn.", "nn.", "nn."), D) === "0,1,3,4,6,7", "or laid down (2x3)");
  check(shipped(plane("fff", "fff", "fff"), D) === "0,1,2,3,4,5,6,7,8", "a 3x3 of any grade ships, all nine");
  check(shipped(plane("nn.", "n.n", "..."), D) === "" && shipped(plane("nn.", "n..", "..."), D) === "" && shipped(plane("n.n", ".n.", "n.n"), NAPHTHA) === "", "an L shape, a diagonal, a cross never ship, with the vessel in or not");
  check(shipped(plane("ddd", "...", "..."), D) === "" && shipped(plane("d..", "d..", "d.."), D) === "" && shipped(plane("nnn", "...", "nnn"), D) === "", "a straight line of three, across or down, never ships, nor two apart");
  check(shipped(plane("dw.", "wd.", "..."), D) === "" && shipped(plane("dd.", "dw.", "..."), D) === "", "a mixed 2x2 never ships");
  check(shipped(plane("ss.", "ss.", "..."), D) === "" && shipped(plane("sss", "sss", "sss"), D) === "", "slops never ship");
  const tall = [[WATER, DIESEL], [WATER, DIESEL], [], [WATER], [WATER], [], [], [], []];
  check(lines(tall, WATER).map(p => p.join(":")).join() === "0:0,1:0,3:0,4:0" && lines(tall, DIESEL).length === 0, "the level counts: water at the foot of four tanks in a 2x2 ships, diesel one level up in two does not");
  check(lines([[0], [0], [], [], [0], [], [], [], []], WATER).length === 0, "a tank without that level breaks the rectangle");
  const two = [[0, 2], [0, 2], [], [0, 2], [0, 2], [], [], [], []];
  check(lines(two, WATER).length === 4 && lines(two, DIESEL).length === 4 && lines(two).length === 8, "two 2x2 at two levels: only the vessel's grade ships, both stand ready");
}

// ---------- shipping, cascades ----------
{
  const r = ship(plane("ww.", "ww.", "..."), WATER);
  check(r.waves.length === 1 && r.waves[0].length === 4 && r.tanks.every(t => !t.length), "a rectangle ships out");
  const s = ship([[0, 2, 1], [0, 3], [], [0, 2], [0, 3], [], [], [], []], WATER);
  check(s.waves.length === 1 && s.tanks.map(t => t.join()).join("|") === "2,1|3||2|3||||", "what floated above drops into their place");
  const chain = ship([[0, 1, 1], [0, 1, 1], [1], [0, 1, 1], [0, 1, 1], [1], [], [], []], WATER);
  check(chain.waves.length === 2 && chain.waves[0].length === 4 && chain.waves[1].length === 6 && filled({ tanks: chain.tanks }) === 4, "the water ships, the FAME above drops a level and fills a 3x2 with the neighbours': a second wave (the 2x2 of FAME left waits for its vessel)");
  check(worth(4) === 160 && worth(6) === 360 && worth(9) === 810, "ten times the square of all a pump ships, its waves together: a 2x2 is 160, a 3x2 360, a 3x3 810");
  // with thought (laying pairs), a second wave turns up now and then
  let waves = 0, st = newGame(311);
  for (let k = 0; k < 250 && !st.over; k++) {
    const all = moves().map(m => pump(st, m.slot, m.t)), top = all.reduce((a, o) => (a.gain + 40 * pairsOf(a.state.tanks) >= o.gain + 40 * pairsOf(o.state.tanks) ? a : o));
    if (top.waves.length > 1) waves++;
    st = top.state;
  }
  check(waves > 0, `and a second wave turns up in play (${waves} seen)`);
}

// ---------- a pump ----------
{
  const s = game([[0, 2], [0, 3], [], [0, 2], [], [], [], [], []], [0, 1]), r = pump(s, 0, 4);
  check(r.level === 0 && r.waves[0].length === 4 && r.gain === 160 && r.state.score === 160 && r.state.tanks[4].length === 0, "water into the middle tank completes the 2x2 for the barge: 160");
  check(s.tanks[4].length === 0 && s.pumps === 0, "the game pumped from is left as it was");
  const no = pump(game([[0], [0], [], [0], [], [], [], [], []], [0, 1], { want: DIESEL }), 0, 4);
  check(no.gain === 0 && no.waves.length === 0 && no.state.tanks[4].join() === "0", "the same 2x2 with diesel's tanker in stays in the tanks");
  const sp = pump(game([[0, 0, 1, 1, 2, 2, 3, 3]], [2, 0]), 0, 0);
  check(sp.spilled === 3 && sp.state.lives === LIVES - 1, "a ninth parcel spills the lightest, a life");
  let threw = 0;
  try { pump(s, 0, 9); } catch { threw++; }
  check(threw === 1, "no tenth tank");
}

// ---------- the tankers ----------
{
  const quiet = pump(game(plane("nn.", "nn.", "..."), [DIESEL, 0], { want: DIESEL, next: FAME, untilTanker: 3 }), 0, 8);
  check(!quiet.tanker && quiet.state.tanks[0].join() === "3", "a 2x2 of another grade waits for its vessel");
  const arrive = pump(game(plane("nn.", "nn.", "..."), [DIESEL, 0], { want: DIESEL, next: NAPHTHA, untilTanker: 1 }), 0, 8);
  check(arrive.tanker?.waves[0].length === 4 && arrive.tanker.gain === 160, "and ships when it berths");
}

// ---------- deliveries ----------
{
  check(deliveryEvery(0) > deliveryEvery(100) && deliveryCount(500) > deliveryCount(0) && PACE.every(([, e, c]) => e >= 1 && c >= 1), "deliveries come more often, and more at once, as the game goes on");
  let quiet = true, seen = 0;
  for (let g = 0; g < 24; g++) {
    let t = newGame(500 + g);
    for (let k = 0; k < 100 && !t.over; k++) {
      const m = moves()[(k * 5 + g) % 18], o = pump(t, m.slot, m.t);
      seen += o.delivered.length;
      if (lines(o.state.tanks, o.state.want).length || o.state.tanks.some(x => x.length > LEVELS) || !o.state.tanks.every(sorted)) quiet = false;
      t = o.state;
    }
  }
  check(quiet && seen > 150, `deliveries never complete a rectangle that ships, fill no tank past eight and leave every tank in order (${seen} deliveries)`);
}

// ---------- slops and the draw-off ----------
{
  const s = game([[WATER, SLOP, 2], [2], [], [2], [2], [], [], [], [WATER]], [3, 3], { untilDraw: 0, want: DIESEL }), r = drawOff(s, 0);
  check(draws(s).join() === "0,8" && r.drained.join() === `0,${SLOP}` && r.waves.length === 1 && r.waves[0].length === 4 && r.gain === 160, "a draw-off drains the water and slops from a foot; the diesel drops level with its neighbours' and fills a 2x2: 160");
  check(r.state.untilDraw === DRAW && r.state.pumps === 1, `it counts as a pump, the next ${DRAW} away`);
  const sour = pump(game([[WATER, FAME, 2]], [3, 3], { sour: [4, 0, 0, 0, 0, 0, 0, 0, 0] }), 0, 8);
  check(sour.soured.join() === "0,1" && sour.state.tanks[0].join() === `0,${SLOP},2`, "FAME standing on water sours into slops as in the row");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 9; k++) { const m = moves()[(k * 5) % 18]; s = pump(s, m.slot, m.t).state; }
  const again = JSON.parse(JSON.stringify(s));
  check(JSON.stringify(pump(s, 1, 3)) === JSON.stringify(pump(again, 1, 3)) && upgrade(again) === again, "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  let z = 3;
  const rnd = () => ((z = (z * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const random = [], careful = [], habit = [], pairing = [];
  const value = o => { const tall = Math.max(...o.state.tanks.map(x => x.length)); return o.gain - 4 * filled(o.state) - 6 * tall * tall - (o.spilled >= 0 ? 600 : 0) - 15 * o.state.tanks.flat().filter(x => x === SLOP).length; };
  const play = (s, pick) => { while (!s.over && s.pumps < 3000) s = pick(s, [...moves().map(m => pump(s, m.slot, m.t)), ...draws(s).map(k => drawOff(s, k))]); return s; };
  const best = (all, v) => all.reduce((a, o) => (v(o) > v(a) ? o : a)).state;
  const emptiest = t => t.tanks.findIndex(x => x.length === Math.min(...t.tanks.map(y => y.length)));
  for (let g = 0; g < 5; g++) {
    let s = newGame(100 + g);
    while (!s.over && s.pumps < 3000) { const m = moves()[Math.floor(rnd() * 18)]; s = pump(s, m.slot, m.t).state; }
    random.push(s.pumps);
    careful.push(play(newGame(100 + g), (t, all) => best(all, value)).pumps);
    // the habit: whatever ships most, else the left parcel into the emptiest tank
    habit.push(play(newGame(100 + g), (t, all) => { const top = all.reduce((a, o) => (o.gain > a.gain ? o : a)); return top.gain ? top.state : pump(t, 0, emptiest(t)).state; }));
    pairing.push(play(newGame(100 + g), (t, all) => best(all, o => value(o) + 25 * pairsOf(o.state.tanks))));
  }
  const score = a => a.map(s => s.score), pumps = a => a.map(s => s.pumps);
  check(median(random) < 60, `pumping anywhere: three spills in about ${median(random)} pumps`);
  check(median(careful) > 3 * median(random) && Math.max(...careful) < 3000, `pumping with thought: about ${median(careful)} pumps, and the deliveries coming faster still end it`);
  check(median(pumps(pairing)) > 1.4 * median(pumps(habit)) && median(score(pairing)) > 2 * median(score(habit)),
    `shipping when it can, else filling the emptiest tank, lasts about ${median(pumps(habit))} pumps and scores about ${median(score(habit)).toLocaleString("en-GB")}; laying pairs for rectangles to come, about ${median(pumps(pairing))} and ${median(score(pairing)).toLocaleString("en-GB")}`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("settle farm: the deal, settling, rectangles, cascades, a pump, the tankers, deliveries, the draw-off, saving, whole games");
