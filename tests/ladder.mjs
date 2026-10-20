// Ladder (ladder-engine.js, ladder-pairs.js): Carroll's rules, par and the routes to it counted exactly, the generator
// at each level across many seeds, the grading, hints, the computer players, a run through JSON, the daily, and every
// one of the book's and the linked pairs played.
import { ACCEPT, COMMON, LENGTHS, LEVELS, LEVEL_ORDER, OVER, HINT, RIVALS, graphFor, isStep, isRung, rarity, analyse, distance, routeFrom, search, effort, fits, levelOf, generate, isEnd, inflected, apart,
  newRun, place, undo, working, words, steps, hintFor, score, rivalPlan, rivalAt, partnerMove, rng } from "../ladder-engine.js";
import { BOOK, CARROLL, KINBOTE, LINKED, THEMES, linkedFor } from "../ladder-pairs.js";
import { dealFor, freshTable, isTable, defaultMode, startTable, teamMove, teamUndo, teamHint, teamOn, mustChange, lettersFor, raceReport, raceOrder, raceOver, teamResult } from "../ladder-table.js";
import { sayReady, noteRun, runOf, standings, resultOf, rematch } from "../duel-core.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const isLadder = (P, ws) => ws[0] === P.start && ws.at(-1) === P.end && ws.every((w, i) => i === 0 || isStep(ws[i - 1], w, P.rules)) && ws.every(w => isRung(P, w)) && new Set(ws).size === ws.length;

// Every shortest route by brute force, counting up to `cap`: what analyse()'s layer-by-layer count must agree with.
function countByHand(P, cap = 50) {
  const g = graphFor(P.rules, P.start.length), nb = w => g.adj[g.at.get(w)].map(i => g.words[i]).filter(v => isRung(P, v));
  let n = 0;
  const walk = (w, left, seen) => {
    if (n >= cap) return;
    if (w === P.end) { if (left === 0) n++; return; }
    if (left === 0 || distance(w, P.end, P.rules) > left) return;
    for (const v of nb(w)) if (!seen.has(v)) { seen.add(v); walk(v, left - 1, seen); seen.delete(v); }
  };
  walk(P.start, P.par, new Set([P.start]));
  return n;
}

// ---------- Carroll's rules ----------
{
  check(isStep("cold", "cord") && !isStep("cold", "card") && !isStep("cold", "cold") && !isStep("cold", "colds"), "a step changes one letter in its place, no more and no fewer");
  check(!isStep("cold", "clod"), "letters keep their places: swapping two isn't a step");
  check(isStep("cold", "colds", "grow") && isStep("cold", "old", "grow") && isStep("hot", "shot", "grow") && !isStep("cold", "od", "grow") && !isStep("cat", "cast", "classic"),
    "growing, a step may also add or take away a letter (and only growing)");
  const P = { start: "cold", end: "warm", rules: "classic" };
  check(isRung(P, "cord") && isRung(P, "WARD") && !isRung(P, "cxld") && !isRung(P, "cords"), "a rung is a word of the ladder's length");
  check(!isRung(P, "fuck") && !isRung({ start: "cent", end: "core", rules: "classic" }, "cunt") && !isRung(P, "dyke"), "the word list's leftover offensive words are no words here");
  check(rarity(P, "cord") === 2 && rarity(P, "cold") === 0 && rarity(P, "hell") === ACCEPT && rarity(P, "xxxx") === -1, "how common a word is: its tier; a word the game never shows counts as the rarest");
  check(apart("cold", "warm") === 4 && apart("head", "tail") === 4 && apart("hot", "cold", "grow") === 3 && apart("cat", "act", "grow") === 2, "letters apart: in their places, or (growing) the edit distance");
  check(isEnd("cold") && isEnd("warm") && !isEnd("cords") && !isEnd("also") && !isEnd("colour") && !isEnd("died") && isEnd("need") && isEnd("feed"),
    "an end is a common word, not a plural, a past tense, a word like also, or one spelling's own");
  check(inflected("cats") && inflected("hated") && inflected("spies") && inflected("banned") && !inflected("glass") && !inflected("need") && !inflected("sing"), "plurals and past tenses are told apart from words that merely end like them");
}

