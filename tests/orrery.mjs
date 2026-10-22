// Orrery's rules (orrery-engine.js): the deal from a seed (four hoops, whole places, each in a colour's plane, each its
// own pace of drift, planets, every colour at least twice, none in line); the beat (the tempos, the cap of one a second,
// a change of tempo, the beat on the game's own clock); the hoops stepping (each of the nine settings' rhythm left and
// right, exactly a place a step or two at the fastest, still standing still, a new setting answering on the next beat,
// the rhythms over a long run, a step and a tip drawn); alignment, exact (at the gates whatever the tips, anywhere in the
// colour's own plane, not in another's, not otherwise; three and four, mixed colours not, two at once; a step, a landing
// or a tip completing one); the drift (its pace, its step and its turn at 45 degrees, wound again by a tip, breaking a
// line, standing still with the game); clearing, the points and the combo; the planets landing on the clock (the pace,
// foretold, the place, a full orrery ending it); a game saved and opened again; the old version replaced; and whole
// games played out by simple players with a person's delays.
// `node tests/orrery.mjs measure` plays more games for each player instead, at every tempo, and prints what the README's
// numbers come from; `games=40`, `limit=1500` (seconds), `tempo=2`, `pace=6.5,1,200`, `drift=30,36,42,48` (or
// `drift=off`), `foresight=0.5`, `top=8`, `fast=off` (no two places a beat) and a list of players (`careful,quick`)
// change it; `trace=100` prints the plans of one game (seed 100) as they're made.
import {
  VERSION, RINGS, PLACES, COLOURS, START, TAU, STEP, DEG, TEMPOS, FIRST_TEMPO, SPIN, EVERY, STRIDE, TIP, TIP_MAX, PLANE, DRIFT, TICK, TIP_TIME, DWELL, AWARD, COMBO_WINDOW, FORETELL,
  PACE, gap, multiplier, period, between, id, seatOf, angleOf, room, planets, dirOf, keyOf, planeOf, turnOf, tiltOf, clusters, newGame, valid, copy, setRing, setTip, setTempo,
  stepsOn, upcoming, nextDrift, step, look, strikeAt,
} from "../orrery-engine.js";

let bad = 0;
const check = (ok, what) => { if (!MEASURE || !ok) console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const MEASURE = process.argv.includes("measure"), ARG = k => process.argv.find(x => x.startsWith(`${k}=`))?.slice(k.length + 1);
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const mod = q => ((q % PLACES) + PLACES) % PLACES;
const NEVER = 1e9;
/** An orrery drawn by hand: every hoop still, at turn 0 and at the tips given, no planets, nothing landing, nothing drifting; then put planets on it. */
function sky(tips = [0, 0, 0, 0], tempo = 3) {
  const s = newGame(1, tempo);
  s.rings.forEach((r, k) => { r.places.fill(-1); r.a = 0; r.set = 0; r.tip = r.tipFrom = tips[k]; r.tipAt = -1e9; r.driftAt = NEVER; r.way = Math.abs(tips[k] + 1) > TIP_MAX ? -1 : 1; });
  s.next.due = NEVER;
  s.locks = [];
  return s;
}
/** Every hoop in one colour's plane. */
const inPlane = (c, tempo) => sky(PLANE.map(() => PLANE[c]), tempo);
/** Planets of a colour put where they're at seat `seat` round the sun: [[ring, place]…], each hoop turned to bring its place there. */
function line(s, colour, seat, ...marks) {
  for (const [ring, place] of marks) { s.rings[ring].places[place] = colour; s.rings[ring].a = mod(seat - place); }
  look(s);
  return s;
}
const run = (s, seconds, dt = 0.05) => { const ev = []; for (let t = 0; t < seconds - 1e-9; t += dt) ev.push(...step(s, Math.min(dt, seconds - t))); return ev; };
const locks = ev => ev.filter(e => e.type === "lock");
const drifts = ev => ev.filter(e => e.type === "drift");
const MIXED = [-3, 0, 2, 1];                                    // four different tips
const OFF = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11];                  // the places off the axle
const SETTINGS = [...Array(2 * SPIN + 1).keys()].map(k => k - SPIN);

// ---------- the deal ----------
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.rings) !== JSON.stringify(c.rings), "the same seed deals the same orrery, another seed another");
  check(a.v === VERSION && VERSION === 5 && RINGS === 4 && a.rings.length === RINGS && a.rings.every(r => r.places.length === PLACES && r.set === 0 && Number.isInteger(r.a) && r.a >= 0 && r.a < PLACES) && a.t === 0 && a.beat === 0 && a.score === 0 && !a.over && valid(a),
    `${RINGS} hoops of ${PLACES} places, standing still, each turned to a whole place`);
  check([...Array(40).keys()].every(k => newGame(k).rings.map(r => r.tip).sort((x, y) => x - y).join() === [...PLANE].sort((x, y) => x - y).join()),
    `each hoop in a different colour's plane to begin with: ${[...PLANE].sort((x, y) => x - y).map(p => p * 15).join(", ")} degrees, in some order`);
  check([...Array(60).keys()].every(k => planets(newGame(k)) === START && clusters(newGame(k)).length === 0) && room(a) === RINGS * PLACES - START, `${START} planets in places, none in line to begin with`);
  check([...Array(200).keys()].every(k => { const n = Array(COLOURS).fill(0); for (const r of newGame(k).rings) for (const x of r.places) if (x >= 0) n[x]++; return Math.min(...n) >= 2; }), "every colour dealt at least twice, so each can line up");
  check(a.next.ring >= 0 && a.rings[a.next.ring].places[a.next.place] === -1 && a.next.colour >= 0 && a.next.colour < COLOURS && near(a.next.due, gap(0)), "the first planet foretold, for an empty place, to land a gap in");
  check(a.tempo === FIRST_TEMPO && newGame(7, 0).tempo === 0 && newGame(7, 9).tempo === TEMPOS.length - 1 && JSON.stringify(newGame(7, 0).rings) === JSON.stringify(a.rings), "a new game at the tempo asked for (the same orrery at any tempo)");
  // each hoop its own pace of drift, from the seed
  const paces = [...Array(40).keys()].map(k => newGame(k).rings.map(r => r.drift).join());
  check(paces.every(p => p.split(",").map(Number).sort((x, y) => x - y).join() === [...DRIFT].sort((x, y) => x - y).join()) && new Set(paces).size > 8 && DRIFT.every(d => d >= 10 && d <= 90) && new Set(DRIFT).size === RINGS,
    `each hoop drifts at a pace of its own, every ${DRIFT.join(", ")} seconds, dealt to the hoops from the seed`);
  check([...Array(40).keys()].every(k => newGame(k).rings.every(r => r.driftAt === r.drift && Math.abs(r.way) === 1 && Math.abs(r.tip + r.way) <= TIP_MAX)) && new Set([...Array(40).keys()].map(k => newGame(k).rings.map(r => r.way).join())).size > 4,
    "the first drift a whole pace in, which way from the seed (back, from 45 degrees)");
}

