// What Landfall says: numbers set as a navigator writes them, the lines of the sight book, the log slate and the almanac's page, the
// ending in words. Pure functions of the voyage (tests/landfall-words.mjs); the page only puts them on the screen.
import { levelOf, estPlace, sceneJd, shipClock, reckonedNoonJd, expectedCatchJd, sunStage, POLARIS, EYE, BY_HR } from "./landfall-engine.js";
import { STARS } from "./landfall-stars.js";
import { ellipse, dist } from "./landfall-model.js";
import { starAltAz, polarisAlmanac, polarisLatitude, toLatLon, placeOfDate, norm360, sunPlace, sunSemidiameter, calendar } from "./landfall-sky.js";
import { leadsmanCall } from "./landfall-bed.js";

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
export const watchWords = S => `Watch ${Math.min(S.w, S.watches)} of ${S.watches}, ${S.kinds[S.w - 1] ?? "dusk"}`;

/** A Julian date's time of day on the chronometer, which keeps Greenwich: "11:57:12". */
export function fmtGmt(jd) {
  const c = calendar(jd);
  return `${pad(c.h)}:${pad(c.mi)}:${pad(c.s)}`;
}
/** Seconds as a signed time: "+0:03:41", "−0:00:09". */
export function fmtSecs(sec) {
  const a = Math.round(Math.abs(sec)), sign = sec < -0.5 ? "−" : sec > 0.5 ? "+" : "±";
  return `${sign}${Math.floor(a / 3600)}:${pad(Math.floor(a / 60) % 60)}:${pad(a % 60)}`;
}
/** East-west distance as nautical miles east or west: "3.2 nm east". */
export const fmtEW = nm => `${fmtNm(nm)} ${nm >= 0 ? "east" : "west"}`;

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
  if (B.kind === "sun") return sunBookLines(B, est);
  if (B.kind === "lop") return lopBookLines(B);
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

/** The sight book of a star taken by the intercept: the reading to a true altitude, the almanac's altitude for the reckoning, and the difference. */
function lopBookLines(B) {
  const star = BY_HR.get(B.hr), name = starLabel(star), toward = B.z >= 0;
  return [
    { label: B.n > 1 ? `Sextant, ${name}, mean of ${B.n}` : `Sextant, ${name}`, value: fmtDM(B.hs) },
    { label: `Dip, eye ${EYE} m up`, value: `−${B.dip.toFixed(1)}′` },
    { label: "Apparent altitude", value: fmtDM(B.app) },
    { label: "Refraction", value: `−${B.refr.toFixed(1)}′` },
    { label: "True altitude", value: fmtDM(B.ho) },
    { label: B.clockOff === null ? "Almanac: altitude from the reckoning" : `Almanac: altitude from the reckoning, clock put right by ${fmtSecs(-B.clockOff)}`, value: `${fmtDM(B.hc)}, bearing ${fmtCourse(B.az)}` },
    { label: "Intercept = true − almanac", value: `${fmtSigned(B.z)} = ${fmtNm(B.z)} ${toward ? "toward" : "away from"} ${name}`, key: true },
    { label: "The line runs", value: `${fmtCourse(B.az + 90)} and ${fmtCourse(B.az - 90)}` },
  ];
}

/** The sight book of a noon watch: the noon altitude to a latitude, and the two times to a longitude. Either part may be missing. */
function sunBookLines(B, est) {
  const out = [];
  if (B.noon) {
    const N = B.noon;
    out.push(
      { label: N.n > 1 ? `Sextant, lower limb, mean of ${N.n}` : "Sextant, lower limb", value: fmtDM(N.hs) },
      { label: `Dip, eye ${EYE} m up`, value: `−${N.dip.toFixed(1)}′` },
      { label: "Refraction", value: `−${N.refr.toFixed(1)}′` },
      { label: "Semi-diameter and parallax", value: `+${N.sd.toFixed(1)}′ +${N.par.toFixed(1)}′` },
      { label: "True altitude of the centre", value: fmtDM(N.ho) },
      { label: `Almanac: declination (sun bears ${N.south ? "south" : "north"})`, value: fmtLat(N.dec) },
      { label: N.south ? "Latitude = dec + (90° − Ho)" : "Latitude = dec − (90° − Ho)", value: fmtLat(N.lat), key: true },
      { label: "Against the reckoning", value: `${fmtNm((N.lat - est.lat) * 60)} ${N.lat >= est.lat ? "north" : "south"}` },
    );
  }
  if (B.lon) {
    const T = B.lon, d = (12 * 3600 - T.eot) - ((((T.tn + 0.5) % 1) + 1) % 1) * 86400;      // 12 h less the equation of time, less the chronometer's time of noon
    out.push(
      { label: "Morning sight, chronometer", value: `${fmtGmt(T.t1)}` },
      { label: "The catch, chronometer", value: `${fmtGmt(T.t2)}` },
      { label: `Noon: half way, ${fmtSecs(T.corr)} for the sun's drift`, value: `${fmtGmt(T.tn)}` },
      { label: `Almanac: equation of time ${fmtSecs(T.eot)}`, value: `${fmtSecs(d)}` },
      { label: "Longitude = 15° × (12 h − eq − noon)", value: fmtLon(T.lon), key: true },
      { label: "Against the reckoning", value: fmtEW((T.lon - est.lon) * 60 * Math.cos(T.lat * Math.PI / 180)) },
    );
  }
  return out;
}

