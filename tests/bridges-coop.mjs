// Bridges as a pair (bridges-coop.js, on board-share.js; docs/coop.md): the host's run becomes a shared board with every twist's
// strings, the board becomes a run again, a board this version can't play is refused, and two phones on one board in the database in
// memory: bridges on different links both stand, the same change twice is one bridge, a later change to one link wins, a
// hold that clears and a tap that adds settle to the later, crossing bridges laid at once both stand (and are found), a hint
// counts once, the solve is the first writer's, and nothing changes the bridges after it.
import coopOf, { shareRun, splitOn, halves, sees, pingValue, newPings, PING_FOR, RUN, LRUNS, TRACK, CAMP } from "../bridges-coop.js";
import { generate, puzzleOf, crossings, crossed, solvedBy, flagsOf } from "../bridges-engine.js";
import { LEVELS as LADDER, kindOf, seedOf } from "../bridges-levels.js";
import { playable, fromPuzzle, fixedOf } from "../bridges-run.js";
import { newRoom, validBoard, commit, createEditor, cellEdit, tallyEdit, onceEdit, tallyOf, onceOf } from "../board-share.js";
import { COOP_GAMES, coopAdapter } from "../coop-games.js";
import { roundTrip, same } from "./rtdb.js";
import { fakeDb } from "./fake-db.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const runOf = (lv, mode = "level", ms = 4000) => { const k = kindOf(lv), puzzle = generate(seedOf(lv), k.size, k.level, k.twist); return { v: 1, ms, hints: 1, ...fromPuzzle(mode, seedOf(lv), k, puzzle, mode === "level" ? { lv } : {}) }; };
const puzzleFor = f => puzzleOf(f.size, f.grid, f.sol, f.kinds || "", f.realms || "", f.hills || "", f.roads || "", { straits: f.straits || "", tree: flagsOf(f.twist).tree });

// ---------- registered, and its board out of the host's saved keys ----------
check(COOP_GAMES.bridges?.page === "bridges.html" && COOP_GAMES.bridges.keys.every(k => k.startsWith("bridges:")) && (await coopAdapter("bridges")).share === coopOf.share, "Bridges is in coop-games.js, its keys under bridges:, its adapter loads");
const lvOf = twist => LADDER.findIndex(L => L.twist === twist && L.size === 7) >= 0 ? LADDER.findIndex(L => L.twist === twist && L.size === 7) : LADDER.findIndex(L => L.twist === twist);
const free = runOf(lvOf("none"), "random");
{
  const board = coopOf.share({ [RUN]: JSON.stringify(free), [TRACK]: '"free"' });
  check(board && same(board.layers, { marks: free.marks, split: "1" }) && board.fixed.sol === free.sol && board.fixed.grid === free.grid && board.start.ms === 4000 && board.start.hints === 1, "a free puzzle in play becomes a board: its puzzle fixed, its bridges its bridges and the split the two layers, the clock and hints where the host stood");
  check(!("undo" in board.fixed) && !("marks" in board.fixed) && !("ms" in board.fixed) && !("done" in board.fixed), "what is the host's own (undo, the clock, marks) is not in the puzzle");
  check(coopOf.share({ [RUN]: JSON.stringify(free) })?.fixed.seed === free.seed, "with no way of playing saved, a free puzzle in play is the one shared");
  check(coopOf.share({ [RUN]: JSON.stringify({ ...free, done: { ms: 5, score: 5 } }), [TRACK]: '"free"' }) === null && coopOf.share({}) === null && coopOf.share({ [RUN]: "not json" }) === null && coopOf.share(null) === null,
    "a solved puzzle, nothing saved or a damaged save: nothing to share (the page deals a new puzzle)");
  const lv = lvOf("narrow"), level = runOf(lv);
  const saved = { [RUN]: JSON.stringify(free), [TRACK]: '"levels"', [CAMP]: JSON.stringify({ v: 2, at: lv, stars: [] }), [LRUNS]: JSON.stringify({ [lv]: level }) };
  const b = coopOf.share(saved);
  check(b?.fixed.mode === "level" && b.fixed.lv === lv && b.fixed.sol === level.sol, "on the ladder it is the level in hand that is shared, not the free puzzle");
  check(coopOf.share({ ...saved, [LRUNS]: JSON.stringify({}) }) === null && coopOf.share({ ...saved, [LRUNS]: JSON.stringify({ [lv]: { ...level, lv: lv + 1 } }) }) === null, "a level with no puzzle saved, or a saved run of another level, shares nothing");
  check(coopOf.share({ ...saved, [TRACK]: '"free"' })?.fixed.mode === "random", "the way of playing decides which of the two is the board");
}