// ---------- the beat ----------
{
  check(TEMPOS.every((b, k) => k === 0 || b > TEMPOS[k - 1]) && TEMPOS[TEMPOS.length - 1] === 60 && TEMPOS[0] >= 15, `tempos of ${TEMPOS.join(", ")} beats a minute: the fastest one a second`);
  const counts = TEMPOS.map((b, k) => { const s = sky([0, 0, 0, 0], k); const n = step(s, 60 + 1e-6).filter(e => e.type === "beat").length; return [n, b, s.beat]; });
  check(counts.every(([n, b, at]) => n === b && at === b), `a minute's beats at each tempo: ${counts.map(c => c[0]).join(", ")}`);
  const s = sky([0, 0, 0, 0], 3);
  check(!setTempo(s, 3) && setTempo(s, 7) === false && s.tempo === 3 && (setTempo(s, -4), s.tempo === 0) && (setTempo(s, 99), s.tempo === TEMPOS.length - 1) && 60 / period(s) === 60, "no faster than one a second, no slower than the slowest");
  // a change of tempo: the next beat a beat of the new tempo after the last, or at once if that has gone by
  const t = sky([0, 0, 0, 0], 0);
  run(t, 3.5);                                                   // a beat at 3 s, the next due at 6
  setTempo(t, 3);                                                // one a second: the next is a second after the last, at 4
  const ev = run(t, 0.6);
  setTempo(t, 0);
  const at = t.beatAt;
  const u = sky([0, 0, 0, 0], 0);
  run(u, 5.5);                                                   // last beat at 3 s; at 30 a minute the next would be at 5, gone by
  setTempo(u, 1);
  const now = run(u, 0.001).filter(e => e.type === "beat").length;
  check(ev.some(e => e.type === "beat") && near(t.lastBeat, 4) && near(at, 4 + 3) && now === 1 && near(u.lastBeat, 5.5) && near(u.beatAt, 7.5), "a change of tempo: the next beat comes a beat of the new tempo after the last, or at once if that's gone by");
  // the beat is the game's: stepped in frames or all at once, the same beats; not stepped (the page's pause), nothing happens
  const f = newGame(5, 2), g = newGame(5, 2);
  setRing(f, 1, 3); setRing(g, 1, 3);
  const fe = run(f, 29.5, 1 / 60).filter(e => e.type === "beat").length, ge = step(g, 29.5).filter(e => e.type === "beat").length;
  const held = copy(f);
  step(f, 0);
  check(fe === ge && fe === Math.floor(29.5 / period(f)) && JSON.stringify(f.rings) === JSON.stringify(g.rings) && JSON.stringify(f) === JSON.stringify(held), "the beat keeps the game's own time: played in frames or at once, the same beats; while the game stands (the menu open), none");
}

// ---------- the hoops step ----------
{
  check(SETTINGS.length === 9 && SETTINGS.every(k => k === 0 || (EVERY[Math.abs(k)] >= 1 && STRIDE[Math.abs(k)] >= 1)) && EVERY.join() === "0,3,2,1,1" && STRIDE.join() === "0,1,1,1,2",
    "nine settings: still, and every third beat, every second, every beat or two places every beat, each way");
  // each setting: set just after a beat, it steps on the next and then every so many, the way it's set
  const rhythm = k => {
    const s = sky([0, 0, 0, 0], 3);
    run(s, 2.5);                                                 // two beats in
    const a0 = s.rings[2].a, beats = [];
    setRing(s, 2, k);
    for (const e of run(s, 12)) if (e.type === "beat" && e.stepped.some(x => x.ring === 2)) beats.push(e.beat);
    return { beats, turn: mod(s.rings[2].a - a0) };
  };
  const all = SETTINGS.filter(k => k).map(k => [k, rhythm(k)]);
  const want = k => { const out = []; for (let b = 3; b <= 14; b += EVERY[Math.abs(k)]) out.push(b); return out; };
  check(all.every(([k, r]) => r.beats.join() === want(k).join()), "each setting steps on the next beat, then every beat, every second or every third: " + all.map(([k, r]) => `${k > 0 ? "+" : ""}${k} on ${r.beats.slice(0, 4).join(",")}…`).join("; "));
  check(all.every(([k, r]) => r.turn === mod(Math.sign(k) * STRIDE[Math.abs(k)] * r.beats.length)), "left steps back, right on: exactly a place a step, or two at the fastest");
  const s = sky([0, 0, 0, 0], 3);
  setRing(s, 0, 3);
  let whole = true, last = s.rings[0].a;
  for (let k = 0; k < 40; k++) { step(s, 1); const a = s.rings[0].a; if (!Number.isInteger(a) || mod(a - last) !== 1) whole = false; last = a; }
  check(whole, "a step is a twelfth of a turn, and between steps a hoop is always on a place");
  // the fastest: two places on every beat, 60 degrees, either way
  const fast = sky([0, 0, 0, 0], 3), places = [];
  setRing(fast, 0, 4); setRing(fast, 1, -4);
  for (let k = 0; k < 6; k++) { const e = step(fast, 1).find(x => x.type === "beat"); places.push(`${mod(fast.rings[0].a)}/${mod(fast.rings[1].a)}/${e.stepped.map(x => x.by).join(":")}`); }
  check(places.join(" ") === "2/10/2:-2 4/8/2:-2 6/6/2:-2 8/4/2:-2 10/2/2:-2 0/0/2:-2" && upcoming(fast, 2).every(col => col[0] === 2 && col[1] === -2),
    "the fastest steps two places on every beat, 60 degrees, right or left: round in six beats");
  const still = sky([0, 0, 0, 0], 3), a0 = still.rings.map(r => r.a);
  check(run(still, 30).filter(e => e.type === "beat").every(e => !e.stepped.length) && still.rings.every((r, k) => r.a === a0[k]), "a hoop set still stands still, beat after beat");
  // a new setting answers on the next beat; the setting it has already carries on as it was
  const n = sky([0, 0, 0, 0], 3);
  setRing(n, 1, 1);                                              // every third right: steps on beat 1, then 4, 7
  run(n, 1.5);
  const nA = n.rings[1].a;
  check(!setRing(n, 1, 1) && n.rings[1].due === 4, "set as it is already, a hoop keeps its rhythm");
  setRing(n, 1, -3);
  const e2 = run(n, 1).filter(e => e.type === "beat");
  check(e2.length === 1 && e2[0].stepped.some(x => x.ring === 1 && x.dir === -1) && n.rings[1].a === mod(nA - 1), "set to another, it answers on the next beat");
  setRing(n, 1, 0);
  check(run(n, 5).every(e => e.type !== "beat" || !e.stepped.length), "and set still, it stops at once");
  check((setRing(n, 1, 9), n.rings[1].set === SPIN) && (setRing(n, 1, -9), n.rings[1].set === -SPIN), `no setting past ${SPIN} either way`);
  // over a long run, the rhythms keep exactly
  const long = sky([0, 0, 0, 0], 3);
  [1, -2, 3, -4].forEach((k, ring) => setRing(long, ring, k));
  const count = [0, 0, 0, 0];
  for (const e of step(long, 600)) if (e.type === "beat") for (const x of e.stepped) count[x.ring] += Math.abs(x.by);
  check(count.join() === "200,300,600,1200" && long.rings.map(r => r.a).join() === `${mod(200)},${mod(-300)},${mod(600)},${mod(-1200)}`, `over 600 beats: ${count.join(", ")} places, and each hoop where that many put it`);
  // what's coming is what happens
  const f = newGame(11, 3);
  [3, -1, 4, -2].forEach((k, ring) => setRing(f, ring, k));
  run(f, 1.5);
  const ahead = upcoming(f, 8), seen = [];
  for (const e of run(f, 8)) if (e.type === "beat") seen.push(f.rings.map((r, ring) => e.stepped.find(x => x.ring === ring)?.by ?? 0));
  check(JSON.stringify(ahead) === JSON.stringify(seen) && stepsOn(f.rings[0], f.beat + 1) === 1 && stepsOn(f.rings[2], f.beat + 1) === 2, "the beats coming (for the bar of beats) are the steps that happen");
  // a step is drawn as a tick ending on the place; two places drawn as one tick; a tip turning to the tip
  const d = sky([0, 0, 0, 0], 3);
  setRing(d, 0, 3);
  step(d, 1);
  const r = d.rings[0], t0 = r.moved, path = [0, 0.25, 0.5, 0.75, 1].map(u => turnOf(r, t0 + u * TICK) - (r.a - 1));
  check(near(path[0], 0) && path[4] === 1 && path.slice(1, 4).every((x, k) => x > path[k]) && Math.max(...[...Array(50).keys()].map(k => turnOf(r, t0 + (k / 50) * TICK) - (r.a - 1))) < 1.06 && turnOf(r, t0 + 5) === r.a,
    `a step drawn as a tick over ${TICK} s, past the place by a hair and onto it exactly`);
  setRing(d, 1, -4);
  step(d, 1);
  const r2 = d.rings[1], t2 = r2.moved, path2 = [0, 0.15, 1].map(u => turnOf(r2, t2 + u * TICK) - r2.a);
  const past2 = Math.min(...[...Array(50).keys()].map(k => turnOf(r2, t2 + (k / 50) * TICK) - r2.a));
  check(near(path2[0], 2) && path2[1] < 1.5 && path2[1] > 0.5 && path2[2] === 0 && past2 > -0.12 && turnOf(r2, t2 + 5) === r2.a, "two places drawn as one tick, from where it was, past by a hair and onto where it's going");
  setTip(d, 1, 2);
  const tr = d.rings[1];
  check(near(tiltOf(tr, d.t), 0) && near(tiltOf(tr, d.t + TIP_TIME / 2), TIP) && tiltOf(tr, d.t + TIP_TIME) === 2 * TIP && (setTip(d, 1, 9), tr.tip === TIP_MAX) && (setTip(d, 1, -9), tr.tip === -TIP_MAX) && near(TIP_MAX * TIP, 45 * DEG),
    `a tip drawn turning over ${TIP_TIME} s; no more than 45 degrees either way`);
}

