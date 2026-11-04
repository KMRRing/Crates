// Yacht (yacht-rules.js, yacht-bot.js, yacht-3d-geo.js): what each category scores, the bonus, the dice (the same from a
// seed however they're held, which is what makes the daily comparable), a turn's rules (three rolls, holds, a category
// once), the game's end and its winners, the state through the database, whole games of computer players at every size and
// strength, what Hard does with obvious dice, and where the 3D dice come to rest.
import { rules, scoreOf, totals, dieAt, winners, openOf, ROUNDS, CATS } from "../yacht-rules.js";
import { botMove, advise, worth } from "../yacht-bot.js";
import { scatterSpots, heldSpot, SCATTER, FELT, DIE, keyNumber } from "../yacht-3d-geo.js";
import { newRecord, applyMove, botMove as seatBot, seeded } from "../seats.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const [ONES, TWOS, , , , SIXES, HOUSE, FOUR, LITTLE, BIG, CHOICE, YACHT] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

// ---------- the categories ----------
check(scoreOf(ONES, [1, 1, 3, 4, 1]) === 3 && scoreOf(SIXES, [6, 6, 2, 6, 6]) === 24 && scoreOf(TWOS, [1, 3, 4, 5, 6]) === 0, "Ones to Sixes: the face times how many show");
check(scoreOf(HOUSE, [3, 3, 3, 5, 5]) === 19 && scoreOf(HOUSE, [3, 3, 3, 5, 4]) === 0 && scoreOf(HOUSE, [4, 4, 4, 4, 4]) === 0, "full house: three and two, all five added; five alike is not one");
check(scoreOf(FOUR, [2, 2, 2, 2, 6]) === 14 && scoreOf(FOUR, [5, 5, 5, 5, 5]) === 25 && scoreOf(FOUR, [2, 2, 2, 6, 6]) === 0, "four of a kind: all five added, five alike counts");
check(scoreOf(LITTLE, [5, 4, 3, 2, 1]) === 30 && scoreOf(LITTLE, [1, 2, 3, 4, 6]) === 0 && scoreOf(LITTLE, [2, 3, 4, 5, 6]) === 0, "little straight is 1-2-3-4-5 and only that");
check(scoreOf(BIG, [6, 5, 4, 3, 2]) === 30 && scoreOf(BIG, [1, 2, 3, 4, 5]) === 0 && scoreOf(BIG, [2, 3, 4, 5, 5]) === 0, "big straight is 2-3-4-5-6 and only that");
check(scoreOf(CHOICE, [1, 2, 3, 4, 6]) === 16 && scoreOf(YACHT, [4, 4, 4, 4, 4]) === 50 && scoreOf(YACHT, [4, 4, 4, 4, 3]) === 0, "choice is the sum, yacht five alike for 50");
{
  const sheet = Array(12).fill(-1);
  [3, 6, 9, 12, 15, 18].forEach((v, c) => (sheet[c] = v));                 // three of each face: 63
  check(totals(sheet).bonus === 35 && totals(sheet).total === 63 + 35 && totals(sheet).upper === 63, "63 in the upper section earns 35");
  sheet[5] = 15;
  check(totals(sheet).bonus === 0 && totals(sheet).total === 60, "60 does not (and open categories count nothing)");
  sheet[YACHT] = 50; sheet[CHOICE] = 0;
  check(totals(sheet).total === 110 && openOf(sheet).length === 4, "the lower section adds, zeros count as taken");
}

// ---------- the dice ----------
{
  let a = 0, ok = true;
  for (let i = 0; i < 6000; i++) { const d = dieAt(12345, i >> 4, i % 4, 1 + (i % 3), i % 5); if (d < 1 || d > 6) ok = false; a += d; }
  check(ok && Math.abs(a / 6000 - 3.5) < 0.1, `the dice are 1 to 6 and fair (mean ${(a / 6000).toFixed(2)})`);
  const counts = Array(7).fill(0);
  for (let i = 0; i < 12000; i++) counts[dieAt(99, i, 0, 1, 0)]++;
  check(counts.slice(1).every(c => Math.abs(c - 2000) < 160), `each face about a sixth (${counts.slice(1).join(", ")})`);
}
{
  // the same seed, two players holding differently: the dice come from where they are in the game, not from what was held
  const rec = () => newRecord(rules, { seats: 1, seed: 7, now: 0 });
  let A = rec(), B = rec();
  A = applyMove(rules, A, 0, { t: "roll" }).G;
  B = applyMove(rules, B, 0, { t: "roll" }).G;
  check(JSON.stringify(A.state.dice) === JSON.stringify(B.state.dice), "the first roll is the same for the same seed");
  A = applyMove(rules, A, 0, { t: "roll", hold: [1, 1, 0, 0, 0] }).G;
  B = applyMove(rules, B, 0, { t: "roll", hold: [0, 0, 0, 1, 1] }).G;
  check(A.state.dice[2] === B.state.dice[2] && A.state.dice[2] === dieAt(A.state.base, 0, 0, 2, 2), "a die rolled again takes its place's value whoever else was held");
  const daily = [1, 2].map(() => newRecord(rules, { seats: 3, options: { daily: 20261104 }, seed: Math.random() * 2 ** 32 >>> 0, now: 0 }));
  check(daily[0].state.base === daily[1].state.base && daily[0].state.seats === 1, "a daily has the same base for everyone, and is played alone");
  check(newRecord(rules, { seats: 1, options: { daily: 20261105 }, seed: 1, now: 0 }).state.base !== daily[0].state.base, "another day, other dice");
}

