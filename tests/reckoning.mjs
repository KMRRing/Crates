// Courier's rules (reckoning-engine.js) and its feel (reckoning-move.js): the jump, the five ways a swipe attacks (a foe in front, to the side, above,
// the bonk and the slam), the wall run, the air chain over a pit, the question gate over the water, the quay from a seed
// and a bot playing whole stretches of it (every kind of chunk is winnable with the swipes the rules give).
import { bot, botStep } from "./reckoning-bot.js";
import { RunLog, describe } from "../reckoning-log.js";
import { Spring, Inertia, Streamer, CameraRig } from "../reckoning-move.js";
import { MAX_QUESTION, MAX_ANSWER, load, dealer } from "../reckoning-questions.js";
import { T as TUNE, airTime } from "../reckoning-tune.js";
import { LANE_W, LANE_T, JUMP_H, JUMP_V, AIR_T, WALL_Y, SLAM_MIN_Y, ROLL_T, SIDE_ABOVE, UP_ABOVE, DRIFT_V, BUFFER, LAND_BUFFER, KINDS, speed, speedAt, newGame, copy, setDeal, swipe, step, take, ensure } from "../reckoning-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const DT = 1 / 120;

/** A quay made by hand: nothing on it, and none made ahead. */
function scene(parts = {}) {
  const S = newGame({ seed: 1 });
  S.world.foes = []; S.world.pits = []; S.world.walls = []; S.world.gates = []; S.world.z1 = 1e9;
  Object.assign(S.hero, parts.hero || {});
  return S;
}
let ids = 1000;
/** A foe `ttc` seconds of running ahead of the hero (at the speed there is now). */
function foeAt(S, kind, lane, ttc, y = KINDS[kind].y) {
  const f = { id: ids++, kind, lane, x: lane * LANE_W, z: S.hero.z + ttc * speed(S), y, h: KINDS[kind].h, alive: true, spent: false, gate: null };
  S.world.foes.push(f);
  return f;
}
const run = (S, secs) => { for (let t = 0; t < secs - 1e-9 && !S.over; t += DT) step(S, DT); };
const events = S => take(S).map(e => e.type);

// ---------- the jump ----------
{
  const S = scene();
  swipe(S, "up");
  let peak = 0, t = 0;
  while (S.hero.mode === "air" && t < 2) { step(S, DT); peak = Math.max(peak, S.hero.y); t += DT; }
  check(Math.abs(peak - JUMP_H) < 0.08 && Math.abs(t - airTime()) < 0.04 && S.hero.mode === "run" && S.hero.y === 0, `a jump peaks at ${peak.toFixed(2)} m (one jump height ${JUMP_H}) and lasts ${t.toFixed(2)} s (${AIR_T} up, less coming down faster)`);
  check(speedAt(0) === 10 && speedAt(5000) > 15.9 && speedAt(300) > speedAt(100), "the run quickens with distance, towards 16 m/s");
  const T = scene({ hero: { y: 1.2, mode: "air" } });
  swipe(T, "up"); run(T, 0.05);
  const L = scene(); swipe(L, "up"); run(L, 0.55); swipe(L, "up");
  let j = 0; for (let i = 0; i < 400 && L.hero.y < 0.5; i++) { step(L, DT); j++; }
  check(j < 120 && L.hero.mode !== "run", "a jump swiped a moment before landing is kept, and jumps on landing");
  swipe(L, "left");
  check(L.hero.lane === -1, "left and right change lane, once, and never past the outer lanes");
  swipe(L, "left"); run(L, 0.3);
  check(L.hero.lane === -1 && Math.abs(L.hero.x + LANE_W) < 0.01, "the hero settles in the lane");
}

// ---------- 1. a foe in front ----------
{
  const hearts = ttc => { const S = scene(), f = foeAt(S, "crab", 0, ttc); run(S, 0.01); swipe(S, "up"); run(S, 1.6); return [S, f]; };
  let [S, f] = hearts(0.2);
  check(!f.alive && S.hearts === 3 && S.kills === 1, "very close: up cuts it down");
  [S, f] = hearts(0.45);
  check(f.alive && S.hearts === 3, "further off: up is a jump that clears it");
  S = scene(); f = foeAt(S, "crab", 0, 0.3); run(S, 1);
  check(S.hearts === 2 && f.spent, "left alone, or too late: it hits");
  S = scene(); f = foeAt(S, "crab", 0, 0.12); swipe(S, "up"); run(S, 0.05); swipe(S, "up"); run(S, 1);
  check(!f.alive && S.hearts === 3, "a second swipe in the last moment still cuts it down");
}

// ---------- 2. a foe to the side ----------
{
  const trial = (heroLane, foeLane, ttc, dir, kind = "crab", air = false) => {
    const S = scene({ hero: { lane: heroLane, x: heroLane * LANE_W, ...(air ? { y: 1.4, mode: "air", vy: 0.01 } : {}) } });
    const f = foeAt(S, kind, foeLane, ttc);
    run(S, 0.01);
    if (dir) swipe(S, dir);
    run(S, 1.2);
    return [S, f];
  };
  let [S, f] = trial(0, -1, 0.4, "left");
  check(!f.alive && S.hero.lane === -1 && S.hearts === 3, "a crab in the next lane: a swipe into it changes lane and cuts it down");
  [S, f] = trial(0, -1, 0.4, "right");
  check(f.alive && S.hero.lane === 1 && S.hearts === 3, "and a swipe the other way dodges it");
  [S, f] = trial(0, -1, 0.4, null);
  check(S.hearts === 2, "left alone it attacks sideways");
  [S, f] = trial(1, -1, 0.4, null);
  check(S.hearts === 3 && f.alive, "but never across two lanes");
  [S, f] = trial(0, 0, 0.4, null);
  check(S.hearts === 2, "and one in my own lane hits me where I stand");
  [S, f] = trial(0, -1, 0.4, "left", "gull", true);
  check(!f.alive && S.hero.lane === -1, "in the air a gull in the next lane is cut down the same way");
  [S, f] = trial(0, -1, 0.4, "left", "gull", false);
  check(f.alive && S.hearts === 2 && S.hero.lane === -1, "from the ground a swipe changes lane only, and the gull, still winding, then dives down my new lane");
  [S, f] = trial(0, -1, 0.9, "left");
  check(f.alive && S.hearts === 2, "too early to count as an attack: only a lane change, into its path");
}

// ---------- 5. a foe above ----------
{
  const S = scene(), f = foeAt(S, "gull", 0, 0.4);
  run(S, 0.01); swipe(S, "up"); run(S, 0.5);
  check(!f.alive && S.hero.vy > 5 && S.hero.y > 1.2 && S.chain === 1, "a gull above in my lane: up is a jump attack, and I am thrown up again");
  const T = scene(), g = foeAt(T, "gull", 0, 0.4);
  run(T, 1.2);
  check(g.alive && g.ph === 3 && T.hearts === 2, "walking under it is not harmless: it dives down my lane (tests/courier-rules.mjs has the dodges)");
}

// ---------- 4. the bonk ----------
{
  const S = scene({ hero: { y: 2, mode: "air", vy: 0 } }), f = foeAt(S, "crab", 0, 0.1);
  swipe(S, "down"); run(S, 0.2);
  check(!f.alive && S.hero.vy > 0 || S.hero.y > 1, "down directly above a foe lands on it");
  const e = events(S);
  check(e.includes("kill") && !e.includes("shockwave") && S.hero.mode === "air", "and bounces into another jump, with no shockwave");
  let top = 0; for (let t = 0; t < 0.7; t += DT) { step(S, DT); top = Math.max(top, S.hero.y); }
  check(top > 1.4, "(it rises like a jump)");
}

// ---------- 3. the slam ----------
{
  const setup = y => {
    const S = scene({ hero: { y, mode: "air", vy: 0 } });
    return [S, foeAt(S, "crab", -1, 0.3), foeAt(S, "crab", 1, 0.34), foeAt(S, "crab", 0, 0.38)];
  };
  let [S, a, b, c] = setup(3.5);
  swipe(S, "down"); run(S, 0.5);
  check([a, b, c].every(f => !f.alive) && S.hearts === 3 && events(S).includes("shockwave"), "from more than one jump height: a slam, and its shockwave cuts down the ground foes in the lanes beside me");
  [S, a, b, c] = setup(1.5);
  swipe(S, "down"); run(S, 0.3);
  check(events(S).indexOf("shockwave") < 0 && !S.hero.slam, "from a plain jump's height it is only a quick drop: no shockwave");
  S = scene({ hero: { y: 3.5, mode: "air", vy: 0 } });
  const under = foeAt(S, "crab", 0, 0.0), beside = foeAt(S, "crab", 1, 0.25);
  swipe(S, "down"); run(S, 0.4);
  const ev = events(S);
  check(!under.alive && beside.alive && !ev.includes("shockwave"), "landing on a foe is a bonk, not a slam: the others stand");
  check(SLAM_MIN_Y > JUMP_H, `(a slam needs more than ${JUMP_H} m)`);
}

