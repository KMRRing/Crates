// Landfall's words (landfall-words.js): the numbers as a navigator writes them, the sight book, the log slate, the almanac's page and
// the endings. Pure, so a voyage is played to each place in Node and its words read back.
import { newVoyage, apply, sextantTruth, look, POLARIS, POLARIS_HR, estPlace } from "../landfall-engine.js";
import { fmtLat, fmtLon, fmtCourse, fmtHours, fmtNm, fmtSigned, fmtDM, starLabel, dateWords, watchWords, slate, slateLines, bookLines, revealWords, refusedWords, logRows, almanacPage, endWords, fogNS } from "../landfall-words.js";
import { play } from "../landfall-bots.js";
import { lopFindWords, steerHead, starTable } from "../landfall-words.js";
import { conditions, BY_HR } from "../landfall-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(fmtLat(54.8833) === "54° 53.0′ N" && fmtLat(-33.5) === "33° 30.0′ S" && fmtLat(10) === "10° 00.0′ N", "a latitude is degrees, minutes to a tenth and a hemisphere");
check(fmtLon(12.5667) === "12° 34′ E" && fmtLon(-170.0) === "170° 00′ W" && fmtLon(2.9999) === "3° 00′ E", "a longitude to the minute (and never 60 minutes)");
check(fmtCourse(95) === "095°" && fmtCourse(-5) === "355°" && fmtCourse(359.6) === "000°" && fmtCourse(0) === "000°", "a course in three figures, wrapped");
check(fmtHours(11.234) === "11.2 h" && fmtNm(4.26) === "4.3 nm" && fmtNm(62.4) === "62 nm" && fmtNm(-3) === "3.0 nm", "hours and miles");
check(fmtSigned(0.9) === "+0.9′" && fmtSigned(-4.1) === "−4.1′" && fmtSigned(0.01) === "±0.0′" && fmtDM(55 * 60 + 14.25) === "55° 14.3′" && fmtDM(7.2) === "0° 07.2′", "signed arcminutes and degrees-minutes");
check(starLabel(POLARIS) === "Polaris" && starLabel([1, "", "β Cas"]) === "β Cas" && starLabel([77, "", ""]) === "HR 77", "a star's name, else its letter, else its number");

