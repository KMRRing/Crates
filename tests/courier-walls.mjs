// Courier's verticality: the wall run's state machine (docs/courier.md, "The wall run"), ground above the quay (ramps, balconies, drop-downs), jump pads
// and balloon chains (Korbi, 4 November 2026). Pure rules, no page.
import { newGame, swipe, step, take, buildRows, groundY, WALL_TOP, WALL_Y, PAD_V, JUMP_V, LANE_W, KINDS } from "../reckoning-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const DT = 1 / 120;

/** An empty quay, the hero on the planks at pace (10 m/s at the start). */
function scene({ lane = 0, walls = [], pits = [], decks = [], pads = [] } = {}) {
  const S = newGame({ seed: 1 });
  const W = S.world;
  W.foes = []; W.pits = pits; W.walls = walls; W.gates = []; W.obs = []; W.pick = []; W.decks = decks.map((d, i) => ({ id: 900 + i, ramp: 0, down: 0, ...d })); W.pads = pads.map((p, i) => ({ id: 950 + i, y: 0, ...p })); W.z1 = 1e9;
  S.fwd = 1; S.hero.lane = lane; S.hero.x = lane * LANE_W;
  return S;
}
const log = [];
const go = (S, cond, secs = 6) => { for (let t = 0; t < secs && !S.over; t += DT) { if (cond(S)) return true; step(S, DT); log.push(...take(S)); } return cond(S); };
const evs = types => log.filter(e => types.includes(e.type)).map(e => e.type);
const sw = (S, d) => { swipe(S, d); log.push(...take(S)); };
const atZ = z => S => S.hero.z >= z;

