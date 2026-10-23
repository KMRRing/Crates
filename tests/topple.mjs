// Topple's rules (topple-engine.js): the table of sixty-one hexagons, the deal from a seed, the pieces (chains of one to
// five), where a piece fits, the twelve ways and six axes, how dominoes fall (a domino falling at a hexagon knocks the
// one there if it faces within thirty degrees, one falling at a line knocks both either side unless edge-on, each
// knocked falling the way nearer the fall, only in its colour), lines, bends, turns and forks, the push (either way
// along the axis), turning a domino, how each piece faces as dealt (every one falling whole from an end where its shape
// allows), a push's clearing and its points, the bell, a game of version 4 carried over, the knock on the table's time,
// the end, a game saved and opened again, and whole games played out to their end by simple players (some of them
// turning their dominoes into long falls first).
//
// `node tests/topple.mjs measure` plays forty games for each player instead and prints what the README's numbers come
// from; the plain run plays a few, to keep the pace honest. To tune, name the players and try another pace:
// `node tests/topple.mjs measure careful,bell pace=12,48,0.6 games=40`.
import { PLAYERS, play } from "./topple-players.js";
import { R, CELLS, SIZE, DIRS, HAND, PIECES, PACE, VERSION, AXES, WAYS, axesOfCoords, axesOf, rate, untilKnock, newGame, at, next, dirTo, cover, fitsAnywhere, chain, group, chains, stepsOf, longest, knockOn, worth, lay, knock, skip, canSkip, turn, moves, pushes, hitBy, offBy, knocks, senseOf, through, isLine, migrate } from "../topple-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const E = 0, NE = 1, NW = 2, W = 3, SW = 4, SE = 5;
const hex = (q, r) => at(q, r);
const angle = w => (w * Math.PI) / 6;
/** A table drawn by hand: dominoes as [q, r, colour, axis]. */
function table(...marks) {
  const cells = new Array(SIZE).fill(-1), ax = new Array(SIZE).fill(-1);
  for (const [q, r, colour, axis] of marks) { cells[hex(q, r)] = colour; ax[hex(q, r)] = axis; }
  return { cells, ax };
}
/** n dominoes from (q, r) going direction d, each facing along the line. */
const line = (q, r, d, n, colour = 0) => Array.from({ length: n }, (_, k) => [q + k * DIRS[d][0], r + k * DIRS[d][1], colour, (2 * d) % AXES]);
/** Dominoes on some hexagons facing as a piece of that shape is dealt: [q, r] … in one colour. */
const shaped = (coords, colour = 0) => { const faces = axesOfCoords(coords); return coords.map(([q, r], k) => [q, r, colour, faces[k]]); };
const fellOf = (t, q, r, way) => chain(t.cells, t.ax, hex(q, r), way).map(f => f[0]).sort((a, b) => a - b).join();
const these = (...qr) => qr.map(([q, r]) => hex(q, r)).sort((a, b) => a - b).join();
const piece = (p, colour = 0) => ({ piece: p, colour });
const SINGLE = "0,0", PAIR = "0,0;1,0";
const game = (t, hand = [piece(SINGLE), piece(SINGLE), piece(SINGLE)], extra = {}) => Object.assign(newGame(1), { cells: t.cells, ax: t.ax, hand, due: true, bell: hex(R, 0) }, extra);

// ---------- the table ----------
{
  check(SIZE === 61 && CELLS.length === 61 && at(0, 0) >= 0 && at(R, 0) >= 0 && at(R, 1) === -1 && at(-R, -R) === -1 && CELLS.every(([q, r], i) => at(q, r) === i), "sixty-one hexagons, four out from the middle, each numbered row by row");
  const ring = n => [...Array(6).keys()].filter(d => next(n, d) >= 0).length;
  check(ring(hex(0, 0)) === 6 && ring(hex(R, 0)) === 3 && ring(hex(0, -R)) === 3 && ring(hex(2, -R)) === 4 && CELLS.every((_, i) => [...Array(6).keys()].every(d => next(i, d) < 0 || next(next(i, d), (d + 3) % 6) === i)),
    "six neighbours in the middle, three in a corner (six of them), four on an edge, and each is its neighbour's neighbour back the other way");
  check(dirTo(hex(0, 0), hex(1, -1)) === NE && dirTo(hex(0, 0), hex(2, 0)) === -1, "the direction from a hexagon to a neighbour, none to one further off");
}

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), hands = new Set([...Array(10).keys()].map(k => JSON.stringify(newGame(k).hand)));
  check(JSON.stringify(a) === JSON.stringify(b) && hands.size > 5, "the same seed deals the same game, another seed another");
  check(a.v === VERSION && VERSION === 5 && !("force" in a) && a.cells.length === SIZE && a.cells.every(c => c === -1) && a.ax.length === SIZE && a.ax.every(f => f === -1) && a.hand.length === HAND && a.hand.every(h => PIECES[h.piece] && h.colour >= 0 && h.colour < 3) && !a.due && a.credit === 0 && a.sets === 1 && !a.over,
    "an empty table, three pieces in three colours, nothing facing any way, no knock yet owed, and no strength any more");
  check(new Set([...Array(30).keys()].map(k => newGame(k).bell)).size > 10 && newGame(3).bell >= 0, "the bell on a hexagon of the table, a different one game to game");
}

