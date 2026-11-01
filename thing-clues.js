// Clues for a thing, pure (tests/thing-clues.mjs checks them): what Nexus and Arb offer when you don't know what the thing in the
// middle (or at either end of a route) is. A ladder of lines from vague to specific, built only from what the knowledge
// base already says of the thing itself: what it is, where or when, the hints written for it as a clue (the "because" of
// its clue links, which Crates writes without the answer's geography), and its note. A line that names anything the caller
// is hiding (the candidates of a round, the cheapest route) is left out, so a clue never hands over the answer it is for.
import { ENTITIES } from "./kb/entities.js";
import { LINKS } from "./kb/links.js";

const ENT = new Map(ENTITIES.map(e => [e.id, e]));
const CANON = id => ENT.get(id)?.same || id;
const HINTS = new Map();                                   // id → its hints as a clue, easiest first
for (const l of LINKS) {
  if (l.rel !== "clue" || !l.hint) continue;
  const id = CANON(l.from);
  if (!HINTS.has(id)) HINTS.set(id, []);
  HINTS.get(id).push({ text: l.hint.trim(), d: l.d ?? 2 });
}
for (const list of HINTS.values()) list.sort((a, b) => a.d - b.d);

// ---------- what it is ----------
// the more particular a set, the earlier: a building is a "kind:site" too, a book a "work"
const SPECIFIC = ["country", "commodity", "painting", "building", "museum", "painter", "architect", "author", "city", "art-movement", "architecture-style",
  "ski-resort", "trade-place", "geo-place", "legal-maxim", "legal-concept", "saying", "quotation"];
const SAYS = { "geo-place": "place", "trade-place": "trading place", "legal-maxim": "legal maxim", "legal-concept": "legal concept", "kind:site": "site", "kind:natural": "natural feature",
  "kind:craft": "craft or product", "kind:food": "food or dish", "kind:law": "law or rule", "kind:art": "work of art", "kind:tech": "technology" };
const WHERE = { eu: "Europe", asia: "Asia", me: "the Middle East", am: "the Americas", af: "Africa" };            // a country's group
const WHAT = { soft: "a soft commodity", met: "a metal", nrg: "an energy commodity", grain: "a grain", chem: "a chemical" };   // a commodity's
const say = set => SAYS[set] || set.replace(/^(kind|feature):/, "").replace(/-/g, " ");
const article = word => (/^[aeiou]/i.test(word) ? "An" : "A");
/** What a thing is, in a few words: "company", "painting", "river". */
export function whatIs(id) {
  const sets = (ENT.get(id)?.sets || []).filter(s => !s.startsWith("group:"));
  const set = SPECIFIC.find(s => sets.includes(s)) || sets.find(s => s.startsWith("kind:")) || sets.find(s => s.startsWith("feature:")) || sets[0];
  return set ? say(set) : "";
}
const what = id => {
  const e = ENT.get(id), word = whatIs(id), groups = (e?.sets || []).filter(s => s.startsWith("group:")).map(s => s.slice(6));
  if (!word) return "";
  if (word === "commodity") { const g = groups.find(x => WHAT[x]); if (g) return `${WHAT[g][0].toUpperCase()}${WHAT[g].slice(1)}`; }
  const where = word === "country" ? groups.find(x => WHERE[x]) : null;
  return `${article(word)} ${word}${where ? ` in ${WHERE[where]}` : ""}`;
};

// ---------- where or when ----------
const million = n => (n >= 100 ? Math.round(n) : n >= 10 ? Math.round(n * 10) / 10 : n).toLocaleString("en-GB");
const WHEN = { painting: y => `Painted in ${y}`, building: y => `Built around ${y}`, site: y => `Dating from ${y}`, book: y => `Published in ${y}`, work: y => `Written in ${y}` };
function whereWhen(id) {
  const e = ENT.get(id);
  if (!e) return [];
  const out = [], word = whatIs(id), year = e.year ?? null;
  if (e.born != null) out.push(`Born ${e.born}${e.died != null ? `, died ${e.died}` : ""}`);
  if (year != null) out.push((WHEN[word] || (y => `From ${y}`))(Math.abs(year)) + (year < 0 ? " BC" : ""));
  if (e.span) out.push(`Active ${e.span}${e.where ? `, in ${e.where}` : ""}`);
  else if (e.founded != null) out.push(`Founded ${e.founded}`);
  if (e.country && e.country !== e.name) out.push(`In ${e.country}${e.region && e.region !== e.country ? `, ${e.region}` : ""}`);
  else if (e.region && e.region !== e.name) out.push(`In ${e.region}`);
  if (e.population != null) out.push(`About ${million(e.population)} million people${e.area != null ? `, ${e.area.toLocaleString("en-GB")} km²` : ""}`);
  if (e.capital) out.push(`Capital: ${e.capital}`);
  const card = e.card;                                    // a movement's card: when and where it flourished
  if (card?.span) out.push(`${card.span.endsWith("–") ? `From ${card.span.slice(0, -1).trim()}` : card.span}${card.where ? `, in ${card.where}` : ""}`);
  if (typeof e.domain === "string") out.push(`Domain: ${e.domain}`);
  if (typeof e.symbol === "string") out.push(`Symbol: ${e.symbol}`);
  return out;
}

