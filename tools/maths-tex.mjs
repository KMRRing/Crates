// tools/maths-tex.mjs: plain-text maths (x², √(…), ∫, [[1, 2], [3, 4]], θ̂…) to LaTeX between $…$, for rich.js and Temml.
// Plain-text maths in the maths bank to LaTeX between $…$, conservatively: only spans with real maths in them, never
// across prose, never units; every span checked by Temml, the app's renderer, and left plain if it doesn't parse.
import fs from "fs"; import vm from "vm";
const ctx = { window: {}, console }; ctx.globalThis = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL("../vendor/temml.min.js", import.meta.url), "utf8"), ctx);
const temml = ctx.temml || ctx.window.temml;
const parses = tex => { try { temml.renderToString(tex, { throwOnError: true }); return true; } catch { return false; } };
const SUP = { "⁰":"0","¹":"1","²":"2","³":"3","⁴":"4","⁵":"5","⁶":"6","⁷":"7","⁸":"8","⁹":"9","⁺":"+","⁻":"-","⁼":"=","⁽":"(","⁾":")","ⁿ":"n","ⁱ":"i","ˣ":"x","ʸ":"y","ᵏ":"k","ᵗ":"t","ᵃ":"a","ᵇ":"b","ᶜ":"c","ᵈ":"d","ᵉ":"e","ᶠ":"f","ᵍ":"g","ʰ":"h","ʲ":"j","ˡ":"l","ᵐ":"m","ᵒ":"o","ᵖ":"p","ʳ":"r","ˢ":"s","ᵘ":"u","ᵛ":"v","ʷ":"w","ᶻ":"z","ᵀ":"T","ᴬ":"A","ᴮ":"B","ᴺ":"N","ᴾ":"P","ᴿ":"R" };
const SUB = { "₀":"0","₁":"1","₂":"2","₃":"3","₄":"4","₅":"5","₆":"6","₇":"7","₈":"8","₉":"9","₊":"+","₋":"-","₌":"=","₍":"(","₎":")","ₐ":"a","ₑ":"e","ₒ":"o","ₓ":"x","ₕ":"h","ₖ":"k","ₗ":"l","ₘ":"m","ₙ":"n","ₚ":"p","ₛ":"s","ₜ":"t","ᵢ":"i","ⱼ":"j","ᵣ":"r","ᵤ":"u","ᵥ":"v" };
const GREEK = { "α":"\\alpha","β":"\\beta","γ":"\\gamma","δ":"\\delta","ε":"\\varepsilon","ζ":"\\zeta","η":"\\eta","θ":"\\theta","κ":"\\kappa","λ":"\\lambda","μ":"\\mu","ν":"\\nu","ξ":"\\xi","π":"\\pi","ρ":"\\rho","σ":"\\sigma","τ":"\\tau","φ":"\\varphi","ϕ":"\\phi","χ":"\\chi","ψ":"\\psi","ω":"\\omega","Γ":"\\Gamma","Δ":"\\Delta","Θ":"\\Theta","Λ":"\\Lambda","Π":"\\Pi","Σ":"\\Sigma","Φ":"\\Phi","Ψ":"\\Psi","Ω":"\\Omega" };
const SYM = { "×":"\\times","÷":"\\div","·":"\\cdot","≈":"\\approx","≤":"\\le","≥":"\\ge","≠":"\\ne","→":"\\to","⇒":"\\Rightarrow","⇔":"\\iff","∞":"\\infty","±":"\\pm","∓":"\\mp","∈":"\\in","∉":"\\notin",
  "⊂":"\\subset","⊆":"\\subseteq","∪":"\\cup","∩":"\\cap","∅":"\\emptyset","∀":"\\forall","∃":"\\exists","∘":"\\circ","∂":"\\partial","∫":"\\int","∮":"\\oint","∑":"\\sum","∏":"\\prod","∇":"\\nabla",
  "ℝ":"\\mathbb{R}","ℤ":"\\mathbb{Z}","ℕ":"\\mathbb{N}","ℚ":"\\mathbb{Q}","ℂ":"\\mathbb{C}","°":"^\\circ","…":"\\ldots","⋯":"\\cdots","∼":"\\sim","~":"\\sim","≡":"\\equiv","∝":"\\propto","⊥":"\\perp",
  "‖":"\\|","⟨":"\\langle","⟩":"\\rangle","¬":"\\neg","∧":"\\land","∨":"\\lor","⊗":"\\otimes","⊕":"\\oplus","ℓ":"\\ell" };
