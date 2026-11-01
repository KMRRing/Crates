// Pipes' Plan (README, Pipes): the oil moves one square for each piece laid, after the level's first few, with no clock.
// What it has to do: wait at the wellhead until the lead's pieces are down; then move a square a piece (a tank holding
// it for TANK pieces); spill, win or reach the terminal exactly as Rush's oil does; run out to the end when asked,
// reaching the result the route showed beforehand (winsNow); play the same from the same seed and pieces, whether or not
// it was saved and read back in between (Undo and the page's saves rely on that); count a blast as a piece like any;
// leave Rush as it was; and be hard in the way the lead is set to make it, which a bot playing a few tries a move shows
// (a person who may stop and think plays better). Run: node tests/pipes-plan.mjs
import * as B from "../pipes-engine.js";
import { playPlan, choose } from "./pipes-plan-bot.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const at = (x, y) => y * B.COLS + x;

/** A level by hand: the wellhead at (1, 4) facing east, nothing else on the board; pieces are set down on P.grid and a
 *  beat given by hand, as laying one does. */
function hand({ lead = 2, quota = 4, cells = {} } = {}) {
  const L = { seed: 1, n: 1, quota, lead, fill: 3000, countdown: 25000, pace: 1, cells: Array(B.COLS * B.ROWS).fill(null), source: { c: at(1, 4), d: 1 }, terminal: null };
  L.cells[L.source.c] = { k: "source", d: 1 };
  for (const [c, f] of Object.entries(cells)) L.cells[c] = f;
  return { L, P: B.newPlay(L, true) };
}
const lay = (L, P, c, piece) => { P.grid[c] = piece; B.beat(L, P); };

// ---------- the lead, and the oil's steps ----------
{
  const { L, P } = hand({ lead: 3 });
  check(P.plan && P.lead === 3 && P.undos === B.UNDOS && !P.flowing, "a Plan level starts with its lead and its undos, the oil not out");
  lay(L, P, at(2, 4), "h"); lay(L, P, at(3, 4), "h");
  check(!P.flowing && P.lead === 1, "the oil waits while the lead's pieces are being laid");
  lay(L, P, at(4, 4), "h");
  check(P.flowing && P.path.length === 1 && P.path[0].a === -1 && P.count === 0, "the piece that makes the lead lets the oil out at the wellhead, nothing passed yet");
  lay(L, P, at(5, 4), "h");
  check(P.path.length === 2 && P.path[1].c === at(2, 4) && P.count === 0, "the next piece moves it from the wellhead into the first square");
  lay(L, P, at(6, 4), "h");
  check(P.path.length === 3 && P.path[2].c === at(3, 4) && P.count === 1 && P.pts.pipe === B.POINTS.pipe, "each piece after moves it one square on, and the square it leaves is passed");
  check(P.t === 0 && P.lockUntil === 0, "Plan keeps no clock");
}

