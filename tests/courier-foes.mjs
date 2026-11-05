// Courier's foes: the behaviours table (BEHAVIOURS in reckoning-engine.js) has an entry for every kind, each living kind has timings that
// make sense and punishes a habit no other kind does, and each foe's counters work (and its punished habit fails) in play (5 November 2026).
import { KINDS, BEHAVIOURS, behOf, armourOf, spawnFoe, swipe, step, speed, BOTTLE_V } from "../reckoning-engine.js";
import { arena, run, reflex } from "./courier-reflex.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

{
  check(Object.keys(KINDS).every(k => BEHAVIOURS[k]), "every kind of foe has a behaviour");
  const live = Object.entries(BEHAVIOURS).filter(([, b]) => !b.inert);
  check(live.every(([, b]) => b.sight > b.wind && b.wind > b.launch && b.launch > 0 && b.counters.length >= 2 && b.move), "a living foe sees, winds up and launches in that order, and has two ways to beat it at least");
  const habits = live.map(([, b]) => b.punishes);
  check(habits.every(Boolean) && new Set(habits).size === habits.length, `no two foes punish the same habit (${habits.length} kinds)`);
  check(behOf({ kind: "crab", heavy: true }) === BEHAVIOURS.bruiser && behOf({ kind: "gull" }) === BEHAVIOURS.gull && behOf({ kind: "roller", cart: true }) === BEHAVIOURS.cart, "a heavy crab behaves as the bruiser and a cart as the cart");
}

/** One foe `tok` in `lane` 30 m ahead of the hero (in `hl`), played by the reflex bot with `habit`: the hearts lost and the run. */
function duel(tok, lane, { hl = 0, habit = null, z = 0, seed = 1, secs = 5 } = {}) {
  const S = arena({ seed, z, lane: hl });
  const f = spawnFoe(S, tok, lane, z + 30);
  run(S, { secs, habit });
  return { S, f, lost: 3 - S.hearts };
}
/** The same at three distances, three lanes of the hero: the most hearts lost, and the fewest (for a habit that must fail somewhere, not everywhere). */
function sweep(tok, lane, habit) {
  let most = 0, least = 9;
  for (const z of [0, 900, 2800]) for (const hl of [-1, 0, 1]) { const { lost } = duel(tok, lane, { hl, habit, z }); most = Math.max(most, lost); least = Math.min(least, lost); }
  return { most, least };
}

// ---------- each counter works, and each punished habit fails ----------
{
  const own = { c: 0, C: 0, S: 0, P: 1, T: 0, R: 0, K: 0, W: 0, H: 0 };
  for (const tok of Object.keys(own)) {
    const { most } = sweep(tok, own[tok], null);
    check(most === 0, `${tok}: the reflex answer takes no hearts, at any speed or from any lane`);
  }
  for (const [tok, habit, what] of [["c", "wait", "waiting in the lane"], ["C", "once", "one cut and on"], ["T", "wait", "holding a lane"], ["R", "early", "jumping early"], ["K", "cut", "reaching for a cut"],
    ["S", "cut", "a swipe for everything"], ["S", "roll", "a roll for everything"], ["P", "wait", "settling in a lane by the water"]]) {
    const { most } = sweep(tok, own[tok], habit);
    check(most > 0, `${tok}: ${what} costs a heart`);
  }
}

// ---------- the armour ----------
{
  // a shield bearer is not cut from the front or the side, and a roll does not take him
  const S = arena({ seed: 2, z: 0 });
  const f = spawnFoe(S, "S", 0, 14);
  let swiped = false, kills = 0;
  while (!S.over && S.t < 3) {
    if (!swiped && (f.z - S.hero.z) / speed(S) < 0.25) { swipe(S, "up"); swiped = true; }
    step(S, 1 / 120);
    kills += S.ev.filter(e => e.type === "lunge").length;
    S.ev.length = 0;
  }
  check(kills === 0, "an up swipe at a shield bearer is a jump, not a front cut (no lunge)");
  const B = arena({ seed: 2, z: 0 });
  spawnFoe(B, "S", 0, 30);
  const st = { next: 0 };
  let how = null;
  while (!B.over && B.t < 5) { reflex(B, st); step(B, 1 / 120); for (const e of B.ev) if (e.type === "kill") how = e.how; B.ev.length = 0; }
  check(how === "bonk" && B.hearts === 3, "a jump and a dive take him (a bonk)");

  // a runaway cart is cut by nothing, bonked by nothing; a lane changed in time is the answer
  const C = arena({ seed: 3, z: 0 });
  const cart = spawnFoe(C, "K", 0, 40);
  check(armourOf(cart) === "all" && cart.h > KINDS.roller.h, "the cart is armoured against everything and bigger than a barrel");
  run(C, { secs: 5 });
  check(C.hearts === 3 && cart.alive, "a lane changed in time dodges the cart, and it is still there, rolling on");
}

