// The notebook: what the voyage teaches in passing. Each note is a fact of the old navigator's trade that the player meets in
// context (the first fix, the first drift, a star tapped, a line of the sight book) and that is then kept in the notebook, where
// it can be read again. It replaces the lesson sheets of the old Navigation course: the same material, but learned by sailing.
// Pure data and functions (tests/landfall-notes.mjs); the page decides when an event happens and puts the words on the screen.
//
// A note: { id, g (group), term, on (the event that earns it, or a list), cap (the short line shown when it is earned), text (the
// whole note), fill? }. Either may be a function of ctx ({ lat }). A note with `fill: { on, answer }` has a `{gap}` in its words that
// stays a blank until that second event happens: it is earned half-empty, and the player fills it by playing. Knowledge only: no
// note changes how a voyage plays.
import { dip, refraction } from "./landfall-sky.js";
import { EYE } from "./landfall-engine.js";

export const GROUPS = [["chart", "On the chart"], ["sky", "The night sky"], ["sight", "Taking a sight"], ["time", "The clock"]];

const cosd = d => Math.cos(d * Math.PI / 180);
const f1 = x => (Math.round(x * 10) / 10).toString();
const MAST = 16;                                     // a masthead's height, for the dip from up there

export const NOTES = [
  // ---------- on the chart ----------
  { id: "hanse", g: "chart", term: "The Hanse", on: "start",
    cap: "The Hanse: the league of north German merchant towns that ran the Baltic and North Sea trade.",
    text: "The Hanse was the league of north German merchant towns that ran the trade of the North Sea and the Baltic from the 1200s. Hamburg, Lübeck and Bremen kept the name into your day." },
  { id: "latlon", g: "chart", term: "Latitude and longitude", on: "ritual",
    cap: "Latitude is how far north of the equator, longitude how far east of Greenwich.",
    text: "Latitude is how far north or south of the equator you are, 0° to 90°; longitude is how far east or west of Greenwich, up to 180°. A chart is a net of both." },
  { id: "minute", g: "chart", term: "The mile", on: "ritual", fill: { on: "plot", answer: "60" },
    cap: "A minute of latitude is one nautical mile. How many to a degree?",
    text: "A minute of latitude (a sixtieth of a degree) is one nautical mile, 1,852 metres: that is how the mile was made. So a degree of latitude is {gap} miles, and distance north and south can be read straight off the edge of a chart." },
  { id: "lonshrink", g: "chart", term: "A degree of longitude", on: "ritual",
    cap: c => `Meridians meet at the poles: a degree of longitude is only ${f1(60 * cosd(c.lat))} miles here.`,
    text: c => `Meridians, the lines of longitude, meet at the poles. A degree of longitude is 60 miles at the equator and shrinks by the cosine of the latitude: at ${Math.round(c.lat)}° N it is ${f1(60 * cosd(c.lat))} miles. That is why the slate gives east-west miles as so few minutes of longitude.` },
  { id: "knot", g: "chart", term: "The knot and the log", on: "step",
    cap: "A knot is a nautical mile an hour, counted off a line with a knot every 47 ft 3 in.",
    text: "A knot is one nautical mile an hour. To measure it a sailor streamed the log, a wooden chip on a line, and counted the knots that ran out while a 28-second sand glass emptied. They are tied 47 ft 3 in apart, the same fraction of a mile as 28 seconds is of an hour." },
  { id: "reckon", g: "chart", term: "Dead reckoning", on: "step",
    cap: "Dead reckoning: where you were, plus the course and speed for the time. Each leg's error adds to the last.",
    text: "Dead reckoning is working out where you are from where you were: the course steered, the speed from the log, the time from the glass. Each leg's error is added to the one before, and the fog round the ship is that sum." },
  { id: "compass", g: "chart", term: "The compass card", on: "bearing",
    cap: "The card has 32 points, each 11¼° wide: north, north by east, north-north-east…",
    text: "The compass card has 32 points, each 11¼° wide: the four cardinal points, four between them, and the rest named \"by\" one of them, such as north by east. The game reads the card in degrees." },
  { id: "variation", g: "chart", term: "Variation", on: "bearing",
    cap: "A compass points to magnetic north, not true north. The gap is the variation.",
    text: "A compass points to magnetic north, not true north. The gap is the variation: it differs from place to place, drifts slowly over the years, and the chart prints it. The ship's own iron adds a deviation of its own. A star whose bearing you know shows the whole error at once." },
  { id: "drift", g: "chart", term: "Set and drift", on: "plot",
    cap: "A current carries the ship as it carries the water: set is its direction, drift its speed.",
    text: "A current carries the ship as it carries the water. Its direction (the way it flows toward) is the set, its speed the drift. The log cannot feel it, so a fix is the only thing that shows what it did." },
  { id: "brouwer", g: "chart", term: "Brouwer's road", on: "plot:star",
    cap: "East and west stay foggy: in 1611 that nearly cost the Dutch East India Company its ships.",
    text: "Polaris says nothing of east and west. In 1611 Hendrik Brouwer showed the Dutch East India Company (the VOC, founded 1602) a fast road to Java: run east before the westerlies of the southern ocean, then turn north. With no check on longitude, ships turned too early or too late." },
  { id: "rhumb", g: "chart", term: "Rhumb line and great circle", on: "sail",
    cap: "One course held is a rhumb line. Mercator's chart (1569) draws it straight.",
    text: "A single course held is a rhumb line: it crosses every meridian at the same angle. Gerardus Mercator's chart (1569) draws it straight by stretching north-south toward the pole; Edward Wright worked out the mathematics in 1599. The shortest way is a great circle, a slice through the earth's centre, which on that chart bows toward the pole." },
  { id: "mercscale", g: "chart", term: "Mercator's scale", on: "sail", fill: { on: "end", answer: "twice" },
    cap: "On a Mercator chart a degree of latitude grows toward the pole. At 60° N, how much?",
    text: "A degree of latitude is 60 miles everywhere, but a Mercator chart draws it longer toward the pole: at 60° N it is {gap} as long as at the equator (the scale grows as the secant of the latitude). So distance is measured on the latitude scale beside you, never on one scale for the whole chart." },
  { id: "starfinder-names", g: "sky", term: "Naming a star", on: "name",
    cap: "A lone star is named by where it stands: its height and bearing against the almanac's list, and its neighbours.",
    text: "Seen through a gap, a bright star is only a point of light. The navigator names it from where it stands: its height and bearing against the bright stars the almanac puts up at that hour, its colour, and the few neighbours the gap shows. The compass checks the name: a star named wrongly stands far from where the named star should." },
  { id: "seabirds", g: "chart", term: "Birds and the land", on: "birds",
    cap: "Seabirds fly out to fish at dawn and home at dusk, and each kind only so far: a sign of land, and of which way it lies.",
    text: "Before charts were good, seabirds were read as a sign of land. A gannet fishes up to sixty or seventy miles from its rock, a tern twenty, a puffin a dozen; they fly out at dawn and home at dusk, low and straight. Pacific navigators followed terns and noddies home to islands they could not see; North Sea fishermen knew the gannets of their rocks." },
  { id: "views", g: "chart", term: "Coastal views", on: "land",
    cap: "The Sailing Directions drew the coast as it looks from seaward, its heights stretched so the shapes can be told.",
    text: "Sailing Directions and the margins of charts carried coastal views: the land drawn as it looks from seaward at a stated distance and bearing, the heights stretched two or three times so that a loaf, a table or a notch can be told. A summit's height also says how far off it shows: about 2.08 times the square root of its height in metres, in miles, plus as much for your own eye." },
  { id: "character", g: "chart", term: "A light's character", on: "lights",
    cap: "Every light keeps its own pattern of flashes, its character, so that no two near each other look alike.",
    text: "A lighthouse is told from its neighbours by its character, printed on the chart beside it: Fl(2) 10s is two flashes every ten seconds, Oc 6s a steady light eclipsed once every six, Iso equal light and dark, F fixed, R or G a red or green light. Augustin Fresnel's lens of 1822 made the turning flashes bright enough to see twenty miles off." },
  { id: "soundings", g: "chart", term: "Soundings", on: "sound",
    cap: "A sounding on a sloping bottom is a line: you are somewhere on that depth's contour.",
    text: "The chart prints depths in fathoms (six feet each) and joins like ones in contours. A cast puts you on one contour; where the bottom slopes, as it shelves to a coast, that contour is a line of position like a star's and says how far off the land you are. A flat bottom says nothing, and a bank gives the same depth on both sides: read the lead against a fix." },
  { id: "leadsman", g: "chart", term: "The leadsman's marks", on: "sound",
    cap: "The hand lead's line is marked at 2, 3, 5, 7, 10, 13, 15, 17 and 20 fathoms: \"by the mark\", or \"by the deep\" between.",
    text: "The hand lead is swung from the chains under way. Its line is marked at 2, 3, 5, 7, 10, 13, 15, 17 and 20 fathoms in leather, calico, serge and cord, so the mark can be felt at night: \"by the mark\" on one, \"by the deep\" between, \"and a half\" or \"a quarter less\" for the rest. Deeper, the deep-sea lead needs the ship hove to." },
  { id: "lead", g: "chart", term: "The lead", on: "end",
    cap: "The Hanse's cogs felt their way in with the lead: a weight on a line, its foot coated in tallow.",
    text: "The Hanse's cogs kept to the coasts and felt their way in with the lead, a weight on a line with its foot coated in tallow. It gave the depth, and what stuck to the tallow (sand, mud, shell) gave the bottom, which on a known coast was a position." },

  // ---------- the night sky ----------
  { id: "turn", g: "sky", term: "The sky turns", on: "wait",
    cap: "The sky turns about the pole once in 23 h 56 min: 15° an hour.",
    text: "The whole sky wheels about one point, the celestial pole, once in 23 hours 56 minutes: 360° in a day, or 15° an hour. It is the same 15° an hour that turns a clock into a longitude." },
  { id: "spin", g: "sky", term: "Which way it turns", on: "wait",
    cap: "Facing north, the stars go round Polaris counter-clockwise.",
    text: "Looking north, the stars turn counter-clockwise about Polaris. They rise in the east (on your right as you face north) and set in the west, so those above the pole drift left." },
  { id: "polehigh", g: "sky", term: "The pole's height", on: "plot:star",
    cap: "The pole stands as high above the horizon as you are far north: that is the whole trick.",
    text: "The celestial pole stands as high above your horizon as your latitude. Polaris is within a degree of the pole, so its altitude, trimmed by the almanac's small correction, is your latitude. It stands due north wherever you are, which is why it gives no longitude." },
  { id: "orion", g: "sky", term: "Orion", on: ["pick:Rigel", "pick:Mintaka", "pick:Alnilam", "pick:Alnitak", "pick:Betelgeuse"], fill: { on: "pick:Betelgeuse", answer: "Betelgeuse" },
    cap: "Orion: three stars in a short line for a belt, blue-white Rigel at a foot, and a red shoulder.",
    text: "Orion the hunter is the easiest sign of the winter sky: three bright stars in a short line make his belt (Mintaka, Alnilam, Alnitak), blue-white Rigel is at a foot, and red {gap} at a shoulder." },
  { id: "sirius", g: "sky", term: "Sirius", on: "pick:Sirius",
    cap: "Sirius: the brightest star in the night sky, found by following Orion's belt down and east.",
    text: "Follow the line of Orion's belt down and to the east and it leads to Sirius, the brightest star in the night sky, at magnitude −1.5 (the lower the number, the brighter). It is about twice as bright as the next, Canopus, which sailors in the south knew well." },
  { id: "aldebaran", g: "sky", term: "Aldebaran", on: "pick:Aldebaran",
    cap: "Aldebaran, the red eye of the Bull: Orion's belt points at it the other way.",
    text: "Orion's belt points the other way too, up and to the west, roughly at Aldebaran, the red eye of the Bull." },

  // ---------- taking a sight ----------
  { id: "astrolabe", g: "sight", term: "The astrolabe", on: "raise", fill: { on: "plot:star", answer: "60" },
    cap: "Before the sextant: the mariner's astrolabe, good to a degree. A degree out is how many miles?",
    text: "Before the sextant there was the mariner's astrolabe: a heavy open brass ring hung from the thumb, with a sighting arm, used by Portuguese pilots at sea from the late 1400s. It was good to a degree at best on a moving deck, and a degree of altitude is a degree of latitude: {gap} miles. A sextant read to a minute brings that to one." },
  { id: "sextant", g: "sight", term: "The sextant", on: "raise",
    cap: "Two mirrors: tilt one and the ray turns twice as far, so a 60° frame reads to 120°.",
    text: "John Hadley's octant of 1730, and the sextant that followed in 1757, measure an angle with two mirrors: the horizon is seen straight through the clear half of one, the star reflected twice in the silvered half. Tilting a mirror by an angle turns the ray by twice as much, so a frame of 60° (a sixth of a circle) is marked up to 120°." },
  { id: "shades", g: "sight", term: "Looking at the sun", on: "raise:sun",
    cap: "Nobody looks at the sun bare: the sextant carries coloured shades.",
    text: "The sun is never looked at bare: the sextant carries coloured glass shades. The astrolabe had no glass; its sailor turned the ring until the sun's light shone through a hole in the upper vane onto the lower." },
  { id: "dip", g: "sight", term: "Dip", on: ["book", "tip:dip"],
    cap: c => `Dip: your eye is above the sea, so the horizon lies below level. At ${EYE} m it is ${f1(dip(EYE))}′.`,
    text: `Dip: the sextant measures from the sea horizon, but your eye is above the sea, so that horizon lies below the true level one. The correction is 1.76′ × √(eye height in metres): ${f1(dip(EYE))}′ at your ${EYE} m, ${f1(dip(MAST))}′ from a masthead ${MAST} m up. It is always subtracted.` },
  { id: "refraction", g: "sight", term: "Refraction", on: ["book", "tip:refraction"],
    cap: `Refraction: the air bends starlight, so a star looks higher than it is.`,
    text: `Refraction: the air bends a star's light, so the star looks higher than it is. The correction is about ${f1(refraction(45))}′ at 45° up and about ${Math.round(refraction(5))}′ at 5°, and it is subtracted. The nearer the horizon, the worse it is.` },
  { id: "ho", g: "sight", term: "Observed altitude", on: ["book", "tip:ho"],
    cap: "Ho, the observed altitude: the reading less dip, less refraction.",
    text: "Ho, the observed altitude, is the star's height above the true, level horizon: the sextant's reading less the dip and less the refraction. Both are subtracted; dip is never added." },
  { id: "noonlat", g: "sight", term: "Latitude from the noon sun", on: "noon",
    cap: "At noon the sun stands due south and highest: latitude = 90° − Ho + declination.",
    text: "At local noon the sun stands highest, due south of you in the northern hemisphere. Your latitude is then 90° − Ho + the sun's declination, declination being the latitude the sun is directly over, south counted negative." },
  { id: "declination", g: "sight", term: "Declination", on: ["sunalmanac", "plot:sun"],
    cap: "Declination: the latitude the sun is over. It swings 23½° north and south in the year.",
    text: "Declination is the latitude a body is directly over, taken from the almanac. The sun's swings between about 23½° N in June and 23½° S in December, and that swing is the seasons." },

  // ---------- the clock ----------
  { id: "lontime", g: "time", term: "Longitude is time", on: "catch", fill: { on: "lon", answer: "4" },
    cap: "The earth turns 15° an hour: how many minutes of time to a degree of longitude?",
    text: "The earth turns 15° an hour, so 1° of longitude is {gap} minutes of time. The sun is highest at your local noon; set that against a clock that keeps Greenwich time and the difference is your longitude." },
  { id: "chrono", g: "time", term: "The chronometer", on: "lon",
    cap: "A chronometer keeps Greenwich time at sea. Early noon is east of Greenwich, late noon west.",
    text: "A chronometer is the clock that keeps Greenwich time at sea. If it reads 14:20 at your local noon, your noon came 2 h 20 min after Greenwich's, and you are 35° west. Early noon means east, late noon west." },
  { id: "clockmile", g: "time", term: "A clock's error in miles", on: "lon",
    cap: c => `A second of time is a quarter-mile at the equator, ${(0.25 * cosd(c.lat)).toFixed(2)} here: a clock minutes out puts you miles out.`,
    text: c => `A second of time is 15 seconds of arc, a quarter of a nautical mile at the equator; toward the poles the meridians draw together, so at ${Math.round(c.lat)}° N it is ${(0.25 * cosd(c.lat)).toFixed(2)}. A chronometer two minutes wrong puts you 30 miles out at the equator, ${Math.round(30 * cosd(c.lat))} here.` },
  { id: "rate", g: "time", term: "A chronometer's rate", on: "lon", fill: { on: "lon", answer: "15" },
    cap: "A chronometer keeps a steady rate, not perfect time. Gaining 3 s a day for 20 days, how far out?",
    text: "A chronometer never keeps perfect time, but it keeps a steady rate. One that gains 3 seconds a day and was set 20 days ago is a minute out: {gap} miles at the equator, unless its rate is logged and allowed for." },
  { id: "act", g: "time", term: "The Longitude Act", on: "lon",
    cap: "1714: £20,000 for a longitude good to half a degree: two minutes of time.",
    text: "The British Longitude Act of 1714 offered up to £20,000 for a method of finding longitude good to half a degree: two minutes of time, 30 miles at the equator." },
  { id: "h4", g: "time", term: "Harrison's H4", on: "lon",
    cap: "H4, 1761: five seconds out after eighty-one days at sea, a mile and a quarter.",
    text: "In 1761–62 John Harrison's fourth timekeeper, H4, was five seconds out after 81 days at sea to Jamaica: a mile and a quarter at the equator, well inside the Act's 30. Captain Cook carried a copy, K1, on his second voyage, 1772–75." },
  { id: "fix", g: "time", term: "A fix", on: "fix",
    cap: "A fix: latitude from the sun, longitude from the clock.",
    text: "That is a fix: a latitude from the sun and a longitude from the clock. The East India Company (chartered 1600) and the Dutch VOC (1602) ran their fleets on the first and a guess at the second." },

  // ---------- any star, the clock, the coast and the sea (sections 3 to 9) ----------
  { id: "intercept", g: "sight", term: "The intercept", on: "plot:lop",
    cap: "The almanac says where a star should stand from your reckoning; the sextant says where it does. A minute's difference is a mile.",
    text: "Work out, from the almanac, how high a star ought to stand if you were where you reckon. The sextant says how high it does stand. Each minute of difference is one nautical mile: toward the star if it stands higher than reckoned, away from it if lower. Mark that distance from your reckoning along the star's bearing and draw the line of position across it, at right angles. You are somewhere on that line." },
  { id: "twolines", g: "sight", term: "Two lines", on: "fix:lop",
    cap: "One line says how far along; two lines that cross say where.",
    text: "One star gives a line, and you are somewhere on it. A second star in another quarter of the sky gives a second line, and you are where they cross. The nearer the two stars stand to a right angle apart, the cleaner the cross; two stars side by side give lines that lie almost on top of each other and tell you little." },
  { id: "clockstar", g: "time", term: "A star and the clock", on: "plot:clock",
    cap: "A star on the meridian hardly climbs; one in the east or west climbs fastest, and a wrong clock moves its line.",
    text: "A star climbs or falls by about 15′ for every minute of time at its fastest, when it stands due east or west, and hardly at all when it stands due south or north. The almanac needs the time to say where the star should be, so a clock a minute wrong moves an east or west star's line by up to 15 miles and a meridian star's by almost none. Two stars in different quarters show which way the clock errs." },
  { id: "lightline", g: "chart", term: "The bearing of a light", on: "light",
    cap: "A light's bearing is a line through the light, as a star's is a line across the sea.",
    text: "A lighthouse stands on the chart where it stands on the coast. Take its compass bearing, put right the compass's known error, and you are on a line through the light running the opposite way. How far off you can see it depends on the height of the light and of your eye: about 1.17 times the square root of each height in feet, in miles, added together, and less in haze." },
  { id: "gale", g: "chart", term: "The sea's own hand", on: "gale",
    cap: "In a gale the log cannot show what the sea does: the ship is set and drifts to leeward.",
    text: "A ship in a gale makes leeway, a sideways slip the log does not count, and the whole sea may be on the move. Hove to, a ship makes little headway and drifts downwind. The dead reckoning gets none of this, and the fog around it should grow accordingly: after a blow a sight is worth more than the log." },
  { id: "southpole", g: "sky", term: "No pole star", on: "south",
    cap: "South of the equator the north pole star is below the horizon, and no bright star marks the south pole.",
    text: "Polaris sinks below the horizon as you cross the equator, and the south celestial pole has no bright star near it (Sigma Octantis is of the fifth magnitude). Navigators in the south take any two bright stars and work the intercept, or find the pole from the Southern Cross." },
  { id: "crux", g: "sky", term: "The Southern Cross", on: ["pick:Acrux", "pick:Gacrux", "pick:Mimosa"],
    cap: "The Cross: carry its long axis four and a half times its length on, and you are at the south celestial pole.",
    text: "The Southern Cross is four bright stars in a kite, Acrux at its foot and Gacrux at its head. Carry the line from Gacrux through Acrux on for four and a half times its own length and you arrive at the south celestial pole, whose height above the horizon is your latitude south." },
  { id: "pointers", g: "sky", term: "The Pointers", on: ["pick:Hadar", "pick:Rigil Kentaurus"],
    cap: "Rigil Kentaurus and Hadar are the Pointers: they lead the eye to the Cross.",
    text: "Two bright stars close together, Rigil Kentaurus and Hadar, in the legs of the Centaur, point at the Southern Cross. Rigil Kentaurus is the nearest bright star to us, a little over four light years away." },
];