const FUNCS = new Set(["arcsin","arccos","arctan","sinh","cosh","tanh","sin","cos","tan","sec","csc","cot","log","ln","exp","det","lim","max","min","sup","inf","gcd","deg","dim","ker","arg"]);
const OPS = new Set(["cosec","adj","tr","rank","Var","Cov","sgn","sech","cosech","coth","arsinh","arcosh","artanh","erf","lcm","hcf","Re","Im","Corr","SD","SE","mod","div","curl"]);
const ENGLISH = new Set("a an as at be by do go he if in is it me my no of on or so to up us we am and are but can for has had her him his how its may not now off old one our out own per put say see she the too two use was way who why yes you all any few let lie get got new set sum top end run ran yet via vs iid law add odd red box bet day pdf cdf rad env nth th st nd rd cm mm km kg etc ie eg".split(" "));
const SIGNAL = /[=<>≤≥≈≠→∞∫∑∏∂√∛∈∉⊂⊆∪∩∀∃ℝℤℕℚℂ^_±×÷·~∼≡∝′⇒⇔∇‖½⅓⅔¼¾⅕⅙⅛\u0302\u0304]|[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ⁿⁱˣʸᵏᵗᵃᵇᶜᵈᵉᶠᵍʰʲˡᵐᵒᵖʳˢᵘᵛʷᶻᵀᴬᴮᴺᴾᴿ₀₁₂₃₄₅₆₇₈₉₊₋₍₎ₐₑₒₓₕₖₗₘₙₚₛₜᵢⱼᵣᵤᵥ]|[α-ωΓΔΘΛΠΣΦΨΩϕ]|\[\[/;
const UNITS = /\d\s*(m\/s|km\/h|m|s|kg|g|N|J|W|km|cm|mm|h|Hz|V|K|mol|L|ml|kW|kWh|MW|GW|°C|ms)(²|³|\b)|m\/s/;
// a token is maths if it's a number, a symbol, a single letter, a function, a differential (dx), or a short product of letters that isn't English
// acronyms of three letters or more (GBM, CDF, NPV) are prose; a capitalised pair that isn't a word (Ae, Ax) is a product
const isMathWord = w => w.length === 1 || FUNCS.has(w) || OPS.has(w) || /^d[a-zA-Z]$/.test(w)
  || (w.length === 2 && !ENGLISH.has(w.toLowerCase()) && /^[a-z]{2}$/i.test(w))
  || (w.length === 3 && !ENGLISH.has(w.toLowerCase()) && /^[a-z]{3}$/.test(w));
const TOKEN = /([A-Za-z]+)|(\d+(?:\.\d+)?)|(\s+)|(.)/gsu;
function spans(text) {
  const toks = [...text.matchAll(TOKEN)].map(m => ({ s: m[0], word: m[1], i: m.index }));
  const out = []; let cur = null;
  const close = () => { if (cur) out.push(cur); cur = null; };
  // the next token after the spaces: an article is followed straight by its word, never across punctuation
  const nextWord = k => { let j = k + 1; while (j < toks.length && /^\s+$/.test(toks[j].s)) j++; return toks[j]?.word || null; };
  for (const [k, t] of toks.entries()) {
    const article = t.word && /^[aAI]$/.test(t.word) && nextWord(k) && !isMathWord(nextWord(k));
    const endOfSentence = t.s === "." && /^\s/.test(text.slice(t.i + 1, t.i + 2));                 // a full stop, then a space: a new sentence
    const breaker = endOfSentence || article || (t.word && !isMathWord(t.word)) || /[£$"“”‘’–—;:\u2060\u2024]/.test(t.s) && t.s !== ":";
    if (breaker) { close(); continue; }
    if (!cur) { if (/^\s+$/.test(t.s)) continue; cur = { start: t.i, end: t.i + t.s.length }; } else cur.end = t.i + t.s.length;
  }
  close();
  return out.map(({ start, end }) => {
    let s = text.slice(start, end);
    while (/[\s.,;:?]$/.test(s)) { s = s.slice(0, -1); end--; }
    while (/^[\s.,;:?]/.test(s)) { s = s.slice(1); start++; }
    // a bracket left open at the end, or closed at the start, belongs to the prose around the span: trim it off
    // (round and square brackets counted together, for half-open intervals like [0, 2π))
    for (let k = 0; k < 6; k++) {
      const d = (s.match(/[(\[]/g) || []).length - (s.match(/[)\]]/g) || []).length;
      if (/^[)\]]/.test(s)) { s = s.slice(1); start++; }
      else if (/[(\[]$/.test(s)) { s = s.slice(0, -1); end--; }
      else if (d < 0 && /[)\]]$/.test(s) && !/^[(\[]/.test(s)) { s = s.slice(0, -1); end--; }
      else if (d > 0 && /^[(\[]/.test(s) && !/[)\]]$/.test(s)) { s = s.slice(1); start++; }
      else break;
      while (/[\s.,;:?]$/.test(s)) { s = s.slice(0, -1); end--; }
      while (/^[\s.,;:?]/.test(s)) { s = s.slice(1); start++; }
    }
    return { start, end, s };
  }).filter(x => x.s);
}
const balanced = s => { let d = 0; for (const c of s) { d += "([".includes(c) ? 1 : ")]".includes(c) ? -1 : 0; if (d < 0) return false; } return d === 0 && (s.split("|").length - 1) % 2 === 0; };
/** Cuts a span at an unmatched bracket: what comes before a stray closing one, or after a stray opening one, is prose's. */
function cut(sp) {
  let { start, s } = sp, d = 0, from = 0;
  for (let i = 0; i < s.length; i++) { d += "([".includes(s[i]) ? 1 : ")]".includes(s[i]) ? -1 : 0; if (d < 0) { from = i + 1; d = 0; } }
  s = s.slice(from); start += from;
  d = 0; const opens = [];
  for (let i = 0; i < s.length; i++) { if ("([".includes(s[i])) opens.push(i); else if (")]".includes(s[i])) opens.pop(); }
  if (opens.length) s = s.slice(0, opens[0]);
  const lead = s.match(/^[\s.,;:?]*/)[0].length; s = s.slice(lead).replace(/[\s.,;:?]+$/, ""); start += lead;
  return { start, end: start + s.length, s };
}
const wanted = s => SIGNAL.test(s) || /\b[a-zA-Z]\s*\(/.test(s) && /[a-zA-Z]\(.*\)/.test(s) && /[=<>+\-−]/.test(s) || /(^|[^a-zA-Z])[a-zA-Z]{1,3}\s*[+\-−*/]\s*[\w(]|[\w)]\s*[+\-−*/]\s*[a-zA-Z]{1,3}([^a-zA-Z]|$)/.test(s) && !/^[\d\s.,+\-−*/()%]+$/.test(s);
function toTex(s) {
  let t = s.normalize("NFD");
  t = t.replace(/(\\?[A-Za-z]|[α-ωΓΔΘΛΠΣΦΨΩ])\u0302/g, "\\hat{$1}").replace(/(\\?[A-Za-z]|[α-ωΓΔΘΛΠΣΦΨΩ])\u0304/g, "\\bar{$1}").normalize("NFC");
  t = t.replace(/\[\[((?:[^\[\]]|\],\s*\[)*)\]\]/g, (m, inner) => `\\begin{pmatrix} ${inner.split(/\],\s*\[/).map(r => r.split(/\s*,\s*/).join(" & ")).join(" \\\\ ")} \\end{pmatrix}`);
  t = t.replace(/∂([²³]?)([a-zA-Z]?)\/∂([a-zA-Z])([²³]?)/g, (m, p1, f, x, p2) => `\\frac{\\partial${p1 ? "^" + SUP[p1] : ""}${f ? " " + f : ""}}{\\partial ${x}${p2 ? "^" + SUP[p2] : ""}}`);
  t = t.replace(/\bd([²³]?)([a-zA-Z]?)\/d([a-zA-Z])([²³]?)/g, (m, p1, f, x, p2) => `\\frac{d${p1 ? "^" + SUP[p1] : ""}${f}}{d${x}${p2 ? "^" + SUP[p2] : ""}}`);
  t = t.replace(/√\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, "\\sqrt{$1}").replace(/√(\d+(?:\.\d+)?|[a-zA-Z])/g, "\\sqrt{$1}").replace(/∛\(([^()]*)\)/g, "\\sqrt[3]{$1}").replace(/∛(\d+|[a-zA-Z])/g, "\\sqrt[3]{$1}");
  t = t.replace(/\^\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g, "^{$1}").replace(/\^([+\-−]?[\w.]+)/g, "^{$1}");
  t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱˣʸᵏᵗᵃᵇᶜᵈᵉᶠᵍʰʲˡᵐᵒᵖʳˢᵘᵛʷᶻᵀᴬᴮᴺᴾᴿ]+/g, m => `^{${[...m].map(c => SUP[c]).join("")}}`);
  t = t.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₒₓₕₖₗₘₙₚₛₜᵢⱼᵣᵤᵥ]+/g, m => `_{${[...m].map(c => SUB[c]).join("").replace(/^\((.*)\)$/, "$1")}}`);
  t = t.replace(/_([a-zA-Z0-9])(?![\w{])/g, "_{$1}");
  t = t.replace(/[A-Za-z]+/g, w => FUNCS.has(w) ? `\\${w} ` : OPS.has(w) ? (w === "mod" ? "\\bmod " : `\\operatorname{${w}} `) : w);
  t = t.replace(/\\hat\{([α-ωΓΔΘΛΠΣΦΨΩ])\}/g, (m, g) => `\\hat{${GREEK[g]}}`).replace(/\\bar\{([α-ωΓΔΘΛΠΣΦΨΩ])\}/g, (m, g) => `\\bar{${GREEK[g]}}`);
  t = t.replace(/[½⅓⅔¼¾⅕⅙⅛]/g, c => ({ "½": "\\tfrac{1}{2}", "⅓": "\\tfrac{1}{3}", "⅔": "\\tfrac{2}{3}", "¼": "\\tfrac{1}{4}", "¾": "\\tfrac{3}{4}", "⅕": "\\tfrac{1}{5}", "⅙": "\\tfrac{1}{6}", "⅛": "\\tfrac{1}{8}" })[c]);
  t = t.replace(/./gsu, c => GREEK[c] ? GREEK[c] + " " : SYM[c] ? SYM[c] + " " : c === "−" ? "-" : c === "%" ? "\\%" : c === "#" ? "\\#" : c === "′" ? "'" : c);
  t = t.replace(/(\S) d([a-zA-Z])(?![a-zA-Z])/g, "$1\\,d$2");                                   // a thin space before a differential
  return t.replace(/[ \t]{2,}/g, " ").replace(/\s+([}^_,;)\]])/g, "$1").trim();          // no space before a comma or a closing bracket
}
const RAW = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻ⁿˣ₀₁₂₃₄₅₆₇₈₉ₙ√∫∑∂≤≥≈≠→∞±×÷]|[α-ωΓΔΘΛΠΣΦΨΩ]|\u0302|\u0304/;
const outside = s => s.replace(/(?<!\\)\$(?:\\\$|[^$])+(?<!\\)\$/g, "");
/** An option still holding raw maths (because a word split it) is typeset whole, its words as \text{}; checked by Temml. */
export function wholeOption(text, log) {
  if (!RAW.test(outside(text)) || UNITS.test(text) || !balanced(text) || /(?<!\\)\$/.test(text)) return null;
  const tex = toTex(text.replace(/[A-Za-z]{2,}/g, w => isMathWord(w) ? w : `\u0001${w}\u0002`)).replace(/\u0001([^\u0002]*)\u0002/g, "\\text{$1}");
  return parses(tex) ? "$" + tex + "$" : (log?.push(text), null);
}
export function convert(text, log) {
  // already marked up: once typeset, a string's only unescaped dollars are maths delimiters (money is always \$), so any
  // unescaped dollar means leave it alone, whatever its maths begins with ($240 = 0.15$ as much as $x^2$)
  if (text == null || /(^|[^\\])\$/.test(text)) return text;
  const src = String(text).replace(/(^|[^\\])\$/g, "$1\\$").replace(/\b(i\.e\.|e\.g\.|cf\.|etc\.|vs\.)/g, m => `\u2060${m.replace(/\./g, "\u2024")}\u2060`);                                                          // a dollar is money
  // abbreviations are prose, though their letters look like variables: i.e., e.g., cf., etc.

  let out = "", at = 0;
  for (const whole of spans(src)) {
    const sp = balanced(whole.s) ? whole : cut(whole);
    if (!sp.s || !wanted(sp.s) || UNITS.test(sp.s) || !balanced(sp.s)) continue;
    const tex = toTex(sp.s);
    if (!parses(tex)) { log?.push(sp.s); continue; }
    out += src.slice(at, sp.start) + "$" + tex + "$"; at = sp.end;
  }
  out += src.slice(at);
  out = out.replace(/\u2060([^\u2060]*)\u2060/g, (m, a) => a.replace(/\u2024/g, "."));
  // in a sentence, a word in brackets raised to a power: (bias)²
  return out.replace(/(^|[^$\w])\(([A-Za-z]{2,}(?: [A-Za-z]+)*)\)([²³⁴])(?![^$]*\$)/g, (m, pre, w, p) => `${pre}$(\\text{${w}})^{${SUP[p]}}$`);
}

