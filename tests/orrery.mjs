// Orrery's rules (orrery-engine.js): the deal from a seed (hoops, tips, planets, none in line, the first planet foretold),
// angles and directions from the sun, what an alignment is (three to five planets of a colour, one to a hoop, in one
// direction from the sun: along the axle, or on hoops tipped alike), the hoops turning at the speed they are set to and
// holding still, tipping, an alignment clearing after a blink, its points and the combo, the planets landing every few
// seconds (foretold, quicker as the game goes on), the end when there's no room, a game saved and opened again, and whole
// games played out.
import { RINGS, PLACES, COLOURS, START, TAU, STEP, DEG, SPEED, VMAX, TILT, TILT_MAX, START_SPEEDS, ACCEL, TILT_EASE, TOL, DWELL, AWARD, COMBO_WINDOW, FORETELL, gap, multiplier, norm, between, id, angleOf, room, planets, dirOf, sep, clusters, newGame, valid, copy, grab, turnTo, release, setSpeed, setTilt, step } from "../orrery-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
/** The sky drawn by hand: every hoop level, still, and at angle 0, nothing landing; then put planets on it. */
function sky(tilts = [0, 0, 0, 0, 0]) {
  const s = newGame(1);
  s.rings.forEach((r, k) => { r.places.fill(-1); r.a = 0; r.w = r.v = 0; r.held = false; r.tilt = r.tiltTo = tilts[k]; });
  s.next.due = 1e9;
  s.locks = [];
  return s;
}
/** Planets of a colour in line at angle `at` (a hoop's place `place` turned to it, off by `off`): [[ring, place, off?]…]. */
function line(s, colour, at, ...marks) {
  for (const [ring, place, off = 0] of marks) { s.rings[ring].places[place] = colour; s.rings[ring].a = norm(at - place * STEP + off); }
  return s;
}
const run = (s, seconds, dt = 0.05) => { const ev = []; for (let t = 0; t < seconds - 1e-9; t += dt) ev.push(...step(s, dt)); return ev; };
const MIXED = [-30 * DEG, 0, 45 * DEG, 15 * DEG, -45 * DEG];     // five different tips

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.rings) !== JSON.stringify(c.rings), "the same seed deals the same orrery, another seed another");
  check(a.v === 3 && a.rings.length === RINGS && a.rings.every((r, k) => r.places.length === PLACES && r.w === START_SPEEDS[k] && r.v === r.w && !r.held && r.a >= 0 && r.a < TAU) && a.t === 0 && a.score === 0 && !a.over && valid(a), `${RINGS} hoops of ${PLACES} places, each at its own speed and anywhere round`);
  check([...Array(40).keys()].every(k => { const t = newGame(k).rings.map(r => Math.round(r.tilt / DEG)).sort((x, y) => x - y); return t.join() === "-30,-15,0,15,30"; }) && newGame(3).rings.every(r => r.tilt === r.tiltTo), "each hoop begins tipped differently: -30, -15, level, 15 and 30 degrees, in some order");
  check(planets(a) === START && room(a) === RINGS * PLACES - START && [...Array(40).keys()].every(k => planets(newGame(k)) === START && clusters(newGame(k)).length === 0), `${START} planets in places, none in line to begin with`);
  check([...Array(200).keys()].every(k => { const n = Array(COLOURS).fill(0); for (const r of newGame(k).rings) for (const x of r.places) if (x >= 0) n[x]++; return Math.min(...n) >= 2; }), "every colour dealt at least twice, so each can line up");
  check(a.next.ring >= 0 && a.rings[a.next.ring].places[a.next.place] === -1 && a.next.colour >= 0 && a.next.colour < COLOURS && near(a.next.due, gap(0)), "the first planet foretold, for an empty place, to land a gap in");
  check(SPEED.every((w, k) => k === 0 ? w === 0 : w > SPEED[k - 1]) && VMAX === SPEED[3] && TAU / SPEED[3] > 20 && TAU / SPEED[1] > 100 && START_SPEEDS.every(w => w !== 0 && Math.abs(w) <= VMAX) && new Set(START_SPEEDS).size === RINGS, `speeds from a turn in ${(TAU / SPEED[1]).toFixed(0)} seconds to one in ${(TAU / SPEED[3]).toFixed(0)}: slow, each hoop starting at its own`);
  check(TILT.every((t, k) => k === 0 ? t === 0 : t > TILT[k - 1]) && TILT_MAX === 45 * DEG, "tips of 15, 30 and 45 degrees");
}

