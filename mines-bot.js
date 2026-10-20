// Mines' computer players, both thinking with the solver (mines-solve.js), paced like a person: a moment to see what a
// number proves (longer for two numbers than one, longer still for a group or the count) and a moment for each tap.
// The rival plays its own copy of your field, and its whole game is worked out when the field is dealt, so it can be
// shown at any moment of your clock (a pause stops it with you). The partner shares your field and holds half of
// its numbers: it acts on what its half proves, tells you a number of its own when you're both stuck, asks for one of
// yours when it is, and answers when you ask. Pure, no page.
import { solve } from "./mines-solve.js";
import { rng, hash, knowing, readerOf, isFlag, OPEN, HIDDEN, STRUCK, STRIKE } from "./mines-engine.js";

// a tap, and the thought before it, in seconds, by level of reasoning (1 one number … 4 the count); slip: the chance
// a tap goes on a mine by mistake
export const PACES = {
  steady: { label: "Steady", tap: 1.25, think: [0, 0.9, 4.5, 8, 10], most: 2, slip: 0.004, flags: true },
  quick: { label: "Quick", tap: 0.75, think: [0, 0.5, 2.6, 4.5, 6], most: 3, slip: 0.002, flags: true },
  sharp: { label: "Sharp", tap: 0.42, think: [0, 0.22, 1.2, 2.2, 3], most: 4, slip: 0.0007, flags: false },
};
export const paceOf = p => (PACES[p] ? p : "quick");
const wobble = R => 0.7 + 0.6 * R();       // a person is never exactly as fast twice

/**
 * The rival's game on a field: { times: [ms at which its count of open cells changed], open: [that count], strikes:
 * [ms of each mine it dug by mistake], end: ms when it cleared the field, score: its score in seconds }. Its seed
 * comes from the field's, so it plays the same way each time.
 */
export function rivalPlan(f, pace = "quick") {
  const P = PACES[paceOf(pace)], R = rng(hash(f.seed ?? 0, f.shape, f.w, "rival", pace));
  const r = solve(f, { keepSteps: true, most: 4 });
  const seen = new Uint8Array(f.n), times = [0], open = [0], strikes = [];
  let t = 0, opened = 0;
  const reveal = i => {          // a tap that opens i and whatever an empty cell opens round it
    const stack = [i];
    while (stack.length) {
      const c = stack.pop();
      if (seen[c]) continue;
      seen[c] = 1; opened++;
      if (f.nums[c] === 0) for (const j of f.nb[c]) if (!seen[j] && !f.mine[j]) stack.push(j);
    }
  };
  t += P.tap * wobble(R) * 1000;
  reveal(f.start);
  times.push(Math.round(t)); open.push(opened);
  for (const d of r.steps) {
    t += P.think[d.level] * wobble(R) * 1000;
    for (const c of d.cells) {
      if (d.mine) { if (P.flags) t += P.tap * wobble(R) * 1000; continue; }
      if (seen[c]) continue;
      if (R() < P.slip) { t += P.tap * wobble(R) * 1000; strikes.push(Math.round(t)); }    // a slip of the thumb onto a mine
      t += P.tap * wobble(R) * 1000;
      reveal(c);
      times.push(Math.round(t)); open.push(opened);
    }
  }
  const end = Math.round(t);
  return { times, open, strikes, end, safe: f.n - f.count, score: Math.round(end / 1000) + STRIKE * strikes.length };
}
/** Where the rival stands `ms` into the field: { open, share (0–1 of the safe cells), strikes, done }. */
export function rivalAt(plan, ms) {
  let k = 0;
  while (k + 1 < plan.times.length && plan.times[k + 1] <= ms) k++;
  return { open: plan.open[k], share: plan.open[k] / plan.safe, strikes: plan.strikes.filter(s => s <= ms).length, done: ms >= plan.end };
}

