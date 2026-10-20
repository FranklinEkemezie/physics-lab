# Virtual Physics Lab

A three-dimensional laboratory in the browser for WAEC-style (and generally
school-level) physics practicals. You assemble real-looking apparatus on a
bench, take measurements by reading scales through a magnifying *reading lens*,
time swings with a stopwatch that has human reaction times, record your trials
in a table, plot the graph and get the value of the physical constant — with an
honest error bar.

Nothing is faked with a lookup table: the pendulum is integrated from its real
equation of motion, the compass needle is aimed at the real resultant of the
magnet's dipole field and the Earth's, the cells obey Kirchhoff's laws with a
finite meter resistance, and the light really bends by Snell's law — so the
errors you see are the errors a candidate really gets.

There are six practicals: **the simple pendulum** (`g`), **the field of a bar
magnet** (`m`), **Hooke's law** (the spring constant), **Ohm's law** (a cell's
e.m.f. and internal resistance), **refraction** (the refractive index of a
glass block), and **the specific heat capacity of water** (a bomb calorimeter and
an electric heater). Each hides its answer, so the number has to be measured.

A **model gallery** (*Models* in the top bar) shows the whole reusable apparatus
library — people, atoms, states of matter, circuit symbols, bench apparatus — and
lets you drop any piece straight onto the bench.

## Running it

```bash
npm install
npm run dev        # start the dev server (Vite), then open the printed URL
```

Other scripts:

| Script            | What it does                                             |
| ----------------- | -------------------------------------------------------- |
| `npm run dev`     | Dev server with hot reload.                              |
| `npm run build`   | Type-check, then produce a production bundle in `dist/`. |
| `npm run preview` | Serve the built bundle locally.                          |
| `npm run typecheck` | `tsc --noEmit`.                                        |
| `npm run verify`  | Run the physics self-checks (no browser needed).         |

### Moving around

The camera is a person standing at the bench, not a turntable. It pivots about
a point *on the bench*, next to the apparatus:

| Gesture                    | What it does                                              |
| -------------------------- | --------------------------------------------------------- |
| Drag                       | Look around the apparatus (or slide, in ✋ Pan mode)      |
| ✋ Pan mode, or shift-drag | Slide the whole view along the bench, not just rotate it  |
| 👁 Look mode               | Plain dragging rotates the view again                      |
| Scroll, or pinch           | Step towards whatever the cursor is over                   |
| Two-finger pinch           | Pan *and* zoom, like a touchpad                            |
| Shift-drag, or right-drag  | Slide along the bench (whatever the mode)                  |
| Double-click apparatus     | Step up to it                                              |
| Arrow keys, `+` / `-`      | Nudge the view                                             |
| `Home`, or *Reset view*    | Step back to the bench                                     |

The viewport toolbar in the corner folds away with the 🎛 tab if it gets in the
way; the choice is remembered.

The viewpoint is clamped to human ones: it never drops below the bench top or
climbs to a map view, and the pivot stays over the bench, so you cannot orbit
off into empty floor.

## The flagship practical

**Simple pendulum — determine `g`.** Choose it from the *Practical* menu at the
top. The apparatus (retort stand, boss head, clamp, split cork, thread, brass
bob, metre rule, stopwatch) is set up for you. Then:

1. **Change the length** by paying thread out of the cork (the slider) or by
   raising the clamp. The absolute length is deliberately *not* shown.
2. **Read the rule.** In the *Practical* tab, the reading lens magnifies the
   metre rule. Drag the red line to the centre of the bob, press *Use this
   reading*, then switch to *Bottom of cork* and do the same. `L` is the
   difference. Both marks sit at the same depth, so parallax **cancels** in `L` —
   the note under the lens shows the (equal) displacement so you can see why.
3. **Start the swing.** Drag the bob aside in the 3D view (or press *Release
   bob*). Let go to swing.
4. **Time it.** Press *START* (or the on-screen button, or the space bar) as the
   bob passes the centre; press *STOP* after `n` complete oscillations.