// ---------- angles and directions ----------
{
  check(near(norm(-0.5), TAU - 0.5) && near(norm(TAU + 1), 1) && norm(0) === 0 && near(between(0.1, TAU - 0.1), -0.2) && near(between(TAU - 0.1, 0.1), 0.2) && near(between(1, 1), 0), "angles wrap round twelve o'clock; the turn between two is the short way");
  const s = sky();
  s.rings[2].a = 1;
  check(near(angleOf(s, 2, 3), 1 + 3 * STEP) && near(angleOf(s, 2, 11), norm(1 + 11 * STEP)) && id(2, 3) === 2 * PLACES + 3, "a place is a twelfth of a turn on from the last, from the hoop's own twelve o'clock");
  const is = (d, x, y, z) => near(d[0], x, 1e-9) && near(d[1], y, 1e-9) && near(d[2], z, 1e-9);
  check(MIXED.every(t => is(dirOf(t, 0), 0, 0, -1) && is(dirOf(t, Math.PI), 0, 0, 1)), "every hoop, however it is tipped, is at the same point at twelve o'clock and at six: the axle");
  check(is(dirOf(0, Math.PI / 2), 1, 0, 0) && is(dirOf(30 * DEG, Math.PI / 2), Math.cos(30 * DEG), Math.sin(30 * DEG), 0) && dirOf(30 * DEG, Math.PI / 2)[1] > 0 && dirOf(-30 * DEG, Math.PI / 2)[1] < 0, "tipped, a hoop lifts its three o'clock side (and lowers its nine)");
  check([0.3, 1.7, 4].every(a => MIXED.every(t => near(Math.hypot(...dirOf(t, a)), 1))) && near(sep([1, 0, 0], [0, 1, 0]), Math.PI / 2) && near(sep([0, 0, 1], [0, 0, -1]), Math.PI) && sep([0, 1, 0], [0, 1, 0]) === 0, "a direction is a unit vector, and the angle between two is the angle at the sun");
  check(near(sep(dirOf(0.3, 1), dirOf(-0.3, 1)), sep(dirOf(-0.3, 1), dirOf(0.3, 1))) && sep(dirOf(0.3, 1), dirOf(-0.3, 1)) > 0.3, "hoops tipped differently are apart away from the axle");
}

