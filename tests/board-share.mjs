// The shared board (board-share.js, docs/coop.md): the cell rule, edits applied inside the room's transaction, and two
// editors on one board in the database in memory (tests/fake-db.js): different cells at once both stand, the same cell
// settles the same way on both screens, an undo leaves what a partner has changed since, a phone that drops off keeps
// its edits and merges them in when it is back, and the board survives the database's round trip.
import { merge, mergeLayers, diff, apply, commit, cellEdit, tallyEdit, onceEdit, tallyOf, onceOf, validBoard, newRoom, createEditor } from "../board-share.js";
import { roundTrip, same } from "./rtdb.js";
import { fakeDb } from "./fake-db.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------- the cell rule ----------
check(merge("0", "0", "2") === "2" && merge("0", "1", "0") === "1" && merge("0", "1", "1") === "1", "an edit that changes nothing leaves what is there; a cell nobody else touched takes the edit; the same change twice is one");
check(merge("0", "1", "2") === "1" && merge("0", "1", "2", "theirs") === "2", "both changed it: the later edit wins, unless it is a weak one");
{
  const w = { merge: (layer, b, m, t) => (layer === "notes" ? String(Number(m) | Number(t)) : undefined) };
  const board = { layers: { marks: "00", notes: "12" } };
  apply(board, [cellEdit("notes", 0, "1", "4"), cellEdit("marks", 0, "0", "1")], w);
  check(board.layers.notes === "52" && board.layers.marks === "10", "a game can bring its own rule for a layer (notes joined bit by bit), the others keep the default");
}

// ---------- edits ----------
{
  const b = { layers: { marks: "00000" }, rev: 0 };
  apply(b, cellEdit("marks", 2, "0", "1"));
  check(b.layers.marks === "00100", "an edit sets its cell");
  check(!apply(b, cellEdit("marks", 9, "0", "1")) && !apply(b, cellEdit("nope", 0, "0", "1")) && !apply(b, cellEdit("marks", -1, "0", "1")) && b.layers.marks === "00100", "a cell outside the layer, or a layer that is not there, is passed over");
  apply(b, cellEdit("marks", 2, "1", "0", true));
  check(b.layers.marks === "00000", "a weak edit that finds the cell as it left it puts it back");
  apply(b, cellEdit("marks", 1, "0", "1"));
  apply(b, cellEdit("marks", 1, "1", "2"));
  apply(b, cellEdit("marks", 1, "1", "0", true));
  check(b.layers.marks === "02000", "a weak edit finding the cell changed since (by a partner) leaves it");
  apply(b, [tallyEdit("hints", "a1"), tallyEdit("hints", "a1"), tallyEdit("hints", "b1")]);
  check(tallyOf(b, "hints") === 2 && tallyOf(b, "none") === 0, "a tally counts each id once, however often it is added");
  apply(b, [onceEdit("done", { ms: 5 }), onceEdit("done", { ms: 9 })]);
  check(onceOf(b, "done").ms === 5, "a once-value is the first writer's");
  const room = { v: 1, board: { layers: { marks: "000" }, rev: 4 } };
  check(commit(room, cellEdit("marks", 0, "0", "0")) === 5 && room.board.rev === 5 && commit({ v: 1 }, []) === null, "an edit that changes nothing still moves the revision on, so its sender hears it came in");
}

// ---------- merging whole boards, and the edits between two ----------
{
  const base = { marks: "0000", notes: "aaaa" }, mine = { marks: "1000", notes: "aaab" }, theirs = { marks: "0200", notes: "aaaa" };
  const m = mergeLayers(base, mine, theirs);
  check(same(m, { marks: "1200", notes: "aaab" }), "a device back with its own copy of a board that moved on: each cell merged, both sets of changes stand");
  check(mergeLayers(base, { marks: "11" }, theirs).marks === "0200", "a copy of another shape is dropped for the room's board");
  const edits = diff(base, mine);
  const rebuilt = { layers: structuredClone(theirs) };
  apply(rebuilt, edits);
  check(edits.length === 2 && same(rebuilt.layers, m), "the edits between a copy and its base, laid on the room's board, are the same merge");
}

