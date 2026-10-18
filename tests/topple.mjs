// Topple's rules (topple-engine.js): the table of sixty-one hexagons, the deal from a seed, the pieces (chains of one to
// five), where a piece fits, how dominoes fall (straight on, onto the two at sixty degrees only where nothing stands
// ahead, never sideways or back; each the way it was knocked), the strength of a push (weak takes the one ahead, medium
// that or the two beside, strong all three; each a part of the next; dealt from the seed, shown a knock ahead), a push's
// clearing and its points (the dominoes times the steps they take: a long chain from its end beats a blob), the bell
// doubling a fall that passes it and moving on, how each domino faces (for the 3D table), the knock on the table's time
// (a knock every hand at first, then fewer, nothing laid until it's made), the end (no room and no knock due), a game
// saved and opened again, and whole games played out to their end.
import { R, CELLS, SIZE, DIRS, HAND, PIECES, PACE, WEAK, MEDIUM, STRONG, FORCE_NAMES, FORCE_ODDS, forceName, axesOfCoords, axesOf, rate, untilKnock, newGame, at, next, cover, fitsAnywhere, chain, group, chains, stepsOf, longest, knockOn, worth, lay, knock, moves } from "../topple-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const E = 0, NE = 1, W = 3, SE = 5;
const hex = (q, r) => at(q, r);
/** A table drawn by hand: [[q, r, colour]…], or a line: [q, r, direction, how many, colour] marked by a fifth entry. */
function table(...marks) {
  const cells = new Array(SIZE).fill(-1);
  for (const m of marks) {
    if (m.length === 3) cells[hex(m[0], m[1])] = m[2];
    else for (let k = 0; k < m[3]; k++) cells[hex(m[0] + k * DIRS[m[2]][0], m[1] + k * DIRS[m[2]][1])] = m[4];
  }
  return cells;
}
const piece = (p, colour = 0) => ({ piece: p, colour });
const SINGLE = "0,0", PAIR = "0,0;1,0";
const game = (cells, hand = [piece(SINGLE), piece(SINGLE), piece(SINGLE)], extra = {}) => Object.assign(newGame(1), { cells, hand, due: true, bell: hex(R, 0) }, extra);
const fell = (cells, q, r, dir, force = MEDIUM) => chain(cells, hex(q, r), dir, force).map(f => f[0]).sort((a, b) => a - b).join();
const at_ = (...qr) => qr.map(([q, r]) => hex(q, r)).sort((a, b) => a - b).join();

// ---------- the table ----------
{
  check(SIZE === 61 && CELLS.length === 61 && at(0, 0) >= 0 && at(R, 0) >= 0 && at(R, 1) === -1 && at(-R, -R) === -1 && CELLS.every(([q, r], i) => at(q, r) === i), "sixty-one hexagons, four out from the middle, each numbered row by row");
  const ring = n => [...Array(6).keys()].filter(d => next(n, d) >= 0).length;
  check(ring(hex(0, 0)) === 6 && ring(hex(R, 0)) === 3 && ring(hex(0, -R)) === 3 && ring(hex(2, -R)) === 4 && CELLS.every((_, i) => [...Array(6).keys()].every(d => next(i, d) < 0 || next(next(i, d), (d + 3) % 6) === i)),
    "six neighbours in the middle, three in a corner (six of them), four on an edge, and each is its neighbour's neighbour back the other way");
}

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), hands = new Set([...Array(10).keys()].map(k => JSON.stringify(newGame(k).hand)));
  check(JSON.stringify(a) === JSON.stringify(b) && hands.size > 5, "the same seed deals the same game, another seed another");
  check(a.v === 4 && a.cells.length === SIZE && a.cells.every(c => c === -1) && a.ax.length === SIZE && a.ax.every(f => f === -1) && a.hand.length === HAND && a.hand.every(h => PIECES[h.piece] && h.colour >= 0 && h.colour < 3) && !a.due && a.force === MEDIUM && a.credit === 0 && a.sets === 1 && !a.over,
    "an empty table, three pieces in three colours, nothing facing any way, no knock yet owed, the first one medium");
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
  const cells = table([0, 0, 0]);
  check(cover(cells, SINGLE, 1, 0)?.join() === String(hex(1, 0)) && cover(cells, SINGLE, 0, 0) === null && cover(cells, SINGLE, R, 1) === null, "a piece goes on empty hexagons, not on a domino or off the table");
  check(cover(cells, PAIR, -1, 0) === null && cover(cells, PAIR, 1, 0)?.join() === `${hex(1, 0)},${hex(2, 0)}` && cover(cells, PAIR, R, 0) === null, "all of it must fit: a pair over a domino, or half off the edge, doesn't");
  check(fitsAnywhere(cells, "0,0;1,0;2,0;3,0;4,0") && !fitsAnywhere(table(...CELLS.map(([q, r], i) => [q, r, i % 2])), SINGLE), "a piece fits somewhere, or nowhere");
}