// ---------- the pieces ----------
{
  const names = Object.keys(PIECES), size = Object.fromEntries([1, 2, 3, 4, 5].map(n => [n, names.filter(k => PIECES[k].cells.length === n).length]));
  const touching = (a, b) => DIRS.some(([dq, dr]) => a[0] + dq === b[0] && a[1] + dr === b[1]);
  const joined = cells => { const seen = new Set([0]); for (let k = 0; k < seen.size + 1; k++) cells.forEach((c, i) => { if (!seen.has(i) && [...seen].some(j => touching(cells[j], c))) seen.add(i); }); return seen.size === cells.length; };
  const degree = cells => Math.max(...cells.map(c => cells.filter(d => d !== c && touching(c, d)).length));
  const triangle = cells => cells.some(a => cells.some(b => cells.some(c => a !== b && b !== c && a !== c && touching(a, b) && touching(b, c) && touching(a, c))));
  check(JSON.stringify(size) === JSON.stringify({ 1: 1, 2: 3, 3: 9, 4: 29, 5: 99 }), `${names.length} pieces, each way a chain lies: one of one, three of two, nine of three, 29 of four, 99 of five`);
  check(names.every(k => joined(PIECES[k].cells) && degree(PIECES[k].cells) <= 3 && !triangle(PIECES[k].cells) && PIECES[k].cells[0].join() === "0,0" && k === PIECES[k].cells.map(c => c.join(",")).join(";")),
    "every piece is a chain (joined, none touching more than three, no three all touching), named by its hexagons from its first");
  const straight = k => new Set(PIECES[k].cells.map(c => c[1])).size === 1 || new Set(PIECES[k].cells.map(c => c[0])).size === 1 || new Set(PIECES[k].cells.map(c => c[0] + c[1])).size === 1;
  const weigh = f => names.filter(k => PIECES[k].cells.length === 3 && f(k)).reduce((total, k) => total + PIECES[k].weight, 0);
  check(Math.abs(weigh(straight) / weigh(k => !straight(k)) - 2) < 1e-9, "a straight line of three is dealt twice as often as the bend");
  const tally = {};
  for (let k = 0; k < 400; k++) for (const h of newGame(k).hand) tally[PIECES[h.piece].cells.length] = (tally[PIECES[h.piece].cells.length] || 0) + 1;
  check(tally[1] > 20 && tally[4] > tally[3] && tally[3] > tally[2] && tally[5] > 40, `dealt by size as they weigh: ${[1, 2, 3, 4, 5].map(n => tally[n]).join(", ")} of 1200 in ones to fives`);
}

// ---------- where a piece fits ----------
{
  const { cells } = table([0, 0, 0, 0]);
  check(cover(cells, SINGLE, 1, 0)?.join() === String(hex(1, 0)) && cover(cells, SINGLE, 0, 0) === null && cover(cells, SINGLE, R, 1) === null, "a piece goes on empty hexagons, not on a domino or off the table");
  check(cover(cells, PAIR, -1, 0) === null && cover(cells, PAIR, 1, 0)?.join() === `${hex(1, 0)},${hex(2, 0)}` && cover(cells, PAIR, R, 0) === null, "all of it must fit: a pair over a domino, or half off the edge, doesn't");
  check(fitsAnywhere(cells, "0,0;1,0;2,0;3,0;4,0") && !fitsAnywhere(CELLS.map((_, i) => i % 2), SINGLE), "a piece fits somewhere, or nowhere");
}

// ---------- the twelve ways and the six axes ----------
{
  const mid = hex(0, 0);
  check(WAYS === 12 && AXES === 6 && [0, 2, 4, 6, 8, 10].every(w => !isLine(w) && hitBy(mid, w).join() === String(next(mid, w / 2))) && [1, 3, 5, 7, 9, 11].every(w => isLine(w) && hitBy(mid, w).join() === [next(mid, (w - 1) / 2), next(mid, ((w + 1) / 2) % 6)].join()),
    "twelve ways round a hexagon, every thirty degrees: an even one at a neighbour, an odd one at the line between the two neighbours either side of it");
  check(hitBy(hex(R, 0), 0).join() === "-1" && hitBy(hex(R, 0), 1).every(j => j < 0) && hitBy(hex(R, 0), 3).filter(j => j >= 0).length === 1, "at the edge, off the table is -1");
  let ok = true;
  for (let axis = 0; axis < AXES; axis++) for (let w = 0; w < WAYS; w++) {
    const off = Math.round(Math.acos(Math.min(1, Math.abs(Math.cos(angle(axis) - angle(w))))) / (Math.PI / 6));
    if (offBy(axis, w) !== off || knocks(w, axis) !== (w % 2 ? off <= 2 : off <= 1)) ok = false;
    if (knocks(w, axis) && !(senseOf(axis, w) % AXES === axis && Math.cos(angle(senseOf(axis, w)) - angle(w)) > 1e-9)) ok = false;
  }
  check(ok && !knocks(0, -1), "how far an axis is from a way (0 square on to 3 edge-on); a fall at a hexagon knocks within thirty degrees, at a line all but edge-on; the one knocked falls the sense of its axis nearer the fall (their dot positive)");
}

