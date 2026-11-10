// Shunt (shunt-engine.js, shunt-bots.js, shunt-levels.js; the page is shunt.js): the shove and the line rule, shear, jams by odd
// rings, bridges and idlers, trains and jewels, the goals and stars, a state kept and read back, the campaign (each deck won to three
// stars by the line stored with it, each of the twelve from before teaching what it says, the bots' floors), the daily, the levers.
// The slow searches (the beam at width 1500, a hundred runs of each bot) are in tests/shunt-search.mjs. Run: node tests/shunt.mjs
import { CELLS, N, ENTRIES, at, fresh, swap, shove, step, play, track, legal, legalEntries, canSwap, over, judge, goalCheck, starsOf, reach, progress, effect, sound, mend, movesOf, STUD, EMPTY } from "../shunt-engine.js";
import { rng, playRandom, playGreedy, beam, search, longest } from "../shunt-bots.js";
import { LEVELS, LEGACY, ENDLESS, CAMPAIGN, COACHED, goalWords, tiers, dailyPlate, rating } from "../shunt-levels.js";
import { LEVERS, D, HIT } from "../shunt-view-2d.js";
import { roundTrip } from "./rtdb.js";

let bad = 0;
/** The twelve levels from before, as they stand in the campaign (their ids, their coach). */
const OLD = LEGACY.map(d => LEVELS.find(l => l.id === d.id));
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
  const sz = s => judge(s).sizes.join();
  check(sz(row3([A, A, A])) === "3" && judge(row3([A, A, A])).comps.some(t => t.n === 3 && !t.jam), "three gears of one pitch in a row: a train of three");
  check(sz(row3([A, B, A])) === "" && judge(row3([A, B, A])).comps.length === 3, "different pitches never mesh");
  check(sz(row3([A, I, B])) === "3", "an idler meshes every pitch");
  check(sz(row3([A, AB, B])) === "3" && sz(row3([A, AB, C])) === "", "a bridge meshes the two pitches it shows, and no other");
  check(sz(row3([AB, AB, AB])) === "3" && sz(row3([AC, B, BC])) === "", "a bridge meshes another bridge it shares a pitch with");
  const fuse = place({ "-2,0": A, "-1,0": A, "0,0": AB, "1,0": B, "2,0": B });
  check(judge(fuse).comps.length === 1 && sz(fuse) === "5", "a bridge fuses two trains into one of five");
  // spin classes alternate along a train
  const J = judge(row3([A, A, A]));
  check(J.sg[at(0, 0)] === -J.sg[at(1, 0)] && J.sg[at(1, 0)] === J.sg[at(-1, 0)] * 1 && J.sg[at(0, 0)] === -J.sg[at(-1, 0)], "meshed gears turn opposite ways");
  // an odd ring jams
  const tri = place({ "0,0": A, "1,0": A, "0,1": A });
  check(judge(tri).jams === 1 && sz(tri) === "" && judge(tri).comps[0].jam, "three gears in a triangle jam: no train");
  const tri2 = place({ "0,0": A, "1,0": A, "0,1": A, "-1,0": A, "-2,0": A });
  check(judge(tri2).jams === 1 && sz(tri2) === "", "a jam takes the whole train down with it");
  const hexRing = place({ "1,0": A, "0,1": A, "-1,1": A, "-1,0": A, "0,-1": A, "1,-1": A });
  check(judge(hexRing).jams === 0 && sz(hexRing) === "6", "a ring of six (even) turns: a train of six");
  const triMixed = place({ "0,0": A, "1,0": A, "0,1": I });
  check(judge(triMixed).jams === 1, "an idler can close a ring and jam");
  const pair = place({ "0,0": A, "1,0": A });
  check(sz(pair) === "" && judge(pair).jams === 0, "two gears turn but are no train");
  const two = place({ "-2,0": A, "-1,0": A, "0,0": A, "0,-2": B, "1,-2": B, "2,-2": B, "2,-1": B });
  check(sz(two) === "4,3" && reach(judge(two), 1) === 4 && reach(judge(two), 2) === 3 && reach(judge(two), 3) === 0, "trains longest first: two trains of 3+, one of 4+, not three");
  check(progress(judge(two), 2, 4) === 7 && progress(judge(two), 2, 3) === 6 && progress(judge(pair), 1, 5) === 2 && progress(judge(pair), 1, 5, true) === 0, "progress counts the k longest groups towards a length, a pair on its way to a train too (unless only trains count)");
  // jewels
  const jw = fresh(lvl({ [at(0, 0)]: A, [at(1, 0)]: A, [at(-1, 0)]: A }, [0], { jewels: [at(0, 0), at(2, 0)], goal: { jewels: true } }));
  check(goalCheck(jw).parts[0].have === 1, "a jewel is covered under a turning train, not on an empty cell");
  const jj = fresh(lvl({ [at(0, 0)]: A, [at(1, 0)]: A, [at(0, 1)]: A }, [0], { jewels: [at(0, 0)], goal: { jewels: true } }));
  check(!goalCheck(jj).ok, "a jewel under a jammed train is not covered");
}

