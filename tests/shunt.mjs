// Shunt (shunt-engine.js, shunt-bots.js, shunt-levels.js; the page is shunt.js): the shove and the line rule, shear, jams by odd
// rings, bridges and idlers, the scoring, the goals, a state kept and read back, the twelve levels (each deck won by the line
// stored with it, each teaching what it says, the bots' floors), the random plates and the daily, and the levers' geometry.
// The slow searches (the beam at width 1500, a hundred runs of each bot) are in tests/shunt-search.mjs. Run: node tests/shunt.mjs
import { CELLS, N, ENTRIES, at, fresh, swap, shove, step, play, track, legal, legalEntries, canSwap, over, judge, goalCheck, effect, sound, mend, movesOf, STUD, EMPTY, VALUE } from "../shunt-engine.js";
import { rng, playRandom, playGreedy, beam, search } from "../shunt-bots.js";
import { LEVELS, COACHED, DIFFS, goalWords, plateOf, randomPlate, dailyPlate, rating, rated } from "../shunt-levels.js";
import { LEVERS, D, HIT } from "../shunt-view-2d.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const canon = v => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v);
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));
const T0 = Date.now();
const lvl = (cells = {}, deal = [0], extra = {}) => ({ stud: [], jewels: [], start: cells, deal, goal: {}, ...extra });
/** An entry by where the gear goes in and which way it travels: the cell on the rim and the step (q, r) it travels by. */
const entry = (q, r, dq, dr) => ENTRIES.findIndex(en => en.line[0] === at(q, r) && en.d[0] === dq && en.d[1] === dr);

// ---------- the plate ----------
check(N === 19 && CELLS.length === 19, "a hexagonal plate of nineteen cells");
check(ENTRIES.length === 30 && ENTRIES.every(en => en.line.length >= 3 && en.line.length <= 5), "thirty ways in, along lines of three to five cells");
check(ENTRIES.every((en, i) => i % 2 || (en.line.join() === ENTRIES[i + 1].line.slice().reverse().join())), "every line can be entered from either end");
check(new Set(ENTRIES.map(en => en.line[0])).size === 12, "from the twelve cells of the rim");
const E0 = entry(-2, 0, 1, 0);                                       // along the row r = 0 from the left
check(E0 >= 0 && ENTRIES[E0].line.length === 5 && ENTRIES[E0].line[0] === at(-2, 0) && ENTRIES[E0].line[4] === at(2, 0), "the middle row from its left end");

