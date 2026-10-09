// Calibre's tests: once a level runs, questions on what you made and what its lesson taught, in several kinds: pick one
// of several, fill in a number or a word, tap a part on the picture, name the part pointed at, put a train in order.
// They come from three places: the design you made (its own tooth counts, so the arithmetic is yours: each mesh's ratio,
// how far apart its arbors stand, the train's ratio in all, how fast the goal turns and which way, where the parts are,
// which layer two parts meet on), the level's own questions on its ideas (written below, level by level), and the
// words the level brought in (the glossary's). Pure, no page: tests/calibre.mjs builds every level's test and answers it.
import { run, solved, workings, inState, rateText, radius, MODULE, beatOf, MAINSPRING_TURNS, DIAL_LAYERS } from "./calibre-engine.js";
import { LEVELS, GLOSSARY } from "./calibre-levels.js";
import { LAYER_NAMES, extentOf } from "./calibre-draw.js";
import { lessonFor } from "./calibre-lessons.js";

/** A seeded random source (mulberry32): a test deals the same for a seed, differently for another. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (list, rnd) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (list, rnd) => list[Math.floor(rnd() * list.length)];
/** A number as it reads: 18,000; 1931; 7.5; 59.063 (thousands are marked from ten thousand, so a year reads as one). */
const fmt = n => (Number.isInteger(n) && Math.abs(n) >= 10000 ? n.toLocaleString("en-GB") : String(+n.toFixed(3)));
/** A unit for one: 1 turn, 1 mesh, 1 time a year. */
const UNIT_ONE = { turns: "turn", times: "time", meshes: "mesh", hours: "hour", days: "day", minutes: "minute", beats: "beat", teeth: "tooth", steps: "step", points: "point", notches: "notch", years: "year", blows: "blow", seconds: "second", degrees: "degree" };
const unitFor = (unit, n) => (n === 1 && unit ? unit.replace(/^\w+/, w => UNIT_ONE[w] || w) : unit);
/** A name inside a sentence: "the centre wheel" (a name that starts with a figure or capitals keeps them: 24-hour, GMT). */
const lc = s => (/^[A-Z](?=[a-z\s])/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

// ---------- kinds of question ----------
// choice: { ask, right, wrongs, order (the options in an order of their own, as True and False) }; number: { ask, answer, unit,
// tol }; word: { ask, answer, accept (other spellings) }; tap: { ask, answer: [arbor] }; order: { ask, items (in order) }.
// Any of them: explain (said after the answer, right or wrong), scene (the picture: calibre-scenes.js's) or see (the
// picture of the lesson's step of that number).
const choice = (ask, right, wrongs, explain, extra = {}) => ({ kind: "choice", ask, right, wrongs, explain, ...extra });
const number = (ask, answer, explain, extra = {}) => ({ kind: "number", ask, answer, explain, ...extra });
const word = (ask, answer, explain, extra = {}) => ({ kind: "word", ask, answer, explain, ...extra });
const truth = (ask, yes, explain, extra = {}) => choice(ask, yes ? "True" : "False", [yes ? "False" : "True"], explain, { order: ["True", "False"], ...extra });

// ---------- answers ----------
/** The numbers a typed answer could mean: "7,5" is 7.5 the European way, "18,000" is 18000 the English way. */
export function readNumbers(text) {
  const s = String(text ?? "").trim().replace(/\s+/g, "").replace(/[×x÷]/g, "");
  if (!s) return [];
  const out = [Number(s.replace(/,/g, "")), Number(s.replace(/\./g, "").replace(",", ".")), Number(s.replace(",", "."))];
  return out.filter(Number.isFinite);
}
/** A word as typed, reduced to what matters: case, accents, articles, punctuation and a plural's s don't. */
const plain = s => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(the|a|an)\s+/, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/s$/, "");
/** Whether an answer is right: the option chosen, the arbor tapped, the order given, the number or the word typed. */
export function isRight(q, given) {
  if (given == null) return false;
  if (q.kind === "choice") return given === q.answer;
  if (q.kind === "tap") return q.answer.includes(given);
  if (q.kind === "order") return Array.isArray(given) && given.length === q.items.length && given.every((x, i) => x === q.items[i]);
  if (q.kind === "number") return readNumbers(given).some(v => Math.abs(v - q.answer) <= (q.tol ?? (Number.isInteger(q.answer) ? 1e-6 : 0.006)));
  if (q.kind === "word") return !!plain(given) && [q.answer, ...(q.accept || [])].some(a => plain(a) === plain(given));
  return false;
}
/** The right answer in words, for the line after a wrong one. */
export function rightAnswer(q) {
  if (q.kind === "choice") return q.options[q.answer];
  if (q.kind === "number") return `${fmt(q.answer)}${q.unit ? ` ${unitFor(q.unit, q.answer)}` : ""}`;
  if (q.kind === "word") return q.answer;
  if (q.kind === "tap") return q.answerName;
  if (q.kind === "order") return q.items.join(", ");
  return "";
}
/** What a wrong tap is told: what it hit, and that the right one is ringed. */
export const missedTap = (q, given) => `Not quite: that's ${q.names?.[given] ? theName(q.names[given]) : "another part"}; ${q.answerName} is ringed in green.`;
/** How many right answers pass a test: three in four, rounded up. */
export const passMark = n => Math.ceil(n * 0.75);

// ---------- what the parts are called ----------
// The arbors a level's solution adds have no names of their own: what each one is, by the solution's id
const ROLES = {
  "1.2": { a1: "idler" }, "1.3": { a1: "middle" }, "1.5": { a1: "idler" }, "1.6": { a1: "middle" }, "1.7": { a1: "middle" },
  "2.2": { a1: "third" }, "2.3": { a1: "third" }, "4.1": { a1: "minute" }, "4.2": { a1: "minute" }, "4.4": { a1: "idler" }, "4.3": { a1: "minute" },
  "5.2": { a1: "intermediate" }, "6.1": { a1: "crownwheel" }, "6.2": { a1: "setting1", a2: "setting2" }, "7.3": { a1: "week" },
  "8.1": { a1: "third" }, "8.2": { a1: "third" }, "10.1": { a1: "reduction" }, "10.2": { a1: "reverser2" },
};
// an arbor's name, by its id or role; and a wheel's and a pinion's on it ([wheel, pinion]), where they have names
const ARBOR_NAMES = { idler: "Idler", middle: "Middle arbor", third: "Third wheel", minute: "Minute wheel", intermediate: "Intermediate wheel", crownwheel: "Crown wheel",
  setting1: "First setting wheel", setting2: "Second setting wheel", week: "Week wheel", reduction: "Reduction wheel", reverser2: "Second reverser" };
const GEAR_NAMES = {
  centre: ["Centre wheel", "Centre pinion"], third: ["Third wheel", "Third pinion"], seconds: ["Fourth wheel", "Fourth pinion"], escape: [null, "Escape pinion"],
  hours: ["Hour wheel", null], minute: ["Minute wheel", "Minute pinion"], h24: ["24-hour wheel", null], idler: ["Idler", null], chrono: ["Chronograph wheel", null],
  coupling: ["Coupling wheel", "Oscillating pinion"], reduction: ["Reduction wheel", "Reduction pinion"], rotor: [null, "Rotor pinion"], intermediate: ["Intermediate wheel", "Intermediate pinion"],
  crownwheel: ["Crown wheel", null], setting1: ["Setting wheel", null], setting2: ["Setting wheel", null], week: ["Week wheel", "Week pinion"], moon: ["Moon disc", "Moon pinion"],
};
const BY_KIND = { barrel: "Barrel", escape: "Escape wheel", fork: "Pallet fork", balance: "Balance", ratchet: "Ratchet wheel", finger: "Finger", rotor: "Rotor",
  reverser: "Reverser", heart: "Heart cam", column: "Column wheel", cam: "Calendar cam", kidney: "Kidney cam", century: "Century wheel", cage: "Tourbillon cage" };
/** What a part is called, by its kind and its arbor (or the arbor's role); null where it has no name of its own. */
export function partTitle(a, p, role) {
  if (BY_KIND[p.kind]) return BY_KIND[p.kind];
  if (p.kind === "star") return p.internal ? "Date ring" : p.teeth === 59 ? "Moon disc" : "Star wheel";
  if (p.kind === "snail") return a.id === "centre" ? "Quarter snail" : "Hour snail";
  if (a.id === "centre" && p.kind === "pinion" && DIAL_LAYERS.includes(p.layer)) return "Cannon pinion";
  if (a.id === "seconds" && p.kind === "wheel" && DIAL_LAYERS.includes(p.layer)) return "Driving wheel";
  if (a.id === "crown" && p.kind === "pinion") return /^Sliding/.test(a.label || "") ? "Sliding pinion" : "Winding pinion";
  const pair = GEAR_NAMES[role || a.id];
  return pair ? pair[p.kind === "pinion" ? 1 : 0] : null;
}
// the other spellings a typed name may take
const ALSO = { "Pallet fork": ["fork", "pallet", "lever", "anchor"], "Escape wheel": ["escape"], "Balance": ["balance wheel"], "Cannon pinion": ["cannon"],
  "Ratchet wheel": ["ratchet"], "Date ring": ["date disc", "date wheel"], "Moon disc": ["moon", "moon wheel", "moon phase disc"], "Heart cam": ["heart"],
  "Tourbillon cage": ["tourbillon", "cage"], "Calendar cam": ["cam", "month cam"], "Kidney cam": ["kidney"], "Hour snail": ["snail"], "Quarter snail": ["snail"] };

