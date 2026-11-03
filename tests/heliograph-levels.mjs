// Heliograph's levels (heliograph-levels.js on heliograph-engine.js): six stations of four levels, each station bringing one new
// thing (lanterns, a prism, shutters, the sun); every level's rules are sound, every deal of it is one the simple player
// wins, no level can be left stuck (a move is always there, a shot always counts, the shots run out), the stars and the
// goal's words, and what each new thing does to the light. Run: node tests/heliograph-levels.mjs
import { MIRRORS, CELLS, SHAPES, BEACON_BONUS, CLEAR_BONUS, newGame, copy, trace, fire, plan, pieces, pieceById, canMove, movesFor, fixtures, closed, beaconsOf, sunAngle, lightAt, lineOf } from "../heliograph-engine.js";
import { LEVELS, CHAPTERS, rulesOf, starsOf, starsInReach, featuresOf, goalSentence, goalShort, goalWords, meterOf, played, dealLevel } from "../heliograph-levels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const N = CELLS.length;

// ---------- the ladder ----------
{
  check(CHAPTERS.length === 6 && CHAPTERS.every(c => c.levels.length === 4) && LEVELS.length === 24, "six stations of four levels");
  check(new Set(LEVELS.map(L => L.name)).size === LEVELS.length && LEVELS.every((L, n) => L.n === n && L.name && L.about), "every level has a name of its own and a line");
  check(LEVELS.every(L => SHAPES[L.shape]), "every level hangs a shape the engine has");
  // each station's new thing: the first level that has a feature is in the station that brings it
  const firstAt = {};
  LEVELS.forEach(L => featuresOf(rulesOf(L.n)).forEach(id => { if (!(id in firstAt)) firstAt[id] = L.chapter; }));
  check(firstAt.quota === 0 && firstAt.beacons === 1 && firstAt.prism === 2 && firstAt.shutter === 3 && firstAt.blink === 3 && firstAt.sun === 4 && firstAt.clear === 5, `the stations bring the quota, lanterns, the prism, shutters, the sun and the clear in turn (${JSON.stringify(firstAt)})`);
  check(LEVELS.filter(L => L.chapter === 5).slice(0, 3).every(L => featuresOf(rulesOf(L.n)).length >= 2), "the last station mixes what came before");
  check(LEVELS.every(L => { const x = rulesOf(L.n); return x.lv === L.n && x.shots >= 6 && x.shots <= 14 && x.goal && (x.crystals >= 0 && x.crystals <= 2); }), "every level has its number, 6 to 14 shots, a goal and 0 to 2 colour crystals");
  check(LEVELS.every(L => { const g = L.goal; return g.kind === "score" ? g.n > 0 && g.more.length === 2 && g.more[0] > g.n && g.more[1] > g.more[0] : g.pars.length === 2 && g.pars[1] <= g.pars[0] && g.pars[0] <= L.shots && (g.kind === "clear" || L.marks); }), "a quota's stars rise; a lantern or clear level's pars fall and fit the shots, and lanterns need marks");
  check(LEVELS.every(L => rulesOf(L.n).crystals > 0 || rulesOf(L.n).fix?.some(f => f.k === "prism")), "a level with no colour crystal has a prism to colour the light");
  check(LEVELS.filter(L => L.goal.kind === "score").every(L => L.goal.more[1] <= 2500), "no quota asks for more than a bot-sized game");
}

