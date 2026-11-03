// Landfall's sky (landfall-sky.js), checked the way the design doc asks: Polaris stands within a degree of the latitude at every
// northern latitude from 10 to 80; the noon sun is 90° − |latitude − declination| high; the sun's declination is near 0 at the
// equinoxes and ±23.44° at the solstices; a body at the zenith when latitude equals declination and hour angle is zero; and
// the table tests/landfall-sky-reference.json, which astronomy-engine (MIT, an independent implementation) made for 39 bodies,
// dates (1840 to 2040) and places drawn from a fixed seed (landfall-sky-reference.mjs makes it; it is a dev tool and
// astronomy-engine is not shipped). Then the pieces the game builds on: time, refraction and dip, Polaris's reduction against
// the exact altitude, the intercept method, and the chart's plane with the longitude trap.
import { readFileSync } from "node:fs";
import { STARS } from "../landfall-stars.js";
import * as S from "../landfall-sky.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b, e) => Math.abs(a - b) <= e;
const POLARIS = STARS.find(s => s[2] === "α UMi");
const ref = JSON.parse(readFileSync(new URL("./landfall-sky-reference.json", import.meta.url), "utf8"));

// ---------- time ----------
{
  check(S.julianDate(2000, 1, 1, 12) === S.J2000, "the Julian date of noon on 1 January 2000 is 2451545.0");
  check(S.julianDate(1987, 4, 10, 0) === 2446895.5, "1987 April 10 at 0 h is JD 2446895.5 (Meeus's example)");
  const cal = S.calendar(S.julianDate(1853, 12, 5, 21, 30, 15));
  check(cal.y === 1853 && cal.m === 12 && cal.d === 5 && cal.h === 21 && cal.mi === 30 && cal.s === 15, "a date in 1853 goes to a Julian date and back");
  check(near(S.gmst(S.julianDate(1987, 4, 10, 0)), 197.693195, 0.0003), "Greenwich sidereal time at 1987 April 10 0 h UT is 13 h 10 m 46.3668 s (Meeus 12.a)");
  check(ref.times.every(t => near(S.gmst(t.jd), t.sidereal, 0.01)), "sidereal time agrees with astronomy-engine's (the apparent time differs by the equation of the equinoxes, under 0.005°)");
}

// ---------- against astronomy-engine ----------
{
  let worstStar = 0, worstSun = 0, n = 0;
  for (const c of ref.cases) {
    const mine = c.body === "sun" ? S.sunAltAz(c.jd, c.lat, c.lon) : S.starAltAz(STARS.find(s => s[0] === c.hr), c.jd, c.lat, c.lon);
    const dAlt = Math.abs(mine.alt - c.alt), dAz = c.alt > -85 && c.alt < 85 ? Math.abs(S.norm180(mine.az - c.az)) * Math.cos(c.alt * S.RAD) : 0;
    if (c.body === "sun") worstSun = Math.max(worstSun, dAlt, dAz); else worstStar = Math.max(worstStar, dAlt, dAz);
    n++;
  }
  check(n >= 30, `${n} bodies, dates and places drawn from a fixed seed (1840 to 2040, latitudes −60 to 70)`);
  check(worstStar < 0.02, `stars agree with astronomy-engine in altitude and azimuth to ${(worstStar * 60).toFixed(2)}′ at worst (the design doc asks 0.1° = 6′)`);
  check(worstSun < 0.03, `the sun agrees to ${(worstSun * 60).toFixed(2)}′ at worst (low-precision formulas)`);
  check(ref.cases.some(c => c.body !== "sun" && Math.hypot(STARS.find(s => s[0] === c.hr)[6], STARS.find(s => s[0] === c.hr)[7]) > 1000), "the table includes fast movers (Arcturus, Rigil Kentaurus), so proper motion over 170 years is checked");
  check(ref.refr.every(r => near(S.refractionOfTrue(r.hTrue), r.r * 60, 0.02)), "refraction from the true altitude (Saemundsson) agrees with astronomy-engine's");
  check(ref.refr.filter(r => r.hTrue >= 5).every(r => near(S.refraction(r.hApp), r.r * 60, 0.12)), "the design doc's refraction from the apparent altitude (Bennett) agrees with it to 0.12′ from 5° up");
}

