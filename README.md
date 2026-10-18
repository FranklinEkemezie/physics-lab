# Virtual Physics Lab

A three-dimensional laboratory in the browser for WAEC-style (and generally
school-level) physics practicals. You assemble real-looking apparatus on a
bench, take measurements by reading scales through a magnifying *reading lens*,
time swings with a stopwatch that has human reaction times, record your trials
in a table, plot the graph and get the value of the physical constant — with an
honest error bar.

Nothing is faked with a lookup table: the pendulum is integrated from its real
equation of motion, so the errors you see are the errors a candidate really
gets.

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

The motion itself is RK4-integrated on a fixed step, so the answer does **not**
depend on your frame rate, and running the clock at 2× or 4× speeds up the wall
clock without changing any recorded time.

## Project layout

The code is layered so that a new practical never has to touch the shell:

```
src/
  core/        EventBus, seeded RNG + error models, math helpers
  engine/      Viewport (renderer/loop), LabRoom, materials & procedural geometry
  engine/models/  procedural apparatus builders (stand, pendulum, rule, stopwatch,
                  masses & springs, optics, electricity, magnetism)
  lab/         equipment catalogue, picking, dragging, placement (Lab)
  physics/     pendulum ODE, clock, stopwatch error model, statistics, constants
  experiments/ the Experiment contract, the registry, and mechanics/SimplePendulum
  ui/          plain-DOM widget kit and the panels (table, graph, lens, toasts)
  app/         App shell (layout + wiring) and the DataStore
```

There are **no binary assets**: all apparatus is generated in code (geometry,
canvas textures, dials, labels), which keeps the repository small and every part
inspectable.

- `core` knows nothing about physics or DOM.
- `physics` is pure and has no DOM/Three dependency, so it is unit-testable.
- `experiments` see only the injected `LabServices` (lab, viewport, clock, rng,
  bus, data store) — never globals.
- `ui` renders whatever an experiment *declares* (its columns and controls), so
  the table, graph and analysis are generic.

## Adding apparatus

1. Write a builder in `src/engine/models/` that returns a `THREE.Group` (use the
   helpers in `src/engine/geometry.ts` and `materials.ts`).
2. Register it in `src/lab/catalog.ts` with an id, name, group, glyph, summary
   and a `build()` — optionally a `buildUpdate()` for live instruments (see the
   stopwatch, whose LCD is refreshed through `userData.stopwatchView`).

## Adding a practical

1. Implement the `Experiment` interface (extend `BaseExperiment`) in
   `src/experiments/` — declare `columns`, and implement `setup`, `update`,
   `analyse`, plus optional `buildControls`, `status` and `graphDecorations`.
2. Add an entry to `src/experiments/registry.ts`. Set `available: true` and
   provide `create`. Anything with `available: false` shows as "coming soon".

The other practicals (Hooke's law, Ohm's law, refraction, magnetic field) are
listed in the registry with their apparatus already modelled — they are the
intended next steps.

## Verifying the physics

```bash
npm run verify
```

`scripts/verify-physics.mjs` bundles `scripts/physics-check.ts` in memory and
asserts that the integrated pendulum matches `2π√(L/g)`, that finite amplitude
lengthens the period by `θ₀²/16`, that `g = 4π²/gradient` round-trips, that a
least-squares fit of noisy `T²`–`L` data recovers `g` within 1 %, and that the
stopwatch error averages out to a sane σ. It needs no browser.

## Notes

- Built with Vite 6, TypeScript (strict) and Three.js 0.170. No UI framework.
- Type-checking is strict (`noUnusedLocals`, `noUnusedParameters`,
  `noImplicitOverride`) — the build fails on unused code by design.