// ---------- how dominoes fall ----------
{
  const line = table([-2, 0, E, 4, 0]), run = chain(line, hex(-2, 0), E);
  check(run.length === 4 && stepsOf(run) === 4 && run.map(f => f[1]).join() === "0,1,2,3" && run[0][2] === -1 && run.map(f => f[0]).join() === [-2, -1, 0, 1].map(q => hex(q, 0)).join(),
    "a line pushed from its end falls end to end, a step a domino, the one pushed first");
  check(fell(line, 0, 0, E) === at_([0, 0], [1, 0]) && stepsOf(chain(line, hex(0, 0), E)) === 2 && fell(line, 1, 0, E) === at_([1, 0]),
    "pushed in the middle only what's ahead of it falls, the rest of the line stays; at the end of the line, only itself");
  check(fell(line, -2, 0, W) === at_([-2, 0]), "pushed against its line, only the one pushed falls");
  check(fell(line, -2, 0, NE) === fell(line, -2, 0, E) && fell(line, -2, 0, SE) === fell(line, -2, 0, E) && fell(line, -1, 0, SE) === at_([-1, 0], [0, 0], [1, 0]),
    "pushed a sixty degrees off its line, with nothing there, a domino falls on the two at sixty degrees: the line beside it goes whole, from the end or ahead of the middle");
  const bend = table([-2, 0, E, 3, 1], [1, -1, 1], [1, 0, 0]);
  const turned = chain(bend, hex(-2, 0), E);
  check(turned.length === 4 && stepsOf(turned) === 4 && fell(bend, -2, 0, E) === at_([-2, 0], [-1, 0], [0, 0], [1, -1]),
    "where its line ends it goes on to a sixty degrees either side: here the one up and to the right (the one straight on is another colour, so it stays)");
  // straight on beats the sixty degrees: with a domino ahead, the two beside the way stay standing
  const ahead = table([-1, 0, 1], [0, 0, 1], [1, 0, 1], [0, -1, 1], [-1, 1, 1]);
  check(fell(ahead, -1, 0, E) === at_([-1, 0], [0, 0], [1, 0]), "with one of its colour straight ahead, a domino takes that one and the two at sixty degrees stay standing");
  const both = table([-1, 0, 1], [0, 0, 1], [1, -1, 1], [0, 1, 1]);
  const forked = chain(both, hex(-1, 0), E);
  check(forked.length === 4 && stepsOf(forked) === 3 && forked.filter(f => f[1] === 2).length === 2, "with none ahead, both at sixty degrees fall at once: a fork, three steps");
  const side = table([0, 0, 1], [0, -1, 1], [-1, 1, 1], [-1, 0, 1]);
  check(fell(side, 0, 0, E) === at_([0, 0]), "a domino at a hundred and twenty degrees, or behind, is never taken: pushed east, the centre of those falls alone");
  const flower = table([0, 0, 1], ...DIRS.map(([dq, dr]) => [dq, dr, 1])), flowered = chain(flower, hex(-1, 0), E);
  check(group(flower, hex(0, 0)).length === 7 && flowered.length === 3 && fell(flower, -1, 0, E) === at_([-1, 0], [0, 0], [1, 0]),
    "a flower of seven pushed from a petal falls along its line and leaves four standing");
  const wall = table([0, 0, 1], [1, 0, 0]);
  check(fell(wall, 0, 0, E) === at_([0, 0]) && fell(table([R, 0, 2]), R, 0, E) === at_([R, 0]) && chain(table([0, 0, 1]), hex(3, 0), E).length === 0, "another colour stops it, so does the table's edge, and an empty hexagon sets nothing off");
  const web = table([-3, 0, E, 4, 0], [0, -1, E, 3, 0], [1, 1, NE, 2, 0], [2, -1, 0]), webbed = chain(web, hex(-3, 0), E), st = Object.fromEntries(webbed.map(([sq, k]) => [sq, k]));
  const heading = (a, b) => DIRS.findIndex(([dq, dr], d) => next(a, d) === b);
  check(webbed.every(([sq, k, by]) => by < 0 || (st[by] === k - 1 && heading(by, sq) >= 0)) && new Set(webbed.map(f => f[0])).size === webbed.length, "each falls from a neighbour a step before it, and none twice");
  check(chains(table([0, 0, E, 4, 0], [-3, 2, 1]), -1).map(k => k.length).join() === "4,1", "the dominoes standing, joined by colour, most first");
}

