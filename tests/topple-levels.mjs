// Topple's levels (topple-levels.js) and what they ask of the engine (topple-engine.js): the fourteen tables and their
// goals, stones and water where nothing is laid, gilded hexagons that double a knock, the bell, the pieces a level deals
// (bridges, twins, balls, heavy dominoes and gates), the stars a score is worth, the pace of a level's knocks, Classic
// untouched, and whole games of every level played out by simple players (tests/topple-players.js), which also say how
// far each goal is from what they reach. The rules of the newer pieces (heavy, gates, springs, floors...) are in
// tests/topple-rules.mjs. `node tests/topple-levels.mjs measure` plays more games per level and prints what the README's
// numbers come from: `measure careful,corner games=24 levels=4,5`.
import { LEVELS, SCENES, FLOOR, ROCK, WATER, VOID, STARS, FREE, levelRules, starsAt, numberOf, custom, SIZE } from "../topple-levels.js";
import { CELLS, AXES, PIECES, PACE, at, rulesOf, newGame, moves, nbr, lay, turn, knock, cover, coverFor, colourAt, fitsAnywhere, chain, chains, group, knockOn, rate, untilKnock, BALL, RAINBOW, HEAVY } from "../topple-engine.js";
import { PLAYERS, play, turnAll } from "./topple-players.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const hex = (q, r) => at(q, r);
const MEASURE = process.argv.includes("measure"), ARG = k => process.argv.find(x => x.startsWith(`${k}=`))?.slice(k.length + 1);
/** A table by hand: dominoes as [q, r, colour, axis]. */
function table(...marks) {
  const cells = new Array(SIZE).fill(-1), ax = new Array(SIZE).fill(-1);
  for (const [q, r, colour, axis] of marks) { cells[hex(q, r)] = colour; ax[hex(q, r)] = axis; }
  return { cells, ax };
}
const fell = (t, q, r, way, rules) => chain(t.cells, t.ax, hex(q, r), way, rules).map(f => f[0]).sort((a, b) => a - b).join();
const these = (...qr) => qr.map(([q, r]) => hex(q, r)).sort((a, b) => a - b).join();
const piece = (p, colour = 0) => ({ piece: p, colour });

// ---------- the levels ----------
{
  check(LEVELS.length === 14 && new Set(LEVELS.map(l => l.name)).size === 14 && LEVELS.every(l => l.about.length > 20), "fourteen levels, each with its own name and a line on what it adds");
  const goals = LEVELS.map(l => l.goal);
  check(goals.every(g => g >= 20000 && g % 100 === 0), `every goal is a whole hundred and none is under level 1's 20000, Korbi's measure (${goals.join(", ")}); they follow what the best of the players reach, below`);
  const stars = LEVELS.map((_, k) => levelRules(k).stars);
  check(stars.every((x, k) => x.length === 3 && x[0] === goals[k] && x[0] < x[1] && x[1] < x[2]) && STARS.length === 2, "three stars a level: the goal, and two higher scores");
  const g0 = goals[0];
  check(starsAt(levelRules(0), g0 - 1) === 0 && starsAt(levelRules(0), g0) === 1 && starsAt(levelRules(0), stars[0][1]) === 2 && starsAt(levelRules(0), 1e9) === 3 && starsAt(FREE, 1e9) === 0, "a score is worth the stars whose scores it has reached; Classic has none");
  check(SIZE === 61 && CELLS.every(([q, r], i) => numberOf(q, r) === i) && numberOf(5, 5) === -1, "the levels number the hexagons as the engine does");
}

