// Parley's Spanish course: the verb rules against forms known to be right (regular and irregular), the course's
// shape (no duplicates, articles and genders, punctuation, accents), that each reading uses only words learned by its
// unit, that no question gives its answer away, and that the voice falls back quietly. Run: node tests/parley.mjs
import fs from "node:fs";
import { forms, row, PERSONS } from "../parley-es-verbs.js";
import { COURSES } from "../parley-courses.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { bad++; console.log(`FAIL ${what}`); } };
const root = new URL("../", import.meta.url).pathname;

// ---------- the rules, against forms known to be right ----------
const KNOWN = {
  pres: {
    hablar: "hablo hablas habla hablamos habláis hablan", comer: "como comes come comemos coméis comen", vivir: "vivo vives vive vivimos vivís viven",
    ser: "soy eres es somos sois son", estar: "estoy estás está estamos estáis están", ir: "voy vas va vamos vais van",
    tener: "tengo tienes tiene tenemos tenéis tienen", venir: "vengo vienes viene venimos venís vienen", querer: "quiero quieres quiere queremos queréis quieren",
    poder: "puedo puedes puede podemos podéis pueden", hacer: "hago haces hace hacemos hacéis hacen", decir: "digo dices dice decimos decís dicen",
    dormir: "duermo duermes duerme dormimos dormís duermen", pedir: "pido pides pide pedimos pedís piden", jugar: "juego juegas juega jugamos jugáis juegan",
    saber: "sé sabes sabe sabemos sabéis saben", dar: "doy das da damos dais dan", ver: "veo ves ve vemos veis ven",
    conocer: "conozco conoces conoce conocemos conocéis conocen", poner: "pongo pones pone ponemos ponéis ponen", salir: "salgo sales sale salimos salís salen",
    enviar: "envío envías envía enviamos enviáis envían", empezar: "empiezo empiezas empieza empezamos empezáis empiezan",
    costar: "cuesto cuestas cuesta costamos costáis cuestan", preferir: "prefiero prefieres prefiere preferimos preferís prefieren",
    levantarse: "me levanto te levantas se levanta nos levantamos os levantáis se levantan", vestirse: "me visto te vistes se viste nos vestimos os vestís se visten",
    acostarse: "me acuesto te acuestas se acuesta nos acostamos os acostáis se acuestan", sentarse: "me siento te sientas se sienta nos sentamos os sentáis se sientan",
  },
  pret: {
    hablar: "hablé hablaste habló hablamos hablasteis hablaron", comer: "comí comiste comió comimos comisteis comieron", vivir: "viví viviste vivió vivimos vivisteis vivieron",
    ser: "fui fuiste fue fuimos fuisteis fueron", ir: "fui fuiste fue fuimos fuisteis fueron", tener: "tuve tuviste tuvo tuvimos tuvisteis tuvieron",
    hacer: "hice hiciste hizo hicimos hicisteis hicieron", decir: "dije dijiste dijo dijimos dijisteis dijeron", poder: "pude pudiste pudo pudimos pudisteis pudieron",
    dormir: "dormí dormiste durmió dormimos dormisteis durmieron", pedir: "pedí pediste pidió pedimos pedisteis pidieron",
    buscar: "busqué buscaste buscó buscamos buscasteis buscaron", llegar: "llegué llegaste llegó llegamos llegasteis llegaron",
    empezar: "empecé empezaste empezó empezamos empezasteis empezaron", leer: "leí leíste leyó leímos leísteis leyeron",
    dar: "di diste dio dimos disteis dieron", ver: "vi viste vio vimos visteis vieron", estar: "estuve estuviste estuvo estuvimos estuvisteis estuvieron",
    venir: "vine viniste vino vinimos vinisteis vinieron", poner: "puse pusiste puso pusimos pusisteis pusieron", querer: "quise quisiste quiso quisimos quisisteis quisieron",
    saber: "supe supiste supo supimos supisteis supieron", traer: "traje trajiste trajo trajimos trajisteis trajeron", preferir: "preferí preferiste prefirió preferimos preferisteis prefirieron",
    pagar: "pagué pagaste pagó pagamos pagasteis pagaron",
  },
  imp: {
    hablar: "hablaba hablabas hablaba hablábamos hablabais hablaban", comer: "comía comías comía comíamos comíais comían", vivir: "vivía vivías vivía vivíamos vivíais vivían",
    ser: "era eras era éramos erais eran", ir: "iba ibas iba íbamos ibais iban", ver: "veía veías veía veíamos veíais veían",
  },
  subj: {
    hablar: "hable hables hable hablemos habléis hablen", comer: "coma comas coma comamos comáis coman", vivir: "viva vivas viva vivamos viváis vivan",
    tener: "tenga tengas tenga tengamos tengáis tengan", hacer: "haga hagas haga hagamos hagáis hagan", ir: "vaya vayas vaya vayamos vayáis vayan",
    ser: "sea seas sea seamos seáis sean", estar: "esté estés esté estemos estéis estén", dar: "dé des dé demos deis den", saber: "sepa sepas sepa sepamos sepáis sepan",
    querer: "quiera quieras quiera queramos queráis quieran", poder: "pueda puedas pueda podamos podáis puedan",
    dormir: "duerma duermas duerma durmamos durmáis duerman", pedir: "pida pidas pida pidamos pidáis pidan",
    buscar: "busque busques busque busquemos busquéis busquen", llegar: "llegue llegues llegue lleguemos lleguéis lleguen",
    empezar: "empiece empieces empiece empecemos empecéis empiecen", jugar: "juegue juegues juegue juguemos juguéis jueguen",
    conocer: "conozca conozcas conozca conozcamos conozcáis conozcan", decir: "diga digas diga digamos digáis digan", venir: "venga vengas venga vengamos vengáis vengan",
    salir: "salga salgas salga salgamos salgáis salgan", ver: "vea veas vea veamos veáis vean", enviar: "envíe envíes envíe enviemos enviéis envíen",
    pagar: "pague pagues pague paguemos paguéis paguen",
  },
};
let tables = 0;
for (const [tense, verbs] of Object.entries(KNOWN)) {
  for (const [inf, want] of Object.entries(verbs)) {
    tables++;
    const got = forms(inf, tense).join(" ");
    check(got === want, `${inf} ${tense}: ${got} (want ${want})`);
  }
}
check(PERSONS.length === 6 && row("ser") === "soy, eres, es, somos, sois, son", "row prints a table in order");
let threw = false;
try { forms("hablarx", "pres"); } catch { threw = true; }
check(threw, "a word that is not a verb is refused");

