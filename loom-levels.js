// Loom's ladder of cloths, pure (tests/loom-float.mjs runs it in Node): the chapters, the levels in them, and the making
// of a level's puzzle from its recipe and a seed. Every cloth is woven, so every one is a cloth a loom could make: the plain
// ones from random floats (mirrored where the pattern is meant to be symmetrical), the weaves from the draft a weaver
// writes down (threading, tie-up, treadling), the plaids from yarns coloured in a sett, and gold thread laid over the
// ground. A puzzle's cloth is made from the seed, tried again until the clues have one answer (pre-weaving a crossing or
// two where they have two) and the logic needed is what the level asks for; the same seed is always the same cloth.
import { makePuzzle, makeUnique, grade, WARP, WEFT, GOLD } from "./loom-float.js";

/** The yarns (loom-engine.js has the same six: ecru, ochre, moss, madder, indigo, charcoal) and the gold laid over them. */
export const GOLD_YARN = 6;
/** A light yarn and a dark one, so a pattern reads by lightness as well as colour (warp first). */
const PAIRS = [[0, 4], [0, 3], [0, 2], [0, 5], [1, 4], [1, 5], [1, 2]];
/** The same without ochre, which would look like the gold laid over it. */
const PLAIN_PAIRS = PAIRS.filter(([a, b]) => a !== 1 && b !== 1);

export const CHAPTERS = [
  { id: "plain", name: "Plain cloth", blurb: "Two yarns and nothing else. A pick's clue is how long its weft floats on the face; a thread's, how long it floats." },
  { id: "weaves", name: "Weaves", blurb: "The cloths a weaver names, woven on a draft: threads on one shaft rise together, so the same marks come round and round." },
  { id: "colour", name: "Colour and weave", blurb: "Yarns of several colours. Where warp and weft are one colour the crossing is settled, and a float runs on across it." },
  { id: "gold", name: "Gold thread", blurb: "A third yarn laid over the ground. Where gold lies it hides both, and a clue lists its floats among the line's own." },
];

const mod = (a, n) => ((a % n) + n) % n;
const seq = (n, order, o = 0) => Array.from({ length: n }, (_, i) => order[mod(i + o, order.length)]);
const point = S => { const a = []; for (let i = 0; i < S; i++) a.push(i); for (let i = S - 2; i > 0; i--) a.push(i); return a; };
const shifted = (S, row) => Array.from({ length: S }, (_, r) => Array.from({ length: S }, (_, c) => row[mod(c + r, row.length)]));
const W = WARP, F = WEFT;

/** The weaves a weaver names: the tie-up (what each treadle does to each shaft), the threading and the treadling, in turn. */
export const WEAVES = {
  plain: { S: 2, tie: [[W, F], [F, W]], thread: [0, 1], tread: [0, 1] },
  hopsack: { S: 2, tie: [[W, F], [F, W]], thread: [0, 0, 1, 1], tread: [0, 0, 1, 1] },
  twill22: { S: 4, tie: shifted(4, [W, W, F, F]), thread: [0, 1, 2, 3], tread: [0, 1, 2, 3] },
  twill31: { S: 4, tie: shifted(4, [W, W, W, F]), thread: [0, 1, 2, 3], tread: [0, 1, 2, 3] },
  herringbone: { S: 4, tie: shifted(4, [W, W, F, F]), thread: point(4), tread: [0, 1, 2, 3] },
  diamond: { S: 4, tie: shifted(4, [W, W, F, F]), thread: point(4), tread: point(4) },
  satin: { S: 5, tie: [[W, F, F, F, F], [F, F, W, F, F], [F, F, F, F, W], [F, W, F, F, F], [F, F, F, W, F]], thread: [0, 1, 2, 3, 4], tread: [0, 1, 2, 3, 4] },
  rosepath: { S: 4, tie: shifted(4, [W, W, F, F]), thread: [0, 1, 2, 3, 2, 1], tread: [0, 1, 2, 3, 2, 1] },
};

