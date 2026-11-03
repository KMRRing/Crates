// What Landfall says: numbers set as a navigator writes them, the lines of the sight book, the log slate and the almanac's page, the
// ending in words. Pure functions of the voyage (tests/landfall-words.mjs); the page only puts them on the screen.
import { levelOf, estPlace, sceneJd, shipClock, POLARIS, EYE } from "./landfall-engine.js";
import { ellipse, dist } from "./landfall-model.js";
import { polarisAlmanac, polarisLatitude, toLatLon, placeOfDate, norm360 } from "./landfall-sky.js";

const pad = (n, w = 2) => String(n).padStart(w, "0");

/** 54.8833 -> "54° 53.0′ N" (S for negative). */
export function fmtLat(deg, plusMinus = "NS") {
  const a = Math.abs(deg) + 1e-9, d = Math.floor(a), m = (a - d) * 60;
  return `${d}° ${pad(m.toFixed(1), 4)}′ ${deg < 0 ? plusMinus[1] : plusMinus[0]}`;
}
/** East longitude in degrees -> "12° 34′ E" (to the minute: that is as exactly as a dead reckoning knows it). */
export function fmtLon(deg) {
  const a = Math.abs(deg) + 1e-9, d = Math.floor(a), m = Math.round((a - d) * 60);
  return m === 60 ? `${d + 1}° 00′ ${deg < 0 ? "W" : "E"}` : `${d}° ${pad(m)}′ ${deg < 0 ? "W" : "E"}`;
}
/** A course in three figures, as it is steered. */
export const fmtCourse = c => `${pad(Math.round(((c % 360) + 360) % 360) % 360, 3)}°`;
/** Hours as "11.2 h". */
export const fmtHours = h => `${h.toFixed(1)} h`;
/** Nautical miles: one decimal below ten. */
export const fmtNm = nm => { const a = Math.abs(nm); return `${a < 10 ? a.toFixed(1) : Math.round(a)} nm`; };
/** A signed number of arcminutes: "+0.9′", "−4.1′". */
export const fmtSigned = x => `${x < -0.05 ? "−" : x > 0.05 ? "+" : "±"}${Math.abs(x).toFixed(1)}′`;
/** Arcminutes as degrees and minutes, "55° 14.2′". */
export const fmtDM = arcmin => { const d = Math.floor(arcmin / 60 + 1e-9); return `${d}° ${pad((arcmin - d * 60).toFixed(1), 4)}′`; };

/** A star's name as the chart would give it: its own name, else its letter and constellation. */
export const starLabel = s => s[1] || s[2] || `HR ${s[0]}`;

/** The year's date as "20 April" for a voyage. */
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const dateWords = S => `${S.date[2]} ${MONTH[S.date[1] - 1]} ${S.date[0]}`;

/** Watch n of m, and which twilight. */
export const watchWords = S => `Watch ${Math.min(S.w, S.watches)} of ${S.watches}, ${S.kinds[S.w - 1] === "dawn" ? "dawn" : "dusk"}`;

/** The leg just sailed, on the log slate: what the log says, in the units the chart has. Departure is east-west distance; a minute of longitude is shorter by the cosine. */
export function slate(S) {
  const L = levelOf(S), g = S.leg, a = g.course * Math.PI / 180;
  const dLat = g.run * Math.cos(a), dep = g.run * Math.sin(a);
  const lat0 = toLatLon(L.origin, S.E).lat, lat1 = lat0 + dLat / 60, mid = (lat0 + lat1) / 2, dLon = dep / Math.cos(mid * Math.PI / 180);
  return { course: g.course, run: g.run, hours: g.hours, dLat, dep, dLon, mid, cosMid: Math.cos(mid * Math.PI / 180) };
}
/** The slate as lines of words. */
export function slateLines(S) {
  const s = slate(S);
  return [
    `Log ${s.run.toFixed(1)} nm on ${fmtCourse(s.course)}, ${fmtHours(s.hours)}.`,
    `Made good ${fmtNm(Math.abs(s.dLat))} ${s.dLat >= 0 ? "north" : "south"} and ${fmtNm(Math.abs(s.dep))} ${s.dep >= 0 ? "east" : "west"}.`,
    `${Math.abs(s.dep).toFixed(1)} nm east-west is ${Math.abs(s.dLon).toFixed(1)}′ of longitude here: a minute of longitude is only ${s.cosMid.toFixed(2)} nm.`,
  ];
}