// ---------- every twist: a board with its strings, through the database, a run again ----------
const twists = [...new Set(LADDER.map(L => L.twist))];
let allOk = 0;
for (const twist of twists) {
  const lv = lvOf(twist), run = runOf(lv), board = coopOf.share({ [RUN]: "null", [TRACK]: '"levels"', [CAMP]: JSON.stringify({ v: 2, at: lv, stars: [] }), [LRUNS]: JSON.stringify({ [lv]: run }) });
  const room = roundTrip(JSON.parse(JSON.stringify(newRoom(board, { players: { a: { name: "Korbi", slot: 0, pid: "pk", online: true } }, host: "pk" }))));
  const back = coopOf.run(room.board), f = fixedOf(run);
  const strings = ["kinds", "realms", "hills", "roads", "straits"].every(k => (run[k] ?? null) === (room.board.fixed[k] ?? null));
  if (board && validBoard(room) && coopOf.valid(room.board) && strings && back.twist === run.twist && same(fixedOf(back), f) && playable({ ...back, ms: 0 }) && back.marks === run.marks && back.hints === 1 && back.done === null) allOk++;
}
check(allOk === twists.length, `a board of each of the ${twists.length} twists (${twists.join(", ")}) keeps all its strings through the database and comes back a playable run`);

// ---------- a board this version can't play ----------
{
  const board = shareRun(free);
  const wrong = (patch, layer = {}) => coopOf.valid({ ...board, fixed: { ...board.fixed, ...patch }, layers: { marks: board.layers.marks, ...layer } });
  check(coopOf.valid(board) && !coopOf.valid(null) && !coopOf.valid({}) && !coopOf.valid({ fixed: board.fixed, layers: {} }), "a good board is valid; none, an empty one and one with no bridges layer are not");
  check(!wrong({ sol: board.fixed.sol.slice(1) }) && !wrong({}, { marks: board.layers.marks + "0" }) && !wrong({ size: 8 }) && !wrong({ lanes: "~" }) && !wrong({ grid: "#" + board.fixed.grid.slice(1) }) && !wrong({ mode: "level", lv: 999 }),
    "an answer or bridges of the wrong length, a size there is none of, fairways and reefs (taken out in November 2026), a level that isn't one: refused");
}

