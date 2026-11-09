// No game says anyone drinks (4 November 2026, Korbi: "remove the drinking references across the games (PG), just say
// 'loses' or 'loses a life'"): a loss is a loss, a life, a point or a chip. Scans every page, script and stylesheet
// (comments left out) for drink / sip / chug / cheers and the like. Subject matter is not a penalty and stays: the
// banks, word lists and the Wine course (what people drink is what they learn about), the lists below.
import fs from "fs";

const root = new URL("..", import.meta.url).pathname;

// whole files that are subject matter: knowledge banks and word lists, the Wine course, the clue and definition data,
// the language courses (they teach "I drink tea"), a bill-splitting sum, the kinds of a thing
const SUBJECT = /(-bank|-data|-words|-pool|-labels|-regions|-service|-subjects|-layout|-themes)\.js$|^(clues-data|slate-defs|kb-index|wine-bank|chart-geo|pics-list)\.js$/;
// lines that are not a drink being taken: a topic's name, a lesson's saved id (renaming it would reset a player's progress)
const LINE_OK = [/food (and|&amp;|&) drink/i, /\bid: "drink"/, /\bkind: "drink"|\bdrink: "food"/];

const BANNED = /\b(drinks?|drinking|drank|drunk(en)?|sips?|sipping|sipped|chugs?|chugging|tipsy|bottoms up|swigs?|booze|boozy|cheers|grog)\b/i;

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const files = fs.readdirSync(root).filter(f => /\.(js|html|css)$/.test(f) && f !== "sw.js" && !SUBJECT.test(f));
const found = [];
for (const f of files) {
  const text = fs.readFileSync(root + f, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))       // block comments (keep the lines)
    .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\w])\/\/.*$/gm, "$1");                           // line comments, but not a URL's //
  text.split("\n").forEach((line, i) => {
    if (BANNED.test(line) && !LINE_OK.some(re => re.test(line))) found.push(`${f}:${i + 1}: ${line.trim().slice(0, 110)}`);
  });
}
for (const hit of found.slice(0, 30)) check(false, `says someone drinks (say "loses", "loses a life"): ${hit}`);
check(files.length > 100, `${files.length} pages and scripts scanned`);
check(found.length === 0, "no game or party game mentions drinking as a penalty");
process.exit(bad ? 1 : 0);