// ---------- alignments ----------
{
  const gate = a => { const s = sky(MIXED); return line(s, 2, a, [0, 3], [1, 7], [2, 0]); };
  const c = clusters(gate(0));
  check(c.length === 1 && c[0].colour === 2 && c[0].ids.join() === [id(0, 3), id(1, 7), id(2, 0)].join() && near(c[0].dir[2], -1, 1e-9) && c[0].spread < 1e-9, "three of a colour at twelve o'clock, from three hoops tipped differently: in line along the axle");
  const c6 = clusters(gate(Math.PI));
  check(c6.length === 1 && near(c6[0].dir[2], 1, 1e-9), "and at six o'clock");
  check(clusters(gate(1.1)).length === 0 && clusters(gate(Math.PI / 2)).length === 0, "away from the axle, hoops tipped differently are not in line");
  const flat = line(sky([0.3, 0.3, 0.3, 0, 0]), 1, 1.1, [0, 2], [1, 5], [2, 9]);
  check(clusters(flat).length === 1 && clusters(flat)[0].spread < 1e-9, "hoops tipped alike are in line anywhere round");
  const nearly = line(sky([0.3, 0.3 + 0.03, 0.3 - 0.03, 0, 0]), 1, 1.1, [0, 2], [1, 5], [2, 9]);
  check(clusters(nearly).length === 1 && clusters(line(sky([0.3, 0.3 + 0.4, 0.3, 0, 0]), 1, 1.1, [0, 2], [1, 5], [2, 9])).length === 0, "hoops tipped nearly alike are too, but a few degrees more and they aren't");
  check(clusters(line(sky(), 0, 1, [0, 3], [1, 7], [2, 0], [3, 9])).length === 1 && clusters(line(sky(), 0, 1, [0, 3], [1, 7], [2, 0], [3, 9], [4, 4]))[0].ids.length === 5 && clusters(line(sky(), 0, 1, [1, 2], [2, 2], [4, 9])).length === 1, "any hoops: four of them, or all five");
  check(clusters(line(sky(MIXED), 3, 0, [0, 3], [1, 7], [2, 0], [3, 1], [4, 11]))[0].ids.length === 5, "all five along the axle");
  check(clusters(line(sky(), 1, 1, [0, 3], [1, 7])).length === 0, "two are not an alignment");
  const mixed = line(sky(), 1, 1, [0, 3], [1, 7]);
  line(mixed, 3, 1, [2, 0]);
  check(clusters(mixed).length === 0, "three of different colours aren't");
  // on one tip the places lie on one circle, so the angle between planets is the turn between them
  const level = off => line(sky(), 0, 1, [0, 3, off[0] * TOL], [1, 7, off[1] * TOL], [2, 0, off[2] * TOL]);
  check(clusters(level([-0.9, 0, 0.9])).length === 1 && clusters(level([-1.2, 0, 1.2])).length === 0, `in line means within ${(TOL / DEG).toFixed(1)} degrees of the middle: just in, and just out`);
  check(clusters(level([0.5, 0, -0.5])).length === 1 && clusters(level([0, 0, 0])).length === 1, "and a ragged line is one");
  check(clusters(line(sky(), 0, 0, [0, 0, TAU - TOL * 0.9], [1, 0, TOL * 0.9], [2, 0])).length === 1, "across twelve o'clock too");
  check(!clusters(line(line(sky(), 0, 1, [0, 3], [1, 7]), 0, 1 + 0.5, [2, 0])).length, "the third a long way off, no alignment");
  const far = line(sky(), 0, 1, [0, 3], [1, 7], [2, 0]);
  far.rings[3].places[2] = 0; far.rings[3].a = 1 + 0.12 - 2 * STEP;     // a fourth, too far from the middle of the three
  check(clusters(far).length === 1 && clusters(far)[0].ids.length === 3, "a planet too far off is left out, and the others still count");
  // a second colour on the same hoops, three places on (so the hoops needn't move), and on two more hoops
  const two = line(sky(), 0, 1, [0, 3], [1, 7], [2, 0]);
  two.rings[0].places[6] = 3;
  two.rings[1].places[10] = 3;
  line(two, 3, 1 + 3 * STEP, [3, 2], [4, 5]);
  const cs = clusters(two);
  check(cs.length === 2 && cs[0].ids.length === 4 && cs[0].colour === 3 && cs[1].ids.length === 3 && cs[1].colour === 0 && !cs[0].ids.some(x => cs[1].ids.includes(x)), "two at once, the larger first, sharing no planet");
}

// ---------- the hoops turn and tip ----------
{
  const s = newGame(3), a0 = s.rings.map(r => r.a);
  step(s, 1);
  check(s.rings.every((r, k) => near(norm(a0[k] + START_SPEEDS[k]), r.a, 1e-9)) && near(s.t, 1), "each hoop turns at the speed it is set to, clockwise where it's positive");
  const h = sky(), w0 = h.rings[1].a;
  h.rings[1].w = h.rings[1].v = 1;
  h.rings[1].held = true;
  run(h, 3);
  check(h.rings[1].a === w0, "a hoop with a finger on it is the finger's: it doesn't turn by itself");
  const t = sky();
  t.rings[0].w = t.rings[0].v = 0.1;
  setSpeed(t, 0, 0);
  const a1 = t.rings[0].a;
  run(t, ACCEL, 0.01);
  check(near(t.rings[0].v, 0.1 * Math.exp(-1), 0.002) && near(t.rings[0].a - a1, 0.1 * ACCEL * (1 - Math.exp(-1)), 0.002), `set to a new speed, a hoop eases to it: 63% of the way after ${ACCEL} seconds`);
  run(t, 4, 0.05);
  const rest = t.rings[0].a, drift = rest - a1;
  run(t, 6, 0.05);
  check(t.rings[0].v === 0 && t.rings[0].a === rest && drift > 0 && drift < 0.1 * ACCEL * 1.01, `held, it stands still (after coasting ${(drift / DEG).toFixed(1)} degrees), and stays where it is however long`);
  const u = sky();
  setSpeed(u, 1, 5); setSpeed(u, 2, -5);
  check(u.rings[1].w === VMAX && u.rings[2].w === -VMAX, "no faster than the most a hoop can be sent");
  const g = sky();
  grab(g, 1);
  turnTo(g, 1, TAU + 0.25);
  check(g.rings[1].held && g.rings[1].v === 0 && near(g.rings[1].a, 0.25) && (release(g, 1, 0.2), !g.rings[1].held && g.rings[1].w === 0.2 && g.rings[1].v === 0.2) && (release(g, 1, 9), g.rings[1].w === VMAX), "a finger grabs, turns to an angle (wrapped), and lets go at a speed");
  const big = newGame(3);
  run(big, 20);
  check(big.rings.every(r => r.a >= 0 && r.a < TAU), "angles stay within one turn");
  const tip = sky();
  setTilt(tip, 2, 20 * DEG);
  run(tip, TILT_EASE, 0.01);
  check(near(tip.rings[2].tilt, 20 * DEG * (1 - Math.exp(-1)), 0.002) && tip.rings[2].tiltTo === 20 * DEG, `a hoop tips to the angle it is set to, 63% of the way after ${TILT_EASE} seconds`);
  run(tip, 4);
  check(tip.rings[2].tilt === 20 * DEG && (setTilt(tip, 2, 2), tip.rings[2].tiltTo === TILT_MAX) && (setTilt(tip, 2, -2), tip.rings[2].tiltTo === -TILT_MAX), "and gets there; no more than 45 degrees either way");
  const stay = line(sky(MIXED), 0, 0, [0, 3], [1, 7], [2, 0]);
  setTilt(stay, 0, 45 * DEG); setTilt(stay, 1, -45 * DEG);
  const dir0 = clusters(stay)[0].dir;
  run(stay, 0.1 + 0.0, 0.01);
  const during = clusters(stay);
  check(during.length === 1 && sep(during[0].dir, dir0) < 1e-9, "tipping a hoop doesn't move a planet at twelve or six: an alignment on the axle stands while its hoops tip");
}

