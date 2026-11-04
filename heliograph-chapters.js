// Heliograph's stations, five levels each, written by hand: two gentle ones that bring the station's twist, two that put it with what
// came before, and a set piece. A level: its chandelier (`hang`: a string for each place "q,r", top first, a digit for each crystal's
// colour, then b for a bolted one, f a frail one, l a lantern), its colour crystals (`gems`, which stay), fixtures, bolted mirrors
// (`pins`), and a goal whose pars are in shots (heliograph-answers.js has the designed answer, which the tests play).
const gem = (c, x, y, z) => ({ x, y, z, c });
const prism = (p, cs) => ({ k: "prism", p, cs });
const split = (p, n, r) => ({ k: "split", p, n, r });
const lamp = (p, c = -1) => ({ k: "lamp", p, c });
const shutter = (p, n, r, cycle) => ({ k: "shutter", p, n, r, ...(cycle ? { cycle } : {}) });
const clear = (a, b) => ({ kind: "clear", pars: [a, b] });
const lanterns = (a, b) => ({ kind: "beacons", pars: [a, b] });
const lamps = (mode, a, b) => ({ kind: "lamps", mode, pars: [a, b] });

export const CHAPTERS = [
  {
    name: "Heligoland", about: "The station on its rock. Where you cut decides what falls: everything under a shattered crystal comes down with it.",
    levels: [
      { name: "First light", about: "A beam up a string from below takes the whole string.", hang: { "0,0": "000" }, gems: [gem(0, -3, 3, 0)], shots: 4, goal: clear(2, 1) },
      { name: "Fair wind", about: "Three lanterns on three strings, and one shot.", hang: { "-1,0": "2020l", "0,0": "2002l", "1,0": "2200l" }, gems: [gem(0, -3, 3, 0)], shots: 4, goal: lanterns(2, 1) },
      { name: "Two colours", about: "Light through both colour crystals carries both colours.", hang: { "-1,0": "2002", "0,0": "2002", "1,0": "2002" }, gems: [gem(0, -3, 3, 0), gem(2, 3, 4, 0)], shots: 5, goal: clear(3, 2) },
      { name: "Diagonal", about: "The lanterns hang under a slanting line of gold.", hang: { "-2,0": "022", "-1,0": "202l", "0,0": "2202l", "1,0": "22202l" }, gems: [gem(0, -3, 3, 0.5)], shots: 5, goal: lanterns(3, 2) },
      { name: "Landfall", about: "Gold and blue in every string: take them down in three shots.", hang: { "-1,0": "0220", "0,0": "2002", "1,0": "0220" }, gems: [gem(0, -3, 3, 0.5), gem(2, 3.2, 4.2, -0.8)], shots: 6, goal: clear(4, 3) },
    ],
  },
  {
    name: "Visby", about: "The fleet's harbour. A bolted crystal holds its string: free it with its own colour.",
    levels: [
      { name: "Brass nut", about: "A cut above a nut frees nothing.", hang: { "0,0": "20b22" }, gems: [gem(0, -3, 3, 0.5), gem(2, 3.2, 4.2, -0.8)], shots: 5, goal: clear(3, 2) },
      { name: "Held fast", about: "Each lantern hangs from a bolted crystal: break the bolt.", hang: { "-1,0": "30b3l", "1,0": "30b3l" }, gems: [gem(0, -3, 3, 0.5)], shots: 4, goal: lanterns(2, 1) },
      { name: "Harbour chain", about: "Three lanterns, each under a nut of one colour.", hang: { "-1,0": "31b2l", "1,0": "31b2l", "0,1": "31b2l" }, gems: [gem(1, -3, 3, 0.5)], shots: 5, goal: lanterns(3, 2) },
      { name: "Double nut", about: "Two nuts on one string: each holds what is under it.", hang: { "0,0": "10b10b1" }, gems: [gem(0, -3, 3, 0.5), gem(1, 3.2, 4.2, -0.8)], shots: 5, goal: clear(3, 2) },
      { name: "Chain locker", about: "Three lanterns on five bolted strings.", hang: { "-2,0": "20b2", "-1,0": "20b2l", "0,0": "20b20b2l", "1,0": "20b2l", "2,0": "20b2" }, gems: [gem(0, -3, 3, 0.5)], shots: 5, goal: lanterns(3, 2) },
    ],
  },
  {
    name: "Reval", about: "The glassmakers' quarter. A prism splits white light in two and is never spent.",
    levels: [
      { name: "Clear glass", about: "No colour crystal: the prism is all the colour there is.", hang: { "0,0": "0101", "1,0": "1010" }, gems: [], fix: [prism([-3, 4.5, 1], [0, 1])], shots: 4, goal: clear(2, 1) },
      { name: "Red and gold", about: "Alternate colours go down whole to light of both.", hang: { "-1,0": "0303", "0,0": "3030l", "1,0": "0303" }, gems: [], fix: [prism([-3, 4.5, 1], [0, 3])], shots: 4, goal: lanterns(2, 1) },
      { name: "Spectrum", about: "Three strings of alternate colours, five deep.", hang: { "-1,0": "01010", "0,0": "10101", "1,0": "01010" }, gems: [], fix: [prism([-3, 4.5, 1], [0, 1])], shots: 5, goal: clear(3, 2) },
      { name: "Dispersion", about: "A prism and a colour crystal carry three colours.", hang: { "0,0": "0212", "1,0": "2120" }, gems: [gem(2, 3.2, 4.2, -0.8)], fix: [prism([-3, 4.5, 1], [0, 1])], shots: 5, goal: clear(3, 2) },
      { name: "Rainbow", about: "Three colours in every string: take them down in three shots.", hang: { "-1,0": "0121", "0,0": "1012", "1,0": "2101" }, gems: [gem(2, 3.2, 4.2, -0.8)], fix: [prism([-3, 4.5, 1], [0, 1])], shots: 6, goal: clear(4, 3) },
    ],
  },
  {
    name: "Bergen", about: "The wharf. A splitter is half-silvered glass: light goes on and turns, two beams in one shot.",
    levels: [
      { name: "Half-silvered", about: "Lanterns on three strings, and one shot.", hang: { "-2,0": "0l", "0,0": "20l", "2,0": "20l" }, gems: [gem(0, -3, 3, 0.5)], fix: [split([0, 6, 0], [0.707, 0.707, 0], 0.8)], shots: 4, goal: lanterns(2, 1) },
      { name: "Two ways", about: "One beam, two cuts.", hang: { "-2,0": "000", "0,0": "000", "2,0": "000" }, gems: [gem(0, -3, 3, 0.5)], fix: [split([0, 5.5, 0], [0.707, 0.707, 0], 0.8)], shots: 5, goal: clear(3, 2) },
      { name: "Crossed colours", about: "Two colours in two strings, and a splitter between.", hang: { "-1,0": "0101", "1,0": "0101" }, gems: [gem(0, -3, 3, 0.5), gem(1, 3.2, 4.2, -0.8)], fix: [split([0, 5.5, 0], [0.707, 0.707, 0], 0.8)], shots: 5, goal: clear(3, 2) },
      { name: "Quay wall", about: "Strings that end differently on each side.", hang: { "-2,0": "01", "2,0": "10", "0,0": "0110" }, gems: [gem(0, -3, 3, 0.5), gem(1, 3.2, 4.2, -0.8)], fix: [split([0, 5.5, 0], [0.707, 0.707, 0], 0.8)], shots: 6, goal: clear(4, 3) },
      { name: "Quayside", about: "Splitter, nuts and four lanterns.", hang: { "-1,0": "21b0l", "1,0": "21b0l", "0,1": "21b0l", "0,-1": "21b0l" }, gems: [gem(1, -3, 3, 0.5), gem(0, 3.2, 4.2, -0.8)], fix: [split([0, 5.5, 0], [0.707, 0.707, 0], 0.8)], shots: 6, goal: lanterns(4, 3) },
    ],
  },
  {
    name: "Danzig", about: "The signal tower. A lamp is lit by light that reaches it, and a signal is lit in order.",
    levels: [
      { name: "First lamp", about: "A lamp is lit by light that reaches it.", hang: {  }, gems: [], fix: [lamp([3, 3, -2])], shots: 4, goal: lamps("all", 2, 1) },
      { name: "Louvre", about: "A shutter stands between the light and the lamp.", hang: {  }, gems: [], fix: [shutter([0, 4, -1.4], [0, 0, 1], 1.8), lamp([0, 4, -3.4])], shots: 4, goal: lamps("all", 2, 1) },
      { name: "Both at once", about: "A splitter, and two lamps to light in one shot.", hang: {  }, gems: [], fix: [split([0, 6, 0], [0.707, 0.707, 0], 0.8), lamp([3, 6, 0]), lamp([0, 9, 0])], shots: 5, goal: lamps("together", 3, 2) },
      { name: "Colours", about: "Each lamp wants its colour; the clear one takes any.", hang: {  }, gems: [gem(0, -3, 3, 0.5), gem(2, 3.2, 4.2, -0.8)], fix: [shutter([0, 5, 0], [0, 1, 0], 2.4), lamp([0, 8, 0]), lamp([-3, 3, -2], 0), lamp([3, 3, -2], 2)], shots: 6, goal: lamps("all", 4, 3) },
      { name: "Signal", about: "A bolted mirror, turned to each lamp in order: one lamp a shot.", hang: {  }, gems: [], fix: [lamp([3, 3, -2]), lamp([-3, 5, -2]), lamp([-1.5, 8, 1.5]), shutter([0, 5, 0], [0, 1, 0], 1.6)], pins: [{"p":[0,12.5,3.4],"n":[0,1,0]}], hand: 2, shots: 6, goal: lamps("order", 4, 3) },
    ],
  },
  {
    name: "Lübeck", about: "The Holstentor, where everything meets. Cracked glass takes two hits.",
    levels: [
      { name: "Hairline", about: "A crack, then a break.", hang: { "0,0": "0f21" }, gems: [gem(0, -3, 3, 0.5)], shots: 5, goal: clear(3, 2) },
      { name: "Two cracks", about: "Two cracked crystals on one string.", hang: { "0,0": "0f2f1" }, gems: [gem(0, -3, 3, 0.5), gem(2, 3.2, 4.2, -0.8)], shots: 5, goal: clear(3, 2) },
      { name: "Fault line", about: "A prism for the colours, three cracks to make.", hang: { "0,0": "0f2f1f" }, gems: [gem(0, -3, 3, 0.5)], fix: [prism([-3, 4.5, 1], [1, 2])], shots: 5, goal: clear(3, 2) },
      { name: "Both walls", about: "Two cracked strings and a splitter.", hang: { "-1,0": "0f0", "1,0": "0f0" }, gems: [gem(0, -3, 3, 0.5)], fix: [split([0, 5.5, 0], [0.707, 0.707, 0], 0.8)], shots: 6, goal: clear(4, 3) },
      { name: "The Holstentor", about: "Lanterns under cracked glass: four shots.", hang: { "-1,0": "0f31l", "1,0": "0f31l" }, gems: [gem(0, -3, 3, 0.5)], shots: 7, goal: lanterns(5, 4) },
    ],
  },
];
