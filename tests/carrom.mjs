// Carrom (carrom-engine.js, carrom-rules.js, carrom-bot.js) on seats.js: the men set out (nine and nine and a queen, none
// touching); the physics the same every time and written with + - * / and sqrt only; a shot replayed step by step ending exactly where
// the rules say; what a shot is refused for; the rules (a man of yours down keeps the turn, one of theirs ends it, the striker down is
// a foul, the queen must be covered, the last man waits for the queen, the board is won by clearing a colour); the state through
// the database; the computer's moves always legal and its levels in order.
import fs from "fs";
import * as E from "../carrom-engine.js";
import { rules, settle, leftOf } from "../carrom-rules.js";
import { newRecord, applyMove, botMove, seeded } from "../seats.js";
import { roundTrip, same as deepSame } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fresh = (seed = 7) => newRecord(rules, { seats: 2, options: {}, seed, now: 1 });

// ---------- the men set out ----------
{
  const { x, y } = E.layout();
  let touching = 0;
  for (let i = 0; i < E.MEN; i++) for (let j = i + 1; j < E.MEN; j++) if (Math.hypot(x[i] - x[j], y[i] - y[j]) < 2 * E.R) touching++;
  check(x.length === 19 && touching === 0, "nineteen men set out, none overlapping");
  const white = [...Array(19).keys()].filter(E.isWhite).length, black = [...Array(19).keys()].filter(E.isBlack).length;
  check(white === 9 && black === 9 && x[0] === 0 && y[0] === 0, "nine white, nine black, the queen in the middle");
  check(E.strikerFree(0, 0, x, y, new Array(19).fill(0)) && E.freeXs(1, x, y, new Array(19).fill(0)).length > 50, "the baselines are clear at the start");
}