// ---------- what a shove does ----------
{
  // shear: a shove slides a whole line and pulls a train apart
  const s = place({ "-2,0": A, "-1,0": A, "0,0": A, "0,-1": B });
  const e = entry(-2, 0, 1, 0), r = shove({ ...s, q: [B], hold: -1 }, e), f = effect({ ...s, q: [B], hold: -1 }, r);
  check(f.A.sizes.join() === "3" && f.B.sizes.join() === "3" && f.moved === 3 && f.broken.length === 0 && f.newJams === 0, "a shove along a train moves it as a block: the train stays whole, no shear");
  // a shove across a train shears it: level 3's own demonstration
  {
    const L3 = OLD[2], t = fresh(L3), k = L3.goal.trains.k, aim = L3.stars[1];
    const shears = legalEntries(t).map(e => ({ e, f: effect(t, shove(t, e)) })).filter(x => x.f.broken.length && progress(x.f.B, k, aim, true) < progress(x.f.A, k, aim, true));
    check(shears.length > 0 && shears.every(x => x.f.broken.every(tr => tr.n >= 2)), "a shove that pulls a train apart is reported as breaking it, and sets the trains back");
    const x = shears[0], r = shove(t, x.e), oldCells = x.f.broken[0].cells, where = new Map(r.moved.map(m => [m[0], m[1]])), J = judge(r.s);
    check(new Set(oldCells.map(c => J.comp[where.has(c) ? where.get(c) : c])).size > 1, "its gears now stand in more than one train");
  }
  const tri = place({ "0,0": A, "1,0": A });
  const withNext = { ...tri, q: [A] }, e3 = entry(0, 2, 0, -1);
  const rj = shove(withNext, e3), fj = effect(withNext, rj);
  check(fj.newJams >= 0 && Array.isArray(fj.B.sizes), "effect reports new jams");
  // a jam the shove makes: a gear landing next to two meshed gears
  const base = place({ "1,0": A, "0,1": A });
  let found = -1;
  for (const e of legalEntries({ ...base, q: [A] })) { const x = shove({ ...base, q: [A] }, e); if (effect({ ...base, q: [A] }, x).newJams > 0) { found = e; break; } }
  check(found >= 0, "some shove into two touching gears makes a jam, and effect says so");
}