// ---------- Polaris ----------
{
  let worst = 0, n = 0;
  const jd0 = S.julianDate(2026, 11, 3, 0);
  for (let lat = 10; lat <= 80; lat += 5) for (let h = 0; h < 24; h += 0.5) {
    const a = S.starAltAz(POLARIS, jd0 + h / 24, lat, 7); worst = Math.max(worst, Math.abs(a.alt - lat)); n++;
  }
  check(worst < 1, `Polaris stands within ${worst.toFixed(2)}° of the latitude at every northern latitude from 10° to 80° (${n} times) in 2026`);
  let worst1853 = 0;
  for (let lat = 10; lat <= 80; lat += 10) for (let h = 0; h < 24; h += 1) worst1853 = Math.max(worst1853, Math.abs(S.starAltAz(POLARIS, S.julianDate(1853, 11, 3, h), lat, 7).alt - lat));
  check(worst1853 > 1 && worst1853 < 1.6, `...and in 1853 it was farther from the pole (${worst1853.toFixed(2)}°), which the 19th-century game has to correct for`);
  const pd = y => 90 - S.placeOfDate(POLARIS[3], POLARIS[4], POLARIS[6], POLARIS[7], S.julianDate(y, 1, 1)).dec;
  check(near(pd(2026), 0.63, 0.03) && near(pd(1853), 1.47, 0.05), `Polaris's polar distance: ${pd(1853).toFixed(2)}° in 1853, ${pd(2026).toFixed(2)}° in 2026`);

  // its reduction: from the observed altitude and the hour angle to the latitude, against the altitude computed exactly
  for (const year of [1853, 2026]) {
    let w = 0, nn = 0;
    for (let lat = 15; lat <= 75; lat += 10) for (let h = 0; h < 24; h += 0.75) {
      const jd = S.julianDate(year, 2, 14, h), lon = -20 + h * 3, a = S.starAltAz(POLARIS, jd, lat, lon), r = S.polarisAlmanac(POLARIS, jd, lon, a.alt);
      w = Math.max(w, Math.abs(S.polarisLatitude(a.alt, a.H, r.pd) - lat)); nn++;
      if (Math.abs(r.lha - a.H) > 1e-6) { check(false, "the almanac's hour angle of Polaris is the sky's"); }
    }
    check(w < 0.004, `Polaris's reduction gives the latitude to ${(w * 60).toFixed(2)}′ in ${year} (${nn} times; without its second-order term it would be off by up to ${year === 1853 ? "1.5" : "0.4"}′)`);
  }
  const a = S.starAltAz(POLARIS, S.julianDate(1853, 3, 3, 3), 55, 0), plain = a.alt - S.polarisAlmanac(POLARIS, S.julianDate(1853, 3, 3, 3), 0, a.alt).pd * Math.cos(a.H * S.RAD);
  check(Math.abs(plain - 55) > 0.0005, "the second-order term matters in 1853 at 55° (the plain formula is more than 0.03′ out)");
}

// ---------- the sun ----------
{
  let decs = [];
  for (const y of [1853, 2026]) {
    decs.push([y, "March equinox", S.sunPlace(S.julianDate(y, 3, 20, 12)).dec, 0, 0.5], [y, "September equinox", S.sunPlace(S.julianDate(y, 9, 23, 0)).dec, 0, 0.5],
      [y, "June solstice", S.sunPlace(S.julianDate(y, 6, 21, 12)).dec, 23.44, 0.1], [y, "December solstice", S.sunPlace(S.julianDate(y, 12, 21, 12)).dec, -23.44, 0.1]);
  }
  check(decs.every(([, , d, want, tol]) => Math.abs(d - want) <= tol), `the sun's declination: ${decs.slice(4).map(([y, n, d]) => `${n} ${d.toFixed(2)}°`).join(", ")} (2026)`);
  let worst = 0, n = 0;
  for (const date of [[2026, 3, 20], [2026, 6, 21], [2026, 9, 23], [2026, 12, 21], [1853, 5, 1], [1853, 10, 15]]) for (let lat = -60; lat <= 70; lat += 10) {
    const jd = S.julianDate(date[0], date[1], date[2], 12), sun = S.sunPlace(jd);
    // apparent noon: the sun's hour angle is zero, so its local sidereal time equals its right ascension
    const noon = S.altAz(sun.ra, sun.dec, lat, sun.ra);
    worst = Math.max(worst, Math.abs(noon.alt - (90 - Math.abs(lat - sun.dec)))); n++;
  }
  check(worst < 1e-9, `at apparent noon the sun's altitude is 90° − |latitude − declination| (${n} dates and latitudes)`);
  // the equation of time, to find noon by the clock: the sun crosses the meridian at 12 h − EoT local mean time
  const feb = S.sunPlace(S.julianDate(2026, 2, 11, 12)).eot, nov = S.sunPlace(S.julianDate(2026, 11, 3, 12)).eot;
  check(near(feb * 60, -14.2, 0.5) && near(nov * 60, 16.4, 0.5), `the equation of time: ${(feb * 60).toFixed(1)} min on 11 February (sun late), ${(nov * 60).toFixed(1)} min on 3 November (sun early)`);
  check(near(S.sunPlace(S.julianDate(2026, 4, 15, 12)).eot, 0, 0.02), "...and it is nil around 15 April");
}