// a voyage to the book
const S = newVoyage("first-watch", 21);
check(/^\d+ [A-Z][a-z]+ 1856$/.test(dateWords(S)) && watchWords(S) === `Watch 1 of ${S.watches}, dusk`, "the date and the watch");
{
  const s = slate(S), lines = slateLines(S);
  check(Math.abs(s.run - S.leg.run) < 1e-9 && Math.abs(Math.hypot(s.dLat, s.dep) - s.run) < 1e-6, "the slate's north and east add up to the log");
  check(Math.abs(s.dLon * s.cosMid - s.dep) < 1e-9 && s.cosMid < 0.9 && s.cosMid > 0.3, `...and a minute of longitude is only ${s.cosMid.toFixed(2)} nm at this latitude (the trap)`);
  check(lines.length === 3 && /minute of longitude/.test(lines[2]) && /Log \d/.test(lines[0]), "...in three lines of words");
}
apply(S, { t: "skip" }); apply(S, { t: "pick", hr: POLARIS_HR });
for (let i = 0; i < 40 && !look(S, POLARIS).visible; i++) apply(S, { t: "wait", min: 2 });
apply(S, { t: "raise" });
check(bookLines(S).length === 0, "no sight book before a reading");
apply(S, { t: "read", marks: [sextantTruth(S), sextantTruth(S) + 0.2, sextantTruth(S) - 0.2] });
{
  const rows = bookLines(S), lat = rows.find(r => r.key), est = estPlace(S);
  check(rows.length === 9 && rows[0].label === "Sextant, mean of 3" && rows.at(-1).label === "Difference", `the sight book has ${rows.length} lines, from the reading to the difference`);
  check(lat.value === fmtLat(S.watch.book.lat) && rows.find(r => r.label === "Dead reckoning").value === fmtLat(est.lat), "...the latitude is the reduction's and the reckoning is the estimate's");
  check(rows.every(r => !/NaN|undefined/.test(r.label + r.value)), "...and none of them is not a number");
}
apply(S, { t: "plot" });
{
  const w = revealWords(S);
  check(S.watch.plot.accepted && /^Latitude \d+° /.test(w) && /Polaris gives latitude only/.test(w), "a plotted sight is announced with its latitude and the east-west trap");
  check(fogNS(S.watch.plot.after.P) < fogNS(S.watch.plot.before.P), `...and the north-south fog goes from ${fmtNm(fogNS(S.watch.plot.before.P))} to ${fmtNm(fogNS(S.watch.plot.after.P))}`);
  check(logRows(S).length === S.trail.length && /Fixed/.test(logRows(S).at(-1).text) && /Left port/.test(logRows(S)[0].text), "the log has a line for each place in the track");
}
{
  const T = newVoyage("first-watch", 22);
  apply(T, { t: "skip" }); apply(T, { t: "pick", hr: POLARIS_HR });
  for (let i = 0; i < 40 && !look(T, POLARIS).visible; i++) apply(T, { t: "wait", min: 2 });
  apply(T, { t: "raise" }); apply(T, { t: "read", marks: [sextantTruth(T) + 120] }); apply(T, { t: "plot" });
  check(!T.watch.plot.accepted && /not plotted/.test(refusedWords(T)) && /nm (north|south) of the reckoning/.test(refusedWords(T)), "a sight two degrees out is refused, in words that say why and what to do");
}
// the almanac
{
  const A = almanacPage(S), top = Math.max(...A.rows.map(r => Math.abs(r.corr)));
  check(A.rows.length === 12 && A.pd > 1 && A.pd < 1.7 && Math.abs(top - A.pd * 60) < 3, `the almanac's page: Polaris ${A.pd.toFixed(2)}° from the pole, corrections up to ${top.toFixed(0)}′`);
  const near = A.rows.reduce((b, r) => (Math.abs(((r.lha - A.lha + 540) % 360) - 180) < Math.abs(((b.lha - A.lha + 540) % 360) - 180) ? r : b));
  check(Math.abs(near.corr - A.corr) < 25 && A.lha >= 0 && A.lha < 360, "...and the present moment lies between its rows");
  check(/^\d\d:\d\d$/.test(A.ship), "...with the ship's time");
}
// endings
for (const [bot, seed] of [["careful", 3], ["blind", 7], ["sloppy", 8], ["confused", 9]]) {
  const { S: R } = play("down-the-latitude", seed, bot), w = endWords(R);
  check(w && w.title && w.lines.length === 2 && w.lines.every(l => !/NaN|undefined/.test(l)) && ["arrived", "grounded", "missed"].includes(w.kind) && w.stars === R.end.stars, `${bot} (seed ${seed}): ${w.kind}, "${w.title}"`);
}
check(endWords(newVoyage("first-watch", 1)) === null, "a voyage under way has no ending");