// ---------- the course ----------
const ES = COURSES.find(c => c.id === "es");
check(ES && ES.lang === "es-ES" && ES.name === "Spanish" && !ES.script && !ES.tones, "Spanish is a course, tagged es-ES");
check(COURSES.every((c, i) => COURSES.findIndex(d => d.id === c.id) === i), "course ids are unique");
const words = ES.units.flatMap(u => u.words.map(w => ({ ...w, unit: u.id })));
check(ES.units.length >= 12 && words.length >= 190, `Spanish is full-size (${ES.units.length} units, ${words.length} words)`);
check(ES.units.every((u, i) => u.id === i + 1), "units are numbered 1, 2, 3 …");
const dup = (xs) => xs.filter((x, i) => xs.indexOf(x) !== i);
check(!dup(words.map(w => w.w)).length, `no word twice: ${dup(words.map(w => w.w))}`);
check(!dup(words.map(w => w.en)).length, `no meaning twice (a drill must never offer two right answers): ${dup(words.map(w => w.en))}`);
check(words.every(w => w.w && w.en && w.ex?.l2 && w.ex?.en), "every word has its word, meaning and example");
check(words.every(w => w.en.length <= 34), `meanings stay short, so the right option never stands out: ${words.filter(w => w.en.length > 34).map(w => w.en)}`);
check(words.every(w => !w.note || (w.note.length <= 140 && typeof w.note === "string")), "a note is one short line");
check(ES.units.every(u => u.grammar.title && u.grammar.rule && u.grammar.examples.length === 3 && u.grammar.examples.every(e => e.l2 && e.en)), "every unit has a pattern with three examples");
check(ES.units.every(u => u.words.length >= 14 && u.words.length <= 15), "units hold 14 or 15 words, like the others");