// What a level is: { id, chapter, name, story, w, h, kind, ...kind's own, grade: [easiest, hardest], givens }.
//   kind "random"  floats at random: `d` the share where the warp shows, `mirror` left to right
//   kind "weave"   a named weave (WEAVES[weave]) on the shafts it names
//   kind "colour"  a structure (`weave`, or random) in yarns coloured by `warp` and `weft`, strings of yarn indices as a sett
//   kind "gold"    random floats with gold laid in picks, `gold` the share of crossings under gold
const L = (chapter, n, name, story, o) => ({ id: `${chapter}-${n}`, chapter, name, story, grade: [1, 3], givens: 2, ...o });
export const LEVELS = [
  L("plain", 1, "Tabby", "Tabby is plain weave's old name: over one, under one. Here it's only a scrap, to see what a float is.", { w: 5, h: 5, kind: "random", d: .5, grade: [1, 1] }),
  L("plain", 2, "Selvedge", "The selvedge is the self-edge, where the weft turns back and the cloth can't fray. Cloth is often the same on both sides of its middle.", { w: 6, h: 6, kind: "random", d: .5, mirror: true, grade: [1, 1] }),
  L("plain", 3, "Hem", "A hem is cloth folded on itself so that its edge holds.", { w: 7, h: 7, kind: "random", d: .5, grade: [1, 2] }),
  L("plain", 4, "Stripe", "Floats lined up one above another show as a stripe, and a long float is a thread that skips a great many crossings.", { w: 8, h: 8, kind: "random", d: .42, grade: [1, 2] }),
  L("plain", 5, "Check", "A check is stripes crossing stripes. A mirrored cloth has its clues mirrored too, which tells you something.", { w: 10, h: 10, kind: "random", d: .5, mirror: true, grade: [1, 3] }),
  L("plain", 6, "Sampler", "A sampler is a weaver's trial piece. This one has no pattern to lean on.", { w: 12, h: 12, kind: "random", d: .5, grade: [2, 3] }),

  L("weaves", 1, "Plain weave", "Over one, under one: the cloth of a shirt. Two shafts, one lifted and then the other.", { w: 8, h: 8, kind: "weave", weave: "plain", grade: [1, 3] }),
  L("weaves", 2, "Hopsack", "Plain weave worked in pairs: threads and picks go two together, so each check is a little square.", { w: 10, h: 10, kind: "weave", weave: "hopsack", grade: [1, 3] }),
  L("weaves", 3, "Twill", "Each pick lifts the shafts one step along from the last, and the weave runs on in a diagonal. Four shafts, the cloth of a pair of jeans.", { w: 10, h: 10, kind: "weave", weave: "twill22", grade: [1, 3] }),
  L("weaves", 4, "Three and one", "A twill that floats over three and under one: the diagonal is steeper, the face smoother. Gabardine is woven so.", { w: 12, h: 10, kind: "weave", weave: "twill31", grade: [1, 3] }),
  L("weaves", 5, "Herringbone", "A twill whose threading turns back on itself, so the diagonal turns with it, like the bones of a fish.", { w: 12, h: 10, kind: "weave", weave: "herringbone", grade: [1, 3] }),
  L("weaves", 6, "Satin", "Five shafts, and a pick that shows its colour on only one thread in five, so the cloth is nearly all one yarn and shines.", { w: 10, h: 10, kind: "weave", weave: "satin", grade: [1, 3] }),
  L("weaves", 7, "Diamond twill", "Point the threading and the treadling both, and the diagonals turn both ways at once: diamonds.", { w: 12, h: 12, kind: "weave", weave: "diamond", grade: [1, 3] }),
  L("weaves", 8, "Rosepath", "Handweavers' favourite: a twill threaded and treadled out and back, which makes small roses along a path.", { w: 14, h: 12, kind: "weave", weave: "rosepath", grade: [1, 3] }),

  L("colour", 1, "Gingham", "Plain weave in two colours, a pair of each in warp and weft: where like meets like the crossing is settled, and the checks come of themselves.", { w: 8, h: 8, kind: "colour", weave: "plain", warp: "0011", weft: "0011", yarns: [0, 3], grade: [1, 3] }),
  L("colour", 2, "Pinstripe", "One thread in six in a dark yarn, and the weft in pairs: a pinstripe shows only where the weft lets it.", { w: 10, h: 8, kind: "colour", warp: "000001", weft: "0011", yarns: [0, 4], grade: [1, 3], d: .5 }),
  L("colour", 3, "Houndstooth", "A twill in blocks of four light and four dark, in warp and weft alike. The two meet in a broken check.", { w: 8, h: 8, kind: "colour", weave: "twill22", warp: "00001111", weft: "00001111", yarns: [0, 5], grade: [1, 3] }),
  L("colour", 4, "Tartan", "A sett is a tartan's pattern of stripes, the same warp and weft. Run through a twill it makes a plaid.", { w: 12, h: 12, kind: "colour", weave: "twill22", warp: "0033322", weft: "0033322", yarns: [0, 4, 2, 3], grade: [1, 3] }),
  L("colour", 5, "Madras", "A light cotton plaid from southern India, its stripes uneven, woven plain.", { w: 12, h: 12, kind: "colour", warp: "0101223", weft: "3032110", yarns: [0, 3, 1, 2], d: .5, grade: [1, 3] }),
  L("colour", 6, "Glen check", "The Glen Urquhart check: small and large checks at once, in a twill of two colours and a third.", { w: 16, h: 16, kind: "colour", weave: "twill22", warp: "000011110000111122", weft: "000011110000111122", yarns: [0, 5, 3], grade: [1, 3] }),

  L("gold", 1, "Brocade", "A brocade carries a pattern in an extra yarn, floated over the cloth where it shows and left on its back where it doesn't.", { w: 8, h: 8, kind: "gold", gold: .14, grade: [1, 1] }),
  L("gold", 2, "Inlay", "Inlay is a thread laid into the shed by hand, apart from the shuttle. Gold hides what lies under it.", { w: 8, h: 8, kind: "gold", gold: .2, grade: [1, 2] }),
  L("gold", 3, "Tinsel", "Metal thread was beaten flat and wound on silk, and floated for show: it never makes the cloth.", { w: 10, h: 10, kind: "gold", gold: .16, grade: [1, 2] }),
  L("gold", 4, "Lampas", "Lampas is two weaves in one cloth, a ground and a pattern in a second structure.", { w: 10, h: 10, kind: "gold", gold: .22, grade: [1, 3] }),
  L("gold", 5, "Cloth of gold", "Cloth of gold was woven with so much gold that kings wore it and the law said who else could.", { w: 12, h: 12, kind: "gold", gold: .18, grade: [2, 3] }),
  L("gold", 6, "Field of gold", "The Field of the Cloth of Gold, where two kings met in 1520, had so many tents of it that it gave the field its name.", { w: 14, h: 12, kind: "gold", gold: .2, grade: [2, 3] }),
];
export const levelOf = id => LEVELS.find(l => l.id === id) || null;
export const chapterOf = lv => CHAPTERS.find(c => c.id === lv.chapter);

