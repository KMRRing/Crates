// Heliograph's levels (heliograph-levels.js on heliograph-engine.js): six stations of five levels, each made by hand with a
// designed answer (heliograph-answers.js). Every answer is played through the engine and wins in the shots the stars say; the
// stations bring their twists in turn; the simple players do not three-star the levels that should take insight; a level
// cannot be left stuck; the goal's words, the stars, the meter. Run: node tests/heliograph-levels.mjs
import { newGame, copy, fire, plan, canMove, movesFor, handLeft, addMirror, moveMirror, turnMirror, hangFrom, CELLS } from "../heliograph-engine.js";
import { LEVELS, CHAPTERS, ANSWERS, rulesOf, starsOf, starsInReach, featuresOf, goalSentence, goalShort, goalWords, meterOf, played, dealLevel } from "../heliograph-levels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

/** A level played by its designed answer: the game at the end. An answer is a list of shots, each the mirrors set, moved or turned: ["add", p, n], ["move", id, p, n], ["turn", id, n]. */
function answered(n) {
  let s = dealLevel(n);
  for (const shot of ANSWERS[n]) {
    for (const [op, a, b, c] of shot) s = op === "add" ? addMirror(s, a, b) : op === "move" ? turnMirror(moveMirror(s, a, b), a, c) : turnMirror(s, a, b);
    s = fire(s).state;
    if (s.over) break;
  }
  return s;
}

// ---------- the ladder ----------
{
  check(CHAPTERS.length === 6 && CHAPTERS.every(c => c.levels.length === 5) && LEVELS.length === 30, "six stations of five levels");
  check(new Set(LEVELS.map(L => L.name)).size === LEVELS.length && LEVELS.every((L, n) => L.n === n && L.name && L.about && L.about.length <= 110), "every level has a name of its own and a short line");
  check(CHAPTERS.every(c => c.name && c.about), "every station has a name and a line");
  // each station's twist: the first level to have it is in the station that brings it
  const firstAt = {};
  LEVELS.forEach(L => featuresOf(rulesOf(L.n)).forEach(id => { if (!(id in firstAt)) firstAt[id] = L.chapter; }));
  const want = { clear: 0, beacons: 0, bolt: 1, prism: 2, split: 3, lamp: 4, frail: 5 };
  check(Object.entries(want).every(([id, ch]) => firstAt[id] === ch), `the stations bring the cut, bolts, the prism, the splitter, lamps and cracked glass in turn (${JSON.stringify(firstAt)})`);
  const seen = new Set(), news = LEVELS.map(L => { const fresh = featuresOf(rulesOf(L.n)).filter(id => !seen.has(id)); fresh.forEach(id => seen.add(id)); return fresh; });
  check(news.every(n => n.length <= 2), `no level brings more than two new things at once (${news.map((n, k) => (n.length ? `${k + 1}: ${n.join("+")}` : "")).filter(Boolean).join(", ")})`);
  check(LEVELS.every(L => { const x = rulesOf(L.n), g = x.goal; return x.lv === L.n && x.shots >= g.pars[0] + 1 && x.shots <= 9 && g.pars.length === 2 && g.pars[1] >= 1 && g.pars[0] === g.pars[1] + 1; }), "every level: its number, a goal whose pars are the answer's shots and one more, and room in the shots to fail once");
  check(LEVELS.every(L => (L.gems ?? []).length <= 3 && (L.fix ?? []).filter(f => f.k === "lamp").length <= 4 && (L.fix ?? []).filter(f => f.k === "split").length <= 3), "no more gems, lamps and splitters than the tube draws");
  check(LEVELS.every(L => L.gems?.length || L.fix?.some(f => f.k === "prism") || L.goal.kind === "lamps"), "a level with no colour crystal or prism asks for lamps (white light)");
}

// ---------- every level has its designed answer, and it wins in the shots the stars say ----------
{
  let ok = true, why = "";
  for (const L of LEVELS) {
    const x = rulesOf(L.n), s = answered(L.n);
    if (!ANSWERS[L.n]?.length) { ok = false; why += `${L.name}: no answer. `; continue; }
    const need = x.goal.pars[1];
    if (!s.won || s.metAt > need) { ok = false; why += `${L.name}: the answer ${s.won ? `takes ${s.metAt}` : "does not win"}, three stars want ${need}. `; }
    if (ANSWERS[L.n].length !== need) { ok = false; why += `${L.name}: the answer is ${ANSWERS[L.n].length} shots, the par ${need}. `; }
    if (starsOf(x, s) !== 3) { ok = false; why += `${L.name}: ${starsOf(x, s)} stars. `; }
  }
  check(ok, ok ? "each level's designed answer wins it, in the shots of the third star" : why);
  // a shot is made of the moves it has: the answer never asks for more
  let fits = true, over = "";
  for (const L of LEVELS) {
    let s = dealLevel(L.n);
    ANSWERS[L.n].forEach((shot, k) => {
      const spent = shot.filter(([op]) => op !== "turn").length;
      if (spent > movesFor(k, s.x)) { fits = false; over += `${L.name} shot ${k + 1}: ${spent} moves of ${movesFor(k, s.x)}. `; }
      for (const [op, a, b, c] of shot) s = op === "add" ? addMirror(s, a, b) : op === "move" ? turnMirror(moveMirror(s, a, b), a, c) : turnMirror(s, a, b);
      s = fire(s).state;
    });
  }
  check(fits, fits ? "and every shot of every answer stays within the moves a shot has" : over);
}

