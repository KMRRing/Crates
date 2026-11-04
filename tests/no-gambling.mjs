// Punt doesn't talk like a betting game (4 November 2026, Korbi: "remove gambling references from punt, keep the
// gameplay the same"): you commit a share of your purse of marks to an answer; a right answer doubles it, a wrong one
// forfeits it; you hold instead of passing, put in everything instead of going all in, and are broke instead of bust.
// Scans what Punt's players read (page text, labels, strings; no comments, no code) for the old words. Saved keys,
// state fields and element ids keep their names (`stake`, `pot`, `bets`, `betBtn`): they are not shown. The casino
// games (Baccarat, Blackjack and the rest of the Appendix) are separate and out of scope.
import fs from "fs";

const root = new URL("..", import.meta.url).pathname;
const FILES = ["punt.html", "punt.js", "punt-gen.js", "punt-table.js"];

const BANNED = /\b(bets?|betting|bettors?|stakes?|staked|staking|pots?|all[- ]in|bust|busted|chips?|odds|wagers?|gambl\w*|casino|jackpot|bankroll|punters?|pays?|passe[sd]?|pass)\b/i;
// strings that are names, not words shown: element ids, class names, saved phases and fields, the pile's reason "pass"
const INTERNAL = /^(pass|bet|bets|stake|pot|pots|chips|betting|slip|passBtn|betBtn|pt-[\w-]*|[#.][\w-]+)$/;
// subject matter in a bank's blurb (ski passes)
const SUBJECT = /passes and food/;

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };

const noComments = t => t
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, " "))
  .replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, " "))
  .replace(/(^|[^:"'`\w\\])\/\/.*$/gm, "$1");

// the words a player reads: an HTML page's text and label attributes; a script's string literals (a template's ${…}
// is code, not text)
function shown(file, text) {
  const out = [];
  if (file.endsWith(".html")) {
    text.replace(/<(script|style)[\s\S]*?<\/\1>/g, m => m.replace(/[^\n]/g, " ")).split("\n").forEach((line, i) => {
      const words = [...line.matchAll(/>([^<>]+)</g)].map(m => m[1]);
      for (const m of line.matchAll(/\b(aria-label|placeholder|title|alt)="([^"]*)"/g)) words.push(m[2]);
      out.push(...words.filter(w => w.trim()).map(w => [i + 1, w]));
    });
    return out;
  }
  text.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
      const s = (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, " ");
      if (!INTERNAL.test(s.trim())) out.push([i + 1, s]);
    }
  });
  return out;
}

const found = [];
for (const f of FILES) {
  const text = noComments(fs.readFileSync(root + f, "utf8"));
  for (const [n, s] of shown(f, text)) if (BANNED.test(s) && !SUBJECT.test(s)) found.push(`${f}:${n}: ${s.trim().slice(0, 110)}`);
}
for (const hit of found.slice(0, 30)) check(false, `Punt says it like a bet (commit, hold, purse, marks, broke): ${hit}`);
check(found.length === 0, "Punt's pages and scripts keep to the merchant's wording");
process.exit(bad ? 1 : 0);
