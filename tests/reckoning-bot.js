// A bot that plays Courier by the rules, for the tests: the lane first, then the swipe at the right moment. `bot` plays the
// endless quay (and the old pieces in a section: gaps with gulls over them, walls, the question's gate); `rowBot` plays a
// section's rows, planning its lane a row ahead (planLane) so that a section is proved to be winnable, not only drawn.
import { LANE_W, UP_ABOVE, SLAM_MIN_Y, speed, swipe, step, newGame, setDeal, goalValue, goalMet, solid, GOODS, ROLL_H } from "../reckoning-engine.js";

/** Plays the way the rules ask: the lane first, then the swipe at the right moment. Returns what it did. */
export function bot(S, st) {
  const h = S.hero, v = speed(S), W = S.world;
  if (h.lunge || S.pending.length) return;
  const ttc = z => (z - h.z) / v;
  if (S.t < st.next) return;
  const act = (dir, wait = 0.05) => { swipe(S, dir); st.next = S.t + wait; (st.log ||= []).push(`${S.t.toFixed(2)}:${dir}@l${h.lane},y${h.y.toFixed(1)}`); if (st.log.length > 8) st.log.shift(); };
  // the wall: an outer lane and a swipe into it, a wall jump near its end
  if (h.mode === "wall") {
    const w = W.walls.find(w => w.side === h.wall && w.z1 > h.z);
    if (w && (w.top ?? 3.2) > 5 && h.y < w.top - 2.6) return act("up");                    // a tall wall (the ship's side): a jump off it, then across, higher each time
    const pit = W.pits.find(p => p.z1 > h.z - 1 && p.z0 < w.z1);
    if (w && h.z > w.z1 - 1.6 && W.foes.some(f => f.alive && f.y <= 0.3 && f.z > w.z1 && f.z < w.z1 + 14)) return act("up");
    return;
  }
  if (h.mode === "air" && h.kick && h.vy < 0) {
    const w = W.walls.find(w => (w.top ?? 3.2) > 5 && w.z0 - 2 < h.z && w.z1 > h.z + 2 && w.side === -h.lane);
    if (w && h.y < w.top - 1.4) return act(w.side > 0 ? "right" : "left");
  }
  // ground above the quay and jump pads are left alone: a lane with none of them is taken
  const free = freeLane(S);
  if (free !== null && h.mode === "run" && h.lane !== free) return act(free > h.lane ? "right" : "left", 0.05);
  if (st.slamAfter && h.mode === "air" && h.y > SLAM_MIN_Y && h.vy < 0 && h.z > st.slamAfter) { st.slamAfter = 0; return act("down"); }
  // a gull one lane over that has wound up is about to dive: a roll goes under it (and a run of them leaves no gap)
  const dive = W.foes.find(f => f.alive && !f.spent && f.kind === "gull" && !f.gate && f.ph >= 2 && ttc(f.z) > -0.1 && ttc(f.z) < 0.2 && Math.abs(f.lane - h.lane) <= 1);
  if (dive && h.mode === "run" && !h.roll) return act("down");
  // crabs
  const f = W.foes.find(f => f.alive && !f.spent && f.kind === "crab" && ttc(f.z) > 0 && ttc(f.z) < 0.5 && Math.abs(f.lane - h.lane) <= 1);
  if (f && h.mode === "run") {
    if (f.lane === h.lane) { if (ttc(f.z) <= 0.2) return act("up"); }
    else if (ttc(f.z) <= 0.4) return act(f.lane > h.lane ? "right" : "left");
  }
  const gate = W.gates.find(g => g.state === "open" && g.z > h.z - 1);
  if (gate && ttc(gate.p0) < 1.5 && ttc(gate.z) > -0.3) {
    const want = gate.q.a - 1;
    if (h.lane !== want && ttc(gate.z) > 0.75) return act(want > h.lane ? "right" : "left", 0.05);
    if (h.lane === want && ttc(gate.z) <= 0.5) return act("up");
    return;
  }
  // a pit with gulls over it: the next one
  const pit = W.pits.find(p => !p.gate && !p.gap && p.z1 > h.z && p.z0 - h.z < 30);
  if (pit) {
    const gulls = W.foes.filter(f => f.alive && f.kind === "gull" && f.z > pit.z0 && f.z < pit.z1 && f.z > h.z).sort((a, b) => a.z - b.z);
    const g = gulls[0];
    const wall = W.walls.find(w => w.z0 < pit.z1 && w.z1 > pit.z0);
    if (wall) {
      if (h.mode === "wall") return;
      if (h.lane !== wall.side) return act(wall.side > h.lane ? "right" : "left", 0.05);
      if (wall.z0 - h.z < 2.2) return act(wall.side > 0 ? "right" : "left");
      return;
    }
    if (g) {
      if (h.mode === "run" && h.lane !== g.lane && ttc(g.z) > 0.9) return act(g.lane > h.lane ? "right" : "left", 0.05);
      if (h.lane === g.lane && h.mode === "air" && h.y - g.y > UP_ABOVE - 0.2) return ttc(g.z) <= 0.2 ? act("down") : undefined;      // too high above it to cut upwards: come down on it (a bonk)
      if (h.lane === g.lane && ttc(g.z) <= 0.5 && (h.mode === "air" || ttc(pit.z0) < 0.35)) return act("up");
      if (h.mode === "air" && h.lane !== g.lane && ttc(g.z) <= 0.5 && ttc(g.z) >= 0.12) return act(g.lane > h.lane ? "right" : "left");
    }
    return;
  }
  // walls without a pit (the slam): get to the side, run up, jump off near the end, dive on the crabs
  const wall = W.walls.find(w => w.z1 > h.z && w.z0 - h.z < 40);
  if (wall && h.mode === "run") {
    if (h.lane !== wall.side) return act(wall.side > h.lane ? "right" : "left", 0.05);
    if (wall.z0 - h.z < 2.2) { st.slamAfter = wall.z1 + 2.5; return act(wall.side > 0 ? "right" : "left"); }
    return;
  }
}

