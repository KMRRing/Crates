// Assay's words (README, Assay): one language's lexicon, English, in the shape another would take (French, German):
// its keyboard, which words it accepts as guesses, and which it keeps as answers. The engine (assay-engine.js) asks
// only for this, so it never knows which language it's playing.
//
// Answers are everyday words: the commonest three tiers of wordlist.js (SCOWL sizes 10 to 35), a spelling both
// sides of the Atlantic share, and a word in its own right rather than a form of another. A regular inflection is
// found by rule (a plural or third person -s, -es, -ies; a past -ed, -ied, with a doubled consonant; an -ing form;
// a comparative or superlative that has the other beside it; Latin and -ves, -men plurals); an irregular one, and a
// word that makes a poor answer (crude, a slur's neighbour, jargon, archaic, informal spelling), is on a list.
// Guesses: any word of the length in the widest list, so no real word is turned away.
import { wordsOf, isWord, tierOf } from "./wordlist.js";

const ANSWER_TIERS = 2;              // SCOWL sizes 10, 20 and 35
const common = w => w.length >= 3 && isWord(w, 3);

/** Why a word is a regular form of another (a short tag), or null. */
export function inflection(w) {
  if (KEEP.has(w)) return null;
  if (w.endsWith("ies") && common(w.slice(0, -3) + "y")) return "ies";
  if (w.endsWith("ves") && (common(w.slice(0, -3) + "f") || common(w.slice(0, -3) + "fe"))) return "ves";
  if (w.endsWith("men") && common(w.slice(0, -3) + "man")) return "men";
  if (w.endsWith("es") && common(w.slice(0, -2)) && /(s|x|z|ch|sh|o)$/.test(w.slice(0, -2))) return "es";
  if (w.endsWith("es") && common(w.slice(0, -2) + "is")) return "is";
  if (w.endsWith("i") && common(w.slice(0, -1) + "us")) return "i";
  if (w.endsWith("ae") && common(w.slice(0, -1))) return "ae";
  if (w.endsWith("a") && common(w.slice(0, -1) + "um")) return "um";
  if (w.endsWith("s") && !w.endsWith("ss") && isWord(w.slice(0, -1))) return "s";
  if (w.endsWith("ied") && common(w.slice(0, -3) + "y")) return "ied";
  if (w.endsWith("ed")) {
    const a = w.slice(0, -2), b = w.slice(0, -1);
    if (common(a) || (common(b) && b.endsWith("e"))) return "ed";
    if (a.length >= 4 && a.at(-1) === a.at(-2) && common(a.slice(0, -1))) return "ed";
  }
  if (w.endsWith("ing")) {
    const a = w.slice(0, -3);
    if (common(a) || common(a + "e")) return "ing";
    if (a.length >= 4 && a.at(-1) === a.at(-2) && common(a.slice(0, -1))) return "ing";
  }
  if (w.endsWith("er")) {             // a comparative, its superlative a word too (nicer, nicest)
    const a = w.slice(0, -2), b = w.slice(0, -1);
    if ((common(a) && common(a + "est")) || (common(b) && common(b + "st")) || common(a.replace(/i$/, "") + "iest")) return "er";
  }
  if (w.endsWith("est")) {
    const a = w.slice(0, -3);
    if ((common(a) || common(a + "e") || common(a.replace(/i$/, "y"))) && (common(a + "er") || common(a + "r"))) return "est";
  }
  return null;
}

// Words the rules take for forms that aren't (seed is not see+d, thing is not th+ing, a diver is no comparative, a
// genus no plural), and nouns that are only ever plural
const KEEP = new Set(`seed feed weed shed tweed need heed reed deed bleed breed creed greed speed steed thing icing
  diver liver elder deter infer water after never under other cover tower lover liner forest honest modest earnest
  harvest interest morning evening ceiling wedding pudding news odds alas genus species phonics jeans kudos mumps
  dregs annals pliers arrears jitters`.split(/\s+/));