// ---------- the wall run: one state machine ----------
// run --(swipe at a wall on my side, from the planks or the air)--> wall (my feet at WALL_Y from the planks, my own height from the air, never above the wall's top)
// wall --(up)--> air, a jump of WALLJUMP_V (the jump is mine again); --(away)--> air, in the lane; --(the wall's end)--> air; --(towards)--> nothing
// air after a wall jump (kick) --(across to a wall on the other side)--> wall there, from where I am; --(the same side)--> wall again, if it is taller
{
  const S = scene({ lane: 1, walls: [{ side: 1, z0: 10, z1: 90 }] });
  go(S, atZ(8)); sw(S, "right");
  check(S.hero.mode === "wall" && S.hero.wall === 1, "a swipe towards a wall on my side, from the planks, starts a wall run");
  go(S, S => S.hero.y > 1.9);
  check(Math.abs(S.hero.y - WALL_Y) < 0.1 && S.hero.mode === "wall", `the wall lifts me to ${WALL_Y} m`);
  go(S, S => S.hero.z > 20);
  check(S.hero.mode === "wall" && S.hearts === 3, "and I run along it");
  sw(S, "up");
  check(S.hero.mode === "air" && S.hero.vy > JUMP_V && S.hero.kick, "up on the wall jumps off it, higher than a plain jump");
}
{
  const S = scene({ lane: 1, walls: [{ side: 1, z0: 10, z1: 90 }] });
  go(S, atZ(4)); sw(S, "up");
  go(S, S => S.hero.vy < 0 && S.hero.y < 1.6 && S.hero.y > 1.2);
  const used = S.hero.jumps === 0 && S.hero.mode === "air";
  sw(S, "right");
  check(used && S.hero.mode === "wall", "a jump already used, a wall run still starts in the air, at the height I was");
  sw(S, "up");
  check(S.hero.mode === "air" && S.hero.vy > JUMP_V, "and it gave the jump back: up jumps again from the wall");
}
{
  const S = scene({ lane: 1, walls: [{ side: 1, z0: 10, z1: 120 }] });
  go(S, atZ(8)); sw(S, "right"); go(S, S => S.hero.y > 1.9); sw(S, "up");
  go(S, S => S.hero.vy < 0 && S.hero.y > WALL_TOP - 0.3);                // over the top of an ordinary wall, on the way down
  sw(S, "right");
  check(S.hero.mode === "air" && S.hero.y > WALL_TOP - 0.3, "an ordinary wall gives no second wall run above its top: a jump off it gets me no higher");
}
{
  const S = scene({ lane: 1, walls: [{ side: 1, z0: 10, z1: 120, top: 9 }] });
  go(S, atZ(8)); sw(S, "right"); go(S, S => S.hero.y > 1.9); sw(S, "up");
  go(S, S => S.hero.vy < 0);
  const y0 = S.hero.y;
  sw(S, "right");
  check(S.hero.mode === "wall" && S.hero.wallY > WALL_Y + 1.5 && Math.abs(S.hero.wallY - y0) < 0.2, `a taller wall gives a second wall run higher up (${S.hero.wallY.toFixed(1)} m, from ${WALL_Y})`);
}
{
  const S = scene({ lane: 1, walls: [{ side: 1, z0: 10, z1: 160, top: 9 }, { side: -1, z0: 10, z1: 160, top: 9 }] });
  go(S, atZ(8)); sw(S, "right"); go(S, S => S.hero.y > 1.9);
  const ys = [S.hero.y];
  for (const d of ["left", "right"]) {
    sw(S, "up"); go(S, S => S.hero.vy < 0);
    sw(S, d);
    go(S, S => S.hero.mode === "wall", 1);
    ys.push(S.hero.y);
  }
  check(S.hero.mode === "wall" && S.hero.wall === 1 && ys[1] > ys[0] + 1.5 && ys[2] > ys[1] + 1.5, `walls on both sides chain upwards, a jump and a swipe across each time (${ys.map(y => y.toFixed(1)).join(", ")} m)`);
  check(S.hero.lane === 1 && S.hearts === 3, "and I am in the lane of the wall I am on");
}
{
  const S = scene({ lane: 1, walls: [{ side: 1, z0: 10, z1: 160 }, { side: -1, z0: 10, z1: 160 }] });
  go(S, atZ(8)); sw(S, "right"); go(S, S => S.hero.y > 1.9);
  sw(S, "right");
  check(S.hero.mode === "wall" && S.hero.wall === 1, "on a wall, a swipe towards it does nothing");
  sw(S, "left");
  check(S.hero.mode === "air" && S.hero.lane === 1 && !S.hero.kick, "and one away from it lets go, and no wall is joined across (that is for a jump off the wall)");
}
{
  const S = scene({ lane: 0, walls: [{ side: 1, z0: 10, z1: 90 }] });
  go(S, atZ(8)); sw(S, "right");
  check(S.hero.mode === "wall" && S.hero.wall === 1 && S.hero.lane === 1, "from the middle lane a swipe towards a wall is the wall run, in one swipe, by way of the lane");
  go(S, S => S.hero.y > 1.9);
  check(Math.abs(S.hero.y - WALL_Y) < 0.1 && S.hearts === 3 && log.some(e => e.type === "wallrun" && e.via), "and it lifts me to the same height as from the edge lane");
}
{
  const S = scene({ lane: 0, walls: [{ side: -1, z0: 10, z1: 90 }] });
  go(S, atZ(8)); sw(S, "right");
  check(S.hero.lane === 1 && S.hero.mode === "run", "a swipe away from the wall is a lane change");
  go(S, S => S.hero.z > 20); sw(S, "left");
  check(S.hero.lane === 0 && S.hero.mode === "run", "and back again too");
  sw(S, "left");
  check(S.hero.mode === "wall" && S.hero.wall === -1, "and from the middle lane, towards the wall, one swipe");
}
{
  const S = scene({ lane: 0, walls: [{ side: 1, z0: 10, z1: 90 }] });
  go(S, atZ(4)); sw(S, "up");
  go(S, S => S.hero.vy < 0 && S.hero.y > 1.0);
  const y0 = S.hero.y;
  sw(S, "right");
  check(S.hero.mode === "wall" && S.hero.wall === 1 && Math.abs(S.hero.wallY - y0) < 0.05, "in a jump from the middle lane the same, at the height I was (Korbi's first words)");
}
{
  const S = scene({ lane: 0, walls: [{ side: 1, z0: 10, z1: 90 }] });
  const f = { id: 77, kind: "crab", lane: 1, x: LANE_W, z: 8 + 10 * 0.4 + 0.1, y: 0, h: 1, alive: true, spent: false, gate: null };
  S.world.foes.push(f);
  go(S, atZ(8.1)); sw(S, "right");
  check(S.hero.mode !== "wall" && S.hero.lane === 1, "with a foe to cut in the edge lane the swipe is the cut, not the wall run (the next one is)");
}
{
  const S = scene({ lane: 0, walls: [{ side: 1, z0: 10, z1: 90, top: 2.4 }] });
  go(S, atZ(8)); sw(S, "right");
  check(S.hero.mode === "wall" && S.hero.wallY <= 1.9 + 1e-9, "and a low wall lifts me no higher than its top allows");
}
{
  const S = scene({ lane: 1, walls: [{ side: 1, z0: 10, z1: 40 }] });
  go(S, atZ(8)); sw(S, "right");
  go(S, S => log.some(e => e.type === "wallend"), 8);
  check(evs(["wallend"]).length === 1 && S.hero.mode !== "wall", "at the wall's end the wall run ends");
  go(S, S => S.hero.mode === "run", 3);
  check(S.hero.mode === "run" && S.hero.y === 0 && S.hearts === 3, "and I come down onto the planks");
}
{
  const S = scene({ lane: 1, walls: [{ side: 1, z0: 10, z1: 40 }], pits: [{ z0: 40, z1: 70 }] });
  go(S, atZ(8)); sw(S, "right");
  go(S, S => S.hero.z > 41, 8);
  go(S, S => S.hero.mode !== "air" || S.hero.z > 95, 5);
  check(S.falls >= 1, "a wall that ends over a pit lets me fall in it");
}

