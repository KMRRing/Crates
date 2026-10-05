// What each of Crates' clue things is. A clue thing (Troll, Scotch broth, Eddy Merckx, La Tomatina…) came into the
// knowledge base with its links but no set: nothing said whether it's a gas field, a soup, a cyclist or a festival.
// This reads what the clue's hand-written hints say ("One of the largest offshore gas fields", "A soup thickened with
// it", "The Cannibal of cycling") and its links' aspects (People, Film, Food…), and gives it a kind only when the
// wording clearly says so: the best kind has to score 3.5 or more and beat the next by at least 1.25. A kind given this
// way is marked kindBy "words", so a person can tell it from one set by hand. Everything else is left without a kind
// and listed in kb/KINDS.md with its two best guesses, for a person to settle. Run after adding clue things; it never
// touches a thing that already has a set.  node tools/kb-kinds.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const kbFile = f => path.join(root, "kb", f);

/** The kinds, with the words in a hint that say a thing is one. */
export const KINDS = {
  person: ["People", /\b(he|she|his|her|him|born|died|king|queen|emperor|empress|president|premier|prime minister|chancellor|sultan|shah|tsar|czar|pharaoh|pope|saint|general|admiral|explorer|founder|inventor|scientist|physicist|chemist|mathematician|painter|sculptor|composer|writer|author|poet|novelist|playwright|philosopher|footballer|striker|goalkeeper|player|athlete|cyclist|runner|sprinter|swimmer|boxer|wrestler|jockey|champion|actor|actress|director|film-?maker|singer|rapper|guitarist|tycoon|magnate|billionaire|dictator|leader|ruler|revolutionary|economist|chef|designer|architect|brothers|sisters|monk|prophet|god|goddess|hero|heroine|warrior|pirate|spy|detective|laureate|minister|governor|mayor|astronaut|cosmonaut|nun|priest|bishop)\b/i],
  company: ["Companies & brands", /\b(company|companies|firm|carmaker|automaker|brand|brands|bank|airline|retailer|conglomerate|chain|miner|refiner|trading house|operator|utility|multinational|start-?up|state-owned|state-controlled|listed|corporation|manufacturer|shipping line|shipbuilder|brewer|brewery|distiller|distillery|supermarket|fashion house|joint venture|subsidiary|cooperative|co-op|makers?|chocolatier|platform company)\b/i],
  organisation: ["Organisations", /\b(agency|ministry|union|organisation|organization|council|commission|central bank|cartel|alliance|bloc|party|parliament|court|tribunal|authority|regulator|institute|university|college|association|federation|guild|army|navy|air force|police|society|foundation|charity|committee|secretariat|sovereign wealth fund)\b/i],
  place: ["Places", /\b((north|south|east|west)(ern)?|south-?west|south-?east|north-?west|north-?east|city|capital|port|town|village|island|islands|archipelago|region|province|state|district|county|peninsula|coast|bay|gulf|strait|harbour|harbor|neighbourhood|quarter|suburb|enclave|exclave|territory|colony|kingdom|oasis|square|street|resort|homeland)\b/i],
  natural: ["Nature & landscape", /\b(river|lake|mountains?|mount|peak|summit|volcano|glacier|desert|forest|rainforest|jungle|plains?|plateau|canyon|gorge|falls|waterfall|reef|sea|ocean|delta|swamp|marsh|wetlands?|steppe|savann?ah?|fjords?|inlets?|caves?|crater|tundra|ice sheet|monsoon|landscape|cliffs|dunes|geyser|hot springs?)\b/i],
  site: ["Sites & structures", /\b((pilot|power|processing|nuclear|coal|gas|biogas|desalination|bottling|treatment|chemical) plant|pits|frontier|mines?|fields?|wells?|refinery|refineries|smelter|dam|canal|pipeline|bridge|tower|palace|castle|temple|cathedral|mosque|shrine|monument|museum|stadium|arena|railway|railroad|terminal|depot|tunnel|wall|fort|fortress|concert hall|opera house|airport|factory|mill|shipyard|docks?|lighthouse|observatory|prison|ruins|statue|landmark|skyscraper|building|platform|rig|power station|plantation|estate)\b/i],
  event: ["Events & history", /\b(war|wars|battle|crisis|revolution|crash|disaster|scandal|boom|bust|mania|bubble|famine|uprising|rebellion|invasion|coup|massacre|siege|strike|spill|embargo|blockade|rush|independence|partition|summit|olympics|world cup|expo|riot|plague|pandemic|epidemic|earthquake|eruption|flood|explosion|meltdown|default|shock|collapse|reunification|unification|dynasty|occupation|exodus|expedition|voyage|landing|heist|robbery)\b/i],
  law: ["Laws, treaties & policies", /\b(law|laws|act|treaty|agreement|accord|directive|regulation|tariffs?|quotas?|subsid(y|ies)|ban|mandate|policy|scheme|programme|program|convention|protocol|tax|levy|duty|sanctions?|constitution|charter|licen[cs]e|permit|certification|certificate|charge|congestion zone)\b/i],
  market: ["Markets & benchmarks", /\b(benchmark|futures|contract|index|grade|grades|marker|spread|margin|discount|premium|auction|tender|hub|exchange|traded|quot(e|ation)|crack|ratio|price|prices)\b/i],
  film: ["Film, TV & games", /\b(film|films|movie|sitcom|series|tv|television|soap opera|drama|comedy|anime|cartoon|video game|game show|documentary|thriller|western|franchise|blockbuster)\b/i],
  book: ["Books & stories", /\b(novel|book|books|poem|poems|epic|saga|fairy tale|comics?|manga|memoir|diary|bible|scripture|treatise|stor(y|ies)|tale|fable|myth|legend|newspaper|magazine)\b/i],
  music: ["Music & dance", /\b(song|songs|anthem|band|opera|symphony|album|music|dance|ballet|tango|flamenco|samba|fado|waltz|instrument|guitar|drums?|bagpipes|hymn|choir|melody|tune)\b/i],
  art: ["Art", /\b(painting|sculpture|mural|fresco|artwork|mosaic|tapestry|engraving|portrait|masterpiece)\b/i],
  food: ["Food", /\b(dish|dishes|stew|soup|sauce|bread|cake|tart|pastry|pastries|dessert|sweets?|snack|cheese|sausage|dumplings?|noodles?|salad|pie|cuisine|recipe|meal|breakfast|street food|biscuits?|chocolate|confection|delicacy|porridge|flour|curry|pickles?|jam|ham|bacon|meat|fries|custard|yogh?urt|rice dish|bun|buns)\b/i],
  drink: ["Drink", /\b(drink|drinks|beer|lager|ale|stout|wine|wines|spirits?|liqueur|brandy|whisk(e)?y|rum|vodka|gin|sake|tea|coffee|juice|cocktail|brew|cider|mead|soda|cola|aperitif|digestif)\b/i],
  animal: ["Animals", /\b(animals?|birds?|fish|mammal|reptile|insect|breed|species|cattle|cows?|horses?|dogs?|cats?|bears?|whales?|apes?|monkeys?|lions?|tigers?|elephants?|wol(f|ves)|deer|sheep|goats?|pigs?|camels?|llamas?|alpacas?|salmon|cod|tuna|shrimps?|crabs?|lobsters?|oysters?|eels?|parrots?|eagles?|storks?|penguins?|orangutans?|pandas?|kangaroos?|koalas?|bees?|silkworms?)\b/i],
  plant: ["Plants & crops", /\b(plants?|trees?|crops?|flowers?|grass|seeds?|fruits?|nuts?|beans?|herbs?|spices?|palm|vines?|variet(y|ies)|cultivar|leaf|leaves|roots?|tubers?|cereal|berr(y|ies)|shrubs?|cactus|orchids?|tulips?|roses?)\b/i],
  disease: ["Diseases & pests", /\b(diseases?|blight|pests?|virus|fung(us|al)|bacteri(a|al)|infection|outbreak|rust|wilt|rot|parasites?|flu|fever|culls?|mildew|weevil|locusts?)\b/i],
  currency: ["Currencies", /\b(currency|currencies|coins?|banknotes?)\b/i],
  vehicle: ["Vehicles & ships", /\b((crude|bulk|lng|very large|ore|car|gas) carriers?|cars?|ships?|vessels?|tankers?|aircraft|planes?|jet|trains?|locomotive|truck|lorry|bikes?|bicycles?|motorcycles?|scooters?|boats?|submarines?|rockets?|spacecraft|satellites?|trams?|ferry|ferries|yachts?|galleons?|clippers?|dhows?)\b/i],
  sport: ["Sport", /\b(sports?|team|teams|league|tournament|championship|cup|martial art|match|race|racing|grand prix|marathon|derby|skiing|golf|cricket|rugby|football|soccer|tennis|polo|hockey|baseball|basketball|cycling|rowing|sailing|surfing|wrestling|boxing|judo|karate|sumo|fencing)\b/i],
  custom: ["Festivals & customs", /\b(festivals?|holidays?|feast|customs?(?! (heading|code|union|duty|tariff))|traditions?|rituals?|ceremony|carnival|celebration|parade|new year|fight|fair|pilgrimage|fiesta|bonfire|procession|etiquette|gesture|superstition)\b/i],
  word: ["Words & names", /\b(word|words|names?|language|means|meaning|nickname|term|slang|phrase|motto|saying|called|dialect|script|alphabet|letters?|toast|expression|idiom|abbreviation|acronym|initials)\b/i],
  tech: ["Science & technology", /\b(invention|invented|technology|technique|process|method|machine|engine|device|software|app|computer|chips?|robot|reactor|turbine|batter(y|ies)|cracking|distillation|fermentation|synthesis|reaction|formula|theory|discovery|vaccine|drug|medicine|telescope|microscope|printing press)\b/i],
  material: ["Materials & substances", /\b(alloy|compound|chemicals?|minerals?|ores?|element|gas|liquid|resin|fib(re|er)|polymer|plastic|acid|salt|filler|by-?product|residue|feedstock|additive|solvent|stimulant|pigment|dye|glue|wax|isotope|crystal|powder|ash|slag)\b/i],
  craft: ["Craft & style", /\b(fabric|textiles?|cloth|garment|dress|suit|hat|cap|shoes?|boots|pattern|style|design|carpets?|rugs?|pottery|porcelain|ceramics|lace|weave|woven|knit|knitwear|embroidery|jewel(le)?ry|watch|watches|tweed|silk|linen|wool|woollen|leather|kilt|tartan|kimono|sari|glassware|furniture|toys?|dolls?)\b/i],
  number: ["Dates & numbers", /^$/],
};
// What a link's aspect suggests about the thing at its end, and how strongly
const ASPECT = { ppl: { person: 2 }, screen: { film: 1.5 }, co: { company: 2 }, firm: { company: 2 }, lang: { word: 1 }, food: { food: 1, drink: 0.5 },
  sport: { sport: 1, person: 0.5 }, nat: { natural: 1, animal: 0.5 }, geo: { place: 1, natural: 0.5 }, hist: { event: 0.5 }, past: { event: 0.5 },
  style: { craft: 1 }, sci: { tech: 1 }, spec: { material: 0.5 }, mkt: { market: 0.5 }, mkts: { market: 1 }, fin: { market: 0.5, company: 0.5 },
  reg: { law: 1 }, pol: { law: 0.5, organisation: 0.5 }, nrg: { site: 0.5 }, met: { site: 0.5 }, agr: { plant: 0.5 }, trade: { place: 0.5 },
  logi: { place: 0.5, vehicle: 0.5 }, cult: { custom: 0.5 }, life: { custom: 0.25 } };