// ---------- two phones on one board ----------
const PATH = "crates/rooms/ABCD/bridges";
const lv = lvOf("hills+narrow") >= 0 ? lvOf("hills+narrow") : lvOf("hills"), base = runOf(lv, "random");
const Pz = puzzleFor(base), need = Array.from(base.sol, (c, l) => (+c > 0 ? l : -1)).filter(l => l >= 0);
async function table(db, marks = base.marks) {
  const root = db.device("host");
  await root.update("crates/rooms/ABCD", { bridges: newRoom({ fixed: fixedOf(base), layers: { marks }, start: { ms: 0, hints: 0 } }, { players: {}, host: "h" }) });
}
function phone(db, uid) {
  const p = { uid, dev: db.device(uid), editor: null };
  const send = async edits => {
    let rev = null;
    const r = await p.dev.tx(PATH, cur => { if (cur === null) return null; rev = commit(cur, edits, coopOf.rules); return cur; });
    return r.committed ? rev : null;
  };
  p.editor = createEditor({ board: { layers: { marks: base.marks }, rev: 0 }, send, rules: coopOf.rules, retryMs: 20 });
  p.stop = p.dev.watch(PATH, g => g?.board && p.editor.hear(g.board));
  return p;
}
const marks = p => p.editor.view.layers.marks;
const settle = async (db, ...ps) => { await Promise.all(ps.map(p => p.editor.idle())); await db.settle(); };
{
  const db = fakeDb();
  await table(db);
  const A = phone(db, "a"), B = phone(db, "b");
  await sleep(10);
  const [l0, l1, l2, l3] = need;
  // different links at once
  A.editor.edit(cellEdit("marks", l0, "0", "1"));
  B.editor.edit(cellEdit("marks", l1, "0", "1"));
  await settle(db, A, B);
  check(db.read(PATH).board.layers.marks[l0] === "1" && db.read(PATH).board.layers.marks[l1] === "1" && marks(A) === marks(B), "bridges laid on two different links at once both stand, on both screens");
  // the same change twice is one bridge
  A.editor.edit(cellEdit("marks", l2, "0", "1"));
  B.editor.edit(cellEdit("marks", l2, "0", "1"));
  await settle(db, A, B);
  check(db.read(PATH).board.layers.marks[l2] === "1" && marks(A) === marks(B), "both tapping the same empty link at once lays one bridge, not two");
  // a hold (clear) against a tap (add) from the same state: the later edit wins, both screens agree
  A.editor.edit(cellEdit("marks", l2, "1", "0"));
  B.editor.edit(cellEdit("marks", l2, "1", "2"));
  await settle(db, A, B);
  const cell = db.read(PATH).board.layers.marks[l2];
  check((cell === "0" || cell === "2") && marks(A)[l2] === cell && marks(B)[l2] === cell, `a clear and a second bridge on one link at once end as one value on the database and both screens (${cell}): the later change stands`);
  // an undo leaves what the partner did since
  A.editor.edit(cellEdit("marks", l3, "0", "1"));
  await settle(db, A);
  B.editor.edit(cellEdit("marks", l3, "1", "2"));
  await settle(db, B);
  A.editor.edit(cellEdit("marks", l3, "1", "0", true));
  await settle(db, A);
  check(db.read(PATH).board.layers.marks[l3] === "2" && marks(A)[l3] === "2", "A's undo of a bridge B has doubled since leaves B's double");
  A.stop(); B.stop();
}

// crossing bridges laid at once: the rules refuse them to one player, so they can come only of two phones at once; both stand, and are found
{
  const db = fakeDb();
  let pair = null;
  for (let a = 0; a < Pz.lay.links.length && !pair; a++) for (const k of Pz.lay.cross[a]) if (k > a && Pz.lay.links[a].cap > 0 && !Pz.lay.links[k].high === !Pz.lay.links[a].high) { pair = [a, k]; break; }
  await table(db);
  const A = phone(db, "a"), B = phone(db, "b");
  await sleep(10);
  check(!!pair && !crossed(Pz, base.marks, pair[0]), "the puzzle has two links that cross");
  A.editor.edit(cellEdit("marks", pair[0], "0", "1"));
  B.editor.edit(cellEdit("marks", pair[1], "0", "1"));
  await settle(db, A, B);
  const m = db.read(PATH).board.layers.marks;
  check(m[pair[0]] === "1" && m[pair[1]] === "1" && marks(A) === m && marks(B) === m, "two bridges that cross, laid at the same moment, both stand");
  check(same([...crossings(Pz, m)].sort(), [...pair].sort()) && crossings(Pz, base.marks).size === 0, "and the page can find them to say so: exactly those two links, none on a board without them");
  A.stop(); B.stop();
}

