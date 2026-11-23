// Settle's metals, recipes and guilds, all in one file so the fact check is one pass (Korbi, 6 November 2026: "every recipe,
// percentage and guild name is from memory and needs the fact check before it ships"). Checked on 8 November 2026 against
// the sources named beside each; a line that says "stylised" is the game's own.
//
// A measure is one unit of metal, all measures weigh the same, so a recipe's ratio is its mass ratio. Metals settle by real density
// (g/cm³, rounded to one place), so the order in a crucible is never the player's choice.

/**
 * The metals. glyph: the alchemists' sign, drawn on a 24-unit square as strokes (so it needs no font); shine: how bright a
 * pool of it is, 0 matt to 1 mirror (tin and copper gleam, lead is dull); base and hi: the pool's body and its highlight.
 * Zinc had no sign of its own in the old tables (it was identified as a metal in Europe only in the 1500s to 1700s), so its
 * mark is a plain Z with a bar. Dross, the burn-off of zinc, is lighter than every metal, so it floats.
 */
export const METALS = {
  Pb: { name: "Lead", dens: 11.3, planet: "Saturn", glyph: "M8 3v11M5 6h6M8 10c3-3 8-2 7 3c-.6 3-3 4-3 8", shine: .25, base: "#5d6e92", hi: "#9aa9c8" },
  Cu: { name: "Copper", dens: 9.0, planet: "Venus", glyph: "M12 3a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 13v9M8 18h8", shine: .7, base: "#c0602c", hi: "#f0a46b" },
  Sn: { name: "Tin", dens: 7.3, planet: "Jupiter", glyph: "M4 8c0-4 6-5 7-1c1 3-4 6-7 9h13M15 3v18", shine: .95, base: "#bfc7d0", hi: "#ffffff" },
  Zn: { name: "Zinc", dens: 7.1, planet: null, glyph: "M6 6h12L6 18h12M9 12h6", shine: .5, base: "#5a9f97", hi: "#a6dcd2" },
  X: { name: "Dross", dens: 0, planet: null, glyph: "M6 17h12M8 12h8M10 7h4", shine: .05, base: "#6b6258", hi: "#9a8f83" },
  // 13 November 2026 (Korbi: five chapters, each a metal combination with its own mechanic): bronze, what a stirred crucible of three
  // copper to one tin becomes (8.8: tin bronze runs 8.7 to 8.9); charcoal, the cover that keeps zinc from boiling off (it floats on
  // everything); black copper, copper with silver in it, as it came from the Saxon and Tyrolean mines (as dense as copper); rich lead,
  // the lead that has drawn the silver out of it in the liquation (the Saigerprozess), as dense as lead. (23 Nov 2026: black copper
  // a hair lighter than copper and rich lead than lead, stylised, so that two that lie together always lie one way.)
  Bz: { name: "Bronze", dens: 8.8, planet: null, glyph: "M7 4v16M7 4h6a4 4 0 0 1 0 8H7M7 12h7a4 4 0 0 1 0 8H7", shine: .6, base: "#9a6a2c", hi: "#e0b066" },
  C: { name: "Charcoal", dens: 0.5, planet: null, glyph: "M5 15c2-6 6-9 14-10M8 18c2-4 5-6 10-7", shine: .02, base: "#2c2622", hi: "#5a504a" },
  Bk: { name: "Black copper", dens: 8.95, planet: "Venus", glyph: "M12 3a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 13v9M8 18h8M9 8h6", shine: .35, base: "#5a3424", hi: "#a8705a" },
  Pr: { name: "Rich lead", dens: 11.25, planet: "Saturn", glyph: "M8 3v11M5 6h6M8 10c3-3 8-2 7 3c-.6 3-3 4-3 8M17 4a3 3 0 1 0 0 .1", shine: .55, base: "#7d86a0", hi: "#e4e8f2" },
};

/**
 * The moulds (23 November 2026, the redesign): each a recipe in measures, every measure the same weight, so a recipe's ratio is
 * its mass ratio. A crucible holding exactly a recipe is cast. real: what the real thing is, from the sources:
 *  - pig lead, copper ingots and block tin: the smelters' bars (pigs of lead; ingots; tin was cast in blocks and bars);
 *  - plumber's solder, 50/50 tin and lead: the long-standing plumbing solder (Lucas-Milhaupt and Harris data sheets; US patent
 *    4,758,407: "the most popular plumbing solder up until the present... 50% lead and 50% tin");
 *  - fine solder, two tin to one lead: tin–lead solders run from 5 % to 70 % tin (Wikipedia, Solder); 63/37 is the eutectic;
 *  - pewter, three tin to one lead: pewter made outside London ran to 25 % lead (Wikipedia, English pewter);
 *  - bell metal, three copper to one tin: about 78 % copper and 22 % tin (Wikipedia, Bell metal);
 *  - speculum, two copper to one tin: the mirror metal of the old telescopes, about 68 % copper (Wikipedia, Speculum metal);
 *  - hard metal, two tin to one copper: the pewterers' tin hardened with copper, the ratio stylised (real hard metal held far
 *    less copper: Wikipedia, Pewter).
 */
