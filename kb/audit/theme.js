// The theme tier (docs/the-knowledge-base.md, "Who the games ask about"): material that is no school curriculum's but is the
// game's own world, kept in the default build beside the universal and the regional. 3 November 2026; Korbi: "a slight bias
// towards german, bavarian, scottish, alpine, mercantile, hanseatic is ok since that's the theme of the game. bit of oil,
// also ok although obviously in no curriculum."
// tools/audit-theme.mjs reads this and promotes an entity marked specialist (s) or personal (p) to t; a universal or
// regional mark stays (it is dealt anyway), a living person is never promoted. The marks are then kb/audit/marks.js's: change
// one there. A new entity is checked against these lists when audit-marks.mjs adds it.

/** Whole sets: Bavaria, Scotland, the Alps, Switzerland's lake, mercantile people, German ranks, wine places. */
export const THEME_SETS = [
  "bavaria-place", "bavarian-word", "bavaria-thing", "bavaria-person", "bavarian-company", "bavarian-district",
  "scotland-place", "scots-word", "scottish-inventor",
  "ski-race", "ski-thing", "ski-person", "great-skier", "lake-geneva-place",
  "merchant-person", "german-rank", "german-style", "wine-place",
];
/** An Alpine resort is theme; these are resorts of other ranges (the Rockies, Japan, Scandinavia): not theme. */
export const NOT_ALPINE = new Set(["whistler-resort", "aspen", "vail", "jackson-hole", "park-city", "niseko", "hakuba", "are", "lillehammer", "holmenkollen", "lake-placid", "palisades-tahoe"]);
/** Anything with one of these countries (museums, cathedrals, palaces, towns), unless it is in a set below. */
export const THEME_COUNTRY = new Set(["Germany", "Switzerland", "Austria", "Liechtenstein", "Scotland"]);
export const COUNTRY_NOT = ["watch-valley-place", "watch-brand", "art-market-place", "art-market-thing", "art-fair", "trade-place", "auction-house", "art-dealer"];
/** Sayings in German, Swiss German, Scots or Bavarian. */
export const THEME_LANG = /^(de|gsw|bar|sco)(-|$)/;

/** English and Latin sayings are the game's own language and the common stock of the English-speaking world: regional, not specialist. */
export const REGIONAL_SAYING_LANG = /^(en|la)$/;

/** Single entities, by id. */
export const THEME_IDS = new Set(`
  jakob-fugger mayer-amschel-rothschild john-law warren-hastings kontor gdansk danzig riga bruges antwerp medici lloyd-s bank-of-england bank-of-scotland stockfish salzburg tyrol
  beer-hall-putsch pilsner rauchbier order-of-st-hubert pour-le-merite order-of-the-black-eagle golden-bull weimar-constitution manfred-von-richthofen
  highland-clearances mary-queen-of-scots scotch-whisky haggis whisky whiskey scotch-broth highland-evening-dress order-of-the-thistle st-giles-cathedral robert-the-bruce andrew-carnegie
  flora-macdonald james-vi-and-i union-of-1707 dolly-the-sheep highland-games hogmanay burns-night national-museum-of-scotland dress-act
  magna-carta runnymede edward-i king-john henry-vii william-the-conqueror bosworth-field battle-abbey cromford-mill ironbridge richard-arkwright
`.split(/\s+/).filter(Boolean));

/** "A bit of oil" (crude, OPEC, how a refinery works, the producers, the famous events): general, no grades, codes or market data. */
export const OIL_IDS = new Set(`
  opec 1973-embargo spindletop exxon-valdez deepwater-horizon oil-sands refinery refineries rockefeller ghawar the-ghawar-oilfield saudi-aramco aramco strait-of-hormuz hormuz
  shell bp exxonmobil chevron prudhoe-bay the-daqing-oilfield baku-oil offshore-oil shale fracking oil-pipeline suez-canal barrel sullom-voe aberdeen
`.split(/\s+/).filter(Boolean));