// ---------- a fall at a hexagon ----------
{
  // the one pushed faces east and west, pushed east: it comes down on the hexagon to its east, and on nothing else
  const from = ax => fellOf(table([0, 0, 0, 0], [1, 0, 0, ax]), 0, 0, 0);
  check(from(0) === these([0, 0], [1, 0]), "falling at a hexagon: the domino there square on falls");
  check(from(1) === these([0, 0], [1, 0]) && from(5) === these([0, 0], [1, 0]), "thirty degrees off, either way, it falls");
  check(from(2) === these([0, 0]) && from(4) === these([0, 0]), "sixty degrees off, mostly edge-on, it stands");
  check(from(3) === these([0, 0]), "ninety degrees off, edge-on, it stands");
  check(fellOf(table([0, 0, 0, 0], [1, 0, 1, 0]), 0, 0, 0) === these([0, 0]), "another colour stands, square on or not");
  check(fellOf(table([0, 0, 0, 0], [2, 0, 0, 0]), 0, 0, 0) === these([0, 0]) && fellOf(table([R, 0, 0, 0]), R, 0, 0) === these([R, 0]), "an empty hexagon stops it, and so does the table's edge");
  const beside = table([0, 0, 0, 0], [1, -1, 0, 0], [0, 1, 0, 0]);
  let only = true;
  for (let a = 0; a < AXES; a++) for (let b = 0; b < AXES; b++) { beside.ax[hex(1, -1)] = a; beside.ax[hex(0, 1)] = b; if (fellOf(beside, 0, 0, 0) !== these([0, 0])) only = false; }
  check(only, "it knocks only the hexagon it falls at: the two beside the way, at sixty degrees, stand however they face");
}

// ---------- a fall at a line ----------
{
  // the one pushed faces thirty degrees (between east and north-east), pushed that way: it comes down on both
  const pair = (a, b, cb = 0) => fellOf(table([0, 0, 0, 1], [1, 0, 0, a], [1, -1, cb, b]), 0, 0, 1);
  const all3 = these([0, 0], [1, 0], [1, -1]);
  check(pair(1, 1) === all3, "falling at a line: the dominoes on both hexagons either side of it fall, square on");
  check(pair(0, 2) === all3 && pair(2, 0) === all3, "thirty degrees off the fall, they fall");
  check(pair(5, 3) === all3 && pair(3, 5) === all3, "sixty degrees off, they fall too");
  check(pair(4, 1) === these([0, 0], [1, -1]) && pair(1, 4) === these([0, 0], [1, 0]), "edge-on to the fall, one stands while its partner falls");
  check(pair(4, 4) === these([0, 0]), "both edge-on, both stand");
  // the fall itself decides, not the way to each: the east one facing 120° is only sixty degrees off the way to it, but square to the fall
  check(offBy(4, 0) === 2 && offBy(4, 1) === 3 && pair(4, 0) === these([0, 0], [1, -1]), "it's the way of the fall that counts, not the way to each hexagon");
  check(pair(1, 1, 2) === these([0, 0], [1, 0]), "only its own colour: another stands while its partner falls");
  check(fellOf(table([0, 0, 0, 1], [1, 0, 0, 1]), 0, 0, 1) === these([0, 0], [1, 0]), "with one of the two hexagons empty, the other still falls");
}

// ---------- the way each falls ----------
{
  // knocked by a fall at thirty degrees, a domino facing 150° falls at 330°, the sense of its axis nearer 30°
  const t = table([0, 0, 0, 1], [1, 0, 0, 5]), run = chain(t.cells, t.ax, hex(0, 0), 1);
  check(run.length === 2 && run[1][3] === 11 && run[0][3] === 1, "each falls along its own axis, the sense nearer the fall that knocked it: facing 150°, knocked at 30°, it falls at 330°");
  let seed = 99, ok = true, cases = 0;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 1000; k++) {
    const cells = CELLS.map(() => (rnd() < 0.85 ? (rnd() < 0.8 ? 0 : 1) : -1)), ax = cells.map(c => (c >= 0 ? Math.floor(rnd() * AXES) : -1)), stand = cells.flatMap((c, i) => (c >= 0 ? [i] : []));
    const i = stand[Math.floor(rnd() * stand.length)], fall = chain(cells, ax, i, ax[i] + (rnd() < 0.5 ? 0 : AXES)), way = new Map(fall.map(f => [f[0], f[3]]));
    for (const [j, , by, w] of fall) {
      if (by >= 0) cases++;
      if (w % AXES !== ax[j] || cells[j] !== cells[i]) ok = false;
      if (by >= 0 && (!(Math.cos(angle(w) - angle(way.get(by))) > 1e-9) || !hitBy(by, way.get(by)).includes(j))) ok = false;
    }
  }
  check(ok && cases > 1000, `on 1000 tables at random (${cases} knocked): each falls along its axis, in its colour, on a hexagon the one before came down on, its way within ninety degrees of that one's`);
}

