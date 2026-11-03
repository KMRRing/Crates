// Manifest's ladder: 44 levels in 11 chapters, each chapter bringing something new and each level harder than the one before
// it in its chapter; every level's recipe deals fair rounds from any seed (stacks that obey the rules, the full number of
// orders, the questions its chapter wants, each answerable by an observer shown only what the view showed); stars and
// the saved campaign mend themselves.
const L = await import("../manifest-levels.js");
const M = await import("../manifest-engine.js");
const { problems } = await import("./manifest-observer.js");
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// the ladder's shape
{
  check(L.COUNT >= 24 && L.COUNT <= 44 && L.CHAPTERS.length === 11 && L.CHAPTERS.every((c, k) => c.from === k * 4) && L.LEVELS.every((lv, i) => L.chapterOf(i) === Math.floor(i / 4)),
    `${L.COUNT} levels in ${L.CHAPTERS.length} chapters of four`);
  const known = new Set(), fresh = [];
  L.CHAPTERS.forEach((c, k) => {
    const lv = L.LEVELS[k * 4 + 3], things = [...lv.recipe.types.map(t => `type ${t}`), ...lv.recipe.kinds, ...(L.LEVELS.slice(k * 4, k * 4 + 4).some(x => x.recipe.logs) ? ["a yard of logs"] : []), ...Object.values(L.LEVELS.slice(k * 4, k * 4 + 4).flatMap(x => Object.values(x.changes))).map(v => `change ${v}`)];
    const added = things.filter(t => !known.has(t));
    fresh.push(added.length);
    things.forEach(t => known.add(t));
  });
  check(fresh.every(n => n > 0), `each chapter brings something new (${fresh.join(", ")} new types, kinds, logs or changes)`);
  const harder = L.CHAPTERS.every((c, k) => [1, 2, 3].every(s => {
    const a = L.LEVELS[k * 4 + s - 1], b = L.LEVELS[k * 4 + s], vol = lv => lv.recipe.x * lv.recipe.y * lv.recipe.z;
    return vol(b) >= vol(a) && b.recipe.exposure <= a.recipe.exposure && b.rounds >= a.rounds && b.lives <= a.lives && b.recipe.orders >= a.recipe.orders
      && (vol(b) > vol(a) || b.recipe.exposure < a.recipe.exposure || b.rounds > a.rounds || b.lives < a.lives || b.recipe.orders > a.recipe.orders);
  }));
  check(harder, "within a chapter each level is bigger, shorter-held, longer or less forgiving than the one before, and none is easier in any way");
  check(L.LEVELS.every(lv => lv.rounds >= 3 && lv.rounds <= 5 && lv.lives >= 3), "every level is three to five rounds");
  const names = L.LEVELS.map(lv => lv.name);
  check(new Set(names).size === names.length && names.every(n => n.length > 3), "every level has its own name");
}

// the recipes
{
  const kinds = Object.keys(M.KINDS), problemsFound = [];
  L.LEVELS.forEach((lv, i) => {
    const r = lv.recipe, name = `level ${i + 1}`;
    if (!r.kinds.every(k => kinds.includes(k) && M.KIND_VIEWS[k])) problemsFound.push(`${name}: an unknown kind`);
    if (!r.want.every(k => r.kinds.includes(k) && r.views.some(v => M.KIND_VIEWS[k].includes(v)))) problemsFound.push(`${name}: wants a kind its views can't carry`);
    if (!r.views.every(v => M.VIEWS[v]) || !r.types.every(t => t >= 1 && t <= M.TYPES) || r.x > 4 || r.y > 4 || r.z > 4 || r.x * r.y * r.z > 48) problemsFound.push(`${name}: a view, type or size out of range`);
    for (let k = 1; k <= lv.rounds; k++) {
      const rc = L.recipeAt(i, k);
      if (Boolean(rc.change) !== Boolean(lv.changes[k]) || (rc.change && rc.orders !== 1)) problemsFound.push(`${name}: round ${k}'s change`);
    }
    if (Object.keys(lv.changes).some(k => k < 1 || k > lv.rounds)) problemsFound.push(`${name}: a change round beyond its rounds`);
  });
  if (problemsFound.length) console.log("  ", problemsFound.join("\n   "));
  check(!problemsFound.length, "every recipe names real kinds, views and types, wants only what its views can ask, and puts change rounds inside the level");
  check(M.levelOf(1).types.length === 3 && M.levelOf(12).types.length === M.LADDER.length && [1, 5, 7, 9, 11, 12].every((r, k, a) => !k || M.levelOf(r).types.length > M.levelOf(a[k - 1]).types.length),
    "Random widens: three types in round 1, six by round 9, the second tree in round 11 and gold in round 12");
}