// ---------- an alignment clears ----------
{
  const s = line(sky(), 1, 2, [0, 3], [1, 7], [2, 0]);
  step(s, DWELL / 2);
  check(s.live.clusters.length === 1 && near(s.live.clusters[0].progress, 0.5, 0.02) && s.live.clusters[0].n === 3 && s.score === 0 && planets(s) === 3, "an alignment charges for a blink: half way after half of it");
  const ev = run(s, DWELL * 2, 0.05);
  const lock = ev.find(e => e.type === "lock");
  check(DWELL <= 0.15 && lock && lock.n === 3 && lock.colour === 1 && lock.gain === AWARD[3] && lock.combo === 1 && sep(lock.dir, dirOf(0, 2)) < 1e-9 && lock.members.length === 3 && planets(s) === 0 && s.score === AWARD[3] && s.cleared === 3 && s.aligned === 1 && !s.live.clusters.length,
    `held for ${DWELL} seconds it clears: ${AWARD[3]} for three`);
  const four = run(line(sky(), 0, 1, [0, 1], [1, 2], [2, 3], [3, 4]), 1).find(e => e.type === "lock"), five = run(line(sky(), 0, 1, [0, 1], [1, 2], [2, 3], [3, 4], [4, 5]), 1).find(e => e.type === "lock");
  check(four.n === 4 && four.gain === AWARD[4] && five.n === 5 && five.gain === AWARD[5] && AWARD[5] > 2 * AWARD[4] && AWARD[4] > 2 * AWARD[3], `four ${AWARD[4]}, five ${AWARD[5]}: each worth well more than the one before`);
  const broken = line(sky(), 1, 2, [0, 3], [1, 7], [2, 0]);
  step(broken, 0.05);
  broken.rings[2].a += 0.3;                                   // a hoop is moved away
  step(broken, 0.05);
  broken.rings[2].a -= 0.3;                                   // and back: starting again
  step(broken, 0.05);
  check(broken.live.clusters.length === 1 && broken.live.clusters[0].progress < 0.6 && broken.score === 0 && planets(broken) === 3 && run(broken, DWELL * 2).some(e => e.type === "lock"), "an alignment that breaks has to start again");
  const grows = line(sky(), 1, 2, [0, 3], [1, 7], [2, 0]);
  step(grows, DWELL * 0.6);
  grows.rings[3].places[5] = 1;
  grows.rings[3].a = norm(2 - 5 * STEP);
  step(grows, DWELL * 0.3);
  check(grows.live.clusters.length === 1 && grows.live.clusters[0].n === 4 && grows.live.clusters[0].progress > 0.6, "a fourth joining keeps what it had charged");
  const ends = run(grows, 0.5).find(e => e.type === "lock");
  check(ends.n === 4 && planets(grows) === 0, "and all four clear together");
}

