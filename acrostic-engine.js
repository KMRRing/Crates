// Acrostic's rules (README, Classics: Acrostic), pure: no page, no word lists, so the page loads it without the weight
// the generator carries (acrostic-make.js, in a worker). A puzzle is plain JSON, made once and kept whole in the run,
// the duel's match and the team's table, so a watcher's frame, a reload and a partner all draw the same one:
//
//   { v, seed, level, twist, source, id, text (as shown), cells (the solution, a letter a square, reading order),
//     layout (the text's words: boxes that are squares or given characters, with the punctuation round them),
//     answers ([{ word, clue, d, cells }]: clue A first; cells, the square each letter goes into), spine ({ text,
//     label, at: "first" | "last" }), about ({ title, by, lines }: the reveal), grade, split, rival, unclued }
//
// An entry is the player's letters, one character a square: a letter, or "." for an empty one.
export const VERSION = 1;
export const EMPTY = ".";

// ---------- what a puzzle can be ----------
// Each level: the text's letters, how many answers and their average length, the rarest words its answers may be
// (wordlist.js tiers) and the tier it leans to (prefer, by how much: lean), the clues it starts from, and the skill a
// person needs (acrostic-solve.js grade). Easy is a short text, the commonest words wherever the letters allow and
// plain clues; Hard a long one, rarer words, the harder clues, and somewhere a clue that must be cracked with little help.
export const LEVELS = {
  easy: { label: "Easy", letters: [28, 72], answers: [5, 11], avg: [3.6, 6.8], tier: 1, prefer: 0, lean: 1.6, d: 1, grade: 1 },
  medium: { label: "Medium", letters: [42, 92], answers: [7, 14], avg: [4, 7.4], tier: 1, prefer: 0, lean: 0.4, d: 1, grade: 2 },
  hard: { label: "Hard", letters: [60, 125], answers: [10, 18], avg: [4.4, 8], tier: 2, prefer: 1, lean: 0.4, d: 2, grade: 3 },
};
export const TWISTS = {
  classic: { label: "Classic", note: "The answers' first letters spell the source." },
  telestich: { label: "Telestich", note: "The source runs down the answers' last letters." },
  half: { label: "Half clued", note: "Half the clues are blank: those words come from the text alone." },
};
export const DAILY = { level: "medium", twist: "classic" };       // today's: the same for everyone, from every source
export const SOURCES = [["lit", "Literature"], ["saying", "Sayings"], ["place", "Places"], ["art", "Paintings"], ["term", "Terms"]];

// ---------- letters ----------
/** Accents and ligatures folded to the 26 letters a square takes (Bären is BAREN, œuvre OEUVRE). */
export function fold(s) {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss").replace(/[Ææ]/g, m => (m === "Æ" ? "AE" : "ae")).replace(/[Œœ]/g, m => (m === "Œ" ? "OE" : "oe"))
    .replace(/[Øø]/g, m => (m === "Ø" ? "O" : "o")).replace(/[Łł]/g, m => (m === "Ł" ? "L" : "l")).replace(/[Đđ]/g, m => (m === "Đ" ? "D" : "d"))
    .replace(/[Þþ]/g, m => (m === "Þ" ? "TH" : "th")).replace(/ı/g, "i").replace(/[‘’ʼ]/g, "'").replace(/[“”«»„]/g, '"');
}
/** The letters of a text, upper case, in order. */
export const lettersOf = s => fold(s).toUpperCase().replace(/[^A-Z]/g, "");

// ---------- the text as squares ----------
const LETTER = /[A-Za-z]/, DIGIT = /[0-9]/;
/**
 * Lays a text out as the grid's words: each a list of boxes, a box a square ({ c: its index }) or a character shown as
 * given ({ g: "4" }), with punctuation drawn at its edges ({ b: before, a: after }) rather than taking a square, as on
 * paper. Digits are given: a square holds a letter. Returns { cells, layout }, cells the letters in reading order.
 */
export function layOut(text) {
  const layout = [], letters = [];
  for (const raw of fold(text).replace(/\s+/g, " ").trim().split(" ")) {
    const boxes = [];
    let lead = "";
    for (const ch of raw) {
      if (LETTER.test(ch)) { boxes.push({ c: letters.length, ...(lead ? { b: lead } : {}) }); letters.push(ch.toUpperCase()); lead = ""; }
      else if (DIGIT.test(ch)) { boxes.push({ g: ch, ...(lead ? { b: lead } : {}) }); lead = ""; }
      else if (boxes.length) boxes.at(-1).a = (boxes.at(-1).a || "") + ch;
      else lead += ch;
    }
    if (boxes.length) layout.push(boxes);
    else if (lead && layout.length) { const last = layout.at(-1).at(-1); last.a = `${last.a || ""} ${lead}`; }   // a dash between words
  }
  return { cells: letters.join(""), layout };
}
/**
 * The text's words as runs of squares, split wherever the text puts a mark or a digit between letters (life's is
 * LIFE and S; head-to-head three words), since that's what a solver reads as a word: [[cell, …], …].
 */
