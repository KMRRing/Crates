// Mines (mines-grid.js, mines-solve.js, mines-engine.js, mines-bot.js, mines-team.js): the three tilings and who
// touches whom; the rules of a field (digging, the flood, flags, chording, strikes, the end); the solver, every
// deduction it makes checked against every way the mines could lie; fields dealt that clear without a guess, at the
// reasoning their level asks; hints; the computer rival and partner; the split of a team's numbers (the shares make
// the whole and neither clears the field alone); the team's field through the database's own round trip; a run kept
// as JSON; and today's field, the same for everyone.
import { SHAPES, neighbours, outline, cellAt, shareOf, extent } from "../mines-grid.js";
import { solve, createSolver, placements } from "../mines-solve.js";
import { FIELDS, MINES, TARGET, SIZES, LEVELS, STRIKE, HINT, dims, deal, fieldOf, bbbv, newRun, dig, flag, chord, score, minesLeft, safeLeft,
  started, hint, needsBoth, readerOf, daily, WEEK, weekdayOf, describe, settingsOf, rng } from "../mines-engine.js";
import { PACES, rivalPlan, rivalAt, partnerMove, SPEAK_AFTER, PRESS_AFTER } from "../mines-bot.js";
import { teamMove, teamField, teamScore, readers, freshField } from "../mines-team.js";
import { freshDuel, sayReady, startAll, rematch } from "../duel-core.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const db = g => roundTrip(JSON.parse(JSON.stringify(g)));
const shapes = Object.keys(SHAPES);

// ---------- the tilings ----------
for (const [shape, w, h] of [["square", 7, 6], ["hex", 7, 6], ["tri", 9, 6]]) {
  const nb = neighbours(shape, w, h), n = w * h;
  const sym = nb.every((l, i) => l.every(j => nb[j].includes(i)) && !l.includes(i) && new Set(l).size === l.length);
  const most = Math.max(...nb.map(l => l.length));
  check(sym && most === SHAPES[shape].most, `${shape}: neighbours both ways, each cell touching at most ${SHAPES[shape].most}`);
  const pts = i => outline(shape, w, i).pts;
  const touch = (a, b) => pts(a).some(([x, y]) => pts(b).some(([u, v]) => Math.hypot(x - u, y - v) < 1e-6));
  let geo = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && touch(i, j) !== nb[i].includes(j)) geo++;
  check(!geo, `${shape}: a cell's neighbours are exactly the cells its outline touches`);
  const hits = [...Array(n).keys()].every(i => { const o = outline(shape, w, i); return cellAt(shape, w, h, o.cx, o.cy) === i; });
  const e = extent(shape, w, h);
  check(hits && cellAt(shape, w, h, -1, -1) === -1 && cellAt(shape, w, h, e.w + 2, e.h + 2) === -1, `${shape}: a finger on a cell's middle finds it, off the field nothing`);
  for (const people of [2, 3, 4, 6]) {
    const share = [...Array(n).keys()].map(i => shareOf(shape, w, i, people)), sizes = Array.from({ length: people }, (_, k) => share.filter(s => s === k).length);
    check(share.every(s => s >= 0 && s < people) && Math.max(...sizes) - Math.min(...sizes) <= Math.ceil(n / people / 2) + 1,
      `${shape}: ${people} players' shares cover every cell, about evenly (${sizes.join("/")})`);
  }
}
{
  const nb = neighbours("square", 6, 6);
  const chess = [...Array(36).keys()].every(i => nb[i].filter(j => Math.abs(j - i) === 1 || Math.abs(j - i) === 6).every(j => shareOf("square", 6, j, 2) !== shareOf("square", 6, i, 2)));
  check(chess, "squares for two: a chessboard, every cell's four edge neighbours the other player's");
}