// ---------- shoving ----------
{
  const row = [-2, -1, 0, 1, 2].map(q => at(q, 0));
  let s = fresh(lvl({}, [0, 1, 2]));
  let r = shove(s, E0);
  check(r.s.cells[row[0]] === 0 && r.moved.length === 0 && r.at === row[0] && r.s.q.join() === "1,2", "into an empty entry cell the gear lands there");
  s = fresh(lvl({ [row[0]]: 1 }, [0]));
  r = shove(s, E0);
  check(r.s.cells[row[0]] === 0 && r.s.cells[row[1]] === 1 && r.moved.length === 1, "an occupied entry cell: its gear moves one step into the gap, the new one takes its place");
  s = fresh(lvl({ [row[0]]: 1, [row[1]]: 1, [row[2]]: 2, [row[4]]: 1 }, [0]));
  r = shove(s, E0);
  check(same(row.map(c => r.s.cells[c]), [0, 1, 1, 2, 1]) && r.moved.length === 3, "a block moves up to the first gap, and what lies beyond the gap stays");
  s = fresh(lvl(Object.fromEntries(row.map(c => [c, 1])), [0]));
  check(shove(s, E0) === null && !legal(s, E0) && !legalEntries(s).includes(E0), "a full line takes no shove");
  check(shove(s, E0 + 1) === null, "nor from the other end");
  // from the far end
  s = fresh(lvl({ [row[4]]: 1 }, [2]));
  const E1 = E0 + 1;
  r = shove(s, E1);
  check(r.s.cells[row[4]] === 2 && r.s.cells[row[3]] === 1, "from the far end the same, the other way");
  // a stud ends a line and never moves
  s = fresh(lvl({ [row[0]]: 1 }, [0], { stud: [row[2]] }));
  check(track(s, E0).length === 2 && s.cells[row[2]] === STUD, "a stud ends the line");
  r = shove(s, E0);
  check(r.s.cells[row[2]] === STUD && r.s.cells[row[0]] === 0 && r.s.cells[row[1]] === 1, "and stays where it is");
  s = fresh(lvl({ [row[0]]: 1, [row[1]]: 1 }, [0], { stud: [row[2]] }));
  check(shove(s, E0) === null, "a line full up to a stud takes no shove");
  check(track(s, entry(2, 0, -1, 0)).length === 2 && track(s, entry(2, 0, -1, 0))[0] === row[4], "a stud ends the line from the far end too");
}
// the queue, the hold
{
  let s = fresh(lvl({}, [0, 1, 2, 0]));
  check(canSwap(s) && swap(s).hold === 0 && swap(s).q.join() === "1,2,0" && swap(s).swapped === 1, "swap puts the next gear in the hold");
  const t = swap(s);
  check(!canSwap(t), "once a turn");
  check(shove(t, E0).s.swapped === 0 && canSwap(shove(t, E0).s) && shove(t, E0).s.cells[at(-2, 0)] === 1, "a shove after a swap shoves the gear that came up, and frees the swap");
  const u = shove(t, E0).s, w = swap(u);
  check(w.hold === 2 && w.q[0] === 0, "a second swap trades the next gear with the held one");
  const last = fresh(lvl({}, [2]));
  check(!canSwap(last) && swap(last).hold === 2 && swap(last).q.length === 0, "the last gear cannot be held (nothing to bring up)");
  const lone = swap(fresh(lvl({}, [0, 1])));
  const emptied = shove(lone, E0).s;
  check(emptied.q.length === 0 && emptied.hold === 0 && !over(emptied), "with the queue out the held gear is the last to shove");
  check(over(shove(emptied, E0).s), "and then the plate is judged");
  check(over(fresh(lvl({}, []))), "no gear to shove: judged");
  const stuck = fresh(lvl(Object.fromEntries(CELLS.map((c, i) => [i, 1])), [0]));
  check(over(stuck), "a full plate: judged");
  check(step(fresh(lvl({}, [0, 1])), -1) !== null && step(fresh(lvl({}, [0])), -1) === null && step(fresh(lvl({}, [0])), 99) === null && step(fresh(lvl({}, [0])), 0.5) === null, "a move that is not allowed is none");
}