// ---------- directions and alignments ----------
{
  const is = (v, x, y, z) => near(v[0], x) && near(v[1], y) && near(v[2], z);
  check(near(between(0.1, TAU - 0.1), -0.2) && near(between(TAU - 0.1, 0.1), 0.2) && near(between(1, 1), 0) && near(between(0, 3), 3), "the way round between two angles is the short way (a swipe's way round the sun)");
  check([-45, -15, 0, 30].every(t => is(dirOf(t * DEG, 0), 0, 0, -1) && is(dirOf(t * DEG, Math.PI), 0, 0, 1)) && is(dirOf(30 * DEG, Math.PI / 2), Math.cos(30 * DEG), Math.sin(30 * DEG), 0), "every hoop, however tipped, meets the axle at twelve and at six; tipped, it lifts its three o'clock side");
  const s = sky();
  s.rings[2].a = 5;
  check(seatOf(s, 2, 3) === 8 && seatOf(s, 2, 9) === 2 && near(angleOf(s, 2, 9), 2 * STEP) && keyOf(s.rings[2], 7) === "N" && keyOf(s.rings[2], 1) === "S" && keyOf(s.rings[2], 3) === "0@8", "a place is a twelfth of a turn on from the last, from the hoop's own twelve o'clock; its direction a name");
  // the planes: four colours, four tips, every other one; level and ±30 no colour's
  check(PLANE.length === COLOURS && new Set(PLANE).size === COLOURS && PLANE.every(p => Number.isInteger(p) && Math.abs(p) <= TIP_MAX) && PLANE.every((p, c) => planeOf(p) === c) && [-2, 0, 2].every(t => planeOf(t) === -1),
    `each colour its own plane: ${PLANE.map(p => `${p > 0 ? "+" : p < 0 ? "−" : ""}${Math.abs(p) * 15}°`).join(", ")}; level and ±30° no colour's`);
  // at the gates, whatever the tips, any colour
  const gate = (seat, colour = 2) => line(sky(MIXED), colour, seat, [0, 3], [1, 7], [3, 0]);
  const n = clusters(gate(0)), sth = clusters(gate(6));
  check(n.length === 1 && n[0].colour === 2 && n[0].key === "N" && n[0].ids.join() === [id(0, 3), id(1, 7), id(3, 0)].join() && is(n[0].dir, 0, 0, -1) && sth.length === 1 && sth[0].key === "S" && is(sth[0].dir, 0, 0, 1),
    "three of a colour at twelve o'clock on hoops tipped every way are in line, along the axle; and at six");
  check([0, 1, 2, 3].every(c => clusters(gate(0, c)).length === 1 && clusters(gate(6, c)).length === 1) && [0, 1, 2, 3].every(c => clusters(line(sky([0, 0, 0, 0]), c, 6, [0, 1], [1, 2], [2, 3])).length === 1),
    "at the gates any colour lines up at any tips, level or in another colour's plane");
  const split = line(line(sky(MIXED), 2, 0, [0, 3], [1, 7]), 2, 6, [3, 0]);
  check(!clusters(split).length, "two at twelve and one at six are not: they're on opposite sides of the sun");
  check(OFF.every(q => !clusters(gate(q)).length), "away from the axle, hoops tipped differently are never in line");
  // in the colour's own plane, anywhere; in another colour's plane, or at a tip that's no colour's, nowhere off the axle
  check([0, 1, 2, 3].every(c => OFF.every(q => clusters(line(sky([PLANE[c], PLANE[c], -2, PLANE[c]]), c, q, [0, 2], [1, 5], [3, 9])).length === 1)), "in its colour's plane, a line at every place round");
  check([0, 1, 2, 3].every(c => [0, 1, 2, 3].every(o => o === c || OFF.every(q => !clusters(line(inPlane(o), c, q, [0, 2], [1, 5], [3, 9])).length))),
    "but not in another colour's plane: four hoops tipped alike line up only their own plane's colour off the axle");
  check([-2, 0, 2].every(t => [0, 1, 2, 3].every(c => OFF.every(q => !clusters(line(sky([t, t, t, t]), c, q, [0, 2], [1, 5], [2, 9])).length))), "nor tipped alike at a tip that's no colour's plane (level, or 30 degrees either way)");
  const T = PLANE[2];
  check(!clusters(line(sky([T, T, T + 1, T - 1]), 2, 4, [0, 2], [1, 5], [2, 9])).length && !clusters(line(line(inPlane(2), 2, 4, [0, 2], [1, 5]), 2, 5, [2, 9])).length, "not with one hoop out of the plane, nor a place apart: exactly, or not at all");
  check(clusters(line(sky(MIXED), 1, 0, [0, 1], [1, 2], [2, 3], [3, 4]))[0].members.length === 4 && clusters(line(inPlane(1), 1, 9, [0, 1], [1, 2], [2, 3], [3, 4]))[0].members.length === 4, "four: at a gate, or on four hoops in the colour's plane");
  check(!clusters(line(inPlane(1), 1, 3, [0, 3], [1, 7])).length, "two are not an alignment");
  const mixed = line(line(inPlane(1), 1, 3, [0, 3], [1, 7]), 3, 3, [2, 0]);
  check(!clusters(mixed).length, "three of different colours aren't");
  const two = line(line(sky(MIXED), 0, 0, [0, 1], [1, 2], [2, 3]), 3, 6, [0, 7], [1, 8], [3, 4]);
  const cs = clusters(two);
  check(cs.length === 2 && cs[0].colour === 0 && cs[0].key === "N" && cs[1].colour === 3 && cs[1].key === "S" && !cs[0].ids.some(x => cs[1].ids.includes(x)), "two at once, sharing no planet");
}

