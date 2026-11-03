// The sky of Landfall: pure functions (no page, no clock, no randomness), so the same sky is computed in the page, in the
// bots and in the tests. Angles are degrees unless a name says radians; time is a Julian date in UT (the game's chronometer
// is right in M1, so UT, UTC and the sky's clock are one); positions are east longitude and north latitude. Tested against
// astronomy-engine (MIT) by tests/landfall-sky.mjs, which carries a table of its results (landfall-sky-reference.mjs makes it).
//
// What is left out, on purpose: nutation (at most 17″) and aberration (at most 20″), a quarter of an arcminute together,
// which a sextant read to the arcminute cannot see; the difference between UT1 and the dynamical time (7 s in 1850).
export const RAD = Math.PI / 180;
export const J2000 = 2451545.0;
const sin = d => Math.sin(d * RAD), cos = d => Math.cos(d * RAD), tan = d => Math.tan(d * RAD);
const asin = x => Math.asin(Math.max(-1, Math.min(1, x))) / RAD;
export const norm360 = a => ((a % 360) + 360) % 360;
export const norm180 = a => { const x = norm360(a); return x > 180 ? x - 360 : x; };

// ---------- time ----------

/** Julian date (UT) of a Gregorian calendar date and time. Good for any date after 1582. */
export function julianDate(y, m, d, h = 0, mi = 0, s = 0) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5 + (h + mi / 60 + s / 3600) / 24;
}
/** The calendar date and time of a Julian date: { y, m, d, h, mi, s }. */
export function calendar(jd) {
  const z0 = Math.floor(jd + 0.5), f = jd + 0.5 - z0;
  let A = z0;
  if (z0 >= 2299161) { const a = Math.floor((z0 - 1867216.25) / 36524.25); A = z0 + 1 + a - Math.floor(a / 4); }
  const B = A + 1524, C = Math.floor((B - 122.1) / 365.25), D = Math.floor(365.25 * C), E = Math.floor((B - D) / 30.6001);
  const d = B - D - Math.floor(30.6001 * E), m = E < 14 ? E - 1 : E - 13, y = m > 2 ? C - 4716 : C - 4715;
  const secs = Math.round(f * 86400);
  return { y, m, d, h: Math.floor(secs / 3600) % 24, mi: Math.floor(secs / 60) % 60, s: secs % 60 };
}
/** Greenwich mean sidereal time in degrees (the doc's formula, with the small terms that matter in 1850). */
export function gmst(jd) {
  const d = jd - J2000, T = d / 36525;
  return norm360(280.46061837 + 360.98564736629 * d + 0.000387933 * T * T - T * T * T / 38710000);
}
export const lst = (jd, lon) => norm360(gmst(jd) + lon);

// ---------- stars ----------

/**
 * A star's right ascension and declination of the date: the catalogue's J2000 place moved by its proper motion
 * (a straight line, which is good to a fraction of an arcsecond over the 200 years the game spans) and then precessed
 * (IAU 1976, Lieske; Meeus, Astronomical Algorithms, 21.2 and 21.4). `pmra` is on the sky (already times cos δ), mas a year.
 */
export function placeOfDate(ra0, dec0, pmra, pmde, jd) {
  const yrs = (jd - J2000) / 365.25, T = (jd - J2000) / 36525;
  const dec1 = dec0 + pmde * yrs / 3.6e6;
  const ra1 = ra0 + (pmra * yrs / 3.6e6) / Math.max(1e-6, cos(dec0));
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) / 3600;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) / 3600;
  const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) / 3600;
  const A = cos(dec1) * sin(ra1 + zeta);
  const B = cos(theta) * cos(dec1) * cos(ra1 + zeta) - sin(theta) * sin(dec1);
  const C = sin(theta) * cos(dec1) * cos(ra1 + zeta) + cos(theta) * sin(dec1);
  return { ra: norm360(Math.atan2(A, B) / RAD + z), dec: asin(C) };
}

/** Altitude and azimuth (from north, through east) of a place on the sky of the date, for latitude `lat` and local sidereal time `lstDeg`. */
export function altAz(ra, dec, lat, lstDeg) {
  const H = lstDeg - ra;
  const alt = asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H));
  const az = norm360(Math.atan2(-sin(H), tan(dec) * cos(lat) - cos(H) * sin(lat)) / RAD);
  return { alt, az, H: norm180(H) };
}

/** A star of the catalogue (the row of landfall-stars.js: [hr, name, des, ra, dec, mag, pmra, pmde, nav]) seen from a place at a time. */
export function starAltAz(star, jd, lat, lon) {
  const p = placeOfDate(star[3], star[4], star[6], star[7], jd);
  return { ...altAz(p.ra, p.dec, lat, lst(jd, lon)), ra: p.ra, dec: p.dec };
}

/** Where a body is straight overhead: its ground point (latitude δ, east longitude α − GMST). */
export const groundPoint = (ra, dec, jd) => ({ lat: dec, lon: norm180(ra - gmst(jd)) });

// ---------- the sun (the doc's low-precision formulas, good to about 0.01° near today) ----------

