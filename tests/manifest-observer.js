// A reference observer for Manifest's rounds, for the tests (not the game): it is given only what the round's view
// showed, with every piece the view hid replaced by "unknown", and the rules, and must reach each question's answer. If it
// can't, the question isn't answerable from what the player was shown, and the test fails. It shares nothing with the
// engine's way of making the questions but the rules' tables.
import { turn, turnKey, validate, legendRows, pixelsOf } from "../manifest-engine.js";
import { room, deduceColumn, weightOf, worthOf, pieces, typeOf, isLong } from "../manifest-rules.js";

const key = (x, y, z) => `${x},${y},${z}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** Enough of each half of a log has to show to count it, weigh it and name it (the engine's CLEAR_SEEN: a piece must show as much to be pointed at). */
const HALF = 90;

/** The stack as the view showed it: a cell code, 0 for a place shown empty, null for a place not shown. */
export function masked(R) {
  const shown = (x, y, z) => (R.view === "all" ? R.seen.has(key(x, y, z)) : R.view === "pair" ? z < 2 : true);
  return R.cells.map((col, x) => col.map((row, y) => row.map((t, z) => (shown(x, y, z) ? t : null))));
}
const each = (M, fn) => M.forEach((col, x) => col.forEach((row, y) => row.forEach((t, z) => fn(x, y, z, t))));
/** The pieces a masked stack shows (a log's two cells, both shown, are one piece), by what the rules make of its cells. */
const shownPieces = M => pieces(M, 0).list;
/** The pieces of a stack that a set of its cells (keys) touch, once each. */
const piecesOf = (cells, turns, keys) => [...new Set(keys.map(k => pieces(cells, turns).at.get(k).key))];

/** The answer an observer reaches for an order of the round, from the masked stack alone. */
export function observe(R, o) {
  const M = masked(R), q = o.question, seenPieces = shownPieces(M), limit = R.level.z;
  const at = ({ x, y, z }) => M[x][y][z];
  switch (o.type) {
    case "count": return seenPieces.filter(p => p.type === q.ware).length;
    case "total": return seenPieces.length;
    case "tier": return seenPieces.filter(p => p.cells[0][2] === q.tier).length;
    case "weight": return seenPieces.reduce((n, p) => n + weightOf(p.code) * p.cells.length, 0);
    case "worth": return seenPieces.reduce((n, p) => n + worthOf(p.code) * p.cells.length, 0);
    case "spot": case "top": return typeOf(at(q.cell));
    case "most": {
      const tally = {};
      for (const p of seenPieces) tally[p.type] = (tally[p.type] || 0) + 1;
      return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0] * 1;
    }
    case "load": return M[q.cell.x][q.cell.y].slice(q.cell.z + 1).reduce((n, t) => n + (t ? weightOf(t) : 0), 0);
    case "fits": return room(M[q.cell.x][q.cell.y].filter(Boolean), q.put, limit);
    case "column": {
      const col = M[q.cell.x][q.cell.y].slice(0, q.cell.z + 1), column = deduceColumn(col.map(t => t || null), R.level.types);
      return column ? column.reduce((n, t) => n + weightOf(t), 0) : null;
    }
    case "turned": return typeOf(at(q.cell));
    case "which": {
      // the options that agree with every place that was shown, turned the way the options are
      const agree = q.stacks.map((s, i) => [s, i]).filter(([s]) => {
        let ok = true;
        each(M, (x, y, z, t) => { if (t !== null) { const [a, b, c] = turnKey(x, y, z, M.length, M[0].length, q.turns).split(",").map(Number); if (s[a][b][c] !== t) ok = false; } });
        return ok;
      });
      return agree.length === 1 ? agree[0][1] : null;
    }
    case "change": case "changeTurned": {
      // the cells that differ, and the one piece they make, named as the picture lays it (a log by its low cell there)
      const back = turn(q.back, (4 - q.turns) % 4), diff = [];
      each(M, (x, y, z, t) => { if (t !== null && back[x][y][z] !== t) diff.push(key(x, y, z)); });
      const parts = piecesOf(back, 0, diff);
      return parts.length === 1 ? pieces(q.back, q.turns).at.get(turnKey(...diff[0].split(",").map(Number), M.length, M[0].length, q.turns)).key : null;
    }
    case "swap": {
      const diff = [];
      each(M, (x, y, z, t) => { if (t !== null && q.back[x][y][z] !== t) diff.push(key(x, y, z)); });
      const parts = piecesOf(q.back, 0, diff);
      return parts.length === 2 ? parts.sort() : null;
    }
  }
  return undefined;
}

/** What is wrong with a round: its stack against the rules, its options, and each question against the observer. */
export function problems(R, label = "") {
  const bad = [], say = (...w) => bad.push(`${label} ${w.join(" ")}`.trim());
  const rules = validate(R.cells, R.level.z);
  if (rules.length) say("breaks the stacking rules:", rules[0]);
  if (!R.orders.length) say("no orders");
  // seen all at once, a log is dealt only if both its halves show (else its length, count and weight would be a guess)
  if (R.view === "all") {
    const px = pixelsOf(R.cells);
    for (const p of pieces(R.cells, 0).list) if (p.long && p.cells.some(([x, y, z]) => px.get(key(x, y, z)) < HALF)) say("a log at", p.key, "has a half that hardly shows");
  }
  for (const o of R.orders) {
    const q = o.question;
    if (q.as === "number" && (!q.options.includes(q.answer) || q.options.length !== 5 || new Set(q.options).size !== 5 || q.options.some(v => v < 0))) say(o.type, "number options", JSON.stringify(q.options), q.answer);
    if (q.as === "ware" && (!q.options.includes(q.answer) || new Set(q.options).size !== q.options.length || q.options.length < 2)) say(o.type, "ware options");
    if (q.as === "stack" && (q.stacks.length !== 4 || new Set(q.stacks.map(s => JSON.stringify(s))).size !== 4 || q.stacks.some(s => validate(s, R.level.z, q.turns).length))) say(o.type, "stack options");
    if (q.cell && !R.cells[q.cell.x][q.cell.y][q.cell.z]) say(o.type, "marks an empty place");
    // a question about weights, worths or room carries its key on the prompt (Korbi, 3 November 2026), and the answer must be
    // reachable from what is printed there alone: every piece of the stack is in it, and the sums come out of its numbers
    if (["weight", "worth", "load", "column", "fits"].includes(o.type)) {
      const rows = q.legend ? legendRows(q.legend) : null, col = o.type === "worth" ? "worth" : "w", M = masked(R);
      if (!rows) say(o.type, "has no key on its prompt");
      else {
        const val = t => rows.find(r => r.id === typeOf(t))?.[col];
        // weights and worths sum pieces, a log among them (its row in the key is the whole piece); the others are about columns, which a
        // log's cells are left out of (it rests half on each of two columns, and the key gives a piece one weight)
        const sums = o.type === "weight" || o.type === "worth";
        const asked = sums ? R.cells.flat(2) : M[q.cell.x][q.cell.y].slice(o.type === "load" ? q.cell.z : 0);   // a load is the weight above a piece: what is under it is no part of the key
        if (!asked.every(t => !t || val(t) != null)) say(o.type, "has a key missing a type that is in the stack");
        if (!sums && rows.some(r => r.long)) say(o.type, "has a log in a key to columns");
        if (o.type === "fits" && !(rows.find(r => r.id === q.put) && rows.every(r => r.bears != null && r.w != null))) say(o.type, "has a key without the weights and what each bears");
        const cellsOf = { load: () => M[q.cell.x][q.cell.y].slice(q.cell.z), fits: () => M[q.cell.x][q.cell.y], column: () => M[q.cell.x][q.cell.y] }[o.type];
        if (cellsOf && cellsOf().some(t => t && isLong(t))) say(o.type, "asks about a column with a log in it");
        const sumOf = ts => ts.reduce((n, t) => n + val(t), 0);
        if (sums && sumOf(shownPieces(M).map(p => p.code)) !== q.answer) say(o.type, "isn't the sum of the key's numbers over what was shown");
        if (o.type === "load" && sumOf(M[q.cell.x][q.cell.y].slice(q.cell.z + 1).filter(Boolean)) !== q.answer) say(o.type, "isn't the sum of the key's numbers over what rests on the piece");
        if (o.type === "column") {
          const column = deduceColumn(M[q.cell.x][q.cell.y].slice(0, q.cell.z + 1).map(t => t || null), q.legend.types);
          if (!column || sumOf(column) !== q.answer) say(o.type, "isn't the sum of the key's numbers over the deduced column");
        }
      }
    }
    const got = observe(R, o);
    if (got === undefined) say(o.type, "has no observer");
    else if (!same(got, q.answer)) say(o.type, "isn't answerable from what the view showed: the observer reaches", JSON.stringify(got), "not", JSON.stringify(q.answer));
  }
  return bad;
}