// articles and gender: the article must fit the noun's ending, except the known exceptions
const nouns = words.filter(w => /^(el|la) /.test(w.w));
const MASC_A = new Set(["día", "mapa", "problema"]), FEM_O = new Set(["mano"]);
for (const n of nouns) {
  const [art, ...rest] = n.w.split(" "), bare = rest.join(" "), last = rest[0];   // "fin de semana": the head is fin
  if (/(ción|sión|dad|tad|tud|umbre)$/.test(last)) check(art === "la", `${n.w}: -ción, -sión, -dad nouns are feminine`);
  if (/(aje|or|án|ambre)$/.test(last) && !/(la)/.test(art)) { /* masculine endings, nothing to forbid */ }
  if (art === "el" && /a$/.test(last) && !MASC_A.has(last) && last !== "agua") check(false, `${n.w}: el before a noun in -a`);
  if (art === "la" && /o$/.test(last) && !FEM_O.has(last)) check(false, `${n.w}: la before a noun in -o`);
}
check(nouns.length >= 60, `a good many nouns carry their article (${nouns.length})`);

// punctuation: every ¿ closes with ? and every ¡ with !, and a question mark has its opener
const spanish = [];
for (const u of ES.units) {
  for (const w of u.words) spanish.push([`${u.id} ${w.w}`, w.ex.l2]);
  for (const e of u.grammar.examples) spanish.push([`${u.id} grammar`, e.l2]);
  spanish.push([`${u.id} text`, u.text.l2]);
}
const count = (s, c) => [...s].filter(x => x === c).length;
for (const [where, s] of spanish) {
  check(count(s, "¿") === count(s, "?") && count(s, "¡") === count(s, "!"), `${where}: unbalanced ¿ ? ¡ ! in "${s}"`);
  check(/[.?!]$/.test(s), `${where}: no end mark: "${s}"`);
  check(!/\s[?!,.;:]/.test(s) && !/[¿¡]\s/.test(s), `${where}: stray space in "${s}"`);
}

// accents: an unaccented form of a word that is always accented must not appear (words that are real unaccented words are left out)
const NEEDS = [
  ["adios", "adiós"], ["tambien", "también"], ["aqui", "aquí"], ["alli", "allí"], ["ahi", "ahí"], ["cafe", "café"], ["telefono", "teléfono"], ["dia", "día"], ["dias", "días"],
  ["despues", "después"], ["mas", "más"], ["ademas", "además"], ["avion", "avión"], ["habitacion", "habitación"], ["estacion", "estación"], ["reunion", "reunión"],
  ["petroleo", "petróleo"], ["pequeno", "pequeño"], ["frio", "frío"], ["sabado", "sábado"], ["miercoles", "miércoles"], ["ojala", "ojalá"], ["quizas", "quizás"],
  ["ingles", "inglés"], ["aleman", "alemán"], ["pais", "país"], ["mama", "mamá"], ["jose", "José"], ["lopez", "López"], ["mexico", "México"], ["espana", "España"],
  ["munich", "Múnich"], ["vivia", "vivía"], ["comiamos", "comíamos"], ["bebia", "bebía"], ["tenia", "tenía"], ["habia", "había"], ["perdon", "perdón"], ["adonde", "adónde"],
  ["asi", "así"], ["aun", "aún"], ["facil", "fácil"], ["util", "útil"], ["ultimo", "último"], ["proximo", "próximo"], ["periodo", "período"],
].filter(([, good]) => good);
for (const [where, s] of spanish) {
  const toks = s.toLowerCase().match(/\p{L}+/gu) || [];
  for (const [bare, good] of NEEDS) check(!toks.includes(bare), `${where}: "${bare}" should be "${good}" in "${s}"`);
}
check(ES.units[4].grammar.rule.includes("habláis") && ES.units[4].grammar.rule.includes("coméis"), "unit 5 shows habláis and coméis with their accents");
check(words.some(w => /ñ/.test(w.w)) && words.some(w => /¿/.test(w.ex.l2)) && words.some(w => /¡/.test(w.ex.l2)) && words.some(w => /[áéíóú]/.test(w.w)), "ñ, ¿, ¡ and accents all occur");