// ---------- par and the routes to it ----------
{
  const known = [["cold", "warm", 4], ["head", "tail", 5], ["hate", "love", 3], ["lass", "male", 4], ["live", "dead", 6], ["lead", "gold", 3], ["ape", "man", 5], ["pig", "sty", 5]];
  const got = known.map(([a, b]) => analyse(a, b)?.par);
  check(known.every(([, , p], i) => got[i] === p), `known pars: ${known.map(([a, b], i) => `${a}-${b} ${got[i]}`).join(", ")}`);
  const P = analyse("cold", "warm");
  check(isLadder(P, P.route) && P.route.length === P.par + 1, "the commonest route is a ladder at par");
  check(P.detours === 0 && analyse("head", "tail").detours === 1 && analyse("four", "five").detours === 4, "detours: steps beyond the letters that differ (HEAD to TAIL changes a letter twice)");
  // the exact count, against a brute-force walk of every shortest route
  const samples = [["cold", "warm"], ["head", "tail"], ["pen", "ink"], ["cat", "dog"], ["bull", "bear"], ["wet", "dry"], ["fox", "hen"], ["east", "west"]];
  const counts = samples.map(([a, b]) => { const Q = analyse(a, b); return [Q.routes, countByHand(Q)]; });
  check(counts.every(([x, y]) => x === y), `the routes at par are counted exactly (${samples.map(([a, b], i) => `${a}-${b} ${counts[i][0]}`).join(", ")})`);
  check(analyse("cold", "colder") === null && analyse("cold", "cold") === null, "no ladder between different lengths in Classic, nor from a word to itself");
  check(distance("cold", "warm") === 4 && distance("cold", "cold") === 0, "distance is par from anywhere");
  const R = routeFrom(P, "card", "warm", ["cold", "cord", "card"]);
  check(R && R[0] === "card" && R.at(-1) === "warm" && R.length === 3, "a route from a rung on, kept clear of the ladder's own words");
  check(analyse("cain", "abel")?.par === 8 && !isRung({ start: "gain", end: "rain", rules: "classic" }, "cain") && distance("gain", "lain") === 1,
    "Carroll's CAIN and ABEL are ends of their own ladder, and rungs of no other");
  const G = analyse("hot", "cold", "grow");
  check(G && G.par === 3 && isLadder(G, G.route), "growing, HOT to COLD in three");
}

// ---------- the generator, at every level ----------
{
  const per = 24, lens = [[3], [4], [5], [6], [4, 5]];
  let made = 0, fit = 0, ladders = true, ends = true, ranged = true, unique = true, rep = true;
  const stats = Object.fromEntries(LEVEL_ORDER.map(l => [l, { par: 0, effort: 0, n: 0 }]));
  const t0 = performance.now();
  for (const level of LEVEL_ORDER) for (const lengths of lens) for (let k = 1; k <= per; k++) {
    const seed = 1000 + k * 7919 + lengths[0] * 13, P = generate(seed, { level, lengths });
    made++;
    if (fits(P, level)) fit++;
    if (!isLadder(P, P.route)) ladders = false;
    if (!isEnd(P.start) || !isEnd(P.end) || !lengths.includes(P.start.length)) ends = false;
    const [lo, hi] = LEVELS[level].par[P.start.length];
    if (P.par < lo || P.par > hi || P.needs > COMMON) ranged = false;
    if (level === "hard" && k <= 4 && countByHand(P, 2) !== 1) unique = false;
    if (k <= 2 && JSON.stringify(generate(seed, { level, lengths })) !== JSON.stringify(P)) rep = false;
    const s = stats[level]; s.par += P.par; s.effort += effort(P); s.n++;
  }
  const ms = (performance.now() - t0) / made;
  check(fit === made, `every ladder fits its level (${fit} of ${made}, ${ms.toFixed(1)} ms each with the grading)`);
  check(ladders && ranged, "each one's commonest route is a ladder at par, par in the level's range, at par through common words");
  check(ends, "its ends are common words of an allowed length");
  check(unique, "Hard has exactly one route at par (counted by hand up to two)");
  check(rep, "the same seed makes the same ladder");
  const avg = l => ({ par: stats[l].par / stats[l].n, effort: stats[l].effort / stats[l].n });
  const [e, m, h] = LEVEL_ORDER.map(avg);
  check(e.par < m.par && m.par < h.par && e.effort < m.effort && m.effort < h.effort,
    `the levels climb: par ${e.par.toFixed(1)}, ${m.par.toFixed(1)}, ${h.par.toFixed(1)}; words a careful search tries ${e.effort.toFixed(0)}, ${m.effort.toFixed(0)}, ${h.effort.toFixed(0)}`);
  const grown = Array.from({ length: 8 }, (_, k) => generate(77 + k, { level: "medium", lengths: [3, 4, 5], rules: "grow" }));
  check(grown.every(P => P.rules === "grow" && isLadder(P, P.route) && fits(P, "medium")) && grown.some(P => P.start.length !== P.end.length), "growing, ladders whose ends may differ in length");
}

