// An offline party's links (October 2026): two phones on the same Wi-Fi, with no internet, connect directly over WebRTC,
// the browser's own phone-to-phone channel. Before they can, each must know the other's keys and addresses (an SDP, a
// session description); online a server passes them, here QR codes do, both ways: the guest scans the host's code, the
// host scans the code then on the guest's screen. No one scan can do it (each side needs the other's keys).
//
// A browser's own description runs to a few hundred characters of boilerplate: only what differs between two phones is
// sent (the ICE username and password, which let each answer the other's connectivity checks; the fingerprint of the
// certificate its encryption uses; the addresses it can be reached at), packed in bytes, and the rest is written back
// round it on the other phone. The code is a QR code of ~100 bytes, quick to read from a screen.
//
// An address may be a phone's own (192.168.8.12) or a name standing for it (<uuid>.local, found by asking the network
// with multicast DNS): a browser hides a page's local address behind such a name unless the page has been allowed the
// camera, which the scanning asks for anyway, so the phone that has just scanned shows its real address, and one
// direction that works is enough for the two to find each other.

const MAGIC = "AL1:";                         // an Almanac link code, version 1: anything else scanned is turned down
const KIND = { offer: 1, answer: 2 };
const ALG = ["sha-256", "sha-384", "sha-512"];
const RTC = { iceServers: [] };              // the local network only: there's no internet to find a public address on
const MAX_CANDIDATES = 4;
const enc = new TextEncoder(), dec = new TextDecoder();

// ---------- the code: bytes, written as base64url ----------
const b64 = bytes => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));

function ipv6Bytes(s) {
  const [head, tail = null] = s.split("::");
  const groups = h => (h ? h.split(":") : []);
  let a = groups(head), b = tail === null ? [] : groups(tail);
  const v4 = arr => (arr.length && arr.at(-1).includes(".") ? arr.pop().split(".").map(Number) : null);
  const last4 = v4(b.length ? b : a);
  const words = n => n.map(x => parseInt(x, 16));
  const fill = 8 - a.length - b.length - (last4 ? 2 : 0);
  const all = [...words(a), ...(tail === null ? [] : Array(fill).fill(0)), ...words(b)];
  const out = [];
  for (const w of all) out.push(w >> 8, w & 255);
  if (last4) out.push(...last4);
  if (out.length !== 16 || out.some(x => !(x >= 0 && x <= 255))) throw new Error(`not an IPv6 address: ${s}`);
  return out;
}
function ipv6Text(bytes) {
  const w = [];
  for (let i = 0; i < 16; i += 2) w.push(((bytes[i] << 8) | bytes[i + 1]).toString(16));
  return w.join(":");                          // uncompressed is valid, and both browsers read it
}
const uuidBytes = s => s.replace(/-/g, "").match(/../g).map(h => parseInt(h, 16));
const uuidText = b => { const h = [...b].map(x => x.toString(16).padStart(2, "0")).join(""); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };

/** An address as the code keeps it: [family, bytes]: 4 IPv4, 6 IPv6, 16 a multicast DNS name (its UUID). */
function packAddress(addr) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(addr)) return [4, addr.split(".").map(Number)];
  const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.local$/i.exec(addr);
  if (m) return [16, uuidBytes(m[1])];
  if (addr.includes(":")) return [6, ipv6Bytes(addr)];
  return null;                                  // a name of another kind: not one a phone on the network can be reached at
}
const unpackAddress = (family, b) => (family === 4 ? [...b].join(".") : family === 6 ? ipv6Text(b) : `${uuidText(b)}.local`);
const ADDRESS_BYTES = { 4: 4, 6: 16, 16: 16 };

/** What a session description says that another phone needs: { ufrag, pwd, alg, fingerprint (bytes), setup, candidates }. */
export function readSdp(sdp) {
  const line = key => sdp.match(new RegExp(`^a=${key}:(.+)$`, "m"))?.[1]?.trim() ?? null;
  const fp = line("fingerprint")?.split(/\s+/) || [];
  const candidates = [];
  for (const m of sdp.matchAll(/^a=candidate:\S+ \d+ (\S+) \d+ (\S+) (\d+) typ host/gm)) {
    if (m[1].toLowerCase() !== "udp") continue;           // a TCP candidate needs the other side to listen: not here
    const packed = packAddress(m[2]);
    if (packed) candidates.push({ address: m[2], port: Number(m[3]), family: packed[0] });
  }
  // real addresses first (they need no multicast DNS on the network), then names, IPv4 before IPv6
  const rank = c => ({ 4: 0, 6: 1, 16: 2 })[c.family];
  candidates.sort((a, b) => rank(a) - rank(b));
  return {
    ufrag: line("ice-ufrag"), pwd: line("ice-pwd"), alg: (fp[0] || "").toLowerCase(),
    fingerprint: (fp[1] || "").split(":").map(h => parseInt(h, 16)), setup: line("setup"),
    candidates: candidates.slice(0, MAX_CANDIDATES),
  };
}

