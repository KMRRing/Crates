// Nexus's rounds, pure (nexus.js draws them; tests/nexus.mjs checks them). A round puts one thing from the knowledge base
// in the middle (the nexus) with a ring of candidates round it, and you pick the ones the Codex links to it directly:
// a link somebody wrote down with its "because" (kb/links.js), either way round (Norway has Equinor as a clue; Equinor
// has Norway as its answer). Three kinds of round:
//   Orbit     all the candidates that are linked to the nexus (3 to 5 of 8 to 12)
//   Aspect    only those linked under one aspect of it (Norway, as Energy: Troll yes, Fjords no, though both are Norway's)
//   Intruder  four are linked and one isn't: find it
// The decoys are near misses, never random things: another thing of the same kind that belongs to a sibling of the nexus
// (a Swedish company beside Norway's), or one step beyond a true link (what Equinor goes with, that isn't Norway), and the
// kind of the true links is the kind most of them are. What the Codex holds loosely (a clue that "also fits" another
// answer, `alt` in the links) is neither a true link nor a decoy: it could fairly be called either. Everything here is
// "in this Codex": a decoy may be linked in life, and the reveal says where it goes instead.
import { ENT, name, kind, ABOUT, TOPIC_LIST, TOPIC_GROUPS, TOPIC_PRESETS, drawEnd } from "./arb-engine.js";
import { LINKS } from "./kb/links.js";
import { KB_TOPICS, drawWeighted } from "./topics.js";

export { TOPIC_LIST, TOPIC_GROUPS, TOPIC_PRESETS, name, kind, ABOUT };
export const PER_RUN = 5;
export const SIZES = [8, 10, 12];
export const TYPES = ["orbit", "aspect", "intruder"];
export const MODES = [["mixed", "Mixed"], ["orbit", "Orbit"], ["aspect", "Aspect"], ["intruder", "Intruder"]];
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const shuffle = (r, xs) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- the links, as a ring ----------
const CANON = id => ENT.get(id)?.same || id;                  // a duplicate entry stands for the one it duplicates
// the relations whose hint describes the thing it is said of ("Troll: one of the largest offshore gas fields"); any other
// relation's hint is the verb between the two ("Heracles strangled The Nemean lion")
const DESCRIBES = new Set(["clue", "link", "from", "led-to", "style"]);
const PHRASE = { in: "is in", "painted-by": "was painted by", "hangs-in": "hangs in", movement: "belongs to", "designed-by": "was designed by", "written-by": "was written by", "in-work": "is in" };
/** id → Map(other → { from, to, rel, hint, aspects }): what the Codex links directly to a thing, with the clue's side (from) and the "because". */
export const LINKED = new Map();
/** id → Set(other): what a clue also fits loosely (its `alt`): neither a true link nor a fair decoy. */
const LOOSE = new Map();
const tie = (map, a, b, make) => {
  if (!map.has(a)) map.set(a, new Map());
  const had = map.get(a).get(b);
  if (!had) map.get(a).set(b, make());
  else for (const x of make().aspects) had.aspects.add(x);     // two links between a pair: both give it their aspects
};
const loose = (a, b) => { if (!LOOSE.has(a)) LOOSE.set(a, new Set()); LOOSE.get(a).add(b); };
for (const l of LINKS) {
  if (!ENT.has(l.from) || !ENT.has(l.to)) continue;
  const [f, t] = [CANON(l.from), CANON(l.to)];
  if (f === t) continue;
  const make = () => ({ from: f, to: t, rel: l.rel, hint: l.hint || "", aspects: new Set(l.aspects || []) });
  tie(LINKED, f, t, make);
  tie(LINKED, t, f, make);
  for (const x of l.alt || []) { const g = CANON(x); if (g !== f && g !== t && ENT.has(g)) { loose(f, g); loose(g, f); } }
}
const linkCount = id => LINKED.get(id)?.size || 0;
const primary = id => (ENT.get(id)?.sets || []).find(s => !s.startsWith("group:")) || "";
const BY_SET = new Map();
for (const id of LINKED.keys()) { const s = primary(id); if (!BY_SET.has(s)) BY_SET.set(s, []); BY_SET.get(s).push(id); }

