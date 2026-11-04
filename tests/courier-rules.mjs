// Courier's rulings of 4 November 2026 (docs/courier.md): a gull in my own lane attacks, a roll needs a short recovery, and the
// foe a swipe is for cannot hurt me, however late the swipe. (The middle-lane wall run is in courier-walls.mjs.) Pure rules, no page.
import { T, setTune, resetTune } from "../reckoning-tune.js";
import { newGame, swipe, step, take, speed, KINDS, LANE_W } from "../reckoning-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const DT = 1 / 120;
const run = (S, secs) => { for (let t = 0; t < secs - 1e-9 && !S.over; t += DT) { step(S, DT); take(S); } };

let ids = 1;
/** An empty quay at pace, the hero in `lane`; foes `ttc` seconds of running ahead. */
function scene(lane = 0) {
  const S = newGame({ seed: 1 });
  S.world.foes = []; S.world.pits = []; S.world.walls = []; S.world.gates = []; S.world.z1 = 1e9;
  S.fwd = 1; S.hero.lane = lane; S.hero.x = lane * LANE_W;
  return S;
}
function foe(S, kind, lane, ttc) {
  const f = { id: ids++, kind, lane, x: lane * LANE_W, z: S.hero.z + ttc * speed(S), y: KINDS[kind].y, h: KINDS[kind].h, alive: true, spent: false, gate: null };
  S.world.foes.push(f);
  return f;
}
/** A gull in my own lane 1.2 s off; the swipes made at the given seconds; the run played out. */
function gull(swipes, extra = {}) {
  const S = scene(0), f = foe(S, "gull", 0, 1.2);
  let at = 0;
  for (const [secs, dir] of swipes) { run(S, secs - at); at = secs; swipe(S, dir); take(S); }
  run(S, 2.5);
  return [S, f];
}

// ---------- 1. a gull in my own lane ----------
{
  const S = scene(0), f = foe(S, "gull", 0, 1.2), seen = [];
  for (let i = 0; i < 400 && S.hero.z < f.z; i++) { step(S, DT); for (const e of take(S)) if (["notice", "wind", "launch"].includes(e.type)) seen.push(e.type); }
  check(seen.join() === "notice,wind,launch" && f.aim === 0, "a gull in my own lane sees me, winds up and launches, like any foe");
  run(S, 1);
  check(S.hearts === 2 && f.y < 0.05, "and dives down the lane: left alone it hits");
}
{
  let [S, f] = gull([[0.95, "down"]]);
  check(S.hearts === 3 && f.alive, "a roll under it dodges");
  [S, f] = gull([[0.95, "right"]]);
  check(S.hearts === 3 && S.hero.lane === 1, "so does a lane change once it has launched");
  [S, f] = gull([[0.95, "left"]]);
  check(S.hearts === 3 && S.hero.lane === -1, "(either way)");
  [S, f] = gull([[0.7, "right"]]);
  check(S.hearts === 2, "but a lane change before it launches only takes it to the new lane: it dives down that one");
  [S, f] = gull([[0.3, "down"]]);
  check(S.hearts === 2, "and a roll that is over before it arrives does nothing");
}
{
  // a plain jump into a gull used to be a hurt at 0.6 s and a kill at 0.5 s: it is now a jump attack from any time it has seen me
  const out = [0.9, 0.7, 0.6, 0.5, 0.4, 0.2].map(ttc => { const S = scene(0), f = foe(S, "gull", 0, 1.2); run(S, 1.2 - ttc); swipe(S, "up"); take(S); run(S, 2); return [ttc, !f.alive, S.hearts, S.chain, S.hero.mode]; });
  check(out.every(o => o[1] && o[2] === 3), `a jump at it from 0.9 s to 0.2 s off is a jump attack that kills it, at every time (${out.map(o => o[0]).join(", ")})`);
  const S = scene(0), f = foe(S, "gull", 0, 1.2); run(S, 0.05); swipe(S, "up"); take(S); run(S, 3);
  check(f.alive && S.hearts === 2, "a jump much too early only lands under its dive: a plain jump, and a hit, but not a silent one (it telegraphed)");
  const U = scene(0), g = foe(U, "gull", 0, 1.2); run(U, 1.0); swipe(U, "up"); take(U); run(U, 1);
  check(!g.alive && U.hearts === 3, "and a jump at it as it dives (ttc 0.2) cuts it down");
  const V = scene(0), h = foe(V, "gull", 0, 0.5);
  V.world.pits.push({ z0: h.z - 3, z1: h.z + 3 });
  run(V, 0.6);
  check(V.hearts === 3 && !h.ph, "a gull over a pit is still the bridge: it never attacks");
}

