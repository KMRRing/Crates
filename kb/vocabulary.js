// The knowledge base's vocabulary: every word kb/ uses to say something, defined once. Korbi, 10 Nov 2026: "a final vision
// that accounts for everything", with links that carry facts of their own (rice and China: the biggest grower, so many
// tonnes a year).
//
// The model. Everything kb/ knows is a statement: a thing, a property, a value, and qualifiers (facts about the statement).
//   - A thing (entities.js) holds its own facts as fields: Norway's `area`, the Mona Lisa's `year`, a resort's `top`.
//   - A link (links.js) is a statement whose value is another thing: Mona Lisa `hangs-in` Louvre. It holds its own facts
//     in `facts`, keyed by FACTS below: when, how far, how much, which rank, as of when and on whose word.
//   - A step is a statement on a thing that is not a thing itself: a story's events, a person's acts (`meetings`). It has
//     words, a place in order, and may have a date and a place.
//   - A set is a thing; its members are linked to it.
// What a value is, and how it reads, is here: a game or the Almanac never guesses a unit or a label, and tests/kb-vocab.mjs
// fails for any field, link type, fact, aspect or kind kb/ uses that isn't defined here. kb/graph.js reads kb/ through
// this, as statements. Aspects and kinds are words, not things: a thing is something a game can ask for or answer with.

/** The kinds of value. `quantity` has a unit (the field's, or for a link's fact its own `unit`); a `year` is a whole year,
 *  negative before Christ; a `period` is written as people write it ("c. 1250–1669", "from 1832") and read by period();
 *  a `ref` names another thing, by id or by name, and is a link when it names one; `acts` are steps (a list of records). */
export const TYPES = ["text", "texts", "number", "quantity", "year", "period", "lat", "lon", "ref", "refs", "flag", "record", "acts", "tags", "lang"];

// role: what the field is to the thing. `fact` is knowledge (the Almanac shows it; a game may ask it); `name` is what the
// thing is called; `play` is a game's own (a difficulty, a stage, wrong options); `meta` is about the entry itself.
const f = (type, label, more = {}) => ({ type, label, role: "fact", ...more });
const name = (type, label) => ({ type, label, role: "name" });
const play = (type, label) => ({ type, label, role: "play" });
const meta = (type, label) => ({ type, label, role: "meta" });