const MAX_NAME = 38;                                          // a chip holds a name, not a quotation
const usable = id => ENT.has(id) && name(id).length <= MAX_NAME;
/** What the link between two things says, as the Codex wrote it: a clue ("Troll → Norway: One of the largest offshore gas fields"), or a sentence ("Heracles strangled The Nemean lion"). */
export function say(a, b) {
  const info = LINKED.get(a)?.get(b);
  if (!info) return "";
  if (DESCRIBES.has(info.rel) && info.hint) return `${name(info.from)} → ${name(info.to)}: ${info.hint}`;
  return `${name(info.from)} ${info.hint || PHRASE[info.rel] || info.rel.replace(/-/g, " ")} ${name(info.to)}`;
}
/** The linked things of a thing that can sit in a ring, the order the links were written in. */
const truthsOf = id => [...(LINKED.get(id)?.keys() || [])].filter(usable);
export const barred = c => new Set([c, ...(LINKED.get(c)?.keys() || []), ...(LOOSE.get(c) || [])]);
/** The aspects (kb topics) of the links where the thing is the answer and the others are its clues, with those clues. */
const aspectsOf = c => {
  const by = new Map();
  for (const [o, info] of LINKED.get(c) || []) if (info.from === o && usable(o)) for (const a of info.aspects) { if (!by.has(a)) by.set(a, []); by.get(a).push(o); }
  return by;
};
export const ASPECT = new Map([...KB_TOPICS.country, ...KB_TOPICS.commodity]);

/** The things that can sit in the middle of a round: three links at least. */
export const CENTRES = [...LINKED.keys()].filter(id => usable(id) && truthsOf(id).length >= 3).sort();
export const ASPECT_CENTRES = CENTRES.filter(id => [...aspectsOf(id).values()].some(xs => xs.length >= 3));
export const INTRUDER_CENTRES = CENTRES.filter(id => truthsOf(id).length >= 4);

// ---------- decoys ----------
const HUB = 60;                                               // a thing linked to more than this is linked to half the world in life, if not in the Codex
const PEERS = 40, SIBLINGS = 12;
/**
 * Where the decoys come from, each with its home (the thing it is linked to instead):
 *   peers     the links of the nexus's own sort (other countries beside a country)
 *   steps     the links of its true links, one step on (what Equinor goes with, that isn't Norway)
 *   siblings  the links of the other things its true links are linked to (Brazil, Equinor's other country)
 * `aspect` keeps to the links that carry it, and then only peers. Never the nexus's own links, loose ones included.
 */
function pools(r, c, trues, aspect = null) {
  const bad = barred(c), found = new Map(), ok = o => !bad.has(o) && usable(o) && linkCount(o) <= HUB;
  const put = (o, home, src) => { if (!found.has(o) && ok(o)) found.set(o, { home, src }); };
  for (const p of shuffle(r, (BY_SET.get(primary(c)) || []).filter(p => p !== c)).slice(0, PEERS))
    for (const [o, info] of LINKED.get(p)) if (!aspect || (info.from === o && info.aspects.has(aspect))) put(o, p, "peers");
  if (aspect) return found;
  for (const t of trues) for (const o of LINKED.get(t).keys()) put(o, t, "steps");
  for (const t of trues) for (const p of shuffle(r, [...LINKED.get(t).keys()].filter(x => !bad.has(x) && usable(x))).slice(0, SIBLINGS))
    for (const o of LINKED.get(p).keys()) put(o, p, "siblings");
  return found;
}
const SOURCE = { peers: 2, steps: 2, siblings: 1 };
/**
 * `want` decoys, near misses: of the kind of the true links whenever the pools hold enough (the others only fill what
 * is short: a building among films is no decoy, it's a gift), drawn by source. `first` are what the pile wants asked
 * again; `taken` ids already in the ring.
 */
function decoys(r, c, trues, want, taken, aspect = null, first = []) {
  const found = pools(r, c, trues, aspect), kinds = new Set(trues.map(kind));
  const names = new Set([...taken, ...trues].map(name)), out = [];
  const add = (o, home) => { if (out.length < want && !names.has(name(o))) { names.add(name(o)); out.push({ id: o, linked: false, home }); } };
  for (const o of first) if (found.has(o)) add(o, found.get(o).home);
  const all = [...found.keys()], weight = o => SOURCE[found.get(o).src];
  for (const o of [...drawWeighted(r, all.filter(x => kinds.has(kind(x))), weight), ...drawWeighted(r, all.filter(x => !kinds.has(kind(x))), weight)]) add(o, found.get(o).home);
  return out.length === want ? out : null;
}

// ---------- the rounds ----------
const pickTrues = (r, c, k, forced = []) => {
  const pool = truthsOf(c), firm = forced.filter(t => pool.includes(t)).slice(0, k);
  return [...firm, ...shuffle(r, pool.filter(t => !firm.includes(t))).slice(0, k - firm.length)];
};
const ring = (r, c, type, cands, extra = {}) => ({ type, centre: c, ...extra, cands: shuffle(r, cands) });