// ---------- the database keeps what is written ----------
{
  const room = newRoom({ fixed: { seed: 7, size: 5, grid: "0123" }, layers: { marks: "0000000000" }, start: { ms: 1200 } }, { players: { a: { name: "Korbi", slot: 0, pid: "pk", online: true } }, host: "pk", now: 1000 });
  commit(room, [cellEdit("marks", 3, "0", "1"), tallyEdit("hints", "pk-1"), onceEdit("done", { ms: 4000, score: 4030, by: 0 })]);
  check(validBoard(room) && same(roundTrip(room), room), "a board with its layers, a tally and a once-value comes back from the database as it went in");
  check(room.board.start.ms === 1200 && room.board.start.at === 1000 && room.board.rev === 1, "the room keeps where the host's clock stood and when the co-op began");
  check(!validBoard({ v: 1, board: { layers: { marks: "" } } }) && !validBoard({ v: 1, board: { layers: { marks: 5 } } }) && !validBoard(null), "a board with an empty or a non-string layer isn't one");
}

// ---------- two editors on one board ----------
const PATH = "crates/rooms/ABCD/test";
async function boardOf(db, layers = "0000000000") {
  const root = db.device("host");
  await root.update("crates/rooms/ABCD", { test: newRoom({ fixed: { n: 1 }, layers: { marks: layers } }, { players: {}, host: "h" }) });
  return root;
}
/** A phone: its device, an editor on the room's board, and what it has drawn. */
function phone(db, uid) {
  const p = { uid, dev: db.device(uid), drew: [], editor: null };
  const send = async edits => {
    let rev = null;
    const r = await p.dev.tx(PATH, cur => { if (cur === null) return null; rev = commit(cur, edits); return cur; });
    return r.committed ? rev : null;
  };
  p.editor = createEditor({ board: { layers: { marks: "0000000000" }, rev: 0 }, send, retryMs: 20, onView: v => p.drew.push(v.layers.marks) });
  p.stop = p.dev.watch(PATH, g => g?.board && p.editor.hear(g.board));
  return p;
}
const marks = p => p.editor.view.layers.marks;
{
  const db = fakeDb();
  await boardOf(db);
  const A = phone(db, "a"), B = phone(db, "b");
  await sleep(10);
  // both at once, different cells
  A.editor.edit(cellEdit("marks", 1, "0", "1"));
  B.editor.edit(cellEdit("marks", 8, "0", "2"));
  check(marks(A)[1] === "1" && marks(B)[8] === "2", "an edit shows at once on the phone that made it");
  await Promise.all([A.editor.idle(), B.editor.idle()]);
  await db.settle();
  const there = db.read(PATH).board.layers.marks;
  check(there === "0100000020" && marks(A) === there && marks(B) === there, "two edits at once to different cells both stand, on the database and on both screens");

  // the same cell, different marks: the later edit wins, and both screens end the same
  A.editor.edit(cellEdit("marks", 4, "0", "1"));
  B.editor.edit(cellEdit("marks", 4, "0", "2"));
  await Promise.all([A.editor.idle(), B.editor.idle()]);
  await db.settle();
  const cell = db.read(PATH).board.layers.marks[4];
  check((cell === "1" || cell === "2") && marks(A)[4] === cell && marks(B)[4] === cell, `the same cell marked two ways at once ends as one mark on the database and both screens (${cell})`);

  // the same cell, the same mark: one mark
  const rev = db.read(PATH).board.rev;
  A.editor.edit(cellEdit("marks", 6, "0", "1"));
  B.editor.edit(cellEdit("marks", 6, "0", "1"));
  await Promise.all([A.editor.idle(), B.editor.idle()]);
  await db.settle();
  check(db.read(PATH).board.layers.marks[6] === "1" && db.read(PATH).board.rev === rev + 2 && marks(A) === marks(B), "the same mark on the same cell at once is one mark (and both edits came in)");

  // an undo (weak) leaves what the partner did since
  A.editor.edit(cellEdit("marks", 2, "0", "1"));
  await A.editor.idle(); await db.settle();
  B.editor.edit(cellEdit("marks", 2, "1", "2"));
  await B.editor.idle(); await db.settle();
  A.editor.edit(cellEdit("marks", 2, "1", "0", true));
  await A.editor.idle(); await db.settle();
  check(db.read(PATH).board.layers.marks[2] === "2" && marks(A)[2] === "2", "A's undo of an edge B has crossed since leaves B's cross");
  B.editor.edit(cellEdit("marks", 2, "2", "0", true));
  await B.editor.idle(); await db.settle();
  check(db.read(PATH).board.layers.marks[2] === "0" && marks(A)[2] === "0", "…and an undo of one's own last mark takes it back");

  // many edits from both at once, none lost
  const before = db.read(PATH).board.layers.marks;
  const want = [...before];
  for (let i = 0; i < 10; i++) {
    if (before[i] !== "0") continue;
    const who = i % 2 ? A : B;
    who.editor.edit(cellEdit("marks", i, "0", "1"));
    want[i] = "1";
  }
  await Promise.all([A.editor.idle(), B.editor.idle()]);
  await db.settle();
  check(db.read(PATH).board.layers.marks === want.join("") && marks(A) === marks(B), "a burst of edits from both phones: every one stands");
  A.stop(); B.stop();
}