// ---------- the strength of a push ----------
{
  const line = table([-2, 0, E, 4, 0]);
  check(WEAK === 1 && MEDIUM === 2 && STRONG === 3 && FORCE_NAMES.join() === "weak,medium,strong" && forceName(WEAK) === "weak" && forceName(STRONG) === "strong" && JSON.stringify(chain(line, hex(-2, 0), E)) === JSON.stringify(chain(line, hex(-2, 0), E, MEDIUM)),
    "three strengths, weak one to strong three, named; a push with none given is medium, as the only push once was");
  check([WEAK, MEDIUM, STRONG].every(f => fell(line, -2, 0, E, f) === at_([-2, 0], [-1, 0], [0, 0], [1, 0])), "a line falls whole from its end at any strength: only a blob tells them apart");
  // nothing stands straight ahead of the pushed one; the two beside the way do
  const beside = table([-1, 0, 1], [0, -1, 1], [-1, 1, 1]);
  check(fell(beside, -1, 0, E, WEAK) === at_([-1, 0]) && fell(beside, -1, 0, E, MEDIUM) === at_([-1, 0], [0, -1], [-1, 1]) && fell(beside, -1, 0, E, STRONG) === fell(beside, -1, 0, E, MEDIUM),
    "with nothing straight ahead, a weak push takes nothing, medium and strong the two at sixty degrees");
  // one straight ahead, and the two beside the way as well
  const three = table([-1, 0, 1], [0, 0, 1], [0, -1, 1], [-1, 1, 1]);
  check(fell(three, -1, 0, E, WEAK) === at_([-1, 0], [0, 0]) && fell(three, -1, 0, E, MEDIUM) === at_([-1, 0], [0, 0]) && fell(three, -1, 0, E, STRONG) === at_([-1, 0], [0, 0], [0, -1], [-1, 1]),
    "with one straight ahead, weak and medium take it alone, strong takes it and the two at sixty degrees as well: all three directions");
  const fork = table([-1, 0, 1], [0, 0, 1], [1, -1, 1], [0, 1, 1]);
  check(fell(fork, -1, 0, E, WEAK) === at_([-1, 0], [0, 0]) && fell(fork, -1, 0, E, MEDIUM) === at_([-1, 0], [0, 0], [1, -1], [0, 1]) && fell(fork, -1, 0, E, STRONG) === fell(fork, -1, 0, E, MEDIUM),
    "a fork: weak stops at the first, medium and strong go on round both arms");
  const flower = table([0, 0, 1], ...DIRS.map(([dq, dr]) => [dq, dr, 1]));
  check(fell(flower, -1, 0, E, WEAK) === at_([-1, 0], [0, 0], [1, 0]) && fell(flower, -1, 0, E, MEDIUM) === fell(flower, -1, 0, E, WEAK) && chain(flower, hex(-1, 0), E, STRONG).length === 7 && stepsOf(chain(flower, hex(-1, 0), E, STRONG)) === 3,
    "a flower of seven pushed from a petal: three fall weak or medium, all seven strong, in three steps");
  const wall = table([-1, 0, 1], [0, 0, 0], [0, -1, 2], [-1, 1, 2]);
  check(fell(wall, -1, 0, E, STRONG) === at_([-1, 0]), "strong takes only its own colour: the others stand");
  // for any table: each strength's fall holds the weaker one's, and stays in the pushed one's colour group
  let seed = 4321;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  let nested = 0, grows = 0, inColour = true, cases = 0;
  for (let k = 0; k < 400; k++) {
    const fill = 0.3 + rnd() * 0.6, cells = CELLS.map(() => (rnd() < fill ? Math.floor(rnd() * 3) : -1)), stand = cells.flatMap((c, i) => (c >= 0 ? [i] : []));
    if (!stand.length) continue;
    const i = stand[Math.floor(rnd() * stand.length)], d = Math.floor(rnd() * 6);
    const [w, m, st] = [WEAK, MEDIUM, STRONG].map(f => new Set(chain(cells, i, d, f).map(x => x[0])));
    cases++;
    if ([...w].every(x => m.has(x)) && [...m].every(x => st.has(x))) nested++;
    if (st.size > m.size) grows++;
    const colour = new Set(group(cells, i));
    if (![...st].every(x => colour.has(x))) inColour = false;
  }
  check(cases > 300 && nested === cases && inColour && grows > 40, `on ${cases} tables, a push at random: a weak fall is part of a medium one, and that of a strong one, always within a colour (strong felled more in ${grows})`);
  const fl = f => knock(game(flower, undefined, { force: f }), hex(-1, 0), E);
  check(fl(WEAK).gain === 90 && fl(MEDIUM).gain === 90 && fl(STRONG).gain === 210 && fl(STRONG).fell.length === 7 && fl(STRONG).state.cells.every(c => c < 0), "a knock is as hard as the game says it is: the flower from a petal 90 weak or medium, 210 strong");
  // dealt from the seed, shown a knock ahead
  const lone = k => knock(game(table([0, 0, 0]), undefined, { seed: k }), hex(0, 0), E).state;
  const tally = [0, 0, 0], N = 900, total = FORCE_ODDS.reduce((a, b) => a + b, 0);
  for (let k = 0; k < N; k++) tally[lone(k).force - 1]++;
  check(FORCE_ODDS.every((o, k) => Math.abs(tally[k] / N - o / total) < 0.05) && tally.every(n => n > 0), `the next knock's strength dealt as the odds say: ${tally.join(", ")} of ${N} weak, medium, strong`);
  check(lone(5).force === lone(5).force && game(table([0, 0, 0])).force === MEDIUM && lone(5).due === false, "the same seed deals the same strength; the game before the knock is left as it was");
}