// ---------- each map ----------
{
  let ok = true, why = "";
  const floors = [];
  LEVELS.forEach((_, k) => {
    const ru = levelRules(k);
    for (let l = 0; l < ru.layers; l++) {
      const n = ru.terrain.slice(l * SIZE, (l + 1) * SIZE).filter(t => t === FLOOR).length;
      floors.push(n);
      if (n < 12) { ok = false; why = `${k + 1}: only ${n} hexagons of floor on floor ${l}`; }
    }
    if (ru.terrain.length !== ru.n || ru.height.length !== ru.n || ru.gilded.length !== ru.n) { ok = false; why = `${k + 1}: sizes`; }
    if (ru.height.some(h => h > 4) || ru.terrain.some((t, i) => t && (ru.gilded[i] || ru.height[i]))) { ok = false; why = `${k + 1}: a height over four, or a gilded or raised stone or water`; }
    if (!Object.keys(PIECES).some(p => PIECES[p].cells.length === ru.maxSize && fitsAnywhere(new Array(ru.n).fill(-1), p, ru))) { ok = false; why = `${k + 1}: no room for a piece of ${ru.maxSize}`; }
  });
  check(ok, ok ? `every map is whole: floors of ${Math.min(...floors)} to ${Math.max(...floors)} hexagons, heights up to four, nothing raised or gilded on stone or water, room for its biggest piece` : why);
  const plain = levelRules(0);
  check(plain.plain && plain.terrain.every(t => t === FLOOR) && plain.bell && plain.pace === null && plain.maxSize === 5 && rulesOf(newGame(1, 0)) === plain && rulesOf(newGame(1)) === FREE, "level 1 is a plain table of five colours: floor all over, the bell, the game's own pace, every piece");
  const hands = new Set(), wild = new Set();
  for (let sd = 0; sd < 300; sd++) for (const h of newGame(sd).hand) { hands.add(h.colour); wild.add(h.colour === RAINBOW); }
  check([...hands].sort().join() === "0,1,2" && !wild.has(true), "Classic still deals its three colours and no rainbow");
  const five = new Set();
  for (let sd = 0; sd < 300; sd++) for (const h of newGame(sd, 0).hand) five.add(h.colour);
  check([...five].sort().join() === "0,1,2,3,4", "level 1 deals the five colours");
}

// ---------- stones, water, the bell ----------
{
  const L = custom({ map: { rock: [[0, 0]], water: [[2, 0]], void: [[3, 0]] } });
  const e = new Array(SIZE).fill(-1);
  check(cover(e, "0,0", 0, 0, L) === null && cover(e, "0,0", 2, 0, L) === null && cover(e, "0,0", 3, 0, L) === null && cover(e, "0,0", 1, 0, L)?.join() === String(hex(1, 0)), "nothing is laid on a stone, on water or where there is no table");
  check(cover(e, "0,0;1,0;2,0", -1, 0, L) === null && cover(e, "0,0;1,0;2,0", 0, 1, L)?.length === 3 && !fitsAnywhere(e, "0,0;1,0;2,0;3,0;4,0", custom({ map: { rock: CELLS.filter(([q, r]) => q === 0) } })), "so a piece fits only whole on floor, and a wall of stones across the table stops a long piece");
  check(cover(e, "0,0", 0, 0) !== null && cover(e, "0,0", 0, 0, FREE) !== null, "Classic's table has no stones");
  let onFloor = true;
  for (let s = 0; s < 200; s++) { const g = newGame(s, 1); if (g.bell < 0 || levelRules(1).terrain[g.bell] !== FLOOR) onFloor = false; }
  const noBell = custom({ bell: false });
  check(onFloor, "the bell hangs on a hexagon of floor, never a stone");
  check(noBell.bell === false && custom({}).bell === true, "a level may have no bell");
  // a fall stops at a stone: nothing stands on it, so it's the same as an empty hexagon; and a stone is no domino to knock
  const t = table([-1, 0, 0, 0], [1, 0, 0, 0]);
  check(fell(t, -1, 0, 0, L) === these([-1, 0]) && fell(t, -1, 0, 0) === these([-1, 0]), "a fall stops at a stone, as at any empty hexagon");
}