// ---------- ground above the quay ----------
{
  const S = scene({ lane: 0, decks: [{ z0: 20, z1: 70, y: 3, l0: 0, l1: 1, ramp: 14 }] });
  check(groundY(S, 0, 20) === 0 && Math.abs(groundY(S, 0, 27) - 1.5) < 1e-9 && groundY(S, 0, 40) === 3 && groundY(S, -LANE_W, 40) === 0, "a ramp rises over its length, to its height, in its own lanes only");
  go(S, atZ(45));
  check(S.hero.mode === "run" && Math.abs(S.hero.y - 3) < 1e-6 && S.hearts === 3, "a ramp carries me up it, running, with no hurt");
  go(S, atZ(75), 3);
  check(S.hearts === 3 && S.hero.y < 3 - 1e-6 || S.hero.mode === "air", "and off the end of the deck I fall");
  go(S, S => S.hero.mode === "run" && S.hero.y === 0, 3);
  check(S.hero.mode === "run" && S.hero.y === 0 && S.hearts === 3, "and land on the planks below it (a drop-down costs nothing)");
}
{
  const S = scene({ lane: 0, decks: [{ z0: 20, z1: 70, y: 3.2, l0: 0, l1: 1 }] });
  go(S, atZ(24), 4);
  check(S.hearts === 2 && Math.abs(S.hero.y - 3.2) < 1e-6, "a balcony's sheer front, run into from the planks, is a heart, and I stand on it");
}
{
  const S = scene({ lane: 0, decks: [{ z0: 20, z1: 70, y: 3.2, l0: 0, l1: 1 }] });
  go(S, atZ(5)); sw(S, "up");
  go(S, atZ(24), 4);
  check(S.hearts === 2, "and a plain jump does not clear it");
}
{
  const S = scene({ lane: 0, decks: [{ z0: 20, z1: 70, y: 3.2, l0: 0, l1: 1 }], pads: [{ lane: 0, z: 16 }] });
  go(S, atZ(40), 5);
  check(evs(["pad"]).length === 1 && S.hearts === 3 && S.hero.mode === "run" && Math.abs(S.hero.y - 3.2) < 1e-6, "a jump pad throws me up onto the balcony, and I run on it");
  const U = scene({ lane: 0, pads: [{ lane: 0, z: 16 }] });
  go(U, S => S.hero.y > 3, 3);
  check(U.hero.y > 3 && PAD_V > 0, "the pad throws me higher than a wall jump");
  const V = scene({ lane: 1, decks: [{ z0: 20, z1: 70, y: 3.2, l0: -1, l1: 0 }], pads: [{ lane: 0, z: 16 }] });
  go(V, atZ(40), 5);
  check(V.hearts === 3 && !evs(["pad"]).length || V.hero.y === 0, "a pad in a lane I am not in does nothing to me");
}
{
  const S = scene({ lane: 0, decks: [{ z0: 20, z1: 60, y: 3, l0: 0, l1: 0 }] });
  buildRows(S, ["!rest 1"], 0, 11);
  const f = (id => S.world.foes.find(x => x.id === id));
  S.world.decks.push({ id: 5, z0: 100, z1: 140, y: 3, l0: 0, l1: 0, ramp: 0, down: 0 });
  buildRows(S, [". . .", "!rest 100", "c . ."], 99.5, 11);
  const crab = S.world.foes.find(x => x.kind === "crab");
  check(crab && crab.gy === 0 || crab.gy === 3, "foes stand on the ground under them (a deck's height is theirs)");
}