const BY_ID = new Map(NOTES.map(n => [n.id, n]));
export const noteById = id => BY_ID.get(id) || null;
const asList = v => (Array.isArray(v) ? v : [v]);
const val = (v, ctx) => (typeof v === "function" ? v(ctx) : v);

/** The first note an event can earn that the player has not yet: it, or null. `have` is { id: 1 (heard) or 2 (whole) }. */
export const earn = (have, ev) => NOTES.find(n => !have[n.id] && asList(n.on).includes(ev)) || null;
/** The first heard note whose blank this event fills, or null. */
export const fillable = (have, ev) => NOTES.find(n => have[n.id] === 1 && n.fill && n.fill.on === ev) || null;

/** A note's words. Its blank (`{gap}`) is "___" until it is filled; a filled one shows the answer. */
export function textOf(n, have, ctx = { lat: 55 }) {
  const t = val(n.text, ctx), done = have[n.id] === 2 || !n.fill;
  return n.fill ? t.replace("{gap}", done ? n.fill.answer : "___") : t;
}
/** The short line shown the moment a note is earned; its blank is a blank. */
export const capOf = (n, ctx = { lat: 55 }) => val(n.cap, ctx);
/** What a filled blank says, for the caption that tells the player it is whole now. */
export const filledOf = (n, ctx = { lat: 55 }) => `${n.term}: ${textOf(n, { [n.id]: 2 }, ctx)}`;

