// Stow: the fields and their lines, the pieces (every fixed polyform counted against the known numbers), placing and
// clearing, the deals, and every level of the campaign won by replaying its solution in exactly its par; today's hold
// made twice the same way, and won. Holds in decks: their cubes and prisms counted, their lines, a piece lowered to
// the first crate it meets (bridging a gap) or not at all when it would stand out of the hatch, a clearing settling the
// hold and filling a second line, the colours moving with their crates, and deals that fit their hold.
import * as E from "../stow-engine.js";
import { CHAPTERS, LEVELS } from "../stow-levels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

// ---------- pieces: the fixed polyforms, counted ----------
const counts = (kind, n) => { const c = []; for (const p of E.polyforms(kind, n)) c[p.size - 1] = (c[p.size - 1] || 0) + 1; return c.join(","); };
check(counts("square", 5) === "1,2,6,19,63", `fixed polyominoes up to five: ${counts("square", 5)} (1, 2, 6, 19, 63)`);
check(counts("hex", 4) === "1,3,11,44", `fixed polyhexes up to four: ${counts("hex", 4)} (1, 3, 11, 44)`);
check(counts("tri", 6) === "2,3,6,14,36,94", `fixed polyiamonds up to six: ${counts("tri", 6)} (2, 3, 6, 14, 36, 94)`);
for (const kind of ["square", "hex", "tri"]) {
  const ps = E.pool(kind), ids = new Set(ps.map(p => p.id));
  const connected = ps.every(p => {
    const f = E.makeField(kind === "square" ? { kind, w: 9, h: 9 } : kind === "hex" ? { kind, radius: 5 } : { kind, size: 5 });
    const idx = E.placements(f, p)[0];
    if (!idx) return false;
    const set = new Set(idx), seen = new Set([idx[0]]), todo = [idx[0]];
    while (todo.length) { const i = todo.pop(); for (const j of f.cells[i].nb) if (set.has(j) && !seen.has(j)) { seen.add(j); todo.push(j); } }
    return seen.size === idx.length;
  });
  check(ids.size === ps.length && connected, `${kind}: ${ps.length} pieces, each one piece (connected) and different`);
}

// the cubes and prisms of a hold: every fixed polycube up to four (1, 3, 15, 86), and of hexagonal and triangular
// prisms up to three
const deep = (kind, n) => { const c = []; for (const p of E.polyforms(kind, n, true)) c[p.size - 1] = (c[p.size - 1] || 0) + 1; return c.join(","); };
check(deep("square", 4) === "1,3,15,86", `fixed polycubes up to four: ${deep("square", 4)} (1, 3, 15, 86)`);
check(deep("hex", 3) === "1,4,24" && deep("tri", 3) === "2,5,20", `prisms up to three: hexagonal ${deep("hex", 3)} (1, 4, 24), triangular ${deep("tri", 3)} (2, 5, 20)`);
{
  const spec = { kind: "square", w: 6, h: 6, decks: 4 }, ps = E.poolFor(spec), f = E.makeField(spec);
  const touching = p => p.cells.some(c => p.cells.filter(d => d.reduce((t, v, k) => t + Math.abs(v - c[k]), 0) === 1).length === 3);
  const fours = ps.filter(p => p.size === 4), flat = fours.filter(p => p.cells.every(c => c[2] === p.cells[0][2]));
  check(new Set(ps.map(p => p.id)).size === ps.length && ps.every(p => E.drops(f, p).length > 0), `a hold's ${ps.length} pieces are different, and each can be lowered into it`);
  check(flat.length === 19 && fours.filter(p => !flat.includes(p) && p.cells.some(c => c[2] !== p.cells[0][2]) && !p.cells.every(c => c[0] === p.cells[0][0] && c[1] === p.cells[0][1])).every(p => touching(p) || p.cells.every(c => c[0] === p.cells[0][0]) || p.cells.every(c => c[1] === p.cells[0][1])),
    "of four cubes it deals the 19 lying flat, the columns, the squares standing up and the corners of a cube, never a screw");
  const low = E.poolFor({ kind: "square", w: 6, h: 6, decks: 2 });
  check(low.every(p => Math.max(...p.cells.map(c => c[2])) - Math.min(...p.cells.map(c => c[2])) < 2), "a hold two decks deep deals nothing taller than two");
}