// ---------- a deal is as the level says (that the simple player wins it: tests/heliograph-deals.mjs) ----------
{
  let ok = true, why = "", total = 0;
  for (const L of LEVELS) for (const seed of [3, 1009, 55555]) {
    const s = newGame(seed, rulesOf(L.n));
    total++;
    const x = s.x, problems = [
      x.lv !== L.n && "its number is not kept",
      s.crystals.length !== L.crystals && "wrong number of colour crystals",
      s.over && "dealt over",
      (s.shots !== 0 || s.score !== 0) && "not at the start",
      L.marks && new Set((x.beacons || []).map(id => id % N)).size !== L.marks.n && "lanterns not on strings of their own",
      L.marks && !(x.beacons || []).every(id => pieces(s).some(q => q.id === id)) && "a lantern that is not in the chandelier",
      !L.marks && x.beacons && "lanterns where there are none",
      JSON.stringify(JSON.parse(JSON.stringify(s))) !== JSON.stringify(s) && "does not survive being saved",
    ].filter(Boolean);
    if (problems.length) { ok = false; why += `${L.name} (${seed}): ${problems.join("; ")}. `; }
  }
  check(ok, ok ? `every deal (${total}: three seeds of each level) is as the level says, and survives being saved` : why);
  const a = dealLevel(5, 77), b = dealLevel(5, 77);
  check(JSON.stringify(a) === JSON.stringify(b), "a level dealt from the same seed is the same game");
}

// ---------- no level can be left stuck ----------
{
  let ok = true, why = "";
  for (const L of LEVELS) {
    const s0 = newGame(11, rulesOf(L.n));
    // nothing set, nothing done: the shots run out and the level ends not won
    let s = copy(s0), k = 0;
    while (!s.over && k < 40) { s = fire(s).state; k++; }
    if (!s.over || k > L.shots || s.won) { ok = false; why += `${L.name}: fired empty ${k} times, ${s.over ? "over" : "not over"}${s.won ? ", won" : ""}. `; }
    // played by a player that looks at four aims, each shot starts with a move to make and room for a mirror
    s = copy(s0); k = 0;
    while (!s.over && k < 40) {
      if (!canMove(s) || s.moves !== movesFor(s.shots) || s.mirrors.length > MIRRORS) { ok = false; why += `${L.name}: shot ${k} starts with no move. `; break; }
      const f = fire(plan(s, "glance"));
      if (f.state.shots !== s.shots + 1) { ok = false; why += `${L.name}: a shot did not count. `; break; }
      s = f.state; k++;
    }
    if (!s.over) { ok = false; why += `${L.name}: never ended. `; }
  }
  check(ok, ok ? "fired empty, every level ends within its shots; played, every shot starts with a move and counts" : why);
}

// ---------- stars, the goal's words, the meter ----------
{
  const q = rulesOf(0), g = q.goal;
  check([0, g.n - 1, g.n, g.more[0], g.more[1] + 1].map(score => starsOf(q, { score })).join() === "0,0,1,2,3", "a quota: a star at the quota, one at each higher score");
  const b = rulesOf(4), bp = b.goal.pars;
  const metIn = shots => starsOf(b, { met: true, metAt: shots });
  check(starsOf(b, { met: false, metAt: 0 }) === 0 && metIn(b.shots) === 1 && metIn(bp[0]) === 2 && metIn(bp[1]) === 3 && metIn(bp[1] - 1) === 3, "lanterns: a star for bringing them down, more for fewer shots");
  const reach = k => starsInReach(b, { shots: k, over: false });
  check(reach(0) === 3 && reach(bp[1] - 1) === 3 && reach(bp[1]) === 2 && reach(bp[0] - 1) === 2 && reach(bp[0]) === 1 && reach(b.shots - 1) === 1, "lanterns: the stars still within reach fall as the shots are used, to the one for bringing them down");
  check(goalSentence(q).startsWith("Reach") && goalSentence(rulesOf(4)).includes("lanterns") && goalSentence(rulesOf(23)).startsWith("Clear"), "the goal in a sentence: reach, bring down, clear");
  check(goalShort(q).includes(String(q.shots)) && goalShort(rulesOf(23)).includes("Clear"), "the goal in a few words for the list");
  const s = dealLevel(4, 5);
  check(goalWords(rulesOf(4), s).includes("0 of 2") && goalWords(rulesOf(0), dealLevel(0, 5)).startsWith("Quota"), "the goal row says the lanterns down of the lanterns, or the quota");
  const m = meterOf(q, { score: g.more[1] / 2 });
  check(Math.abs(m.fill - 0.5) < 1e-9 && m.marks.length === 2 && m.marks[0] < m.marks[1], "a quota's meter runs to the last star, with a tick at each of the others");
  check(meterOf(b, { shots: 2 }).marks.length === 2, "a lantern level's meter has a tick where each of the upper stars is lost");
}

