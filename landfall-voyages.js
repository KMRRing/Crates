// Sections 3 to 9 of Landfall: any star, by the intercept (landfall-levels.js has sections 1 and 2). Pure data.
//
// A level with `lop: n` takes n stars a watch, each a line of position: the almanac gives where the star should stand for the reckoned
// place, the sextant says where it does, and the difference is how far to move toward (or from) it. Two lines cross in a fix.
//   pool    the stars the watch may suggest (Yale numbers); the player may take any star that shows
//   clock   the chronometer: `err` [least, most] seconds it is wrong by (sign drawn), `sd` what the reckoning trusts it to, `rate` the sd of its drift in seconds a day
//   light   a lighthouse (made by `sea`): seen only from within `range` nm (less in haze or a gale), it gives a bearing
//   lights  a coast of several, each with its character (`ch`, landfall-lights.js): the one in sight must be told from the others
//   gale    `legs`: the legs (0 is the first) a storm sets the ship off on by `push` nm sd, which the log cannot show
//   bed     a charted bottom the lead can be cast on (landfall-bed.js): the shelf off the coast, banks and pits
// The sea is invented (see landfall-levels.js); the latitudes and longitudes are real so the sky is.

/** The chapters, by `section`. */
export const SECTIONS = {
  1: "Polaris and the log", 2: "The noon sun", 3: "Two lines", 4: "The chronometer", 5: "The Southern Cross", 6: "Cloud and weather",
  7: "The lighthouse", 8: "The storm", 9: "The Hanse run", 10: "The lead", 11: "Lights by their character",
};

const R = Math.round;
/**
 * A landfall `nm` from the departure fix on `course`: the harbour dead ahead, two shoals either side of the approach, a coast across it
 * (perpendicular to the course, 14 nm beyond) and, if `light` is given, a lighthouse on the coast beside the harbour.
 */
function sea(course, nm, { r = 6, names = ["Skarn Bank", "The Hounds"], light = null, lights = null, coast = "the coast" } = {}) {
  const a = course * Math.PI / 180, f = [Math.sin(a), Math.cos(a)], rt = [Math.cos(a), -Math.sin(a)];
  const at = (u, v) => [R(10 * (u * f[0] + v * rt[0])) / 10, R(10 * (u * f[1] + v * rt[1])) / 10];
  const h = at(nm, 0), s1 = at(nm - 3, r + 11), s2 = at(nm + 1, -(r + 12));
  const wob = [2, -3, 1, 4, -2, 0, 3, -1, 2];
  const shore = wob.map((w, i) => at(nm + 14 + w, -180 + i * 45));
  const land = [[...shore, at(nm + 400, 180), at(nm + 400, -180)]];
  const lp = at(nm + 9, r + 9);
  return {
    harbour: { name: coast, x: h[0], y: h[1], r }, shoals: [{ name: names[0], x: s1[0], y: s1[1], r: 4.5 }, { name: names[1], x: s2[0], y: s2[1], r: 4.5 }], land,
    ...(light ? { light: { name: light.name, range: light.range, x: lp[0], y: lp[1] } } : {}),
    // a coast of several lights: each `v` nm along the coast from the harbour (to starboard of the approach is positive), `u` on from it
    ...(lights ? { lights: lights.map(g => { const q = at(nm + (g.u ?? 10), g.v); return { name: g.name, ch: g.ch, range: g.range, x: q[0], y: q[1] }; }) } : {}),
  };
}
/** A point `u` nm along `course` from the departure fix and `v` nm to starboard of it, as sea() places things. */
const spot = (course, u, v) => { const a = course * Math.PI / 180; return [R(10 * (u * Math.sin(a) + v * Math.cos(a))) / 10, R(10 * (u * Math.cos(a) - v * Math.sin(a))) / 10]; };
/** A bottom that shelves off the coast: four fathoms at the shore, `deep` far out, with banks and pits laid along the approach. */
const shelf = (course, { deep = 85, width = 30, line = 120, banks = [] } = {}) => ({
  shore: 4, deep, width, line, banks: banks.map(([u, v, r, top, name]) => { const [x, y] = spot(course, u, v); return { x, y, r, top, ...(name ? { name } : {}) }; }),
});
const NAV = [1708, 7001, 5340, 7924, 7557, 1457, 2990, 3982, 5056, 2943, 2061, 1713, 2491, 4301, 4905, 5191, 1017, 1791, 2088, 2891, 1790, 6134];
const SOUTH = [4730, 4853, 4763, 5267, 5459, 2326, 472, 3685, 7790, 8425, 8728, 6134, 6527, 6879, 6217, 3207, 3307, 6553, 2491];
const standard = { log: 0.07, compass: [1.5, 3.0], sd: 2, current: 0.5, start: 0.4 };
const clk = (a, b, sd, rate = 3) => ({ err: [a, b], sd, rate });
const GREY = "the Grey Sea";

