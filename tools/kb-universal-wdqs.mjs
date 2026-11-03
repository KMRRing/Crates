// Wikidata Query Service, from Node, through curl (the container's proxy is set up for curl and Node 22's fetch ignores it).
// Wikidata's data is CC0. The service wants a User-Agent that says who is asking, allows about five queries at once and
// cuts one off after 60 s: keep each query to a few hundred items (VALUES) and call `sparql` one at a time.
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const UA = "CodexKnowledgeResearch/0.1 (Korbi's game suite, repo KMRRing/Crates; research queries, a few thousand items)";
const ENDPOINT = "https://query.wikidata.org/sparql";

/** Runs one SPARQL query and returns its bindings as plain objects { var: string }. Retries on 429/5xx with a pause. */
export function sparql(query, { tries = 4, timeout = 90 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "wdqs-"));
  try {
    writeFileSync(join(dir, "q.txt"), query);
    for (let t = 1; ; t++) {
      let out = "", code = "";
      try {
        out = execFileSync("curl", ["-sS", "-m", String(timeout), "-A", UA, "-H", "Accept: application/sparql-results+json", "-D", join(dir, "h.txt"),
          "--data-urlencode", `query@${join(dir, "q.txt")}`, "-o", join(dir, "out.json"), "-w", "%{http_code}", ENDPOINT],
          { encoding: "utf8", maxBuffer: 1 << 20 });
        code = out.trim();
      } catch (e) { code = "curl:" + (e.status ?? e.message); }
      if (code === "200") {
        const rows = JSON.parse(readFileSync(join(dir, "out.json"), "utf8")).results.bindings;
        return rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.value])));
      }
      // A 429 says how long to stay away (it was 1,000 s on 3 November); every try inside that time only extends it
      let wait = 3 * t;
      if (code === "429") {
        try { wait = Number(/retry-after:\s*(\d+)/i.exec(readFileSync(join(dir, "h.txt"), "utf8"))?.[1] ?? 60); } catch { wait = 60; }
        if (wait > 120) throw new Error(`WDQS throttled: retry after ${wait} s`);
      }
      if (t >= tries) throw new Error(`WDQS ${code} after ${t} tries: ${(() => { try { return readFileSync(join(dir, "out.json"), "utf8").slice(0, 300); } catch { return ""; } })()}`);
      sleep(Math.max(3, wait) * 1000);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

export function sleep(ms) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); }

/** "http://www.wikidata.org/entity/Q42" → "Q42" */
export const qid = uri => uri.slice(uri.lastIndexOf("/") + 1);

/** Splits a list into runs of n. */
export function chunks(list, n) { const out = []; for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n)); return out; }