// ---------- the thrower's shots ----------
{
  const S = arena({ seed: 4, z: 0 });
  spawnFoe(S, "T", 0, 40);
  let shot = null, tracer = null;
  const st = { next: 0 };
  while (!S.over && S.t < 5) {
    for (const f of S.world.foes) if (f.kind === "thrower" && f.ph === 2) tracer = f.aim;
    step(S, 1 / 120);
    for (const e of S.ev) if (e.type === "throw") shot = e;
    S.ev.length = 0;
    if (shot) break;
  }
  check(shot && tracer === shot.aim && shot.aim === S.hero.lane, "a tracer follows my lane while the thrower winds up and sets where the throw goes");
  const b = S.world.shots[0];
  check(b && b.lane === shot.aim && b.z < 40.1, "the bottle runs the lane aimed at");
  swipe(S, "left");
  let hurt = false;
  for (let i = 0; i < 600 && !S.over; i++) { step(S, 1 / 120); if (S.ev.some(e => e.type === "hurt")) hurt = true; S.ev.length = 0; }
  check(!hurt, "a lane changed after the throw dodges it");
  const J = arena({ seed: 4, z: 0 });
  spawnFoe(J, "T", 0, 40);
  let up = false, jhurt = false;
  while (!J.over && J.t < 4.5) {
    const s = J.world.shots.find(x => !x.done && x.kind === "bottle");
    if (s && !up && (s.z - J.hero.z) / (speed(J) + BOTTLE_V) < 0.36) { swipe(J, "up"); up = true; }
    step(J, 1 / 120);
    if (J.ev.some(e => e.type === "hurt" && e.shot)) jhurt = true;
    J.ev.length = 0;
  }
  check(up && !jhurt, "a bottle is jumped");
  const A = arena({ seed: 4, z: 0 });
  const t = spawnFoe(A, "T", 0, 40);
  t.thrown = 2;                                                         // the next throw is the third: an anchor
  let kind = null, smashed = false, ahurt = false;
  while (!A.over && A.t < 5) { step(A, 1 / 120); for (const e of A.ev) { if (e.type === "throw") kind = e.shot; if (e.type === "smash") smashed = true; if (e.type === "hurt") ahurt = true; } A.ev.length = 0; }
  check(kind === "anchor" && smashed && ahurt, "every third throw is an anchor, lobbed to land where I will be, and it hurts if I am still there");
}

// ---------- the pirate and the others ----------
{
  const S = arena({ seed: 5, z: 0 });
  const p = spawnFoe(S, "P", 1, 30);
  check(p.x > 1.7 * 1.5 && p.y > 1, "a pirate hangs out over the water on a rope");
  let landed = null;
  const st = { next: 0 };
  while (!S.over && S.t < 5) { step(S, 1 / 120); if (p.p >= 1 && landed === null) landed = [p.lane, +p.y.toFixed(2)]; S.ev.length = 0; if (landed) break; }
  check(landed && landed[0] === S.hero.lane && landed[1] === 0, "and swings into the lane I am in, landing on the planks");
  const R = arena({ seed: 6, z: 0 });
  const r = spawnFoe(R, "R", 0, 40);
  while (!R.over && r.ph !== 3) { step(R, 1 / 120); R.ev.length = 0; }
  const z0 = r.z;
  for (let i = 0; i < 36; i++) { step(R, 1 / 120); R.ev.length = 0; }
  check(r.ph === 3 && z0 - r.z > 2, "a docker's barrel, once launched, rolls towards me faster than the quay comes");
  const W = arena({ seed: 7, z: 0 });
  const w = spawnFoe(W, "W", 0, 60);
  const xs = new Set();
  for (let i = 0; i < 360; i++) { step(W, 1 / 120); xs.add(w.lane); if (W.hero.z > 40) break; }
  check(xs.size >= 2, "a patrolling crab strafes across lanes until it sees me");
  const H = arena({ seed: 8, z: 0 });
  const h = spawnFoe(H, "H", 1, 40);
  while (!H.over && !h.ph) { step(H, 1 / 120); H.ev.length = 0; }
  const hz = h.z;
  for (let i = 0; i < 60; i++) { step(H, 1 / 120); H.ev.length = 0; }
  check(hz - h.z > 1.5, "a charger runs at me from the moment it has seen me");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("courier foes: the behaviours table, the counters, the habits they punish, the armour and the shots");
