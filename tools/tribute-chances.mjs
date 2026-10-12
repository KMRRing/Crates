// Fits the chances Tribute's hint shows to the computer players' own play: BOMB_FIT, EITHER_FIT and STANDS in
// tribute-bot.js. The count takes the cards you can't see as dealt at random among the players with room for them; the
// players keep their bombs, pairs and high cards and don't beat everything they could, so this plays hands among them,
// records what each opponent really held and what really happened to each play, and fits the count to it by logistic
// regression: the log-odds of what happened as a weighted sum of the count's log-odds and a few facts of the position.
//   node tools/tribute-chances.mjs bombs [games]          what each opponent held (about five minutes for 1,500 games)
//   node tools/tribute-chances.mjs stands hard [games]    what happened next to plays, Hard answering with its look-ahead
//                                                         as it plays (about half an hour for 400 games)
//   node tools/tribute-chances.mjs stands medium [games]  the same against Medium (five minutes for 600)
// Each prints the numbers to put in tribute-bot.js and how close they and the count come on a third of the games, held
// out of the fit. A game is three hands of a match, the computer players on every seat (Hard's rules, quick, for bombs).
import * as E from "../tribute-engine.js";
import * as B from "../tribute-bot.js";

const [what = "bombs", ...rest] = process.argv.slice(2);
const KINDS = ["single", "pair", "triple", "full", "straight", "tube", "plate"];
const NOT_BOMB = { type: "single", key: 99, n: 1, bomb: 0 };
const logit = (q, e) => { const x = Math.min(1 - e, Math.max(e, q)); return Math.log(x / (1 - x)); };
const sigmoid = z => 1 / (1 + Math.exp(-z));
const dot = (w, x) => w.reduce((a, wi, i) => a + wi * x[i], 0);

/** Hands of computer players, three to a game; look(state, seat, game, step) at each play. */
function play(games, skill, look) {
  for (let g = 0; g < games; g++) {
    let st = E.newGame({ mode: "deals", deals: 6 }, 7000 + g), hand = 0;
    for (let step = 0; step < 20000; step++) {
      if (st.phase === "over") { if (++hand >= 3 || st.result.over) break; st = E.nextHand(st, 31 * g + hand); continue; }
      const seat = E.waitingOn(st)[0];
      if (st.phase === "play") look(st, seat, g, step);
      E.act(st, seat, B.decide(st, seat, { seed: seat + g * 7 + step, skill, search: 0 }).action);
    }
    if ((g + 1) % 50 === 0) process.stderr.write(`${g + 1} games\n`);
  }
}