// ---------- lines, bends, turns and forks ----------
{
  const row = table(...line(-2, 0, E, 5)), run = chain(row.cells, row.ax, hex(-2, 0), 0);
  check(run.length === 5 && stepsOf(run) === 5 && run.map(f => f[1]).join() === "0,1,2,3,4" && run[0][2] === -1 && run.map(f => f[0]).join() === [-2, -1, 0, 1, 2].map(q => hex(q, 0)).join(),
    "a line pushed from its end along itself falls end to end, a step a domino, the one pushed first");
  check(fellOf(row, 2, 0, 6) === fellOf(row, -2, 0, 0) && fellOf(row, -2, 0, 6) === these([-2, 0]) && fellOf(row, 0, 0, 0) === these([0, 0], [1, 0], [2, 0]),
    "from its other end the other way, the same; pushed away from the rest, only itself; pushed in its middle, only what's ahead");
  // a bend of sixty degrees: east along a row, then north-east; the domino at the bend facing the line between (30°)
  const bendAt = [0, 0], arms = [[-2, 0], [-1, 0], [0, 0], [1, -1], [2, -2]], bend = axis => table(...shaped(arms).map(m => (m[0] === bendAt[0] && m[1] === bendAt[1] ? [m[0], m[1], 0, axis] : m)));
  const whole = these(...arms);
  check(shaped(arms)[2][3] === 1 && fellOf(bend(1), -2, 0, 0) === whole && fellOf(bend(1), 2, -2, 8) === whole && stepsOf(chain(bend(1).cells, bend(1).ax, hex(2, -2), 8)) === 5,
    "a bend of sixty degrees falls through, both ways, when the domino at the bend faces the line between the way in and the way on (here 30°)");
  check(fellOf(bend(0), -2, 0, 0) === these([-2, 0], [-1, 0], [0, 0]) && fellOf(bend(0), 2, -2, 8) === these([2, -2], [1, -1]) && fellOf(bend(2), -2, 0, 0) === these([-2, 0], [-1, 0]),
    "facing along either line instead, the bend stops it: facing the way in it falls but points past the next, facing the way on it's sixty degrees off the fall and stands");
  // a turn of 120°: the domino past it touches the one before it, and falls only if that one's own fall comes down on it
  let never = true, onlyIfHit = true, aroundOnce = false;
  for (const c of [[1, -1], [0, 1]]) for (let w = 0; w < WAYS; w++) {
    if (!hitBy(hex(0, 0), w).includes(hex(1, 0))) continue;
    for (let b = 0; b < AXES; b++) for (let cAxis = 0; cAxis < AXES; cAxis++) {
      const t = table([0, 0, 0, w % AXES], [1, 0, 0, b], [c[0], c[1], 0, cAxis]), fell = chain(t.cells, t.ax, hex(0, 0), w), cFell = fell.find(f => f[0] === hex(...c));
      if (!cFell) continue;
      if (!isLine(w)) never = false;
      if (!hitBy(hex(0, 0), w).includes(hex(...c))) onlyIfHit = false;
      if (cFell[2] === hex(1, 0)) aroundOnce = true;
    }
  }
  check(never && onlyIfHit, "a turn of 120° is never taken: the domino past it falls only where the one before the turn comes down on its hexagon itself, falling at the line between the two");
  check(aroundOnce, "(and that one, standing edge-on to the first, can still be knocked by the second: a fork's other half, round the corner)");
  // a fork: a domino facing a line brings down both beyond it, and each goes on along its own line
  const branches = [...line(1, 0, E, 3), ...line(1, -1, NE, 3)], fork = table([0, 0, 0, 1], ...branches), forked = chain(fork.cells, fork.ax, hex(0, 0), 1);
  const both = these([1, 0], [2, 0], [3, 0], [1, -1], [2, -2], [3, -3]);
  check(fellOf(fork, 0, 0, 1) === [hex(0, 0), ...both.split(",").map(Number)].sort((a, b) => a - b).join() && stepsOf(forked) === 4 && knockOn(fork.cells, fork.ax, hex(0, 0), 1).gain === 280,
    "a fork: a domino facing a line brings down both beyond it, and each goes on along its own line (seven in four steps, 280, where a line of four is 160)");
  const behind = table([-1, 0, 0, 0], [0, 0, 0, 1], ...branches), fed = chain(behind.cells, behind.ax, hex(-1, 0), 0);
  check(fed.length === 8 && stepsOf(fed) === 5, "fed by a domino falling at it, thirty degrees off, the fork domino carries the fall on into both");
  // only a line-faller knocks two: on tables at random, every domino that knocked two was falling at a line
  let seed = 7, ok = true, twos = 0;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let k = 0; k < 400; k++) {
    const cells = CELLS.map(() => (rnd() < 0.8 ? 0 : -1)), ax = cells.map(c => (c >= 0 ? Math.floor(rnd() * AXES) : -1)), stand = cells.flatMap((c, i) => (c >= 0 ? [i] : []));
    const i = stand[Math.floor(rnd() * stand.length)], fall = chain(cells, ax, i, ax[i]), way = new Map(fall.map(f => [f[0], f[3]])), kids = new Map();
    for (const [, , by] of fall) if (by >= 0) kids.set(by, (kids.get(by) || 0) + 1);
    for (const [j, n] of kids) { if (n > (isLine(way.get(j)) ? 2 : 1)) ok = false; if (n === 2) twos++; }
  }
  check(ok && twos > 50, `a domino falling at a hexagon brings down one at most, at a line two (on 400 tables at random, ${twos} knocked two, every one at a line)`);
}

// ---------- the push ----------
{
  const t = table(...line(-2, 0, E, 3), [0, 2, 0, 1]), s = game(t);
  check(pushes(t.ax, hex(-2, 0)).join() === "0,6" && pushes(t.ax, hex(0, 2)).join() === "1,7" && pushes(t.ax, hex(3, 3)).length === 0, "a domino can be pushed two ways: either way along its axis");
  check(knock(s, hex(-2, 0), 0).fell.length === 3 && knock(s, hex(-2, 0), 6).fell.length === 1 && knock(s, hex(0, 0), 6).fell.length === 3, "either way, the player's to choose: the line from its west end east, or from its east end west");
  let threw = 0;
  for (const w of [1, 2, 3, 4, 5, 7, 8, 9, 10, 11]) { try { knock(s, hex(-2, 0), w); } catch { threw++; } }
  check(threw === 10 && [1, 2, 3, 4, 5, 7, 8, 9, 10, 11].every(w => chain(t.cells, t.ax, hex(-2, 0), w).length === 0), "and no other way: a push across its axis is refused, and falls nothing");
}