// Irregular forms (pasts, participles, plurals), and words that make poor answers: crude or a slur's neighbour, jargon,
// archaic, informal spellings, a name in lower case. A guess may still be any of them.
const DROP = new Set(`
  bade been bled blew bred came drew feet fled flew gave goes grew hove hung knew lain lent lice mice rang rode sank
  seen slid sped spun sung swam swum told took trod went wept were woke wore wove noes bani mads yous sames rares vasts
  arose awoke began begun borne chose clung crept dealt drank dwelt eaten feted flown flung froze geese knelt meant
  pence redid shone shown slept slung slunk smote stood stunk swore swung threw undid upped vying woken wrote wrung
  bought taught caught fought sought forgot gotten arisen sprang sprung shrank shrunk strove strode strewn beheld befell
  upheld outran outdid remade redone relaid repaid misled thrown shaken bitten ridden beaten brought forgave forbade
  mistook rewrote overate outgrew foresaw forsook partook overran oversaw overdid forbore forgone outdone striven
  trodden rebuilt mislaid outlaid waylaid women monies orgies fezzes genera beeves deaves indices colones termini
  cums crap damn hell slag suck puke poop teat lewd nude dope puss hick goon snot dung piss turd tits boob butt arse
  sluts smuts rapes raped sexes sexed sperm enema urine nuder queer gayer lamer bigot moron idiot slave lynch booby
  booty butts asses psych homey mamma nappy sissy ninny pansy dicky spunk dopey chink vomit cocked cocking sexism
  bummer
  condom bugger racism racist sexist sexual sexing heroin virgin anuses whores harlot retard rectal testes testis
  uterus molest sadism sadist fetish herpes hernia nudity carnal pantie crotch cretin nitwit midget ghetto bloody
  faggots rapists penises pussies pussier rectums vaginae vaginal jackass bitched pervert genital lesbian asexual
  obscene suicide urinate buttock fascist fascism cocaine anthrax cyanide hornier moronic idiotic bigotry satanic
  heathen infidel gentile mongrel cripple knacker lunatic
  thee thou unto ergo geld mien mete lath lade wist wive weer gent mike mama papa spay ovum cant wont char byte baud
  info data sine buss putt nigh gosh
  gonna wanna kinda sorta dunno lemme gimme betcha newbie loonie
  multi octal infix dimer fiche halon haler sizer edger unset pends unsay unman letup sunup datum roman maria peter
  french august python tripos physic ashcan spigot pended impend parser linker loader router raster planar scalar
  parsec lambda bitmap termly rummer bootee babier upping pickax
  therein thereof thereon wherein insofar whence thence hither sporran simplex operand tensors wingers rummest
  wannest zincked bummest babiest
  humaner chiefer choicer chaster fickler impurer insaner loyaler maturer minuter obtuser opaquer remoter securer
  sedater serener severer solider stabler suppler uniquer untruer unwiser urbaner vivider acrider astuter demurer
  eagerer exacter
`.trim().split(/\s+/));

const pools = new Map();
/**
 * The answers of a length, alphabetical: [{ w, tier }] (tier 0 the commonest). The same array each time: don't change it.
 */
function answers(len) {
  if (!pools.has(len)) {
    pools.set(len, Object.freeze(wordsOf(len, ANSWER_TIERS, { variants: false })
      .filter(w => !DROP.has(w) && !inflection(w))
      .map(w => Object.freeze({ w, tier: tierOf(w) }))));
  }
  return pools.get(len);
}

/** English: the keyboard, what may be guessed and what may be the answer. */
export const ENGLISH = Object.freeze({
  id: "en",
  name: "English",
  lengths: [4, 5, 6, 7],
  rows: ["qwertyuiop", "asdfghjkl", "zxcvbnm"],
  /** A typed character as a letter of this alphabet, or "" (a game keeps letters lower case). */
  letter: ch => (/^[a-z]$/i.test(ch) ? ch.toLowerCase() : ""),
  accepts: w => isWord(w),
  answers,
});
export const LEXICONS = { en: ENGLISH };