// ---------- the design under test ----------
/**
 * What a test needs of a design: it in its first state, its run, the paths driving its goals, what each arbor is called
 * (an arbor you added is named for the arbor the solution adds in its place, if it's on the same path at the same step;
 * failing that by what it carries: "your 10/75 arbor"), and the arbors you put parts on.
 */
/** The arbors a level's goals are about: an arbor's rate, a cam's, a snail's, the hearts', a column wheel's, a counter's. */
const goalArbors = (level, design) => new Set((level.goals || []).flatMap(g => Object.values(g)).flat().filter(v => typeof v === "string" && design.arbors.some(a => a.id === v)));
function study(level, design) {
  const state = level.scenarios?.[0], shown = state ? inState(design, state) : design, out = run(shown);
  const goals = (level.goals || []).filter(g => g.arbor && (!g.in || g.in === state?.id));
  const paths = goals.map(g => ({ g, steps: workings(shown, out, g.arbor) })).filter(x => x.steps?.length);
  const roles = new Map(), byRole = ROLES[level.id] || {};
  const sol = state ? inState(solved(level), state) : solved(level), solOut = run(sol);
  for (const { g, steps } of paths) {
    const theirs = workings(sol, solOut, g.arbor);
    if (!theirs || theirs.length !== steps.length) continue;
    const mine = [steps[0].from, ...steps.map(s => s.to)], ref = [theirs[0].from, ...theirs.map(s => s.to)];
    ref.forEach((id, i) => { const role = byRole[id.replace(/~$/, "")], a = shown.arbors.find(x => x.id === mine[i].replace(/~$/, "")); if (role && a && !a.label) roles.set(a.id, role); });
  }
  for (const a of shown.arbors) if (!a.label && byRole[a.id] && !roles.has(a.id) && sol.arbors.some(b => b.id === a.id && Math.hypot(b.x - a.x, b.y - a.y) < 0.05)) roles.set(a.id, byRole[a.id]);
  const arbor = id => shown.arbors.find(a => a.id === String(id).replace(/~$/, ""));
  const teeth = a => (a.parts || []).filter(p => p.teeth).map(p => p.teeth).join("/");
  const name = id => {
    const a = arbor(id);
    if (!a) return "Arbor";
    if (a.label) { const n = a.label.replace(/ \(.*\)$/, "").replace(/ with its .*$/, ""); return n === "Centre" ? "Centre arbor" : n; }
    return ARBOR_NAMES[roles.get(a.id)] || `Your ${teeth(a) || "new"} arbor`;
  };
  const made = new Set(design.arbors.filter(a => (a.parts || []).some(p => !p.fixed)).map(a => a.id));
  return { level, design: shown, out, goals, paths, roles, arbor, name, made, about: goalArbors(level, shown) };
}
const copyArbors = arbors => arbors.map(a => ({ ...a, parts: (a.parts || []).map(p => ({ ...p })) }));
/** A picture of the design under test: still, its own names left off unless given. */
const picture = (S, extra = {}) => ({ arbors: copyArbors(S.design.arbors), plate: S.level.plate, motion: "still", ...extra });
const bare = id => String(id).replace(/~$/, "");

// ---------- questions from the design you made ----------
/** A gear in a mesh, named as a watchmaker would: the third wheel, of 75 teeth; the fourth pinion, of 10 leaves; the
 *  20-tooth wheel on the idler, where it has no name of its own. */