// the hint, the solve, and nothing after it
{
  const db = fakeDb();
  await table(db);
  const A = phone(db, "a"), B = phone(db, "b");
  await sleep(10);
  A.editor.edit([cellEdit("marks", need[0], "0", "1"), tallyEdit("hints", "h-a1")]);
  B.editor.edit([cellEdit("marks", need[1], "0", "1"), tallyEdit("hints", "h-b1")]);
  A.editor.edit(tallyEdit("hints", "h-a1"));
  await settle(db, A, B);
  check(tallyOf(db.read(PATH).board, "hints") === 2 && coopOf.run(db.read(PATH).board).hints === 2, "two hints, one by each of you, count two; the same hint sent twice counts once");
  // each lays the answer's links they like; the last bridge solves it
  const solveBy = (p, links) => { for (const l of links) { const cur = +marks(p)[l]; for (let c = cur; c < +base.sol[l]; c++) p.editor.edit(cellEdit("marks", l, String(c), String(c + 1))); } };
  solveBy(A, need.filter((_, i) => i % 2 === 0));
  solveBy(B, need.filter((_, i) => i % 2 === 1));
  await settle(db, A, B);
  check(solvedBy(Pz, db.read(PATH).board.layers.marks) && marks(A) === marks(B), "the answer, laid half by each, is the answer on both screens");
  A.editor.edit(onceEdit("done", { ms: 41000, score: 71, by: "Korbi" }));
  B.editor.edit(onceEdit("done", { ms: 43000, score: 73, by: "Sarah" }));
  await settle(db, A, B);
  const board = db.read(PATH).board, run = coopOf.run(board);
  check(onceOf(board, "done").ms === 41000 || onceOf(board, "done").ms === 43000, "the solve is set once");
  check(run.done?.ms === onceOf(board, "done").ms && run.done.score === onceOf(board, "done").score && !("by" in run.done), "the run says when it was solved and the score, one time for both of you");
  B.editor.edit(cellEdit("marks", need[0], "1", "0"));
  await settle(db, B);
  check(db.read(PATH).board.layers.marks === Array.from(base.sol).join("") && coopOf.rules.frozen(db.read(PATH).board), "after the solve a tap still on its way changes nothing");
  A.stop(); B.stop();
}

// ---------- the split: half of the numbers to each of you (3 November 2026, Korbi) ----------
{
  // every ladder level's puzzle, as the table would have it: complementary, balanced, the same twice, nothing empty where there are two
  let comp = 0, balanced = 0, same2 = 0, regionsOk = 0, total = 0, shapeOk = 0;
  for (let lv = 0; lv < LADDER.length; lv++) {
    const run = runOf(lv), f = fixedOf(run), a = halves(f), b = halves({ ...f }), isl = [...f.grid].map((ch, i) => (ch !== "." ? i : -1)).filter(i => i >= 0);
    total++;
    if (a.length === f.grid.length && [...a].every((ch, i) => (f.grid[i] === "." ? ch === "." : ch === "h" || ch === "g"))) shapeOk++;
    const h = isl.filter(i => a[i] === "h").length, g = isl.filter(i => a[i] === "g").length;
    if (h + g === isl.length && isl.every(i => sees(a, i, true, true) !== sees(a, i, false, true))) comp++;
    if (Math.abs(h - g) <= 1) balanced++;
    if (a === b) same2++;
    const regions = new Map();
    for (const i of isl) { const r = Math.floor((Math.floor(i / f.size) * 3) / f.size) * 3 + Math.floor(((i % f.size) * 3) / f.size); regions.set(r, [...(regions.get(r) || []), a[i]]); }
    if ([...regions.values()].every(sides => sides.length < 2 || (sides.includes("h") && sides.includes("g")))) regionsOk++;
  }
  check(shapeOk === total, `every island of all ${total} ladder puzzles is the host's or the guest's, and the cells with no island are neither`);
  check(comp === total, "each island's number is shown to exactly one of the two phones: the halves are complementary");
  check(balanced === total, "each of you has half of the islands, to within one");
  check(same2 === total, "the same puzzle gives the same halves every time (a reload, a late joiner)");
  check(regionsOk === total, "in every ninth of the board with two islands or more, each of you has one: neither half is empty anywhere");
  const f = fixedOf(runOf(lvOf("ranges"))), other = halves({ ...f, seed: f.seed + 1 });
  check(other !== halves(f), "another puzzle deals another way");
  const seen = new Set();
  for (let seed = 1; seed <= 60; seed++) seen.add(halves({ ...f, seed })[[...f.grid].findIndex(c => c !== ".")]);
  check(seen.has("h") && seen.has("g"), "the first island is the host's about as often as the guest's: the dealing does not favour the host");
  check(sees("h?g", 0, true, true) && !sees("h?g", 2, true, true) && sees("h?g", 2, false, true) && sees("h?g", 2, true, false) && sees("h?g", 0, false, false), "an island shows its number to its own half; with the split off every number shows");
  check(splitOn({ layers: { split: "1" } }) && !splitOn({ layers: { split: "0" } }) && !splitOn({ layers: { marks: "0" } }) && !splitOn(null), "the split is on only where the board says so (a board from before has none)");
  check(shareRun(free).layers.split === "1" && shareRun(free, false).layers.split === "0" && coopOf.valid(shareRun(free, false)) && !coopOf.valid({ ...shareRun(free), layers: { marks: free.marks, split: "2" } }), "a new co-op has the split on; the setting is one character, 0 or 1");
}
{
  // the split is a layer of the board: either of you can switch it, the later change wins, both screens change at once, and it survives the database
  const db = fakeDb();
  await table(db);
  await db.device("host").update(PATH + "/board/layers", { split: "1" });
  const A = phone(db, "a"), B = phone(db, "b");
  await sleep(10);
  A.editor.edit(cellEdit("split", 0, "1", "0"));
  await settle(db, A);
  check(db.read(PATH).board.layers.split === "0" && B.editor.view.layers.split === "0" && A.editor.view.layers.split === "0", "a switch of the split by one of you is on both screens and in the room");
  B.editor.edit(cellEdit("split", 0, "0", "1"));
  A.editor.edit(cellEdit("split", 0, "0", "1"));
  await settle(db, A, B);
  check(db.read(PATH).board.layers.split === "1" && splitOn(db.read(PATH).board) && coopOf.valid(db.read(PATH).board) && same(roundTrip(db.read(PATH).board), db.read(PATH).board), "both switching it on at once is on, and the board is still a good board");
  A.stop(); B.stop();
}

