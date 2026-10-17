// A mix of topics, as every game that deals from the knowledge base deals it (Crates, Punt, Quote, Order, Origin, Arb,
// Chart): each topic out (0), in (1) or more (2: dealt twice as often as it would be in), from a preset or your own,
// chosen in the menu (menu.js's topicMix). These are the pieces the games share, pure: a mix made whole, which preset
// it is, and a seeded draw by weight. A game's topics are a list of [id, label]; its presets { id: { label, topics } }.

/** A mix as kept (anything: an old save, a link), made whole for a list of topics: each 0, 1 or 2 (one it doesn't
 *  know, in). */
export function cleanMix(list, saved) {
  const out = {};
  for (const [id] of list) { const w = Number(saved?.[id]); out[id] = w === 0 || w === 1 || w === 2 ? w : 1; }
  return out;
}
/** The preset a mix is (its id), or "custom": your own. */
export const presetOf = (list, presets, w) =>
  Object.keys(presets).find(k => list.every(([id]) => (w?.[id] ?? 1) === (presets[k].topics[id] ?? 1))) || "custom";
/** Whether a mix has every topic of a list in, and none more: the game deals as it did before it had topics. */
export const even = (list, w) => !w || list.every(([id]) => (w[id] ?? 1) === 1);
/** Whether a mix has any topic in at all (a link's, mistyped, may have none; the menu always keeps one). */
export const anyIn = (list, w) => list.some(([id]) => (w?.[id] ?? 1) > 0);
/** k of the items drawn by weight from a seeded r(), none put back: a weight of 2 twice as likely as 1, 0 never. */
export function drawWeighted(r, items, weightOf, k = items.length) {
  const left = items.map(x => ({ x, w: weightOf(x) })).filter(o => o.w > 0), out = [];
  while (out.length < k && left.length) {
    let t = r() * left.reduce((a, o) => a + o.w, 0), i = 0;
    while (i < left.length - 1 && (t -= left[i].w) >= 0) i++;
    out.push(left.splice(i, 1)[0].x);
  }
  return out;
}
/** A mix as a link carries it, the topics in with their weights ("trade.2,art.1"), and back (a topic not named, out). */
export const mixParam = (list, w) => list.filter(([id]) => (w?.[id] ?? 1) > 0).map(([id]) => `${id}.${w?.[id] ?? 1}`).join(",");
export const mixFromParam = (list, text) => cleanMix(list, Object.fromEntries([
  ...list.map(([id]) => [id, 0]),
  ...String(text || "").split(",").map(x => x.split(".")).filter(([id]) => list.some(([t]) => t === id)).map(([id, w]) => [id, Number(w)]),
]));

// ---------- the knowledge base's topics ----------
/** A clue link's aspects (kb/links.js), which belong to the link, not the thing: a country clue's and a commodity clue's
 *  ask different things. Crates weights them in its settings (core.js takes them from here), Origin deals its clues by
 *  the country ones, Arb its routes by both. */
export const KB_TOPICS = {
  country: [
    ["geo", "Geography"], ["nat", "Nature"], ["nrg", "Energy"], ["met", "Metals & mining"],
    ["agr", "Agriculture"], ["food", "Food & drink"], ["mkt", "Money & economy"], ["fin", "Finance"], ["trade", "Trade & shipping"],
    ["co", "Companies & brands"], ["pol", "Policy & institutions"], ["hist", "History"], ["cult", "Culture & arts"],
    ["screen", "Film, TV & games"], ["style", "Craft & style"],
    ["sport", "Sport"], ["ppl", "People"], ["sci", "Science & tech"], ["lang", "Language & names"],
  ],
  commodity: [
    ["orig", "Origins"], ["prod", "Production"], ["uses", "Uses"], ["spec", "Specs & science"],
    ["mkts", "Markets"], ["logi", "Trade & logistics"], ["reg", "Policy"], ["firm", "Companies"],
    ["past", "History"], ["life", "Culture & language"],
  ],
};
const allKb = w => Object.fromEntries([...KB_TOPICS.country, ...KB_TOPICS.commodity].map(([k]) => [k, w]));
/** Crates' presets for them: Trader weights what a country makes, sells and moves; Culture night its arts and people. */
export const KB_PRESETS = {
  trader: { label: "Trader", topics: { ...allKb(1), nrg: 2, met: 2, agr: 2, mkt: 2, fin: 2, trade: 2, co: 2, pol: 1, sci: 1, geo: 1, lang: 1,
    mkts: 2, logi: 2, reg: 2, firm: 2, orig: 1, prod: 1, uses: 1, spec: 1 } },
  balanced: { label: "Balanced", topics: allKb(1) },
  culture: { label: "Culture night", topics: { ...allKb(1), cult: 2, screen: 2, style: 2, food: 2, sport: 2, ppl: 2, hist: 2, nat: 2, mkt: 1, fin: 1, nrg: 1, met: 1, trade: 1, sci: 1, pol: 1,
    life: 2, past: 2, uses: 2, spec: 1, mkts: 1, logi: 1, reg: 1 } },
};

