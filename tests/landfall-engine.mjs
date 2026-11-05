// Landfall's voyage engine (landfall-engine.js, landfall-levels.js): the bells, the twilights every level plays in, the sextant's
// reduction (a perfect sight gives the latitude back), the plot's gate and fog, the compass check, the legs and their endings,
// the clouds, the helps and the saved voyage.
import {
  newVoyage, apply, moves, validate, save, restore, nextCrossing, bellsAt, bellsBetween, shipClock, conditions, look, sextantTruth, swellAt,
  sightNoise, filterSigma, reduce, forecast, levelOf, truePlace, estPlace, sceneJd, hintFor, routeOf, masteryAfter, regionWords, cloudsNow, sunStage, expectedCatchJd, reckonedNoonJd,
  POLARIS, POLARIS_HR, BY_HR, DUSK_ALT, DAWN_ALT, MAX_WAIT, EYE, chooseTargets, reduceLop,
} from "../landfall-engine.js";
import { LEVELS, SECTIONS } from "../landfall-levels.js";
import { sunAltAz, julianDate, calendar } from "../landfall-sky.js";
import { dist, bearing } from "../landfall-model.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const KOCHAB = 5563;                                       // β UMi, four degrees from Polaris

// ---------- the ship's bell ----------
{
  const row = ms => ms.map(m => bellsAt(m)).join(" ");
  check(row([0, 30, 60, 90, 120, 150, 180, 210, 240]) === "8 1 2 3 4 5 6 7 8", "the middle watch strikes 8 1 2 3 4 5 6 7 8 from midnight to four");
  check(row([960, 990, 1020, 1050, 1080, 1110, 1140, 1170, 1200]) === "8 1 2 3 4 1 2 3 8", "the dog watches strike 8 1 2 3 4 1 2 3 8 from four to eight in the evening");
  check(row([720, 750, 780]) === "8 1 2" && bellsAt(1440) === 8 && bellsAt(-30) === 7, "noon is eight bells, and the day wraps");
  const jd = julianDate(1856, 4, 20, 0), bells = bellsBetween(jd, jd + 1, 0);
  // five full watches of 8+1+..+7 = 36 strokes, and the two dog watches together 8+1+2+3+4+1+2+3 = 24
  check(bells.length === 48 && bells.reduce((t, b) => t + b.bells, 0) === 5 * 36 + 24, `a day holds ${bells.length} half-hours and ${bells.reduce((t, b) => t + b.bells, 0)} strokes (204 by the watch system)`);
  check(bellsBetween(jd + 0.0001, jd + 0.0001, 0).length === 0 && bellsBetween(jd, jd + 1 / 48 + 1e-9, 0).length === 1, "none between a moment and itself, one across a half-hour mark");
  check(bellsBetween(jd, jd + 1 / 48 + 1e-9, 15).length === 1 && shipClock(jd, 15) === "01:00", "the ship keeps the time of its meridian: 15° east is an hour ahead of Greenwich");
}

// ---------- every level plays in a real twilight ----------
for (const L of LEVELS) {
  let worst = { dusk: 99, dawn: 99 }, firstSeen = 0, n = 0, never = 0;
  const [[m0, d0], [m1, d1]] = L.window, a = Date.UTC(L.year, m0 - 1, d0), b = Date.UTC(L.year, m1 - 1, d1);
  for (let t = a; t <= b; t += 3 * 86400000) {
    const d = new Date(t), noon = julianDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), 12) - L.origin.lon / 360;
    for (const kind of ["dusk", "dawn"]) {
      const c = nextCrossing(noon, kind, L.origin.lat, L.origin.lon);
      if (c === null) { never++; continue; }
      const alt = sunAltAz(c, L.origin.lat, L.origin.lon).alt;
      if (Math.abs(alt - (kind === "dusk" ? DUSK_ALT : DAWN_ALT)) > 0.02) worst[kind] = 0;
      // a half hour later (6 game minutes at the clock's speed... 36 at 12x of three minutes) the dusk sky must have reached the star's twilight
      if (kind === "dusk") { const later = sunAltAz(c + 40 / 1440, L.origin.lat, L.origin.lon).alt; if (later > -5.6) firstSeen++; }
      n++;
    }
  }
  check(never === 0 && worst.dusk !== 0 && worst.dawn !== 0, `${L.name}: the sun crosses both watch altitudes on every day of its window (${n} checked)`);
  check(firstSeen === 0, `${L.name}: by 40 minutes into a dusk watch the sky is dark enough for the pole star`);
}

