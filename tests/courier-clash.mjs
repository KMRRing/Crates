// Courier's two rulings of 4 November 2026 (Korbi, "that felt wrong" flags from the Feel lab round; docs/courier.md): leaving a wall towards a foe is
// the aerial cut a swipe in the air would make, and a foe lunging at me that I swipe, roll or jump into bounces off and dies, knocked the way the move went (a bruiser loses the attack). Pure rules.
import { T, setTune, resetTune } from "../reckoning-tune.js";
import { newGame, swipe, step, take, speed, KINDS, LANE_W, WALL_Y } from "../reckoning-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const DT = 1 / 120;
let log = [];
const run = (S, secs) => { for (let t = 0; t < secs - 1e-9 && !S.over; t += DT) { step(S, DT); log.push(...take(S)); } };
const evs = (...types) => log.filter(e => types.includes(e.type));

let ids = 1;
function scene(lane = 0, walls = []) {
  const S = newGame({ seed: 1 });
  S.world.foes = []; S.world.pits = []; S.world.walls = walls; S.world.gates = []; S.world.z1 = 1e9;
  S.fwd = 1; S.hero.lane = lane; S.hero.x = lane * LANE_W;
  log = [];
  return S;
}
function foe(S, kind, lane, ttc, extra = {}) {
  const f = { id: ids++, kind, lane, x: lane * LANE_W, z: S.hero.z + ttc * speed(S), y: KINDS[kind].y, h: KINDS[kind].h, alive: true, spent: false, gate: null, ...extra };
  S.world.foes.push(f);
  return f;
}
const sw = (S, d) => { swipe(S, d); log.push(...take(S)); };

// ---------- leaving a wall towards a foe ----------
const onWall = (...foes) => {
  const S = scene(1, [{ side: 1, z0: -5, z1: 400 }]);
  const made = foes.map(([kind, lane, ttc, y]) => foe(S, kind, lane, ttc, y != null ? { y } : {}));
  sw(S, "right"); run(S, 0.4);
  return [S, ...made];
};
{
  // his log: the right wall, a gull in the left lane 0.49 s away, a swipe left: "left the wall", fell at vy -13.9, into the water
  const S = scene(1, [{ side: 1, z0: -5, z1: 400 }]);
  sw(S, "right"); run(S, 0.4);
  const g = foe(S, "gull", -1, 0.49 + 0.0);
  check(S.hero.mode === "wall" && Math.abs(S.hero.y - WALL_Y) < 0.1, "(on the right wall)");
  sw(S, "left");
  check(S.hero.lunge && S.hero.lunge.how === "side" && S.hero.lane === -1 && evs("wallleave").length === 1, "a swipe away from the wall with a gull two lanes over is a cut at it, not a drop");
  run(S, 0.7);
  check(!g.alive && S.hearts === 3 && S.hero.mode === "air" && S.chain === 1 && S.hero.jumps === 1, "which kills it, chains, and gives the jump back");
  run(S, 2);
  check(S.hero.mode === "run" && S.hearts === 3, "and I come down on the quay, not in the water");
}
{
  const [S, g] = onWall(["gull", 0, 0.5]);
  sw(S, "left");
  run(S, 0.7);
  check(!g.alive && S.hearts === 3 && S.hero.mode === "air", "a gull in the middle lane is cut the same way");
}
{
  const [S, b] = onWall(["balloon", 0, 0.5, 2.2]);
  sw(S, "left"); run(S, 0.7);
  check(!b.alive && S.hero.mode === "air" && S.coins > 0, "a balloon is popped");
}
{
  const [S, c] = onWall(["crab", 0, 0.5]);
  sw(S, "left"); run(S, 0.7);
  check(!c.alive && S.hearts === 3, "and a crab below: a swoop onto it");
}
{
  const [S] = onWall(["crab", 0, 3.5], ["gull", -1, 3.0]);
  sw(S, "left");
  check(!S.hero.lunge && S.hero.lane === 1 && S.hero.mode === "air" && evs("wallleave").length === 1, "with nothing in reach it is the plain leave: a drop in the wall's lane");
}
{
  const [S, c] = onWall(["crab", 0, 0.5]);
  sw(S, "right");
  check(S.hero.mode === "wall" && !S.hero.lunge && c.alive, "a swipe towards the wall is still nothing, with a foe or not");
  sw(S, "up");
  check(S.hero.mode === "air" && S.hero.kick && !S.hero.lunge, "and up is the wall jump");
}