/** The lane to be in while a deck or a jump pad is near (the bot does not use them): the free lane nearest, or null if it is on one or none is near. */
export function freeLane(S) {
  const h = S.hero, W = S.world;
  if (h.gy > 0.3) return null;
  const near = W.decks.filter(d => d.z1 > h.z - 1 && d.z0 - h.z < 30), pads = W.pads.filter(p => p.z > h.z - 1 && p.z - h.z < 30);
  if (!near.length && !pads.length) return null;
  const bad = lane => near.some(d => lane >= d.l0 && lane <= d.l1) || pads.some(p => p.lane === lane);
  const ok = [-1, 0, 1].filter(l => !bad(l));
  if (!ok.length || !bad(h.lane)) return null;
  return ok.sort((a, b) => Math.abs(a - h.lane) - Math.abs(b - h.lane))[0];
}

// ---------- a section's rows ----------
const BIG = 100;                                              // a heart lost, in the planner's coins; a wanted good is worth 1.5

/** What lies in each lane of the row at metre z: foes alive, things that block, things to pick up. */
function cellsAt(S, z) {
  const W = S.world, out = [[], [], []];
  for (const f of W.foes) if (f.alive && !f.spent && Math.abs(f.z - z) < 0.01) out[f.lane + 1].push(f);
  for (const o of W.obs) if (Math.abs(o.z - z) < 0.01) out[o.lane + 1].push(o);
  for (const p of W.pick) if (!p.taken && Math.abs(p.z - z) < 0.01) out[p.lane + 1].push(p);
  return out;
}

/** When the hero reaches metre z, in the run's seconds: the run is played forward in small steps (the pace comes back after a start or a hit). */
function arrival(S, z) {
  const m = S.mods || { v0: 10, v1: 16 }, dt = 1 / 60;
  let t = S.t, zz = S.hero.z, fwd = S.fwd;
  for (let n = 0; zz < z && n < 4000; n++) {
    fwd = Math.min(1, fwd + (1 - fwd) * (1 - Math.exp(-dt * 6)) + dt * 0.4);
    zz += (m.v0 + (m.v1 - m.v0) * (1 - Math.exp(-Math.max(0, zz) / 700))) * fwd * dt;
    t += dt;
  }
  return t;
}

