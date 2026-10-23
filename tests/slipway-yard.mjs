// Slipway's yard (slipway-yard.js): the joints and what each fastening is worth on them, the stock the bench's carving
// makes, fastening within the stock, the gale that draws a load from each joint's forecast band, the grade by thrift
// and by failed gales, a run kept through JSON; and, run as a harness, that the assembling is a set of decisions and
// not busywork: lashings alone never hold, the wrong fastening at a joint fails, no fastening is best everywhere, the
// best way to spend what there is differs with the carving, and fastening joint by joint to the top of the forecast,
// the obvious plan, loses to spending the scarce ones where they count.
import { MAX_ON, MORE, FIXINGS, KINDS, ASSEMBLIES, strength, stock, worth, holdOf, allowed, usedOf, canAdd, fasten, gale, leastFor, parOf, newRun, nextSeed, launch, missing, sound } from "../slipway-yard.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const IDS = FIXINGS.map(f => f.id), GOOD = IDS.filter(id => id !== "lash");
const TIER = { 1: 60, 2: 80, 3: 95 };                                 // a score at one, two and three stars
const carved = (a, tier) => Object.fromEntries([...a.parts, "treenail", "wedge", "pin"].map(id => [id, TIER[tier]]));
const byId = id => ASSEMBLIES.find(a => a.id === id);

// ---------- the data ----------
{
  const parts = new Set(ASSEMBLIES.flatMap(a => a.parts));
  check(ASSEMBLIES.every(a => a.joints.every(j => a.parts.includes(j.a) && a.parts.includes(j.b) && KINDS[j.kind] && j.load[0] < j.load[1])), "every joint joins two parts of its assembly, is of a known kind and has a band of loads");
  check(ASSEMBLIES.every(a => new Set(a.joints.map(j => j.id)).size === a.joints.length), "a joint's name is its own within an assembly");
  check(Object.values(KINDS).every(k => k.value.lash > 0 && GOOD.some(id => k.value[id] > 0)), "every kind of joint takes a lashing and at least one thing carved");
  check(GOOD.every(id => Object.values(KINDS).some(k => k.value[id] == null) && Object.values(KINDS).some(k => k.value[id] > 0)), "every fastening is wrong somewhere (a kind can't take it) and right somewhere");
  const bestAt = Object.values(KINDS).map(k => GOOD.reduce((a, b) => ((k.value[b] ?? 0) > (k.value[a] ?? 0) ? b : a)));
  check(new Set(bestAt).size >= 3, "no fastening is the best on every kind of joint: the treenail, the wedge and the pin each is on some");
  check(near(ASSEMBLIES.at(-1).parts.length, 8) && parts.size === 8, "the last assembly is the whole ship of eight timbers and the others are of those");
}

// ---------- what carving makes ----------
{
  check(strength(55) > 0.75 && strength(55) < 0.8 && near(strength(90), 1) && near(strength(100), 1) && strength(75) > strength(55), "a part is as strong as it was well carved: 0.77 at a star, 0.9 at two, 1 at three");
  const sc = (t, w, p) => stock({ treenail: t, wedge: w, pin: p });
  check(sc(60, 60, 60).treenail === 4 && sc(80, 80, 80).treenail === 6 && sc(95, 95, 95).treenail === 8 && sc(95, 60, 80).wedge === 2 && sc(95, 60, 80).pin === 3, "good carving of the peg, the wedge and the pin gives more of each");
  check(stock({}).lash === Infinity, "a lashing is never short");
  check(missing(byId("hull"), {}).length === 6 && missing(byId("hull"), carved(byId("hull"), 1)).length === 0, "an assembly opens when its parts and the three fastenings are carved");
}

