// Orrery's rules (orrery-engine.js): the deal from a seed (four hoops, whole places, every hoop going slow the same way,
// each in a colour's plane, each its own pace of drift, planets, every colour at least twice, no three of a colour at one
// place, so nothing lines up while the orrery turns together); the beat (the tempos, the cap of one a second, a change of
// tempo, the beat on the game's own clock); the hoops stepping (each of the six settings' rhythm left and right, exactly a
// place a step or two at the fastest, no setting still, a new setting answering on the next beat, the rhythms over a
// long run, a step drawn) and a press of a colour (every hoop into its plane at once, or one hoop alone, drawn turning
// quickly); alignment, exact (at the gates whatever the tips, anywhere in the colour's own plane, not in another's, not
// otherwise, however the hoops are going; three and four, mixed colours not, two at once); a line made and struck (by a
// beat's steps on hoops going at three speeds, struck on the next beat where it stood, before that beat's steps; one made
// just before a beat; a fourth pressed into it; a press for one hoop keeping a line on the others; a landing or a press
// completing one; one broken first); the drift (its pace, its step and its turn at 45 degrees, no clock wound by a press,
// breaking a line, standing still with the game); clearing, the points and the combo; the planets landing on the clock
// (the pace, foretold, the place, a full orrery ending it); no hoop taking more than three of a colour, and a colour
// landing where it is already less often; a game saved and opened again; the old version replaced; and whole games
// played out by simple players with a person's delays.
// `node tests/orrery.mjs measure` plays more games for each player instead, at every tempo, and prints what the README's
// numbers come from; `games=40`, `limit=1500` (seconds), `tempo=2`, `pace=6.5,1,170`, `drift=30,36,42,48` (or
// `drift=off`), `wind=all` or `wind=moved` (a press winding the drift's clocks) and a
// list of players (`careful,quick`) change it; `trace=100` prints the plans of one game (seed 100) as they're made.
import {
  VERSION, RINGS, PLACES, COLOURS, START, TAU, STEP, DEG, TEMPOS, FIRST_TEMPO, SPIN, REFERENCE, FIRST_SET, TIP, TIP_MAX, PLANE, DRIFT, TICK, TIP_TIME, DWELL, AWARD, COMBO_WINDOW,
  FORETELL, PACE, gap, multiplier, period, between, id, seatOf, angleOf, room, planets, dirOf, keyOf, planeOf, turnOf, tiltOf, clusters, crowds, newGame, valid, copy, setRing,
  setTempo, nextDrift, driftTime, aims, AIMS, step, look, strikeAt, setPlane, CAP, ALIKE, holds,
} from "../orrery-engine.js";

