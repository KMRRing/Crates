// What the codex tells: for each constellation Landfall teaches, how to find it, a story or a fact, when it stands high in the
// evening, and the mastery the player has earned. Words only, and the sky's own arithmetic for the months. Knowledge, never power:
// nothing here changes how a voyage plays.
import { FIGURES } from "./landfall-figures.js";
import { STARS } from "./landfall-stars.js";
import { julianDate, starAltAz, calendar } from "./landfall-sky.js";

export const MASTERY = ["not seen yet", "seen", "named with a hint", "found without one"];

export const LORE = {
  UMa: {
    rule: "Merak and Dubhe, the two stars at the end of the Plough's bowl, point to Polaris: carry their gap five times on.",
    story: "In the Greek tale Callisto was changed into a bear and set among the stars; her son Arcas follows as the Little Bear.",
    fact: "Five of its seven stars, all but Dubhe and Alkaid at the two ends, are drifting through space together, a family that formed together.",
    german: "To a German sailor it is the Großer Wagen, the Great Wagon, and the Little Bear is the Kleiner Wagen.",
  },
  UMi: {
    rule: "Polaris is the tip of the Little Bear's tail. Find it by the Plough's pointers, or from Cassiopeia across the pole.",
    story: "One Greek tale makes the Little Bear Arcas, the son of Callisto; the sailors of the north made it their guide.",
    fact: "Polaris is not quite on the pole: in 1856 it stood 1° 22′ from it, about 0° 40′ today. The almanac's correction is that gap.",
    german: "The Kleiner Wagen, the Little Wagon; Polaris is the Polarstern, the pole star.",
  },
  Cas: {
    rule: "Cassiopeia is a W of five stars. It and the Plough stand on opposite sides of Polaris: when one is low, the other is high.",
    story: "Cassiopeia was the vain queen of Aethiopia, who boasted of her beauty and was set in the sky on her throne, which tips her upside down for half of every night.",
    fact: "Its five stars are nearly equally bright, which is what makes the W so easy to pick out, even through haze.",
    german: "Kassiopeia, which a German sailor calls the Himmels-W, the W in the sky.",
  },
};

/** How a sight works, in four lines, for the first visit and the menu. */
export const HOW = [
  ["Find the pole star", "Look north. The Plough or Cassiopeia leads you to Polaris. Tap it to choose it."],
  ["Bring it to the horizon", "Drag in the eyepiece to bring the star down onto the horizon. The lens closes in as you near it. The drum on the right is finer."],
  ["Centre it and mark", "The swell makes the star bob. Settle it so it swings evenly about the horizon, then tap Mark. Three marks, averaged, beat one."],
  ["Read the latitude", "The almanac turns your reading into the latitude. The pole star stands as high as you are far north, and the fog around the ship collapses along that line."],
];

/** How the sun is taken, for the first noon watch and the menu. */
export const HOW_STAR = [
  ["Any bright star", "The pole star is not the only one. The almanac names the stars worth taking tonight; tap one, bring it to the horizon and read it as before. Take two that stand well apart."],
  ["The intercept", "The almanac works out how high the star should stand from where you reckon you are. The difference from what the sextant says is the intercept: a minute is a mile, toward the star if it stands higher than reckoned, away if lower."],
  ["A line, and then a fix", "The intercept is drawn across the chart at right angles to the star's bearing: you are somewhere along that line. A second star in another quarter makes a second line, and you are where they cross."],
  ["The clock and the light", "A star in the east or west climbs fastest, so a wrong chronometer moves its line: two stars show which way the clock errs. A light, when it is in sight, is a line too: take its compass bearing."],
];
/** How the lead is cast, for the first voyage of the lead's chapter and the menu. */
export const HOW_LEAD = [
  ["The lead", "On a coast whose bottom is charted, Lead heaves the ship to and casts the deep-sea lead: a quarter of an hour of the watch, once a watch, by day or night."],
  ["A depth is a line", "The chart's soundings and dotted contours show the bottom. The depth you find puts you on its contour: where the bottom shelves up to the coast, that says how far off the land you are, which is how far you have run."],
  ["Read it against a fix", "A flat bottom says nothing, and a bank has the same depth on both its sides. Take your stars first and sound after: a depth far from the reckoning is not plotted."],
  ["The bottom", "Tallow in the lead's foot brings up the bottom: rock on a ledge, sand and shell on a bank, mud in a hole, gravel close to the land. The chart prints the same words beside its soundings."],
];
export const HOW_SUN = [
  ["The morning altitude", "Press the sextant button while the sun is still climbing. Bring its lower edge down to the horizon with the drum and mark it. The chronometer notes the time to the second."],
  ["The noon altitude", "Wait for noon by your reckoning (the almanac gives it). The sun stops climbing and hangs. Keep its lower edge on the horizon and mark when it has stopped rising: that height gives the latitude."],
  ["The catch", "The drum stays where the morning sight set it. The sun is now falling back to that height. Press Now the moment its lower edge touches the horizon. Noon is half way between the two times, and the clock turns noon into the longitude."],
  ["Cloud and the night", "Cloud can take the sun at the wrong minute: then skip the sight and let the pole star carry the night. The pole star never gives the longitude; only the sun and the clock do."],
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The months in which a figure stands highest at nine in the evening, local mean time, in an 1850s year at latitude 55 degrees: "Mar to May". */
export function monthsHigh(figure, lat = 55) {
  const des = FIGURES[figure].key[0], star = STARS.find(s => s[2] === des);
  const alt = MONTHS.map((_, m) => starAltAz(star, julianDate(1856, m + 1, 15, 21), lat, 0).alt);
  const top = Math.max(...alt), flat = top - Math.min(...alt) < 15;           // Polaris hardly moves: it is the same all year
  if (flat) return { always: true, altitude: Math.round(top) };
  const hi = alt.map((a, i) => (a > top - 12 ? i : -1)).filter(i => i >= 0);
  // the run of months around the best one (months wrap round the year)
  const best = alt.indexOf(top), run = [best];
  for (let d = 1; d < 12; d++) { const i = (best + d) % 12, j = (best - d + 12) % 12; if (hi.includes(i) && run.at(-1) === (i + 11) % 12) run.push(i); if (hi.includes(j) && run[0] === (j + 1) % 12) run.unshift(j); }
  return { best: MONTHS[best], from: MONTHS[run[0]], to: MONTHS[run.at(-1)], altitude: Math.round(top) };
}
export const monthsText = figure => { const m = monthsHigh(figure); if (m.always) return "up all night, every night of the year, at about the height of your latitude"; return m.from === m.to ? `highest at nine in the evening in ${m.best}` : `highest at nine in the evening from ${m.from} to ${m.to}, best in ${m.best}`; };
