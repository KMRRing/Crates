// The authored voyages of Section 1, "Polaris and the log". Pure data: the engine (landfall-engine.js) plays them, the page draws them.
//
// The SEA IS INVENTED. The latitudes and longitudes are real so that the sky is (Polaris's altitude IS the latitude), but the
// coasts, banks and harbours are made up and sit in open water of the real map. They are labelled as fiction in the menu.
//
// Chart units are nautical miles, x east and y north of the departure fix. A watch is one twilight: the sun is 4.5 degrees below
// the horizon at dusk (the watch then lasts as the sky darkens), 11 degrees below at dawn (the sky then brightens), and the
// ship sails between twilights, so `kinds` alternates night runs of 8 to 14 hours with day runs of 10 to 15.
//
// errors: log      the log's error as a fraction of speed (one persistent number per voyage, drawn from its range)
//         compass  [least, most] true compass error in degrees (sign drawn); the DR assumes it is 0 until a bearing check
//         sd       the compass error the DR is trusted to (degrees); the fog grows by it, whatever the true error
//         current  the standard deviation of the set and drift, knots
//         start    the standard deviation of the departure fix, nm
const east = (far, pts) => [...pts.map(([y, x]) => [x, y]), [far, pts[pts.length - 1][0]], [far, pts[0][0]]];
const west = (far, pts) => [...pts.map(([y, x]) => [x, y]), [far, pts[pts.length - 1][0]], [far, pts[0][0]]];

