// Writes assay-grades.js: every answer's grade, for each lexicon and length (README, Assay: how hard a word is).
// Grading every word on a phone would take seconds, so it's done here once: node assay-grades.mjs (a minute or two).
// Run it again whenever the word list or Assay's answer rules change; tests/assay.mjs fails until it has been.
import fs from "fs";
import { LEXICONS } from "./assay-words.js";
import { packOf, gradeOf, packGrades, hashOf } from "./assay-engine.js";

const out = {};
for (const lex of Object.values(LEXICONS)) {
  out[lex.id] = {};
  for (const len of lex.lengths) {
    const t0 = Date.now(), P = packOf(lex, len), g = Int32Array.from({ length: P.N }, (_, i) => gradeOf(P, i));
    out[lex.id][len] = { n: P.N, sum: hashOf(P.words.join(" ")), g: packGrades(g) };
    console.log(`${lex.id} ${len}: ${P.N} words graded in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
}
const body = Object.entries(out).map(([id, lens]) => `  ${id}: {\n${Object.entries(lens).map(([len, x]) => `    ${len}: { n: ${x.n}, sum: ${x.sum}, g: "${x.g}" },`).join("\n")}\n  },`).join("\n");
fs.writeFileSync(new URL("./assay-grades.js", import.meta.url), `// Assay's grades, written by assay-grades.mjs: don't edit, rerun it (tests/assay.mjs says when it's due).
// For each lexicon and length: how many answers, a hash of them (a list that has changed since is graded on the phone
// instead), and each answer's grade, two characters a word in the answers' order (assay-engine.js, gradesOf).
export const GRADES = {
${body}
};
`);