// ---------- a line made, and struck ----------
{
  // by a stop: two standing at twelve o'clock, the third a place short, set going: the beat takes it there, but a hoop
  // set going makes no line; stopped there, it does, and the next beat strikes it
  const s = line(sky(MIXED), 1, 0, [0, 3], [1, 7]);
  s.rings[2].places[4] = 1; s.rings[2].a = mod(0 - 4 - 1);    // a place short of twelve
  setRing(s, 2, 3);
  const passing = step(s, 1.05);
  check(seatOf(s, 2, 4) === 0 && passing.some(e => e.type === "beat") && !s.locks.length && !clusters(s).length && !locks(step(s, 0.5)).length, "a hoop going round makes no line, even standing in one between its steps: nothing lines up by chance");
  setRing(s, 2, 0);
  check(s.locks.length === 1 && s.locks[0].key === "N" && near(s.locks[0].at, s.t), "stopped there, it stands in line");
  const ev = step(s, 1), lk = locks(ev);
  check(lk.length === 1 && lk[0].n === 3 && lk[0].gain === AWARD[3] && lk[0].key === "N" && s.score === AWARD[3] && planets(s) === 0 && s.cleared === 3 && s.aligned === 1 && !s.locks.length && ev[0].type === "beat",
    `and the next beat strikes it: ${AWARD[3]} for three`);
  const late = line(sky(MIXED), 1, 0, [0, 3], [1, 7]);
  late.rings[2].places[4] = 1;
  step(late, 0.9);
  line(late, 1, 0, [2, 4]);                                      // in line a tenth of a second before a beat
  check(!locks(step(late, 0.2)).length && late.locks.length === 1 && locks(step(late, 1)).length === 1, `one made less than ${DWELL} s before a beat waits for the one after, so what made it has been drawn`);
  const four = locks(step(line(inPlane(0), 0, 4, [0, 1], [1, 2], [2, 3], [3, 4]), 1.05));
  check(four.length === 1 && four[0].n === 4 && four[0].gain === AWARD[4] && AWARD[4] >= 3 * AWARD[3], `four ${AWARD[4]}: better than three lines of three`);
  // a fourth stopped in line before the beat joins the three, and all four are struck together
  const join = line(sky(MIXED), 2, 6, [0, 1], [1, 2], [2, 3]);
  join.rings[3].places[8] = 2; join.rings[3].a = mod(6 - 8);
  setRing(join, 3, 2);                                           // going, so not in line yet
  step(join, 0.4);
  setRing(join, 3, 0);
  const jl = locks(step(join, 1));
  check(jl.length === 1 && jl[0].n === 4 && near(join.lastLock, 1), "a fourth hoop stopped in line before the beat joins the three: all four are struck together");
  // by a landing: two in place, the third foretold onto the place that's at twelve on its hoop
  const l = line(sky(MIXED), 2, 0, [0, 3], [1, 7]);
  l.rings[3].a = 5;
  l.next = { due: 0.5, ring: 3, place: 7, colour: 2 };
  const le = step(l, 1.05);
  check(le.some(e => e.type === "land" && e.ring === 3) && locks(le).length === 1 && locks(le)[0].members.some(m => m.ring === 3), "a planet landing completes one");
  // by a tip: three blue at four o'clock, two hoops in blue's plane, the third tipped into it
  const B = PLANE[2], tp = line(sky([B, B, B + 2, -1]), 2, 4, [0, 2], [1, 5], [2, 9]);
  check(!clusters(tp).length && setTip(tp, 2, B) && tp.locks.length === 1 && locks(step(tp, 1.05)).length === 1 && planets(tp) === 0, "a tip into the colour's plane completes one, and the beat strikes it");
  // one that breaks before the beat strikes it is gone
  const br = line(sky([B, B, B, -1]), 2, 4, [0, 2], [1, 5], [2, 9]);
  step(br, 0.5);
  setTip(br, 2, B + 1);
  const br2 = line(sky([B, B, B, -1]), 2, 4, [0, 2], [1, 5], [2, 9]);
  step(br2, 0.5);
  setRing(br2, 0, -1);
  check(!br.locks.length && !locks(step(br, 2)).length && planets(br) === 3 && !br2.locks.length && !locks(step(br2, 0.6)).length, "one broken before the beat (a hoop tipped out of the plane, or set going) isn't struck");
  // a fourth landing in it while it shows keeps its time, and all four are struck
  const g = line(sky(MIXED), 0, 6, [0, 1], [1, 2], [2, 3]);
  g.rings[3].a = 2;
  g.next = { due: DWELL / 2, ring: 3, place: 4, colour: 0 };
  const gl = locks(step(g, 1.05));
  check(gl.length === 1 && gl[0].n === 4 && gl[0].gain === AWARD[4] && near(g.lastLock, 1), "a fourth landing in it while it stands: all four are struck together");
}

// ---------- the drift ----------
{
  // a step a pace, one way, turning at 45 degrees: a slow pendulum
  const s = sky([1, 0, 0, 0]);
  s.rings[0].drift = 10; s.rings[0].driftAt = 10; s.rings[0].way = 1;
  const tips = drifts(run(s, 125, 0.25)).map(e => e.tip);
  check(tips.join() === "2,3,2,1,0,-1,-2,-3,-2,-1,0,1" && s.rings[0].tip === 1, "a hoop drifts a step at a time one way, to 45 degrees and back the other: +30, +45, +30, +15, level, −15 … −45 and up again");
  const p = sky([0, 0, 0, 0]);
  p.rings[2].drift = 7; p.rings[2].driftAt = 7; p.rings[2].way = -1;
  const at = [];
  for (let k = 0; k < 300; k++) for (const e of step(p, 0.1)) if (e.type === "drift") at.push(`${e.ring}:${e.from}>${e.tip}@${(p.rings[2].driftAt - p.rings[2].drift).toFixed(9)}`);
  check(at.join() === "2:0>-1@7.000000000,2:-1>-2@14.000000000,2:-2>-3@21.000000000,2:-3>-2@28.000000000" && p.rings[2].way === 1 && p.rings[2].tip === -2, "at its own steady pace (every 7 s, here), on the clock, exactly, whatever the steps of time it's played in");
  // its pace on the clock, not the beat: the same drifts at every tempo
  const byTempo = TEMPOS.map((_, k) => { const g = newGame(31, k); return drifts(run(g, 200, 0.1)).map(e => `${e.ring}${e.tip}`).join(); });
  check(byTempo.every(x => x === byTempo[0]) && byTempo[0].split(",").length >= 15, "the drift keeps the clock, not the beat: the same drifts at every tempo, so a slow tempo isn't spared it");
  // a tip of the hand winds the drift again
  const w = sky([1, 1, 1, 1]);
  w.rings.forEach(r => { r.drift = 20; r.driftAt = 20; });
  run(w, 15);
  setTip(w, 1, 2);
  check(near(w.rings[1].driftAt, 35) && w.rings[0].driftAt === 20 && !setTip(w, 0, 1) && w.rings[0].driftAt === 20, "a tip of your own winds its drift again (the next a whole pace on); a press at the tip it has isn't a tip, and winds nothing");
  const dw = drifts(run(w, 30));
  check(dw.filter(e => e.ring === 1).length === 1 && dw.filter(e => e.ring === 0).length === 2 && near(w.rings[1].driftAt, 55), "so the hoop tipped drifts a whole pace after it, the others on their own clocks");
  const end = sky([0, 0, 0, 0]);
  end.rings[0].way = 1; end.rings[1].way = -1;
  setTip(end, 0, 3); setTip(end, 1, -3);
  check(end.rings[0].way === -1 && end.rings[1].way === 1 && (setTip(end, 0, 1), end.rings[0].way === -1), "tipped to 45 degrees by hand, it drifts back from there (and keeps its way, tipped between)");
  // a drift that tips a hoop out of a standing line breaks it; one into its colour's plane can complete one
  const B = PLANE[2], br = line(sky([B, B, B, 0]), 2, 4, [0, 2], [1, 5], [2, 9]);
  br.rings[1].driftAt = 0.2; br.rings[1].drift = 30; br.rings[1].way = 1;
  check(br.locks.length === 1, "a line standing in blue's plane …");
  const be = run(br, 1.5);
  check(drifts(be).length === 1 && !br.locks.length && !locks(be).length && planets(br) === 3 && br.rings[1].tip === B + 1, "… broken by a hoop of it drifting out before the beat: not struck, as if tipped by hand");
  const mk = line(sky([B, B, B + 1, 0]), 2, 4, [0, 2], [1, 5], [2, 9]);
  mk.rings[2].driftAt = 0.2; mk.rings[2].drift = 30; mk.rings[2].way = -1;
  const me = run(mk, 1.5);
  check(drifts(me).length === 1 && locks(me).length === 1 && planets(mk) === 0, "and a drift into the colour's plane can make one, struck on the next beat");
  const gt = line(sky(MIXED), 1, 0, [0, 3], [1, 7], [2, 0]);
  gt.rings.forEach(r => { r.driftAt = 0.1; r.drift = 30; });
  check(locks(run(gt, 1.2)).length === 1, "a line at a gate stands whatever the hoops drift to");
  // standing still with the game: not stepped, nothing drifts; over, nothing drifts
  const st = newGame(41, 2), before = st.rings.map(r => `${r.tip}@${r.driftAt}`).join();
  step(st, 0);
  const ov = newGame(42, 2);
  ov.rings.forEach(r => r.places.fill(0));
  ov.next.due = 0.1;
  run(ov, 0.5);
  const tipsOver = ov.rings.map(r => r.tip).join();
  check(st.rings.map(r => `${r.tip}@${r.driftAt}`).join() === before && ov.over && !drifts(run(ov, 100)).length && ov.rings.map(r => r.tip).join() === tipsOver && !setTip(ov, 0, 0), "the drift stands still with the game (the menu open, the tab hidden) and stops with the end");
  check(nextDrift(newGame(43, 2)) === newGame(43, 2).rings.findIndex(r => r.drift === Math.min(...DRIFT)), "the hoop that drifts next is the one whose time comes first (for the page to show)");
}