const rngOf = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const fill = (w, h, f) => Array.from({ length: w * h }, (_, i) => f(Math.floor(i / w), i % w));

/** The cloth a level's recipe weaves from a draw, as makePuzzle takes it (without the pre-woven crossings). */
function cloth(lv, R) {
  const { w, h } = lv;
  const pairs = lv.kind === "gold" ? PLAIN_PAIRS : PAIRS, pair = pairs[Math.floor(R() * pairs.length)], swap = R() < .5, [a, b] = swap ? [pair[1], pair[0]] : pair;
  if (lv.kind === "random") {
    const half = Math.ceil(w / 2), pick = fill(lv.mirror ? half : w, h, () => (R() < lv.d ? W : F));
    const cells = fill(w, h, (r, c) => pick[r * (lv.mirror ? half : w) + (lv.mirror ? Math.min(c, w - 1 - c) : c)]);
    return { w, h, warp: Array(w).fill(a), weft: Array(h).fill(b), cells };
  }
  if (lv.kind === "gold") {
    const cells = fill(w, h, () => (R() < .5 ? W : F));
    for (let r = 0; r < h; r++) {                        // gold floats along a pick, a few crossings each, a pick or two apart
      let c = Math.floor(R() * 3);
      while (c < w) {
        if (R() < lv.gold * 3.2) { const len = 1 + Math.floor(R() * 3.4); for (let k = 0; k < len && c + k < w; k++) cells[r * w + c + k] = GOLD; c += len; }
        c += 1 + Math.floor(R() * 3);
      }
    }
    return { w, h, warp: Array(w).fill(a), weft: Array(h).fill(b), gold: GOLD_YARN, cells };
  }
  // a weave, or a structure at random, in the yarns the level names
  let thread, tread, tie;
  const draft = lv.weave ? WEAVES[lv.weave] : null;
  if (draft) {
    const to = Math.floor(R() * draft.thread.length), ro = Math.floor(R() * draft.tread.length), back = R() < .5;
    thread = seq(w, back ? [...draft.thread].reverse() : draft.thread, to);
    tread = seq(h, draft.tread, ro);
    const cmp = R() < .5;
    tie = draft.tie.map(row => row.map(s => (cmp ? 1 - s : s)));
  }
  let warp, weft;
  if (lv.kind === "colour") {
    const ys = lv.yarns, wo = Math.floor(R() * lv.warp.length), fo = Math.floor(R() * lv.weft.length);
    warp = Array.from({ length: w }, (_, i) => ys[+lv.warp[mod(i + wo, lv.warp.length)]]);
    weft = Array.from({ length: h }, (_, i) => ys[+lv.weft[mod(i + fo, lv.weft.length)]]);
  } else { warp = Array(w).fill(a); weft = Array(h).fill(b); }
  if (draft) return { w, h, warp, weft, tie: { col: thread, row: tread }, cells: fill(w, h, (r, c) => tie[tread[r]][thread[c]]) };
  return { w, h, warp, weft, cells: fill(w, h, () => (R() < (lv.d ?? .5) ? W : F)) };
}