export function runsOf(layout) {
  const runs = [];
  for (const word of layout) {
    let run = [];
    const flush = () => { if (run.length) runs.push(run); run = []; };
    word.forEach((box, i) => {
      if (box.c != null) run.push(box.c); else flush();
      if (box.a && i < word.length - 1) flush();      // a mark inside the word (only a word's first box has one before it)
    });
    flush();
  }
  return runs;
}

// ---------- a puzzle's squares and clues ----------
/** For every square: which answer it belongs to and where in it ({ a, i }). */
export function owners(P) {
  const own = new Array(P.cells.length);
  P.answers.forEach((ans, a) => ans.cells.forEach((c, i) => { own[c] = { a, i }; }));
  return own;
}
/** The clue's label: A, B, … Z, then AA, BB, as on paper. */
export const labelOf = a => String.fromCharCode(65 + (a % 26)).repeat(1 + Math.floor(a / 26));
export const blank = P => EMPTY.repeat(P.cells.length);
/** Whether an entry is this puzzle's: the right length, letters and blanks only. */
export const validEntry = (P, e) => typeof e === "string" && e.length === P.cells.length && /^[A-Z.]*$/.test(e);
/** The entry with `letter` (or EMPTY) in square `c`. */
export function put(entry, c, letter) {
  const ch = letter && /^[A-Za-z]$/.test(letter) ? letter.toUpperCase() : EMPTY;
  return c < 0 || c >= entry.length || entry[c] === ch ? entry : entry.slice(0, c) + ch + entry.slice(c + 1);
}
export const solved = (P, entry) => entry === P.cells;
export const filled = entry => { let n = 0; for (const ch of entry) if (ch !== EMPTY) n++; return n; };
/** The squares holding a letter that isn't the text's. */
export function wrong(P, entry) {
  const out = [];
  for (let c = 0; c < entry.length; c++) if (entry[c] !== EMPTY && entry[c] !== P.cells[c]) out.push(c);
  return out;
}
/** Squares right so far: a duel's progress, a rival's. */
export function right(P, entry) { let n = 0; for (let c = 0; c < entry.length; c++) if (entry[c] === P.cells[c]) n++; return n; }
/** An answer as the entry spells it, "." for its gaps. */
export const spelled = (P, entry, a) => P.answers[a].cells.map(c => entry[c]).join("");
/** Where the spine reads in every answer: its first letters, or its last (a telestich). */
export const spineCell = (P, a) => (P.spine.at === "last" ? P.answers[a].cells.at(-1) : P.answers[a].cells[0]);

// ---------- moving through the puzzle ----------
/**
 * The square after `c` (or before, step -1) along the way you're typing: "text", reading order, or "clue", the
 * answer's own letters. null at the end.
 */
export function step(P, own, c, way, dir = 1) {
  if (way === "clue") { const { a, i } = own[c], cells = P.answers[a].cells; return cells[i + dir] ?? null; }
  const n = c + dir;
  return n >= 0 && n < P.cells.length ? n : null;
}
/** The next empty square after `c` along the way, wrapping within the answer or the text; null when it's full. */
export function nextEmpty(P, own, entry, c, way) {
  const order = way === "clue" ? P.answers[own[c].a].cells : [...P.cells].map((_, i) => i);
  const at = order.indexOf(c);
  for (let k = 1; k <= order.length; k++) { const x = order[(at + k) % order.length]; if (entry[x] === EMPTY) return x; }
  return null;
}

// ---------- the computer's run, as it stands at a moment ----------
/**
 * The rival's entry `ms` into its run: its schedule is a list of [ms, cells] steps (acrostic-solve.js works it out
 * when the puzzle is made), every square in a step taking its letter once that moment is past.
 */
export function rivalAt(P, level, ms) {
  const plan = P.rival?.[level] || [];
  let entry = blank(P);
  for (const [at, cells] of plan) { if (at > ms) break; for (const c of cells) entry = put(entry, c, P.cells[c]); }
  return entry;
}
/** When the rival finishes (ms), or null if it never does. */
export const rivalDone = (P, level) => { const plan = P.rival?.[level]; return plan?.length ? plan.at(-1)[0] : null; };

// ---------- playing together ----------
/** Whether clue `a` is this seat's to read in a team match (each seat holds its half; with nobody else, all). */
export const holds = (P, a, seat) => seat == null || !P.split || P.split[a] === seat;