// ---------- fastening ----------
{
  const a = byId("hull"), sc = carved(a, 1), run = newRun(1, 7);
  check(canAdd(a, run, "scarf", "treenail", sc) && !canAdd(a, run, "scarf", "pin", sc), "a joint takes what its kind takes and nothing else");
  check(fasten(a, run, "scarf", "lash", 1, sc) && !fasten(a, run, "scarf", "lash", 1, sc), "one lashing to a joint");
  for (let i = 0; i < 3; i++) check(fasten(a, run, "scarf", "treenail", 1, sc), `a treenail goes on (${i + 1})`);
  check(!fasten(a, run, "scarf", "wedge", 1, sc), `a joint holds at most ${MAX_ON} fastenings`);
  check(fasten(a, run, "kneeL", "treenail", 1, sc) && !fasten(a, run, "kneeR", "treenail", 1, sc), "and the stock is shared across the joints: four treenails at a star, and the fifth isn't there");
  check(usedOf(run, "treenail") === 4, "what's used is counted across the assembly");
  check(fasten(a, run, "scarf", "treenail", -1, sc) && usedOf(run, "treenail") === 3 && !fasten(a, run, "kneeR", "wedge", -1, sc), "a fastening comes off, and one that isn't there can't");
  check(canAdd(a, run, "kneeR", "treenail", sc), "which frees it for another joint");
  const empty = newRun(1, 7);
  fasten(a, empty, "scarf", "treenail", 1, sc);
  fasten(a, empty, "scarf", "treenail", -1, sc);
  check(Object.keys(empty.fix).length === 0, "a joint with nothing on it is not kept in the run (the database keeps no empty objects)");
  run.done = { stars: 1 };
  check(!canAdd(a, run, "kneeL", "treenail", sc) && !fasten(a, run, "kneeL", "treenail", -1, sc), "a run that is over is left as it was");
}

// ---------- what a joint is worth ----------
{
  check(near(worth("knee", { lash: 1, treenail: 2 }), 1 + 3 + 3 * MORE[1]), "a second of a kind is worth less than the first");
  check(near(worth("stand", { wedge: 3 }), 3 * (MORE[0] + MORE[1] + MORE[2])), "and a third less again");
  const a = byId("hull"), j = a.joints[0];
  check(near(holdOf(a, j, { treenail: 1 }, { stem: 95, frame: 95 }), 3) && holdOf(a, j, { treenail: 1 }, { stem: 95, frame: 60 }) < 3, "a joint is as strong as the weaker of the two timbers it joins");
  check(allowed(j, "treenail") && !allowed(j, "pin"), "the kind says what is allowed");
}

// ---------- the gale ----------
{
  const a = byId("cog"), g1 = gale(a, 5), g2 = gale(a, 5), g3 = gale(a, 6);
  check(JSON.stringify(g1) === JSON.stringify(g2) && JSON.stringify(g1) !== JSON.stringify(g3), "the gale from a seed is the same every time and another from another");
  let inBand = true, spread = [0, 0];
  for (let s = 1; s <= 200; s++) for (const j of a.joints) { const v = gale(a, s * 31)[j.id]; if (v < j.load[0] || v > j.load[1]) inBand = false; }
  check(inBand, "every load is drawn from its joint's forecast band");
  const first = a.joints[0];
  const vs = Array.from({ length: 400 }, (_, s) => gale(a, s * 977 + 1)[first.id]);
  spread = [Math.min(...vs), Math.max(...vs)];
  check(spread[0] < first.load[0] + 0.1 * (first.load[1] - first.load[0]) && spread[1] > first.load[1] - 0.1 * (first.load[1] - first.load[0]), "and the draws cover the whole band");
}

// ---------- the launch ----------
{
  const a = byId("deck"), sc = carved(a, 3);
  const lashes = newRun(0, 11);
  for (const j of a.joints) fasten(a, lashes, j.id, "lash", 1, sc);
  const r0 = launch(a, lashes, sc);
  check(!r0.held && lashes.tries === 1 && lashes.seed !== 11 && lashes.done === null && r0.stars === 0, "lashings alone don't hold: the gale takes a joint, the run goes on with a new gale to come");
  check(lashes.seed === nextSeed(11), "the next gale is the next seed");
  // a plain, strong fastening: three treenails a joint
  const strong = newRun(0, 11);
  for (const j of a.joints) { fasten(a, strong, j.id, "lash", 1, sc); for (let i = 0; i < 3; i++) fasten(a, strong, j.id, "treenail", 1, sc); }
  const r1 = launch(a, strong, sc);
  check(r1.held && strong.done && strong.done.stars === r1.stars && r1.joints.every(j => j.ok), "enough on every joint holds, and the run is closed with its stars");
  check(r1.par < r1.used || r1.par === r1.used, "and says how few would have held");
  check(r1.stars === 1 || r1.stars === 2 || r1.stars === 3, "a hold is one to three stars");
  // thrift: the same hold after failed gales is a star less for each
  const late = newRun(0, 11);
  late.tries = 2;
  for (const j of a.joints) { fasten(a, late, j.id, "lash", 1, sc); for (let i = 0; i < 3; i++) fasten(a, late, j.id, "treenail", 1, sc); }
  const r2 = launch(a, late, sc);
  check(r2.held && r2.stars === Math.max(1, (r1.stars) - 2) || r2.stars === 1, "a gale that took a joint first costs a star, one star the least");
  check(parOf(a, gale(a, 11), sc) >= 1, "a gale always wants something");
  // par: the least that would have held, brute-forced
  const j = byId("rig").joints[0], q = strength(95);
  const brute = load => { let best = Infinity; for (let t = 0; t <= 3; t++) for (let w = 0; w <= 3; w++) if (t + w <= 3 && worth(j.kind, { lash: 1, treenail: t, wedge: w }) * q >= load) best = Math.min(best, t + w); return best === Infinity ? MAX_ON : best; };
  check([3.8, 4.5, 5.2, 5.9, 7, 9].every(l => leastFor(j, l, q) === brute(l)), "the least that would have held a joint agrees with trying every way");
}