// ---------- spills and wins ----------
{
  // the oil at the open end with a piece laid elsewhere: it runs into the empty square
  const { L, P } = hand({ lead: 1, quota: 3 });
  lay(L, P, at(2, 4), "h");                                   // lead met: out
  lay(L, P, at(3, 4), "h");                                   // into (2, 4)
  lay(L, P, at(6, 1), "h");                                   // a piece elsewhere: into (3, 4), (2, 4) passed
  lay(L, P, at(7 - 1, 2), "h");                               // passes (3, 4), then (4, 4) is empty
  check(P.over && P.over.why === "open" && !P.over.win && P.count === 2, `short of the quota, a spill into an empty square ends the run (${P.over?.why}, ${P.count} passed)`);
}
{
  const { L, P } = hand({ lead: 1, quota: 2 });
  lay(L, P, at(2, 4), "h"); lay(L, P, at(3, 4), "h"); lay(L, P, at(4, 4), "h"); lay(L, P, at(2, 1), "h");
  check(P.count === 2 && !P.over, "two passed");
  lay(L, P, at(2, 2), "h"); lay(L, P, at(2, 3), "h");
  check(P.over && P.over.win && P.over.why === "open" && P.pts.unused < 0, "past the quota a spill is a level cleared, the pieces it never reached cost their points");
}
{
  const { L, P } = hand({ lead: 1, quota: 1, cells: { [at(3, 4)]: { k: "rock" } } });
  lay(L, P, at(2, 4), "h"); lay(L, P, at(0, 0), "h"); lay(L, P, at(0, 1), "h");
  check(P.over?.why === "rock" && P.over.win, "into rock ends the level (cleared past the quota)");
}
{
  const { L, P } = hand({ lead: 1, quota: 1 });
  lay(L, P, at(2, 4), "ne");                                  // a bend that takes the oil in from the west? it doesn't: ne is north and east
  lay(L, P, at(0, 0), "h"); lay(L, P, at(0, 1), "h");
  check(P.over?.why === "shape" && !P.over.win, "into a piece that doesn't take it in is a spill");
}
{
  // the terminal: refused before the quota, a clean end with its bonus after
  for (const [quota, why, win] of [[3, "early", false], [1, "terminal", true]]) {
    const { L, P } = hand({ lead: 1, quota });
    L.cells[at(4, 4)] = { k: "terminal", d: 3 }; L.terminal = { c: at(4, 4), d: 3 };
    lay(L, P, at(2, 4), "h"); lay(L, P, at(3, 4), "h"); lay(L, P, at(0, 0), "h"); lay(L, P, at(0, 1), "h");
    check(P.over?.why === why && P.over.win === win && (why === "terminal" ? P.pts.terminal === B.POINTS.terminal : P.pts.terminal === 0), `the terminal after ${quota - 0} needed: ${why}`);
  }
}

// ---------- tanks ----------
{
  const { L, P } = hand({ lead: 1, quota: 9, cells: { [at(3, 4)]: { k: "tank", piece: "h" } } });
  lay(L, P, at(2, 4), "h"); lay(L, P, at(4, 4), "h"); lay(L, P, at(5, 4), "h");    // out, into (2, 4), into the tank
  check(P.path[P.path.length - 1].c === at(3, 4) && P.beats === 0, "the oil enters the tank");
  const held = [];
  for (let i = 0; i < B.TANK; i++) { lay(L, P, at(0, i), "h"); held.push(P.path[P.path.length - 1].c); }
  check(held.slice(0, B.TANK - 1).every(c => c === at(3, 4)) && held[B.TANK - 1] === at(4, 4), `a tank holds it for ${B.TANK} pieces`);
  check(P.p === 0 && P.count === 2, "and it has passed the pipe and the tank once it's through");
}

// ---------- running out ----------
{
  const { L, P } = hand({ lead: 5, quota: 3 });
  for (let x = 2; x <= 6; x++) P.grid[at(x, 4)] = "h";
  check(B.winsNow(L, P), "a route that clears the quota is one the oil would win");
  B.runOut(L, P);
  check(P.over?.win && P.count === 5 && P.flowing, "running out lets the oil go before its lead is laid and carries it to the end");
}
{
  const { L, P } = hand({ lead: 5, quota: 6 });
  for (let x = 2; x <= 5; x++) P.grid[at(x, 4)] = "h";
  check(!B.winsNow(L, P), "a route short of the quota isn't");
  B.runOut(L, P);
  check(P.over && !P.over.win, "and running it out loses");
}
{
  // winsNow tells beforehand what running out does, over whatever the bot has built, level by level
  let tried = 0, wrong = 0;
  for (const n of [1, 3, 5, 8, 12]) for (let s = 1; s <= 8; s++) {
    const L = B.deal(s * 104729, n), P = B.newPlay(L, true), r = B.rng(s * 31 + n);
    for (let g = 0; g < 40 && !P.over; g++) {
      const c = choose(L, P, r);
      if (c < 0) break;
      B.place(L, P, c);
      if (P.over) break;
      if (g % 3) continue;
      const Q = JSON.parse(JSON.stringify(P)), says = B.winsNow(L, P);
      B.runOut(L, Q);
      tried++;
      if (!Q.over || Q.over.win !== says) wrong++;
    }
  }
  check(tried > 100 && wrong === 0, `winsNow agrees with running out in ${tried - wrong} of ${tried} positions`);
}

