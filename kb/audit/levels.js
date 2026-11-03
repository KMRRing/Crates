// The audit's marks for items that aren't about one entity (docs/the-knowledge-base.md, "Who the games ask about"): a Punt
// level's questions (a bank's physics, chemistry, religion are curriculum topics; Bavaria's beer is not), and Quote's
// categories. An item about an entity takes the worse of its level's mark and its entity's (kb/audit/marks.js).
// u universal, r regional, s specialist, p personal. A bank or level not listed puts no limit (u).
export const LEVEL = {
  flags: { ea: "u", mi: "r", ha: "s" },
  eco: { micro: "u", macro: "u", trade: "r", ideas: "r" },
  phy: { "*": "u" },
  chm: { atoms: "u", react: "u", organic: "u", industry: "r" },
  cs: { data: "u", code: "u", design: "r", systems: "r" },
  phil: { ancient: "u", modern: "r", ethics: "u", knowledge: "r" },
  rel: { islam: "u", judchr: "u", east: "u", table: "r" },
  refining: { "*": "p" },
  law: { "*": "p" },
  artmarket: { "*": "p" },
  swiss: { "*": "s" },
  bavaria: { "*": "s" },
  skiing: { "*": "s" },
  watches: { "*": "s" },
  arch: { styles: "u", buildings: "u", parts: "r" },
  myth: { gods: "u", heroes: "u", norse: "r", egypt: "u", words: "r" },
  merchants: { ideas: "s", "*": "r" },
  titles: { peerage: "r", "*": "s" },
  britain: { history: "s", places: "s", whisky: "s", customs: "s", words: "s", wales: "s", money: "p", city: "p", science: "r", constitution: "r", england: "r" },
  china: { inventions: "u", history: "r", geography: "r", thought: "r", culture: "r", food: "s", tea: "s", trade: "p" },
  sayings: { latin: "r", german: "s", english: "r", french: "s", chinese: "s", world: "s", trading: "p", pop: "s" },
};
/** Quote's categories (kb/items/estimates.js CATS): the trade and market ones are personal. */
export const QUOTE_CAT = { trade: "p", markets: "p", refining: "p", wine: "r" };
/** Quote's old audience marks 1, 2, 3 are universal, regional (domain), specialist. */
export const AUDIENCE_MARK = { 1: "u", 2: "r", 3: "s" };
/** Who am I?'s own people (not entities in kb/) who are alive and not on the short list of the globally famous: not dealt in the published build. */
export const WHOAMI_LIVING = ["haruki-murakami", "banksy", "david-attenborough", "bob-dylan", "mick-jagger", "kylie", "adele", "ed-sheeran", "drake", "justin-bieber", "dua-lipa", "billie-eilish", "jay-chou", "meryl-streep", "morgan-freeman", "rowan-atkinson", "tom-hanks", "brad-pitt", "johnny-depp", "keanu-reeves", "will-smith", "hugh-jackman", "dwayne-johnson", "angelina-jolie", "oprah-winfrey", "gordon-ramsay", "chow-yun-fat", "andy-lau", "stephen-chow", "michelle-yeoh", "gong-li", "david-beckham", "yao-ming", "michael-schumacher", "stephen-king", "li-ka-shing"];