// ---------- a turn ----------
{
  let G = newRecord(rules, { seats: 2, seed: 11, now: 0 });
  check(G.state.left === 3 && G.state.turn === 0 && rules.toMove(G.state) === 0, "a game starts with seat 0 and three rolls to come");
  check(applyMove(rules, G, 0, { t: "score", c: 0 }).error === "Roll first", "no scoring before the first roll");
  check(applyMove(rules, G, 1, { t: "roll" }).error === "It isn't your turn", "no rolling out of turn");
  G = applyMove(rules, G, 0, { t: "roll" }).G;
  check(G.state.left === 2 && G.state.dice.every(d => d >= 1 && d <= 6), "a roll uses one of three");
  check(applyMove(rules, G, 0, { t: "roll", hold: [1, 1, 1, 1, 1] }).error !== undefined, "holding all five and rolling is refused");
  const held = applyMove(rules, G, 0, { t: "hold", hold: [1, 0, 1, 0, 0] }).G;
  check(JSON.stringify(held.state.held) === "[1,0,1,0,0]" && held.state.left === 2, "holding changes nothing else");
  let R = applyMove(rules, held, 0, { t: "roll" }).G;
  check(R.state.dice[0] === held.state.dice[0] && R.state.dice[2] === held.state.dice[2] && R.state.left === 1, "held dice keep their faces through a roll");
  R = applyMove(rules, R, 0, { t: "roll" }).G;
  check(R.state.left === 0 && applyMove(rules, R, 0, { t: "roll" }).error !== undefined, "after the third roll there is no fourth");
  const dice = [...R.state.dice], pts = scoreOf(CHOICE, dice);
  const S = applyMove(rules, R, 0, { t: "score", c: CHOICE }).G;
  check(S.state.sheets[0][CHOICE] === pts && S.state.turn === 1 && S.state.left === 3 && S.state.held.every(h => !h), "scoring writes the points and passes the dice on");
  let T = applyMove(rules, S, 1, { t: "roll" }).G;
  T = applyMove(rules, T, 1, { t: "score", c: CHOICE }).G;
  let U = applyMove(rules, T, 0, { t: "roll" }).G;
  check(applyMove(rules, U, 0, { t: "score", c: CHOICE }).error === "That category is taken", "a category is used once");
}

// ---------- a whole game, the end, the winners ----------
{
  let G = newRecord(rules, { seats: 3, seed: 21, now: 0 }), turns = 0;
  while (!rules.over(G.state) && turns < 200) {
    const who = rules.toMove(G.state), c = openOf(G.state.sheets[who])[0];
    G = applyMove(rules, G, who, { t: "roll" }).G;
    G = applyMove(rules, G, who, { t: "score", c }).G;
    turns++;
  }
  check(rules.over(G.state) && turns === ROUNDS * 3 && G.state.sheets.every(sh => sh.every(v => v >= 0)), `twelve rounds each, then the game is over (${turns} turns)`);
  check(rules.toMove(G.state) === null && applyMove(rules, G, 0, { t: "roll" }).error === "The game is over", "nobody moves after the end");
  const w = winners(G.state), t = G.state.sheets.map(s => totals(s).total);
  check(w.length >= 1 && w.every(i => t[i] === Math.max(...t)), "the winners are the seats with the top total");
}

// ---------- through the database ----------
{
  let G = newRecord(rules, { seats: 2, seed: 5, now: 0 });
  const back = roundTrip(G);
  check(back.state.dice.length === 5 && back.state.held.length === 5, "a new game comes back whole");
  let r = applyMove(rules, back, 0, { t: "roll" });
  check(!r.error, "and carries on from what came back");
  G = roundTrip(r.G);
  r = applyMove(rules, G, 0, { t: "hold", hold: [0, 0, 0, 0, 0] });
  check(!r.error && roundTrip(r.G).state.held.length === 5, "a hold of nothing survives too");
}