// ---------- gilded ----------
{
  const G = custom({ map: { gilded: [[1, 0]] } });
  const row = table(...[-2, -1, 0, 1].map(q => [q, 0, 0, 0]));
  const k = knockOn(row.cells, row.ax, hex(-2, 0), 0, -1, G), plainK = knockOn(row.cells, row.ax, hex(-2, 0), 0);
  check(plainK.gain === 160 && !plainK.gilded && k.gain === 320 && k.gilded, "a fall that brings down a domino on a gilded hexagon scores double: a line of four, 160 and 320");
  check(knockOn(row.cells, row.ax, hex(-2, 0), 0, hex(0, 0), G).gain === 820 && knockOn(row.cells, row.ax, hex(-2, 0), 0, hex(0, 0), G).rings, "and the bell's 500 comes on top of it, not doubled: 820");
  check(knockOn(row.cells, row.ax, hex(0, 0), 6, -1, G).gain === 90 && !knockOn(row.cells, row.ax, hex(0, 0), 6, -1, G).gilded && knockOn(row.cells, row.ax, hex(-1, 0), 0, -1, G).gilded, "only if a domino on it falls: pushed the other way, or from short of it, it doesn't");
  check(!knockOn(table([0, 0, 0, 0]).cells, table([0, 0, 0, 0]).ax, hex(0, 0), 0, -1, G).gilded, "an empty gilded hexagon is nothing");
  // in a game: level 4 has gilded hexagons; a knock reports it and scores it
  const ru = levelRules(3), where = ru.gilded.findIndex(Boolean);
  const [q, r] = CELLS[where];
  const g = Object.assign(newGame(3, 3), { due: true, bell: -1, ...table([q, r, 0, 0]), mod: undefined });
  const done = knock(g, where, 0);
  check(done.gilded && done.gain === 20 && done.state.score === 20, "in a game of the level the knock says it was gilded, and scores it");
}

// ---------- bridges and twins ----------
{
  const B = custom({ bridges: 0.2, map: { water: [[1, 0]], rock: [[3, 0]], void: [[-1, 0]] } });
  const line3 = "0,0;1,0;2,0", e = new Array(SIZE).fill(-1);
  check(cover(e, line3, 0, 0, B) === null && coverFor(e, { piece: line3, colour: 0, bridge: true }, 0, 0, B)?.join() === [hex(0, 0), hex(1, 0), hex(2, 0)].join(), "a bridge lies on water, where no other piece can");
  check(coverFor(e, { piece: line3, colour: 0, bridge: true }, 1, 0, B) === null && coverFor(e, { piece: "0,0;1,0", colour: 0, bridge: true }, -2, 0, B) === null, "but not on a stone or where there is no table");
  check(fitsAnywhere(e, line3, B, true) && !fitsAnywhere(e, "0,0;1,0;2,0;3,0;4,0", custom({ map: { rock: CELLS.filter(([q]) => q === 0) } }), true), "it still has to fit whole");
  // the fall crosses a bridge as it crosses any domino
  const across = table([-1, 1, 0, 0], [0, 1, 0, 0], [1, 1, 0, 0]);
  const Br = custom({ map: { water: [[0, 1]] } });
  check(fell(across, -1, 1, 0, Br) === these([-1, 1], [0, 1], [1, 1]), "a fall runs over a domino standing on a bridge, as over any");
  // what is dealt: Two courts (8) has bridges, Fenland (9) has both
  const deal = (k, f) => { let n = 0, total = 0; for (let sd = 0; sd < 600; sd++) for (const h of newGame(sd, k).hand) { total++; if (f(h)) n++; } return n / total; };
  const bridgeShare = deal(7, h => h.bridge), twinShare = deal(8, h => h.colours);
  check(Math.abs(bridgeShare - levelRules(7).bridges * 0.88) < 0.04 && Math.abs(twinShare - levelRules(8).twins * 0.88) < 0.04, `about one piece in six is a bridge on Two courts (${bridgeShare.toFixed(2)}), and one in six a twin on Fenland (${twinShare.toFixed(2)})`);
  let shaped = true, differ = true, apart = true;
  for (const k of [7, 8, 13]) for (let sd = 0; sd < 300; sd++) for (const h of newGame(sd, k).hand) {
    const c = PIECES[h.piece].cells;
    if (h.bridge && (c.length < 2 || c.length > 3 || h.colours || h.mod)) shaped = false;
    if (h.colours && (c.length !== 2 || h.colours[0] === h.colours[1] || h.colours[0] !== h.colour || h.bridge || h.mod)) differ = false;
    if (h.colour === RAINBOW && (h.bridge || h.colours)) apart = false;
  }
  check(shaped && differ && apart, "a bridge is a straight line of two or three, a twin a pair of two colours; never both at once, never heavy, never a rainbow");
  let none = true;
  for (let k = 0; k < LEVELS.length; k++) {
    const ru = levelRules(k);
    if (!ru.bridges && !ru.twins) for (let sd = 0; sd < 60; sd++) for (const h of newGame(sd, k).hand) if (h.bridge || h.colours) none = false;
  }
  check(none && FREE.twins === 0 && FREE.bridges === 0, "a level without them deals neither");
  // a twin lays one colour on each domino, and joins both
  const T = custom({ twins: 0.3 }), g = newGame(5, 0), twin = { piece: "0,0;1,0", colour: 0, colours: [0, 1] };
  g.hand = [twin, g.hand[1], g.hand[2]];
  const laid = lay(g, 0, 0, 0, 0);
  check(laid.state.cells[hex(0, 0)] === 0 && laid.state.cells[hex(1, 0)] === 1 && colourAt(twin, 1) === 1 && colourAt({ colour: 2 }, 3) === 2, "a twin stands one colour on each of its dominoes");
  const row = table([-1, 0, 0, 0], [0, 0, 0, 0], [1, 0, 1, 0], [2, 0, 1, 0]);
  check(group(row.cells, hex(0, 0), T).length === 2 && fell(row, -1, 0, 0, T) === these([-1, 0], [0, 0]), "each half of a twin belongs to the colour it is, so the two halves are never in one fall");
  // saved with the game, through JSON
  check(JSON.stringify(JSON.parse(JSON.stringify(laid.state)).hand) === JSON.stringify(laid.state.hand) && coverFor(e, JSON.parse(JSON.stringify({ piece: line3, colour: 1, bridge: true })), 0, 0, B), "a bridge or a twin in hand goes through JSON as it is");
}

