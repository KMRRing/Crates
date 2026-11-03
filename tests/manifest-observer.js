// A reference observer for Manifest's rounds, for the tests (not the game): it is given only what the round's view
// showed, with every piece the view hid replaced by "unknown", and the rules, and must reach each question's answer. If it
// can't, the question isn't answerable from what the player was shown, and the test fails. It shares nothing with the
// engine's way of making the questions but the rules' tables.
import { turn, turnKey, validate, legendRows } from "../manifest-engine.js";
import { room, deduceColumn, weightOf, worthOf } from "../manifest-rules.js";

const key = (x, y, z) => `${x},${y},${z}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The stack as the view showed it: a type, 0 for a place shown empty, null for a place not shown. */
export function masked(R) {
  const shown = (x, y, z) => (R.view === "all" ? R.seen.has(key(x, y, z)) : R.view === "pair" ? z < 2 : true);
  return R.cells.map((col, x) => col.map((row, y) => row.map((t, z) => (shown(x, y, z) ? t : null))));
}
const each = (M, fn) => M.forEach((col, x) => col.forEach((row, y) => row.forEach((t, z) => fn(x, y, z, t))));
const known = M => { const out = []; each(M, (x, y, z, t) => { if (t) out.push([x, y, z, t]); }); return out; };

/** The answer an observer reaches for an order of the round, from the masked stack alone. */
export function observe(R, o) {
  const M = masked(R), q = o.question, seenPieces = known(M), limit = R.level.z;
  const at = ({ x, y, z }) => M[x][y][z];
  switch (o.type) {
    case "count": return seenPieces.filter(p => p[3] === q.ware).length;
    case "total": return seenPieces.length;
    case "tier": return seenPieces.filter(p => p[2] === q.tier).length;
    case "weight": return seenPieces.reduce((n, p) => n + weightOf(p[3]), 0);
    case "worth": return seenPieces.reduce((n, p) => n + worthOf(p[3]), 0);
    case "spot": case "top": return at(q.cell);
    case "most": {
      const tally = {};
      for (const p of seenPieces) tally[p[3]] = (tally[p[3]] || 0) + 1;
      return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0] * 1;
    }
    case "load": return M[q.cell.x][q.cell.y].slice(q.cell.z + 1).reduce((n, t) => n + (t ? weightOf(t) : 0), 0);
    case "fits": return room(M[q.cell.x][q.cell.y].filter(Boolean), q.put, limit);
    case "column": {
      const col = M[q.cell.x][q.cell.y].slice(0, q.cell.z + 1), column = deduceColumn(col.map(t => t || null), R.level.types);
      return column ? column.reduce((n, t) => n + weightOf(t), 0) : null;
    }
    case "turned": return at(q.cell);
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
      const back = turn(q.back, (4 - q.turns) % 4), diff = [];
      each(M, (x, y, z, t) => { if (t !== null && back[x][y][z] !== t) diff.push(key(x, y, z)); });
      return diff.length === 1 ? turnKey(...diff[0].split(",").map(Number), M.length, M[0].length, q.turns) : null;
    }
    case "swap": {
      const diff = [];
      each(M, (x, y, z, t) => { if (t !== null && q.back[x][y][z] !== t) diff.push(key(x, y, z)); });
      return diff.length === 2 ? diff.sort() : null;
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
  for (const o of R.orders) {
    const q = o.question;
    if (q.as === "number" && (!q.options.includes(q.answer) || q.options.length !== 5 || new Set(q.options).size !== 5 || q.options.some(v => v < 0))) say(o.type, "number options", JSON.stringify(q.options), q.answer);
    if (q.as === "ware" && (!q.options.includes(q.answer) || new Set(q.options).size !== q.options.length || q.options.length < 2)) say(o.type, "ware options");
    if (q.as === "stack" && (q.stacks.length !== 4 || new Set(q.stacks.map(s => JSON.stringify(s))).size !== 4 || q.stacks.some(s => validate(s, R.level.z).length))) say(o.type, "stack options");
    if (q.cell && !R.cells[q.cell.x][q.cell.y][q.cell.z]) say(o.type, "marks an empty place");
    // a question about weights, worths or room carries its key on the prompt (Korbi, 3 November 2026), and the answer must be
    // reachable from what is printed there alone: every piece of the stack is in it, and the sums come out of its numbers
    if (["weight", "worth", "load", "column", "fits"].includes(o.type)) {
      const rows = q.legend ? legendRows(q.legend) : null, col = o.type === "worth" ? "worth" : "w", M = masked(R);
      if (!rows) say(o.type, "has no key on its prompt");
      else {
        const val = t => rows.find(r => r.id === t)?.[col];
        if (!R.cells.flat(2).every(t => !t || val(t) != null)) say(o.type, "has a key missing a type that is in the stack");
        if (o.type === "fits" && !(rows.find(r => r.id === q.put) && rows.every(r => r.bears != null && r.w != null))) say(o.type, "has a key without the weights and what each bears");
        const sumOf = ts => ts.reduce((n, t) => n + val(t), 0);
        const flat = [];
        M.forEach((c, x) => c.forEach((row, y) => row.forEach((t, z) => { if (t) flat.push(t); })));
        if (o.type === "weight" || o.type === "worth") { if (sumOf(flat) !== q.answer) say(o.type, "isn't the sum of the key's numbers over what was shown"); }
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