/** Every field a thing may have. */
export const FIELDS = {
  // what it is called, and what it is
  id: name("text", "Id"), name: name("text", "Name"), aliases: name("texts", "Also called"), qualifier: name("text", "Told apart as"),
  short: name("text", "Short name"), title: name("text", "Full title"), called: name("text", "In English"), same: meta("ref", "The same as"),
  sets: meta("tags", "Kinds"), pic: meta("text", "Picture"), kindBy: meta("text", "Kind set by"),
  // said about it
  note: f("text", "Note"), text: f("text", "Words"), lang: f("lang", "Language"), meaning: f("text", "Means"), literal: f("text", "Literally"),
  rendering: f("text", "In English"), english: f("text", "In English"), origin: f("text", "Origin"), who: f("text", "Said by"), form: f("text", "Form"),
  branch: f("text", "Branch of law"), domain: f("text", "Domain"), symbol: f("text", "Symbol"), custom: f("text", "Custom"), kind: f("text", "Feature"),
  nat: f("text", "Nationality"), makes: f("text", "Makes"), group: f("text", "Group"), signature: f("text", "Signature"), founder: f("text", "Founder"),
  seat: f("text", "Seat"), men: f("text", "Men wear"), when: f("text", "Worn"), motto: f("text", "Motto"), mottoEn: f("text", "Motto in English"),
  gave: f("text", "Gave"), feat: f("text", "Known for"), taught: f("text", "Taught"), skiArea: f("text", "Ski area"),
  // a merchant power's card
  family: f("text", "Family"), where: f("text", "Where"), traded: f("text", "Traded"), model: f("text", "How it worked"), ruled: f("text", "Ruled"),
  fell: f("text", "Fell to"), then: f("text", "Today"), dark: f("text", "Its dark side"),
  // where it is (a ref names another thing; `kind` says which kind when a name is shared, as Jupiter the god and the planet;
// `back` is how the named thing lists the things that name it)
  lat: f("lat", "Latitude"), lon: f("lon", "Longitude"), region: f("text", "Region"),
  country: f("ref", "Country", { loose: true }), capital: f("ref", "Capital", { loose: true, back: "Capital of" }), state: f("ref", "State", { loose: true }),
  town: f("ref", "Town", { loose: true, back: "Based here" }), at: f("ref", "Held at", { back: "Held here" }),
  roman: f("ref", "Roman name", { kind: "roman-god", back: "Greek name" }), within: f("ref", "Within", { back: "Within it" }),
  from: f("text", "From"),
  // when
  year: f("year", "Year"), circa: f("flag", "Around"), born: f("year", "Born"), died: f("year", "Died"), founded: f("year", "Founded"), span: f("period", "Span"),
  // how much
  area: f("quantity", "Area", { unit: "km²" }), population: f("quantity", "Population", { unit: "million" }), length: f("quantity", "Length", { unit: "km" }),
  depth: f("quantity", "Depth", { unit: "metres" }), top: f("quantity", "Highest point", { unit: "metres" }), height: f("quantity", "Height", { unit: "metres" }),
  rank: f("number", "Rank"),
  // records and steps
  card: f("record", "Movement"), archCard: f("record", "Style"), meetings: f("acts", "Acts"), steps: f("acts", "Steps"),
  // the games' own
  crates: play("number", "Crates' board position"), d: play("number", "Difficulty"), stage: play("text", "Stage"), wrong: play("texts", "Wrong options"),
  fromWrong: play("texts", "Wrong sources"), notWith: play("texts", "Not with"), iconic: play("flag", "Iconic"), pinCat: play("text", "Chart category"),
  marks: play("texts", "Names on the map"), anonymous: play("flag", "Anonymous"),
  unit: play("text", "Order's word for a step"), ask: play("text", "Order's question"),
};
/** The fields of a record (`card`, `archCard`) and of a step (`meetings`, `steps`). */
export const RECORD = {
  from: f("year", "From"), where: f("text", "Where"), span: f("period", "Span"), family: f("text", "Family"), against: f("text", "Against"),
  aim: f("text", "Aimed at"), tells: f("text", "How to tell it"), context: f("text", "Context"), then: f("text", "Then"),
};
export const STEP = {
  id: meta("ref", "Who"), text: f("text", "What"), what: f("text", "What"), alt: f("text", "Also put"), why: f("text", "Why it mattered"),
  year: f("year", "Year"), to: f("year", "Until"), circa: f("flag", "Around"), place: f("text", "Place"), thing: f("ref", "The thing"), pic: meta("text", "Picture"),
};

/** The facts a link may carry (`facts` on a link). A quantity's unit is in the same facts as `unit` unless given here. */
export const FACTS = {
  year: f("year", "Year"), circa: f("flag", "Around"), from: f("year", "From"), to: f("year", "Until"), asOf: f("year", "As of"),
  rank: f("number", "Rank"), role: f("text", "As"), once: f("flag", "In the past"), pos: f("number", "Place in order"),
  amount: f("quantity", "Amount"), share: f("quantity", "Share", { unit: "%" }), unit: meta("text", "Unit"),
  distance: f("quantity", "Distance", { unit: "km" }), upriver: f("quantity", "Up the river", { unit: "nm" }), by: f("text", "By"),
  source: meta("text", "Source"),
};
/** The roles a ranked link names (`role`: rice and China, rank 1 as the grower): the word, and its plural for "the biggest …". */
export const ROLES = {
  grower: "growers", producer: "producers", exporter: "exporters", importer: "importers", consumer: "consumers", miner: "miners",
  refiner: "refiners", holder: "holders of reserves", maker: "makers", buyer: "buyers", supplier: "suppliers",
};

