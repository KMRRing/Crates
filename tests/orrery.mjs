// Orrery's rules (orrery-engine.js): the deal from a seed (rings, planets, none in line, the first planet foretold),
// angles, what an alignment is (three to five planets of a colour, one to a ring, within a few degrees of each other
// round the sun), the rings turning at their own speeds and drifting back to them after a hand, an alignment charging
// and clearing after a moment, its points and the combo, the planets landing every few seconds (foretold, quicker as
// the game goes on), the end when there's no room, a game saved and opened again, and whole games played out.
import { RINGS, PLACES, COLOURS, START, TAU, STEP, PACE, SPRING, WMAX, TOL, DWELL, AWARD, COMBO_WINDOW, FORETELL, gap, multiplier, norm, between, id, angleOf, room, planets, clusters, newGame, valid, copy, grab, turnTo, release, step } from "../orrery-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
/** The sky drawn by hand: every ring held still at angle 0 and nothing landing; then put planets on it. */
function sky() {
  const s = newGame(1);
  for (const r of s.rings) { r.places.fill(-1); r.a = 0; r.w = 0; r.held = true; }
  s.next.due = 1e9;
  s.locks = [];
  return s;
}
/** Planets of a colour in line at angle `at` (a ring's place `place` turned to it, off by `off`): [[ring, place, off?]…]. */
function line(s, colour, at, ...marks) {
  for (const [ring, place, off = 0] of marks) { s.rings[ring].places[place] = colour; s.rings[ring].a = norm(at - place * STEP + off); }
  return s;
}
const run = (s, seconds, dt = 0.05) => { const ev = []; for (let t = 0; t < seconds - 1e-9; t += dt) ev.push(...step(s, dt)); return ev; };

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.rings) !== JSON.stringify(c.rings), "the same seed deals the same orrery, another seed another");
  check(a.v === 2 && a.rings.length === RINGS && a.rings.every((r, k) => r.places.length === PLACES && r.w === PACE[k] && !r.held && r.a >= 0 && r.a < TAU) && a.t === 0 && a.score === 0 && !a.over && valid(a), `${RINGS} rings of ${PLACES} places, each at its own pace and anywhere round`);
  check(planets(a) === START && room(a) === RINGS * PLACES - START && [...Array(40).keys()].every(k => planets(newGame(k)) === START && clusters(newGame(k)).length === 0), `${START} planets in places, none in line to begin with`);
  check([...Array(200).keys()].every(k => { const n = Array(COLOURS).fill(0); for (const r of newGame(k).rings) for (const x of r.places) if (x >= 0) n[x]++; return Math.min(...n) >= 2; }), "every colour dealt at least twice, so each can line up");
  check(a.next.ring >= 0 && a.rings[a.next.ring].places[a.next.place] === -1 && a.next.colour >= 0 && a.next.colour < COLOURS && near(a.next.due, gap(0)), "the first planet foretold, for an empty place, to land a gap in");
  const pairs = PACE.flatMap((x, i) => PACE.slice(i + 1).map(y => Math.abs(x - y)));
  check(Math.min(...pairs) >= 0.28 - 1e-9 && PACE.every((w, k) => k === 0 || Math.sign(w) !== Math.sign(PACE[k - 1]) || w === PACE[k]) && Math.abs(PACE[0]) > Math.abs(PACE[RINGS - 1]) && 2 * TOL / Math.min(...pairs) < DWELL, "the paces: inner fastest, no two near enough to line up by themselves for as long as it takes to clear");
}

// ---------- angles ----------
{
  check(near(norm(-0.5), TAU - 0.5) && near(norm(TAU + 1), 1) && norm(0) === 0 && near(between(0.1, TAU - 0.1), -0.2) && near(between(TAU - 0.1, 0.1), 0.2) && near(between(1, 1), 0), "angles wrap round twelve o'clock; the turn between two is the short way");
  const s = sky();
  s.rings[2].a = 1;
  check(near(angleOf(s, 2, 3), 1 + 3 * STEP) && near(angleOf(s, 2, 11), norm(1 + 11 * STEP)) && id(2, 3) === 2 * PLACES + 3, "a place is a twelfth of a turn on from the last, from the ring's own twelve o'clock");
}