// ---------- pings: a ring on an island, ephemeral, in the pinger's place in the room ----------
{
  const seen = new Map(), now = 1_000_000;
  const players = { a: { slot: 0, ping: pingValue(5, now - 100) }, b: { slot: 1 } };
  const first = newPings(players, seen, now, 30);
  check(first.length === 1 && first[0].uid === "a" && first[0].isl === 5 && first[0].slot === 0, "a fresh ping is shown once, with who pinged and where");
  check(newPings(players, seen, now + 500, 30).length === 0, "the same ping read again (the room changed for another reason) is not shown again");
  players.a.ping = pingValue(9, now + 700);
  players.b.ping = pingValue(2, now + 650);
  const next = newPings(players, seen, now + 800, 30);
  check(next.length === 2 && next.find(x => x.uid === "a").isl === 9 && next.find(x => x.uid === "b").slot === 1, "a second ping replaces the first (one place a player), and both players can ping at once");
  const reload = newPings({ a: { slot: 0, ping: pingValue(4, now - 60_000) } }, new Map(), now, 30);
  check(reload.length === 0, "a ping left in the room from a minute ago is not shown to a phone that has just loaded");
  check(newPings({ a: { slot: 0, ping: pingValue(4, now + 5000) } }, new Map(), now, 30).length === 1 && newPings({ a: { slot: 0, ping: pingValue(4, now + 20_000) } }, new Map(), now, 30).length === 0, "a few seconds of difference between the two phones' clocks is allowed, a lot is not");
  check(newPings({ a: { ping: "99:" + now } }, new Map(), now, 30).length === 0 && newPings({ a: { ping: "x" } }, new Map(), now, 30).length === 0 && newPings({ a: { ping: 5 } }, new Map(), now, 30).length === 0 && newPings(null, new Map(), now, 30).length === 0, "an island that isn't there, or a value that isn't a ping, shows nothing");
  check(PING_FOR >= 1500 && PING_FOR <= 3000, "a ring stays about two seconds");
  // the value goes through the database in the player's own place and comes back as written
  const db = fakeDb(), dev = db.device("a");
  await dev.update("crates/rooms/ABCD/bridges/players/a", { slot: 0, name: "Korbi" });
  await dev.update("crates/rooms/ABCD/bridges/players/a", { ping: pingValue(7, now) });
  await db.settle();
  const got = db.read("crates/rooms/ABCD/bridges/players");
  check(got.a.ping === `7:${now}` && got.a.name === "Korbi" && newPings(got, new Map(), now, 30)[0].isl === 7, "a ping written to your own place leaves your seat as it was and reads back");
}

process.exit(bad ? 1 : 0);