// ---------- the grading's measure ----------
{
  const straight = analyse("cold", "warm"), detour = analyse("head", "tail"), long = analyse("four", "five");
  check(effort(straight) <= straight.par + 2 && effort(detour) > effort(straight) && effort(long) > effort(detour), "no detours: a careful search goes straight there; detours make it search");
  const S = search(long, { vocab: COMMON });
  check(S && isLadder(long, S.route) && S.route.length - 1 === long.par, "the careful search (weight 1) finds par");
  check(levelOf(analyse("lead", "gold")) === "easy" && levelOf(analyse("cold", "warm")) === "easy" && levelOf(analyse("chin", "nose")) === "medium" && levelOf(analyse("four", "five")) === "hard", "a given pair's level, by its par");
}

// ---------- a ladder in play ----------
{
  const P = { ...analyse("cold", "warm"), level: "easy" };
  const run = newRun(P);
  check(place(P, run, "top", "cold") === "same" && place(P, run, "top", "card") === "step" && place(P, run, "top", "cxld") === "word" && place(P, run, "top", "colt") === "placed", "a rung must change one letter and be a word");
  check(place(P, run, "top", "cold") === "used", "a word already on the ladder can't come again");
  check(undo(run, "top") && working(run, "top") === "cold" && !undo(run, "top"), "undo takes the working rung off, never the first word");
  check(place(P, run, "bottom", "ward") === "placed" && working(run, "bottom") === "ward" && words(run).join() === "cold,ward,warm", "the ladder is worked from the bottom too");
  check(place(P, run, "top", "cord") === "placed" && place(P, run, "top", "card") === "placed", "and from the top");
  check(place(P, run, "top", "ward") === "done" && run.done && words(run).join(" ") === "cold cord card ward warm" && steps(run) === 4, "the two ends meet: a whole ladder, at par");
  // a meeting further down drops the rungs the bottom end needn't have climbed
  const Q = newRun(P);
  place(P, Q, "bottom", "ward"); place(P, Q, "bottom", "word"); place(P, Q, "top", "cord");
  check(place(P, Q, "top", "word") === "done" && words(Q).join(" ") === "cold cord word ward warm", "a join at any rung of the other end");
  const T = newRun(P);
  place(P, T, "top", "cord");
  const h = hintFor(P, T, "top");
  check(h && isStep("cord", h.word) && h.left === 2 && distance(h.word, "warm") === 2, "a hint: the next rung on a shortest route from where you are, and the steps left");
  T.ms = 83000; T.hints = 1;
  ["card", "ward"].forEach(w => place(P, T, "top", w));
  place(P, T, "top", "warm");
  check(T.done && score(P, T) === 83 + HINT, "a score: the seconds, and a hint's 30");
  const U = newRun(P);
  for (const w of ["colt", "cola", "cold"]) place(P, U, "top", w);
  check(U.top.join() === "cold,colt,cola", "a loop back to a word already on is refused, not made");
  const V = newRun(P);
  for (const w of ["colt", "molt", "mold", "cold"]) place(P, V, "top", w);
  ["cord", "card", "ward", "warm"].forEach(w => place(P, V, "top", w));
  check(!V.done || steps(V) >= P.par, "never under par");
  const W = newRun(P);
  for (const w of ["bold", "bald", "ball", "wall", "wail", "warl"]) place(P, W, "top", w);
  for (const w of ["ward", "warm"]) place(P, W, "top", w);
  check(!W.done || score(P, { ...W, ms: 0 }) === OVER * (steps(W) - P.par), "a step over par costs a minute");
  // a run through JSON (a reload, a partner watching) carries on as it was
  const X = newRun(P);
  place(P, X, "top", "cord");
  place(P, X, "bottom", "ward");
  const back = JSON.parse(JSON.stringify(X));
  check(place(P, back, "top", "card") === "placed" && place(P, back, "top", "ward") === "done" && steps(back) === 4, "a run read back from JSON carries on");
}