// the cloze drill gaps the word where it first appears in its example: that must be a whole word, never part of another
const ART = /^(le|la|l'|les|un|une|der|die|das|ein|eine|el|los|las|una) /;
const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const w of words) {
  const bare = w.w.replace(ART, "");
  const target = [w.w, bare].find(t => new RegExp(esc(t), "i").test(w.ex.l2));
  if (!target) continue;                                        // not in its sentence: the drill falls back to recognising it
  const m = new RegExp(`(?<![\\p{L}])${esc(target)}(?![\\p{L}])`, "iu").exec(w.ex.l2);
  const first = new RegExp(esc(target), "i").exec(w.ex.l2);
  check(m && m.index === first.index, `${w.w}: the cloze would gap part of another word in "${w.ex.l2}"`);
}
const inSentence = words.filter(w => [w.w, w.w.replace(ART, "")].some(t => new RegExp(`(?<![\\p{L}])${esc(t)}(?![\\p{L}])`, "iu").test(w.ex.l2)));
check(inSentence.length >= words.length * 0.6, `most words can be drilled in their sentence (${inSentence.length} of ${words.length})`);

// listening: two words that sound alike in Spanish (b = v, silent h, ll = y, c/z = s in Latin America, qu = k, g = j before e/i) can't be told apart
const sounds = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(el|la|los|las|un|una) /, "").replace(/h/g, "").replace(/v/g, "b").replace(/ll/g, "y")
  .replace(/qu/g, "k").replace(/c(?=[ei])/g, "s").replace(/z/g, "s").replace(/ge/g, "je").replace(/gi/g, "ji").replace(/w/g, "u").replace(/c/g, "k").replace(/\s+/g, "");
const bySound = new Map();
for (const w of words) bySound.set(sounds(w.w), [...(bySound.get(sounds(w.w)) || []), w.w]);
// (qué and que differ only by an accent: Parley's drills already keep those two apart, as they compare without accents)
const plain = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
check([...bySound.values()].every(g => g.length === 1 || new Set(g.map(plain)).size === 1), `words that sound the same: ${[...bySound.values()].filter(g => g.length > 1).map(g => g.join("/"))}`);

// ---------- the readings ----------
const seen = s => String(s);
const givesAway = q => {
  const right = q.a === undefined ? [] : [q.o[q.a]], wrong = q.o.filter((_, i) => i !== q.a);
  const rl = right[0].length, wl = wrong.map(s => s.length), mean = wl.reduce((a, b) => a + b, 0) / wl.length;
  return rl > Math.max(...wl) && rl >= 1.5 * mean && rl - Math.max(...wl) >= 8;
};
for (const u of ES.units) {
  check(u.text.qs.length === 3, `unit ${u.id}: three questions`);
  for (const q of u.text.qs) {
    check(q.o.length === 4 && q.a >= 0 && q.a < 4 && new Set(q.o.map(o => o.toLowerCase())).size === 4, `unit ${u.id}: "${q.q}" has four different options`);
    check(!givesAway(q), `unit ${u.id}: "${q.q}" gives its answer away by length`);
    check(!seen(q.o[q.a]).includes("only") && q.o.every(o => o.length <= 48), `unit ${u.id}: "${q.q}" options are short`);
  }
  check(u.text.l2.length > 60 && u.text.en.length > 60, `unit ${u.id}: a reading with its English`);
}