// family: what a link is about, for grouping. locates: the link puts its thing somewhere (the target's place is the thing's
// place when it has none of its own). away is how it reads from its own thing, toward from the other.
const r = (away, toward, family, locates = false) => ({ away, toward, family, locates });
/** Every kind of link. */
export const RELS = {
  clue: r("A clue to", "Clues to it", "clue"), link: r("Linked to", "Linked from", "link"), "member-of": r("In the set", "Members", "set"),
  // where
  in: r("In", "Within it", "place", true), city: r("Stands in", "Buildings here", "place", true), "based-in": r("Based in", "Based here", "place", true),
  "held-in": r("Held in", "Held here", "place", true), "held-at": r("Held at", "Held here", "place", true), "born-in": r("Born in", "Born here", "place"),
  "made-in": r("Made in", "Made here", "place", true), "brewed-in": r("Brewed in", "Brewed here", "place", true), "distilled-on": r("Distilled on", "Distilled here", "place", true),
  "signed-in": r("Agreed at", "Agreed here", "place", true), "met-in": r("Met at", "Met here", "place", true), "sealed-at": r("Sealed at", "Sealed here", "place", true),
  "found-at": r("Found at", "Found here", "place", true), "made-at": r("Made at", "Made here", "place", true), "opened-in": r("Opened in", "Opened here", "place", true),
  "plays-at": r("Plays at", "Home of", "place", true), "runs-in": r("Runs in", "Run here", "place", true), "opens-at": r("Opens at", "Opens here", "place", true),
  under: r("Lies under", "Above it", "place", true), above: r("Above", "Below it", "place"), to: r("Ends at", "The end of", "place"), "ends-at": r("Meets the sea at", "The end of", "place"),
  on: r("On", "Things on it", "place", true), "began-at": r("Began at", "The start of", "place"), "began-in": r("Began in", "Where it began", "place"),
  "worked-in": r("Worked in", "Worked here", "place"), "buried-in": r("Buried in", "Buried here", "place"), buried: r("Buried at", "Buried here", "place"),
  "discovered-at": r("Discovered at", "Discovered here", "place"), "invented-in": r("Invented in", "Invented here", "place"), "invented-at": r("Invented at", "Invented here", "place"),
  "built-at": r("Built at", "Built here", "place"), "taught-at": r("Taught at", "Taught here", "place"), "grew-up-in": r("Grew up in", "Grew up here", "place"),
  "won-at": r("Won at", "Won here", "place"), visits: r("Visits", "Visited by", "place"), "moved-to": r("Moved to", "Moved here", "place"),
  "family-seat": r("Came from", "Home of the house of", "place"), "active-in": r("Active in", "People active here", "place"), from: r("From", "From here", "place"),
  "ruled-from": r("Ruled from", "Ruled from here", "place"), capital: r("Ruled from", "Seat of", "place"), hq: r("Ran its trade from", "Headquarters of", "place"),
  base: r("Moved to", "Base of", "place"), "last-of": r("Last emperor in", "Last emperor here", "place"), "gave-name": r("Gave her name to", "Named after", "place"),
  "ashore-at": r("Comes ashore at", "Lands here", "place"), today: r("Is today", "Once", "place"),
  // the sea (Crossing)
  borders: r("Borders", "Borders", "sea"), "sea-lane": r("Sea lane to", "Sea lane to", "sea"), "port-on": r("Port on", "Ports here", "sea", true),
  "inland-of": r("Reaches the sea at", "Inland places served", "sea"), guards: r("Guards", "Guarded by", "sea"),
  // art and building
  "painted-by": r("Painted by", "Paintings", "art"), "hangs-in": r("Hangs in", "On its walls", "art", true), movement: r("Movement", "Works", "art"),
  "designed-by": r("Designed by", "Designs", "art"), style: r("Style", "In this style", "art"), "led-to": r("Led to", "Grew out of", "art"),
  depicts: r("Depicts", "Depicted in", "art"), set: r("Set to music", "Set by", "art"), named: r("Gives its name to", "Named after", "art"),
  // words and works
  "written-by": r("Written by", "Works", "work"), "in-work": r("From the work", "Lines", "work"), about: r("The epic of", "Sung of in", "work"),
  "story-of": r("The story of", "Its story", "work"),
  // people and families
  "child-of": r("Child of", "Children", "people"), "parent-of": r("Parent of", "Parent", "people"), "mother-of": r("Mother of", "Mother", "people"),
  married: r("Married", "Married", "people"), "twin-of": r("Twin of", "Twin of", "people"), "regent-for": r("Ruled for", "Regent", "people"),
  "roman-name": r("Roman name", "Greek name", "people"), "steed-of": r("Steed of", "Rode", "people"), met: r("Received", "Received by", "people"),
  sent: r("Sent out", "Sent by", "people"), followed: r("Followed", "Followed by", "people"), celebrated: r("Celebrated on", "Celebrates", "people"),
  wore: r("Wore", "Worn by", "people"), eats: r("Feast of", "Eaten at", "people"), promised: r("Promised", "Promised by", "people"),
  killed: r("Defeated", "Defeated by", "people"), sealed: r("Sealed", "Sealed by", "people"), chapel: r("Its chapel in", "Chapel of", "people"),
  elections: r("Fixed elections at", "Elections fixed by", "people"), proclaimed: r("Proclaimed", "Proclaimed by", "people"),
  "buried-with": r("Buried with", "Buried with", "people"), owns: r("Owns", "Owned by", "people"), sells: r("Sells", "Sold by", "people"),
  "beer-hall": r("Runs", "Run by", "people"),
  // myth
  slew: r("Slew", "Slain by", "myth"), captured: r("Captured", "Captured by", "myth"), "born-of": r("Born of", "Gave birth to", "myth"),
  sought: r("Sought", "Sought by", "myth"), helped: r("Helped", "Helped by", "myth"), blinded: r("Blinded", "Blinded by", "myth"),
  passed: r("Passed", "Passed by", "myth"), "carried-off": r("Carried off", "Carried off by", "myth"), descended: r("Went down to", "Visited by", "myth"),
  answered: r("Answered", "Answered by", "myth"), defied: r("Defied", "Defied by", "myth"), granted: r("Was granted a gift by", "Granted a gift to", "myth"),
  home: r("Home", "Home of", "myth", true), keeps: r("Keeps", "Kept by", "myth"), "maimed-by": r("Maimed by", "Maimed", "myth"),
  foe: r("Foe of", "Foe of", "myth"), "slain-by": r("Slain by", "Slew", "myth"), contrived: r("Contrived the death of", "Killed by the plot of", "myth"),
  murdered: r("Murdered", "Murdered by", "myth"), embalmed: r("Embalmed", "Embalmed by", "myth"), devours: r("Devours", "Devoured by", "myth"),
  // trade and empire
  traded: r("Carried", "Carried by", "trade"), "merchant-of": r("A merchant of", "Its merchants", "trade"), market: r("Traded at", "Market of", "trade"),
  kontor: r("Counting-house at", "Counting-house of", "trade"), diet: r("Held its Diet at", "Diet of", "trade"), member: r("Counted among its towns", "Member of", "trade"),
  "bank-of": r("The bank of", "Its bank", "trade"), ran: r("Ran", "Run by", "trade"), built: r("Built", "Built by", "trade"),
  founded: r("Founded", "Founded by", "trade"), port: r("Held", "Held by", "trade"), opened: r("Opened the way for", "Opened by", "trade"),
  landed: r("Landed at", "Landfall of", "trade"), mined: r("Drew silver from", "Mined by", "trade"), admiral: r("Led by", "Led", "trade"),
  visited: r("Traded at", "Visited by", "trade"), post: r("Traded from", "Post of", "trade"), took: r("Took", "Taken by", "trade"),
  led: r("Led", "Led by", "trade"), ruled: r("Was given", "Given to", "trade"), won: r("Won at", "Won by", "trade"), served: r("Commanded the army of", "Its commander", "trade"),
  governed: r("Governed for", "Its governor", "trade"), "traded-at": r("Traded at", "Traders here", "trade"), ruined: r("Cost a fortune to", "Ruined by", "trade"),
  "slave-trade": r("A slaving post like those of", "Its slaving posts", "trade"),
};