let bad = 0;
const check = (ok, what) => { if (!MEASURE || !ok) console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const MEASURE = process.argv.includes("measure"), ARG = k => process.argv.find(x => x.startsWith(`${k}=`))?.slice(k.length + 1);
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const mod = q => ((q % PLACES) + PLACES) % PLACES;
const NEVER = 1e9;
// The game's tempos run from one beat a minute to twenty, so a beat is three seconds at quickest. Most checks below are
// written in whole seconds, so they use a tempo of their own, sixty a minute, put on the end of the list here (T1).
const GAME_TEMPOS = [...TEMPOS], T1 = TEMPOS.push(60) - 1;
/**
 * An orrery drawn by hand: every hoop held (set to nothing, which no game has, and its first step NEVER beats away: the
 * rules only ask a hoop when it's due to step), so it stands until a test sets it going; at turn 0 and at the tips given,
 * no planets, nothing landing, nothing drifting; then put planets on it.
 */
function sky(tips = [0, 0, 0, 0], tempo = T1) {
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
const SETTINGS = [-2, -1, 1, 2];

// ---------- the deal ----------
/** A new game's hoops with their drifts counted in beats, so that games at different tempos can be told alike. */
const inBeats = g => g.rings.map(r => ({ ...r, driftAt: Math.round((r.driftAt / period(g)) * 1e6) }));
{
  const a = newGame(7), b = newGame(7), c = newGame(8);
  check(JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a.rings) !== JSON.stringify(c.rings), "the same seed deals the same orrery, another seed another");
  check(a.v === VERSION && VERSION === 8 && RINGS === 4 && a.rings.length === RINGS && a.rings.every(r => r.places.length === PLACES && Number.isInteger(r.a) && r.a >= 0 && r.a < PLACES) && a.t === 0 && a.beat === 0 && a.score === 0 && !a.over && valid(a),
    `${RINGS} hoops of ${PLACES} places, each turned to a whole place`);
  check([...Array(40).keys()].every(k => newGame(k).rings.every(r => r.set === FIRST_SET)) && FIRST_SET === -1,
    "every hoop going slow, all the same way and stepping on every beat: the whole orrery turning together, anticlockwise seen from above");
  check([...Array(40).keys()].every(k => newGame(k).rings.map(r => r.tip).sort((x, y) => x - y).join() === [...PLANE].sort((x, y) => x - y).join()),
    `each hoop in a different colour's plane to begin with: ${[...PLANE].sort((x, y) => x - y).map(p => p * 15).join(", ")} degrees, in some order`);
  check([...Array(60).keys()].every(k => planets(newGame(k)) === START && clusters(newGame(k)).length === 0 && crowds(newGame(k)).length === 0) && room(a) === RINGS * PLACES - START,
    `${START} planets in places, none in line to begin with, nor three of a colour at one place round`);
  check([...Array(200).keys()].every(k => { const n = Array(COLOURS).fill(0); for (const r of newGame(k).rings) for (const x of r.places) if (x >= 0) n[x]++; return Math.min(...n) >= 2; }), "every colour dealt at least twice, so each can line up");
  check(a.next.ring >= 0 && a.rings[a.next.ring].places[a.next.place] === -1 && a.next.colour >= 0 && a.next.colour < COLOURS && near(a.next.due, gap(0) * period(a)), "the first planet foretold, for an empty place, to land a gap (in beats) in");
  check(a.tempo === FIRST_TEMPO && newGame(7, 0).tempo === 0 && newGame(7, 9).tempo === TEMPOS.length - 1 && JSON.stringify(inBeats(newGame(7, 0))) === JSON.stringify(inBeats(a)), "a new game at the tempo asked for (the same orrery at any tempo, its drifts as many beats away)");
  // each hoop its own pace of drift, from the seed
  const paces = [...Array(40).keys()].map(k => newGame(k).rings.map(r => r.drift).join());
  check(paces.every(p => p.split(",").map(Number).sort((x, y) => x - y).join() === [...DRIFT].sort((x, y) => x - y).join()) && new Set(paces).size > 8 && DRIFT.every(d => d >= 3 && d <= 30) && new Set(DRIFT).size === RINGS,
    `each hoop drifts at a pace of its own, every ${DRIFT.join(", ")} beats, dealt to the hoops from the seed`);
  check([...Array(40).keys()].every(k => newGame(k).rings.every(r => near(r.driftAt, r.drift * period(newGame(k))) && Math.abs(r.way) === 1 && Math.abs(r.tip + r.way) <= TIP_MAX)) && new Set([...Array(40).keys()].map(k => newGame(k).rings.map(r => r.way).join())).size > 4,
    "the first drift a whole pace in, which way from the seed (back, from 45 degrees)");
  // turning together, the hoops keep which planets are together: with nothing landing and nothing drifting, no line comes
  const quiet = [...Array(40).keys()].map(k => { const g = newGame(k, T1); g.next.due = NEVER; g.rings.forEach(r => { r.driftAt = NEVER; }); return { g, g0: newGame(k, T1), ev: step(g, 125) }; });
  check(quiet.every(({ g, g0, ev }) => !locks(ev).length && g.beat === 125 && ev.filter(e => e.type === "beat").every(e => e.stepped.length === 0 || e.stepped.length === RINGS)
    && g.rings.every((r, i) => r.a === mod(g0.rings[i].a - 125))),
  "left alone, the orrery turns together, every hoop a place back on every beat, all together, and with nothing landing or drifting no step brings a line");
}

// ---------- the beat ----------
{
  check(GAME_TEMPOS.join() === "1,2,4,6,12,20" && GAME_TEMPOS.every((b, k) => k === 0 || b > GAME_TEMPOS[k - 1]) && FIRST_TEMPO === 4, `tempos of ${GAME_TEMPOS.join(", ")} beats a minute: the fastest twenty, a beat every three seconds, a first game at twelve`);
  const counts = TEMPOS.map((b, k) => { const s = sky([0, 0, 0, 0], k); const n = step(s, 60 + 1e-6).filter(e => e.type === "beat").length; return [n, b, s.beat]; });
  check(counts.every(([n, b, at]) => n === b && at === b), `a minute's beats at each tempo: ${counts.map(c => c[0]).join(", ")}`);
  const s = sky([0, 0, 0, 0], T1);
  check(!setTempo(s, T1) && setTempo(s, 99) === false && s.tempo === T1 && (setTempo(s, -4), s.tempo === 0) && 60 / period(s) === 1 && newGame(7, 99).tempo === T1, "no slower than one a minute (nor quicker than the list)");
  // a change of tempo: the next beat a beat of the new tempo after the last, or at once if that has gone by
  const t = sky([0, 0, 0, 0], 5);
  run(t, 3.5);                                                   // twenty a minute: a beat at 3 s, the next due at 6
  setTempo(t, T1);                                               // one a second: the next is a second after the last, at 4
  const ev = run(t, 0.6);
  setTempo(t, 5);
  const at = t.beatAt;
  const u = sky([0, 0, 0, 0], 5);
  run(u, 5.5);                                                   // last beat at 3 s; at sixty a minute the next would be at 4, gone by
  setTempo(u, T1);
  const now = run(u, 0.001).filter(e => e.type === "beat").length;
  check(ev.some(e => e.type === "beat") && near(t.lastBeat, 4) && near(at, 4 + 3) && now === 1 && near(u.lastBeat, 5.5) && near(u.beatAt, 6.5), "a change of tempo: the next beat comes a beat of the new tempo after the last, or at once if that's gone by");
  // what is counted in beats keeps its place in them when the beat changes: the planet foretold and each drift
  const w = newGame(9, 4), due0 = w.next.due, drift0 = w.rings.map(r => r.driftAt);
  setTempo(w, 5);
  check(near(w.next.due, due0 * 3 / 5) && w.rings.every((r, k) => near(r.driftAt, drift0[k] * 3 / 5)), "a change of tempo stretches what's counted in beats: the planet foretold and each drift come as many beats away as they were");
  // the beat is the game's: stepped in frames or all at once, the same beats; not stepped (the page's pause), nothing happens
  const f = newGame(5, 4), g = newGame(5, 4);
  setRing(f, 1, 2); setRing(g, 1, 2);
  const fe = run(f, 29.5, 1 / 60).filter(e => e.type === "beat").length, ge = step(g, 29.5).filter(e => e.type === "beat").length;
  const held = copy(f);
  step(f, 0);
  check(fe === ge && fe === Math.floor(29.5 / period(f)) && JSON.stringify(f.rings) === JSON.stringify(g.rings) && JSON.stringify(f) === JSON.stringify(held), "the beat keeps the game's own time: played in frames or at once, the same beats; while the game stands (the menu open), none");
}

// ---------- the hoops step ----------
{
  check(SETTINGS.every(k => Math.abs(k) >= 1 && Math.abs(k) <= SPIN) && SPIN === 2 && SETTINGS.length === 4,
    "four settings, none of them still: slow (a place on every beat) and fast (two places on every beat), each way");
  // each setting: set after a beat, it steps on the next beat and on every beat after, the way it's set
  const rhythm = k => {
    const s = sky([0, 0, 0, 0], T1);
    run(s, 2.5);                                                 // two beats in
    const a0 = s.rings[2].a, beats = [];
    setRing(s, 2, k);
    for (const e of run(s, 12)) if (e.type === "beat" && e.stepped.some(x => x.ring === 2)) beats.push(e.beat);
    return { beats, turn: mod(s.rings[2].a - a0) };
  };
  const all = SETTINGS.map(k => [k, rhythm(k)]);
  check(all.every(([k, r]) => r.beats.join() === "3,4,5,6,7,8,9,10,11,12,13,14"), "each setting steps on the next beat, then on every beat: " + all.map(([k, r]) => `${k > 0 ? "+" : ""}${k} on ${r.beats.slice(0, 3).join(",")}…`).join("; "));
  check(all.every(([k, r]) => r.turn === mod(k * r.beats.length)), "left steps back, right on: exactly a place a beat when slow, two when fast");
  const s = sky([0, 0, 0, 0], T1);
  setRing(s, 0, 2);
  let whole = true, last = s.rings[0].a;
  for (let k = 0; k < 40; k++) { step(s, 1); const a = s.rings[0].a; if (!Number.isInteger(a) || mod(a - last) !== 2) whole = false; last = a; }
  check(whole, "a step is a twelfth of a turn, or two, and between steps a hoop is always on a place");
  // the fast: two places on every beat, 60 degrees, either way: round in six beats; the slow in twelve
  const fast = sky([0, 0, 0, 0], T1), places = [];
  setRing(fast, 0, 2); setRing(fast, 1, -2); setRing(fast, 2, 1);
  for (let k = 0; k < 12; k++) { step(fast, 1); places.push(`${mod(fast.rings[0].a)}/${mod(fast.rings[1].a)}/${mod(fast.rings[2].a)}`); }
  check(places.slice(0, 4).join(" ") === "2/10/1 4/8/2 6/6/3 8/4/4" && places[5] === "0/0/6" && places[11] === "0/0/0",
    "the fast steps two places on every beat, 60 degrees, right or left: round in six beats; the slow in twelve");
  // none stands still: there is no setting 0, and every hoop of a new game steps on its first beat
  const z = sky([0, 0, 0, 0], T1);
  setRing(z, 0, 2);
  const fresh = newGame(3, T1), moved = new Set();
  for (const e of step(fresh, 1.05)) if (e.type === "beat") for (const x of e.stepped) moved.add(x.ring);
  check(!setRing(z, 0, 0) && !setRing(z, 0, 0.3) && z.rings[0].set === 2 && moved.size === RINGS, "no hoop stands still: a setting of 0 is refused, the hoop going on as it was, and every hoop of a new game steps on its first beat");
  // a new setting answers on the next beat; the setting it has already carries on as it was
  const n = sky([0, 0, 0, 0], T1);
  setRing(n, 1, 1);
  run(n, 1.5);
  const nA = n.rings[1].a;
  check(!setRing(n, 1, 1) && n.rings[1].set === 1, "set as it is already, a hoop goes on as it was");
  setRing(n, 1, -2);
  const e2 = run(n, 1).filter(e => e.type === "beat");
  check(e2.length === 1 && e2[0].stepped.some(x => x.ring === 1 && x.dir === -1 && x.by === -2) && n.rings[1].a === mod(nA - 2), "set to another, it answers on the next beat");
  check((setRing(n, 1, 9), n.rings[1].set === SPIN) && (setRing(n, 1, -9), n.rings[1].set === -SPIN), `no setting past ${SPIN} either way`);
  // over a long run, the rhythms keep exactly
  const long = sky([0, 0, 0, 0], T1);
  [1, -2, 2, -1].forEach((k, ring) => setRing(long, ring, k));
  const count = [0, 0, 0, 0];
  for (const e of step(long, 601)) if (e.type === "beat") for (const x of e.stepped) count[x.ring] += Math.abs(x.by);
  check(count.join() === "601,1202,1202,601" && long.rings.map(r => r.a).join() === `${mod(601)},${mod(-1202)},${mod(1202)},${mod(-601)}`, `over 601 beats: ${count.join(", ")} places, and each hoop where that many put it`);
  // a step is drawn as a tick ending on the place; two places as one tick; a tip turning to the tip
  const d = sky([0, 0, 0, 0], T1);
  setRing(d, 0, 1);
  step(d, 1);
  const r = d.rings[0], t0 = r.moved, path = [0, 0.25, 0.5, 0.75, 1].map(u => turnOf(r, t0 + u * TICK) - (r.a - 1));
  check(near(path[0], 0) && path[4] === 1 && path.slice(1, 4).every((x, k) => x > path[k]) && Math.max(...[...Array(50).keys()].map(k => turnOf(r, t0 + (k / 50) * TICK) - (r.a - 1))) < 1.06 && turnOf(r, t0 + 5) === r.a,
    `a step drawn as a tick over ${TICK} s, past the place by a hair and onto it exactly`);
  setRing(d, 1, -2);
  step(d, 1);
  const r2 = d.rings[1], t2 = r2.moved, path2 = [0, 0.15, 1].map(u => turnOf(r2, t2 + u * TICK) - r2.a);
  const past2 = Math.min(...[...Array(50).keys()].map(k => turnOf(r2, t2 + (k / 50) * TICK) - r2.a));
  check(near(path2[0], 2) && path2[1] < 1.5 && path2[1] > 0.5 && path2[2] === 0 && past2 > -0.12 && turnOf(r2, t2 + 5) === r2.a, "two places drawn as one tick, from where it was, past by a hair and onto where it's going");
  d.rings.forEach(r => { r.tip = r.tipFrom = -1; r.tipAt = -1e9; });
  setPlane(d, 2);                                                // green's plane to blue's: two steps
  const tr = d.rings[1];
  check(d.rings.every(r => r.tip === PLANE[2]) && near(tiltOf(tr, d.t), -TIP) && near(tiltOf(tr, d.t + TIP_TIME / 2), 0) && tiltOf(tr, d.t + TIP_TIME) === TIP && TIP_TIME <= 0.25 && PLANE.every(p => Math.abs(p) <= TIP_MAX) && near(TIP_MAX * TIP, 45 * DEG),
    `a press tips every hoop at once, each drawn turning quickly (over ${TIP_TIME} s) to the colour's plane; no tip past 45 degrees`);
  check(!setPlane(d, 2) && d.rings.every(r => r.tip === PLANE[2]) && !setPlane(d, 9), "pressing the colour every hoop is in already does nothing (nor a colour there isn't)");
  // a press for one hoop: it alone tips; pressed again, nothing; for every hoop then, the others follow
  const o = sky([-1, -1, -1, -1], T1), before = o.rings.map(r => `${r.tip},${r.tipAt}`);
  const one = setPlane(o, 3, 2), alone = o.rings.every((r, k) => (k === 2 ? r.tip === PLANE[3] && near(tiltOf(r, o.t), -TIP) && near(tiltOf(r, o.t + TIP_TIME), PLANE[3] * TIP) : `${r.tip},${r.tipAt}` === before[k]));
  check(one && alone && !setPlane(o, 3, 2) && setPlane(o, 3) && o.rings.every(r => r.tip === PLANE[3]),
    "a press for one hoop tips it alone, drawn turning as every hoop is; for the colour it's in already, nothing; for every hoop, the rest follow");
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
  check(n.length === 1 && n[0].colour === 2 && n[0].key === "N" && n[0].seat === 0 && n[0].ids.join() === [id(0, 3), id(1, 7), id(3, 0)].join() && is(n[0].dir, 0, 0, -1) && sth.length === 1 && sth[0].key === "S" && sth[0].seat === 6 && is(sth[0].dir, 0, 0, 1),
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
  // however the hoops are going: their settings make no difference to a line
  const going = SETTINGS.map(k => { const g = line(sky(MIXED), 1, 0, [0, 3], [1, 7], [3, 0]); g.rings.forEach(r => { r.set = k; }); return clusters(g); });
  check(going.every(cs => cs.length === 1 && cs[0].key === "N"), "however the hoops are going, slow, medium or fast, either way: a line is where the planets are");
  check(clusters(line(sky(MIXED), 1, 0, [0, 1], [1, 2], [2, 3], [3, 4]))[0].members.length === 4 && clusters(line(inPlane(1), 1, 9, [0, 1], [1, 2], [2, 3], [3, 4]))[0].members.length === 4, "four: at a gate, or on four hoops in the colour's plane");
  check(!clusters(line(inPlane(1), 1, 3, [0, 3], [1, 7])).length, "two are not an alignment");
  const mixed = line(line(inPlane(1), 1, 3, [0, 3], [1, 7]), 3, 3, [2, 0]);
  check(!clusters(mixed).length, "three of different colours aren't");
  const two = line(line(sky(MIXED), 0, 0, [0, 1], [1, 2], [2, 3]), 3, 6, [0, 7], [1, 8], [3, 4]);
  const cs = clusters(two);
  check(cs.length === 2 && cs[0].colour === 0 && cs[0].key === "N" && cs[1].colour === 3 && cs[1].key === "S" && !cs[0].ids.some(x => cs[1].ids.includes(x)), "two at once, sharing no planet");
  check(crowds(line(sky(MIXED), 2, 4, [0, 2], [1, 5], [2, 9])).length === 1 && !clusters(line(sky(MIXED), 2, 4, [0, 2], [1, 5], [2, 9])).length, "three of a colour at one place round on hoops tipped apart are together but no line (until a gate, or the plane)");
}

// ---------- a line made, and struck ----------
{
  // by a beat's steps, on hoops going at two speeds: each of two brings a blue planet to twelve o'clock on the first beat,
  // a place on, to meet a third standing there; the line stands from that beat, and the next strikes it before the
  // third hoop's step
  const s = sky(MIXED, T1);
  s.rings[0].places[3] = 2; s.rings[0].a = mod(11 - 3);          // a place short of twelve
  s.rings[1].places[7] = 2; s.rings[1].a = mod(10 - 7);          // two places short of it
  s.rings[2].places[0] = 2; s.rings[2].a = 0;                     // at twelve already, held
  look(s);
  setRing(s, 0, 1); setRing(s, 1, 2);
  check(!s.locks.length, "three blue planets on three hoops, two short of the third: no line");
  const first = step(s, 1.05);
  check(first.some(e => e.type === "beat") && !locks(first).length && s.locks.length === 1 && s.locks[0].key === "N" && s.locks[0].members.length === 3 && near(s.locks[0].at, 1),
    "a beat's steps bring them together at twelve o'clock, on hoops going slow and fast: a line, however they're going");
  setRing(s, 2, -1);                                              // the third hoop set going in the line's beat: it steps on the next
  const second = step(s, 1), lk = locks(second);
  check(lk.length === 1 && lk[0].n === 3 && lk[0].gain === AWARD[3] && lk[0].seat === 0 && s.score === AWARD[3] && planets(s) === 0 && s.cleared === 3 && s.aligned === 1 && second.findIndex(e => e.type === "lock") < second.findIndex(e => e.type === "beat"),
    `and the next beat strikes it, ${AWARD[3]} for three, where it stood (before that beat's steps)`);
  check(s.rings[0].a === mod(8 + 2) && s.rings[1].a === mod(3 + 4) && s.rings[2].a === mod(-1), "and its hoops step on, on that beat, as they would have (the one set going in the line's beat too)");
  // one made just before a beat (by a press) isn't struck on it: on hoops the beat steps apart it's gone; on hoops going
  // alike in the colour's plane it goes round with them, and the beat after strikes it
  const B = PLANE[2], late = line(sky([B, B, B + 2, 0]), 2, 4, [0, 2], [1, 5], [2, 9]), alike = line(sky([B, B, B + 2, 0]), 2, 4, [0, 2], [1, 5], [2, 9]);
  setRing(late, 0, 1); setRing(late, 1, 1); setRing(late, 2, -2); // two on, one fast back: the beat parts them
  [0, 1, 2].forEach(k => setRing(alike, k, 1));                  // all three slow, the same way
  step(late, 0.9); step(alike, 0.9);
  setPlane(late, 2); setPlane(alike, 2);                         // in line a tenth of a second before the beat
  const lt = step(late, 0.2), al = step(alike, 0.2);
  check(!locks(lt).length && !late.locks.length && !locks(step(late, 3)).length && !locks(al).length && alike.locks.length === 1 && alike.locks[0].seat === 5 && locks(step(alike, 1)).length === 1,
    `one made less than ${DWELL} s before a beat waits for the one after: broken by the steps between, or carried round by hoops going alike and struck then`);
  const four = locks(step(line(inPlane(0), 0, 4, [0, 1], [1, 2], [2, 3], [3, 4]), 1.05));
  check(four.length === 1 && four[0].n === 4 && four[0].gain === AWARD[4] && AWARD[4] >= 3 * AWARD[3], `four ${AWARD[4]}: better than three lines of three`);
  // a fourth in its beat: three blue in blue's plane at four o'clock and a fourth hoop with blue there but in red's plane;
  // blue pressed for the fourth alone joins it, and all four are struck together
  const join = line(sky([B, B, B, PLANE[3]]), 2, 4, [0, 2], [1, 5], [2, 9], [3, 1]);
  step(join, 0.4);
  const three = join.locks.length === 1 && join.locks[0].members.length === 3;
  setPlane(join, 2, 3);
  const jl = locks(step(join, 1));
  check(three && jl.length === 1 && jl[0].n === 4 && jl[0].gain === AWARD[4] && join.fours === 1, "a fourth hoop pressed into the plane in the line's beat joins it: all four are struck together");
  // a press for one hoop leaves the others as they are: a red line in red's plane stands while a fourth hoop is pressed
  // into green's; pressed for every hoop, green would have broken it
  const R = PLANE[3], kept = line(sky([R, R, R, 0]), 3, 2, [0, 1], [1, 4], [2, 6]), broken = line(sky([R, R, R, 0]), 3, 2, [0, 1], [1, 4], [2, 6]);
  setPlane(kept, 1, 3); setPlane(broken, 1);
  check(kept.locks.length === 1 && kept.rings[3].tip === PLANE[1] && locks(step(kept, 1.05)).length === 1 && !broken.locks.length && !locks(step(broken, 1.05)).length,
    "a colour pressed for one hoop tips it alone: a line standing on the others is kept (pressed for every hoop, the line would have broken)");
  // by a landing: two in place, the third foretold onto the place that's at twelve on its hoop
  const l = line(sky(MIXED), 2, 0, [0, 3], [1, 7]);
  l.rings[3].a = 5;
  l.next = { due: 0.5, ring: 3, place: 7, colour: 2 };
  const le = step(l, 1.05);
  check(le.some(e => e.type === "land" && e.ring === 3) && locks(le).length === 1 && locks(le)[0].members.some(m => m.ring === 3), "a planet landing completes one");
  // by a press: three blue at four o'clock, two hoops in blue's plane, the press of blue tipping the rest into it
  const tp = line(sky([B, B, B + 2, -1]), 2, 4, [0, 2], [1, 5], [2, 9]);
  check(!clusters(tp).length && setPlane(tp, 2) && tp.rings.every(r => r.tip === B) && tp.locks.length === 1 && locks(step(tp, 1.05)).length === 1 && planets(tp) === 0, "a press of blue tips every hoop into blue's plane and completes one, and the beat strikes it");
  const tp1 = line(sky([B, B, B + 2, -1]), 2, 4, [0, 2], [1, 5], [2, 9]);
  check(setPlane(tp1, 2, 2) && tp1.rings[3].tip === -1 && tp1.locks.length === 1 && locks(step(tp1, 1.05)).length === 1, "and so does blue pressed for the one hoop out of the plane");
  // one broken before the beat strikes it is gone; a hoop of one set anew breaks nothing, since the beat strikes before it steps
  const br = line(sky([B, B, B, -1]), 2, 4, [0, 2], [1, 5], [2, 9]);
  step(br, 0.5);
  setPlane(br, 3);                                               // every hoop to red's plane: out of blue's
  const br2 = line(sky([B, B, B, -1]), 2, 4, [0, 2], [1, 5], [2, 9]);
  step(br2, 0.5);
  setRing(br2, 0, -3);
  check(!br.locks.length && !locks(step(br, 2)).length && planets(br) === 3 && br2.locks.length === 1 && locks(step(br2, 0.6)).length === 1,
    "one broken before the beat (the hoops pressed into another colour's plane) isn't struck; one with a hoop of it set anew is, before that hoop steps");
  // a fourth landing in it while it shows keeps its time, and all four are struck
  const g = line(sky(MIXED), 0, 6, [0, 1], [1, 2], [2, 3]);
  g.rings[3].a = 2;
  g.next = { due: DWELL / 2, ring: 3, place: 4, colour: 0 };
  const gl = locks(step(g, 1.05));
  check(gl.length === 1 && gl[0].n === 4 && gl[0].gain === AWARD[4] && near(g.lastLock, 1), "a fourth landing in it while it stands: all four are struck together");
}

// ---------- something to aim at ----------
{
  // a colour can be lined up only with planets on three hoops (a line has one planet to a hoop): the deal and the landings keep one to three
  const starts = [...Array(300).keys()].map(k => aims(newGame(k)));
  check(starts.every(n => n >= AIMS.least && n <= AIMS.most) && AIMS.least === 1 && AIMS.most === 3, "every game starts with a colour or two on three hoops to aim for, never none (the start was all different planets on different hoops)");
  // nothing aimed at: the planet foretold takes the colour on most hoops to one it isn't on
  const lone = sky();
  lone.rings[0].places[0] = 0; lone.rings[1].places[3] = 0; lone.rings[2].places[6] = 1; lone.rings[3].places[9] = 2;
  lone.next = { due: 0.1, ring: 3, place: 5, colour: 2 };
  run(lone, 0.2);
  check(aims(lone) === 0 && lone.next.colour === 0 && lone.next.ring >= 2 && lone.rings[lone.next.ring].places[lone.next.place] < 0, "with nothing to aim at, the planet foretold next is the colour that's on two hoops, for a third");
  // as many to aim at as are wanted: none that makes another
  const full = sky();
  [0, 1, 2].forEach(c => [0, 1, 2].forEach(r => { full.rings[r].places[c * 4] = c; }));        // three colours, each on three hoops
  full.rings[3].places[1] = 3; full.rings[0].places[1] = 3; full.rings[1].places[1] = 3;        // a fourth, on three too: more than wanted
  [full.rings[3].places[1], full.rings[0].places[1], full.rings[1].places[1]] = [-1, -1, 3];      // … taken back to one hoop
  let made = 0;
  for (let k = 0; k < 60; k++) { const g = copy(full); g.n = k * 7; g.next = { due: 0.1, ring: 2, place: 11, colour: 0 }; run(g, 0.2); if (aims(g) > AIMS.most) made++; }
  check(aims(full) === 3 && made === 0, "with three to aim at, the planets foretold never make a fourth");
  // played with no hand (nothing cleared) the first thirty planets keep something to aim at nearly always
  let seen = 0, with0 = 0;
  for (let k = 1; k <= 60; k++) { const g = newGame(k, 5); for (let t = 0; t < 300 && !g.over && planets(g) < 30; t++) if (step(g, 1).some(e => e.type === "land")) { seen++; if (!aims(g)) with0++; } }
  check(with0 / seen < 0.01, `after a landing there is almost always a colour to aim at (${with0} of ${seen} with none)`);
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
  // its pace in beats, not seconds: the same drifts at every tempo, as many beats apart (nothing landing)
  const byTempo = TEMPOS.map((_, k) => { const g = newGame(31, k), P = period(g); g.next.due = NEVER; return drifts(run(g, 197.3 * P, P / 10)).map(e => `${e.ring}${e.tip}`).join(); });
  check(byTempo.every(x => x === byTempo[0]) && byTempo[0].split(",").length >= 15, "the drift is counted in beats: the same drifts at every tempo, a slow one as many beats apart as a quick one");
  // a press winds no clock: each hoop drifts on its own, whatever is pressed
  const w = sky([1, 1, 1, 1]);
  w.rings.forEach((r, k) => { r.drift = 20 + k; r.driftAt = 20 + k; });
  run(w, 15);
  setPlane(w, 0, 1);                                             // one hoop alone to yellow's plane
  setPlane(w, 3);                                                // then every hoop to red's plane, 5 to 8 seconds before it drifts
  check(w.rings.every((r, k) => r.tip === 3 && r.driftAt === 20 + k), "a press winds no hoop's drift, for one hoop or for every one: each keeps its own clock, whatever is pressed");
  const dw = drifts(run(w, 10));
  check(dw.map(e => `${e.ring}:${e.from}>${e.tip}`).join() === "0:3>2,1:3>2,2:3>2,3:3>2" && w.rings.every((r, k) => r.driftAt === 40 + 2 * k), "so the hoops drift out of the plane one by one, each at its own time, until pressed again");
  const end = sky([0, 0, 0, 0]);
  end.rings.forEach((r, k) => { r.way = k % 2 ? 1 : -1; });
  setPlane(end, 0);
  check(end.rings.every(r => r.tip === -3 && r.way === 1) && (setPlane(end, 3), end.rings.every(r => r.tip === 3 && r.way === -1)), "pressed to 45 degrees either way, every hoop drifts back from there");
  // a drift comes on a beat, after the hoops have stepped (not before them, and not between beats)
  const B = PLANE[2];
  const when = sky([B, B, B, 0]);
  when.rings[1].driftAt = 0.2; when.rings[1].drift = 30; when.rings[1].way = 1;
  const early = run(when, 0.9), late = run(when, 0.2);
  check(!drifts(early).length && drifts(late).length === 1 && when.rings[1].tip === B + 1, "a hoop whose drift falls between two beats waits for the next: nothing drifts between beats");
  const order = sky([B, B, B, 0]);
  order.rings.forEach(r => { r.set = 1; });
  order.rings[0].driftAt = 0.5; order.rings[0].drift = 30; order.rings[0].way = 1;
  const seq = run(order, 1.05).map(e => e.type);
  check(seq.join() === "beat,drift" && near(order.rings[0].tipAt, 1 + TICK), "in the beat the hoops step first and then the tilt: the event comes after the step's, and the tilt is drawn a tick later, once the step has");
  check(near(tiltOf(order.rings[0], 1), B * TIP) && near(tiltOf(order.rings[0], 1 + TICK + TIP_TIME), (B + 1) * TIP), "the tilt is drawn standing at the old tip while the hoops step, and turning after");
  check(near(driftTime(order, 1), order.beatAt + Math.max(0, Math.ceil((order.rings[1].driftAt - order.beatAt) / period(order) - 1e-9)) * period(order)) && driftTime(when, 1) >= when.t, "the page is told when a drift will show: the beat it falls on");
  // a line standing is struck by the beat before the hoops step or drift, so a drift due with that beat can't break it
  const br = line(sky([B, B, B, 0]), 2, 4, [0, 2], [1, 5], [2, 9]);
  br.rings[1].driftAt = 0.2; br.rings[1].drift = 30; br.rings[1].way = 1;
  check(br.locks.length === 1, "a line standing in blue's plane …");
  const be = run(br, 1.5);
  check(drifts(be).length === 1 && locks(be).length === 1 && planets(br) === 0, "… is struck by the beat first, and the hoop that was due to drift out of it drifts after: the drift can't save or break a line the beat strikes");
  // a drift is looked at after the steps: one that tips a hoop out of the plane a step has just made a line in breaks it, one into the plane makes it
  const together = (tips, hoop, way) => {
    const g = line(sky(tips), 2, 4, [0, 2], [1, 5], [2, 9]);
    g.rings.forEach(r => { r.set = 1; r.a = mod(r.a - 1); });         // one step brings the three to seat 4 together
    g.locks = [];
    g.rings[hoop].driftAt = 0.2; g.rings[hoop].drift = 30; g.rings[hoop].way = way;
    return g;
  };
  const mid = together([B, B, B, 0], 1, 1), midEv = run(mid, 1.5);
  check(drifts(midEv).length === 1 && !mid.locks.length && !locks(midEv).length && planets(mid) === 3 && mid.rings[1].tip === B + 1, "a line the beat's steps make is broken by a hoop of it drifting out in the same beat: not struck, as if tipped by hand");
  const mk = together([B, B, B + 1, 0], 2, -1), mkEv = run(mk, 1.5);
  check(drifts(mkEv).length === 1 && mk.locks.length === 1 && planets(mk) === 3, "and a drift into the colour's plane makes one in that beat, standing …");
  check(locks(run(mk, 1)).length === 1 && planets(mk) === 0, "… and struck on the next beat");
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
  check(st.rings.map(r => `${r.tip}@${r.driftAt}`).join() === before && ov.over && !drifts(run(ov, 100)).length && ov.rings.map(r => r.tip).join() === tipsOver && !setPlane(ov, 1) && !setPlane(ov, 1, 0), "the drift stands still with the game (the menu open, the tab hidden) and stops with the end");
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
  check(s.next.due > due && near(s.next.due - due, gap(s.beat) * period(s)) && s.rings[s.next.ring].places[s.next.place] === -1 && FORETELL > 0 && FORETELL < gap(0) * REFERENCE, "and the next is foretold, for an empty place, shown a moment ahead");
  // in beats: the same landings at every tempo, a quicker tempo bringing them quicker
  const at = tempo => { const g = newGame(13, tempo), P = period(g); return run(g, 120 * P, P / 10).filter(e => e.type === "land").map(e => `${e.ring}.${e.place}`).join(); };
  check(TEMPOS.every((_, k) => at(k) === at(0)) && at(0).split(",").length >= 18, "landings are counted in beats: the same at every tempo, so the quicker it goes the quicker the planets come");
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
  check(step(full, 1).length === 0 && full.t === t0 && !setRing(full, 0, 3) && !setPlane(full, 0) && !setTempo(full, 0), "and nothing goes on after");
  // a full orrery with an alignment showing: it clears first, and the planet lands in the room it leaves
  const last = sky(MIXED);
  last.rings.forEach((r, k) => r.places.forEach((_, p) => { r.places[p] = (k + p) % 2 ? 1 : 3; }));
  line(last, 2, 0, [0, 0], [1, 0], [2, 0]);
  last.next = { due: 0.05, ring: 3, place: 5, colour: 0 };
  const e5 = run(last, 1.1, 0.01);
  check(!last.over && locks(e5).length >= 1 && e5.findIndex(e => e.type === "lock") < e5.findIndex(e => e.type === "land"), "a full orrery with a line standing: the beat strikes it first, and the planet lands in its room");
}

// ---------- a colour's share of a hoop (Korbi, 27 October 2026) ----------
{
  // a hoop crowded with one colour can only be worn down a planet a line, so no landing takes a hoop past CAP of a
  // colour: played with no hand to a full orrery, every hoop then holds exactly CAP of each
  let past = 0, games = 0, even = 0, lands = 0, already = 0, twice = 0;
  for (let k = 1; k <= 120; k++) {
    const g = newGame(k, 5);
    for (let t = 0; t < 4000 && !g.over; t++) {
      const before = g.rings.map(r => [...r.places]);
      for (const e of step(g, 1)) {
        if (e.type !== "land" || planets(g) > 30) continue;           // how a colour lands, before the orrery crowds
        const h = before[e.ring].filter(c => c === e.colour).length;
        lands++; already += h; if (h >= 2) twice++;
      }
      if (g.rings.some(r => [0, 1, 2, 3].some(c => holds(r, c) > CAP))) past++;
    }
    games++;
    if (g.over && g.rings.every(r => [0, 1, 2, 3].every(c => holds(r, c) === CAP))) even++;
  }
  check(!past && even === games && CAP === PLACES / COLOURS, `no landing takes a hoop past ${CAP} of a colour: ${games} games played with no hand to a full orrery, every hoop then ${CAP} of each`);
  // and a colour lands on a hoop holding it already less often (with no weighting, 1.25 of it there on average and two or more 35% of the time)
  check(ALIKE === 0.5 && already / lands < 1.05 && twice / lands < 0.27, `a colour lands where it is already half as often for each one there: ${(already / lands).toFixed(2)} of it on the hoop on average, two or more ${Math.round((100 * twice) / lands)}% of the time, over the first thirty planets of ${games} games`);
  // a planet foretold onto a full orrery, where the room a line made is only on a hoop holding CAP of its colour: it comes as one that hoop can take
  const f = sky();
  f.rings[0].places = [2, 2, 2, 0, 0, 0, 1, 1, 1, 3, 3, -1];
  for (let k = 1; k < RINGS; k++) f.rings[k].places = f.rings[k].places.map((_, p) => (p + k) % COLOURS);
  f.next = { due: 0.1, ring: -1, place: -1, colour: 2 };
  const l = run(f, 0.2).find(e => e.type === "land");
  check(l && l.ring === 0 && l.place === 11 && l.colour === 3 && [0, 1, 2, 3].every(c => holds(f.rings[0], c) <= CAP), "a planet with nowhere its colour may land comes as a colour the hoop with room can take");
}

// ---------- saved and opened again ----------
{
  const s = newGame(21, 4);
  run(s, 3.3, 1 / 60);
  setRing(s, 1, 2); setRing(s, 3, -2); setPlane(s, 2); setPlane(s, 0, 1); setTempo(s, 5);
  run(s, 4.1, 1 / 60);
  const saved = JSON.parse(JSON.stringify(s)), a = copy(s), b = JSON.parse(JSON.stringify(saved));
  const da = drifts(run(a, 60, 1 / 60)).map(e => `${e.ring}${e.tip}`).join(), db = drifts(run(b, 60, 0.5)).map(e => `${e.ring}${e.tip}`).join();
  const same = (x, y) => JSON.stringify({ ...x, t: x.t.toFixed(6) }) === JSON.stringify({ ...y, t: y.t.toFixed(6) });
  check(valid(saved) && same(a, b) && da === db && da.split(",").length >= 2, "a game saved and opened again goes on as it would have, drifts and all, frame by frame or half a second at a time");
  const keep = JSON.stringify(s);
  run(copy(s), 5);
  check(JSON.stringify(s) === keep, "a copy to try things on leaves the game as it was");
  const ringsWith = f => ({ ...saved, rings: saved.rings.map(r => ({ ...r, ...f })) });
  check(!valid({ ...saved, v: 5 }) && !valid(null) && !valid({ ...saved, rings: saved.rings.slice(1) }) && !valid(ringsWith({ a: 1.5 })) && !valid(ringsWith({ set: 0 })) && !valid(ringsWith({ set: 4 }))
    && !valid(ringsWith({ way: 0 })) && !valid({ ...saved, next: null }) && !valid({ ...saved, tempo: 9 }),
    "a game saved by an earlier orrery (another version), or a broken one (a hoop set still, or past fast), isn't taken: it's replaced by a new game");
}

// ---------- whole games ----------
// Players with a person's hands (the harness): how long each one takes to look and decide what to line up, to tap a hoop
// (or the sky, to let the hoop chosen go), to press a button, and to see a hoop drift out of a line it's making and
// answer it; each varies as a person's would (a spread of about `jitter` of itself, now and then much slower), game by
// game the same from the seed. A press of a colour does what the page's does: it tips the hoop chosen, or every hoop when
// none is.
const HANDS = {
  careful: { think: 2.5, tap: 0.8, press: 0.6, react: 0.4, jitter: 0.25 },
  quick: { think: 1.2, tap: 0.55, press: 0.45, react: 0.3, jitter: 0.2 },
};
const LEVELS = SETTINGS;
const LIMIT = Number(ARG("limit") || 3000);                     // seconds a game is played to at most
const TRACE = MEASURE && ARG("trace") != null;                 // one game's plans, printed as they're made
const AHEAD = 12;                                              // beats ahead a plan looks for its line (the slow hoop turns round in 12): a long wait is worth less than looking again
const MARGIN = 0.3;                                            // seconds before a beat that a setting must be pressed, to count on its steps
// What a press of a colour does to the drift's clocks: the engine's rule, none wound ("none"); to measure the others,
// `wind=all` (a press winds the clocks of the hoops it's for) or `wind=moved` (of the hoops it tips).
const WIND = (MEASURE && ARG("wind")) || "none";
if (MEASURE && ARG("pace")) { const [first, least, half] = ARG("pace").split(",").map(Number); Object.assign(PACE, { first, least, half }); }
if (MEASURE && ARG("drift")) DRIFT.splice(0, RINGS, ...(ARG("drift") === "off" ? [1e7, 1e7 + 1, 1e7 + 2, 1e7 + 3] : ARG("drift").split(",").map(Number)));
const perms = a => (a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p])));
const subsets = (a, k) => (k === 0 ? [[]] : a.length < k ? [] : [...subsets(a.slice(1), k - 1).map(p => [a[0], ...p]), ...subsets(a.slice(1), k)]);
const beatTime = (s, b) => (b <= s.beat ? s.lastBeat : s.beatAt + (b - s.beat - 1) * period(s));
const atGate = seat => seat === 0 || seat === PLACES / 2;
/** A hoop's planets of one colour as twelve bits, by place on the hoop, turned to the bits of the places round the sun they're at. */
const turned = (bits, a) => ((bits << a) | (bits >>> (PLACES - a))) & 0xfff;
/** A press of a colour's button, for one hoop or (ring -1) every hoop, the drift's clocks wound as WIND says (the engine winds none). */
function pressColour(s, colour, ring = -1) {
  const tipped = s.rings.map((r, k) => (ring < 0 || k === ring) && r.tip !== PLANE[colour]), moved = setPlane(s, colour, ring);
  if (WIND !== "none") s.rings.forEach((r, k) => { if ((WIND === "all" && (ring < 0 || k === ring)) || tipped[k]) r.driftAt = s.t + r.drift * period(s); });
  return moved;
}