// ---------- goals ----------
{
  const s = fresh({ ...lvl({ [at(0, 0)]: A, [at(1, 0)]: A, [at(-1, 0)]: A }, [A]), goal: { trains: { k: 1, m: 3 } }, jewels: [at(0, 0)] });
  check(goalCheck(s).ok && goalCheck({ ...s, goal: { trains: { k: 1, m: 4 } } }).ok === false, "a trains goal: a train of 3+ is there, of 4+ not");
  check(goalCheck({ ...s, goal: { jewels: true } }).ok && !goalCheck({ ...s, jewels: [at(0, 0), at(0, -2)], goal: { jewels: true } }).ok, "a jewel goal: every jewel under a turning train");
  check(goalCheck({ ...s, goal: { trains: { k: 1, m: 3 } } }).ok && !goalCheck({ ...s, goal: { trains: { k: 2, m: 3 } } }).ok && !goalCheck({ ...s, goal: { trains: { k: 1, m: 4 } } }).ok, "a trains goal: so many separate trains of so many");
  check(goalCheck({ ...s, goal: { nojam: true } }).ok && !goalCheck({ ...place({ "0,0": A, "1,0": A, "0,1": A }), goal: { nojam: true } }).ok, "a no-jam goal");
  check(goalWords({ nojam: true, trains: { k: 2, m: 5 } }) === "2 trains of 5+, no jam" && goalWords({ jewels: true, trains: { k: 1, m: 9 } }) === "A train of 9+, cover every jewel", "a goal in words");
  // stars: none for a goal missed, one for the goal, one more for each longer size the same number of trains reach
  const st = place({ "-2,0": A, "-1,0": A, "0,0": A, "1,0": A, "0,-2": B, "1,-2": B, "2,-2": B, "2,-1": B });
  const at2 = (m, conds = {}) => ({ ...st, goal: { trains: { k: 2, m }, ...conds } });
  check(starsOf(at2(3), null, [4, 5]) === 2 && starsOf(at2(3), null, [3, 4]) === 3 && starsOf(at2(4), null, [5, 6]) === 1 && starsOf(at2(5), null, [6, 7]) === 0, "stars: the goal one, each longer size one more");
  check(starsOf({ ...at2(3, { jewels: true }), jewels: [at(-1, 1)] }, null, [4, 4]) === 0, "and none while another part of the goal is missed");
  check(JSON.stringify(tiers(2, 7)) === '{"trains":{"k":2,"m":5},"stars":[6,7]}' && tiers(3, 4).trains.m === 3, "the goal two gears short of the longest trains found, a star for each gear more");
}

// ---------- a state kept and read back ----------
{
  const L = OLD[11], s = play(L, L.sol.slice(0, 9));
  check(sound(s) && sound(fresh(L)), "a state made here is sound");
  check(same(JSON.parse(JSON.stringify(s)), s), "plain JSON: it survives a round through text unchanged");
  const back = mend(roundTrip(s));
  check(sound(back) && same(back, s), "and through a store that keeps no empty arrays or objects (queue out, no jewels, no goal parts)");
  const ended = play(OLD[0], OLD[0].sol);
  check(sound(mend(roundTrip(ended))) && same(mend(roundTrip(ended)), ended), "the end of a plate (queue out, nothing held) survives it too");
  check(!sound(null) && !sound({}) && !sound({ ...s, v: 99 }) && !sound({ ...s, cells: s.cells.slice(1) }) && !sound({ ...s, cells: s.cells.map(() => 9) }) && !sound({ ...s, q: "x" }), "a stale or damaged state is not sound (an old run must not crash the page)");
  check(play(OLD[0], [99]) === null && play(OLD[0], [3, 3, 3, 3, 3, 3, 3, 3]) === null, "moves that do not play are none");
  check(same(play(L, L.sol.slice(0, 9)), s), "a plate and its moves are the state: the same moves play the same");
}

// ---------- the campaign (campaign.js holds its rules; tests/campaign.mjs its data) and Endless ----------
check(LEVELS.every((l, i) => l.no === i + 1) && OLD.every(Boolean) && CAMPAIGN.chapters.length >= 6 && CAMPAIGN.chapters.every((_, c) => { const n = LEVELS.filter(l => l.chapter === c).length; return n >= 3 && n <= 5; }),
  "the levels are numbered in order, the twelve from before are in the campaign, and a chapter is as long as its lessons: three to five levels");
check(LEVELS.filter(l => l.role === "intro").length === CAMPAIGN.chapters.length - 1 && LEVELS.filter(l => l.role === "cap").length === CAMPAIGN.chapters.length && CAMPAIGN.chapters.every((_, c) => LEVELS.filter(l => l.chapter === c).at(-1).role === "cap"),
  "every chapter ends with its capstone, and all but the last (where the twists meet) open with an introduction");