// ---------- blasts, saves and Rush ----------
{
  const L = B.deal(4242, 1), P = B.newPlay(L, true), c = at(0, 0);
  const free = [...Array(B.COLS * B.ROWS).keys()].find(i => !L.cells[i] && i !== c);
  const lead = P.lead;
  check(B.place(L, P, c) === "laid" && P.lead === lead - 1, "a piece laid in Plan gives the oil a beat");
  check(B.place(L, P, c) === "blast" && P.lead === lead - 2 && P.blasts === 1 && P.pts.blast === B.POINTS.blast && P.lockUntil === 0, "a blast costs its points and is a piece like any: the beat, and no moment lost");
  check(B.place(L, P, free) === "laid", "and the next square can be laid at once");
}
{
  // the same pieces on the same seed play the same; a level saved and read back in the middle plays on the same
  const L = B.deal(777, 4), r = B.rng(5), moves = [], A = B.newPlay(L, true);
  for (let g = 0; g < 60 && !A.over; g++) { const c = choose(L, A, r); if (c < 0) break; B.place(L, A, c); moves.push(c); }
  const run = (cut = -1) => {
    let P = B.newPlay(L, true);
    moves.forEach((c, i) => { if (i === cut) { const { undos, ...rest } = P; P = { ...JSON.parse(JSON.stringify(rest)), undos }; } B.place(L, P, c); });
    return JSON.stringify(P);
  };
  check(run() === JSON.stringify(A), "the same level and the same pieces end the same");
  check([3, 10, 20, moves.length - 1].every(cut => run(cut) === run()), "a level saved and read back in at any piece plays on exactly as it would have (what Undo and the page's saves rely on)");
  // a snapshot taken before a piece, restored, is the level before it
  const P = B.newPlay(L, true);
  moves.slice(0, 12).forEach(c => B.place(L, P, c));
  const { undos, ...before } = P, snap = JSON.stringify(before), as = JSON.stringify({ ...before, undos: 0 });    // (before shares P's arrays, which the next piece changes)
  B.place(L, P, moves[12]);
  const back = { ...JSON.parse(snap), undos: undos - 1 };
  check(P.next === 13 && JSON.stringify({ ...back, undos: 0 }) === as && back.next === 12 && back.undos === B.UNDOS - 1, "taking a piece back restores the level (and the queue) as it stood, an undo the poorer");
}
{
  const L = B.deal(1, 1), P = B.newPlay(L), Q = B.newPlay(L, true);
  check(!("plan" in P) && !("lead" in P) && Object.keys(Q).length > Object.keys(P).length, "Rush's level has none of Plan's state");
  const c = [...Array(B.COLS * B.ROWS).keys()].find(i => !L.cells[i]);
  B.place(L, P, c);
  check(!P.flowing && P.path.length === 0 && P.next === 1, "and laying a piece in Rush starts no oil");
  B.advance(L, P, L.countdown);
  check(P.flowing, "which still waits out the countdown");
}
{
  const leads = Array.from({ length: 40 }, (_, i) => B.levelOf(i + 1).lead);
  check(leads[0] === 15 && leads.every((v, i) => i === 0 || v <= leads[i - 1]) && Math.min(...leads) === 5 && B.deal(9, 7).lead === B.levelOf(7).lead, `the lead starts at ${leads[0]} pieces and runs down to ${Math.min(...leads)} by level ${leads.indexOf(5) + 1}`);
}

// ---------- how hard it is ----------
{
  const N = 30, wins = {};
  for (const n of [1, 6, 12]) { wins[n] = 0; for (let s = 1; s <= N; s++) if (playPlan(s * 7919, n).P.over?.win) wins[n]++; }
  console.log(`    bot: level 1 ${wins[1]}/${N}, level 6 ${wins[6]}/${N}, level 12 ${wins[12]}/${N}`);
  check(wins[1] >= 27, "the bot, a few tries a move, clears nearly every first level");
  check(wins[6] >= 12 && wins[6] <= 27, "wins most but not all of the sixth levels");
  check(wins[12] <= 9 && wins[12] < wins[6], "and few of the twelfth: the levels get harder as the lead runs down and the quota and rock grow");
}

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