// Random's and Today's ramp (Korbi, 3 November 2026: "slow down the increase in difficulty. it really ramps up massively in
// round 10"): by the engine's own measure no round is more than STEP harder than the one before, none is easier, round 10
// is about what round 8 was, and the old round 10 is not reached before round 13
{
  const ds = Array.from({ length: 16 }, (_, i) => M.difficulty(M.levelOf(i + 1)));
  const steps = ds.map((d, i) => (i ? d / ds[i - 1] : 1));
  // the old recipe (x from 6 rounds, y from 4, z from 6; types, kinds and orders as they widened), under the same measure
  const old = r => M.difficulty({ x: Math.min(4, 3 + Math.floor((r - 1) / 6)), y: Math.min(4, 2 + Math.floor((r - 1) / 4)), z: Math.min(3, 2 + Math.floor((r - 1) / 6)),
    types: { length: r < 5 ? 3 : r < 9 ? 4 : r < 11 ? 5 : 6 }, kinds: { length: 6 + (r >= 3) + 2 * (r >= 5) + 2 * (r >= 7) + 2 * (r >= 9) }, orders: r < 6 ? 3 : 4, exposure: Math.max(5000, 9000 - 300 * (r - 1)) });
  const bigOld = Math.max(...Array.from({ length: 11 }, (_, i) => old(i + 2) / old(i + 1)));
  check(steps.every(s => s >= 1 && s <= M.STEP) && bigOld > 1.3 && Math.abs(ds[9] / old(8) - 1) < 0.12 && ds[11] < old(10) && ds.findIndex(d => d >= old(10)) >= 12,
    `the ramp is gentle: no round more than ${Math.round((M.STEP - 1) * 100)}% harder than the one before (the largest step is ${Math.max(...steps).toFixed(2)}; it was ${bigOld.toFixed(2)}), round 10 is ${ds[9].toFixed(2)} where the old round 8 was ${old(8).toFixed(2)}, round 12 is ${ds[11].toFixed(2)}, the old round 10's ${old(10).toFixed(2)} comes at round ${ds.findIndex(d => d >= old(10)) + 1}`);
}

