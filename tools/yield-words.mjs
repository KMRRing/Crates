// Writes yield-words.js, the words Yield counts (README, Yield), from wordlist.js (SCOWL) and wordfreq's English word
// frequencies. A Claude runs it, not Korbi:
//   pip download wordfreq==3.1.1 --no-deps -d <dir>   (then unzip the wheel there)
//   node tools/yield-words.mjs <dir>/wordfreq/data/large_en.msgpack.gz
// A word counts when it's ordinary English that everyone spells the same way: SCOWL's commoner lists (sizes 10 to 40,
// tiers 0 to 3) and used often enough in its own form (SCOWL files every inflection under its base word, so "gonging"
// and "tenanting" come with "gong" and "tenant": a Zipf frequency of 2, once in ten million words, is the line, 1.5
// for the commonest lists); or SCOWL's sizes 50 and 55 at a Zipf of 3 or more, once in a million (the ordinary modern words SCOWL
// files as rare: online, timeline, texting), less the names, brands, slang and archaisms their frequency flatters. Never:
// a spelling only one side of the Atlantic uses, an s anywhere (Yield's letters never include S, as Spelling Bee's
// don't), or a word on BLOCKED, the slurs, vulgarities and crude words a game played with friends shouldn't count.
import fs from "node:fs";
import zlib from "node:zlib";
import { wordsOf, tierOf, isVariant } from "../wordlist.js";

const src = process.argv[2];
if (!src) { console.error("usage: node tools/yield-words.mjs <wordfreq's large_en.msgpack.gz>"); process.exit(1); }

// ---------- wordfreq's file: gzip of msgpack, a header, then one list of words per centibel of frequency ----------
function readFreqs(file) {
  const data = zlib.gunzipSync(fs.readFileSync(file));
  let pos = 0;
  const str = n => { const s = data.toString("utf8", pos, pos + n); pos += n; return s; };
  const read = () => {
    const b = data[pos++];
    if (b <= 0x7f) return b;
    if (b >= 0x80 && b <= 0x8f) { const o = {}; for (let i = 0; i < (b & 15); i++) o[read()] = read(); return o; }
    if (b >= 0x90 && b <= 0x9f) return Array.from({ length: b & 15 }, read);
    if (b >= 0xa0 && b <= 0xbf) return str(b & 31);
    if (b === 0xd9) return str(data[pos++]);
    if (b === 0xda) { const n = data.readUInt16BE(pos); pos += 2; return str(n); }
    if (b === 0xdc) { const n = data.readUInt16BE(pos); pos += 2; return Array.from({ length: n }, read); }
    if (b === 0xdd) { const n = data.readUInt32BE(pos); pos += 4; return Array.from({ length: n }, read); }
    if (b === 0xcc) return data[pos++];
    if (b === 0xcd) { const v = data.readUInt16BE(pos); pos += 2; return v; }
    if (b === 0xc0) return null;
    throw new Error(`msgpack byte ${b.toString(16)} at ${pos - 1}`);
  };
  const [, ...buckets] = read();
  const zipf = new Map();
  buckets.forEach((words, i) => { for (const w of words) if (/^[a-z]+$/.test(w) && !zipf.has(w)) zipf.set(w, 9 - i / 100); });
  return zipf;
}
const ZIPF = readFreqs(src), zipf = w => ZIPF.get(w) ?? 0;

// SCOWL 50 and 55 words whose frequency is a name's, a brand's or slang's, or an archaism's or an interjection's
const NOT_COMMON = new Set(`ahem berg bong brad dang dell dirk dory doth dyer fave fink gaga giro glam gran hank hath hiya joey khan loco
  lube lulu mick noel phew poly pong pooh rand rhea rick thru tony troy viva yang billy bobby brill butch fella footy gator hogan hubby japan
  jihad jimmy marge mater outta randy roger terry thine twain wally wight willy xerox yahoo afghan amazon bailey barbie barker barney
  batman bowman canton carter dammit douche draper google gotcha hector hookup hoover johnny mickey morrow oxford panama phoebe thingy
  tucker bitcoin charlie clement colleen corolla erotica freeman googled magneto mahatma morocco pollard riviera wheeler angelica
  chandler dickhead googling nickelodeon motherfucking`.split(/\s+/));
