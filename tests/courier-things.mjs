// Courier's things on the quay: the sluice gate's state and its warning, the drawbridge and its lever, the barrel that is jumped or broken, the
// balloon that is popped, and the coins and amber that every stretch of quay carries (Korbi, 4 November 2026). Pure rules, no page.
import { newGame, valid, swipe, step, take, solid, tide, bridgeUp, leverLowers, sprinkle, speed, TIDE_P, TIDE_OPEN, TIDE_WARN, BREAK_COINS, GEM_MAX_HEARTS, COIN_PASS, KINDS, JUMP_V, LANE_W } from "../reckoning-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const DT = 1 / 120;
const run = (S, secs) => { for (let t = 0; t < secs - 1e-9 && !S.over; t += DT) step(S, DT); };

/** A section of one's own, with no coins unless asked: the hero is on its quay at pace. */
function make(rows, extra = {}) {
  const S = newGame({ seed: 1, section: { id: 1, name: "t", v0: 10, v1: 10, gap: 10, rows, goal: { kind: "none", n: 0 }, par: { hits: 0 }, lead: 10, coins: false, ...extra } });
  S.fwd = 1;
  return S;
}
const evs = (S, fn) => { const all = []; return { run: secs => { for (let t = 0; t < secs - 1e-9 && !S.over; t += DT) { step(S, DT); all.push(...take(S)); } return all; }, all }; };

// ---------- the sluice gate: which one is open, and a warning before it changes ----------
{
  const S = make(["W0 W1 W2"]), o = S.world.obs[0];
  const seq = [];
  for (let t = 0; t < TIDE_P * 1.001; t += 0.01) { S.t = t; const s = tide(S, o).state; if (seq[seq.length - 1] !== s) seq.push(s); }
  check(seq.join(",") === "open,closing,shut,opening,open" || seq.join(",") === "closing,shut,opening,open,closing" || seq.join(",") === "open,closing,shut,opening", `a sluice goes open, closing, shut, opening and open again (${seq.join(", ")})`);
  let closing = 0, opening = 0;
  for (let t = 0; t < TIDE_P; t += 0.01) { S.t = t; const s = tide(S, o).state; if (s === "closing") closing += 0.01; if (s === "opening") opening += 0.01; }
  check(Math.abs(closing - TIDE_WARN) < 0.05 && Math.abs(opening - TIDE_WARN) < 0.05, `the warning lasts ${TIDE_WARN} s each way`);
  let ok = true;
  for (let t = 0; t < TIDE_P; t += 0.01) { S.t = t; const s = tide(S, o).state; if (solid(S, o) !== (s === "shut" || s === "opening")) ok = false; }
  check(ok, "a gate blocks while it is shut or opening, and not while it is open or closing (what the lamp and the leaf show is what the rules do)");
  const open = [0, 0, 0]; let min = 3, max = 0;
  for (let t = 0; t < TIDE_P * 2; t += 0.02) { S.t = t; const n = S.world.obs.filter(x => !solid(S, x)).length; min = Math.min(min, n); max = Math.max(max, n); }
  check(min >= 1 && max <= 2, "of the three gates in a row at least one is passable at any moment, and one at least is shut when the others are not all open (the lanes differ)");
  S.t = 0; const left = tide(S, o).left;
  check(left > 0 && left <= TIDE_P, "it says the seconds until it changes");
}

// ---------- the drawbridge and its lever ----------
{
  let S = make(["F0 F1 F0"]);
  const [a, b] = S.world.obs;
  check(bridgeUp(S, a) && !bridgeUp(S, b) && solid(S, a) && !solid(S, b), "with the lever at 0 the red bridges (0) are up and the blue ones are down");
  S = make(["L . .", "F0 F0 F0"]);
  check(leverLowers(S) === 0, "the lever shows the colour it will lower: the red bridges, which are up");
  swipe(S, "left"); run(S, 4);
  check(S.flip === 1 && S.hits === 0, "stepping on it turns the bridges over, and the red ones are down");
  check(leverLowers(S) === 1, "and now it would lower the blue ones");
  S = make(["F0 F0 F0"]); run(S, 4);
  check(S.hits === 1, "a bridge that is up still stops the hero");
}