// ---------- a voyage is its seed ----------
{
  const A = newVoyage("first-watch", 11), B = newVoyage("first-watch", 11), C = newVoyage("first-watch", 12);
  check(save(A) === save(B) && save(A) !== save(C), "the same seed is the same voyage, another seed another date, set and compass");
  const dates = new Set(Array.from({ length: 40 }, (_, i) => newVoyage("first-watch", i).date.join("-")));
  check(dates.size > 15, `a replay reseeds the date: ${dates.size} different days in 40 voyages`);
  const L = levelOf(A), [[m0, d0], [m1, d1]] = L.window;
  check([...dates].every(s => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d) >= Date.UTC(1856, m0 - 1, d0) && Date.UTC(y, m - 1, d) <= Date.UTC(1856, m1 - 1, d1); }), "...and keeps to the level's season");
  check(new Set(Array.from({ length: 60 }, (_, i) => newVoyage("haze-on-the-banks", i).watch.weather)).size >= 2, "...and the weather");
  check(validate(A).length === 0 && A.phase === "ritual" && A.w === 1, "a new voyage stands at its first watch's chart work");
}

// ---------- the latitude reveal is right ----------
const waitFor = (S, ok) => { for (let i = 0; i < 60 && !ok(S); i++) apply(S, { t: "wait", min: 2 }); return ok(S); };
const toSky = (S, hr = POLARIS_HR) => { apply(S, { t: "skip" }); apply(S, { t: "pick", hr }); return waitFor(S, s => look(s, BY_HR.get(hr)).visible && conditions(s).sun < -6); };
{
  let worst = 0, worstNoisy = 0, n = 0;
  for (const L of LEVELS.filter(l => !l.lop)) for (let seed = 1; seed <= 6; seed++) {
    const S = newVoyage(L.id, seed);
    if (!toSky(S)) continue;
    apply(S, { t: "raise" });
    S.watch.hUnit = 0;                                                        // no horizon error: the instrument's exact reading
    S.E[0] = S.T[0];                                                          // and the almanac entered at the right longitude
    const marks = [sextantTruth(S)];
    apply(S, { t: "read", marks });
    const lat = S.watch.book.lat, truth = truePlace(S).lat;
    worst = Math.max(worst, Math.abs(lat - truth) * 60);
    n++;
  }
  check(n >= 30 && worst < 0.15, `a perfect sight of Polaris gives the true latitude to ${worst.toFixed(2)}′ over ${n} sights`);
  for (const L of LEVELS.filter(l => !l.lop)) for (let seed = 1; seed <= 6; seed++) {
    const S = newVoyage(L.id, seed);
    if (!toSky(S)) continue;
    apply(S, { t: "raise" });
    apply(S, { t: "read", marks: [sextantTruth(S)] });
    worstNoisy = Math.max(worstNoisy, Math.abs(S.watch.book.lat - truePlace(S).lat) * 60 / sightNoise(S).horizon);
  }
  check(worstNoisy < 4.5, `with the horizon's own error the latitude is out by at most ${worstNoisy.toFixed(1)} of its sd`);
}
{
  const S = newVoyage("first-watch", 3);
  toSky(S); apply(S, { t: "raise" }); S.watch.hUnit = 0;
  const truth = sextantTruth(S), book = reduce(S, [truth]);
  check(Math.abs(book.dip - 3.29) < 0.02 && book.refr > 0.5 && book.refr < 1.2 && Math.abs(book.ho - (book.hs - book.dip - book.refr)) < 1e-9, `the book's lines add up: Hs ${book.hs.toFixed(1)}′, dip ${book.dip.toFixed(2)}′, refraction ${book.refr.toFixed(2)}′, Ho ${book.ho.toFixed(1)}′`);
  check(Math.abs(book.corr) < 140 && Math.abs(book.pd - 1.4) < 0.1, `the almanac's Polaris correction is ${book.corr.toFixed(1)}′ for a polar distance of ${book.pd.toFixed(2)}° (1856)`);
  const a = swellAt(S, 0), amp = sightNoise(S).swell;
  check(Array.from({ length: 200 }, (_, i) => Math.abs(swellAt(S, i * 0.37))).every(x => x <= amp + 1e-9) && Math.max(...Array.from({ length: 200 }, (_, i) => Math.abs(swellAt(S, i * 0.37)))) > 0.6 * amp, `the swell moves the star by up to ${amp.toFixed(2)}′ and never more`);
  check(Number.isFinite(a), "the swell is a plain function of the second");
}