// never counted, and not called a word when typed
const BLOCKED = new Set(`crap crappy crapped crapping crapper goddamn goddamned damn dyke fart farted farting farter pimp pimped
  pimping poop pooped pooping puke puked puking turd peed peeing bimbo booby chink raped raping rapist erection grope groped groping lynch
  lynched lynching lyncher moron moronic cretin cretinous imbecile imbecilic retard retarded retardation midget cripple crippled loony
  hillbilly redneck gringo mulatto hooker junkie pervert perverted perverting bitchy bitched bitching bitchier bugger buggered
  buggering buggery condom douche fucked fucker fucking motherfucking dickhead ejaculate ejaculated ejaculating ejaculation
  nymphomaniac nympho pornographer pornographic porno porn pubic vaginal vagina queer queerer niggle niggled niggling niggard
  niggardly gyp gypped gypping gypsy gipsy spastic spaz negro negroid coolie pikey chav honky darkie kaffir wetback beaner tranny
  shemale ladyboy slut slutty whore skank floozy hussy copulate copulated copulating copulation mooning boner booty nookie orgy titty
  bonk bonked bonking humping hermaphrodite fondle fondled fondling harlot gayer wiener wanna gonna gotta kinda sorta dunno lemme
  gimme coulda woulda shoulda oughta betcha yeah yeh nope`.split(/\s+/));

function counted(w) {
  if (w.length < 4 || w.includes("s") || isVariant(w) || BLOCKED.has(w)) return false;
  const t = tierOf(w), f = zipf(w);
  if (t < 0) return false;
  if (t <= 1) return f >= 1.5;
  if (t <= 3) return f >= 2.0;
  if (t <= 5) return f >= 3.0 && !NOT_COMMON.has(w);
  return false;
}

// how common each word is, to a tenth of a Zipf, one character of BAND a word (1.5 and under the first, 7.6 and over the last)
const BAND = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const band = w => BAND[Math.max(0, Math.min(BAND.length - 1, Math.round(zipf(w) * 10) - 15))];
const WORDS = {};
let total = 0;
for (let n = 4; n <= 15; n++) {
  const list = wordsOf(n, 5).filter(counted);
  total += list.length;
  WORDS[n] = [list.join(""), list.map(band).join("")];
}
const blocked = [...BLOCKED].filter(w => !w.includes("s")).sort().join(" ");
const FILE = new URL("../yield-words.js", import.meta.url);
const write = days => fs.writeFileSync(FILE, `// The words Yield counts (README, Yield), written by tools/yield-words.mjs from wordlist.js and wordfreq; don't edit,
// rebuild. For each length: its words run together in alphabetical order, then one character per word for how often
// it's used, its Zipf frequency to a tenth (the base-10 logarithm of its uses in a billion words; BAND's first character
// is 1.5 or less). BLOCKED: words wordlist.js has that Yield neither counts nor calls a word when they're typed. DAYS:
// the letter sets today's puzzle walks through, seven letters each, every set that can make a Medium hive, shuffled.
//
// Frequencies: wordfreq 3.1.1 by Robyn Speer (https://github.com/rspeer/wordfreq), whose data is licensed CC BY-SA 4.0
// (https://creativecommons.org/licenses/by-sa/4.0/); these bands are derived from it and shared under the same licence.
// wordfreq draws on SUBTLEX (Marc Brysbaert et al., freely available at http://crr.ugent.be/programs-data/subtitle-frequencies),
// OpenSubtitles 2018 (http://www.opensubtitles.org/), Google Books Ngrams (http://books.google.com/ngrams), the Leeds
// Internet Corpus, Wikipedia, ParaCrawl, and Twitter and Reddit. The words themselves are SCOWL's (wordlist-data.js).
export const BAND = ${JSON.stringify(BAND)};
export const WORDS = ${JSON.stringify(WORDS)};
export const BLOCKED = ${JSON.stringify(blocked)};
export const DAYS = ${JSON.stringify(days)};
`);
// the words first, then the days, which the engine works out from them (it reads the file just written)
write("");
const { hiveSets, makesDaily, rng, FIRST_DAY } = await import("../yield-engine.js");
const sets = hiveSets().filter(makesDaily), r = rng(FIRST_DAY);
for (let i = sets.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [sets[i], sets[j]] = [sets[j], sets[i]]; }
write(sets.join(""));
console.log(`yield-words.js: ${total} words, ${sets.length} letter sets for the dailies, ${(fs.statSync(FILE).size / 1024).toFixed(0)} KB`);