// ---------- the rules ----------
// 5×4 squares, mines at (0,4) and (3,3); the start at (1,1) is empty
const M = (w, h, list, shape = "square") => { const m = new Uint8Array(w * h); for (const [r, c] of list) m[r * w + c] = 1; return m; };
{
  const f = fieldOf("square", 5, 4, M(5, 4, [[0, 4], [3, 3]]), 6);
  check(f.count === 2 && f.nums[6] === 0 && f.nums[3] === 1 && f.nums[8] === 2 - 1 && f.nums[13] === 1, "a field counts each cell's neighbouring mines");
  const run = newRun(f);
  check(dig(f, run, 0).why === "start" && run.cells === ".".repeat(20), "before the start is open, only the start can be dug");
  const r = dig(f, run, 6);
  check(r.ok && r.opened[0] === 6 && r.opened.length > 9 && run.cells[6] === "o" && run.cells[4] === "." && started(f, run.cells), "the empty start opens the patch round it, its border included");
  check(flag(f, run, 4) && run.cells[4] === "0" && minesLeft(f, run.cells) === 1 && dig(f, run, 4).why === "flag", "a flag marks a mine, counts off the mines left, and keeps its cell from digging");
  check(flag(f, run, 4) && run.cells[4] === "." && flag(f, run, 4), "a flag comes off again (and back)");
  check(!flag(f, run, 6) && dig(f, run, 6).why === "open", "an open cell takes no flag and no dig");
  const before = run.strikes, hit = dig(f, run, 18);
  check(hit.ok && hit.struck === 18 && run.cells[18] === "x" && run.strikes === before + 1 && !run.done && minesLeft(f, run.cells) === 0, "a mine dug is a strike: it stays, shown, and counts as found");
  check(score({ ms: 61400, strikes: 1, hints: 2 }) === 61 + STRIKE + 2 * HINT, "a score is the seconds on the clock plus the mines and hints");
  const h2 = fieldOf("square", 3, 3, M(3, 3, [[0, 0], [0, 2]]), 7), s = newRun(h2);
  dig(h2, s, 7);
  check(s.cells === "...oooooo", "a start on the bottom row opens the two rows above the mines' row");
  dig(h2, s, 0, { sudden: true });
  check(s.done && s.lost && !s.won && dig(h2, s, 1).why === "done", "played sudden, a mine ends the field");
}
{
  // chording, on a dealt field: a number with as many hidden neighbours as mines still missing flags them; one with
  // all its mines flagged digs the rest; a wrong flag under a chord digs a mine
  const f = deal({ seed: 3, shape: "square", size: "medium", level: "medium" }), run = newRun(f);
  dig(f, run, f.start);
  const find = test => [...Array(f.n).keys()].find(i => { if (run.cells[i] !== "o" || !f.nums[i]) return false; const nb = f.nb[i].map(j => run.cells[j]); return test(nb.filter(c => c === ".").length, nb.filter(c => c !== "." && c !== "o").length, f.nums[i]); });
  const full = find((hid, marked, v) => hid > 0 && hid + marked === v);
  const fc = full != null ? chord(f, run, full) : null;
  check(fc?.kind === "flag" && fc.cells.every(c => f.mine[c] && run.cells[c] === "0"), "a number with exactly as many hidden neighbours as mines left to find flags them all");
  const done = find((hid, marked, v) => hid > 0 && marked === v && f.nb.every(() => true));
  const before = safeLeft(f, run.cells), dc = done != null ? chord(f, run, done) : null;
  check(dc?.kind === "dig" && dc.results.every(r => r.ok && r.struck < 0) && safeLeft(f, run.cells) < before, "a number with all its mines flagged digs the rest round it");
  check(chord(f, run, f.start).kind === "none", "an empty cell has nothing to chord");
  const g = deal({ seed: 4, shape: "square", size: "medium", level: "medium" }), wrong = newRun(g);
  dig(g, wrong, g.start);
  const k = [...Array(g.n).keys()].find(i => wrong.cells[i] === "o" && g.nums[i] === 1 && g.nb[i].some(j => wrong.cells[j] === "." && !g.mine[j]) && g.nb[i].some(j => g.mine[j]));
  const safeOne = g.nb[k].find(j => wrong.cells[j] === "." && !g.mine[j]);
  flag(g, wrong, safeOne);
  const c = chord(g, wrong, k);
  check(c.kind === "dig" && wrong.strikes === 1 && c.results.some(r => r.struck >= 0), "a wrong flag makes a chord dig a mine: a strike");
}
{
  // 3BV: one empty patch opens a field's border at once; a number no empty cell touches is a click of its own
  const f = fieldOf("square", 4, 1, M(4, 1, [[0, 3]]), 0);
  check(bbbv(f) === 1, "3BV: one patch is one click");
  const g = fieldOf("square", 5, 1, M(5, 1, [[0, 1], [0, 3]]), 4);
  check(bbbv(g) === 3, "3BV: three cells cut off by mines are three clicks");
}