/** A link code: kind ("offer" or "answer"), id (the offer it's for), the sender's name, and readSdp()'s fields. */
export function encodeLink({ kind, id, name = "", ufrag, pwd, alg, fingerprint, setup, candidates }) {
  const out = [KIND[kind], id >> 8, id & 255, setup === "passive" ? 1 : 0];
  const text = s => { const b = [...enc.encode(s)].slice(0, 60); out.push(b.length, ...b); };
  text(ufrag); text(pwd);
  out.push(Math.max(0, ALG.indexOf(alg)), fingerprint.length, ...fingerprint);
  text(name);
  out.push(candidates.length);
  for (const c of candidates) { const [family, bytes] = packAddress(c.address); out.push(family, ...bytes, c.port >> 8, c.port & 255); }
  return MAGIC + b64(out);
}
/** A scanned code read back, or null if it isn't one (another QR code, or a damaged one). */
export function decodeLink(code) {
  if (typeof code !== "string" || !code.startsWith(MAGIC)) return null;
  try {
    const b = unb64(code.slice(MAGIC.length));
    let i = 0;
    const byte = () => { if (i >= b.length) throw new Error("short"); return b[i++]; };
    const bytes = n => { if (i + n > b.length) throw new Error("short"); const s = b.slice(i, i + n); i += n; return s; };
    const text = () => dec.decode(bytes(byte()));
    const k = byte(), kind = Object.keys(KIND).find(key => KIND[key] === k);
    const id = (byte() << 8) | byte(), setup = byte() ? "passive" : "active";
    const ufrag = text(), pwd = text();
    const alg = ALG[byte()] || ALG[0], fingerprint = [...bytes(byte())];
    const name = text(), candidates = [];
    for (let n = byte(); n > 0; n--) {
      const family = byte(), address = unpackAddress(family, bytes(ADDRESS_BYTES[family] ?? 99));
      candidates.push({ address, port: (byte() << 8) | byte(), family });
    }
    if (!kind || !ufrag || !pwd || fingerprint.length < 20 || !candidates.length) return null;
    return { kind, id, name, ufrag, pwd, alg, fingerprint, setup: kind === "offer" ? "actpass" : setup, candidates };
  } catch { return null; }
}

/** The other phone's description written back out in full from its code, as a browser will take it. */
export function writeSdp(link) {
  const hex = link.fingerprint.map(x => x.toString(16).toUpperCase().padStart(2, "0")).join(":");
  return [
    "v=0", `o=- ${4611686018427387 + link.id} 2 IN IP4 127.0.0.1`, "s=-", "t=0 0", "a=group:BUNDLE 0", "a=msid-semantic: WMS",
    "m=application 9 UDP/DTLS/SCTP webrtc-datachannel", "c=IN IP4 0.0.0.0",
    ...link.candidates.map((c, n) => `a=candidate:${n + 1} 1 udp ${2122260223 - n} ${c.address} ${c.port} typ host generation 0`),
    "a=end-of-candidates",
    `a=ice-ufrag:${link.ufrag}`, `a=ice-pwd:${link.pwd}`,
    `a=fingerprint:${link.alg} ${hex}`, `a=setup:${link.setup}`, "a=mid:0", "a=sctp-port:5000", "a=max-message-size:262144", "",
  ].join("\r\n");
}

// ---------- the connection ----------
/**
 * Waits until the phone has found its addresses: until the browser says it's done, or a moment after the first one
 * (a name for multicast DNS can keep the browser looking for seconds more, and one address is enough here).
 */
function gathered(pc, ms = 4000) {
  return new Promise(resolve => {
    if (pc.iceGatheringState === "complete") { resolve(); return; }
    let soon = 0;
    const finish = () => { clearTimeout(soon); clearTimeout(cap); resolve(); };
    pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") finish(); });
    pc.addEventListener("icecandidate", e => {
      if (e.candidate && / udp /i.test(` ${e.candidate.candidate} `) && !soon) soon = setTimeout(finish, 400);
    });
    const cap = setTimeout(finish, ms);        // what it has by then is enough on a local network
  });
}
/** The channel once open; rejected if the connection fails (the other phone not on this network, or too slow). */
function opened(pc, channel, ms) {
  return new Promise((resolve, reject) => {
    if (channel.readyState === "open") { resolve(channel); return; }
    const fail = why => { clearTimeout(timer); reject(new Error(why)); };
    const timer = setTimeout(() => fail("timeout"), ms);
    channel.addEventListener("open", () => { clearTimeout(timer); resolve(channel); }, { once: true });
    pc.addEventListener("connectionstatechange", () => { if (pc.connectionState === "failed" || pc.connectionState === "closed") fail(pc.connectionState); });
  });
}
// one channel, the same on both phones (negotiated: no message to set it up), ordered and reliable
const channelOf = pc => pc.createDataChannel("almanac", { negotiated: true, id: 0, ordered: true });

/**
 * The host's side of one link: a connection waiting for a guest, its code to show. accept(reply) takes the code read
 * from the guest's screen and resolves with the open channel. Each guest gets a link of their own.
 */
export async function hostLink({ name, id = Math.floor(Math.random() * 65536) }) {
  const pc = new RTCPeerConnection(RTC), channel = channelOf(pc);
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  const code = encodeLink({ kind: "offer", id, name, ...readSdp(pc.localDescription.sdp) });
  return {
    id, code, pc, channel,
    async accept(reply, ms = 30000) {
      await pc.setRemoteDescription({ type: "answer", sdp: writeSdp(reply) });
      return opened(pc, channel, ms);
    },
    close() { try { pc.close(); } catch { /* already */ } },
  };
}

/**
 * The guest's side: the host's code read, a connection answering it, the code to show the host, and `open`, which
 * resolves with the channel once the host has scanned that code (the guest's checks wait for it: half a minute).
 */
export async function guestLink(offer, { name, ms = 45000 }) {
  const pc = new RTCPeerConnection(RTC), channel = channelOf(pc);
  await pc.setRemoteDescription({ type: "offer", sdp: writeSdp(offer) });
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  const code = encodeLink({ kind: "answer", id: offer.id, name, ...readSdp(pc.localDescription.sdp) });
  return { code, pc, channel, open: opened(pc, channel, ms), close() { try { pc.close(); } catch { /* already */ } } };
}
