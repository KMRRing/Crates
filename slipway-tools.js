// What the page says about each tool: its name, its picture, what it needs and what it forbids (the rules are
// slipway-puzzle.js's; these are the words), and what each refusal means. No page here.
export const TOOL = {
  saw: { name: "Saw", how: "line", icon: `<path d="M3 15l12-12 3 3-12 12z"/><path d="M5 17l-1.5 1.5M8 14l-1.5 1.5M11 11l-1.5 1.5M14 8l-1.5 1.5"/><path d="M15 3l6 6-2 2"/>`,
    brief: "Draw a line along a face seen edge-on: the cut is the plane through your eye and the line. It cannot go into the part." },
  kerf: { name: "Kerf", how: "line", icon: `<path d="M3 17h13l4-3-4-3H3z"/><path d="M6 14h9"/><path d="M19 5v7"/>`,
    brief: "The back saw scores a shoulder of the part and takes nothing. Draw along the wall, seen edge-on. The chisel needs it." },
  chisel: { name: "Chisel", how: "tap", icon: `<path d="M12 3l3 3-1.5 9h-3L9 6z"/><path d="M10.5 15h3v4h-3z"/>`,
    brief: "Chops a column 8 layers deep, square to a face you look straight at, never into end grain. Both shoulders along the grain must be scored by the kerf, or open to air." },
  plane: { name: "Plane", how: "stroke", icon: `<path d="M3 16h18v3H3z"/><path d="M6 16l3-6h7l2 6"/><path d="M12 10V6l3-2"/>`,
    brief: "Three layers a stroke, along the grain, on a flat face. It will not take end grain, a curve, or a knot." },
  shave: { name: "Shave", how: "stroke", icon: `<path d="M4 14q8-6 16 0"/><path d="M4 14v3M20 14v3"/><path d="M9 9l-1-3M15 9l1-3"/>`,
    brief: "The spokeshave follows any curve, along the grain, but only takes a thin skin: deep stock jams it. A knot stops it." },
  adze: { name: "Adze", how: "stroke", icon: `<path d="M5 20L16 5"/><path d="M13 4l7 3-3 5z"/>`,
    brief: "Rough work: five layers a stroke, across the grain, on any surface, and it leaves a rough skin to be shaved." },
  drill: { name: "Drill", how: "tap", icon: `<path d="M4 8h9v6H4z"/><path d="M13 10h4l3 1-3 1h-4"/><path d="M6 14v6h4v-6"/>`,
    brief: "Bores through, straight along your line of sight. It needs a square face to start on and to come out of, and wood round it to back the bit." },
  gouge: { name: "Gouge", how: "tap", icon: `<path d="M6 4l5 11"/><path d="M4 16q8 6 16 0"/><path d="M11 15l-1 3"/>`,
    brief: "Scoops a dish where the part has one. It needs a face near square and a rim of wood round it." },
};
export const TURN_ICON = `<path d="M5 12a7 7 0 0 1 12-5l2-2v6h-6l2.2-2.2A4.6 4.6 0 0 0 7.4 12"/><path d="M19 12a7 7 0 0 1-12 5l-2 2v-6h6l-2.2 2.2A4.6 4.6 0 0 0 16.6 12"/>`;
/** What a refusal means, said so that it points at the fix. */
export const WHY = {
  into: "That cut would go into the part.",
  nothing: "That takes nothing.",
  knot: "The iron stops on the knot. Take the waste (saw it, or chop it) first.",
  skates: "The tool skates off a slope. Look square at a flat face.",
  blowout: "The bit would come out ragged through a slope on the far side. Bore before either face is eased.",
  grabs: "The bit grabs the knot. Take the waste over it first.",
  splits: "The wood round it is too thin and splits. Do this while the waste still backs it, or score the shoulders first.",
  chips: "The rim round the dish is too thin and chips. Scoop it before the edge beside it is eased.",
  steep: "The gouge slides off a slope that steep.",
  slips: "There is no dish there to scoop.",
  end: "That is end grain. The plane, shave and chisel will not take it: saw it.",
  tearout: "Across the grain it tears out. Draw the stroke along the grain.",
  digs: "Along the grain the adze digs in. Draw the stroke across the grain.",
  rocks: "The sole rocks on a curve. Use the spokeshave or the adze.",
  jam: "Too much stock for the spokeshave: rough it with the adze first.",
  short: "Draw a longer stroke.",
  wall: "The back saw only scores a wall of the part. Draw along one, seen edge-on.",
  scored: "That shoulder is already scored.",
  miss: "Nothing there.",
};
export const VIEW_WORDS = { side: "the Side view", top: "the Top view", end: "the End view", corner: "the Corner view" };
/** Where the parts of the cog are, for the fitting at the end (a point in a 100 x 60 drawing). */
export const SPOT = { mast: [50, 16], hull: [30, 40], rig: [68, 20], rudder: [88, 40], bow: [10, 36], deck: [50, 33], keel: [50, 50] };
