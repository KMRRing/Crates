// For the co-op tests of the classics (docs/coop.md): two phones on one shared board in the database in memory, and the
// checks every classic's adapter has to pass the same way (different cells at once both stand, the same cell settles as
// one value on both screens, an undo leaves what the partner did since, a hint counts once, the solve is the first
// writer's and nothing changes the board after it, and the board survives the database). A game's own test brings its
// puzzle and what is particular to it (its layers, its rules) and calls these.
import { newRoom, validBoard, commit, createEditor, cellEdit, tallyEdit, onceEdit, tallyOf, onceOf } from "../board-share.js";
import { roundTrip, same } from "./rtdb.js";
import { fakeDb } from "./fake-db.js";
import { freshEntries, write, pencil } from "../digits-edit.js";
import { recordEdits } from "../digits-coop.js";
import { COOP_GAMES, coopAdapter } from "../coop-games.js";

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

/**
 * What every game on the digit grid (digits-coop.js: Sudoku, Calcudoku, Kakuro) has to do as a pair, from a grid of its own:
 * `kinds` are the game's kinds (the first is played), `gridOf(kind)` an encoded grid of one, `decode(grid)` its puzzle (`solution`, and
 * `n` and `givens` where the grid is square), `shape(puzzle)` otherwise says `{ k: digits, cells, free(i): whether a player writes in
 * cell i }`, `badGrid` a grid this version can't play. `coopOf` is the adapter's default export, `KEY` and `playable` its other two;
 * the game's own test adds what is particular to it.
 */
