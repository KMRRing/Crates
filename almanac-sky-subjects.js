// The star chart's subjects: which of Settings' subjects (topics.js: SUBJECTS) each thing in the knowledge base belongs to,
// and the colour each subject's stars wear. Pure, so the layout script, the page and the tests all say the same.
//
// A thing has no subject of its own in kb/: what it is is its sets (country, painting, kind:food…), and the topics it
// touches belong to its links (a clue link's aspects, which Almanac's entry lists as Topics). So a star's subjects are
// worked out the way a person would read the entry: what kind of thing it is first, then what its links are about.
//   1. A set that says what it is outright (a painting is Art, a ski resort Sport, a legal maxim Policy & law) decides.
//   2. Otherwise its kind (kind:food…) leans one way and its clue links' aspects (mapped through TOPIC_OF.kb, the same
//      table the games use) lean the others; the heaviest wins.
//   3. Whatever is left takes its neighbours' vote; whatever still has none is Geography.
// A star has up to three subjects (the ones carrying at least 60% of the heaviest's weight), the heaviest first: it
// wears the first that is switched on, and stays lit while any is.
import { SUBJECTS, TOPIC_OF } from "./topics.js";

export const SUBJECT_IDS = SUBJECTS.map(s => s.id);
const IX = new Map(SUBJECT_IDS.map((id, i) => [id, i]));

// Each subject's enamel for stars: bright enough on a dark sky and told apart by hue and, round the wheel, by lightness.
// A board's own colours (CLAUDE.md, The look), so fixed hex is right here. Neighbouring regions of the sky get unlike hues.
export const COLOURS = {
  geo: "#5FB0E8", cities: "#B8C4D6", nat: "#5CCB7A", mkt: "#E8C24A", fin: "#F2A33C", trade: "#3FD0C4", co: "#9B8CF2",
  nrg: "#FF7A52", met: "#C9A36B", agr: "#B4D94F", pol: "#7A9BFF", hist: "#D98A6A", ppl: "#F28DB5", lang: "#E8E08A",
  rel: "#C58FE8", art: "#FF5F8A", cult: "#E87CE0", screen: "#8AF0F0", style: "#E5B8A0", food: "#F28A3C", sport: "#4FE0A0",
  sci: "#6FA8FF", math: "#A7B3C6",
};

// What a set says a thing is, outright. A name here wins over everything else a thing has.
const BY_SET = {
  country: "geo", "geo-place": "geo", city: "cities", "trade-place": "trade", "trade-good": "trade", "merchant-power": "trade", "merchant-person": "trade",
  "trade-history": "hist", feature: "nat", saying: "lang", quotation: "cult", work: "cult", author: "cult",
  museum: "art", painting: "art", painter: "art", person: "art", "art-movement": "art", "art-place": "art", architect: "art", building: "art",
  "architecture-style": "art", "architecture-term": "art", "art-market-place": "art", "auction-house": "art", "art-dealer": "art", "art-forger": "art",
  "art-fair": "art", "art-record": "art", "art-market-person": "art", "art-market-thing": "art",
  "legal-concept": "pol", "legal-maxim": "pol", "peerage-rank": "hist", "german-rank": "hist", "german-style": "hist", "chivalric-order": "hist",
  "religious-order": "rel", "dress-code": "style", "court-place": "hist", "court-person": "hist", "court-thing": "style",
  "ski-resort": "sport", "ski-race": "sport", "ski-person": "sport", "ski-thing": "sport", "great-skier": "sport",
  "wine-place": "food", distillery: "food", "chinese-dish": "food", "chinese-tea": "food",
  "watch-brand": "style", "watch-model": "style", "watch-finish": "style", "watch-group": "style", complication: "style", "movement-part": "style",
  "horology-person": "style", "watch-valley-place": "style",
  "greek-god": "cult", "roman-god": "cult", "norse-god": "cult", "egyptian-god": "cult", "myth-hero": "cult", "myth-creature": "cult", "myth-place": "cult",
  "chinese-thinker": "rel", chengyu: "lang", "bavarian-word": "lang", "scots-word": "lang", "chinese-festival": "cult",
  "scottish-inventor": "sci", "bavarian-company": "co", "china-thing": "co", "futures-exchange": "fin", "britain-person": "ppl", "bavaria-person": "ppl",
  "china-person": "ppl", "people-place": "ppl", "britain-thing": "pol", "bavaria-thing": "hist",
  "lake-geneva-place": "geo", "britain-place": "geo", "scotland-place": "geo", "bavaria-place": "geo", "bavarian-district": "geo", "china-place": "geo",
  "chinese-province": "geo",
};
// a commodity's family (group:…) puts it among the markets it belongs to; the region groups of countries say nothing here
const BY_GROUP = { soft: "agr", grain: "agr", met: "met", nrg: "nrg", bio: "nrg", chem: "sci", cred: "fin", circ: "nat" };
// what a kind leans toward, lightly: the thing's links' aspects outweigh it when they agree on something else
const BY_KIND = {
  person: "ppl", place: "geo", site: "geo", company: "co", word: "lang", food: "food", drink: "food", tech: "sci", law: "pol", material: "sci", event: "hist",
  art: "cult", craft: "style", market: "mkt", natural: "nat", book: "cult", custom: "cult", organisation: "pol", music: "cult", sport: "sport",
  plant: "nat", currency: "fin", animal: "nat", film: "screen", vehicle: "trade", "video game": "screen", tv: "screen", disease: "nat", game: "screen", number: "math",
};
const KIND_WEIGHT = 0.5;