/** How many notes are heard, how many in all. */
export const tally = have => ({ got: NOTES.filter(n => have[n.id]).length, of: NOTES.length });

/**
 * What the Navigation course taught is not lost: a lesson done there stands for the notes that carry it here, and they are
 * written whole (it had already told the player the answer). The lesson ids are the old course's.
 */
export const FROM_COURSE = {
  latlon: ["hanse", "latlon", "minute", "lonshrink"], mile: ["knot", "lead"], compass: ["compass", "variation"], dr: ["reckon", "brouwer"], drift: ["drift"],
  merc: ["rhumb", "mercscale"], turn: ["turn", "spin"], polaris: ["polehigh"], orion: ["orion", "sirius", "aldebaran"], astrolabe: ["astrolabe", "shades"],
  sextant: ["sextant"], corrections: ["dip", "refraction", "ho"], noon: ["noonlat", "declination"], clock: ["lontime", "chrono"],
  rate: ["clockmile", "rate", "act", "h4"], fix: ["fix"],
};
/** The notes `have` plus those the old course's finished lessons stand for. Never lowers a note. */
export function fromCourse(have, doneLessons) {
  const out = { ...have };
  for (const [lesson, ids] of Object.entries(FROM_COURSE)) if (doneLessons[lesson]) for (const id of ids) out[id] = 2;
  return out;
}
