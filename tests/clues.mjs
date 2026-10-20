// The clue bank (clues.js, README Classics). Every clued word is a common word of wordlist.js, filed under its length
// and its tier, a word both spellings share, alphabetical and once. Every clue is short plain text starting with a
// capital, gives away neither its answer nor an obvious stem of it (RUN in a clue for RUNNING, CARRY for CARRIED, GIVE
// for GAVE) nor a piece of it (HUNK for CHUNK), and differs from its word's other clue. The API finds a word's clues
// in any case, easy first, and lists a length's clued words commonest first.
import { CLUES } from "../clues-data.js";
import { MIN, MAX, cluesOf, hasClue, cluedWords } from "../clues.js";
import { tierOf, isVariant } from "../wordlist.js";

let bad = 0;
const check = (ok, what, examples = []) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) { bad++; for (const e of examples.slice(0, 12)) console.log(`       ${e}`); if (examples.length > 12) console.log(`       … and ${examples.length - 12} more`); }
};

// The forms of the commonest irregular words: each is a stem of the others (GAVE and GIVE, MICE and MOUSE).
const IRREGULAR = `arise arose arisen|awake awoke awoken|be am is are was were been being|bear bore borne born|beat beaten|
become became|begin began begun|bend bent|bite bit bitten|bleed bled|blow blew blown|break broke broken|breed bred|bring brought|
build built|burn burnt|buy bought|catch caught|choose chose chosen|cling clung|come came|creep crept|deal dealt|dig dug|
do does did done|draw drew drawn|dream dreamt|drink drank drunk|drive drove driven|eat ate eaten|fall fell fallen|feed fed|
feel felt|fight fought|find found|flee fled|fling flung|fly flies flew flown|forbid forbade forbidden|forget forgot forgotten|
forgive forgave forgiven|freeze froze frozen|get got gotten|give gave given|go goes went gone|grind ground|grow grew grown|
hang hung|have has had|hear heard|hide hid hidden|hold held|keep kept|kneel knelt|know knew known|lay laid|lead led|lean leant|
leap leapt|learn learnt|leave left|lend lent|lie lay lain|light lit|lose lost|make made|mean meant|meet met|
mistake mistook mistaken|pay paid|ride rode ridden|ring rang rung|rise rose risen|run ran|say said|see saw seen|seek sought|
sell sold|send sent|sew sewn|shake shook shaken|shine shone|shoot shot|show shown|shrink shrank shrunk|sing sang sung|
sink sank sunk|sit sat|slay slew slain|sleep slept|slide slid|sling slung|smell smelt|speak spoke spoken|speed sped|spell spelt|
spend spent|spill spilt|spin spun|spit spat|spoil spoilt|spring sprang sprung|stand stood|steal stole stolen|stick stuck|
sting stung|stink stank stunk|stride strode stridden|strike struck|string strung|strive strove striven|swear swore sworn|
sweep swept|swell swollen|swim swam swum|swing swung|take took taken|teach taught|tear tore torn|tell told|think thought|
throw threw thrown|tread trod trodden|wake woke woken|wear wore worn|weave wove woven|weep wept|win won|wind wound|wring wrung|
write wrote written|child children|foot feet|goose geese|louse lice|man men|mouse mice|ox oxen|person people|tooth teeth|
woman women|die dice|good better best|bad worse worst|far farther further|little less least|many much more most`;
const FORMS = new Map();
for (const group of IRREGULAR.replace(/\n/g, "").split("|")) {
  const forms = group.split(" ");
  for (const f of forms) FORMS.set(f, [...(FORMS.get(f) || []), ...forms]);
}

// Endings taken off to find a word's stem, each with what goes back on: RUNS, RUN; HOPED, HOPE; CARRIES, CARRY;
// LEAVES, LEAF; SAFEST, SAFE; HAPPILY, HAPPY.
const ENDINGS = [["s", ""], ["es", ""], ["ed", ""], ["ed", "e"], ["ing", ""], ["ing", "e"], ["ies", "y"], ["ied", "y"],
  ["er", ""], ["er", "e"], ["est", ""], ["est", "e"], ["ier", "y"], ["iest", "y"], ["ly", ""], ["ily", "y"], ["ally", ""],
  ["ness", ""], ["y", ""], ["ves", "f"], ["ves", "fe"]];
