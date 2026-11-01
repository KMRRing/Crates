// Slate's lives and the rules in play (README, Slate): a board has a few lives and a list of the rules in play, one of
// which each field has; a word that puts up a failing mark the board didn't show costs a life (however many marks, and
// one that stays up costs nothing again); the list narrows by what the fields have passed and failed, each rule being
// one field's at most, and colours the keys by what every rule a field could be agrees on. Run: node tests/slate-lives.mjs
import { generate, LEVELS, BASE_RULES, ruleById, shortOf, gridOf, rowsOf, VALID, replay, livesOf, candidates, dealsOf, keyVerdicts, keyVerdictsAmong, lettersFrom, fieldsOf, rng32 } from "../slate-gen.js";

let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const ALPHABET = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

// ---------- every board has lives and a legend ----------
let boards = 0, holds = 0, sized = 0, ordered = 0, named = 0, lives = 0;
const KW = id => id.startsWith("kw:");
for (const level of Object.keys(LEVELS)) {
  for (let n = 1; n <= 40; n++) {
    const board = generate(n * 6007 + level.length, level);
    boards++;
    const ids = board.legend, fs = fieldsOf(board);
    if (board.fields.every(f => ids.includes(f.rule)) && new Set(ids).size === ids.length) holds++;
    // per type: the fields' rules and (up to) the level's decoys, no more
    const per = type => ids.map(ruleById).filter(r => r.type === type).length, fields = type => fs.filter(f => f.rule.type === type).length;
    if (["single", "pair", "whole"].every(t => per(t) >= fields(t) && per(t) <= fields(t) + LEVELS[level].decoys + (t === "single" ? 0 : 0))) sized++;
    // the catalogue's order, which says nothing of which are the fields'
    const at = id => (KW(id) ? 99 : BASE_RULES.findIndex(r => r.id === id));
    if (ids.every((id, i) => !i || at(ids[i - 1]) <= at(id))) ordered++;
    if (ids.every(id => { const s = shortOf(ruleById(id)); return typeof s === "string" && s.length >= 3 && s.length <= 22; })) named++;
    if (board.lives === LEVELS[level].lives && board.lives >= 4 && board.lives <= 8) lives++;
  }
}
check(holds === boards, `every field's rule is in its board's legend, once each (${holds}/${boards} boards)`);
check(sized === boards, `a legend has each type's field rules and at most the level's decoys besides (${sized}/${boards})`);
check(ordered === boards, `a legend is in the catalogue's order, not the fields' (${ordered}/${boards})`);
check(named === boards, `every rule in a legend has a short name (${named}/${boards})`);
check(lives === boards, `every board carries its level's lives (${lives}/${boards})`);
check(BASE_RULES.every(r => typeof shortOf(r) === "string" && shortOf(r).length <= 18), "every catalogue rule has a short name of at most 18 letters");
check(Object.keys(LEVELS).every(l => LEVELS[l].lives > LEVELS[l === "easy" ? "easy" : l].decoys), "a level has more lives than decoys");
// the same seed deals the same board: the legend is part of it
check(JSON.stringify(generate(4242, "hard")) === JSON.stringify(generate(4242, "hard")), "a seed deals the same board, legend and lives included");

// ---------- what costs a life ----------
const board = generate(777, "medium"), grid = gridOf(rowsOf(board));
const cells = s => s.cells.map(k => board.sol[k]).join("");
const fill = grid.slots.map(s => ({ slot: s.id, word: cells(s) }));
check(livesOf(board, fill).lost === 0 && livesOf(board, fill).left === board.lives, "laying our fill word by word costs nothing");
check(livesOf({ ...board, lives: undefined }, [{ slot: 0, word: "ZZZZZ" }]).total === 0, "a board dealt without lives has none to lose");