// ---------- the zenith and the horizon ----------
{
  const z = S.altAz(123.4, 31.7, 31.7, 123.4);
  check(near(z.alt, 90, 1e-9), "a body at the zenith: latitude equal to declination and hour angle zero give an altitude of 90°");
  const east = S.altAz(0, 0, 40, -90), west = S.altAz(0, 0, 40, 90), south = S.altAz(0, 10, 40, 0), north = S.altAz(0, 80, 40, 180);
  check(near(east.az, 90, 1e-9) && near(west.az, 270, 1e-9) && near(south.az, 180, 1e-9) && near(north.az, 0, 1e-9), "azimuth runs from north through east: a body rising on the equator is due east, setting due west, on the meridian south of the zenith due south");
  check(near(east.alt, 0, 1e-9) && near(south.alt, 60, 1e-9) && near(north.alt, 30, 1e-9), "...and the altitudes are right (rising is on the horizon, 60° on the meridian for a star 30° south of the zenith, and a star at declination 80° is 30° up at its lower culmination at 40° N)");
  const g = S.groundPoint(88, 20, S.julianDate(2026, 11, 3, 6));
  check(near(g.lat, 20, 1e-9) && near(S.altAz(88, 20, g.lat, S.gmst(S.julianDate(2026, 11, 3, 6)) + g.lon).alt, 90, 1e-6), "a body's ground point is where it stands overhead");
}

// ---------- the sextant's corrections ----------
{
  check(near(S.dip(3), 3.05, 0.01) && near(S.dip(0), 0, 1e-9), "dip: 1.76′ times the square root of the eye's height in metres (3.05′ at 3 m)");
  check(near(S.refractionOfTrue(45), 1.01, 0.02) && near(S.refraction(45), 0.99, 0.02) && S.refractionOfTrue(5) > 9, "refraction is about 1′ at 45° and about 10′ at 5°");
  let w = 0;
  for (let h = 8; h <= 88; h += 4) w = Math.max(w, Math.abs(S.observedAltitude(S.sextantReading(h, 3.5), 3.5) - h) * 60);
  check(w < 0.12, `reducing what the sextant reads (dip, then refraction) gives back the true altitude to ${w.toFixed(2)}′ from 8° up`);
}

// ---------- the intercept method ----------
{
  // an observer at the true position, an assumed position some miles off: the line of position must pass through the observer
  const origin = { lat: 56, lon: 5 };
  const jd = S.julianDate(1853, 11, 20, 19, 30);
  let worst = 0, n = 0;
  for (const star of [POLARIS, ...STARS.filter(s => s[8] && s[5] < 1.3)]) {
    for (const off of [[6, -9], [-14, 11], [20, 5], [-3, -25]]) {
      const truth = [4, -7], tll = S.toLatLon(origin, truth), all = S.toLatLon(origin, [truth[0] + off[0], truth[1] + off[1]]);
      const ts = S.starAltAz(star, jd, tll.lat, tll.lon), as = S.starAltAz(star, jd, all.lat, all.lon);
      if (ts.alt < 15) continue;
      const lop = S.lineOfPosition([truth[0] + off[0], truth[1] + off[1]], as.alt, as.az, ts.alt);
      // distance of the true position from the line: the component along `toward` of (truth − foot)
      const d = (truth[0] - lop.foot[0]) * lop.toward[0] + (truth[1] - lop.foot[1]) * lop.toward[1];
      worst = Math.max(worst, Math.abs(d)); n++;
    }
  }
  check(n >= 8 && worst < 0.6, `the true position lies on the line of position (assumed position up to 27 nm off, ${n} sights): ${worst.toFixed(2)} nm from it at worst`);
  const as = S.starAltAz(POLARIS, jd, 56, 5), l = S.lineOfPosition([0, 0], as.alt, as.az, as.alt + 10 / 60);
  check(near(l.a, 10, 1e-9) && near(l.foot[1], 10, 0.05) && Math.abs(l.foot[0]) < 0.5, "Polaris's line is a parallel: ten minutes of altitude too high puts you ten miles north of the assumed position, and says nothing east or west");
  check(near(S.circleRadiusNm(60), 1800, 1e-9), "the circle of position of a body at 60° has a radius of 1800 nm");
}