function gearWords(S, id, layer, teeth) {
  const a = S.arbor(id), p = (a?.parts || []).find(q => q.layer === layer), pinion = id.endsWith("~") || p?.kind === "pinion";
  const title = id.endsWith("~") ? null : a && p && partTitle(a, p, S.roles.get(a.id));
  if (title) return `the ${lc(title)}, of ${teeth} ${pinion ? "leaves" : "teeth"},`;
  return `the ${teeth}-${pinion ? "leaf pinion" : "tooth wheel"} on the ${lc(S.name(id))}`;
}
/** A gear's own name where it has one (the coupling wheel, on the coupling lever's arbor), else its arbor's. */
const gearName = (S, id, layer) => { const a = S.arbor(id), p = (a?.parts || []).find(q => q.layer === layer); return (!id.endsWith("~") && a && p && partTitle(a, p, S.roles.get(a.id))) || S.name(id); };
/** A mesh's ratio, asked so the answer is at least one: the driven's turns for one of the driver's, or the other way. */
function ratioQuestion(S, st) {
  const A = gearName(S, st.from, st.layer), B = gearName(S, st.to, st.layer), up = Math.abs(st.k) >= 1, a = gearWords(S, st.from, st.layer, st.driver), b = gearWords(S, st.to, st.layer, st.driven).replace(/,$/, "");
  const said = `${a[0].toUpperCase()}${a.slice(1)} drives ${b}.`;
  const scene = picture(S, { focus: [bare(st.from), bare(st.to)], lit: { a: bare(st.from), b: bare(st.to) }, labels: { [bare(st.from)]: A, [bare(st.to)]: B } });
  // why, as the lesson put it: a wheel driving a pinion speeds up, a pinion driving a wheel slows down (two wheels: the same rule)
  const pinionTo = / pinion|leaves/.test(b), pinionFrom = / pinion|leaves/.test(a);
  const why = st.driver === st.driven ? "as many teeth on each, so the driven keeps the driver's speed"
    : up ? (pinionTo && !pinionFrom ? "a wheel driving a pinion speeds up, by its teeth over the pinion's leaves" : "the driven turns faster, by the driver's teeth over its own")
    : (pinionFrom && !pinionTo ? "a pinion driving a wheel slows down, by the wheel's teeth over the pinion's leaves" : "the driven turns slower, by its own teeth over the driver's");
  return up
    ? number(`${said} How many times does the ${lc(B)} turn for each turn of the ${lc(A)}?`, st.driver / st.driven, `${st.driver} over ${st.driven} is ×${fmt(st.driver / st.driven)}: ${why}.`, { unit: "turns", scene, topic: "ratio" })
    : number(`${said} How many turns of the ${lc(A)} make one turn of the ${lc(B)}?`, st.driven / st.driver, `${st.driver} into ${st.driven} is ÷${fmt(st.driven / st.driver)}: ${why}.`, { unit: "turns", scene, topic: "ratio" });
}
/** How far apart two meshing arbors stand: half the teeth plus half the leaves, a module a tooth. */
function distanceQuestion(S, st) {
  const A = S.name(st.from), B = S.name(st.to), p = (S.arbor(st.from)?.parts || []).find(q => q.layer === st.layer), m = p?.m || MODULE, d = ((st.driver + st.driven) * m) / 2;
  return number(`How far apart do the ${lc(A)} and the ${lc(B)} stand, for their ${st.driver} and ${st.driven} to mesh, in mm?`, +d.toFixed(4),
    `Half the teeth plus half the leaves, at ${m} mm a tooth: (${st.driver} + ${st.driven}) ÷ 2 × ${m} = ${fmt(d)} mm.`,
    { unit: "mm", tol: 0.006, topic: "distance", scene: picture(S, { focus: [bare(st.from), bare(st.to)], lit: { a: bare(st.from), b: bare(st.to) }, labels: { [bare(st.from)]: A, [bare(st.to)]: B } }) });
}
/** The ratio of a whole path: the steps' ratios multiplied. */
function totalQuestion(S, steps) {
  const total = Math.abs(steps.reduce((m, st) => m * st.k, 1)), src = S.name(steps[0].from), tgt = S.name(steps.at(-1).to);
  const chain = steps.map(st => (Math.abs(st.k) >= 1 ? `×${fmt(Math.abs(st.k))}` : `÷${fmt(1 / Math.abs(st.k))}`)).join(", then ");
  const ids = [...new Set(steps.flatMap(st => [bare(st.from), bare(st.to)]))], scene = picture(S, { focus: ids, labels: { [bare(steps[0].from)]: src, [bare(steps.at(-1).to)]: tgt } });
  return total >= 1
    ? number(`How many turns does the ${lc(tgt)} make for each turn of the ${lc(src)}, all the train's steps together?`, +total.toFixed(4), `Each step's ratio multiplied: ${chain}, so ×${fmt(total)} in all.`, { unit: "turns", tol: 0.006, scene, topic: "total" })
    : number(`How many turns of the ${lc(src)} make one turn of the ${lc(tgt)}, all the train's steps together?`, +(1 / total).toFixed(4), `Each step's ratio multiplied: ${chain}, so ÷${fmt(1 / total)} in all.`, { unit: "turns", tol: 0.006, scene, topic: "total" });
}
/** A rate in the unit that makes it a plain number: times a minute, times an hour, hours or days a turn. */
function rateIn(r) {
  const a = Math.abs(r);
  if (a >= 60) return { value: a / 60, ask: "How many times a minute does", unit: "times a minute" };
  if (a >= 1) return { value: a, ask: "How many times an hour does", unit: "times an hour" };
  if (1 / a <= 48) return { value: 1 / a, ask: "How many hours does", tail: "take to turn once", unit: "hours" };
  return { value: 1 / a / 24, ask: "How many days does", tail: "take to turn once", unit: "days" };
}
/** A speed in words, without its direction: once a minute, twice an hour, 8 times an hour, once every 12 hours. */
const speedWords = r => rateText(r).replace(/, (anti)?clockwise$/, "").replace(/^([\d.]+) (an?) /, (_, n, per) => `${{ 1: "once", 2: "twice" }[n] || `${n} times`} ${per} `);
/** How fast a goal's arbor turns, from how fast the train's first arbor does. */
function rateQuestion(S, steps) {
  const src = steps[0].from, tgt = steps.at(-1).to, rs = S.out.rates[src], rt = S.out.rates[tgt];
  if (!rs || !rt) return null;
  const u = rateIn(rt), total = Math.abs(rt / rs);
  return number(`The ${lc(S.name(src))} turns ${speedWords(rs)}. ${u.ask} the ${lc(S.name(tgt))} ${u.tail || "turn"}?`, +u.value.toFixed(4),
    `The train from one to the other is ${total >= 1 ? `×${fmt(total)}` : `÷${fmt(1 / total)}`}, so it turns ${speedWords(rt)}.`,
    { unit: u.unit, tol: 0.006, topic: "rate", scene: picture(S, { focus: [...new Set(steps.flatMap(st => [bare(st.from), bare(st.to)]))], labels: { [bare(src)]: S.name(src), [bare(tgt)]: S.name(tgt) } }) });
}
/** Which way a goal's arbor turns: every mesh turns the next the other way round. */
function directionQuestion(S, steps) {
  const src = steps[0].from, tgt = steps.at(-1).to, rs = S.out.rates[src] ?? S.out.relative?.[src], rt = S.out.rates[tgt] ?? S.out.relative?.[tgt];
  if (!rs || !rt) return null;
  const way = r => (r > 0 ? "clockwise" : "anticlockwise"), flips = steps.filter(st => st.k < 0).length;
  return choice(`The ${lc(S.name(src))} turns ${way(rs)}. Which way does the ${lc(S.name(tgt))} turn?`, way(rt) === "clockwise" ? "Clockwise" : "Anticlockwise", [way(rt) === "clockwise" ? "Anticlockwise" : "Clockwise"],
    `Each mesh turns the next the other way round: ${flips} reversal${flips === 1 ? "" : "s"} from one to the other, so ${flips % 2 ? "the other way" : "the same way"}.`,
    { order: ["Clockwise", "Anticlockwise"], topic: "direction", scene: picture(S, { focus: [...new Set(steps.flatMap(st => [bare(st.from), bare(st.to)]))], labels: { [bare(src)]: `${S.name(src)}: ${way(rs)}`, [bare(tgt)]: S.name(tgt) } }) });
}
/** The layer two parts meet on, read off the 3D view. */
function layerQuestion(S, st, rnd) {
  const used = [...new Set(S.design.arbors.flatMap(a => (a.parts || []).map(p => p.layer)))].filter(l => LAYER_NAMES[l] && l < 9), right = LAYER_NAMES[st.layer];
  const wrongs = shuffle(used.filter(l => l !== st.layer).map(l => LAYER_NAMES[l]), rnd).slice(0, 3);
  if (wrongs.length < 1) return null;
  const A = S.name(st.from), B = S.name(st.to);
  return choice(`On which layer do the ${lc(A)} and the ${lc(B)} mesh?`, right, wrongs,
    `Only parts on one layer mesh: they meet on ${/^\d/.test(right) ? `layer ${right}` : right}, where the lit dot is, level with its name on the left.`,
    { topic: "layer", scene: { ...picture(S), view: "3d", up: DIAL_LAYERS.includes(st.layer) ? "dial" : "train", focus: [bare(st.from), bare(st.to)], lit: { a: bare(st.from), b: bare(st.to) }, labels: { [bare(st.from)]: A, [bare(st.to)]: B } } });
}
/** "the third wheel", "your 10/75 arbor": a name as a sentence says it. */
const theName = n => (/^Your /.test(n) ? lc(n) : `the ${lc(n)}`);
/** Every arbor's name, to write by the ring of whatever a tap lands on. */
const namesOf = S => Object.fromEntries(S.design.arbors.map(a => [a.id, S.name(a.id)]));
/** The arbors that can be tapped and told apart: named, and not sharing their place with another. */
function tappable(S) {
  const shared = new Set(S.design.arbors.filter(a => a.on || S.design.arbors.some(b => b !== a && Math.hypot(b.x - a.x, b.y - a.y) < 0.3)).flatMap(a => [a.id, a.on].filter(Boolean)));
  return S.design.arbors.filter(a => !shared.has(a.id) && ((a.parts || []).length || a.noParts) && !/^Your /.test(S.name(a.id)));
}
function tapQuestion(S, rnd) {
  const can = tappable(S);
  if (can.length < 2) return null;
  const mine = can.filter(a => S.made.has(a.id)), keen = mine.length ? mine : can.filter(a => S.about.has(a.id));
  const a = pick(keen.length ? keen : can, rnd), name = S.name(a.id), def = GLOSSARY.find(([t]) => t.toLowerCase() === name.toLowerCase())?.[1];
  return { kind: "tap", ask: `Tap the ${lc(name)}.`, answer: [a.id], answerName: `the ${lc(name)}`, names: namesOf(S), explain: def ? `The ${lc(name)} is ${lc(def)}` : "", scene: picture(S), topic: "tap" };
}
/** The arbor turning at a round rate (once a minute, once an hour), to be found on the picture. */
function tapByRateQuestion(S) {
  const can = tappable(S), rate = (id, r) => Math.abs((S.out.rates[id] || 0) - r) < 1e-9 || Math.abs((S.out.rates[id] || 0) + r) < 1e-9;
  for (const [r, says] of [[60, "once a minute"], [1, "once an hour"], [1 / 12, "once in twelve hours"], [1 / 24, "once a day"]]) {
    const hits = can.filter(a => rate(a.id, r)), all = S.design.arbors.filter(a => rate(a.id, r));
    if (hits.length === 1 && all.length === 1) return { kind: "tap", ask: `Tap the arbor that turns ${says}.`, answer: [hits[0].id], answerName: `the ${lc(S.name(hits[0].id))}`, names: namesOf(S), explain: `The ${lc(S.name(hits[0].id))} turns ${says}.`, scene: picture(S), topic: "tap" };
  }
  return null;
}
/** A part pointed at, to be named: one of several names, or typed. */
function nameQuestion(S, rnd, typed) {
  const can = S.design.arbors.flatMap(a => (a.parts || []).map(p => ({ a, p, title: partTitle(a, p, S.roles.get(a.id)) }))).filter(x => x.title && !S.design.arbors.some(b => b !== x.a && b.on === x.a.id));
  if (!can.length) return null;
  const mine = can.filter(x => S.made.has(x.a.id) && !x.p.fixed), keen = mine.length ? mine : can.filter(x => S.about.has(x.a.id) || x.p.editable);
  const { a, p, title } = pick(keen.length ? keen : can, rnd), def = GLOSSARY.find(([t]) => t === title)?.[1];
  const scene = picture(S, { focus: [a.id], ring: { id: a.id, layer: p.layer } }), explain = `It's the ${lc(title)}.${def ? ` ${def}` : ""}`;
  scene.arbors = scene.arbors.map(b => (b.id === a.id ? { ...b, parts: b.parts.filter(q => q.layer === p.layer && q.kind === p.kind) } : b));
  if (typed) return word("What is the part in the ring called?", title, explain, { accept: ALSO[title] || [], scene, topic: "name" });
  const others = [...new Set([...can.map(x => x.title), ...NAME_POOL])].filter(t => t !== title && !(ALSO[t] || []).some(x => plain(x) === plain(title)));
  const near = others.filter(t => can.some(x => x.title === t)), rest = others.filter(t => !near.includes(t));
  return choice("What is the part in the ring called?", title, [...shuffle(near, rnd), ...shuffle(rest, rnd)].slice(0, 3), explain, { scene, topic: "name" });
}
const NAME_POOL = ["Barrel", "Centre wheel", "Third wheel", "Fourth wheel", "Escape wheel", "Pallet fork", "Balance", "Cannon pinion", "Minute wheel", "Hour wheel", "Idler",
  "Ratchet wheel", "Crown wheel", "Date ring", "Moon disc", "Chronograph wheel", "Coupling wheel", "Rotor", "Reverser", "Column wheel", "Heart cam", "Hour snail"];
