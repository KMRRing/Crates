// Entry point: solo by default, together when the address carries ?room=CODE.
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

const solo = createSolo({ onTogether: pool => startTogether(pool), setPoolParam });
const coop = createCoop({ onLeave: () => solo.start(), setRoomParam, setPoolParam });

async function startTogether(pool) {
  if (!(await coop.create(pool))) solo.start();
}

const params = new URLSearchParams(location.search);
const pool = parsePool(params.get("cat"));
const room = (params.get("room") || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);

solo.start(pool);
if (room.length === 4) {
  coop.join(room).then(ok => { if (!ok) { setRoomParam(null); solo.start(); } });
}
