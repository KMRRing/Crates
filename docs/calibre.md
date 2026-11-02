# Calibre

Learn watchmaking by drafting movements the way watchmakers do, on the calibre plan: the plate seen from above, each
arbor a point, each wheel and pinion a circle of its pitch diameter on a layer (1 to 5 the train's, D1 to D3 the dial
side). Choose a part from the tray: faint circles show where its arbor would have to stand to mesh with each wheel on
that layer; tap an arbor to add it there, or near a wheel to set a new arbor that snaps into mesh. Drag your own arbors;
tap one to see how it turns or take a part off.

Meshing with two wheels at once (31 October 2026; Korbi: placing a gear "can be a bit fiddly when there's two existing
gears and you want to place one that gets both"). Where two of those circles cross, one wheel meshes with both, and a
green dot marks the place (in 3D too, on the layer's plane). A tap or a drag within three quarters of the single snap's
reach of a dot (the reach is 1.2 mm or the wheel's own radius, whichever is more) snaps to it, ahead of the nearest
circle, which would have left the wheel touching one of the two. A place that would put the wheel off the plate is
left out, and wheels on another layer or of another module have no circles, as they can't mesh. The circles and the
crossings are `meshCircles` and `meshPoints` in `calibre-engine.js`, which `snap` and the plan's guides both use, so
what the dot shows is where the snap goes.

3D (the button over the zoom, October 2026) pulls the movement apart: each layer at a height of its own, drawn with the
plan's own artwork under one axonometric map (turned by the azimuth, tilted by the elevation, lifted by its height), so
straight down it is the plan and the button swings the camera between the two. The main plate is the floor and the side
the level is worked on faces up (the train's layers rising, the dial side's hanging under it with the hands below, or
the other way up for a level under the dial), so nothing is mirrored and every wheel turns as on the plan. Each part
keeps its thickness, the arbors stand through the layers as steel staffs, a bridge's post stands up through the train,
and a rail at the left names each layer at its height: a tap on a name builds on that layer, a tap on a part picks it
and its layer, and with a part in hand a tap places it on its layer's plane, where the finger meets it. A drag turns the
movement the way the finger goes, as any 3D viewer does: across spins it about its staffs with the near edge following
the finger, down tips its top towards you, up tips it away and over to show the back. (Until October 2026 a drag moved
the camera instead, so the movement turned against the finger and down flattened it.) Pinch and the buttons zoom, and the
parts on the layer in hand are named where they sit. The view you chose is kept (`calibre:view`).
Each staff ends in its pivot as on the plan (a red jewel in its chaton where the arbor carries the train, a grey stud
where it carries only the dial's side, a black head for a bridge's post), and the fixed arbors keep their names
(31 October 2026; Korbi: in 3D "you don't get arbor marker for the output the same you do in 2d"). The Output of an early
level has no part yet, so no staff either, and the 3D view drew nothing where it stood.

The engine (`calibre-engine.js`) runs the plan as it would really turn, at real size (one module, 0.1 mm a tooth, or a
gear's own finer module, which meshes only its own kind): ratios and directions through every mesh, a finger pushing a
star wheel or a date ring one tooth a turn, locked loops, no wheel over another arbor's pivot on its side of the plate,
nothing off the plate (round, or the Reverso's rectangle). The escapement is built from its real parts, a club-tooth
escape wheel, a pallet fork whose stones must reach its teeth and a balance in line at the end of the fork: no fork and
the spring runs away, a fork alone locks after one tick, both and the balance's beat sets the pace. Wind coils the
mainspring in its barrel; the watch then runs down over its power reserve, the balance swinging in real time and its
amplitude falling as the spring weakens, the escape wheel stepping half a tooth a beat at real speed.

Teaching (October 2026). Every level opens with its lesson (`calibre-lessons.js`), its ideas a step at a time, each
with a picture of the part it's about on its own and running (`calibre-scenes.js`): two wheels with the mesh between
them lit, a wheel and pinion on one arbor in 3D, a train turning in time-lapse with its turns or rates counted under
it, a mainspring winding and letting down, an escapement ticking in slow motion (or at its real beat) with its beats
counted, a balance's amplitude falling as the spring runs down, a finger stepping a star, a locked triangle straining.
A picture is a small mechanism of its own, the level's plate as it starts (its problem, never its answer), or an
earlier level's finished work, framed close on what it's about (the rest drawn faint or left out), with names of its
own on its parts; the demonstrations use other counts than the level's (an 80 driving a 40 where the level wants a
60 and a 30) so they show the idea and leave the arithmetic to you. A chapter's first level opens with what the
chapter is about. The last step is the task: the level's plate with what drives it and what each goal's arbor should
do written on it, what usually goes wrong ("watch out for"), and how to build, folded away; Build it closes it. Step
with Next and Back, the dots, the arrow keys or a swipe across the picture; Lesson, in the brief and the menu, opens
it again.

On the plate: the goals show live what each arbor does and what it should. Workings follows the train to the first
goal not yet met (all met: to the end of the longest path) as a chain, each arbor's name and between them the step's
ratio (×8 speeding up, ÷3 slowing down, a finger, a reverser's clutch, a jumper holding two together): a tap on a
ratio isolates that mesh, its two arbors drawn full and the rest faint, the mesh lit, the plan framed on them, and says
it in words ("The 80-tooth wheel on Centre wheel drives the 10-leaf pinion on Third wheel: 80 over 10 is ×8, faster,
and the other way round"); the last chip takes the whole path. Tap an arbor and the inspector says what drives it and
what it drives, mesh by mesh; Isolate shows it with just those, framed above the inspector (in 3D the stack keeps clear
of it too), and follows the arbor you tap next. Hint gives two or three graded nudges (a hint caps the stars at two); a
Glossary of the craft's words; Undo; keys (1–8 layers, W wind, Z undo, H hint, Delete, Esc). Stars for par (fewest
parts).

Tests (October 2026): once a level runs, It runs offers a test on what you made and what its lesson taught (Test, in
the brief and the menu, takes it again; the lesson's last step says it's coming). About ten questions of five kinds:
pick one of several, type a number or a word, tap a part on the picture, name the part in the ring (picked or typed),
put a train in order. The arithmetic comes from your own design, so its numbers are yours: a mesh you put in and its
ratio (asked so the answer is at least one: how many times the pinion turns for a turn of its wheel, or how many turns
of a pinion make a turn of the wheel it drives), how far apart two arbors stand, the train's ratio in all, how fast
the goal's arbor turns from the train's first, which way it turns, the beat, the power reserve, a finger's star. Then
reading the movement: a part to tap (one you put in, or one the goals are about, or the arbor that turns once a
minute), a part to name (its arbor drawn with that part alone, ringed, the rest faint), the train in order, the layer
two parts meet on, read off the 3D view. Then the level's own questions on its ideas (two to four a level, the history
and the arithmetic of the lesson), and a word or two the level brought in, from the glossary, asked one of three ways:
type it from its meaning, pick it, or pick its meaning. An arbor you added is named for what it is (the third wheel)
when it stands where the solution's does on the train, else for what it carries ("your 10/75 arbor"). A typed number
reads the English way or the European (7,5 is 7.5; 18,000 is eighteen thousand); a typed word forgives case, accents,
an article and a plural. After each answer: right or not, the right answer, and why; a tap that misses rings and names
both parts on the picture, what you tapped and what was asked for, so a wrong tap still teaches a name. Three in four
pass; the best is kept (in calibre:progress, so it syncs) and shown on the brief's Test link and in the course. The
glossary has grown to 75 words, and no definition says its own word or carries a figure: a test offers a definition
among others, and a lone figure would mark the right one out. Questions follow the subject banks' rule
(tests/banks.mjs): the right option mustn't stand out as the longest or the only one with a figure.

The course is a map of every chapter, folded, the one you're in open: how many levels run and the stars won, Continue
to the first level not yet running, and each level a picture of its plate (your design as you left it, the solution
once it runs, else its start), framed on where its work happens, with a line on what it teaches and its stars.

Your design is kept on each level as it changes (October 2026; the twelve levels last changed), so a reload, another
device on your solo code or a visit to another level brings the plate back as you left it, and a partner watching sees
each part go in (it used to see the level as it starts). Start this level again, in the menu, forgets it. A design
kept against an older version of a level (its fixed arbors or its tray since changed) isn't restored.

The course (`calibre-levels.js`, 55 levels): 1 Gears (two wheels, idlers, wheel and pinion, speeding up, a ratio hunt,
a locked triangle, clearance round a post), 2 The going train (the centre wheel, small seconds, choosing the counts, a
repair that keeps the tooth sum), 3 The escapement (the runaway and the pallet fork, the balance, the beat, the faster
beat, choosing the balance, the escape wheel's teeth), 4 The motion works (the minute wheel, twelve to one, the 24-hour
hand, the whole watch), 5 Power (more hours from the barrel ratio, a week with an intermediate wheel, force or hours: the balance's
amplitude from the torque reaching it against the reserve, constant force: a fusée or a remontoire keeping the
swing between 230 and 310 degrees over the whole run), 6 Winding and
setting (ratchet and click, the setting wheels), 7 Calendars and the moon (the date ring and its finger, the 59-tooth
moon, the 135-tooth moon good for 122 years), 8 Famous calibres (the Unitas 6497 with small seconds at nine, the
Reverso's rectangular calibre, the El Primero's 36,000 vph, the Valjoux 7750's oscillating pinion, Harrison's H4: steady force and regulation
to a second a day), 9 The chronograph (a module under the dial driven from the
fourth wheel: the chronograph wheel, start and stop with a coupling lever swinging about the driving wheel, a finger
counting minutes on a 30-tooth star, heart cams for reset, the flyback lever,
the Datograph's jumping counter against a creeping one), 10 Automatic winding (one reverser winds one way, a second
makes either swing of the rotor wind), 11 Regulating (the index on a balance whose beat comes from its inertia and its
hairspring's stiffness, to within five seconds a day; a free-sprung balance chosen by its inertia). 12 Pushers and
jumpers (the jumping hour: a twelve-point star held to the hour wheel by a jumper, a press jumping only the travel hand,
home time on a 24-hour hand; the column wheel, twice as many ratchet teeth as columns; the alarm, an hour trip and a minute trip letting it go at the
set minute, once in twelve hours), 13 Calendars that know (the
annual calendar's twelve-notch cam, the perpetual calendar's four-year cam with its leap year, cut month by month in an
editor, the equation of time on a kidney cam, a secular calendar that knows 2100 isn't a leap year), 14 Striking (the hour snail read by the rack from twelve o'clock, numbered in an editor and struck on a
synthesised gong; the quarter snail, and the whole repeater: hours low, quarters double, minutes high), 15 The tourbillon (Breguet's cage: the fixed fourth wheel and the escape pinion rolling round it).
Mechanisms with states (started and stopped, the rotor either way, running and pressed) are judged in each, with
buttons to switch between them. The chronograph levels' empty coupling arbors are under the dial, so they no longer
start with a clash over the train's pivots; the quarter snail is drawn with its four steps (it was drawn as twelve,
eight of them broken); a reverser is drawn gilt and steel (it was black); the workings follow a reverser's one-way
clutch, the way it passes. `tests/calibre.mjs` proves the engine's rules, that every level is unsolved at the start and
solved by its worked solution, from its tray, within par, that the workings multiply to the train's ratio, that
every lesson step builds its picture from parts it holds, names nothing missing, shows no solution of its own level or
a later one, and turns no faster than two turns a second, and that every level's test, dealt three times, asks five to
eleven questions whose pictures hold what they name and whose right answers are right (typed either way) and wrong
ones wrong, with no choice giving itself away; a test on 2.3 built the other way round from its solution (80 into 8,
then 72 into 12) asks those counts.

Held sideways (README, Bigger screens), the plan (or the movement in 3D) takes the left, all the height under the header, and the level's brief, the parts (wrapped into rows rather than scrolled past) and the controls stand beside it, the brief scrolling inside if it's long.