/** The north-south uncertainty (95 in 100) in nautical miles for a fog. */
export const fogNS = P => 2.45 * Math.sqrt(Math.max(0, P[1][1]));
/** The east-west uncertainty (95 in 100) in nautical miles for a fog. */
export const fogEW = P => 2.45 * Math.sqrt(Math.max(0, P[0][0]));
/** What a plotted sight did to the fog, in words. */
export function revealWords(S) {
  const p = S.watch.plot;
  if (!p || !p.accepted) return "";
  const fog = () => `Now north-south ±${fmtNm(fogNS(p.after.P))} (was ${fmtNm(fogNS(p.before.P))}), east-west ±${fmtNm(fogEW(p.after.P))} (was ${fmtNm(fogEW(p.before.P))}).`;
  if (p.light) return `${p.name && levelOf(S).lights ? p.name : "The light"} bears ${fmtCourse(p.observed)} by the compass. ${fog()}`;
  if (p.sound) return `${p.depth} fathoms: the ship is somewhere on that depth's contour, ruled on the chart. ${fog()}`;
  if (p.hill) return `${p.name} bears ${fmtCourse(p.observed)} by the compass. ${fog()}`;
  if (p.trace) return `The line of soundings is laid down where its depths agree with the chart's: a fix from the bottom. ${fog()}`;
  if (p.birds) return `The birds flew ${fmtCourse(p.observed)} by the compass: a line through ${p.name}, rough as birds are. ${fog()}`;
  if (p.lop) return `${starLabel(BY_HR.get(p.hr))}: the ship is ${fmtNm(p.z)} ${p.z >= 0 ? "toward it" : "away from it"} of where you reckoned. ${fog()}${p.more ? " Take a second star standing well apart from it, and the two lines make a fix." : ""}`;
  if (p.sun) {
    const got = [p.latOk && `latitude ${fmtLat(p.lat)}`, p.lonOk && `longitude ${fmtLon(p.lon)}`].filter(Boolean).join(", ");
    const lost = [p.latOk === false && p.zLat !== undefined && "The latitude was refused.", p.lonOk === false && p.zLon !== undefined && "The longitude was refused."].filter(Boolean).join(" ");
    const fog = `Now north-south ±${fmtNm(fogNS(p.after.P))} (was ${fmtNm(fogNS(p.before.P))}), east-west ±${fmtNm(fogEW(p.after.P))} (was ${fmtNm(fogEW(p.before.P))}).`;
    return `${got[0].toUpperCase()}${got.slice(1)}. ${fog}${p.lonOk ? " The clock fixed the longitude." : " Without the clock east-west stays foggy."} ${lost}`.trim();
  }
  return `Latitude ${fmtLat(p.lat)}. North and south the ship is now within ${fmtNm(fogNS(p.after.P))}, from ${fmtNm(fogNS(p.before.P))}. East and west is as uncertain as before: Polaris gives latitude only.`;
}
/** Why a sight was refused, in words. */
export function refusedWords(S) {
  const p = S.watch.plot;
  if (p.light) return `${p.name && levelOf(S).lights ? `A line through ${p.name}` : "The light's line"} is ${fmtNm(Math.abs(p.z))} from the reckoning, and the fog allows ${fmtNm(p.gate)}. It is not plotted: is the compass right? Is it the light you think?`;
  if (p.trace) return p.flat ? "The bottom under the line is too even to say where it lies: on this ground it would fit anywhere. Next leg's line, over the banks, will say more." : p.far ? "The line fits there, but that is far outside the fog: is it the right bank? It is not laid down." : "The depths there do not agree with the chart's. The line is not laid down: next leg's line will say more.";
  if (p.birds) return `A line through ${p.name} is ${fmtNm(Math.abs(p.z))} from the reckoning, and the fog allows ${fmtNm(p.gate)}. It is not plotted: were they bound for that rock? At dawn their rock is astern.`;
  if (p.hill) return `A line through ${p.name} is ${fmtNm(Math.abs(p.z))} from the reckoning, and the fog allows ${fmtNm(p.gate)}. It is not plotted: is it the summit you think?`;
  if (p.sound) return `${p.depth} fathoms is nowhere near the reckoning: the nearest such depth is ${fmtNm(Math.abs(p.z))} off it, and the fog allows ${fmtNm(p.gate)}. It is not plotted: the other side of a bank? Fix by the stars, and the next cast will say.`;
  if (p.lop) return `This line is ${fmtNm(Math.abs(p.z))} ${p.z >= 0 ? "toward" : "away from"} ${starLabel(BY_HR.get(p.hr))} of the reckoning, and the fog allows ${fmtNm(p.gate)}. It is not plotted: was it that star, was the horizon right, was the reading? Take it again, or throw it away.`;
  if (p.sun) {
    const bits = [p.zLat !== undefined && `The latitude is ${fmtNm(Math.abs(p.zLat))} ${p.zLat >= 0 ? "north" : "south"} of the reckoning (the fog allows ${fmtNm(p.gateLat)})`,
      p.zLon !== undefined && `the longitude is ${fmtNm(Math.abs(p.zLon))} ${p.zLon >= 0 ? "east" : "west"} of it (the fog allows ${fmtNm(p.gateLon)})`].filter(Boolean).join("; ");
    return `${bits[0].toUpperCase()}${bits.slice(1)}. Neither is plotted: was the sun at its peak, was the catch made on the moment, was the horizon clear? Take the noon altitude again, or throw the sights away.`;
  }
  return `This latitude is ${fmtNm(Math.abs(p.z))} ${p.z >= 0 ? "north" : "south"} of the reckoning, and the fog allows ${fmtNm(p.gate)}. It is not plotted: was it Polaris, was the horizon right, was the reading? Take it again, or throw it away.`;
}