export const MOULDS = {
  pig: { name: "Pig of lead", real: "lead as the smelter cast it" },
  ingot: { name: "Copper ingot", real: "copper as the smelter cast it" },
  block: { name: "Block tin", real: "tin as the smelter cast it" },
  plumber: { name: "Plumber's solder", parts: { Sn: 1, Pb: 1 }, real: "50/50 tin and lead, the old plumbing solder" },
  fine: { name: "Fine solder", parts: { Sn: 2, Pb: 1 }, real: "about two parts tin to one of lead" },
  pewter: { name: "Pewter", parts: { Sn: 3, Pb: 1 }, real: "tin with a quarter lead, as country pewter was" },
  bell: { name: "Bell metal", parts: { Cu: 3, Sn: 1 }, real: "about 78 % copper and 22 % tin" },
  speculum: { name: "Speculum", parts: { Cu: 2, Sn: 1 }, real: "the old telescopes' mirror metal, about two copper to one tin" },
  hard: { name: "Hard metal", parts: { Sn: 2, Cu: 1 }, real: "tin hardened with copper (stylised: real hard metal held far less)" },
  // 23 November 2026, the campaign's later chapters:
  //  - spelter: zinc as it was cast and traded, in slabs (Wikipedia, Spelter);
  //  - brass, two copper to one zinc: cartridge brass is 70/30, common brasses run 60 to 70 % copper (Wikipedia, Brass);
  //  - Prince's metal, three copper to one zinc: Prince Rupert's brass, about 75 % copper and 25 % zinc (Wikipedia, Prince's metal);
  //  - pinchbeck, four copper to one zinc: the gold-like brass of watchcases, about 83 % copper (Wikipedia, Pinchbeck): stylised to 80;
  //  - work lead: the silver-rich lead the liquation draws off, cast in bars for the cupel (Werkblei; Wikipedia, Liquation).
  spelter: { name: "Spelter", real: "zinc as it was cast and traded" },
  work: { name: "Work lead", real: "the silver-rich lead of the liquation, cast for the cupel" },
  brass: { name: "Brass", parts: { Cu: 2, Zn: 1 }, real: "two copper to one zinc, as common brass is" },
  prince: { name: "Prince's metal", parts: { Cu: 3, Zn: 1 }, real: "Prince Rupert's brass, about three copper to one zinc" },
  pinchbeck: { name: "Pinchbeck", parts: { Cu: 4, Zn: 1 }, real: "the watchcases' gold-like brass (stylised: about five to one)" },
};
const PURE = { Pb: "pig", Cu: "ingot", Sn: "block", Zn: "spelter", Pr: "work" };
/** A mould by its name in a level: a recipe's id ("pewter"), or a pure bar as metal and measures ("Cu3"). */
export function mouldOf(id) {
  const m = /^(Pb|Cu|Sn|Zn|Pr)(\d)$/.exec(id);
  if (m) return { id, ...MOULDS[PURE[m[1]]], parts: { [m[1]]: Number(m[2]) } };
  if (!MOULDS[id]?.parts) throw new Error(`no mould ${id}`);
  return { id, ...MOULDS[id] };
}

/** The chapters, one new idea each (the redesign's first three; charcoal and zinc, and the liquation, come after a playtest). */
export const CHAPTERS = [
  { id: 1, name: "Settling", idea: "Metal lies by weight: lead at the foot, then copper, tin on top. Only the top pours out, and it sinks to its place wherever it lands." },
  { id: 2, name: "Alloys", idea: "A mould can want a mix. Build it from the foot up: the heavy metal poured last slips under the light." },
  { id: 3, name: "Measures", idea: "Crucibles of two to five measures: a pour stops at the rim and the rest stays behind, so a small crucible measures out one or two." },
  // 23 November 2026, Korbi: "work on a lot more levels. think of twists as well": each chapter from here one new idea, with the three
  // before it in every level (the Gears sheet's way: the common ideas recur, the chapter's own stays in its chapter and the capstones)
  { id: 4, name: "Spare metal", idea: "More metal than the moulds take: a crucible casts only its exact recipe, so a spare has to be parked where it does no harm." },
  { id: 5, name: "Dross", idea: "Dross floats on all metal and spoils a cast, and clings: wherever it is poured, the measure under it goes too. The iron slag pot takes it and never gives it back." },
  { id: 6, name: "The teapot ladle", idea: "The teapot ladle pours from its foot: its heaviest metal comes out from under the rest, dross and all." },
  { id: 7, name: "Zinc", idea: "Zinc burns away in an open crucible once the pour is done; it keeps only under charcoal, which floats on everything, never pours, and takes a place." },
  { id: 8, name: "Liquation", idea: "Lead poured onto black copper draws out its silver, measure for measure: the lead turns rich, the copper is left plain. The Saigerprozess of the Hanse's silver trade." },
];