// ---------- turning a domino ----------
{
  const t = table(...line(-2, 0, E, 3), [1, -1, 0, 4]), s = game(t), turned = turn(s, hex(1, -1), 2);
  check(turned.ax[hex(1, -1)] === 2 && s.ax[hex(1, -1)] === 4 && turned.ax.every((a, i) => i === hex(1, -1) || a === s.ax[i]), "a domino turned to another axis, the rest as they were, the game turned from left as it was");
  check(["score", "n", "due", "credit", "laid", "sets", "felled", "bell"].every(k => turned[k] === s[k]) && JSON.stringify(turned.hand) === JSON.stringify(s.hand) && JSON.stringify(turned.cells) === JSON.stringify(s.cells), "turning is free: nothing else changes, a knock due or not");
  let again = s;
  for (let k = 0; k < 20; k++) again = turn(again, hex(-1, 0), k % AXES);
  check(again.ax[hex(-1, 0)] === 1 && JSON.stringify(JSON.parse(JSON.stringify(turned))) === JSON.stringify(turned), "as often as you like, and kept with the game as it's saved");
  // the bend set up by turning, then pushed: the line of three and the one turned to carry it on round
  const set = turn(turn(s, hex(0, 0), 1), hex(1, -1), 2);
  check(knock(s, hex(-2, 0), 0).fell.length === 3 && knock(set, hex(-2, 0), 0).fell.length === 4, "turned to face the line between, the end of a line carries the fall round a bend onto the next");
  let threw = 0;
  for (const [g, i, a] of [[s, hex(3, 3), 0], [s, hex(0, 0), 6], [s, hex(0, 0), -1], [s, hex(0, 0), 1.5], [Object.assign(structuredClone(s), { over: true }), hex(0, 0), 1]]) { try { turn(g, i, a); } catch { threw++; } }
  check(threw === 5, "not on an empty hexagon, not to an axis that isn't one, not when the game is over");
}

// ---------- how each piece faces as dealt ----------
{
  check(axesOfCoords([[0, 0], [1, 0], [2, 0]]).join() === "0,0,0" && axesOfCoords([[0, 0], [0, 1], [0, 2]]).join() === "4,4,4" && axesOfCoords([[0, 0], [1, -1], [2, -2]]).join() === "2,2,2" && axesOfCoords([[0, 0], [1, -1]]).join() === "2,2",
    "a line faces along itself, whichever of the three ways it lies; two beside each other face one another");
  check(axesOfCoords([[-1, 0], [0, 0], [1, -1]]).join() === "0,1,2" && axesOfCoords([[1, -1], [0, 0], [0, 1]]).join() === "2,3,4", "at a bend of sixty degrees, the domino at the bend faces the line between its two neighbours' ways (a line axis), the ends their neighbour");
  check(new Set(CELLS.map(c => axesOfCoords([c])[0])).size === 3 && CELLS.every(c => axesOfCoords([c])[0] % 2 === 0), "a lone domino takes a hexagon axis from where it stands, three of them across the table");
  check(axesOf([hex(0, 0), hex(1, 0)]).join() === axesOfCoords([[0, 0], [1, 0]]).join() && [0, 1, 2, 3, 4, 5].every(a => [0, 1, 2, 3, 4, 5].every(b => a === b || through(a, b) === through(b, a))), "by hexagon number or by coordinates, the same; the axis between two ways the same either way round");
  // every piece of the 141, laid alone: pushed from an end towards the rest, how much of it falls
  const counts = { whole: 0, forks: 0, forkOf4: 0 };
  let ok = true;
  for (const [name, p] of Object.entries(PIECES)) {
    const t = { cells: new Array(SIZE).fill(-1), ax: new Array(SIZE).fill(-1) };
    const laid = [[0, 0], [-1, 0], [-2, 0], [0, -1], [-1, -1], [0, -2], [-2, 1], [-1, 1]].map(([q, r]) => cover(t.cells, name, q, r)).find(Boolean), faces = axesOf(laid);
    laid.forEach((i, k) => { t.cells[i] = 0; t.ax[i] = faces[k]; });
    const degree = i => laid.filter(j => dirTo(i, j) >= 0).length, n = laid.length;
    const ends = laid.filter(i => degree(i) <= 1).map(e => Math.max(...pushes(t.ax, e).map(w => chain(t.cells, t.ax, e, w).length)));
    if (laid.some(i => degree(i) === 3)) {
      counts.forks++; if (n === 4) counts.forkOf4++;
      if (ends.filter(m => m === n - 1).length !== 2 || Math.max(...ends) !== n - 1) ok = false;           // the ends of its two long arms
    } else if (ends.every(m => m === n)) counts.whole++;
    else ok = false;
  }
  check(ok && counts.whole === 121 && counts.forks === 20 && counts.forkOf4 === 2,
    `as dealt, every piece but the forks falls whole from either end (${counts.whole}); the ${counts.forks} forks (${counts.forkOf4} of four, ${counts.forks - counts.forkOf4} of five) fall all but their short arm from the end of either long one, no fall taking all three arms`);
  const s = game(table(), [piece("0,0;1,0;1,1", 1), piece(SINGLE, 0), piece(SINGLE, 2)], { due: false }), r = lay(s, 0, 0, 0);
  check(r.laid.every((i, k) => r.state.ax[i] === axesOf(r.laid)[k]) && r.state.ax.filter(f => f >= 0).length === 3 && s.ax.every(f => f === -1), "laying keeps how they face, with the game; no other hexagon faces anywhere");
  const k = knock(Object.assign(structuredClone(r.state), { due: true }), hex(0, 0), 0);
  check(k.fell.length === 3 && k.fell.every(([i]) => k.state.ax[i] === -1) && k.state.ax.every((f, i) => (f >= 0) === (k.state.cells[i] >= 0)), "a knock clears them with the dominoes that fell");
}

