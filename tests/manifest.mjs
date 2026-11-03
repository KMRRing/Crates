// Manifest: runs are twelve repeatable rounds; stacks obey gravity and stay within 4×4×3 and five wares; every order
// is fair (its answer among its options and answerable from what the view showed); turning is consistent; the
// which-stack question has four different stacks with exactly one the true one turned, and its mirror decoy is no
// turn of the stack; change rounds change what they say they change, among packages you could see; prices
// follow the round and your record.
// Together: a team's stack in parts, every package seen by exactly one player, whole columns, one stretch of the
// floor each, as even as columns allow; a team's rounds as fair as alone, counted on what the team could see; and a
// table in Node, every change read back as the database gives it: Ready and Next, the round's clock, replies in order,
// a round settled for several players (each at their own bonus), who the table waits for and going on without the
// last, players away or out of lives, the team's first answer counting, the game over, Play again, the pair's record.
import { roundTrip, same as sameDb } from "./rtdb.js";
const M = await import("../manifest-engine.js");
const { isTimber } = await import("../manifest-rules.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const fail = (...why) => { bad++; console.log("  ", ...why); };
const key = (x, y, z) => `${x},${y},${z}`;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let orders = 0, rounds = 0, turnedAsked = 0;
const byType = {}, byView = {};
/** One round's fairness: as alone, or a team's (whose "you could see" is what any of them could see of their part). */
function fair(a, b, seed, r, team = 0) {
  const L = a.level, where = `${seed}/${r}${team ? ` (a team of ${team})` : ""}`;
  rounds++;
  if (!same(a.cells, b.cells) || !same(a.orders, b.orders)) fail("not repeatable", where);
  if (a.cells.length !== L.x || a.cells[0].length !== L.y || a.cells[0][0].length !== L.z || L.x > 4 || L.y > 4 || L.z > 3 || L.types.length > M.TYPES) fail("size", where);
  a.cells.forEach(col => col.forEach(row => { for (let z = 1; z < row.length; z++) if (row[z] && !row[z - 1]) fail("floating package", where); }));
  if (Boolean(L.change) !== (r % 4 === 0)) fail("change round in the wrong place", where);
  byView[a.view] = (byView[a.view] || 0) + 1;
  const types = a.orders.map(o => o.type);
  if (new Set(types).size !== types.length) fail("two orders of one kind", where, types);
  if (!L.change && a.orders.length < Math.min(L.orders, 3)) fail("too few orders", where, a.orders.length);
  const X = L.x, Y = L.y;
  // what the view showed: every package, the bottom two tiers, or (all at once) what could be seen
  const shown = [];
  a.cells.forEach((col, x) => col.forEach((row, y) => row.forEach((c, z) => { if (c && (a.view === "all" ? a.seen.has(key(x, y, z)) : a.view === "pair" ? z < 2 : true)) shown.push(c); })));
  for (const o of a.orders) {
    orders++;
    byType[o.type] = (byType[o.type] || 0) + 1;
    const q = o.question;
    if (!o.posted || !q.text) fail("an order without words", where, o.type);
    if (q.as === "number" && (!q.options.includes(q.answer) || q.options.length !== 5 || q.options.some(v => v < 0))) fail("number options", where, q);
    if (q.as === "ware" && !q.options.includes(q.answer)) fail("ware options", where, q);
    if (o.type === "count" && q.answer !== shown.filter(c => c === q.ware).length) fail("a count that isn't what the view showed", where);
    if (o.type === "total" && q.answer !== shown.length) fail("a total that isn't what the view showed", where);
    if (q.cell) {
      const { x, y, z } = q.cell, k = key(x, y, z);
      if (!a.cells[x][y][z]) fail("a marked cell that's empty", where, o.type);
      if (a.view === "all" && !a.seen.has(k)) fail("all at once, asking about a package nobody could see", where, o.type);
      if (a.view === "pair" && z > 1) fail("two-tier view, asking above tier 2", where, o.type);
      if (q.as === "ware" && a.cells[x][y][z] !== q.answer) fail("marked cell's ware isn't the answer", where, o.type);
    }
    if (o.type === "turned") {
      const t = M.turn(a.cells, q.turns), [x, y, z] = q.at.split(",").map(Number);
      if (t[x][y][z] !== q.answer) fail("turned spot doesn't carry the ware", where);
      // the grey stack is plain boxes: the marked piece must show enough of itself there, and the true stack's real shapes too
      if (!M.clearSet(t, M.boxFor(q.turns), true).has(q.at)) fail("the turned question's marked piece isn't clearly in its picture (a grey stack of boxes)", where);
      if (!M.visibleSet(t, M.boxFor(q.turns)).has(q.at)) fail("turned spot can't be seen", where);
      turnedAsked++;
    }
    if (o.type === "which") {
      const truth = M.turn(a.cells, q.turns);
      if (q.stacks.length !== 4 || q.stacks.filter(s => same(s, truth)).length !== 1 || !same(q.stacks[q.answer], truth)) fail("which-stack options", where);
      if (new Set(q.stacks.map(s => JSON.stringify(s))).size !== 4) fail("which-stack options not all different", where);
      const mirrorTurned = M.turn(M.mirror(a.cells), q.turns);
      if (q.stacks.some(s => same(s, mirrorTurned)) && [0, 1, 2, 3].some(t => same(M.turn(a.cells, t), M.mirror(a.cells)))) fail("mirror decoy is a turn of the stack", where);
    }
    if (o.type === "change" || o.type === "changeTurned") {
      const back = M.turn(q.back, (4 - q.turns) % 4);        // undo the turn to compare with the stack you saw
      let diffs = [];
      a.cells.forEach((col, x) => col.forEach((row, y) => row.forEach((c, z) => { if (c !== back[x][y][z]) diffs.push(key(x, y, z)); })));
      if (diffs.length !== 1 || diffs[0] !== key(q.cell.x, q.cell.y, q.cell.z) || !a.seen.has(diffs[0])) fail("a change round should change one package you could see", where, diffs);
      if (M.turnKey(q.cell.x, q.cell.y, q.cell.z, X, Y, q.turns) !== q.answer) fail("change answer not where the package went", where);
      if (!M.clearSet(q.back, M.boxFor(q.turns)).has(q.answer)) fail("the changed package can't be clearly seen when it's back", where);
    }
    if (o.type === "swap") {
      const diffs = [];
      a.cells.forEach((col, x) => col.forEach((row, y) => row.forEach((c, z) => { if (c !== q.back[x][y][z]) diffs.push(key(x, y, z)); })));
      const tally = s => JSON.stringify(s.flat(2).filter(Boolean).sort());
      if (!same(diffs.sort(), q.answer) || !diffs.every(k => a.seen.has(k) && a.visible.has(k)) || tally(a.cells) !== tally(q.back)) fail("a swap round should swap two packages you could see, and can again", where, diffs);
    }
  }
}
const alone = new Map();                     // seed/r: the round alone, kept for the checks of the parts below
for (let seed = 1; seed <= 60; seed++) for (let r = 1; r <= M.ROUNDS; r++) {
  const a = M.makeRound(seed, r);
  if (a.seen !== a.visible || a.parts) fail("alone, you saw what the stack shows, in no parts", seed, r);
  fair(a, M.makeRound(seed, r), seed, r);
  alone.set(`${seed}/${r}`, a);
}
check(bad === 0 && turnedAsked > 40, `${rounds} rounds, ${orders} orders (${turnedAsked} of the stack seen from another side, each marked piece clearly in its own picture), all fair (${JSON.stringify(byType)}; views ${JSON.stringify(byView)})`);
const L = [1, 4, 8, 12].map(M.levelOf);
check(L.map(l => l.change).join() === ",ware,turned,swap", `change rounds 4, 8, 12: ${L.slice(1).map(l => l.change).join(", ")}`);
// turning
{
  const c = M.makeRound(7, 9).cells;
  const ok = same(M.turn(M.turn(c, 1), 3), c) && same(M.turn(c, 4), c) && [1, 2, 3].every(t => { const tc = M.turn(c, t); let good = true; c.forEach((col, x) => col.forEach((row, y) => row.forEach((v, z) => { const [a, b, d] = M.turnKey(x, y, z, c.length, c[0].length, t).split(",").map(Number); if (tc[a][b][d] !== v) good = false; }))); return good; });
  check(ok, "turning: a quarter and three quarters cancel, four is none, and every package is found where turnKey says");
}
{
  const full = [[[1, 1], [1, 1]], [[1, 1], [1, 1]]];
  const v = M.visibleSet(full), v1 = M.visibleSet(full, M.boxFor(1));
  check(!v.has("0,0,0") && v.has("1,1,1") && v.size === 7 && v1.size === 7, `a full 2×2×2 block shows 7 cubes either way round (${[...v].join(" ")})`);
}
check(L[0].x * L[0].y * L[0].z < L[3].x * L[3].y * L[3].z && L[0].exposure > L[3].exposure && M.levelOf(12).x * M.levelOf(12).y * M.levelOf(12).z <= 48, `stacks grow from ${L[0].x}×${L[0].y}×${L[0].z} to ${L[3].x}×${L[3].y}×${L[3].z}, holds from ${L[0].exposure / 1000} s to ${L[3].exposure / 1000} s`);
const p = M.priceOf("spot", 1, null), pLate = M.priceOf("spot", 12, null), pGood = M.priceOf("spot", 1, { t: 20, h: 19 }), pBad = M.priceOf("spot", 1, { t: 20, h: 3 });
check(p > 0 && pLate > p && pGood < p && pBad > p, `prices: a spot pays ${p} in round 1, ${pLate} in round 12; ${pGood} if you're usually right, ${pBad} if usually wrong`);
check(M.shipBonus(1) === 1.5 && M.shipBonus(0) === 1 && M.shipBonus(0.4) === 1.2, "shipping early: up to half as much again");

// questions come in the order that gives least away first: which-stack, whose four stacks show nearly everything, last;
// and a number answer's truth isn't mostly in the middle
{
  let outOfOrder = 0, middle = 0, numbers = 0;
  for (let seed = 1; seed <= 300; seed++) for (let r = 1; r <= 12; r++) {
    const R = M.makeRound(seed, r), ranks = R.orders.map(o => M.ASK_ORDER.indexOf(o.type)).filter(k => k >= 0);
    if (ranks.some((k, i) => i && k < ranks[i - 1])) outOfOrder++;
    for (const o of R.orders) if (o.question.as === "number") { numbers++; if (o.question.options.indexOf(o.question.answer) === 2) middle++; }
  }
  const share = middle / numbers;
  check(!outOfOrder, `questions asked least-revealing first, which-stack last (${outOfOrder} rounds out of order)`);
  check(share <= 0.3, `the true number is in the middle ${Math.round(share * 100)}% of the time (a fifth is fair; random scatter gave 37%)`);
}

// ---------- a stack in parts, for a team of two to six ----------
{
  let splits = 0, worst = 0, problems = 0;
  for (const { cells } of alone.values()) {
    const X = cells.length, Y = cells[0].length;
    const all = [], height = {}, snake = [];
    cells.forEach((col, x) => col.forEach((row, y) => { height[`${x},${y}`] = row.filter(Boolean).length; row.forEach((c, z) => { if (c) all.push(key(x, y, z)); }); }));
    for (let y = 0; y < Y; y++) for (let k = 0; k < X; k++) snake.push(`${y % 2 ? X - 1 - k : k},${y}`);
    const tallest = Math.max(...Object.values(height));
    for (let n = 2; n <= 6; n++) {
      splits++;
      const parts = M.splitStack(cells, n), seen = parts.flat(), sizes = parts.map(x => x.length);
      const columns = parts.map(part => [...new Set(part.map(k => k.split(",").slice(0, 2).join(",")))]);
      const whole = columns.every((cols, i) => cols.reduce((s, c) => s + height[c], 0) === sizes[i]);
      const stretch = columns.every(cols => { const at = cols.map(c => snake.indexOf(c)).sort((a, b) => a - b); return at.every((v, i) => !i || v === at[i - 1] + 1); });
      const order = columns.map(cols => Math.min(...cols.map(c => snake.indexOf(c))));
      const spread = Math.max(...sizes) - Math.min(...sizes);
      worst = Math.max(worst, spread);
      if (parts.length !== n || sizes.some(s => !s) || seen.length !== all.length || new Set(seen).size !== all.length || !all.every(k => seen.includes(k))
        || !whole || !stretch || order.some((v, i) => i && v < order[i - 1]) || spread > tallest || !same(M.splitStack(cells, n), parts)) {
        problems++;
        if (problems < 4) console.log("  ", n, sizes, columns);
      }
    }
  }
  check(!problems, `${splits} stacks shared among two to six: every package seen by exactly one player, in whole columns, one stretch of the floor each, the parts within ${worst} packages of each other (never more than the tallest column)`);
  // a team's rounds: the same stack as alone, in its parts; all at once, the team's "you could see" is what any of them
  // could see of their own part, drawn alone (more than the whole stack shows), and every order is fair on that
  const before = { rounds, bad };
  let more = 0;
  for (let seed = 1; seed <= 30; seed++) for (let r = 1; r <= M.ROUNDS; r++) {
    const team = 2 + (seed % 5), a = M.makeRound(seed, r, team), one = alone.get(`${seed}/${r}`);
    if (!same(a.cells, one.cells) || !same(a.parts, M.splitStack(a.cells, team))) fail("a team's stack isn't the one alone, in its parts", seed, r, team);
    if (a.view === "all") {
      const union = new Set([...a.visible, ...a.parts.flatMap(part => [...M.visibleSet(M.partCells(a.cells, part))])]);
      if (!same([...a.seen].sort(), [...union].sort())) fail("what the team could see", seed, r, team);
      if (a.seen.size > a.visible.size) more++;
    } else if (a.seen !== a.visible) fail("what the team could see", seed, r, team);
    fair(a, seed <= 5 ? M.makeRound(seed, r, team) : a, seed, r, team);
  }
  check(bad === before.bad, `${rounds - before.rounds} rounds played by teams of two to six, all fair on what the team could see (all at once, the team saw more than the whole stack shows in ${more} of them)`);
  const R9 = M.makeRound(5, 9, 3), R10 = M.makeRound(5, 10, 3), seats = [0, 2, 5];
  check(same(seats.map(s => M.partFor(R9, seats, s)).flat().sort(), R9.parts.flat().sort()) && same(M.partFor(R9, seats, 0), R9.parts[0]) && same(M.partFor(R10, seats, 0), R10.parts[1])
    && same(M.partFor(R9, seats, 1), []) && M.partFor(M.makeRound(5, 9, 1), [4], 4) === null,
  "each seat at the round's opening gets one part (they go round the table a step a round), one who came later none, one alone the whole stack");
}

// ---------- a table in Node: every change made on a copy and read back as the database gives it ----------
let trips = 0, lost = 0;
/** A change made in the room's transaction: kept only if it says it changed something, and read back as the database
 *  would give it, which must be what was written (no undefined, no empty list or object, no list with holes). */
function act(g, change) {
  const next = structuredClone(g);
  if (!change(next)) return g;
  const back = roundTrip(next);
  trips++;
  if (!sameDb(back, next)) { lost++; console.log("   lost in the round trip:", JSON.stringify(next).slice(0, 300)); }
  return back;
}
/** Whether a change would do anything, on a copy. */
const would = (g, change) => !!change(structuredClone(g));
const players = { ua: { name: "Korbi", slot: 0, pid: "pa", online: true }, ub: { name: "Sarah Li", slot: 1, pid: "pb", online: true }, uc: { name: "Tom", slot: 2, pid: "pc", online: true } };
const all = [0, 1, 2];
const right = (R, i) => ({ g: R.orders[i].question.answer });
const wrong = (R, i) => { const q = R.orders[i].question; return { g: q.as === "number" || q.as === "ware" ? q.options.find(o => o !== q.answer) : q.as === "stack" ? (q.answer + 1) % 4 : "9,9,9" }; };
const PASS = { p: 1 };

// against
{
  let g = roundTrip(M.freshTable(players, { people: 3, mode: "against", seed: 4242, now: 1000 }));
  check(M.isTable(g) && g.people === 3 && M.stageOf(g.game) === "lobby" && g.game.mode === "against" && g.next === "against"
    && M.freshTable(players, { people: 9 }).people === 6 && M.freshTable(players, { people: "x" }).people === 2 && M.freshTable(players, { mode: "nonsense" }).game.mode === "against",
  "a fresh table: its first game in the lobby, seats for as many as asked (two to six)");
  g = act(g, x => M.sayReady(x, 0, [0], 1100));
  check(M.stageOf(g.game) === "lobby" && !would(g, x => M.sayReady(x, 0, [0], 1150)), "Ready alone at the table: the first round waits for a second player (and Ready twice does nothing)");
  g = act(g, x => M.sayReady(x, 1, all, 1200));
  let w = M.waitingFor(g, all, 1300);
  check(M.stageOf(g.game) === "lobby" && same(w.waiting, [2]) && w.without === 2 && w.at === 1200 + M.GRACE, "two of three Ready: the table waits for the third, and may start without them 30 s after the last Ready");
  check(!would(g, x => M.goOn(x, 0, all, w.at - 1)) && !would(g, x => M.goOn(x, 2, all, w.at)), "not before then, and not by the one it waits for");
  const lobby = g;
  g = act(g, x => M.goOn(x, 0, all, w.at));
  check(M.stageOf(g.game) === "play" && g.game.round.r === 1 && g.game.round.at === w.at + M.LEAD && !g.game.ready, "then anyone else may: round 1 opens, its tally a moment later");
  g = act(lobby, x => M.sayReady(x, 2, [0, 1, 2], 1300));
  check(M.stageOf(g.game) === "play" && g.game.round.at === 1300 + M.LEAD, "or the third says Ready, and it opens at once");
  const chosen = act(lobby, x => M.setNext(x, "team"));
  check(act(g, x => M.setNext(x, "team")).game.mode === "against" && chosen.game.mode === "team" && chosen.next === "team" && !chosen.game.ready,
    "the mode chosen for the next game is this one's too while nobody has started it (and everyone says Ready again)");

  const R = M.roundOf(g.game), tl = M.timeline(R, g.game.round.at), n = R.orders.length, prices = R.orders.map(o => M.priceOf(o.type, 1));
  check(tl.drop === g.game.round.at + M.BOOK && tl.landed > tl.drop && tl.holdEnd === tl.landed + R.level.exposure && Object.keys(tl.times).length === R.cells.flat(2).filter(Boolean).length,
    `the round's clock, the same on every phone: the tally ${M.BOOK / 1000} s, the drop, then the hold of ${R.level.exposure / 1000} s`);
  // Korbi ships the moment the stack lands (half as much again), and gets everything right
  g = act(g, x => M.ship(x, 0, 1, { present: all, now: tl.landed }));
  check(M.bonusOf(g.game, 0) === 1.5 && M.bonusOf(g.game, 1) === 1 && !would(g, x => M.ship(x, 0, 1, { present: all, now: tl.landed + 5 })), "Ship it: your own hold, your own bonus (once)");
  check(!would(g, x => M.reply(x, 0, 1, 1, right(R, 1), { present: all, now: tl.landed + 10 })), "replies in order: the second question before the first does nothing");
  for (let i = 0; i < n; i++) g = act(g, x => M.reply(x, 0, 1, i, right(R, i), { present: all, now: tl.landed + 100 * (i + 1) }));
  const korbiDone = g.game.round.runs.s0.done;
  check(korbiDone === tl.landed + 100 * n && !would(g, x => M.reply(x, 0, 1, 0, wrong(R, 0), { present: all, now: tl.landed + 999 })) && M.stageOf(g.game) === "play",
    "all of Korbi's in: he's done, a reply sent again changes nothing, and the round waits for the others");
  // Sarah: wrong, then she passes the rest; Tom answers the first and then nothing
  g = act(g, x => M.reply(x, 1, 1, 0, wrong(R, 0), { present: all, now: tl.holdEnd + 500 }));
  for (let i = 1; i < n; i++) g = act(g, x => M.reply(x, 1, 1, i, PASS, { present: all, now: tl.holdEnd + 1000 }));
  g = act(g, x => M.reply(x, 2, 1, 0, right(R, 0), { present: all, now: tl.holdEnd + 2000 }));
  w = M.waitingFor(g, all, tl.holdEnd + 3000);
  check(same(w.waiting, [2]) && w.without === 2 && w.at === tl.holdEnd + 1000 + M.GRACE, "Tom's the last: the others may go on without him 30 s after the last of them was done (and the questions had opened)");
  check(same(M.waitingFor(g, [0, 1], tl.holdEnd + 3000).waiting, []) && M.settleIfDue(structuredClone(g), [0, 1], tl.holdEnd + 3000), "nobody away holds the table up: with Tom's phone asleep, the round is due");
  check(!would(g, x => M.goOn(x, 0, all, w.at - 1)), "before his time's up, nobody goes on without him");
  g = act(g, x => M.goOn(x, 1, all, w.at));
  const t = g.game.totals, mineAt = (k, bonus) => prices.slice(0, k).reduce((s, v) => s + Math.round(v * bonus), 0);
  check(M.stageOf(g.game) === "results" && g.game.round.settled === w.at
    && same(t.s0, { pts: mineAt(n, 1.5), lives: 3, right: n, wrong: 0, passed: 0, last: mineAt(n, 1.5) })
    && same(t.s1, { pts: 0, lives: 2, right: 0, wrong: 1, passed: n - 1, last: 0 })
    && same(t.s2, { pts: Math.round(prices[0]), lives: 3, right: 1, wrong: 0, passed: n - 1, last: Math.round(prices[0]) }),
  `the round settled for all three at once: Korbi ${t.s0.pts} (every one right, shipped at once, ×1.5), Sarah a life gone, Tom what he'd answered, the rest passed`);
  check(!would(g, x => M.reply(x, 2, 1, 1, right(R, 1), { present: all, now: w.at + 10 })), "a reply after the round's settled changes nothing");
  check(same(M.verdicts(g.game, 1), ["wrong", ...Array(n - 1).fill("passed")]) && same(M.scoresOf(g).map(s => [s.name, s.pts, s.last]), [["Korbi", t.s0.pts, t.s0.pts], ["Sarah Li", 0, 0], ["Tom", t.s2.pts, t.s2.pts]]),
    "the results: each one's answers and points this round, and the standings");
  // Next: Tom's phone sleeps, the two here go on
  g = act(g, x => M.sayReady(x, 0, [0, 1], w.at + 5000));
  g = act(g, x => M.sayReady(x, 1, [0, 1], w.at + 6000));
  check(M.stageOf(g.game) === "play" && g.game.round.r === 2, "Next from everyone at the table (Tom away): round 2 opens");
  // round 2: Sarah gets two wrong, out of lives; Korbi passes everything
  const R2 = M.roundOf(g.game), t2 = M.timeline(R2, g.game.round.at);
  for (let i = 0; i < R2.orders.length; i++) g = act(g, x => M.reply(x, 0, 2, i, PASS, { present: [0, 1], now: t2.holdEnd + 10 }));
  g = act(g, x => M.reply(x, 1, 2, 0, wrong(R2, 0), { present: [0, 1], now: t2.holdEnd + 20 }));
  g = act(g, x => M.reply(x, 1, 2, 1, wrong(R2, 1), { present: [0, 1], now: t2.holdEnd + 30 }));
  check(M.stageOf(g.game) === "play", "two wrong of three: Sarah's not done yet");
  g = act(g, x => M.reply(x, 1, 2, 2, PASS, { present: [0, 1], now: t2.holdEnd + 40 }));
  check(M.stageOf(g.game) === "results" && g.game.totals.s1.lives === 0 && g.game.totals.s1.out === 2 && !M.playing(g.game, 1) && g.game.totals.s2.passed === n - 1 + R2.orders.length,
    "her last reply settles it (those here all done): she's out of lives in round 2; Tom, away, passed it");
  // Sarah, out, isn't waited for; Korbi's Next opens round 3
  check(same(M.waitingFor(g, [0, 1], t2.holdEnd + 100).waiting, [0]), "after a round, the table waits only for those still playing");
  g = act(g, x => M.sayReady(x, 0, [0, 1], t2.holdEnd + 200));
  check(g.game.round.r === 3 && !would(g, x => M.reply(x, 1, 3, 0, PASS, { now: t2.holdEnd + 300 })) && !would(g, x => M.ship(x, 1, 3, { now: 1 })), "round 3 opens; out of lives, Sarah watches (no replies, no Ship it)");
  // nobody here plays (Korbi and Tom away, Sarah watching): the round settles once its hold is over, not before
  const t3 = M.timeline(M.roundOf(g.game), g.game.round.at);
  check(!M.settleIfDue(structuredClone(g), [1], t3.holdEnd - 1) && M.settleIfDue(structuredClone(g), [1], t3.holdEnd), "with only a watcher at the table, a round settles once its hold is over");
  g = act(g, x => M.settleIfDue(x, [1], t3.holdEnd));
  check(same(M.waitingFor(g, [1], t3.holdEnd + 5).waiting, [1]), "and, everyone here out, the watcher's Next moves it on");
  // play on, everyone passing, to the twelfth: the game is over when it's settled
  let at = t3.holdEnd + 10;
  for (let r = 4; r <= M.ROUNDS; r++) {
    g = act(g, x => M.sayReady(x, 0, [0, 2], at)); g = act(g, x => M.sayReady(x, 2, [0, 2], at + 1));
    const Rr = M.roundOf(g.game), tr = M.timeline(Rr, g.game.round.at);
    for (const s of [0, 2]) for (let i = 0; i < Rr.orders.length; i++) g = act(g, x => M.reply(x, s, r, i, PASS, { present: [0, 2], now: tr.holdEnd + 1 }));
    at = tr.holdEnd + 10;
  }
  check(M.stageOf(g.game) === "over" && g.game.round.r === M.ROUNDS && !would(g, x => M.sayReady(x, 0, all, at)) && !would(g, x => M.openRound(x, all, at)), "after the twelfth round's settled, the game's over: no thirteenth");
  check(same(M.resultOf(g, 0), { match: `4242-1000`, score: t.s0.pts, won: true, coop: false }) && M.resultOf(g, 1).won === false && M.resultOf(g, 2).won === false,
    "the pair's record: won is coming first, alone");
  const tie = structuredClone(g);
  tie.game.totals.s2.pts = tie.game.totals.s0.pts;
  check(M.resultOf(tie, 0).won === false && M.resultOf(tie, 2).won === false, "a shared first place is nobody's win");
  // Play again: the first to ask deals it, in the next mode; one a moment later says Ready to it
  g = act(g, x => M.setNext(x, "team"));
  check(g.game.mode === "against" && g.next === "team", "the next mode chosen mid-game waits for the next game");
  g = act(g, x => M.again(x, 2, 1, { seed: 77, present: all, now: at + 100 }));
  check(g.game.n === 2 && g.game.mode === "team" && M.stageOf(g.game) === "lobby" && same(g.game.ready, { s2: at + 100 }) && !g.game.totals, "Play again: game 2, together, in its lobby, Tom ready");
  g = act(g, x => M.again(x, 0, 1, { seed: 78, present: [0, 2], now: at + 200 }));
  check(g.game.n === 2 && g.game.seed === 77 && M.stageOf(g.game) === "play" && same(g.game.round.seats, [0, 2]), "Korbi's Play again a moment later is his Ready for it: the two here start, the stack shared between them");
  check(!would(g, x => M.again(x, 1, 0, { seed: 1, now: 1 })), "an old game's Play again does nothing");
}

// together
{
  let g = roundTrip(M.freshTable(players, { people: 3, mode: "team", seed: 9001, now: 50 }));
  for (const s of all) g = act(g, x => M.sayReady(x, s, all, 100 + s));
  const R = M.roundOf(g.game), tl = M.timeline(R, g.game.round.at), seats = g.game.round.seats;
  check(same(seats, all) && R.parts.length === 3 && same(all.map(s => M.partFor(R, seats, s)).flat().sort(), R.cells.flatMap((col, x) => col.flatMap((row, y) => row.flatMap((c, z) => (c ? [key(x, y, z)] : [])))).sort()),
    "together: the round opens with the stack shared among the three at the table, every package someone's");
  g = act(g, x => M.ship(x, 0, 1, { present: all, now: tl.landed + 1000 }));
  g = act(g, x => M.ship(x, 2, 1, { present: all, now: tl.landed + 2000 }));
  check(!g.game.round.shipped && M.bonusOf(g.game) === 1, "two of three have shipped: the team's hold goes on");
  g = act(g, x => M.ship(x, 1, 1, { present: all, now: tl.landed + 3000 }));
  const bonus = Math.round(M.shipBonus(1 - 3000 / R.level.exposure) * 100) / 100;
  check(g.game.round.shipped === tl.landed + 3000 && M.bonusOf(g.game) === bonus, `everyone's shipped: the hold ends then, and the team's answers pay ×${bonus}`);
  const n = R.orders.length, prices = R.orders.map(o => M.priceOf(o.type, 1));
  check(!would(g, x => M.reply(x, 1, 1, 1, right(R, 1), { present: all, now: 1 })), "the team's questions come in order too");
  g = act(g, x => M.reply(x, 1, 1, 0, right(R, 0), { present: all, now: tl.holdEnd }));
  check(!would(g, x => M.reply(x, 2, 1, 0, wrong(R, 0), { present: all, now: tl.holdEnd + 1 })) && same(g.game.round.answers, { q0: { ...right(R, 0), by: 1 } }),
    "the first answer counts: Tom's to the same question a moment later changes nothing");
  g = act(g, x => M.reply(x, 2, 1, 1, wrong(R, 1), { present: all, now: tl.holdEnd + 2 }));
  for (let i = 2; i < n; i++) g = act(g, x => M.reply(x, 0, 1, i, PASS, { present: all, now: tl.holdEnd + 3 }));
  const got = Math.round(prices[0] * bonus);
  check(M.stageOf(g.game) === "results" && same(g.game.team, { pts: got, lives: 2, right: 1, wrong: 1, passed: n - 2, last: got }) && same(M.verdicts(g.game), ["right", "wrong", ...Array(n - 2).fill("passed")]),
    "the last reply settles it: the team's score and lives, one right, one wrong, the rest passed");
  // round 2 with Sarah's phone asleep: the stack in two parts
  g = act(g, x => M.sayReady(x, 0, [0, 2], tl.holdEnd + 10));
  g = act(g, x => M.sayReady(x, 2, [0, 2], tl.holdEnd + 11));
  const R2 = M.roundOf(g.game);
  check(g.game.round.r === 2 && same(g.game.round.seats, [0, 2]) && R2.parts.length === 2 && same(M.partFor(R2, g.game.round.seats, 1), []),
    "Next with Sarah away: round 2 is shared between the two here; she has no part when she comes back");
  // two wrong in round 2: the team's out of lives, the game over
  g = act(g, x => M.reply(x, 0, 2, 0, wrong(R2, 0), { now: 1 }));
  g = act(g, x => M.reply(x, 2, 2, 1, wrong(R2, 1), { now: 2 }));
  for (let i = 2; i < R2.orders.length; i++) g = act(g, x => M.reply(x, 0, 2, i, PASS, { now: 3 }));
  check(M.stageOf(g.game) === "over" && g.game.team.lives === 0 && same(M.resultOf(g, 1), { match: "9001-50", score: got, won: false, coop: true }),
    "the team out of lives: over, and the pair's record is the team's score, together");
  check(same(M.waitingFor(g, all, 9).waiting, []) && M.livesOf(g.game, 2) === 0 && M.playing(g.game, 1), "together, everyone plays every round; the lives are the team's");
}
check(trips > 60 && !lost, `${trips} changes to a table read back from the database just as they were written`);

// The 3D picture is the engine's picture: the camera (manifest-model.js) puts every corner of every package where the
// engine's isoPoint does, so what shows through a stack is what the engine says shows. No WebGL here: the numbers only.
{
  const Mo = await import("../manifest-model.js");
  let worst = 0, boxes = 0, lifts = 0;
  for (const [X, Y, Z, turns] of [[1, 1, 1, 0], [3, 2, 2, 0], [4, 4, 3, 0], [4, 3, 3, 1], [3, 4, 2, 2], [2, 4, 3, 3]]) {
    const b = M.boxFor(turns), frame = Mo.frameOf(X, Y, Z, b, { drop: true }), cam = Mo.cameraOf(frame, X, Y, Z, b);
    const [ax, ay] = Mo.planeOf(cam.at), total = frame.H + frame.room;
    for (let x = 0; x <= X; x++) for (let y = 0; y <= Y; y++) for (let z = 0; z <= Z; z++) {
      const [px, py] = Mo.planeOf([x * b.X, z * b.H, y * b.Y]);                       // the corner in the camera's plane, from the stack's centre
      const at = [(px - ax - cam.left) / (cam.right - cam.left) * frame.W, (cam.top - (py - ay)) / (cam.top - cam.bottom) * total - frame.room];
      const [ex, ey] = frame.to([(x * b.X - y * b.Y) * 0.866, (x * b.X + y * b.Y) * 0.5 - z * b.H]);    // where the engine's drawing has it
      worst = Math.max(worst, Math.abs(at[0] - ex), Math.abs(at[1] - ey));
      boxes++;
    }
    const cells = Array.from({ length: X }, () => Array.from({ length: Y }, () => Array.from({ length: Z }, () => 1)));
    for (const it of Mo.layout(cells, turns, frame)) {
      const f = M.cubeFaces(it.x, it.y, it.z, b);
      if (!same(it.faces.top, f.top.map(frame.to)) || !same(it.faces.left, f.left.map(frame.to)) || !same(it.faces.right, f.right.map(frame.to))) fail("layout differs from the engine's faces", X, Y, Z);
      if (Math.abs(it.box.sx - b.X) + Math.abs(it.box.sy - b.H) + Math.abs(it.box.sz - b.Y) > 1e-9) fail("a package isn't its cell's box", X, Y, Z);
      lifts++;
    }
  }
  check(worst < 0.02 && boxes > 300 && lifts > 100, `3D camera: ${boxes} box corners and ${lifts} packages land where the engine's drawing has them (worst ${worst.toFixed(4)} view box units: the engine's .866 is √3/2 to three places)`);
  const f0 = Mo.fall(0), f1 = Mo.fall(1), path = Array.from({ length: 101 }, (_, i) => Mo.fall(i / 100));
  const monotone = path.every((p, i) => i === 0 || i > 58 || p.lift <= path[i - 1].lift);                  // it drops until the strike at .58
  check(f0.lift > 1 && f0.fade === 0 && f1.lift === 0 && f1.squash === 1 && f1.fade === 1 && monotone && path.every(p => p.lift >= 0 && p.squash > 0.85 && p.squash < 1.05),
    "a falling package starts high and unseen, drops, flattens a little, rebounds a little and is still at the end of LANDING");
  const cells2 = [[[1], [1]], [[1], [0]]], b2 = M.boxFor(0), fr2 = Mo.frameOf(2, 2, 1, b2, {}), items2 = Mo.layout(cells2, 0, fr2);
  const c = it => { const t = it.faces.top; return [(t[0][0] + t[2][0]) / 2, (t[0][1] + t[2][1]) / 2]; };
  check(items2.every(it => Mo.packageAt(items2, ...c(it)) === it.key) && Mo.packageAt(items2, -50, -50) === null,
    "a tap on a package's top finds that package (the nearest of those under it), a tap on nothing finds none");
}

// The eight cargo types must be told apart by outline first and by colour second (the owner, 3 November 2026: "Each with their
// own 3d model"; a piece that is only another colour of the same shape is the first version's mistake). So the types are
// measured two ways, for every pair:
//  - the outline: the silhouettes of the models (manifest-shapes.js, seen by the isometric camera, a bundle of timber lying
//    either way) by overlap, shared area over total area; no pair may overlap more than SHAPE, except the one pair that is meant to
//    (gold and ingots, below);
//  - the colour: CIEDE2000 between the two on the same face, for a normal eye and the three dichromacies (Machado 2009,
//    severity 1), under both drawings' shading and in another piece's shadow.
// A pair whose outlines are close (over ALIKE) must also be far apart in colour, even for a colour-blind eye, so that no
// two types are alike in both; the rest are told apart by their outline and their colour is only kept honest by FLOOR.
// THE EXCEPTION: gold ingots have the ingots' shape on purpose (Korbi, 3 November 2026: "similar skin to the other ingots"). So that
// pair cannot be told apart by outline and is held to a far stricter colour, GOLD_FAR, for all four eyes under every shading, and
// has a second cue that is not colour: the crown on the pile's top (tests/manifest-shapes.mjs checks it, both drawings draw it).
{
  const SHAPE = 0.9, ALIKE = 0.78, FAR = 9, FLOOR = 4, GOLD_FAR = 20;
  const GOLD = M.WARES.findIndex(w => w.id === "gold"), INGOT = M.WARES.findIndex(w => w.id === "ingot");
  const Sh = await import("../manifest-shapes.js");
  const outlines = M.WARES.map((_, k) => (isTimber(k + 1) ? [Sh.silhouette(k + 1, 96, 0), Sh.silhouette(k + 1, 96, Math.PI / 2)] : [Sh.silhouette(k + 1, 96, 0)]));
  const overlapOf = (i, j) => Math.max(...outlines[i].flatMap(a => outlines[j].map(b => Sh.overlap(a, b))));
  const NAMES = M.WARES.map(w => w.name.toLowerCase());
  const pairs = [];
  for (let i = 0; i < M.TYPES; i++) for (let j = i + 1; j < M.TYPES; j++) pairs.push({ i, j, shape: overlapOf(i, j), twin: i === INGOT && j === GOLD });
  const fills = outlines.map(o => o[0].reduce((n, v) => n + v, 0) / (96 * 96));
  const widest = pairs.filter(p => !p.twin).reduce((a, p) => (p.shape > a.shape ? p : a));
  check(pairs.every(p => p.twin || p.shape <= SHAPE) && fills.every(f => f > 0.1),
    `no two cargo types share an outline but gold and ingots: the largest overlap of the rest is ${widest.shape.toFixed(2)} (${NAMES[widest.i]} and ${NAMES[widest.j]}), under ${SHAPE}`);
  const lin = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  const unlin = c => Math.round(255 * Math.min(1, Math.max(0, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
  const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const EYES = {
    normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
    tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
  };
  const { FACE_SHADE, SHADOWED } = await import("../manifest-model.js");
  const FLAT = [0.72, 0.86, 1.05];                                    // the shading manifest-art.js gives left, right and top
  const LIT = [...Object.values(FACE_SHADE), SHADOWED];                // the 3D drawing's lights, and a face in shadow
  const seen = (hex, k, eye) => { const v = rgbOf(hex).map(n => lin(Math.min(255, n * k))); return EYES[eye].map(r => unlin(r[0] * v[0] + r[1] * v[1] + r[2] * v[2])); };
  const lab = rgb => {
    const [r, g, b] = rgb.map(lin), f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
    const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047), y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b), z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const de = ([L1, a1, b1], [L2, a2, b2]) => {                          // CIEDE2000
    const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI, p7 = c => c ** 7 / (c ** 7 + 25 ** 7);
    const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(p7(Cb)));
    const A1 = (1 + G) * a1, A2 = (1 + G) * a2, C1 = Math.hypot(A1, b1), C2 = Math.hypot(A2, b2);
    const h1 = (deg(Math.atan2(b1, A1)) + 360) % 360, h2 = (deg(Math.atan2(b2, A2)) + 360) % 360;
    let dh = h2 - h1; if (C1 * C2 === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
    const dH = 2 * Math.sqrt(C1 * C2) * Math.sin(rad(dh / 2)), Lb = (L1 + L2) / 2, Cp = (C1 + C2) / 2;
    let hb = h1 + h2; if (C1 * C2 !== 0 && Math.abs(h1 - h2) > 180) hb += hb < 360 ? 360 : -360; hb /= 2;
    const T = 1 - 0.17 * Math.cos(rad(hb - 30)) + 0.24 * Math.cos(rad(2 * hb)) + 0.32 * Math.cos(rad(3 * hb + 6)) - 0.2 * Math.cos(rad(4 * hb - 63));
    const Sl = 1 + 0.015 * (Lb - 50) ** 2 / Math.sqrt(20 + (Lb - 50) ** 2), Sc = 1 + 0.045 * Cp, Sh = 1 + 0.015 * Cp * T;
    const Rt = -Math.sin(rad(60 * Math.exp(-(((hb - 275) / 25) ** 2)))) * 2 * Math.sqrt(p7(Cp));
    return Math.sqrt(((L2 - L1) / Sl) ** 2 + ((C2 - C1) / Sc) ** 2 + (dH / Sh) ** 2 + Rt * ((C2 - C1) / Sc) * (dH / Sh));
  };
  const hexes = M.WARES.map(w => w.hex);
  const apart = (FACES, eye, i, j) => Math.min(...FACES.map(k => de(lab(seen(hexes[i], k, eye)), lab(seen(hexes[j], k, eye)))));
  const eyes = Object.keys(EYES);
  const range = (i, j, eye) => Math.min(apart(FLAT, eye, i, j), apart(LIT, eye, i, j));
  const table = pairs.map(p => { const by = eyes.map(e => range(p.i, p.j, e)), low = Math.min(...by); return { ...p, colour: low, eye: eyes[by.indexOf(low)] }; });
  const alike = table.filter(p => !p.twin && p.shape > ALIKE && p.colour < FAR), dull = table.filter(p => p.colour < FLOOR);
  const twin = table.find(p => p.twin), nearest = table.filter(p => !p.twin).reduce((a, p) => (p.colour < a.colour ? p : a));
  check(!alike.length && !dull.length,
    `no two types are alike in both outline and colour (outlines over ${ALIKE} overlap are ${FAR} ΔE apart or more for every eye): ${alike.map(p => `${NAMES[p.i]}/${NAMES[p.j]} overlap ${p.shape.toFixed(2)}, ${p.colour.toFixed(1)} ΔE for ${p.eye}`).join("; ") || "none"}; nearest pair in colour ${NAMES[nearest.i]}/${NAMES[nearest.j]}, ${nearest.colour.toFixed(1)} ΔE for ${nearest.eye} (floor ${FLOOR})`);
  check(twin.colour >= GOLD_FAR, `gold and ingots, the same shape, are at least ${GOLD_FAR} ΔE apart for all four eyes in every shading (the least is ${twin.colour.toFixed(1)}, for ${twin.eye}); the crown on gold is the second cue`);
}

console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