// Run as a script (node tools/maths-tex.mjs): typesets the plain-text maths in maths-bank.js in place. Strings that
// already carry $…$ are left as they are, so it can be run again after new questions are added in plain text.
if (import.meta.url === `file://${process.argv[1]}`) {
  const RAWX = /[⁰¹²³⁴⁵⁶⁷⁸⁹⁻ⁿˣ₀₁₂₃₄₅₆₇₈₉ₙ√∫∑∂≤≥≈≠→∞±×÷]|[α-ωΓΔΘΛΠΣΦΨΩ]|\u0302|\u0304/;
  const strip = s => s.replace(/(?<!\\)\$(?:\\\$|[^$])+(?<!\\)\$/g, "");
  const file = new URL("../maths-bank.js", import.meta.url), src = fs.readFileSync(file, "utf8"), head = src.slice(0, src.indexOf("export const MATHS = ["));
  const { MATHS } = await import(file.href), refused = [];
  const opt = o => { const c = convert(o, refused); return RAWX.test(strip(c)) ? (wholeOption(o, refused) || c) : c; };
  const out = MATHS.map(q => ({ ...q, q: convert(q.q, refused), o: q.o.map(opt), ...(q.x != null ? { x: convert(q.x, refused) } : {}) }));
  fs.writeFileSync(file, head + "export const MATHS = [" + out.map(q => JSON.stringify(q)).join(",\n") + "];\n");
  console.log(`${out.length} questions written; ${refused.length} spans left plain (Temml refused them): ${refused.slice(0, 5).join(" / ")}`);
}