check(LEVELS.filter((l, i) => LEVELS[i - 1]?.chapter !== l.chapter).every(l => l.tip), "a chapter's first level says what the chapter brings");
check(LEVELS.filter(l => l.chapter === 0).every(l => l.tip) && LEVELS[1].goal.trains.k === 1 && LEVELS[2].goal.trains.k === 2 && LEVELS.filter(l => l.chapter === 0).every(l => !l.deal.some(g => g > 0)),
  "the first chapter, one pitch: the shove, a train kept a chain (a jam), then two trains rather than one, each level saying its lesson");
check(ENDLESS.length >= 200 && ENDLESS.every((e, n) => n === 0 || e.needs >= ENDLESS[n - 1].needs) && ENDLESS.filter(e => e.milestone).length === Math.floor(ENDLESS.length / 25), "Endless: hundreds of plates, the chapters they wait for in order, a milestone every 25th");
{
  const bad1 = [];
  const ALL = [...LEVELS, ...ENDLESS.map((e, n) => ({ ...e, id: `endless ${n + 1}` }))];
  for (const L of ALL) {
    const s = play(L, L.sol), J = s && judge(s);
    if (!s || !over(s) || starsOf(s, J, L.stars) !== 3 || reach(J, L.goal.trains.k) !== L.best) bad1.push(L.id);
  }
  check(!bad1.length, `every level's deck, and every Endless plate's, is won to three stars by the line stored with it${bad1.length ? `: not ${bad1.slice(0, 5)}` : ""}`);
  check(ALL.every(l => l.goal.trains && l.goal.trains.m >= 3 && same(l.stars, [l.goal.trains.m + 1, l.goal.trains.m + 2]) && l.stars[1] === l.best), "each goal is trains two gears short of the longest found, a star for each gear more");
  check(ALL.every(l => !("score" in l.goal)), "no points anywhere");
  check(ALL.every(l => l.deal.length <= N - l.stud.length - Object.keys(l.start).length && l.deal.every(g => g >= 0 && g <= 6)), "every deck fits its plate");
  check(ALL.every(l => sound(fresh(l)) && l.jewels.every(j => fresh(l).cells[j] === EMPTY)), "every plate's start is sound, its jewels on open cells");
  const groups = L => new Set(L.deal.concat(Object.values(L.start)).filter(g => g <= 2 || g >= 4).flatMap(g => (g <= 2 ? [g] : g === 4 ? [0, 1] : g === 5 ? [0, 2] : [1, 2])));
  check(groups(OLD[0]).size === 1 && groups(OLD[1]).size === 2 && groups(OLD[2]).size === 2, "the first level has one pitch, the second and third two");
  check(OLD[2].demo === "shear" && OLD[3].demo === "jam" && OLD[4].swap && OLD[0].guide && OLD[1].guide, "levels 3 and 4 demonstrate a shear and a jam, 5 the hold, 1 and 2 are guided");
  // the demonstrations exist at the first turn: a shear that sets the trains back, a shove that jams
  const first = L => fresh(L);
  const shears = L => legalEntries(first(L)).filter(e => { const f = effect(first(L), shove(first(L), e)), k = L.goal.trains.k; return f.broken.length && progress(f.B, k, L.stars[1], true) < progress(f.A, k, L.stars[1], true); });
  const jams = L => legalEntries(first(L)).filter(e => effect(first(L), shove(first(L), e)).newJams > 0);
  check(shears(OLD[2]).length > 0 && jams(OLD[3]).length > 0, "level 3 has a shove that shears a train and sets the trains back, level 4 one that jams, at its first turn");
  check(OLD[4].sol[0] === -1, "level 5's best line begins with a swap (the coach pulses the cradle)");
  check(OLD[5].deal.includes(I) && OLD[6].jewels.length === 3 && OLD[6].goal.jewels && OLD[7].deal.some(g => g >= 4) && OLD[7].goal.trains.k === 2, "level 6 deals idlers, 7 has three jewels, 8 deals bridges and asks for two separate trains");
  check(OLD[10].deal.some(g => g >= 4) && OLD[11].stud.length === 3 && OLD[11].jewels.length === 2, "levels 11 and 12 are the old fusion and workshop plates");
  check(OLD.every(l => COACHED.has(l.id) === !!l.coach) && OLD.slice(0, 8).every(l => l.tip && l.coach?.length >= 3) && OLD.slice(8).every(l => l.tip && !l.coach), "the first eight from before have coach lines, the rest only their tip");
  check(LEVELS.every(l => (l.tip || "").length <= 190 && (l.coach || []).every(c => c.length <= 130)), "every line fits the coach's box");
}
// the bots (a few runs each; the hundred-run floors are in tests/shunt-search.mjs)
{
  const wins = (L, runs, bot) => { let n = 0; for (let i = 0; i < runs; i++) n += bot(L, i + 1).ok; return Math.round(100 * n / runs); };
  const g = OLD.slice(0, 6).map(L => wins(L, 20, playGreedy));
  check(g.every(p => p >= 80), `the greedy player (the shove that looks best at once) beats levels 1 to 6 at least four times in five (${g.join(", ")}%)`);
  const bw = OLD.map(L => beam(L, 40).ok);
  check(bw.slice(0, 8).every(Boolean), "a beam search of width 40 wins levels 1 to 8");
  const r = OLD.slice(0, 4).map(L => wins(L, 20, playRandom));
  check(r.every(p => p < 80), `a player shoving at random does not walk through them (${r.join(", ")}%)`);
}