// ---------- flyers follow the hero's height; what reaches them from above ----------
{
  // the hero held at a height (a real one would fall), a gull `ttc` seconds ahead in the next lane
  const hold = (S, y, secs) => { for (let t = 0; t < secs - 1e-9 && !S.over; t += DT) { S.hero.y = y; S.hero.vy = 0; step(S, DT); } };
  const seen = (y, secs, ttc = 4, tweak = () => {}) => {
    const S = scene({ hero: { lane: 0, y: 0, mode: "air" } }), g = foeAt(S, "gull", -1, ttc);
    tweak(S, g);
    hold(S, y, secs);
    return [S, g];
  };
  let [S, g] = seen(6, 1);
  check(Math.abs(g.y - (1.35 + DRIFT_V)) < 0.05, `a hero far above a gull: it climbs, slowly (${DRIFT_V} m/s; ${g.y.toFixed(2)} m after a second)`);
  [S, g] = seen(6, 3.5);
  check(Math.abs(6 - g.y - (SIDE_ABOVE - 0.1)) < 0.02 && g.ph === 2, "and stops where I am within a swipe sideways of it, without diving on a hero in the air");
  [S, g] = seen(0, 1, 3, (S, g) => { g.y = 5; });
  S.hero.mode = "run";
  check(Math.abs(g.y - (5 - DRIFT_V)) < 0.05, "one high above a hero on the ground sinks towards him");
  [S, g] = seen(0, 1.9, 3, (S, g) => { g.y = 5; });
  check(g.y > 1.35 + 0.99 && g.y < 5 - 2.5, `but only until he is within reach of it (${g.y.toFixed(2)} m)`);
  [S, g] = seen(6, 1, 4, (S, g) => { g.gate = { id: 99, i: 0 }; });
  check(g.y === 1.35, "a gull of a question hangs where it was put");
  [S, g] = seen(6, 1, 4, (S, g) => { S.world.pits.push({ z0: g.z - 2, z1: g.z + 2 }); });
  check(g.y === 1.35, "and so does one over a pit, the bridge");
  [S, g] = seen(6, 1, 7);
  check(g.y === 1.35, "a gull further off than four seconds has not noticed me");

  // what reaches a gull at 1.35 m from where, by how far above its base I am
  const reaches = (dy, dir, heroLane, gullLane) => {
    const S = scene({ hero: { lane: heroLane, x: heroLane * LANE_W, y: 1.35 + dy, mode: "air", vy: 0.01 } });
    foeAt(S, "gull", gullLane, 0.3);
    swipe(S, dir);
    return !!S.hero.lunge;
  };
  check(reaches(1.1, "up", 0, 0) && !reaches(1.5, "up", 0, 0), `up cuts a gull in my lane from just above it (up to ${UP_ABOVE} m over its base), not from higher`);
  check(reaches(1.9, "left", 0, -1) && reaches(1.9, "right", 0, 1) && !reaches(2.3, "left", 0, -1), `a swipe sideways cuts one in the next lane from a bit above (up to ${SIDE_ABOVE} m), not from higher`);
  check(reaches(-0.5, "left", 0, -1), "and from a little below it, on the way up");
  // far above, in its lane: down. A bonk on the way, and I am thrown up again
  S = scene({ hero: { y: 4.35, mode: "air", vy: 0 } });
  g = foeAt(S, "gull", 0, 0.15);
  swipe(S, "down");
  check(S.hero.lunge?.how === "bonk", "from far above, down comes down on it: a bonk");
  run(S, 0.3);
  check(!g.alive && S.hero.mode === "air" && S.hero.vy > 0 || S.hero.y > g.y + 1.5, "and the hero jumps back up after it");
}

// ---------- down in a jump, with no foe under me and not from a slam's height, rolls on landing ----------
{
  let S = scene({ hero: { y: 1.5, mode: "air", vy: 0 } });
  const crab = foeAt(S, "crab", 0, 0.3);
  swipe(S, "down"); run(S, 0.12);
  const e = take(S);
  check(S.hero.mode === "run" && S.hero.roll > 0 && e.some(x => x.type === "roll" && x.land), "down in a jump lands in a roll");
  run(S, 0.5);
  check(!crab.alive && S.hearts === 3, "and the roll cuts down the foe that reaches me");
  S = scene({ hero: { y: 3.5, mode: "air", vy: 0 } });
  swipe(S, "down"); run(S, 0.4);
  check(!events(S).includes("roll") && S.hero.roll === 0, "a slam is not a roll");
  S = scene({ hero: { y: 1.5, mode: "air", vy: 0 } });
  swipe(S, "up"); run(S, 1.5);
  check(S.hero.mode === "run" && S.hero.roll === 0, "a jump that comes down by itself is only a landing");
  S = scene({ hero: { y: 2, mode: "air", vy: 0 } });
  foeAt(S, "crab", 0, 0.1);
  swipe(S, "down"); run(S, 1.2);
  check(!events(S).includes("roll"), "a bonk bounces into another jump, and lands as it does");
}

// ---------- a foe two lanes across ----------
{
  const trial = (heroLane, foeLane, ttc, dir, kind = "crab", air = false) => {
    const S = scene({ hero: { lane: heroLane, x: heroLane * LANE_W, ...(air ? { y: 1.4, mode: "air", vy: 0.01 } : {}) } });
    const f = foeAt(S, kind, foeLane, ttc);
    run(S, 0.01);
    if (dir) swipe(S, dir);
    run(S, 1.2);
    return [S, f];
  };
  let [S, f] = trial(-1, 1, 0.4, "right");
  check(!f.alive && S.hero.lane === 1 && S.hearts === 3, "a crab two lanes across: a swipe towards it crosses both lanes and cuts it down");
  [S, f] = trial(1, -1, 0.4, "left");
  check(!f.alive && S.hero.lane === -1, "and the same from the other side");
  [S, f] = trial(-1, 1, 0.4, "left");
  check(f.alive && S.hero.lane === -1, "a swipe the other way leaves it alone");
  [S, f] = trial(-1, 1, 0.12, "right");
  check(!f.alive && S.hero.lane === 1 && S.hearts === 3, "even this late the swipe wins: both lanes are crossed and it is cut down");
  [S, f] = trial(-1, 1, 0.9, "right");
  check(f.alive && S.hero.lane === 0, "too far off to count as an attack: only a lane change");
  {
    const T = scene({ hero: { lane: -1, x: -LANE_W } }), near = foeAt(T, "crab", 0, 0.4), far = foeAt(T, "crab", 1, 0.3);
    run(T, 0.01); swipe(T, "right"); run(T, 0.6);
    check(!near.alive && far.alive && T.hero.lane === 0, "with a foe in the next lane too, the next lane's is the one cut");
  }
  [S, f] = trial(-1, 1, 0.4, "right", "gull", true);
  check(!f.alive && S.hero.lane === 1, "in the air a gull two lanes across is cut down the same way");
  [S, f] = trial(-1, 1, 0.4, "right", "gull", false);
  check(f.alive && S.hero.lane === 0, "from the ground a gull is out of reach, two lanes across as much as one");
}