// ---------- how each domino faces ----------
{
  check(axesOfCoords([[0, 0], [1, 0], [2, 0]]).join() === "0,0,0" && axesOfCoords([[0, 0], [0, 1], [0, 2]]).join() === "2,2,2" && axesOfCoords([[0, 0], [1, -1]]).join() === "1,1",
    "a line faces along itself, whichever of the three ways it lies; two beside each other face one another");
  const bend = axesOfCoords([[0, 0], [1, 0], [1, 1]]);
  check(bend[0] === 0 && bend[2] === 2 && bend.every(f => f >= 0 && f < 3), "at a bend the ends face the one beside them");
  check(new Set(CELLS.map(c => axesOfCoords([c])[0])).size === 3, "lone dominoes take a turn from where they stand, so a table of them isn't all one way");
  check(Object.values(PIECES).every(p => axesOfCoords(p.cells).length === p.cells.length && axesOfCoords(p.cells).every(f => f >= 0 && f < 3)), "every piece's dominoes face one of three ways");
  check(axesOf([hex(0, 0), hex(1, 0)]).join() === axesOfCoords([[0, 0], [1, 0]]).join(), "by hexagon number or by coordinates, the same");
  const s = game(table(), [piece("0,0;1,0", 1), piece(SINGLE, 0), piece(SINGLE, 2)], { due: false }), r = lay(s, 0, 0, 0);
  check(r.laid.every((i, k) => r.state.ax[i] === axesOf(r.laid)[k]) && r.state.ax.filter(f => f >= 0).length === 2 && s.ax.every(f => f === -1), "laying keeps how they face, with the game; no other hexagon faces anywhere");
  const k = knock(Object.assign(structuredClone(r.state), { due: true }), hex(0, 0), E);
  check(k.fell.every(([i]) => k.state.ax[i] === -1) && k.state.ax.every((f, i) => (f >= 0) === (k.state.cells[i] >= 0)), "a knock clears them with the dominoes that fell");
}