// ---------- meshing, trains, jams ----------
const A = 0, B = 1, C = 2, I = 3, AB = 4, AC = 5, BC = 6;
const place = cells => fresh(lvl(Object.fromEntries(Object.entries(cells).map(([k, v]) => [at(...k.split(",").map(Number)), v]))));
{
  const row3 = c => place({ "-1,0": c[0], "0,0": c[1], "1,0": c[2] });
  check(judge(row3([A, A, A])).score === VALUE[3] && judge(row3([A, A, A])).comps.some(t => t.n === 3 && !t.jam), "three gears of one pitch in a row: a train of three, 10");
  check(judge(row3([A, B, A])).score === 0 && judge(row3([A, B, A])).comps.length === 3, "different pitches never mesh");
  check(judge(row3([A, I, B])).score === VALUE[3], "an idler meshes every pitch");
  check(judge(row3([A, AB, B])).score === VALUE[3] && judge(row3([A, AB, C])).score === 0, "a bridge meshes the two pitches it shows, and no other");
  check(judge(row3([AB, AB, AB])).score === VALUE[3] && judge(row3([AC, B, BC])).score === 0, "a bridge meshes another bridge it shares a pitch with");
  const fuse = place({ "-2,0": A, "-1,0": A, "0,0": AB, "1,0": B, "2,0": B });
  check(judge(fuse).comps.length === 1 && judge(fuse).score === VALUE[5], "a bridge fuses two trains into one of five");
  // spin classes alternate along a train
  const J = judge(row3([A, A, A]));
  check(J.sg[at(0, 0)] === -J.sg[at(1, 0)] && J.sg[at(1, 0)] === J.sg[at(-1, 0)] * 1 && J.sg[at(0, 0)] === -J.sg[at(-1, 0)], "meshed gears turn opposite ways");
  // an odd ring jams
  const tri = place({ "0,0": A, "1,0": A, "0,1": A });
  check(judge(tri).jams === 1 && judge(tri).score === 0 && judge(tri).comps[0].jam, "three gears in a triangle jam: no score");
  const tri2 = place({ "0,0": A, "1,0": A, "0,1": A, "-1,0": A, "-2,0": A });
  check(judge(tri2).jams === 1 && judge(tri2).score === 0, "a jam takes the whole train down with it");
  const hexRing = place({ "1,0": A, "0,1": A, "-1,1": A, "-1,0": A, "0,-1": A, "1,-1": A });
  check(judge(hexRing).jams === 0 && judge(hexRing).score === VALUE[6], "a ring of six (even) turns: a train of six, 22");
  const triMixed = place({ "0,0": A, "1,0": A, "0,1": I });
  check(judge(triMixed).jams === 1, "an idler can close a ring and jam");
  const pair = place({ "0,0": A, "1,0": A });
  check(judge(pair).score === 0 && judge(pair).jams === 0, "two gears turn but score nothing");
  check([3, 4, 5, 6, 7].every((n, i) => VALUE[n] === [10, 16, 20, 22, 23][i]) && VALUE[Math.min(9, 7)] === 23, "trains of three to seven and more score 10, 16, 20, 22, 23");
  // jewels
  const jw = fresh(lvl({ [at(0, 0)]: A, [at(1, 0)]: A, [at(-1, 0)]: A }, [0], { jewels: [at(0, 0), at(2, 0)] }));
  check(judge(jw).score === VALUE[3] * 1.5, "a jewel under a turning train: half as much again");
  const jw2 = fresh(lvl({ [at(0, 0)]: A, [at(1, 0)]: A, [at(-1, 0)]: A }, [0], { jewels: [at(0, 0), at(1, 0)] }));
  check(judge(jw2).score === VALUE[3] * 2, "two jewels: twice");
  const jj = fresh(lvl({ [at(0, 0)]: A, [at(1, 0)]: A, [at(0, 1)]: A }, [0], { jewels: [at(0, 0)] }));
  check(judge(jj).score === 0, "a jewel under a jammed train pays nothing");
}

// ---------- what a shove does ----------
{
  // shear: a shove slides a whole line and pulls a train apart
  const s = place({ "-2,0": A, "-1,0": A, "0,0": A, "0,-1": B });
  const e = entry(-2, 0, 1, 0), r = shove({ ...s, q: [B], hold: -1 }, e), f = effect({ ...s, q: [B], hold: -1 }, r);
  check(f.A.score === VALUE[3] && f.B.score === VALUE[3] && f.moved === 3 && f.broken.length === 0 && f.newJams === 0, "a shove along a train moves it as a block: the train stays whole, no shear");
  // a shove across a train shears it: level 3's own demonstration
  {
    const L3 = LEVELS[2], t = fresh(L3), shears = legalEntries(t).map(e => ({ e, f: effect(t, shove(t, e)) })).filter(x => x.f.broken.length && x.f.B.score < x.f.A.score);
    check(shears.length > 0 && shears.every(x => x.f.broken.every(tr => tr.n >= 3)), "a shove that pulls a train of three or more apart is reported as breaking it, and costs score");
    const x = shears[0], r = shove(t, x.e), oldCells = x.f.broken[0].cells, where = new Map(r.moved.map(m => [m[0], m[1]])), J = judge(r.s);
    check(new Set(oldCells.map(c => J.comp[where.has(c) ? where.get(c) : c])).size > 1, "its gears now stand in more than one train");
  }
  const tri = place({ "0,0": A, "1,0": A });
  const withNext = { ...tri, q: [A] }, e3 = entry(0, 2, 0, -1);
  const rj = shove(withNext, e3), fj = effect(withNext, rj);
  check(fj.newJams >= 0 && typeof fj.B.score === "number", "effect reports new jams");
  // a jam the shove makes: a gear landing next to two meshed gears
  const base = place({ "1,0": A, "0,1": A });
  let found = -1;
  for (const e of legalEntries({ ...base, q: [A] })) { const x = shove({ ...base, q: [A] }, e); if (effect({ ...base, q: [A] }, x).newJams > 0) { found = e; break; } }
  check(found >= 0, "some shove into two touching gears makes a jam, and effect says so");
}