// a reading uses only words met by its unit: words, examples and pattern of units 1..n, the forms of the verbs learned (a tense only once taught), names
const NAMES = new Set(["pablo", "marta", "luis", "ana", "madrid"]);
const TAUGHT = { pres: 1, pret: 11, imp: 12, subj: 14 };
const tokens = s => (s.toLowerCase().match(/\p{L}+/gu) || []);
const variants = t => {
  const out = new Set([t, t + "s", t + "es", t.replace(/s$/, ""), t.replace(/es$/, "")]);
  if (/o$/.test(t)) { const b = t.slice(0, -1); ["a", "os", "as"].forEach(e => out.add(b + e)); }
  if (/a$/.test(t)) { const b = t.slice(0, -1); ["o", "os", "as"].forEach(e => out.add(b + e)); }
  if (/e$/.test(t)) { const b = t.slice(0, -1); ["a", "as"].forEach(e => out.add(b + e)); }
  if (/ón$/.test(t)) out.add(t.replace(/ón$/, "ones"));
  return out;
};
const known = new Set();
for (const u of ES.units) {
  for (const w of u.words) {
    for (const t of tokens(w.w)) variants(t).forEach(v => known.add(v));
    for (const t of tokens(w.ex.l2)) variants(t).forEach(v => known.add(v));
    if (/^to /.test(w.en) && /^[a-záéíóúñ]+(ar|er|ir)(se)?$/.test(w.w)) {
      for (const [tense, from] of Object.entries(TAUGHT)) if (u.id <= from || true) for (const f of forms(w.w, tense)) for (const t of tokens(f)) known.add(`${tense}:${t}:${u.id}`);
    }
  }
  for (const t of tokens(u.grammar.rule)) variants(t).forEach(v => known.add(v));
  for (const e of u.grammar.examples) for (const t of tokens(e.l2)) variants(t).forEach(v => known.add(v));
  // the text of unit n may use everything above, the units before it, and its own
  const ok = new Set();
  for (const k of known) {
    const m = k.match(/^(pres|pret|imp|subj):(.+):(\d+)$/);
    if (!m) ok.add(k);
    else if (+m[3] <= u.id && TAUGHT[m[1]] <= u.id) ok.add(m[2]);
  }
  const unknown = [...new Set(tokens(u.text.l2))].filter(t => !ok.has(t) && !NAMES.has(t));
  check(!unknown.length, `unit ${u.id}'s reading has words not learned yet: ${unknown.join(", ")}`);
}

// ---------- the voice ----------
async function voiceWith(voices) {
  const spoken = [];
  globalThis.window = { speechSynthesis: voices && { getVoices: () => voices, cancel() {}, speak: u => spoken.push(u), addEventListener() {} } };
  globalThis.addEventListener = () => {};
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  const v = await import(`../voice.js?${Math.random()}`);
  return { v, spoken };
}
{
  const { v, spoken } = await voiceWith([{ lang: "fr-FR" }, { lang: "es_MX" }, { lang: "es-ES" }]);
  check(v.speak("hola", "es-ES") && spoken[0].lang === "es-ES" && spoken[0].voice?.lang === "es-ES", "es-ES picks the exact Spanish voice");
  check(v.hasVoice("es-ES"), "a Spanish voice is found");
}
{
  const { v, spoken } = await voiceWith([{ lang: "es_MX" }]);
  check(v.speak("hola", "es-ES") && spoken[0].voice?.lang === "es_MX", "no es-ES voice: a Latin-American Spanish voice is used (family match, even with an underscore)");
}
{
  const { v, spoken } = await voiceWith([{ lang: "fr-FR" }]);
  check(v.speak("hola", "es-ES") && spoken[0].voice === undefined && !v.hasVoice("es-ES"), "no Spanish voice: the engine's default speaks and nothing throws");
}
{
  const { v } = await voiceWith(null);
  check(v.speak("hola", "es-ES") === false && !v.hasVoice("es-ES"), "no speech engine: speak answers false, silently");
}

// ---------- the page and the games screen ----------
const html = fs.readFileSync(root + "parley.html", "utf8");
check(/<option value="es">Spanish<\/option>/.test(html), "the course picker offers Spanish");
check(/parley: "[^"]*spanish/.test(fs.readFileSync(root + "games-find.js", "utf8")), "the games screen's search finds Parley by 'spanish'");
const code = fs.readFileSync(root + "parley.js", "utf8");
check(/es: \["el", "la"\]/.test(code), "typed production offers el and la for Spanish");

console.log(bad ? `parley: ${bad} FAILED` : `parley: ok (${tables} verb tables, ${words.length} Spanish words in ${ES.units.length} units)`);
process.exit(bad ? 1 : 0);