// every level deals fair rounds from any seed: its own first, and others
{
  let rounds = 0, orders = 0, missing = 0;
  const problemsFound = [], byKind = {};
  L.LEVELS.forEach((lv, i) => {
    for (const seed of [L.seedOf(i), 7, 19, 4242]) for (let k = 1; k <= lv.rounds; k++) {
      const rc = L.recipeAt(i, k), R = M.makeRound(seed, k, 0, rc);
      rounds++;
      problemsFound.push(...problems(R, `level ${i + 1} seed ${seed} round ${k}:`));
      const want = rc.change ? [] : rc.want.filter(w => M.KIND_VIEWS[w].includes(R.view));
      if (want.some(w => !R.orders.some(o => o.type === w))) missing++;
      if (R.orders.length < (rc.change ? 1 : rc.orders)) problemsFound.push(`level ${i + 1} seed ${seed} round ${k}: ${R.orders.length} of ${rc.orders} orders`);
      if (new Set(R.orders.map(o => o.type)).size !== R.orders.length) problemsFound.push(`level ${i + 1} seed ${seed} round ${k}: two orders of one kind`);
      for (const o of R.orders) { orders++; byKind[o.type] = (byKind[o.type] || 0) + 1; }
      if (R.orders.some(o => !(o.type in M.KINDS) || (!rc.change && !rc.kinds.includes(o.type)))) problemsFound.push(`level ${i + 1} seed ${seed} round ${k}: a kind the recipe doesn't allow`);
    }
  });
  if (problemsFound.length) console.log("  ", problemsFound.slice(0, 8).join("\n   "));
  check(!problemsFound.length && !missing, `${rounds} rounds, ${orders} orders over all levels: every stack obeys the rules, every order is within the recipe and answerable by the observer, the full number are posted, and the wanted kinds are all there (${missing} short)`);
  check(["column", "load", "fits", "weight", "worth", "which", "turned", "swap", "change", "changeTurned"].every(k => byKind[k] > 3), `every kind is dealt somewhere on the ladder (${Object.entries(byKind).map(([k, n]) => `${k} ${n}`).join(", ")})`);
  const a = M.makeRound(L.seedOf(5), 2, 0, L.recipeAt(5, 2)), b = M.makeRound(L.seedOf(5), 2, 0, L.recipeAt(5, 2)), c = M.makeRound(99, 2, 0, L.recipeAt(5, 2));
  check(same(a.cells, b.cells) && same(a.orders, b.orders) && !same(a.cells, c.cells) && new Set(L.LEVELS.map((_, i) => L.seedOf(i))).size === L.COUNT,
    "a level's first deal is the same for everyone; a replay (another seed) is another stack");
  // a team can play a level's round too: the stack shared out, the orders made of what the team could see
  const t = M.makeRound(L.seedOf(13), 1, 3, L.recipeAt(13, 1));
  check(t.parts.length === 3 && !problems(t, "team").length, "a team's round from a level's recipe is as fair");
}

// stars and the saved campaign
{
  const lv = L.LEVELS[0].lives;
  check(L.starsFor(0, { right: 6, wrong: 0, passed: 0 }) === 3 && L.starsFor(0, { right: 5, wrong: 1, passed: 0 }) === 2 && L.starsFor(0, { right: 6, wrong: 0, passed: 1 }) === 2
    && L.starsFor(0, { right: 3, wrong: 1, passed: 2 }) === 1 && L.starsFor(0, { right: 4, wrong: 2, passed: 0 }) === 1 && L.starsFor(0, { right: 2, wrong: lv, passed: 0 }) === 0 && L.starsFor(0, {}) === 0,
  "stars: 3 for every question right, 2 for one wrong (or a pass) with three quarters right, 1 for coming through, 0 when the lives run out");
  const empty = L.mendCamp(undefined), junk = L.mendCamp({ v: 9, at: 99, stars: [3, "x", 2, -4, 9, null] }), partial = L.mendCamp({ at: 20, stars: [1, 1, 1] });
  check(empty.at === 0 && empty.stars.length === L.COUNT && empty.stars.every(s => s === 0) && junk.stars.slice(0, 6).join() === "3,0,2,0,3,0" && junk.at <= 1 && partial.at === 3 && partial.v === L.CAMP_VERSION,
    "the campaign mends: missing or bad stars are none, the level in hand is never beyond the first not passed");
  const camp = { ...empty, stars: empty.stars.map((s, k) => (k < 5 ? 1 : 0)) };
  check(L.isOpen(camp, 0) && L.isOpen(camp, 5) && !L.isOpen(camp, 6) && !L.isOpen(empty, 1), "a level is open when the one before has a star");
}
console.log(bad ? `${bad} problems` : "all checks pass");
if (bad) process.exitCode = 1;