// ---------- a push, its points, the bell ----------
{
  const s = game(table(...line(-3, 0, E, 3), [-3, 1, 1, 0])), r = knock(s, hex(-3, 0), 0);
  check(r.fell.length === 3 && r.steps === 3 && r.gain === 90 && r.state.score === 90 && r.state.cells[hex(-3, 0)] === -1 && r.state.cells[hex(-3, 1)] === 1,
    "the dominoes fall and clear: ten times how many fell times the steps they took, a line of three from its end 90");
  check(knock(s, hex(-2, 0), 0).gain === 40 && worth(1) === 10 && worth(10) === 1000 && worth(20, 10) === 2000, "pushed in the middle only two fall, two steps: 40; one long line beats several short ones");
  check(!r.state.due && r.state.felled === 3 && s.due && s.cells[hex(-3, 0)] === 0, "the knock made; the game knocked from left as it was");
  let threw = 0;
  try { knock(r.state, hex(-3, 1), 0); } catch { threw++; }
  try { knock(s, hex(3, 3), 0); } catch { threw++; }
  check(threw === 2, "no knock when none is due, nor on an empty hexagon");
  const five = game(table(...line(-2, 0, E, 5))), four = game(table(...line(-2, 0, E, 4)));
  check(knock(five, hex(-2, 0), 0).gain === 250 && knock(four, hex(-2, 0), 0).gain === 160 && knock(four, hex(-2, 0), 6).gain === 10, "a line of five from its end 250; of four 160; pushed the other way, 10");
  const arcAt = [[-3, 0], [-2, 0], [-1, 0], [0, 0], [1, -1], [2, -2], [3, -3]], arc = table(...shaped(arcAt)), best = longest(arc.cells, arc.ax, hex(-3, 0));
  check(best.size === 7 && best.fell === 7 && best.steps === 7 && best.gain === 490 && [hex(-3, 0), hex(3, -3)].includes(best.at), "the best push on what's joined: from a far end, round the bend in seven, 490");
  check(longest(table([0, 0, 0, 0]).cells, table([0, 0, 0, 0]).ax, hex(0, 0)).gain === 10 && longest(table().cells, table().ax, 0).at === -1, "it tries every domino both ways: a lone domino is 10, an empty table nothing");
  const two = table(...line(0, 0, E, 4), [-3, 2, 1, 0]);
  check(chains(two.cells, two.ax, -1).map(k => k.length).join() === "4,1", "the dominoes standing, joined by colour, most first");
  const rung = knock(game(table(...line(-2, 0, E, 4)), undefined, { bell: hex(0, 0) }), hex(-2, 0), 0);
  check(rung.rang && rung.gain === 320 && rung.state.rung === 1 && rung.state.bell !== hex(0, 0) && rung.state.cells[rung.state.bell] === -1, "a fall past the bell scores double (a line of four 320) and the bell moves to an empty hexagon");
  const t4 = table(...line(-2, 0, E, 4), [-1, 2, 1, 0]), missed = knock(game(t4, undefined, { bell: hex(-1, 2) }), hex(-2, 0), 0);
  check(!missed.rang && missed.gain === 160 && missed.state.bell === hex(-1, 2) && knockOn(t4.cells, t4.ax, hex(-2, 0), 0, hex(1, 0)).rings, "a fall that doesn't pass it leaves it where it hangs");
  const plain = game(table(...line(-2, 0, E, 4)), undefined, { n: 40 }), ringing = game(table(...line(-2, 0, E, 4)), undefined, { n: 40, bell: hex(0, 0) });
  check(knock(plain, hex(-2, 0), 0).state.n === 41 && knock(ringing, hex(-2, 0), 0).state.n === 42, "a knock still passes over the draw that once dealt the next knock's strength, and the bell takes one more when it moves");
  // a skipped knock: no fall, and the next knock scores as much again, adding to the bell's rather than multiplying it
  const row = extra => game(table(...line(-2, 0, E, 4)), undefined, extra), owed = row({ bell: hex(R, 0) }), skipped = skip(owed).state;
  check(canSkip(owed) && !skipped.due && skipped.boost === 1 && skipped.score === 0 && skipped.felled === 0 && JSON.stringify(skipped.cells) === JSON.stringify(owed.cells) && skipped.n === owed.n && !skipped.over,
    "skipping a due knock fells nothing, takes the knock off the table's time and leaves the next one boosted");
  const boosted = { ...skipped, due: true }, took = knock(boosted, hex(-2, 0), 0), rung2 = knock({ ...boosted, bell: hex(0, 0) }, hex(-2, 0), 0);
  check(took.boosted && took.gain === 320 && took.state.boost === 0 && knock(owed, hex(-2, 0), 0).gain === 160, "the boosted knock scores a hundred per cent more (a line of four: 320 for 160) and spends it");
  check(rung2.rang && rung2.gain === 480 && knockOn(...Object.values(table(...line(-2, 0, E, 4))), hex(-2, 0), 0, hex(0, 0), undefined, 1).gain === 480, "with the bell as well it is three times (480), the two adding rather than multiplying");
  check(!canSkip(skipped) && !canSkip(boosted) && !canSkip(row({ due: false })) && !canSkip(row({ hand: [null, null, null] })) && !canSkip(row({ over: true })), "no skip where none is due, where one is already standing, where no piece in hand would fit, or when the game is over");
  let refused = 0;
  for (const g of [boosted, row({ due: false }), row({ hand: [null, null, null] })]) try { skip(g); } catch { refused++; }
  check(refused === 3, "skipping where it isn't allowed is refused");
  check(chains(...Object.values(table(...line(-2, 0, E, 4))), hex(R, 0), undefined, 1)[0].best.gain === 320 && longest(...Object.values(table(...line(-2, 0, E, 4))), hex(-2, 0), -1, undefined, 1).gain === 320, "the best push the page shows counts the boost that stands");
}