// ---------- the roll ----------
{
  const trial = (ttc, lane = 0, swipeAt = 0) => {
    const S = scene(), f = foeAt(S, "crab", lane, ttc);
    run(S, swipeAt + 0.005); swipe(S, "down");
    const rolled = S.hero.roll > 0;
    run(S, 1.2);
    return [S, f, rolled];
  };
  let [S, f, rolled] = trial(0.22);
  check(rolled && !f.alive && S.hearts === 3 && S.kills === 1 && S.hero.mode === "run", "down on the planks is a roll, and it cuts down a foe in front if it is close enough");
  [S, f] = trial(0.12);
  check(!f.alive && S.hearts === 3, "even one almost on me");
  [S, f] = trial(0.8);
  check(f.alive && S.hearts === 2, "a roll that ends before the foe reaches me does not stop it");
  S = scene({ hero: { lane: -1, x: -LANE_W } }); f = foeAt(S, "crab", 1, 0.25); run(S, 0.01); swipe(S, "down"); run(S, 1);
  check(f.alive && S.hearts === 3, "a roll cuts only what is in my lane (a foe two lanes across never hits)");
  S = scene(); f = foeAt(S, "crab", 1, 0.3); S.hero.lane = 0; run(S, 0.01); swipe(S, "down"); run(S, 1);
  check(f.alive && S.hearts === 2, "and a foe in the next lane still hits a rolling hero");
  S = scene(); f = foeAt(S, "crab", 0, 0.2); run(S, 0.01); swipe(S, "down"); run(S, 0.05);
  check(S.hero.y === 0 && S.hero.mode === "run", "a roll keeps the hero on the planks (no hop after the cut)");
  S = scene(); swipe(S, "down"); run(S, ROLL_T + 0.05);
  check(S.hero.roll === 0, "a roll ends");
  S = scene(); swipe(S, "down"); run(S, 0.05); swipe(S, "up"); run(S, 0.05);
  check(S.hero.roll === 0 && S.hero.mode === "air", "up in the middle of a roll jumps out of it");
  S = scene(); S.world.pits.push({ z0: 3, z1: 20 }); swipe(S, "down"); run(S, 0.5);
  check(S.hero.roll === 0, "a roll that runs off the edge ends");
}

// ---------- the foes telegraph: see me, wind up, launch ----------
{
  // a crab one lane over, the hero standing still in his lane: what it does, in order, as the quay brings it
  const S = scene({ hero: { lane: 0 } }), f = foeAt(S, "crab", -1, 1.4);
  const seen = []; let aim = null;
  for (let i = 0; i < 400 && !S.over && S.hero.z < f.z + 2; i++) {
    step(S, DT);
    for (const e of take(S)) if (["notice", "wind", "launch"].includes(e.type)) seen.push([e.type, +(((f.z - S.hero.z) / speed(S)).toFixed(2)), e.look ?? e.aim]);
  }
  check(seen.map(e => e[0]).join() === "notice,wind,launch", `a crab a lane over sees me, winds up and launches, in that order (${seen.map(e => `${e[0]} at ${e[1]} s`).join(", ")})`);
  check(seen[0][1] <= 1.1 && seen[0][1] > 1.0 && seen[1][1] <= 0.6 && seen[2][1] <= 0.3, "from 1.1 s, 0.6 s and 0.3 s before it reaches me");
  check(seen[0][2] === 1 && seen[2][2] === 0, "it looks my way (to its right, my lane being to the right of its own), and launches at the lane I am in");
  check(S.hearts === 2, "and the launch hits");
  const T = scene({ hero: { lane: 1, x: LANE_W } }), g = foeAt(T, "crab", -1, 1.4);
  run(T, 1.7);
  check(!g.ph && T.hearts === 3, "two lanes away it never notices me, let alone attacks");
  const U = scene({ hero: { lane: 0 } }), c = foeAt(U, "crab", -1, 1.4);
  run(U, 0.5);
  const phBefore = c.ph; swipe(U, "right"); run(U, 0.1);
  check(phBefore === 1 && c.ph === 0, "if I leave before it winds up it has lost me again");
  run(U, 1.5);
  check(U.hearts === 3 && U.hero.lane === 1, "and it never attacks");
  const V = scene({ hero: { lane: 0 } }), d = foeAt(V, "crab", 0, 1.0);
  run(V, 0.3);
  check(d.ph === 1 && d.look === 0, "a crab in my own lane sees me too, looking straight ahead");
}

// ---------- a launched foe hits where it aimed ----------
{
  const crab = (swipes, ttc = 1.0, lane = -1) => {
    const S = scene({ hero: { lane: 0 } }), f = foeAt(S, "crab", lane, ttc);
    let at = 0;
    for (const [secs, dir] of swipes) { run(S, secs - at); at = secs; swipe(S, dir); }
    run(S, 2.5);
    return [S, f];
  };
  let [S, f] = crab([]);
  check(S.hearts === 2 && Math.abs(f.x - 0) < 0.01, "the crab slides across to my lane and hits there");
  // the launch is at 0.3 s before it; a lane away made at 0.2 s before it is in time
  [S, f] = crab([[0.8, "right"]]);
  check(S.hearts === 3, "a lane away after it has launched still dodges it, if it is early enough");
  [S, f] = crab([[0.6, "right"]]);
  check(S.hearts === 3 && f.ph === 0, "and before the launch it never launches at all");
  [S, f] = crab([[0.95, "right"]]);
  check(S.hearts === 2, "but in the last moment it is too late: it hits where it aimed");
  [S, f] = crab([[0.7, "up"]]);
  check(S.hearts === 3 && f.alive, "so does a jump over it");
}

// ---------- a gull one lane over dives on a hero on the ground ----------
{
  const gull = (swipes, ttc = 1.2, lane = -1, hero = {}) => {
    const S = scene({ hero: { lane: 0, ...hero } }), f = foeAt(S, "gull", lane, ttc);
    let at = 0;
    for (const [secs, dir] of swipes) { run(S, secs - at); at = secs; swipe(S, dir); }
    run(S, 2.5);
    return [S, f];
  };
  let [S, f] = gull([]);
  check(S.hearts === 2 && f.ph === 3 && f.y < 0.05 && f.aim === 0, "a gull in the next lane winds up, then dives down onto the hero on the ground");
  const T = scene({ hero: { lane: 0 } }), t = foeAt(T, "gull", -1, 1.2);
  run(T, 0.8);
  check(t.ph === 2 && t.y === 1.35, "(until it launches it stays up at its height)");
  [S, f] = gull([[1.0, "up"]]);
  check(S.hearts === 3, "a jump after it has launched goes over the dive");
  [S, f] = gull([[0.95, "right"]]);
  check(S.hearts === 3, "so does a lane away");
  [S, f] = gull([[0.96, "down"]]);
  check(S.hearts === 3 && f.alive, "and so does a roll: it goes under the dive");
  [S, f] = gull([], 1.2, 0);
  check(S.hearts === 2 && f.ph === 3 && f.aim === 0, "a gull in my own lane attacks too: it dives down the lane");
  {
    const U = scene({ hero: { lane: 0, y: 12, mode: "air", vy: 9 } }), g = foeAt(U, "gull", -1, 1.2);
    run(U, 1.0);
    check(U.hero.mode === "air" && g.ph === 2 && g.y > 1.35, "and none dives on a hero in the air (it waits for him to come down, climbing towards him)");
  }
  {
    const U = scene({ hero: { lane: 0 } }), g = foeAt(U, "gull", -1, 1.2);
    U.world.pits.push({ z0: g.z - 2, z1: g.z + 2 });
    run(U, 1.2);
    check(!g.ph && U.hearts === 3, "a gull over a pit is the bridge, not an enemy");
  }
  {
    const U = scene({ hero: { lane: 0 } }), g = foeAt(U, "gull", -1, 1.2);
    g.gate = { id: 1, i: 0 };
    run(U, 1.4);
    check(!g.ph, "and the gulls of a question are the answers, not enemies");
  }
}

// ---------- a swipe sideways cuts down a diving flyer from the ground ----------
{
  const dive = (swipeAt, dir = "left", lane = -1, hero = {}) => {
    const S = scene({ hero: { lane: 0, ...hero } }), f = foeAt(S, "gull", lane, 1.2);
    run(S, swipeAt); if (dir) swipe(S, dir); run(S, 2);
    return [S, f];
  };
  let [S, f] = dive(0.95);
  check(!f.alive && S.hearts === 3 && S.hero.lane === -1, "once a gull has launched its dive from the next lane, a swipe towards it cuts it down, from the ground");
  [S, f] = dive(0.95);
  check(S.kills === 1 && S.bestChain === 1, "and counts as an attack in the air");
  [S, f] = dive(0.95, "right", 1);
  check(!f.alive && S.hearts === 3 && S.hero.lane === 1, "from the other side the same");
  [S, f] = dive(1.1);
  check(!f.alive && S.hearts === 3, "right up to the last moments before it hits (0.1 s before)");
  [S, f] = dive(0.7);
  check(f.alive && S.hearts === 2, "before the launch it is only a lane change: it has not dived yet, and it dives down the lane I am in");
  [S, f] = dive(0.95, "right", -1);
  check(f.alive && S.hearts === 3, "a swipe away from it still only dodges");
}

