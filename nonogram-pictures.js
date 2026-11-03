// Nonogram's pictures, pure (no page): what the knowledge base can draw, each made into a puzzle with exactly one
// answer that a person can reach by reasoning (nonogram-engine.js proves both). Four kinds:
//  - countries: the outlines Chart draws them with (chart-countries.js, Natural Earth at 1:110m), one colour;
//  - flags, in colour, drawn from nonogram-flags.js (the knowledge base has them only as emoji);
//  - lakes: Chart's lake shapes (chart-geo.js, Natural Earth at 1:50m), one colour.
//  - regions: the cantons, states, provinces and prefectures of twenty countries (nonogram-regions.js, Natural Earth's admin-1
//    boundaries at 1:10m, simplified), one colour; the question names the country.
// Each is named as the knowledge base names it and carries its entity, so a picture you couldn't name goes to the pile
// about it. The same picture and size always make the same puzzle, so today's is the same on every phone and a match
// the same for everyone at the table.
import { COUNTRIES, REGION_OF } from "./chart-countries.js";
import { GEO } from "./chart-geo.js";
import { TOPIC_OF, mixFromSubjects } from "./topics.js";
import { PLACES } from "./nonogram-regions.js";
import { MATHS as FLAG_QUESTIONS } from "./flags-bank.js";
import { FLAGS, COLOURS, COLOUR_NAMES, rasterFlag } from "./nonogram-flags.js";
import { cluesOf, grade, countSolutions, depthOf, overlap } from "./nonogram-engine.js";
import { HEX_SIZES, hexGrid, hexCoverage, hexPuzzleFrom } from "./nonogram-hex.js";

import { landOf } from "./nonogram-land.js";
export { landOf };

/**
 * How much of each cell the land covers, from 0 to 1: a w×h grid over `box` (in projected degrees, y up), each cell
 * sampled at `ss`×`ss` points, inside by the even–odd rule over every ring (so a hole, Lesotho in South Africa, is
 * outside). Scanline by scanline: where each sampling row crosses the rings' edges, then which samples lie between.
 */