// ---------- fields and lines ----------
const fieldOf = spec => E.makeField(spec);
const linesPer = f => [...new Set(f.cellLines.map(l => l.length))].join("/");
const sq = fieldOf({ kind: "square", w: 8, h: 8 }), bays = fieldOf({ kind: "square", w: 9, h: 9, bays: 3 });
const hex = fieldOf({ kind: "hex", radius: 4 }), tri = fieldOf({ kind: "tri", size: 3 });
check(sq.n === 64 && sq.lines.length === 16 && linesPer(sq) === "2", "8×8: 64 cells, 16 lines, each cell in a row and a column");
check(bays.n === 81 && bays.lines.length === 27 && linesPer(bays) === "3", "9×9 with bays: 81 cells, 27 lines (rows, columns, 3×3 bays), each cell in three");
check(hex.n === 61 && hex.lines.length === 27 && linesPer(hex) === "3", "hexagons of radius 4: 61 cells, 27 lines in three directions, each cell in three");
check(tri.n === 54 && tri.lines.length === 18 && linesPer(tri) === "3" && E.makeField({ kind: "tri", size: 4 }).n === 96, "a hexagon of triangles: 6 × size² cells (54, 96), each in three lines");
// neighbouring triangles share an edge: two corners
const corners = c => c.pts.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`);
const shareEdge = tri.cells.every(c => c.nb.every(j => corners(c).filter(k => corners(tri.cells[j]).includes(k)).length === 2));
check(shareEdge && tri.cells.every(c => c.nb.length >= 1 && c.nb.length <= 3), "every triangle's neighbours share an edge with it");
const up = tri.cells.filter(c => E.pointsUp(c.c)).length;
check(up === tri.n / 2, "half the triangles point up, half down");

{
  const h = E.makeField({ kind: "square", w: 6, h: 6, decks: 3 }), x = E.makeField({ kind: "hex", radius: 4, decks: 2 });
  check(h.n === 108 && h.lines.length === 36 && linesPer(h) === "2" && h.cells.every(c => c.nb.length >= 3 && c.nb.length <= 6),
    "a hold of 6×6 three decks deep: 108 cells, 36 lines (each deck's rows and columns), each cell in two");
  check(x.n === 122 && x.lines.length === 54 && linesPer(x) === "3", "a hold of hexagons two decks deep: 122 cells, 54 lines, each cell in three");
}

// ---------- placing and clearing ----------
// a row filled but for its last two cells, a consignment in it; a domino fills it
const b0 = new Uint8Array(sq.n);
for (let x = 0; x < 6; x++) b0[sq.index.get(`${x},0`)] = 1;
b0[sq.index.get("2,0")] = 2;
const domino = E.pool("square").find(p => p.id === "square:0,0;1,0");
const put = E.put(sq, b0, E.placements(sq, domino).find(idx => idx[0] === sq.index.get("6,0")));
check(put.lines.length === 1 && put.marks === 1 && E.marksLeft(put.board) === 0 && [...put.board].every(v => v === 0), "filling a row clears it, its consignment with it");
const mono = E.pool("square").find(p => p.size === 1);
const cross = new Uint8Array(sq.n);
for (let x = 0; x < 8; x++) cross[sq.index.get(`${x},3`)] = 1;
for (let y = 0; y < 8; y++) cross[sq.index.get(`3,${y}`)] = 1;
cross[sq.index.get("3,3")] = 0;
const both = E.put(sq, cross, E.placements(sq, mono).find(idx => idx[0] === sq.index.get("3,3")));
check(both.lines.length === 2 && both.cleared.length === 15, "a piece filling a row and a column clears both at once");
check(!E.fits(cross, E.placements(sq, mono).find(idx => idx[0] === sq.index.get("3,4"))), "a piece doesn't fit over cargo");
const triPiece = E.pool("tri").find(p => p.size === 1 && p.cells[0].reduce((a, b) => a + b) === 1);
check(E.placements(tri, triPiece).every(idx => E.pointsUp(tri.cells[idx[0]].c)), "a triangle piece only goes where its cells point the same way");

// in a hold: a piece is lowered to the first crate it meets
{
  const f = E.makeField({ kind: "square", w: 3, h: 3, decks: 3 }), at = (x, y, z) => f.index.get(`${x},${y},${z}`);
  const piece = id => E.poolFor(f.spec).find(p => p.id === `square3:${id}`);
  const b = new Uint8Array(f.n);
  b[at(0, 0, 0)] = 1; b[at(0, 0, 1)] = 1;
  const domino = piece("0,0,0;1,0,0"), over = E.options(f, b, domino).find(idx => idx[0] === at(0, 0, 2));
  check(over && over[1] === at(1, 0, 2) && !E.options(f, b, domino).some(idx => idx[0] === at(0, 0, 0) || idx[0] === at(0, 0, 1)),
    "a piece lowered over a stack rests on it, its far end over the gap (a bridge), and can't be slid in under it");
  const bar = piece("0,0,0;0,0,1;0,0,2");
  check(!E.options(f, b, bar).some(idx => idx.some(i => f.cells[i].col === f.plan.index.get("0,0"))) && E.options(f, b, bar).length === 8,
    "a piece that would stand out of the hatch doesn't fit there");
  // a floor row filled but one; next row filled but one, its gap under a crate left by a bridge: the first clearing
  // settles that crate into the gap, and the second row goes out after it, its consignment with it
  const c = new Uint8Array(f.n), tint = new Array(f.n).fill(0);
  c[at(0, 0, 0)] = 1; c[at(1, 0, 0)] = 1; c[at(0, 1, 0)] = 2; c[at(1, 1, 0)] = 1; c[at(2, 1, 1)] = 1; c[at(1, 1, 1)] = 1;
  tint[at(2, 1, 1)] = 3; tint[at(1, 1, 1)] = 4;
  const mono = piece("0,0,0"), r = E.put(f, c, E.options(f, c, mono).find(idx => idx[0] === at(2, 0, 0)), tint, true);
  check(r.waves.length === 2 && r.waves[0].cleared.length === 3 && r.waves[0].moved.some(([a, z]) => a === at(2, 1, 1) && z === at(2, 1, 0)) && r.waves[1].cleared.includes(at(0, 1, 0)) && r.marks === 1,
    "a line cleared, the hold settles: a crate over a gap drops into it, filling a second line, which clears with its consignment");
  check(r.extra[at(1, 1, 0)] === 4 && r.board[at(1, 1, 0)] === 1 && E.marksLeft(r.board) === 0, "a crate's colour moves with it as the hold settles");
  check(!E.anyFits(f, Uint8Array.from({ length: f.n }, (_, i) => (i === at(2, 2, 2) ? 0 : 1)), [bar, domino]) && E.anyFits(f, new Uint8Array(f.n), [bar]),
    "nothing fits a full hold; anything fits an empty one");
}

// ---------- deals ----------
const lv = LEVELS[5];
const same = (a, b) => a.map(p => p.id).join() === b.map(p => p.id).join();
check(same(E.tray(lv, 3), E.tray(lv, 3)) && !same(E.tray(lv, 3, 0), E.tray(lv, 3, 1)), "a tray is the same every time it's dealt; a second player's differs");
check(LEVELS.every(l => E.tray(l, 0).every(p => l.weights[p.size - 1] > 0 && p.kind === l.field.kind && !!p.deep === !!l.field.decks)), "every level deals pieces of its field's kind and its sizes, cubes and prisms to a hold");
check(LEVELS.filter(l => l.field.decks).every(l => { const f = E.makeField(l.field); return [0, 1, 2, 3].every(n => E.tray(l, n).every(p => E.drops(f, p).some(d => d.tall < f.decks))); }), "a hold is dealt only pieces that fit it");

// ---------- the campaign ----------
check(CHAPTERS.length === 8 && LEVELS.length >= 70 && LEVELS.every((l, i) => l.id === i + 1 && CHAPTERS.some(c => c.id === l.chapter)), `${LEVELS.length} levels in ${CHAPTERS.length} chapters, numbered in order`);
check(CHAPTERS.slice(5).every(c => LEVELS.filter(l => l.chapter === c.id).every(l => l.field.decks >= 2)) && LEVELS.filter(l => l.field.decks).length >= 20, "the last three chapters are holds in decks");
const fieldsOk = LEVELS.every(l => {
  const f = E.makeField(l.field), b = E.startBoard(l, f);
  const fullLine = f.lines.some(line => [...line.cells].every(i => b[i]));
  // a hold's cargo stands on the floor or on cargo: nothing floats
  const standing = !f.decks || f.cells.every(c => !b[c.i] || c.z === 0 || b[c.i - f.n2]);
  return l.marks.length > 0 && !fullLine && standing && E.marksLeft(b) === l.marks.length && E.anyFits(f, b, E.tray(l, 0));
});
check(fieldsOk, "every level opens with consignments to clear, no line already full, nothing in a hold floating, and a first piece that fits");
const won = LEVELS.filter(l => {
  if (l.solution.length !== l.par) return false;
  const board = E.replay(l, l.solution);
  return board && E.marksLeft(board) === 0;
});
check(won.length === LEVELS.length, `every level is won by replaying its solution in its par (${won.length} of ${LEVELS.length})`);
check(LEVELS.every(l => E.starsFor(l.par, l.par) === 3 && E.starsFor(l.par + 1, l.par) === 2 && E.starsFor(l.par + 20, l.par) === 1), "stars: three at par, two a little over, one for any win");

// ---------- today's hold ----------
const t0 = Date.now();
const d1 = E.dailyLevel(20261011), took = Date.now() - t0, d2 = E.dailyLevel(20261011), d3 = E.dailyLevel(20261012);
const deckDay = [20261014, 20261015, 20261016, 20261017, 20261018].find(d => E.DAILY_RECIPES[d % E.DAILY_RECIPES.length].field.decks), dd = E.dailyLevel(deckDay), ddBoard = E.replay(dd, dd.solution);
check(dd.field.decks && dd.par > 0 && ddBoard && E.marksLeft(ddBoard) === 0, `one day in ${E.DAILY_RECIPES.length} today's hold is in decks (${deckDay}: par ${dd.par}), and it can be won`);
const strip = l => JSON.stringify({ ...l });
check(strip(d1) === strip(d2) && strip(d1) !== strip(d3), "today's hold is the same every time it's made, and tomorrow's differs");
const dBoard = E.replay(d1, d1.solution);
check(d1.par > 0 && dBoard && E.marksLeft(dBoard) === 0, `today's hold can be won, in its par of ${d1.par} (made in ${took} ms)`);