/** The aspects a clue link may have: what it's about (Crates' topics). Each maps to Settings' subjects in topics.js (TOPIC_OF.kb). */
export const ASPECTS = {
  geo: "Geography", mkt: "Markets", mkts: "Markets", lang: "Language", hist: "History", past: "History", trade: "Trade", food: "Food", agr: "Agriculture",
  met: "Metals", nat: "Nature", cult: "Culture", pol: "Politics", sport: "Sport", co: "Companies", firm: "Companies", sci: "Science", nrg: "Energy",
  ppl: "People", fin: "Finance", style: "Style", screen: "Film & TV", orig: "Origins", logi: "Logistics", life: "Life", uses: "Uses", prod: "Production",
  spec: "Specifications", reg: "Regulation",
};

/** What a thing is: the tags in its `sets`, in words. Families (kind:…, feature:…, group:…) and the rest. Where a game plays a
 *  thing is not a tag: Census's sets are things with members, Crossing's sea and land are its links. */
export const KINDS = {
  country: "country", city: "city", commodity: "commodity", painting: "painting", museum: "museum", feature: "natural feature", building: "building",
  work: "work", author: "writer", painter: "painter", architect: "architect", person: "person", quotation: "quotation", saying: "saying", artwork: "artwork",
  "trade-place": "trade hub", "geo-place": "place", "art-place": "art place", "people-place": "place", "wine-place": "wine region", "ski-resort": "ski resort",
  "legal-maxim": "legal maxim", "legal-concept": "legal concept", "art-movement": "art movement", "architecture-style": "architectural style",
  "greek-god": "Greek god", "roman-god": "Roman god", "norse-god": "Norse god", "egyptian-god": "Egyptian god", "myth-hero": "hero of myth",
  "myth-creature": "creature of myth", "myth-place": "place of myth", "merchant-power": "merchant power", "merchant-person": "merchant",
  "trade-history": "trade history", "trade-good": "trade good", "chivalric-order": "order of chivalry", "watch-brand": "watchmaker",
  "horology-person": "watchmaker", "dress-code": "dress code", "german-rank": "German rank", "german-style": "German form of address",
  "bavaria-place": "Bavaria", "bavaria-person": "Bavaria", "bavaria-thing": "Bavaria", "bavarian-company": "Bavarian company",
  "bavarian-district": "Bavarian district", "bavarian-word": "Bavarian word", "britain-place": "Britain", "britain-person": "Britain",
  "britain-thing": "Britain", "scotland-place": "Scotland", "scots-word": "Scots word", "scottish-inventor": "Scottish inventor",
  "china-place": "China", "china-person": "China", "china-thing": "China", "chinese-province": "Chinese province", "chinese-festival": "Chinese festival",
  "chinese-thinker": "Chinese thinker", chengyu: "chengyu", "court-place": "court", "court-person": "court", "court-thing": "court",
  "art-market-place": "art market", "art-market-person": "art market", "art-market-thing": "art market", "lake-geneva-place": "Lake Geneva",
  "ski-race": "ski race", "ski-person": "skier", "ski-thing": "skiing", "great-skier": "great skier", set: "set", story: "story",
  // families: feature:<kind>, kind:<kind>, group:<group>
  "feature:desert": "desert", "feature:lake": "lake", "feature:plateau": "plateau", "feature:range": "mountain range", "feature:river": "river",
  "kind:animal": "animal", "kind:art": "art", "kind:book": "book", "kind:company": "company", "kind:craft": "craft", "kind:currency": "currency",
  "kind:custom": "custom", "kind:drink": "drink", "kind:event": "event", "kind:film": "film", "kind:food": "food", "kind:law": "law",
  "kind:market": "market", "kind:material": "material", "kind:music": "music", "kind:natural": "nature", "kind:organisation": "organisation",
  "kind:person": "person", "kind:place": "place", "kind:plant": "plant", "kind:site": "site", "kind:sport": "sport", "kind:tech": "technology",
  "kind:vehicle": "vehicle", "kind:word": "word",
  "group:eu": "Europe", "group:asia": "Asia", "group:me": "Middle East", "group:am": "Americas", "group:af": "Africa", "group:soft": "soft commodity",
  "group:met": "metal", "group:nrg": "energy", "group:grain": "grain", "group:bio": "biofuel", "group:chem": "chemical", "group:cred": "credit",
  "group:circ": "circular",
};