/** The answer and its obvious stems of three letters or more. */
function stemsOf(answer) {
  const out = new Set([answer, ...(FORMS.get(answer) || [])]);
  for (const [end, put] of ENDINGS) {
    if (!answer.endsWith(end)) continue;
    const s = answer.slice(0, -end.length);
    out.add(s + put);
    // a doubled consonant: RUNNING, RUN; STOPPED, STOP; BIGGER, BIG; TRAVELLED, TRAVEL
    if (!put && s.length >= 3 && s.at(-1) === s.at(-2) && !"aeiou".includes(s.at(-1))) out.add(s.slice(0, -1));
  }
  return [...out].filter(s => s.length >= 3);
}
/** Whether a clue gives its answer away: a stem of four letters or more anywhere in one of its words, one of three
 *  letters at the start or end of one (CAT in "category", "bobcat"), or the whole answer run across its words. */
function givesAway(answer, text) {
  const lower = text.toLowerCase(), words = lower.match(/[a-z]+/g) || [];
  if (answer.length >= 5 && lower.replace(/[^a-z]/g, "").includes(answer)) return answer;
  for (const s of stemsOf(answer)) {
    if (words.some(w => (s.length >= 4 ? w.includes(s) : w.startsWith(s) || w.endsWith(s)))) return s;
  }
  return null;
}
/** Whether a clue shows a piece of its answer the other way round: one of its words, of four letters or more, inside
 *  the answer (HUNK in a clue for CHUNK), or one of three at the answer's start or end (NOT for CANNOT, NUT for PEANUT). */
function showsPiece(answer, text) {
  for (const w of text.toLowerCase().match(/[a-z]+/g) || []) {
    if (w.length >= 3 && w !== answer && (w.length >= 4 ? answer.includes(w) : answer.startsWith(w) || answer.endsWith(w))) return w;
  }
  return null;
}

// ---------- the data ----------
const entries = [], malformed = [], misfiled = [], unordered = [];
for (const [key, blocks] of Object.entries(CLUES)) {
  const n = Number(key);
  if (!(Number.isInteger(n) && n >= MIN && n <= MAX) || !Array.isArray(blocks) || blocks.length > 3) { malformed.push(`length ${key}`); continue; }
  blocks.forEach((block, tier) => {
    let last = "";
    for (const line of block.split("\n")) {
      if (!line) continue;
      const fields = line.split("|"), [word, easy, hard] = fields;
      if (fields.length !== 3 || !/^[a-z]+$/.test(word) || (!easy && !hard)) { malformed.push(line); continue; }
      if (word.length !== n || tierOf(word) !== tier || isVariant(word)) misfiled.push(`${word}: filed at ${n} letters, tier ${tier}; wordlist.js has tier ${tierOf(word)}${isVariant(word) ? ", one spelling's only" : ""}`);
      if (!(last < word)) unordered.push(`${last} then ${word}`);
      last = word;
      entries.push({ word, tier, clues: [[easy, 1], [hard, 2]].filter(([text]) => text) });
    }
  });
}
check(!malformed.length, "every line is a word in lower case and two clue fields, at least one filled, under a length of 3 to 12", malformed);
check(!misfiled.length, "every clued word is in wordlist.js, filed under its length and its tier (0 to 2), and a word both spellings share", misfiled);
check(!unordered.length, "alphabetical within each tier, each word once", unordered);
const seen = new Set(entries.map(e => e.word));
check(seen.size === entries.length, "no word is clued twice");
// both raised as the bank grows, so that losing words fails
const FLOOR = 16500, LONGEST = MAX;
check(entries.length >= FLOOR, `at least ${FLOOR} words clued (${entries.length}, ${entries.filter(e => e.word.length <= 7).length} of them of 3 to 7 letters)`);
check(Array.from({ length: LONGEST - MIN + 1 }, (_, i) => MIN + i).every(n => entries.some(e => e.word.length === n)), `every length from ${MIN} to ${LONGEST} has clued words`);