// ---------- a push, its points, the bell ----------
{
  const s = game(table([-3, 0, E, 3, 0], [-3, 1, 1])), r = knock(s, hex(-3, 0), E);
  check(r.fell.length === 3 && r.steps === 3 && r.gain === 90 && r.state.score === 90 && r.state.cells[hex(-3, 0)] === -1 && r.state.cells[hex(-3, 1)] === 1,
    "the dominoes fall and clear: ten times how many fell times the steps they took, a line of three from its end 90");
  check(knock(s, hex(-2, 0), E).gain === 40 && worth(1) === 10 && worth(10) === 1000 && worth(20, 10) === 2000, "pushed in the middle only two fall, two steps: 40; one long line beats several short ones");
  check(!r.state.due && r.state.felled === 3 && s.due && s.cells[hex(-3, 0)] === 0, "the knock made; the game knocked from left as it was");
  let threw = 0;
  try { knock(r.state, hex(-3, 1), E); } catch { threw++; }
  try { knock(s, hex(3, 3), E); } catch { threw++; }
  check(threw === 2, "no knock when none is due, nor on an empty hexagon");
  const five = game(table([-2, 0, E, 5, 0])), four = game(table([-2, 0, E, 4, 0]));
  check(knock(five, hex(-2, 0), E).gain === 250 && knock(four, hex(-2, 0), E).gain === 160 && knock(four, hex(-2, 0), W).gain === 10, "a line of five from its end 250; of four 160; pushed the wrong way, 10");
  const arc = table([-3, 0, E, 4, 0], [1, -1, NE, 3, 0]), best = longest(arc, hex(-3, 0));
  check(best.size === 7 && best.fell === 7 && best.steps === 7 && best.gain === 490 && [hex(-3, 0), hex(3, -3)].includes(best.at), "the best push on what's joined: from a far end, round the bend in seven, 490");
  check(longest(table([0, 0, 0]), hex(0, 0)).gain === 10 && longest(table(), 0).at === -1, "it tries every domino and every way: a lone domino is 10, an empty table nothing");
  const rung = knock(game(table([-2, 0, E, 4, 0]), undefined, { bell: hex(0, 0) }), hex(-2, 0), E);
  check(rung.rang && rung.gain === 320 && rung.state.rung === 1 && rung.state.bell !== hex(0, 0) && rung.state.cells[rung.state.bell] === -1, "a fall past the bell scores double (a line of four 320) and the bell moves to an empty hexagon");
  const missed = knock(game(table([-2, 0, E, 4, 0], [-1, 2, 1]), undefined, { bell: hex(-1, 2) }), hex(-2, 0), E);
  check(!missed.rang && missed.gain === 160 && missed.state.bell === hex(-1, 2) && knockOn(table([-2, 0, E, 4, 0]), hex(-2, 0), E, hex(1, 0)).rings, "a fall that doesn't pass it leaves it where it hangs");
}

