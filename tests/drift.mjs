// Drift's rules (drift-engine.js on the quays of drift-shapes.js, the levels of drift-levels.js): the shapes, the deal
// from a seed, the wind on a quay of any shape (a slide stops at water and rocks, a line is broken by them), the turn,
// every event (squall, rock, rogue wave, second gust, fog, moored and sealed crates), the orders, a game saved and opened
// again, a game of the old square field made into the new, and the simple players clearing the early levels.
import { SHAPES, SHAPE_IDS } from "../drift-shapes.js";
import { EMPTY, WATER, QUEUE, MOORED, SEALED, rules, newGame, upgrade, blow, shove, lineRuns, lines, gale, lay, moves, room, filled, worth, stars, foggy, validate, geo } from "../drift-engine.js";
import { SECTIONS, LEVELS, levelRules, openRules } from "../drift-levels.js";
import { play } from "../drift-bots.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
/** A quay drawn by hand, "#" quay and "." water, made known as `id`. */
const quay = (id, rows) => { SHAPES[id] = { id, name: id, rows, w: rows[0].length, h: rows.length, open: rows.flatMap(r => [...r].map(c => c === "#")) }; return SHAPES[id]; };
/** A quay with crates on it: "." empty, "0"-"3" a crate, "~" water or rock; rows not given empty. */
const field = (id, rows) => { const s = SHAPES[id]; return s.open.map((o, i) => { const ch = rows[Math.floor(i / s.w)]?.[i % s.w]; return !o ? WATER : ch === "~" ? WATER : ch === undefined || ch === "." ? EMPTY : Number(ch); }); };
const row = (id, c, y) => { const s = SHAPES[id]; return [...Array(s.w).keys()].map(x => (c[y * s.w + x] === WATER ? "~" : c[y * s.w + x] < 0 ? "." : c[y * s.w + x])).join(""); };
quay("t7", ["#######", "#######", "#######", "#######", "#######", "#######", "#######"]);
quay("t-wet", ["###.###", "#######", ".#####."]);
const game = (rs, id, rows, extra = {}) => Object.assign(newGame(rs, 1), { cells: field(id, rows), strays: [], reef: -1, ...extra }, { next: newGame(rs, 1).next.map((n, k) => (k ? n : { c: 0, k: 0 })) });
const plan = (rs, s, ps) => { s.plan = ps.map(p => (typeof p === "number" ? { w: p } : p)); while (s.plan.length < QUEUE) s.plan.push({ w: 1 }); return s; };
const base = rules({ shape: "t7", start: 0 });
const T = (rs, s, i, winds) => lay(rs, plan(rs, s, winds), i);