// ---------- the ladder ----------
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A matcher for lines that name any of `names` (whole words, any case; names of under three letters are too common to hide). */
function namer(names) {
  const list = [...new Set(names.filter(n => n && n.length >= 3))].sort((a, b) => b.length - a.length);
  if (!list.length) return () => false;
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${list.map(esc).join("|")})(?![\\p{L}\\p{N}])`, "iu");
  return text => re.test(text);
}
/**
 * The clues for a thing, from vague to specific: what it is, where or when, the hints written for it, its note. `hide`
 * lists names a line must not contain (the ring's candidates, the route's things, the thing itself when you are not to
 * be told it): a line that does is left out.
 */
export function clueLines(id, hide = [], { hints = true } = {}) {
  const e = ENT.get(CANON(id));
  if (!e) return [];
  const names = namer(hide);
  // a thing in a ring or a list gets no hints: they are written for its links, and one of them could be the link being asked
  const lines = [what(id), ...whereWhen(id), ...(hints ? (HINTS.get(CANON(id)) || []).slice(0, 2).map(h => h.text) : []), e.note || ""];
  const seen = new Set();
  return lines.map(t => t.trim()).filter(t => t && !names(t) && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
}
/** The Wikipedia page of a thing's picture, if it has one. */
export const pictureOf = id => ENT.get(CANON(id))?.pic || null;

// ---------- asking for a description marks the thing as not known (Deck) ----------
const shown = e => (e.qualifier ? `${e.name} (${e.qualifier})` : e.name);
let BY_WHAT = null;                                          // what a thing is → the things of that kind, in the base's order
const sameKind = id => {
  if (!BY_WHAT) { BY_WHAT = new Map(); for (const e of ENTITIES) { if (e.same) continue; const k = whatIs(e.id); if (k) { if (!BY_WHAT.has(k)) BY_WHAT.set(k, []); BY_WHAT.get(k).push(e.id); } } }
  return BY_WHAT.get(whatIs(id)) || [];
};
const spread = text => { let h = 2166136261; for (const c of text) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
/** What a thing is and where or when, in up to three short lines, without its long note: what an option says of it. */
const facts = id => clueLines(id, [], { hints: false }).filter(t => t !== ENT.get(CANON(id))?.note).slice(0, 3);
const words = t => t.split(" ").length;
/** Others of its kind, in a fixed order that differs for each thing, whose facts `ok` accepts: three, or null. */
function alike(e, ok) {
  const out = [];
  for (const o of sameKind(e.id).filter(x => x !== e.id).sort((a, b) => spread(e.id + a) - spread(e.id + b))) {
    const r = ok(ENT.get(o), facts(o));
    if (r && !out.includes(r)) out.push(r);
    if (out.length === 3) return out;
  }
  return null;
}
/**
 * The Deck card for a thing someone asked a description of, the same thing always giving the same card (asking twice is one
 * item). Mostly "which of these describes X?", its description among three of things of its kind, each said the same way
 * (what it is, then where or when) so none gives itself away, and none sharing a particular with it. A thing with too little
 * of that to say is asked the other way round: its fuller description, "which thing is this?", among the names of three of its
 * kind. null when it has too little to describe or too few like it.
 */
export function whatCard(id) {
  const e = ENT.get(CANON(id)), mine = e && facts(e.id);
  if (!e) return null;
  // said the same way: the first line as long, and each later one opening with the same word ("Born", "Active", "From")
  const shape = (lines, n) => lines.length >= n && words(lines[0]) === words(mine[0]) && lines.slice(1, n).every((t, i) => t.split(" ")[0] === mine[i + 1].split(" ")[0]);
  if (mine.length >= 2) {
    const say = lines => lines.join(". "), right = say(mine);
    const others = alike(e, (f, lines) => (shape(lines, mine.length) && !lines.slice(1, mine.length).some(t => mine.includes(t)) && say(lines.slice(0, mine.length)) !== right ? say(lines.slice(0, mine.length)) : null));
    if (others) return {
      key: `what~${e.id}`,
      payload: { fixed: true, ask: "Nexus · what is it", prompt: `Which of these describes ${shown(e)}?`, answer: right, options: [right, ...others], right: [0], need: 1,
        note: `${shown(e)}: ${say(clueLines(e.id, [], { hints: false }))}.`, about: [e.id] },
    };
  }
  const lines = clueLines(e.id, [shown(e), e.name]).slice(0, 4);
  if (lines.length < 2) return null;
  const others = alike(e, (f, theirs) => (shown(f) !== shown(e) && !theirs.some(t => lines.slice(1).includes(t)) ? shown(f) : null));
  if (!others) return null;
  return {
    key: `what~${e.id}`,
    payload: { fixed: true, ask: "Nexus · what is it", prompt: `${lines.join(". ")}. Which thing is this?`, answer: shown(e), options: [shown(e), ...others], right: [0], need: 1,
      note: `${shown(e)}: ${lines.join(". ")}.`, about: [e.id] },
  };
}