// ---------- the pace of the knocks ----------
{
  const rates = [1, 2, 15, 16, 17, 30, 55, 56, 57, 500].map(rate);
  check(rates.slice(0, 4).every(v => v === 1) && rates[8] === PACE.end && rates[9] === PACE.end && rates.every((v, k) => k === 0 || v <= rates[k - 1]) && rates[5] > PACE.end && rates[5] < 1, `a knock every hand for ${PACE.from}, then fewer and fewer to ${Math.round(PACE.end * 100)} in a hundred from the ${PACE.to}th hand`);
  // hands played on a table cleared after each, so the game can't end: which hands' ends brought a knock, and what
  // untilKnock said at the start of each
  let s = newGame(3);
  const brought = [], told = [];
  for (let hand = 1; hand <= 100; hand++) {
    told[hand] = hand + untilKnock(s) - 1;
    for (let k = 0; k < HAND; k++) { const m = moves(s)[0]; s = lay(s, m.slot, m.q, m.r).state; }
    brought[hand] = s.due;
    if (s.due) s = knock(s, s.cells.findIndex(c => c >= 0), E).state;
    s.cells.fill(-1);
  }
  const dueFrom = h => { let k = h; while (!brought[k]) k++; return k; };
  check(brought.slice(1, PACE.from + 1).every(Boolean), "a knock after each of the first sixteen hands");
  const later = brought.slice(PACE.to + 1);
  check(Math.abs(later.filter(Boolean).length / later.length - PACE.end) < .1, "from the fifty-seventh hand about seven in ten");
  check(told.slice(1, 90).every((n, k) => n === dueFrom(k + 1)), "untilKnock says, at the start of a hand, which hand's end brings the knock");
  check(untilKnock(Object.assign(newGame(1), { due: true })) === 0 && untilKnock(newGame(1)) === 1, "0 when it's due, 1 after the first hand");
}

// ---------- laying, and the knock on the table's time ----------
{
  const s = game(table(), [piece("0,0;1,0", 2), piece(SINGLE, 1), piece("0,0;0,1", 0)], { due: false });
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
  const after = knock(all.state, hex(0, 0), E);
  check(!after.state.due && moves(after.state).length > 0, "made, the next hand is laid");
  const later = game(table(), [piece(SINGLE), null, null], { due: false, sets: 60, credit: 0 }), l2 = lay(later, 0, 0, 0);
  check(!l2.due && l2.state.credit === PACE.end && lay(Object.assign(structuredClone(l2.state), { hand: [piece(SINGLE), null, null] }), 0, 1, 0).due, "later a hand's end only adds seven tenths of a knock to the credit: the second brings it due");
}

// ---------- the end ----------
{
  const hole = hex(0, 0), full = new Array(SIZE).fill(0);
  full[hole] = -1;
  const hand = [piece(SINGLE, 2), piece(PAIR, 0), piece("0,0;0,1", 1)];
  const stuck = lay(game(full, hand, { due: false }), 0, 0, 0);
  check(stuck.over && stuck.state.over, "no room for any piece in hand, and no knock due: the game is over");
  const done = lay(game(full, [piece(SINGLE, 2), null, null], { due: false }), 0, 0, 0);
  check(done.dealt && done.due && !done.over, "a hand finished with the knock due isn't over, the knock may make room");
  const made = knock(done.state, 0, E);
  check(made.state.cells.filter(c => c < 0).length >= 5, "and made, there is room again");
}

