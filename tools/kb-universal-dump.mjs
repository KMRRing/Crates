// Readers for the Wikimedia dumps that carry the universality signals. All of it is read as a stream, nothing is held
// but what the caller keeps. Licences: the SQL tables and the multistream index are facts about pages (titles, ids,
// Wikidata item numbers, language links), which carry no copyright of their own; the clickstream is CC0; page *text*
// (CC BY-SA) is read only to find which titles a list names and is never kept or shipped.
// Everything here is plain Node (zlib, readline); the dumps are fetched by tools/kb-universal-fetch.sh.
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

/** Calls onLine(line) for each line of a gzip file (returns a promise). */
export async function gunzipLines(path, onLine) {
  const rl = createInterface({ input: createReadStream(path).pipe(createGunzip()), crlfDelay: Infinity });
  for await (const line of rl) onLine(line);
}

/** MySQL string escapes as the dump writes them: \' \" \\ \n \t \r \0 \Z; anything else is the character itself. */
export function unescapeSql(s) {
  if (!s.includes("\\")) return s;
  return s.replace(/\\(.)/g, (_, c) => c === "n" ? "\n" : c === "t" ? "\t" : c === "r" ? "\r" : c === "0" ? "\0" : c === "Z" ? "\x1a" : c);
}

/** The tuples of a dump's INSERT lines that match `re` (a global regex over the raw line); calls onMatch(match).
 *  Since 2026 the dumps write one tuple per line under a bare "INSERT INTO … VALUES" line; older dumps put thousands on one line. */
export async function scanInserts(path, re, onMatch) {
  await gunzipLines(path, line => {
    if (line.charCodeAt(0) !== 40 /* ( */ && !line.startsWith("INSERT INTO")) return;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(line))) onMatch(m);
  });
}

/** The multistream index lines "offset:pageid:title" → calls onEntry(offset, pageId, title). Titles may contain colons. */
export function parseIndexLine(line) {
  const a = line.indexOf(":"), b = line.indexOf(":", a + 1);
  return a < 0 || b < 0 ? null : [Number(line.slice(0, a)), Number(line.slice(a + 1, b)), line.slice(b + 1)];
}

/** Wikipedia titles use underscores in tables and spaces in text. */
export const spaced = t => t.replace(/_/g, " ");
export const underscored = t => t.replace(/ /g, "_");