// ---------- the score and the combo ----------
{
  check(multiplier(0) === 1 && multiplier(1) === 1 && multiplier(2) === 1.25 && multiplier(3) === 1.5 && multiplier(30) === 3, "the multiplier: none for the first, a quarter more for each in a run, three times at most");
  const two = line(line(sky(MIXED), 0, 0, [0, 1], [1, 2], [2, 3]), 3, 6, [0, 7], [1, 8], [3, 4]);
  const [first, second] = locks(step(two, 1.05));
  check(first.combo === 1 && second.combo === 2 && first.gain === AWARD[3] && second.gain === Math.round(AWARD[3] * 1.25) && two.score === first.gain + second.gain, "two at once: the second counts on the first's combo");
  const late = line(inPlane(0), 0, 1, [0, 1], [1, 2], [2, 3]);
  step(late, 1.05);
  step(late, COMBO_WINDOW);
  line(late, 0, 4, [0, 5], [1, 6], [2, 7]);
  const again = locks(step(late, 1))[0];
  check(again && again.combo === 1 && again.gain === AWARD[3], `after ${COMBO_WINDOW} seconds the run is over`);
}

// ---------- the planets land, on the clock ----------
{
  check(gap(0) === PACE.first && [0, 30, 60, 120, 240, 300, 400, 600].every((t, k, a) => k === 0 || gap(t) <= gap(a[k - 1])) && gap(1e5) > 0, `a planet every ${gap(0)} seconds at first, quicker as the game goes on (${gap(300).toFixed(1)} at five minutes)`);
  const s = newGame(9), due = s.next.due, { ring, place, colour } = s.next, before = planets(s);
  const ev = run(s, due - 0.05);
  check(!ev.some(e => e.type === "land") && planets(s) === before, "not before it's due");
  setRing(s, ring, 3);
  const l = run(s, 0.2).find(e => e.type === "land");
  check(l && l.ring === ring && l.place === place && l.colour === colour && s.rings[ring].places[place] === colour && planets(s) === before + 1, "it lands in the place foretold, on its hoop (so it travels with it)");
  check(s.next.due > due && near(s.next.due - due, gap(due)) && s.rings[s.next.ring].places[s.next.place] === -1 && FORETELL > 0 && FORETELL < gap(0), "and the next is foretold, for an empty place, shown a moment ahead");
  // on the clock: the same landings at every tempo
  const at = tempo => { const g = newGame(13, tempo); return run(g, 120, 0.1).filter(e => e.type === "land").map(e => `${e.ring}.${e.place}`).join(); };
  check(TEMPOS.every((_, k) => at(k) === at(0)) && at(0).split(",").length >= 18, "landings keep the clock, not the beat: the same at every tempo");
  const f = sky();
  f.rings[0].places.fill(0);
  f.next = { due: 0.1, ring: 0, place: 4, colour: 1 };
  const l3 = run(f, 0.2).find(e => e.type === "land");
  check(l3 && l3.ring !== 0 && f.rings[l3.ring].places[l3.place] === 1, "a place taken in the meantime sends it to a free one");
  const full = newGame(5);
  full.rings.forEach(r => r.places.fill(0));
  full.next.due = 0.1;
  const e4 = run(full, 0.3);
  check(e4.some(e => e.type === "over") && full.over && room(full) === 0, "no place for the next planet ends the game");
  const t0 = full.t;
  check(step(full, 1).length === 0 && full.t === t0 && !setRing(full, 0, 3) && !setTip(full, 0, 1) && !setTempo(full, 0), "and nothing goes on after");
  // a full orrery with an alignment showing: it clears first, and the planet lands in the room it leaves
  const last = sky(MIXED);
  last.rings.forEach((r, k) => r.places.forEach((_, p) => { r.places[p] = (k + p) % 2 ? 1 : 3; }));
  line(last, 2, 0, [0, 0], [1, 0], [2, 0]);
  last.next = { due: 0.05, ring: 3, place: 5, colour: 0 };
  const e5 = run(last, 1.1, 0.01);
  check(!last.over && locks(e5).length >= 1 && e5.findIndex(e => e.type === "lock") < e5.findIndex(e => e.type === "land"), "a full orrery with a line standing: the beat strikes it first, and the planet lands in its room");
}

// ---------- saved and opened again ----------
{
  const s = newGame(21, 2);
  run(s, 3.3, 1 / 60);
  setRing(s, 1, 2); setRing(s, 3, -4); setTip(s, 2, 1); setTempo(s, 3);
  run(s, 4.1, 1 / 60);
  const saved = JSON.parse(JSON.stringify(s)), a = copy(s), b = JSON.parse(JSON.stringify(saved));
  const da = drifts(run(a, 60, 1 / 60)).map(e => `${e.ring}${e.tip}`).join(), db = drifts(run(b, 60, 0.5)).map(e => `${e.ring}${e.tip}`).join();
  const same = (x, y) => JSON.stringify({ ...x, t: x.t.toFixed(6) }) === JSON.stringify({ ...y, t: y.t.toFixed(6) });
  check(valid(saved) && same(a, b) && da === db && da.split(",").length >= 2, "a game saved and opened again goes on as it would have, drifts and all, frame by frame or half a second at a time");
  const keep = JSON.stringify(s);
  run(copy(s), 5);
  check(JSON.stringify(s) === keep, "a copy to try things on leaves the game as it was");
  const v4 = { ...saved, v: 4, rings: saved.rings.map(({ drift, driftAt, way, ...r }) => r) };
  check(!valid(v4) && !valid({ ...saved, v: 4 }) && !valid(null) && !valid({ ...saved, rings: saved.rings.slice(1) }) && !valid({ ...saved, rings: saved.rings.map(r => ({ ...r, a: 1.5 })) }) && !valid({ ...saved, rings: saved.rings.map(r => ({ ...r, set: 5 })) })
    && !valid({ ...saved, rings: saved.rings.map(r => ({ ...r, way: 0 })) }) && !valid({ ...saved, next: null }) && !valid({ ...saved, tempo: 9 }),
    "a game saved by the earlier orrery (version 4, tipped alike for any colour), or a broken one, isn't taken: it's replaced by a new game");
}