// ---------- alignments ----------
{
  const three = line(sky(), 2, 1, [0, 3], [1, 7], [2, 0]);
  const c = clusters(three);
  check(c.length === 1 && c[0].colour === 2 && c[0].ids.join() === [id(0, 3), id(1, 7), id(2, 0)].join() && near(c[0].angle, 1) && c[0].spread < 1e-9, "three of a colour on a line out from the sun, from three rings, however their places go");
  check(clusters(line(sky(), 0, 1, [1, 2], [2, 2], [4, 9])).length === 1 && clusters(line(sky(), 0, 1, [0, 2], [1, 2], [2, 2], [3, 2])).length === 1 && clusters(line(sky(), 0, 1, [0, 2], [1, 2], [2, 2], [3, 2], [4, 2]))[0].ids.length === 5, "any rings: or four of them, or all five");
  check(clusters(line(sky(), 1, 1, [0, 3], [1, 7])).length === 0, "two are not an alignment");
  const mixed = line(sky(), 1, 1, [0, 3], [1, 7]);
  line(mixed, 3, 1, [2, 0]);
  check(clusters(mixed).length === 0, "three of different colours aren't");
  const within = line(sky(), 0, 1, [0, 3], [1, 7, TOL * 1.8], [2, 0, -TOL * 0.1]), apart = line(sky(), 0, 1, [0, 3], [1, 7, TOL * 2.3], [2, 0]);
  check(clusters(within).length === 1 && clusters(apart).length === 0, `in line means within ${(2 * TOL * 180 / Math.PI).toFixed(1)} degrees of each other: just in, and just out`);
  check(clusters(line(sky(), 0, 0, [0, 0, TAU - TOL * 0.9], [1, 0, TOL * 0.9], [2, 0])).length === 1, "across twelve o'clock too");
  check(clusters(line(sky(), 0, 1, [0, 3], [1, 7], [2, 0])).length === 1 && !clusters(line(line(sky(), 0, 1, [0, 3], [1, 7]), 0, 1 + 0.5, [2, 0])).length, "the third a long way off, no alignment");
  // a second colour on the same rings, three places on (so the rings needn't move), and on two more rings
  const two = line(sky(), 0, 1, [0, 3], [1, 7], [2, 0]);
  two.rings[0].places[6] = 3;
  two.rings[1].places[10] = 3;
  line(two, 3, 1 + 3 * STEP, [3, 2], [4, 5]);
  const cs = clusters(two);
  check(cs.length === 2 && cs[0].ids.length === 4 && cs[0].colour === 3 && cs[1].ids.length === 3 && cs[1].colour === 0, "two at once, the larger first");
}

// ---------- the rings turn ----------
{
  const s = newGame(3), a0 = s.rings.map(r => r.a);
  step(s, 1);
  check(s.rings.every((r, k) => near(norm(a0[k] + PACE[k]), r.a, 1e-9)) && near(s.t, 1), "each ring turns at its own pace, clockwise where it's positive");
  const h = sky(), w0 = h.rings[1].a;
  h.rings[1].w = 1;
  run(h, 3);
  check(h.rings[1].a === w0, "a ring with a finger on it is the finger's: it doesn't turn by itself");
  const t = newGame(3);
  turnTo(t, 0, 2.5, 0);
  release(t, 0, 0);
  const still = t.rings[0].a;
  step(t, 0.05);
  const after = t.rings[0];
  check(near(still, 2.5) && after.w > 0 && after.w < 0.05 && after.a > still, "let go still, a ring starts to go again, slowly (a mainspring)");
  const u = newGame(3);
  release(u, 0, 0);
  run(u, SPRING, 0.05);
  check(near(u.rings[0].w, PACE[0] * (1 - Math.exp(-1)), 0.01), `after ${SPRING} seconds it has come back 63% of the way to its pace`);
  const f = newGame(3);
  turnTo(f, 2, 1, 9);
  check(f.rings[2].w === WMAX && (turnTo(f, 2, 1, -9), f.rings[2].w === -WMAX), "no faster than the most a ring can be sent");
  const g = newGame(3);
  grab(g, 1);
  turnTo(g, 1, TAU + 0.25, 0.3);
  check(g.rings[1].held && near(g.rings[1].a, 0.25) && g.rings[1].w === 0.3 && (release(g, 1, 0.4), !g.rings[1].held && g.rings[1].w === 0.4), "a finger grabs, turns to an angle (wrapped) at a speed, and lets go with it");
  const big = newGame(3);
  run(big, 20);
  check(big.rings.every(r => r.a >= 0 && r.a < TAU), "angles stay within one turn");
}