/** A train put in order, from its first arbor: its names shuffled, to be tapped in turn. */
function orderQuestion(S, steps) {
  const names = [steps[0].from, ...steps.map(st => st.to)].map(id => S.name(id)).filter((n, i, all) => n !== all[i - 1]);
  if (names.length < 3 || new Set(names).size !== names.length) return null;
  return { kind: "order", ask: `Put the train in order, from the ${lc(names[0])}: tap them in turn.`, items: names, explain: `The turning goes ${names.map(lc).join(", then ")}.`, scene: picture(S), topic: "order" };
}
/** A wheel's size from its teeth. */
function sizeQuestion(S, st) {
  const teeth = Math.max(st.driver, st.driven), id = st.driver >= st.driven ? st.from : st.to, p = (S.arbor(id)?.parts || []).find(q => q.layer === st.layer), m = p?.m || MODULE;
  if (p?.kind === "barrel") return null;
  return number(`How wide is the ${teeth}-tooth wheel on the ${lc(S.name(id))}, across its pitch circle, in mm?`, +(teeth * m).toFixed(4), `${teeth} teeth at ${m} mm a tooth: ${fmt(teeth * m)} mm across.`,
    { unit: "mm", tol: 0.006, topic: "size", scene: picture(S, { focus: [bare(id)], labels: { [bare(id)]: S.name(id) } }) });
}
/** The beat's arithmetic, from the balance and escape wheel you have. */
function beatQuestions(S) {
  const esc = S.out.escapements.find(e => e.state === "running"), bal = esc && S.arbor(esc.balance)?.parts.find(p => p.kind === "balance");
  if (!esc || !bal) return [];
  const vph = beatOf(bal);
  if (!Number.isInteger(vph) || vph % 3600) return [];
  const scene = picture(S, { focus: [esc.escape, esc.balance, ...S.design.arbors.filter(a => (a.parts || []).some(p => p.kind === "fork")).map(a => a.id)] });
  return [
    number(`The balance beats ${fmt(vph)} times an hour. How many beats is that a second?`, vph / 3600, `${fmt(vph)} ÷ 3,600 seconds = ${fmt(vph / 3600)} beats a second.`, { unit: "beats", scene, topic: "beat" }),
    number(`The balance beats ${fmt(vph)} times an hour, and the escape wheel has ${esc.teeth} teeth, each giving two beats. How many times an hour does the escape wheel turn?`, vph / (2 * esc.teeth), `${fmt(vph)} ÷ (2 × ${esc.teeth}) = ${fmt(vph / (2 * esc.teeth))} turns an hour.`, { unit: "turns an hour", tol: 0.006, scene, topic: "beat" }),
  ];
}
/** How long the mainspring runs: five turns of the barrel at its rate. */
function reserveQuestion(S) {
  const b = S.design.arbors.find(a => (a.parts || []).some(p => p.kind === "barrel") && a.power != null), r = b && S.out.rates[b.id];
  if (!r) return null;
  const h = 1 / Math.abs(r);
  return number(`A full wind gives the barrel ${MAINSPRING_TURNS} turns, and it turns once every ${fmt(+h.toFixed(3))} hours. How many hours does the watch run?`, +(MAINSPRING_TURNS * h).toFixed(4),
    `${MAINSPRING_TURNS} turns × ${fmt(+h.toFixed(3))} hours a turn = ${fmt(+(MAINSPRING_TURNS * h).toFixed(2))} hours.`, { unit: "hours", tol: 0.06, topic: "reserve", scene: picture(S, { focus: [b.id], labels: { [b.id]: "Barrel" } }) });
}
/** A finger's star: a tooth a turn, so a turn of the star takes as many turns of the finger as it has teeth. */
function fingerQuestion(S) {
  const f = S.out.fingers.find(x => x.a !== "pusher"), rf = f && S.out.rates[f.a];
  if (!rf) return null;
  const hours = 1 / Math.abs(rf), [per, unit] = hours >= 24 ? [hours / 24, "days"] : hours >= 1 ? [hours, "hours"] : [hours * 60, "minutes"];
  const once = per === 1 ? `once ${unit === "days" ? "a day" : unit === "hours" ? "an hour" : "a minute"}` : `once every ${fmt(+per.toFixed(3))} ${unit}`;
  return number(`The finger on the ${lc(S.name(f.a))} turns ${once} and pushes the ${lc(S.name(f.b))} on one tooth of ${f.teeth} each turn. How many ${unit} for the ${lc(S.name(f.b))} to turn once?`,
    +(per * f.teeth).toFixed(4), `${f.teeth} teeth, a tooth a turn: ${f.teeth} × ${fmt(+per.toFixed(3))} = ${fmt(+(per * f.teeth).toFixed(3))} ${unit}.`,
    { unit, tol: 0.006, topic: "finger", scene: picture(S, { focus: [f.a, f.b], labels: { [f.a]: S.name(f.a), [f.b]: S.name(f.b) } }) });
}
/** The meshes a turning passes through. */
function meshCountQuestion(S, steps) {
  const n = steps.filter(st => st.driver).length;
  if (n < 2) return null;
  return number(`How many meshes does the turning pass through, from the ${lc(S.name(steps[0].from))} to the ${lc(S.name(steps.at(-1).to))}?`, n, `${n}: ${steps.filter(st => st.driver).map(st => `${lc(S.name(st.from))} to ${lc(S.name(st.to))}`).join("; ")}.`,
    { unit: "meshes", topic: "count", scene: picture(S, { focus: [...new Set(steps.flatMap(st => [bare(st.from), bare(st.to)]))] }) });
}

// ---------- the words ----------
const lessonText = L => lessonFor(L).map(st => st.say).join(" ") + " " + L.task + " " + (L.watch || []).join(" ");
const mentions = (text, term) => new RegExp(`(^|[^a-z])${term.toLowerCase().replace(/[-]/g, "[- ]?").replace(/[éè]/g, "[eé]")}(s|es)?([^a-z]|$)`, "i").test(text);
/** Where each word first comes up in the course: the level that brings it in. */
let firstSeen = null;
function introduced() {
  if (firstSeen) return firstSeen;
  firstSeen = new Map();
  for (const L of LEVELS) { const text = lessonText(L); for (const [term] of GLOSSARY) if (!firstSeen.has(term) && mentions(text, term)) firstSeen.set(term, L.id); }
  return firstSeen;
}
/** A definition with its own word blanked, in case it says it. */
const blank = (def, term) => def.replace(new RegExp(term.replace(/[-]/g, "[- ]?"), "ig"), "____");
/** A word's questions: name it from its meaning (typed, or one of several), or pick its meaning. */
function wordQuestion(term, how, rnd) {
  const def = GLOSSARY.find(([t]) => t === term)[1], seen = introduced(), at = LEVELS.findIndex(L => L.id === seen.get(term));
  const near = GLOSSARY.filter(([t]) => t !== term).sort((u, v) => Math.abs(LEVELS.findIndex(L => L.id === seen.get(u[0])) - at) - Math.abs(LEVELS.findIndex(L => L.id === seen.get(v[0])) - at));
  if (how === "typed") return word(`Which word is this? “${blank(def, term)}”`, term, `${term}: ${lc(def)}`, { accept: ALSO[term] || [], topic: "word" });
  if (how === "term") return choice(`Which word means this? “${blank(def, term)}”`, term, shuffle(near.slice(0, 6), rnd).slice(0, 3).map(([t]) => t), `${term}: ${lc(def)}`, { topic: "word" });
  // its meaning among meanings of about its length, so the right one doesn't stand out
  const likeIt = near.slice(0, 12).sort((u, v) => Math.abs(u[1].length - def.length) - Math.abs(v[1].length - def.length)).slice(0, 3).map(([, d]) => d);
  return choice(`What does “${term}” mean?`, def, likeIt, `${term}: ${lc(def)}`, { topic: "word" });
}
/** The words a level brings in, and failing those the ones its lesson uses. */
export function wordsOf(L) {
  const seen = introduced(), text = lessonText(L), mine = GLOSSARY.map(([t]) => t).filter(t => seen.get(t) === L.id);
  return mine.length ? mine : GLOSSARY.map(([t]) => t).filter(t => mentions(text, t));
}