/** Every line of the sight book for a reduced sight: [{ label, value, key }]. The latitude is the last line; the rest are what the almanac asks. */
export function bookLines(S) {
  const B = S.watch.book;
  if (!B) return [];
  const est = estPlace(S);
  return [
    { label: B.n > 1 ? `Sextant, mean of ${B.n}` : "Sextant", value: fmtDM(B.hs) },
    { label: `Dip, eye ${EYE} m up`, value: `−${B.dip.toFixed(1)}′` },
    { label: "Apparent altitude", value: fmtDM(B.app) },
    { label: "Refraction", value: `−${B.refr.toFixed(1)}′` },
    { label: "True altitude", value: fmtDM(B.ho) },
    { label: `Almanac: Polaris at ${Math.round(((B.lha % 360) + 360) % 360)}°`, value: fmtSigned(B.corr) },
    { label: "Latitude", value: fmtLat(B.lat), key: true },
    { label: "Dead reckoning", value: fmtLat(est.lat) },
    { label: "Difference", value: `${fmtSigned((B.lat - est.lat) * 60)} = ${fmtNm((B.lat - est.lat) * 60)} ${B.lat >= est.lat ? "north" : "south"}` },
  ];
}

/** The north-south uncertainty (95 in 100) in nautical miles for a fog. */
export const fogNS = P => 2.45 * Math.sqrt(Math.max(0, P[1][1]));
/** What a plotted sight did to the fog, in words. */
export function revealWords(S) {
  const p = S.watch.plot;
  if (!p || !p.accepted) return "";
  return `Latitude ${fmtLat(p.lat)}. North and south the ship is now within ${fmtNm(fogNS(p.after.P))}, from ${fmtNm(fogNS(p.before.P))}. East and west is as uncertain as before: Polaris gives latitude only.`;
}
/** Why a sight was refused, in words. */
export function refusedWords(S) {
  const p = S.watch.plot;
  return `This latitude is ${fmtNm(Math.abs(p.z))} ${p.z >= 0 ? "north" : "south"} of the reckoning, and the fog allows ${fmtNm(p.gate)}. It is not plotted: was it Polaris, was the horizon right, was the reading? Take it again, or throw it away.`;
}

/** The log: what was written at each watch. [{ watch, kind, text }]. */
export function logRows(S) {
  const L = levelOf(S), rows = [];
  for (const t of S.trail) {
    const p = toLatLon(L.origin, t.p);
    rows.push({ watch: t.w, kind: t.k, text: `${t.k === "fix" ? "Fixed" : t.k === "start" ? "Left port" : "Reckoned"}  ${fmtLat(p.lat)}  ${fmtLon(p.lon)}` });
  }
  return rows;
}

/**
 * The almanac's page for Polaris: its distance from the pole, and the correction to add to the true altitude at every 30 degrees of its hour
 * angle (the sheet is for the year of the voyage; the altitude hardly matters, so one is used). `now` is the row the present moment is on.
 */
export function almanacPage(S) {
  const jd = sceneJd(S), est = estPlace(S), p = placeOfDate(POLARIS[3], POLARIS[4], POLARIS[6], POLARIS[7], jd);
  const now = polarisAlmanac(POLARIS, jd, est.lon, est.lat), pd = now.pd;
  const rows = [];
  for (let lha = 0; lha < 360; lha += 30) rows.push({ lha, corr: (polarisLatitude(est.lat, lha, pd) - est.lat) * 60 });
  return { pd, dec: p.dec, lha: norm360(now.lha), corr: now.corr, rows, ship: shipClock(jd, est.lon), date: dateWords(S) };
}

/** The ending in words: { title, lines, stars }. */
export function endWords(S) {
  const L = levelOf(S), e = S.end;
  if (!e) return null;
  const off = dist(S.E, S.T), where = `Your reckoning put you ${fmtNm(off)} from where you were.`;
  if (e.kind === "arrived") {
    const lines = [`${L.harbour.name} lies ahead. The track passed ${fmtNm(e.miss)} from the harbour mark.`, where];
    return { title: e.stars === 3 ? "A clean landfall" : e.stars === 2 ? "Landfall" : "Landfall, narrowly", lines, stars: e.stars, kind: "arrived" };
  }
  if (e.kind === "grounded") return { title: "Aground", lines: [e.why ? `The ship struck ${e.why}.` : "The ship struck.", where], stars: 0, kind: "grounded" };
  return { title: "Landfall missed", lines: [`The last watch is over and ${L.harbour.name} is not under the bow; the track passed ${fmtNm(e.miss ?? 0)} from it.`, where], stars: 0, kind: "missed" };
}

/** The size of the fog as "±N nm" north-south and east-west, for the task line. */
export function fogWords(P) {
  const e = ellipse(P);
  return `${fmtNm(e.rx)} × ${fmtNm(e.ry)}`;
}