export const VOYAGES = [
  // ---------- section 3: two lines ----------
  { id: "a-star-in-the-east", section: 3, n: 11, name: "A Star in the East", place: GREY,
    blurb: "Polaris is behind you now. A star in the east says how far east you are; a star in the north, how far north. Take the one the sky offers.",
    lesson: "A star's altitude gives a line at right angles to where it stands: a star in the east fixes how far east you are, whatever the latitude.",
    origin: { lat: 56.5, lon: 1.0 }, year: 1856, window: [[3, 20], [4, 25]], watches: 3, kinds: "dusk,dawn,dusk", lop: 2, pool: NAV,
    speed: 5, course0: 100, leg0: 6, hint: 0, swell: 0.5, weather: { clear: 1 }, errors: { ...standard, compass: [0.5, 1.5], sd: 1.2 },
    ...sea(100, 122, { names: ["Gull Bank", "Hake Ledge"], coast: "Sandvik" }) },
  { id: "two-lines-cross", section: 3, n: 12, name: "Two Lines Cross", place: GREY,
    blurb: "Two stars, one watch. Each gives a line; where they cross you are. The wider apart they stand, the cleaner the cross.",
    lesson: "Two stars at right angles make a fix: each pins the ship along the way the other cannot.",
    origin: { lat: 55.5, lon: -2.0 }, year: 1856, window: [[9, 20], [10, 28]], watches: 3, kinds: "dusk,dawn,dusk", lop: 2, pool: NAV,
    speed: 5, course0: 85, leg0: 6, hint: 1, swell: 0.5, weather: { clear: 3, haze: 1 }, errors: { ...standard, compass: [1.0, 2.0], sd: 1.5 },
    ...sea(85, 125, { names: ["Skerry Bank", "Little Brann"], coast: "Torvik" }) },
  { id: "the-fix", section: 3, n: 13, name: "The Fix", place: GREY,
    blurb: "Four nights and a coast with no beacon. Fix your place every watch and steer from the fix, not from the log.",
    lesson: "A fix every watch keeps the doubt small: the log's error has no time to grow.",
    origin: { lat: 58.0, lon: 4.0 }, year: 1856, window: [[10, 2], [11, 8]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 2, pool: NAV,
    speed: 5, course0: 250, leg0: 6, hint: 2, swell: 0.6, weather: { clear: 3, haze: 1, cloud: 1 }, errors: { ...standard, current: 0.6 },
    ...sea(250, 168, { names: ["Old Man's Bank", "Seal Skerries"], coast: "Westerhaven" }) },
  { id: "haze-and-swell", section: 3, n: 14, name: "Haze and Swell", place: GREY,
    blurb: "The horizon is soft and the star will not hold still. Three marks each, and take the lines that agree.",
    lesson: "Swell blurs the horizon, not the star: the average of three marks is worth more than one careful one.",
    origin: { lat: 59.5, lon: 5.0 }, year: 1856, window: [[11, 5], [12, 5]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 2, pool: NAV,
    speed: 5, course0: 195, leg0: 7, hint: 2, swell: 0.95, weather: { haze: 3, swell: 2, clear: 1 }, errors: { ...standard, log: 0.08, compass: [2.0, 3.5], sd: 2.3, current: 0.6 },
    ...sea(195, 165, { names: ["Raven Reef", "Dogger Tail"], coast: "Jerrik" }) },
  // ---------- section 4: the chronometer ----------
  { id: "a-clock-gone-slow", section: 4, n: 15, name: "A Clock Gone Slow", place: GREY,
    blurb: "The chronometer has lost half a minute since Lübeck. A star on the meridian does not care; a star in the east or west does.",
    lesson: "A second of time is a quarter of a mile at the equator: a clock that is wrong moves every line of an east or west star.",
    origin: { lat: 56.0, lon: 3.0 }, year: 1856, window: [[3, 18], [4, 20]], watches: 3, kinds: "dusk,dawn,dusk", lop: 2, pool: NAV, clock: clk(20, 40, 25),
    speed: 5, course0: 90, leg0: 6, hint: 1, swell: 0.5, weather: { clear: 3, haze: 1 }, errors: { ...standard, compass: [1.0, 2.0], sd: 1.5 },
    ...sea(90, 122, { names: ["Skarv Bank", "The Hounds"], coast: "Kalvik" }) },
  { id: "east-and-west", section: 4, n: 16, name: "East and West", place: GREY,
    blurb: "A star due south fixes the latitude and shrugs at the clock; a star in the east or west is moved by it. Take one of each.",
    lesson: "Take one star in the south and one in the east: the first pins the latitude, the second reads the clock's error as a shift east.",
    origin: { lat: 57.5, lon: 6.0 }, year: 1856, window: [[9, 15], [10, 22]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 2, pool: NAV, clock: clk(25, 50, 30),
    speed: 5, course0: 265, leg0: 6, hint: 2, swell: 0.6, weather: { clear: 3, haze: 1, cloud: 1 }, errors: { ...standard },
    ...sea(265, 165, { names: ["Brann Ledge", "Gannet Rock"], coast: "Havn Orrel" }) },
  { id: "the-rate-of-the-clock", section: 4, n: 17, name: "The Rate of the Clock", place: GREY,
    blurb: "A clock does not stay wrong by the same amount: it gains or loses a little each day. Fix it again each night.",
    lesson: "A chronometer's error is not a number but a rate: a clock rated at the last port is still a little different today.",
    origin: { lat: 54.5, lon: -1.5 }, year: 1856, window: [[2, 28], [3, 28]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 2, pool: NAV, clock: clk(30, 60, 35, 6),
    speed: 5, course0: 52, leg0: 6, hint: 2, swell: 0.6, weather: { clear: 3, haze: 1, cloud: 1 }, errors: { ...standard },
    ...sea(52, 168, { names: ["Raven Reef", "Dogger Tail"], coast: "Stenhamn" }) },
  { id: "clock-and-cloud", section: 4, n: 18, name: "Clock and Cloud", place: GREY,
    blurb: "Five watches, a doubtful clock and a sky of gaps. Take the stars you are given.",
    lesson: "When cloud takes the second star, the first still fixes a line: a line is worth taking.",
    origin: { lat: 58.5, lon: 2.0 }, year: 1856, window: [[10, 1], [11, 1]], watches: 5, kinds: "dusk,dawn,dusk,dawn,dusk", lop: 2, pool: NAV, clock: clk(30, 55, 35, 5),
    speed: 5, course0: 215, leg0: 6, hint: 2, swell: 0.7, weather: { clear: 2, cloud: 3, haze: 1 }, errors: { ...standard, log: 0.08, compass: [2.0, 3.5], sd: 2.3, current: 0.6 },
    ...sea(215, 212, { names: ["Troll Skerry", "Gaut Bank"], coast: "Vestvag" }) },
  // ---------- section 5: the Southern Cross ----------
  { id: "under-the-cross", section: 5, n: 19, name: "Under the Cross", place: "the Southern Sea",
    blurb: "South of the line the pole star never rises. The Cross stands over the south, and its long arm points the way to the pole.",
    lesson: "Extend the Cross's long axis four and a half times: that is the south celestial pole, and its height is your latitude.",
    origin: { lat: -24.0, lon: -12.0 }, year: 1856, window: [[5, 15], [6, 25]], watches: 3, kinds: "dusk,dawn,dusk", lop: 2, pool: SOUTH,
    speed: 5, course0: 110, leg0: 6, hint: 0, swell: 0.5, weather: { clear: 1 }, errors: { ...standard, compass: [1.0, 2.0], sd: 1.5 },
    ...sea(110, 122, { names: ["Coral Bank", "The Sisters"], coast: "Porto Alba" }) },
  { id: "the-pointers", section: 5, n: 20, name: "The Pointers", place: "the Southern Sea",
    blurb: "Two bright stars beside the Cross point at it: Alpha and Beta Centauri. Find them first, and the Cross is under them.",
    lesson: "The Pointers lead to the Cross, and the Cross to the south: three steps to the pole you cannot see.",
    origin: { lat: -30.0, lon: 18.0 }, year: 1856, window: [[6, 1], [7, 15]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 2, pool: SOUTH,
    speed: 5, course0: 305, leg0: 6, hint: 1, swell: 0.6, weather: { clear: 3, haze: 1 }, errors: { ...standard },
    ...sea(305, 166, { names: ["Albatross Bank", "Seal Island"], coast: "Walvis" }) },
  { id: "no-pole-star", section: 5, n: 21, name: "No Pole Star", place: "the Southern Sea",
    blurb: "The southern pole has no star of its own. Fix by whatever bright stars the evening gives you, and mind the clock.",
    lesson: "Without a pole star the intercept does everything: any two bright stars that stand apart make a fix.",
    origin: { lat: -35.0, lon: 25.0 }, year: 1856, window: [[7, 1], [8, 10]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 2, pool: SOUTH, clock: clk(15, 35, 22),
    speed: 5, course0: 135, leg0: 6, hint: 2, swell: 0.7, weather: { clear: 3, haze: 1, swell: 1 }, errors: { ...standard },
    ...sea(135, 166, { names: ["Agulhas Ledge", "Whale Rock"], coast: "Port Natal" }) },
  { id: "canopus-and-achernar", section: 5, n: 22, name: "Canopus and Achernar", place: "the Southern Sea",
    blurb: "Five watches in the roaring latitudes: the two great southern stars, a sea that does not lie down, and cloud off the west.",
    lesson: "Canopus and Achernar stand far apart: a fix from the two of them is a wide cross, the best a southern sky offers.",
    origin: { lat: -38.0, lon: 40.0 }, year: 1856, window: [[8, 1], [9, 5]], watches: 5, kinds: "dusk,dawn,dusk,dawn,dusk", lop: 2, pool: SOUTH, clock: clk(15, 40, 25, 4),
    speed: 5, course0: 95, leg0: 6, hint: 3, swell: 1.0, weather: { clear: 2, cloud: 2, swell: 2 }, errors: { ...standard, log: 0.08, compass: [2.0, 3.5], sd: 2.3, current: 0.65 },
    ...sea(95, 212, { names: ["Crozet Bank", "The Needles"], coast: "Kerguelen Roads" }) },
  // ---------- section 6: cloud and weather ----------
  { id: "gaps-in-the-cloud", section: 6, n: 23, name: "Gaps in the Cloud", place: GREY,
    blurb: "A moving ceiling. A star shows through a gap and is gone: take whichever one the sky gives, and take it quickly.",
    lesson: "Choose the star the gap shows, not the star you planned: any two stars make a fix.",
    origin: { lat: 55.0, lon: 0.0 }, year: 1856, window: [[10, 20], [11, 25]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 2, pool: NAV,
    speed: 5, course0: 75, leg0: 6, hint: 2, swell: 0.6, weather: { cloud: 4, clear: 1, haze: 1 }, errors: { ...standard },
    ...sea(75, 166, { names: ["Raven Reef", "Dogger Tail"], coast: "Sandhamn" }) },
  { id: "squalls", section: 6, n: 24, name: "Squalls", place: GREY,
    blurb: "Rain squalls, a lumpy sea and a short twilight. Wait with the sextant ready and the lamp low.",
    lesson: "The horizon goes before the light does: take the sight in the first minutes of the twilight or not at all.",
    origin: { lat: 59.0, lon: 4.0 }, year: 1856, window: [[11, 10], [12, 12]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 2, pool: NAV,
    speed: 5, course0: 215, leg0: 7, hint: 2, swell: 1.0, weather: { cloud: 2, haze: 2, swell: 2 }, errors: { ...standard, log: 0.08, compass: [2.0, 3.5], sd: 2.3, current: 0.6 },
    ...sea(215, 168, { names: ["Skarn Bank", "The Maidens"], coast: "Nordvik" }) },
  { id: "dawn-watches", section: 6, n: 25, name: "Dawn Watches", place: GREY,
    blurb: "Dawn first, and dawn again. The stars fade as you wait for them and the horizon comes up behind: the sun is quick.",
    lesson: "A morning twilight is a countdown: the bright stars go first, and the horizon comes only as they leave.",
    origin: { lat: 57.0, lon: -2.0 }, year: 1856, window: [[5, 1], [5, 30]], watches: 4, kinds: "dawn,dusk,dawn,dusk", lop: 2, pool: NAV,
    speed: 5, course0: 40, leg0: 6, hint: 2, swell: 0.6, weather: { clear: 3, haze: 1, cloud: 1 }, errors: { ...standard },
    ...sea(40, 166, { names: ["Gannet Rock", "Brann Ledge"], coast: "Kirkhavn" }) },
  // ---------- section 7: the lighthouse ----------
  { id: "the-light-on-the-skerry", section: 7, n: 26, name: "The Light on the Skerry", place: GREY,
    blurb: "A light stands on the coast, and shows only from sixteen miles. Run in on the stars; when it rises, take its bearing.",
    lesson: "A light is a line too: its bearing, corrected for the compass, puts you on a line through it.",
    origin: { lat: 56.0, lon: 2.0 }, year: 1856, window: [[10, 1], [11, 3]], watches: 3, kinds: "dusk,dawn,dusk", lop: 1, pool: NAV,
    speed: 5, course0: 70, leg0: 6, hint: 1, swell: 0.5, weather: { clear: 3, haze: 1 }, errors: { ...standard, compass: [1.0, 2.0], sd: 1.5 },
    ...sea(70, 122, { names: ["Skerry Bank", "Little Brann"], coast: "Skerrholm", light: { name: "Skerry Light", range: 16 } }) },
  { id: "loom-of-the-land", section: 7, n: 27, name: "Loom of the Land", place: GREY,
    blurb: "Haze cuts a light's reach to ten miles. Be on your line before it shows.",
    lesson: "The light tells you the coast is near, not where along it: a bearing and a star make the landfall.",
    origin: { lat: 58.0, lon: 6.0 }, year: 1856, window: [[10, 15], [11, 20]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 2, pool: NAV,
    speed: 5, course0: 255, leg0: 6, hint: 2, swell: 0.7, weather: { haze: 3, clear: 2 }, errors: { ...standard, compass: [2.0, 3.5], sd: 2.3 },
    ...sea(255, 166, { names: ["Gaut Bank", "Troll Skerry"], coast: "Havn Skerra", light: { name: "Skerra Light", range: 14 } }) },
  { id: "a-dark-coast", section: 7, n: 28, name: "A Dark Coast", place: GREY,
    blurb: "A short light on an iron coast, and a current setting you onto it. The stars have to carry you most of the way.",
    lesson: "A light that is not yet in sight is also information: you are further than its range.",
    origin: { lat: 57.5, lon: 3.0 }, year: 1856, window: [[11, 1], [12, 8]], watches: 5, kinds: "dusk,dawn,dusk,dawn,dusk", lop: 2, pool: NAV, clock: clk(15, 35, 22),
    speed: 5, course0: 150, leg0: 6, hint: 2, swell: 0.8, weather: { clear: 2, haze: 2, cloud: 2 }, errors: { ...standard, log: 0.07, compass: [1.5, 3.0], sd: 2, current: 0.5 },
    ...sea(150, 210, { names: ["Hake Bank", "The Hounds"], coast: "Kalvik", light: { name: "Kalvik Light", range: 12 } }) },
  // ---------- section 8: the storm ----------
  { id: "gale-off-the-skaw", section: 8, n: 29, name: "Gale off the Skaw", place: GREY,
    blurb: "A gale sets in on the second night. The log says what the ship made; the sea says otherwise. Fix yourself again when it blows out.",
    lesson: "A gale moves the ship in ways the log cannot show: the dead reckoning drifts, and only a sight brings it back.",
    origin: { lat: 57.0, lon: 6.0 }, year: 1856, window: [[10, 25], [11, 25]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 2, pool: NAV, gale: { legs: [1, 2], push: 7 },
    speed: 5, course0: 280, leg0: 6, hint: 2, swell: 0.9, weather: { clear: 2, haze: 1, cloud: 1 }, errors: { ...standard, log: 0.08, compass: [2.0, 3.5], sd: 2.3, current: 0.6 },
    ...sea(280, 166, { names: ["Skarn Bank", "The Maidens"], coast: "Lista" }) },
  { id: "hove-to", section: 8, n: 30, name: "Hove To", place: GREY,
    blurb: "The storm has the ship for two days. Hove to, you lose no ground, but the sea sets you where it likes.",
    lesson: "Heaving to saves the ship and spoils the reckoning: after a blow, trust a sight over the log.",
    origin: { lat: 58.5, lon: 2.0 }, year: 1856, window: [[11, 5], [12, 5]], watches: 5, kinds: "dusk,dawn,dusk,dawn,dusk", lop: 2, pool: NAV, gale: { legs: [1, 2], push: 7 }, clock: clk(10, 25, 18),
    speed: 5, course0: 190, leg0: 6, hint: 3, swell: 1.1, weather: { clear: 2, cloud: 2, swell: 1 }, errors: { ...standard, log: 0.08, compass: [2.0, 3.5], sd: 2.3, current: 0.6 },
    ...sea(190, 212, { names: ["Gaut Bank", "Troll Skerry"], coast: "Stavanger Roads" }) },
  { id: "the-drift", section: 8, n: 31, name: "The Drift", place: GREY,
    blurb: "Two blows in one voyage and a coast with a light to find. The reckoning will be wrong twice: be ready to start it over.",
    lesson: "After a blow, forget the fog you had: let the first good fix be the new beginning.",
    origin: { lat: 55.5, lon: 0.5 }, year: 1856, window: [[11, 12], [12, 15]], watches: 5, kinds: "dusk,dawn,dusk,dawn,dusk", lop: 2, pool: NAV, gale: { legs: [0, 3], push: 8 },
    speed: 5, course0: 80, leg0: 6, hint: 3, swell: 1.0, weather: { clear: 2, cloud: 2, haze: 1 }, errors: { ...standard, log: 0.08, compass: [2.0, 3.5], sd: 2.3, current: 0.6 },
    ...sea(80, 210, { names: ["Raven Reef", "Dogger Tail"], coast: "Stenhamn", light: { name: "Sten Light", range: 14 } }) },
  // ---------- section 9: the Hanse run ----------
  // Real latitudes and longitudes, an invented sea between them: the run a Lübeck barque made in a season.
  { id: "luebeck-to-the-skaw", section: 9, n: 32, name: "Lübeck to the Skaw", place: "the Baltic and the Kattegat",
    blurb: "Out of Lübeck Bay with the grain, north up the Kattegat. The Skaw's light is the first you will raise on the way.",
    lesson: "A short run is the place to practise: two stars, a light, and the clock you carry for the long passage.",
    origin: { lat: 54.4, lon: 11.2 }, year: 1856, window: [[9, 1], [9, 25]], watches: 5, kinds: "dusk,dawn,dusk,dawn,dusk", lop: 2, pool: NAV, clock: clk(10, 30, 20),
    speed: 5, course0: 358, leg0: 6, hint: 2, swell: 0.6, weather: { clear: 3, haze: 1, cloud: 1 }, errors: { ...standard },
    ...sea(358, 212, { names: ["Anholt Bank", "Læsø Rev"], coast: "The Skaw", light: { name: "Skaw Light", range: 16 } }) },
  { id: "the-skaw-to-bergen", section: 9, n: 33, name: "The Skaw to Bergen", place: "the North Sea",
    blurb: "Across the mouth of the Skagerrak and up the Norwegian coast: the open North Sea in October, and a gale on the way.",
    lesson: "The long passage is every lesson at once: the clock, the cross, the cloud and the blow.",
    origin: { lat: 57.7, lon: 10.5 }, year: 1856, window: [[10, 1], [10, 28]], watches: 6, kinds: "dusk,dawn,dusk,dawn,dusk,dawn", lop: 2, pool: NAV, clock: clk(12, 32, 22), gale: { legs: [2, 3], push: 7 },
    speed: 5, course0: 315, leg0: 6, hint: 3, swell: 0.9, weather: { clear: 2, haze: 1, cloud: 2, swell: 1 }, errors: { ...standard, log: 0.08, compass: [2.0, 3.5], sd: 2.3, current: 0.65 },
    ...sea(315, 258, { names: ["Utsira Bank", "The Skerries"], coast: "Bergen", light: { name: "Fedje Light", range: 15 } }) },
  { id: "bergen-to-london", section: 9, n: 34, name: "Bergen to London", place: "the North Sea",
    blurb: "The last stretch, from the Dogger to the Thames mouth with Bergen's fish. Shoals on every side and a light at the end of it.",
    lesson: "Home waters are the hardest: shoals close in, the tide is strong and every fix matters.",
    origin: { lat: 54.0, lon: 2.5 }, year: 1856, window: [[11, 1], [11, 25]], watches: 5, kinds: "dusk,dawn,dusk,dawn,dusk", lop: 2, pool: NAV, clock: clk(10, 28, 20),
    speed: 5, course0: 222, leg0: 6, hint: 3, swell: 0.8, weather: { clear: 2, haze: 2, cloud: 2 }, errors: { ...standard, log: 0.07, compass: [1.5, 3.0], sd: 2, current: 0.5 },
    ...sea(222, 212, { names: ["Long Sand", "Kentish Knock"], coast: "the Nore", light: { name: "Nore Light", range: 13 } }) },
  // ---------- section 10: the lead ----------
  // The deep-sea lead, cast once a watch with the ship hove to: the depth is a line along its contour wherever the bottom slopes.
  // The shelf off a coast says how far off it you are, which is how far you have run, the thing the log gets wrong.
  { id: "on-soundings", section: 10, n: 35, name: "On Soundings", place: GREY,
    blurb: "One star a night, and a log that runs fast. The bottom shelves up to the coast: when the lead finds it, it says how far you have to go.",
    lesson: "A star across your course says where you are across it; the depth on a shelving bottom says how far along. Together they fix you.",
    origin: { lat: 56.5, lon: 0.5 }, year: 1856, window: [[9, 1], [10, 5]], watches: 3, kinds: "dusk,dawn,dusk", lop: 1, pool: NAV,
    speed: 5, course0: 95, leg0: 6, hint: 1, swell: 0.5, weather: { clear: 2, haze: 2 }, errors: { ...standard, log: 0.1, compass: [1.0, 2.0], sd: 1.5, current: 0.5 },
    ...sea(95, 150, { r: 6.5, names: ["Gull Bank", "Hake Ledge"], coast: "Sandvik" }), bed: shelf(95, { deep: 100, width: 42 }) },
  { id: "thick-weather", section: 10, n: 36, name: "Thick Weather", place: GREY,
    blurb: "Cloud for days, with gaps. When the stars will not show, the lead still will: sound every watch and steer by what the bottom says.",
    lesson: "Cloud hides the sky, not the sea floor. A sounding is a line on any night.",
    origin: { lat: 57.5, lon: 2.0 }, year: 1856, window: [[11, 1], [12, 5]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 2, pool: NAV,
    speed: 5, course0: 40, leg0: 6, hint: 2, swell: 0.7, weather: { thick: 5, haze: 1, clear: 1 }, errors: { ...standard, log: 0.09, current: 0.5 },
    ...sea(40, 185, { r: 6.5, names: ["The Fladen", "Brann Knoll"], coast: "Utvær" }), bed: shelf(40, { deep: 100, width: 40, banks: [[120, -26, 14, 22, "Fladen Ground"]] }) },
  { id: "the-silver-pit", section: 10, n: 37, name: "The Silver Pit", place: GREY,
    blurb: "Across the Dogger, a wide bank as flat as a table, with one deep hole in it, the Silver Pit. Find the hole and you know where you are on the bank.",
    lesson: "A flat bottom says nothing, but a hole in it is a mark: the depth jumps, and the sounding pins you to its edge.",
    origin: { lat: 54.6, lon: 0.0 }, year: 1856, window: [[10, 10], [11, 15]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 1, pool: NAV,
    speed: 5, course0: 70, leg0: 6, hint: 2, swell: 0.7, weather: { clear: 2, haze: 2, thick: 1 }, errors: { ...standard, log: 0.08, compass: [1.5, 3.0], sd: 2, current: 0.35 },
    ...sea(70, 165, { r: 7, names: ["Dogger Tail", "Swarte Bank"], coast: "Westerhaven" }),
    bed: shelf(70, { deep: 70, width: 30, banks: [[85, 0, 46, 13, "the Dogger"], [96, 4, 9, 46, "the Silver Pit"]] }) },
  // ---------- section 11: lights by their character ----------
  // A coast with more than one light: each is told by its character, the pattern of its flashes, which the chart prints beside it.
  { id: "which-light", section: 11, n: 38, name: "Which Light?", place: GREY,
    blurb: "Two lights guard the harbour, one each side. When one rises, count its flashes against the chart before you trust its bearing.",
    lesson: "A light is only a line through the tower you name: count its flashes and time them, and the chart tells you which tower it is.",
    origin: { lat: 57.0, lon: 1.0 }, year: 1856, window: [[10, 1], [11, 5]], watches: 3, kinds: "dusk,dawn,dusk", lop: 1, pool: NAV,
    speed: 5, course0: 80, leg0: 6, hint: 1, swell: 0.5, weather: { clear: 3, haze: 1 }, errors: { ...standard, compass: [1.0, 2.0], sd: 1.5 },
    ...sea(80, 165, { names: ["North Brann", "South Brann"], coast: "Brannhavn", lights: [{ name: "Brann Ness", ch: "Fl(2) 10s", range: 24, v: -22 }, { name: "Holm", ch: "Oc 6s", range: 22, v: 24 }] }) },
  { id: "cross-bearings", section: 11, n: 39, name: "Cross Bearings", place: GREY,
    blurb: "Three lights on a long coast, and cloud over the stars. Two lights in sight at once are a fix with no sky at all.",
    lesson: "Two bearings cross like two stars: lights well apart make a fix, and a third shows whether you named them right.",
    origin: { lat: 58.0, lon: 3.5 }, year: 1856, window: [[11, 1], [12, 5]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 1, pool: NAV,
    speed: 5, course0: 110, leg0: 6, hint: 2, swell: 0.6, weather: { thick: 3, haze: 1, clear: 2 }, errors: { ...standard, log: 0.08, current: 0.55 },
    ...sea(110, 165, { r: 6.5, names: ["The Scaur", "Kettle Rock"], coast: "Lindvik", lights: [{ name: "Lind Head", ch: "Fl 5s", range: 24, v: -30 }, { name: "Kettle", ch: "Iso 4s", range: 16, v: 9, u: 6 }, { name: "Varde", ch: "Fl(3) 15s", range: 26, v: 34 }] }) },
  { id: "count-the-flashes", section: 11, n: 40, name: "Count the Flashes", place: GREY,
    blurb: "A coast of lights that look alike, a current setting along it, and a log you cannot trust. Time each light before you name it.",
    lesson: "Lights that look alike differ in their count and their period: two flashes in ten seconds is not three in fifteen.",
    origin: { lat: 56.0, lon: 6.0 }, year: 1856, window: [[10, 15], [11, 20]], watches: 4, kinds: "dusk,dawn,dusk,dawn", lop: 1, pool: NAV, clock: clk(10, 25, 18),
    speed: 5, course0: 250, leg0: 6, hint: 2, swell: 0.7, weather: { clear: 2, haze: 2, thick: 1 }, errors: { ...standard, log: 0.08, compass: [1.5, 3.0], sd: 2, current: 0.5 },
    ...sea(250, 170, { r: 6.5, names: ["The Graves", "Old Pen"], coast: "Westerhaven", lights: [{ name: "Graves", ch: "Fl(2) 10s", range: 24, v: -9 }, { name: "Pen Head", ch: "Fl(3) 15s", range: 24, v: 10 }, { name: "Westerhaven", ch: "Fl R 5s", range: 14, v: 2, u: 4 }] }) },
];