// ---------- the plot, the gate and the fog ----------
{
  const S = newVoyage("down-the-latitude", 4);
  toSky(S); apply(S, { t: "raise" });
  const before = { P: JSON.parse(JSON.stringify(S.P)), E: [...S.E] };
  apply(S, { t: "read", marks: [sextantTruth(S), sextantTruth(S) + 0.3, sextantTruth(S) - 0.3] });
  const r = apply(S, { t: "plot" });
  check(r.ok && r.accepted && S.phase === "steer", "a good sight is plotted and the watch goes on to steering");
  check(S.P[1][1] < 0.2 * before.P[1][1] && S.P[0][0] > 0.5 * before.P[0][0], `the fog collapses north-south only: sd ${Math.sqrt(before.P[1][1]).toFixed(1)} nm to ${Math.sqrt(S.P[1][1]).toFixed(2)} nm, east-west ${Math.sqrt(before.P[0][0]).toFixed(1)} to ${Math.sqrt(S.P[0][0]).toFixed(1)} (only what the course ties to it)`);
  check(Math.abs(S.E[1] - truePlace(S).lat * 0 - S.T[1]) < 3 && Math.abs(S.E[1] - S.T[1]) < Math.abs(before.E[1] - S.T[1]) + 1.5, "the estimate moves toward the true latitude");
  check(S.fixes.length === 1 && S.trail.at(-1).k === "fix" && S.watch.plot.after.P[1][1] === S.P[1][1], "the fix is kept on the track and in the watch's record (before and after, for the reveal)");
}
{
  const S = newVoyage("first-watch", 5);
  toSky(S, KOCHAB);
  apply(S, { t: "raise" });                      // (Kochab swings 4° round the pole: its bearing may pass for Polaris's, or not, by the hour)
  apply(S, { t: "read", marks: [sextantTruth(S)] });
  const r = apply(S, { t: "plot" });
  check(r.ok && r.accepted === false && S.phase === "book" && S.watch.plot.off, `a sight of the wrong star is refused by the plot (it is ${r.z.toFixed(0)} nm off the reckoning)`);
  check(moves(S).includes("retake") && apply(S, { t: "retake" }).ok && S.phase === "find" && S.watch.min > 0, "...and may be retaken, at the cost of a few minutes of twilight");
  apply(S, { t: "pick", hr: POLARIS_HR }); waitFor(S, s => look(s, POLARIS).visible);
  apply(S, { t: "raise" }); apply(S, { t: "read", marks: [sextantTruth(S)] });
  check(apply(S, { t: "plot" }).accepted, "...and the right star then goes in");
}
{
  const S = newVoyage("first-watch", 5);
  apply(S, { t: "skip" });
  waitFor(S, s => conditions(s).sun < -7);
  const far = [...BY_HR.values()].filter(s => s[5] < 1.6 && look(S, s).visible && Math.abs(((look(S, s).az + 180) % 360) - 180) > 45).sort((a, b) => a[5] - b[5])[0];
  apply(S, { t: "pick", hr: far[0] });
  const r = apply(S, { t: "bearing" });
  check(far && r.ok && r.wrong === true && S.compass.known === null, `the compass check does catch a star far from north (${far[1]} bears ${r.observed.toFixed(0)}°, Polaris should be near ${r.expected.toFixed(0)}°) and learns nothing from it`);
}
{
  const S = newVoyage("the-compass-lies", 6);
  toSky(S);
  const r = apply(S, { t: "bearing" });
  check(r.ok && !r.wrong && Math.abs(r.diff - S.compass.err) < 1.5 && S.compass.known !== null, `the bearing check finds the compass error: ${r.diff.toFixed(1)}° against a true ${S.compass.err.toFixed(1)}°`);
  check(!apply(S, { t: "bearing" }).ok, "...once a watch");
  check(S.compass.sd < 0.6, "...and the DR trusts the compass more afterwards");
}
{
  const S = newVoyage("first-watch", 7);
  check(!apply(S, { t: "plot" }).ok && !apply(S, { t: "sail", course: 0 }).ok && apply(S, { t: "step", d: S.leg.run }).ok, "a move out of its phase is refused");
  check(moves(S).join() === "wait,pick,skipsight", "before a star is picked the sky offers waiting, picking and giving up the sight");
}

