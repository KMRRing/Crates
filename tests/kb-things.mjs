// The shared knowledge-base pieces (kb-things.js; Nexus draws its centres with them, and Arb did its routes' ends): what a
// thing is about, and a draw from a mix of topics: every topic in deals evenly, a thing is never drawn only for topics that
// are out, a topic weighed twice comes up about twice as often, a mix of nothing deals nothing (its caller falls back to everything), a match's link
// carries its mix whole, and the mix is made from the suite's one set of subjects (topicsOf): every subject on is Balanced,
// subjects off take their topics out, and nothing on deals every topic.
// Run: node tests/kb-things.mjs
import { ENT, ABOUT, TOPIC_LIST, topicsOf, drawEnd, endWeight, name, kind } from "../kb-things.js";
import { mixParam, mixFromParam, cleanMix, cleanSubjects, subjectsIn, subjectsSay, SUBJECT_PRESETS, TOPIC_OF } from "../topics.js";
let bad = 0;
const fail = (...why) => { bad++; console.log(...why); };

// the things a draw can end on: those about a topic of the list and no other (a topic outside the list weighs 1 in any
// mix), every tenth of them to keep the draws quick (a draw weighs the whole pool)
const IDS = new Set(TOPIC_LIST.map(([id]) => id));
const ALL_ABOUT = [...ABOUT.keys()].filter(id => ENT.has(id) && ABOUT.get(id).size && [...ABOUT.get(id)].every(t => IDS.has(t))).sort();
const POOL = ALL_ABOUT.filter((_, i) => i % 10 === 0);
if (ALL_ABOUT.length < 1000) fail("too few things with a topic", ALL_ABOUT.length);
const untopical = [...ABOUT.keys()].filter(id => ENT.has(id) && !ABOUT.get(id).size);
if (untopical.length > ABOUT.size / 20) fail("things about no topic, in whatever the mix:", untopical.length, "of", ABOUT.size);
if (!(name(POOL[0]) && typeof kind(POOL[0]) === "string")) fail("a thing has no name or kind");

const mixOf = (base, over = {}) => ({ ...Object.fromEntries(TOPIC_LIST.map(([id]) => [id, base])), ...over });
const rand = seed => () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const draws = (w, n = 1000, seed = 9) => { const r = rand(seed); return Array.from({ length: n }, () => drawEnd(r, POOL, w)); };
const about = (id, topics) => [...ABOUT.get(id)].some(t => topics.includes(t));
const only = (id, topics) => ABOUT.get(id)?.size && [...ABOUT.get(id)].every(t => topics.includes(t));

// no mix and every topic in are the same draw, seed for seed
{
  const a = draws(null, 200), b = draws(mixOf(1), 200);
  if (JSON.stringify(a) !== JSON.stringify(b)) fail("Balanced draws other things than no mix");
}
// culture out: nothing drawn only about the arts
const ART = ["cult", "screen", "style"], noArt = mixOf(1, { cult: 0, screen: 0, style: 0 });
const onlyArt = draws(noArt).filter(id => only(id, ART));
if (onlyArt.length) fail("drawn only about topics out:", onlyArt.slice(0, 5).join(" "));
// one topic in, every other out: everything drawn is about it
const energy = draws(mixOf(0, { nrg: 1 })).filter(id => !about(id, ["nrg"]));
if (energy.length) fail("with only Energy in, drawn about other things:", energy.slice(0, 5).join(" "));
// a topic more: a thing about it weighs twice what it would in, so those come nearly twice as often
const share = (w, n = 2500) => draws(w, n, 17).filter(id => about(id, ["hist"])).length / n;
const hist = POOL.filter(id => about(id, ["hist"])), p = hist.length / POOL.length, histMore = mixOf(1, { hist: 2 });
const evenShare = share(null), moreShare = share(histMore);
if (!hist.every(id => endWeight(histMore, id) === 2)) fail("a thing about history not weighed twice with History more");
if (Math.abs(evenShare - p) > .03 || Math.abs(moreShare - 2 * p / (1 + p)) > .03) fail("History more:", moreShare.toFixed(3), "drawn about it, Balanced", evenShare.toFixed(3), "of", p.toFixed(3));
// a mix with every topic out draws nothing (the caller then deals from every topic, as Nexus does after forty tries)
if (draws(mixOf(0), 20).some(id => id != null)) fail("a mix with every topic out drew something");

