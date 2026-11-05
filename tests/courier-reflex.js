// A bot that answers foes by what they do (5 November 2026): it reads each foe's behaviour, not a row. A launched foe aimed at my lane is met by the
// answer its kind asks (a roll for the crab, the pirate and the gull's dive; a jump and a dive on a shield bearer; a lane for a cart and a shot), and the
// rest it leaves to the foe to come. It is the oracle of tests/courier-foes.mjs ("this counter works") and plays the encounters in
// tests/courier-encounters.mjs. `habit` makes it play a habit instead, to show the foe that punishes it: "cut" swipes at whatever comes in its lane,
// "roll" rolls at everything, "wait" stands in its lane and does nothing, "once" answers each foe once and goes on, "early" jumps a rolling barrel the moment it sets off.
import { speed, swipe, step, newGame, BOTTLE_V, behOf, armourOf, LANE_W } from "../reckoning-engine.js";

export function reflex(S, st, habit = null) {
  const h = S.hero, v = speed(S), W = S.world;
  if (h.lunge || S.pending.length || S.t < st.next) return false;
  const act = (dir, wait = 0.06) => { swipe(S, dir); st.next = S.t + wait; (st.log ||= []).push(`${S.t.toFixed(2)}:${dir}@l${h.lane},y${h.y.toFixed(1)}`); if (st.log.length > 8) st.log.shift(); return true; };
  const ttc = f => (f.z - h.z) / v;
  const foes = W.foes.filter(f => f.alive && !f.spent && !f.gate && f.z > h.z - 1 && f.z < h.z + 40).sort((a, b) => a.z - b.z);
  const lane = d => (d > 0 ? "right" : "left");
  // a lane to step to: the one with the least coming at it
  const safer = (also = []) => {
    const cost = l => foes.filter(f => (f.aim ?? f.lane) === l && ttc(f) < 1.4).length * 2 + W.shots.filter(s => !s.done && s.lane === l).length * 3 + also.filter(x => x === l).length * 5 + Math.abs(l - h.lane) * 0.1;
    return [-1, 0, 1].filter(l => Math.abs(l - h.lane) === 1).sort((a, b) => cost(a) - cost(b))[0];
  };
  if (h.mode === "air") {
    if (habit) return false;
    // a dive on a shield bearer from above
    const sh = foes.find(f => armourOf(f) === "top" && (f.aim ?? f.lane) === h.lane && ttc(f) < 0.21 && h.y > f.y + f.h);
    if (sh) return act("down");
    return false;
  }
  if (h.mode !== "run" || habit === "wait") return false;
  // shots in my lane: out of it (a bottle might be jumped; the bot steps)
  for (const s of W.shots) {
    if (s.done || s.lane !== h.lane) continue;
    const tt = s.kind === "bottle" ? (s.z - h.z) / (v + BOTTLE_V) : (s.zl - h.z) / v;
    if (tt > 0 && tt < 0.5) return act(lane(safer() - h.lane));
  }
  for (const f of foes) {
    const t = ttc(f), B = behOf(f);
    if (B.move === "roll") {                                       // a barrel or a cart rolling down its lane
      if (f.ph !== 3 || f.lane !== h.lane) continue;
      const tc = (f.z - h.z) / (v + B.roll);
      if (armourOf(f) === "all") { if (habit === "cut" ? tc < 0.12 : tc < 0.8) return act(habit === "cut" ? "up" : lane(safer() - h.lane)); continue; }
      if (habit === "early" ? tc <= 0.62 : tc <= 0.3 && !(h.roll > 0 && h.rollQ)) return act(habit === "early" ? "up" : "down");
      continue;
    }
    if (B.move === "throw") {                                      // a thrower in my lane is cut as I reach it; beside me, as I pass
      if (habit !== "wait" && f.lane === h.lane && t < 0.22 && t > 0.02) return act("up");
      if (habit !== "wait" && Math.abs(f.lane - h.lane) === 1 && t < 0.4 && t > 0.1) return act(lane(f.lane - h.lane));
      continue;
    }
    const mine = f.ph === 3 ? f.aim === h.lane : armourOf(f) === "top" ? Math.abs(f.lane - h.lane) <= 1 : f.lane === h.lane;
    if (!mine) continue;
    const air = f.y - (f.gy || 0) > 0.3 && f.kind === "gull";
    if (armourOf(f) === "top") {                                   // the shield: over him from before his launch, and down
      if (habit === "cut" && f.lane !== h.lane) { if (t < 0.4 && t > 0.1) return act(lane(f.lane - h.lane)); continue; }      // cutting him from the side: only a lane changed into his
      if (habit === "roll") { if (f.ph === 3 && t < 0.3 && !(h.roll > 0 && h.rollQ)) return act("down"); continue; }
      if (t < 0.55 && t > 0.3) return act("up");
      continue;
    }
    if (habit === "cut" && f.ph !== 3 && t < 0.35) return act("up");
    if (air) { if (f.ph >= 2 && t < 0.2 && !(h.roll > 0 && h.rollQ)) return act("down"); continue; }
    if (habit === "once" && (st.done ||= new Set()).has(f.id)) continue;                  // "one cut and on": each foe is answered once
    if (f.ph === 3 && t < 0.3 && !(h.roll > 0 && h.rollQ) && habit !== "wait") { st.done?.add(f.id); return act(habit === "cut" ? "up" : "down"); }
    if ((f.kind === "barrel") && t < 0.3 && t > 0.05 && !(h.roll > 0 && h.rollQ) && habit !== "wait") return act("down");
  }
  return false;
}

/** The scene for a foe test: a clean quay at speed for distance `z`, the hero in the middle lane at z, nothing else. */
export function arena({ seed = 1, z = 0, lane = 0, hearts = 3 } = {}) {
  const S = newGame({ seed, hearts });
  const W = S.world;
  W.foes.length = W.obs.length = W.pick.length = W.pits.length = W.walls.length = W.decks.length = W.pads.length = W.rows.length = W.zones.length = W.gates.length = 0;
  W.z1 = 1e6; W.chunks = 2;
  S.hero.z = z; S.hero.lane = lane; S.hero.x = lane * LANE_W;
  return S;
}

/** Runs the arena for `secs`, the bot moving each tick; returns the run. */
export function run(S, { secs = 6, habit = null, bot = reflex, DT = 1 / 120 } = {}) {
  const st = { next: 0 };
  const end = S.t + secs;
  while (!S.over && S.t < end) { bot(S, st, habit); step(S, DT); S.ev.length = 0; }
  return S;
}