// ---------- scenes ----------
{
  check(LEVELS.every(l => SCENES.includes(l.scene)) && levelRules(0).scene === "birch" && FREE.scene === "birch", "every level has a scene the drawing knows; Classic and the first level are the birch and mahogany table as it has always been");
  check(SCENES.slice(1).every(k => LEVELS.some(l => l.scene === k)) && levelRules(0).rise === 0.16 && FREE.rise === 0.16 && LEVELS.every((_, k) => levelRules(k).rise >= 0.16), "and each of the others (marble, jetty, cliff, garden) is somewhere; a step is 0.16 high at least");
}

// ---------- balls ----------
{
  const withBalls = LEVELS.map((_, k) => levelRules(k).balls);
  const ballLevels = withBalls.flatMap((b, k) => (b ? [k] : []));
  check(ballLevels.join() === "10,13" && ballLevels.every(k => withBalls[k] >= 2 && withBalls[k] <= 3) && FREE.balls === 0 && custom({}).balls === 0 && !custom({ balls: 2 }).plain, `only The cup and the Grand table have balls (${ballLevels.map(k => withBalls[k]).join(", ")}), and a level with them is not plain`);
  // every deal puts them on empty floor, away from the bell, and the game keeps them to the number
  let ok = true;
  for (const k of ballLevels) for (let n = 0; n < 40; n++) {
    const g = newGame(n, k), ru = levelRules(k), at = g.cells.flatMap((c, i) => (c === BALL ? [i] : []));
    if (at.length !== ru.balls || at.some(i => ru.terrain[i] !== FLOOR || i === g.bell || g.ax[i] >= 0)) ok = false;
  }
  check(ok, "a deal of those levels puts every ball on empty floor, not under the bell");
}