// ---------- the computer players ----------
{
  const pool = Array.from({ length: 10 }, (_, k) => generate(500 + k, { level: k % 2 ? "medium" : "hard", lengths: [4] }));
  const plans = level => pool.map((P, k) => ({ P, plan: rivalPlan(P, level, 9 + k) }));
  const all = Object.keys(RIVALS).map(level => [level, plans(level)]);
  check(all.every(([, xs]) => xs.every(({ P, plan }) => isLadder(P, plan.route) && plan.at.length === plan.route.length - 1 && plan.at.every((t, i) => i === 0 || t >= plan.at[i - 1]))),
    "every computer player climbs a real ladder, rung by rung, in time order");
  const over = level => all.find(([l]) => l === level)[1].reduce((a, { P, plan }) => a + plan.route.length - 1 - P.par, 0) / pool.length;
  const time = level => all.find(([l]) => l === level)[1].reduce((a, { plan }) => a + plan.at.at(-1), 0) / pool.length;
  check(over("master") === 0, "a master finds par");
  check(over("novice") >= over("club") && over("club") >= over("master") && time("novice") > time("club") && time("club") > time("master"),
    `the levels: steps over par ${over("novice").toFixed(1)}, ${over("club").toFixed(1)}, ${over("master").toFixed(1)}; seconds ${(time("novice") / 1000).toFixed(0)}, ${(time("club") / 1000).toFixed(0)}, ${(time("master") / 1000).toFixed(0)}`);
  const P = pool[0], a = rivalPlan(P, "club", 3), b = rivalPlan(P, "club", 3);
  check(JSON.stringify(a) === JSON.stringify(b) && rivalAt(a, 0) === 0 && rivalAt(a, a.at.at(-1)) === a.route.length - 1, "the same seed, the same climb; its rungs appear as their moments pass");
  check(time("master") / 1000 >= 10, "even a master takes a person's time");
}