// ---------- a run kept ----------
{
  const a = byId("rig"), run = newRun(3, 99), sc = carved(a, 2);
  fasten(a, run, "step", "wedge", 1, sc); fasten(a, run, "step", "lash", 1, sc); fasten(a, run, "hoist", "pin", 1, sc);
  const back = JSON.parse(JSON.stringify(run));
  check(sound(back) && JSON.stringify(back) === JSON.stringify(run), "a run goes through JSON and comes back whole");
  check(sound({ ...back, job: 99 }) === null && sound({ ...back, fix: { nope: { wedge: 1 } } }) === null && sound({ ...back, fix: { step: { wedge: 0 } } }) === null && sound({ ...back, seed: "x" }) === null && sound(null) === null, "and a run that isn't one is not taken");
}

// ---------- decisions, not busywork ----------
// The best way to spend a stock, found by search: per joint every allowed set of fastenings, and a table over how many
// of each is used, keeping the likeliest hold (the product of each joint's chance to hold, the loads being independent
// draws from their bands), then the fewest fastenings.
function options(j) {
  const v = KINDS[j.kind].value, out = [];
  for (let l = 0; l <= 1; l++) for (let t = 0; t <= MAX_ON; t++) for (let w = 0; w <= MAX_ON; w++) for (let p = 0; p <= MAX_ON; p++) {
    if (l + t + w + p > MAX_ON || (t && v.treenail == null) || (w && v.wedge == null) || (p && v.pin == null)) continue;
    out.push({ lash: l, treenail: t, wedge: w, pin: p });
  }
  return out;
}
const chance = (j, f, q) => Math.max(0, Math.min(1, (worth(j.kind, f) * q - j.load[0]) / (j.load[1] - j.load[0])));
function search(a, sc) {
  const st = stock(sc);
  let table = new Map([["0,0,0", { v: 0, picks: [] }]]);
  for (const j of a.joints) {
    const q = Math.min(strength(sc[j.a]), strength(sc[j.b])), next = new Map();
    for (const [k, s] of table) {
      const [t0, w0, p0] = k.split(",").map(Number);
      for (const f of options(j)) {
        const t = t0 + f.treenail, w = w0 + f.wedge, p = p0 + f.pin;
        if (t > st.treenail || w > st.wedge || p > st.pin) continue;
        const v = s.v + Math.log(Math.max(chance(j, f, q), 1e-9)) - 0.002 * (f.treenail + f.wedge + f.pin), key = `${t},${w},${p}`;
        if (!next.has(key) || next.get(key).v < v) next.set(key, { v, picks: [...s.picks, f] });
      }
    }
    table = next;
  }
  return [...table.values()].reduce((a, b) => (a.v > b.v ? a : b));
}
const holds = (a, sc, picks, trials = 300) => {
  let n = 0;
  for (let s = 1; s <= trials; s++) {
    const run = newRun(0, s * 7919);
    a.joints.forEach((j, i) => { const f = Object.fromEntries(IDS.filter(id => picks[i][id]).map(id => [id, picks[i][id]])); if (Object.keys(f).length) run.fix[j.id] = f; });
    if (launch(a, run, sc).held) n++;
  }
  return n / trials;
};
/** The obvious plan: joint by joint, best-value fastenings until the top of its band is covered, while the stock lasts. */
function toTheTop(a, sc) {
  const st = stock(sc), left = { treenail: st.treenail, wedge: st.wedge, pin: st.pin };
  return a.joints.map(j => {
    const f = { lash: 1, treenail: 0, wedge: 0, pin: 0 }, q = Math.min(strength(sc[j.a]), strength(sc[j.b]));
    while (worth(j.kind, f) * q < j.load[1] && f.lash + f.treenail + f.wedge + f.pin < MAX_ON) {
      let pick = null, gain = 0;
      for (const id of GOOD) if (allowed(j, id) && left[id] > 0) { const g = worth(j.kind, { ...f, [id]: f[id] + 1 }) - worth(j.kind, f); if (g > gain) { gain = g; pick = id; } }
      if (!pick) break;
      f[pick]++; left[pick]--;
    }
    return f;
  });
}
/** Two fastenings at every joint, the kind's best (or its worst) each time: the same effort, differently placed. */
const two = (a, pickBest) => a.joints.map(j => {
  const v = KINDS[j.kind].value, id = GOOD.filter(g => v[g] != null).reduce((x, y) => ((v[x] < v[y]) === pickBest ? y : x));
  return { lash: 1, treenail: 0, wedge: 0, pin: 0, [id]: 2 };
});
{
  const best = {}, chanceAll = {};
  for (const a of ASSEMBLIES) for (const t of [1, 2, 3]) { const s = search(a, carved(a, t)); best[`${a.id}${t}`] = s; chanceAll[`${a.id}${t}`] = Math.exp(s.v + 0.002 * s.picks.reduce((n, f) => n + f.treenail + f.wedge + f.pin, 0)); }
  check(ASSEMBLIES.every(a => holds(a, carved(a, 3), a.joints.map(j => ({ lash: allowed(j, "lash") ? 1 : 0 })), 100) === 0), "lashings alone hold nothing, in any assembly, at any carving");
  const placed = ASSEMBLIES.map(a => holds(a, carved(a, 3), two(a, true), 200) - holds(a, carved(a, 3), two(a, false), 200));
  console.log("     two of the right fastening at every joint against two of the wrong:", placed.map(x => x.toFixed(2)).join(", "));
  check(placed.every(x => x > 0) && placed.filter(x => x >= 0.3).length >= 3, "two fastenings of the right kind hold far oftener than two of the wrong one: it matters which goes where");
  check(ASSEMBLIES.every(a => chanceAll[`${a.id}3`] >= chanceAll[`${a.id}2`] - 1e-9 && chanceAll[`${a.id}2`] >= chanceAll[`${a.id}1`] - 1e-9), "better carving never makes it harder to hold");
  check(ASSEMBLIES.every(a => chanceAll[`${a.id}3`] > 0.95), "with three-star carving every assembly can be made to hold");
  check(chanceAll.cog1 < 0.05 && chanceAll.cog2 > 0.25 && chanceAll.cog2 < 0.8, "the whole ship is out of reach at a star's carving and a risk at two stars' (best chance of holding all eight: " + chanceAll.cog2.toFixed(2) + ")");
  check(chanceAll.deck1 > 0.95 && chanceAll.hull1 < 0.6 && chanceAll.rig1 < 0.7, "and the first assembly is easy, the later ones need care with little stock");
  // the best spending is not the obvious one
  let beaten = 0;
  const gaps = [];
  for (const a of ASSEMBLIES) for (const t of [1, 2]) {
    const sc = carved(a, t), mine = holds(a, sc, best[`${a.id}${t}`].picks), plain = holds(a, sc, toTheTop(a, sc));
    gaps.push(`${a.id}${t}: best ${mine.toFixed(2)} v ${plain.toFixed(2)}`);
    if (mine - plain >= 0.2) beaten++;
  }
  console.log("     the best spending against filling joint by joint to the top of the forecast:", gaps.join("; "));
  check(beaten >= 2, `filling joint by joint to the top of the forecast loses to spending the scarce ones where they count (by a fifth or more in ${beaten} cases)`);
  // and what's best depends on what was carved
  const ways = new Set(ASSEMBLIES.flatMap(a => [1, 2, 3].map(t => JSON.stringify(best[`${a.id}${t}`].picks.map(f => [f.treenail, f.wedge, f.pin])))));
  check(ways.size >= 10, `the best way to spend differs from assembly to assembly and with the carving (${ways.size} different ways in 15 cases)`);
  const kinds = new Set(best.cog3.picks.flatMap(f => GOOD.filter(id => f[id] > 0)));
  check(kinds.size === 3, "the whole ship uses a treenail, a wedge and a pin somewhere: none is left in the drawer");
  const hullSame = JSON.stringify(best.hull1.picks) === JSON.stringify(best.hull3.picks);
  check(!hullSame, "the hull is fastened differently with little stock than with plenty");
}

if (bad) { console.log(`${bad} failed`); process.exit(1); }
else console.log("slipway yard: the joints and kinds, the stock the carving makes, fastening within it, the gale from its forecast, the grade by thrift and by failed gales, a run kept, and that assembling is a set of decisions");
