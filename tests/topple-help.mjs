// Topple's feature help (topple-help.js): every entry's scenes run on the engine and do what the text says, every feature
// the fourteen levels have has an entry (and a level that comes later cannot bring one that has none), the ids are
// unique, and the numbers in the texts are the engine's. The dialog itself (topple-help-ui.js) is the page's, looked at in a
// browser. Run: node tests/topple-help.mjs
import { newGame, lay, knock, moves, knockOn, worth, BELL, BALL, HEAVY, gateMod, SIZE, at, rulesOf } from "../topple-engine.js";
import { LEVELS, MIXES, CUP_SCORE, FREE, ROCK, WATER, VOID, CUP, FLOOR, levelRules, custom } from "../topple-levels.js";
import { FEATURES, ORDER, RULE_KEYS, featureOf, runScene, verdictOf, marksOf, featuresOfRules, featuresOfHand, featuresAtCell, unseen } from "../topple-help.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const fmt = n => n.toLocaleString("en-GB");
const ids = FEATURES.map(f => f.id);

// ---------- the entries ----------
{
  check(new Set(ids).size === ids.length && ids.every(id => /^[a-z]+$/.test(id)), "every entry has an id of its own");
  check(ORDER.length === ids.length && ORDER.every(id => ids.includes(id)), "the teaching order names every entry once, and only them");
  check(FEATURES.every(f => f.name && f.lines.length >= 1 && f.lines.length <= 3 && f.lines.every(l => l.length <= 170)), "each entry has a name and one to three short lines");
  check(FEATURES.every(f => f.scenes.length >= 1 && f.scenes.length <= 2), "each entry has one scene, or two to set side by side");
  // the numbers a text may mention are the engine's: the cup's flat sum, the bell's; the rest of the rules are words
  const allowed = new Set([CUP_SCORE, BELL]);
  const numbers = FEATURES.flatMap(f => [f.name, ...f.lines].flatMap(t => (t.match(/\d[\d,]*/g) || []).map(n => Number(n.replace(/,/g, "")))));
  check(numbers.every(n => allowed.has(n)), `no text names a number the engine does not give (${[...new Set(numbers)].join(", ") || "none"})`);
  check(featureOf("cup").lines.join(" ").includes(fmt(CUP_SCORE)) && featureOf("gilded").lines.join(" ").includes(fmt(BELL)), "the cup's text says the engine's sum, the gilding's the engine's bell");
}

// ---------- every scene is a real table and does what its entry says ----------
{
  let ok = true, why = "";
  for (const f of FEATURES) f.scenes.forEach((s, n) => {
    const r = runScene(s), e = s.expect || {}, name = `${f.id} ${n + 1}`;
    const placed = [...s.put.map(p => [p[0], p[1], p[5] || 0]), ...(s.balls || []).map(b => [b[0], b[1], b[2] || 0])];
    const shown = new Set(r.shown);
    const problems = [
      !Object.keys(e).length && "says nothing it is held to",
      s.put.some(p => at(p[0], p[1]) < 0) && "a domino off the table",
      placed.some(([q, rr, fl]) => !shown.has(fl * SIZE + at(q, rr))) && "something placed is not drawn",
      r.rules.terrain[r.start] === VOID && "pushed from where there is no table",
      !(r.cells[r.start] >= 0) && "nothing stands where it is pushed",
      r.fell.length && r.fell[0][0] !== r.start && "the push is not the first to fall",
      e.fells != null && r.fell.length !== e.fells && `${r.fell.length} fall, not ${e.fells}`,
      e.falls != null && r.falls !== e.falls && `the target ${r.falls ? "falls" : "stands"}, not ${e.falls ? "falls" : "stands"}`,
      e.falls != null && r.target < 0 && "a verdict with no target",
      e.doubled != null && r.doubled !== e.doubled && `${r.doubled ? "doubled" : "not doubled"}, not ${e.doubled ? "doubled" : "not"}`,
      e.cups != null && r.k.cups !== e.cups && `${r.k.cups} cups, not ${e.cups}`,
      f.scenes.length > 1 && !verdictOf(r) && "a contrast with no word to tell its scenes by",
    ].filter(Boolean);
    if (problems.length) { ok = false; why += `${name}: ${problems.join("; ")}. `; }
  });
  check(ok, ok ? "every scene is a table by hand that the engine plays to what its entry expects: the falls, stands and doublings" : why);
  // the scenes of a contrast differ in their outcome, which is what the pair is for
  const contrasts = FEATURES.filter(f => f.scenes.length === 2 && f.scenes.every(s => s.target)).map(f => [f.id, ...f.scenes.map(s => runScene(s).falls)]);
  check(contrasts.every(([, a, b]) => a !== b), `a pair of scenes with a verdict each has one that stands and one that falls (${contrasts.map(c => c[0]).join(", ")})`);
}