function orbit(r, c, size, must = {}) {
  const have = truthsOf(c).length;
  if (have < 3) return null;
  const k = Math.min(have, 5, size - 4, 3 + Math.floor(r() * 3));
  const trues = pickTrues(r, c, k, must.trues);
  const bad = decoys(r, c, trues, size - k, [c], null, must.falses);
  return bad && ring(r, c, "orbit", [...trues.map(id => ({ id, linked: true })), ...bad]);
}
function aspect(r, c, size, must = {}) {
  const options = [...aspectsOf(c)].filter(([, xs]) => xs.length >= 3);
  if (!options.length) return null;
  const [a, ids] = options[Math.floor(r() * options.length)];
  const k = Math.min(ids.length, 4, size - 5), want = size - k, trues = shuffle(r, ids).slice(0, k);
  // the same nexus's other links (linked, but not under this aspect) are half the decoys; the rest are other things' links under it
  const near = shuffle(r, [...LINKED.get(c)].filter(([o, info]) => info.from === o && usable(o) && info.aspects.size && !info.aspects.has(a)).map(([o]) => o));
  const used = new Set([c, ...trues]), names = new Set([c, ...trues].map(name)), mine = [];
  for (const o of near) if (mine.length < Math.floor(want / 2) && !names.has(name(o))) { names.add(name(o)); used.add(o); mine.push({ id: o, linked: false, near: true }); }
  if (!mine.length) return null;
  const rest = decoys(r, c, trues, want - mine.length, [...used], a, must.falses);
  return rest && ring(r, c, "aspect", [...trues.map(id => ({ id, linked: true })), ...mine, ...rest], { aspect: a });
}
function intruder(r, c, size, must = {}) {
  if (truthsOf(c).length < 4) return null;
  const trues = pickTrues(r, c, 4, must.trues), odd = decoys(r, c, trues, 1, [c], null, must.falses);
  return odd && ring(r, c, "intruder", [...trues.map(id => ({ id, linked: true })), ...odd]);
}
const BUILD = { orbit, aspect, intruder };
const POOL = { orbit: CENTRES, aspect: ASPECT_CENTRES, intruder: INTRUDER_CENTRES };

/**
 * The five rounds of a seed. `mode` is a type or "mixed"; `size` how many candidates an Orbit or Aspect round rings
 * the nexus with; `weights` a mix of the knowledge base's topics (the nexus is drawn by the weight of its likeliest
 * topic, as Arb draws its ends); `forced` nexuses to deal first, with `must[id] = { trues, falses }` to put in them
 * (what the learning mode asks again); `avoid` a Set of nexuses dealt lately, left out unless that leaves too few.
 */
export function dealRun(seed, { mode = "mixed", size = 10, weights = null, forced = [], must = {}, avoid = null } = {}) {
  const r = rng(seed), rounds = [], used = new Set();
  for (let i = 0; i < PER_RUN; i++) {
    let made = null;
    for (let tries = 0; tries < 80 && !made; tries++) {
      const push = forced[i] && !used.has(forced[i]) && tries === 0;
      const type = mode === "mixed" ? (push ? "orbit" : TYPES[Math.floor(r() * TYPES.length)]) : mode;   // what the pile wants asked again goes in an Orbit
      let from = POOL[type].filter(c => !used.has(c) && !avoid?.has(c));
      if (from.length < 30) from = POOL[type].filter(c => !used.has(c));
      const c = push && POOL[type].includes(forced[i]) ? forced[i] : drawEnd(r, from, tries < 40 ? weights : null);
      if (c == null) continue;
      made = BUILD[type](r, c, size, must[c]) || (mode === "mixed" ? orbit(r, c, size, must[c]) : null);
    }
    if (!made) break;
    used.add(made.centre);
    rounds.push(made);
  }
  return { seed, mode, size, rounds };
}

