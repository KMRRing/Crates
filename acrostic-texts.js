// The hidden texts (README, Classics: Acrostic): the knowledge base's own words, read from kb/ as Origin and Arb read
// it, never edited here. Each entry is a thing whose words can be hidden, in the forms they may take (a note in full or
// cut where a reader pauses; a saying with or without its origin), each form with what its answers' first letters may
// spell (the spine, most telling first), and what the reveal says once it's solved.
//
//   lit     a line from literature (Punt's literature: works before 1929), in English (a translation's own words for
//           the rest); the first letters spell its author and work, or what of them fits
//   saying  a saying (Punt's sayings, without the pop culture), in English: what it says word for word and what it
//           means; the first letters spell the saying itself in its own language, or the language
//   place   a place's note (Chart's, Origin's): the first letters spell its name, or its name and country
//   art     a painting's note: the first letters spell the painting, or its painter
//   term    a word of architecture or watchmaking, defined without naming itself (the knowledge base's own rule): the
//           first letters spell the word
import { ENTITIES } from "./kb/entities.js";
import { LINKS } from "./kb/links.js";
import { fold, lettersOf } from "./acrostic-engine.js";

export { SOURCES } from "./acrostic-engine.js";
const LANG = { la: "Latin", de: "German", fr: "French", en: "English", it: "Italian", es: "Spanish", pt: "Portuguese", zh: "Chinese",
  ja: "Japanese", da: "Danish", sv: "Swedish", nl: "Dutch", ru: "Russian", sw: "Swahili", ar: "Arabic", no: "Norwegian", ko: "Korean",
  grc: "Greek", el: "Greek", pl: "Polish", sa: "Sanskrit" };
// the sets of a thing with a place on the map, whose note says where and what it is
const PLACE_SET = /^(city|trade-place|geo-place|feature|museum|building|wine-place|ski-resort|art-fair|distillery|[a-z-]+-place)$/;
// family names that come first (Sun Tzu, Cao Xueqin): the whole name is the author's spine
const NAME_FIRST = /^(Lao|Sun|Cao|Lu|Li|Du|Bai|Su|Wu|Meng|Han|Zhuang|Matsuo|Murasaki)\b/;

const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
const end = s => (/[.!?…]$/.test(s) ? s : `${s}.`);
const bare = s => String(s || "").replace(/^(the|a|an) /i, "");
const spine = (text, label) => ({ text, label });

/**
 * A note as it may be hidden: whole, or cut where a reader pauses: a sentence's end, a semicolon or a colon, or a comma
 * in a sentence's first clause (after a colon a comma ends a fragment: "…south of Shanghai: crude"), never inside
 * brackets, and only once enough has been said to stand alone.
 */
function cuts(text) {
  const out = [text], re = /[.;:!?](?=\s)|,(?=\s)/g;
  let m, clause = true, depth = 0, last = 0;
  while ((m = re.exec(text))) {
    for (const ch of text.slice(last, m.index)) depth += ch === "(" ? 1 : ch === ")" ? -1 : 0;
    last = m.index;
    const head = text.slice(0, m.index).trim(), comma = m[0] === ",";
    if (!depth && (!comma || clause) && lettersOf(head).length >= 28 && head.length < text.length - 3) out.push(head);
    if (/[;:]/.test(m[0])) clause = false;
    if (/[.!?]/.test(m[0])) clause = true;
  }
  return [...new Set(out)];
}
const wordSet = text => new Set(fold(text).toUpperCase().split(/[^A-Z]+/));
/** Whether a text gives its spine away: every word of the spine that matters (four letters or more) is in it. */
export function tells(text, spineText, words = wordSet(text)) {
  const sig = fold(spineText).toUpperCase().split(/[^A-Z]+/).filter(w => w.length >= 4);
  return sig.length > 0 && sig.every(w => words.has(w));
}

let built = null;
/**
 * Every entry, built once: [{ id, source, stage, famous, forms: [{ text, spines: [{ text, label }] }], about: { title,
 * by, lines } }]. famous: a line most people know (the knowledge base's own mark), which a solver recognises sooner.
 */
