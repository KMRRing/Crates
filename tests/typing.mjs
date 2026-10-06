// Typed answers (typing.js): what counts as the right one, and what doesn't. Run: node tests/typing.mjs
import { check } from "../typing.js";
let bad = 0;
const t = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };
const exact = (typed, answer) => check(typed, [answer]).exact, right = (typed, answer) => check(typed, [answer]).right;
t(exact("phantom of the opera", "Phantom of the Opera"), "case doesn't matter");
t(exact("The Phantom of the Opera", "Phantom of the Opera"), "nor a leading article");
t(exact("Gaudi", "Gaudí") && exact("Strasse", "Straße") && exact("Oersted", "Ørsted") || exact("Orsted", "Ørsted"), "nor accents, ß or ø");
t(exact("ivy-style", "Ivy style") && exact("blue  mountain!", "Blue Mountain"), "nor punctuation and spacing");
t(exact("krone", "Krone (currency)"), "a part in brackets can be left out");
t(exact("ni hao", "nǐ hǎo") && exact("ni3 hao3", "nǐ hǎo") && exact("nihao", "nǐ hǎo"), "pinyin without its tones, with tone numbers, or run together");
t(right("Habsburg", "Habsburgs") && !exact("Habsburg", "Habsburgs"), "a slip of a letter in a longer name counts, as close");
t(right("Hapsbrugs", "Habsburgs"), "two slips in a name of nine letters or more count");
t(!right("Malta", "Malt"), "a short answer has to be exact");
t(!right("Madrid", "Barcelona") && !right("", "Barcelona") && !right("   ", "Barcelona"), "a different name, or nothing, is wrong");
t(check("Bilbao", ["Barcelona", "Bilbao"]).answer === "Bilbao", "any accepted answer counts, and says which it matched");
console.log(bad ? `${bad} FAILED` : "typing: every check holds");
process.exitCode = bad ? 1 : 0;
