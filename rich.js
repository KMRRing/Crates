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
export const hasMath = text => typeof text === "string" && /\$[^$]+\$/.test(text);
/** Fills `node` with `text`, rendering any $…$ as maths. Plain text otherwise. */
export function setRich(node, text) {
  const s = text == null ? "" : String(text);
  if (!hasMath(s)) { node.textContent = s; return; }
  const render = () => {
    node.replaceChildren();
    const parts = s.split(/(\$\$[^$]+\$\$|\$[^$]+\$)/);
    for (const part of parts) {
      if (!part) continue;
      const display = part.startsWith("$$"), tex = display ? part.slice(2, -2) : part.startsWith("$") ? part.slice(1, -1) : null;
      if (tex == null) { node.appendChild(document.createTextNode(part)); continue; }
      const span = document.createElement(display ? "div" : "span");
      span.className = display ? "math display" : "math";
      try { span.innerHTML = window.temml.renderToString(tex, { displayMode: display, throwOnError: false }); } catch { span.textContent = tex; }
      node.appendChild(span);
    }
  };
  if (window.temml) render();
  else { node.textContent = s.replace(/\$\$?/g, ""); loadMath().then(ok => { if (ok) render(); }); }
}