// ---------- an alignment charges and clears ----------
{
  const s = line(sky(), 1, 2, [0, 3], [1, 7], [2, 0]);
  step(s, DWELL / 2);
  check(s.live.clusters.length === 1 && near(s.live.clusters[0].progress, 0.5, 0.02) && s.live.clusters[0].n === 3 && s.score === 0 && planets(s) === 3, "an alignment charges while it holds: half way after half the time");
  const ev = run(s, DWELL, 0.05);
  const lock = ev.find(e => e.type === "lock");
  check(lock && lock.n === 3 && lock.colour === 1 && lock.gain === AWARD[3] && lock.combo === 1 && near(lock.angle, 2) && lock.members.length === 3 && planets(s) === 0 && s.score === AWARD[3] && s.cleared === 3 && s.aligned === 1 && !s.live.clusters.length,
    `held for ${DWELL} seconds it clears: ${AWARD[3]} for three`);
  const four = run(line(sky(), 0, 1, [0, 1], [1, 2], [2, 3], [3, 4]), 1).find(e => e.type === "lock"), five = run(line(sky(), 0, 1, [0, 1], [1, 2], [2, 3], [3, 4], [4, 5]), 1).find(e => e.type === "lock");
  check(four.n === 4 && four.gain === AWARD[4] && five.n === 5 && five.gain === AWARD[5] && AWARD[5] > 2 * AWARD[4] && AWARD[4] > 2 * AWARD[3], `four ${AWARD[4]}, five ${AWARD[5]}: each worth well more than the one before`);
  const broken = line(sky(), 1, 2, [0, 3], [1, 7], [2, 0]);
  step(broken, 0.3);
  broken.rings[2].a += 0.3;                                   // a ring is moved away
  step(broken, 0.05);
  broken.rings[2].a -= 0.3;                                   // and back: starting again
  step(broken, 0.05);
  check(!broken.live.clusters.length === false && broken.live.clusters[0].progress < 0.3 && broken.score === 0, "an alignment that breaks has to start again");
  const grows = line(sky(), 1, 2, [0, 3], [1, 7], [2, 0]);
  step(grows, DWELL * 0.6);
  grows.rings[3].places[5] = 1;
  grows.rings[3].a = norm(2 - 5 * STEP);
  step(grows, 0.05);
  check(grows.live.clusters.length === 1 && grows.live.clusters[0].n === 4 && grows.live.clusters[0].progress > 0.6, "a fourth joining keeps what it had charged");
  const ends = run(grows, 0.5).find(e => e.type === "lock");
  check(ends.n === 4 && planets(grows) === 0, "and all four clear together");
}