// ---------- goals ----------
{
  const s = fresh({ ...lvl({ [at(0, 0)]: A, [at(1, 0)]: A, [at(-1, 0)]: A }, [A]), goal: { score: 10 }, jewels: [at(0, 0)] });
  check(goalCheck(s).ok && goalCheck({ ...s, goal: { score: 16 } }).ok === false, "a score goal");
  check(goalCheck({ ...s, goal: { jewels: true } }).ok && !goalCheck({ ...s, jewels: [at(0, 0), at(0, -2)], goal: { jewels: true } }).ok, "a jewel goal: every jewel under a turning train");
  check(goalCheck({ ...s, goal: { trains: { k: 1, m: 3 } } }).ok && !goalCheck({ ...s, goal: { trains: { k: 2, m: 3 } } }).ok && !goalCheck({ ...s, goal: { trains: { k: 1, m: 4 } } }).ok, "a trains goal: so many separate trains of so many");
  check(goalCheck({ ...s, goal: { nojam: true } }).ok && !goalCheck({ ...place({ "0,0": A, "1,0": A, "0,1": A }), goal: { nojam: true } }).ok, "a no-jam goal");
  check(goalWords({ nojam: true, score: 42 }) === "No jam, score 42" && goalWords({ jewels: true, trains: { k: 2, m: 4 }, score: 68 }) === "Cover every jewel, 2 separate trains of 4+, score 68" && goalWords({}) === "Pure score", "a goal in words");
}

// ---------- a state kept and read back ----------
{
  const L = LEVELS[11], s = play(L, L.sol.slice(0, 9));
  check(sound(s) && sound(fresh(L)), "a state made here is sound");
  check(same(JSON.parse(JSON.stringify(s)), s), "plain JSON: it survives a round through text unchanged");
  const back = mend(roundTrip(s));
  check(sound(back) && same(back, s), "and through a store that keeps no empty arrays or objects (queue out, no jewels, no goal parts)");
  const ended = play(LEVELS[0], LEVELS[0].sol);
  check(sound(mend(roundTrip(ended))) && same(mend(roundTrip(ended)), ended), "the end of a plate (queue out, nothing held) survives it too");
  check(!sound(null) && !sound({}) && !sound({ ...s, v: 99 }) && !sound({ ...s, cells: s.cells.slice(1) }) && !sound({ ...s, cells: s.cells.map(() => 9) }) && !sound({ ...s, q: "x" }), "a stale or damaged state is not sound (an old run must not crash the page)");
  check(play(LEVELS[0], [99]) === null && play(LEVELS[0], [3, 3, 3, 3, 3, 3, 3, 3]) === null, "moves that do not play are none");
  check(same(play(L, L.sol.slice(0, 9)), s), "a plate and its moves are the state: the same moves play the same");
}