export function entries() {
  if (built) return built;
  const byId = new Map(ENTITIES.map(e => [e.id, e]));
  const out = new Map();
  for (const l of LINKS) { if (!out.has(l.from)) out.set(l.from, []); out.get(l.from).push(l); }
  const rel = (id, r) => byId.get((out.get(id) || []).find(l => l.rel === r)?.to) || null;
  const list = [];
  const add = (e, source, stage, forms, about) => {
    const ok = forms.map(f => { const words = wordSet(f.text); return { text: f.text, spines: f.spines.filter(s => s.text && lettersOf(s.text).length >= 3 && !tells(f.text, s.text, words)) }; })
      .filter(f => f.text && f.spines.length);
    if (ok.length) list.push({ id: e.id, source, stage, famous: e.iconic === true || e.d === 1, forms: ok, about });
  };
  for (const e of ENTITIES) {
    const sets = e.sets || [];
    if (sets.includes("quotation")) {
      const work = rel(e.id, "in-work"), author = work && rel(work.id, "written-by");
      if (!work) continue;
      const surname = author ? (NAME_FIRST.test(author.name) ? author.name : author.name.split(" ").pop()) : "";
      const spines = [
        ...(author ? [spine(`${surname} ${work.name}`, "its author and work")] : []),
        spine(work.name, "the work"),
        ...(bare(work.name) !== work.name ? [spine(bare(work.name), "the work")] : []),
        ...(author ? [spine(surname, "its author"), ...(surname !== author.name ? [spine(author.name, "its author")] : [])] : []),
      ];
      const said = e.who && !/^its /.test(e.who) && !/^(Meditation|Maxims)/.test(e.who) ? `Said by ${e.who}.` : e.who ? `${cap(e.who)}.` : null;
      add(e, "lit", e.stage, [{ text: e.rendering || e.text, spines }], {
        title: e.rendering || e.text,
        by: [author?.name, `${work.name}${work.year ? ` (${work.year})` : ""}`].filter(Boolean).join(", "),
        lines: [said, e.rendering ? `In the original: ${e.text}` : null, e.note || null].filter(Boolean),
      });
    } else if (sets.includes("saying") && e.stage !== "pop") {
      const lang = LANG[String(e.lang || "").split("-")[0]] || null;
      const zh = e.lang === "zh", origin = zh ? (e.origin || "").split(":").slice(1).join(":").trim() : (e.origin || "");
      const pinyin = zh ? (e.origin || "").split(":")[0].trim() : null;
      const literal = e.literal && e.literal !== e.meaning ? e.literal : (e.rendering || "");
      const say = (head, from) => [end(head), from ? end(cap(from)) : ""].filter(Boolean).join(" ");
      let forms;
      if (e.lang === "en") {
        // an English saying is hidden with what it means: the first letters say where it comes from
        const where = e.stage === "trading" ? [spine("Trading floor", "where it's said"), spine("The trading floor", "where it's said")] : [spine("English idiom", "what it is"), spine("English saying", "what it is")];
        forms = [{ text: say(`${e.text}: ${e.meaning}`, origin), spines: where }, { text: say(`${e.text}: ${e.meaning}`, ""), spines: where }];
      } else {
        const own = pinyin || (/[A-Za-z]/.test(fold(e.text)) ? e.text : null);
        const named = [...(own ? [spine(own, lang ? `the saying, in ${lang}` : "the saying")] : []), ...(lang ? [spine(`${lang} saying`, "where it's from"), spine(lang, "its language")] : [])];
        const gloss = literal ? `${cap(literal)}: ${e.meaning}` : cap(e.meaning);
        forms = [
          { text: say(gloss, origin), spines: named }, { text: say(gloss, ""), spines: named }, { text: say(cap(e.meaning), origin), spines: named },
          // the saying itself in the text, its language down the first letters
          ...(own && lang ? [{ text: say(`${own}: ${gloss}`, origin), spines: named.slice(1) }, { text: say(`${own}: ${gloss}`, ""), spines: named.slice(1) }] : []),
        ];
      }
      add(e, "saying", e.stage, forms, {
        title: e.text, by: [lang, pinyin].filter(Boolean).join(", "),
        lines: [literal ? `Word for word: ${literal}.` : null, `It means ${end(e.meaning)}`, origin ? end(cap(origin)) : null].filter(Boolean),
      });
    } else if (e.note && sets.includes("painting")) {
      const painter = rel(e.id, "painted-by"), museum = rel(e.id, "hangs-in");
      const surname = painter ? painter.name.split(" ").pop() : "";
      const spines = [
        spine(e.name, "the painting"), ...(bare(e.name) !== e.name ? [spine(bare(e.name), "the painting")] : []),
        ...(painter ? [spine(`${surname} ${bare(e.name)}`, "its painter and the painting"), spine(painter.name, "its painter"), spine(surname, "its painter")] : []),
      ];
      add(e, "art", null, cuts(e.note).map(text => ({ text, spines })),
        { title: e.name, by: [painter?.name, e.year ? `${e.circa ? "c. " : ""}${e.year}` : null, museum?.name].filter(Boolean).join(", "), lines: [e.note] });
    } else if (e.note && !sets.includes("quotation") && !sets.includes("saying") && sets.some(s => PLACE_SET.test(s))) {
      const country = e.country && byId.get(e.country), where = country ? country.name.replace(/^the /i, "") : null;
      const spines = [
        spine(e.name, "the place"), ...(bare(e.name) !== e.name ? [spine(bare(e.name), "the place")] : []),
        ...(where && !lettersOf(e.name).includes(lettersOf(where)) ? [spine(`${bare(e.name)} ${where}`, "the place and its country")] : []),
      ];
      add(e, "place", null, cuts(e.note).map(text => ({ text, spines })), { title: e.name, by: where || "", lines: [e.note] });
    } else if (e.def || e.does || e.desc) {
      const text = end(cap(e.def || e.does || e.desc));
      add(e, "term", null, [{ text, spines: [spine(bare(e.name), "the word"), ...(bare(e.name) !== e.name ? [spine(e.name, "the word")] : [])] }],
        { title: e.name, by: sets.includes("architecture-term") ? "Architecture" : "Watchmaking", lines: [text] });
    }
  }
  built = list;
  return list;
}