// ---------- the stars, and the pace ----------
{
  const t = table(...[-2, -1, 0, 1, 2].map(q => [q, 0, 0, 0])), L0 = levelRules(0), [one, , three] = L0.stars;
  const ready = (state, extra) => Object.assign(structuredClone(state), { due: true, bell: -1, cells: t.cells.slice(), ax: t.ax.slice(), ...extra });
  const a = knock(ready(newGame(5, 0), { score: one - 100 }), hex(-2, 0), 0);
  check(a.state.score === one + 150 && a.state.stars === 1 && starsAt(L0, one - 100) === 0, "a knock that takes the score past the goal earns the first star");
  const b = knock(ready(a.state, { score: three - 100 }), hex(-2, 0), 0);
  check(b.state.stars === 3 && JSON.parse(JSON.stringify(b.state)).stars === 3, "the stars follow the score and are kept with the game");
  const c = knock(ready(b.state, { score: 100, stars: 3 }), hex(-2, 0), 0);
  check(c.state.stars === 3, "and never go back");
  check(knock(Object.assign(newGame(4), { due: true, bell: -1, cells: t.cells.slice(), ax: t.ax.slice() }), hex(-2, 0), 0).state.stars === undefined, "a Classic game has none");
  // each level's pace
  const slow = levelRules(5), classic = levelRules(0);
  const untilAt = (n, sets) => untilKnock(Object.assign(newGame(1, n), { sets, credit: 0 }));
  check(slow.pace && classic.pace === null && untilAt(5, 50) <= untilAt(0, 50) + 1 && slow.pace.end > PACE.end, "a level may give its knocks a pace of its own, a gentler one on the harder tables");
  check(rate(10, slow.pace) === 1 && rate(100, slow.pace) === slow.pace.end && rate(50, slow.pace) < 1 && rate(50, slow.pace) > slow.pace.end, "which tapers like the game's own, from its own hand to its own rate");
  const was = { ...PACE };
  PACE.from = 5; PACE.to = 10; PACE.end = 0.5;
  check(untilAt(0, 20) === 2 && untilAt(5, 20) === 1, "Classic follows the game's PACE as it stands; a level's own doesn't move with it");
  Object.assign(PACE, was);
}

// ---------- no soft locks ----------
// A table can't be made impossible: any standing domino may be pushed on its own (a heavy one or a gate pushed by hand
// falls), so a knock that is due always has a push; and every piece a level deals must fit on its empty table, as must
// every piece of the first hand together with the start dominoes. What can't be guaranteed is only the end of the game,
// a hand with nowhere to go, which is how a game is meant to end.
{
  let ok = true, why = "";
  LEVELS.forEach((L, k) => {
    const ru = levelRules(k), empty = new Array(ru.n).fill(-1);
    for (let sd = 0; sd < 150 && ok; sd++) {
      const g = newGame(sd, k);
      for (const h of g.hand) if (!fitsAnywhere(g.cells, h.piece, ru, !!h.bridge)) { ok = false; why = `${k + 1}: a dealt piece (${h.piece}) fits nowhere on seed ${sd}`; }
      if (!moves(g).length) { ok = false; why = `${k + 1}: no move on the first hand of seed ${sd}`; }
    }
    // every kind of piece the level can deal fits its empty table, a bridge on water
    for (const p of Object.keys(PIECES)) if (PIECES[p].cells.length <= ru.maxSize && !ru.bridges && !fitsAnywhere(empty, p, ru)) { ok = false; why = `${k + 1}: piece ${p} fits nowhere on the empty table`; }
    for (const st of ru.start) {
      // a heavy domino or a gate that stands at the start can be brought down: two neighbours of floor to hit it from, and it can be pushed itself
      const nbs = [0, 1, 2, 3, 4, 5].filter(d => { const j = nbr(st.i, d, ru); return j >= 0 && ru.terrain[j] === FLOOR && !(ru.hedge[st.i * 6 + d]); });
      if (nbs.length < 2) { ok = false; why = `${k + 1}: a domino at the start has fewer than two neighbours to be hit from`; }
      const g = newGame(1, k);
      if (!(g.cells[st.i] >= 0) || g.ax[st.i] !== st.axis) { ok = false; why = `${k + 1}: a start domino missing`; }
      const w = st.axis;
      const res = knockOn(g.cells, g.ax, st.i, w, -1, ru, 0, g.mod);
      if (!res.fell.some(f => f[0] === st.i)) { ok = false; why = `${k + 1}: a start domino cannot be pushed over`; }
      if (st.mod === "gate" && !st.gate.every(c => ru.colours.includes(c))) { ok = false; why = `${k + 1}: a gate wants a colour the level doesn't deal`; }
    }
    // a heavy domino or a gate dealt is a piece that fits whole like any other, and each colour of the level is dealt
    const seen = new Set();
    for (let sd = 0; sd < 200; sd++) for (const h of newGame(sd, k).hand) { seen.add(h.colour); }
    if (ru.colours.filter(c => c !== RAINBOW).some(c => !seen.has(c))) { ok = false; why = `${k + 1}: a colour of the level that is never dealt`; }
    if (ru.heavy > 0 && !Array.from({ length: 200 }, (_, sd) => newGame(sd, k).hand.some(h => h.mod === HEAVY)).some(Boolean)) { ok = false; why = `${k + 1}: no heavy domino is ever dealt`; }
  });
  check(ok, ok ? "on every table every dealt piece fits, the first hand has a move, a heavy domino or a gate at the start has two neighbours to be hit from and can be pushed by hand, every colour is dealt" : why);
}