/** A real word for a slot that, laid first on an empty board, puts up a failing mark; `marks` fields it fails at least. */
function failing(b, slot, atLeast = 1) {
  for (const w of VALID) {
    if (w.length !== slot.cells.length) continue;
    const r = replay(b, [{ slot: slot.id, word: w }]);
    if (r.lost.length && r.lost[0].fields.length >= atLeast) return { slot: slot.id, word: w, fields: r.lost[0].fields };
  }
  return null;
}
let bad1 = null, two = null;
for (const s of grid.slots) { bad1 ||= failing(board, s); two ||= failing(board, s, 2); }
check(!!bad1, "some real word costs a life on this board");
const one = replay(board, [bad1]);
check(one.lost.length === 1 && one.lost[0].n === 0 && one.lost[0].fields.length >= 1, `a word that fails costs one life, naming the field it failed (${JSON.stringify(one.lost)})`);
if (two) check(replay(board, [two]).lost.length === 1 && replay(board, [two]).lost[0].fields.length >= 2, "a word failing two fields still costs one life");
// a mark that stays up costs nothing more: lay a word elsewhere that keeps clear of it
const later = grid.slots.filter(s => !s.cells.some(k => grid.slots[bad1.slot].cells.includes(k)));
const cleanAfter = later.length ? { slot: later[0].id, word: cells(later[0]) } : null;
if (cleanAfter) check(replay(board, [bad1, cleanAfter]).lost.length === 1, "a failing mark that stays up costs nothing again when another word is laid");
check(replay(board, [bad1, { clear: grid.slots[bad1.slot].cells }, bad1]).lost.length === 2, "clearing it and laying it again costs again");
check(replay(board, [{ draft: { [grid.slots[0].cells[0]]: "Q" } }]).lost.length === 0, "letters that aren't in a real word are a frame, judged and charged for nothing");
check(replay(board, [bad1, { check: { v: 2, out: {} } }, { reveal: 0 }]).lost.length === 1, "a check or a rule revealed costs nothing");
check(livesOf(board, Array.from({ length: board.lives }, (_, i) => ({ clear: [] }))).lost === 0, "empty clears cost nothing");

// ---------- the legend narrows ----------
const fake = {
  rows: ["...", "..."], legend: ["vowel", "consonant", "firstHalf", "asc", "mixed"],
  fields: [{ rule: "vowel", cells: ["0,0", "0,1"] }, { rule: "consonant", cells: ["1,0", "1,1"] }, { rule: "asc", cells: ["0,2", "1,2"] }], lives: 5,
};
const none = () => ({ ok: new Set(), no: new Set() });
let notes = [none(), none(), none()];
const ids = c => c.map(x => x.map(r => r.id).join("+"));
check(JSON.stringify(ids(candidates(fake, notes))) === JSON.stringify(["vowel+consonant+firstHalf", "vowel+consonant+firstHalf", "asc+mixed"]), "with nothing known, a field could be any rule of its type in the legend");
notes = [{ ok: new Set(["A"]), no: new Set(["B"]) }, none(), none()];
check(JSON.stringify(ids(candidates(fake, notes))) === JSON.stringify(["vowel", "consonant+firstHalf", "asc+mixed"]), "a field that took A and rejected B is the vowels, and no other field has them");
notes = [{ ok: new Set(["A"]), no: new Set(["B"]) }, { ok: new Set(["B"]), no: new Set(["E"]) }, none()];
check(JSON.stringify(ids(candidates(fake, notes))) === JSON.stringify(["vowel", "consonant", "asc+mixed"]), "B passed and E failed: the consonants (E, in the first half, would have passed A to M)");
notes = [none(), none(), { ok: new Set(["A→B"]), no: new Set(["B→A"]) }];
check(JSON.stringify(ids(candidates(fake, notes))) === JSON.stringify(["vowel+consonant+firstHalf", "vowel+consonant+firstHalf", "asc"]), "a pair field that took A→B and failed B→A is the climbing pairs");
check(JSON.stringify(ids(candidates(fake, [none(), none(), none()], new Set([0])))) === JSON.stringify(["vowel", "consonant+firstHalf", "asc+mixed"]), "a rule revealed is that field's, and the others lose it");
// two fields that could each be only the same rule: no deal, so the lists are empty rather than wrong
const dealt = dealsOf(fake, [{ ok: new Set(["A"]), no: new Set() }, { ok: new Set(["A"]), no: new Set(["B"]) }, none()]);
check(dealt[0].deals.length === 1 && dealt[0].deals[0].join() === "firstHalf,vowel", "a field that must have the vowels leaves the other the first half: deals are whole, each rule one field's");
check(candidates({ fields: fake.fields, rows: fake.rows }, notes) === null, "a board without a legend has no list");