export function sunPlace(jd) {
  const n = jd - J2000;
  const L = norm360(280.460 + 0.9856474 * n), g = norm360(357.528 + 0.9856003 * n);
  const lam = L + 1.915 * sin(g) + 0.020 * sin(2 * g), eps = 23.439 - 0.0000004 * n;
  const ra = norm360(Math.atan2(cos(eps) * sin(lam), cos(lam)) / RAD), dec = asin(sin(eps) * sin(lam));
  return { ra, dec, eot: norm180(L - ra) / 15 };      // the equation of time in hours: apparent noon is at 12 h minus it, local mean time
}
export const sunAltAz = (jd, lat, lon) => { const s = sunPlace(jd); return { ...altAz(s.ra, s.dec, lat, lst(jd, lon)), ra: s.ra, dec: s.dec }; };

// ---------- the sextant's corrections ----------

/** Dip of the horizon, arcminutes, for an eye `h` metres above the sea. */
export const dip = h => 1.76 * Math.sqrt(Math.max(0, h));
/** Refraction in arcminutes for an APPARENT altitude (Bennett, the doc's formula): what to subtract from an observed altitude. */
export const refraction = hApp => 1 / Math.tan((hApp + 7.31 / (hApp + 4.4)) * RAD);
/** Refraction in arcminutes for a TRUE altitude (Saemundsson): how much higher than the geometry the star is seen. */
export const refractionOfTrue = hTrue => 1.02 / Math.tan((hTrue + 10.3 / (hTrue + 5.11)) * RAD);
/** The altitude a star is SEEN at (above the astronomical horizon) for its true altitude: the geometry plus refraction, degrees. */
export const apparentAltitude = hTrue => hTrue + refractionOfTrue(hTrue) / 60;
/** What the sextant reads (degrees): the apparent altitude measured from the visible horizon, which lies `dip` below the true one. */
export const sextantReading = (hTrue, eyeM) => apparentAltitude(hTrue) + dip(eyeM) / 60;
/** From a sextant reading Hs to the observed altitude Ho the reduction wants (degrees): subtract the dip, then refraction. */
export function observedAltitude(hs, eyeM) {
  const app = hs - dip(eyeM) / 60;
  return app - refraction(app) / 60;
}

// ---------- the intercept method ----------

/** The intercept in nautical miles: positive means the observer is nearer the body than the assumed position (a = 60 (Ho − Hc)). */
export const interceptNm = (ho, hc) => 60 * (ho - hc);
/**
 * The line of position from an assumed position (x, y in nm), a computed altitude hc at azimuth zn and an observed altitude ho:
 * a line perpendicular to zn, `a` nm from the assumed position, toward the body when a is positive. Returns the foot of the
 * perpendicular, the unit direction toward the body and the unit direction along the line.
 */
export function lineOfPosition(assumed, hc, zn, ho) {
  const a = interceptNm(ho, hc), toward = [sin(zn), cos(zn)];
  return { a, zn, toward, along: [toward[1], -toward[0]], foot: [assumed[0] + toward[0] * a, assumed[1] + toward[1] * a] };
}
/** The radius in nautical miles of the circle of position round a body's ground point, for an observed altitude. */
export const circleRadiusNm = ho => 60 * (90 - ho);

// ---------- Polaris ----------

/**
 * The latitude from Polaris. `ho` is the observed altitude, `lha` Polaris's local hour angle and `p` its polar distance (90° − its
 * declination of the date), all degrees: φ = Ho − p cos t, and the second-order term (p²/2) sin²t tan Ho, which is 1.5′ in 1850.
 * Polaris is nearly on the pole, so its altitude is the latitude to within p, and it says nothing about longitude.
 */
export function polarisLatitude(ho, lha, p) {
  return ho - p * cos(lha) + 0.5 * (p * RAD) * p * sin(lha) * sin(lha) * tan(ho);
}
/** What the almanac gives for Polaris at a time and (assumed) longitude: its hour angle, polar distance and the correction in arcminutes (latitude − Ho). */
export function polarisAlmanac(star, jd, lon, ho) {
  const p = placeOfDate(star[3], star[4], star[6], star[7], jd), lha = norm180(lst(jd, lon) - p.ra), pd = 90 - p.dec;
  return { lha, pd, corr: (polarisLatitude(ho, lha, pd) - ho) * 60 };
}

// ---------- the plane of a chart ----------

/**
 * Nautical miles east (x) and north (y) of a chart's origin ↔ latitude and east longitude, by middle-latitude sailing: a minute
 * of latitude is a mile everywhere, but a minute of LONGITUDE is a mile only on the equator and shrinks by cos φ. This is the
 * longitude trap: east-west distance is departure p = Δλ' cos φm, not Δλ'.
 */
export function toLatLon(origin, [x, y]) {
  const lat = origin.lat + y / 60, phim = (origin.lat + lat) / 2;
  return { lat, lon: origin.lon + x / (60 * cos(phim)) };
}
export function fromLatLon(origin, lat, lon) {
  const phim = (origin.lat + lat) / 2;
  return [60 * (lon - origin.lon) * cos(phim), 60 * (lat - origin.lat)];
}