// ---------- the mix as a match keeps it ----------
// (a link from before topics were on or off may carry a weight of 2: it still deals)
const own = mixOf(1, { cult: 0, nrg: 2, mkts: 2, ppl: 0 });
if (JSON.stringify(mixFromParam(TOPIC_LIST, mixParam(TOPIC_LIST, own))) !== JSON.stringify(own)) fail("a match's mix changed on its way through the link");
if (JSON.stringify(draws(mixFromParam(TOPIC_LIST, mixParam(TOPIC_LIST, own)), 100)) !== JSON.stringify(draws(own, 100))) fail("a match draws other things on the partner's phone");

// ---------- the suite's one set of subjects (topics.js, topics-on.js; Settings) ----------
{
  const on = cleanSubjects(null), none = cleanSubjects(SUBJECT_PRESETS.none.topics);
  const onlySubject = id => cleanSubjects({ ...SUBJECT_PRESETS.none.topics, [id]: 1 });
  const without = (...ids) => cleanSubjects(Object.fromEntries(ids.map(id => [id, 0])));
  if (TOPIC_LIST.some(([id]) => !TOPIC_OF.kb[id])) fail("a topic of the knowledge base belongs to no subject");
  // all on is Balanced: every topic in once, and the same draws, seed for seed
  const all = topicsOf(on);
  if (JSON.stringify(all) !== JSON.stringify(cleanMix(TOPIC_LIST, null)) || !TOPIC_LIST.every(([id]) => all[id] === 1)) fail("all subjects on is not every topic in once");
  if (JSON.stringify(draws(all, 100)) !== JSON.stringify(draws(null, 100))) fail("all subjects on draws other things than Balanced");
  // a subject off takes its topics out (Literature, music & myth is cult, Film, TV & games screen, Craft & style style);
  // the subjects with no topic here (maths, cities...) change nothing
  const noArts = topicsOf(without("cult", "screen", "style"));
  if (!(noArts.cult === 0 && noArts.screen === 0 && noArts.style === 0 && noArts.geo === 1 && noArts.nrg === 1)) fail("subjects off did not take their topics out", JSON.stringify(noArts));
  if (draws(noArts).some(id => only(id, ART))) fail("a thing only about subjects off was drawn");
  if (JSON.stringify(draws(noArts, 100)) === JSON.stringify(draws(all, 100))) fail("subjects off drew the same things as all on");
  if (JSON.stringify(topicsOf(without("math", "cities", "rel", "art"))) !== JSON.stringify(all)) fail("a subject none of these topics belongs to changed the mix");
  // one subject on, the rest off: everything drawn is about its topics (Energy is nrg alone)
  const nrgOnly = topicsOf(onlySubject("nrg"));
  if (TOPIC_LIST.some(([id]) => (nrgOnly[id] === 1) !== (id === "nrg"))) fail("only Energy on is not the energy topic alone", JSON.stringify(nrgOnly));
  if (draws(nrgOnly).some(id => !about(id, ["nrg"]))) fail("with only Energy on, drawn about other things");
  // two subjects can share a topic's weight: Trade & shipping carries Production and Trade & logistics as well
  const trade = topicsOf(onlySubject("trade"));
  if (!(trade.trade === 1 && trade.prod === 1 && trade.logi === 1 && trade.hist === 0)) fail("Trade & shipping did not bring its commodity topics", JSON.stringify(trade));
  // nothing on: a mix of nothing (the callers then draw from every topic, as all on does), and the menu says so
  const nothing = topicsOf(none);
  if (TOPIC_LIST.some(([id]) => nothing[id] !== 0) || subjectsIn(none).length) fail("all subjects off is not nothing in");
  if (draws(nothing, 20).some(id => id != null)) fail("nothing on drew something");
  if (!/every topic/.test(subjectsSay(none))) fail("the topics line does not say nothing on deals every topic");
  // a match carries the dealer's mix whole
  const custom = topicsOf(without("hist", "sport", "agr"));
  if (JSON.stringify(mixFromParam(TOPIC_LIST, mixParam(TOPIC_LIST, custom))) !== JSON.stringify(custom)) fail("a mix made from subjects changed on its way through the link");
  // an old link of the Trader preset's weights of 2 still draws
  const trader = mixOf(1, { nrg: 2, met: 2, agr: 2, mkt: 2, fin: 2, trade: 2, co: 2, mkts: 2, logi: 2, reg: 2, firm: 2 });
  if (draws(mixFromParam(TOPIC_LIST, mixParam(TOPIC_LIST, trader)), 50).some(id => id == null)) fail("a linked mix with weights of 2 no longer draws");
}

console.log(bad ? `kb-things: ${bad} problems` : `kb-things: ${ALL_ABOUT.length} things with a topic; History more draws ${Math.round(moreShare * 100)}% about it (Balanced ${Math.round(evenShare * 100)}%)`);
if (bad) process.exitCode = 1;
