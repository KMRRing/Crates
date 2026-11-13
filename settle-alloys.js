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
  // 13 November 2026 (Korbi: five chapters, each a metal combination with its own mechanic): bronze, what a stirred crucible of three
  // copper to one tin becomes (8.8: tin bronze runs 8.7 to 8.9); charcoal, the cover that keeps zinc from boiling off (it floats on
  // everything); black copper, copper with silver in it, as it came from the Saxon and Tyrolean mines (as dense as copper); rich lead,
  // the lead that has drawn the silver out of it in the liquation (the Saigerprozess), as dense as lead
  Bz: { name: "Bronze", dens: 8.8, planet: null, glyph: "M7 4v16M7 4h6a4 4 0 0 1 0 8H7M7 12h7a4 4 0 0 1 0 8H7", shine: .6, base: "#9a6a2c", hi: "#e0b066" },
  C: { name: "Charcoal", dens: 0.5, planet: null, glyph: "M5 15c2-6 6-9 14-10M8 18c2-4 5-6 10-7", shine: .02, base: "#2c2622", hi: "#5a504a" },
  Bk: { name: "Black copper", dens: 9.0, planet: "Venus", glyph: "M12 3a5 5 0 1 0 0 10a5 5 0 1 0 0-10M12 13v9M8 18h8M9 8h6", shine: .35, base: "#5a3424", hi: "#a8705a" },
  Pr: { name: "Rich lead", dens: 11.3, planet: "Saturn", glyph: "M8 3v11M5 6h6M8 10c3-3 8-2 7 3c-.6 3-3 4-3 8M17 4a3 3 0 1 0 0 .1", shine: .55, base: "#7d86a0", hi: "#e4e8f2" },
};
export const DROSS = "X", CHAR = "C";
/** The metals a player is ever dealt (dross comes from zinc burning or a spoiled stir, bronze from a stir, rich lead from liquation). */
export const DEALT = ["Pb", "Cu", "Sn", "Zn", "C", "Bk"];
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
// 13 November 2026, the chapters' new orders:
//  - hard metal, two tin to one copper: the pewterers' "hard metal" was tin hardened with copper (and antimony); the ratio is stylised
//    (real hard metal held far less copper: Wikipedia, Pewter; Hornsby, "Pewter of the Western World");
//  - fine pewter, three tin to one copper: stylised the same way (the Pewterers' "fine metal" was tin with a little copper);
//  - bronze and bell metal: bronze is what three copper to one tin becomes when stirred; bell metal is about 78 % copper and 22 % tin,
//    near enough three to one (Wikipedia, Bell metal); a bar is three parcels of it, a bell four;
//  - the liquation: argentiferous ("black") copper was melted with lead, which took the silver; the rich lead was drawn off and
//    cupelled, the copper left was refined (Wikipedia, Liquation; Saigerhütte Grünthal). Saigerblei is the rich lead, Garkupfer
//    the refined copper.
export const RECIPES = {
  hard: { name: "Hard metal", parts: { Sn: 2, Cu: 1 }, w: 3, k: 1, real: "tin hardened with copper (stylised: real hard metal held far less)" },
  finepewter: { name: "Fine pewter", parts: { Sn: 3, Cu: 1 }, w: 2, k: 2, real: "tin with a little copper (stylised)" },
  bar: { name: "Bronze bar", parts: { Bz: 3 }, w: 3, k: 1, real: "bronze, about three copper to one tin" },
  bell: { name: "Bell", parts: { Bz: 4 }, w: 2, k: 2, real: "bell metal, about 78 % copper and 22 % tin" },
  saiger: { name: "Saigerblei", parts: { Pr: 2 }, w: 2, k: 1, real: "the rich lead of the liquation, cupelled for its silver" },
  gar: { name: "Garkupfer", parts: { Cu: 3 }, w: 3, k: 1, real: "the copper left once the lead has taken its silver, refined" },
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
 * The chapters, one metal combination and one mechanic each (13 November 2026, Korbi: "settle is more like topple... maybe 5
 * different chapters and they each have different mechanics (these are the different metal combinations)"). feats: what the
 * player may do besides pouring: pot (every pour goes into the first crucible), decant (the top of a crucible into another), fire (melt the solid copper in a crucible, with
 * fuel), stir (make bronze), skim (the dross or charcoal off a top); solid: copper is poured solid; burn: zinc on top burns.
 */
export const CHAPTERS = [
  { id: 1, name: "Solder", metals: ["Pb", "Sn"], feats: { pot: true, decant: true }, orders: ["plumber", "fine", "solder"],
    idea: "Everything is poured into the melting pot, where tin floats on lead: tip the top into the moulds.", how: "Drag the top of a crucible onto another to tip it in. Every tip is a turn." },
  { id: 2, name: "Pewter", metals: ["Sn", "Cu"], feats: { fire: true }, solid: true, orders: ["hard", "finepewter"],
    idea: "Copper goes into a cold crucible solid: it stays where it lands and casts in nothing, until the crucible is fired.", how: "Fire a crucible to melt its copper (it sinks under the tin) and keep it hot. The fuel is short." },
  { id: 3, name: "Bronze", metals: ["Cu", "Sn"], feats: { stir: true, skim: true }, orders: ["bar", "bell"],
    idea: "Stir three copper to one tin and the crucible turns to bronze; any other measure spoils it.", how: "Stir a crucible that holds exactly three copper to each tin. Skim spoiled dross off." },
  { id: 4, name: "Brass", metals: ["Cu", "Zn", "C"], feats: { skim: true }, burn: true, burnAt: 2, orders: ["brass", "prince", "tombac"],
    idea: "Zinc left on top boils off in two turns: keep it under charcoal, which floats on everything.", how: "Zinc on top burns to dross after two turns. Skim dross or charcoal off a top." },
  { id: 5, name: "Silver", metals: ["Pb", "Bk", "Cu"], feats: { decant: true }, orders: ["saiger", "gar"],
    idea: "Lead sinking through black copper draws its silver out: the copper is clean, the lead rich.", how: "Pour or decant lead into a crucible of black copper. Decanting costs a turn." },
];
export const BURN = 6;       // pours zinc may stand on top before it burns
export const SKIM_NOTE = "Skim takes the dross off a crucible's top. It costs a turn.";
