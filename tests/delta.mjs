// Delta boards: every level deals boards; each has exactly one drawable way of pairing the numbers and sharing
// out the operations, it is the one the board was built from, and the arithmetic alone allows ones the space
// rules out. At a table (delta-room.js): a party's request seats as many as it asked for, paths keep who drew them
// (a cut path stays its drawer's), the paths under the others' fingers show only for those here, and a party of three
// solves a board together with every move through the database's round trip. Run: node tests/delta.mjs
const G = await import("../delta-gen.js");
const R = await import("../delta-room.js");
const { sitDown, seatsOf } = await import("../rooms.js");
const { roundTrip, same } = await import("./rtdb.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- at a table ----------
{
  const board = G.generate(31337, "medium"), valid = g => !!g?.board, slots = g => g?.people || 2;   // as delta.js passes them
  const P = ["Korbi", "Sarah", "Tom", "Mei", "Bo", "Ines", "Eve"].map((name, i) => ({ uid: `u${i}`, pid: `p${i}`, name }));
  const seat = (p, slot) => ({ [p.uid]: { name: p.name, slot, pid: p.pid, online: true } });
  const table = people => R.freshTable(seat(P[0], 0), { app: 2, level: "medium", seed: 31337, board, ask: people ? { people } : null, now: 5 });
  const sitAll = (t, who) => who.reduce((g, p) => (g ? sitDown(g, p, { valid, slots }) : g), t);
  const three = sitAll(table(3), P.slice(1, 3)), six = sitAll(table(6), P.slice(1, 6)), pair = sitAll(table(null), [P[1]]);
  check(seatsOf(three).length === 3 && sitDown(three, P[3], { valid, slots }) === undefined && seatsOf(six).length === 6 && sitDown(six, P[6], { valid, slots }) === undefined,
    "a party's table seats as many as the request asked for (three, six), no more");
  check(seatsOf(pair).length === 2 && sitDown(pair, P[2], { valid, slots }) === undefined && R.peopleOf({ people: 12 }) === 6 && R.peopleOf(undefined) === 2, "a pair's seats two; a request keeps two to six");

  // paths keep who drew them; a path cut by another's stays its drawer's; solo paths carry no one
  const a = board.sol.find(p => p.cells.length >= 3), b = board.sol.find(p => p !== a);
  const cut = R.pathList(R.withPath(R.withPath({}, "x", null, a.cells, "u0"), "y", null, [b.cells[0], a.cells[2]], "u1"));
  const x = cut.find(p => p.id === "x"), y = cut.find(p => p.id === "y");
  check(x?.by === "u0" && x.cells.join() === a.cells.slice(0, 2).join() && y?.by === "u1", "a path cut by another's keeps the part before, and its drawer");
  check(!("by" in R.withPath({}, "z", null, a.cells).z), "a solo path names nobody");
  check(same(R.drawnBy(R.withPath(R.withPath({}, "x", null, a.cells, "u0"), "y", null, b.cells, "u1")), { u0: 1, u1: 1 }), "paths are counted by their drawers");

  // who's here, and what they're drawing
  const g = structuredClone(three);
  g.players.u1.draw = a.cells.join(";");
  g.players.u2.draw = b.cells.join(";");
  const here = { u0: { game: "delta", online: true, pid: "p0" }, u1: { game: "delta", online: true, pid: "p1" }, u2: { game: "delta", online: true, pid: "p2" } };
  check(R.drawingsOf(g, here, "u0", "p0").map(d => d.slot).join() === "1,2", "you see the paths the others are drawing");
  g.players.u2.online = false;
  check(R.drawingsOf(g, here, "u0", "p0").map(d => d.slot).join() === "1" && R.presentSlots(g, here, "u0").join() === "0,1", "but not a sleeping phone's");
  check(R.presentSlots(g, { ...here, u1: { ...here.u1, game: "stow" } }, "u0").join() === "0" && R.presentSlots(g, {}, "u2").join() === "2", "nor someone in another game; your own seat is always here");

  // a party of three solves the board, a pair's path each, every move through the database
  let t = roundTrip(table(3));
  for (const p of P.slice(1, 3)) t = roundTrip(sitDown(t, p, { valid, slots }));
  const act = change => { const cur = structuredClone(t); cur.paths ||= {}; cur.clues = Object.values(cur.clues || {}); change(cur); t = roundTrip(cur); };
  act(cur => { cur.players.u1.draw = board.sol[0].cells.slice(0, 2).join(";"); });
  act(cur => { cur.clues.push(1); });
  board.sol.forEach((p, i) => act(cur => { cur.paths = R.withPath(cur.paths, `p${i}`, null, p.cells, P[i % 3].uid); delete cur.players[P[i % 3].uid].draw; }));
  const back = R.pathList(t.paths);
  check(seatsOf(t).length === 3 && t.people === 3 && Object.values(t.clues).join() === "1", "three seated, the clue kept, through the database");
  check(G.isSolved(t.board, back.map(p => p.cells)) && back.every(p => p.by === P[Number(p.id.slice(1)) % 3].uid), "the board is solved from what came back, each path its drawer's");
  check(seatsOf(t).every(([, p]) => p.draw === undefined) && same(t.board, board), "no path left under a finger, and the board itself whole");
}

const pairing = s => s.map(x => [x.from, x.to].sort().join("~")).sort().join("|");
for (const lvl of Object.keys(G.LEVELS)) {
  let made = 0, ms = 0, worst = 0;
  for (let seed = 1; seed <= 15; seed++) {
    const t = Date.now(), b = G.generate(seed * 7919, lvl), d = Date.now() - t;
    ms += d; worst = Math.max(worst, d);
    if (!b) { bad++; console.log(`${lvl} seed ${seed}: no board`); continue; }
    made++;
    const { solutions, opKeys } = G.arithmeticSolutions(b, 100);
    const drawable = solutions.filter(s => { const r = G.routeAll(b, opKeys, s); return r && r !== "unknown"; });
    const intended = pairing(b.sol);
    if (drawable.length !== 1 || pairing(drawable[0]) !== intended) { bad++; console.log(`${lvl} seed ${seed}: ${drawable.length} drawable answers`); }
    if (!G.isSolved(b, b.sol.map(p => p.cells))) { bad++; console.log(`${lvl} seed ${seed}: its own solution doesn't check out`); }
    if (solutions.length - drawable.length < G.LEVELS[lvl].decoys) { bad++; console.log(`${lvl} seed ${seed}: too few ruled-out pairings`); }
  }
  console.log(`${lvl}: ${made}/15 boards, average ${Math.round(ms / 15)} ms, slowest ${worst} ms`);
}
console.log(bad ? `${bad} problems` : "all boards check out");
if (bad) process.exitCode = 1;
