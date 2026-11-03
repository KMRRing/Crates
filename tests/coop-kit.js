// For the co-op tests of the classics (docs/coop.md): two phones on one shared board in the database in memory, and the
// checks every classic's adapter has to pass the same way (different cells at once both stand, the same cell settles as
// one value on both screens, an undo leaves what the partner did since, a hint counts once, the solve is the first
// writer's and nothing changes the board after it, and the board survives the database). A game's own test brings its
// puzzle and what is particular to it (its layers, its rules) and calls these.
import { newRoom, validBoard, commit, createEditor, cellEdit, tallyEdit, onceEdit, tallyOf, onceOf } from "../board-share.js";
import { roundTrip, same } from "./rtdb.js";
import { fakeDb } from "./fake-db.js";

export const sleep = ms => new Promise(r => setTimeout(r, ms));

/** A check that counts what failed: `const { check, done } = checker()`, and `done()` at the end sets the exit code. */
export function checker() {
  let bad = 0;
  return {
    check: (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; },
    done: () => { process.exitCode = bad ? 1 : 0; if (bad) console.log(`${bad} problems`); },
  };
}

/** A room in the database in memory holding a board, and two phones editing it as coop-page.js's do. */
export async function table(id, adapter, share) {
  const db = fakeDb(), PATH = `crates/rooms/ABCD/${id}`;
  await db.device("host").update("crates/rooms/ABCD", { [id]: newRoom(share, { players: {}, host: "h" }) });
  const phone = uid => {
    const p = { uid, dev: db.device(uid), editor: null };
    const send = async edits => {
      let rev = null;
      const r = await p.dev.tx(PATH, cur => { if (cur === null) return null; rev = commit(cur, edits, adapter.rules); return cur; });
      return r.committed ? rev : null;
    };
    p.editor = createEditor({ board: { layers: share.layers, rev: 0 }, send, rules: adapter.rules, retryMs: 20 });
    p.stop = p.dev.watch(PATH, g => g?.board && p.editor.hear(g.board));
    return p;
  };
  const A = phone("a"), B = phone("b");
  await sleep(10);
  return {
    db, PATH, A, B,
    board: () => db.read(PATH).board,
    settle: async (...ps) => { await Promise.all((ps.length ? ps : [A, B]).map(p => p.editor.idle())); await db.settle(); },
    stop: () => { A.stop(); B.stop(); },
  };
}

/**
 * What every classic's adapter must do. `share` is the board a host's run becomes; `layer` the one the players mark,
 * `cells` four cells of it that are free and `vals` three different marks for them (the empty one first). `solved` is
 * a function of a board that says whether the puzzle is solved (for the "laid half by each" check), `answer(cell)` the
 * mark the answer has there (or null when a cell is not the answer's).
 */
export async function commonSuite({ check, id, adapter, share, layer, cells: [c0, c1, c2, c3], vals: [v0, v1, v2], tally = "hints", once = "done" }) {
  const room = roundTrip(JSON.parse(JSON.stringify(newRoom(share, { players: { a: { name: "Korbi", slot: 0, pid: "pk", online: true } }, host: "pk" }))));
  check(validBoard(room) && adapter.valid(room.board) && !adapter.valid(null) && !adapter.valid({}) && !adapter.valid({ fixed: share.fixed, layers: {} }), `${id}: a board through the database is valid; none, an empty one and one with no ${layer} layer are not`);
  const t = await table(id, adapter, share);
  const { A, B } = t, mk = p => p.editor.view.layers[layer];
  // different cells at once
  A.editor.edit(cellEdit(layer, c0, v0, v1));
  B.editor.edit(cellEdit(layer, c1, v0, v1));
  await t.settle();
  check(t.board().layers[layer][c0] === v1 && t.board().layers[layer][c1] === v1 && mk(A) === mk(B) && mk(A) === t.board().layers[layer], `${id}: marks on two different cells at once both stand, on both screens`);
  // the same cell, two ways: the later stands, both screens agree
  A.editor.edit(cellEdit(layer, c2, v0, v1));
  B.editor.edit(cellEdit(layer, c2, v0, v2));
  await t.settle();
  const got = t.board().layers[layer][c2];
  check((got === v1 || got === v2) && mk(A)[c2] === got && mk(B)[c2] === got, `${id}: two different marks on one cell at once end as one value (${got}) on the database and both screens`);
  // the same change twice is one
  A.editor.edit(cellEdit(layer, c3, v0, v1));
  B.editor.edit(cellEdit(layer, c3, v0, v1));
  await t.settle();
  check(t.board().layers[layer][c3] === v1 && mk(A) === mk(B), `${id}: both making the same mark at once is one mark`);
  // an undo puts back only what it left
  A.editor.edit(cellEdit(layer, c3, v1, v0, true));
  await t.settle();
  check(t.board().layers[layer][c3] === v0, `${id}: an undo of a mark nobody has touched since puts it back`);
  A.editor.edit(cellEdit(layer, c3, v0, v1));
  await t.settle(A);
  B.editor.edit(cellEdit(layer, c3, v1, v2));
  await t.settle(B);
  A.editor.edit(cellEdit(layer, c3, v1, v0, true));
  await t.settle(A);
  check(t.board().layers[layer][c3] === v2 && mk(A)[c3] === v2, `${id}: an undo of a mark the partner changed since leaves the partner's`);
  // hints and the solve
  A.editor.edit([tallyEdit(tally, "h-a1")]);
  B.editor.edit([tallyEdit(tally, "h-b1")]);
  A.editor.edit(tallyEdit(tally, "h-a1"));
  await t.settle();
  check(tallyOf(t.board(), tally) === 2 && adapter.run(t.board()).hints === (t.board().start?.hints || 0) + 2, `${id}: two hints, one by each of you, count two; the same hint sent twice counts once`);
  A.editor.edit(onceEdit(once, { ms: 41000, score: 71, by: "Korbi" }));
  B.editor.edit(onceEdit(once, { ms: 43000, score: 73, by: "Sarah" }));
  await t.settle();
  const board = t.board(), solved = adapter.run(board);
  check([41000, 43000].includes(onceOf(board, once).ms) && solved.done?.ms === onceOf(board, once).ms && solved.done.score === onceOf(board, once).score && !("by" in solved.done), `${id}: the solve is set once and the run says one time for both of you`);
  const before = t.board().layers[layer];
  B.editor.edit(cellEdit(layer, c0, v1, v0));
  await t.settle();
  check(t.board().layers[layer] === before && !!adapter.rules?.frozen?.(t.board()), `${id}: after the solve a mark still on its way changes nothing`);
  check(adapter.valid(t.board()) && same(roundTrip(t.board()), t.board()), `${id}: the board is still a good board after all of that, and the database keeps it as it is`);
  t.stop();
}
