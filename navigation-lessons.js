// The Navigation course: celestial navigation and the sea, taught from nothing, on the course's sheet (course.js) with a stage of its
// own (navigation-stage.js). Each step is words over an instrument (`inst`), and either a plain look, a choice (quiz, answer, why),
// or a task the instrument judges (goal). Every number the words quote is worked out here by the same functions the instruments use
// (navigation-math.js and Landfall's sky), so the words cannot disagree with the picture; tests/navigation.mjs checks them again.
//
// A step: { inst, say, alt (what the picture is, for a screen reader), ...the instrument's own fields, goal?, quiz?, answer?, why? }.
import { sunPlace, julianDate, observedAltitude, dip, latitudeFromMeridian, refraction } from "./landfall-sky.js";
import { greatCircle, rhumb, milesPerDegLon, magneticOf, pointName, knotSpacingFt, clockErrorMiles, altText, dms, hhmm, TIDE_HOURS } from "./navigation-math.js";
import { seen, star } from "./navigation-sky.js";

const nm = n => `${Math.round(n).toLocaleString("en")} nm`;
const PORTS = [
  { name: "Hamburg", lat: 53.55, lon: 9.99, left: true }, { name: "Lübeck", lat: 53.867, lon: 10.683 }, { name: "Visby", lat: 57.64, lon: 18.3 },
  { name: "Danzig", lat: 54.35, lon: 18.65 }, { name: "Bergen", lat: 60.39, lon: 5.32 },
];
const BALTIC = { la0: 52, la1: 58, lo0: 5, lo1: 21 };

// ---------- numbers the words quote ----------
/** The noon sun on a date: its declination and, from a latitude (north of it), the altitude of its centre at noon. */
export function noonSun(y, m, d, lat) {
  const dec = sunPlace(julianDate(y, m, d, 12)).dec;
  return { dec, ho: 90 - Math.abs(lat - dec) };
}
const SUN = noonSun(2026, 10, 26, 49);
const DEC_ROUND = Math.round(SUN.dec * 10) / 10, HO_ROUND = Math.round(SUN.ho * 10) / 10;
export const NOON = { dec: DEC_ROUND, ho: HO_ROUND, lat: Math.round(latitudeFromMeridian(HO_ROUND, DEC_ROUND, true)) };
const HS = 41 + 17 / 60, EYE = 4;
const HO = observedAltitude(HS, EYE);
const SOUTHAMPTON = { name: "Southampton", lat: 50.9, lon: -1.4 }, NEWYORK = { name: "New York", lat: 40.5, lon: -74 };
export const ROUTE = { rh: rhumb(SOUTHAMPTON.lat, SOUTHAMPTON.lon, NEWYORK.lat, NEWYORK.lon), gc: greatCircle(SOUTHAMPTON.lat, SOUTHAMPTON.lon, NEWYORK.lat, NEWYORK.lon) };
const POLARIS_SKY = { lat: 56, lon: 8, when: [2026, 10, 20, 21] };
const POLARIS_ALT = seen(POLARIS_SKY, star("Polaris")).alt;
const FIX = { dec: -13, ho: 33, g: 15 + 20 / 60 };
const lonStrip = [-60, 10];
const dm = (deg) => altText(deg).replace(/^(\d+)° /, "$1° ");

/** A multiple-choice step: the options, the right one named by its place in the list as written, then put at a place that cycles 0, 1, 2 so the
 *  right answer is never in the same seat twice running (the order the lessons are written in is the order they are shown in). */
let seat = 0;
const pick = (opts, right) => {
  const want = seat++ % 3, out = opts.filter((_, i) => i !== right);
  out.splice(want, 0, opts[right]);
  return { quiz: out, answer: want };
};

