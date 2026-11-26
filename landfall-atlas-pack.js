// Loads an Atlas area's pack (landfall-atlas/<region>/<area>.json and its two height grids, landfall-terrain-build.mjs's output) and
// keeps it for offline play: a pack is fetched the first time its area is opened and kept in a cache of its own, never in sw.js's
// list, so the app's download does not grow with the Atlas (Korbi, 27 Nov 2026: region packs downloaded on first open, then kept
// offline). The kept copies sit under addresses of their own (landfall-atlas-kept/<build stamp>/…), not the files' real ones: the
// service worker answers a real address from any cache it finds it in, query or none, so a copy kept there would stand in for a
// rebuilt pack for ever. A rebuild is a new stamp, so a new address: fetched once, and the area's older copies cleared.
import { grid, terrain, decode } from "./landfall-terrain.js";

const CACHE = "landfall-atlas-1";
const base = (region, area) => `./landfall-atlas/${region}/${area}`;

/** The bytes of a pack file: the copy kept for this build if there is one, else the network (then kept, older builds' cleared). */
async function bytes(file, built) {
  const keep = new URL(`./landfall-atlas-kept/${encodeURIComponent(built)}/${file.replace("./landfall-atlas/", "")}`, location.href).href;
  let cache = null;
  try { cache = await caches.open(CACHE); } catch { /* no Cache Storage (a private window): the network every time */ }
  let res = cache && await cache.match(keep);
  if (!res) {
    res = await fetch(file);
    if (!res.ok) throw new Error(`${file}: ${res.status}`);
    if (cache) {
      const tail = keep.slice(keep.indexOf("/", keep.indexOf("landfall-atlas-kept/") + 20));
      for (const old of await cache.keys()) if (old.url.endsWith(tail) && old.url !== keep) await cache.delete(old);
      await cache.put(keep, res.clone()).catch(() => {});
    }
  }
  return new Uint8Array(await res.arrayBuffer());
}
async function gunzip(u8) {
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const loaded = new Map();
/** Two summits of one name in an area (the Bernese Alps have two Breithorns) are told apart by their heights. */
export function tellApart(landmarks) {
  for (const l of landmarks) l.name = l.name.replace(/_/g, " ");          // a label written as a page's address (Pointe_de_la_Courte_Dune)
  const count = new Map();
  for (const l of landmarks) count.set(l.name, (count.get(l.name) || 0) + 1);
  for (const l of landmarks) if (count.get(l.name) > 1) l.name = `${l.name} (${l.listed || l.ele} m)`;
  return landmarks;
}

/** An area ready to play: its landmarks and starts, its grids and the terrain lookup over them, and `built`, its region's stamp. */
export function loadArea(region, area) {
  const key = `${region}/${area}`;
  if (!loaded.has(key)) loaded.set(key, (async () => {
    const built = (await regionIndex(region))?.built || "";
    const P = JSON.parse(new TextDecoder().decode(await bytes(`${base(region, area)}.json`, built)));
    const load = async (k, G) => {
      const g = grid([G.w, G.s, G.e, G.n], G.cols, G.rows, decode(await gunzip(await bytes(`${base(region, area)}.${k}.bin.gz`, built)), G.cols, G.rows));
      g.fine = k === "fine";
      return g;
    };
    const [fine, far] = await Promise.all([load("fine", P.fine), load("far", P.far)]);
    tellApart(P.landmarks);
    return { ...P, region, built, fine, far, at: terrain([fine, far]) };
  })().catch(e => { loaded.delete(key); throw e; }));
  return loaded.get(key);
}
const indexes = new Map();
/**
 * A region's list of built areas, its credits and its build stamp, or null if it has no pack yet: from the network when there is
 * one (so a rebuild is seen), else the copy kept from last time, in localStorage (a cache would be answered from by the worker
 * even online). Once a session.
 */
export function regionIndex(region) {
  if (!indexes.has(region)) indexes.set(region, (async () => {
    const key = `landfall:atlas-index-${region}`;
    try {
      const res = await fetch(`./landfall-atlas/${region}/index.json`, { cache: "no-cache" });
      if (!res.ok) throw new Error(String(res.status));
      const ix = await res.json();
      try { localStorage.setItem(key, JSON.stringify(ix)); } catch { /* full, or private */ }
      return ix;
    } catch {
      try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
    }
  })());
  return indexes.get(region);
}