/** A field's label for this thing: a year is when it was painted, built or written. */
export function labelOf(key, e) {
  if (key !== "year") return FIELDS[key]?.label ?? key;
  const s = e?.sets || [];
  return s.includes("painting") || s.includes("artwork") ? "Painted" : s.includes("building") ? "Built" : s.includes("work") ? "Written" : "Year";
}
/** A year in words: 1519, 725 BC. */
export const yearWords = (y, circa = false) => `${circa ? "c. " : ""}${y < 0 ? `${-y} BC` : y}`;
/** A period as people write it, read: "c. 1250–1669" → { from: 1250, to: 1669, circa: true }; "from 1832" → { from: 1832 }. Null if it isn't one. */
export function period(text) {
  // "c. 1848–1860s" (a decade counts from its start), "c. 100 BC–AD 400", "c. 900–1300 (Five Dynasties and Song)" (the note is dropped)
  const m = /^(from )?(c\. ?)?(?:AD )?(\d{1,4})s?( BC)?(?:\s*[–-]\s*(c\. ?)?(?:AD )?(\d{1,4})s?( BC)?)?$/.exec(String(text).replace(/\s*\(.*\)$/, "").trim());
  if (!m || (m[1] && m[6])) return null;
  const year = (n, bc) => (bc ? -Number(n) : Number(n));
  const out = { from: year(m[3], m[4] || m[7]) };       // "500–300 BC": both ends are BC
  if (m[6]) out.to = year(m[6], m[7]);
  if (m[2] || m[5]) out.circa = true;
  return out;
}