// ---------- a game of version 4 ----------
{
  const old = { v: 4, seed: 9, n: 31, cells: new Array(SIZE).fill(-1), ax: new Array(SIZE).fill(-1), hand: [piece(PAIR, 1), null, piece(SINGLE, 0)], due: true, force: 3, credit: 0.4, bell: hex(1, 1), rung: 2, sets: 6, laid: 16, felled: 12, score: 870, over: false };
  old.cells[hex(0, 0)] = 0; old.ax[hex(0, 0)] = 0; old.cells[hex(1, 0)] = 0; old.ax[hex(1, 0)] = 1; old.cells[hex(2, 0)] = 2; old.ax[hex(2, 0)] = 2;
  const kept = JSON.stringify(old), m = migrate(JSON.parse(kept));
  check(m && m.v === 5 && !("force" in m) && m.ax[hex(0, 0)] === 0 && m.ax[hex(1, 0)] === 2 && m.ax[hex(2, 0)] === 4 && m.ax.filter(a => a >= 0).length === 3 && JSON.stringify(old) === kept,
    "a game of version 4 opens as version 5: each of its three axes the same hexagon axis of six (doubled), the strength dropped, the game passed in left as it was");
  check(["seed", "n", "due", "credit", "bell", "rung", "sets", "laid", "felled", "score", "over"].every(k => m[k] === old[k]) && JSON.stringify(m.cells) === JSON.stringify(old.cells) && JSON.stringify(m.hand) === JSON.stringify(old.hand),
    "everything else as it was: the table, the hand, the score, the knock due, the draws made (so the deal goes on as it would have)");
  check(knock(m, hex(0, 0), 0).state.n === 32 && migrate(m) === m && migrate({ ...old, v: 3 }) === null && migrate(null) === null && migrate({ v: 5 }) === null, "it knocks on from there; a game of this version is kept as it is; one older than four, or no game, isn't taken");
}

// ---------- the pace of the knocks ----------
{
  const rates = [1, 2, PACE.from - 1, PACE.from, PACE.from + 1, Math.round((PACE.from + PACE.to) / 2), PACE.to - 1, PACE.to, PACE.to + 1, 500].map(v => rate(v));
  check(rates.slice(0, 4).every(v => v === 1) && rates[7] === PACE.end && rates[9] === PACE.end && rates.every((v, k) => k === 0 || v <= rates[k - 1]) && rates[5] > PACE.end && rates[5] < 1, `a knock every hand for ${PACE.from}, then fewer and fewer to ${Math.round(PACE.end * 100)} in a hundred from the ${PACE.to}th hand`);
  // hands played on a table cleared after each, so the game can't end: which hands' ends brought a knock, and what
  // untilKnock said at the start of each
  let s = newGame(3);
  const brought = [], told = [];
  for (let hand = 1; hand <= 160; hand++) {
    told[hand] = hand + untilKnock(s) - 1;
    for (let k = 0; k < HAND; k++) { const m = moves(s)[0]; s = lay(s, m.slot, m.q, m.r).state; }
    brought[hand] = s.due;
    if (s.due) { const i = s.cells.findIndex(c => c >= 0); s = knock(s, i, s.ax[i]).state; }
    s.cells.fill(-1); s.ax.fill(-1);
  }
  const dueFrom = h => { let k = h; while (!brought[k]) k++; return k; };
  check(brought.slice(1, PACE.from + 1).every(Boolean), `a knock after each of the first ${PACE.from} hands`);
  const later = brought.slice(PACE.to + 1);
  check(Math.abs(later.filter(Boolean).length / later.length - PACE.end) < 0.1, `from the ${PACE.to + 1}th hand about ${Math.round(PACE.end * 10)} in ten`);
  check(told.slice(1, 140).every((n, k) => n === dueFrom(k + 1)), "untilKnock says, at the start of a hand, which hand's end brings the knock");
  check(untilKnock(Object.assign(newGame(1), { due: true })) === 0 && untilKnock(newGame(1)) === 1, "0 when it's due, 1 after the first hand");
}

// ---------- laying, and the knock on the table's time ----------
{
  const s = game(table(), [piece(PAIR, 2), piece(SINGLE, 1), piece("0,0;0,1", 0)], { due: false });
  const r = lay(s, 0, 0, 0);
  check(r.laid.join() === `${hex(0, 0)},${hex(1, 0)}` && r.state.cells[hex(0, 0)] === 2 && r.state.hand[0] === null && r.state.laid === 1 && !r.dealt && !r.due, "a piece stands its dominoes in its colour; the others wait");
  let threw = false;
  try { lay(r.state, 1, 1, 0); } catch { threw = true; }
  check(threw && s.cells[hex(0, 0)] === -1, "not where a domino stands; the game laid from left as it was");
  const all = lay(lay(r.state, 1, -2, 0).state, 2, 0, -2);
  check(all.dealt && all.state.hand.every(Boolean) && all.state.sets === s.sets + 1 && all.due === all.state.due && all.state.credit < 1, "the third laid, three more are dealt");
  check(all.due && !moves(all.state).length, "the hand's last piece down with a knock owed: the knock first, nothing laid until it's made");
  threw = false;
  try { lay(all.state, 0, 3, 0); } catch { threw = true; }
  check(threw, "a piece can't be laid over it");
  const turned = turn(all.state, hex(0, 0), 3);
  check(turned.due && turned.ax[hex(0, 0)] === 3, "with the knock due, a domino can still be turned, to set the fall up before the push");
  const after = knock(all.state, hex(0, 0), 0);
  check(!after.state.due && moves(after.state).length > 0, "made, the next hand is laid");
  const later = game(table(), [piece(SINGLE), null, null], { due: false, sets: PACE.to + 4, credit: 0 }), l2 = lay(later, 0, 0, 0);
  const second = lay(Object.assign(structuredClone(l2.state), { hand: [piece(SINGLE), null, null] }), 0, 1, 0);
  check(!l2.due && l2.state.credit === PACE.end && second.due === (2 * PACE.end >= 1 - 1e-9), `later a hand's end only adds ${PACE.end} of a knock to the credit`);
}