// ---------- the claims in the texts, one at a time ----------
{
  const scene = (id, n = 0) => runScene(featureOf(id).scenes[n]);
  const gain = r => r.k.gain;
  // mixes: a parent knocks the mix and the mix the other parent, and the mix stands before any other colour
  const MIXED = [[5, [0, 1]], [6, [0, 2]], [7, [1, 2]], [8, [3, 4]]];
  const rowOf = (...cs) => cs.map((c, k) => [k, 0, c, 0]);
  const falls = (...cs) => runScene({ put: rowOf(...cs), push: [0, 0, 0] }).fell.length;
  check(MIXED.every(([m, [a, b]]) => MIXES[m].join() === [a, b].join() && falls(a, m, b) === 3 && falls(b, m, a) === 3), "each mix is knocked by either parent and knocks the other parent");
  check(MIXED.every(([m, [a]]) => falls(a, m, 5 + ((m - 5 + 1) % 4)) === 2) && falls(0, 5, 2) === 2 && falls(3, 8, 0) === 2, "a mix does not knock another mix, nor a colour outside its pair");
  check(falls(0, 9, 4) === 3 && falls(4, 9, 7) === 3 && falls(2, 9, 8) === 3, "the rainbow is knocked by any colour and knocks any colour, mixes too");
  // heavy: the second hit, any two dominoes; by hand it falls at once; double
  const fork = (heavy, extra) => ({ put: [[0, 0, 9, 1], [1, 0, 2, 2], ...extra, [2, -1, 1, 1, heavy]], push: [0, 0, 1], target: [2, -1] });   // a rainbow pushes: it knocks a blue and a white, which fall on the red heavy one
  check(runScene(fork(HEAVY, [[1, -1, 4, 0]])).falls === true && runScene(fork(HEAVY, [])).falls === false, "a heavy domino stands through one hit and falls on a second, whatever colours the two are");
  const alone = runScene({ put: [[0, 0, 0, 0, HEAVY]], push: [0, 0, 0] });
  check(alone.fell.length === 1, "a heavy domino pushed by hand falls at once");
  const plain = runScene({ put: [[0, 0, 0, 1], [1, 0, 0, 2], [1, -1, 0, 0], [2, -1, 0, 1]], push: [0, 0, 1] }), heavy = scene("heavy", 1);
  check(plain.fell.length === 4 && heavy.fell.length === 4 && !plain.doubled && gain(heavy) === gain(plain) * 2 && gain(plain) === worth(4, plain.k.steps), `the heavy domino doubles the knock (${gain(plain)} to ${gain(heavy)})`);
  // gate: one of each colour, a rainbow either, two of one colour not
  const gate = (a, b) => runScene({ put: [[0, 0, 0, 1], [1, 0, a, 2], [1, -1, b, 0], [2, -1, 0, 1, gateMod(0, 6)]], push: [0, 0, 1], target: [2, -1] });
  check(gate(0, 6).falls && !gate(0, 0).falls && !gate(6, 6).falls && gate(0, 9).falls && gate(9, 6).falls, "a gate opens to one domino of each of its colours, a rainbow standing for either, and not to two of one colour");
  check(!gate(0, 5).falls, "an orange is neither of a yellow and green gate's colours");
  const solo = runScene({ put: [[0, 0, 0, 0, gateMod(0, 6)]], push: [0, 0, 0] });
  check(solo.fell.length === 1 && solo.doubled, "a gate pushed by hand falls at once, and scores double");
  // gilded: the whole knock doubles, once, with the bell's sum after it
  const gild = scene("gilded"), bell = knockOn(gild.cells, gild.ax, gild.start, gild.way, gild.fell[1][0], gild.rules, 0, gild.mod);
  check(gild.doubled && gain(gild) === worth(3, 3) * 2 && bell.gain === worth(3, 3) * 2 + BELL, `a gilded fall doubles the knock and the bell's ${BELL} comes after it, not doubled`);
  const twice = runScene({ rules: { map: { spring: [[0, 0]], gilded: [[3, 0]] } }, put: [[0, 0, 0, 0], [2, 0, 0, 0], [3, 0, 0, 0]], push: [0, 0, 0] });
  check(twice.k.crossed && twice.k.gilded && gain(twice) === worth(3, twice.k.steps) * 2, "a gilded fall that also crosses doubles once, not twice over");
  // spring, portal, stair, drop: a crossing is double; the far end of a link falls whichever way it faces
  check(scene("spring", 0).k.crossed && scene("spring", 0).doubled && !scene("spring", 1).doubled, "a spring's throw is a crossing and doubles; stopped by a stone it throws nothing");
  const turned = (id, put) => { const s = { ...featureOf(id).scenes[0] }; s.put = s.put.map((p, k) => (k === put ? [p[0], p[1], p[2], 2, p[4], p[5]] : p)); return runScene(s); };
  check(turned("portal", 3).fell.some(f => f[0] === at(0, 2)) && turned("portal", 3).doubled, "a portal brings down the other end whichever way it faces, and doubles");
  check(turned("stair", 3).fell.some(f => f[0] === SIZE + at(0, 0)) && turned("stair", 3).doubled && scene("stair").fell.some(f => f[0] >= SIZE), "a stair brings down the domino on the other floor whichever way it faces, and doubles");
  check(scene("floors").fell.some(f => f[0] >= SIZE) && scene("floors").fell.some(f => f[0] < SIZE) && scene("floors").doubled, "a fall off the upper floor's edge lands on the floor below and goes on there, doubled");
  // a ball and a cup
  const cup = scene("cup");
  check(cup.k.cups === 1 && gain(cup) === worth(cup.k.units, cup.k.steps) + CUP_SCORE, `a ball that stops in a cup scores ${fmt(CUP_SCORE)} flat, on top of the knock`);
  check(marksOf(cup).join() === `+${fmt(CUP_SCORE)}` && marksOf(scene("heavy", 1)).join() === "×2" && marksOf(scene("mix")).length === 0, "the marks a scene ends with are the cup's sum and the double, and nothing else");
  check(verdictOf(scene("heavy", 0)) === "Stands" && verdictOf(scene("heavy", 1)) === "Falls" && verdictOf(scene("twin", 0)) !== verdictOf(scene("twin", 1)), "a scene is told by Stands or Falls, or the word it carries");
  const ball0 = scene("ball", 0), ball1 = scene("ball", 1);
  check(ball0.rolls.length === 1 && ball1.rolls.length === 1 && ball1.rolls[0].m > ball0.rolls[0].m && ball1.rolls[0].hit >= 0 && ball0.rolls[0].hit < 0, "a ball hit later in the chain has more momentum, and reaches the domino the other runs out short of");
  // water and bridges: a fall does not cross water, but goes over a ford or a plank
  check(scene("water", 0).falls === false && scene("water", 1).falls === true && scene("bridge", 0).falls === false && scene("bridge", 1).falls === true, "a fall stops at water, and crosses by a ford or a bridge");
  const bridged = scene("bridge", 1);
  check(bridged.shown.some(i => bridged.cells[i] >= 0 && bridged.rules.terrain[i] === WATER), "the bridge scene lays its dominoes on water");
}

