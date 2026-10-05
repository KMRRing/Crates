// Slate's dictionary (slate-defs.js): every word our fills use is defined, at most a few dozen of the rarest words
// players may place are not, every pointer to a base word lands on one with senses, and every code is one the lookup
// shows. Entries outside the word list must be bases something points at (go for gone).
import { WORDS } from "../slate-words.js";
import { DEFS } from "../slate-defs.js";

const unpack = packed => Object.entries(packed).flatMap(([L, s]) => s.match(new RegExp(`.{${L}}`, "g")));
const VAL = new Set(unpack(WORDS.val)), EASY = unpack(WORDS.easy);
const SENSE = "nvarpcdoixk", HOW = "psdgctfv";
const UNDEFINED_AT_MOST = 40;
let bad = 0;
const fail = msg => { bad++; console.log(msg); };
const hasSenses = w => (DEFS[w] || "").split("|").some(p => p && !p.startsWith("="));

const pointedAt = new Set();
for (const [w, line] of Object.entries(DEFS)) {
  if (!line) fail(`${w}: empty entry`);
  for (const part of line.split("|")) {
    if (part.startsWith("=")) {
      const [base, how, extra] = part.slice(1).split(".");
      pointedAt.add(base);
      if (extra !== undefined || how?.length !== 1 || !HOW.includes(how)) fail(`${w}: bad pointer "${part}"`);
      else if (!hasSenses(base)) fail(`${w} points at ${base}, which has no senses`);
    } else if (part.length < 4 || !SENSE.includes(part[0])) fail(`${w}: bad sense "${part}"`);
  }
}
for (const w of EASY) if (!DEFS[w]) fail(`${w} is a fill word without a definition`);
for (const w of Object.keys(DEFS)) if (!VAL.has(w) && !pointedAt.has(w)) fail(`${w} is not in the word list and nothing points at it`);
const undefined_ = [...VAL].filter(w => !DEFS[w]);
if (undefined_.length > UNDEFINED_AT_MOST) fail(`${undefined_.length} words have no definition (at most ${UNDEFINED_AT_MOST})`);

console.log(bad ? `${bad} problems in the dictionary`
  : `dictionary: ${VAL.size - undefined_.length} of ${VAL.size} words defined (every fill word), ${Object.keys(DEFS).length - VAL.size + undefined_.length} bases besides`);
process.exitCode = bad ? 1 : 0;