// the noon watch's words
{
  const { fmtGmt, fmtSecs, fmtEW, sunTaskWords, sunAlmanac } = await import("../landfall-words.js");
  const { sceneJd, reckonedNoonJd, expectedCatchJd } = await import("../landfall-engine.js");
  const N = newVoyage("noon-sight", 3);
  check(watchWords(N) === `Watch 1 of ${N.watches}, noon`, "a noon watch is named for the sun");
  check(fmtGmt(2451545.0) === "12:00:00" && fmtSecs(125) === "+0:02:05" && /east$/.test(fmtEW(3)) && /west$/.test(fmtEW(-3)), "a time of day, a count of seconds, east and west");
  apply(N, { t: "skip" });
  check(!/NaN|undefined/.test(sunTaskWords(N)) && !/NaN|undefined/.test(sunTaskWords(N, true)) && !/NaN|undefined/.test(sunAlmanac(N).toString()), "the sun's task line and almanac page are written without a gap");
  const take = () => { for (let i = 0; i < 40 && !apply(N, { t: "raise" }).ok; i++) apply(N, { t: "wait", min: 1 }); apply(N, { t: "read", marks: [sextantTruth(N)] }); };
  const until = jd => { for (let i = 0; i < 400 && sceneJd(N) < jd; i++) apply(N, { t: "wait", min: 1 }); };
  take(); until(reckonedNoonJd(N) - 3 / 1440); take(); until(expectedCatchJd(N) - 8 / 1440);
  apply(N, { t: "raise" });
  for (let i = 0; i < 400 && sextantTruth(N) > N.watch.sun.m1.hs; i++) apply(N, { t: "wait", min: 0.05 });
  apply(N, { t: "read", marks: [] });
  const rows = bookLines(N);
  check(rows.length >= 12 && rows.length <= 16 && rows.every(r => r.label && r.value && !/NaN|undefined/.test(r.label + r.value)), `the sun's sight book is ${rows.length} rows with no gaps`);
  check(rows.filter(r => r.key).length === 2 && /Latitude/.test(rows.find(r => r.key).label), "...with the latitude and the longitude picked out");
  apply(N, { t: "plot" });
  const rv = revealWords(N);
  check(!/NaN|undefined/.test(JSON.stringify(rv)) && JSON.stringify(rv).length < 700, "the reveal of a sun fix is short and whole");
}

{
  // an any-star watch: the sight book, the words before and after, the star table
  const T = newVoyage("two-lines-cross", 5);
  apply(T, { t: "skip" });
  check(/^Sight 1 of 2: tap a bright star \(try <b>\w+<\/b> or <b>\w+<\/b>\)\.$/.test(lopFindWords(T, 1)) && !lopFindWords(T, 4).includes("try"), "before a star the words count the sights and, with help, suggest two");
  const hr = T.watch.targets[0];
  apply(T, { t: "pick", hr });
  for (let i = 0; i < 60 && !(look(T, BY_HR.get(hr)).visible && conditions(T).sun < -6); i++) apply(T, { t: "wait", min: 2 });
  apply(T, { t: "raise" }); apply(T, { t: "read", marks: [sextantTruth(T)] });
  const rows = bookLines(T), key = rows.find(r => r.key);
  check(rows.length === 8 && /Intercept/.test(key.label) && /toward|away from/.test(key.value) && rows.every(r => !/NaN|undefined/.test(r.label + r.value)), "the sight book of a star ends in the intercept, toward or away from it");
  apply(T, { t: "plot" });
  check(/^Sight 2 of 2: one more, standing apart/.test(lopFindWords(T, 4)) && !/NaN|undefined/.test(revealWords(T)) && /fix/i.test(revealWords(T)), "after the first line the words ask for another, and the reveal says what the line did");
  check(!/NaN|undefined/.test(steerHead(T)) && starTable(T).length >= 8 && starTable(T).every(r => r.mag <= 1.9 && r.alt >= 8) && starTable(T).some(r => r.done), "the star table lists the bright stars up, and marks the one taken");
  const U = newVoyage("two-lines-cross", 5); apply(U, { t: "skip" }); apply(U, { t: "pick", hr: U.watch.targets[0] });
  for (let i = 0; i < 60 && !(look(U, BY_HR.get(U.watch.targets[0])).visible && conditions(U).sun < -6); i++) apply(U, { t: "wait", min: 2 });
  apply(U, { t: "raise" }); apply(U, { t: "read", marks: [sextantTruth(U) + 40] }); apply(U, { t: "plot" });
  check(/not plotted/.test(refusedWords(U)) && /toward|away from/.test(refusedWords(U)), "a line far from the reckoning is refused in words that name the star");
}

if (bad) { console.log(`${bad} problems`); process.exitCode = 1; }
else console.log("landfall-words: formats, the slate, the sight book, the almanac and the endings");