// ---------- each level's own questions: on its ideas, whatever you built ----------
export const QUIZ = {
  // ---------- 1. Gears ----------
  "1.1": [
    number("A wheel has 50 teeth. How wide is it across its pitch circle, in mm?", 5, "A tenth of a millimetre a tooth: 50 × 0.1 = 5 mm.", { unit: "mm", see: 1 }),
    choice("Two meshing wheels turn…", "opposite ways round, at speeds in the ratio of their teeth", ["the same way round, at speeds in the ratio of their teeth", "opposite ways round, at one speed whatever their teeth"],
      "Each tooth of the driver pushes the other's on, so they turn opposite ways, and the smaller turns faster by the ratio of the teeth.", { see: 2 }),
    number("A 90-tooth wheel drives a 30-tooth wheel. How many turns does the 30 make for each turn of the 90?", 3, "90 over 30 is three.", { unit: "turns" }),
  ],
  "1.2": [
    choice("What does an idler change?", "The way the next wheel turns", ["The ratio between the outer wheels", "Both the ratio and the way round"], "An idler turns the direction back and nothing else: the outer two turn as if they met directly.", { see: 2 }),
    choice("Five wheels in a row, four meshes: the last turns…", "the same way as the first", ["the other way from the first", "not at all: the row locks"], "Four reversals, an even number, bring it back the same way."),
    truth("A 20-tooth idler between two 40s makes the last 40 turn twice as fast.", false, "An idler never changes the ratio: the outer two turn as if 40 met 40, at one speed."),
  ],
  "1.3": [
    word("What are a pinion's teeth called?", "leaves", "A pinion's teeth are its leaves.", { accept: ["leaf"], see: 1 }),
    choice("Why do a wheel and a pinion on one arbor sit on different layers?", "Each meets a different neighbour, and only one layer's parts mesh", ["A pinion is too small to sit on the same layer as a wheel", "Parts on one arbor would otherwise turn different ways round"],
      "Only parts on the same layer mesh, and the wheel and the pinion each mesh with a different arbor.", { see: 2 }),
    number("A 10-leaf pinion drives a 60-tooth wheel, whose own 10-leaf pinion drives a 100-tooth wheel. How many turns of the first pinion make one turn of the last wheel?", 60, "60 into 10 is six, 100 into 10 is ten: six times ten is sixty.", { unit: "turns" }),
  ],
  "1.4": [
    choice("Why can't three wheels that all mesh with one another turn?", "Round the triangle the third would turn both ways at once", ["Their teeth would have to be cut to three different sizes", "The middle wheel would have to turn three times too fast"],
      "Each turns the next the other way: round three meshes the third is asked to turn both ways at once, so the loop locks.", { see: 1 }),
    truth("Taking one wheel out of a locked triangle frees the other two.", true, "Two meshing wheels can always turn: it's the loop that locks."),
  ],
  "1.5": [
    choice("Why may no wheel pass over another arbor's pivot?", "The arbor runs up to its bridge, so the wheel would strike it", ["The pivot's jewel would wear the passing wheel's teeth down", "The wheel's teeth would catch on the pivot and turn it"],
      "An arbor stands from the plate to its bridge: a wheel crossing its pivot would hit the arbor itself.", { see: 1 }),
    number("How much clearance does every pivot keep here, in mm?", 0.15, "Every pivot keeps a margin of 0.15 mm that no other wheel may cross.", { unit: "mm", tol: 0.001 }),
  ],
  "1.6": [
    choice("A wheel driving a pinion…", "speeds up: the pinion turns faster by teeth over leaves", ["slows down: the pinion turns slower by leaves over teeth", "keeps the speed: wheel and pinion turn at one rate"], "A wheel driving a pinion speeds up, by the wheel's teeth over the pinion's leaves.", { see: 1 }),
    number("A train speeds up eight times, then six, then ten. How many times faster is its last arbor than its first?", 480, "Ratios multiply along a train: 8 × 6 × 10 = 480.", { unit: "times", see: 2 }),
  ],
  "1.7": [
    number("Twelve in two steps: the first step is ×4. What must the second be?", 3, "4 × 3 = 12.", { unit: "times" }),
    choice("Why must the last step of the train fill its distance exactly?", "The output can't move, so its mesh decides where your arbor stands", ["A longer distance would make the last step's ratio larger", "The last step's teeth are cut to a finer module than the rest"],
      "The output arbor is fixed: whatever meshes with it must stand exactly half its teeth plus half the leaves away.", { see: 2 }),
  ],
  // ---------- 2. The going train ----------
  "2.1": [
    choice("What does the centre wheel carry?", "The minute hand", ["The hour hand", "The seconds hand"], "The centre wheel turns once an hour and carries the minute hand.", { see: 3 }),
    number("The barrel turns once in 8 hours and the centre wheel once an hour. How many times faster is the centre wheel?", 8, "Eight hours to one: eight times faster.", { unit: "times" }),
    word("What is the coiled ribbon of steel in the barrel called?", "mainspring", "The mainspring: wound tight round the barrel's arbor, it turns the barrel as it lets down.", { accept: ["main spring", "spring"], see: 1 }),
  ],
  "2.2": [
    number("The centre wheel turns once an hour, the fourth wheel once a minute. How many times faster is the fourth?", 60, "Sixty minutes in an hour: sixty times faster.", { unit: "times" }),
    choice("Which wheel carries the small seconds hand?", "The fourth wheel", ["The third wheel", "The centre wheel"], "The fourth wheel turns once a minute and carries the small seconds.", { see: 1 }),
    choice("What must the third wheel's arbor mesh with?", "The centre wheel and the fourth wheel's pinion", ["The barrel and the centre wheel's own pinion", "The escape wheel and the pallet fork's stones"], "The third arbor's pinion takes the centre wheel's teeth; its wheel drives the fourth wheel's pinion.", { see: 2 }),
  ],
  "2.3": [
    number("An 80-tooth wheel meshes a 10-leaf pinion. How far apart are their arbors, in mm?", 4.5, "(80 + 10) ÷ 2 × 0.1 = 4.5 mm.", { unit: "mm", see: 2, topic: "distance" }),
    number("Sixty in two steps: eight times what?", 7.5, "8 × 7.5 = 60.", { unit: "times" }),
    truth("Any two steps that multiply to sixty fit the same distances.", false, "Each mesh stands half its teeth plus half its leaves apart: other counts, other distances."),
  ],
  "2.4": [
    choice("A wheel and pinion replacing a wrong pair must keep the same…", "total of teeth and leaves, to mesh at the same distance", ["ratio of teeth to leaves, to keep the same distance", "size of wheel, so the old pinion can stay where it was"],
      "The arbors don't move, so the new pair must add up to the same count: then any ratio inside that total will mesh.", { see: 2 }),
    number("A 64 and an 8 make 72. A 12-leaf pinion keeps that total with a wheel of how many teeth?", 60, "72 − 12 = 60: a 60 and a 12, also 3.6 mm apart.", { unit: "teeth", see: 2 }),
  ],
  // ---------- 3. The escapement ----------
  "3.1": [
    choice("A wound mainspring with no escapement…", "spins the train in a blur and is spent in seconds", ["holds the train still until a pallet fork is fitted", "runs the train at the right rate, but only for an hour"], "Nothing holds it back: the spring lets go at once.", { see: 1 }),
    choice("A pallet fork with no balance…", "locks the escape wheel after one tick", ["lets the escape wheel turn at half its speed", "lets the spring run down twice as slowly"], "One tooth lands on a stone and the train locks: there's no balance to swing the fork across.", { see: 3 }),
    word("What are the escape wheel, pallet fork and balance called together?", "escapement", "The escapement: it lets the power out a little at a time.", { see: 2 }),
  ],
  "3.2": [
    choice("What keeps the balance swinging at a steady rate?", "Its hairspring, whatever the mainspring's force", ["The mainspring's force, which stays the same", "The pallet fork, which swings at its own rate"], "The hairspring sets the rate; the mainspring only keeps it swinging.", { see: 1 }),
    choice("How do the escape wheel, the fork and the balance stand?", "In one straight line", ["At a right angle, the fork at its corner", "In a triangle, each meshing the other two"], "In line: the Swiss lever escapement. Out of line, the impulse pin misses the fork's horns.", { see: 3 }),
    word("The jewel on the balance's roller that knocks the fork across is the impulse…", "pin", "The impulse pin: each swing it knocks the fork across, releasing a tooth.", { accept: ["impulse pin", "jewel"], see: 2 }),
  ],
  "3.3": [
    number("18,000 vph is how many beats a second?", 5, "18,000 ÷ 3,600 = 5.", { unit: "beats", see: 1, topic: "beat" }),
    number("How many beats does each escape-wheel tooth give?", 2, "One on each pallet: two beats a tooth.", { unit: "beats", see: 2, topic: "beat" }),
    number("A 15-tooth escape wheel at 18,000 vph turns how many times an hour?", 600, "18,000 ÷ (2 × 15) = 600.", { unit: "turns", see: 2, topic: "beat" }),
  ],
  "3.4": [
    number("28,800 vph is how many beats a second?", 8, "28,800 ÷ 3,600 = 8.", { unit: "beats", see: 1, topic: "beat" }),
    number("A 20-tooth escape wheel at 28,800 vph turns how many times an hour?", 720, "28,800 ÷ (2 × 20) = 720.", { unit: "turns", topic: "beat" }),
    choice("Why do modern watches beat faster?", "A faster balance keeps better time when the watch is knocked", ["A faster balance makes the mainspring last a good deal longer", "A faster balance lets the train get by with fewer wheels"], "A quicker balance is disturbed less by a knock: 28,800 vph keeps better time on the wrist."),
  ],
  "3.5": [
    choice("Fit a balance that beats faster than the train was built for, and the watch…", "runs fast", ["runs slow", "stops after one tick"], "The balance sets the pace for every wheel: a faster beat, a faster watch.", { see: 1 }),
    number("A 15-tooth escape wheel must turn 720 times an hour. What beat does that need, in vph?", 21600, "720 × 2 × 15 = 21,600 vph.", { unit: "vph", see: 2, topic: "beat" }),
  ],
  "3.6": [
    number("A 28,800 vph balance, and a train turning the escape wheel 720 times an hour. How many teeth?", 20, "28,800 ÷ (2 × 720) = 20.", { unit: "teeth", see: 2, topic: "beat" }),
    truth("With the train and the balance fixed, any escape wheel keeps time.", false, "Each tooth gives two beats: only one count matches the balance's beat to the train's turns."),
  ],
  // ---------- 4. The motion works ----------
  "4.1": [
    choice("Which wheel carries the hour hand?", "The hour wheel", ["The minute wheel", "The cannon pinion"], "The hour wheel, a tube round the cannon pinion, turns once in twelve hours.", { see: 2 }),
    number("The cannon pinion turns once an hour, the hour wheel once in twelve. How many times slower is the hour wheel?", 12, "Twelve hours a turn against one: twelve times slower.", { unit: "times" }),
    word("The little train under the dial is the … works.", "motion", "The motion works: cannon pinion, minute wheel and pinion, hour wheel.", { accept: ["motion works"], see: 1 }),
  ],
  "4.2": [
    number("A 10-leaf cannon pinion meshes a 30-tooth minute wheel. What must the minute pinion and the hour wheel add up to?", 40, "Both meshes share one distance: 10 + 30 = 40, so the other pair must make 40 too (8 and 32).", { unit: "teeth and leaves", see: 2 }),
    number("Twelve in two steps: the first is ÷3. What must the second be?", 4, "3 × 4 = 12.", { unit: "times" }),
    choice("Why must both pairs of the motion works add up to one count?", "The minute wheel meets both at one distance from the centre", ["The hour wheel and the cannon pinion are cut to one module", "The motion works must turn the hour hand clockwise"],
      "The cannon pinion and the hour wheel share the centre: the minute arbor's distance from it is fixed by both meshes.", { see: 2 }),
  ],
  "4.4": [
    number("The hour wheel has 32 teeth and turns once in twelve hours. How many teeth turn once a day, driven from it?", 64, "Half as fast: twice the teeth, 64.", { unit: "teeth", see: 1 }),
    choice("Why does the 24-hour wheel need an idler?", "Meshed straight from the hour wheel it would turn backwards", ["Meshed straight from the hour wheel it would turn too fast", "Meshed straight from the hour wheel it would lock solid"], "One mesh reverses: the idler turns it back to clockwise.", { see: 2 }),
    word("A second hour hand showing another time zone makes a … watch.", "GMT", "A GMT: a 24-hour hand for another time zone, or day and night at home.", { accept: ["dual time", "world time", "travel"] }),
  ],
  "4.3": [
    choice("Which part sets the pace of all three hands?", "The balance", ["The mainspring", "The centre wheel"], "The balance's beat paces the escape wheel, and the train and the motion works follow it.", { see: 2 }),
    choice("Where do the motion works sit?", "Under the dial, on the dial side", ["Above the train, under the bridges", "Inside the barrel, round its arbor"], "Under the dial, on the other side of the main plate from the train.", { see: 1 }),
  ],
  // ---------- 5. Power ----------
  "5.1": [
    number("A mainspring gives 5 turns, and the barrel turns once every 10 hours. How many hours does the watch run?", 50, "5 × 10 = 50 hours.", { unit: "hours", see: 1, topic: "reserve" }),
    choice("A higher ratio from barrel to centre wheel gives…", "more hours, but less force at the balance", ["more hours, and more force at the balance", "fewer hours, but more force at the balance"], "The same five turns last longer, and the force reaching the balance falls in proportion.", { see: 2 }),
    number("An 82-tooth barrel drives an 8-leaf centre pinion. What is the ratio?", 10.25, "82 ÷ 8 = 10.25.", { unit: "times" }),
  ],
  "5.2": [
    number("A week is how many hours?", 168, "7 × 24 = 168.", { unit: "hours" }),
    choice("With an intermediate wheel between barrel and centre, the centre wheel turns…", "the same way as the barrel", ["the other way from the barrel", "not at all until it's wound"], "Two meshes instead of one: the direction comes back round.", { see: 2 }),
    number("A barrel-to-centre ratio of 45, and 5 turns of the spring: how many hours?", 225, "5 × 45 = 225 hours: over nine days.", { unit: "hours", topic: "reserve" }),
  ],
  "5.3": [
    choice("What is the balance's amplitude?", "How far it swings each way, in degrees", ["How many times it swings in a second", "How hard the mainspring pushes on it"], "Amplitude: the swing each way, in degrees.", { see: 2 }),
    choice("A healthy watch's balance swings…", "270 to 300 degrees", ["90 to 120 degrees", "450 to 500 degrees"], "270 to 300 degrees each way; below about 230 it loses accuracy.", { see: 2 }),
    number("Below how many degrees of amplitude does a watch start to lose accuracy?", 230, "Below about 230 degrees it keeps worse time; below 150 it may stop.", { unit: "degrees" }),
  ],
  "5.4": [
    choice("What does a fusée do?", "Pulls on a wider radius as the spring weakens", ["Rewinds a small spring every few seconds", "Adds a second mainspring beside the first"], "The chain winds onto a cone: as the spring weakens it pulls on a wider radius, evening out the force.", { see: 2 }),
    choice("What does a remontoire do?", "Rewinds a small spring that alone drives the escapement", ["Pulls the barrel's chain onto a wider radius as it runs", "Doubles the mainspring's force for its last hours"], "A small spring, rewound by the train every few seconds, gives the escapement a constant force.", { see: 2 }),
    truth("A stronger mainspring cures a falling amplitude.", false, "Fully wound, it swings the balance so far that the impulse pin knocks the fork's horns from outside.", { see: 3 }),
  ],
  // ---------- 6. Winding and setting ----------
  "6.1": [
    choice("What stops the mainspring unwinding through the crown?", "The click on the ratchet wheel", ["The pallet fork on the escape wheel", "The jumper on the date ring"], "The click, a sprung pawl, lets the ratchet turn the winding way only.", { see: 2 }),
    word("The wheel on the barrel arbor that the crown turns is the … wheel.", "ratchet", "The ratchet wheel: turning it coils the spring.", { accept: ["ratchet wheel"], see: 1 }),
    choice("The winding pinion turns clockwise. Two meshes on, the ratchet turns…", "clockwise", ["anticlockwise", "not at all"], "Two reversals bring it back the same way round."),
  ],
  "6.2": [
    choice("Why can the hands be turned without forcing the train backwards?", "The cannon pinion grips the centre arbor only by friction", ["The minute wheel slips on a one-way clutch when turned", "The hour wheel lifts out of mesh while the crown is out"], "The cannon pinion slips on the centre arbor, so the motion works turn and the train stays put.", { see: 2 }),
    number("From the sliding pinion through two setting wheels and the minute wheel to the cannon pinion: how many meshes?", 4, "Sliding pinion to first setting wheel, first setting wheel to second, second to the minute wheel, minute wheel to cannon pinion: four.", { unit: "meshes", topic: "count" }),
  ],
  // ---------- 7. Calendars and the moon ----------
  "7.1": [
    number("A finger turning once a day pushes a 31-tooth date ring a tooth a turn. How many days for one turn of the ring?", 31, "A tooth a day: 31 days.", { unit: "days", see: 2, topic: "finger" }),
    choice("After the 30th of a 30-day month, a simple date shows…", "31, and the wearer corrects it", ["1, as the finger knows the month", "30 again, and holds it a day"], "A simple date doesn't know the month's length: it goes on to 31.", { see: 3 }),
    word("The part on the 24-hour wheel that pushes the date ring on is the…", "finger", "The finger: a tooth a turn, once a day.", { accept: ["date finger"], see: 1 }),
  ],
  "7.2": [
    number("A 59-tooth moon disc pushed one tooth a day turns once in how many days?", 59, "A tooth a day: 59 days, two lunar months.", { unit: "days", see: 1, topic: "finger" }),
    choice("Why two moons on one disc?", "Each turn of the disc passes two lunar months", ["One moon shows the day, the other the night", "Two moons balance the disc as it turns"], "Two lunations of 29½ days make 59: one moon after the other passes the window.", { see: 1 }),
    number("Two lunar months of 29.53 days come to how many days?", 59.06, "2 × 29.53 = 59.06.", { unit: "days", tol: 0.006 }),
  ],
  "7.3": [
    number("A 16-leaf pinion turning once a week drives a 135-tooth disc. How many days for one turn of the disc? (two decimals)", 59.06, "135 ÷ 16 × 7 = 59.0625 days, against 59.0612 for two lunations.", { unit: "days", tol: 0.006, see: 2 }),
    choice("Why is the moon train cut to a finer module?", "To fit enough teeth for a fine ratio in the space", ["To make the moon turn faster than the date ring", "To let the moon disc mesh with any ordinary wheel"], "Fine teeth give big counts in a small space: 135 teeth fit where 67 would.", { see: 3 }),
    truth("A finger-driven moon can follow the moon's 29.53 days exactly.", false, "A finger counts only whole days: 29½ at best. A fine train turns the disc continuously.", { see: 1 }),
  ],
  // ---------- 8. Famous calibres ----------
  "8.1": [
    choice("Where are the Unitas 6497's small seconds?", "At nine o'clock", ["At six o'clock", "At three o'clock"], "At nine; its twin, the 6498, puts them at six.", { see: 1 }),
    number("The 6497 beats 18,000 vph: how many beats a second?", 5, "18,000 ÷ 3,600 = 5.", { unit: "beats", topic: "beat" }),
    choice("Why do so many watchmakers learn on the 6497?", "Its big, open layout is easy to see and to work on", ["It has the fewest parts of any mechanical calibre", "It was the first calibre with a Swiss lever escapement"], "Its large, open layout: everything is easy to see and reach.", { see: 2 }),
  ],
  "8.2": [
    number("In which year did the Reverso appear?", 1931, "1931: Jaeger-LeCoultre's case that flips to protect its glass.", { unit: "" }),
    choice("Why does the Reverso need a rectangular movement?", "Its case is rectangular, flipping to protect the glass", ["Its seconds need a dial of their own at six", "Its barrel is too large for a round movement"], "A rectangular case that flips over needs a rectangular movement to fill it.", { see: 1 }),
    number("21,600 vph and a 15-tooth escape wheel: how many turns an hour?", 720, "21,600 ÷ (2 × 15) = 720.", { unit: "turns", see: 3, topic: "beat" }),
  ],
  "8.3": [
    number("36,000 vph is how many beats a second?", 10, "36,000 ÷ 3,600 = 10: fine enough to time tenths of a second.", { unit: "beats", see: 1, topic: "beat" }),
    number("36,000 vph, and the train turns the escape wheel 600 times an hour. How many teeth?", 30, "36,000 ÷ (2 × 600) = 30.", { unit: "teeth", see: 2, topic: "beat" }),
    number("In which year did the El Primero appear?", 1969, "1969: among the first automatic chronographs.", { unit: "" }),
  ],
  "8.4": [
    choice("What couples the Valjoux 7750's chronograph?", "An oscillating pinion on a rocker", ["A coupling wheel on a swinging lever", "A vertical clutch between two discs"], "A long pinion on a rocker tilts into the chronograph wheel to start, out to stop.", { see: 2 }),
    choice("What switches the 7750, in place of a column wheel?", "Cams and levers", ["A jumper and a star", "A friction spring"], "Cams and levers: cheaper to make than a column wheel, and robust.", { see: 1 }),
    number("In which year was the 7750 designed?", 1974, "1974, by Edmond Capt.", { unit: "" }),
  ],
  "8.5": [
    number("H4 lost about how many seconds in 81 days at sea?", 5, "About five seconds on the trial voyage to Jamaica in 1761 and 1762.", { unit: "seconds", see: 1 }),
    choice("What did H4's remontoire give its escapement?", "The same force whatever the mainspring was doing", ["Twice the force for the last hours of the run", "A faster beat whenever the ship was rolling"], "Rewound every seven and a half seconds, it gave the escapement an even force from full wind to empty.", { see: 2 }),
    choice("Why did a ship need a watch like H4?", "To find longitude, keeping the time at home", ["To find latitude, timing the sun at noon", "To time the ship's speed through the water"], "The difference between local time and home time gives the longitude.", { see: 1 }),
  ],
  // ---------- 9. The chronograph ----------
  "9.1": [
    choice("Which wheel drives the chronograph?", "The fourth wheel, once a minute", ["The centre wheel, once an hour", "The escape wheel, ten times a minute"], "The fourth wheel already turns once a minute: the chronograph takes its drive from it.", { see: 2 }),
    number("The driving wheel has 60 teeth and turns once a minute. How many teeth for a chronograph wheel that turns once a minute too?", 60, "The coupling wheel between them changes the direction back, not the ratio: 60 to 60.", { unit: "teeth", see: 2 }),
    choice("Why mustn't the driving and chronograph wheels touch?", "With the coupling wheel, the three would lock in a loop", ["The chronograph wheel would then turn anticlockwise", "The driving wheel would then stop the fourth wheel"], "Three wheels all meshing make a loop, and a loop of three locks."),
  ],
  "9.2": [
    choice("What does the coupling lever swing about?", "The driving wheel's arbor", ["The chronograph wheel's arbor", "The column wheel's arbor"], "About the driving wheel's arbor: the coupling wheel never leaves the driving wheel.", { see: 1 }),
    truth("Stopping the chronograph stops the watch.", false, "The coupling only leaves the chronograph wheel: the watch runs on.", { see: 2 }),
    choice("What turns a step with each press of the pusher?", "The column wheel", ["The coupling wheel", "The heart cam"], "The column wheel lets the lever fall in or lifts it out, a step a press.", { see: 2 }),
  ],
  "9.3": [
    number("A 30-tooth star pushed a tooth a minute turns once in how many minutes?", 30, "A tooth a minute: thirty minutes.", { unit: "minutes", see: 1, topic: "finger" }),
    choice("What holds the counter's star between pushes?", "A spring jumper", ["A one-way clutch", "A heart cam"], "A jumper holds the star, so the hand jumps from minute to minute.", { see: 2 }),
    choice("The finger that pushes the minute counter is on…", "the chronograph wheel", ["the fourth wheel", "the hour wheel"], "On the chronograph wheel: a push for every minute timed.", { see: 1 }),
  ],
  "9.4": [
    choice("Why is the reset cam shaped like a heart?", "Pressed anywhere, it turns until the hammer lies in its notch", ["Its point lets the hammer push the hand on to sixty", "Its two lobes balance the hand as it flies back"], "Its curve rises evenly from the notch: the hammer always finds the way down to zero.", { see: 2 }),
    word("The cam a reset hammer drops onto is the … cam.", "heart", "The heart cam.", { accept: ["heart cam", "heart-shaped"], see: 1 }),
  ],
  "9.5": [
    choice("What does a flyback do in one press?", "Resets the hands and sets them off again at once", ["Stops the hands and holds them until pressed again", "Adds the time so far to the minute counter"], "Pressed while running, the hands fly back to zero and set off again.", { see: 1 }),
    choice("How does a flyback lever differ from an ordinary coupling lever?", "It keeps the coupling in while the hearts are struck", ["It lifts the coupling out before the hearts are struck", "It strikes the hearts twice so the hands land on zero"], "The drive goes on while the hammers fall.", { see: 2 }),
    number("In which year did Lange's Datograph appear?", 1999, "1999: a column-wheel flyback.", { unit: "", see: 3 }),
  ],
  "9.6": [
    choice("A minute counter geared straight to the chronograph wheel…", "creeps between the minutes", ["jumps a minute at a time", "stands still until reset"], "Gears turn it continuously: its hand drifts between the minutes.", { see: 1 }),
    choice("What makes the Datograph's counter jump?", "A finger stepping it as the seconds pass twelve", ["A pair of gears turning it a minute at a time", "A heart cam throwing it on every minute"], "A finger lets it stand all minute, then jumps it in an instant.", { see: 2 }),
    truth("A finger and a pair of gears can both give the counter the right average rate.", true, "Both average half a turn an hour; only the finger makes it jump.", { see: 3 }),
  ],
  // ---------- 10. Automatic winding ----------
  "10.1": [
    choice("What is a reverser?", "A wheel and a pinion joined by a one-way clutch", ["A wheel that turns the train backwards at night", "A pinion that changes the rotor's direction"], "Turned one way its clutch drives; the other way it slips.", { see: 2 }),
    choice("With one reverser, the rotor winds…", "in one direction only", ["in both directions, at half speed", "in neither direction until wound"], "The clutch drives one way and slips the other.", { see: 3 }),
    word("The half-moon weight that winds an automatic watch is the…", "rotor", "The rotor swings round the movement with every move of the wrist.", { accept: ["oscillating weight", "winding rotor"], see: 1 }),
  ],
  "10.2": [
    choice("How does a second reverser let both swings wind?", "It turns the other way, so one clutch or the other drives", ["It doubles the force of each swing reaching the barrel", "It lets the rotor spin freely in both directions"], "Meshed with the first, it turns the other way: whichever way the rotor swings, one of them drives.", { see: 1 }),
    truth("If the second reverser also touches the rotor's pinion, the train locks.", true, "It would make a loop of three meshes, and a loop of three locks."),
    choice("Which great automatic calibre uses reverser wheels?", "The ETA 2824", ["The Unitas 6497", "Harrison's H4"], "The ETA 2824 among others; the 6497 is hand-wound and H4 a marine timekeeper.", { see: 2 }),
  ],
  // ---------- 11. Regulating ----------
  "11.1": [
    choice("Moving the index towards +…", "shortens the hairspring's working length, and the watch gains", ["lengthens the hairspring's working length, and the watch gains", "shortens the hairspring's working length, and the watch loses"], "A shorter spring is stiffer: the balance swings faster and the watch gains.", { see: 2 }),
    choice("A stiffer hairspring makes the balance swing…", "faster", ["slower", "wider"], "Stiffer or lighter, faster; weaker or heavier, slower.", { see: 1 }),
    number("This watch had to keep time to within how many seconds a day?", 5, "Within five seconds a day; a good watch keeps within a few.", { unit: "seconds", see: 3 }),
  ],
  "11.2": [
    number("Four per cent more inertia makes the balance how many per cent slower?", 2, "The beat goes as one over the square root of the inertia: √1.04 ≈ 1.02, two per cent.", { unit: "%", tol: 0.1, see: 2 }),
    choice("How is a free-sprung balance regulated?", "By weights on its rim, its hairspring's length fixed", ["By an index moving curb pins along its hairspring", "By a stronger mainspring fitted to its barrel"], "No index: weights on the rim change its inertia.", { see: 1 }),
    choice("A heavier balance, with more inertia, beats…", "slower", ["faster", "just the same"], "More inertia, a slower swing."),
  ],
  // ---------- 12. Pushers and jumpers ----------
  "12.1": [
    number("How many points does the travel hour hand's star have?", 12, "Twelve: one an hour.", { unit: "points", see: 2 }),
    choice("What holds the star to the hour wheel between presses?", "A jumper", ["A click", "A heart cam"], "A jumper, a spring with a tooth: the star turns with the hour wheel until a press drives it round a point.", { see: 2 }),
    choice("A press of the pusher moves…", "only the travel hour hand, an hour on", ["both hour hands, an hour on", "the minute hand back to twelve"], "Only the travel hand: the watch and the home time run on.", { see: 3 }),
  ],
  "12.2": [
    number("A column wheel of 7 columns needs how many ratchet teeth for start and stop to alternate?", 14, "Twice the columns: each press moves half a column.", { unit: "teeth", see: 2 }),
    choice("A lever dropped between two columns…", "engages the coupling", ["lifts the coupling", "resets the hands"], "Down between the columns, the coupling engages; up on a column, it lets go.", { see: 1 }),
    choice("Why are column wheels prized?", "They switch crisply and are finished by hand", ["They need no pusher to start the chronograph", "They let the chronograph run without power"], "Crisp switching and hand finishing; cheaper chronographs use a stamped cam."),
  ],
  "12.3": [
    choice("Why does a trip on the hour wheel alone go off near the time, not on it?", "The hour wheel turns so slowly its trip drops in over minutes", ["The hour wheel turns so fast its trip drops in twice an hour", "The hour wheel's trip is set by hand to within five minutes"], "Once in twelve hours: its trip takes minutes to drop into the notch.", { see: 2 }),
    choice("What makes the alarm exact to the minute?", "A trip on the cannon pinion gating the release", ["A trip on the escape wheel timing the release", "A second hour wheel turning twice as fast"], "The minute's trip drops in only in the set minute, and only with the hour trip down.", { see: 2 }),
    number("In which year did Vulcain's Cricket appear?", 1947, "1947; Jaeger-LeCoultre's Memovox followed in 1950.", { unit: "", see: 1 }),
  ],
  // ---------- 13. Calendars that know ----------
  "13.1": [
    choice("Which months have 30 days?", "April, June, September, November", ["April, June, August, November", "February, April, June, September"], "Thirty days hath September, April, June and November.", { see: 2 }),
    number("How many times a year must an annual calendar be corrected?", 1, "Once, on the 1st of March: it doesn't know February.", { unit: "times" }),
    number("In which year did the first wristwatch annual calendar appear?", 1996, "1996, by Patek Philippe.", { unit: "", see: 2 }),
  ],
  "13.2": [
    number("A perpetual calendar's cam turns once in how many years?", 4, "Four: three ordinary years and a leap year.", { unit: "years", see: 1 }),
    number("How many notches does the four-year cam have?", 48, "One a month for four years: 48.", { unit: "notches", see: 1 }),
    choice("February's notch in the leap year is…", "a little shallower than in the other three", ["a little deeper than in the other three", "the same depth as in the other three"], "29 days, not 28: the date goes one further before the jump.", { see: 1 }),
  ],
  "13.3": [
    choice("In mid-February a sundial is…", "about 14 minutes behind the watch", ["about 14 minutes ahead of the watch", "within a minute of the watch"], "About 14 minutes behind; in early November about 16 ahead.", { see: 1 }),
    number("On how many days a year do a sundial and a watch agree?", 4, "Four days a year.", { unit: "days", see: 1 }),
    choice("Why does solar time run long or short?", "The orbit is an ellipse and the axis tilted", ["The moon pulls the Earth back and forth", "The Earth slows down a little every year"], "The elliptical orbit and the tilted axis make the solar day vary.", { see: 1 }),
  ],
  "13.4": [
    choice("Which of these is a leap year?", "2400", ["2100", "2200", "2300"], "Divisible by 400: a leap year. 2100, 2200 and 2300 aren't.", { see: 1 }),
    choice("A year divisible by 100 is a leap year only if…", "it is also divisible by 400", ["it is also divisible by 200", "it is also divisible by 8"], "The Gregorian rule: centuries skip their leap day unless divisible by 400.", { see: 1 }),
    number("How many leap days does the Gregorian calendar drop every 400 years?", 3, "Three: the century years not divisible by 400.", { unit: "days", see: 2 }),
  ],
  // ---------- 14. Striking ----------
  "14.1": [
    choice("What does the rack read on the snail?", "The depth of the step under it, as a count of blows", ["The speed of the snail as it passes twelve", "The number of teeth on the hour wheel"], "The deeper the step, the more teeth the rack falls, the more blows.", { see: 2 }),
    choice("At three o'clock, which step is under the rack?", "The one that started three places anticlockwise of twelve", ["The one that started three places clockwise of twelve", "The one at twelve, which turns with the hand"], "The snail turns clockwise: at three, the step from three places anticlockwise has come round to twelve.", { see: 3 }),
    choice("A minute repeater strikes the hours on…", "the low gong", ["the high gong", "both gongs"], "Hours low, quarters on both as ding-dongs, minutes high.", { see: 1 }),
  ],
  "14.2": [
    number("How many steps has the quarter snail?", 4, "Four: none, one, two or three quarters.", { unit: "steps", see: 2 }),
    choice("How are the quarters struck?", "As ding-dongs on both gongs", ["As single blows on the low gong", "As single blows on the high gong"], "Ding-dong, on both gongs.", { see: 1 }),
    number("At 3:47 a repeater strikes 3 hours and 3 quarters. How many minutes after them?", 2, "47 = 3 × 15 + 2: two blows on the high gong.", { unit: "blows" }),
  ],
  // ---------- 15. The tourbillon ----------
  "15.1": [
    choice("Why turn the escapement in a cage?", "So gravity's errors in each position average out", ["So the balance can beat twice as fast", "So the mainspring runs twice as long"], "The errors of each position cancel as the cage turns.", { see: 1 }),
    number("How many seconds does the cage take for a turn?", 60, "Once a minute: it takes the fourth wheel's place.", { unit: "seconds", see: 2 }),
    number("A 75-tooth fixed wheel and a 10-leaf escape pinion: how many turns does the escape wheel make, relative to the cage, each turn of the cage?", 7.5, "The pinion rolls round the fixed wheel: 75 ÷ 10 = 7.5.", { unit: "turns", see: 3 }),
    number("In which year did Breguet patent the tourbillon?", 1801, "1801.", { unit: "" }),
  ],
};

