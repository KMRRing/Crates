// The clue ladder (thing-clues.js): what Nexus and Arb offer for a thing you don't know. From vague to specific, built from the
// knowledge base's own words, never naming what the caller hides, and there for nearly every thing a round starts from.
import { clueLines, whatIs, pictureOf, whatCard } from "../thing-clues.js";
import { CENTRES, name } from "../nexus-engine.js";
import { ENDS } from "../arb-engine.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

check(whatIs("equinor") === "company" && whatIs("mona-lisa") === "painting" && whatIs("burj-khalifa") === "building" && whatIs("norway") === "country" && whatIs("coffee") === "commodity", "a thing says what it is by its most particular set (a building is also a site, a book a work)");
{
  const norway = clueLines("norway");
  check(norway[0] === "A country in Europe" && norway.some(l => /million people/.test(l)), `a country: what it is, where, and its size (${norway.slice(0, 2).join(" / ")})`);
  check(clueLines("coffee")[0] === "A soft commodity", "a commodity says which kind");
  const burj = clueLines("burj-khalifa");
  check(burj[0] === "A building" && /Built around 2009/.test(burj[1]) && /^In /.test(burj[2]) && /tallest/.test(burj.at(-1)), `a building: what, when, where, then its note last (${burj.length} lines)`);
  const byron = clueLines("lord-byron");
  check(/^Born 1788, died 1824$/.test(byron[1]), "a person: born and died");
}
{
  // a line that names what is hidden is left out, and the rest stay in order
  const all = clueLines("burj-khalifa"), hidden = clueLines("burj-khalifa", ["Skidmore"]), none = clueLines("burj-khalifa", ["skidmore, OWINGS"]);
  check(all.some(l => /Skidmore/.test(l)) && !hidden.some(l => /Skidmore/.test(l)) && hidden.length === all.length - 1 && JSON.stringify(none) === JSON.stringify(hidden.length < all.length ? all.filter(l => !/skidmore, owings/i.test(l)) : all), "a line naming a hidden thing is left out, in any case");
  check(clueLines("colosseum", ["Italy"]).every(l => !/Italy/.test(l)) && clueLines("colosseum", ["It"]).length === clueLines("colosseum").length, "names are matched as whole words, and those under three letters are not hidden");
  check(clueLines("nothing-like-this").length === 0, "an unknown thing has no clues");
}
{
  // coverage: the things Nexus starts from and Arb's routes end at
  let some = 0, two = 0, leaks = 0;
  for (const c of CENTRES) { const l = clueLines(c, [name(c)]); if (l.length) some++; if (l.length >= 2) two++; if (name(c).length >= 3 && l.some(t => new RegExp(`(?<![\\p{L}\\p{N}])${name(c).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "iu").test(t))) leaks++; }
  check(some === CENTRES.length && !leaks, `every Nexus centre has a clue, and none names itself when it is hidden (${CENTRES.length})`);
  check(two / CENTRES.length > 0.9, `${Math.round((100 * two) / CENTRES.length)}% of Nexus centres have two clues or more (the rest, mostly painters and plain commodities, say only what they are)`);
  let ends = 0;
  for (const id of ENDS) if (clueLines(id).length >= 2) ends++;
  check(ends / ENDS.length > 0.9, `${Math.round((100 * ends) / ENDS.length)}% of the things a route can start or end at have two clues or more (${ENDS.length})`);
  const pics = CENTRES.filter(c => pictureOf(c));
  check(pics.length > 100 && pictureOf("burj-khalifa") === "Burj Khalifa", `${pics.length} centres have a picture`);
}
{
  // a thing in a ring or a list is described without the hints written for its links
  const ring = clueLines("coffee", [], { hints: false }), full = clueLines("coffee");
  check(full.length > ring.length && ring.every(t => full.includes(t)) && JSON.stringify(clueLines("coffee", [], { hints: true })) === JSON.stringify(full), "hints:false leaves out the hints written for a thing's links, and nothing else");
}
{
  // asking for a description is "not known" for Deck: one card per thing, answerable, and the right option never the odd one out
  let made = 0, bad1 = 0, bad2 = 0, bad3 = 0, bad4 = 0, again = 0;
  for (const id of [...CENTRES, ...ENDS.slice(0, 600)]) {
    const c = whatCard(id);
    if (!c) continue;
    made++;
    const p = c.payload, o = p.options;
    if (c.key !== `what~${id}` || !p.fixed || !p.about?.includes(id) || JSON.stringify(p.right) !== "[0]" || p.answer !== o[0]) bad1++;
    if (o.length !== 4 || new Set(o).size !== 4) bad2++;
    if (!p.prompt.startsWith("Which of these describes ")) { if (!p.prompt.endsWith("Which thing is this?")) bad3++; }
    else if (new Set(o.map(t => t.split(". ")[0].split(" ").length)).size !== 1 || new Set(o.map(t => t.slice(t.indexOf(". ") + 2).split(" ")[0])).size !== 1) bad4++;   // said the same way: as many words, the same opening word
    if (JSON.stringify(whatCard(id)) !== JSON.stringify(c)) again++;
  }
  check(made > 1000 && !bad1 && !bad2 && !bad3 && !bad4 && !again, `a described thing becomes a card Deck can ask: ${made} of the starts and ends have one; four different options, its own first, said alike, and the same card every time`);
  const k = whatCard("norway").payload;
  check(k.options.every(t => /^A country in /.test(t)) && /million people/.test(k.options[0]), "a country's description is among other countries' in the same words (\"in Europe\" in all or none)");
  check(whatCard("coffee").payload.prompt.endsWith("Which thing is this?") && whatCard("coffee").payload.options[0] === "Coffee", "a thing with too little to describe in the first way is asked the other way round, by name");
  check(whatCard("nothing-like-this") === null, "an unknown thing has no card");
}
console.log(bad ? `\n${bad} FAILED` : "\nclues: a ladder from vague to specific, never naming what is hidden");
process.exit(bad ? 1 : 0);