export async function digitsSuite({ check, id, name, coopOf, KEY, playable, kinds, gridOf, decode, badGrid, shape = P => ({ k: P.n, cells: P.n * P.n, free: i => !P.givens?.[i] }) }) {
  const grid = gridOf(kinds[0]), P = decode(grid), { k, cells } = shape(P), free = [...Array(cells).keys()].filter(shape(P).free);
  const entries = freshEntries(cells);
  write(entries, free[1], 2); pencil(entries, free[2], 1); pencil(entries, free[2], k);
  const run = { v: 1, mode: "random", grid, entries, sel: 5, notes: true, ms: 4000, hints: 1, wrong: [free[1]], done: null, pace: "keen" };
  const sealed = o => JSON.stringify({ ...run, ...o });

  check(COOP_GAMES[id]?.page === `${id}.html` && COOP_GAMES[id].keys.join() === KEY && (await coopAdapter(id)).share === coopOf.share, `${name} is in coop-games.js, its key under ${id}:, its adapter loads`);
  const board = coopOf.share({ [KEY]: sealed({}) });
  check(board && board.fixed.grid.seed === grid.seed && board.layers.v.length === cells && board.layers.v[free[1]] === "2" && board.layers.n1[free[2]] === "1" && board.layers[`n${k}`][free[2]] === "1" && board.start.ms === 4000 && board.start.hints === 1,
    `${id}: a grid in play becomes a board: its grid fixed, the digits and each digit's pencil marks as layers, the clock and hints where the host stood`);
  check(["entries", "sel", "notes", "ms", "hints", "wrong", "done", "pace"].every(x => !(x in board.fixed)), `${id}: what is the host's own (selection, the Notes switch, a hint's strike, the clock, the computer's pace) is not in the grid`);
  check(coopOf.share({ [KEY]: sealed({ done: { ms: 5, score: 5 } }) }) === null && coopOf.share({}) === null && coopOf.share({ [KEY]: "not json" }) === null && coopOf.share(null) === null
    && coopOf.share({ [KEY]: sealed({ grid: badGrid }) }) === null && coopOf.share({ [KEY]: sealed({ entries: { ...entries, v: entries.v.slice(1) } }) }) === null,
    `${id}: a solved grid, nothing saved, a damaged save, a grid this version can't play, entries of the wrong length: nothing to share (the page deals a new grid)`);
  check(coopOf.share({ [KEY]: sealed({ mode: "pair", split: "*".repeat(cells), by: ".".repeat(cells) }) }) === null
    && coopOf.share({ [KEY]: sealed({ mode: "daily" }) })?.fixed.mode === "daily" && coopOf.share({ [KEY]: sealed({ mode: "rival" }) })?.fixed.mode === "random",
    `${id}: a run with the computer as partner is never shared; today's grid is, and a race with the computer is shared as a plain grid`);

  const back = coopOf.run({ ...board, tally: { hints: { x: 1, y: 1 } }, once: { done: { ms: 9000, score: 9090, by: "Korbi" } } });
  check(playable({ ...back, ms: 0 }) && back.hints === 3 && back.done.ms === 9000 && !("by" in back.done) && back.entries.v[free[1]] === 2 && back.entries.n[free[2]] === (1 << 1 | 1 << k) && back.entries.past.length === 0 && back.grid.seed === grid.seed,
    `${id}: the board comes back as a playable run: the same grid, the digits and pencil marks, hints from the start and the tally, the solve as set, no undo history`);
  const daily = coopOf.share({ [KEY]: sealed({ mode: "daily" }) });
  check(coopOf.run(daily).mode === "daily" && coopOf.run({ ...daily, once: { done: { ms: 5, score: 5 } } }).mode === "random", `${id}: today's grid solved together comes back as a plain grid: the host's run must not use up their daily`);

  let ok = 0;
  for (const kind of kinds) {
    const g = gridOf(kind), b = coopOf.share({ [KEY]: JSON.stringify({ ...run, grid: g, entries: freshEntries(shape(decode(g)).cells) }) }), through = b && roundTrip(JSON.parse(JSON.stringify(b)));
    if (b && coopOf.valid(b) && through && coopOf.valid(through) && decode(through.fixed.grid).solution.join() === decode(g).solution.join()) ok++;
  }
  check(ok === kinds.length, `${id}: a grid of each kind tried (${kinds.length}) is valid through the database and comes back the same grid`);

  const wrong = (patch, layer = {}) => coopOf.valid({ ...board, fixed: { ...board.fixed, ...patch }, layers: { ...board.layers, ...layer } });
  check(coopOf.valid(board) && !wrong({ grid: badGrid }) && !wrong({ grid: null }) && !wrong({}, { v: board.layers.v + "0" }) && !wrong({}, { v: "z".repeat(cells) }) && !wrong({}, { n1: "2".repeat(cells) }) && !wrong({}, { n1: undefined }) && !wrong({}, { [`n${k + 1}`]: "0".repeat(cells) }),
    `${id}: a good board is valid; a grid this version can't play, none at all, digits of the wrong length, a digit past ${k}, a pencil layer that is not 0 or 1, one missing, one too many: refused`);

  const [c0, c1, c2, c3] = free;
  const empty = coopOf.share({ [KEY]: JSON.stringify({ ...run, entries: freshEntries(cells), hints: 0, ms: 0 }) });
  await commonSuite({ check, id, adapter: coopOf, share: empty, layer: "v", cells: [c0, c1, c2, c3], vals: ["0", "3", "7"].map(x => (Number(x) > k ? "1" : x)) });

  // a grid filled in half by each, and pencil marks by both, is the grid on both screens
  const t = await table(id, coopOf, empty), { A, B } = t, half = j => free.filter((_, i) => i % 2 === j), D = "0123456789abcdefghijklmnopqrstuvwxyz";
  const mineA = freshEntries(cells), mineB = freshEntries(cells);
  const play = (e, p, i) => { write(e, i, P.solution[i]); p.editor.edit(recordEdits(e.past.at(-1), k)); };       // each types into their own entries, as the page does, and sends the move
  const n = Math.min(5, half(0).length - 3, half(1).length);
  for (const i of half(0).slice(0, n)) play(mineA, A, i);
  for (const i of half(1).slice(0, n)) play(mineB, B, i);
  const marked = half(0)[n + 1];
  pencil(mineA, marked, 1); A.editor.edit(recordEdits(mineA.past.at(-1), k));
  pencil(mineB, marked, 2); B.editor.edit(recordEdits(mineB.past.at(-1), k));
  await t.settle();
  const a = A.editor.view.layers, b = B.editor.view.layers;
  check(JSON.stringify(a) === JSON.stringify(b) && [...half(0).slice(0, n), ...half(1).slice(0, n)].every(i => a.v[i] === D[P.solution[i]]), `${id}: digits written by each of you in their own half are on both screens`);
  check(a.n1[marked] === "1" && a.n2[marked] === "1", `${id}: pencil marks of two digits in one cell, one from each of you, both stand on both screens`);
  const c = half(0)[n + 2], other = P.solution[c] % k + 1;       // my undo of a digit the partner has overwritten since leaves theirs
  play(mineA, A, c);
  await t.settle(A);
  B.editor.edit([cellEdit("v", c, D[P.solution[c]], D[other])]);
  await t.settle(B);
  A.editor.edit(recordEdits(mineA.past.pop(), k, { back: true, weak: true }));
  await t.settle(A);
  check(t.board().layers.v[c] === D[other] && A.editor.view.layers.v[c] === D[other], `${id}: an undo of a digit the partner overwrote since leaves the partner's`);
  t.stop();
}