// ---------- the dividers ----------
{
  const run = (d) => { const S = newVoyage("first-watch", 8); const r = apply(S, d === null ? { t: "skip" } : { t: "step", d: S.leg.run + d }); return { S, r }; };
  const exact = run(0), off = run(3), skip = run(null);
  const sd = x => Math.sqrt(x.S.P[0][0] + x.S.P[1][1]);
  check(exact.S.E.every((v, i) => Math.abs(v - exact.S.pre.E[i]) < 1e-9), "a careful step-off puts the DR where the log says");
  check(off.S.E.some((v, i) => Math.abs(v - off.S.pre.E[i]) > 1) && sd(off) > sd(exact), "a sloppy one puts it out of place and widens the fog");
  check(sd(skip) > sd(exact) && sd(skip) < sd(off), "skipping the ritual takes the default fog, between the two");
}

// ---------- the legs and their endings ----------
{
  // helpers: a perfect navigator who is told the truth, to test the endings
  const sailTo = (S, course) => { apply(S, { t: "skip" }); apply(S, { t: "skipsight" }); return apply(S, { t: "sail", course }); };
  const toward = (S, x, y) => bearing([x - S.T[0], y - S.T[1]]);
  const L = levelOf(newVoyage("first-watch", 1));
  let S = newVoyage("first-watch", 1);
  S.compass.err = 0; S.logErr = 0; S.cur = [0, 0];
  for (let i = 0; i < 4 && S.phase !== "end"; i++) { const c = toward(S, L.harbour.x, L.harbour.y); S.cur = [0, 0]; sailTo(S, c); }
  check(S.end?.kind === "arrived" && S.end.stars === 3 && S.end.miss < 1.5, `sailing true at the harbour arrives with three stars (miss ${S.end?.miss?.toFixed(2)} nm)`);
  S = newVoyage("first-watch", 1); S.compass.err = 0; S.logErr = 0;
  for (let i = 0; i < 4 && S.phase !== "end"; i++) { S.cur = [0, 0]; sailTo(S, toward(S, L.harbour.x, L.harbour.y + 20)); }
  check(S.end?.kind === "grounded" && S.end.why, `aiming twenty miles north of the harbour grounds on ${S.end?.why}`);
  S = newVoyage("first-watch", 1); S.compass.err = 0; S.logErr = 0;
  for (let i = 0; i < 4 && S.phase !== "end"; i++) { S.cur = [0, 0]; sailTo(S, 270); }
  check(S.end?.kind === "missed" && S.end.stars === 0 && S.end.watches === 3, "sailing away from the coast until the watches are spent is a missed landfall");
  S = newVoyage("first-watch", 1); S.compass.err = 0; S.logErr = 0;
  apply(S, { t: "skip" }); apply(S, { t: "skipsight" });
  const T0 = [...S.T], E0 = [...S.E], w0 = S.w;
  apply(S, { t: "heave" });
  check(S.w === w0 + 1 && dist(S.T, T0) < 12 && dist(S.pre.E, E0) < 1e-9, "heaving to costs a watch, the log shows no run, and only the current moves the ship");
  check(S.leg.run === 0, "...the DR does not move");
}