/** Logistic regression by Newton's method: the weights for which sigmoid(w·x) fits the outcomes best, a little ridge for steadiness. */
function logistic(xs, ys) {
  const d = xs[0].length, ridge = 1e-4;
  let w = new Array(d).fill(0);
  for (let it = 0; it < 40; it++) {
    const g = w.map(wi => -ridge * wi), H = Array.from({ length: d }, (_, i) => Array.from({ length: d }, (_, j) => (i === j ? ridge : 0)));
    xs.forEach((x, r) => {
      const p = sigmoid(dot(w, x)), v = p * (1 - p), e = ys[r] - p;
      for (let i = 0; i < d; i++) {
        if (!x[i]) continue;
        g[i] += e * x[i];
        for (let j = 0; j < d; j++) H[i][j] += v * x[i] * x[j];
      }
    });
    const step = solve(H, g);
    w = w.map((wi, i) => wi + step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  return w;
}
function solve(A, b) {                                           // Gaussian elimination, partial pivoting
  const n = b.length, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}
/** How far a chance is from what happened: |said − happened| in bands of what it said, weighed by each band's size, in points. */
function gap(pairs) {
  const edges = [0, 1e-9, 0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9, 0.95, 0.99, 1 - 1e-9, 1.01];
  let err = 0, n = 0;
  for (let i = 0; i < edges.length - 1; i++) {
    const band = pairs.filter(([c]) => c >= edges[i] && c < edges[i + 1]);
    if (band.length < 30) continue;
    const said = band.reduce((a, [c]) => a + c, 0) / band.length, was = band.reduce((a, [, y]) => a + y, 0) / band.length;
    err += band.length * Math.abs(said - was); n += band.length;
  }
  return n ? ((100 * err) / n).toFixed(1) : "-";
}
const fmt = w => `[${w.map(x => Number(x.toFixed(4))).join(", ")}]`;
const heldOut = r => r.g % 3 === 2;

if (what === "bombs") {
  const games = Number(rest[0] || 1500), rows = [];
  play(games, "hard", (st, seat, g, step) => {
    if (step % 4) return;
    const K = B.knowledge(st, seat), level = st.level, has = (hand, over) => hand.length >= 4 && B.candidates(hand, level, over).some(c => c.reading.bomb);
    const ours = B.candidates(st.hands[seat], level, NOT_BOMB).filter(c => c.reading.bomb);
    rows.push({ g, opps: K.opps.map(o => ({
      h: K.counts[o], q: B.bombCount(K, o), hit: has(st.hands[o], NOT_BOMB),
      bigs: ours.map(b => ({ tier: b.reading.bomb, q: B.bombCount(K, o, b.reading), hit: has(st.hands[o], b.reading) })),
    })) });
  });
  const open = q => q > 1e-9 && q < 1 - 1e-9;
  const anyX = o => [1, logit(o.q, 1e-6), Math.log(o.h)], bigX = (o, b) => [1, logit(b.q, 1e-6), Math.log(o.h), b.tier];
  const cal = (w, q, x) => (open(q) ? sigmoid(dot(w, x)) : q);
  const fit = rs => {
    const a = rs.flatMap(r => r.opps.filter(o => open(o.q))), b = rs.flatMap(r => r.opps.flatMap(o => o.bigs.filter(x => open(x.q)).map(x => [o, x])));
    const any = logistic(a.map(anyX), a.map(o => +o.hit)), bigger = logistic(b.map(([o, x]) => bigX(o, x)), b.map(([, x]) => +x.hit));
    // either opponent, where both could hold one: their chances taken as independent, then fitted
    const both = rs.map(r => ({ cs: r.opps.map(o => cal(any, o.q, anyX(o))), hit: r.opps.some(o => o.hit) }))
      .map(x => ({ ...x, e: 1 - x.cs.reduce((p, c) => p * (1 - c), 1) }))
      .filter(x => x.cs.length === 2 && x.cs.every(c => c > 1e-9) && x.e < 1 - 1e-9);
    const either = logistic(both.map(x => [1, logit(x.e, 1e-6)]), both.map(x => +x.hit));
    return { any, bigger, either };
  };
  const check = (f, rs) => {
    const a = rs.flatMap(r => r.opps.filter(o => o.h >= 4)), b = rs.flatMap(r => r.opps.filter(o => o.h >= 4).flatMap(o => o.bigs.map(x => [o, x])));
    const eitherOf = r => {
      const cs = r.opps.map(o => cal(f.any, o.q, anyX(o))), e = 1 - cs.reduce((p, c) => p * (1 - c), 1);
      return cs.length === 2 && cs.every(c => c > 1e-9) && e < 1 - 1e-9 ? sigmoid(dot(f.either, [1, logit(e, 1e-6)])) : e;
    };
    const indep = r => 1 - r.opps.reduce((p, o) => p * (1 - (o.h >= 4 ? o.q : 0)), 1);
    console.log(`  any bomb, one opponent: ${gap(a.map(o => [cal(f.any, o.q, anyX(o)), +o.hit]))} points (the count ${gap(a.map(o => [o.q, +o.hit]))})`);
    console.log(`  a bomb bigger than ours: ${gap(b.map(([o, x]) => [cal(f.bigger, x.q, bigX(o, x)), +x.hit]))} points (the count ${gap(b.map(([, x]) => [x.q, +x.hit]))})`);
    console.log(`  either opponent: ${gap(rs.map(r => [eitherOf(r), +r.opps.some(o => o.hit)]))} points (the count ${gap(rs.map(r => [indep(r), +r.opps.some(o => o.hit)]))})`);
  };
  console.log(`${rows.length} positions in ${games} games; on the games held out, fitted on the rest:`);
  check(fit(rows.filter(r => !heldOut(r))), rows.filter(heldOut));
  const f = fit(rows);
  console.log(`\nconst BOMB_FIT = { any: ${fmt([...f.any, 0])}, bigger: ${fmt(f.bigger)} };\nconst EITHER_FIT = ${fmt(f.either)};`);
} else if (what === "stands") {
  const skill = rest[0] === "medium" ? "medium" : "hard", look = skill === "hard", games = Number(rest[1] || (look ? 400 : 600)), rows = [];
  play(games, skill, (st, me, g, step) => {
    if (step % (look ? 9 : 5)) return;
    const K = B.knowledge(st, me), level = st.level, mine = st.hands[me];
    const plays = (st.top ? B.candidates(mine, level, st.top.reading) : B.split(mine, level).combos).filter(c => !c.reading.bomb && c.cards.length < mine.length);
    plays.forEach((c, i) => {
      if (look && (i * 7 + step) % 3) return;                    // a third of them: each costs a look-ahead or two
      const t = structuredClone(st);
      E.act(t, me, { t: "play", cards: c.cards });
      let beaten = false;
      // until it comes round to him, his partner plays over it, or an opponent does (a bomb isn't beating it here)
      for (let k = 0; k < 12 && t.phase === "play" && t.top?.seat === me && t.turn !== me; k++) {
        const s = t.turn, d = B.decide(t, s, { seed: s + step + g, skill, search: look ? 32 : 0, budget: 450 });
        E.act(t, s, d.action);
        if (d.action.t === "play" && E.teamOf(s) !== E.teamOf(me)) { beaten = !t.top.reading.bomb; break; }
      }
      rows.push({ g, kind: c.reading.type, lead: !st.top, q: B.hold(c.reading, K), stood: !beaten });
    });
  });
  // a kind too rare to fit on its own takes the tube's numbers (the plate: two triples in a row, six cards like it)
  const pooled = rows.filter(r => r.kind === "plate").length < 300;
  const k = r => KINDS.indexOf(pooled && r.kind === "plate" ? "tube" : r.kind);
  const X = r => {
    const x = new Array(16).fill(0), lq = logit(r.q, 1e-4);
    x[k(r)] = 1; x[7 + k(r)] = lq; x[14] = -Math.log(1 - Math.min(1 - 1e-4, r.q)); x[15] = r.lead ? 1 : 0;
    return x;
  };
  const fit = rs => { const use = rs.filter(r => r.q < 1 - 1e-9); return logistic(use.map(X), use.map(r => +r.stood)); };
  const said = (w, r) => (r.q > 1 - 1e-9 ? 1 : Math.min(0.99, sigmoid(dot(w, X(r)))));
  const test = rows.filter(heldOut), wt = fit(rows.filter(r => !heldOut(r)));
  console.log(`${rows.length} plays in ${games} games against ${skill === "hard" ? "Hard, with its look-ahead" : "Medium"}; on the games held out, fitted on the rest: ${gap(test.map(r => [said(wt, r), +r.stood]))} points (the count ${gap(test.map(r => [r.q, +r.stood]))})`);
  const w = fit(rows), per = KINDS.map((name, i) => `${name}: [${Number(w[i].toFixed(4))}, ${Number(w[7 + i].toFixed(4))}]`);
  if (pooled) per[6] = `plate: [${Number(w[5].toFixed(4))}, ${Number(w[12].toFixed(4))}]`;
  console.log(`\n  ${skill}: { ${per.join(", ")}, sure: ${Number(w[14].toFixed(4))}, lead: ${Number(w[15].toFixed(4))} },${pooled ? "   // too few plates to fit: as tubes" : ""}`);
} else console.log("node tools/tribute-chances.mjs bombs [games] | stands hard [games] | stands medium [games]");
