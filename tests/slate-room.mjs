// Slate at a table (slate-room.js): a party's request seats as many as it asked for (two to six, sitDown's slots), a
// pair's two; either kind of request (the party's glyph, the pair's slate) deals a new table, sat at by the others;
// a player's other device gets their seat back, their letters with it. Each letter is its placer's while it stays the
// same; who's at the table now (a sleeping phone isn't); where the others' cursors are. And a party of six fills a
// board together, every move through the database's round trip, the state whole at the end and the board solved.
// Run: node tests/slate-room.mjs
import { sitDown, seatsOf } from "../rooms.js";
import { generate, gridOf, rowsOf, lettersFrom, isSolved } from "../slate-gen.js";
import { MOST, peopleOf, seatsFor, askedFor, freshTable, logOf, ownersFrom, placedBy, presentSlots, cursorsOf, storable } from "../slate-room.js";
import { roundTrip, same } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const valid = g => !!g?.board;
const slots = g => g?.people || 2;                        // as slate.js passes it to sitDown
const board = generate(4242, "easy"), grid = gridOf(rowsOf(board));
const NAMES = ["Korbi", "Sarah", "Tom", "Mei", "Bo", "Ines", "Eve"];
const P = NAMES.map((name, i) => ({ uid: `u${i}`, pid: `p${i}`, name }));
const seat = (p, slot) => ({ [p.uid]: { name: p.name, slot, pid: p.pid, online: true } });
const table = (people, extra = {}) => freshTable(seat(P[0], 0), { app: 5, seed: 4242, level: "easy", board, ask: people ? { people } : null, now: 1000, ...extra });
const sitAll = (t, who) => who.reduce((g, p) => (g ? sitDown(g, p, { valid, slots }) : g), t);

// ---------- how many sit down ----------
check(peopleOf({ people: 3 }) === 3 && peopleOf({ people: 9 }) === MOST && peopleOf({ people: 1 }) === 2 && peopleOf(null) === 2 && peopleOf({ people: "x" }) === 2,
  "a request keeps seats for two to six (a pair's request, saying nothing, two)");
const three = sitAll(table(3), P.slice(1, 3));
check(seatsOf(three).map(([, p]) => p.slot).sort().join() === "0,1,2" && sitDown(three, P[3], { valid, slots }) === undefined, "a party of three seats three, and turns a fourth away");
const six = sitAll(table(6), P.slice(1, 6));
check(seatsOf(six).length === 6 && sitDown(six, P[6], { valid, slots }) === undefined, "a party of six seats six, and no seventh");
const pair = sitAll(table(null), [P[1]]);
check(seatsFor(pair) === 2 && seatsOf(pair).length === 2 && sitDown(pair, P[2], { valid, slots }) === undefined, "a pair's table seats two");
check(seatsFor({ board, players: {} }) === 2, "a table from before parties seats two");

// ---------- requests ----------
const party = { game: "glyph", at: 77, answer: "yes", people: 3 }, partner = { game: "slate", at: 88, answer: "yes", from: "p1" };
check(askedFor(party, 77) === 77 && askedFor(partner, 88) === 88, "a party's request (its branch, glyph) and the pair's (the game's name, slate) are both Slate's");
check(askedFor(party, 78) === null && askedFor({ ...party, answer: null }, 77) === null && askedFor({ ...party, game: "delta" }, 77) === null && askedFor(party, 0) === null,
  "not another request, one not said yes to, another game's, or none in the address");
// whoever arrives first for a request deals over the table there; the others sit down at it
const old = { ...six, asked: 5, log: [{ slot: 0, word: "XXX", by: "u0" }] };
const dealt = table(3, { asked: 77, seed: 99 });
const first = sitDown(old, P[0], { initial: dealt, asked: 77, valid, slots });
check(first === dealt && first.people === 3 && !first.log.length, "the first to come for a party's request deals a new table for three over the old one");
const next = sitDown(first, P[2], { initial: table(3, { asked: 77, seed: 123 }), asked: 77, valid, slots });
check(next.seed === 99 && next.players.u2.slot === 1, "the next sits down at it, nothing dealt over it");
check(sitDown(next, P[1], { valid, slots }).players.u1.slot === 2, "a third person takes the third seat");

// ---------- a player's other device ----------
const played = { ...three, log: [{ slot: 0, word: "ABC", by: "u1" }, { check: { v: 2, at: 0, out: {} }, by: "u1" }] };
const ipad = sitDown(played, { uid: "u1b", pid: "p1", name: "Sarah" }, { valid, slots });
check(ipad.players.u1b?.slot === 1 && !ipad.players.u1 && ipad.log.every(e => e.by === "u1b"), "your other device takes your seat, your letters and checks with it");