export const LEVELS = [
  {
    id: "first-watch", n: 1, name: "First Watch", place: "the Grey Sea",
    blurb: "Three nights to Skerrholm. The pole star will tell you how far north you are; the log tells you the rest.",
    lesson: "The pole star stands as high above the horizon as you are far north of the equator.",
    origin: { lat: 56.0, lon: 2.0 }, year: 1856, window: [[4, 6], [5, 2]], watches: 3, kinds: "dusk,dawn,dusk",
    speed: 5, course0: 80, leg0: 6, hint: 0, swell: 0.5,
    weather: { clear: 1 },
    errors: { log: 0.05, compass: [0.3, 1.0], sd: 1, current: 0.3, start: 0.3 },
    harbour: { name: "Skerrholm", x: 116, y: 26, r: 6.5 },
    shoals: [{ name: "Hake Bank", x: 119, y: 62, r: 4 }, { name: "Little Brann", x: 121, y: -6, r: 3.5 }],
    land: [east(190, [[-90, 132], [-50, 135], [-20, 131], [0, 134], [12, 130], [26, 126], [40, 131], [55, 135], [80, 132], [100, 136]])],
  },
  {
    id: "down-the-latitude", n: 2, name: "Running Down the Latitude", place: "the Grey Sea",
    blurb: "Find the harbour's latitude, then run along it until the land stands up. The old way, and the safest.",
    lesson: "The pole star gives your latitude and nothing else: east or west of home it is silent.",
    origin: { lat: 57.5, lon: -3.0 }, year: 1856, window: [[8, 24], [9, 25]], watches: 3, kinds: "dusk,dawn,dusk",
    speed: 5, course0: 62, leg0: 7, hint: 1, swell: 0.5,
    weather: { clear: 3, haze: 1 },
    errors: { log: 0.06, compass: [1.0, 2.0], sd: 1.5, current: 0.4, start: 0.4 },
    harbour: { name: "Havn Orrel", x: 128, y: 34, r: 6 },
    shoals: [{ name: "Gannet Rock", x: 123, y: 63, r: 5 }, { name: "Brann Ledge", x: 126, y: 6, r: 4 }],
    land: [east(200, [[-80, 142], [-30, 146], [0, 141], [14, 137], [34, 137], [52, 140], [75, 146], [110, 144]])],
  },
  {
    id: "the-compass-lies", n: 3, name: "The Compass Lies", place: "the Grey Sea",
    blurb: "Four nights, and a compass that has been wrong since Lübeck. A star's bearing will tell you by how much.",
    lesson: "A star that should stand due north and does not is the compass confessing.",
    origin: { lat: 55.0, lon: 0.5 }, year: 1856, window: [[4, 8], [5, 5]], watches: 4, kinds: "dusk,dawn,dusk,dawn",
    speed: 5, course0: 95, leg0: 6, hint: 1, swell: 0.55,
    weather: { clear: 3, haze: 1 },
    errors: { log: 0.07, compass: [2.5, 4.0], sd: 2.5, current: 0.45, start: 0.4 },
    harbour: { name: "Kalvik", x: 150, y: -20, r: 6.5 },
    shoals: [{ name: "Skarv Bank", x: 142, y: 8, r: 5 }, { name: "The Hounds", x: 146, y: -48, r: 5 }],
    land: [east(210, [[-90, 160], [-62, 158], [-34, 160], [-20, 158], [-6, 156], [14, 161], [40, 158], [70, 163]])],
  },
  {
    id: "haze-on-the-banks", n: 4, name: "Haze on the Banks", place: "the Grey Sea",
    blurb: "Westward, into haze and a lumpy sea. The horizon is soft and the star is dim; take your marks and trust the average.",
    lesson: "In swell the star will not hold still: centre it and read the drum, do not chase it.",
    origin: { lat: 58.0, lon: 6.0 }, year: 1856, window: [[9, 1], [10, 8]], watches: 4, kinds: "dusk,dawn,dusk,dawn",
    speed: 5, course0: 262, leg0: 7, hint: 1, swell: 0.9,
    weather: { haze: 3, clear: 2, swell: 2 },
    errors: { log: 0.07, compass: [1.5, 3.0], sd: 2, current: 0.5, start: 0.4 },
    harbour: { name: "Westerhaven", x: -150, y: 14, r: 6.5 },
    shoals: [{ name: "Old Man's Bank", x: -140, y: 42, r: 5 }, { name: "Seal Skerries", x: -143, y: -16, r: 5 }],
    land: [west(-220, [[-90, -158], [-50, -156], [-20, -160], [0, -156], [14, -158], [30, -154], [48, -160], [80, -157]])],
  },
  {
    id: "broken-cloud", n: 5, name: "Broken Cloud", place: "the Grey Sea",
    blurb: "A sky of moving gaps. The star is there; wait for it, and for the horizon to stay.",
    lesson: "The twilight is short. When the star shows through a gap, take it.",
    origin: { lat: 54.5, lon: 1.0 }, year: 1856, window: [[3, 26], [4, 20]], watches: 4, kinds: "dusk,dawn,dusk,dawn",
    speed: 5, course0: 70, leg0: 6, hint: 2, swell: 0.6,
    weather: { cloud: 3, clear: 2, haze: 1 },
    errors: { log: 0.07, compass: [1.5, 3.0], sd: 2, current: 0.5, start: 0.4 },
    harbour: { name: "Stenhamn", x: 160, y: 50, r: 6 },
    shoals: [{ name: "Raven Reef", x: 152, y: 78, r: 5 }, { name: "Dogger Tail", x: 154, y: 22, r: 5 }],
    land: [east(220, [[-40, 170], [0, 172], [24, 168], [38, 166], [50, 166], [66, 170], [100, 174]])],
  },
  {
    id: "the-other-side", n: 6, name: "The Other Side", place: "the Grey Sea",
    blurb: "Five autumn nights, long and dark. The rigging hides the Plough; Cassiopeia rides clear on the other side of the pole.",
    lesson: "The Plough and Cassiopeia stand on opposite sides of Polaris: when one is low, the other is high.",
    origin: { lat: 59.0, lon: 8.0 }, year: 1856, window: [[10, 6], [11, 3]], watches: 5, kinds: "dusk,dawn,dusk,dawn,dusk",
    speed: 5, course0: 255, leg0: 6, hint: 2, swell: 0.7, route: "cassiopeia",
    weather: { clear: 3, haze: 2, cloud: 2, swell: 1 },
    errors: { log: 0.08, compass: [2.5, 4.0], sd: 2.5, current: 0.55, start: 0.5 },
    harbour: { name: "Nordvik", x: -170, y: -30, r: 6 },
    shoals: [{ name: "Skarn Bank", x: -163, y: -2, r: 5 }, { name: "The Maidens", x: -166, y: -58, r: 5 }],
    land: [west(-240, [[-100, -176], [-70, -179], [-48, -176], [-30, -174], [-14, -178], [8, -176], [30, -181], [60, -178]])],
  },
];

export const levelById = id => LEVELS.find(l => l.id === id) || null;