// ---------- which features something has ----------
{
  const rules = custom({ colours: [0, 1, 2, 3, 4, 5, 6, 7, 8], map: { rock: [[1, 0]], water: [[2, 0]], cup: [[3, 0]], height: { 1: [[0, 1]] }, gilded: [[0, 2]], spring: [[0, 3]], marsh: [[1, 2]], hedge: [[[-1, 0], [-2, 0]]] }, links: [[[0, -3, 0], [0, 3, -3]]] });
  const state = (extra = {}) => ({ cells: new Array(rules.n).fill(-1), ax: new Array(rules.n).fill(-1), mod: new Array(rules.n).fill(0), ...extra });
  const here = (q, r, s = state()) => featuresAtCell(s, at(q, r), rules).join();
  check(here(1, 0) === "stone" && here(2, 0) === "water" && here(3, 0) === "cup" && here(0, 1) === "steps" && here(0, 2) === "gilded" && here(0, 3) === "spring" && here(1, 2) === "marsh", "a long press on terrain names it: stone, water, cup, steps, gilded, spring, marsh");
  check(here(-1, 0) === "hedge" && here(-2, 0) === "hedge" && here(-3, 0) === "portal" && here(3, -3) === "portal" && here(0, 0) === "", "and a hedge from either side of it, a portal from either end, and a plain hexagon nothing");
  const s = state();
  s.cells[at(0, 0)] = 5; s.ax[at(0, 0)] = 0; s.cells[at(0, 2)] = 9; s.ax[at(0, 2)] = 0; s.cells[at(1, 1)] = 0; s.ax[at(1, 1)] = 0; s.mod[at(1, 1)] = HEAVY;
  s.cells[at(-1, 1)] = 1; s.ax[at(-1, 1)] = 0; s.mod[at(-1, 1)] = gateMod(0, 6); s.cells[at(2, 0)] = 0; s.ax[at(2, 0)] = 0; s.cells[at(0, -1)] = BALL;
  check(here(0, 0, s) === "mix" && here(0, 2, s) === "rainbow,gilded" && here(1, 1, s) === "heavy" && here(-1, 1, s) === "gate" && here(2, 0, s) === "water,bridge" && here(0, -1, s) === "ball", "on a domino it names its colour if a mix or the rainbow, its weight or gate, a bridge if it stands on water; a ball is a ball; in teaching order");
  const hand = h => featuresOfHand(h).join();
  check(hand({ piece: "0,0", colour: 5 }) === "mix" && hand({ piece: "0,0", colour: 9 }) === "rainbow" && hand({ piece: "0,0", colour: 0, mod: HEAVY }) === "heavy" && hand({ piece: "0,0", colour: 0, mod: gateMod(0, 6) }) === "gate" && hand({ piece: "0,0", colour: 0, bridge: true }) === "bridge", "a piece in hand names a mix, the rainbow, a heavy, a gate, a bridge");
  check(hand({ piece: "0,0", colour: 0, colours: [0, 6] }) === "mix,twin" && hand({ piece: "0,0", colour: 0, colours: [0, 1] }) === "twin" && hand({ piece: "0,0", colour: 3 }) === "" && featuresOfHand(null).length === 0, "a twin is named, and its colours if one is a mix; a plain piece nothing");
  check(unseen(["mix", "stone", "cup"], ["stone"]).join() === "mix,cup" && unseen(["mix"], []).join() === "mix" && unseen([], ["mix"]).length === 0, "what is yet to show is what is not yet seen, in the order given");
  check(featuresOfRules(FREE).length === 0 && featuresOfRules(levelRules(0)).length === 0, "Classic and the first level have nothing to explain");
}