// ---------- the solver, checked against every way the mines could lie ----------
/** Every way of laying the mines left on the hidden cells that agrees with what's open: as arrays of 0/1 per hidden cell. */
function layouts(f, st) {
  const hidden = [], open = [];
  for (let i = 0; i < f.n; i++) { if (st[i] === -1) hidden.push(i); else if (st[i] === 0) open.push(i); }
  const known = [...st].filter(v => v === 1).length, left = f.count - known, out = [];
  const pick = new Int8Array(f.n);
  for (let i = 0; i < f.n; i++) if (st[i] === 1) pick[i] = 1;
  const ok = () => open.every(i => f.nb[i].reduce((m, j) => m + pick[j], 0) === f.nums[i]);
  const go = (k, m) => {
    if (m > left || m + (hidden.length - k) < left) return;
    if (k === hidden.length) { if (ok()) out.push(hidden.map(i => pick[i])); return; }
    pick[hidden[k]] = 1; go(k + 1, m + 1); pick[hidden[k]] = 0; go(k + 1, m);
  };
  go(0, 0);
  return { hidden, out };
}
{
  let steps = 0, wrong = 0, cleared = 0, checkedLevels = 0, levelBad = 0;
  const R = rng(99);
  for (const [shape, w, h, count] of [["square", 5, 5, 5], ["hex", 5, 5, 5], ["tri", 7, 4, 4], ["square", 6, 4, 5]]) {
    for (let t = 0; t < 14; t++) {
      const nb = neighbours(shape, w, h), inner = [...Array(w * h).keys()].filter(i => nb[i].length === SHAPES[shape].most);
      const start = inner[Math.floor(R() * inner.length)], banned = new Set([start, ...nb[start]]);
      const free = [...Array(w * h).keys()].filter(i => !banned.has(i));
      for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
      const mine = new Uint8Array(w * h);
      free.slice(0, count).forEach(i => { mine[i] = 1; });
      const f = fieldOf(shape, w, h, mine, start);
      const s = createSolver(f);
      s.open(start);
      for (let guard = 0; guard < 200 && !s.done; guard++) {
        const d = s.next(4);
        if (!d) break;
        const { hidden, out } = layouts(f, s.st);
        for (const c of d.cells) { const k = hidden.indexOf(c); if (out.some(l => l[k] !== (d.mine ? 1 : 0))) wrong++; }
        // a deduction of one number or two is provable from those numbers alone
        if (d.level <= 2) {
          checkedLevels++;
          const cs = d.from.map(i => s.constraint(i)), vars = [...new Set(cs.flatMap(c => c.u))];
          const p = placements(vars, cs.map(c => ({ cells: c.u, lo: c.r, hi: c.r })));
          if (!p || !d.cells.every(c => p.forced.some(x => x.cell === c && x.mine === d.mine))) levelBad++;
        }
        steps++;
        s.apply(d);
      }
      if (s.done) cleared++;
    }
  }
  check(steps > 150 && !wrong, `every deduction (${steps}, on ${cleared} small fields cleared) agrees with every way the mines could lie`);
  check(checkedLevels > 50 && !levelBad, `a deduction graded one number or two follows from those numbers alone (${checkedLevels})`);
}
{
  // the patterns a person knows, each found at its level: a 1 with one hidden neighbour; the 1-2-1 on a wall
  const one = fieldOf("square", 3, 1, M(3, 1, [[0, 2]]), 0);
  const s = createSolver(one); s.open(0);
  const d = s.next(4);
  check(d?.level === 1 && d.mine && d.cells.join() === "2" && d.from.join() === "1", "one number: a 1 with one hidden neighbour has its mine there");
  // under a wall of hidden cells, mines at (0,1) and (0,3): the 1 at the end sees two of them, the 1 beside it three,
  // so the third is safe; no one number says so
  const pair = fieldOf("square", 5, 3, M(5, 3, [[0, 1], [0, 3]]), 12), sp = createSolver(pair);
  sp.open(12);
  const two = sp.next(4);
  check(sp.next(1) === null && two?.level === 2 && !two.mine && two.cells.includes(2) && two.from.includes(5) && two.from.includes(6),
    "two numbers: a 1 whose hidden cells are all under the 1 beside it frees that one's other cell (the 1-1)");
  // 1-2-1 on a wall: under the 1 2 1 the two outer cells are mines, the middle safe; found from two numbers
  const wall = fieldOf("square", 5, 3, M(5, 3, [[2, 1], [2, 3]]), 2);
  const r = solve(wall, { keepSteps: true });
  check(r.solved && r.max <= 2, "a 1-2-1 is cleared with no more than two numbers at a time");
}