// ---------- a phone drops off and comes back ----------
{
  const db = fakeDb();
  await boardOf(db);
  const A = phone(db, "a"), B = phone(db, "b");
  await sleep(10);
  A.editor.edit(cellEdit("marks", 0, "0", "1"));
  await A.editor.idle(); await db.settle();
  db.drop("b");
  // B, offline, marks three cells (one A also marks, differently, while B is away); its screen shows them all
  B.editor.edit([cellEdit("marks", 5, "0", "1"), cellEdit("marks", 6, "0", "1"), cellEdit("marks", 9, "0", "2")]);
  check(marks(B)[5] === "1" && marks(B)[6] === "1" && marks(B)[9] === "2" && B.editor.unsent === 3, "a phone that has dropped off keeps showing what it marks, and keeps it to send");
  A.editor.edit([cellEdit("marks", 9, "0", "1"), cellEdit("marks", 3, "0", "1")]);
  await A.editor.idle(); await db.settle();
  check(db.read(PATH).board.layers.marks === "1001000001" && marks(B)[0] === "1" && marks(B)[3] === "0", "the room moves on without it, and it hears nothing of that");
  // back: a new connection, the same player; the editor sends by whatever device the phone has
  B.dev = db.device("b");
  B.stop();
  B.stop = B.dev.watch(PATH, g => g?.board && B.editor.hear(g.board));
  B.editor.retry();
  await Promise.all([A.editor.idle(), B.editor.idle()]);
  await db.settle();
  const end = db.read(PATH).board.layers.marks;
  check(end[0] === "1" && end[3] === "1" && end[5] === "1" && end[6] === "1", "back on the board, its edits are in and A's stand");
  check(end[9] === "2" && marks(A) === end && marks(B) === end, "the cell both marked while apart takes the later edit (the one arriving last), and both screens show the same board");
  A.stop(); B.stop();
}

// ---------- the same editor, offline and back ----------
{
  const db = fakeDb();
  await boardOf(db);
  const A = phone(db, "a");
  await sleep(10);
  db.drop("a");
  A.editor.edit(cellEdit("marks", 7, "0", "1"));
  await sleep(60);                                   // it tries again, and fails again, without losing the edit
  check(A.editor.unsent === 1 && marks(A)[7] === "1", "an edit that cannot be sent is kept, and shown, through its retries");
  A.dev = db.device("a");
  A.editor.retry();
  await A.editor.idle(); await db.settle();
  check(db.read(PATH).board.layers.marks[7] === "1" && A.editor.unsent === 0, "once the connection is back the edit goes");
  A.stop();
}

// ---------- a tally and a once-value from two phones ----------
{
  const db = fakeDb();
  await boardOf(db);
  const A = phone(db, "a"), B = phone(db, "b");
  await sleep(10);
  A.editor.edit([tallyEdit("hints", "a-1"), onceEdit("done", { ms: 1000, by: 0 })]);
  B.editor.edit([tallyEdit("hints", "b-1"), onceEdit("done", { ms: 1010, by: 1 })]);
  await Promise.all([A.editor.idle(), B.editor.idle()]);
  await db.settle();
  const b = db.read(PATH).board;
  check(tallyOf(b, "hints") === 2 && tallyOf(A.editor.view, "hints") === 2 && tallyOf(B.editor.view, "hints") === 2, "a hint each, at once: two, on the database and on both screens (an edit shown twice isn't counted twice)");
  check(onceOf(b, "done").ms === onceOf(A.editor.view, "done").ms && onceOf(b, "done").ms === onceOf(B.editor.view, "done").ms, "both finding the board solved at once: one time stands, the same on both screens");
  A.stop(); B.stop();
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; } else console.log("board-share: the cell rule, edits and two editors on one board hold");