// ---------- the computer as a partner, holding half the letters ----------
{
  const climb = (P, owners, level, me = null) => {
    // the computer holds slot 1's letters; "me" plays slot 0's along the commonest route when it's my letter next
    const ws = [P.start];
    for (let turn = 0; turn < 40 && ws.at(-1) !== P.end; turn++) {
      const m = partnerMove(P, ws, p => owners[p] === 1, level, 7 + turn);
      if (m) { ws.push(m.word); continue; }
      const next = me ? me(ws) : null;
      if (!next) return { ws, stuck: true };
      ws.push(next);
    }
    return { ws, stuck: ws.at(-1) !== P.end };
  };
  const mineNext = (P, owners) => ws => { const R = routeFrom(P, ws.at(-1), P.end, ws); if (!R || R.length < 2) return null; const p = [...R[0]].findIndex((c, i) => c !== R[1][i]); return owners[p] === 0 ? R[1] : null; };
  let valid = true, theirsOnly = true, waits = 0, atPar = 0, n = 0;
  for (let k = 0; k < 16; k++) {
    const P = generate(900 + k, { level: k % 2 ? "medium" : "easy", lengths: [4] }), owners = lettersFor(P, [0, 1], 1 + (k % 2));
    const res = climb(P, owners, "master", mineNext(P, owners));
    n++;
    if (!isLadder(P, res.ws)) valid = false;
    for (let i = 1; i < res.ws.length; i++) {
      const p = [...res.ws[i - 1]].findIndex((c, j) => c !== res.ws[i][j]);
      if (partnerMove(P, res.ws.slice(0, i), q => owners[q] === 1, "master", 1)?.word === res.ws[i] && owners[p] !== 1) theirsOnly = false;
    }
    if (res.ws.length - 1 === P.par) atPar++;
    if (partnerMove(P, [P.start], p => owners[p] === 1, "master", 1) === null) waits++;
  }
  check(valid, "a person and a master partner, each changing only their own letters, climb whole ladders");
  check(theirsOnly, "the computer only ever changes the letters it holds");
  check(atPar === n, `with a master partner and a careful player the team finds par (${atPar} of ${n})`);
  check(waits > 0 && waits < n, `when the next step is yours, the computer waits for you (${waits} of ${n} first steps)`);
  const P = analyse("cold", "warm"), m = partnerMove(P, ["cold"], () => true, "novice", 3);
  check(m && isStep("cold", m.word) && m.think >= RIVALS.novice.think * 0.6, "a novice partner moves too, after a novice's thinking");
}

// ---------- the daily ----------
{
  const day = 20261020, a = generate(day, { level: "medium", lengths: [4, 5] }), b = generate(day, { level: "medium", lengths: [4, 5] });
  const c = generate(day + 1, { level: "medium", lengths: [4, 5] });
  check(JSON.stringify(a) === JSON.stringify(b) && (a.start !== c.start || a.end !== c.end), "today's ladder is the same on every phone, and tomorrow's another");
  const r1 = rng(5), r2 = rng(5);
  check(Array.from({ length: 5 }, r1).join() === Array.from({ length: 5 }, r2).join(), "the seeded generator repeats");
}

// ---------- the book and the linked pairs ----------
{
  const played = BOOK.map(p => ({ p, P: analyse(p.a, p.b) }));
  check(played.every(({ P }) => P && P.par <= 11 && P.needs <= 4), `every one of Carroll's and Kinbote's ${BOOK.length} plays, in words of his day (${played.filter(x => !x.P || x.P.needs > 4).map(x => x.p.say).join(", ") || "all"})`);
  check(CARROLL.length === 32 && KINBOTE.length === 3, "Carroll's 31 of his 38, his HEAD to TAIL first, and Kinbote's three");
  check(analyse("hate", "love").par === 3 && analyse("lass", "male").par === 4 && analyse("live", "dead").par === 6, "Kinbote's records: in three and four are par; live to dead takes six, not five");
  const caps = p => p.say.toUpperCase().includes(p.a.toUpperCase()) && p.say.toUpperCase().includes(p.b.toUpperCase());
  check(BOOK.every(caps) && LINKED.every(caps), "every pair's line names both its words");
  const linked = LINKED.map(p => ({ p, P: analyse(p.a, p.b, p.rules) }));
  const weak = linked.filter(({ P }) => !P || P.par < 3 || P.par > 9 || P.needs > 3);
  check(!weak.length, `all ${LINKED.length} linked pairs play by their rules, par 3 to 9, in words no rarer than SCOWL 40${weak.length ? `: not ${weak.map(x => x.p.say).join(", ")}` : ""}`);
  check(Object.keys(THEMES).every(t => linkedFor("classic", [t]).length >= 6) && linkedFor("classic").every(p => p.rules === "classic") && linkedFor("grow").length === LINKED.length,
    "every theme has pairs for Classic; growing, every pair plays");
  check(new Set(LINKED.map(p => `${p.a}-${p.b}-${p.rules}`)).size === LINKED.length, "no pair twice");
  const levels = LEVEL_ORDER.map(l => linked.filter(({ P }) => P && levelOf(P) === l).length);
  check(levels.every(n => n >= 15), `linked pairs at every level (${levels.join(", ")})`);
}