export function coverage(rings, box, w, h, ss = 6) {
  const out = new Float64Array(w * h), cw = (box.x1 - box.x0) / w, ch = (box.y1 - box.y0) / h;
  const edges = [];
  for (const r of rings) for (let i = 0; i < r.length - 1; i++) if (r[i][1] !== r[i + 1][1]) edges.push([r[i][0], r[i][1], r[i + 1][0], r[i + 1][1]]);
  const xs = [];
  for (let sy = 0; sy < h * ss; sy++) {
    const y = box.y1 - (sy + 0.5) * (ch / ss), row = Math.floor(sy / ss);
    xs.length = 0;
    for (const [ax, ay, bx, by] of edges) if ((ay > y) !== (by > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    xs.sort((a, b) => a - b);
    let k = 0;
    for (let sx = 0; sx < w * ss; sx++) {
      const x = box.x0 + (sx + 0.5) * (cw / ss);
      while (k < xs.length && xs[k] < x) k++;
      if (k % 2) out[row * w + Math.floor(sx / ss)] += 1 / (ss * ss);
    }
  }
  return out;
}

// ---------- from a picture to a puzzle ----------
/** The cells without their empty rows and columns at the edges (a piece of land in the frame too small to show leaves
 *  them), with the coverage cut to match: { cells, cov, w, h }. */
function trimmed(cells, cov, w, h) {
  const rowEmpty = r => { for (let c = 0; c < w; c++) if (cells[r * w + c]) return false; return true; };
  let top = 0, bottom = h - 1;
  while (top < bottom && rowEmpty(top)) top++;
  while (bottom > top && rowEmpty(bottom)) bottom--;
  const colEmpty = c => { for (let r = top; r <= bottom; r++) if (cells[r * w + c]) return false; return true; };
  let left = 0, right = w - 1;
  while (left < right && colEmpty(left)) left++;
  while (right > left && colEmpty(right)) right--;
  const out = [], cv = [];
  for (let r = top; r <= bottom; r++) for (let c = left; c <= right; c++) { out.push(cells[r * w + c]); cv.push(cov[r * w + c]); }
  return { cells: out, cov: cv, w: right - left + 1, h: bottom - top + 1 };
}
/** The sizes: about this many cells, never longer than `long` on a side nor shorter than `short`. */
export const SIZES = {
  small: { label: "Small", n: 100, long: 14, short: 5 },
  medium: { label: "Medium", n: 225, long: 20, short: 7 },
  large: { label: "Large", n: 400, long: 26, short: 9 },
};
/** The grid for a shape `ar` wide to 1 high at a size: { w, h }, or null when the shape is too long or thin for it. */
export function gridFor(ar, sizeId) {
  const s = SIZES[sizeId];
  let w = Math.round(Math.sqrt(s.n * ar)), h = Math.round(Math.sqrt(s.n / ar));
  if (w > s.long) { w = s.long; h = Math.round(w / ar); }
  if (h > s.long) { h = s.long; w = Math.round(h * ar); }
  return Math.min(w, h) < s.short ? null : { w, h };
}

/**
 * The puzzle a coverage map makes: each cell filled when the shape covers at least half of it, and if those clues
 * allow more than one answer (or one a person could only reach by guessing), the fewest cells changed to put that
 * right, the cells the shape half covers first, so the picture moves as little as it can. Tries the even split, then
 * a little more and a little less of each cell; then changes cells one at a time, each time one where two answers
 * differ (or that reasoning can't settle), up to `flips`. Returns { cells, clues, grade, flips: [cell…], cut } or null.
 */
export function puzzleFrom(cov0, w0, h0, { flips = 10, colours = 1, short = 1 } = {}) {
  const tries = [];
  for (const cut of [0.5, 0.45, 0.55, 0.4, 0.6, 0.35, 0.65]) {
    const t = trimmed(Array.from(cov0, v => (v >= cut ? 1 : 0)), cov0, w0, h0);
    const key = `${t.w}:${t.cells.join("")}`;
    if (Math.min(t.w, t.h) >= short && !tries.some(x => x.key === key)) tries.push({ key, ...t, cut });
  }
  if (!tries.length) return null;
  // one answer first (a search that finds a second in a few dozen steps), then whether reasoning reaches it: grading
  // a picture with two answers is the slow part, as the look-ahead gets far before it sticks
  const judge = (cells, w, h) => {
    const clues = cluesOf(w, h, cells), p = { w, h, colours, clues }, n = countSolutions(p, { maxNodes: 3000 });
    if (n.count !== 1 || n.gaveUp) return { clues, p, two: n.count > 1 ? n.found : null };
    const g = grade(p);
    return { clues, p, g: g.solved ? g : null, st: g.st };
  };
  for (const t of tries) {
    const j = judge(t.cells, t.w, t.h);
    if (j.g) return { cells: t.cells, w: t.w, h: t.h, clues: j.clues, grade: j.g, flips: [], cut: t.cut };
  }
  // the even split, with the fewest changes that leave one answer a person can reach
  const { w, h, cov } = tries[0], cells = tries[0].cells.slice(), changed = [];
  const doubt = i => Math.abs(cov[i] - 0.5);
  for (let n = 0; n <= flips; n++) {
    const j = judge(cells, w, h);
    if (j.g) return { cells, w, h, clues: j.clues, grade: j.g, flips: changed, cut: 0.5 };
    if (n === flips) break;
    // a cell where two answers differ, else one that reasoning leaves open
    const where = j.two ? [...j.two[0].keys()].filter(i => j.two[0][i] !== j.two[1][i]) : j.st ? [...j.st.keys()].filter(i => j.st[i] & (j.st[i] - 1)) : [];
    let pick = -1;
    for (const i of where) if (!changed.includes(i) && (pick < 0 || doubt(i) < doubt(pick))) pick = i;
    if (pick < 0) break;
    cells[pick] = cells[pick] ? 0 : 1;
    changed.push(pick);
  }
  return null;
}

// ---------- what there is to draw ----------
export const TOPICS = { countries: "Countries", flags: "Flags", lakes: "Lakes", regions: "Regions" };
/** The kinds as [id, label] pairs, and the mix the suite's subjects (Settings; topics-on.js) make of them: a kind in when its
 *  subject is on (countries, flags and regions are Geography, lakes Nature). Only "All" follows it; a kind picked in the
 *  menu is dealt whatever Settings says, and nothing on leaves every kind in. */
export const TOPIC_LIST = Object.entries(TOPICS);
export const topicsOf = on => mixFromSubjects(TOPIC_LIST, TOPIC_OF.nonogram, on);
export const REGIONS = [["world", "Worldwide"], ["europe", "Europe"], ["middle-east", "Middle East"], ["asia", "Asia"], ["africa", "Africa"],
  ["north-america", "North America"], ["south-america", "South America"], ["oceania", "Oceania"]];
const REGION_ID = Object.fromEntries(REGIONS.map(([id, label]) => [label, id]));

/** Other names a place goes by, accepted when it's named (typing.js already forgives case, accents, a leading "the"
 *  and a slip of a letter). */
const ALIASES = {
  uk: ["UK", "Britain", "Great Britain"], "united-states": ["USA", "US", "America", "United States of America"], "czech-republic": ["Czechia"],
  "ivory-coast": ["Ivory Coast", "Cote d'Ivoire"], myanmar: ["Burma"], netherlands: ["Holland"], "dr-congo": ["DRC", "DR Congo", "Congo-Kinshasa", "Zaire", "Democratic Republic of Congo"],
  "republic-of-the-congo": ["Congo", "Congo-Brazzaville", "Republic of Congo"], "east-timor": ["Timor-Leste", "Timor"], eswatini: ["Swaziland"],
  "north-macedonia": ["Macedonia"], uae: ["UAE", "Emirates"], "south-korea": ["Korea", "Republic of Korea"], "north-korea": ["DPRK"], "cape-verde": ["Cabo Verde"],
  "vatican-city": ["Vatican", "Holy See"], "bosnia-and-herzegovina": ["Bosnia"], "central-african-republic": ["CAR"], "sao-tome-and-principe": ["Sao Tome"],
  "trinidad-and-tobago": ["Trinidad"], "antigua-and-barbuda": ["Antigua"], "saint-kitts-and-nevis": ["St Kitts", "St Kitts and Nevis", "Saint Kitts"],
  "saint-lucia": ["St Lucia"], "saint-vincent-and-the-grenadines": ["St Vincent", "Saint Vincent"], "papua-new-guinea": ["PNG"],
  micronesia: ["Federated States of Micronesia"], "solomon-islands": ["Solomons"], palestine: ["State of Palestine"], turkey: ["Türkiye"],
  russia: ["Russian Federation"], "lake-geneva": ["Léman", "Lac Léman", "Lake Leman"], "lake-constance": ["Bodensee"],
  "lake-ladoga": ["Ladoga"], "lake-onega": ["Onega"],
};
/** Flags no one could tell apart at this size: either name is right for both. */
const SAME_FLAG = [["chad", "romania"], ["monaco", "indonesia"]];

const fame = new Map(FLAG_QUESTIONS.map(q => [q.about[0], q.lv]));            // ea well known, mi less, ha obscure
const flagNames = new Map(FLAG_QUESTIONS.map(q => [q.about[0], q.o[q.a[0]]]));
const emoji = new Map(FLAG_QUESTIONS.map(q => [q.about[0], (q.q.match(/\p{RI}\p{RI}/u) || [""])[0]]));
const shapes = new Map();                                                   // a picture's outline, for its puzzle

/**
 * Every picture: { id, topic, about (the knowledge base's entity), name, regions, fame, flag (emoji), note }. Ids are
 * the topic's letter and the entity's id (c-france, f-france, l-lake-geneva), so a match or a link names one exactly.
 */
export const PICTURES = [
  ...COUNTRIES.map(c => { shapes.set(`c-${c.about}`, c); return { id: `c-${c.about}`, topic: "countries", about: c.about, name: c.name, regions: c.regions, fame: fame.get(c.about) || "ha", flag: c.flag }; }),
  ...Object.keys(FLAGS).filter(id => flagNames.has(id)).map(id => ({ id: `f-${id}`, topic: "flags", about: id, name: flagNames.get(id), regions: REGION_OF[flagNames.get(id)] || [], fame: fame.get(id) || "ha", flag: emoji.get(id) })),
  ...GEO.filter(g => g.kind === "lake").map(g => { shapes.set(`l-${g.about}`, g); return { id: `l-${g.about}`, topic: "lakes", about: g.about, name: g.name, regions: [REGION_ID[g.region]].filter(Boolean), fame: "mi", flag: "", note: g.note, where: g.country }; }),
  // no entity in the knowledge base yet (about: null): a miss goes to the pile as a picture, not about anything
  ...PLACES.map(r => { shapes.set(`r-${r.id}`, { rings: r.rings, reach: r.reach }); return { id: `r-${r.id}`, topic: "regions", about: null, name: r.name, alt: r.alt || [], regions: [r.cont], fame: "mi", flag: "", of: r.of, unit: r.unit,
    note: `${/^[aeiou]/.test(r.unit) ? "an" : "a"} ${r.unit} of ${r.of}` }; }),
];
const byId = new Map(PICTURES.map(p => [p.id, p]));
export const pictureOf = id => byId.get(id) || null;

/** The names a picture may be given: its own, without "Lake" or "the", and what else it goes by; for a flag, any flag
 *  that looks the same. */
export function namesOf(pic) {
  const out = [pic.name, ...(pic.alt || []), ...(ALIASES[pic.about] || [])];
  const bare = pic.name.replace(/^(the|lake)\s+/i, "").replace(/\s+lake$/i, "");
  if (bare !== pic.name) out.push(bare);
  if (pic.topic === "flags") for (const pair of SAME_FLAG) if (pair.includes(pic.about)) for (const other of pair) if (other !== pic.about) out.push(flagNames.get(other), ...(ALIASES[other] || []));
  return out.filter(Boolean);
}
/** What a picture is, in a few words: "the outline of Chile", "the flag of Chile", "Lake Geneva". */
export const askOf = (topic, pic = null) => (topic === "flags" ? "Whose flag is this?" : topic === "lakes" ? "Which lake is this?"
  : topic === "regions" ? `Which ${pic?.unit || "part"} of ${pic?.of || "its country"} is this?` : "Whose outline is this?");
/** The pictures whose names are the choices for naming this one: every name of its kind, and for a part of a country the
 *  others of the same country (the question has told you which). */
export const siblingsOf = pic => PICTURES.filter(p => p.topic === pic.topic && (pic.topic !== "regions" || p.of === pic.of));

// ---------- the puzzle a picture makes ----------
// how hard, from how a person would solve it (grade() and depthOf() in nonogram-engine.js): Easy is the simple rules
// alone in six rounds or fewer; Medium needs seven to ten, or the complete line logic; Hard eleven or more, or a
// contradiction. Measured on every picture (README, Nonogram): at Medium about a quarter are Easy, half Medium and a
// quarter Hard.
export const BANDS = { easy: "Easy", medium: "Medium", hard: "Hard" };
export function bandOf(level, depth) {
  if (level >= 3 || (level === 1 && depth >= 11)) return "hard";
  if (level === 2 || depth >= 7) return "medium";
  return "easy";
}

const CACHE = new Map();
const keyOf = (id, size, grid) => `${id}@${size}${grid === "hex" ? "@hex" : ""}`;
/** Whether a picture's puzzle at a size has been made already this session (making one can take a moment). */
export const madeAlready = (id, size, grid = "square") => CACHE.has(keyOf(id, size, grid));
/** A puzzle made elsewhere (the page's worker), kept as if made here. */
export function remember(pz) { if (pz?.id && SIZES[pz.size] && pictureOf(pz.id)) CACHE.set(keyOf(pz.id, pz.size, pz.hex ? "hex" : "square"), pz); }
/**
 * The puzzle a picture makes at a size, on squares or (grid "hex") on hexes, or null if it makes none there (too long
 * and thin, too sparse, a flag on hexes, or nothing the fixes can make unique): { id, topic, size, w, h, colours
 * (besides the blank), answer (a colour index a cell), clues, level, depth, probes, band, flips (cells changed from the
 * even split), palette (a colour a colour index: index 0 the blank's, for the flag at the end; null for a one-colour
 * picture, which the page draws in its own ink), names (of the colours) }; on hexes also { hex, R (cells from the
 * centre to a side), n (cells), lines, dirs, land (the shape the outline is of, filled) } and no w or h. Made once a
 * session.
 */
export function puzzleOf(id, size, grid = "square") {
  const key = keyOf(id, size, grid);
  if (!CACHE.has(key)) CACHE.set(key, makePuzzle(id, size, grid));
  return CACHE.get(key);
}
/** The same, made afresh every time (puzzleOf keeps what it makes). */
export function makePuzzle(id, size, grid = "square") {
  const pic = byId.get(id);
  if (!pic || !SIZES[size]) return null;
  const made = grid === "hex" ? (pic.topic === "flags" ? null : hexShapePuzzle(shapes.get(id), size))
    : pic.topic === "flags" ? flagPuzzle(FLAGS[pic.about], size) : shapePuzzle(shapes.get(id), size);
  if (!made) return null;
  const depth = depthOf(made.hex ? made : { w: made.w, h: made.h, colours: made.colours, clues: made.clues }, overlap).depth;
  return { id, topic: pic.topic, size, ...made, depth, band: bandOf(made.level, depth) };
}
/** On hexes a country or a lake is its outline (nonogram-hex.js, outlineOf: three clues a cell pin a line one cell wide
 *  down where two can't), filled in when it's finished; one too thin to fill an eighth of the hexagon makes none. */
function hexShapePuzzle(shape, size) {
  const land = landOf(shape), g = hexGrid(HEX_SIZES[size].R), cov = hexCoverage(land.rings, land.box, g);
  if (cov.reduce((n, v) => n + (v >= 0.5 ? 1 : 0), 0) < 0.12 * g.n) return null;
  const made = hexPuzzleFrom(cov, g);
  if (!made) return null;
  return { hex: true, R: g.R, n: g.n, lines: g.lines, dirs: g.dirs, land: made.land, w: null, h: null, colours: 1, answer: made.cells, clues: made.clues,
    level: made.grade.level, probes: made.grade.probes, flips: made.flips, palette: null, names: null };
}
function shapePuzzle(shape, size) {
  const land = landOf(shape), b = land.box, g = gridFor((b.x1 - b.x0) / (b.y1 - b.y0), size);
  if (!g) return null;
  const cov = coverage(land.rings, b, g.w, g.h);
  if (cov.reduce((n, v) => n + (v >= 0.5 ? 1 : 0), 0) < 0.12 * cov.length) return null;   // a scatter of islets, not a picture
  const made = puzzleFrom(cov, g.w, g.h, { short: SIZES[size].short });
  if (!made) return null;
  return { w: made.w, h: made.h, colours: 1, answer: made.cells, clues: made.clues, level: made.grade.level, probes: made.grade.probes, flips: made.flips.length, palette: null, names: null };
}
/**
 * A flag's puzzle: the grid near the size's that cuts its colours most cleanly (stripes falling between rows), the
 * blank its commonest colour (its most of it is left to draw in the others), and of the grids near it the first whose
 * clues have one answer reasoning reaches.
 */
function flagPuzzle(flag, size) {
  const g = gridFor(flag.r, size);
  if (!g) return null;
  const tries = [];
  for (let dw = -1; dw <= 1; dw++) for (let dh = -1; dh <= 1; dh++) {
    const w = g.w + dw, h = g.h + dh;
    if (Math.min(w, h) < SIZES[size].short || Math.max(w, h) > SIZES[size].long || Math.abs(w / h - flag.r) / flag.r > 0.12) continue;
    tries.push({ w, h, ...rasterFlag(flag, w, h) });
  }
  tries.sort((a, b) => b.crisp - Math.abs(b.w * b.h - SIZES[size].n) / SIZES[size].n * 0.1 - (a.crisp - Math.abs(a.w * a.h - SIZES[size].n) / SIZES[size].n * 0.1));
  for (const t of tries) {
    const count = {};
    for (const c of t.letters) count[c] = (count[c] || 0) + 1;
    const bg = count._ ? "_" : Object.keys(count).sort((a, b) => count[b] - count[a] || (b === "W") - (a === "W") || (a < b ? -1 : 1))[0];
    const order = Object.keys(count).filter(c => c !== bg).sort((a, b) => count[b] - count[a] || (a < b ? -1 : 1));
    if (!order.length || order.length > 7) continue;
    const answer = t.letters.map(c => (c === bg ? 0 : 1 + order.indexOf(c)));
    const clues = cluesOf(t.w, t.h, answer), p = { w: t.w, h: t.h, colours: order.length, clues };
    const n = countSolutions(p, { maxNodes: 3000 });
    if (n.count !== 1 || n.gaveUp) continue;
    const gr = grade(p);
    if (!gr.solved) continue;
    return { w: t.w, h: t.h, colours: order.length, answer, clues, level: gr.level, probes: gr.probes, flips: 0,
      palette: [bg === "_" ? null : COLOURS[bg], ...order.map(c => COLOURS[c])], names: [COLOUR_NAMES[bg] || "", ...order.map(c => COLOUR_NAMES[c])] };
  }
  return null;
}

// ---------- dealing ----------
/** A small seeded random (mulberry32), so a day's picture is the same on every phone. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = (rand, xs) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
/** The pictures of a topic ("all" for every kind, less those `mix` has out) in a region ("world" for all of them); on hexes, no flags. */
export const poolOf = (topic, region, grid = "square", mix = null) => {
  const kinds = mix && Object.values(mix).some(w => w > 0) ? p => mix[p.topic] > 0 : () => true;
  return PICTURES.filter(p => (topic === "all" ? kinds(p) : p.topic === topic) && (region === "world" || p.regions.includes(region)) && !(grid === "hex" && p.topic === "flags"));
};

/**
 * How a due picture (learning mode's `prefer`) is dealt: a picture you couldn't name used to be put first at every deal
 * and nothing it was just dealt counted against it, so one miss came back every game (Korbi, 31 October 2026: "always
 * giving me the same one, Switzerland"). Now a deal offers one half the time (`share`) and not one shown within the last
 * HOLD_BACK deals, so a single miss comes back about once in eight games and several share the turns.
 */
export const PREFER_SHARE = 0.5, HOLD_BACK = 6;

/**
 * The picture for a new game: { id, nearest } or null. `seen` is what was dealt lately, newest first. From the pool,
 * those due again or weak elsewhere (`prefer`, in order) first when this deal offers one, then those not dealt lately in
 * a random order (by `rand`), then the rest, longest ago first so the pool comes round in turn; the first that makes a
 * puzzle at this size (and grid) of the band asked ("any" for all), or failing that the nearest band (nearest: true).
 * `mix` (topicsOf the subjects on) leaves out the kinds Settings has out when the topic is "all".
 */
export function dealPicture({ topic = "countries", region = "world", size = "medium", band = "any", grid = "square", mix = null, seen = [], prefer = [], share = PREFER_SHARE, rand = Math.random } = {}) {
  const pool = poolOf(topic, region, grid, mix);
  if (!pool.length) return null;
  const ids = new Set(pool.map(p => p.id)), lately = new Set(seen), held = new Set(seen.slice(0, HOLD_BACK));
  // the draw is only made when there is something due, so a deal without (a day's picture) is the same as ever
  const due = prefer.length && rand() < share ? prefer.filter(id => ids.has(id) && !held.has(id)) : [];
  const fresh = shuffle(rand, pool.filter(p => !lately.has(p.id)).map(p => p.id));
  const age = new Map();                                          // how many deals ago; the newest showing counts if it's in twice
  seen.forEach((id, i) => { if (!age.has(id)) age.set(id, i); });
  const stale = pool.filter(p => lately.has(p.id)).map(p => p.id).sort((a, b) => age.get(b) - age.get(a));
  const order = [...new Set([...due, ...fresh, ...stale])];
  const rank = b => ["easy", "medium", "hard"].indexOf(b);
  let near = null;
  for (const id of order) {
    const pz = puzzleOf(id, size, grid);
    if (!pz) continue;
    if (band === "any" || pz.band === band) return { id, nearest: false };
    if (!near || Math.abs(rank(pz.band) - rank(band)) < Math.abs(rank(near.band) - rank(band))) near = { id, band: pz.band };
  }
  return near ? { id: near.id, nearest: true } : null;
}
/** Today's picture: a country's outline, Medium, of Medium difficulty, the same for everyone on the day (YYYYMMDD). */
export const DAILY = { topic: "countries", region: "world", size: "medium", band: "medium" };
export function dailyPicture(day) {
  return dealPicture({ ...DAILY, rand: rng(day) })?.id ?? null;
}