// ---------- a foe lunging at me that I swipe into ----------
// A swipe sideways towards a lunging foe is a cut at it whenever the window allows (SIDE_WIN, and a late one while it hits). Narrowing the window
// to nothing takes that away, so what is left is the collision rule alone.
const narrow = () => setTune({ SIDE_WIN: 0.02, FRONT_WIN: 0.02 });
const launched = (kind, fromLane, heroLane, extra = {}) => {
  const S = scene(heroLane), f = foe(S, kind, fromLane, 1.6, extra);
  let n = 0; while (f.ph !== 3 && n++ < 4000) { step(S, DT); take(S); }
  return [S, f];
};
/** Runs on until the foe is `ttc` seconds off (a swipe this late crosses its path as it arrives). */
const until = (S, f, ttc) => { let n = 0; while ((f.z - S.hero.z) / speed(S) > ttc && n++ < 4000) { step(S, DT); log.push(...take(S)); } };
{
  narrow();
  const [S, f] = launched("crab", -1, 0);
  until(S, f, 0.06);
  sw(S, "left");
  check(!S.hero.lunge && S.hero.lane === -1, "(the swipe is a plain lane change into the crab's lane: nothing is cut)");
  run(S, 1);
  check(!f.alive && S.hearts === 3 && evs("clash").length === 1 && evs("kill").some(e => e.how === "clash" && e.dir === -1), "a crab lunging at me from the left, swiped into: it bounces off and dies, I am not hurt");
  resetTune();
}
{
  narrow();
  const [S, f] = launched("crab", -1, 0, { heavy: true, hp: 2 });
  until(S, f, 0.06); sw(S, "left"); run(S, 0.1);
  check(f.alive && f.hp === 1 && f.ph !== 3 && S.hearts === 3 && f.z > S.hero.z + 3, "a bruiser lunging at me loses the attack and is thrown back, wounded; I am not hurt");
  resetTune();
}
{
  narrow();
  const [S, f] = launched("gull", 1, 0);
  until(S, f, 0.06); sw(S, "right"); run(S, 1);
  check(!f.alive && S.hearts === 3, "so does a gull diving at me from the side");
  resetTune();
}
{
  narrow();
  const [S, f] = launched("crab", -1, 0);
  until(S, f, 0.2); sw(S, "right"); run(S, 1);
  check(f.alive && S.hearts === 3 && evs("clash").length === 0, "a swipe away from it is a dodge, as before (it lands in the lane I left)");
  resetTune();
}
{
  // 4 November, Korbi: "rolling or jump attack -> knocks straight back"
  narrow();
  const [S, f] = launched("crab", -1, 0);
  until(S, f, 0.3); sw(S, "down"); run(S, 1.2);
  const k = evs("kill").find(e => e.how === "clash");
  check(!f.alive && S.hearts === 3 && k && k.dir === 0, "a roll into a crab lunging from the side kills it, I am not hurt, and it is knocked straight back (dir 0)");
  resetTune();
}
{
  narrow();
  const [S, f] = launched("crab", 1, 0);
  until(S, f, 0.3); sw(S, "up"); run(S, 1.2);
  const k = evs("kill").find(e => e.how === "clash");
  check(!f.alive && S.hearts === 3 && k && k.dir === 0, "a jump attack (up) at a crab lunging from the right kills it, straight back");
  resetTune();
}
for (const [dir, from, name] of [[-1, -1, "left"], [1, 1, "right"]]) {
  narrow();
  const [S, f] = launched("crab", from, 0);
  until(S, f, 0.06); sw(S, name); run(S, 1);
  const k = evs("kill").find(e => e.how === "clash");
  check(!f.alive && S.hearts === 3 && k && k.dir === dir, `a swipe ${name} knocks it back and ${name} (dir ${dir})`);
  resetTune();
}
{
  narrow();
  const [S, f] = launched("crab", -1, 0, { heavy: true, hp: 2 });
  until(S, f, 0.3); sw(S, "down"); run(S, 0.45);
  check(f.alive && f.hp === 1 && f.ph !== 3 && S.hearts === 3 && f.z > S.hero.z + 3, "a roll into a lunging bruiser: it loses the attack and staggers back, wounded");
  resetTune();
}
{
  narrow();
  const [S, f] = launched("gull", 1, 0);
  until(S, f, 0.3); sw(S, "down"); run(S, 1);
  check(f.alive && S.hearts === 3 && evs("clash").length === 0, "a roll still goes under a gull's dive (not a hit)");
  resetTune();
}
{
  // a foe knocked sideways takes down the one it lands on, a few metres on in the lane beyond
  narrow();
  const [S, f] = launched("crab", -1, 0);
  until(S, f, 0.06);
  const hit = foe(S, "crab", -1, 0, { z: f.z + 4 }), far = foe(S, "crab", -1, 0, { z: f.z + 30 }), mid = foe(S, "crab", 0, 0, { z: f.z + 4 });
  hit.ph = 0; far.ph = 0; mid.ph = 0;
  // the hero swipes left, the crab came from the left (lane -1): it flies on towards lane -2, which is out of the quay, so nothing
  sw(S, "left"); run(S, 0.05);
  check(hit.alive && far.alive && mid.alive, "knocked off the quay's edge there is nobody to take down");
  resetTune();
}
{
  narrow();
  const S = scene(1), f = foe(S, "crab", 0, 1.6);
  let n = 0; while (f.ph !== 3 && n++ < 4000) { step(S, DT); take(S); }
  const mate = foe(S, "crab", -1, 0, { z: f.z + 3 }), far = foe(S, "crab", -1, 0, { z: f.z + 30 }), ahead = foe(S, "crab", 1, 0, { z: f.z + 3 });
  until(S, f, 0.06); sw(S, "left"); run(S, 0.05);
  check(!f.alive && !mate.alive && far.alive && ahead.alive && S.hearts === 3, "knocked left it lands on a foe in the lane beyond a few metres on and takes it down too; a far one or one in another lane is left");
  resetTune();
}
{
  // with the real windows the ordinary cut does it: the same swipe, the same result
  const [S, f] = launched("crab", -1, 0);
  until(S, f, 0.06); sw(S, "left"); run(S, 1);
  check(!f.alive && S.hearts === 3, "with the lab's windows the same swipe is the ordinary side cut, and I am not hurt either");
}

console.log(bad ? `${bad} problems` : "courier clash: leaving a wall towards a foe, and a lunging foe I swipe into");
process.exit(bad ? 1 : 0);