// ---------- very fast, opposite ways ----------
{
  // three hoops tipped alike meet at one angle after two seconds: two going very fast one way, one very fast the other
  const s = sky([0.2, 0.2, 0.2, 0, 0]), meet = 1.3, T = 2;
  const marks = [[0, 3, 1], [1, 7, -1], [2, 0, 1]];
  for (const [ring, place, dir] of marks) {
    s.rings[ring].places[place] = 0;
    s.rings[ring].a = norm(meet - place * STEP - dir * VMAX * T);
    s.rings[ring].w = s.rings[ring].v = dir * VMAX;
  }
  const ev = run(s, 4, 0.02), lock = ev.find(e => e.type === "lock");
  check(lock && lock.n === 3 && s.score === AWARD[3] && s.t > T - 0.5 && s.t < T + 0.5 + 4, "one hoop going very fast one way and two the other clear on passing: no stopping, no hand to place them");
  const slow = sky([0.2, 0.2, 0.2, 0, 0]);
  for (const [ring, place, dir] of marks) {
    slow.rings[ring].places[place] = 0;
    slow.rings[ring].a = norm(meet - place * STEP - dir * SPEED[1] * T);
    slow.rings[ring].w = slow.rings[ring].v = dir * SPEED[1];
  }
  check(run(slow, 4, 0.02).some(e => e.type === "lock"), "slow ones do too: they stay in line longer");
}

// ---------- the score and the combo ----------
{
  check(multiplier(0) === 1 && multiplier(1) === 1 && multiplier(2) === 1.25 && multiplier(3) === 1.5 && multiplier(30) === 3, "the multiplier: none for the first, a quarter more for each in a run, three times at most");
  const s = line(sky(), 0, 1, [0, 1], [1, 2], [2, 3]);
  s.rings[0].places[7] = 2; s.rings[1].places[8] = 2; s.rings[2].places[9] = 2;    // half a turn on from the first three: another alignment, opposite
  const ev = run(s, 1).filter(e => e.type === "lock");
  const [first, second] = ev;
  check(ev.length === 2 && first.combo === 1 && second.combo === 2 && first.gain === AWARD[3] && second.gain === Math.round(AWARD[3] * 1.25) && s.score === first.gain + second.gain, "two in a run: the second a quarter better");
  const late = line(sky(), 0, 1, [0, 1], [1, 2], [2, 3]);
  run(late, 1);
  late.t += COMBO_WINDOW + 1;
  line(late, 2, 4, [0, 5], [1, 6], [2, 7]);
  const again = run(late, 1).find(e => e.type === "lock");
  check(again.combo === 1 && again.gain === AWARD[3], `after ${COMBO_WINDOW} seconds the run is over`);
}

// ---------- the planets land ----------
{
  check(gap(0) === 6.5 && near(gap(80), 5.5) && gap(10000) === 2.4 && [0, 30, 60, 120, 240, 300, 400].every((t, k, a) => k === 0 || gap(t) <= gap(a[k - 1])), "a planet every six and a half seconds at first, quicker as the game goes on, to a floor of 2.4");
  const s = newGame(9), due = s.next.due, { ring, place, colour } = s.next, before = planets(s);
  s.rings.forEach(r => { r.held = true; });
  const ev = run(s, due - 0.05, 0.05);
  check(!ev.some(e => e.type === "land") && planets(s) === before, "not before it's due");
  const ev2 = run(s, 0.2, 0.05), landed = ev2.find(e => e.type === "land");
  check(landed && landed.ring === ring && landed.place === place && landed.colour === colour && s.rings[ring].places[place] === colour && planets(s) === before + 1, "it lands in the place foretold, in its hoop's own frame (so it turns with it)");
  check(s.next.due > due && s.next.due - s.t <= gap(s.t) && s.next.due - s.t > gap(s.t) - 0.25 && s.rings[s.next.ring].places[s.next.place] === -1, "and the next is foretold, for an empty place");
  check(FORETELL > 0 && FORETELL < gap(0), "the planet foretold is shown a moment ahead: not for the whole of the first, easy gaps");
  // on a full hoop the newcomer finds another
  const f = sky();
  f.rings[0].places.fill(0);
  f.next = { due: 0.1, ring: 0, place: 4, colour: 1 };
  const ev3 = run(f, 0.2, 0.05), l = ev3.find(e => e.type === "land");
  check(l && l.ring !== 0 && f.rings[l.ring].places[l.place] === 1, "a place taken in the meantime sends it to a free one");
  // no room
  const full = newGame(5);
  full.rings.forEach(r => { r.places.fill(0); r.held = true; });
  full.next.due = 0.1;
  const ev4 = run(full, 0.3, 0.05);
  check(ev4.some(e => e.type === "over") && full.over && room(full) === 0, "no place for the next planet ends the game");
  const t0 = full.t;
  check(step(full, 1).length === 0 && full.t === t0, "and nothing goes on after");
  const keep = newGame(6);
  keep.rings.forEach(r => { r.held = true; });
  let lands = 0, last = 0, gapsOk = true;
  for (let t = 0; t < 120; t += 0.05) { for (const e of step(keep, 0.05)) if (e.type === "land") { if (lands && keep.t - last > gap(keep.t) + 0.3) gapsOk = false; last = keep.t; lands++; } if (keep.over) break; }
  check(lands >= 18 && gapsOk, `${lands} planets in two minutes, one every few seconds`);
}