// ---------- the invariant, over played boards ----------
let played = 0, kept = 0, agreed = 0;
for (const level of Object.keys(LEVELS)) {
  for (let n = 1; n <= 12; n++) {
    const b = generate(n * 911 + level.length, level), g = gridOf(rowsOf(b)), r = rng32(n * 13 + level.length), log = [];
    for (let m = 0; m < 14; m++) {
      const s = g.slots[Math.floor(r() * g.slots.length)], have = lettersFrom(b, log);
      const fit = [...VALID].filter(w => w.length === s.cells.length && s.cells.every((k, i) => !have[k] || have[k] === w[i]));
      if (!fit.length) continue;
      log.push({ slot: s.id, word: fit[Math.floor(r() * fit.length)] });
      if (r() < .2) log.push({ reveal: Math.floor(r() * b.fields.length) });
    }
    const shown = new Set(log.filter(e => e.reveal != null).map(e => e.reveal)), notes2 = replay(b, log).notes, c = candidates(b, notes2, shown);
    played++;
    if (b.fields.every((f, i) => c[i].some(x => x.id === f.rule))) kept++;
    // and no rule the notes contradict is offered
    const agree = (rule, note) => { const t = s => (rule.type === "single" ? rule.test(s) : rule.type === "pair" ? rule.test(...s.split("→")) : rule.test([...s])); return [...note.ok].every(t) && ![...note.no].some(t); };
    if (c.every((list, i) => list.every(x => shown.has(i) || agree(x, notes2[i])))) agreed++;
  }
}
check(kept === played, `after random play and reveals, each field's own rule is always among its candidates (${kept}/${played} boards)`);
check(agreed === played, `no candidate disagrees with what its field has passed or failed (${agreed}/${played})`);

// ---------- the keys ----------
const field = { rule: ruleById("vowel"), cells: ["0,0", "0,1"] };
const keys = f => f && { green: ALPHABET.filter(c => f(c) === true).join(""), red: ALPHABET.filter(c => f(c) === false).join("") };
const amongTwo = keys(keyVerdictsAmong(field, [ruleById("vowel"), ruleById("firstHalf")], none(), {}, "0,0"));
check(amongTwo.green === "AEI" && amongTwo.red === "NPQRSTVWXYZ", `a letter every candidate takes is green, one every candidate rejects red, the rest plain (${JSON.stringify(amongTwo)})`);
const alone = keys(keyVerdictsAmong(field, [ruleById("vowel")], none(), {}, "0,0")), revealedKeys = keys(keyVerdicts(field, none(), {}, "0,0", true));
check(JSON.stringify(alone) === JSON.stringify(revealedKeys), "down to one rule, the keys are those of the rule revealed");
check(keyVerdictsAmong({ rule: ruleById("asc"), cells: ["0,0", "0,1"] }, [ruleById("asc"), ruleById("mixed")], none(), {}, "0,0") === null, "a pair field with no lettered neighbour colours nothing");
check(keyVerdictsAmong(field, [], none(), {}, "0,0") === null, "no candidates colour nothing");

console.log(bad ? `\n${bad} FAILED` : "\nall passed");
process.exit(bad ? 1 : 0);