// ---------- the clouds, the helps, the saved voyage ----------
{
  let gaps = 0, closed = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const S = newVoyage("broken-cloud", seed);
    if (S.watch.weather !== "cloud") continue;
    const seen = []; apply(S, { t: "skip" });
    for (let m = 0; m <= MAX_WAIT; m += 1) { S.watch.min = m; seen.push(look(S, POLARIS).cloud); }
    if (seen[0]) closed++;
    // a gap: at least six consecutive game minutes (30 seconds) with the star clear, while the sun is dark enough
    let run = 0, best = 0; for (const c of seen) { run = c ? 0 : run + 1; best = Math.max(best, run); }
    if (best >= 6) gaps++;
  }
  check(closed > 0 && gaps > 0, `broken cloud covers the pole star at first and opens a gap you can take it in (${closed} covered, ${gaps} with a gap)`);
  const S = (() => { for (let s = 1; s < 60; s++) { const v = newVoyage("broken-cloud", s); if (v.watch.weather === "cloud") return v; } })();
  apply(S, { t: "skip" }); apply(S, { t: "pick", hr: POLARIS_HR }); S.watch.min = 0;
  const covered = look(S, POLARIS).cloud;
  check(covered ? !apply(S, { t: "raise" }).ok : true, "a star behind cloud cannot be sighted");
  check(cloudsNow(S).length === 4 && cloudsNow(S).every(c => c.alt > 0 && c.r > 5), "the renderer is given the clouds as discs on the sky");
}
{
  const lv = newVoyage("first-watch", 2);
  apply(lv, { t: "skip" });
  const h = t => hintFor(lv, t);
  check(h(0).ring === POLARIS_HR && !h(0).figure && /Polaris/.test(h(0).text), "tier 0 names the star and rings it");
  check(h(1).ring === null && h(1).figure === "UMa" && /point/.test(h(1).text), "tier 1 names it and gives the star-hopping rule, and draws the Plough");
  check(h(2).figure === null && /Plough/.test(h(2).text) && /(north|east|west)/.test(h(2).text), "tier 2 gives the constellation and the region");
  check(/due north|north/.test(h(3).text) && /\d+° up/.test(h(3).text) && h(4).text === "Find the pole star.", "tier 3 gives a bearing and a height, tier 4 nothing");
  check(["plough", "cassiopeia"].includes(routeOf(lv)), "a route is chosen");
  const spring = Array.from({ length: 12 }, (_, i) => routeOf(newVoyage("first-watch", i + 1))), autumn = Array.from({ length: 12 }, (_, i) => routeOf(newVoyage("the-other-side", i + 1)));
  check(spring.every(r => r === "plough") && autumn.every(r => r === "cassiopeia"), "on spring evenings the Plough is high and the way; the last level fixes Cassiopeia (the rigging hides the Plough)");
  check(regionWords(45, 10) === "low in the north-east" && regionWords(270, 40) === "halfway up in the west" && regionWords(350, 70) === "high in the north", "the region in words");
  check(masteryAfter(0, 0, true) === 2 && masteryAfter(0, 2, true) === 3 && masteryAfter(3, 0, true) === 3 && masteryAfter(0, 1, false) === 1, "mastery rises with a find (named with a hint, found without) and never falls");
}
{
  const S = newVoyage("the-other-side", 9);
  apply(S, { t: "skip" }); apply(S, { t: "pick", hr: POLARIS_HR });
  const text = save(S), R = restore(text);
  check(R && save(R) === text && text.length < 9000, `a voyage saves as ${text.length} characters of JSON and loads back the same`);
  const x = JSON.parse(JSON.stringify(S)), y = restore(text);
  waitFor(x, s => look(s, POLARIS).visible); waitFor(y, s => look(s, POLARIS).visible);
  apply(x, { t: "raise" }); apply(y, { t: "raise" });
  apply(x, { t: "read", marks: [sextantTruth(x)] }); apply(y, { t: "read", marks: [sextantTruth(y)] }); apply(x, { t: "plot" }); apply(y, { t: "plot" });
  apply(x, { t: "sail", course: 250 }); apply(y, { t: "sail", course: 250 });
  check(save(x) === save(y), "a restored voyage goes on exactly as the original (one seed, one draw counter)");
  check(restore("nonsense") === null && restore(JSON.stringify({ v: 2 })) === null && restore(null) === null, "a bad save is not a voyage");
  check(validate(x).length === 0, "a played voyage keeps its invariants");
}

// ---------- the forecast of a course ----------
{
  const S = newVoyage("first-watch", 5);
  apply(S, { t: "skip" }); apply(S, { t: "pick", hr: POLARIS_HR });
  const f = forecast(S, 90), g = forecast(S, 90), tr = P => P[0][0] + P[1][1];
  check(f.hours > 4 && f.hours < 20 && Math.abs(f.run - f.hours * levelOf(S).speed) < 1e-9, `a forecast says how long to the next twilight (${f.hours.toFixed(1)} h, ${f.run.toFixed(0)} nm)`);
  check(Math.abs(f.E[1] - S.E[1]) < 1e-6 && f.E[0] > S.E[0] + 10 && JSON.stringify(f) === JSON.stringify(g), "...due east it keeps the northing, adds the run to the easting, and gives the same answer twice");
  check(tr(f.P) > tr(S.P), "...and the fog it forecasts is bigger than the fog now");
  const before = save(S);
  forecast(S, 200);
  check(save(S) === before, "...and asking changes nothing");
  waitFor(S, s => look(s, POLARIS).visible); apply(S, { t: "raise" }); apply(S, { t: "read", marks: [sextantTruth(S)] }); apply(S, { t: "plot" });
  const h = forecast(S, 90);
  apply(S, { t: "sail", course: 90 });
  check(Math.hypot(h.E[0] - S.pre.E[0], h.E[1] - S.pre.E[1]) < 3 && Math.abs(h.hours - S.leg.hours) < 0.4, "the forecast lands within a few miles of the reckoning the leg gives (the sun is judged from the estimate, not the truth)");
}

