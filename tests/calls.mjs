// Every function a game calls from suite.js is imported. A missing import fails only when the line runs: Quote's and
// Chart's closing summaries threw on every ranked run (today's, or one counting for your best) because noteComparable
// was called but never imported, and the closing bell did nothing. Comments and strings are set aside before looking.
import fs from "fs";
const root = new URL("..", import.meta.url);
const read = f => fs.readFileSync(new URL(f, root), "utf8");
const names = [...read("suite.js").matchAll(/^export (?:async )?(?:function|const|let) (\w+)/gm)].map(m => m[1]);
const code = src => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1/g, '""').replace(/`(?:\\.|[^\\`])*`/g, "``");
const missing = [];
for (const f of fs.readdirSync(root).filter(f => f.endsWith(".js") && f !== "suite.js" && !/-bank\.js$|^sw\.js$/.test(f))) {
  const src = read(f), body = code(src);
  const imported = new Set([...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']\.\/suite\.js["']/g)].flatMap(m => m[1].split(",").map(s => s.trim().split(/\s+as\s+/).pop())).filter(Boolean));
  if (/import \* as \w+ from ["']\.\/suite\.js["']/.test(src)) continue;
  for (const n of names) {
    // defined here: a function, a variable, a parameter, or a method (ask(state) { … })
    if (imported.has(n) || new RegExp(`(function\\*?|const|let|var|class)\\s+${n}\\b|[({,]\\s*${n}\\s*[,)}=]|^\\s*(async\\s+)?${n}\\s*\\([^)]*\\)\\s*\\{`, "m").test(body)) continue;
    if (new RegExp(`(^|[^.\\w$])${n}\\s*\\(`).test(body)) missing.push(`${f} calls ${n}`);
  }
}
console.log(`${missing.length ? "FAIL" : "ok  "} every suite.js function a game calls is imported${missing.length ? `: ${missing.join(", ")}` : ""}`);
if (missing.length) process.exitCode = 1;