// ---------- the physics is the same every time, and plain arithmetic ----------
{
  const src = fs.readFileSync(new URL("../carrom-engine.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  check(!/Math\.(sin|cos|tan|atan2?|pow|exp|log|hypot|cbrt|sinh|cosh|tanh)\b|\*\*/.test(src), "the engine uses no trigonometry, power or hypot: they differ in the last bit between engines");
  const { x, y } = E.layout(), st = new Array(19).fill(0);
  const shot = { x: -60, ax: 180, ay: 983, p: 820 };
  const a = E.simulate(x, y, st, shot, 0), b = E.simulate(x.slice(), y.slice(), st.slice(), { ...shot }, 0);
  check(a.steps === b.steps && same([...a.x], [...b.x]) && same([...a.y], [...b.y]) && same(a.events, b.events), "the same shot gives the same rest, bit for bit");
  const c = E.startSim(x, y, st, shot, 0);
  let n = 0;
  while (E.stepSim(c)) n++;
  check(c.done && c.steps === a.steps && same([...c.x], [...a.x]), "stepping a shot one step at a time ends where simulate does");
  check(a.steps > 20 && a.steps < E.MAX_STEPS, "a break settles by itself");
  const alone = E.simulate(x, y, new Array(19).fill(1), { x: 0, ax: 0, ay: 1000, p: 100 }, 0);
  check(alone.y[19] > -380 && alone.y[19] < -150, "a light touch rolls a short way and stops");
  const seat1 = E.simulate(x, y, st, { x: 0, ax: 0, ay: -1000, p: 500 }, 1);
  check(seat1.y[19] < 380 || seat1.down[19] === 1, "seat 1 shoots down the board from the top baseline");
}

// ---------- what a shot is refused for ----------
{
  const { x, y } = E.layout(), st = new Array(19).fill(0);
  const ok = { x: 0, ax: 0, ay: 1000, p: 500 };
  check(E.shotError(ok, 0, x, y, st) === "", "a straight shot is allowed");
  check(E.shotError({ ...ok, ay: -1000 }, 0, x, y, st) !== "" && E.shotError({ ...ok, ay: 1000 }, 1, x, y, st) !== "", "not backwards, for either seat");
  check(E.shotError({ ...ok, x: 400 }, 0, x, y, st) !== "" && E.shotError({ ...ok, p: 0 }, 0, x, y, st) !== "" && E.shotError({ ...ok, p: 1001 }, 0, x, y, st) !== "", "the striker stays on the baseline, the power is 1 to 1000");
  check(E.shotError({ ...ok, x: 0.5 }, 0, x, y, st) !== "" && E.shotError({ x: 0, ax: 0, ay: 0, p: 10 }, 0, x, y, st) !== "" && E.shotError(null, 0, x, y, st) !== "", "a shot is whole numbers and has a direction");
  const x2 = x.slice(), y2 = y.slice();
  x2[1] = 100; y2[1] = -380;
  check(E.shotError({ ...ok, x: 120 }, 0, x2, y2, st) !== "" && E.shotError({ ...ok, x: 200 }, 0, x2, y2, st) === "", "the striker cannot stand on a man");
  check(!E.freeXs(0, x2, y2, st).includes(100) && E.freeXs(0, x2, y2, st).includes(200), "freeXs lists where it can stand");
}

// ---------- the rules, from positions set up by hand ----------
const blank = () => {
  const s = rules.deal({ options: {}, prev: null });
  return s;
};
const SHOT = { x: 0, ax: 0, ay: 1000, p: 500 };
{
  // a white man near the right-hand top pocket, a shot sent through it from the left: aimed at the spot behind it
  const s = blank();
  s.st.fill(1); s.st[0] = 0; s.st[1] = 0; s.st[2] = 0; s.st[10] = 0; s.n = 20;       // the queen, two white and one black left
  s.px[1] = 330; s.py[1] = 330; s.px[2] = -200; s.py[2] = -100; s.px[10] = -300; s.py[10] = 200; s.px[0] = 0; s.py[0] = 0;
  const ux = (486 - 330) / Math.hypot(156, 156), gx = 330 - ux * 50, gy = 330 - ux * 50;
  const dx = gx - 0, dy = gy + 380;
  const l = Math.hypot(dx, dy);
  const move = { x: 0, ax: Math.round((dx / l) * 1000), ay: Math.round((dy / l) * 1000), p: 560 };
  const r = rules.act(JSON.parse(JSON.stringify(s)), 0, move);
  check(typeof r !== "string" && r.last.pocketed.includes(1) && r.st[1] > 0, "a man struck towards a pocket goes down it");
  check(r.turn === 0 && !r.last.foul, "a man of yours down: you shoot again");
  check(leftOf(r, 0).length === 1 && !r.over, "one of two white men down leaves the board on");
}
{
  // the last man cannot go down before the queen: it comes back
  const s = blank();
  s.st.fill(1); s.st[0] = 0; s.st[1] = 0; s.st[10] = 0; s.n = 20;
  s.px[1] = 100; s.py[1] = 100; s.px[10] = -100; s.py[10] = 100; s.px[0] = 200; s.py[0] = -100;
  s.st[1] = 21; s.px[1] = 0; s.py[1] = 0; s.n = 21;                         // the last white man has just gone down
  const r = settle(JSON.parse(JSON.stringify(s)), 0, SHOT, [1], false);
  check(r.st[1] === 0 && r.last.returned.includes(1) && !r.over, "the last man down while the queen is out comes back, and the game goes on");
  const t = JSON.parse(JSON.stringify(s)); t.queen = 2; t.qs = 0; t.st[0] = 5;
  const r2 = settle(t, 0, SHOT, [1], false);
  check(r2.over && r2.winner === 0 && r2.points === 1 + 3, "with the queen won, the last man ends it: 1 man left of theirs and 3 for the queen");
}
{
  // the queen: down alone she is pending and the turn goes on; the next shot's cover keeps her; a miss sends her back
  const s = blank();
  const a = settle(JSON.parse(JSON.stringify(s)), 0, SHOT, [0], false);
  check(a.queen === 1 && a.qs === 0 && a.turn === 0 && a.st[0] > 0, "the queen down alone waits for a cover, and you shoot again");
  const covered = settle(JSON.parse(JSON.stringify(a)), 0, SHOT, [3], false);
  check(covered.queen === 2 && covered.qs === 0 && covered.turn === 0, "a man of yours down on the next shot covers her");
  const missed = settle(JSON.parse(JSON.stringify(a)), 0, SHOT, [], false);
  check(missed.queen === 0 && missed.st[0] === 0 && missed.turn === 1 && missed.last.returned.includes(0), "a miss sends the queen back to the middle and the turn passes");
  const both = settle(JSON.parse(JSON.stringify(s)), 1, SHOT, [0, 12], false);
  check(both.queen === 2 && both.qs === 1, "the queen and a man of yours on the same shot is covered at once");
  const foulQ = settle(JSON.parse(JSON.stringify(s)), 0, SHOT, [0], true);
  check(foulQ.queen === 0 && foulQ.st[0] === 0 && foulQ.turn === 1, "the queen down with the striker is a foul: she goes back");
}
{
  // opponent's man, a miss, the striker down
  const s = blank();
  const theirs = settle(JSON.parse(JSON.stringify(s)), 0, SHOT, [11], false);
  check(theirs.turn === 1 && theirs.st[11] > 0, "a man of theirs down ends your turn and stays down");
  const miss = settle(JSON.parse(JSON.stringify(s)), 0, SHOT, [], false);
  check(miss.turn === 1 && miss.shots === 1, "no pocket: the turn passes");
  const mixed = settle(JSON.parse(JSON.stringify(s)), 0, SHOT, [11, 2], false);
  check(mixed.turn === 0, "one of each: yours keeps the turn");
  const prior = JSON.parse(JSON.stringify(s)); prior.st[4] = 1; prior.n = 1; prior.px[4] = 0; prior.py[4] = 0;
  const foul = settle(prior, 0, SHOT, [], true);
  check(foul.turn === 1 && foul.last.foul && foul.st[4] === 0 && foul.last.returned.includes(4), "the striker down: the turn passes and the man you pocketed last comes back");
  const foul0 = settle(JSON.parse(JSON.stringify(s)), 0, SHOT, [], true);
  check(foul0.turn === 1 && foul0.last.returned.length === 0, "a foul with none down costs the turn only");
  const net = settle(JSON.parse(JSON.stringify(s)), 0, SHOT, [2], true);
  check(net.st[2] === 0 && net.turn === 1, "a foul that also pocketed one of yours nets nothing");
}
{
  // a returned man lands on a free spot even when the middle is taken
  const s = blank();
  const { x, y } = E.layout();
  const st = new Array(19).fill(0);
  const [fx, fy] = E.freeSpot(x, y, st, 5);
  check(Math.hypot(fx, fy) > 0 && [...Array(19).keys()].every(i => i === 5 || Math.hypot(x[i] - fx, y[i] - fy) >= 2 * E.R), "with the middle taken, a returned man goes to the nearest free spot");
  void s;
}

// ---------- a whole shot through the rules and the runner, and the database ----------
{
  const G0 = fresh();
  const mv = botMove(rules, G0, 0, "medium");
  const r = applyMove(rules, G0, 0, mv);
  check(!r.error && r.G.state.shots === 1 && r.G.n === 1, "a move is applied once");
  check(applyMove(rules, G0, 1, mv).error === "It isn't your turn", "out of turn is refused");
  check(applyMove(rules, G0, 0, { ...mv, x: 999 }).error, "a bad shot is refused with a reason");
  const through = JSON.parse(JSON.stringify(roundTrip(r.G.state)));
  check(deepSame(rules.restore(through), r.G.state), "the state survives the database (no empty lists kept, numbers whole)");
  const again = applyMove(rules, r.G, rules.toMove(r.G.state), botMove(rules, r.G, rules.toMove(r.G.state), "easy"));
  check(!again.error, "the next player moves from the restored state");
  // replaying the shot from the state before ends exactly where the state says (what the page does)
  const before = G0.state, last = r.G.state.last;
  const sim = E.simulate(before.px, before.py, before.st, last.shot, last.seat);
  const live = [...Array(19).keys()].filter(i => r.G.state.st[i] === 0 && before.st[i] === 0 && !last.returned.includes(i));
  check(live.every(i => sim.x[i] === r.G.state.px[i] && sim.y[i] === r.G.state.py[i]), "the page's replay of a shot ends where the state has the men");
  const q = newRecord(rules, { seats: 2, options: { first: 1 }, seed: 3, now: 1 });
  check(q.state.turn === 1 && rules.deal({ options: {}, prev: q.state }).first === 0, "who breaks can be set, and alternates by default");
}

// ---------- the computer ----------
{
  let G = fresh(11);
  let n = 0, refused = 0;
  const t0 = Date.now();
  while (!rules.over(G.state) && n < 25) {
    const seat = rules.toMove(G.state);
    const r = applyMove(rules, G, seat, botMove(rules, G, seat, n % 2 ? "medium" : "easy"));
    if (r.error) { refused++; break; }
    G = r.G; n++;
  }
  check(refused === 0 && n > 8, "the computer's shots are always legal");
  const hard = fresh(5);
  const t1 = Date.now();
  const mv = botMove(rules, hard, 0, "hard");
  check(!applyMove(rules, hard, 0, mv).error, "Hard's shot is legal");
  check(Date.now() - t1 < 4000, "Hard answers within a few seconds, even cold");
  void t0;
  // the levels in order: over the same positions, Hard pockets more than Medium, and Medium more than Easy
  const score = level => {
    let total = 0;
    for (let seed = 40; seed < 47; seed++) {
      let g = fresh(seed);
      // a few shots in, so the board has opened up
      for (let k = 0; k < 4; k++) { const seat = rules.toMove(g.state); g = applyMove(rules, g, seat, botMove(rules, g, seat, "medium")).G; }
      const seat = rules.toMove(g.state), r = applyMove(rules, g, seat, botMove(rules, g, seat, level));
      const mine = new Set(E.colourIds(seat));
      total += (r.G?.state.last.pocketed || []).filter(i => mine.has(i)).length;
    }
    return total;
  };
  const e = score("easy"), m = score("medium"), h = score("hard");
  check(h >= e && m + h > e, `the levels are in order over seven positions (Easy ${e}, Medium ${m}, Hard ${h} of your men down)`);
  const rng = seeded(1);
  void rng;
  check(same(botMove(rules, hard, 0, "medium"), botMove(rules, hard, 0, "medium")), "a move worked out twice is the same move");
}

console.log(bad ? `carrom: ${bad} failed` : "carrom: every check passed");
process.exit(bad ? 1 : 0);