/** What the lead brought up, in the leadsman's words and the navigator's: the call, the bottom, and what it means for the plot. */
export function soundWords(S, r) {
  const W = S.watch, s = W.sound, L = levelOf(S);
  if (!s) return "";
  if (s.none) return `"No bottom with this line!" Past ${L.bed.line} fathoms: well out from the coast.`;
  const call = `"${leadsmanCall(s.depth)}!" ${s.bottom[0].toUpperCase()}${s.bottom.slice(1)} on the tallow.`;
  if (s.flat) return `${call} The bottom is flat here: the depth says nothing of where on it you are.`;
  if (s.off) return `${call} ${refusedWords(S)}`;
  return call;
}

/** The first words of the steering line: what the watch's sights made. */
export function steerHead(S) {
  const W = S.watch, p = W.plot, names = (W.lops || []).map(h => starLabel(BY_HR.get(h))).join(" and ");
  if (W.lops?.length || W.lines?.length) {
    const lit = (W.lines || []).filter(l => l.kind === "light"), many = !!levelOf(S).lights, hills = (W.lines || []).filter(l => l.kind === "hill" || l.kind === "birds" || l.kind === "trace").map(l => (l.kind === "birds" ? `the birds of ${l.name}` : l.kind === "trace" ? "the line of soundings" : l.name));
    const extra = [...(many ? lit.map(l => l.name) : lit.length ? ["the light"] : []), ...hills, W.lines?.some(l => l.kind === "depth") && "the lead"].filter(Boolean);
    const lines = (W.lops?.length || 0) + (W.lines || []).filter(l => l.kind !== "star").length, from = [names, ...extra].filter(Boolean);
    return `<b>${lines > 1 ? "A fix" : "One line"}${from.length ? ` from ${from.slice(0, -1).join(", ")}${from.length > 1 ? " and " : ""}${from.at(-1)}` : ""}.</b> `;
  }
  return p?.accepted ? `<b>Latitude ${fmtLat(p.lat)}.</b> ` : p?.discarded ? "The sight is thrown away. " : "No sight this watch. ";
}
/** What to do in the sky on a level of any-star sights: how many lines are in, and (with help) which stars the almanac would suggest. */
export function lopFindWords(S, tier) {
  const W = S.watch, L = levelOf(S), n = L.lop - W.lops.length, names = W.targets.filter(h => !W.lops.includes(h)).map(h => starLabel(BY_HR.get(h)));
  const seen = (W.lights || []).filter(l => l.seen && !l.done).length;
  const light = W.light?.seen && !W.light.done ? " The light is in sight: take its bearing."
    : W.light && !W.light.seen && L.light ? " No light is in sight yet."
    : seen ? ` ${seen > 1 ? "Lights are" : "A light is"} in sight: tell ${seen > 1 ? "them" : "it"} by the flashes, then take the bearing.`
    : L.lights && !W.lights?.some(l => l.seen) ? " No light is in sight yet." : "";
  const land = (W.hills?.some(h => h.seen && !h.done) ? " The land is in sight: tell its summits by their shapes, and take a bearing." : "")
    + (W.colonies?.some(c => c.seen && !c.done) ? ` Seabirds are flying ${W.kind === "dawn" ? "out from" : "home to"} their rock: mark their course.` : "");
  const lead = `Sight ${W.lops.length + 1} of ${L.lop}: ${n === 1 && W.lops.length ? "one more, standing apart" : "tap a bright star"}`;
  return `${lead}${tier < 4 && names.length ? ` (try ${names.map(x => `<b>${x}</b>`).join(" or ")})` : ""}.${light}${land}`;
}
/** The almanac's page for the any-star levels: the bright stars of the night as the reckoning has them, by brightness. */
export function starTable(S) {
  const est = estPlace(S), jd = sceneJd(S), W = S.watch, rows = [];
  for (const s of STARS) {
    if (!s[8] || s[5] > 1.9) continue;
    const a = starAltAz(s, jd, est.lat, est.lon);
    if (a.alt < 8) continue;
    rows.push({ hr: s[0], name: starLabel(s), az: a.az, alt: a.alt, mag: s[5], target: (W.targets || []).includes(s[0]), done: (W.lops || []).includes(s[0]) });
  }
  return rows.sort((x, y) => x.mag - y.mag).slice(0, 16);
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

// ---------- a noon watch ----------

/** Ship's time of a Julian date at the estimate's longitude, as "HH:MM". */
const shipAt = (S, jd) => shipClock(jd, estPlace(S).lon);

/**
 * The task line of a noon watch in the sky: what the sun is doing and which sight is next, with the times the navigator can work out
 * from the almanac (noon by the reckoning, and when the falling sun should come back to the morning's altitude).
 */
export function sunTaskWords(S, cloud = false) {
  const st = sunStage(S), noon = shipAt(S, reckonedNoonJd(S)), W = S.watch.sun;
  const head = cloud ? "Cloud is over the sun. " : "";
  if (st === "morning") return `${head}The sun is climbing. Take its altitude now: the lower edge on the horizon. Noon by your reckoning is <b>${noon}</b>.`;
  if (st === "noon") return `${head}${W.m1 ? "The morning altitude is in the book. " : ""}Noon by your reckoning is <b>${noon}</b>. Wait for it, then take the sun's greatest height while it hangs.`;
  if (st === "afternoon") return `${head}The sun is falling. By the morning's drum it should come back to the horizon at about <b>${shipAt(S, expectedCatchJd(S))}</b>: call the moment its lower edge touches.`;
  return "All the sights of the sun are taken.";
}

/** The almanac's page for the sun: its declination, semi-diameter and equation of time, and noon by the reckoning. */
export function sunAlmanac(S) {
  const jd = sceneJd(S), sun = sunPlace(jd), est = estPlace(S), noon = reckonedNoonJd(S), at = sunPlace(noon);
  return {
    date: dateWords(S), dec: at.dec, sd: sunSemidiameter(noon), eot: at.eot * 3600, noonShip: shipAt(S, noon), noonGmt: fmtGmt(noon),
    catchShip: S.watch.sun?.m1 ? shipAt(S, expectedCatchJd(S)) : null, ship: shipClock(jd, est.lon), lon: est.lon, decNow: sun.dec,
  };
}
