// Rich text for the banks: a prompt, option or note may carry LaTeX between $…$ (inline) or $$…$$ (displayed),
// rendered to MathML by Temml (vendor/temml.min.js, MIT) when it's loaded, shown as-is when it isn't. Everything
// else is plain text, set as text (never as HTML).
let ready = null;
export function loadMath() {
  if (ready) return ready;
  ready = new Promise(resolve => {
    if (window.temml) { resolve(true); return; }
    if (!document.querySelector("link[data-temml]")) { const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "./vendor/temml.css"; l.dataset.temml = "1"; document.head.appendChild(l); }
    const s = document.createElement("script");
    s.src = "./vendor/temml.min.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
  return ready;
}
/**
 * Splits text into plain runs and maths, telling maths from money as Pandoc does: $$…$$ is displayed maths; an inline
 * $ opens maths only if a non-space follows it, and closes it only after a non-space and not before a digit; \$ is
 * always a dollar. So "$2^{10}$" is maths, but "spent $3 million … needs $2 million" is two prices: a plain pair of
 * dollars once turned the words between them into run-together italic maths. Returns [{ text } | { tex, display }].
 */
export function mathParts(text) {
  const s = text == null ? "" : String(text), out = [];
  let plain = "", i = 0;
  const flush = () => { if (plain) out.push({ text: plain }); plain = ""; };
  while (i < s.length) {
    const c = s[i];
    if (c === "\\" && s[i + 1] === "$") { plain += "$"; i += 2; continue; }
    if (c !== "$") { plain += c; i++; continue; }
    if (s[i + 1] === "$") {                                       // $$…$$
      const end = s.indexOf("$$", i + 2);
      if (end > i + 2) { flush(); out.push({ tex: s.slice(i + 2, end), display: true }); i = end + 2; continue; }
      plain += "$$"; i += 2; continue;
    }
    if (s[i + 1] && !/\s/.test(s[i + 1])) {                       // an opening $ has a non-space after it
      let j = i + 1, end = -1;
      while ((j = s.indexOf("$", j)) !== -1) {
        if (s[j - 1] !== "\\" && !/\s/.test(s[j - 1]) && !/[0-9]/.test(s[j + 1] || "")) { end = j; break; }
        j++;
      }
      if (end > i + 1) { flush(); out.push({ tex: s.slice(i + 1, end), display: false }); i = end + 1; continue; }
    }
    plain += c; i++;                                               // a dollar, not maths
  }
  flush();
  return out;
}
export const hasMath = text => typeof text === "string" && mathParts(text).some(p => p.tex != null);
/** Fills `node` with `text`, rendering any maths in it (see mathParts). Plain text otherwise. */
export function setRich(node, text) {
  const parts = mathParts(text);
  if (!parts.some(p => p.tex != null)) { node.textContent = parts.map(p => p.text).join(""); return; }
  const render = () => {
    node.replaceChildren();
    for (const p of parts) {
      if (p.tex == null) { node.appendChild(document.createTextNode(p.text)); continue; }
      const span = document.createElement(p.display ? "div" : "span");
      span.className = p.display ? "math display" : "math";
      try { span.innerHTML = window.temml.renderToString(p.tex, { displayMode: p.display, throwOnError: false }); } catch { span.textContent = p.tex; }
      node.appendChild(span);
    }
  };
  if (window.temml) render();
  else { node.textContent = parts.map(p => p.tex ?? p.text).join(""); loadMath().then(ok => { if (ok) render(); }); }   // the source, dollars kept, until Temml loads
}
