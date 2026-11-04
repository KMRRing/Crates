// The Earth's pictures, drawn off the page's thread (columbiad-globe.js asks; the maths is columbiad-sphere.js, the same function the
// page would run itself, so a picture here is byte for byte the one the page would have made). A sphere is a whole disc of pixels read
// through a map thirty times a second, which is more than a phone's page can do between two frames while it also draws the scene.
//
// Messages in:  { map: { w, h, data } }  the Earth's photograph (RGBA bytes);  { clouds: { w, h, a } }  the clouds' map;
//               { draw: { id, S, sun, tilt, roll, pad, turn, tint }, buf }  a picture, into `buf` if it is the right size.
// Messages out: { id, S, turn, buf, air }  the picture's bytes (`air`, the glow round the disc, only the first time for a size).
import { buildSphere, renderSphere, withMips } from "./columbiad-sphere.js";

let map = null, clouds = null;
const geos = new Map();                                        // S -> { geo, sk, air (not yet sent) }

onmessage = ({ data: m }) => {
  if (m.map) { map = withMips({ w: m.map.w, h: m.map.h, data: new Uint8ClampedArray(m.map.data) }); geos.clear(); }
  if (m.clouds) clouds = { w: m.clouds.w, h: m.clouds.h, a: new Float32Array(m.clouds.a) };
  if (!m.draw || !map) return;
  const { id, S, sun, tilt, roll, pad, turn, tint } = m.draw;
  const sk = `${S}|${sun[0].toFixed(3)},${sun[1].toFixed(3)}`;
  let e = geos.get(S);
  if (!e || e.sk !== sk) {
    geos.delete(S);
    while (geos.size >= 2) geos.delete(geos.keys().next().value);            // the geometry is big: only the two sizes in use are kept
    const air = new Uint8ClampedArray(S * S * 4);
    e = { sk, air, geo: buildSphere(S, { pad, tilt, roll, sun, earth: true, texW: map.w, texH: map.h, mips: map.mips.length }, air) };
    geos.set(S, e);
  }
  const buf = m.buf && m.buf.byteLength === S * S * 4 ? new Uint8ClampedArray(m.buf) : new Uint8ClampedArray(S * S * 4);
  renderSphere(e.geo, buf, map, clouds, turn, tint);
  const out = { id, S, turn, buf: buf.buffer }, send = [buf.buffer];
  if (e.air) { out.air = e.air.buffer; send.push(e.air.buffer); e.air = null; }
  postMessage(out, send);
};