// ---------- fields dealt without a guess, at their level ----------
{
  const grades = {};
  let solved = 0, total = 0, startClear = 0, counts = 0, fit = 0, easyTop = 0, easyTotal = 0;
  for (const shape of shapes) for (const size of Object.keys(SIZES)) for (const level of Object.keys(LEVELS)) {
    const xs = [];
    for (let k = 1; k <= 3; k++) {
      const f = deal({ seed: k * 7717 + 3, shape, size, level });
      total++;
      if (solve(f).solved) solved++;
      if (!f.mine[f.start] && f.nb[f.start].every(j => !f.mine[j]) && f.nums[f.start] === 0) startClear++;
      if (f.count === dims({ shape, size, level }).count) counts++;
      const [lo, hi] = TARGET[shape][size][level].hard;
      if (f.grade.hard >= lo && f.grade.hard <= hi) fit++;
      if (level === "easy" && shape !== "tri") { easyTotal++; if (f.grade.top <= 1) easyTop++; }
      xs.push(f.grade.hard);
    }
    grades[`${shape}:${size}:${level}`] = xs.reduce((a, b) => a + b, 0) / xs.length;
  }
  check(solved === total, `every field dealt clears from its start by reasoning alone (${solved}/${total})`);
  check(startClear === total && counts === total, "every start is empty, with no mine round it, and every field has its level's mines");
  check(fit >= total * 0.9, `fields meet their level's reasoning (${fit}/${total}; the rest the closest of ${400} tried)`);
  check(easyTop === easyTotal, "an easy field of squares or hexes never needs more than one number at a time");
  const ordered = shapes.every(sh => Object.keys(SIZES).every(sz => grades[`${sh}:${sz}:easy`] <= grades[`${sh}:${sz}:medium`] && grades[`${sh}:${sz}:medium`] <= grades[`${sh}:${sz}:hard`]));
  check(ordered, "every shape and size: hard fields need more than medium, medium more than easy");
  const a = deal({ seed: 42, shape: "hex", size: "medium", level: "hard" }), b = deal({ seed: 42, shape: "hex", size: "medium", level: "hard" }), c = deal({ seed: 43, shape: "hex", size: "medium", level: "hard" });
  check(a.mine.join("") === b.mine.join("") && a.start === b.start && a.mine.join("") !== c.mine.join(""), "a seed deals the same field every time, another seed another");
  check(describe({ shape: "tri", size: "large", level: "easy" }) === "Large triangles, easy" && settingsOf({ shape: "x" }).shape === "square", "a field's name, and settings checked");
  check(Object.values(FIELDS).every(s => Object.keys(s).length === 3) && Object.values(MINES).every(s => Object.values(s).every(l => l.length === 3)), "three sizes of each shape, three levels' mines each");
}