/**
 * Each thing's subjects, as indexes into SUBJECT_IDS, the heaviest first (1 to 3 of them).
 * `entities` and `links` are kb/'s; a thing with `same` is a copy of another and gets that one's subjects.
 */
export function subjectsOf(entities, links) {
  const at = new Map(entities.map((e, i) => [e.id, i]));
  const n = entities.length, canon = i => { const s = entities[i].same; return s && at.has(s) ? at.get(s) : i; };
  const weight = Array.from({ length: n }, () => new Float64Array(SUBJECT_IDS.length));
  const decided = new Uint8Array(n), nearby = Array.from({ length: n }, () => []);
  entities.forEach((e, i) => {
    for (const s of e.sets || []) {
      const to = BY_SET[s] || (s.startsWith("feature:") ? "nat" : null);
      if (to) { weight[i][IX.get(to)] += 100; decided[i] = 1; }
    }
    if (e.sets?.includes("commodity")) {
      const g = (e.sets.find(s => s.startsWith("group:")) || "").slice(6);
      weight[i][IX.get(BY_GROUP[g] || "trade")] += 100; decided[i] = 1;
    }
    if (!decided[i]) for (const s of e.sets || []) if (s.startsWith("kind:") && BY_KIND[s.slice(5)]) weight[i][IX.get(BY_KIND[s.slice(5)])] += KIND_WEIGHT;
  });
  for (const l of links) {
    const f = at.get(l.from), t = at.get(l.to);
    if (f == null || t == null) continue;
    nearby[canon(f)].push(canon(t)); nearby[canon(t)].push(canon(f));
    if (l.rel !== "clue" || decided[f] || !l.aspects?.length) continue;     // the aspects describe the clue thing, the one the link comes from
    for (const a of l.aspects) { const s = TOPIC_OF.kb[a]; if (s) weight[canon(f)][IX.get(s)] += 1 / l.aspects.length; }
  }
  // a thing nothing says anything about takes its neighbours' vote (their own, once they have one), twice round
  const best = w => { let b = 0; for (let k = 1; k < w.length; k++) if (w[k] > w[b]) b = k; return w[b] > 0 ? b : -1; };
  for (let pass = 0; pass < 2; pass++) {
    entities.forEach((e, i) => {
      if (best(weight[i]) >= 0) return;
      const vote = new Float64Array(SUBJECT_IDS.length);
      for (const j of nearby[i]) { const b = best(weight[j]); if (b >= 0) vote[b] += 1; }
      if (best(vote) >= 0) weight[i] = vote.map(v => v * 0.5);        // half, so a borrowed subject never outweighs one a thing earned
    });
  }
  return entities.map((e, i) => {
    const w = weight[canon(i)], order = [...w.keys()].filter(k => w[k] > 0).sort((p, q) => w[q] - w[p] || p - q);
    if (!order.length) return [IX.get("geo")];
    return order.filter(k => w[k] >= 0.6 * w[order[0]]).slice(0, 3);
  });
}