// ---------- barrels: jumped, or broken by the same attacks that cut a crab ----------
// (the first row is 10 m up the quay and the pace is 10 m/s, so it is reached at 1.0 s: a swipe at 0.75 s is 0.25 s from it)
{
  check(KINDS.barrel.inert && !KINDS.barrel.air, "a barrel is a thing that stands: it does not look, wind up or fly at me");
  let S = make([". b ."]), E = evs(S);
  const b = S.world.foes[0];
  E.run(0.75); swipe(S, "up"); E.run(2);
  check(!b.alive && S.hits === 0 && S.coins === BREAK_COINS.barrel, `up close to a barrel cuts it open (the lunge of a crab): no heart, ${BREAK_COINS.barrel} coins`);
  check(E.all.some(e => e.type === "kill" && e.kind === "barrel" && e.how === "front" && Number.isFinite(e.x) && Number.isFinite(e.z)) && E.all.some(e => e.type === "coins" && e.n === BREAK_COINS.barrel), "and says where it broke and what came out");
  S = make([". b ."]); const b2 = S.world.foes[0]; run(S, 0.55); swipe(S, "up"); run(S, 2);
  check(b2.alive && S.hits === 0 && S.coins === 0, "up from further off is a jump over it: the barrel stays, no coins, no harm");
  S = make([". b ."]); run(S, 4);
  check(S.hits === 1 && S.coins === 0 && !S.world.foes[0].alive, "run into, a barrel costs a heart and breaks, and gives nothing");
  S = make([". b ."]); run(S, 0.8); swipe(S, "down"); run(S, 2);
  check(S.hits === 0 && S.coins === BREAK_COINS.barrel, "a roll through a barrel breaks it");
  S = make([". . b"]); run(S, 0.7); swipe(S, "right"); run(S, 2);
  check(S.hits === 0 && S.coins === BREAK_COINS.barrel && S.hero.lane === 1, "a swipe towards a barrel in the next lane cuts it, and the lane change goes with it");
  S = make([". b ."]); run(S, 0.75); swipe(S, "up"); run(S, 0.32);
  check(S.hero.y > 0.1 && S.hero.mode === "air", "(the cut hops me up, as a crab's does)");
  S = make([". b ."]); S.hero.z = 8; S.hero.y = 3; S.hero.mode = "air"; S.hero.vy = 0; swipe(S, "down"); run(S, 1.6);
  check(S.hits === 0 && !S.world.foes[0].alive && S.coins === BREAK_COINS.barrel, "dropped on from above, a barrel breaks too (a bonk)");
}

// ---------- balloons: popped in the air, and a stair for the hero ----------
{
  check(KINDS.balloon.inert && KINDS.balloon.air && KINDS.balloon.y > KINDS.crab.y + 1, "a balloon floats where it is hung and does not follow me");
  let S = make([". o ."]), E = evs(S);
  const bal = S.world.foes[0];
  E.run(0.55); swipe(S, "up"); E.run(0.15);
  check(S.hero.y > 0.5, "up under a balloon flies up at it");
  let n = 0; while (bal.alive && n++ < 200) E.run(0.01);
  check(!bal.alive && S.hits === 0 && S.coins === BREAK_COINS.balloon && S.chain >= 1 && S.hero.jumps === 1, `popped from below: ${BREAK_COINS.balloon} coins, my jump back in hand, the chain counts`);
  S = make([". O ."]); const hi = S.world.foes[0];
  run(S, 0.55); swipe(S, "up"); run(S, 0.3);
  check(hi.alive, "a high balloon is out of reach of a swipe from the planks: the swipe is a plain jump");
  // run into one: it pops for nothing and ends my chain; it never costs a heart
  S = make([". o ."]); S.hero.z = 9.3; S.hero.mode = "air"; S.hero.y = 1.6; S.hero.vy = 0; S.chain = 3; run(S, 0.3);
  check(!S.world.foes[0].alive && S.hits === 0 && S.coins === 0 && S.chain === 0, "run into, a balloon pops for nothing and ends my chain, and costs no heart");
  // a stair of balloons: each pop throws me up again, and a sideways swipe in the air takes the next one in the other lane
  S = make([". . ."], { lead: 8 });
  for (const [lane, z, y] of [[0, 10, 2.2], [1, 14, 3.0], [0, 18, 3.8], [-1, 22, 3.0]]) S.world.foes.push({ id: 700 + z, kind: "balloon", lane, x: lane * LANE_W, z, y, h: 1.1, alive: true, spent: false, gate: null });
  E = evs(S);
  const act = () => {
    const h = S.hero, f = S.world.foes.filter(f => f.alive).sort((a, b) => a.z - b.z)[0];
    if (!f || h.lunge || S.pending.length) return;
    const t = (f.z - h.z) / speed(S);
    if (t > 0.5 || t < 0.2) return;
    swipe(S, f.lane === h.lane ? "up" : f.lane > h.lane ? "right" : "left");
  };
  for (let t = 0; t < 4 && !S.over; t += DT) { act(); step(S, DT); E.all.push(...take(S)); }
  const popped = S.world.foes.filter(f => !f.alive).length;
  check(popped === 4 && S.hits === 0, `a chain of balloons is popped one after another (${popped} of 4), up and across, without a heart lost`);
  check(E.all.filter(e => e.type === "kill").map(e => e.chain).join() === "1,2,3,4", "and the chain counts each");
  check(S.coins === 4 * BREAK_COINS.balloon, "and each gives its coins");
}