/** How a lane fares in a row, for a hero who has `flip` and `token`: { cost, gain, out (the lane he ends in), flip, token }. */
function laneFares(S, cells, L, flip, token, t, sets = []) {
  const probe = { flip, token, t, set: Object.fromEntries(sets.map(k => [k, 1]).concat(Object.entries(S.set))) };
  let nsets = sets;
  let cost = 0, gain = 0, out = L, nflip = flip, ntoken = token;
  const kill = S.goal.kind === "kills" ? 1.2 : 0;                  // when foes are what is counted, a cut is worth going for
  const crabs = [-1, 0, 1].filter(l => cells[l + 1].some(f => f.kind === "crab"));
  const mine = crabs.includes(L);
  const near = crabs.filter(l => Math.abs(l - L) === 1);
  let eff = L;
  if (!mine && near.length === 1) { eff = near[0]; out = eff; cost += 0.4 - kill; }       // it is cut as it comes, and I am in its lane
  else if (near.length >= 1 && (mine || near.length > 1)) cost += BIG;               // one cut cannot answer two
  for (const it of cells[eff + 1]) {
    if (it.y0 !== undefined) {
      const margin = it.kind === "tide" ? [-0.2, 0, 0.2] : [0];
      if (margin.some(m => solid({ ...probe, t: t + m }, it))) cost += it.kind === "barrel" || it.kind === "beam" ? 0.2 : BIG;
    } else if (it.kind === "crab") cost += (it.heavy ? 0.6 : 0.3) - kill;
    else if (it.taken === false) {
      if (it.kind === "lever") { if (it.link) nsets = [...nsets, it.link]; else nflip ^= 1; }
      else if (it.kind === "token") ntoken = it.mark;
      else if (S.bill.bad.includes(it.kind)) cost += BIG / 2;
      else if (S.bill.want.includes(it.kind)) gain += 1.5;
      else gain += 0.1;
    }
  }
  return { cost, gain, out, flip: nflip, token: ntoken, sets: nsets };
}

/** The lane to be in for the next row, found by a search over all the rows to come: lane, lever and token are its state. */
export function planLane(S) {
  const h = S.hero, rows = S.world.rows.filter(z => z > h.z - 1.3);
  if (!rows.length) return null;
  let layer = new Map([[`${h.lane}|${S.flip}|${S.token}|`, { score: 0, first: null, e: h.lane, flip: S.flip, token: S.token, sets: [] }]]);
  rows.forEach((z, r) => {
    const cells = cellsAt(S, z), t = arrival(S, z), next = new Map();
    for (const st of layer.values()) for (const L of [-1, 0, 1]) {
      const o = laneFares(S, cells, L, st.flip, st.token, t, st.sets);
      const score = st.score + o.cost - o.gain + 0.05 * Math.abs(L - st.e);
      const key = `${o.out}|${o.flip}|${o.token}|${o.sets.join(",")}`, old = next.get(key);
      if (!old || score < old.score) next.set(key, { score, first: r === 0 ? L : st.first, e: o.out, flip: o.flip, token: o.token, sets: o.sets });
    }
    layer = next;
  });
  let best = null;
  for (const st of layer.values()) if (!best || st.score < best.score) best = st;
  return { lane: best.first, score: best.score, z: rows[0] };
}

