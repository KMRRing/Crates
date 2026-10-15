// Finds Gammon's rush puzzles: games the computer players play among themselves (Medium), and now and then a roll
// with a real choice (four plays or more), every play it allows asked of GNU Backgammon (tools/gnubg.mjs: money play,
// 2-ply; gnubg is GPL, so only its equities are kept): a puzzle is kept when its best play is ahead of the next by
// MARGIN of a game or more. Pure races are kept more rarely than positions with contact. Writes JSON lines; then merge
// writes gammon-puzzles.js, rated 1 to 10 by rank (the computer players missing it, Medium and Hard, a closer call,
// more plays to choose from make one harder), at most BANK of them.
// Run: GNUBG_HINTS=<the package's folder> node tools/gammon-puzzles.mjs <first game> <games> <out.jsonl>;
//      node tools/gammon-puzzles.mjs merge <files…>
import * as fs from "node:fs";
import { start, plays, apply, pips } from "../gammon-board.js";
import { botTurn, contact } from "../gammon-bot.js";
import { sideText, playOf, playText, boardOf, diceOf } from "../gammon-course.js";
import { motifsOf } from "../gammon-rush.js";

const MARGIN = 0.06, BANK = 400;
const key = (me, op) => `${me.join()}|${op.join()}`;

if (process.argv[2] === "merge") {
  const found = process.argv.slice(3).flatMap(f => fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)));
  const seen = new Set(), all = [];
  for (const p of found) {
    const k = `${p.me}|${p.op}|${p.dice}`;
    if (seen.has(k)) continue;
    seen.add(k);
    // the plays written as the course writes them now (a checker moved on as one path); what the best does, named
    // again; whether Hard (a roll further) finds it too
    const { me, op } = boardOf(p), named = t => playText(playOf(p, t).moves, op);
    Object.assign(p, { opts: p.opts.map(named), best: named(p.best), ok: p.ok.map(named) });
    const best = playOf(p, p.best);
    let m = me, o = op;
    for (const mv of botTurn(me, op, diceOf(p), { level: "hard" })) [m, o] = apply(m, o, mv);
    Object.assign(p, { why: motifsOf(p, p.best, p.opts[1]), hard: key(m, o) === key(best.me, best.op) });
    delete p.easy;
    all.push(p);
  }
  // contact first, a race now and then (at most a fifth of the bank), each spread over all the games found
  const spread = (list, n) => (list.length <= n ? list : [...Array(n)].map((_, i) => list[Math.floor((i * list.length) / n)]));
  const races = all.filter(p => p.race), rest = all.filter(p => !p.race), nRaces = Math.min(races.length, Math.floor(BANK / 5));
  const pick = [...spread(rest, BANK - nRaces), ...spread(races, nRaces)];
  const gap = p => p.vals[0] - p.vals[1];
  const score = p => (p.medium ? 0 : 2) + (p.hard ? 0 : 2) + (1 - Math.min(gap(p), 0.5) / 0.5) * 2 + Math.min(p.opts.length, 40) / 20;
  pick.sort((a, b) => score(a) - score(b) || a.g - b.g);
  pick.forEach((p, i) => { p.r = 1 + Math.floor((10 * i) / pick.length); });
  pick.sort((a, b) => a.r - b.r || a.g - b.g).forEach((p, i) => { p.id = `g${String(i + 1).padStart(3, "0")}`; delete p.g; });
  const head = `// Gammon's rush puzzles, found by tools/gammon-puzzles.mjs (don't edit: run it again). Each is a position from the
// computer players' own games, written as the course writes its steps (gammon-course.js: me, op, dice), with every play
// the roll allows (opts, as players write them) and GNU Backgammon's equity for each (vals, money play, best first),
// the best and those as good (ok), what the best does (why), whether it's a pure race, whether the computer players
// found it (medium, hard), and a rating (r, 1-10).\n`;
  fs.writeFileSync(new URL("../gammon-puzzles.js", import.meta.url), `${head}export const PUZZLES = [\n${pick.map(p => JSON.stringify(p)).join(",\n")},\n];\n`);
  console.log(`${pick.length} puzzles of ${all.length}; by rating ${[...Array(10)].map((_, i) => pick.filter(p => p.r === i + 1).length).join(" ")}; races ${pick.filter(p => p.race).length}`);
  process.exit(0);
}

const { hints, shutdown } = await import("./gnubg.mjs");
const first = Number(process.argv[2] || 1), games = Number(process.argv[3] || 10), out = process.argv[4] || "gammon-puzzles.jsonl";
const seeded = n => () => (n = (n * 16807) % 2147483647) / 2147483647;
let tried = 0, kept = 0;
const t0 = Date.now();
for (let g = first; g < first + games; g++) {
  const rng = seeded(g * 7919 + 5), die = () => 1 + Math.floor(rng() * 6);
  let me = start(), op = start(), turn = 0;
  for (; turn < 200 && me[0] < 15 && op[0] < 15; turn++) {
    let dice = [die(), die()];
    while (turn === 0 && dice[0] === dice[1]) dice = [die(), die()];
    const legal = plays(me, op, dice).filter(p => p.unique), race = !contact(me, op);
    if (legal.length >= 4 && rng() < (race ? 0.08 : 0.3)) {
      tried++;
      const list = await hints(me, op, dice, 200);
      if (list.length === legal.length && list[0].equity - list[1].equity >= MARGIN) {
        const step = { me: sideText(me), op: sideText(op), dice: `${dice[0]} ${dice[1]}` };
        const at = moves => { let m = me, o = op; for (const mv of moves) [m, o] = apply(m, o, mv); return key(m, o); };
        const best = list[0], ok = list.filter(h => best.equity - h.equity < MARGIN / 2).map(h => h.text);
        const medium = at(botTurn(me, op, dice, { level: "medium" })) === key(best.me, best.op);
        const p = { id: "", g, ...step, opts: list.map(h => h.text), vals: list.map(h => Math.round(h.equity * 1000) / 1000), best: best.text, ok, why: motifsOf(step, best.text, list[1].text), race, medium };
        if (playOf(step, best.text)) { fs.appendFileSync(out, JSON.stringify(p) + "\n"); kept++; }
      }
    }
    const moves = botTurn(me, op, dice, { level: "medium", rng });
    for (const mv of moves) [me, op] = apply(me, op, mv);
    [me, op] = [op, me];
  }
  process.stdout.write(`game ${g}: ${kept} puzzles from ${tried} tried, ${((Date.now() - t0) / 1000).toFixed(0)} s (${pips(me)} v ${pips(op)})\n`);
}
shutdown();
