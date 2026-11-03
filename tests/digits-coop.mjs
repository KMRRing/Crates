// The digit grid as a shared board (digits-coop.js, on digits-edit.js and board-share.js; docs/coop.md): entries become layers and
// back, every move of digits-edit.js is the same change to the board as it is to the entries (digits, pencil marks, rubbing out,
// filling the marks, a hint's strike, undo and redo), an undo is weak (it leaves what a partner changed since), two partners
// marking different digits in one cell both stand, a pencil mark never touches a digit, and a partner's cursor is drawn only
// while they are here.
import { layersOf, entriesOf, validLayers, recordEdits, cursorsOf, noteLayer } from "../digits-coop.js";
import { freshEntries, write, pencil, rub, fill, set, undo, redo } from "../digits-edit.js";
import { apply, cellEdit } from "../board-share.js";
import { checker } from "./coop-kit.js";

const { check, done } = checker();
const rng = (() => { let s = 12345; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; })();
const pick = n => Math.floor(rng() * n);

// ---------- layers ----------
{
  const k = 9, e = freshEntries(81);
  write(e, 0, 5); write(e, 1, 9); pencil(e, 2, 3); pencil(e, 2, 7); pencil(e, 80, 9);
  const L = layersOf(e, k), back = entriesOf(L, k, 81);
  check(Object.keys(L).join() === ["v", ...Array.from({ length: k }, (_, i) => noteLayer(i + 1))].join() && L.v.length === 81 && L.n3.length === 81 && L.v[0] === "5" && L.n3[2] === "1" && L.n7[2] === "1" && L.n9[80] === "1" && L.n5[2] === "0", "entries become a layer of digits and a layer for each digit's pencil marks");
  check(JSON.stringify(back.v) === JSON.stringify(e.v) && JSON.stringify(back.n) === JSON.stringify(e.n), "and come back as they were");
  const wide = freshEntries(144); write(wide, 5, 12); pencil(wide, 6, 11);
  check(entriesOf(layersOf(wide, 12), 12, 144).v[5] === 12 && entriesOf(layersOf(wide, 12), 12, 144).n[6] === 1 << 11, "a grid of 12 digits keeps its twelfth in one character");
  check(validLayers(L, k, 81) && !validLayers(L, k, 80) && !validLayers({ ...L, v: L.v.slice(1) }, k, 81) && !validLayers({ ...L, v: "a" + L.v.slice(1) }, k, 81) && !validLayers({ ...L, n4: "2".repeat(81) }, k, 81) && !validLayers({ ...L, n4: undefined }, k, 81) && !validLayers({ ...L, n10: "0".repeat(81) }, k, 81) && !validLayers(null, k, 81),
    "a board's layers are whole only with every digit a character up to k, every pencil layer 0 or 1 and no layer more than k");
}

// ---------- every move is the same change to the board as to the entries ----------
{
  const k = 9, cells = 81, e = freshEntries(cells), board = { layers: layersOf(e, k) };
  let moves = 0, bad = 0;
  const same = () => { const b = entriesOf(board.layers, k, cells); return JSON.stringify(b.v) === JSON.stringify(e.v) && JSON.stringify(b.n) === JSON.stringify(e.n); };
  for (let i = 0; i < 400; i++) {
    const c = pick(cells), d = 1 + pick(k), kind = pick(9);
    let rec = null, edits = null;
    const last = () => e.past.at(-1);
    if (kind === 0 || kind === 1) { const before = last(); if (write(e, c, d, { clear: [pick(cells), pick(cells), pick(cells)] }) && last() !== before) edits = recordEdits(last(), k); }
    else if (kind === 2 || kind === 3 || kind === 4) { const before = last(); if (pencil(e, c, d) && last() !== before) edits = recordEdits(last(), k); }
    else if (kind === 5) { const before = last(); if (rub(e, c) && last() !== before) edits = recordEdits(last(), k); }
    else if (kind === 6) { const before = last(); if (fill(e, { [c]: pick(1 << (k + 1)) & ~1, [pick(cells)]: 6 }) && last() !== before) edits = recordEdits(last(), k); }
    else if (kind === 7) { rec = e.past.at(-1); if (rec && undo(e)) edits = recordEdits(rec, k, { back: true, weak: true }); }
    else { rec = e.future.at(-1); if (rec && redo(e)) edits = recordEdits(rec, k); }
    if (!edits) continue;
    moves++;
    apply(board, edits);
    if (!same()) bad++;
  }
  check(moves > 200 && bad === 0, `${moves} random moves (digits, pencil marks, rubbing out, filling the marks, undo, redo) leave the board and the entries the same after every one`);
}
// a move of a digit with the cells it clears: one record, every cell in it
{
  const e = freshEntries(81);
  pencil(e, 1, 5); pencil(e, 2, 5); pencil(e, 3, 6);
  write(e, 0, 5, { clear: [1, 2, 3] });
  const edits = recordEdits(e.past.at(-1), 9);
  check(edits.some(x => x.layer === "v" && x.i === 0 && x.to === "5") && edits.some(x => x.layer === "n5" && x.i === 1 && x.to === "0") && edits.some(x => x.layer === "n5" && x.i === 2 && x.to === "0") && !edits.some(x => x.i === 3), "a digit and the pencil marks of it that leave the cells which see it are one move's edits, and no more");
}

