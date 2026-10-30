// Entry point: solo by default; together when the address carries ?room=CODE;
// ?b=CODE opens a specific board, ?cat=countries|commodities|mixed picks the pool,
// ?run=CODE makes this device follow a solo run synced from another device.
import { parsePool, POOL_PARAM } from "./core.js";
import { createSolo } from "./solo.js";
import { createCoop } from "./coop.js";
import { bindSwitcher, APPS } from "./apps.js";
import { busy } from "./loading.js";
import "./pwa.js";

function setParam(key, value) {
  const u = new URL(location.href);
  if (value) u.searchParams.set(key, value); else u.searchParams.delete(key);
  history.replaceState(null, "", u);
}
const setPoolParam = pool => setParam("cat", POOL_PARAM[pool]);
const setRoomParam = code => setParam("room", code);
const setBoardParam = code => setParam("b", code);

bindSwitcher(document.getElementById("appsBtn"), "crates");
document.querySelector(".cr-mark").innerHTML = APPS.find(a => a.id === "crates").logo;

const solo = createSolo({ setPoolParam, setBoardParam });
const coop = createCoop({ onLeave: () => solo.start(), setRoomParam, mySettings: () => solo.settings() });

const params = new URLSearchParams(location.search);
const pool = parsePool(params.get("cat"));
const room = (params.get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
const runCode = params.get("run");
if (runCode) setParam("run", null);

// a room in the address: the room's board from the first moment, never your own while the room is joined (your
// partner would be on another board until it was), and your own only if the join doesn't come off
if (room.length === 4) {
  const joined = busy("Joining your partner", { delay: 0 });
  coop.join(room).then(ok => { joined(); if (!ok) { setRoomParam(null); solo.start(pool, params.get("b"), runCode); } });
} else solo.start(pool, params.get("b"), runCode);