// ---------- the fourteen levels: no feature without an entry ----------
{
  /** What a level has, worked out from its spec as written (LEVELS), not from the rules compiled from it: a second way to the same answer. */
  function expected(L) {
    const has = new Set(), layers = L.layers || [L.map || {}];
    for (const m of layers) {
      if (m.rock?.length) has.add("stone");
      if (m.water?.length) has.add("water");
      if (m.cup?.length) has.add("cup");
      if (Object.values(m.height || {}).some(l => l.length)) has.add("steps");
      if (m.gilded?.length) has.add("gilded");
      if (m.spring?.length) has.add("spring");
      if (m.marsh?.length) has.add("marsh");
      if (m.hedge?.length) has.add("hedge");
    }
    if (layers.length > 1) has.add("floors");
    for (const [a, b] of L.links || []) has.add(a[0] === b[0] ? "portal" : "stair");
    for (const c of [...L.colours, ...(L.gate ? L.gate.colours : [])]) if (MIXES[c]) has.add("mix");
    if (L.wild) has.add("rainbow");
    if (L.bridges) has.add("bridge");
    if (L.twins) has.add("twin");
    if (L.balls) has.add("ball");
    if (L.heavy || L.start.some(s => s.heavy)) has.add("heavy");
    if (L.gate || L.start.some(s => s.gate)) has.add("gate");
    return [...has].sort();
  }
  let ok = true, why = "";
  LEVELS.forEach((L, k) => {
    const got = featuresOfRules(levelRules(k)), want = expected(L);
    if ([...got].sort().join() !== want.join()) { ok = false; why += `${k + 1} ${L.name}: help finds ${got.join(" ")}, its spec has ${want.join(" ")}. `; }
    const lost = got.filter(id => !featureOf(id));
    if (lost.length) { ok = false; why += `${k + 1}: no entry for ${lost.join(" ")}. `; }
    if (got.join() !== ORDER.filter(id => got.includes(id)).join()) { ok = false; why += `${k + 1}: not in teaching order. `; }
  });
  check(ok, ok ? "each of the fourteen levels' features, found two ways (its rules, its spec), has an entry, in teaching order" : why);
  const all = new Set(LEVELS.flatMap((_, k) => featuresOfRules(levelRules(k))));
  check(ids.every(id => all.has(id)), `every entry is a feature some level has (${ids.filter(id => !all.has(id)).join(" ") || "none left over"})`);
  // a rule the help was not taught cannot slip in: every key a level's rules carry is read by it or listed as no feature
  const known = new Set([...RULE_KEYS.read, ...RULE_KEYS.passed]), keys = new Set([...Object.keys(FREE), ...LEVELS.flatMap((_, k) => Object.keys(levelRules(k)))]);
  check([...keys].every(k => known.has(k)), `every key of a level's rules is one help reads or knowingly passes by (${[...keys].filter(k => !known.has(k)).join(", ") || "none new"})`);
  const kinds = new Set(LEVELS.flatMap((_, k) => [...levelRules(k).terrain]));
  check([...kinds].every(t => [FLOOR, ROCK, WATER, VOID, CUP].includes(t)), "every kind of terrain a level has is one help knows");
  // what is dealt, and what is on the table as it plays, is always something the level's own list has
  let missing = new Set(), plays = 0;
  LEVELS.forEach((_, k) => {
    const have = new Set(featuresOfRules(levelRules(k))), rules = levelRules(k);
    for (const seed of [3, 17, 29, 41, 53, 67]) {
      let g = newGame(seed, k);
      for (let step = 0; step < 220 && !g.over; step++) {
        for (const h of g.hand) for (const id of featuresOfHand(h)) if (!have.has(id)) missing.add(`${k + 1} hand ${id}`);
        for (let i = 0; i < rules.n; i++) for (const id of featuresAtCell(g, i, rules)) if (!have.has(id)) missing.add(`${k + 1} hexagon ${id}`);
        if (g.due) {
          const standing = g.cells.flatMap((c, i) => (c >= 0 ? [i] : []));
          if (!standing.length) break;
          g = knock(g, standing[0], g.ax[standing[0]]).state;
        } else {
          const mv = moves(g);
          if (!mv.length) break;
          const m = mv[(step * 7 + seed) % mv.length];
          g = lay(g, m.slot, m.q, m.r, m.floor).state;
        }
        plays++;
      }
    }
  });
  check(missing.size === 0 && plays > 500, `over ${plays} moves of every level, nothing dealt or standing is a feature the level's list leaves out (${[...missing].join("; ") || "none"})`);
}

console.log(bad ? `${bad} problems` : "topple help: every check passed");
if (bad) process.exitCode = 1;
