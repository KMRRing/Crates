// The Constitutions course's interaction steps (the lesson kit, lesson-kit.js), written compactly for the chapter files constitutions-x1.js to constitutions-x6.js. Each helper
// returns a raw step that constitutions-lessons.js turns into a kit step and seats in its lesson after the raw step named in the chapter's table (X[lessonId][i]: after the lesson's
// raw step i, counting from 0; the table's order is the order shown). `say` is the words the sheet shows (40 to 90 words, never more than 120); `why` ends the step. A last
// argument { check: true } flags a fact nobody has verified yet. Facts here restate the lesson's own words as something to do, or are flagged.
const o = (x, say, rest, why, opt) => ({ x, say, ...rest, why, ...(opt || {}) });

/** Tap a card, then its partner. pairs: [[left, right]…] (2 to 5). */
export const PAIR = (say, pairs, why, opt) => o("pair", say, { pairs }, why, opt);
/** Tap a card, then its numbered place. items in the right order (3 to 5). */
export const ORDR = (say, items, why, opt) => o("order", say, { items }, why, opt);
/** Sort into boxes. bins: [name…]; items: [[text, binIndex, why?]…] (up to 6). */
export const BINS = (say, bins, items, why, opt) => o("bins", say, { bins, items: items.map(([t, bin, w]) => ({ t, bin, ...(w ? { why: w } : {}) })) }, why, opt);
/** True or false under each statement. items: [[text, answer, reason]…] (1 to 4). */
export const TF = (say, items, why, opt) => o("tf", say, { items: items.map(([t, a, w]) => ({ t, a, why: w })) }, why, opt);
/** Tap a term to open it. cards: [[head, body]…] (2 to 6). */
export const REV = (say, cards, why, opt) => o("reveal", say, { cards: cards.map(([head, body]) => ({ head, body })) }, why, opt);
/** Tap the parts of a diagram (a graph whose nodes have `note`). */
export const EXP = (say, fig, why, opt) => o("explore", say, { fig }, why, opt);
/** Drag a value. spec: { min, max, step, init, unit, label, bands: [{ from, text, tone? }], marks?, goal?, need? }. */
export const SLIDE = (say, spec, why, opt) => o("slider", say, spec, why, opt);
/** Pick a move, see what constrained it. options: [[label, what bit]…] (2 to 4). */
export const DEC = (say, actor, options, why, opt) => o("decide", say, { actor, options: options.map(([label, bites]) => ({ label, bites })) }, why, opt);
/** Switch layers on a diagram. toggles: [[id, label, on?]…]; rules: [[[conditions], text]…], first match wins; dflt otherwise. */
export const TOG = (say, fig, toggles, rules, dflt, why, opt) => o("toggle", say, { fig, toggles: toggles.map(([id, label, on]) => ({ id, label, on: !!on })), rules: rules.map(([c, text]) => ({ if: c, text })), dflt }, why, opt);
/** Place pieces on a skeleton diagram whose empty places are `slot` nodes. pieces: [[slotId, label]…] (2 to 5). */
export const BUILD = (say, fig, pieces, why, opt) => o("build", say, { fig, pieces: pieces.map(([id, label]) => ({ id, label })) }, why, opt);
/** Words with a figure beside them (no task): the step the figure explains. */
export const FIG = (say, fig, opt) => ({ x: "fig", say, fig, ...(opt || {}) });

// ---- figure shorthand ----
/** A graph node: N(id, x, y, label, tone, note, layer). */
export const N = (id, x, y, label, tone, note, layer) => ({ id, x, y, label, ...(tone ? { tone } : {}), ...(note ? { note } : {}), ...(layer ? { layer } : {}) });
/** A slot (an empty place to build into): SL(id, x, y, w). */
export const SL = (id, x, y, w = 70) => ({ id, x, y, label: "", slot: true, w });
/** An edge: E(a, b, label, kind, layer). */
export const E = (a, b, label, kind, layer) => ({ a, b, ...(label ? { label } : {}), ...(kind ? { kind } : {}), ...(layer ? { layer } : {}) });
/** A graph: G(w, h, nodes, edges, alt). */
export const G = (w, h, nodes, edges = [], alt = "") => ({ type: "graph", w, h, nodes, edges, alt });