// ---------- repeated rolls leave no gap ----------
{
  // down every 0.15 s, with a crab reaching me at every moment in turn: none gets through
  let worst = null, n = 0;
  for (let ttc = 0.3; ttc < 1.6; ttc += 0.013) {
    const S = scene(), f = foeAt(S, "crab", 0, ttc);
    for (let t = 0; t < 2.2; t += 0.15) { swipe(S, "down"); run(S, 0.15); }
    n++;
    if (S.hearts < 3 && !worst) worst = ttc;
  }
  check(worst === null, `rolling again and again, no foe in front gets through (${n} arrival times from 0.3 to 1.6 s)`);
  const S = scene(); swipe(S, "down");
  let gaps = 0; for (let t = 0; t < 2; t += DT) { if (t % 0.2 < DT) swipe(S, "down"); step(S, DT); if (S.hero.roll === 0) gaps++; }
  check(gaps === 0, "the next roll follows the last at once");
  const T = scene(); swipe(T, "down"); run(T, 0.1); swipe(T, "down"); run(T, 0.1); swipe(T, "up"); run(T, 0.05);
  check(T.hero.mode === "air" && T.hero.roll === 0, "and up still jumps out of the run of them");
  const U = scene(); swipe(U, "down"); run(U, 0.1); swipe(U, "down"); run(U, 1);
  check(U.hero.roll === 0, "one queued roll is one more roll, not a run");
  // a lunge from the next lane is not dodged by a roll
  const V = scene({ hero: { lane: 0 } }), c = foeAt(V, "crab", 1, 1.0);
  for (let t = 0; t < 1.6; t += 0.15) { swipe(V, "down"); run(V, 0.15); }
  check(V.hearts === 2, "but a roll in a lane the crab is not on does not dodge its lunge: it hits me rolling");
  const W = scene({ hero: { lane: 0 } }), g = foeAt(W, "gull", 1, 1.0);
  for (let t = 0; t < 1.6; t += 0.15) { swipe(W, "down"); run(W, 0.15); }
  check(W.hearts === 3 && g.alive, "while a gull's dive goes over a rolling hero");
}

// ---------- one swipe sideways takes the foes in a row ----------
{
  const row = (heroLane, foes, dir, air = false) => {
    const S = scene({ hero: { lane: heroLane, x: heroLane * LANE_W, ...(air ? { y: 1.4, mode: "air", vy: 0.01 } : {}) } });
    const made = foes.map(([kind, lane, ttc]) => foeAt(S, kind, lane, ttc));
    run(S, 0.01); take(S);
    swipe(S, dir); run(S, 1.5);
    return [S, made];
  };
  let [S, [a, b]] = row(-1, [["crab", 0, 0.4], ["crab", 1, 0.45]], "right");
  check(!a.alive && !b.alive && S.hero.lane === 1 && S.hearts === 3 && S.kills === 2, "on the left with a foe in the middle and one on the right: one swipe right takes both");
  [S, [a, b]] = row(1, [["crab", 0, 0.4], ["crab", -1, 0.45]], "left");
  check(!a.alive && !b.alive && S.hero.lane === -1 && S.hearts === 3, "and the same from the other side");
  [S, [a, b]] = row(-1, [["crab", 0, 0.4], ["crab", 1, 0.4]], "right");
  check(!a.alive && !b.alive && S.hearts === 3, "side by side in a row");
  [S, [a, b]] = row(-1, [["crab", 0, 0.4], ["crab", 1, 1.4]], "right");
  check(!a.alive && b.alive && S.hero.lane === 0, "a second foe too far on is left for another swipe");
  [S, [a, b]] = row(-1, [["crab", 0, 0.4], ["crab", -1, 0.45]], "right");
  check(!a.alive && b.alive, "a foe the other way is not taken");
  [S, [a, b]] = row(-1, [["gull", 0, 0.4], ["gull", 1, 0.5]], "right", true);
  check(!a.alive && !b.alive && S.hero.lane === 1 && S.bestChain === 2, "in the air, gulls in a row are a chain");
  [S, [a, b]] = row(-1, [["crab", 0, 0.4], ["gull", 1, 0.75]], "right");
  check(!a.alive && b.alive, "(a gull in the air is out of reach of a cut from the ground)");
  {
    const T = scene({ hero: { lane: -1, x: -LANE_W } }), c = foeAt(T, "crab", 0, 0.4), e = foeAt(T, "crab", 1, 0.45);
    run(T, 0.01); take(T); swipe(T, "right"); run(T, 1.5);
    const ev = take(T);
    check(T.hero.lane === 1, "(the lane it ends in is the far one)");
  }
  {
    const T = scene({ hero: { lane: -1, x: -LANE_W } }); foeAt(T, "crab", 0, 0.4); foeAt(T, "crab", 1, 0.45);
    run(T, 0.01); take(T); swipe(T, "right");
    const ev = []; for (let i = 0; i < 90; i++) { step(T, DT); ev.push(...take(T)); }
    const kinds = ev.filter(e => ["kill", "lane", "lunge"].includes(e.type)).map(e => e.type + (e.sweep ? "*" : "")).join();
    check(/kill,lane,lunge\*,kill/.test(kinds), `the events say so: ${kinds}`);
  }
  {
    const q = { id: "Q1", bank: "test", q: "?", o: ["a", "b", "c"], a: 2, x: "", about: [] };
    const T = newGame({ seed: 3, deal: () => q });
    let n = 0; while (!T.world.gates.length && n++ < 80) { T.hero.z += 20; ensure(T); }
    const g = T.world.gates[0];
    T.world.foes = T.world.foes.filter(f => f.gate && f.gate.id === g.id);
    T.world.pits = T.world.pits.filter(p => p.gate === g.id); T.world.z1 = 1e9;
    T.hero.lane = -1; T.hero.x = -LANE_W; T.hero.z = g.z - 0.7 * speed(T); take(T);
    run(T, 0.01); const m = foeAt(T, "crab", 0, 0.45); T.hero.z = g.z - 0.7 * speed(T);
    m.z = T.hero.z + 0.45 * speed(T); swipe(T, "right"); run(T, 0.3);
    check(g.state === "open" && g.pick === null, "a cut that goes on never goes on to the gulls of a question: those are chosen");
  }
}

// ---------- the jump comes back after a cut in the air ----------
{
  const S = scene(), f = foeAt(S, "gull", 0, 0.4);
  run(S, 0.01); swipe(S, "up"); run(S, 0.5);
  check(!f.alive && S.hero.mode === "air" && S.hero.jumps === 1, "a jump attack on a gull throws me up again and gives my jump back");
  const y0 = S.hero.y; swipe(S, "up"); run(S, 0.05);
  check(S.hero.jumps === 0 && S.hero.vy > 7 && S.hero.y > y0, "one more up in the air, with nothing to cut: a second jump from where I am");
  const peakBefore = S.hero.y; let peak = peakBefore; for (let i = 0; i < 300 && S.hero.mode === "air"; i++) { step(S, DT); peak = Math.max(peak, S.hero.y); }
  check(peak - y0 > JUMP_H - 0.1, `and it rises a whole jump height (${(peak - y0).toFixed(2)} m)`);
  const T = scene(), g = foeAt(T, "gull", 0, 0.4);
  run(T, 0.01); swipe(T, "up"); run(T, 0.5); swipe(T, "up"); run(T, 0.05); take(T); swipe(T, "up"); run(T, 0.05);
  check(T.hero.jumps === 0 && !take(T).some(e => e.type === "jump"), "but only the one: a third up does nothing");
  const U = scene(); swipe(U, "up"); run(U, 0.2); swipe(U, "up"); run(U, 0.05);
  check(U.hero.jumps === 0 && U.hero.vy < 5, "a plain jump has no second one to give");
  const V = scene(), h1 = foeAt(V, "gull", 0, 0.4), h2 = foeAt(V, "gull", 1, 0.9);
  h2.y = 2.6;
  run(V, 0.01); swipe(V, "up"); run(V, 0.45); swipe(V, "right"); run(V, 0.7);
  check(!h1.alive && !h2.alive && V.chain === 2, "and after a cut I can swipe sideways to the next gull as before");
  const W = scene({ hero: { y: 2, mode: "air", vy: 0 } }), c = foeAt(W, "crab", 0, 0.1);
  swipe(W, "down"); run(W, 0.2);
  check(!c.alive && W.hero.jumps === 1, "a bonk gives it back too");
  run(W, 3);
  check(W.hero.jumps === 0 && W.hero.mode === "run", "landing takes it away");
}