/**
 * A level's puzzle for a seed: { puzzle, grade, given }. The same level and seed always give the same cloth. A cloth whose
 * clues have two answers is pre-woven at a crossing or two (as many as the level allows) until they have one; the first
 * one whose logic is as hard as the level asks is kept (else the nearest found in a hundred tries).
 */
export function makeLevel(lv, seed) {
  const R = rngOf((seed ^ 0x9E3779B1) >>> 0);
  let best = null;
  for (let tries = 0; tries < 160; tries++) {
    const c = cloth(lv, R), p = makePuzzle(c), gave = makeUnique(p, lv.givens, n => Math.floor(R() * n));
    if (gave < 0) continue;
    const g = grade(p), miss = g < lv.grade[0] ? lv.grade[0] - g : g > lv.grade[1] ? g - lv.grade[1] : 0;
    if (!best || miss < best.miss || (miss === best.miss && gave < best.gave)) best = { puzzle: p, grade: g, miss, gave };
    if (!miss && gave <= (lv.givens > 1 ? 1 : 0) + (tries > 60 ? 1 : 0)) break;
  }
  return best && { puzzle: best.puzzle, grade: best.grade, given: best.gave };
}

/** Stars for a cloth: three if no crossing was set wrong and no hint taken, two for three such helps or fewer together, one for finishing. */
export const FEW = 3;
export const starsFor = (slips, hints) => (slips + hints === 0 ? 3 : slips + hints <= FEW ? 2 : 1);
/** The first cloth of a ladder is canonical (the same for everyone); "a fresh one" is another seed. */
export const seedOf = lv => 1000 + LEVELS.indexOf(lv);