// ---------- the answer ----------
/** How a round went for the things picked: hits, wrong picks and the points (0 to 100). An Intruder is right or wrong. */
export function judge(round, picked) {
  const set = new Set(picked), cands = round.cands;
  const hits = cands.filter(c => c.linked && set.has(c.id)).length, wrong = cands.filter(c => !c.linked && set.has(c.id)).length;
  const trues = cands.filter(c => c.linked).length;
  const points = round.type === "intruder" ? (wrong === 1 && set.size === 1 ? 100 : 0) : Math.round(100 * Math.max(0, hits - wrong) / trues);
  return { hits, wrong, trues, points, perfect: points === 100 };
}
const labelsOf = (c, id) => [...(LINKED.get(c)?.get(id)?.aspects || [])].map(a => ASPECT.get(a) || a).join(" and ");
/** What the reveal says about one candidate: { lead, because }: the verdict on one that isn't linked (or is, under another aspect), and the link itself, or the one it has instead. */
export function reasonOf(round, cand) {
  const c = round.centre;
  if (cand.linked) return { lead: "", because: say(c, cand.id) };
  if (cand.near) return { lead: `Linked to ${name(c)}, but as ${labelsOf(c, cand.id)}`, because: say(c, cand.id) };
  return { lead: `Not linked to ${name(c)}`, because: cand.home == null ? "" : say(cand.id, cand.home) };
}
const noteOf = (round, cand) => `${name(cand.id)}: ${Object.values(reasonOf(round, cand)).filter(Boolean).join(". ")}`;
/** What a round asks, in words. */
export function askOf(round) {
  const c = name(round.centre);
  if (round.type === "intruder") return `Which one is not linked to ${c}?`;
  if (round.type === "aspect") return `Pick everything linked to ${c} as ${ASPECT.get(round.aspect) || round.aspect}`;
  return `Pick everything the Codex links to ${c}`;
}

// ---------- what the pile keeps ----------
/**
 * The cards for the pile (pile.js; Deck asks them) from a round and what was picked: { key, why, payload }, payload
 * being the Deck's option card, about the two things so other games can ask about them too (plus `centre`, `pick` and
 * `linked`, which say what the card asks, for `settles`). A true link left out becomes "which of these is linked to X?"
 * with the wrong picks among its options; a wrong pick, when nothing was left out, "which of these is not linked to X?"
 * (an Aspect round has no such card: its wrong picks may be linked, but under another aspect, so it asks for a true
 * link again). Keys: `X>link`, `X!decoy`, `X~aspect>link`.
 */
export function cardsFor(round, picked) {
  const set = new Set(picked), c = round.centre, cn = name(c), j = judge(round, picked), an = ASPECT.get(round.aspect) || round.aspect;
  const trues = round.cands.filter(x => x.linked), decoysIn = round.cands.filter(x => !x.linked);
  const wrongPicks = decoysIn.filter(x => set.has(x.id)), left = trues.filter(x => !set.has(x.id));
  const card = (ask, prompt, right, others, linked, cand) => ({
    fixed: true, ask, prompt, answer: name(right), options: [right, ...others.slice(0, 3)].map(name), right: [0], need: 1,
    note: noteOf(round, cand), about: [c, cand.id], centre: c, pick: cand.id, linked,
  });
  const aspected = round.type === "aspect", key = (sep, id) => `${c}${aspected ? `~${round.aspect}` : ""}${sep}${id}`;
  const askLinked = aspected ? `Which of these is linked to ${cn} as ${an}?` : `Which of these is linked to ${cn} in the Codex?`;
  const where = aspected ? `Nexus · ${cn}, ${an}` : `Nexus · linked to ${cn}`;
  const out = [];
  if (round.type === "intruder") {
    if (!j.perfect) { const odd = decoysIn[0]; out.push({ key: key("!", odd.id), why: "wrong", payload: card(`Nexus · not linked to ${cn}`, `Which of these is not linked to ${cn} in the Codex?`, odd.id, trues.map(x => x.id), false, odd) }); }
    return out;
  }
  for (const m of left) out.push({ key: key(">", m.id), why: "miss", payload: card(where, askLinked, m.id, [...wrongPicks, ...decoysIn.filter(x => !set.has(x.id))].map(x => x.id), true, m) });
  if (!left.length && wrongPicks.length) {
    if (aspected) { const t = trues[0]; out.push({ key: key(">", t.id), why: "wrong", payload: card(where, askLinked, t.id, [...wrongPicks, ...decoysIn.filter(x => !set.has(x.id))].map(x => x.id), true, t) }); }
    else for (const w of wrongPicks) out.push({ key: key("!", w.id), why: "wrong", payload: card(`Nexus · not linked to ${cn}`, `Which of these is not linked to ${cn} in the Codex?`, w.id, trues.map(x => x.id), false, w) });
  }
  return out;
}
/** What playing a round settles among the cards the pile dealt it for (`items`: [{ key, payload }]): { key, right } for each whose pick is in the round. */
export function settles(round, picked, items) {
  const set = new Set(picked);
  return items.filter(it => it.payload?.centre === round.centre && round.cands.some(x => x.id === it.payload.pick))
    .map(it => ({ key: it.key, right: it.payload.linked ? set.has(it.payload.pick) : !set.has(it.payload.pick) }));
}
