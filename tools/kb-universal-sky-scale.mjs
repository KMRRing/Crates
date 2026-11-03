// How the Almanac's sky scales: lays out kb/ as it is, then kb/ copied 2, 4 and 6 times over (7,838 → 15,676 → 31,352 →
// 47,028 stars; each copy keeps its own links), timing almanac-sky-build.mjs's own buildLayout and sizing the file it would write.
// Read-only: it writes nothing into the repo. Usage: node tools/kb-universal-sky-scale.mjs
import { buildLayout, encode } from "../almanac-sky-build.mjs";
import { ENTITIES } from "../kb/entities.js";
import { LINKS } from "../kb/links.js";

const copies = k => {
  if (k === 1) return { entities: ENTITIES, links: LINKS };
  const entities = [], links = [];
  for (let c = 0; c < k; c++) {
    const tag = c ? `~${c}` : "";
    for (const e of ENTITIES) entities.push(c ? { ...e, id: e.id + tag, same: e.same ? e.same + tag : e.same, crates: undefined } : e);
    for (const l of LINKS) links.push(c ? { ...l, from: l.from + tag, to: l.to + tag } : l);
  }
  return { entities, links };
};
for (const k of [1, 2, 4, 6]) {
  const { entities, links } = copies(k);
  const t = Date.now();
  const lay = buildLayout(entities, links);
  const ms = Date.now() - t;
  const file = encode(lay);
  console.log(`${lay.ids.length} stars: layout ${ms} ms; file ${(file.ids.length + file.xyz.length) / 1024 | 0} KB (ids ${(file.ids.length / 1024) | 0} KB, positions ${(file.xyz.length / 1024) | 0} KB)`);
}