// ---------- the computer players ----------
{
  const rng = seeded(8), avg = { easy: 0, medium: 0, hard: 0 }, N = 12;
  let ok = true, games = 0;
  for (const level of ["easy", "medium", "hard"]) for (let g = 0; g < N; g++) {
    const seats = 1 + (g % 4);
    let G = newRecord(rules, { seats, seed: 100 + g, now: 0 });
    for (let i = 0; i < 2000 && !rules.over(G.state); i++) {
      const who = rules.toMove(G.state), m = botMove(G.state, who, { level, rng });
      const r = applyMove(rules, G, who, m);
      if (r.error) { ok = false; console.log(`  illegal: ${r.error}`, JSON.stringify(m)); break; }
      G = r.G;
    }
    if (!rules.over(G.state)) ok = false;
    games++;
    avg[level] += G.state.sheets.reduce((a, s) => a + totals(s).total, 0) / seats / N;
  }
  check(ok, `${games} games of one to four computer players to the end at every strength, every move legal`);
  check(avg.hard > avg.medium + 3 && avg.medium > avg.easy + 15, `Hard scores more than Medium, and Medium more than Easy (${avg.hard.toFixed(0)}, ${avg.medium.toFixed(0)}, ${avg.easy.toFixed(0)} a game)`);
  check(avg.hard > 150, "Hard scores more than 150 a game");
}
{
  const at = (dice, left, taken = []) => {
    const G = newRecord(rules, { seats: 1, seed: 3, now: 0 }), s = G.state;
    s.dice = dice; s.left = left; s.held = [0, 0, 0, 0, 0];
    taken.forEach(c => (s.sheets[0][c] = 0));
    return s;
  };
  const rng = seeded(1);
  let m = botMove(at([5, 5, 5, 5, 1], 1), 0, { level: "hard", rng });
  check(m.t === "roll" && m.hold.join("") === "11110", "four fives and a one, one roll left: Hard keeps the four fives");
  m = botMove(at([4, 4, 4, 4, 4], 2), 0, { level: "hard", rng });
  check(m.t === "score" && m.c === YACHT, "five alike: Hard writes it in Yacht");
  m = botMove(at([1, 2, 3, 4, 5], 1), 0, { level: "hard", rng });
  check(m.t === "score" && m.c === LITTLE, "1-2-3-4-5: Hard takes the little straight rather than rolling on");
  m = botMove(at([6, 6, 6, 5, 5], 0), 0, { level: "hard", rng });
  check(m.t === "score" && m.c === HOUSE, "three sixes and two fives, no rolls left: the full house (29)");
  m = botMove(at([1, 2, 4, 4, 6], 0, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 0, { level: "hard", rng });
  check(m.t === "score" && m.c === YACHT, "with one category left it takes that, 0 or not");
  m = botMove(at([2, 3, 3, 5, 6], 1, []), 0, { level: "hard", rng });
  check(m.t === "roll" && m.hold.some(Boolean), "a loose hand is rolled on, keeping something");
  const h = advise(at([6, 6, 6, 6, 2], 0), 0);
  check(h.c === FOUR && h.pts === 26, `the hint for four sixes and a two is ${h.name} for ${h.pts}`);
  check(worth(YACHT, [3, 3, 3, 3, 3]) > worth(CHOICE, [3, 3, 3, 3, 3]) && worth(SIXES, [6, 6, 6, 6, 1]) > worth(SIXES, [6, 6, 1, 1, 1]), "the worth of a score is the points over what the category tends to make");
  check(CATS.length === 12, "twelve categories");
}

// ---------- where the 3D dice lie ----------
{
  let ok = true, inside = true, same = true;
  for (let s = 0; s < 400; s++) {
    const a = scatterSpots(s * 977 + 3, keyNumber(`g:0:${s % 12}:${s % 3}`)), b = scatterSpots(s * 977 + 3, keyNumber(`g:0:${s % 12}:${s % 3}`));
    if (JSON.stringify(a) !== JSON.stringify(b)) same = false;
    for (let i = 0; i < 5; i++) {
      if (a[i].x < SCATTER.x0 - 1e-9 || a[i].x > SCATTER.x1 + 1e-9 || a[i].z < SCATTER.z0 - 1e-9 || a[i].z > SCATTER.z1 + 1e-9) inside = false;
      for (let j = 0; j < i; j++) if (Math.hypot(a[i].x - a[j].x, a[i].z - a[j].z) < DIE * 1.05) ok = false;
    }
  }
  check(same, "the dice lie in the same places on every device for a seed and a roll");
  check(ok, "no two dice overlap");
  check(inside, "every die stays inside the throwing area");
  const row = [0, 1, 2, 3, 4].map(heldSpot);
  check(row.every((p, i) => i === 0 || p.x - row[i - 1].x >= DIE * 1.1) && row.every(p => Math.abs(p.x) < FELT.w / 2 - 1), "the held row is in order, apart and on the felt");
}

console.log(bad ? `yacht: ${bad} failed` : "yacht: every check passed");
process.exit(bad ? 1 : 0);