// ---------- hints ----------
{
  const f = deal({ seed: 5, shape: "square", size: "small", level: "medium" }), run = newRun(f);
  check(hint(f, run) === null, "no hint before the start is dug");
  dig(f, run, f.start);
  let right = 0, given = 0;
  for (let guard = 0; guard < 200 && !run.done; guard++) {
    const h = hint(f, run);
    if (!h) break;
    given++;
    if (h.cells.every(c => !!f.mine[c] === h.mine) && h.from.length >= (h.level === 4 ? 0 : 1)) right++;
    for (const c of h.cells) { if (h.mine) flag(f, run, c); else dig(f, run, c); }
  }
  check(given > 3 && right === given && run.won && !run.strikes, `hints alone clear a field, every one right (${given})`);
  const g = deal({ seed: 6, shape: "square", size: "small", level: "easy" }), r2 = newRun(g);
  dig(g, r2, g.start);
  const safe = [...Array(g.n).keys()].find(i => r2.cells[i] === "." && !g.mine[i] && g.nb[i].some(j => r2.cells[j] === "o"));
  flag(g, r2, safe);
  let named = false;
  for (let guard = 0; guard < 100 && !named; guard++) {
    const h = hint(g, r2);
    if (!h) break;
    if (!h.mine && h.cells.includes(safe)) named = true;
    else for (const c of h.cells) { if (h.mine) { if (r2.cells[c] === ".") flag(g, r2, c); } else if (r2.cells[c] === ".") dig(g, r2, c); }
  }
  check(named, "a hint never trusts a flag: it can name a flagged cell safe");
}

// ---------- the computer rival ----------
{
  const ends = { steady: 0, quick: 0, sharp: 0 };
  let whole = true, rising = true;
  for (let k = 1; k <= 4; k++) {
    const f = deal({ seed: k * 31, shape: "square", size: "medium", level: "medium" });
    for (const pace of Object.keys(PACES)) {
      const p = rivalPlan(f, pace);
      ends[pace] += p.end;
      whole &&= p.open.at(-1) === f.n - f.count && rivalAt(p, p.end).done && rivalAt(p, p.end).share === 1;
      rising &&= p.times.every((t, i) => !i || t >= p.times[i - 1]) && p.open.every((o, i) => !i || o >= p.open[i - 1]);
      const again = rivalPlan(f, pace);
      whole &&= again.end === p.end;
    }
  }
  check(whole && rising, "the rival clears its copy of the field, a cell at a time, the same way each time for a field");
  check(ends.sharp < ends.quick && ends.quick < ends.steady, `sharp is quicker than quick, quick than steady (${Object.values(ends).map(e => Math.round(e / 4000)).join(" / ")} s a medium field)`);
}

