// Entry point: solo by default; together when the address carries ?room=CODE;
// ?b=CODE opens a specific board, ?cat=countries|commodities|mixed picks the pool.
import { parsePool, POOL_PARAM } from "./core.js";
import { createSolo } from "./solo.js";
import { createCoop } from "./coop.js";

function setParam(key, value) {
  const u = new URL(location.href);
  if (value) u.searchParams.set(key, value); else u.searchParams.delete(key);
  history.replaceState(null, "", u);
}
const setPoolParam = pool => setParam("cat", POOL_PARAM[pool]);
const setRoomParam = code => setParam("room", code);
const setBoardParam = code => setParam("b", code);

const solo = createSolo({ onTogether: (pool, settings) => startTogether(pool, settings), setPoolParam, setBoardParam });
const coop = createCoop({ onLeave: () => solo.start(), setRoomParam, setPoolParam });

async function startTogether(pool, settings) {
  if (!(await coop.create(pool, settings))) solo.start();
}

const params = new URLSearchParams(location.search);
const pool = parsePool(params.get("cat"));
const room = (params.get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

solo.start(pool, params.get("b"));
if (room.length === 4) {
  coop.join(room).then(ok => { if (!ok) { setRoomParam(null); solo.start(); } });
}