// ---------- whole games ----------
// Players with a person's hands (the harness): how long each one takes to look and decide what to line up, to tap a hoop
// (both its rows of buttons are there at once), to press a button, and to see a hoop arrive and press still, and how
// much longer that takes for each other hoop it's keeping count of at the same time (`juggle`); each varies as a
// person's would (a spread of about `jitter` of itself, now and then much slower), game by game the same from the seed.
const HANDS = {
  careful: { think: 2.5, tap: 0.8, press: 0.6, react: 0.4, juggle: 0.3, jitter: 0.25 },
  quick: { think: 1.2, tap: 0.55, press: 0.45, react: 0.3, juggle: 0.2, jitter: 0.2 },
};
// and the foresight to see a hoop tipped into a colour's plane as set up for the lines after this one too: of a tip's
// time, the share a plan counts as paid for by them (with none, a plan pays for all its tips, and the player keeps to
// the gates more than a person would)
const FORESIGHT = Number(ARG("foresight") ?? 0.5);
const FASTEST = ARG("fast") === "off" ? 3 : SPIN;              // measuring what two places a beat is worth: `fast=off` plays without it
const LIMIT = Number(ARG("limit") || 3000);                     // seconds a game is played to at most
const MAX_TIPS = 3;                                              // hoops a plan tips at most
const TOP = Number(ARG("top") || 8);
const TRACE = MEASURE && ARG("trace") != null;                 // one game's plans, printed as they're made                             // the plans it rehearses, of those that look cheapest
if (MEASURE && ARG("pace")) { const [first, least, half] = ARG("pace").split(",").map(Number); Object.assign(PACE, { first, least, half }); }
if (MEASURE && ARG("drift")) DRIFT.splice(0, RINGS, ...(ARG("drift") === "off" ? [1e7, 1e7 + 1, 1e7 + 2, 1e7 + 3] : ARG("drift").split(",").map(Number)));
const shortest = (from, to) => { const d = mod(to - from); return d > 6 ? d - 12 : d; };
const perms = a => (a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])));
const subsets = (a, k) => (k === 0 ? [[]] : a.length < k ? [] : [...subsets(a.slice(1), k - 1).map(p => [a[0], ...p]), ...subsets(a.slice(1), k)]);
const beatTime = (s, b) => (b <= s.beat ? s.lastBeat : s.beatAt + (b - s.beat - 1) * period(s));
const beatAfter = (s, t) => (t < s.beatAt ? s.beat + 1 : s.beat + 2 + Math.floor((t - s.beatAt) / period(s)));
const atGate = key => key === "N" || key === "S";
/** The settings that bring a hoop `d` places in whole steps: two a beat only for an even distance. */
const fits = (d, k) => Math.abs(d) % STRIDE[k] === 0;

/**
 * The alignments worth trying: for each colour, at either gate (any tips) or at any other place in its plane (tipping up
 * to MAX_TIPS hoops into it, if `tips`), three or four hoops each bringing its planet of that colour nearest the place:
 * [{ colour, key, n, members: [{ ring, place, d (places, signed), tip (to tip it to, or null) }] }].
 */
function options(s, tips) {
  const out = [];
  for (let c = 0; c < COLOURS; c++) {
    const nearest = s.rings.map(r => {
      const best = new Array(PLACES).fill(null);
      r.places.forEach((col, p) => {
        if (col !== c) return;
        for (let q = 0; q < PLACES; q++) { const d = shortest(mod(r.a + p), q); if (!best[q] || Math.abs(d) < Math.abs(best[q].d)) best[q] = { place: p, d }; }
      });
      return best;
    });
    const add = (key, members) => {
      const can = members.filter(Boolean);
      for (const k of [3, 4]) for (const set of subsets(can, k)) if (set.filter(m => m.tip != null).length <= MAX_TIPS) out.push({ colour: c, key, n: k, members: set });
    };
    for (const q of [0, 6]) add(q ? "S" : "N", nearest.map((b, ring) => b[q] && { ring, ...b[q], tip: null }));
    const T = PLANE[c];
    if (!tips && s.rings.filter(r => r.tip === T).length < 3) continue;
    for (let q = 1; q < PLACES; q++) {
      if (q === 6) continue;
      add(`${T}@${q}`, nearest.map((b, ring) => b[q] && (s.rings[ring].tip === T || tips) && { ring, ...b[q], tip: s.rings[ring].tip === T ? null : T }));
    }
  }
  return out;
}
/**
 * How a plan would go, played with a person's usual delays: the tips first, then the hoops set going in `order` at their
 * settings; one at a time (`one`: each stopped as it arrives before the next is set) or all at once (then each stopped
 * as it arrives, a moment later for each other hoop still going). When the beat would strike the line, or null if the
 * hand couldn't stop a hoop before its next step, a fourth wouldn't stand before the beat struck the first three, or a
 * hoop of a line in a colour's plane would drift out of it first (a hoop the plan tips is wound again as it's tipped).
 */
function rehearse(s, me, hands, opt, order, levels, one) {
  const margin = 0.3;
  let t = s.t, chosen = me.chosen;
  const to = ring => { if (chosen !== ring) t += hands.tap; chosen = ring; };
  const ready = opt.members.filter(m => !m.d && m.tip == null).map(() => s.t);     // in place already, and standing
  const wound = new Map(), tip = m => { if (m.tip == null) return; to(m.ring); t += hands.press; wound.set(m.ring, t); };
  for (const m of opt.members) if (!m.d && m.tip != null) { tip(m); ready.push(t); }  // in place, tipped into the plane
  const arrive = [], next = [];
  order.forEach((m, i) => {
    tip(m);                                                      // tipped and set going on one choosing of the hoop
    to(m.ring);
    t += hands.press;
    const k = levels[i];
    arrive[i] = beatAfter(s, t) + (Math.abs(m.d) / STRIDE[k] - 1) * EVERY[k];
    next[i] = arrive[i] + EVERY[k];
    if (one) { t = Math.max(t, beatTime(s, arrive[i]) + hands.react); ready.push(t); }
  });
  const stops = [];
  if (!one) {
    for (const i of order.map((_, i) => i).sort((i, j) => arrive[i] - arrive[j])) {
      to(order[i].ring);
      t = Math.max(t, beatTime(s, arrive[i]) + hands.react + hands.juggle * (order.length - stops.length - 1));
      if (t > beatTime(s, next[i]) - margin) return null;
      stops.push(i);
      ready.push(t);
    }
  }
  ready.sort((a, b) => a - b);
  const done = strikeAt(s, ready[2]);
  if (opt.n === 4 && !(ready[3] < done - 0.05)) return null;
  if (!atGate(opt.key)) for (const m of opt.members) { const r = s.rings[m.ring]; if ((wound.has(m.ring) ? wound.get(m.ring) + r.drift : r.driftAt) < done + 0.1) return null; }
  return { done, order, levels, one, stops };
}
/** The plan for the cheapest alignment worth most for its time: what to tip, which hoops to set which way at which setting and in what order, and which to stop. */
function plan(s, me, hands, tips) {
  const P = period(s), opts = options(s, tips);
  const worth = o => (o.n + AWARD[o.n] / 100);
  const rough = o => {
    const moving = o.members.filter(m => m.d), tipped = o.members.filter(m => m.tip != null), touched = new Set([...moving, ...tipped].map(m => m.ring)).size;
    return touched * hands.tap + (tipped.length + moving.length) * hands.press + moving.length * (hands.tap + hands.press) + Math.max(0, ...moving.map(m => Math.abs(m.d) / (fits(m.d, 4) ? 2 : 1) - 1)) * P + P;
  };
  // a line in a plane is no use if a hoop of it left alone will drift out before it can be struck
  const lasts = o => atGate(o.key) || o.members.every(m => m.tip != null || s.rings[m.ring].driftAt > s.t + rough(o) + 0.5);
  const top = opts.filter(lasts).map(o => ({ o, r: worth(o) / (rough(o) + hands.think) })).sort((a, b) => b.r - a.r).slice(0, TOP);
  let best = null;
  for (const { o } of top) {
    const moving = o.members.filter(m => m.d);
    for (const order of perms(moving)) {
      const tries = [[order.map(() => 3), true], [order.map(m => (fits(m.d, FASTEST) ? FASTEST : 3)), true]];
      const lv = (order.length > 3 ? [4, 3, 2] : [4, 3, 2, 1]).filter(l => l <= FASTEST);
      const grid = order.reduce((acc, m) => acc.flatMap(p => lv.filter(l => fits(m.d, l)).map(l => [...p, l])), [[]]);
      for (const levels of grid) tries.push([levels, false]);
      for (const [levels, one] of tries) {
        const r = rehearse(s, me, hands, o, order, levels, one);
        if (!r) continue;
        const rate = worth(o) / (r.done - s.t + hands.think - FORESIGHT * o.members.filter(m => m.tip != null).length * (hands.tap + hands.press));
        if (!best || rate > best.rate) best = { ...r, opt: o, rate };
      }
    }
  }
  return best;
}