// ---------- the daily ----------
{
  const days = [20261104, 20261105, 20261231];
  const ds = days.map(d => dailyPlate(d)), again = days.map(d => dailyPlate(d));
  check(same(ds, again) && !same(ds[0], ds[1]) && ds.every(p => p.kind === "daily" && same(p.start, {}) && p.deal.length === 16 && p.jewels.length === 2 && p.stud.length <= 2), "the daily is dealt from the day alone: the same every time, another each day, sixteen gears, two jewels, no starting gears");
  check(ds.every(p => p.deal.some(g => g === 3) && p.deal.filter(g => g >= 4).length === 2) && ds.every(p => new Set([...p.stud, ...p.jewels]).size === p.stud.length + p.jewels.length), "an idler or two and two bridges; studs and jewels never share a cell");
  const rate = day => { const p = dailyPlate(day), sr = rating(p); sr.step(Infinity); return sr.result(); };
  const r1 = rate(20261104), r2 = rate(20261104);
  check(same(r1, r2) && r1.goal.trains && r1.goal.jewels && r1.stars[1] === r1.best && r1.stars[0] === r1.best - 1, "its goal and stars are the same on every device (the search is deterministic): trains two gears short, a star for each gear more");
  const top = longest(r1, r1.goal.trains.k);
  top.step(Infinity);
  check(top.result().m >= r1.best && beam(r1, 40).ok, `and the search makes them (${goalWords(r1.goal)}, stars at ${r1.stars})`);
  check(!ds.some(p => !sound(fresh(p))), "a daily plate is sound");
}

// ---------- the levers ----------
{
  check(LEVERS.length === 30 && LEVERS.every((l, e) => l.e === e), "thirty levers, one for each way in");
  let min = 1e9;
  for (const a of LEVERS) for (const b of LEVERS) if (a.e < b.e) min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y));
  check(min >= 0.4 * D, `no two levers (tabs) are closer than 0.4 cells (${(min / D).toFixed(2)})`);
  check(HIT >= 0.55 * D && HIT <= 0.8 * D, "a touch within 0.8 of a cell of a lever means it, the nearest lever winning");
  check(LEVERS.every(l => Math.hypot(l.x, l.y) > 1.5 * D && Math.hypot(l.x, l.y) < 3 * D), "the levers stand round the board's outline");
}

check(Date.now() - T0 < 5000, `the whole file runs in under five seconds (${Date.now() - T0} ms)`);
process.exit(bad ? 1 : 0);