5. **Record** the trial (the *Record reading* button, or Enter).
6. Repeat for at least six lengths, then open the *Graph* and *Analysis* tabs.

The graph plots `T²` against `L`; the gradient gives `g = 4π² / gradient`, and
the *Analysis* tab reports `g` with its uncertainty, the intercept, `r²`, and
examiner-style notes on what went wrong.

### A hidden-`g` challenge

Under *Location* you can move the lab to the Moon, Mars or Jupiter — or to
**Planet X**, whose `g` is hidden. Measure it, then press *Reveal the true
value* to check.

## The second practical: plotting the field of a bar magnet

Choose **Plotting the field of a bar magnet**. A bar magnet is pinned across a
printed plotting sheet and the compass needle really does settle along the
*resultant* of the magnet's dipole field and the Earth's horizontal field, so:

- **Map the field.** Drag the compass anywhere and the needle follows. Press
  *Walk one step* to advance it 1 cm along the needle, leaving a pencil mark —
  repeated presses walk out a genuine field line. *New line* starts a fresh one.
  (A *training-wheels* switch draws the whole line through the compass for you.)
- **Measure the fall-off.** Put the compass on the *equatorial line* (printed
  across the sheet) and read the distance `d` from the scale and the needle
  deflection θ. There the magnet's field is perpendicular to the Earth's, so
  `tan θ = B/H`, and for a dipole `B = (μ₀/4π)·m/d³`. The graph of `tan θ`
  against `1/d³` is therefore a straight line through the origin whose gradient
  is `(μ₀/4π)·m/H`.
- **Find the moment.** The analysis turns the gradient into the magnet's moment
  `m`, with an uncertainty and `r²`. The moment is randomised for every fresh
  magnet and is not written on it — press *Reveal the true value* to check.
- The iron-filings card can be laid over the magnet for the classic sprinkle
  picture of the same field.

Realism here: the Earth's field is always present (so the compass swings back
to north far from the magnet), `d` is read to ±0.5 mm and θ to ±1°, error bars
are drawn from those two numbers, and the bar is only treated as a point dipole
beyond roughly its own length — the analysis says so when you get too close.

## Hooke's law — the spring constant

Choose **Hooke's law — extension of a spring**. Hang slotted masses on the
spring, let it settle, and read the pointer against the metre rule. Record the
load and the extension for five or six loads, plot `x` against `F`, and take `k`
from the reciprocal of the gradient. Two things make this more than arithmetic:

- Every run gets a **fresh spring** whose stiffness is written nowhere, so it has
  to be measured.
- The spring has a real **elastic limit**. Load it past that and it yields: the
  point sits above the straight line and drags the naive fit down. The analysis
  spots the yielded points and refits the elastic ones — exactly the judgement a
  marker wants you to make.

## Ohm's law — e.m.f. and internal resistance

Choose **Ohm's law — e.m.f. and internal resistance**. A dry cell, rheostat,
ammeter, voltmeter and switch are wired up for you. Turn the rheostat, read both
meters, and record `V` and `I`. The graph of `V` against `I` is a straight line
whose **intercept is the e.m.f. `E`** and whose **gradient is `−r`**.

The cell's `E` and `r` are randomised for every fresh cell and are not printed on
it. The meters have the faults real meters have: the voltmeter's 1000 Ω shunts a
little current, so it reads a hair low; the ammeter's own resistance adds to the
series circuit; and both readings are rounded to the nearest division with a
wobbly hand.

## Refraction — the refractive index of a glass block

Choose **Refraction — the refractive index of a glass block**. A ray box throws a
beam at a glass block on a sheet of paper. Move it round the protractor and the
beam is traced *through* the glass — bending towards the normal inside, and
leaving the far face parallel but shifted sideways, which is why you have to mark
the incident and emergent rays and join them up to find the hidden refracted ray.