// ---------- two partners ----------
{
  const k = 9, e = freshEntries(81), board = { layers: layersOf(e, k), rev: 0 };
  // different digits marked in one cell by two partners: both stand
  apply(board, [cellEdit("n3", 10, "0", "1")]); apply(board, [cellEdit("n7", 10, "0", "1")]);
  check(entriesOf(board.layers, k, 81).n[10] === (1 << 3 | 1 << 7), "two pencil marks of different digits in one cell, one from each of you, both stand");
  // a partner places a digit where I am marking: the marks are still there under it, and the digit is whole
  apply(board, [cellEdit("v", 10, "0", "5")]); apply(board, [cellEdit("n4", 10, "0", "1")]);
  const got = entriesOf(board.layers, k, 81);
  check(got.v[10] === 5 && (got.n[10] & (1 << 4)) !== 0, "a pencil mark that arrives after a partner's digit leaves the digit as it is (it is another layer)");
  // the same cell, two digits: the later wins
  apply(board, [cellEdit("v", 20, "0", "3")]); apply(board, [cellEdit("v", 20, "0", "8")]);
  check(board.layers.v[20] === "8", "two different digits in one cell at once: the later stands");
  // undo is weak: a partner has overwritten my digit since
  const mine = freshEntries(81); write(mine, 30, 4);
  apply(board, recordEdits(mine.past.at(-1), k));
  apply(board, [cellEdit("v", 30, "4", "6")]);
  const rec = mine.past.at(-1); undo(mine);
  apply(board, recordEdits(rec, k, { back: true, weak: true }));
  check(board.layers.v[30] === "6", "my undo of a digit my partner has since changed leaves theirs");
  const again = freshEntries(81); write(again, 31, 2);
  apply(board, recordEdits(again.past.at(-1), k));
  const rec2 = again.past.at(-1); undo(again);
  apply(board, recordEdits(rec2, k, { back: true, weak: true }));
  check(board.layers.v[31] === "0", "and an undo that finds the digit as it left it takes it out");
}

// ---------- the partner's cursor ----------
{
  const players = { me: { slot: 0, name: "Korbi", at: 4 }, you: { slot: 1, name: "sarah", at: 17 }, gone: { slot: 2, name: "Tom", at: 5 }, none: { slot: 3, name: "Eve", at: -1 }, far: { slot: 4, name: "Zed", at: 99 } };
  const got = cursorsOf(players, "me", ["me", "you", "none", "far"], 81);
  check(JSON.stringify(got) === JSON.stringify({ 17: { seat: 1, initial: "S" } }), "the cursors are the others' selected cells, in their seat's colour with their initial, only while they are here and only on the grid");
  check(Object.keys(cursorsOf(null, "me", [], 81)).length === 0 && Object.keys(cursorsOf({ a: null }, "me", ["a"], 81)).length === 0, "no players, or an empty place, no cursors");
}

done();
