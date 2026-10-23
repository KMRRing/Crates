// Topple's levels (topple-levels.js) and what they ask of the engine (topple-engine.js): the twelve tables and their
// goals, level 1 playing exactly as Classic does, stones and water where nothing is laid, a tall colour reaching the
// hexagon past the next (over water and gaps, not past a stone, climbing a step), heights a fall never climbs, gilded
// hexagons that double a knock, the pearl colour that every colour knocks and that knocks every colour, the pieces a level
// deals, the stars a score is worth, the pace of a level's knocks, and whole games of every level played out by simple
// players (tests/topple-players.js). `node tests/topple-levels.mjs measure` plays more games per level and prints what the
// README's numbers come from: `measure careful,corner games=24 levels=4,5`.
import { LEVELS, FLOOR, ROCK, WATER, VOID, PEARL, STARS, FREE, levelRules, starsAt, numberOf, custom, SIZE } from "../topple-levels.js";
import { CELLS, AXES, WAYS, PIECES, PACE, at, hitBy, reachBy, rulesOf, newGame, lay, turn, knock, cover, fitsAnywhere, chain, chains, group, knockOn, longest, rate, untilKnock } from "../topple-engine.js";
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

// ---------- the twelve ----------
{
  check(LEVELS.length === 12 && new Set(LEVELS.map(l => l.name)).size === 12 && LEVELS.every(l => l.about.length > 20), "twelve levels, each with its own name and a line on what it adds");
  const goals = LEVELS.map(l => l.goal);
  check(goals.every((g, k) => g > 0 && (k === 0 || g > goals[k - 1])), `each goal higher than the one before (${goals.join(", ")})`);
  const stars = LEVELS.map((_, k) => levelRules(k).stars);
  check(stars.every((s, k) => s.length === 3 && s[0] === goals[k] && s[0] < s[1] && s[1] < s[2]) && STARS.length === 2, "three stars a level: the goal, and two higher scores");
  check(starsAt(levelRules(0), 2999) === 0 && starsAt(levelRules(0), 3000) === 1 && starsAt(levelRules(0), stars[0][1]) === 2 && starsAt(levelRules(0), 1e9) === 3 && starsAt(FREE, 1e9) === 0, "a score is worth the stars whose scores it has reached; Classic has none");
  check(SIZE === 61 && CELLS.every(([q, r], i) => numberOf(q, r) === i) && numberOf(5, 5) === -1, "the levels number the hexagons as the engine does");
}

// ---------- each map ----------
{
  let ok = true, why = "";
  const floors = [];
  LEVELS.forEach((_, k) => {
    const ru = levelRules(k);
    const n = ru.terrain.filter(t => t === FLOOR).length;
    floors.push(n);
    if (ru.terrain.length !== SIZE || ru.height.length !== SIZE || ru.gilded.length !== SIZE || ru.tall.length !== 4) { ok = false; why = `${k + 1}: sizes`; }
    if (ru.height.some(h => h > 2) || ru.terrain.some((t, i) => t && (ru.gilded[i] || ru.height[i]))) { ok = false; why = `${k + 1}: a height over two, or a gilded or raised stone or water`; }
    if (n < 40) { ok = false; why = `${k + 1}: only ${n} hexagons of floor`; }
    // room for the biggest piece the level deals: a straight line of four (or five) somewhere
    if (!Object.keys(PIECES).some(p => PIECES[p].cells.length === ru.maxSize && fitsAnywhere(new Array(SIZE).fill(-1), p, ru))) { ok = false; why = `${k + 1}: no room for a piece of ${ru.maxSize}`; }
  });
  check(ok, ok ? `every map is whole: floor of ${Math.min(...floors)} to ${Math.max(...floors)} hexagons, heights up to two, nothing raised or gilded on stone or water, room for its biggest piece` : why);
  const feature = k => { const ru = levelRules(k); return { rock: ru.terrain.includes(ROCK), water: ru.terrain.includes(WATER), void: ru.terrain.includes(VOID), tall: ru.tall.some(Boolean), gilded: ru.gilded.some(Boolean), height: ru.height.some(Boolean), pearl: ru.pearl > 0 }; };
  const first = key => LEVELS.findIndex((_, k) => feature(k)[key]) + 1;
  check(first("rock") === 2 && first("water") === 3 && first("tall") === 4 && first("gilded") === 5 && first("height") === 6 && first("pearl") === 7 && first("void") === 8, `each thing comes in on a level of its own: stones 2, water 3, tall 4, gilded 5, heights 6, pearl 7, no table 8 (here ${["rock", "water", "tall", "gilded", "height", "pearl", "void"].map(first).join(", ")})`);
  const kept = ["tall", "pearl"].every(key => LEVELS.every((_, k) => k + 1 < first(key) || feature(k)[key]));
  check(kept, "and once in, tall and pearl stay in every level after");
  const plain = levelRules(0);
  check(plain.plain && plain.terrain.every(t => t === FLOOR) && plain.height.every(h => h === 0) && plain.gilded.every(g => !g) && plain.tall.every(t => !t) && plain.pearl === 0 && plain.bell && plain.pace === null && plain.maxSize === 5 && rulesOf(newGame(1, 0)) === plain && rulesOf(newGame(1)) === FREE, "level 1 is Classic's table: plain floor, nothing tall, no pearl, the bell, the game's own pace, every piece");
}