// ---------- whose letters ----------
{
  const across = grid.slots.find(s => s.dir === "Across"), down = grid.slots.find(s => s.dir === "Down" && s.cells.some(k => across.cells.includes(k)));
  const word = s => s.cells.map(k => board.sol[k]).join(""), cross = down.cells.find(k => across.cells.includes(k));
  const log = [{ slot: across.id, word: word(across), by: "u0" }, { slot: down.id, word: word(down), by: "u1" }];
  const owners = ownersFrom(board, log);
  check(owners[cross] === "u0" && down.cells.filter(k => k !== cross).every(k => owners[k] === "u1") && across.cells.every(k => owners[k] === "u0"),
    "each letter is its placer's; a word laid through another's letter leaves that letter theirs");
  const changed = word(down).split("").map((ch, i) => (down.cells[i] === cross ? (ch === "Z" ? "Q" : "Z") : ch)).join("");
  check(ownersFrom(board, [...log, { slot: down.id, word: changed, by: "u2" }])[cross] === "u2", "a letter changed is its changer's");
  const cleared = ownersFrom(board, [...log, { clear: [cross], by: "u2" }, { draft: { [cross]: "Q" }, by: "u3" }]);
  check(cleared[cross] === "u3" && ownersFrom(board, [...log, { clear: [cross] }])[cross] === undefined, "a cleared cell is nobody's, a frame's letter its typist's");
  check(same(placedBy([...log, { slot: across.id, word: word(across), by: "u0" }, { draft: { [cross]: "A" }, by: "u1" }, { check: {}, by: "u2" }]), { u0: 2, u1: 1 }),
    "words placed are counted by player (frames and checks aren't)");
}

// ---------- who's here, and where they're typing ----------
{
  const g = structuredClone(six);
  const here = Object.fromEntries(P.slice(0, 6).map(p => [p.uid, { game: "glyph", name: p.name, online: true, pid: p.pid }]));
  here.u2 = { ...here.u2, game: "delta" };                 // gone to another game of the room
  here.u3 = { ...here.u3, online: false };                 // its page closed
  g.players.u4.online = false;                             // asleep: marked offline at its seat
  delete here.u5;                                          // back to solo: not here at all
  check(presentSlots(g, here, "u0").join() === "0,1", "here now: you, and those with Slate open online (not another game, a closed page, a phone asleep or someone gone)");
  check(presentSlots(g, {}, "u3").join() === "3", "your own seat is always here");
  g.players.u1.at = { k: grid.cells[0], d: "Down" };
  g.players.u4.at = { k: grid.cells[1], d: "Across" };
  g.players.u0.at = { k: grid.cells[2], d: "Across" };
  const seen = cursorsOf(g, here, "u0", "p0");
  check(seen.length === 1 && seen[0].id === "u1" && seen[0].slot === 1 && seen[0].k === grid.cells[0] && seen[0].d === "Down", "you see the cursors of the others here, not your own or a sleeping phone's");
  g.players.u0b = { name: "Korbi", slot: 9, pid: "p0", online: true, at: { k: grid.cells[3] } };
  check(!cursorsOf(g, { ...here, u0b: { game: "glyph", online: true, pid: "p0" } }, "u0", "p0").some(c => c.id === "u0b"), "nor your own other device's");
}

// ---------- a party of six fills a board, every move through the database ----------
{
  let g = roundTrip(storable(table(6, { asked: 77 })));
  for (const p of P.slice(1, 6)) g = roundTrip(storable(sitDown(g, p, { initial: null, asked: 77, valid, slots })));
  check(seatsOf(g).length === 6 && g.people === 6 && g.asked === 77 && logOf(g).length === 0, "six seated, through the database (no empty log kept)");
  const move = (by, change) => { const cur = structuredClone(g); cur.log = logOf(cur); change(cur, by); g = roundTrip(storable(cur)); };
  // everyone moves their cursor (a write of their own, beside the moves), then the words go in, a player each in turn
  for (const [i, p] of P.slice(0, 6).entries()) { g.players[p.uid].at = { k: grid.cells[i % grid.cells.length], d: i % 2 ? "Down" : "Across" }; g = roundTrip(g); }
  move("u2", (cur, by) => cur.log.push({ check: { v: 2, at: 0, out: {}, proven: true }, by }));
  move("u3", (cur, by) => cur.log.push({ reveal: 0, by }));
  grid.slots.forEach((s, i) => move(P[i % 6].uid, (cur, by) => cur.log.push({ slot: s.id, word: s.cells.map(k => board.sol[k]).join(""), by })));
  const log = logOf(g), letters = lettersFrom(g.board, log), owners = ownersFrom(g.board, log);
  check(Array.isArray(g.log) && log.length === grid.slots.length + 2 && log.every(e => e.by), "the log comes back a list, every entry with its player");
  check(isSolved(g.board, letters), "the board is solved from what came back");
  check(grid.cells.every(k => /^u[0-5]$/.test(owners[k])) && new Set(Object.values(owners)).size === Math.min(6, grid.slots.length), "every letter has its placer, in up to six colours");
  check(P.slice(0, 6).every((p, i) => g.players[p.uid].at?.k === grid.cells[i % grid.cells.length] && g.players[p.uid].slot === i), "each player's seat and cursor came back as written");
  check(same(g.board, board), "the board itself came back whole");
  const warned = [], warn = console.warn;
  console.warn = msg => warned.push(msg);
  const odd = storable({ ...g, oops: undefined, n: NaN, log: [...log, { slot: 0, word: "ABC", by: undefined }] });
  console.warn = warn;
  check(!("oops" in odd) && odd.n === null && odd.log.at(-1).by === undefined && warned.length === 1 && (() => { try { roundTrip(odd); return true; } catch { return false; } })(),
    "what the database refuses (undefined, NaN) is dropped before a write, with a warning, not the move");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("slate-room: a party seats as many as asked, fills one board in its colours, through the database");