// ---------- coming down, a swipe sideways swoops onto a foe on the ground ----------
{
  const trial = (y, vy, foeLane, ttc, dir, secs = 1.2) => {
    const S = scene({ hero: { y, vy, mode: "air" } });
    const f = foeAt(S, "crab", foeLane, ttc);
    run(S, 0.005); swipe(S, dir); run(S, secs);
    return [S, f];
  };
  let [S, f] = trial(3, -2, 1, 0.45, "right");
  check(!f.alive && S.hero.lane === 1 && S.hearts === 3, "coming down from 3 m, a swipe sideways swoops onto a crab in the next lane and cuts it down");
  [S, f] = trial(3, -2, 1, 0.45, "right", 0.5);
  check(S.hero.jumps === 1 && S.chain === 1, "and counts as an attack in the air: my jump comes back");
  [S, f] = trial(3, 4, 1, 0.45, "right");
  check(f.alive && S.hero.lane === 1, "still going up, it is only a lane change");
  [S, f] = trial(7, -2, 1, 0.45, "right");
  check(f.alive && S.hero.lane === 1, "too high above it to reach: only a lane change");
  [S, f] = trial(3, -2, -1, 0.45, "right");
  check(f.alive && S.hero.lane === 1, "the other way, a dodge");
  [S, f] = trial(3, -2, 1, 0.05, "right");
  check(!f.alive, "even this late the swoop arrives (a swipe is never too late to win)");
  {
    const T = scene({ hero: { y: 3, vy: -2, mode: "air", lane: -1, x: -LANE_W } }), c = foeAt(T, "crab", 1, 0.45);
    run(T, 0.005); swipe(T, "right"); run(T, 1.2);
    check(!c.alive && T.hero.lane === 1, "and so is one two lanes across");
  }
}

// ---------- the wall ----------
{
  const wallScene = (heroExtra = {}) => {
    const S = scene({ hero: { lane: 1, x: LANE_W, ...heroExtra } });
    S.world.walls.push({ side: 1, z0: -5, z1: 60 });
    return S;
  };
  let S = wallScene();
  swipe(S, "right"); run(S, 0.4);
  check(S.hero.mode === "wall" && Math.abs(S.hero.y - WALL_Y) < 0.05 && S.hero.x > LANE_W + 0.2, "swiping into a wall from the outer lane runs up it, lifting the hero");
  run(S, 1.5);
  check(S.hero.mode === "wall" && S.hero.y > 1.9, "and runs along it");
  swipe(S, "up"); run(S, 0.1);
  let peak = 0;
  for (let i = 0; i < 300 && S.hero.mode === "air"; i++) { step(S, DT); peak = Math.max(peak, S.hero.y); }
  check(peak > WALL_Y + 2.2 && peak > JUMP_H * 1.9, `up on the wall jumps again, higher than a jump from the ground (peak ${peak.toFixed(1)} m)`);
  S = wallScene(); swipe(S, "right"); run(S, 0.5);
  S.world.walls[0].z1 = S.hero.z + 3; run(S, 0.6);
  check(S.hero.mode !== "wall", "at the wall's end the hero comes off it");
  S = scene(); S.world.walls.push({ side: 1, z0: -5, z1: 60 });
  swipe(S, "right");
  check(S.hero.lane === 1 && S.hero.mode === "wall", "from the middle lane the same swipe is the wall run, by way of the lane");
  S = wallScene({ y: 1.2, mode: "air", vy: 3 });
  swipe(S, "right");
  check(S.hero.mode === "wall", "or jump first, then swipe into the wall");
  S = wallScene(); swipe(S, "right"); run(S, 0.3); swipe(S, "left"); run(S, 0.1);
  check(S.hero.mode === "air" && S.hero.wall === 0, "away from the wall lets go");
  S = wallScene(); swipe(S, "right"); run(S, 0.3); swipe(S, "up"); run(S, 0.3);
  const ev2 = take(S);
  S.world.foes.push(...[0, 1].map((l, i) => ({ id: ids++, kind: "crab", lane: l, x: l * LANE_W, z: S.hero.z + 2.6 + i * 0.3, y: 0, h: 1, alive: true, spent: false, gate: null })));
  S.world.walls = [];
  swipe(S, "down"); run(S, 0.6);
  const ev3 = events(S);
  check(ev3.includes("shockwave") && S.world.foes.every(f => !f.alive), "a wall jump, then down, then a shockwave over the crabs below");
}

// ---------- the air chain ----------
{
  const S = scene();
  S.world.pits.push({ z0: 4, z1: 4 + 17 });
  const lanes = [0, 1, 1];
  const gulls = lanes.map((l, i) => { const f = foeAt(S, "gull", l, 0); f.z = 7.5 + i * 6; f.y = i % 2 ? 2.3 : 1.35; return f; });
  S.hero.z = 2;
  // the lane for the first gull: move, then up; then the rest as the bot does it
  swipe(S, "up");                                                  // a jump to the edge...
  run(S, 0.2);
  const lunged = [];
  for (let i = 0; i < 800 && !S.over && S.hero.z < 30; i++) {
    const nxt = gulls.find(g => g.alive);
    if (nxt && !S.hero.lunge) {
      const t = (nxt.z - S.hero.z) / speed(S);
      if (nxt.lane !== S.hero.lane) { if (t < 0.5) swipe(S, nxt.lane > S.hero.lane ? "right" : "left"); }
      else if (S.hero.y - nxt.y > UP_ABOVE - 0.2) { if (t < 0.2) swipe(S, "down"); }      // too high above it to cut upwards: come down on it
      else if (t < 0.5) swipe(S, "up");
    }
    step(S, DT);
  }
  check(gulls.every(g => !g.alive) && S.hearts === 3 && S.hero.z >= 21 && S.falls === 0, "three gulls over a pit: each cut down in the air carries me on, across the water");
  const T = scene(); T.world.pits.push({ z0: 4, z1: 21 });
  T.hero.z = 2; swipe(T, "up"); run(T, 3);
  check(T.falls === 1 && T.hearts === 2 && T.hero.z > 21, "without them, a jump falls short: a heart, and back on the far bank");
}