/**
 * A person playing: looks (thinks), plans the alignment worth most for its time, does it with the hands it has (a tap to
 * choose a hoop, a press for each button, a moment to see a hoop arrive and stop it), watches for it to clear, stops
 * whatever is still going, and looks again. A hoop that steps on past its place (a stop too late) spoils the plan, and so
 * does a hoop of it drifting out of the plane; it looks again. `tips: false` never tips a hoop; `flat` tips every hoop
 * alike before anything else.
 */
function careful(hands, seed, { tips = true, flat = false } = {}) {
  let x = (seed * 2654435761 + 977) >>> 0;
  const rnd = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
  const vary = v => v * Math.exp(hands.jitter * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(TAU * rnd()));
  const me = { chosen: -1 }, stats = { plans: 0, tips: 0, misses: 0, broken: 0, stops: 0, fast: 0, tipAt: [] };
  let todo = [{ kind: "think" }], busy = null, waiting = null, goal = null, spoilt = false;
  if (flat) todo = [{ kind: "level" }, { kind: "think" }];          // every hoop tipped like the first, before anything else
  const moved = new Map();                                       // a hoop set going: { steps taken since, steps it needs }
  const halt = s => s.rings.flatMap((r, ring) => (r.set ? [ring] : [])).sort((a, b) => (b === me.chosen) - (a === me.chosen)).flatMap(ring => [{ kind: "pick", ring }, { kind: "set", ring, k: 0 }]);
  function start(s, job) {
    const t = s.t;
    if (job.kind === "think") return { at: t + vary(hands.think), then: () => {
      const p = plan(s, me, hands, tips);
      stats.plans++;
      if (TRACE) console.log(`${s.t.toFixed(1)} s, ${planets(s)} planets, tips ${s.rings.map(r => r.tip).join(" ")}: ${p ? `${"YGBR"[p.opt.colour]} ${p.opt.key} ×${p.opt.n}, ${p.opt.members.map(m => `${m.ring + 1}${m.tip != null ? `↷${m.tip}` : ""}${m.d ? `${m.d > 0 ? "+" : ""}${m.d}` : ""}`).join(" ")}, struck at ${p.done.toFixed(1)}` : "nothing"}`);
      if (!p) { todo.push({ kind: "think" }); return; }
      goal = { ids: p.opt.members.map(m => id(m.ring, m.place)), rings: new Set(p.opt.members.map(m => m.ring)), plane: !atGate(p.opt.key), until: p.done + 1.5 + (p.done - s.t) * 0.3 };
      for (const m of p.opt.members) if (!m.d && m.tip != null) todo.push({ kind: "pick", ring: m.ring }, { kind: "tip", ring: m.ring, k: m.tip });
      p.order.forEach((m, i) => {
        if (m.tip != null) todo.push({ kind: "pick", ring: m.ring }, { kind: "tip", ring: m.ring, k: m.tip });
        todo.push({ kind: "pick", ring: m.ring }, { kind: "set", ring: m.ring, k: Math.sign(m.d) * p.levels[i], steps: Math.abs(m.d) / STRIDE[p.levels[i]] });
        if (p.one) todo.push({ kind: "stop", ring: m.ring });
      });
      for (const i of p.stops) todo.push({ kind: "pick", ring: p.order[i].ring }, { kind: "stop", ring: p.order[i].ring });
      todo.push({ kind: "watch" });
    } };
    if (job.kind === "level") return { at: t, then: () => { const T = s.rings[0].tip; todo.unshift(...s.rings.flatMap((r, ring) => (r.tip === T ? [] : [{ kind: "pick", ring }, { kind: "tip", ring, k: T }]))); } };
    if (job.kind === "pick") return { at: t + (me.chosen === job.ring ? 0 : vary(hands.tap)), then: () => { me.chosen = job.ring; } };
    if (job.kind === "set") return { at: t + vary(hands.press), then: () => { if (setRing(s, job.ring, job.k) && job.steps) { moved.set(job.ring, { taken: 0, need: job.steps }); if (Math.abs(job.k) === SPIN) stats.fast++; } } };
    if (job.kind === "tip") return { at: t + vary(hands.press), then: () => { if (setTip(s, job.ring, job.k)) { stats.tips++; stats.tipAt.push(s.t); } } };
    if (job.kind === "stop") {
      const m = moved.get(job.ring);
      if (!m || !s.rings[job.ring].set) return { at: t, then: () => {} };
      if (m.taken < m.need) return null;                         // not there yet: wait for the next beat
      if (m.taken > m.need) return { at: t, then: () => { stats.misses++; todo = [...halt(s), { kind: "think" }]; } };
      const others = s.rings.filter((r, ring) => ring !== job.ring && r.set).length;
      return { at: Math.max(t, s.rings[job.ring].moved + vary(hands.react + hands.juggle * others)), then: () => {
        if (moved.get(job.ring).taken === m.need) { setRing(s, job.ring, 0); stats.stops++; }
        else { stats.misses++; todo = [...halt(s), { kind: "think" }]; }
      } };
    }
    if (job.kind === "watch") {
      const gone = goal.ids.every(i => s.rings[Math.floor(i / PLACES)].places[i % PLACES] < 0);
      if (!gone && s.t < goal.until) return null;
      return { at: t, then: () => { todo.push(...halt(s), { kind: "think" }); } };
    }
    throw new Error(job.kind);
  }
  return {
    stats,
    /** When it next does something: its hand free again, or the next beat or landing if it's waiting to see what they do. */
    wake: s => {
      if (spoilt) return s.t;
      if (busy) return busy.at;
      if (!waiting) return s.t;
      if (waiting.kind === "stop") return s.beatAt;
      return Math.max(s.t + 1e-6, Math.min(s.beatAt, s.next.due, goal.until));
    },
    saw(e) {
      if (e.type === "beat") for (const { ring } of e.stepped) { const m = moved.get(ring); if (m) m.taken++; }
      if (e.type === "drift" && goal?.plane && goal.rings.has(e.ring) && todo.length) spoilt = true;     // a hoop of the plan drifted out of its plane
    },
    act(s) {
      if (spoilt) { spoilt = false; busy = null; waiting = null; stats.broken++; todo = [...halt(s), { kind: "think" }]; }
      if (busy && s.t >= busy.at - 1e-9) { const b = busy; busy = null; b.then(); }
      while (!busy && todo.length) {
        const job = todo[0], b = start(s, job);
        if (!b) { waiting = job; return; }
        waiting = null;
        todo.shift();
        if (b.at <= s.t + 1e-9) b.then(); else { busy = b; return; }
      }
    },
  };
}
/** A person pressing at random, as fast as a careful hand goes: every hoop tipped alike first, then a hoop picked and one of the nine spin buttons or the seven tips, again and again. */
function masher(hands, seed) {
  let x = (seed * 2246822519 + 3) >>> 0, at = 0, first = true;
  const rnd = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
  return {
    stats: {},
    wake: () => at,
    saw() {},
    act(s) {
      if (first) { s.rings.forEach((r, ring) => setTip(s, ring, s.rings[0].tip)); first = false; }
      const ring = Math.floor(rnd() * RINGS), k = Math.floor(rnd() * 16);
      if (k < 9) setRing(s, ring, k - SPIN); else setTip(s, ring, k - 9 - TIP_MAX);
      at = s.t + hands.tap + hands.press;
    },
  };
}
const PLAYERS = {
  idle: { name: "touching nothing", make: () => ({ stats: {}, wake: () => Infinity, saw() {}, act() {} }) },
  spinner: { name: "setting every hoop going and waiting", make: () => { let done = false; return { stats: {}, wake: s => (done ? Infinity : s.t), saw() {}, act(s) { if (!done) { s.rings.forEach((r, ring) => setTip(s, ring, s.rings[0].tip)); [3, -2, 4, -1].forEach((k, ring) => setRing(s, ring, k)); done = true; } } }; } },
  masher: { name: "pressing buttons on hoops at random", make: seed => masher(HANDS.careful, seed) },
  careful: { name: "a careful player", make: seed => careful(HANDS.careful, seed) },
  gates: { name: "a careful player who never tips", make: seed => careful(HANDS.careful, seed, { tips: false }) },
  flat: { name: "a careful player who tips every hoop alike first", make: seed => careful(HANDS.careful, seed, { flat: true }) },
  quick: { name: "a quick player", make: seed => careful(HANDS.quick, seed) },
  quickgates: { name: "a quick player who never tips", make: seed => careful(HANDS.quick, seed, { tips: false }) },
};
/** A game played out to its end (or LIMIT seconds) by a player at a tempo: what it came to. */
function play(seed, tempo, who) {
  const s = newGame(seed, tempo), p = PLAYERS[who].make(seed);
  let guard = 0, sane = true, gates = 0, spokes = 0, drifted = 0;
  while (!s.over && s.t < LIMIT && guard++ < 1e6) {
    const at = Math.min(LIMIT, Math.max(s.t, p.wake(s)));
    if (at > s.t) for (const e of step(s, at - s.t)) { p.saw(e, s); if (e.type === "lock") { if (atGate(e.key)) gates++; else spokes++; } if (e.type === "drift") drifted++; }
    if (!s.over) p.act(s);
    if (!s.rings.every(r => Number.isInteger(r.a) && r.a >= 0 && r.a < PLACES && Math.abs(r.tip) <= TIP_MAX && Math.abs(r.set) <= SPIN)) sane = false;
  }
  const st = p.stats, late = (st.tipAt || []).filter(t => t > s.t / 2).length;
  return { t: s.t, score: s.score, aligned: s.aligned, fours: s.fours, over: s.over, sane, gates, spokes, drifted, late, alike: Math.max(...[-3, -2, -1, 0, 1, 2, 3].map(T => s.rings.filter(r => r.tip === T).length)), ...st };
}
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  const games = MEASURE ? Number(ARG("games") || 30) : 6;
  if (TRACE) {
    const who = process.argv.find(x => PLAYERS[x]) || "careful", r = play(Number(ARG("trace")), ARG("tempo") != null ? Number(ARG("tempo")) : FIRST_TEMPO, who);
    console.log(`${PLAYERS[who].name}: ${r.t.toFixed(0)} s, ${r.score} points, ${r.aligned} lines (${r.gates} at the gates, ${r.spokes} in planes), ${r.tips} tips, ${r.drifted} drifts, ${r.broken} broken`);
    process.exit(0);
  }
  if (MEASURE) {
    const named = process.argv.find(x => x.split(",").every(k => PLAYERS[k])), who = named ? named.split(",") : Object.keys(PLAYERS);
    const tempos = ARG("tempo") != null ? ARG("tempo").split(",").map(Number) : TEMPOS.map((_, k) => k);
    const t0 = Date.now();
    for (const w of who) for (const k of tempos) {
      const list = Array.from({ length: games }, (_, g) => play(100 + g, k, w));
      const ts = list.map(r => r.t), sc = list.map(r => r.score), sum = f => list.reduce((a, r) => a + (r[f] || 0), 0), per = f => (sum(f) / games).toFixed(1);
      const perMin = (sum("tips") / (ts.reduce((a, b) => a + b, 0) / 60)).toFixed(2);
      console.log(`${PLAYERS[w].name} at ${TEMPOS[k]}: ${median(ts).toFixed(0)} s (${Math.min(...ts).toFixed(0)} to ${Math.max(...ts).toFixed(0)}), scoring ${median(sc)}, ${per("aligned")} lines (${per("fours")} fours; ${per("gates")} at the gates, ${per("spokes")} in planes), `
        + `${per("tips")} tips (${perMin} a minute, ${per("late")} in the game's second half), ${per("drifted")} drifts, ${per("broken")} plans broken by one, ${per("fast")} hoops set two a beat, ${per("misses")} stops missed, ${per("alike")} hoops alike at the end; ${list.filter(r => !r.over).length} not over`);
    }
    console.log(`(pace ${PACE.first}, ${PACE.least}, ${PACE.half}; drift ${DRIFT.join(", ")}; ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    process.exit(0);
  }
  const at = FIRST_TEMPO, games6 = who => Array.from({ length: games }, (_, g) => play(100 + g, at, who));
  const idle = games6("idle"), spin = games6("spinner"), done = games6("careful"), gates = games6("gates"), quick = games6("quick"), quickGates = games6("quickgates");
  const med = (list, k) => median(list.map(r => r[k]));
  check(idle.every(r => r.over) && med(idle, "aligned") <= 1, `touching nothing, the hoops stand still (and drift): full after about ${med(idle, "t").toFixed(0)} seconds, with ${med(idle, "aligned")} lines`);
  check(spin.every(r => r.aligned === 0 && r.over), "tipping every hoop alike, setting them all going and waiting: not one line, since a hoop going round is in none");
  check(med(done, "t") > 2.5 * med(idle, "t") && med(done, "score") > 50 * Math.max(100, med(idle, "score")),
    `a careful player lasts far longer (about ${med(done, "t").toFixed(0)} seconds at ${TEMPOS[at]} a minute, ${med(done, "score").toLocaleString("en-GB")} points)`);
  check(done.every(r => r.tips >= 20 && r.late >= 8 && r.spokes >= r.gates / 2),
    `tipping into the planes all game long: about ${med(done, "tips")} tips a game, ${med(done, "late")} in its second half, and ${med(done, "spokes")} lines in planes to ${med(done, "gates")} at the gates`);
  check(med(done, "score") > 1.12 * med(gates, "score") && med(done, "t") > med(gates, "t") && med(quick, "score") > 1.4 * med(quickGates, "score") && med(quick, "t") > med(quickGates, "t"),
    `worth more than never tipping (${med(done, "score").toLocaleString("en-GB")} points to ${med(gates, "score").toLocaleString("en-GB")}), and the more the quicker the hand (${med(quick, "score").toLocaleString("en-GB")} to ${med(quickGates, "score").toLocaleString("en-GB")})`);
  check(done.every(r => r.drifted >= 5) && done.some(r => r.broken > 0) && done.every(r => r.fast > 0), "the hoops drift under it all game, now and then spoiling a plan, and it sets hoops going two places a beat");
  check(med(quick, "t") > med(done, "t") && med(quick, "score") > med(done, "score"), `a quicker one longer still (about ${med(quick, "t").toFixed(0)} seconds, ${med(quick, "score").toLocaleString("en-GB")} points)`);
  check([...idle, ...spin, ...done, ...gates, ...quick, ...quickGates].every(r => r.over && r.sane), "and every game ends, the hoops on whole places, tips and settings throughout");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("orrery: the deal, the beat, stepping (two places a beat too), alignments at the gates and in the colours' planes, the drift, clearing, the combo, planets landing on the clock, the end, saving, the old version replaced, whole games");