// ---------- coins, and amber ----------
{
  const S0 = newGame({ seed: 5 });
  check(S0.world.pick.filter(p => p.kind === "coin").every(p => p.z > 18), "(the first stretch of the quay, where nothing is yet, has none)");
  const N = 18;
  let withCoins = 0, coins = 0, gems = 0, noCrab = true;
  for (let seed = 1; seed <= N; seed++) {
    const S = newGame({ seed });
    const all = [];
    for (let z = 0; z < 4000; z += 100) { S.hero.z = z; step(S, 1e-6); for (const p of S.world.pick) if (!all.includes(p)) all.push(p); }
    const c = all.filter(p => p.kind === "coin").length, g = all.filter(p => p.kind === "gem").length;
    coins += c; gems += g;
    if (c > 100) withCoins++;
  }
  check(withCoins === N, `every quay has coins all along (${(coins / N).toFixed(0)} in 4000 m on average)`);
  check(gems >= 1 && gems < coins / 20, `amber is rare (${gems} in ${N} quays of 4000 m, to ${coins} coins)`);
  for (let seed = 1; seed <= 30; seed++) {
    const S = newGame({ seed });
    S.world.foes.length = 0;
    for (let k = 0; k < 4; k++) S.world.foes.push({ id: 800 + k, kind: "crab", lane: [-1, 0, 1, 0][k], x: 0, z: 40 + 18 * k, y: 0, h: 1, alive: true, spent: false, gate: null });
    S.world.pick.length = 0; S.crng = seed * 77;
    sprinkle(S, 30, 140);
    for (const p of S.world.pick) if (p.kind === "coin" && S.world.foes.some(f => Math.abs(f.z - p.z) < 2 && Math.abs(f.lane - p.lane) <= 1)) noCrab = false;
  }
  check(noCrab, "a trail never runs through a crab's lane or the one beside it: the coins are the safe way");
  let arcs = 0, low = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const S = newGame({ seed });
    S.world.foes.length = 0; S.world.foes.push({ id: 810, kind: "barrel", lane: 0, x: 0, z: 60, y: 0, h: 0.85, alive: true, spent: false, gate: null });
    S.world.pick.length = 0; S.crng = seed * 31;
    sprinkle(S, 30, 100);
    for (const p of S.world.pick) if (p.kind === "coin" && p.lane === 0 && Math.abs(p.z - 60) < 1.5) { if (p.y > 1) arcs++; else low++; }
  }
  check(arcs > 0 && low === 0, "coins arc over a barrel, where a jump goes (and none lies on it)");
  const a = newGame({ seed: 9 }), b = newGame({ seed: 9 });
  a.hero.z = b.hero.z = 600; step(a, 1e-6); step(b, 1e-6);
  check(JSON.stringify(a.world.pick) === JSON.stringify(b.world.pick), "the coins are the same for the same seed");
}
{
  const give = (S, ...ps) => { for (const p of ps) S.world.pick.push({ taken: false, lane: 0, y: 0.55, ...p }); };
  let S = make([". . ."]); give(S, { id: 901, kind: "coin", z: 12 }, { id: 903, kind: "coin", z: 16, lane: 1 }); run(S, 2);
  check(S.coins === 1, "running through a coin takes it, and a coin in another lane stays");
  S = make([". . ."]); give(S, { id: 904, kind: "coin", z: 16, y: 1.9 });
  run(S, 1.0); swipe(S, "up"); run(S, 1.4);
  check(S.coins === 1, "a jump takes a coin hung at its height");
  S = make([". . ."]); give(S, { id: 905, kind: "coin", z: 16, y: 3.5 }); run(S, 2.5);
  check(S.coins === 0, "and one hung out of reach stays");
  S = make([". . ."]); S.hearts = 2; give(S, { id: 906, kind: "gem", z: 13, y: 1.0 }); run(S, 1.6);
  check(S.gems === 1 && S.hearts === 3 && S.maxHearts === 3, "amber is a heart back");
  S = make([". . ."]); give(S, { id: 907, kind: "gem", z: 13, y: 1.0 }); run(S, 1.6);
  check(S.gems === 1 && S.maxHearts === 4 && S.hearts === 4, "and, with all my hearts, a heart more");
  S = make([". . ."]); S.maxHearts = S.hearts = GEM_MAX_HEARTS; give(S, { id: 908, kind: "gem", z: 13, y: 1.0 }); run(S, 1.6);
  check(S.gems === 1 && S.maxHearts === GEM_MAX_HEARTS && S.hearts === GEM_MAX_HEARTS, `but never more than ${GEM_MAX_HEARTS} hearts`);
}
{
  // a section carries coins too, and a run kept from before has none and is still valid
  const S = newGame({ seed: 2, section: { id: 3, name: "t", v0: 10, v1: 10, gap: 11, rows: [". . .", ". . .", ". . .", ". . .", ". . .", ". . .", ". . .", ". . ."], goal: { kind: "none", n: 0 }, par: { hits: 0 } } });
  check(S.world.pick.some(p => p.kind === "coin"), "a section is sprinkled with coins as the endless quay is");
  const old = JSON.parse(JSON.stringify(newGame({ seed: 4 })));
  delete old.coins; delete old.gems; delete old.broke; delete old.crng;
  check(valid(old, []) && old.coins === 0 && old.gems === 0 && Number.isFinite(old.crng), "a run kept before coins is valid, and given them");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("courier things: the sluice's states, the bridge and its lever, barrels broken, balloons popped, coins and amber");
