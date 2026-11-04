// Spanish verb forms from rules, for Parley's Spanish course: its grammar cards print their tables from here, so a
// table can't drift from the rules, and tests/parley.mjs checks the rules against forms known to be right (regular
// and irregular). Four tenses: present, preterite (pretérito indefinido), imperfect, present subjunctive. Persons:
// yo, tú, él/ella/usted, nosotros, vosotros (Spain; Latin America has none and uses the third plural), ellos/ustedes.
export const PERSONS = ["yo", "tú", "él / ella / usted", "nosotros", "vosotros", "ellos / ellas / ustedes"];
export const REFLEXIVE = ["me", "te", "se", "nos", "os", "se"];
export const TENSES = ["pres", "pret", "imp", "subj"];

const ER = { pres: ["o", "es", "e", "emos", "éis", "en"], pret: ["í", "iste", "ió", "imos", "isteis", "ieron"], imp: ["ía", "ías", "ía", "íamos", "íais", "ían"], subj: ["a", "as", "a", "amos", "áis", "an"] };
const END = {
  ar: { pres: ["o", "as", "a", "amos", "áis", "an"], pret: ["é", "aste", "ó", "amos", "asteis", "aron"], imp: ["aba", "abas", "aba", "ábamos", "abais", "aban"], subj: ["e", "es", "e", "emos", "éis", "en"] },
  er: ER,
  ir: { ...ER, pres: ["o", "es", "e", "imos", "ís", "en"] },
};
/** Persons whose stress falls on the stem (yo, tú, él, ellos): where a stem change shows. */
const STRONG = [0, 1, 2, 5];