// ---------- the noon watch: the sun's three sights ----------
{
  // takes the sun now (waiting out a cloud over it) and returns the stage it was taken at
  const take = S => { for (let i = 0; i < 40 && !apply(S, { t: "raise" }).ok; i++) apply(S, { t: "wait", min: 1 }); const st = S.watch.stage; apply(S, { t: "read", marks: [sextantTruth(S)] }); return st; };
  const until = (S, jd) => { for (let i = 0; i < 400 && sceneJd(S) < jd; i++) apply(S, { t: "wait", min: 1 }); };
  const S = newVoyage("noon-sight", 3);
  apply(S, { t: "skip" });
  check(S.watch.kind === "noon" && sunStage(S) === "morning" && moves(S).includes("skipstage"), "a noon-sight voyage opens with a noon watch at its morning sight");
  check(take(S) === "morning" && S.phase === "find" && S.watch.sun.m1, "the morning sight is kept in the book and the watch goes on (nothing is plotted yet)");
  check(!apply(S, { t: "plot" }).ok, "nothing can be plotted before the sun's sights are done");
  until(S, reckonedNoonJd(S) - 3 / 1440);
  check(sunStage(S) === "noon" && S.watch.min > 30, "waiting brings the sun to noon");
  check(take(S) === "noon" && S.watch.sun.noon, "the noon altitude is taken");
  check(Number.isFinite(expectedCatchJd(S)), "the almanac gives the moment the afternoon sun matches the morning's");
  until(S, expectedCatchJd(S) - 8 / 1440);
  apply(S, { t: "raise" });                                      // the drum stays where the morning sight left it; the catch is the moment the sun comes down to it
  for (let i = 0; i < 400 && sextantTruth(S) > S.watch.sun.m1.hs; i++) apply(S, { t: "wait", min: 0.05 });
  apply(S, { t: "lower" });
  check(take(S) === "afternoon" && S.phase === "book" && S.watch.book.kind === "sun", "the catch ends the sights and opens the sight book");
  const r = apply(S, { t: "plot" });
  check(r.ok && r.accepted && S.phase === "steer" && S.watch.plot.latOk && S.watch.plot.lonOk, "a good run of sights fixes both the latitude and the longitude");
  check(S.watch.plot.errorNm < 8, `...and the fix is ${S.watch.plot.errorNm.toFixed(1)} nm from the truth`);
  check(S.P[0][0] < S.pre.P[0][0] * 0.5, "the east-west fog collapses, which the pole star alone never does");
  const R = restore(JSON.parse(JSON.stringify(save(S))));
  check(R && R.phase === S.phase && JSON.stringify(R.watch.sun) === JSON.stringify(S.watch.sun) && R.watch.plot.lonOk === true, "a noon watch survives saving and restoring");
}
{
  const S = newVoyage("noon-sight", 4);
  apply(S, { t: "skip" });
  apply(S, { t: "skipstage" });
  check(S.watch.sun.m1 === false && sunStage(S) === "noon", "the morning sight may be skipped");
  for (let i = 0; i < 400 && sceneJd(S) < reckonedNoonJd(S) - 3 / 1440; i++) apply(S, { t: "wait", min: 1 });
  for (let i = 0; i < 40 && !apply(S, { t: "raise" }).ok; i++) apply(S, { t: "wait", min: 1 });
  apply(S, { t: "read", marks: [sextantTruth(S)] });
  apply(S, { t: "skipstage" });
  check(S.phase === "book" && !S.watch.book.lon && S.watch.book.noon, "without the morning and the catch the book holds the noon altitude only");
  const again = JSON.parse(JSON.stringify(save(S))), T = restore(again);
  check(apply(T, { t: "retake" }).ok && T.phase === "find" && T.watch.sun.noon === null, "the noon altitude (and only it) can be retaken");
  const r = apply(S, { t: "plot" });
  check(r.accepted && S.watch.plot.latOk && !S.watch.plot.lonOk, "...and without a catch the plot fixes the latitude and leaves the longitude foggy");
}