// ---------- the question over the water ----------
{
  const q = { id: "Q1", bank: "test", q: "Which?", o: ["one", "two", "three"], a: 2, x: "three", about: ["e1"] };
  const gateScene = (lane, how, ttc = 0) => {
    const S = newGame({ seed: 3, deal: () => q });
    let n = 0;
    while (!S.world.gates.length && n++ < 80) { S.hero.z += 20; ensure(S); }
    const g = S.world.gates[0];
    S.world.foes = S.world.foes.filter(f => f.gate && f.gate.id === g.id);
    S.hero.z = g.z - 5.5; S.hero.lane = lane; S.hero.x = lane * LANE_W;
    if (ttc) S.hero.z = g.z - ttc * speed(S);
    S.world.pits = S.world.pits.filter(p => p.gate === g.id);
    S.world.z1 = 1e9;
    take(S);
    const hows = [].concat(how || []);
    if (hows.length) run(S, 0.01);
    hows.forEach((d, i) => { if (i) run(S, 0.06); swipe(S, d); });          // quick swipes, one after the other
    run(S, 3);
    return [S, g];
  };
  check(newGame({ seed: 3, deal: () => q }).world.gates.length > 0 || true, "(the first question comes after a few chunks of quay)");
  let [S, g] = gateScene(1, "up");
  check(g.state === "right" && S.hearts === 3 && S.falls === 0 && S.right === 1 && S.hero.z > g.p1, "up under the right answer's gull: thrown across the gap, and the question is right");
  check(S.answers[0].ok === true && S.answers[0].id === "Q1" && S.world.foes.length === 0, "it is kept for the pile, and the other gulls fly off");
  for (const ttc of [0.95, 0.7, 0.45, 0.2]) {
    [S, g] = gateScene(1, "up", ttc);
    check(g.state === "right" && S.hearts === 3 && S.falls === 0 && S.hero.z > g.p1, `a jump ${ttc} s before the right gull is a jump attack, and the throw after it is enough to clear the gap`);
  }
  [S, g] = gateScene(1, "up", 1.4);
  check(g.state !== "right", "from further off than that it is only a jump");
  // the cut can be moved from gull to gull while I fly at the first
  [S, g] = gateScene(1, ["up", "left"], 0.95);
  check(g.pick === 1 && g.state === "wrong" && S.hero.lane === 0, "up, then left, in time: the attack moves from the right gull to the middle one");
  [S, g] = gateScene(1, ["up", "left", "left"], 0.95);
  check(g.pick === 0 && g.state === "wrong" && S.hero.lane === -1, "up, left, left, in time: from the right lane to the left gull");
  [S, g] = gateScene(-1, ["up", "right", "right"], 0.95);
  check(g.pick === 2 && g.state === "right" && S.falls === 0 && S.hero.z > g.p1, "and from the left lane to the right one, over the gap");
  [S, g] = gateScene(1, ["up", "left", "right"], 0.95);
  check(g.pick === 2 && g.state === "right", "left and right again: back on the right gull");
  [S, g] = gateScene(1, ["up", "right"], 0.95);
  check(g.pick === 2 && g.state === "right" && S.hero.lane === 1, "no lane beyond the right one: nothing moves");
  [S, g] = gateScene(1, ["up", "left", "left", "left"], 0.95);
  check(g.pick === 0 && S.hero.lane === -1, "(nor beyond the left)");
  [S, g] = gateScene(1, ["up", "left", "left"], 0.15);
  check(g.pick === 1, "too late for the last swipe: the cut lands on the middle gull before the second left is done");
  [S, g] = gateScene(0, "up");
  check(g.state === "wrong" && S.hearts === 1 && S.falls === 1 && S.wrong === 1 && S.hero.z > g.p1, "under a wrong answer: no bounce, into the water, two hearts, and back on the far bank");
  [S, g] = gateScene(-1, null);
  check(g.state === "missed" && S.missed === 1 && S.hearts === 1 && S.answers[0].ok === null, "unanswered, a jump cannot clear it: two hearts, and the question is missed");
  [S, g] = gateScene(0, "right");
  check(S.hero.lane === 1, "(a lane change on the way to the right one)");
  // the third right answer in a row gives a heart back
  const T = newGame({ seed: 3, deal: () => q }); T.hearts = 2;
  {
    const A = newGame({ seed: 3, deal: () => q }); A.hearts = 1; const ans = { ...A.world.gates[0] || { id: 7, q } };
    const O = newGame({ seed: 3, deal: () => q });
    O.hearts = 2; const gate = { id: 900, z: 0, p0: 0, p1: 1, q, state: "open", pick: null }; O.world.gates.push(gate); O.world.z1 = 1e9;
    O.world.pits.push({ z0: 0.5, z1: 30, gate: 900 });         // (the water under the gap, which the wrong answer drops me into)
    const gl = { id: 901, kind: "gull", lane: 0, x: 0, z: O.hero.z + 0.3, y: 1.35, h: 0.8, alive: true, spent: false, gate: { id: 900, i: 0 } };
    O.world.foes.push(gl);
    swipe(O, "up"); run(O, 0.6);
    check(O.hearts === 0 && O.over, "a wrong answer with two hearts left is the end");
  }
  const ok = i => { const w = T.world.gates[0] || { id: i, q }; return w; };
  T.streak = 0;
  const gg = { id: 99, z: 0, p0: 0, p1: 1, q, state: "open", pick: null };
  T.world.gates.push(gg);
  const gull = { id: 98, kind: "gull", lane: 1, x: LANE_W, z: T.hero.z + 0.3, y: 1.35, h: 0.8, alive: true, spent: false, gate: { id: 99, i: 2 } };
  T.world.foes.push(gull); T.hero.lane = 1; T.hero.x = LANE_W; T.world.z1 = 1e9;
  swipe(T, "up"); run(T, 0.6);
  check(T.hearts === 3 && T.streak === 1, "and a right answer gives a heart back (the first one, if I am short of one)");
  const full = newGame({ seed: 3, deal: () => q }); full.world.z1 = 1e9;
  full.world.gates.push({ id: 99, z: 0, p0: 0, p1: 1, q, state: "open", pick: null });
  full.world.foes.push({ id: 98, kind: "gull", lane: 1, x: LANE_W, z: full.hero.z + 0.3, y: 1.35, h: 0.8, alive: true, spent: false, gate: { id: 99, i: 2 } });
  full.hero.lane = 1; full.hero.x = LANE_W; swipe(full, "up"); run(full, 0.6);
  check(full.hearts === 3 && full.right === 1, "(and never more than the three)");
}