export const COURSE = {
  title: "Navigation and the night sky", zh: "",
  chapters: [
    {
      id: "chart", title: "On the chart", zh: "",
      lessons: [
        {
          id: "latlon", title: "Latitude and longitude", zh: "",
          steps: [
            { inst: "chart", proj: "plate", win: BALTIC, grid: 2, marks: PORTS, showMarks: true, desc: "A chart of the Baltic with the ports of the Hanse marked", say: "Latitude is how far north or south of the equator you are, 0° to 90°; longitude how far east or west of Greenwich, 0° to 180°. A chart is a net of both. These are ports of the Hanse, the league of north German merchant towns that ran the trade of the North Sea and the Baltic from the 1200s." },
            { inst: "chart", proj: "plate", win: BALTIC, grid: 2, marks: PORTS, desc: "A chart of the Baltic with its graticule", goal: { lat: 53.867, lon: 10.683, tolLat: 0.5, tolLon: 0.8, msg: "Right: 53° 52′ N, 10° 41′ E is Lübeck, the Hanse's head." }, check: "Mark it", say: "Mark 53° 52′ N, 10° 41′ E. Read latitude up the left edge and longitude along the foot; drag the cross where they meet." },
            { inst: "chart", proj: "plate", win: BALTIC, grid: 2, marks: PORTS, showMarks: true, desc: "The same chart", ...pick(["60 nm", "30 nm", "90 nm"], 0), say: "How many nautical miles are there in a degree of latitude?", why: "60. A minute of latitude is one nautical mile, 1,852 metres: that is how the mile was made. Distance north and south can be read straight off the edge of any chart." },
            { inst: "chart", proj: "plate", win: BALTIC, grid: 2, marks: PORTS, showMarks: true, desc: "The same chart", ...pick(["60 nm", "18 nm", `${Math.round(milesPerDegLon(53.867))} nm`], 2), say: "Meridians (lines of longitude) meet at the poles. How wide is a degree of longitude at Lübeck's latitude, 53.9° N?", why: `${milesPerDegLon(53.867).toFixed(1)} nm: it is 60 at the equator and shrinks by the cosine of the latitude. That is why the chart above is narrower than it is tall.` },
          ],
        },
        {
          id: "mile", title: "The knot and the log", zh: "",
          steps: [
            { inst: "log", speed: 6, desc: "A log line paid out astern, a knot marked every 47 feet 3 inches", say: `A knot is one nautical mile an hour. To measure it the sailor streamed a log, a wooden chip on a line, and counted the knots in the line that ran out while a 28-second sand glass emptied. The knots lie ${Math.floor(knotSpacingFt())} ft ${Math.round((knotSpacingFt() % 1) * 12)} in apart: that is the same fraction of a mile as 28 seconds is of an hour. Slide the speed.` },
            { inst: "log", speed: 7, desc: "The log line at seven knots", ...pick(["56 nm", "11 nm", "28 nm"], 2), say: "She runs out 7 knots in the glass and holds that speed for 4 hours. How far has she gone?", why: "28 nautical miles: 7 knots is 7 miles every hour." },
            { inst: "log", speed: 4, desc: "The log line", ...pick(["the chronometer", "the log", "the lead line"], 2), say: "The Hanse's cogs kept near the coasts, and found where they were by a lead weight on a line, its foot coated in tallow. What did the lead tell them?", why: "How deep the water was, and from what stuck to the tallow, the bottom: sand, mud or shell. On a known coast that was a position. The log gives distance run, not depth." },
          ],
        },
        {
          id: "compass", title: "The compass card", zh: "",
          steps: [
            { inst: "rose", snapPoints: true, start: 0, desc: "A compass card with 32 points and a needle", say: "The compass card has 32 points, each 11¼° wide: the four cardinal points, four between them, and the rest named 'by' one of them, such as north by east. Drag the needle round." },
            { inst: "rose", snapPoints: true, start: 0, desc: "A compass card", goal: { deg: 236.25, tol: 3, msg: `Right: ${pointName(236.25)}, 236¼°.` }, check: "That one", say: "Set the needle to south-west by west." },
            { inst: "rose", variation: -10, start: 90, desc: "A compass card with magnetic north marked ten degrees west of true north", say: "A compass points to magnetic north, not true north. The difference is the variation; it differs from place to place, changes slowly with the years, and the chart prints it. Here magnetic north lies 10° west of true. Turn the needle: the card reads both." },
            { inst: "rose", variation: -10, start: 90, desc: "The same card", ...pick(["080°", "090°", `${String(Math.round(magneticOf(90, -10))).padStart(3, "0")}°`], 2), say: "You want to steer true east, 090°, with 10° of westerly variation. What does the compass show?", why: "100°. Magnetic north is 10° west, so every true bearing measures 10° more from it. To go from true to magnetic add westerly variation and subtract easterly." },
          ],
        },
        {
          id: "dr", title: "Dead reckoning", zh: "",
          steps: [
            { inst: "plot", play: { k: 6, h: 2, start: 60 }, desc: "A plot with a ship at its start and a course line", say: "Dead reckoning is working out where you are from where you were, with the course steered, the speed from the log and the time from the glass. Six knots for 2 hours is 12 miles; the course says which way. Drag the line round the ship, and read how far north and east it takes her." },
            { inst: "plot", legs: [{ c: 90, k: 6, h: 3 }], goal: { tol: 2 }, desc: "A plot with one leg east", check: "Mark her", say: "She steers due east, 090°, at 6 knots for 3 hours. Tap where she is." },
            { inst: "plot", legs: [{ c: 60, k: 6, h: 2 }, { c: 150, k: 5, h: 3 }], goal: { tol: 2 }, desc: "A plot with two legs", check: "Mark her", say: "Two legs: 060° at 6 knots for 2 hours, then 150° at 5 knots for 3 hours. Tap where she ends." },
            { inst: "plot", legs: [{ c: 60, k: 6, h: 2 }, { c: 150, k: 5, h: 3 }], desc: "The same plot", ...pick(["Nobody could measure longitude, so no one knew when to turn", "The compass points the wrong way in the southern ocean", "Latitude cannot be found south of the equator"], 0), say: "In 1611 Hendrik Brouwer showed the Dutch East India Company (the VOC, founded 1602) a fast road to Java: run east before the westerly winds of the southern ocean, then turn north. Why was that dangerous with dead reckoning alone?", why: "Each leg's error, from the log, the compass and the sea, adds to the last, and east–west distance had no check at all. Ships ran on too far, or turned too soon. A latitude can be corrected by a sight; a longitude, until the chronometer, could not." },
          ],
        },
        {
          id: "drift", title: "Set and drift", zh: "",
          steps: [
            { inst: "plot", legs: [{ c: 90, k: 5, h: 4 }], cur: { set: 0, k: 2 }, showCur: true, desc: "A plot: a ship steering east, a current setting her north", say: "A current carries the ship as it carries the water. Its direction (the way it flows toward) is the set, its speed the drift. She steers east at 5 knots for 4 hours, 20 miles; a 2-knot current sets north for the same 4 hours, 8 miles. The ring is where her own way would put her; the dot is where she is." },
            { inst: "plot", legs: [{ c: 45, k: 6, h: 3 }], cur: { set: 270, k: 1.5 }, goal: { tol: 2 }, desc: "A plot with a current setting west", check: "Mark her", say: "She steers 045° at 6 knots for 3 hours. A current of 1½ knots sets west (270°) all that time. Tap where she is." },
          ],
        },
        {
          id: "merc", title: "Mercator, rhumb and great circle", zh: "",
          steps: [
            { inst: "chart", proj: "merc", win: { la0: 34, la1: 58, lo0: -80, lo1: 0 }, grid: 10, route: { a: SOUTHAMPTON, b: NEWYORK }, desc: "A Mercator chart with two routes from Southampton to New York", say: `Gerardus Mercator's chart (1569) makes a constant compass course, a rhumb line, a straight line, by stretching north–south as you go toward the pole. The shortest way is a great circle, a slice through the earth's centre; on this chart it bows toward the pole. Southampton to New York: rhumb ${nm(ROUTE.rh.nm)}, great circle ${nm(ROUTE.gc.nm)}. Show each.` },
            { inst: "chart", proj: "merc", win: { la0: 34, la1: 58, lo0: -80, lo1: 0 }, grid: 10, route: { a: SOUTHAMPTON, b: NEWYORK }, desc: "The same chart", ...pick(["a great circle", "the shortest way", "a line of constant course"], 2), say: "On a Mercator chart a straight line is…", why: "A line of constant course, a rhumb line: it crosses every meridian at the same angle, so you can steer it by one compass setting. That, and not distance, was Mercator's point. Edward Wright worked out the mathematics in 1599." },
            { inst: "chart", proj: "merc", win: { la0: 34, la1: 58, lo0: -80, lo1: 0 }, grid: 10, route: { a: SOUTHAMPTON, b: NEWYORK }, desc: "The same chart", ...pick(["half as long", "the same length as at the equator", "twice as long as at the equator"], 2), say: "A degree of latitude is 60 nm everywhere. On a Mercator chart, at 60° N it is drawn…", why: "Twice as long: the scale grows as the secant of the latitude, 2 at 60°. So you measure distance on the latitude scale beside the part of the chart you are in, never on one scale for the whole chart." },
          ],
        },
      ],
    },
    {
      id: "sky", title: "The night sky", zh: "",
      lessons: [
        {
          id: "turn", title: "The sky turns", zh: "",
          steps: [
            { inst: "sky", lat: 56, lon: 8, when: [2026, 11, 15, 19], az: 0, alt: 45, fov: 62, look: "Looking north, 56° N", figs: ["Plough", "UMi", "Cas"], names: ["Polaris"], time: true, say: "Look north from 56° N. The whole sky wheels about one point, the celestial pole, once in a day: 360° in 23 h 56 min, or 15° an hour. Drag the time slider and watch the Plough and Cassiopeia go round the pole star, Polaris. The stars are Landfall's real catalogue." },
            { inst: "sky", lat: 56, lon: 8, when: [2026, 11, 15, 19], az: 0, alt: 45, fov: 62, look: "Looking north, 56° N", figs: ["Plough", "UMi", "Cas"], names: ["Polaris"], time: true, ...pick(["90°", "15°", "60°"], 2), say: "How far do the stars turn about Polaris in four hours?", why: "60°: 15° an hour. The same 15° an hour that turns the clock into a longitude, two lessons from the end of this course." },
            { inst: "sky", lat: 56, lon: 8, when: [2026, 11, 15, 19], az: 0, alt: 45, fov: 62, look: "Looking north, 56° N", figs: ["Plough", "UMi", "Cas"], names: ["Polaris"], time: true, ...pick(["Clockwise", "Counter-clockwise", "They do not turn"], 1), say: "Looking north, which way do the stars turn about Polaris?", why: "Counter-clockwise. Stars rise in the east (to the right when you face north) and set in the west (left), so those above the pole move left." },
          ],
        },
        {
          id: "polaris", title: "Polaris", zh: "",
          steps: [
            { inst: "sky", lat: 56, lon: 8, when: [2026, 3, 20, 22], az: 0, alt: 55, fov: 58, look: "Looking north, 56° N", figs: ["Plough", "UMi"], names: ["Merak", "Dubhe"], hop: { from: "Merak", through: "Dubhe", times: 6 }, goal: { star: "Polaris", msg: "Right: Polaris, five times the pointers' gap on." }, say: "Polaris, the pole star, stands almost on the north celestial pole, the point the sky turns about. To find it, take the two stars at the end of the Plough's bowl, Merak and Dubhe, the Pointers, and carry their gap about five times on past Dubhe. Tap Polaris." },
            { inst: "sky", lat: 56, lon: 8, when: POLARIS_SKY.when, az: 0, alt: 50, fov: 58, look: "Looking north, 56° N", figs: ["Cas", "UMi"], names: ["Schedar", "Caph"], goal: { star: "Polaris", msg: "Right: Polaris, across the pole from the Plough." }, say: "The Plough is not always up. Cassiopeia, the W, keeps to the other side of the pole. Tap Polaris." },
            { inst: "alt", body: "star", target: POLARIS_ALT, tol: 1.5, desc: "A mariner's astrolabe with Polaris in sight", start: 20, goal: { alt: POLARIS_ALT }, check: "Read it", note: "Polaris", say: "Measure it. Bring the astrolabe's alidade into line with Polaris and read the altitude.", then: `Right: ${altText(POLARIS_ALT)}.` },
            { inst: "alt", body: "star", target: POLARIS_ALT, tol: 1.5, desc: "The astrolabe", start: POLARIS_ALT, note: "Polaris", ...pick(["90° N", "34° N", "56° N"], 2), say: `Polaris is ${altText(POLARIS_ALT)} above the horizon. Your latitude is about…`, why: "56° N. Polaris is within a degree of the pole, and the pole stands as high above your horizon as your latitude. (A small almanac correction, under a degree, trims it.) It stands due north wherever you are, so it says nothing of east and west." },
          ],
        },
        {
          id: "orion", title: "Orion and the winter sky", zh: "",
          steps: [
            { inst: "sky", lat: 45, lon: 0, when: [2026, 1, 15, 21], az: 163, alt: 42, fov: 33, look: "Looking south, 45° N", figs: ["Ori"], names: ["Betelgeuse", "Rigel", "Mintaka", "Alnitak"], say: "Orion the hunter is the easiest sign of the winter sky: three bright stars in a short line make his belt (Mintaka, Alnilam, Alnitak), with red Betelgeuse at one shoulder and blue-white Rigel at a foot." },
            { inst: "sky", lat: 45, lon: 0, when: [2026, 1, 15, 21], az: 163, alt: 42, fov: 33, look: "Looking south, 45° N", figs: ["Ori"], names: ["Mintaka", "Alnitak"], hop: { from: "Mintaka", through: "Alnitak", times: 9 }, goal: { star: "Sirius", msg: "Right: Sirius, the brightest star in the night sky." }, say: "Follow the line of the belt down and to the east (left, facing south) and it leads to the brightest star in the night sky. Tap it." },
            { inst: "sky", lat: 45, lon: 0, when: [2026, 1, 15, 21], az: 163, alt: 42, fov: 33, look: "Looking south, 45° N", figs: ["Ori"], names: ["Mintaka", "Alnitak"], goal: { star: "Aldebaran", msg: "Right: Aldebaran, the red eye of the bull." }, say: "The belt points the other way too, up and to the west, roughly at the red eye of the Bull. Tap Aldebaran." },
            { inst: "sky", lat: 45, lon: 0, when: [2026, 1, 15, 21], az: 163, alt: 42, fov: 33, look: "Looking south, 45° N", figs: ["Ori"], names: ["Rigel", "Betelgeuse", "Sirius"], ...pick(["Polaris", "Rigel", "Sirius"], 2), say: "Which of these is the brightest star in the whole night sky?", why: "Sirius, magnitude −1.5 (the lower the number, the brighter): twice as bright again as Canopus, the next, which sailors in the south knew well." },
          ],
        },
        {
          id: "cross", title: "The Southern Cross", zh: "",
          steps: [
            { inst: "sky", lat: -30, lon: 0, when: [2026, 5, 20, 21], az: 180, alt: 40, fov: 42, look: "Looking south, 30° S", figs: ["Cru", "Cen"], names: ["Acrux", "Gacrux", "Hadar", "Rigil Kentaurus"], hop: { from: "Gacrux", through: "Acrux", times: 5.5 }, mark: { az: 180, alt: 30, label: "S pole" }, say: "South of the equator Polaris is gone below the horizon, and there is no bright star at the south celestial pole. Sailors used the Southern Cross: carry its long axis, Gacrux to Acrux, four and a half times its own length on, and you are at the pole. The two Pointers, Hadar and Rigil Kentaurus, lead you to the Cross." },
            { inst: "sky", lat: -30, lon: 0, when: [2026, 5, 20, 21], az: 180, alt: 40, fov: 42, look: "Looking south, 30° S", figs: ["Cru", "Cen"], names: ["Acrux", "Gacrux"], goal: { point: { az: 180, alt: 30 }, tol: 5, msg: "Right: the south celestial pole, 30° above the horizon at 30° S." }, say: "Tap the south celestial pole." },
            { inst: "sky", lat: -30, lon: 0, when: [2026, 5, 20, 21], az: 180, alt: 40, fov: 42, look: "Looking south, 30° S", figs: ["Cru", "Cen"], names: ["Acrux", "Gacrux"], mark: { az: 180, alt: 30, label: "S pole" }, ...pick(["30°", "60°", "90°"], 0), say: "At 30° S, how high is the south celestial pole above the horizon?", why: "30°: the pole stands as high as your latitude, north or south. That is the rule that makes a latitude out of a pole star." },
          ],
        },
      ],
    },
    {
      id: "sight", title: "Taking a sight", zh: "",
      lessons: [
        {
          id: "astrolabe", title: "The astrolabe", zh: "",
          steps: [
            { inst: "alt", body: "star", target: 38, start: 12, desc: "A mariner's astrolabe and a star above the horizon", say: "The mariner's astrolabe is a heavy open brass ring hung from the thumb, with a sighting arm, the alidade, turning on its centre. Hang it plumb, swing the arm until the star shows through both sighting vanes, and read the altitude (the angle above the horizon) on the ring. Portuguese pilots used it at sea in the late 1400s. Drag the alidade." },
            { inst: "alt", body: "star", target: 52, tol: 1.5, start: 12, goal: { alt: 52 }, check: "Read it", desc: "An astrolabe with a star", say: "Bring the alidade onto the star and read it. It is good to a degree at best, on a moving deck.", then: "Right: 52°." },
            { inst: "alt", body: "sun", target: 33, tol: 1.5, start: 12, goal: { alt: 33 }, check: "Read it", desc: "An astrolabe with the sun", say: "You cannot look at the sun. Turn the ring until its light shines through the hole in the upper vane onto the lower. Set the alidade on the sun.", then: "Right: 33°." },
            { inst: "alt", body: "star", target: 38, start: 38, desc: "The astrolabe", ...pick(["600 nm", "6 nm", "60 nm"], 2), say: "Your astrolabe has an error of 1°. How far out in latitude is that?", why: "60 nautical miles: a degree of altitude is a degree of latitude. A sextant, read to a minute of arc, brought it down to one mile." },
          ],
        },
        {
          id: "sextant", title: "The sextant", zh: "",
          steps: [
            { inst: "sext", target: 41 + 17 / 60, start: 20, desc: "A sextant with its index arm and the eyepiece view", say: "John Hadley's octant of 1730 and the sextant that followed (from 1757) measure an angle with two mirrors: you see the horizon straight through the clear half of the horizon glass, and the star, reflected twice, in the silvered half. Move the index arm until the star rests on the horizon, and read the arc. Drag the arm, then the drum below for the tenths." },
            { inst: "sext", target: 41 + 17 / 60, start: 20, desc: "A sextant", ...pick(["Turning a mirror by a degree turns the ray it reflects by two", "The scale is printed in half-degrees so it can be read finer", "The horizon glass adds 60° to every reading"], 0), say: "A sextant's frame is a sixth of a circle, 60°, yet it measures up to 120°. Why?", why: "A mirror that turns by an angle turns the ray it reflects by twice as much, so a 60° arc is marked up to 120°. That is also why an angle can be read to a minute on a hand-held frame." },
            { inst: "sext", target: 38 + 25 / 60, start: 20, tol: 0.15, goal: { reading: 38 + 25 / 60 }, check: "Read it", desc: "A sextant with a star above the horizon", say: "Bring the star down to the horizon: the arm to near it, then the drum. When it sits on the line, check.", then: "Right: the arc reads 38° 25.0′." },
            { inst: "sext", target: 62 + 39 / 60, start: 40, tol: 0.15, goal: { reading: 62 + 39 / 60 }, check: "Read it", desc: "A sextant with a high star", say: "Another star, higher.", then: "Right: the arc reads 62° 39.0′." },
          ],
        },
        {
          id: "corrections", title: "Dip and refraction", zh: "",
          steps: [
            { inst: "corr", hs: HS, eye: EYE, desc: "The corrections table: sextant reading, dip, refraction, observed altitude", say: "The sextant measures from the sea horizon, but the altitude you want is above the true, level horizon. Two small corrections, both subtracted. Dip: your eye is above the sea, so the visible horizon lies below level (1.76′ × √(eye height in metres)). Refraction: the air bends the star's light, so it looks higher (about 1′ at 45°, about 10′ at 5°). Drag the sliders." },
            { inst: "corr", hs: HS, eye: EYE, fixed: true, desc: "The corrections table", ...pick(["7.0′", "1.8′", `${dip(EYE).toFixed(1)}′`], 2), say: "The sextant reads 41° 17.0′ and your eye is 4 m above the sea. What is the dip?", why: "1.76 × √4 = 3.5′. Higher eye, lower horizon: from a mast at 16 m it would be 7.0′." },
            { inst: "corr", hs: HS, eye: EYE, fixed: true, desc: "The corrections table", ...pick([dm(HS - dip(EYE) / 60), dm(HO), dm(HS + dip(EYE) / 60 - 1 / 60)], 1), say: "The sextant reads 41° 17.0′, eye 4 m. What is the observed altitude, Ho?", why: `${dm(HS)} − ${dip(EYE).toFixed(1)}′ dip = ${dm(HS - dip(EYE) / 60)} apparent; − ${refraction(HS - dip(EYE) / 60).toFixed(1)}′ refraction = ${dm(HO)}. Forgetting refraction leaves ${dm(HS - dip(EYE) / 60)}; dip is never added.` },
          ],
        },
        {
          id: "noon", title: "Latitude from the noon sun", zh: "",
          steps: [
            { inst: "alt", body: "sun", target: NOON.ho, start: 15, desc: "An astrolabe with the noon sun", say: `At local noon the sun is at its highest, due south of you in the northern hemisphere. Its altitude then, Ho, gives your latitude: latitude = 90° − Ho + declination. Declination is the latitude the sun is directly over, from the almanac, south being negative. On 26 October it is ${dms(Math.abs(NOON.dec), NOON.dec < 0 ? "S" : "N", "S")}. Hold the sun in the sights.` },
            { inst: "alt", body: "sun", target: NOON.ho, tol: 1.5, start: 15, goal: { alt: NOON.ho }, check: "Read it", desc: "An astrolabe with the noon sun", say: "Set the alidade on the noon sun and read its altitude.", then: `Right: ${altText(NOON.ho)}.` },
            { inst: "alt", body: "sun", target: NOON.ho, start: NOON.ho, desc: "The noon sun", ...pick([`${Math.round(90 - NOON.ho)}° N`, `${NOON.lat}° N`, `${Math.round(90 - NOON.ho - NOON.dec)}° N`], 1), say: `On 26 October the sun's declination is ${Math.abs(NOON.dec)}° S. At noon you measure Ho = ${altText(NOON.ho)}, the sun due south. Your latitude is…`, why: `90° − ${NOON.ho}° = ${Math.round((90 - NOON.ho) * 10) / 10}° from the sun's overhead point; the sun is ${Math.abs(NOON.dec)}° south of the equator and you are north of it, so add: ${Math.round((90 - NOON.ho) * 10) / 10}° − ${Math.abs(NOON.dec)}° = ${NOON.lat}° N.` },
          ],
        },
      ],
    },
    {
      id: "time", title: "Time and tide", zh: "",
      lessons: [
        {
          id: "clock", title: "Longitude is time", zh: "",
          steps: [
            { inst: "clock", range: lonStrip, g: 12, desc: "A chronometer and a strip of longitudes", say: "The earth turns 15° an hour, so 1° of longitude is 4 minutes of time. The sun is highest at your local noon. If a clock kept at Greenwich time reads 14:20 at that moment, your noon came 2 h 20 min after Greenwich's: you are 35° west. A chronometer is the clock that keeps Greenwich time at sea. Drag its reading." },
            { inst: "clock", range: lonStrip, g: 14 + 20 / 60, goal: { lon: -35, tol: 3, msg: "Right: 35° W." }, check: "Mark the ship", desc: "A chronometer reading 14:20 and a strip of longitudes", say: "The sun is on your meridian, local noon, and the chronometer reads 14:20. Tap the strip where the ship is." },
            { inst: "clock", range: [10, 60], g: 9 + 40 / 60, desc: "A chronometer reading 09:40", ...pick(["145° E", "35° W", "35° E"], 2), say: "At local noon the chronometer reads 09:40. Where are you?", why: "Your noon came 2 h 20 min before Greenwich's, so you are east of it: 2 h 20 min × 15° = 35° E. Early noon, east; late noon, west." },
          ],
        },
        {
          id: "rate", title: "A clock's error in miles", zh: "",
          steps: [
            { inst: "clockerr", err: 120, lat: 0, desc: "A clock's error shown as a distance", say: "A second of time is 15 seconds of arc, a quarter of a nautical mile at the equator: 4 seconds is a mile. Toward the poles meridians draw together, so the mile shrinks by cos(latitude). The British Longitude Act of 1714 offered up to £20,000 for a method good to half a degree: two minutes of time, 30 miles at the equator. Drag the error and the latitude." },
            { inst: "clockerr", err: 120, lat: 60, fixed: true, desc: "A clock's error", ...pick(["7.5 nm", "30 nm", `${Math.round(clockErrorMiles(120, 60) * 10) / 10} nm`], 2), say: "The chronometer is 2 minutes wrong, and you are at 60° N. How many miles out in longitude?", why: "30 nm at the equator × cos 60° = 15 nm." },
            { inst: "clockerr", err: 60, lat: 0, desc: "A clock's error", ...pick(["60 nm", "3 nm", "15 nm"], 2), say: "A chronometer never keeps perfect time, but it keeps a steady rate. Yours gains 3 seconds a day, and was last set 20 days ago. If you ignore the rate, how far out are you in longitude at the equator?", why: "20 × 3 s = 60 s = 15 nm. So navigators logged a chronometer's rate and corrected for it, and checked it against the stars or a known port." },
            { inst: "clockerr", err: 5, lat: 0, desc: "A clock's error", ...pick(["1¼ nm", "5 nm", "12½ nm"], 0), say: "In 1761–62 John Harrison's fourth timekeeper, H4, was five seconds out after nine weeks at sea on the way to Jamaica. How many miles at the equator is that? (Captain Cook took a copy of it, K1, on his second voyage, 1772–75.)", why: "5 s × ¼ nm = 1¼ nm: well inside the Act's 30. It took until the 1760s, and decades more to make them cheap." },
          ],
        },
        {
          id: "tides", title: "The moon and the tide", zh: "",
          steps: [
            { inst: "tide", age: 3, desc: "The moon's phase and a day's tides", say: `The moon's pull raises two tides a lunar day, 24 h 50 min, about 12 h 25 min apart (Newton explained it in 1687). When sun and moon pull along one line, at new and full moon, tides are largest: springs. At the quarters they pull across each other: neaps. (On the Baltic, at Lübeck, the tide is hardly there; at Hamburg on the Elbe it is felt.) Slide the moon's age.` },
            { inst: "tide", age: 3, goal: { springs: true, msg: "Right: a new or full moon. The tide's range is greatest." }, check: "This day", desc: "The moon's phase and a day's tides", say: "Set the moon to a day of spring tides.", },
            { inst: "tide", age: 12, desc: "The moon and the tide", ...pick(["12:00", "18:00", `${hhmm(6 + TIDE_HOURS)}`], 2), say: "High water is at 06:00. When is the next?", why: "About 18:25: the tide comes every 12 h 25 min, not 12 hours." },
            { inst: "tide", age: 12, desc: "The moon and the tide", ...pick(["about 12 hours later", "at the same time", "about 50 minutes later"], 2), say: "Tomorrow, high water in the morning comes…", why: "About 50 minutes later: the moon comes round 50 minutes later each day, and the tide follows it." },
          ],
        },
        {
          id: "fix", title: "A noon fix", zh: "",
          steps: [
            { inst: "chart", proj: "plate", win: { la0: 38, la1: 50, lo0: -60, lo1: -40 }, grid: 2, gridLon: 4, goal: { lat: 44, lon: -50, tolLat: 1, tolLon: 2, msg: "Right: 44° N, 50° W." }, check: "Mark the fix", desc: "A chart of the open Atlantic", say: `Put it together. At local noon the sun's declination is 13° S and you measure Ho = ${altText(FIX.ho)}, the sun due south. The chronometer then reads 15:20 Greenwich time. Work out the latitude (90° − Ho + declination) and the longitude (15° × the difference in time) and mark the fix.` },
            { inst: "chart", proj: "plate", win: { la0: 38, la1: 50, lo0: -60, lo1: -40 }, grid: 2, gridLon: 4, desc: "A chart of the open Atlantic", ...pick(["Polaris", "the sun's noon altitude", "the chronometer"], 2), say: "That is a fix: a latitude from the sun, a longitude from the clock. The East India Company (chartered 1600) and the VOC ran their fleets on the first and a guess for the second. Which gave the longitude?", why: "The chronometer, set against the sun's noon. The altitude gives only latitude; so does Polaris." },
          ],
        },
      ],
    },
  ],
};
export const FACTS = { SUN, HO, HS, EYE, POLARIS_ALT, POLARIS_SKY, FIX, ROUTE, DEC_ROUND };