/**
 * Each hoop's turn after each of the next AHEAD beats' steps: going as it is (`going`, from now), and set anew to each
 * other setting in time for its first step on each of those beats (`anew`: { k, from, at }, at -1 before it's set).
 */
function turns(s) {
  return s.rings.map(r => {
    const going = [r.a];
    for (let h = 1; h <= AHEAD; h++) going.push(mod(going[h - 1] + r.set));
    const anew = [];
    for (const k of LEVELS) if (k !== r.set) for (let f = 1; f <= AHEAD; f++) {
      const at = new Array(AHEAD + 1).fill(-1);
      let a = going[f - 1];
      for (let h = f; h <= AHEAD; h++) { a += k; at[h] = mod(a); }
      anew.push({ k, from: s.beat + f, at });
    }
    return { going, anew };
  });
}
/**
 * The plan for the line worth most for its time: for each colour, each of the next AHEAD beats and each place round,
 * three or four hoops that can each bring a planet of the colour there with that beat's steps, going as they are or set
 * anew once, at a gate for any tips or elsewhere in the colour's plane (pressed into it, if `presses`; if not, only hoops
 * in it already). The quickest and best are rehearsed first, and the first the hand can do in time is taken.
 */
function plan(s, me, hands, presses) {
  const worth = n => n + AWARD[n] / 100, at = turns(s), plans = [];
  for (let c = 0; c < COLOURS; c++) {
    const bits = s.rings.map(r => r.places.reduce((m, col, p) => (col === c ? m | (1 << p) : m), 0));
    if (bits.filter(Boolean).length < 3) continue;
    for (let h = 1; h <= AHEAD; h++) for (let q = 0; q < PLACES; q++) {
      const bit = 1 << q, gate = atGate(q);
      const can = s.rings.map((r, i) => {
        if (!bits[i] || (!gate && !presses && r.tip !== PLANE[c])) return null;
        if (turned(bits[i], at[i].going[h]) & bit) return { a: at[i].going[h] };
        const ways = at[i].anew.filter(w => w.at[h] >= 0 && turned(bits[i], w.at[h]) & bit).map(w => ({ k: w.k, from: w.from, a: w.at[h] }));
        return ways.length ? { ways } : null;
      });
      const able = can.flatMap((x, i) => (x ? [i] : []));
      for (const n of [4, 3]) for (const members of subsets(able, n)) plans.push({ colour: c, seat: q, beat: s.beat + h, n, members, can, rate: worth(n) / (beatTime(s, s.beat + h + 1) - s.t + hands.think) });
    }
  }
  plans.sort((x, y) => y.rate - x.rate);
  for (const p of plans) { const r = rehearse(s, me, hands, p, presses); if (r) return { ...p, ...r }; }
  return null;
}
/**
 * How a plan would go, played with a person's usual delays: the colour pressed first if the line is off the axle and a
 * hoop of it isn't in the colour's plane (every hoop at once, the sky tapped first to let the hoop chosen go; or each such
 * hoop chosen and pressed for alone: whichever the hand is done with sooner), then the hoops that need it set anew, one
 * after another, each pressed once the beat before its first step has gone and in time for that step. A hoop of a line in
 * a plane that drifts out before the strike breaks it, and is pressed back as soon as the hand sees it and is free (by a
 * player who presses at all). The hand's jobs and the planets of the line, or null if it can't be done in time.
 */