// ---------- what each new thing does to the light ----------
const row = CELLS.map((c, i) => [c, i]).filter(([c]) => c.r === 0).sort(([a], [b]) => a.q - b.q).map(([, i]) => i);
/** A game set by hand, with no mirrors or colour crystals: a layer of the chandelier of each colour of `layers` along the middle row. */
function table(x, layers) {
  const s = newGame(1, { lv: 0, shape: "column", colours: [0, 1, 2, 3], extra: 0, crystals: 0, every: 99, shots: 8, goal: { kind: "score", n: 9999, more: [] }, fix: [], ...x });
  s.serial = 0;
  s.depth = CELLS.map((cell, i) => (row.includes(i) ? layers.length : 0));
  s.layers = layers.map(c => ({ s: s.serial++, c: CELLS.map((cell, i) => (row.includes(i) ? c : -1)) }));
  s.mirrors = []; s.crystals = []; s.untilDrop = 99;
  return s;
}
{
  // the prism: the light through it carries its two colours, and it is not spent
  const prism = { fix: [{ k: "prism", p: [-3, 6, 0], cs: [0, 1] }], port: [-3, 14, 0] };
  const s = table(prism, [0]);
  const t = trace(s);
  check(t.legs.at(-1).cs.join() === "0,1" && t.cross.length === 1 && t.cross[0].kind === "prism", "white light through a prism carries its two colours");
  check(trace(table(prism, [0])).crossed.length === 0, "a prism is no colour crystal: nothing is spent");
  const before = JSON.stringify(fixtures(s)), after = fire(s).state;
  check(JSON.stringify(fixtures(after)) === before && after.crystals.length === 0, "a prism is never spent or replaced");
}
{
  // a shutter: shut, the light stops at it; open, it goes through; by cycle, shot by shot
  const fix = shut => [{ k: "shutter", p: [-3, 9, 0], n: [0, 1, 0], r: 1.5, ...(shut === "cycle" ? { cycle: [1, 0] } : {}) }];
  const s = table({ fix: fix(true), port: [-3, 14, 0] }, [0]);
  check(trace(s).stop.what === "shutter" && trace(s).legs.length === 1 && Math.abs(trace(s).stop.at[1] - 9) < 1e-6, "light stops at a shut shutter, where it meets it");
  const c = table({ fix: fix("cycle"), port: [-3, 14, 0] }, [0]);
  const closedNow = k => closed({ ...c, shots: k }, fixtures(c)[0]);
  check(closedNow(0) && !closedNow(1) && closedNow(2) && !closedNow(3), "a cycled shutter is shut and open by turns, by the shot's number");
  check(trace(c).stop.what === "shutter" && trace({ ...c, shots: 1 }).stop.what !== "shutter", "and the light meets it as it stands for the shot");
  const f = fire(c);
  check(f.state.shots === 1 && f.gain === 0 && f.shattered.length === 0, "firing against a shut shutter is a shot, not a stall, and brings nothing down");
}
{
  // the sun: the light slants a little more each shot, from `from` to `to` over the level
  const x = rulesOf(LEVELS.findIndex(L => L.sun && L.sun.from === -24));
  const s = newGame(1, x), last = x.shots - 1;
  check(Math.abs(sunAngle(s, 0) - x.sun.from) < 1e-9 && Math.abs(sunAngle(s, last) - x.sun.to) < 1e-9 && sunAngle(s, last + 5) === x.sun.to, "the sun runs from its first angle to its last over the shots, and stays there");
  const d0 = lightAt(s, 0).d, d1 = lightAt(s, last).d;
  check(d0[0] < 0 && Math.abs(d1[0]) < 1e-9 && Math.abs(Math.hypot(...d0) - 1) < 1e-9, "the light slants one way, then falls straight, a unit direction");
  check(sunAngle(newGame(1), 3) === 0 && lightAt(newGame(1)).d.join() === "0,-1,0", "with no sun the light falls straight down");
}
{
  // lanterns: crystals of the chandelier that count when they are gone; the bonus is paid once each; the last ends the level
  const s = dealLevel(4, 5), ids = beaconsOf(s);
  check(ids.length === 2 && ids.every(id => pieceById(s, id)) && new Set(ids.map(id => id % N)).size === 2, "a level's lanterns are crystals of the chandelier, each on a string of its own");
  const none = fire(s);
  check(none.downed === 0 && none.gain === 0 && beaconsOf(none.state).length === 2 && !none.state.over, "a shot that brings no lantern down leaves the level going");
  const take = (g, id) => { const t = copy(g); t.layers.find(l => l.s === Math.floor(id / N)).c[id % N] = -1; return t; };
  const one = fire(take(s, ids[0]));
  check(one.downed === 1 && one.gain >= BEACON_BONUS && beaconsOf(one.state).join() === String(ids[1]) && !one.state.over && !one.state.met, "one lantern down: its bonus is paid and the other is left");
  const two = fire(take(one.state, ids[1]));
  check(two.downed === 1 && two.state.met && two.state.metAt === 2 && two.state.over && two.state.won && !beaconsOf(two.state).length, "the last lantern down ends the level, won, in the shots it took");
  const late = fire(take(s, ids[0]));
  const again = fire(late.state);
  check(late.gain >= BEACON_BONUS && again.gain === 0 && again.downed === 0, "a lantern's bonus is paid once");
  const won = played(dealLevel(4, 5));
  check(won.won && won.over && won.score >= BEACON_BONUS * 2, "the simple player brings the lanterns down, the bonus paid for each");
}
{
  // clearing: nothing refills the chandelier, and the last crystal ends the level with the bonus
  const s = dealLevel(23, 3);
  check(s.x.goal.kind === "clear", "the last level asks for the whole chandelier");
  let t = copy(s);
  for (let i = 0; i < 3 && !t.over; i++) t = fire(t).state;
  check(t.layers.length <= s.layers.length, "it hangs no new crystals as the shots go by");
  const empty = copy(s);
  empty.layers.forEach(l => l.c.fill(-1));
  const f = fire(empty);
  check(f.cleared && f.gain === CLEAR_BONUS && f.state.over && f.state.won && !pieces(f.state).length, "with nothing left the bonus is paid, nothing is hung again, the level is won");
  const endless = newGame(5);
  endless.layers.forEach(l => l.c.fill(-1));
  const g = fire(endless);
  check(g.cleared && g.gain === CLEAR_BONUS && pieces(g.state).length > 0 && !g.state.over, "in the endless game the same bonus is paid, and a new chandelier hung");
}

// ---------- a game saved and opened again; the endless game as it was ----------
{
  let s = dealLevel(15, 9), k = 0, same = true;
  while (!s.over && k < 6) {
    const planned = plan(s, "best"), a = fire(planned), b = fire(JSON.parse(JSON.stringify(planned)));
    if (JSON.stringify(a.state) !== JSON.stringify(b.state)) same = false;
    s = JSON.parse(JSON.stringify(a.state)); k++;
  }
  check(same, "a level saved and opened again goes on as it would have (its rules are in the game)");
  const c = newGame(5);
  check(!("x" in c) && c.crystals.length === 2 && c.v === 4, "the endless game has no rules of a level in it, and the same shape as ever");
  const e = fire(plan(c, "best")).state;
  check(e.x === undefined && e.won === undefined && e.met === undefined && lineOf(e) === 2.2, "and a shot of it keeps it so (no goal, no win, the old line)");
  const old = JSON.parse(JSON.stringify(c));
  check(fire(old).state.shots === 1, "a game saved before the levels still plays on");
}

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