/** Plays a section's rows: the lane planned, then the swipe each cell asks for at its moment. `st` keeps what it did. */
export function rowBot(S, st) {
  const h = S.hero, v = speed(S), W = S.world;
  if (h.lunge || S.pending.length || S.t < st.next) return false;
  const act = (dir, wait = 0.06) => {
    swipe(S, dir);
    st.next = S.t + wait;
    (st.log ||= []).push(`${S.t.toFixed(2)}:${dir}@l${h.lane},y${h.y.toFixed(1)}`); if (st.log.length > 8) st.log.shift();
    return true;
  };
  const ttc = z => (z - h.z) / v;
  // a bruiser thrown back comes again: it is finished before anything else, in its lane or the next
  const back = W.foes.find(f => f.alive && f.heavy && !W.rows.includes(f.z) && ttc(f.z) > 0 && ttc(f.z) < 1.2);
  if (back && h.mode !== "wall") {
    const t = ttc(back.z);
    if (back.lane === h.lane) return t <= 0.22 && !h.roll ? act("up") : false;
    if (Math.abs(back.lane - h.lane) === 1) return t <= 0.4 && t > 0.1 ? act(back.lane > h.lane ? "right" : "left") : false;
  }
  // a gap in the planks: jump so that the far side is reached (a jump from the very edge carries furthest)
  const gap = W.pits.find(p => p.gap && p.z1 > h.z && p.z0 - h.z < 20);
  if (gap) {
    if (h.mode === "run" && ttc(gap.z0) <= 0.07 && ttc(gap.z0) > 0) return act("up");
    return false;
  }
  const z = W.rows.find(z => z > h.z - 1.3);                    // a row is not passed until its cart is behind me
  if (z === undefined || z < h.z) return false;
  const row = cellsAt(S, z), t = ttc(z);
  // a gull one lane over that has wound up is about to dive: a roll goes under it
  const dive = W.foes.find(f => f.alive && !f.spent && f.kind === "gull" && !f.gate && f.ph >= 2 && ttc(f.z) > -0.1 && ttc(f.z) < 0.2 && Math.abs(f.lane - h.lane) <= 1);
  if (dive && h.mode === "run" && !h.roll) return act("down");
  const mine = row[h.lane + 1];
  const has = (cell, fn) => cell.some(fn);
  if (has(mine, f => f.kind === "crab") && t <= 0.2 && t > 0 && !h.roll) return act("up");           // (a roll already cuts it down)
  if (has(mine, o => o.kind === "barrel") && t <= 0.32 && t > 0.12 && h.mode === "run") return act("up");
  if (has(mine, o => o.kind === "beam") && t <= 0.28 && t > 0.05 && h.mode === "run" && !h.roll) return act("down");
  if (has(mine, p => p.kind === "amber" && !p.taken) && t <= 0.36 && t > 0.2 && h.mode === "run") return act("up");
  // a crab in the next lane, none in mine: cut it as it comes
  const near = [-1, 1].map(d => ({ d, c: row[h.lane + d + 1] })).filter(x => x.c && x.c.some(f => f.kind === "crab"));
  if (near.length === 1 && !has(mine, f => f.kind === "crab") && t <= 0.4 && t > 0.1) return act(near[0].d > 0 ? "right" : "left");
  // the lane
  if (!st.commit || st.commit.z !== z || st.commit.flip !== S.flip || st.commit.token !== S.token) {
    const plan = planLane(S);                                    // once chosen for a row the lane is kept, unless a lever or a token changes what the rows ask
    st.commit = { z, lane: plan ? plan.lane : null, flip: S.flip, token: S.token };
  }
  const plan = st.commit;
  if (plan.lane !== null && plan.lane !== h.lane && h.mode !== "wall") {
    const d = plan.lane > h.lane ? 1 : -1, into = row[h.lane + d + 1] || [];
    const crabInto = into.some(f => f.kind === "crab");
    if (t > 0.36 && (!crabInto || t > 0.62)) return act(d > 0 ? "right" : "left");
  }
  return false;
}

/** One tick of the right bot: the old one near a gate, a wall or a gap with gulls over it, the rows' bot elsewhere. */
export function botStep(S, st) {
  const z = S.hero.z, W = S.world;
  const old = W.decks.some(d => d.z1 > z - 1 && d.z0 - z < 30) || W.pads.some(p => p.z > z - 1 && p.z - z < 30) || W.gates.some(g => g.state === "open" && g.p0 - z < 60) || W.walls.some(w => w.z1 > z && w.z0 - z < 30) || W.pits.some(p => !p.gap && p.z1 > z && p.z0 - z < 28);
  return old || (st.slamAfter && S.hero.mode === "air") ? bot(S, st) : rowBot(S, st);
}

/** Plays a section from its start with the rows' bot, and the old one for the pieces of the old quay; returns the run. */
export function playSection(def, { seed = 3, deal = null, launch = true, limit = 200000 } = {}) {
  const S = newGame({ seed, deal, launch, section: def });
  const st = { next: 0, slamAfter: 0 };
  const DT = 1 / 120;
  let steps = 0;
  while (!S.over && steps++ < limit) {
    botStep(S, st);
    step(S, DT);
    if (process.env.COURIER_DEBUG) for (const e of S.ev) if (["hurt", "fall", "clang", "seized"].includes(e.type)) console.log(`   sec ${def.id} t=${S.t.toFixed(2)} z=${S.hero.z.toFixed(1)} ${e.type} lane=${S.hero.lane} y=${S.hero.y.toFixed(2)} swipes ${(st.log || []).join(" ")}`);
    S.ev.length = 0;
  }
  return S;
}