/** Verbs wholly irregular in a tense: the whole row, since no rule makes it. */
const WHOLE = {
  ser: { pres: ["soy", "eres", "es", "somos", "sois", "son"], pret: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"], imp: ["era", "eras", "era", "éramos", "erais", "eran"], subj: ["sea", "seas", "sea", "seamos", "seáis", "sean"] },
  ir: { pres: ["voy", "vas", "va", "vamos", "vais", "van"], pret: ["fui", "fuiste", "fue", "fuimos", "fuisteis", "fueron"], imp: ["iba", "ibas", "iba", "íbamos", "ibais", "iban"], subj: ["vaya", "vayas", "vaya", "vayamos", "vayáis", "vayan"] },
  estar: { pres: ["estoy", "estás", "está", "estamos", "estáis", "están"], subj: ["esté", "estés", "esté", "estemos", "estéis", "estén"] },
  dar: { pres: ["doy", "das", "da", "damos", "dais", "dan"], pret: ["di", "diste", "dio", "dimos", "disteis", "dieron"], subj: ["dé", "des", "dé", "demos", "deis", "den"] },
  ver: { pres: ["veo", "ves", "ve", "vemos", "veis", "ven"], pret: ["vi", "viste", "vio", "vimos", "visteis", "vieron"], imp: ["veía", "veías", "veía", "veíamos", "veíais", "veían"], subj: ["vea", "veas", "vea", "veamos", "veáis", "vean"] },
  saber: { pres: ["sé", "sabes", "sabe", "sabemos", "sabéis", "saben"], subj: ["sepa", "sepas", "sepa", "sepamos", "sepáis", "sepan"] },
};
/**
 * The rest are rules plus a flag: alt, the stem vowel that changes (ie: querer, ue: poder, i: pedir, u>ue: jugar); go,
 * the yo form when it is irregular (the subjunctive is built on it); pret, the irregular preterite stem (a stem in -j
 * takes -eron, not -ieron); p3, an irregular third singular; hiato, leer's y; acc, enviar's accented í.
 */
const SPEC = {
  tener: { alt: "ie", go: "tengo", pret: "tuv" }, venir: { alt: "ie", go: "vengo", pret: "vin" },
  querer: { alt: "ie", pret: "quis" }, poder: { alt: "ue", pret: "pud" },
  hacer: { go: "hago", pret: "hic", p3: "hizo" }, decir: { alt: "i", go: "digo", pret: "dij" },
  poner: { go: "pongo", pret: "pus" }, salir: { go: "salgo" }, traer: { go: "traigo", pret: "traj" }, conocer: { go: "conozco" },
  estar: { pret: "estuv" }, saber: { pret: "sup" },
  dormir: { alt: "ue" }, pedir: { alt: "i" }, repetir: { alt: "i" }, vestir: { alt: "i" }, preferir: { alt: "ie" },
  empezar: { alt: "ie" }, entender: { alt: "ie" }, sentar: { alt: "ie" }, costar: { alt: "ue" }, acostar: { alt: "ue" }, jugar: { alt: "u>ue" },
  leer: { hiato: true }, enviar: { acc: true },
};
const ALT = { ie: ["e", "ie"], ue: ["o", "ue"], i: ["e", "i"], "u>ue": ["u", "ue"] };
/** Where a stem-changing -ir verb goes in nosotros/vosotros of the subjunctive and in the preterite's third persons. */
const SHIFT = { ie: ["e", "i"], ue: ["o", "u"], i: ["e", "i"] };
const swap = (stem, from, to) => { const k = stem.lastIndexOf(from); return k < 0 ? stem : stem.slice(0, k) + to + stem.slice(k + from.length); };
/** Spelling that keeps the sound before e: c → qu, g → gu, z → c (-ar verbs only: buscar → busqué, busque). */
const keepSound = (base, ending) => {
  if (!/^[eé]/.test(ending)) return base + ending;
  if (base.endsWith("c")) return base.slice(0, -1) + "qu" + ending;
  if (base.endsWith("g")) return base + "u" + ending;
  if (base.endsWith("z")) return base.slice(0, -1) + "c" + ending;
  return base + ending;
};

/** Six forms of a verb in a tense; a reflexive verb (levantarse) comes with its pronouns (me levanto). */
export function forms(infinitive, tense) {
  const reflexive = infinitive.endsWith("se");
  const inf = reflexive ? infinitive.slice(0, -2) : infinitive;
  const out = rows(inf, tense);
  return reflexive ? out.map((f, i) => `${REFLEXIVE[i]} ${f}`) : out;
}
function rows(inf, tense) {
  if (!TENSES.includes(tense)) throw new Error(`no tense ${tense}`);
  const whole = WHOLE[inf]?.[tense];
  if (whole) return whole.slice();
  const type = inf.slice(-2), spec = SPEC[inf] || {}, stem = inf.slice(0, -2), end = END[type]?.[tense];
  if (!end) throw new Error(`not a verb: ${inf}`);
  const change = s => (spec.alt ? swap(s, ...ALT[spec.alt]) : spec.acc ? swap(s, "i", "í") : s);
  const join = (base, e) => (type === "ar" ? keepSound(base, e) : base + e);
  if (tense === "pres") return end.map((e, i) => (i === 0 && spec.go ? spec.go : join(STRONG.includes(i) ? change(stem) : stem, e)));
  if (tense === "imp") return end.map(e => stem + e);
  if (tense === "subj") {
    return end.map((e, i) => {
      if (spec.go) return join(spec.go.slice(0, -1), e);
      if (STRONG.includes(i)) return join(change(stem), e);
      return join(type === "ir" && spec.alt && SHIFT[spec.alt] ? swap(stem, ...SHIFT[spec.alt]) : stem, e);
    });
  }
  // the preterite
  if (spec.pret) {
    const e = ["e", "iste", "o", "imos", "isteis", spec.pret.endsWith("j") ? "eron" : "ieron"];
    return e.map((x, i) => (i === 2 && spec.p3 ? spec.p3 : spec.pret + x));
  }
  if (spec.hiato) return end.map((e, i) => (i === 2 ? stem + "yó" : i === 5 ? stem + "yeron" : stem + e.replace(/^i/, "í")));
  return end.map((e, i) => {
    const shifted = type === "ir" && (i === 2 || i === 5) && spec.alt && SHIFT[spec.alt] ? swap(stem, ...SHIFT[spec.alt]) : stem;
    return join(shifted, e);
  });
}
/** A table as one line for a grammar card: the six forms in order, "soy, eres, es, somos, sois, son". */
export const row = (inf, tense = "pres") => forms(inf, tense).join(", ");