// ---------- level 1 plays as Classic does ----------
{
  // the careful player lays and faces Classic's game; the same moves, turns and knocks are made on level 1's
  const strip = g => { const { level, stars, ...rest } = g; return rest; };
  let same = true, steps = 0;
  for (const seed of [1, 7, 42, 1234]) {
    let a = newGame(seed), b = newGame(seed, 0);
    if (JSON.stringify(strip(b)) !== JSON.stringify(a) || b.level !== 0 || b.stars !== 0 || "level" in a || "stars" in a) same = false;
    const faced = new Set(), rnd = () => 0.5;
    for (let k = 0; k < 120 && !a.over; k++) {
      if (a.due) {
        const best = chains(a.cells, a.ax, a.bell).reduce((x, c) => (!x || c.best.gain > x.gain ? c.best : x), null);
        const ra = knock(a, best.at, best.way), rb = knock(b, best.at, best.way);
        if (ra.gain !== rb.gain || ra.fell.length !== rb.fell.length || ra.gilded || rb.gilded) same = false;
        a = ra.state; b = rb.state;
      } else {
        const m = PLAYERS.careful.choose(a, rnd);
        a = lay(a, m.slot, m.q, m.r).state; b = lay(b, m.slot, m.q, m.r).state;
        if (!a.over) { a = turnAll(a, faced); a.ax.forEach((x, i) => { if (b.ax[i] !== x) b = turn(b, i, x); }); }
      }
      steps++;
      if (JSON.stringify(strip(b)) !== JSON.stringify(a) || a.over !== b.over) { same = false; break; }
    }
  }
  check(same && steps > 150, `level 1 against Classic over four games (${steps} moves): the same deal, bell, falls, scores and pace, move for move, but for the level and the stars it carries`);
  const hands = new Set(), pearls = new Set();
  for (let s = 0; s < 300; s++) for (const h of newGame(s).hand) { hands.add(h.colour); pearls.add(h.colour === PEARL); }
  check([...hands].sort().join() === "0,1,2" && !pearls.has(true), "Classic never deals a pearl");
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

// ---------- tall: the hexagon past the next ----------
{
  // the geometry: past the near hexagon(s), two out along a hexagon way and √3 out along a line way, at the way's angle
  const MID = ([q, r]) => [q + r / 2, (Math.sqrt(3) / 2) * r];
  let ok = true, n = 0;
  CELLS.forEach((c, i) => {
    for (let w = 0; w < WAYS; w++) {
      const far = reachBy(i, w);
      if (hitBy(i, w).every(j => j < 0)) { if (far >= 0) ok = false; continue; }
      if (far < 0) continue;
      n++;
      const [x0, z0] = MID(c), [x1, z1] = MID(CELLS[far]), dist = Math.hypot(x1 - x0, z1 - z0), want = w % 2 ? Math.sqrt(3) : 2;
      const angle = Math.atan2(-(z1 - z0), x1 - x0), wantAngle = (w * Math.PI) / 6;
      if (Math.abs(dist - want) > 1e-9 || Math.abs(Math.cos(angle - wantAngle) - 1) > 1e-9) ok = false;
    }
  });
  check(ok && n > 300, `the hexagon a tall domino reaches past the next is two hexagons out along a hexagon way and a hexagon and a half along a line way, the way it falls (${n} places on the table)`);
  const mid = hex(0, 0);
  check(reachBy(mid, 0) === hex(2, 0) && reachBy(mid, 1) === hex(2, -1) && reachBy(mid, 2) === hex(2, -2) && reachBy(mid, 3) === hex(1, -2) && reachBy(hex(4, 0), 0) === -1 && reachBy(hex(3, 0), 0) === -1 && reachBy(hex(3, 0), 1) === -1, "from the middle: two east, and past the line between east and north-east the hexagon beyond both; none off the edge");
  // water and gaps are crossed; a stone is not
  const T = custom({ tall: [0] }), W = custom({ tall: [0], map: { water: [[1, 0]] } }), K = custom({ tall: [0], map: { rock: [[1, 0]] } });
  const across = table([0, 0, 0, 0], [2, 0, 0, 0]);
  check(fell(across, 0, 0, 0) === these([0, 0]), "an ordinary domino falling east doesn't reach the one two out");
  check(fell(across, 0, 0, 0, T) === these([0, 0], [2, 0]) && fell(across, 0, 0, 0, W) === these([0, 0], [2, 0]), "a tall one does, over an empty hexagon or over water");
  check(fell(across, 0, 0, 0, K) === these([0, 0]), "but not past a stone");
  const colours = custom({ tall: [1] });
  check(fell(across, 0, 0, 0, colours) === these([0, 0]), "only the colours that are tall: a tall blue doesn't make the yellow so");
  const both = table([0, 0, 0, 0], [1, 0, 0, 0], [2, 0, 0, 0]), run = chain(both.cells, both.ax, hex(0, 0), 0, T);
  check(run.length === 3 && run.every(f => f[1] <= 1) && run.find(f => f[0] === hex(2, 0))[2] === hex(0, 0) && knockOn(both.cells, both.ax, hex(0, 0), 0, -1, T).gain === 10 * 3 * 2, "with the near one standing too, a tall domino brings down both in a step: three in two steps, 60, not 90");
  // at a line
  const line = table([0, 0, 0, 1], [2, -1, 0, 1]);
  check(fell(line, 0, 0, 1, T) === these([0, 0], [2, -1]) && fell(line, 0, 0, 1) === these([0, 0]), "past the line between two hexagons it reaches the one beyond them both");
  const blocked = custom({ tall: [0], map: { rock: [[1, -1]] } });
  check(fell(line, 0, 0, 1, blocked) === these([0, 0]), "a stone on either side of the line stops it");
  // the one reached falls the way nearer the fall, and knocks on in its own colour
  const onward = table([0, 0, 0, 0], [2, 0, 0, 0], [3, 0, 0, 0], [4, 0, 1, 0]), go = chain(onward.cells, onward.ax, hex(0, 0), 0, T);
  check(go.map(f => f[0]).join() === [hex(0, 0), hex(2, 0), hex(3, 0)].join() && go[1][3] === 0, "and what is reached knocks on as any domino does, in its own colour");
  // a tall domino pushed from far away joins what it reaches
  check(group(across.cells, hex(0, 0), T).length === 2 && group(across.cells, hex(2, 0), T).length === 2 && group(across.cells, hex(0, 0), custom({})).length === 1 && group(across.cells, hex(0, 0), K).length === 1, "a tall domino is joined to the one it reaches, and that one to it, for the rings and the best push; not past a stone, nor if neither is tall");
  check(longest(across.cells, across.ax, hex(0, 0), -1, T).gain === 20 * 2 && longest(across.cells, across.ax, hex(0, 0), -1, T).size === 2, "the best push on a tall pair is the two falling: 40");
}

// ---------- heights: a fall never climbs ----------
{
  const H = custom({ map: { height: { 1: [[1, 0]], 2: [[2, 0]] } }}), Ht = custom({ tall: [0], map: { height: { 1: [[1, 0]], 2: [[2, 0], [3, 0]] } } });
  const hillRow = () => table([0, 0, 0, 0], [1, 0, 0, 0], [2, 0, 0, 0]);
  const level = table([-1, 0, 0, 0], [0, 0, 0, 0]);
  check(fell(level, -1, 0, 0, H) === these([-1, 0], [0, 0]), "a fall along the level goes on");
  const up = table([0, 0, 0, 0], [1, 0, 0, 0]), upTwo = table([1, 0, 0, 0], [2, 0, 0, 0]);
  check(fell(up, 0, 0, 0, H) === these([0, 0]) && fell(upTwo, 1, 0, 0, H) === these([1, 0]), "up a step it stops, a step to the next terrace");
  check(fell(up, 1, 0, 6, H) === these([0, 0], [1, 0]) && fell(hillRow(), 2, 0, 6, H) === these([0, 0], [1, 0], [2, 0]), "down a step, or two, it goes on (the same chain pushed from the top)");
  check(fell(up, 0, 0, 0, Ht) === these([0, 0], [1, 0]) && fell(table([1, 0, 0, 0], [2, 0, 0, 0]), 1, 0, 0, Ht) === these([1, 0], [2, 0]), "a tall domino climbs one step");
  check(fell(table([0, 0, 0, 0], [2, 0, 0, 0]), 0, 0, 0, Ht) === these([0, 0]), "but not two (reaching from the ground over to the top terrace)");
  // the best push is found from the top
  const hill = hillRow(), best = longest(hill.cells, hill.ax, hex(0, 0), -1, H);
  check(best.fell === 3 && best.at === hex(2, 0) && best.way === 6, "so a chain up a hill is pushed from its top, and the best push says so");
}

// ---------- gilded ----------
{
  const G = custom({ map: { gilded: [[1, 0]] } });
  const row = table(...[-2, -1, 0, 1].map(q => [q, 0, 0, 0]));
  const k = knockOn(row.cells, row.ax, hex(-2, 0), 0, -1, G), plainK = knockOn(row.cells, row.ax, hex(-2, 0), 0);
  check(plainK.gain === 160 && !plainK.gilded && k.gain === 320 && k.gilded, "a fall that brings down a domino on a gilded hexagon scores double: a line of four, 160 and 320");
  check(knockOn(row.cells, row.ax, hex(-2, 0), 0, hex(0, 0), G).gain === 640 && knockOn(row.cells, row.ax, hex(-2, 0), 0, hex(0, 0), G).rings, "and the bell's double doubles it again: 640");
  check(knockOn(row.cells, row.ax, hex(0, 0), 6, -1, G).gain === 90 && !knockOn(row.cells, row.ax, hex(0, 0), 6, -1, G).gilded && knockOn(row.cells, row.ax, hex(-1, 0), 0, -1, G).gilded, "only if a domino on it falls: pushed the other way, or from short of it, it doesn't");
  check(!knockOn(table([0, 0, 0, 0]).cells, table([0, 0, 0, 0]).ax, hex(0, 0), 0, -1, G).gilded, "an empty gilded hexagon is nothing");
  // in a game: level 5 has gilded hexagons; a knock reports it and scores it
  const ru = levelRules(4), where = ru.gilded.findIndex(Boolean);
  const [q, r] = CELLS[where];
  const g = Object.assign(newGame(3, 4), { due: true, bell: -1, ...table([q, r, 0, 0]) });
  const done = knock(g, where, 0);
  check(done.gilded && done.gain === 20 && done.state.score === 20, "in a game of the level the knock says it was gilded, and scores it");
}

// ---------- pearl ----------
{
  const P = custom({ pearl: 0.1 });
  const trio = table([0, 0, 0, 0], [1, 0, PEARL, 0], [2, 0, 1, 0]);
  check(fell(trio, 0, 0, 0, P) === these([0, 0], [1, 0], [2, 0]), "a colour's fall brings down a pearl, and the pearl brings down another colour beyond it");
  check(fell(table([0, 0, PEARL, 0], [1, 0, 2, 0]), 0, 0, 0, P) === these([0, 0], [1, 0]) && fell(table([0, 0, 2, 0], [1, 0, PEARL, 0]), 0, 0, 0, P) === these([0, 0], [1, 0]), "a pearl pushed brings down any colour, and any colour pushed brings down a pearl");
  check(fell(table([0, 0, 0, 0], [1, 0, 1, 0]), 0, 0, 0, P) === these([0, 0]), "but two colours with no pearl between still stand apart");
  check(group(trio.cells, hex(0, 0), P).length === 3 && group(trio.cells, hex(2, 0), P).length === 3, "a pearl joins the colours beside it into one group");
  // what is dealt
  let pearls = 0, total = 0, small = true, other = new Set();
  for (let s = 0; s < 800; s++) for (const h of newGame(s, 6).hand) { total++; if (h.colour === PEARL) { pearls++; if (PIECES[h.piece].cells.length > 2) small = false; } else other.add(h.colour); }
  check(Math.abs(pearls / total - 0.12) < 0.03 && small && [...other].sort().join() === "0,1,2", `about one piece in eight is a pearl (${pearls} of ${total}), always of one or two dominoes; the other pieces are the usual three colours`);
  let big = 0, over4 = 0;
  for (let s = 0; s < 300; s++) for (const h of newGame(s, 3).hand) { total++; if (PIECES[h.piece].cells.length === 5) big++; if (PIECES[h.piece].cells.length > 4) over4++; }
  check(over4 === 0 && big === 0, "a level may deal only pieces up to four");
  let fives = 0;
  for (let s = 0; s < 300; s++) for (const h of newGame(s, 1).hand) if (PIECES[h.piece].cells.length === 5) fives++;
  check(fives > 20, "and one that keeps to the usual deal deals fives");
}

// ---------- the stars, and the pace ----------
{
  const t = table(...[-2, -1, 0, 1, 2].map(q => [q, 0, 0, 0]));
  let g = Object.assign(newGame(5, 0), { due: true, bell: -1, cells: t.cells, ax: t.ax, score: 2900 });
  const a = knock(g, hex(-2, 0), 0);
  check(a.state.score === 3150 && a.state.stars === 1 && g.stars === 0, "a knock that takes the score past the goal earns the first star");
  const row2 = table(...[-2, -1, 0, 1, 2].map(q => [q, 0, 0, 0]));
  const b = knock(Object.assign(structuredClone(a.state), { due: true, bell: -1, cells: row2.cells, ax: row2.ax, score: 8000 }), hex(-2, 0), 0);
  check(b.state.stars === 3 && JSON.parse(JSON.stringify(b.state)).stars === 3, "the stars follow the score and are kept with the game");
  const c = knock(Object.assign(structuredClone(b.state), { due: true, bell: -1, cells: table([0, 0, 0, 0]).cells, ax: table([0, 0, 0, 0]).ax, score: 100, stars: 3 }), hex(0, 0), 0);
  check(c.state.stars === 3, "and never go back");
  check(knock(Object.assign(newGame(4), { due: true, bell: -1, cells: t.cells, ax: t.ax }), hex(-2, 0), 0).state.stars === undefined, "a Classic game has none");
  // each level's pace
  const slow = levelRules(3), classic = levelRules(0);
  const untilAt = (n, sets) => untilKnock(Object.assign(newGame(1, n), { sets, credit: 0 }));
  check(slow.pace && classic.pace === null && untilAt(3, 50) <= 2 && untilAt(0, 50) >= 2, "a level may give its knocks a pace of its own, a gentler one on a table cut up by water");
  check(rate(10, slow.pace) === 1 && rate(100, slow.pace) === slow.pace.end && rate(50, slow.pace) < 1 && rate(50, slow.pace) > slow.pace.end, "which tapers like the game's own, from its own hand to its own rate");
  const was = { ...PACE };
  PACE.from = 5; PACE.to = 10; PACE.end = 0.5;
  check(untilAt(0, 20) === 2 && untilAt(3, 20) === 1, "Classic follows the game's PACE as it stands; a level's own doesn't move with it");
  Object.assign(PACE, was);
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
  const corner = Array.from({ length: 6 }, (_, g) => play(100 + g, PLAYERS.corner, { level: 0 }));
  check(corner.filter(r => r.stars >= 1).length <= 1, "laying everything in the corner and turning nothing doesn't beat level 1");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("topple levels: twelve maps and goals, level 1 as Classic, stones and water, tall dominoes, heights, gilded hexagons, pearls, stars and pace, whole games of every level");