// ---------- 2. a roll gets a short recovery ----------
{
  resetTune();
  check(T.ROLL_REC >= 0.12 && T.ROLL_REC <= 0.2, `the recovery is a tunable (${T.ROLL_REC} s)`);
  const S = scene(0);
  swipe(S, "down"); const e1 = take(S).filter(e => e.type === "roll").length;
  run(S, T.ROLL_T + 0.01);
  check(e1 === 1 && S.hero.roll === 0 && S.hero.rollRec > 0, "after a roll there is a recovery");
  swipe(S, "down"); run(S, 0.01);
  check(S.hero.roll === 0, "in which another roll does not start");
  run(S, 0.3); swipe(S, "down"); take(S);
  check(S.hero.roll > 0, "and after it, one does");
  const U = scene(0);
  swipe(U, "down"); run(U, 0.2); swipe(U, "down"); run(U, T.ROLL_T - 0.2 + 0.02);
  check(U.hero.roll > 0 && U.hero.rollRec === 0, "a roll swiped in the middle of one still follows at once, with no recovery between a chain of them");
  run(U, T.ROLL_T + 0.01);
  check(U.hero.roll === 0 && U.hero.rollRec > 0, "the recovery comes after the last of the chain");
  const W = scene(0);
  swipe(W, "down"); run(W, T.ROLL_T + T.ROLL_REC - 0.05); swipe(W, "down"); run(W, 0.1);
  check(W.hero.roll > 0, "a down swiped a moment before the recovery ends is kept, and rolls when it does");
  const X = scene(0);
  swipe(X, "down"); run(X, T.ROLL_T + 0.01); swipe(X, "up"); take(X);
  check(X.hero.mode === "air", "a jump is allowed in the recovery");
  setTune({ ROLL_REC: 0 });
  const Y = scene(0);
  swipe(Y, "down"); run(Y, T.ROLL_T + 0.01); swipe(Y, "down"); take(Y);
  check(Y.hero.roll > 0, "with the tunable at 0 there is none");
  setTune({ ROLL_REC: 0.4 });
  const Z = scene(0);
  swipe(Z, "down"); run(Z, T.ROLL_T + 0.3); swipe(Z, "down"); run(Z, 0.01);
  check(Z.hero.roll === 0, "and a longer one is longer");
  resetTune();
}

// ---------- 3. the foe I am attacking cannot hurt me, however late ----------
{
  /** A crab one lane left, launched at me; the run goes on until it is in reach of me, then `after` seconds more, and then a swipe left. */
  const late = (after, lane = -1, kind = "crab") => {
    const S = scene(0), f = foe(S, kind, lane, 1.0);
    for (let i = 0; i < 600 && f.threat == null && !S.over; i++) { step(S, DT); take(S); }
    run(S, after);
    swipe(S, "left"); take(S); run(S, 1);
    return [S, f];
  };
  let [S, f] = late(0);
  check(f.ph === 3 && !f.alive && S.hearts === 3, "a crab that has launched and is just reaching me is cut by a swipe towards it, and does not hurt");
  [S, f] = late(0.1);
  check(!f.alive && S.hearts === 3, "a tenth of a second after it reached me (it is hitting me, and I am quite late) the swipe still wins");
  [S, f] = late(T.LATE_WIN - 0.03);
  check(!f.alive && S.hearts === 3, `right up to the late window (${T.LATE_WIN} s)`);
  [S, f] = late(T.LATE_WIN + 0.1);
  check(S.hearts === 2, "past it the hit has landed");
  [S, f] = late(0.1, 1);
  check(S.hearts === 2 || !f.alive, "(the other side is its own swipe)");
  const U = scene(0), a = foe(U, "crab", -1, 1.0);
  for (let i = 0; i < 600 && a.threat == null; i++) { step(U, DT); take(U); }
  run(U, 0.05); swipe(U, "right"); take(U); run(U, 1);
  check(U.hearts === 2, "a swipe the other way does not cancel the hit, however late: only the foe being attacked is safe");
  {
    // a cut from the left lane goes on to the next foe: that one is safe too, from the swipe
    const V = scene(-1), p = foe(V, "crab", 0, 0.35), q = foe(V, "crab", 1, 0.36);
    run(V, 0.01); swipe(V, "right"); take(V); run(V, 1);
    check(!p.alive && !q.alive && V.hearts === 3, "a sweep: the foe it goes on to cannot hurt me while it comes, either");
  }
  {
    // other foes on that side are not: a second crab in the lane I am cut into, behind the first
    const V = scene(0), p = foe(V, "crab", -1, 0.3), q = foe(V, "crab", -1, 1.0);
    run(V, 0.01); swipe(V, "left"); take(V); run(V, 1.5);
    check(!p.alive && V.hearts === 2, "another foe on that side is not guarded: it hits as it would");
  }
  {
    // the guard is gone: a swipe no longer protects against a foe beside me that is not its target
    const V = scene(-1), p = foe(V, "crab", 0, 0.085);
    run(V, 0.005); swipe(V, "up"); take(V); run(V, 1);
    check(V.hearts === 2, "a swipe up in the lane beside a foe no longer guards me from it");
    const W = scene(0), c = foe(W, "crab", 1, 0.9);
    run(W, 0.005); swipe(W, "left"); take(W); run(W, 1.3);
    check(W.hero.guard === undefined, "(no guard is kept at all)");
  }
  {
    // barrels are not mid-attack: they hit at once
    const V = scene(0), b = foe(V, "barrel", 0, 0.3);
    run(V, 0.5);
    check(V.hearts === 2 && !b.alive, "a barrel run into hits at once (it is not attacking)");
  }
}

console.log(bad ? `${bad} problems` : "courier rules: a gull in my own lane, the roll's recovery, the foe I am attacking");
process.exit(bad ? 1 : 0);