// ---------- together: the table (ladder-table.js), every change through the database's round trip ----------
{
  const db = g => roundTrip(JSON.parse(JSON.stringify(g)));
  const seat = (n) => Object.fromEntries(Array.from({ length: n }, (_, s) => [`u${s}`, { name: `P${s}`, slot: s, pid: `p${s}`, online: true }]));
  const table = (n, mode, seed = 41) => db(freshTable(seat(n), { people: n, match: dealFor(seed, { n, mode, level: "easy" }), now: 1000 }));
  const allIn = (g, n, at = 2000) => { let x = g; for (let s = 0; s < n; s++) { sayReady(x, s, [...Array(n).keys()], at); if (x.start) startTable(x, at); x = db(x); } return x; };

  // the split: each player's letters, and the last word each sees, make the whole between them, and nobody climbs alone
  let covers = true, needed = true, deals = 0;
  for (const n of [2, 3, 4]) for (let seed = 1; seed <= 12; seed++) {
    const g = allIn(table(n, "team", seed * 31), n), P = g.match.ladders[0], owners = g.team.owners;
    deals++;
    if (owners.length !== P.start.length || new Set(owners).size !== n) covers = false;
    // every player holds a letter the first and last words differ in: a letter every ladder must change
    if (!Array.from({ length: n }, (_, s) => s).every(s => mustChange(P).some(p => owners[p] === s))) needed = false;
  }
  check(covers, `a team's letters are dealt round everyone at the table (${deals} deals of two, three and four players)`);
  check(needed, "every player holds a letter the ladder must change, so the whole team is needed");
  const g0 = allIn(table(2, "team"), 2), P0 = g0.match.ladders[0];
  const seen = s => [...P0.end].map((c, p) => (g0.team.owners[p] === s ? c : "_")).join("");
  check([...seen(0)].every((c, p) => c === "_" || c === P0.end[p]) && [...P0.end].every((c, p) => seen(0)[p] === c || seen(1)[p] === c) && seen(0) !== P0.end && seen(1) !== P0.end,
    `each sees only their own letters of the last word (${seen(0)} and ${seen(1)} make ${P0.end}), neither the whole of it`);
  // one player alone, climbing the par route with the other at the table: refused at the other's letter
  let solo = g0, stuck = null;
  for (let k = 1; k < P0.route.length && !stuck; k++) {
    const r = teamMove(solo, { n: solo.n, slot: 0, from: k - 1, word: P0.route[k], present: [0, 1], now: 5000 });
    if (r === "theirs") stuck = P0.route[k]; else solo = db(solo);
  }
  check(!!stuck && !solo.team.done, `alone, a player is stopped at their partner's letter (${stuck?.toUpperCase()})`);
  // together: the par route, each making the rungs whose letter they hold
  let g = g0;
  const ownerAt = (a, b) => g.team.owners[[...a].findIndex((c, i) => c !== b[i])];
  for (let k = 1; k < P0.route.length; k++) {
    const slot = ownerAt(P0.route[k - 1], P0.route[k]);
    const r = teamMove(g, { n: g.n, slot, from: k - 1, word: P0.route[k], present: [0, 1], now: 2000 + 1000 * k });
    if (r !== "placed" && r !== "done") { check(false, `a team rung was refused: ${r}`); break; }
    g = db(g);
  }
  check(g.team.done && g.team.steps === P0.par && g.team.rungs.map(r => r.w).join() === P0.route.join(), `together they climb it at par, through the database at every rung (${P0.route.join(" ")})`);
  const res = teamResult(g);
  check(res && res.coop && res.won && res.lower && res.score === Math.round((g.team.at - g.start) / 1000), "the pair's record: a team's score, lower is better");
  // a rung made on a ladder that has moved on is refused; an away player's letters are anyone's
  const h = allIn(table(2, "team", 99), 2), Q = h.match.ladders[0], other = h.team.owners[[...Q.route[0]].findIndex((c, i) => c !== Q.route[1][i])] === 0 ? 1 : 0;
  const hp = db(h);
  check(teamMove(h, { n: h.n, slot: other, from: 0, word: Q.route[1], present: [0, 1] }) === "theirs" && teamMove(hp, { n: h.n, slot: other, from: 0, word: Q.route[1], present: [other] }) === "placed",
    "a partner's letter is theirs while they're here, and let go while they're away");
  const h2 = db(hp);
  check(teamMove(h2, { n: h2.n, slot: 0, from: 0, word: Q.route[1], present: [0, 1] }) === "moved" && teamMove(h2, { n: h2.n + 1, slot: 0, from: 1, word: "xxxx", present: [] }) === "moved",
    "a rung made on a ladder that has moved on, or in another game, is refused");
  check(teamUndo(h2, { n: h2.n, from: 1 }) && db(h2).team.rungs.length === 1 && !teamUndo(db(h2), { n: h2.n, from: 0 }), "anyone may take the last rung off, never the first word");
  const h3 = db(h2), w = teamHint(h3, { n: h3.n, from: 0 });
  check(w && isStep(Q.start, w) && db(h3).team.hints === 1 && db(h3).team.rungs[1].hint, "a hint for the team puts the next rung of a route on, whoever's letter it is");
  // the race: the same ladders for everyone; the lowest score wins
  // three at the table; two say Ready and race, the third is away and never begins
  let race = table(3, "race", 7);
  sayReady(race, 0, [0, 1], 2000); race = db(race);
  sayReady(race, 1, [0, 1], 2000); startTable(race, 2000); race = db(race);
  check(race.match.ladders.length === 3 && race.match.ladders.every(P => isLadder(P, P.route)) && !race.team && runOf(race, 0).begun && !runOf(race, 2), "a race deals three ladders, the same for everyone at the table");
  check(!raceOver(race, [0, 1, 2]), "a race isn't over while someone at the table is still to play it");
  const runs = [{ at: 3, over: 0, hints: 0, ms: 90000, count: 3, done: true }, { at: 3, over: 1, hints: 0, ms: 50000, count: 3, done: true }];
  runs.forEach((r, s) => { const rep = raceReport(r); noteRun(race, s, race.n, { ...rep, ms: r.ms }, 2000 + r.ms); race = db(race); });
  const order = standings(race, raceOrder).map(x => x.slot);
  check(order.join() === "0,1" && runOf(race, 0).score === 90 && runOf(race, 1).score === 110, `the standings: a minute a step over par counts against the time (90 s at par beats 50 s one over: ${order.join(", ")})`);
  check(raceOver(race, [0, 1]), "it's over when everyone who began has finished and nobody here is still to begin");
  const mid = raceReport({ at: 1, over: 0, hints: 0, ms: 20000, count: 3, done: false });
  check(mid.text === "1 of 3" && !mid.done && raceOrder({ ...mid }, { ...raceReport({ at: 2, over: 0, hints: 0, ms: 1, count: 3, done: false }) }) > 0, "while it's on, a player's progress: the ladders climbed");
  const won = resultOf(race, 0, [0, 1], raceOrder, true);
  check(won && won.won && won.lower, "the pair's record: the race's winner");
  const again = db(Object.assign(race, {}));
  rematch(again, 1, dealFor(8, { n: 3, mode: "team" }));
  const T2 = db(again);
  check(T2.n === 2 && T2.match.mode === "team" && !teamOn(T2) && runOf(T2, 1)?.ready && !runOf(T2, 0), "another game at the table, the other way: the one who asked is ready, the rest say so");
  check(isTable(T2) && !isTable({ ...T2, match: { ...T2.match, mode: "chess" } }) && defaultMode(2) === "team" && defaultMode(4) === "race", "a pair plays as a team by default, a party races");
}

// ---------- speed ----------
{
  const t0 = performance.now();
  for (const n of LENGTHS) graphFor("classic", n);
  const built = performance.now() - t0, t1 = performance.now();
  for (let k = 0; k < 20; k++) generate(31337 + k, { level: "medium", lengths: [4, 5] });
  const each = (performance.now() - t1) / 20;
  check(each < 60, `a Medium ladder in ${each.toFixed(1)} ms (graphs ready: ${built.toFixed(0)} ms more the first time)`);
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("ladder: all good");
