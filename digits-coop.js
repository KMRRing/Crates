// The digit grid as a shared board (docs/coop.md): what Sudoku, Calcudoku and Kakuro share, as digits-edit.js is what they
// share on the page. Pure (no page), so tests can check it and a phone can load an adapter from any page.
//
// A set of entries (digits-edit.js: `v` a value a cell, 0 when empty; `n` a mask a cell, bit d for a pencil mark of digit d) is
// the board's layers, one string each and a character a cell, so two partners writing in different cells, or marking different
// digits in one cell, never meet:
//   v     the digit in the cell, 0 for empty, as one character in base 36 (a grid has at most 12 digits)
//   n1…nK a layer for each digit d, "1" where the cell has a pencil mark for d
// The pencil marks are shared too: it is one board, and what a partner has marked in a cell they are looking at is worth
// seeing. A mark and a digit are in different layers, so a mark can never overwrite a digit; a cell with a digit shows no
// marks (digits.js), and rubbing the digit out brings them back, as they do solo. Undo and redo are each player's own history
// (digits-edit.js's moves) sent as edits: an undo is weak, so it only puts back what it finds as it left it.
import { cellEdit } from "./board-share.js";

const B36 = "0123456789abcdefghijklmnopqrstuvwxyz";
export const noteLayer = d => `n${d}`;

/** The layers of a set of entries, for a grid with digits 1 to k. */
export function layersOf(entries, k) {
  const out = { v: Array.from(entries.v, x => B36[x]).join("") };
  for (let d = 1; d <= k; d++) out[noteLayer(d)] = Array.from(entries.n, m => (m >> d) & 1).join("");
  return out;
}

/** The entries (without their history) a board's layers make, for a grid of `cells` cells with digits 1 to k. */
export function entriesOf(layers, k, cells) {
  const v = Array.from(layers.v, ch => Math.max(0, B36.indexOf(ch))), n = new Array(cells).fill(0);
  for (let d = 1; d <= k; d++) {
    const s = layers[noteLayer(d)];
    for (let i = 0; i < cells; i++) if (s[i] === "1") n[i] |= 1 << d;
  }
  return { v, n };
}

/** Whether a board's layers are whole for a grid of `cells` cells with digits 1 to k (every digit a character, every mark 0 or 1). */
export function validLayers(layers, k, cells) {
  if (!layers || typeof layers.v !== "string" || layers.v.length !== cells) return false;
  for (const ch of layers.v) { const x = B36.indexOf(ch); if (x < 0 || x > k) return false; }
  for (let d = 1; d <= k; d++) { const s = layers[noteLayer(d)]; if (typeof s !== "string" || s.length !== cells || !/^[01]+$/.test(s)) return false; }
  return Object.keys(layers).length === k + 1;
}

/**
 * The cell edits of one move of digits-edit.js (its record: [cell, oldValue, oldNotes, newValue, newNotes, …]), for a grid with
 * digits 1 to k. `back` takes the move back (an undo), `weak` makes the edits an undo's: each only puts a cell back if it is
 * still as the move left it, so a digit or a mark your partner changed since stays theirs.
 */
export function recordEdits(rec, k, { back = false, weak = false } = {}) {
  const edits = [];
  for (let i = 0; i + 4 < rec.length; i += 5) {
    const c = rec[i], [fv, fn, tv, tn] = back ? [rec[i + 3], rec[i + 4], rec[i + 1], rec[i + 2]] : [rec[i + 1], rec[i + 2], rec[i + 3], rec[i + 4]];
    if (fv !== tv) edits.push(cellEdit("v", c, B36[fv], B36[tv], weak));
    for (let d = 1; d <= k; d++) if (((fn ^ tn) >> d) & 1) edits.push(cellEdit(noteLayer(d), c, String((fn >> d) & 1), String((tn >> d) & 1), weak));
  }
  return edits;
}

// ---------- where your partner is: the cell they have selected ----------
/**
 * The cursors to draw (digits.js `cursors`: { cell: { seat, initial } }) from the room's players ({ uid: { slot, name, at } }, `at`
 * the cell a player has selected, written to their own place in the room as they move): everyone but you who is here.
 */
export function cursorsOf(players, me, hereIds, cells) {
  const out = {};
  for (const [uid, p] of Object.entries(players || {})) {
    if (!p || uid === me || !hereIds.includes(uid) || !Number.isInteger(p.at) || p.at < 0 || p.at >= cells) continue;
    out[p.at] = { seat: p.slot ?? 1, initial: String(p.name || "?").trim().slice(0, 1).toUpperCase() };
  }
  return out;
}