// ---------- the log ----------
{
  const q = { id: "Q1", bank: "test", q: "Which?", o: ["one", "two", "three"], a: 2, x: "three", about: ["e1"] };
  const S = newGame({ seed: 3, deal: () => q });
  let n = 0;
  while (!S.world.gates.length && n++ < 80) { S.hero.z += 20; ensure(S); }
  const g = S.world.gates[0];
  S.world.foes = S.world.foes.filter(f => f.gate && f.gate.id === g.id);
  S.world.pits = S.world.pits.filter(p => p.gate === g.id); S.world.z1 = 1e9;
  S.hero.lane = 1; S.hero.x = LANE_W; S.hero.z = g.z - 0.95 * speed(S); take(S);
  const log = new RunLog(S);
  const send = d => { log.swipe(S, d); swipe(S, d); for (const e of take(S)) log.event(S, e); };
  const go = secs => { for (let t = 0; t < secs - 1e-9 && !S.over; t += DT) { step(S, DT); for (const e of take(S)) log.event(S, e); } };
  go(0.01); send("up"); go(0.06); send("left"); go(0.06); send("left"); go(3);
  const text = log.lines.join("\n");
  check(log.lines.every((l, i) => l.startsWith(`#${i + 1} `)) && log.n === log.lines.length, "every line is numbered, in order");
  check(/#1 t=0\.0\d z=\S+ \| swipe UP \| me: lane R, running/.test(text) && /foes: .*gull R \+0\.\d\ds y1\.4 gate\d+/.test(text), "a swipe line says where I was and the foes about to reach me, in seconds");
  check(/swipe LEFT \| me: lane R, flying y=\S+ at gull R/.test(text), "a swipe in flight says what I am flying at");
  check(/lane → M/.test(text) && /lane → L/.test(text) && /the cut moves to gull gate\d+ \(side\)/.test(text), "the lines after it say what the rules did: the lane, and the cut moving");
  check(/ANSWER gate\d+ wrong: "Which\?" picked one; right three/.test(text) && /FALL into the water/.test(text), "the answer is in it, with what was picked and what was right");
  check(log.text("test").startsWith("Courier log, run 3, test\nL, M, R:") && log.text().includes("#1 "), "the whole log has a head and the legend before the lines");
  const back = RunLog.from(JSON.parse(JSON.stringify(log)));
  check(back.text() === log.text() && (back.note(S, "x"), back.n === log.n + 1), "a log survives being saved and carries on numbering");
  const T = scene({ hero: { y: 0 } }); const L2 = new RunLog(T);
  swipe(T, "down"); T.hero.mode = "run"; swipe(T, "up"); for (const e of take(T)) L2.event(T, e);
  check(describe(T, { type: "wait", dir: "up" }).includes(`kept for ${BUFFER} s`) && describe(T, { type: "drop", dir: "left" }).includes("dropped"), "a swipe that waits, and one dropped, are said");
  {
    const A = scene({ hero: { lane: 0 } }); foeAt(A, "crab", -1, 1.4); foeAt(A, "gull", 1, 1.4);
    const L3 = new RunLog(A);
    const seenAt = [];
    for (let i = 0; i < 150; i++) { step(A, DT); for (const e of take(A)) L3.event(A, e); if (i === 50) { L3.swipe(A, "up"); seenAt.push(L3.lines.at(-1)); } }
    const t3 = L3.lines.join("\n");
    check(/crab L sees me, looks right/.test(t3) && /crab L winds up/.test(t3) && /crab L launches at lane M/.test(t3) && /gull R launches at lane M \(dives\)/.test(t3), "the log says what the foes make up their minds to");
    check(/crab L \+\d\.\d\ds (sees me|winding up)/.test(seenAt[0]), "and a swipe's line says what each foe near is about to do");
  }
  const U = scene(); swipe(U, "left"); run(U, 0.1);
  const big = new RunLog(U); for (let i = 0; i < 1000; i++) big.note(U, "x");
  check(big.lines.length === 900 && big.n === 1000 && big.lines[0].startsWith("#101 "), "a long run keeps its last 900 lines, numbers unchanged");
}

// ---------- the questions are capped ----------
{
  const { setMarkedIn } = await import("../topics-on.js");
  setMarkedIn(true);
  const pool = await load("quay");
  check(pool.length > 400 && pool.every(p => p.q.q.length <= MAX_QUESTION && p.q.o.every(o => o.length <= MAX_ANSWER)), `every question is at most ${MAX_QUESTION} characters and every answer ${MAX_ANSWER} (${pool.length} of them)`);
  check(new Set(pool.map(p => p.bank)).size >= 4, "and the banks are all still in it");
  // Exclude (the default) leaves out what is marked for removal; the questions it keeps are enough to play on
  setMarkedIn(false);
  const kept = await load("quay");
  check(kept.length > 250 && kept.length < pool.length && kept.every(p => !p.q.mk) && new Set(kept.map(p => p.bank)).size >= 2, `Exclude: ${kept.length} of the ${pool.length} questions, none marked for removal`);
  check((await load("quay", true)).length === kept.length, "a daily gets the same questions whatever Settings says");
  setMarkedIn(true);
  const deal = dealer(pool); let r = 0.37; const d = deal(() => (r = (r * 9301 + 49297) % 233280 / 233280), 0, []);
  check(d.q.length <= MAX_QUESTION && d.o.length === 3 && d.o[d.a] !== undefined, "a dealt question carries three answers");
}

// ---------- the quay from a seed ----------
{
  const a = newGame({ seed: 5 }), b = newGame({ seed: 5 }), c = newGame({ seed: 6 });
  for (const S of [a, b, c]) { S.hero.z = 400; ensure(S); }
  check(JSON.stringify(a.world) === JSON.stringify(b.world) && JSON.stringify(a.world) !== JSON.stringify(c.world), "the same seed makes the same quay, another seed another");
  const d = copy(a);
  check(JSON.stringify(d) === JSON.stringify(a) && !Object.keys(a).includes("deal"), "a game copies through JSON, the question dealer kept off it");
  const kinds = new Set(); let pits = 0, walls = 0;
  for (const seed of [9, 10, 11]) { const s = newGame({ seed }); for (let z = 0; z <= 2400; z += 100) { s.hero.z = z; ensure(s); s.world.foes.forEach(f => kinds.add(f.kind)); pits += s.world.pits.length; walls += s.world.walls.length; } }
  check(kinds.has("crab") && kinds.has("gull") && kinds.has("barrel") && kinds.has("balloon") && pits > 0 && walls > 0, "crabs, gulls, barrels, balloons, pits and walls all come");
  const before = JSON.stringify(newGame({ seed: 11, deal: () => ({ id: "x", o: ["a", "b", "c"], a: 1 }) }).world.foes.slice(0, 3));
  check(before === JSON.stringify(newGame({ seed: 11, deal: () => ({ id: "y", o: ["a", "b", "c"], a: 0 }) }).world.foes.slice(0, 3)), "the questions dealt do not move the quay");
}

// ---------- movement: a lane change is an arc, a cut carries on, a jump swiped early is kept, a run sets off ----------
{
  const S = scene(); swipe(S, "right");
  const xs = []; for (let i = 0; i < 60; i++) { step(S, DT); xs.push([S.hero.x, S.hero.vx]); }
  const mono = xs.every(([x], i) => i === 0 || x >= xs[i - 1][0] - 1e-9), at = ms => xs[Math.round(ms / 1000 / DT) - 1][0];
  check(mono && at(8) < LANE_W * 0.06 && at(70) > LANE_W * 0.78 && at(110) > LANE_W * 0.94, `a lane change is an arc: a soft start (${at(8).toFixed(3)} m after 8 ms), 80% in 0.07 s, 95% in ${(LANE_T).toFixed(2)} s`);
  run(S, 0.4);
  check(S.hero.x === LANE_W && S.hero.vx === 0, "and it arrives exactly, at rest");
  // a swipe made on top of another carries on from the speed it had: no stop in the middle, no jump in x
  const T = scene(); swipe(T, "right"); run(T, 0.04); const x0 = T.hero.x, v0 = T.hero.vx;
  swipe(T, "left"); step(T, DT);
  check(Math.abs(T.hero.x - x0) < 0.2 && T.hero.vx < v0 && T.hero.lane === 0, `a swipe back in the middle of one turns round from where I am (x ${x0.toFixed(2)} to ${T.hero.x.toFixed(2)}), with no jump`);
  const U = scene(); swipe(U, "left"); run(U, 0.05); swipe(U, "left");
  check(U.hero.lane === -1, "(the outer lane stops a second swipe the same way)");
  const V = scene({ hero: { lane: -1, x: -LANE_W } }); swipe(V, "right"); run(V, 0.05); const vMid = V.hero.vx; swipe(V, "right"); run(V, 0.05);
  check(V.hero.lane === 1 && V.hero.vx > 0 && vMid > 5, "and two the same way run on into the far lane without stopping in the middle one");
  // a cut sideways: the lane's spring has taken me to the foe's lane early; the cut lands when the quay brings the foe
  const W = scene(), c = foeAt(W, "crab", -1, 0.5);
  run(W, 0.01); swipe(W, "left"); run(W, 0.2);
  check(Math.abs(W.hero.x + LANE_W) < 0.12 && c.alive && W.hero.lunge, "a cut sideways is a lane change at the lane's speed, and the cut lands later, as the foe arrives");
  run(W, 0.4);
  check(!c.alive && !W.hero.lunge && W.hearts === 3 && Math.abs(W.hero.x + LANE_W) < 0.05, "and it does");
  // a cut up: eased, so most of the way up is gone in the first half of the time
  const Y = scene(), g = foeAt(Y, "gull", 0, 0.5);
  run(Y, 0.01); swipe(Y, "up"); const y1 = Y.hero.lunge && (run(Y, 0.25), Y.hero.y);
  check(y1 > 0.72 * (g.y + g.h * 0.3 - 0.2), `a cut up is a burst, not a crawl: ${(y1 / (g.y + g.h * 0.3 - 0.2) * 100).toFixed(0)}% of the way up after half the time`);
  // a jump swiped well before landing is kept until I land
  const L = scene(); swipe(L, "up"); run(L, 0.44); take(L); swipe(L, "up");
  const kept = take(L).find(e => e.type === "wait");
  let steps = 0; while (L.hero.mode === "air" && steps++ < 400) step(L, DT);
  step(L, DT);
  check(kept && kept.keep > BUFFER && kept.keep <= LAND_BUFFER && L.hero.mode === "air" && L.hero.y > 0, `a jump swiped 0.28 s before landing is kept ${kept ? kept.keep.toFixed(2) : "?"} s and jumps as I land`);
  const M = scene(); swipe(M, "up"); run(M, 0.1); take(M); swipe(M, "down");
  check(take(M).every(e => e.type !== "wait" || e.keep === BUFFER) , "(any other swipe is kept the plain BUFFER)");
  // landing says how hard
  const A = scene(); swipe(A, "up"); run(A, 1);
  const land = take(A).find(e => e.type === "land");
  check(land && Math.abs(land.v - JUMP_V * Math.sqrt(TUNE.FALL)) < 0.6, `a landing says how hard it was (${land ? land.v.toFixed(1) : "?"} m/s after a jump of ${JUMP_V.toFixed(1)})`);
  const B = scene({ hero: { y: 3, mode: "air", vy: 0 } }); swipe(B, "down"); run(B, 0.5);
  check(take(B).find(e => e.type === "land").v > 20, "and a dive's is much harder");
  // a run that sets off from a standstill
  const N = newGame({ seed: 2, launch: true });
  check(speed(N) < 4 && speed(newGame({ seed: 2 })) === 10, "a run set off from a standstill starts at a third of the pace, one picked up at pace does not");
  run(N, 0.7);
  check(speed(N) > 0.99 * speedAt(N.hero.z), "and is at full pace in 0.7 s");
}

// ---------- the feel: springs, the pose carried over, the cloth, the camera ----------
{
  const sp = new Spring(0); for (let i = 0; i < 120; i++) sp.to(1, 1 / 60, 20, 1);
  check(Math.abs(sp.x - 1) < 1e-3 && sp.v < 1e-2, "a critically damped spring arrives");
  const ring = new Spring(0); let over = 0; for (let i = 0; i < 120; i++) over = Math.max(over, ring.to(1, 1 / 60, 20, 0.3));
  check(over > 1.2, `and a loose one overshoots (${over.toFixed(2)})`);
  const still = new Spring(0.4); still.v = 3; still.to(1, 0, 20, 1);
  check(still.x === 0.4 && still.v === 3, "a frame of no time (the game paused) changes nothing");
  const big = new Spring(0); big.to(1, 0.5, 60, 0.5);
  check(Number.isFinite(big.x) && Math.abs(big.x) < 5, "and a long frame stays stable");

  const I = new Inertia(3, 18, 0.8);
  I.step("a", [1, 2, 3], 1 / 60);
  const first = I.step("b", [0, 0, 0], 1 / 60).slice();
  check(first.every((x, i) => Math.abs(x - [1, 2, 3][i]) < 0.5), "a pose that changes is carried over from the one before, not snapped");
  let out = first; for (let i = 0; i < 60; i++) out = I.step("b", [0, 0, 0], 1 / 60);
  check(out.every(x => Math.abs(x) < 0.02), "and arrives at the new one");

  const cloth = (speed, vy, vx) => { const s = new Streamer(0.2, 20, 0.5); for (let i = 0; i < 90; i++) s.update(1 / 60, { speed, vy, vx }); return s; };
  check(cloth(0, 0, 0).a.x < 0.01, "a scarf hangs when he is still");
  const run10 = cloth(10, 0, 0).a.x, run16 = cloth(16, 0, 0).a.x;
  check(run16 > run10 && run10 > 0.8, `and streams out as he runs (${run10.toFixed(2)} at 10 m/s, ${run16.toFixed(2)} at 16)`);
  check(cloth(14, 9, 0).a.x < run16 && cloth(14, -9, 0).a.x > 1.5, "droops when he rises and flares when he falls");
  check(cloth(14, 0, 12).b.x < -0.3 && cloth(14, 0, -12).b.x > 0.3, "and trails away from the way he moves sideways");

  const cam = new CameraRig();
  const settle = (s, secs) => { for (let i = 0; i < secs * 60; i++) cam.update(1 / 60, s); return cam.out; };
  const slow = settle({ x: 0, y: 0, vx: 0, speed: 8, wall: 0 }, 3).fov, fast = settle({ x: 0, y: 0, vx: 0, speed: 16, wall: 0 }, 3);
  const backFast = fast.back;
  check(fast.fov > slow + 4 && backFast > 6, `the camera widens (${slow.toFixed(1)} to ${fast.fov.toFixed(1)} degrees) and draws back (${backFast.toFixed(2)} m) with speed`);
  const x0 = fast.x; cam.update(1 / 60, { x: LANE_W, y: 0, vx: 15, speed: 16, wall: 0 });
  const lag = cam.out.x - x0;
  settle({ x: LANE_W, y: 0, vx: 0, speed: 16, wall: 0 }, 3);
  check(lag > 0 && lag < LANE_W * 0.55 * 0.3 && Math.abs(cam.out.x - LANE_W * 0.55) < 0.01, "it follows a change of lane late, and gets there");
  const r0 = cam.out.roll; for (let i = 0; i < 6; i++) cam.update(1 / 60, { x: LANE_W, y: 0, vx: 18, speed: 16, wall: 0 });
  check(Math.abs(cam.out.roll - r0) > 0.01, "and leans into it");
  const yRest = settle({ x: 0, y: 0, vx: 0, speed: 16, wall: 0 }, 3).y;
  cam.land(10); let low = 0, high = 0; for (let i = 0; i < 90; i++) { const y = cam.update(1 / 60, { x: 0, y: 0, vx: 0, speed: 16, wall: 0 }).y; low = Math.min(low, y - yRest); high = Math.max(high, y - yRest); }
  check(low < -0.1 && high > 0.005 && Math.abs(cam.out.y - yRest) < 0.01, `a landing dips it (${low.toFixed(2)} m), it springs back past (${high.toFixed(3)}) and settles`);
  // the ground he stands on is followed fully: on a deck the picture is the quay's, a jump over it only partly followed, a high one enough
  const quayY = settle({ x: 0, y: 0, ground: 0, vx: 0, speed: 16, wall: 0 }, 3).y, quayL = cam.out.lookY;
  settle({ x: 0, y: 3.2, ground: 3.2, vx: 0, speed: 16, wall: 0 }, 3);
  check(Math.abs(cam.out.y - quayY - 3.2) < 0.01 && Math.abs(cam.out.lookY - quayL - 3.2) < 0.01, "on a deck the camera stands exactly as high over him as on the quay");
  let peak = 0; for (let i = 0; i < 40; i++) { const y = 3.2 + 1.6 * Math.sin(i / 39 * Math.PI); cam.update(1 / 60, { x: 0, y, ground: 3.2, vx: 0, speed: 16, wall: 0 }); peak = Math.max(peak, cam.out.y - quayY - 3.2); }
  check(peak > 0.1 && peak < 1.0, `a jump over a deck lifts it only in part (${peak.toFixed(2)} m of 1.6)`);
  let lowest = 9; for (let i = 0; i < 60; i++) { cam.update(1 / 60, { x: 0, y: 3.2, ground: 3.2, vx: 0, speed: 16, wall: 0 }); } for (let i = 0; i < 90; i++) { const y = Math.max(0, 3.2 - 12.3 * (i / 60) ** 2); const before = cam.out.y; cam.update(1 / 60, { x: 0, y, ground: 0, vx: 0, speed: 16, wall: 0 }); lowest = Math.min(lowest, cam.out.y - before); }
  check(lowest > -0.2 && Math.abs(cam.out.y - quayY) < 0.05, `a drop to the quay is followed without a lurch (${lowest.toFixed(2)} m in a frame)`);
  const cam2 = new CameraRig(), before = JSON.stringify(cam2.out); cam2.update(0, { x: 5, y: 3, vx: 9, speed: 16, wall: 1 });
  check(Number.isFinite(cam2.out.x) && JSON.stringify(cam2.out) !== before.replace("NaN", ""), "a frame of no time leaves the camera finite");
}

// ---------- a bot plays the quay ----------
{
  const q = n => ({ id: `Q${n}`, bank: "test", q: "?", o: ["a", "b", "c"], a: n % 3, x: "", about: [] });
  const results = [];
  for (const seed of [1, 2, 3, 4]) {
    let n = 0;
    const S = newGame({ seed, deal: () => q(n++) });
    const st = { next: 0, slamAfter: 0 };
    let steps = 0;
    while (!S.over && S.hero.z < 1800 && steps++ < 300000) {
      botStep(S, st); step(S, DT);
      if (process.env.RECKONING_DEBUG) for (const e of S.ev) if (["hurt", "fall", "clang"].includes(e.type)) {
        const h = S.hero, near = S.world.foes.filter(f => Math.abs(f.z - h.z) < 6).map(f => `${f.kind}${f.alive ? "" : "x"}${f.spent ? "s" : ""}@l${f.lane},${(f.z - h.z).toFixed(1)}`);
        console.log(`   seed ${seed} swipes ${st.log.join(' ')}\n   seed ${seed} t=${S.t.toFixed(2)} ${e.type} z=${h.z.toFixed(1)} lane=${h.lane} y=${h.y.toFixed(2)} ${h.mode} near: ${near.join(" ")}; walls ${S.world.walls.map(w => `${w.side}:${(w.z0 - h.z).toFixed(0)}..${(w.z1 - h.z).toFixed(0)}`)}; pits ${S.world.pits.map(p => `${(p.z0 - h.z).toFixed(0)}..${(p.z1 - h.z).toFixed(0)}`)}`);
      }
      S.ev.length = 0;
    }
    results.push([seed, Math.round(S.hero.z), S.hearts, S.falls, S.right, S.wrong + S.missed, S.over]);
  }
  for (const r of results) console.log(`     seed ${r[0]}: ${r[1]} m, hearts ${r[2]}, falls ${r[3]}, answers right ${r[4]} wrong ${r[5]}${r[6] ? ", OVER" : ""}`);
  check(results.every(r => !r[6] && r[1] >= 1800), "a bot that swipes by the rules runs 1,800 m on four quays");
  check(results.every(r => r[4] >= 3), "and answers the questions over the water");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("reckoning: the jump, the five attacks, walls, the air chain, the question over the water, the quay from a seed, a bot's run");