function rehearse(s, me, hands, { colour, seat, beat, members, can }, presses) {
  const T = b => beatTime(s, b), plane = PLANE[colour], gate = atGate(seat), strike = T(beat + 1);
  const anew = members.filter(i => can[i].ways), out = gate ? [] : members.filter(i => s.rings[i].tip !== plane);
  let best = null;
  for (const all of out.length > 1 ? [true, false] : [false]) for (const order of perms(anew)) {
    let t = s.t, chosen = me.chosen, first = s.beat + 1, ok = true;
    const jobs = [], pressed = new Map(), how = new Map();
    const to = ring => { if (chosen !== ring) { t += hands.tap; chosen = ring; jobs.push({ kind: "pick", ring }); } };
    const press = ring => { t += hands.press; jobs.push({ kind: "press", colour }); for (const i of ring < 0 ? members : [ring]) pressed.set(i, t); };
    if (all) { if (chosen >= 0) { t += hands.tap; chosen = -1; jobs.push({ kind: "away" }); } press(-1); }
    else for (const i of out) if (!anew.includes(i)) { to(i); press(i); }
    for (const i of order) {
      to(i);
      if (!all && out.includes(i)) press(i);
      const way = can[i].ways.filter(w => w.from >= first).sort((x, y) => x.from - y.from).find(w => Math.max(t, T(w.from - 1)) + hands.press <= T(w.from) - MARGIN);
      if (!way) { ok = false; break; }
      t = Math.max(t, T(way.from - 1)) + hands.press;
      jobs.push({ kind: "set", ring: i, k: way.k, after: way.from - 1 });
      how.set(i, way);
      first = way.from;
    }
    if (!ok) continue;
    // it stands from its beat, or from the last press if that's later
    let from = Math.max(T(beat), ...pressed.values());
    if (!gate) for (const i of members) {
      const r = s.rings[i], since = pressed.get(i) ?? s.t, wound = pressed.has(i) && (WIND === "all" || (WIND === "moved" && r.tip !== plane)), drifts = wound ? since + r.drift * period(s) : r.driftAt;
      if (drifts <= since || drifts >= strike) continue;
      if (!presses) { ok = false; break; }
      from = Math.max(from, Math.max(drifts + hands.react, t) + hands.tap + hands.press);
    }
    if (!ok || from > strike - DWELL) continue;
    if (!best || t < best.t) best = { t, jobs, how };
  }
  if (!best) return null;
  const ids = members.map(i => id(i, mod(seat - (best.how.get(i)?.a ?? can[i].a))));
  return { jobs: best.jobs, ids, done: strike };
}