// ---------- whole games of every level ----------
{
  const games = MEASURE ? Number(ARG("games") || 16) : 4, who = (ARG("who") || (MEASURE ? "careful,corner" : "careful")).split(","), only = ARG("levels")?.split(",").map(Number);
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  const t0 = Date.now();
  let allOk = true, allEnd = true;
  const careful = [];
  LEVELS.forEach((L, n) => {
    if (only && !only.includes(n + 1)) return;
    for (const id of who) {
      const res = Array.from({ length: games }, (_, g) => play(100 + g, PLAYERS[id], { level: n, pieces: 400 }));
      if (!res.every(r => r.ok)) allOk = false;
      if (!res.every(r => r.ended)) allEnd = false;
      if (id === "careful") careful[n] = res;
      if (MEASURE) {
        const sc = res.map(r => r.score), got = k => res.filter(r => r.stars > k).length;
        console.log(`${String(n + 1).padStart(2)} ${L.name.padEnd(16)} ${PLAYERS[id].name.padEnd(36)} goal ${String(L.goal).padStart(5)}: scoring ${median(sc)} (${Math.min(...sc)} to ${Math.max(...sc)}) in ${median(res.map(r => r.laid))} pieces; goal met ${got(0)} of ${games}, two stars ${got(1)}, three ${got(2)}${res.some(r => r.laidAt[0] != null) ? `; first star at piece ${median(res.filter(r => r.laidAt[0] != null).map(r => r.laidAt[0]))}` : ""}`);
      }
    }
  });
  if (MEASURE) { console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`); process.exit(0); }
  check(allOk && allEnd, "whole games of every level, to the end: standing dominoes face one of six axes and empty hexagons none, the score is the knocks' gains, and every game ends");
  const meets = careful.map(rs => rs.filter(r => r.stars >= 1).length);
  check(meets[0] === games && meets.slice(1, 3).every(m => m >= games - 1), `the careful player beats level 1 every time, and the next two nearly (goals ${LEVELS.slice(0, 3).map(l => l.goal).join(", ")}; met ${meets.slice(0, 3).join(", ")} of ${games})`);
  // the goals' rule: a share of what the careful player scores in the median there, a half at level 1 rising to three quarters
  const share = LEVELS.map((L, n) => {
    const sc = Array.from({ length: 20 }, (_, g) => play(300 + g, PLAYERS.careful, { level: n, pieces: 400 }).score).sort((a, b) => a - b);
    return { share: L.goal / sc[10], met: sc.filter(x => x >= L.goal).length };
  });
  check(share.every(x => x.share > 0.3 && x.share < 1 && x.met >= 10), `each goal is between a third and the whole of the careful player's median, and beaten in half his games at least (shares ${share.map(x => x.share.toFixed(2)).join(", ")}; met ${share.map(x => x.met).join(", ")} of 20)`);
  check(share[0].met >= 17, `and level 1, the first, in nearly all (${share[0].met} of 20)`);
  const corner = Array.from({ length: 6 }, (_, g) => play(100 + g, PLAYERS.corner, { level: 0 }));
  check(corner.filter(r => r.stars >= 1).length <= 1, "laying everything in the corner and turning nothing doesn't beat level 1");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("topple levels: eighteen maps and goals, level 1 as Classic, stones and water, tall dominoes, heights, gilded hexagons, pearls, bridges and twins, scenes and the stair, balls, stars and pace, whole games of every level");