// ---------- the split, and the computer partner ----------
{
  let both = 0, total = 0, alone = 0, whole = 0;
  for (const shape of shapes) for (const level of ["easy", "hard"]) for (let k = 1; k <= 2; k++) {
    const f = deal({ seed: k * 101, shape, size: "small", level, team: true });
    total++;
    if (needsBoth(f)) both++;
    if (solve(f, { sees: i => readerOf(f, i, 2) === 0 }).solved || solve(f, { sees: i => readerOf(f, i, 2) === 1 }).solved) alone++;
    if (solve(f, { sees: i => readerOf(f, i, 2) === 0 || readerOf(f, i, 2) === 1 }).solved) whole++;
  }
  check(both === total && !alone && whole === total, `a team's field: the two shares together clear it, neither alone does (${total} fields)`);
  // two computer partners, each reading its half, clear fields together, asking and telling when stuck
  let cleared = 0, games = 0, mineDug = 0, talked = 0;
  for (const [shape, size] of [["square", "small"], ["hex", "small"], ["tri", "small"]]) for (let k = 1; k <= 2; k++) {
    const f = deal({ seed: k * 557, shape, size, level: "medium", team: true }), run = newRun(f), told = new Set(), asked = [new Set(), new Set()];
    dig(f, run, f.start);
    games++;
    let t = 0, last = 0;
    for (let guard = 0; guard < 3000 && !run.done; guard++) {
      const ms = [0, 1].map(me => partnerMove(f, { cells: run.cells, told }, { me, pace: "sharp", stuckMs: t - last, asked: asked[me], seed: k }));
      const live = ms.map((m, me) => (m ? { ...m, me } : null)).filter(Boolean);
      if (!live.length) { if (t - last >= PRESS_AFTER) break; t = last + (t - last < SPEAK_AFTER ? SPEAK_AFTER : PRESS_AFTER); continue; }
      const m = live.sort((a, b) => a.wait - b.wait || a.me - b.me)[0];
      t += m.wait;
      if (m.kind === "dig") { if (dig(f, run, m.cell).struck >= 0) mineDug++; last = t; }
      else if (m.kind === "flag") { flag(f, run, m.cell, m.me); last = t; }
      else { asked[m.me].add(`${m.why}:${m.cell}`); told.add(m.cell); talked++; last = t; }
    }
    if (run.won) cleared++;
  }
  check(cleared === games && !mineDug && talked > 0, `two computer partners, each with half the numbers, clear every field without a mine, by talking (${talked} numbers shown)`);
  const f = deal({ seed: 9, shape: "square", size: "small", level: "medium", team: true }), run = newRun(f);
  dig(f, run, f.start);
  const quiet = partnerMove(f, { cells: run.cells, told: new Set() }, { me: 1, pace: "quick", stuckMs: 0 });
  check(!quiet || quiet.kind !== "point", "a partner says nothing before the field has stood still a while");
  check(readers({ runs: { s0: { begun: 1 }, s1: { begun: 1 }, s2: {} } }, [0], { 1: 5000 }).join() === "0,1"
    && readers({ runs: { s0: { begun: 1 }, s1: { begun: 1 } } }, [0], { 1: 60000 }).join() === "0", "a player away a moment keeps their share; away long, it goes to the others");
}