// ---------- any star: the intercept, the clock, the light and the gale ----------
const lopSky = (S, hr) => { apply(S, { t: "skip" }); apply(S, { t: "pick", hr }); return waitFor(S, s => look(s, BY_HR.get(hr)).visible && conditions(s).sun < -6); };
{
  const LOP = LEVELS.filter(l => l.lop);
  check(LEVELS.length >= 30 && LOP.length >= 24 && new Set(LEVELS.map(l => l.id)).size === LEVELS.length && LEVELS.every((l, i) => l.n === i + 1), `${LEVELS.length} levels, numbered in order, ${LOP.length} of them by any star`);
  check([...new Set(LEVELS.map(l => l.section))].every(k => SECTIONS[k]) && Object.keys(SECTIONS).length === 9, "nine chapters, each named");
  let worst = 0, n = 0, none = 0;
  for (const L of LOP.filter(l => !l.clock)) for (let seed = 1; seed <= 4; seed++) {
    const S = newVoyage(L.id, seed), hr = S.watch.targets[0];
    if (hr === undefined) { none++; continue; }
    if (!lopSky(S, hr)) continue;
    apply(S, { t: "raise" }); S.watch.hUnit = 0; S.E = [...S.T];                 // no horizon error, and the reckoning is right
    apply(S, { t: "read", marks: [sextantTruth(S)] });
    worst = Math.max(worst, Math.abs(S.watch.book.z)); n++;
  }
  check(n >= 40 && worst < 0.4 && none === 0, `a perfect sight of any star from the right place has no intercept: ${worst.toFixed(2)} nm over ${n} sights, every watch had a star to suggest`);
}
{
  // a wrong chronometer moves the line of a star by the star's rate of climb, and only that
  let ok = 0, n = 0, worst = 0, east = 0;
  for (const id of ["a-clock-gone-slow", "east-and-west", "the-rate-of-the-clock"]) for (let seed = 1; seed <= 6; seed++) {
    const S = newVoyage(id, seed), hr = S.watch.targets[0];
    if (!lopSky(S, hr)) continue;
    apply(S, { t: "raise" }); S.watch.hUnit = 0; S.E = [...S.T];
    apply(S, { t: "read", marks: [sextantTruth(S)] });
    const B = S.watch.book, want = B.k * S.clock.err;
    worst = Math.max(worst, Math.abs(B.z - want)); n++; if (Math.abs(B.z) > 3) ok++;
    if (Math.abs(B.a[0]) > 0.7) east++;
  }
  check(n >= 12 && worst < 0.4, `the clock's error shifts the line by exactly the star's rate of climb times it (off by ${worst.toFixed(2)} nm at most over ${n} sights)`);
  check(ok >= n / 3, `a clock thirty seconds out is plain to see in the line (${ok} of ${n} sights moved more than 3 nm)`);
  // two stars standing apart read the clock: the unknown goes into the filter and comes out smaller
  const resid = [], errs = [];
  for (let seed = 1; seed <= 14; seed++) {
    const S = newVoyage("east-and-west", seed);
    apply(S, { t: "skip" });
    for (const hr of S.watch.targets) {
      apply(S, { t: "pick", hr });
      if (!waitFor(S, s => look(s, BY_HR.get(hr)).visible && conditions(s).sun < -6)) break;
      apply(S, { t: "raise" }); S.watch.hUnit = 0;
      apply(S, { t: "read", marks: [sextantTruth(S)] }); apply(S, { t: "plot" });
    }
    if (S.watch.lops.length < 2) continue;
    resid.push(Math.abs(S.clock.err - S.epsE)); errs.push(Math.abs(S.clock.err));
  }
  const mean = a => a.reduce((t, x) => t + x, 0) / a.length;
  check(resid.length >= 8 && mean(resid) < 0.75 * mean(errs), `two stars read the clock: its error falls from ${mean(errs).toFixed(0)} s to ${mean(resid).toFixed(0)} s after one watch (${resid.length} watches)`);
}
{
  const S = newVoyage("two-lines-cross", 5), hr0 = S.watch.targets[0], hr1 = S.watch.targets[1];
  lopSky(S, hr0); apply(S, { t: "raise" }); apply(S, { t: "read", marks: [sextantTruth(S)] });
  const first = apply(S, { t: "plot" });
  check(first.accepted && first.more && S.phase === "find" && S.watch.picked === null && S.watch.lops.length === 1, "the first of two lines goes back to the sky for the second");
  check(!apply(S, { t: "pick", hr: hr0 }).ok, "...and the star already taken cannot be taken twice");
  const before = S.P[0][0] * S.P[1][1] - S.P[0][1] ** 2;
  apply(S, { t: "pick", hr: hr1 }); waitFor(S, s => look(s, BY_HR.get(hr1)).visible);
  apply(S, { t: "raise" }); apply(S, { t: "read", marks: [sextantTruth(S)] });
  const second = apply(S, { t: "plot" });
  const after = S.P[0][0] * S.P[1][1] - S.P[0][1] ** 2;
  check(second.accepted && !second.more && S.phase === "steer" && S.watch.lines.length === 2 && after < before * 0.6, "two lines end the sights and the second shrinks the fog the other way too");
  check(S.trail.filter(t => t.k === "fix" && t.w === S.w).length === 1, "...and the two lines are one fix on the chart");
  const T = newVoyage("two-lines-cross", 5); lopSky(T, hr0); apply(T, { t: "raise" }); apply(T, { t: "read", marks: [sextantTruth(T) + 50] });
  const bad1 = apply(T, { t: "plot" });
  check(bad1.ok && !bad1.accepted && apply(T, { t: "discard" }).ok && T.phase === "find" && T.watch.lops.length === 0 && apply(T, { t: "skipsight" }).ok && T.phase === "steer", "a line fifty miles out is refused; discarding it leaves the sky open, and the sights can be given up");
}
{
  // the light: seen only within its range, a bearing gives a line through it that the ship is on
  let seen = 0, near = 0, n = 0, worst = 0;
  for (const id of ["the-light-on-the-skerry", "loom-of-the-land", "a-dark-coast"]) for (let seed = 1; seed <= 8; seed++) {
    const S = newVoyage(id, seed), L = levelOf(S);
    apply(S, { t: "skip" });
    S.T = [L.light.x - 8, L.light.y - 3]; S.watch.light = { seen: true, done: false }; S.E = [S.T[0] + 3, S.T[1] - 2]; S.P = [[9, 0, 0], [0, 9, 0], [0, 0, 0]];
    const farE = dist(S.E, S.T);
    const r = apply(S, { t: "light" });
    n++; if (r.accepted) { seen++; const ln = S.watch.lines.at(-1), d = Math.abs((S.T[0] - ln.p[0]) * ln.dir[1] - (S.T[1] - ln.p[1]) * ln.dir[0]); worst = Math.max(worst, d); if (dist(S.E, S.T) < farE) near++; }
    if (!(r.ok && !apply(S, { t: "light" }).ok)) bad++;
  }
  check(seen >= 7 * n / 8 && worst < 4 && near >= seen / 2, `a bearing of the light is a line the ship is on (${worst.toFixed(1)} nm at worst), once a watch, and it pulls the reckoning toward her (${near} of ${seen})`);
  let far = 0, close = 0, count = 0;
  for (let seed = 1; seed <= 20; seed++) for (const id of ["the-light-on-the-skerry", "a-dark-coast"]) { const S = newVoyage(id, seed); count++; if (S.watch.light?.seen) close++; else far++; }
  check(close === 0 && far === count, "far from the coast no light is seen at the first watch");
}
{
  // a gale sets the ship off by what the log cannot show, on the legs the level names and not on the others
  const off = (id, leg) => { const out = []; for (let seed = 1; seed <= 24; seed++) {
    const S = newVoyage(id, seed);
    let T0 = [0, 0], E0 = [0, 0];
    for (let k = 0; k < leg; k++) { apply(S, { t: "skip" }); apply(S, { t: "skipsight" }); T0 = S.T; E0 = S.E; apply(S, { t: "sail", course: levelOf(S).course0 }); if (S.phase === "end") break; }
    if (S.phase === "end") continue;
    out.push(Math.hypot((S.T[0] - T0[0]) - (S.pre.E[0] - E0[0]), (S.T[1] - T0[1]) - (S.pre.E[1] - E0[1])));
  } return out; };
  const rms = a => Math.sqrt(a.reduce((t, x) => t + x * x, 0) / a.length), calm = off("gale-off-the-skaw", 0), blow = off("gale-off-the-skaw", 2);
  check(blow.length >= 10 && rms(blow) > 1.6 * rms(calm), `a gale sets the ship ${rms(blow).toFixed(1)} nm off her reckoning in a leg, ${rms(calm).toFixed(1)} in a calm one`);
  const S = newVoyage("gale-off-the-skaw", 1);
  check(S.weathers[1] === "storm" && S.weathers[2] === "storm" && S.weathers[0] !== "storm", "the watches a gale ends in are stormy");
  check(forecast(S, 280).P[0][0] >= 0, "the forecast's fog is a covariance with a clock row");
}
check(LEVELS.filter(l => l.section === 2).length === 4 && LEVELS.filter(l => l.section === 2).every(l => l.kinds.includes("noon")), "section 2's four levels all take the sun");

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("landfall-engine: bells, twilights, the latitude reveal, the gate and fog, the legs and endings, clouds, helps, saving");
