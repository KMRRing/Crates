# Refinery
A course in how a refinery works (October 2026, rebuilt on Calibre's pattern at Korbi's request): thirteen chapters of levels from the crude unit to co-processing renewables, each level a lesson, then a plant to run on a flowsheet, then an exam. Par is the LP's (linear programme's) best plan for the level; stars are three at par (within $0.10/bbl), two within $0.50, one within $1.50, and only with the plant running. Three invented refineries (Alder Point, Brackwater, Kestrel Flats: "another fictional refinery", Korbi, October 2026) carry the late chapters, with no real plant's name or figures.

## Rulings
- Co-processing is its own chapter (Korbi, October 2026: "lessons on co-processing of different feedstocks there").
- A stream split several ways can lock a share (Korbi, October 2026: one share to hold while another moves).
- The lines panel fades (Korbi, October 2026: a whole refinery's flowsheet is a hundred lines, and most of a cracker's products have only one place to go).
- Hide filters and draggable units (Korbi, November 2026, the brief; not his exact words): a hidden class of line is not drawn at all, not faded, and nothing is left dangling; a unit or product box can be dragged and its lines follow; Reset layout returns to the default.
- The hint goes by how standard a pattern is (Korbi, October 2026: start with the obvious, fine-tune at the end). What counts as practice is refining's, not the course's (Korbi, October 2026: the statements must make sense in the real world).
- An off-spec product shows the blend inputs causing it (Korbi, October 2026).
- Where a share makes or breaks a product's spec the margin jumps, and that edge is generally where a plan earns most (Korbi, October 2026): the slider marks and stops on those edges.
- Par's plans must make sense in the real world (Korbi, October 2026): the limits no product can be sold without (flash point, fuel oil's viscosity and density, diesel's density window and distillation, gasoil's cetane, petrol's vapour pressure) are in every level, or par found plans no refinery could sell.
- An exam asks what carries over to any refinery (Korbi, October 2026: a figure that holds for one plan teaches nothing to take elsewhere).
- Together: the same level and start for everyone; Submit is asked once and is final; the highest margin wins, then the quicker. Hints don't show.

## Traps
- Par for every level, crude and market is kept in `refinery-par.js` (`node tests/refinery.mjs --write-par`; the test fails while it's stale). A level that starts from another's par (chapter 12's; 13.6 from 13.5, by `running` in `refinery-levels.js`) reads it, so run `--write-par` twice after changing the first.
- A plan kept in `refinery-par.js` is one of the solver's starts, so a plan once found is never lost to a search that wandered elsewhere. It is kept as the shares that actually flowed: where a full unit sent feed back to where it would have gone, the plan says so, or following it overfills the unit.
- A renewable's ticket is valued along the whole chain (what a kilogram earns downstream as the plan routes it), not one step back: the one-step gradient never sent fats to the FCC.
- 6.3 and 6.4 price HSFO at $65: at $70, cutting vacuum residue into fuel oil earned as much as coking it and par left the coker idle.
- Urals stays only in chapter 1: a lesson whose answer was to buy it would teach a trade the EU's embargo ended.
- The hint's trims come last and only while the plan is short of par: a few thousandths of a point of heavy vacuum gas oil kept from 8.1's hydrocracker spill into fuel oil and put it off spec.
- An off-spec miss finer than the figures shown is told to as many places as part it from the limit ("cetane 50.97 under 51.0", never "51.0 under 51.0").
- A slider's edge sheet is built once while it's open and only updated; rebuilt on every move it replaced the slider under the finger. The slider is drawn by the page, not the browser (edges are placed by the thumb's width, and iOS moves a range only by its thumb). A drag holds the stream's other shares as they were when it began.
- The default layout comes from the level alone, so the routing never moves a box. Dragged boxes are kept per level in `refinery:layout` with a signature of the level's units and its layout, so a level whose units change wipes its saved positions; the hidden classes are `refinery:hide`. Both are `refinery:` keys so a watching partner sees the same sheet. Offsets are clamped to 1.5 times the default sheet.
- Hiding keeps a node that is off spec or selected, and a culprit stream of an off-spec product stays named when hidden ("from the C4 (hidden)", with a link to show it). Fuel gas is one stream in the model, so "off-gas" and "fuel gas" are one class.
- Two works in one plant (Brackwater's `cdu2`) cut the same crude the same way, so each cut is one stream whichever column made it.
- Held sideways (README, Bigger screens), the flowsheet takes the left, all the height under the header, and the strip, the brief and the margin stand beside it.