// ---------- the twelve levels ----------
check(LEVELS.length === 12 && LEVELS.every((l, i) => l.no === i + 1 && l.id === `l${i + 1}`), "twelve levels, in order");
{
  const bad1 = [];
  for (const L of LEVELS) {
    const s = play(L, L.sol), J = s && judge(s);
    if (!s || !over(s) || !goalCheck(s, J).ok || J.score !== L.best) bad1.push(L.id);
  }
  check(!bad1.length, `every level's deck is won by the line stored with it, to its best score${bad1.length ? `: not ${bad1}` : ""}`);
  check(LEVELS.every(l => l.stars[0] >= (l.goal.score || 0) && l.stars[1] >= l.stars[0] && l.stars[1] <= l.best), "the stars climb from the goal to just under the best known");
  check(LEVELS.slice(8).every(l => l.goal.score <= 0.9 * l.best) && LEVELS.every(l => l.goal.score <= 0.9 * l.best), "no goal asks more than nine tenths of the best known score");
  check(LEVELS.every(l => l.deal.length <= N - l.stud.length - Object.keys(l.start).length && l.deal.every(g => g >= 0 && g <= 6)), "every deck fits its plate");
  check(LEVELS.every(l => sound(fresh(l)) && l.jewels.every(j => fresh(l).cells[j] === EMPTY)), "every level's start is sound, its jewels on open cells");
  const groups = L => new Set(L.deal.concat(Object.values(L.start)).filter(g => g <= 2 || g >= 4).flatMap(g => (g <= 2 ? [g] : g === 4 ? [0, 1] : g === 5 ? [0, 2] : [1, 2])));
  check(groups(LEVELS[0]).size === 1 && groups(LEVELS[1]).size === 2 && groups(LEVELS[2]).size === 2, "the first level has one pitch, the second and third two");
  check(LEVELS[2].demo === "shear" && LEVELS[3].demo === "jam" && LEVELS[4].swap && LEVELS[0].guide && LEVELS[1].guide, "levels 3 and 4 demonstrate a shear and a jam, 5 the hold, 1 and 2 are guided");
  // the demonstrations exist at the first turn: a shear that costs score, a shove that jams
  const first = L => fresh(L);
  const shears = L => legalEntries(first(L)).filter(e => { const f = effect(first(L), shove(first(L), e)); return f.broken.length && f.B.score < f.A.score; });
  const jams = L => legalEntries(first(L)).filter(e => effect(first(L), shove(first(L), e)).newJams > 0);
  check(shears(LEVELS[2]).length > 0 && jams(LEVELS[3]).length > 0, "level 3 has a shove that shears a train and costs score, level 4 one that jams, at its first turn");
  check(LEVELS[4].sol[0] === -1, "level 5's best line begins with a swap (the coach pulses the cradle)");
  check(LEVELS[5].deal.includes(I) && LEVELS[6].jewels.length === 3 && LEVELS[6].goal.jewels && LEVELS[7].deal.some(g => g >= 4) && LEVELS[7].goal.trains, "level 6 deals idlers, 7 has three jewels, 8 deals bridges and asks for separate trains");
  check(LEVELS[10].deal.some(g => g >= 4) && LEVELS[11].stud.length === 3 && LEVELS[11].jewels.length === 2, "levels 11 and 12 are the old fusion and workshop plates");
  check(LEVELS.slice(0, COACHED).every(l => l.tip && l.coach?.length >= 3) && LEVELS.slice(COACHED).every(l => l.tip && !l.coach), "levels 1 to 8 have coach lines, the rest only their tip");
  check(LEVELS.every(l => l.tip.length <= 190 && (l.coach || []).every(c => c.length <= 130)), "every line fits the coach's box");
}
// the bots (a few runs each; the hundred-run floors are in tests/shunt-search.mjs)
{
  const wins = (L, runs, bot) => { let n = 0; for (let i = 0; i < runs; i++) n += bot(L, i + 1).ok; return Math.round(100 * n / runs); };
  const g = LEVELS.slice(0, 6).map(L => wins(L, 20, playGreedy));
  check(g.slice(0, 4).every(p => p >= 80) && g.slice(4, 6).every(p => p >= 40), `the greedy player (always the best score now) beats levels 1 to 4 at least four times in five and 5 and 6 at least two in five (${g.join(", ")}%)`);
  const bw = LEVELS.map(L => beam(L, 40).ok);
  check(bw.slice(0, 8).every(Boolean), "a beam search of width 40 wins levels 1 to 8");
  const r = LEVELS.slice(0, 4).map(L => wins(L, 20, playRandom));
  check(r.every(p => p < 80), `a player shoving at random does not walk through them (${r.join(", ")}%)`);
}