// ---------- the team's field at the table, through the database's round trip ----------
{
  const f = deal({ seed: 77, shape: "square", size: "small", level: "medium", team: true });
  const seat = (name, slot) => ({ name, slot, pid: `p${slot}`, online: true });
  let g = db(freshDuel({ a: seat("Korbi", 0), b: seat("Sarah", 1) }, { app: 1, match: { seed: 77, shape: "square", size: "small", level: "medium", mode: "team" }, now: 1000 }));
  sayReady(g, 0, [0, 1], 1000); sayReady(g, 1, [0, 1], 1200); g = db(g);
  check(!!g.start && !teamField(g, f), "the match starts for both, with no field until the first move");
  check(!teamMove(g, f, 1, { kind: "dig", cell: (f.start + 1) % f.n }, { now: 5000 }) || (f.start + 1) % f.n === f.start, "nothing but the start can be dug first");
  check(teamMove(g, f, 0, { kind: "dig", cell: f.start }, { now: 5000 }), "Korbi digs the start");
  g = db(g);
  const fd = teamField(g, f);
  check(fd && fd.cells.length === f.n && fd.told.length === f.n && fd.cells[f.start] === "o" && fd.by.s0.dug === 1, "the field comes back from the database whole: its cells and what's been shown, as strings");
  check(!teamMove(g, f, 1, { kind: "dig", cell: f.start }, { now: 5100 }), "a move made on an older copy (the start, open already) is set aside");
  const mine = [...Array(f.n).keys()].find(i => f.mine[i] && f.nb[i].some(j => fd.cells[j] === "o"));
  check(teamMove(g, f, 1, { kind: "flag", cell: mine }, { now: 5200 }) && db(g).field.cells[mine] === "1", "Sarah's flag is hers (her seat on it)");
  g = db(g);
  check(!teamMove(g, f, 0, { kind: "dig", cell: mine }, { now: 5300 }), "a flag keeps its cell from anyone's dig");
  const mineNum = [...Array(f.n).keys()].find(i => g.field.cells[i] === "o" && f.nums[i] > 0 && readerOf(f, i, 2) === 0);
  check(teamMove(g, f, 0, { kind: "tell", cell: mineNum }, { now: 5400 }) && db(g).field.told[mineNum] === "1" && db(g).field.pings.s0.cell === mineNum, "showing a number marks it for everyone, and rings it");
  g = db(g);
  check(teamMove(g, f, 1, { kind: "ping", cell: 3 }, { now: 5500 }) && db(g).field.pings.s1.cell === 3, "pointing rings a cell");
  g = db(g);
  // the two of them clear it, each move by whoever's turn it is, through the round trip every time
  let turn = 0;
  for (let guard = 0; guard < 400 && !teamField(g, f).end; guard++) {
    const fdNow = teamField(g, f), run = { cells: fdNow.cells, strikes: fdNow.strikes, hints: 0, ms: 0, done: false, won: false, lost: false };
    const h = hint(f, run);
    if (!h) break;
    const c = h.mine ? h.cells.find(x => fdNow.cells[x] === ".") : h.cells[0];
    if (c == null) break;
    teamMove(g, f, turn, { kind: h.mine ? "flag" : "dig", cell: c }, { now: 6000 + guard * 1000 });
    g = db(g);
    turn = 1 - turn;
  }
  const end = teamField(g, f).end;
  check(end?.won && teamScore(g, teamField(g, f)) === Math.round((end.at - g.start) / 1000), "the team clears its field: its time from the shared start");
  check(!teamMove(g, f, 0, { kind: "dig", cell: 0 }, { now: 1e6 }), "a field over takes no more moves");
  rematch(g, 0, { seed: 78, shape: "square", size: "small", level: "medium", mode: "team" });
  g = db(g);
  check(!teamField(g, f) && teamMove(g, f, 0, { kind: "ping", cell: 1 }, { now: 2e6 }) && g.field.n === g.n && !g.field.end, "a rematch leaves the old field behind; its first move starts a new one");
  const lost = db(freshDuel({ a: seat("Korbi", 0) }, { app: 1, match: { seed: 77, mode: "team" }, now: 1 }));
  startAll(lost, 10);
  teamMove(lost, f, 0, { kind: "dig", cell: f.start }, { now: 20 });
  const someMine = [...Array(f.n).keys()].find(i => f.mine[i]);
  teamMove(lost, f, 0, { kind: "dig", cell: someMine }, { now: 30, sudden: true });
  check(teamField(lost, f).end && !teamField(lost, f).end.won && teamField(lost, f).strikes === 1, "played sudden, the team's first mine ends its field");
  check(freshField(f, 3).cells === ".".repeat(f.n), "a fresh field is all hidden");
}

// ---------- a run kept as JSON, and today's field ----------
{
  const f = deal({ seed: 1234, shape: "hex", size: "small", level: "medium" });
  let run = newRun(f);
  dig(f, run, f.start);
  run = JSON.parse(JSON.stringify({ ...run, ms: 12345 }));
  for (let guard = 0; guard < 300 && !run.done; guard++) {
    const h = hint(f, run);
    if (!h) break;
    for (const c of h.cells) { if (h.mine) { if (run.cells[c] === ".") flag(f, run, c); } else dig(f, run, c); }
    run = JSON.parse(JSON.stringify(run));
  }
  check(run.won && run.ms === 12345 && safeLeft(f, run.cells) === 0, "a run kept as JSON at every move carries on to the end");
  check(WEEK.length === 7 && WEEK.every(d => SHAPES[d.shape] && SIZES[d.size] && LEVELS[d.level]), "a field for each day of the week");
  check(weekdayOf(20261019) === "Monday" && daily(20261019).size === "small" && daily(20261019).level === "easy" && daily(20261024).size === "large", "Monday's field is small and easy, Saturday's large");
  const day = 20261020, d1 = deal({ seed: day, ...daily(day) }), d2 = deal({ seed: day, ...daily(day) }), d3 = deal({ seed: day + 1, ...daily(day + 1) });
  check(d1.mine.join("") === d2.mine.join("") && d1.start === d2.start && (d1.mine.join("") !== d3.mine.join("") || d1.shape !== d3.shape), "today's field is the same on every device, tomorrow's another");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("mines: every field clears without a guess, at its level, alone or as a team");