// ---------- how the simple players fare: the levels are not won by playing on ----------
{
  const rows = [];
  let easy = 0;
  for (const L of LEVELS) {
    const x = rulesOf(L.n), got = {};
    for (const how of ["glance", "keen", "best"]) { const s = played(dealLevel(L.n), how); got[how] = s.won ? starsOf(x, s) : 0; }
    rows.push(`${L.chapter + 1}.${L.k + 1} ${L.name}: ${got.glance}${got.keen}${got.best}`);
    // after the first station's gentle levels, the best simple player does not three-star a level
    if (L.chapter > 0 || L.k > 1) if (got.best === 3) easy++;
  }
  console.log(`     stars of glance, keen and best: ${rows.join("; ")}`);
  check(easy <= 4, `the simple player that looks at every aim three-stars at most four levels past the first two (${easy})`);
}

// ---------- no level can be left stuck ----------
{
  let ok = true, why = "";
  for (const L of LEVELS) {
    let s = dealLevel(L.n), k = 0;
    while (!s.over && k < 40) { s = fire(s).state; k++; }                       // nothing set: the shots run out, not won
    if (!s.over || k > L.shots || s.won) { ok = false; why += `${L.name}: fired empty ${k} times${s.won ? ", won" : ""}. `; }
    s = dealLevel(L.n); k = 0;
    while (!s.over && k < 40) {
      if (!canMove(s) || s.moves !== movesFor(s.shots, s.x) || handLeft(s) < 0) { ok = false; why += `${L.name}: shot ${k} starts with no move. `; break; }
      s = fire(plan(s, "glance")).state; k++;
    }
    if (!s.over) { ok = false; why += `${L.name}: never ended. `; }
  }
  check(ok, ok ? "fired empty, every level ends within its shots; played, every shot starts with a move and counts" : why);
}

// ---------- a deal is as the level says ----------
{
  let ok = true, why = "";
  for (const L of LEVELS) {
    const s = dealLevel(L.n), x = s.x, h = hangFrom(L.hang);
    const problems = [
      x.lv !== L.n && "its number is not kept",
      s.crystals.length !== (L.gems ?? []).length && "wrong number of colour crystals",
      s.mirrors.length !== (L.pins ?? []).length && "wrong number of bolted mirrors",
      handLeft(s) !== (L.hand ?? 6) && "wrong number of mirrors in hand",
      s.over && "dealt over",
      (s.shots !== 0 || s.score !== 0) && "not at the start",
      JSON.stringify(s.depth) !== JSON.stringify(h.depth) && "the chandelier is not as written",
      (s.x.beacons?.length ?? 0) !== h.beacons.length && "lanterns not as written",
      L.goal.kind === "beacons" && !h.beacons.length && "lanterns asked for, none hung",
      JSON.stringify(JSON.parse(JSON.stringify(s))) !== JSON.stringify(s) && "does not survive being saved",
      JSON.stringify({ ...dealLevel(L.n, 99), seed: 0 }) !== JSON.stringify({ ...s, seed: 0 }) && "the seed changes the level",
    ].filter(Boolean);
    if (problems.length) { ok = false; why += `${L.name}: ${problems.join("; ")}. `; }
  }
  check(ok, ok ? "every level is dealt as written, the same every time, and survives being saved" : why);
}

// ---------- stars, the goal's words, the meter ----------
{
  const lamps = LEVELS.findIndex(L => L.goal.kind === "lamps"), lanterns = LEVELS.findIndex(L => L.goal.kind === "beacons"), clear = LEVELS.findIndex(L => L.goal.kind === "clear");
  const x = rulesOf(lanterns), p = x.goal.pars;
  const metIn = shots => starsOf(x, { met: true, metAt: shots });
  check(starsOf(x, { met: false, metAt: 0 }) === 0 && metIn(x.shots) === 1 && metIn(p[0]) === 2 && metIn(p[1]) === 3 && metIn(p[1] - 1) === 3, "a star for the goal, one more for each par in shots");
  const reach = k => starsInReach(x, { shots: k, over: false });
  check(reach(0) === 3 && reach(p[1] - 1) === 3 && reach(p[1]) === 2 && reach(p[0] - 1) === 2 && reach(p[0]) === 1, "the stars still within reach fall as the shots are used");
  check(goalSentence(rulesOf(clear)).startsWith("Clear") && goalSentence(x).includes("lantern") && goalSentence(rulesOf(lamps)).includes("lamp"), "the goal in a sentence: clear, bring down, light");
  check(goalShort(rulesOf(clear)).includes("Clear") && goalShort(x).includes("lantern") && goalShort(rulesOf(lamps)).length > 0, "the goal in a few words for the list");
  const order = LEVELS.findIndex(L => L.goal.kind === "lamps" && L.goal.mode === "order"), together = LEVELS.findIndex(L => L.goal.kind === "lamps" && L.goal.mode === "together");
  check(order < 0 || goalSentence(rulesOf(order)).includes("order"), "a signal says it is lit in order");
  check(together < 0 || goalSentence(rulesOf(together)).includes("one shot"), "lamps at once say one shot");
  check(goalWords(x, dealLevel(lanterns)).includes("0 of") && goalWords(rulesOf(lamps), dealLevel(lamps)).includes("0 of"), "the goal row says the lanterns down or the lamps lit");
  check(meterOf(x, { shots: 2 }).marks.length === 2 && meterOf(x, { shots: 2 }).fill === 2 / x.shots, "the meter is the shots used, with a tick where each of the upper stars is lost");
}

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