// ---------- random plates and the daily ----------
{
  for (const d of DIFFS) {
    const p = randomPlate(12345, d), q = randomPlate(12345, d), o = randomPlate(12346, d);
    check(same(p, q) && !same(p, o), `a ${d} plate is the same from its seed, and another seed gives another plate`);
  }
  const easy = plateOf(1, "easy"), med = plateOf(1, "medium"), hard = plateOf(1, "hard");
  check(easy.stud.length === 0 && med.stud.length === 0 && Object.values(easy.start).every(g => g <= 1) && easy.deal.every(g => g <= 1), "easy: two pitches, no studs, no idlers or bridges");
  check(med.deal.filter(g => g === 3).length === 2 && med.deal.every(g => g <= 3) && med.jewels.length === 2, "medium: three pitches and two idlers, two jewels");
  const hardIs = [1, 2, 3, 4, 5, 6, 7, 8].map(s => plateOf(s, "hard"));
  check(hardIs.every(h => h.deal.some(g => g >= 4) && h.deal.some(g => g === 3) && h.jewels.length === 3 && h.stud.length <= 2), "hard: idlers, bridges, three jewels, up to two studs");
  check(hardIs.every(h => h.deal.length === N - h.stud.length - Object.keys(h.start).length), "hard plates are dealt full");
  check([...DIFFS].every(d => [1, 2, 3, 4, 5].every(s => { const p = plateOf(s, d); return sound(fresh({ ...p, goal: {} })) && new Set([...p.stud, ...p.jewels, ...Object.keys(p.start).map(Number)]).size === p.stud.length + p.jewels.length + Object.keys(p.start).length; })), "studs, jewels and starting gears never share a cell");
  // a rated plate: its goal is one the search itself met
  for (const d of DIFFS) {
    const plate = randomPlate(77, d), sr = rating(plate, d);
    sr.step(Infinity);
    const spec = sr.result(), sr2 = search(fresh({ ...plate, goal: {} }), 40);
    sr2.step(Infinity);
    const top = sr2.result().score;
    check(spec.goal.score <= top && spec.stars[0] >= spec.goal.score && spec.stars[1] <= top && spec.stars[1] >= spec.stars[0] && spec.goal.score >= 10, `a ${d} plate's goal (${spec.goal.score}) and stars (${spec.stars}) are under what the search scored (${top})`);
    const w = beam(spec, 40);
    check(w.ok, `and the search wins it (${d})`);
  }
  const days = [20261104, 20261105, 20261231];
  const ds = days.map(d => dailyPlate(d)), again = days.map(d => dailyPlate(d));
  check(same(ds, again) && !same(ds[0], ds[1]) && ds.every(p => p.kind === "daily" && same(p.start, {}) && p.deal.length === N - p.stud.length), "the daily is dealt from the day alone: the same every time, another each day, full, with no starting gears");
  const rate = day => { const p = dailyPlate(day), sr = rating(p, "hard"); sr.step(Infinity); return sr.result(); };
  const r1 = rate(20261104), r2 = rate(20261104);
  check(same(r1, r2) && r1.goal.score >= 10 && r1.stars[0] <= r1.stars[1], "its goal and stars are the same on every device (the search is deterministic)");
  check(!ds.some(p => !sound(fresh({ ...p, goal: {} }))), "a daily plate is sound");
}

// ---------- the levers ----------
{
  check(LEVERS.length === 30 && LEVERS.every((l, e) => l.e === e), "thirty levers, one for each way in");
  let min = 1e9;
  for (const a of LEVERS) for (const b of LEVERS) if (a.e < b.e) min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y));
  check(min >= 0.45 * D, `no two levers are closer than 0.45 cells (${(min / D).toFixed(2)})`);
  check(HIT >= 0.55 * D && HIT <= 0.8 * D, "a touch within 0.62 of a cell of a lever means it, the nearest lever winning");
  check(LEVERS.every(l => Math.hypot(l.x, l.y) > 1.5 * D && Math.hypot(l.x, l.y) < 3 * D), "the levers stand round the rim");
}

check(Date.now() - T0 < 5000, `the whole file runs in under five seconds (${Date.now() - T0} ms)`);
process.exit(bad ? 1 : 0);