// ---------- the score and the combo ----------
{
  check(multiplier(0) === 1 && multiplier(1) === 1 && multiplier(2) === 1.25 && multiplier(3) === 1.5 && multiplier(30) === 3, "the multiplier: none for the first, a quarter more for each in a run, three times at most");
  const s = line(line(sky(), 0, 1, [0, 1], [1, 2], [2, 3]), 2, 4, [0, 5], [1, 6], [2, 7]);
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
  check(gap(0) === 4 && gap(90) === 3 && gap(10000) === 0.7 && [0, 30, 60, 120, 240, 300, 400].every((t, k, a) => k === 0 || gap(t) <= gap(a[k - 1])), "a planet every four seconds at first, quicker as the game goes on, to a floor of 0.7");
  const s = newGame(9), due = s.next.due, { ring, place, colour } = s.next, before = planets(s);
  s.rings.forEach(r => { r.held = true; });
  const ev = run(s, due - 0.05, 0.05);
  check(!ev.some(e => e.type === "land") && planets(s) === before, "not before it's due");
  const ev2 = run(s, 0.2, 0.05), landed = ev2.find(e => e.type === "land");
  check(landed && landed.ring === ring && landed.place === place && landed.colour === colour && s.rings[ring].places[place] === colour && planets(s) === before + 1, "it lands in the place foretold, in its ring's own frame (so it turns with it)");
  check(s.next.due > due && s.next.due - s.t <= gap(s.t) && s.next.due - s.t > gap(s.t) - 0.25 && s.rings[s.next.ring].places[s.next.place] === -1, "and the next is foretold, for an empty place");
  check(FORETELL > 0 && FORETELL < gap(0), "the planet foretold is shown a moment ahead: not for the whole of the first, easy gaps");
  // in a full ring the newcomer finds another
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
  check(lands > 25 && gapsOk, `${lands} planets in two minutes, one every few seconds`);
}

// ---------- saved and opened again ----------
{
  const s = newGame(21);
  turnTo(s, 1, 1, 0.5);
  s.rings[1].held = false;
  run(s, 7);
  const saved = JSON.parse(JSON.stringify(s)), a = copy(s), b = JSON.parse(JSON.stringify(saved));
  run(a, 10);
  run(b, 10);
  check(valid(saved) && JSON.stringify(a) === JSON.stringify(b) && !("live" in copy(s) && copy(s).live), "a game saved and opened again goes on as it would have");
  const keep = JSON.stringify(s);
  run(copy(s), 5);
  check(JSON.stringify(s) === keep, "a copy to try things on leaves the game as it was");
  check(!valid(null) && !valid({ v: 1, places: [] }) && !valid({ ...saved, rings: saved.rings.slice(1) }) && !valid({ ...saved, next: null }), "a game from the turn-based orrery, or a broken one, isn't taken");
}

// ---------- whole games ----------
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  const idle = seed => { const s = newGame(seed); while (!s.over && s.t < 900) step(s, 1 / 20); return s; };
  // a player with perfect hands, one alignment a time: finds the colour with most rings, brings those rings' planets to
  // one angle, and lets go; every `look` seconds
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
        if (best) for (const { ring, place } of best) { const target = norm(best[0].place * 0 + 1 - place * STEP); turnTo(s, ring, target, 0); }
      }
      step(s, 1 / 20);
    }
    return s;
  };
  const idles = [...Array(6).keys()].map(k => idle(40 + k));
  check(idles.every(s => s.over) && median(idles.map(s => s.t)) > 100 && median(idles.map(s => s.t)) < 230 && median(idles.map(s => s.score)) <= 300 && idles.every(s => s.score <= 1000), `turning nothing: full after about ${median(idles.map(s => s.t)).toFixed(0)} seconds, hardly a point`);
  const played = [...Array(6).keys()].map(k => player(2.5, 40 + k));
  check(median(played.map(s => s.t)) > 2 * median(idles.map(s => s.t)) && median(played.map(s => s.score)) > 5000, `lining planets up every couple of seconds lasts much longer (${median(played.map(s => s.t)).toFixed(0)} seconds, ${median(played.map(s => s.score)).toLocaleString("en-GB")} points)`);
  check(played.every(s => s.cleared === s.rings.reduce((n, r) => n, 0) + s.cleared && s.rings.every(r => r.a >= 0 && r.a < TAU)), "through whole games the rings stay within a turn");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("orrery: the deal, angles, alignments, the rings turning, charging and clearing, the combo, planets landing, the end, saving, whole games");
