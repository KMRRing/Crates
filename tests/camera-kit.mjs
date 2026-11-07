// The shared 3D camera kit (camera-kit.js): the pure turn / pinch / wheel maths and the gestures bindOrbit makes of pointer
// events. Run: node tests/camera-kit.mjs
import { turn, pinchTo, wheelTo, bindOrbit } from "../camera-kit.js";
let bad = 0;
const check = (ok, what) => { console.log(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) bad++; };
const near = (a, b) => Math.abs(a - b) < 1e-9;

const PITCH = [0.2, 1.2], ZOOM = [0.3, 1.8], v0 = { yaw: 0, pitch: 0.7, dist: 20 };
// ---------- the maths ----------
let v = turn(v0, 100, 0, PITCH);
check(near(v.yaw, -0.65) && v.pitch === 0.7 && v.dist === 20, "dragging right turns the table left (yaw falls), pitch and distance stay");
check(turn(v0, 0, 1000, PITCH).pitch === 1.2 && turn(v0, 0, -1000, PITCH).pitch === 0.2, "the tilt stops at both ends of its range");
check(pinchTo(v0, 100, 50, 20, ZOOM).dist === 36, "fingers closing zoom out, held at 1.8 × fit");
check(pinchTo(v0, 50, 100, 20, ZOOM).dist === 10 && pinchTo(v0, 10, 1000, 20, ZOOM).dist === 6, "fingers opening zoom in, held at 0.3 × fit");
check(pinchTo(v0, 0, 50, 20, ZOOM) === v0, "a pinch with no starting spread changes nothing");
check(wheelTo(v0, 100, 20, ZOOM).dist > 20 && wheelTo(v0, -100, 20, ZOOM).dist < 20, "the wheel zooms out going one way and in the other");
check(wheelTo(v0, 1e6, 20, ZOOM).dist === 36 && wheelTo(v0, -1e6, 20, ZOOM).dist === 6, "the wheel is held in the same range");
check(v0.yaw === 0 && v0.dist === 20, "the functions leave the view they are given alone");

// ---------- the gestures, on an element that only keeps its listeners ----------
const el = { style: {}, L: {}, addEventListener(t, f) { (this.L[t] ||= []).push(f); }, removeEventListener(t, f) { this.L[t] = (this.L[t] || []).filter(x => x !== f); }, setPointerCapture() {} };
const fire = (t, e) => (el.L[t] || []).forEach(f => f({ preventDefault() {}, ...e }));
let view = { ...v0 }, sets = 0, dones = 0, resets = 0, clock = 1000;
const kit = bindOrbit(el, { get: () => view, fit: () => 20, set: x => { view = x; sets++; }, done: () => dones++, reset: () => resets++, pitch: PITCH, zoom: ZOOM, now: () => clock });
check(el.style.touchAction === "none", "the element stops the browser scrolling under a drag");
fire("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 });
fire("pointermove", { pointerId: 1, clientX: 40, clientY: 10 });
check(sets === 1 && near(view.yaw, -0.26) && near(view.pitch, 0.755), "one finger dragging turns and tilts");
fire("pointerup", { pointerId: 1 });
check(dones === 1 && resets === 0, "lifting the finger keeps the view, and a drag is not a tap");
fire("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 }); fire("pointerup", { pointerId: 1 });
clock += 100;
fire("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 }); fire("pointerup", { pointerId: 1 });
check(resets === 1, "two still taps within a third of a second put the view back");
clock += 1000;
fire("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 }); fire("pointerup", { pointerId: 1 });
clock += 1000;
fire("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 }); fire("pointerup", { pointerId: 1 });
check(resets === 1, "two taps far apart in time are not a double tap");
view = { ...v0 }; sets = 0;
fire("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 }); fire("pointerdown", { pointerId: 2, clientX: 100, clientY: 0 });
fire("pointermove", { pointerId: 2, clientX: 100, clientY: 0 });
fire("pointermove", { pointerId: 2, clientX: 50, clientY: 0 });
check(sets === 1 && view.dist > 20 && view.yaw === 0, "two fingers closing zoom out and do not turn it");
fire("pointerup", { pointerId: 1 }); fire("pointerup", { pointerId: 2 });
view = { ...v0 }; dones = 0;
fire("wheel", { deltaY: -120 });
check(view.dist < 20 && dones === 1, "the wheel zooms in and keeps the view");
fire("dblclick", {});
check(resets === 2, "a double click puts the view back");
kit.off();
const before = sets;
fire("pointerdown", { pointerId: 1, clientX: 0, clientY: 0 }); fire("pointermove", { pointerId: 1, clientX: 30, clientY: 0 });
check(sets === before, "after off() the element is left alone");
process.exit(bad ? 1 : 0);