Record `i` and `r` at six or more angles and plot **sin i against sin r**: a
straight line through the origin whose gradient is `n`. The block's index is
random for every block, both angles are read from the normal with a protractor's
error, and the analysis tells you when your line misses the origin.

## Specific heat capacity — the bomb calorimeter

Choose **Specific heat capacity — bomb calorimeter**. A copper bomb sits in its
jacket with 400 g of water, a heater coil, a stirrer and a thermometer; a bench
supply and two leads stand beside it. The mass is on the balance, the supply
reads 12 V and a current it holds steady, and the thermometer is read to 0.1 °C.

Record θ₁ at `t = 0`, switch on the heater, and take a reading every 30 s (the
datalogger does it for you) until five minutes are up. The clock and the heater
run **10× faster than bench time**, so the whole run takes half a minute while
every number in the table is what a real five-minute run would have given.

Plot **Δθ against t**. The first part is nearly straight; it **bends over** later
because the calorimeter is losing heat to the room (Newton's law of cooling). So:

- the **initial gradient** gives `c = VI / (m × gradient)` — the honest value;
- the syllabus endpoint formula `c = VIt / (mΔθ)` reads a few per cent high, and
  the analysis shows you exactly how much, and why.

The steel bomb's own heat capacity, the 0.1 °C graduations and the thermometer's
one-and-a-half-second lag are all in the model. The accepted value for water is
4.18 × 10³ J kg⁻¹ K⁻¹; a careful run lands within a few per cent of it.

## What makes it realistic

Every number the student reads carries the error a real measurement would:

| Source                | How it is modelled                                                        |
| --------------------- | ------------------------------------------------------------------------ |
| Reaction time         | Stopwatch presses are delayed by a random ~0.21 s (with a personal bias). |
| Finite amplitude      | The period grows as `T ≈ T₀(1 + θ₀²/16)`; releasing from 20° skews `g`.    |
| Finite bob size       | Extra moment of inertia for a large bob: `T = T₀√(1 + ⅖(r/L)²)`.          |
| Reading the rule      | 1 mm graduations; the lens shows where the mark *appears* from your angle.|
| Parallax              | Computed from the camera azimuth (and shown — it cancels in `L`).        |
| Damping & draughts    | Viscous + aerodynamic drag; an "open window" adds random perturbation.    |
| Thermal expansion     | The rule's material has a real coefficient of expansion per °C.           |
| The spring's yield    | Past the elastic limit `F = kx` stops holding, so the graph bends upward. |
| Pointer on the rule   | The zero is taken with the hanger alone, so the reading error enters twice.|
| Meter loading         | A 1000 Ω voltmeter shunts ~1.5 mA and pulls its own reading a few mV low. |
| Protractor readings   | ±0.5° on both `i` and `r`, rounded to the nearest degree: the biggest error.|
| Point-dipole limit    | Inside about 11 cm the bar's own length breaks the `1/d³` law.            |
| Newton cooling        | The calorimeter loses heat in proportion to (θ − room), so Δθ–t bends over.|
| The bomb's heat capacity | The steel vessel warms too, so the water's measured `c` reads a little high.|
| Thermometer lag       | A first-order lag (τ ≈ 1.5 s) means the column trails the water.           |
| Thermal rounding      | Temperatures are read to 0.1 °C; a 2 K rise carries a few per cent of it.   |

The motion itself is RK4-integrated on a fixed step, so the answer does **not**
depend on your frame rate, and running the clock at 2× or 4× speeds up the wall
clock without changing any recorded time.

## Project layout

The code is layered so that a new practical never has to touch the shell:

```
src/
  core/        EventBus, seeded RNG + error models, maths, formatting, the lab clock
  engine/      Viewport (renderer/loop), LabRoom, materials, procedural geometry kit
  engine/models/  procedural apparatus builders, by topic (masses, optics,
                  electricity, magnetism) plus the general pieces
  engine/models/library/  the reusable, categorised model library (people,
                  atoms, matter, circuit symbols, apparatus) + its catalogue
  lab/         equipment catalogue, picking, dragging, placement (Lab)
  physics/     pure physics: pendulum ODE, springs, magnets, circuits, optics,
               calorimetry, measurement error models, statistics, constants
  experiments/ the Experiment contract, the registry, and one folder per practical
  ui/          plain-DOM widget kit and the panels (table, graph, lens, toasts)
  app/         App shell (layout + wiring) and the DataStore
```

Every one of those folders has an `index.ts` barrel, so a consumer imports a
whole layer rather than a file: `@/engine`, `@/lab`, `@/ui`, `@/physics`,
`@/experiments`. The topics inside get their own barrels too
(`@/experiments/mechanics`, `@/physics/optics`, …).

There are **no binary assets**: all apparatus is generated in code (geometry,
canvas textures, dials, labels), which keeps the repository small and every part
inspectable.

- `core` knows nothing about physics or DOM.
- `physics` is pure and has no DOM/Three dependency, so it is unit-testable.
- `experiments` see only the injected `LabServices` (lab, viewport, clock, rng,
  bus, data store) — never globals.
- `ui` renders whatever an experiment *declares* (its columns and controls), so
  the table, graph and analysis are generic.

## Using the pieces elsewhere

The layering is not decoration: each layer is meant to be liftable.

| You want…                              | Import                                                        |
| -------------------------------------- | ------------------------------------------------------------- |
| The physics, with no browser at all    | `@/physics` — pure functions, driven by the self-checks        |
| The maths only (fits, RK4, RNG)        | `@/core/math`                                                 |
| The apparatus models on your own scene | `@/engine` (`materials`, `geometry`, `models`)                 |
| The categorised model library          | `@/engine/models/library` — `MODEL_LIBRARY`, `buildModel(id)` |
| The widget kit in a plain page         | `@/ui/widgets` — options objects, no framework                 |
| The whole bench                        | `@/lab` (`Lab`) + `@/engine` (`Viewport`, `LabRoom`)           |
| One practical, without the others      | `@/experiments/<topic>`                                        |

`physics/` never imports Three.js or the DOM, which is what lets the *same*
equations drive the 3-D bench, the self-checks in `scripts/`, and a standalone
article or a differently-themed lab. The apparatus builders are equally
standalone: they return a `THREE.Group` and need nothing but Three.js.

A practical is three cooperating pieces, kept apart on purpose:
`<Name>Rig.ts` does the drawing, `analysis.ts` does the arithmetic (pure — no
Three.js, no DOM), and `controls.ts` builds the panel from a small model object
and returns a `refresh` closure, so a slider drag never rebuilds the DOM under
the student's fingers. The orchestrator ties them together and owns nothing else.

## Adding apparatus

1. If it is general enough to belong to the model library, write a builder in
   `src/engine/models/library/<category>.ts` and add a `ModelEntry` to its
   catalogue; it then appears in the in-app gallery automatically.
2. Otherwise write a builder in `src/engine/models/<topic>/` that returns a
   `THREE.Group` (use the helpers in `src/engine/geometry/` and
   `src/engine/materials.ts`).
3. Register it in `src/lab/catalog/<topic>.ts` with an id, name, group, glyph,
   summary and a `build()` — optionally a `buildUpdate()` for live instruments
   (see the stopwatch, whose LCD is refreshed through `userData.stopwatchView`).

Builders take an options object rather than baking a value in, which is how the
practicals keep their answers secret: `buildDryCell(voltage, { showVoltage: false })`
and `buildGlassBlock(size, { label })` draw apparatus that is correct in every
respect except the number the student is meant to measure.

## Adding a practical

1. Make a folder `src/experiments/<topic>/<name>/` holding the rig (drawing),
   the analysis (pure arithmetic), the controls (the DOM panel) and the
   orchestrator that extends `BaseExperiment`. Declare `columns` and implement
   `setup`, `update`, `analyse`, plus optional `buildControls`, `status` and
   `graphDecorations`.
2. Add an entry to `src/experiments/registry.ts`. Set `available: true` and
   provide `create`. Anything with `available: false` shows as "coming soon".

The six practicals in the registry all follow the rig / analysis / controls
split described above, and they are the best guide to the pattern: the pendulum
and the magnet are the longest-running ones; the spring, the cell, the glass
block and the calorimeter are the most recent. Each keeps its own apparatus — the
hidden value is a constructor argument, never a label — so what the student
measures is what the physics calculates, with nothing shared between runs.

## The model library

`src/engine/models/library/` is a catalogue of stand-alone builders that any
Three.js scene can use — the lab and the in-app gallery are two hosts that
happen to share it:

| Category   | What is in it                                                        |
| ---------- | -------------------------------------------------------------------- |
| `people`   | Five human figures (adult, child, technician, seated, demonstrator)   |
| `atomic`   | Thomson's plum pudding, Rutherford, Bohr, and an electron cloud      |
| `matter`   | Particle views of a solid, a liquid and a gas                         |
| `circuit`  | Resistor, inductor, capacitor, cell, lamp and open/closed switch tiles |
| `apparatus`| Knife edge, pulley, inclined plane, thermometer, bomb calorimeter, beaker, tripod, Bunsen burner, power supply |

Every entry is a `ModelEntry` with an id, category, summary and `build(options)`.
The options are the same for everything: `scale`, `accent` and `labels`, applied
uniformly by `applyDisplayOptions()`. Models are deterministic (a seeded RNG), so
a screenshot or a lesson always looks the same, and they describe themselves:
`userData.physical` carries the mass/height, `userData.facts` the teaching
points, and animated models expose `userData.update(dt)` plus their view objects
(`userData.calorimeter`, `userData.supply`, …) so a host can drive them.

To put one on the lab bench, build it and hand it to `Lab.adopt()`; that is
exactly what the gallery's *Place on bench* button does.

## Verifying the physics

```bash
npm run verify
```

`scripts/verify-physics.mjs` bundles `scripts/physics-check.ts` in memory and
runs the self-checks (27 at the time of writing, needing no browser). They cover
every practical:

- **Pendulum** — the integrated motion matches `2π√(L/g)`, finite amplitude
  lengthens the period by `θ₀²/16`, `g = 4π²/gradient` round-trips, a
  least-squares fit of noisy `T²`–`L` data recovers `g` within 1 %, and the
  stopwatch error averages out to a sane σ.
- **Bar magnet** — the equatorial field is `μ₀m/4πd³` and perpendicular to the
  moment, `tan θ` follows the inverse-cube law, a student's noisy graph recovers
  `m` within 10 %, the needle sits at 45° where the two fields are equal, and the
  field-line tracer stays on the paper.
- **Spring** — the elastic limit really bends the graph, and a student's `x`–`F`
  fit recovers `k`.
- **Cell** — the loaded circuit obeys both `V = IR` and `V = E − Ir`, the
  voltmeter's 1000 Ω shunt is accounted for, and a student's `V`–`I` line
  recovers `E` and `r`.
- **Glass block** — `traceBlockRay` bends the beam by Snell's law, leaves the far
  face parallel but shifted, a student's `sin i`–`sin r` line recovers `n`, and
  the critical angle of glass comes out at 41.81°.
- **Calorimeter** — with no losses `VIt` converts to `mcΔθ` exactly, Newton
  cooling returns a warm vessel to room temperature, the thermometer's lag is
  `τ × gradient`, and a student's initial-gradient graph recovers `c` while the
  endpoint formula reads measurably high.

## Notes

- Built with Vite 6, TypeScript (strict) and Three.js 0.170. No UI framework.
- Type-checking is strict (`noUnusedLocals`, `noUnusedParameters`,
  `noImplicitOverride`) — the build fails on unused code by design.
- Adding a practical is a matter of writing three files and a registry entry; the
  shell, the graph, the table and the analysis view are all generic.
