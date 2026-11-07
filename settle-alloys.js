// Settle's metals, recipes and guilds, all in one file so the fact check is one pass (Korbi, 6 November 2026: "every recipe,
// percentage and guild name is from memory and needs the fact check before it ships"). Checked on 8 November 2026 against
// the sources named beside each; a line that says "stylised" is the game's own.
//
// A parcel is one unit of metal, all parcels weigh the same, so a recipe's ratio is its mass ratio: 2 copper to 1 zinc is
// 67 % copper. Metals settle by real density (g/cm³, rounded to one place), so the stacks are never the player's choice.

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
};
export const DROSS = "X";
/** The metals a player is ever dealt (dross only comes from zinc burning). */
export const DEALT = ["Pb", "Cu", "Sn", "Zn"];
/** Heavier first: where a parcel of each settles among the rest. */
export const heavier = (a, b) => METALS[a].dens >= METALS[b].dens;

/**
 * The orders. parts: the parcels of each metal (they add up to w × k); w crucibles wide by k levels tall. A block ships when
 * the parcels in it are exactly the parts, in any arrangement. real: what the real alloy is, from the sources:
 *  - plumber's solder, 50/50 tin–lead: the long-standing general plumbing and sheet-metal solder (Lucas-Milhaupt and Harris
 *    data sheets; US patent 4,758,407: "the most popular plumbing solder up until the present... 50% lead and 50% tin");
 *  - fine solder, two tin to one lead: tin–lead solders run from 5 % to 70 % tin (Wikipedia, Solder);
 *  - solder, 5:3 (62.5 % tin): the 60/40 and 63/37 tin–lead compositions are most of the lead solder in use (McCampbell
 *    catalogue); 63/37 is the eutectic;
 *  - lay pewter, 7:1 (87.5 % tin): the Pewterers' lay metal was tin with up to about 15 % lead for mugs and holloware, and
 *    pewter made outside London ran to 25 % (Wikipedia, English pewter; Material Intelligence, "Pewter, the advantageous
 *    alloy"; Magazine Antiques 2013); the 1860 Britannica gives 80 : 20 as the theoretical common pewter;
 *  - brass, 2:1 (67 % copper): yellow brass sits at 65–70 % copper; cartridge brass is 70/30 (Copper Development Assoc.);
 *  - Prince's metal, 3:1 (75 % copper): Ure, 1856, gives "3 parts copper and 1 part zinc" (Wikipedia, Tombac);
 *  - tombac, 5:1 (83 % copper): a high-copper brass with 5–20 % zinc; Ure's gilting tombac is 82 % copper, 18 % zinc.
 */
export const RECIPES = {
  plumber: { name: "Plumber's solder", parts: { Sn: 1, Pb: 1 }, w: 2, k: 1, real: "50/50 tin and lead, the old plumbing solder" },
  fine: { name: "Fine solder", parts: { Sn: 2, Pb: 1 }, w: 3, k: 1, real: "about two parts tin to one of lead" },
  solder: { name: "Soft solder", parts: { Sn: 5, Pb: 3 }, w: 4, k: 2, real: "about 63 % tin, the 63/37 solder" },
  lay: { name: "Lay pewter", parts: { Sn: 7, Pb: 1 }, w: 4, k: 2, real: "tin with up to about 15 % lead, for mugs" },
  brass: { name: "Brass", parts: { Cu: 2, Zn: 1 }, w: 3, k: 1, real: "about 65–70 % copper" },
  prince: { name: "Prince's metal", parts: { Cu: 3, Zn: 1 }, w: 4, k: 1, real: "3 copper to 1 zinc, as Ure gave it" },
  tombac: { name: "Tombac", parts: { Cu: 5, Zn: 1 }, w: 3, k: 2, real: "copper with 5–20 % zinc, for gilt trinkets" },
};
for (const [id, r] of Object.entries(RECIPES)) {
  r.id = id;
  r.n = r.w * r.k;
  if (Object.values(r.parts).reduce((a, b) => a + b, 0) !== r.n) throw new Error(`${id}: the parcels must add up to ${r.w} × ${r.k}`);
}

/**
 * The tiers, one guild each: cols the crucibles (the shorter a row, the taller each); orders its recipes; idea the one new
 * thing. German names with the English beside (Korbi's default, not vetoed). Zinngießer, Rotgießer and Glockengießer are
 * the real trades; the Nuremberg trade lists give Zinngießer and Kandelgießer (jug pewterers) together, and Rotgießer
 * beside Gelbgießer and Rotschmied (Epilog, Schmiedekunst und Glockenguss; Heidelberg, Germanisches Nationalmuseum
 * Mitteilungen). The plan's "Lötmeister" could not be found as a guild, so the second tier takes Kandelgießer.
 */
export const TIERS = [
  { id: 1, guild: "Zinngießer", en: "Pewterers", cols: 3, height: 8, orders: ["plumber", "fine"], idea: "A recipe lined up across the crucibles at one level is drawn off." },
  { id: 2, guild: "Kandelgießer", en: "Jug pewterers", cols: 4, height: 7, orders: ["solder", "lay"], idea: "Orders two levels tall: both rows of the block must be the recipe." },
  { id: 3, guild: "Rotgießer", en: "Brass founders", cols: 4, height: 7, orders: ["brass", "prince", "tombac"], idea: "Zinc left on top burns to dross: skim it off.", zinc: true },
];
export const BURN = 6;       // pours zinc may stand on top before it burns
export const SKIM_NOTE = "Skim takes the dross off a crucible's top. It costs a turn.";