// ---------- a test ----------
/** A question made ready to ask: a choice's options dealt (the right one's place noted), an order's items shuffled. */
function deal(q, rnd, L) {
  const out = { ...q };
  if (q.see) { const sc = lessonFor(L)[q.see - 1]?.scene; if (sc) out.scene = { ...sc, labels: undefined, show: undefined, motion: "still" }; }
  if (q.kind === "choice") { out.options = q.order || shuffle([q.right, ...q.wrongs], rnd); out.answer = out.options.indexOf(q.right); }
  if (q.kind === "order") { let o; do o = shuffle(q.items, rnd); while (o.every((x, i) => x === q.items[i])); out.options = o; }
  return out;
}
/**
 * A level's test on a design that runs (yours, or its worked solution): what you made first (a part to tap and one to
 * name, then the arithmetic of your own train, which way it turns, its order, a layer), then the level's own questions,
 * then its words. About ten in all; dealt afresh each time from rnd.
 */
export function buildTest(L, design, rnd = Math.random) {
  const S = study(L, design), qs = [], own = QUIZ[L.id] || [], covered = new Set(own.map(q => q.topic).filter(Boolean));
  // about ten in all: the level's own questions, a word or two, and the rest on what you made
  const words = own.length >= 4 ? 1 : 2, room = Math.max(4, 10 - own.length - words);
  const add = q => { if (q && qs.length < room && !(q.topic !== "tap" && q.topic !== "name" && covered.has(q.topic))) qs.push(q); };
  // what you made: a part to find, a part to name
  add(rnd() < 0.5 ? tapByRateQuestion(S) || tapQuestion(S, rnd) : tapQuestion(S, rnd) || tapByRateQuestion(S));
  add(nameQuestion(S, rnd, rnd() < 0.4));
  // the arithmetic: the steps you made first (a mesh you put in), then the paths to the goals
  const steps = S.paths.flatMap(p => p.steps).filter((st, i, all) => st.driver && all.findIndex(x => x.from === st.from && x.to === st.to) === i);
  // a mesh you made: one of its two gears is a part you put in
  const yours = (id, layer) => (S.arbor(id)?.parts || []).some(p => p.layer === layer && !p.fixed);
  const mine = steps.filter(st => yours(st.from, st.layer) || yours(st.to, st.layer)), from = shuffle(mine.length ? mine : steps, rnd);
  if (from[0]) add(ratioQuestion(S, from[0]));
  // then turns between reading the movement (its order, which way it turns, a layer in 3D) and its arithmetic
  const longest = S.paths.reduce((m, p) => (p.steps.length > (m?.steps.length || 0) ? p : m), null);
  const layered = mine.filter(st => st.layer != null && st.layer < 9), layers = new Set(S.design.arbors.flatMap(a => (a.parts || []).map(p => p.layer)).filter(l => l < 9));
  const reading = shuffle([
    longest ? orderQuestion(S, longest.steps) : null, longest ? directionQuestion(S, longest.steps) : null,
    // a layer read off the 3D view, once the course has brought in layers (1.3)
    LEVELS.indexOf(L) >= LEVELS.findIndex(l => l.id === "1.3") && layered.length && layers.size >= 2 ? layerQuestion(S, pick(layered, rnd), rnd) : null,
  ].filter(Boolean), rnd);
  const maths = [...shuffle([
    from[1] || from[0] ? distanceQuestion(S, from[1] || from[0]) : null,
    longest && longest.steps.length >= 2 ? (rnd() < 0.5 ? totalQuestion(S, longest.steps) : rateQuestion(S, longest.steps) || totalQuestion(S, longest.steps)) : longest ? rateQuestion(S, longest.steps) : null,
    ...beatQuestions(S), LEVELS.indexOf(L) >= LEVELS.findIndex(l => l.id === "5.1") ? reserveQuestion(S) : null, fingerQuestion(S),
    L.chapter <= 2 && from[0] ? sizeQuestion(S, from[0]) : null,
  ].filter(q => q && !covered.has(q.topic)), rnd), longest ? meshCountQuestion(S, longest.steps) : null].filter(Boolean);
  for (let i = 0; i < 4; i++) { add(reading[i]); add(maths[2 * i]); add(maths[2 * i + 1]); }
  // the level's own questions, then its words (a different way of asking each)
  qs.push(...own);
  const hows = shuffle(["typed", "term", "meaning"], rnd);
  shuffle(wordsOf(L), rnd).slice(0, words).forEach((t, i) => qs.push(wordQuestion(t, hows[i], rnd)));
  return qs.map(q => deal(q, rnd, L));
}