// ---------- saved and opened again ----------
{
  let s = newGame(42);
  for (let k = 0; k < 9; k++) { if (s.due) { s = knock(s, s.cells.findIndex(c => c >= 0), k % 6).state; continue; } const m = moves(s)[(k * 5) % moves(s).length]; s = lay(s, m.slot, m.q, m.r).state; }
  const again = JSON.parse(JSON.stringify(s));
  const step = g => (g.due ? knock(g, g.cells.findIndex(c => c >= 0), 0) : lay(g, moves(g)[0].slot, moves(g)[0].q, moves(g)[0].r));
  check(JSON.stringify(step(s)) === JSON.stringify(step(again)), "a game saved and opened again goes on as it would have");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  // the push that scores most, as hard as the game says
  const most = s => chains(s.cells, s.bell, s.force).reduce((a, c) => (!a || c.best.gain > a.gain ? c.best : a), null);
  // the corner: every piece as near the top as it goes
  const corner = s => moves(s)[0];
  // keeping what a piece joins falling whole (at the strength the next knock will have), and room for the rest of the hand
  const careful = s => {
    let pick = null, bv = -Infinity;
    for (const m of moves(s)) {
      const h = s.hand[m.slot], sq = cover(s.cells, h.piece, m.q, m.r), cells = s.cells.slice();
      for (const k of sq) cells[k] = h.colour;
      const b = longest(cells, sq[0], s.bell, s.force);
      let room = 0;
      for (const k of s.hand) if (k && k !== h && fitsAnywhere(cells, k.piece)) room++;
      const v = b.fell * 3 - (b.size - b.fell) * 4 + room * 25;
      if (v > bv) { bv = v; pick = m; }
    }
    return pick;
  };
  // every knock made: how hard it was and how many fell; and whether the game stayed as it should
  const knocks = [], sound = { ok: true, scored: true };
  const play = (seed, choose) => {
    let s = newGame(seed), score = 0;
    while (!s.over && s.laid < 1000) {
      if (s.due) {
        const b = most(s), r = knock(s, b.at, b.dir);
        knocks.push({ force: s.force, fell: r.fell.length, gain: r.gain });
        score += r.gain;
        s = r.state;
      } else {
        const m = choose(s);
        s = lay(s, m.slot, m.q, m.r).state;
      }
      if (!s.cells.every((c, i) => (c >= 0) === (s.ax[i] >= 0 && s.ax[i] < 3)) || ![WEAK, MEDIUM, STRONG].includes(s.force)) sound.ok = false;
      if (s.score !== score) sound.scored = false;
    }
    return s.laid;
  };
  const corners = [], cares = [];
  for (let g = 0; g < 8; g++) { corners.push(play(100 + g, corner)); cares.push(play(100 + g, careful)); }
  check(median(corners) < 60, `laying every piece in the corner: over after about ${median(corners)} pieces`);
  check(median(cares) > 1.5 * median(corners) && Math.max(...cares) < 1000, `keeping lines that fall whole: about ${median(cares)} pieces, and still over in the end`);
  check(sound.ok && sound.scored, "through whole games: standing dominoes face a way and empty hexagons none, the strength is always one of three, the score is the knocks' gains");
  const mean = f => { const k = knocks.filter(x => x.force === f); return { n: k.length, fell: k.reduce((a, x) => a + x.fell, 0) / (k.length || 1) }; };
  const [w, m, st] = [WEAK, MEDIUM, STRONG].map(mean);
  check(w.n > 5 && m.n > 20 && st.n > 20 && w.fell < 0.7 * m.fell && st.fell > w.fell, `the strengths tell in careful play: a weak knock fells ${w.fell.toFixed(1)} on average, medium ${m.fell.toFixed(1)}, strong ${st.fell.toFixed(1)}`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("topple: the table, the deal, the pieces, where they fit, how dominoes fall, the strength of a push, how they face, pushes and the bell, the pace of the knocks, the end, saving, whole games");