// ---------- the shapes ----------
{
  const real = SHAPE_IDS.map(id => SHAPES[id]);
  check(real.every(s => s.open.length === s.w * s.h && s.rows.every(r => r.length === s.w)) && SHAPE_IDS.includes("hull") && SHAPE_IDS.length >= 5, "quays are masks on a grid: a ship's hull, a pier, a basin, a figure of eight, a lagoon, the open quay");
  const connected = s => {
    const seen = new Set(), todo = [s.open.indexOf(true)];
    while (todo.length) { const i = todo.pop(); if (seen.has(i) || !s.open[i]) continue; seen.add(i); const x = i % s.w, y = Math.floor(i / s.w); if (x) todo.push(i - 1); if (x < s.w - 1) todo.push(i + 1); if (y) todo.push(i - s.w); if (y < s.h - 1) todo.push(i + s.w); }
    return seen.size === s.open.filter(Boolean).length;
  };
  check(real.every(connected) && real.every(s => s.open.filter(Boolean).length >= 25 && s.w <= 9 && s.h <= 9), "each is one piece of quay, large enough to play and small enough to draw");
  const hull = SHAPES.hull;
  check(hull.rows[0].match(/#/g).length === 1 && hull.rows[4].match(/#/g).length === 7 && hull.rows[8].match(/#/g).length < 7, "the hull has a pointed bow, its widest in the middle and a narrowing stern");
}

// ---------- the deal ----------
{
  const rs = levelRules(LEVELS[1]), a = newGame(rs, 7), b = newGame(rs, 7), c = newGame(rs, 8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.cells) !== JSON.stringify(c.cells), "the same seed deals the same quay, another seed another");
  check(a.cells.every((x, i) => SHAPES[a.shape].open[i] || x === WATER) && a.cells.filter(x => x >= 0).length === rs.start && lines(a.shape, a.cells).length === 0, "the crates lie on quay only, none in a line");
  check(a.next.length === QUEUE && a.plan.length === QUEUE && a.plan.every(p => p.w >= 0 && p.w < 4), `the next ${QUEUE} crates and winds are dealt`);
  const open = openRules("hull"), o = newGame(open, 3);
  check(o.shape === "hull" && o.next[5 % QUEUE]?.k !== undefined && o.next.every(n => n.k === 0 || n.k === 1), "open sail has the hull, and moored crates in its queue");
}

// ---------- the wind on a quay ----------
{
  const c = field("t7", [".0.1..2"]);
  check(row("t7", blow("t7", c, 1).cells, 0) === "....012" && row("t7", blow("t7", c, 3).cells, 0) === "012....", "east or west, every crate slides to the edge or the next crate, keeping its order");
  const down = field("t7", ["3", ".", "2"]), s = blow("t7", down, 2).cells, u = blow("t7", down, 0).cells;
  check(s[6 * 7] === 2 && s[5 * 7] === 3 && u[0] === 3 && u[7] === 2, "and south or north, down the columns");
  const wet = field("t-wet", ["0.....0", "1......"]);
  // row 0 is ###.### : water in the middle, so each side has its own segment
  const e = blow("t-wet", wet, 1).cells, w = blow("t-wet", wet, 3).cells;
  check(row("t-wet", e, 0) === "..0~..0" && row("t-wet", w, 0) === "0..~0..", "a slide stops at the water: crates either side of an inlet do not cross it");
  check(row("t-wet", e, 1) === "......1", "and a row without water slides the whole way");
  const hull = SHAPES.hull, cells = hull.open.map(o => (o ? EMPTY : WATER));
  cells[1 * hull.w + 2] = 1;
  check(blow("hull", cells, 0).cells[1 * hull.w + 3] === EMPTY && blow("hull", cells, 0).cells[2 * hull.w + 2] === EMPTY, "in the hull a crate blown north stops where the quay ends, at the bow's shoulder");
  const g = geo("t-wet", wet);
  check(g.h.length === 4 && g.v.some(l => l.length === 2), "the quay is cut into stretches at the water, along and across");
}
{
  // lines run over quay only: three in a row either side of water are not a line
  check(lines("t7", field("t7", ["00", "00"])).length === 0, "two by two is no line");
  quay("t-bar", ["#####", ".#.#."]);
  check(lines("t-bar", field("t-bar", ["00000", ".1.1."])).length === 5 && lineRuns("t-bar", field("t-bar", ["00000"])).get(0) === 5, "a line of five is five crates, the longest run through each");
  quay("t-split", ["##.##"]);
  check(lines("t-split", field("t-split", ["00~00"])).length === 0, "water between breaks a line");
  quay("t-rock", ["#####"]);
  check(lines("t-rock", field("t-rock", ["00~00"])).length === 0 && lines("t-rock", field("t-rock", ["000~0"])).join() === "0,1,2", "so does a rock; three either side of it ship");
}

// ---------- a turn ----------
{
  const s = game(base, "t7", ["00....."]), r = T(base, s, 6, [3, 2, 0]);
  check(r.gusts[0].cleared.length === 3 && r.gain === worth(3) && r.state.score === 90 && row("t7", r.state.cells, 0) === ".......", "laid at the far end, the west wind brings it up to the other two: three in a row ship, 90");
  const none = T(base, game(base, "t7", ["00....."]), 24, [1, 1, 1]);
  check(none.gain === 0 && none.gusts.length === 1, "lines count after the wind: laid where the wind takes it elsewhere, it makes nothing");
  const chain = T(base, game(base, "t7", ["3...00.", "......3", "......3"]), 6, [1, 1, 1]);
  check(chain.gusts.length === 3 && chain.gain === worth(6), "a shipment, and the wind blows again, which can line up more: all of a turn's count together, 360");
  check(s.cells[6] === EMPTY && s.turns === 0, "the game laid on is left as it was");
  check(r.state.turns === 1 && r.state.next.length === QUEUE && r.state.plan.length === QUEUE, "the queue moves on a turn and stays five long");
  let threw = 0;
  try { lay(base, s, 0); } catch { threw++; }
  try { lay(base, Object.assign(structuredClone(s), { status: "won" }), 40); } catch { threw++; }
  const water = game(rules({ shape: "t-wet", start: 0 }), "t-wet", []);
  try { lay(rules({ shape: "t-wet", start: 0 }), water, 3); } catch { threw++; }
  check(threw === 3 && moves(s).length === 47, "a crate goes on an empty square of quay: not on another crate, not on water, not once it's over");
  check(worth(3) === 90 && worth(6) === 360, "ten times the square of all a turn ships");
}

// ---------- moored crates ----------
{
  const c = field("t7", [".0.1..2"]), at3 = [3];
  check(row("t7", blow("t7", c, 1, at3).cells, 0) === "..01..2" && row("t7", blow("t7", c, 3, at3).cells, 0) === "0..12..", "a moored crate stays put, and the wind piles the crates upwind of it against it, as against an edge");
  const s = game(base, "t7", ["......."]);
  s.next[0] = { c: 2, k: MOORED };
  const r = T(base, s, 5, [3, 1, 1]);
  check(r.state.stakes.join() === "5" && r.state.cells[5] === 2, "a moored crate stays where it's laid, even with the wind");
  const t = game(base, "t7", ["22....."]);
  t.next[0] = { c: 2, k: MOORED };
  const u = T(base, t, 2, [3, 1, 1]);
  check(u.gain === 90 && u.state.stakes.length === 0, "and ships in a line like any crate, its mooring going with it");
}

// ---------- squalls ----------
{
  const sq = rules({ shape: "t7", start: 0, squall: { every: 3, count: 2 } }), s0 = newGame(sq, 5);
  check(s0.plan[2].squall === 2 && !s0.plan[0].squall && s0.strays.length === 0, "the third turn brings a squall of two, and the queue shows it ahead");
  // forecast through a move that arrives at a squall turn: the strays are in the state before the crate is laid
  let g = newGame(sq, 9);
  for (let k = 0; k < 2; k++) g = lay(sq, g, moves(g)[0]).state;
  check(g.plan[0].squall === 2 && g.strays.length === 2, "a squall is forecast the turn before it comes: its strays on empty squares");
  const coming = new Set(g.strays.map(q => q.at));
  check(g.strays.every(q => g.cells[q.at] === EMPTY && q.colour >= 0) && !moves(g).some(m => coming.has(m)) && coming.size === 2, "and no crate can be laid where one is coming");
  let threw = false;
  try { lay(sq, g, g.strays[0].at); } catch { threw = true; }
  const m = moves(g)[0], r = lay(sq, g, m), cells = g.cells.slice();
  cells[m] = g.next[0].c;
  for (const q of g.strays) cells[q.at] = q.colour;
  check(threw && r.squall.length === 2 && JSON.stringify(gale("t7", cells, g.plan[0].w, g.stakes).cells) === JSON.stringify(r.state.cells), "laid there, refused; the strays land where forecast, before the wind, so the turn shown beforehand is the turn played");
  const two = Array.from({ length: 7 }, (_, y) => [...Array(7).keys()].map(x => ((x + 2 * y) % 4)).join(""));
  two[0] = `..${two[0].slice(2)}`;
  // two empty squares, and a squall due the turn after this one: it may stray on one square at most, the last stays free
  const probe = Object.assign(newGame(sq, 6), { cells: field("t7", two) });
  probe.plan = [{ w: 1 }, { w: 1, squall: 3 }, { w: 1 }, { w: 1 }, { w: 1 }];
  const turned = lay(sq, probe, 0).state;
  check(turned.strays.length <= Math.max(0, room(turned) - 1) && (turned.status === "lost" || moves(turned).length >= 1), "never on the last empty square: a crate can always be laid");
}

// ---------- rocks ----------
{
  const rk = rules({ shape: "t7", start: 0, rock: { p: 1, max: 2 } }), s0 = newGame(rk, 3);
  check(s0.plan.some(p => p.rock) && s0.plan.filter(p => p.rock).length <= 2, "a rock is forecast in the queue, never more than the level's most at once");
  let g = newGame(rk, 3);
  while (!g.plan[0].rock && g.status === "play") g = lay(rk, g, moves(g)[0]).state;
  check(g.reef >= 0 && g.cells[g.reef] === EMPTY && !moves(g).includes(g.reef), "a rock is forecast on an empty square the turn before it rises, and no crate can be laid there");
  const reef = g.reef, r = lay(rk, g, moves(g)[0]);
  check(r.reef === reef && r.state.cells[reef] === WATER && r.state.rocks.includes(reef), "it rises there, and the square is rock from then on");
  check(row("t7", blow("t7", field("t7", ["0.~.0.."]), 1).cells, 0) === ".0~...0", "a slide stops at a rock: east of it crates go to the edge, west of it to the rock");
}

// ---------- rogue waves ----------
{
  const c = field("t7", [".0.1..2"]);
  const e = shove("t7", c, { axis: 0, at: 0, dir: 1 });
  check(row("t7", e.cells, 0) === "..0.1.2" && e.moved.length === 2, "a wave east shoves a row one square: each crate with room beyond it moves, the one at the edge stays");
  const packed = shove("t7", field("t7", ["012...."]), { axis: 0, at: 0, dir: 1 });
  check(row("t7", packed.cells, 0) === ".012...", "a packed row moves together, the leading crate first");
  const wall = shove("t7", field("t7", ["0.1...."]), { axis: 0, at: 0, dir: -1 });
  check(row("t7", wall.cells, 0) === "01....." && wall.moved.map(m => m.join(">")).join() === "2>1", "west: the crate at the edge stays, the other moves");
  const col = shove("t7", field("t7", ["0", "1", "."]), { axis: 1, at: 0, dir: 1 });
  check(col.cells[7] === 0 && col.cells[14] === 1 && col.cells[0] === EMPTY, "a column wave shoves south");
  const moored = shove("t7", field("t7", ["0.1...."]), { axis: 0, at: 0, dir: 1 }, [0]);
  check(row("t7", moored.cells, 0) === "0..1..." , "a moored crate does not move");
  const rs = rules({ shape: "t7", start: 0, wave: { p: 1 } });
  let g = newGame(rs, 2);
  const w = g.plan[0].wave;
  check(w && (w.axis === 0 || w.axis === 1) && Math.abs(w.dir) === 1 && w.at >= 0 && w.at < 7, "the queue says which row or column, and which way");
  const r = lay(rs, g, 24);
  check(r.wave && r.wave.moved.every(([f, t]) => Math.abs(f - t) === (w.axis === 0 ? 1 : 7)), "the turn is the wave, then the wind");
}

// ---------- a second gust ----------
{
  const rs = rules({ shape: "t7", start: 0, gust: { p: 1 } }), g = newGame(rs, 4);
  check(g.plan.every(p => p.w2 != null && p.w2 !== p.w), "a gust turn has a second wind, from another quarter");
  const s = game(base, "t7", ["0.....1"]);
  const r = T(base, s, 24, [{ w: 3, w2: 1 }, 1, 1]);
  check(r.winds.join() === "3,1" && r.gusts.map(x => x.wind).join() === "3,1", "the first wind settles, then the second blows");
  check(row("t7", r.state.cells, 0) === ".....01", "west then east: the crates end against the east edge, in their order");
}

// ---------- fog ----------
{
  const rs = rules({ shape: "t7", start: 0, fog: { p: 1 } }), g = newGame(rs, 4);
  check(g.plan.every(p => p.fog) && foggy(g) && !foggy(newGame(base, 4)), "fog is in the plan, and the page hides what follows the turn");
}

// ---------- the harbour master's seal ----------
{
  const rs = rules({ shape: "t7", start: 0, seal: 4 }), g = game(rs, "t7", ["0.1..0.", "..0...1", "......."]);
  g.next[0] = { c: 0, k: SEALED };
  const r = T(rs, g, 42, [1, 1, 1]);
  check(r.sealed === 0 && r.by[0] === 4 && r.state.cells.every(c => c !== 0) && r.state.cells.filter(c => c === 1).length === 2, "a sealed crate ships every crate of its good, and only that");
  check(r.gain === worth(4) && r.state.shipped[0] === 4 && r.gusts.some(x => x.sealed), "all of them count for the orders and score");
  const od = rules({ shape: "t7", start: 0, orders: [4, 0, 0, 0], runs: [4, 0, 0, 0], turns: 5 });
  const q = game(od, "t7", ["0.1..0.", "..0...1"]);
  q.next[0] = { c: 0, k: SEALED };
  check(T(od, q, 42, [1, 1, 1]).state.status === "won", "even for a good whose order needs long lines, a seal's crates count in full");
  check(newGame(rs, 1).next[3].k === SEALED && newGame(rs, 1).next[0].k === 0, "every fourth crate is sealed");
}

// ---------- orders ----------
{
  const od = rules({ shape: "t7", start: 0, orders: [3, 0, 0, 0], turns: 3 }), g = game(od, "t7", ["00....."]);
  g.next[0] = { c: 0, k: 0 };
  const w = T(od, g, 6, [3, 1, 1]);
  check(w.state.status === "won" && stars(od, w.state) >= 1, "filling the orders wins");
  const l = lay(od, Object.assign(game(od, "t7", []), { turns: 2 }), 0);
  check(l.state.status === "lost" && /unfilled/.test(l.state.why), "running out of turns loses");
  const long = rules({ shape: "t7", start: 0, orders: [0, 0, 3, 0], runs: [0, 0, 4, 0], turns: 9 }), h = game(long, "t7", ["22....."]);
  h.next[0] = { c: 2, k: 0 };
  const three = T(long, h, 6, [3, 1, 1]);
  check(three.state.shipped[2] === 0 && three.by[2] === 3 && three.ok[2] === 0, "a line of three does not count for an order of lines of four: spent, and no use");
  check(stars({ turns: 30 }, { status: "won", turns: 20 }) === 3 && stars({ turns: 30 }, { status: "won", turns: 29 }) === 1 && stars({ turns: 30 }, { status: "lost", turns: 29 }) === 0, "stars for turns to spare");
  const full = Array.from({ length: 7 }, (_, y) => [...Array(7).keys()].map(x => ((x + 2 * y) % 4)).join(""));
  full[0] = `.${full[0].slice(1)}`;
  const e = lay(rules({ shape: "t7", start: 0 }), game(rules({ shape: "t7", start: 0 }), "t7", full), 0);
  check(e.state.status === "lost" && /full/.test(e.state.why), "no room left after the wind: lost");
}

// ---------- the levels ----------
{
  const order = ["moor", "squall", "gust", "wave", "fog", "rock", "seal"];
  const has = l => ({ moor: l.moor, squall: l.squall, gust: l.gust, wave: l.wave, fog: l.fog, rock: l.rock, seal: l.seal });
  check(SECTIONS.length === 8 && LEVELS.length === 16 && new Set(LEVELS.map(l => l.id)).size === 16, "eight sections, sixteen levels, each id its own");
  check(SECTIONS.every((sec, k) => sec.event === (k === 0 ? null : order[k - 1])), "one event is introduced to a section, in order: moorings, squalls, crosswinds, waves, fog, reefs, the harbour master");
  const late = LEVELS.filter(l => order.some((ev, k) => has(l)[ev] && k + 2 > l.section));
  check(!late.length, `no level has an event before its section introduces it${late.length ? ": " + late.map(l => l.id).join() : ""}`);
  check(LEVELS.every(l => !validate(levelRules(l)).length) && new Set(LEVELS.map(l => l.shape)).size >= 5, `every level is valid, on at least five different quays (${[...new Set(LEVELS.map(l => l.shape))].join(", ")})`);
  check(LEVELS.every(l => SECTIONS.find(s => s.id === l.section).levels.some(x => x.id === l.id)) && LEVELS.every(l => l.note && l.name), "each has a name and a note");
  const evs = LEVELS.filter(l => l.section === 8).length;
  check(evs === 2 && openRules("hull").shape === "hull" && openRules("nonsense").shape === "quay", "open sail takes the quay chosen");
}

// ---------- saved and opened again ----------
{
  const rs = levelRules(LEVELS[12]);
  let s = newGame(rs, 42);
  for (let k = 0; k < 9 && s.status === "play"; k++) s = lay(rs, s, moves(s)[(k * 7) % moves(s).length]).state;
  const again = JSON.parse(JSON.stringify(s)), m = moves(s)[3];
  check(JSON.stringify(lay(rs, s, m)) === JSON.stringify(lay(rs, again, m)) && upgrade(rs, again) === again, "a game saved and opened again goes on as it would have (a v2 game is left as it is)");
  const old = { v: 1, seed: 11, n: 40, cells: new Array(49).fill(-1), stakes: [], next: [1, 2], winds: [1, 2, 3], turns: 5, untilSquall: 2, strays: [], untilStake: 0, score: 120, over: false };
  old.cells[10] = 2; old.cells[11] = 2; old.cells[30] = 0;
  const up = upgrade(openRules("quay"), old);
  check(up.v === 2 && up.shape === "quay" && up.cells.join() === old.cells.join() && up.score === 120 && up.turns === 5 && up.next.length === QUEUE && up.plan.length === QUEUE && up.plan.slice(0, 3).map(p => p.w).join() === "1,2,3", "a game of the old square field is made into an open-sail game on the quay, where it was");
  check(up.next[0].c === 1 && up.next[1].c === 2 && up.plan[1].squall > 0 && lay(openRules("quay"), up, moves(up)[0]).state.turns === 6, "its crates and its squall come on as they were, and it plays on");
  check(up.next[0].k === MOORED && up.next[1].k === 0, "and the sixth crate's mooring comes when it did");
}

// ---------- whole games by simple players ----------
{
  const win = (l, bot, n) => { let w = 0; for (let sd = 1; sd <= n; sd++) if (play(levelRules(LEVELS.find(x => x.id === l)), sd, bot).status === "won") w++; return w / n; };
  const p11 = win("1-1", "planner", 10), r11 = win("1-1", "random", 10), p12 = win("1-2", "planner", 10), r21 = win("2-1", "random", 10), p21 = win("2-1", "planner", 10);
  check(p11 >= 0.5 && p12 >= 0.5 && p21 >= 0.5, `the planner clears the early levels (1-1 ${p11 * 100}%, 1-2 ${p12 * 100}%, 2-1 ${p21 * 100}%)`);
  check(r11 <= p11 && r21 <= 0.3 && win("2-2", "random", 10) <= 0.3, `laying anywhere clears fewer (1-1 ${r11 * 100}%, 2-1 ${r21 * 100}%)`);
  const open = openRules("hull");
  let turns = [], anywhere = [];
  for (let sd = 1; sd <= 4; sd++) { const s = play(open, sd, "random", 400); anywhere.push(s.turns); }
  check(anywhere.every(t => t < 150), `open sail on the hull: laying anywhere fills the quay in about ${anywhere.join(", ")} turns`);
  const g = play(openRules("quay"), 3, "greedy", 300);
  check(g.turns > Math.max(...anywhere) * 0.5 && g.score > 0, `laying for the wind lasts longer (${g.turns} turns, ${g.score} points)`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("drift: the shapes, the deal, the wind, lines, a turn, every event, the orders, the levels, saving, whole games");