// ---------- a table of more than two (stow-room.js) ----------
// A party's request seats as many as it asked for; each seat has a hand of its own, kept by seat (s0, s1…); turns go
// round the table in seat order, passing over anyone away, and a party plays a level through with every move through
// the database's round trip. Out of room on your turn, the level is lost.
{
  const R = await import("../stow-room.js");
  const { sitDown, seatsOf } = await import("../rooms.js");
  const { roundTrip } = await import("./rtdb.js");
  const valid = g => g?.v === 1 && Array.isArray(g.board), slots = g => g?.people || 2;   // as stow.js passes them
  const P = ["Korbi", "Sarah", "Tom", "Mei", "Bo", "Ines", "Eve"].map((name, i) => ({ uid: `u${i}`, pid: `p${i}`, name }));
  const level = LEVELS[0], f = E.makeField(level.field);
  const table = people => R.freshTable(level, { u0: { name: "Korbi", pid: "p0", slot: 0, online: true } }, { app: 2, ask: people ? { people } : null, now: 9 });
  const sitAll = (t, who) => who.reduce((g, p) => (g ? sitDown(g, p, { valid, slots }) : g), t);
  const three = sitAll(table(3), P.slice(1, 3)), six = sitAll(table(6), P.slice(1, 6)), pair = sitAll(table(null), [P[1]]);
  check(seatsOf(three).length === 3 && sitDown(three, P[3], { valid, slots }) === undefined && seatsOf(six).length === 6 && sitDown(six, P[6], { valid, slots }) === undefined
    && seatsOf(pair).length === 2 && sitDown(pair, P[2], { valid, slots }) === undefined, "a party's table seats as many as asked (three, six), a pair's two");

  // hands: by seat, a seat's own deal, the first tray until one's been played; a pair's table from before kept a list
  const h4 = R.handOf(six, 4);
  check(h4.tray === 0 && h4.slots.every(Boolean) && same(R.piecesIn(six, 4), E.tray(level, 0, 4)) && !same(E.tray(level, 0, 4), E.tray(level, 0, 0)),
    "every seat has a hand of its own, dealt for its seat");
  const old = { ...pair, hands: [{ tray: 2, slots: [true, false, true] }, { tray: 1, slots: [false, true, true] }] };
  check(R.handOf(old, 1).tray === 1 && !R.handOf(old, 1).slots[0], "a pair's table from before (hands kept as a list) reads as it was");

  // turns: in seat order, passing over the away, staying put with nobody here
  const g = sitAll(table(4), P.slice(1, 4));
  check(R.seatOrder(g).join() === "0,1,2,3" && R.nextSeat(g, 1) === 2 && R.nextSeat(g, 3) === 0, "turns go round the table in seat order");
  check(R.turnNow({ ...g, turn: 1 }, [0, 1, 2, 3]) === 1 && R.turnNow({ ...g, turn: 1 }, [0, 2, 3]) === 2 && R.turnNow({ ...g, turn: 3 }, [0, 1]) === 0 && R.turnNow({ ...g, turn: 2 }, []) === 2,
    "a player who's away is passed over, to the next one here; with nobody here the turn stays where it is");
  const here = { u0: { game: "stow", online: true }, u1: { game: "stow", online: true }, u2: { game: "stow", online: false }, u3: { game: "stow", online: true } };
  const asleep = structuredClone(g);
  asleep.players.u3.online = false;
  check(R.presentSlots(asleep, here, "u0").join() === "0,1" && R.presentSlots(asleep, {}, "u2").join() === "2", "here: those with Stow open on a phone that's awake (your own seat always)");

  // a move: only on your turn, the piece in your hand, where it fits; the turn passes on, over the away
  {
    const t = structuredClone(g), pres = [0, 2, 3], hand = R.piecesIn(t, 0), k = hand.findIndex(p => p && E.options(f, Uint8Array.from(t.board), p).length);
    const idx = E.options(f, Uint8Array.from(t.board), hand[k])[0];
    check(!R.move(structuredClone(t), 1, 0, idx, pres) && !R.move(structuredClone(t), 0, k, idx.map ? idx.map(i => i + 1000) : idx, pres), "not on someone else's turn, nor where the piece doesn't go");
    check(R.move(t, 0, k, idx, pres) && t.turn === 1 && R.turnNow(t, pres) === 2 && t.used === 1 && t.hands.s0.slots[k] === false && !("s1" in t.hands),
      "a move passes the turn on (Sarah, away, passed over to Tom), the piece gone from that hand alone, kept by seat");
    const back = roundTrip(t);
    check(R.handOf(back, 0).slots[k] === false && R.handOf(back, 2).slots.every(Boolean) && !Array.isArray(back.hands), "the hands come back through the database by seat");
  }

  // out of room on your turn: lost, whoever it falls to. A checkerboard has no line near full and no two empty cells
  // side by side: a single crate fits anywhere empty, nothing bigger does.
  {
    const checker = f.cells.map(c => ((c.c[0] + c.c[1]) % 2 ? 1 : 0));
    checker[1] = 2;                                                          // a consignment still to go
    const trayWith = (seat, test) => { for (let n = 0; n < 200; n++) if (test(E.tray(level, n, seat))) return n; return -1; };
    const t0 = trayWith(0, ps => ps.some(p => p.size === 1)), t1 = trayWith(1, ps => ps.every(p => p.size > 1));
    const t = { ...structuredClone(three), board: checker, hands: { s0: { tray: t0, slots: [true, true, true] }, s1: { tray: t1, slots: [true, true, true] } } };
    const k = E.tray(level, t0, 0).findIndex(p => p.size === 1), idx = E.options(f, Uint8Array.from(checker), E.tray(level, t0, 0)[k])[0];
    check(t0 >= 0 && t1 >= 0 && R.move(t, 0, k, idx, [0, 1, 2]) && t.done?.won === false && t.done.by === 1, "a move after which the next player has nothing that fits loses the level, on their turn");
    const u = { ...structuredClone(three), board: checker, turn: 1, hands: { s1: { tray: t1, slots: [true, true, true] } } };
    check(!R.stuck(structuredClone(u), 0, [0, 1, 2]) && R.stuck(u, 1, [0, 1, 2]) && u.done.by === 1, "out of room on your own turn (come to you, or come back to), the level is lost");
    const v = { ...structuredClone(three), board: checker, turn: 1, hands: { s1: { tray: t1, slots: [true, true, true] }, s2: { tray: t0, slots: [true, true, true] } } };
    check(R.turnNow(v, [0, 2]) === 2 && !R.stuck(v, 2, [0, 2]), "while the one out of room is away, the next one here plays on");
  }

  // a party of three plays the first level through, every state through the database; Sarah's phone sleeps a while
  {
    let t = roundTrip(table(3));
    for (const p of P.slice(1, 3)) t = roundTrip(sitDown(t, p, { valid, slots }));
    const best = (g, seat) => {
      const board = Uint8Array.from(g.board);
      let top = null;
      R.piecesIn(g, seat).forEach((p, k) => {
        if (p) for (const idx of E.options(f, board, p)) {
          const r = E.put(f, board, idx), score = r.marks * 1e6 + r.cleared.length * 1e3 - idx.length;
          if (!top || score > top.score) top = { k, idx, score };
        }
      });
      return top;
    };
    const order = [];
    let legal = true, steps = 0;
    while (!t.done && steps < 150) {
      const pres = steps >= 1 && steps < 4 ? [0, 2] : [0, 1, 2];              // Sarah away for three turns
      const seat = R.turnNow(t, pres), m = best(t, seat), cur = structuredClone(t);
      if (!m || !R.move(cur, seat, m.k, m.idx, pres)) { legal = false; break; }
      order.push(seat);
      t = roundTrip(cur);
      steps++;
    }
    check(legal && t.done?.won === true && t.used === steps, `three play the first level through and win it, together (${steps} pieces), every move through the database`);
    check(order.slice(0, 5).join("") === "02020" && order.slice(5, 8).join("") === "120", `turns round the table, Sarah passed over while away and back in her turn after (${order.join("")})`);
    check(Object.keys(t.hands).every(k => /^s[0-2]$/.test(k)) && Array.isArray(t.board) && t.board.length === f.n && t.people === 3, "the hands kept by seat, the hold whole");
  }
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("stow: fields, holds, pieces, clearing and settling, deals, every level and today's hold, and a table of three");
