// Settle's levels (settle-levels.js on settle-engine.js's newLevel): each one deals a farm from its seed with no line
// standing, switches only the parts of the game it names on, and is won by shipping its goal within its pumps; the plan
// each carries (the best a search found) is replayed here and must win at exactly its par; stars, the order the levels
// open in, and the endless game left as it was.
import { TANKS, LEVELS as ROWS, FAME, WATER, newGame, newLevel, upgrade, rule, lines, pump, drawOff, draws, filled } from "../settle-engine.js";
import { LEVELS, levelOf, starsFor, isOpen } from "../settle-levels.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const sorted = t => t.every((g, k) => k === 0 || [999, 883, 835, 700, 950][t[k - 1]] >= [999, 883, 835, 700, 950][g]);
const step = (s, [slot, t]) => (slot < 0 ? drawOff(s, t) : pump(s, slot, t));

check(LEVELS.length >= 12 && LEVELS.length <= 20 && LEVELS.every((l, k) => l.id === k + 1 && levelOf(l.id) === l), `${LEVELS.length} levels, numbered in order`);

// ---------- every level, replayed ----------
{
  const problems = [];
  for (const L of LEVELS) {
    const s0 = newLevel(L);
    if (!s0.tanks.every(sorted) || lines(s0.tanks).length || filled(s0) !== L.parcels) problems.push(`${L.id}: the deal`);
    if (!(L.limit > L.par && L.par >= 1 && L.goal >= 3 && L.plan.length === L.par)) problems.push(`${L.id}: the numbers`);
    let s = s0, won = -1;
    L.plan.forEach((m, k) => { if (s.over) return; s = step(s, m).state; if (s.won && won < 0) won = k + 1; });
    if (!(s.won && s.over && won === L.par && s.pumps === L.par && s.shipped >= L.goal)) problems.push(`${L.id}: the plan wins at pump ${won}`);
    if (starsFor(L, L.par) !== 3 || starsFor(L, L.limit) !== 1) problems.push(`${L.id}: stars`);
  }
  check(!problems.length, `every level deals a farm in order with no line standing, and its plan wins at its par${problems.length ? `: ${problems.join("; ")}` : ""}`);
}

// ---------- the ramp: one idea more at a time ----------
{
  const on = L => ["deliver", "sour", "tanker", "draw"].filter(k => L.rules[k]);
  const first = k => LEVELS.findIndex(L => L.rules[k]) + 1;
  check(on(LEVELS[0]).length === 0 && first("deliver") > 1 && first("tanker") > first("deliver") - 1 && first("draw") > first("sour"), `the first level has every part off; deliveries come in at ${first("deliver")}, the tanker at ${first("tanker")}, souring at ${first("sour")}, the draw-off at ${first("draw")}`);
  check(LEVELS.slice(0, 13).every(L => on(L).length <= 2) && LEVELS.slice(0, 13).some(L => on(L).length === 1), "the teaching levels switch on one part, or two together; the whole game comes after");
  check(LEVELS.slice(-3).every(L => on(L).length === 4) && LEVELS.at(-1).goal > LEVELS[0].goal * 5, "the last levels are the whole game, with the biggest goal");
  check(LEVELS[first("draw") - 1].drawn && LEVELS.filter(L => L.drawn).every(L => L.rules.draw && draws(newLevel(L)).length > 0), "the levels that teach the draw-off have it ready from the start, with a foot to drain");
  check(LEVELS[first("sour") - 1].sour && LEVELS.filter(L => L.sour).every(L => L.rules.sour && newLevel(L).sour.some(x => x > 0)), "the levels that teach souring open with FAME already standing on water, part-soured");
}

// ---------- parts switched off ----------
{
  const L = LEVELS[0], s = newLevel(L);
  check(!rule(s, "deliver") && !rule(s, "tanker") && s.want == null, "level 1: no deliveries, no tanker, no draw-off");
  const m = step(s, [0, 5]);
  check(m.delivered.length === 0 && !m.tanker && m.soured.length === 0, "a pump delivers nothing, brings no tanker, sours nothing");
  check(s.untilDraw === 10 && draws(s).length === 0 && (() => { try { drawOff({ ...s, untilDraw: 0 }, 0); return false; } catch { return true; } })(), "a draw-off can't be spent where the level has none");
  // with the tanker off any grade ships by threes
  const t = newLevel(LEVELS[1]);
  t.tanks = t.tanks.map(() => []);
  t.tanks[0] = [FAME]; t.tanks[1] = [FAME]; t.hand = [FAME, WATER];
  const r = pump(t, 0, 2);
  check(r.waves.length === 1 && r.waves[0].length === 3, "three of any grade in a line ship when there is no tanker");
}
{
  const L = LEVELS.find(x => x.rules.deliver && !x.rules.tanker), s = newLevel(L);
  check(rule(s, "deliver") && s.untilDelivery === 3, "level with deliveries: one every three pumps");
  let g = s, n = filled(g), came = 0;
  for (let k = 0; k < 3; k++) { g.hand = [2, 2]; const r = pump(g, 0, k === 0 ? 5 : 4); g = r.state; came += r.delivered.length; if (g.over) break; }
  check(came === 1 || g.over, "the third pump brings a delivery");
}

// ---------- the end ----------
{
  const L = LEVELS[2];
  // pumping a grade no line can use into the same corner until the pumps run out
  let s = newLevel(L), k = 0;
  while (!s.over && k++ < 200) { s.hand = [WATER, WATER]; s = pump(s, 0, k % 2 ? 0 : 5).state; }
  check(s.over && (!s.won) && s.pumps <= L.limit, `without shipping enough a level ends by its pumps (${s.pumps} of ${L.limit}) or by spills, not won`);
  const w = newLevel(L);
  w.shipped = L.goal - 1;
  w.tanks = [[1], [1], [], [], [], []];
  w.hand = [FAME, FAME];
  const r = pump(w, 0, 2);
  check(r.state.won && r.state.over && r.state.shipped >= L.goal && r.delivered.length === 0, "shipping the goal wins at once, nothing coming in after it");
  const sp = newLevel(LEVELS[5]);
  sp.shipped = 0;
  check(sp.goal > 0 && upgrade(sp) === sp, "a level saved and opened again is left whole");
}

// ---------- stars and the order ----------
{
  const L = { par: 6 };
  check(starsFor(L, 6) === 3 && starsFor(L, 8) === 2 && starsFor(L, 9) === 1 && starsFor({ par: 2 }, 4) === 2 && starsFor({ par: 2 }, 5) === 1, "three stars at par, two within a third more (two pumps at least), else one");
  check(isOpen(1, {}) && !isOpen(2, {}) && isOpen(2, { 1: { stars: 1 } }) && !isOpen(3, { 1: { stars: 3 } }) && isOpen(3, { 2: { stars: 1 } }), "the first level is open; each next one once the one before has a star");
}

// ---------- the endless game is as it was ----------
{
  const a = newGame(7);
  check(a.goal == null && a.rules == null && rule(a, "deliver") && rule(a, "tanker") && ROWS === 8 && TANKS === 6, "a new endless game has no goal and every part on");
  let g = a;
  for (let k = 0; k < 12 && !g.over; k++) g = pump(g, 0, k % TANKS).state;
  check(g.goal == null && !("won" in g) && g.pumps === (g.over ? g.pumps : 12), "the endless game plays on with no goal and no winning");
  check(WATER === 0, "grades unchanged");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("settle levels: every plan replayed at its par, the ramp, parts off, the end, stars, the endless game as it was");