// ---------- saved and opened again ----------
{
  const s = newGame(21);
  turnTo(s, 1, 1);
  setSpeed(s, 1, SPEED[2]);
  setTilt(s, 3, 30 * DEG);
  s.rings[1].held = false;
  run(s, 7);
  const saved = JSON.parse(JSON.stringify(s)), a = copy(s), b = JSON.parse(JSON.stringify(saved));
  run(a, 10);
  run(b, 10);
  check(valid(saved) && JSON.stringify(a) === JSON.stringify(b) && !("live" in copy(s) && copy(s).live), "a game saved and opened again goes on as it would have");
  const keep = JSON.stringify(s);
  run(copy(s), 5);
  check(JSON.stringify(s) === keep, "a copy to try things on leaves the game as it was");
  check(!valid(null) && !valid({ v: 1, places: [] }) && !valid({ ...saved, v: 2 }) && !valid({ ...saved, rings: saved.rings.slice(1) }) && !valid({ ...saved, next: null }) && !valid({ ...saved, rings: saved.rings.map(r => ({ ...r, tiltTo: undefined })) }), "a game from the earlier orrery, or a broken one, isn't taken");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  const idle = seed => { const s = newGame(seed); while (!s.over && s.t < 900) step(s, 1 / 20); return s; };
  // a player with perfect hands, one alignment at a time: every `look` seconds finds the colour with most hoops and sets
  // each one's nearest planet to twelve o'clock, held there (what the buttons do, only quicker); everything else is left going
  const player = (look, seed) => {
    const s = newGame(seed);
    let next = 1;
    while (!s.over && s.t < 900) {
      if (s.t >= next) {
        next = s.t + look;
        let best = null;
        for (let c = 0; c < COLOURS; c++) {
          const per = s.rings.map((r, ring) => ({ ring, place: r.places.indexOf(c) })).filter(x => x.place >= 0);
          if (per.length >= 3 && (!best || per.length > best.length)) best = per;
        }
        if (best) for (const { ring, place } of best) { grab(s, ring); turnTo(s, ring, -place * STEP); release(s, ring, 0); }
      }
      step(s, 1 / 20);
    }
    return s;
  };
  const idles = [...Array(6).keys()].map(k => idle(40 + k));
  check(idles.every(s => s.over) && median(idles.map(s => s.t)) > 150 && median(idles.map(s => s.t)) < 450 && median(idles.map(s => s.score)) <= 2000, `turning nothing: full after about ${median(idles.map(s => s.t)).toFixed(0)} seconds, a few points by chance`);
  const played = [...Array(6).keys()].map(k => player(4, 40 + k));
  check(median(played.map(s => s.t)) > 2 * median(idles.map(s => s.t)) && median(played.map(s => s.score)) > 5000, `setting hoops to a place every few seconds lasts much longer (${median(played.map(s => s.t)).toFixed(0)} seconds, ${median(played.map(s => s.score)).toLocaleString("en-GB")} points)`);
  check(played.every(s => s.rings.every(r => r.a >= 0 && r.a < TAU && Math.abs(r.tilt) <= TILT_MAX + 1e-9 && Math.abs(r.v) <= VMAX + 1e-9)), "through whole games the hoops stay within a turn, a tip and a speed");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("orrery: the deal, directions, alignments on the axle and on hoops tipped alike, hoops turning, holding and tipping, clearing, the combo, planets landing, the end, saving, whole games");