// ---------- the clues ----------
const clues = entries.flatMap(e => e.clues.map(([text, d]) => ({ word: e.word, text, d })));
const shape = clues.filter(c => !/^(?:[A-Z0-9("]|___)/.test(c.text) || !/^[A-Za-zÀ-ÖØ-öø-ÿ0-9 ,.;:'"?!()&%_-]+$/.test(c.text) || /\s\s|^\s|\s$/.test(c.text)
  || (/\.$/.test(c.text) && !/(?:e\.g|etc)\.$/.test(c.text)) || (c.text.match(/\(/g) || []).length !== (c.text.match(/\)/g) || []).length
  || (c.text.match(/"/g) || []).length % 2);
check(!shape.length, "every clue is plain text that starts with a capital (or a blank), with no full stop at the end", shape.map(c => `${c.word}: ${c.text}`));
const long = clues.filter(c => c.text.length > 50);
check(!long.length, `every clue is 50 characters at most (the longest ${Math.max(...clues.map(c => c.text.length))})`, long.map(c => `${c.word}: ${c.text} (${c.text.length})`));
const giving = clues.map(c => ({ ...c, stem: givesAway(c.word, c.text) })).filter(c => c.stem);
check(!giving.length, "no clue contains its answer or an obvious stem of it", giving.map(c => `${c.word}: "${c.text}" has ${c.stem}`));
const showing = clues.map(c => ({ ...c, piece: showsPiece(c.word, c.text) })).filter(c => c.piece);
check(!showing.length, "nor a word that is a piece of its answer", showing.map(c => `${c.word}: "${c.text}" has ${c.piece}`));
const twice = entries.filter(e => e.clues.length === 2 && e.clues[0][0].toLowerCase().replace(/[^a-z0-9]/g, "") === e.clues[1][0].toLowerCase().replace(/[^a-z0-9]/g, ""));
check(!twice.length, "no word has the same clue twice", twice.map(e => `${e.word}: ${e.clues[0][0]}`));
check(clues.length > entries.length * 1.8, `two clues for nearly every word (${clues.length} clues, ${entries.filter(e => e.clues.length === 2).length} words with both)`);
check(givesAway("running", "Sprinting") === null && givesAway("running", "Out for a run") === "run" && givesAway("carried", "Was carrying") === "carry"
  && givesAway("gave", "Did give") === "give" && givesAway("cat", "Category") === "cat" && givesAway("art", "Painting, e.g.") === null
  && givesAway("leaves", "Leaf matter") === "leaf" && givesAway("someone", "Some one person") === "someone",
  "the check for a stem finds RUN in RUNNING, CARRY in CARRIED, GIVE in GAVE, a short answer starting a word, and the answer run across words");
check(showsPiece("chunk", "Hunk") === "hunk" && showsPiece("cannot", "May not") === "not" && showsPiece("peanut", "Monkey nut") === "nut"
  && showsPiece("either", "One or the other") === null && showsPiece("peanut", "Goober") === null,
  "and the check for a piece finds HUNK in CHUNK and a short word ending CANNOT or PEANUT, not one in the middle (THE in EITHER)");

// ---------- the API ----------
{
  const a = cluesOf("able"), b = cluesOf("ABLE");
  check(a.length === 2 && a === b && Object.isFrozen(a) && Object.isFrozen(a[0]), "cluesOf finds a word in any case, the same frozen list each time");
  check(cluesOf("xyzzy").length === 0 && cluesOf("").length === 0 && cluesOf(null).length === 0 && cluesOf("a".repeat(13)).length === 0, "and nothing for a word it hasn't, or none at all");
  const ds = [];
  for (const e of entries) {
    const got = cluesOf(e.word);
    if (got.length !== e.clues.length || got.some((c, i) => c.text !== e.clues[i][0] || c.d !== e.clues[i][1] || (i && c.d <= got[i - 1].d)) || got.some(c => c.d !== 1 && c.d !== 2)) ds.push(e.word);
  }
  check(!ds.length, "every word's clues come back as written, d 1 (easy) or 2 (harder), the easy one first", ds);
  check(entries.every(e => hasClue(e.word) && hasClue(e.word.toUpperCase())) && !hasClue("xyzzy") && !hasClue(""), "hasClue says which words have a clue");
  const order = [];
  for (let n = MIN; n <= MAX; n++) {
    const all = cluedWords(n), mine = entries.filter(e => e.word.length === n);
    if (all.length !== mine.length || all.some(w => w.length !== n || !hasClue(w))) order.push(`${n}: ${all.length} listed, ${mine.length} clued`);
    for (let i = 1; i < all.length; i++) {
      const t0 = tierOf(all[i - 1]), t1 = tierOf(all[i]);
      if (t1 < t0 || (t1 === t0 && !(all[i - 1] < all[i]))) { order.push(`${n}: ${all[i - 1]} before ${all[i]}`); break; }
    }
    for (let t = 0; t < 2; t++) {
      const narrow = cluedWords(n, t), wide = cluedWords(n, t + 1);
      if (narrow.some((w, i) => wide[i] !== w) || narrow.some(w => tierOf(w) > t)) order.push(`${n}: tier ${t} isn't the start of tier ${t + 1}'s list`);
    }
  }
  check(!order.length, "cluedWords lists every clued word of a length, commonest tier first, alphabetical within one; upto narrows it", order);
  check(cluedWords(5) === cluedWords(5) && Object.isFrozen(cluedWords(5)) && cluedWords("5") === cluedWords(5), "the same frozen list each time");
  check(cluedWords(2).length === 0 && cluedWords(13).length === 0 && cluedWords(4.5).length === 0 && cluedWords(5, -1).length === 0, "no list outside 3 to 12 letters, or below the commonest tier");
}

console.log(bad ? `\n${bad} FAILED` : "\nall ok");
process.exit(bad ? 1 : 0);