/**
 * A person playing: looks (thinks), plans the line worth most for its time, does it with the hands it has (a colour
 * pressed if the plan is in a plane its hoops aren't all in; a tap to choose a hoop and a press to set it anew, once the
 * beat before its first step has gone), watches for the line to be struck, and looks again. A setting pressed a beat late
 * (or early) spoils the plan, and it looks again; a hoop of the plan drifting out of its plane is pressed back.
 * `presses: false` never presses a colour; `once` presses the first hoop's colour at the start, for every hoop, and
 * never again.
 */
function careful(hands, seed, { presses = true, once = false } = {}) {
  let x = (seed * 2654435761 + 977) >>> 0;
  const rnd = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
  const vary = v => v * Math.exp(hands.jitter * Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(TAU * rnd()));
  const me = { chosen: -1 }, stats = { plans: 0, presses: 0, represses: 0, misses: 0, fast: 0, pressAt: [] };
  let todo = [{ kind: "think" }], busy = null, waiting = null, goal = null, drifted = -1;
  if (once) todo = [{ kind: "first" }, { kind: "think" }];
  /** A colour pressed as the page takes it: for the hoop chosen, or for every hoop with none. */
  const tap = (s, colour, again = false) => { if (pressColour(s, colour, me.chosen)) { stats.presses++; stats.pressAt.push(s.t); if (again) stats.represses++; } };
  function start(s, job) {
    const t = s.t;
    if (job.kind === "think") return { at: t + vary(hands.think), then: () => {
      const p = plan(s, me, hands, presses && !once);
      stats.plans++;
      if (TRACE) console.log(`${s.t.toFixed(1)} s, ${planets(s)} planets, tips ${s.rings.map(r => r.tip).join(" ")}, set ${s.rings.map(r => r.set).join(" ")}: ${p ? `${"YGBR"[p.colour]} at ${p.seat} after beat ${p.beat} ×${p.n}, ${p.members.map(i => `${i + 1}${p.can[i].ways ? "*" : ""}`).join(" ")}, struck at ${p.done.toFixed(1)}` : "nothing"}`);
      if (!p) { todo.push({ kind: "think" }); return; }
      goal = { ids: p.ids, rings: new Set(p.members), plane: !atGate(p.seat), colour: p.colour, until: p.done + 1.5 };
      todo.push(...p.jobs, { kind: "watch" });
    } };
    if (job.kind === "first") return { at: t + vary(hands.press), then: () => tap(s, planeOf(s.rings[0].tip)) };
    if (job.kind === "away") return { at: t + vary(hands.tap), then: () => { me.chosen = -1; } };
    if (job.kind === "pick") return { at: t + (me.chosen === job.ring ? 0 : vary(hands.tap)), then: () => { me.chosen = job.ring; } };
    if (job.kind === "press") return { at: t + vary(job.again ? hands.react + hands.press : hands.press), then: () => tap(s, job.colour, job.again) };
    if (job.kind === "set") {
      if (s.beat < job.after) return null;                       // the beat before its first step still to come
      return { at: t + (me.chosen === job.ring ? 0 : vary(hands.tap)) + vary(hands.press), then: () => { me.chosen = job.ring; if (setRing(s, job.ring, job.k) && Math.abs(job.k) === SPIN) stats.fast++; } };
    }
    if (job.kind === "watch") {
      const gone = goal.ids.every(i => s.rings[Math.floor(i / PLACES)].places[i % PLACES] < 0);
      if (!gone && s.t < goal.until) return null;
      return { at: t, then: () => { if (!gone) stats.misses++; todo.push({ kind: "think" }); } };
    }
    throw new Error(job.kind);
  }
  return {
    stats,
    /** When it next does something: its hand free again, or the next beat or landing if it's waiting to see what they do. */
    wake: s => {
      if (drifted >= 0) return s.t;
      if (busy) return busy.at;
      if (!waiting) return s.t;
      if (waiting.kind === "set") return s.beatAt;
      return Math.max(s.t + 1e-6, Math.min(s.beatAt, s.next.due, goal.until));
    },
    saw(e, s) {
      // a hoop of the plan drifted out of its plane: its colour pressed for it again (no colour pressed in a plan of `once`'s)
      if (e.type === "drift" && goal?.plane && goal.rings.has(e.ring) && todo.length && presses && !once && s.rings[e.ring].tip !== PLANE[goal.colour]) drifted = e.ring;
    },
    act(s) {
      if (drifted >= 0) { const ring = drifted; drifted = -1; if (!todo.some(j => j.again)) todo.unshift({ kind: "pick", ring }, { kind: "press", colour: goal.colour, again: true }); }
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
/** A person pressing at random, as fast as a careful hand goes: a hoop chosen and one of the six speeds, or a colour (for the hoop chosen), again and again. */
function masher(hands, seed) {
  let x = (seed * 2246822519 + 3) >>> 0, at = 0, chosen = -1;
  const rnd = () => ((x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296);
  return {
    stats: {},
    wake: () => at,
    saw() {},
    act(s) {
      const ring = Math.floor(rnd() * RINGS), k = Math.floor(rnd() * (LEVELS.length + COLOURS));
      if (k < LEVELS.length) { setRing(s, ring, LEVELS[k]); chosen = ring; } else pressColour(s, k - LEVELS.length, chosen);
      at = s.t + hands.tap + hands.press;
    },
  };
}
/** Setting every hoop going at a speed of its own, then pressing red for every hoop every ten seconds: as much as chance gives. */
function spinner() {
  let next = 0;
  return {
    stats: {},
    wake: () => next,
    saw() {},
    act(s) {
      if (!next) [2, -1, 1, -2].forEach((k, ring) => setRing(s, ring, k));
      pressColour(s, 3);
      next = s.t + 10;
    },
  };
}
const PLAYERS = {
  idle: { name: "touching nothing", make: () => ({ stats: {}, wake: () => Infinity, saw() {}, act() {} }) },
  spinner: { name: "setting every hoop going at a speed of its own and pressing red every ten seconds", make: () => spinner() },
  masher: { name: "pressing buttons at random", make: seed => masher(HANDS.careful, seed) },
  careful: { name: "a careful player", make: seed => careful(HANDS.careful, seed) },
  gates: { name: "a careful player who never presses a colour", make: seed => careful(HANDS.careful, seed, { presses: false }) },
  once: { name: "a careful player who presses a colour once, at the start", make: seed => careful(HANDS.careful, seed, { once: true }) },
  quick: { name: "a quick player", make: seed => careful(HANDS.quick, seed) },
  quickgates: { name: "a quick player who never presses a colour", make: seed => careful(HANDS.quick, seed, { presses: false }) },
};
/** A game played out to its end (or LIMIT seconds) by a player at a tempo: what it came to. */
function play(seed, tempo, who) {
  const s = newGame(seed, tempo), p = PLAYERS[who].make(seed);
  let guard = 0, sane = true, gates = 0, spokes = 0, drifted = 0;
  while (!s.over && s.t < LIMIT && guard++ < 1e6) {
    const at = Math.min(LIMIT, Math.max(s.t, p.wake(s)));
    if (at > s.t) for (const e of step(s, at - s.t)) { p.saw(e, s); if (e.type === "lock") { if (atGate(e.seat)) gates++; else spokes++; } if (e.type === "drift") drifted++; }
    if (!s.over) p.act(s);
    if (!s.rings.every(r => Number.isInteger(r.a) && r.a >= 0 && r.a < PLACES && Math.abs(r.tip) <= TIP_MAX && r.set !== 0 && Math.abs(r.set) <= SPIN)) sane = false;
  }
  const st = p.stats, late = (st.pressAt || []).filter(t => t > s.t / 2).length;
  return { t: s.t, score: s.score, aligned: s.aligned, fours: s.fours, over: s.over, sane, gates, spokes, drifted, late, ...st };
}
{
  const median = a => [...a].sort((x, y) => x - y)[a.length >> 1];
  const games = MEASURE ? Number(ARG("games") || 30) : 6;
  if (TRACE) {
    const who = process.argv.find(x => PLAYERS[x]) || "careful", r = play(Number(ARG("trace")), ARG("tempo") != null ? Number(ARG("tempo")) : FIRST_TEMPO, who);
    console.log(`${PLAYERS[who].name}: ${r.t.toFixed(0)} s, ${r.score} points, ${r.aligned} lines (${r.gates} at the gates, ${r.spokes} in planes), ${r.presses} presses (${r.represses} putting a drifted hoop back), ${r.misses} plans missed, ${r.drifted} drifts`);
    process.exit(0);
  }
  if (MEASURE) {
    const named = process.argv.find(x => x.split(",").every(k => PLAYERS[k])), who = named ? named.split(",") : Object.keys(PLAYERS);
    const tempos = ARG("tempo") != null ? ARG("tempo").split(",").map(Number) : GAME_TEMPOS.map((_, k) => k);
    const t0 = Date.now();
    for (const w of who) for (const k of tempos) {
      const list = Array.from({ length: games }, (_, g) => play(100 + g, k, w));
      const ts = list.map(r => r.t), sc = list.map(r => r.score), sum = f => list.reduce((a, r) => a + (r[f] || 0), 0), per = f => (sum(f) / games).toFixed(1);
      const perMin = (sum("presses") / (ts.reduce((a, b) => a + b, 0) / 60)).toFixed(2);
      console.log(`${PLAYERS[w].name} at ${TEMPOS[k]}: ${median(ts).toFixed(0)} s (${Math.min(...ts).toFixed(0)} to ${Math.max(...ts).toFixed(0)}), scoring ${median(sc)}, ${per("aligned")} lines (${per("fours")} fours; ${per("gates")} at the gates, ${per("spokes")} in planes), `
        + `${per("plans")} plans (${per("misses")} missed), ${per("presses")} presses (${perMin} a minute, ${per("late")} in the game's second half, ${per("represses")} putting a drifted hoop back), ${per("drifted")} drifts, ${per("fast")} hoops set fast; ${list.filter(r => !r.over).length} not over`);
    }
    console.log(`(pace ${PACE.first}, ${PACE.least}, ${PACE.half}; drift ${DRIFT.join(", ")}; a press winds ${WIND}; ${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    process.exit(0);
  }
  const at = FIRST_TEMPO, games6 = who => Array.from({ length: games }, (_, g) => play(100 + g, at, who));
  const idle = games6("idle"), spin = games6("spinner"), done = games6("careful"), gates = games6("gates"), quick = games6("quick"), quickGates = games6("quickgates");
  const med = (list, k) => median(list.map(r => r[k]));
  check(idle.every(r => r.over) && med(idle, "aligned") <= 4, `touching nothing, the orrery turns together and no step brings a line: full after about ${med(idle, "t").toFixed(0)} seconds, with ${med(idle, "aligned")} lines (planets landing by two of their colour)`);
  check(spin.every(r => r.over) && med(spin, "aligned") < med(done, "aligned") / 3, `setting every hoop going at a speed of its own and pressing a colour now and then: what chance brings, about ${med(spin, "aligned")} lines and ${med(spin, "t").toFixed(0)} seconds`);
  check(med(done, "t") > 1.6 * med(spin, "t") && med(done, "score") > 4 * med(spin, "score"),
    `a careful player lasts far longer (about ${med(done, "t").toFixed(0)} seconds at ${TEMPOS[at]} a minute, ${med(done, "score").toLocaleString("en-GB")} points, to chance's ${med(spin, "score").toLocaleString("en-GB")})`);
  check(done.every(r => r.presses >= 10 && r.late >= 4),
    `pressing the colours all game long: about ${med(done, "presses")} presses a game, ${med(done, "late")} in its second half, and ${med(done, "spokes")} lines in planes to ${med(done, "gates")} at the gates`);
  // every hoop is always going and steps on every beat, so three planets of a colour can be brought to a gate together on
  // most beats, and the planes add little (README, 23 October 2026): a quick hand gains by them, a careful one about breaks even
  check(med(quick, "score") > med(quickGates, "score") && med(done, "score") > 0.6 * med(gates, "score"),
    `worth a quick hand something, a careful one about what the time costs (${med(done, "score").toLocaleString("en-GB")} points to ${med(gates, "score").toLocaleString("en-GB")} never pressing; quick, ${med(quick, "score").toLocaleString("en-GB")} to ${med(quickGates, "score").toLocaleString("en-GB")})`);
  check(done.every(r => r.drifted >= 5 && r.fast > 0) && done.some(r => r.represses > 0), "the hoops drift under it all game, now and then out of a line it's making (pressed back), and it sets hoops fast");
  check(med(quick, "t") > med(done, "t") && med(quick, "score") > med(done, "score"), `a quicker one longer still (about ${med(quick, "t").toFixed(0)} seconds, ${med(quick, "score").toLocaleString("en-GB")} points)`);
  check([...idle, ...spin, ...done, ...gates, ...quick, ...quickGates].every(r => r.over && r.sane), "and every game ends, the hoops on whole places, never set still, tips and settings throughout");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("orrery: the deal, the beat, stepping (a slot or two a beat, none still), a press of a colour for every hoop or one, alignments at the gates and in the colours' planes, lines on the beat however the hoops are going, the drift, clearing, the combo, planets landing on the clock, the end, saving, the old version replaced, whole games");
