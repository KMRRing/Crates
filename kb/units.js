// What a unit measures. A question's unit is free text ("km", "$ billion", "million barrels a day"), but a few of them are
// sizes of one thing, and a line in Order can put a hectare beside a square kilometre, or a bridge in metres beside a
// canal in kilometres, if it knows how many of one a unit is of the dimension's base. A unit that isn't listed stands
// alone: only questions in that unit share a line. The base is whatever makes the factors plain numbers.
//
// A unit is listed only where every question in it counts the same thing: "people" is a head count, so Switzerland's
// population per square kilometre is "people per km²", not "people", and a currency never mixes with another (no rate
// is kept), nor does a rate with an amount.
export const DIMENSIONS = {
  length: { label: "lengths", base: "metres" },
  area: { label: "areas", base: "m²" },
  headcount: { label: "numbers of people", base: "people" },
  mass: { label: "masses", base: "kg" },
  volume: { label: "volumes", base: "litres" },
  dollars: { label: "sums in dollars", base: "$" },
  pounds: { label: "sums in pounds", base: "£" },
  pressure: { label: "pressures", base: "kPa" },
  density: { label: "densities", base: "kg/m³" },
  heat: { label: "energy per litre", base: "MJ/L" },
  barrel: { label: "prices a barrel", base: "$ a barrel" },
};
/** unit → [dimension, how many of the dimension's base one of it is] */
export const UNITS = {
  cm: ["length", 0.01], metres: ["length", 1], km: ["length", 1000],
  hectares: ["area", 1e4], "thousand hectares": ["area", 1e7], "km²": ["area", 1e6], "million km²": ["area", 1e12],
  people: ["headcount", 1], million: ["headcount", 1e6],
  kg: ["mass", 1], "million tonnes": ["mass", 1e9],
  litres: ["volume", 1], "million hectolitres": ["volume", 1e8],
  "$ million": ["dollars", 1e6], "$ billion": ["dollars", 1e9], "$ trillion": ["dollars", 1e12],
  "£ million": ["pounds", 1e6], "£ billion": ["pounds", 1e9],
  kPa: ["pressure", 1], bar: ["pressure", 100],
  "kg/m³": ["density", 1], "kg per litre": ["density", 1000],
  "MJ/L": ["heat", 1], "MJ per litre": ["heat", 1],
  "$ a barrel": ["barrel", 1], "$ per barrel": ["barrel", 1],
};
/** What a unit is a size of: its dimension, or the unit itself when nothing else shares it. */
export const dimensionOf = unit => UNITS[unit]?.[0] ?? unit;
/** A value in a unit, in its dimension's base: the number to compare with another card's in the same dimension. */
export const sizeOf = (value, unit) => value * (UNITS[unit]?.[1] ?? 1);