// ---------- the end ----------
{
  const hole = hex(0, 0), full = { cells: new Array(SIZE).fill(0), ax: new Array(SIZE).fill(0) };
  full.cells[hole] = -1; full.ax[hole] = -1;
  const hand = [piece(SINGLE, 2), piece(PAIR, 0), piece("0,0;0,1", 1)];
  const stuck = lay(game(full, hand, { due: false }), 0, 0, 0);
  check(stuck.over && stuck.state.over, "no room for any piece in hand, and no knock due: the game is over");
  let threw = false;
  try { turn(stuck.state, hex(1, 0), 1); } catch { threw = true; }
  check(threw, "and nothing more is turned");
  const done = lay(game(full, [piece(SINGLE, 2), null, null], { due: false }), 0, 0, 0);
  check(done.dealt && done.due && !done.over, "a hand finished with the knock due isn't over, the knock may make room");
  const made = knock(done.state, 0, 0);
  check(made.state.cells.filter(c => c < 0).length >= 5, "and made, there is room again");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 12; k++) {
    if (s.due) { const i = s.cells.findIndex(c => c >= 0); s = knock(s, i, s.ax[i] + (k % 2) * AXES).state; continue; }
    const m = moves(s)[(k * 5) % moves(s).length];
    s = lay(s, m.slot, m.q, m.r).state;
    const i = s.cells.findIndex(c => c >= 0);
    if (!s.over) s = turn(s, i, (s.ax[i] + k) % AXES);
  }
  const again = JSON.parse(JSON.stringify(s));
  const step = g => { if (!g.due) return lay(g, moves(g)[0].slot, moves(g)[0].q, moves(g)[0].r); const i = g.cells.findIndex(c => c >= 0); return knock(g, i, g.ax[i]); };
  check(JSON.stringify(step(s)) === JSON.stringify(step(again)) && JSON.stringify(again.ax) === JSON.stringify(s.ax), "a game saved and opened again goes on as it would have, the dominoes facing as they were turned");
}

// ---------- whole games ----------
// Simple players (tests/topple-players.js): four that lay by habit and turn nothing (in the corner, by colour, at random)
// and two careful ones that turn every group of a colour into the longest fall they can find after each piece (the second
// also bringing its falls to the bell). Every knock is the push that scores most.
const MEASURE = process.argv.includes("measure"), ARG = k => process.argv.find(x => x.startsWith(`${k}=`))?.slice(k.length + 1);
if (MEASURE && ARG("pace")) { const [from, to, end] = ARG("pace").split(",").map(Number); Object.assign(PACE, { from, to, end }); }
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  const games = MEASURE ? Number(ARG("games") || 40) : 6, results = {}, named = process.argv.find(x => x.split(",").every(k => PLAYERS[k]));
  const playing = MEASURE ? (named ? named.split(",") : Object.keys(PLAYERS)) : ["corner", "careful"];
  const t0 = Date.now();
  for (const [id, p] of Object.entries(PLAYERS)) {
    if (!playing.includes(id)) continue;
    results[id] = Array.from({ length: games }, (_, g) => play(100 + g, p));
  }
  if (MEASURE) {
    for (const [id, list] of Object.entries(results)) {
      const laid = list.map(r => r.laid), sc = list.map(r => r.score);
      if (process.argv.includes("list")) console.log(list.map((r, g) => `${100 + g}:${r.laid}`).join(" "));
      const sum = k => list.reduce((a, r) => a + r[k], 0), per = k => Math.round((100 * sum(k)) / sum("knocks"));
      console.log(`${PLAYERS[id].name}: ${median(laid)} pieces (${Math.min(...laid)} to ${Math.max(...laid)}), scoring ${median(sc)}, ${(sum("fell") / sum("knocks")).toFixed(1)} a knock, the bell ${(sum("rung") / list.length).toFixed(1)} times; ${per("bent")} knocks in 100 through a domino facing a line, ${per("forked")} forking; ${list.filter(r => !r.ended).length} not over`);
    }
    console.log(`(pace ${PACE.from}, ${PACE.to}, ${PACE.end}; ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    process.exit(0);
  }
  const corners = results.corner.map(r => r.laid), cares = results.careful.map(r => r.laid);
  check(median(corners) < 60, `laying every piece in the corner, turning nothing: over after about ${median(corners)} pieces`);
  check(median(cares) > 1.5 * median(corners) && results.careful.every(r => r.ended), `turning each group into its longest fall and laying for it: about ${median(cares)} pieces, and over in the end every time`);
  check(Object.values(results).flat().every(r => r.ok), "through whole games: standing dominoes face one of six axes and empty hexagons none, the score is the knocks' gains");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("topple: the table, the deal, the pieces, where they fit, the ways and axes, falls at a hexagon and at a line, lines, bends, turns and forks, the push, turning, how pieces face, pushes and the bell, version 4 carried over, the pace of the knocks, the end, saving, whole games");