// Words that turn up around many kinds ("name", "price", "coast", "pigment") say less than the specific ones, so they
// count for less: a currency "whose name means crown" is a currency, not a word.
const BROAD = new Set(["word", "market", "place", "material"]);
// A thing's own name can say what it is: Hadrian's Wall, the Suez Canal, Lake Kivu, Rye bread
const NAMED = new Set(["site", "natural", "place", "food", "drink", "event", "organisation", "company"]);

/** Scores for each kind from a thing's name, hints and aspects: { kind: score }. */
export function scores(name, hints, aspects) {
  const s = {};
  const add = (k, v) => { s[k] = (s[k] || 0) + v; };
  if (/^\d[\d,.]*s?$/.test(name)) add("number", 4);
  const head = hints.map(h => h.split(/\s+/).slice(0, 5).join(" ")).join(" | ");
  for (const [k, [, words]] of Object.entries(KINDS)) {
    if (k === "number") continue;
    const w = BROAD.has(k) ? 0.75 : 1;
    if (hints.some(h => words.test(h))) add(k, 2 * w);
    if (words.test(head)) add(k, 1 * w);            // the head noun comes early: "A soup thickened with it"
    if (NAMED.has(k) && words.test(name)) add(k, 1.5);
  }
  if (s.currency) add("currency", 1.5);              // "a currency whose name means crown" is a currency first
  if (hints.some(h => /\b(fight|bout|final|match) (in|of) .*\b(19|20)\d\d\b|\b(19|20)\d\d (fight|bout|final)\b/i.test(h))) add("event", 2);
  for (const a of aspects) for (const [k, v] of Object.entries(ASPECT[a] || {})) add(k, v);
  return s;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { ENTITIES } = await import(pathToFileURL(kbFile("entities.js")).href);
  const { LINKS } = await import(pathToFileURL(kbFile("links.js")).href);
  const clues = new Map();
  for (const l of LINKS) if (l.rel === "clue") (clues.get(l.from) || clues.set(l.from, []).get(l.from)).push(l);
  const byId = new Map(ENTITIES.map(e => [e.id, e]));
  const given = {}, open = [];
  for (const e of ENTITIES) {
    if (e.sets.length || !clues.has(e.id)) continue;            // only bare clue things; a set by hand always stands
    const ls = clues.get(e.id);
    const s = scores(e.name, ls.map(l => l.hint), ls.flatMap(l => l.aspects));
    const [best, second] = Object.entries(s).sort((a, b) => b[1] - a[1]);
    if (best && best[1] >= 3.5 && best[1] - (second?.[1] || 0) >= 1.25) {      // only when the wording clearly says so
      e.sets.push(`kind:${best[0]}`);
      e.kindBy = "words";
      given[best[0]] = (given[best[0]] || 0) + 1;
    } else open.push({ e, ls, guesses: [best, second].filter(Boolean).map(([k, v]) => `${k} ${v}`).join(", ") || "none" });
  }
  // write the entities back as they were laid out: one per line
  const text = fs.readFileSync(kbFile("entities.js"), "utf8");
  const head = text.slice(0, text.indexOf("export const ENTITIES"));
  fs.writeFileSync(kbFile("entities.js"), `${head}export const ENTITIES = [\n${ENTITIES.map(e => JSON.stringify(e)).join(",\n")}\n];\n`);
  // the record: every clue thing's kind by where it came from (by hand, read one by one, or from the wording), and what's open
  const kinds = ENTITIES.filter(e => e.sets.some(x => x.startsWith("kind:")));
  const by = src => kinds.filter(e => (e.kindBy || "hand") === src).length;
  const tally = {};
  for (const e of kinds) { const k = e.sets.find(x => x.startsWith("kind:")).slice(5); tally[k] = (tally[k] || 0) + 1; }
  const md = `# What each clue thing is

${kinds.length} clue things have a kind: ${by("hand")} set by hand, ${by("read")} settled by reading each one's hints (kindBy "read"),
${by("words")} given from their wording by tools/kb-kinds.mjs (kindBy "words"). This run gave ${Object.values(given).reduce((a, b) => a + b, 0)}.
By kind: ${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${KINDS[k][0].toLowerCase()}`).join(", ")}.

## Still open (${open.length}): the wording doesn't settle it. Two best guesses each, then the hints
${open.map(({ e, ls, guesses }) => `- **${e.name}** (${guesses}): ${ls.map(l => `${byId.get(l.to).name}: ${l.hint}`).join("; ").slice(0, 220)}`).join("\n")}
`;
  fs.writeFileSync(kbFile("KINDS.md"), md);
  console.log(md.split("\n").slice(0, 3).join("\n"));
}