/**
 * The partner's next move on a shared field, as it stands: { kind: "dig" | "flag" | "point", cell, wait (ms of
 * thought and tap before it), level, why } or null when it can do nothing yet. It reads the numbers of its own share
 * (seat `me` of `people`) and those told; it trusts its own flags, never yours. why, for a point: "ask" (one of your
 * numbers would help it), "tell" (one of its own would help you), "wrong" (a flag it can show is wrong).
 * state: { cells, told (Set of cells told to all) }; stuckMs: how long nothing has moved on the field.
 */
export function partnerMove(f, state, { me = 1, people = 2, pace = "quick", stuckMs = 0, asked = new Set(), seed = 0 } = {}) {
  const P = PACES[paceOf(pace)], R = rng(hash(seed, stuckMs > 0 ? 1 : 0, countOpen(state.cells), state.told.size));
  const think = level => Math.round((P.think[level] + P.tap) * wobble(R) * 1000);
  const theirs = i => readerOf(f, i, people) === me;
  // cells it knows are safe without having seen their numbers (flagged by you, wrongly): it mustn't read them
  const unread = new Set();
  const s = knowing(f, state.cells, { sees: i => (theirs(i) || state.told.has(i)) && !unread.has(i), trust: [me] });
  for (let guard = 0; guard < f.n; guard++) {
    const d = s.next(P.most);
    if (!d) break;
    for (const c of d.cells) {
      const ch = state.cells[c];
      if (d.mine && ch === HIDDEN) return { kind: "flag", cell: c, wait: think(d.level), level: d.level };
      if (!d.mine && ch === HIDDEN) return { kind: "dig", cell: c, wait: think(d.level), level: d.level };
      if (!d.mine && isFlag(ch) && !asked.has(`wrong:${c}`)) return { kind: "point", cell: c, wait: think(d.level), level: d.level, why: "wrong" };
    }
    // nothing in it to do (its mines are flagged already, its safe cells under flags it has shown are wrong): it
    // keeps what it learned in mind and looks further
    if (d.mine) for (const c of d.cells) s.markMine(c);
    else { for (const c of d.cells) { unread.add(c); s.st[c] = 0; } s.sync(); }
  }
  // nothing it can prove: after a while, a number of its own you could use (if yours prove nothing either), or one
  // of yours it needs
  if (stuckMs < 7000) return null;
  const yoursRead = told => i => !theirs(i) || told.has(i);
  if (!knowing(f, state.cells, { sees: yoursRead(state.told) }).next(4)) {
    for (const c of cellsOf(f, state, i => theirs(i) && !state.told.has(i))) {
      if (asked.has(`tell:${c}`)) continue;
      if (knowing(f, state.cells, { sees: yoursRead(new Set(state.told).add(c)) }).next(4)) return { kind: "point", cell: c, wait: think(2), level: 2, why: "tell" };
    }
  }
  const wanted = cellsOf(f, state, i => !theirs(i) && !state.told.has(i)).filter(c => !asked.has(`ask:${c}`));
  for (const c of wanted) {
    const told = new Set(state.told).add(c);
    if (knowing(f, state.cells, { sees: i => theirs(i) || told.has(i), trust: [me] }).next(P.most)) return { kind: "point", cell: c, wait: think(2), level: 2, why: "ask" };
  }
  // no one number of yours would do it alone (it needs two at once, or more than it can reason with): after longer,
  // it asks for the next of yours on the edge all the same, so the two of you always get there
  if (stuckMs >= 14000 && wanted.length) return { kind: "point", cell: wanted[0], wait: think(2), level: 2, why: "ask" };
  return null;
}
const countOpen = cells => { let k = 0; for (const ch of cells) if (ch === OPEN) k++; return k; };
/** Open numbers that still touch a hidden cell and pass `keep`, in the field's order. */
function cellsOf(f, state, keep) {
  const out = [];
  for (let i = 0; i < f.n; i++) {
    if (state.cells[i] !== OPEN || f.nums[i] === 0 || !keep(i)) continue;
    if (f.nb[i].some(j => state.cells[j] === HIDDEN || isFlag(state.cells[j]))) out.push(i);
  }
  return out;
}
export { STRUCK };