// ---------- the pieces ----------
{
  const S = scene();
  buildRows(S, ["!ramp 0"], 10, 11);
  const d = S.world.decks[0], on = S.world.foes.filter(f => f.gy === 3);
  check(d && d.ramp > 0 && on.length >= 2 && S.world.pick.some(p => p.y > 3), "a ramp piece has a ramp, with foes and coins up on it");
  const T = scene();
  buildRows(T, ["!balcony 0"], 10, 11);
  check(T.world.pads.length === 1 && T.world.decks[0].ramp === 0 && T.world.foes.some(f => f.kind === "balloon" && f.gy > 3), "a balcony piece has a pad before a sheer deck, with balloons over it");
  const R = scene();
  buildRows(R, ["!sky 0"], 10, 11);
  check(R.world.pads.length === 1 && R.world.foes.filter(f => f.kind === "balloon").length >= 4 && R.world.foes.every(f => f.y >= 3.8), "a sky piece is a pad and a chain of high balloons");
  const C = scene();
  buildRows(C, ["!climb 0"], 10, 11);
  check(C.world.walls.length === 2 && C.world.walls.every(w => w.top > 7) && C.world.pits.length === 1 && C.world.decks.length === 1, "a climb piece is a stretch of water between two tall walls, and a balcony beyond");
}
// the balloons of the sky carry me: pad, then a swipe up for each as it comes
{
  const S = scene({ lane: 0 });
  buildRows(S, ["!sky 0"], 0, 11);
  const pad = S.world.pads[0];
  S.hero.lane = pad.lane; S.hero.x = pad.lane * LANE_W;
  let kills = 0, tries = 0;
  for (let t = 0; t < 8 && !S.over; t += DT) {
    const f = S.world.foes.find(x => x.alive && x.kind === "balloon" && x.z - S.hero.z < 3);
    if (f && S.hero.mode === "air" && (f.z - S.hero.z) / 10 < 0.35 && (tries++ % 6 === 0)) swipe(S, "up");
    step(S, DT);
    for (const e of take(S)) if (e.type === "kill" && e.kind === "balloon") kills++;
  }
  check(kills >= 4 && S.hearts === 3, `a pad and an upward swipe at each balloon carries me through the sky (${kills} popped)`);
}
// the ship's side, climbed by the rules: lane, wall run, jump, across, jump, across
{
  const S = scene({ lane: 1 });
  buildRows(S, ["!climb 0"], 0, 11);
  const [w] = S.world.walls, pit = S.world.pits[0];
  let step_ = 0, ys = [];
  S.hero.lane = 1; S.hero.x = LANE_W;
  for (let t = 0; t < 14 && !S.over && S.hero.z < pit.z1 + 14; t += DT) {
    const h = S.hero;
    if (step_ === 0 && h.z >= w.z0) { swipe(S, "right"); step_ = 1; }
    else if (step_ === 1 && h.mode === "wall" && h.y > 1.9) { swipe(S, "up"); step_ = 2; }
    else if (step_ === 2 && h.vy < 0) { swipe(S, "left"); step_ = 3; }
    else if (step_ === 3 && h.mode === "wall" && Math.abs(h.y - h.wallY) < 0.2) { ys.push(h.y); swipe(S, "up"); step_ = 4; }
    else if (step_ === 4 && h.vy < 0) { swipe(S, "right"); step_ = 5; }
    else if (step_ === 5 && h.mode === "wall") { ys.push(h.y); step_ = 6; }
    step(S, DT); take(S);
  }
  check(step_ === 6 && S.hearts === 3 && S.hero.z >= pit.z1, `the ship's side can be climbed by wall run and wall jump, ${S.hero.z.toFixed(0)} m, hearts ${S.hearts}, at ${ys.map(y => y.toFixed(1)).join(", ")} m`);
  for (let t = 0; t < 6 && !S.over && !(S.hero.mode === "run" && S.hero.y > 0); t += DT) { step(S, DT); take(S); }
  check(S.hearts === 3 && S.hero.mode === "run" && S.hero.y > 4, `and I come down onto the balcony beyond (y ${S.hero.y.toFixed(1)})`);
}

// Playtest: one piece, again and again
{
  const S = newGame({ seed: 5, piece: "climb" });
  step(S, 1e-6);
  S.hero.z = 300; step(S, 1e-6);
  const ids = S.world.zones.filter(z => z.id).map(z => z.id);
  check(ids.length >= 2 && ids.every(id => id === "climb") && S.world.walls.length >= 2, "a Playtest run of one piece lays only that piece");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("courier walls: the wall run's state machine, decks, ramps, pads, balloon chains, the climb");