// ---------- the chart's plane and the longitude trap ----------
{
  const o = { lat: 55, lon: 8 };
  const ll = S.toLatLon(o, [37.5, -42.25]), back = S.fromLatLon(o, ll.lat, ll.lon);
  check(near(back[0], 37.5, 1e-9) && near(back[1], -42.25, 1e-9), "nautical miles to latitude and longitude and back");
  const east60 = S.toLatLon({ lat: 60, lon: 0 }, [60, 0]), east60eq = S.toLatLon({ lat: 0, lon: 0 }, [60, 0]);
  check(near(east60eq.lon, 1, 1e-9) && near(east60.lon, 2, 1e-9), "the longitude trap: 60 nm due east is one degree of longitude on the equator and two at 60° N, because a minute of longitude shrinks by cos φ");
  check(near(S.toLatLon(o, [0, 60]).lat, 56, 1e-12), "...while a minute of latitude is a mile everywhere");
}

// ---------- the sun sights ----------
{
  const jd = S.julianDate(1853, 6, 20, 12), lat = 55.9, lon = -1.3;
  const tn = S.noonJd(jd, lon);
  check(near(S.sunHourAngle(tn, lon), 0, 1e-6), "apparent noon is where the sun's hour angle is zero");
  check(near(S.sunHourAngle(S.sunAtHourAngle(tn - 0.2, lon, -30), lon), -30, 1e-6), "the sun's hour angle of −30° is found to the minute");
  const hs = S.sunReading(60, tn, 3.5);
  check(near(S.sunObservedAltitude(hs, tn, 3.5), 60, 0.002), "the sun's corrections (dip, refraction, semi-diameter, parallax) undo what the sextant reading put in");
  check(near(S.sunSemidiameter(S.julianDate(1853, 1, 3, 0)), 16.27, 0.05) && near(S.sunSemidiameter(S.julianDate(1853, 7, 4, 0)), 15.74, 0.05), "the semi-diameter is 16.3′ near the perihelion and 15.7′ near the aphelion");
  const day = S.sunAltAz(tn, lat, lon);
  check(near(S.latitudeFromMeridian(day.alt, day.dec, day.dec < lat), lat, 1e-6), "the meridian altitude gives the latitude back");
  // equal altitudes: the morning and afternoon sights an equal time either side of noon give the longitude, the drift of declination allowed for
  const t1 = S.sunAtHourAngle(tn - 0.4, lon, -35), t2 = S.sunAtHourAngle(tn - 0.2, lon, 35);
  const a1 = S.sunAltAz(t1, lat, lon).alt;
  const t2b = (() => { let lo = tn, hi = tn + 0.4; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; (S.sunAltAz(m, lat, lon).alt > a1 ? lo = m : hi = m); } return (lo + hi) / 2; })();
  const found = S.equalAltitudeLongitude(t1, t2b, lat, lon + 1.5);
  check(found !== null && near(found, lon, 0.002), "equal altitudes find the longitude, even from a reckoning 1.5° out");
  check(S.equalAltitudeLongitude(t1, t2b, lat, lon + 20) === null, "...and say so when the reckoning is too far out to fit");
  check(near(S.longitudeFromNoon(S.julianDate(1853, 3, 1, 12), 0), 0, 1e-9), "noon by the clock at 12 h GMT with no equation of time is longitude 0");
  check(near(S.longitudeFromNoon(S.julianDate(1853, 3, 1, 11), 0), 15, 1e-6), "…and the sun crossing an hour early is 15° east");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("landfall-sky: time, the sky against astronomy-engine, Polaris, the sun, the zenith, dip and refraction, the intercept, the chart's plane");
