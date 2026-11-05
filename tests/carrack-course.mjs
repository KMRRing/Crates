// Carrack's course (carrack-course.js): every scene is a legal game state, every ported named in it exists, and every answer
// a lesson gives is the one the rules work out: a quiz with a calc has the option the calc gives, an orders choice has exactly
// one option the rules accept (and it is the answer), a tap step has right and wrong ports on its map.
import { COURSE, STEPS, stateOf, shownPorts, rightOf, isTask } from "../carrack-course.js";
import { PORTS, IDX } from "../carrack-map.js";

let bad = 0;
const check = (ok, what) => { if (!ok) { console.log(`FAIL ${what}`); bad++; } };

const lessons = COURSE.chapters.flatMap(c => c.lessons);
const ids = lessons.map(l => l.id);
check(new Set(ids).size === ids.length, "lessons have their own ids");
check(lessons.every(l => l.title && l.steps.length && l.steps.every(st => st.say)), "every lesson has a title and steps that speak");
check(COURSE.chapters.length >= 8, "the chapters of the plan are there");
check(lessons.filter(l => l.id.startsWith("p-")).length === 9, "each of the nine powers has a lesson");
check(lessons.at(-1).steps.at(-1).play === true, "the course ends in a game");

let quizzes = 0, calcs = 0, valid = 0, taps = 0;
for (const { step, where } of STEPS) {
  if (step.scene) {
    let s;
    try { s = stateOf(step.scene); } catch (e) { check(false, `${where}: the scene is not readable (${e.message})`); continue; }
    const ports = shownPorts(step.scene, s);
    check(ports.length >= 1 && ports.every(p => PORTS[p]), `${where}: the ports shown are real`);
    for (const k of Object.keys(step.scene.own || {}).concat(Object.keys(step.scene.fac || {}), step.scene.fort || [])) check(IDX[k] != null, `${where}: ${k} is a port`);
    check(s.fl.every(f => f.every(n => n >= 0 && n <= 3)), `${where}: no more than three fleets of a power in a port`);
    check(ports.length <= 12, `${where}: the map is not crowded`);
  }
  if (step.quiz) {
    quizzes++;
    check(step.answer >= 0 && step.answer < step.quiz.length, `${where}: the answer is one of the choices`);
    check(new Set(step.quiz).size === step.quiz.length, `${where}: the choices differ`);
    if (step.calc || step.valid) {
      check(!!step.scene || step.calc?.length === 0, `${where}: a worked answer has a scene`);
      const r = rightOf(step);
      if (step.valid) { valid++; check(r.length === 1 && r[0] === step.answer, `${where}: the rules accept exactly the option ${step.answer} (accepted: ${r})`); }
      else { calcs++; check(r[0] === step.answer, `${where}: the rules give "${step.calc(stateOf(step.scene ?? { powers: ["hanse", "venice"] }))}", the lesson says "${step.quiz[step.answer]}"`); }
    }
  }
  if (isTask(step)) {
    taps++;
    const s = stateOf(step.scene), ports = shownPorts(step.scene, s), right = ports.filter(p => step.pick(s, p));
    check(right.length >= 1 && right.length < ports.length, `${where}: the map has right ports and wrong ones`);
  }
}
check(quizzes >= 25 && calcs + valid >= 20, `enough worked choices (${quizzes} choices, ${calcs} calculated, ${valid} by the rules, ${taps} taps)`);

console.log(bad ? `\n${bad} failed` : "\nall passed");
process.exit(bad ? 1 : 0);
