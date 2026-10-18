/**
 * WAEC-style practical: use a simple pendulum to determine the acceleration of
 * free fall `g`.
 *
 * ---------------------------------------------------------------------------
 * What is real here
 * ---------------------------------------------------------------------------
 * The bob obeys `θ'' = −(g/L)·sin θ − damping` and is integrated with RK4 at a
 * fixed step. It is *not* a sine wave on a timer. Everything the student
 * measures therefore carries the errors a real experiment carries:
 *
 *  - **Reaction time.** Starting and stopping a stopwatch is ~210 ms of human
 *    error each way. Over ten swings this is a few parts in a thousand — the
 *    dominant error in the whole practical.
 *  - **Finite amplitude.** Released from 20°, the true period is ~0.5 % longer
 *    than `2π√(L/g)`, which pulls the answer for `g` about 1 % low. Textbooks
 *    say "keep the amplitude small"; here you can see why.
 *  - **Reading the rule.** The student reads the heights of the cork and of
 *    the *centre* of the bob. Reading to the bottom of the bob instead costs
 *    half its diameter, shifting the graph's intercept.
 *  - **Parallax.** The lens shows where the marks appear from the current
 *    camera angle. Because both the cork and the bob sit in the same plane,
 *    the shift cancels in `L` — a subtlety worth knowing before you spend an
 *    afternoon chasing it.
 *  - **Damping and draughts.** The swing decays; an open window perturbs it.
 *
 * The result: repeated runs give `g` within about 1 %, exactly like a good
 * school candidate — and a sloppy run gives something a marker would circle.
 */

import * as THREE from 'three';
import { BaseExperiment } from '../types';
import type {
  AnalysisResult,
  ColumnDef,
  DataSet,
  ExperimentStatus,
  LabServices,
} from '../types';
import type { GroupId } from '@/lab/types';
import { BENCH_HEIGHT } from '@/engine/LabRoom';
import { PendulumRig, RIG } from './PendulumRig';
import { StopwatchInstrument } from '@/physics/measurement';
import type { StopwatchView } from '@/engine/models/stopwatch';
import {
  amplitudeFromState,
  gravityFromSlope,
  integratePendulum,
  parametersForLocation,
} from '@/physics/mechanics/pendulum';
import type { PendulumState } from '@/physics/mechanics/pendulum';
import { createMysteryLocation, EARTH, LOCATIONS, REACTION_MEAN_S } from '@/physics/constants';
import type { Location } from '@/physics/constants';
import { linearFit, mean, percentError } from '@/core/math';
import { viewAzimuth } from '@/physics/measurement';
import { ReadingLens } from '@/ui/ReadingLens';
import { button, card, note, numberField, segmented, select, slider, stat, toggle } from '@/ui/widgets';
import type { ButtonWidget, NumberFieldWidget, SegmentedWidget, SelectWidget, SliderWidget, ToggleWidget } from '@/ui/widgets';

/** The five numbers a student writes in their book for one trial. */
export interface PendulumRow {
  L: number;
  n: number;
  t: number;
  T: number;
  T2: number;
}

/** How the length of the pendulum was obtained from the rule. */
interface LengthReading {
  /** Height of the point of suspension above the bench, in centimetres. */
  pivotCm: number | null;
  /** Height of the centre of the bob above the bench, in centimetres. */
  bobCm: number | null;
  /** Camera azimuth when each reading was taken (radians). */
  pivotAzimuth: number | null;
  bobAzimuth: number | null;
  /** How each number got there: typed by the student, or copied from the lens. */
  pivotSource: 'typed' | 'lens' | null;
  bobSource: 'typed' | 'lens' | null;
}

const TAU = Math.PI * 2;
void TAU;

export class SimplePendulumExperiment extends BaseExperiment {
  readonly id = 'simple-pendulum';
  readonly title = 'Simple pendulum — determine g';
  readonly group: GroupId = 'mechanics';

  readonly aim =
    'To determine the acceleration of free fall, g, using a simple pendulum, and to verify that T² is directly proportional to L.';

  readonly theory =
    'For a simple pendulum swinging through a small angle, `T = 2π√(L/g)`. Squaring gives ' +
    '`T² = (4π²/g)·L`, so a graph of **T² against L** is a straight line through the origin with ' +
    'gradient `4π²/g`. Hence `g = 4π² / gradient`. Time **n** oscillations and divide by n: ' +
    '`T = t/n`, which is why timing many swings improves the result.';

  readonly procedure = [
    'Clamp the split cork in the jaws and pass the thread through the slit.',
    'Adjust the thread so the bob hangs well clear of the bench (raise the clamp if needed).',
    'Displace the bob slightly (about 10°–15°) and let it swing in a vertical plane.',
    'Using the reading lens, record the height of the point of suspension and of the centre of the bob; L is their difference.',
    'Time n complete oscillations with the stopwatch, always starting and stopping as the bob passes the centre of its swing.',
    'Repeat for at least six different lengths.',
    'Plot a graph of T² against L, find the gradient, and compute g = 4π² / gradient.',
  ] as const;

  readonly columns: readonly ColumnDef[] = [
    {
      id: 'L',
      header: 'L',
      unit: 'm',
      decimals: 3,
      role: 'independent',
      hint: 'Length from the point of suspension to the centre of the bob.',
    },
    { id: 'n', header: 'n', unit: 'swings', decimals: 0, role: 'raw', plottable: false, hint: 'Number of oscillations timed.' },
    { id: 't', header: 't', unit: 's', decimals: 2, role: 'raw', plottable: false, hint: 'Stopwatch reading for n oscillations.' },
    { id: 'T', header: 'T = t/n', unit: 's', decimals: 3, role: 'derived', plottable: false, hint: 'Period of one oscillation.' },
    { id: 'T2', header: 'T²', unit: 's²', decimals: 4, role: 'dependent', hint: 'Plotted against L; gradient = 4π²/g.' },
  ];

  // --- Apparatus -----------------------------------------------------------
  #rig: PendulumRig | null = null;
  #stopwatchObject: THREE.Object3D | null = null;
  #stopwatchView: StopwatchView | null = null;
  #stopwatch = new StopwatchInstrument({ resolutionS: 0.01 });
  #lastShownDisplay = -1;

  // --- Motion --------------------------------------------------------------
  #motion: PendulumState = { theta: 0, omega: 0 };
  #mode: 'idle' | 'held' | 'swinging' = 'idle';
  #halfSwings = 0;
  #previousOmega = 0;
  #releaseAmplitudeRad = 0;
  #currentAmplitudeRad = 0;
  #draught = false;

  // --- Controls ------------------------------------------------------------
  #location: Location = EARTH;
  #mystery: Location = EARTH;
  #oscillations = 5;
  #releaseAngleDeg = 12;
  #showSwingCounter = true;

  // --- Length reading ------------------------------------------------------
  #lens: ReadingLens | null = null;
  #readingTarget: 'bob' | 'pivot' = 'bob';
  #lastLensMarkerM = Number.NaN;
  #reading: LengthReading = {
    pivotCm: null,
    bobCm: null,
    pivotAzimuth: null,
    bobAzimuth: null,
    pivotSource: null,
    bobSource: null,
  };

  // --- Live widgets --------------------------------------------------------
  #widgets: {
    stopwatchDisplay?: HTMLElement;
    swings?: ReturnType<typeof stat>;
    amplitude?: ReturnType<typeof stat>;
    length?: ReturnType<typeof stat>;
    threadsSlider?: SliderWidget;
    clampSlider?: SliderWidget;
    nControl?: SegmentedWidget<string>;
    startButton?: ButtonWidget;
    recordButton?: ButtonWidget;
    locationSelect?: SelectWidget<string>;
    draughtToggle?: ToggleWidget;
    counterToggle?: ToggleWidget;
    pivotField?: NumberFieldWidget;
    bobField?: NumberFieldWidget;
  } = {};

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  override setup(services: LabServices): void {
    const { lab, bus } = services;

    this.#mystery = createMysteryLocation(services.rng);
    this.#rig = new PendulumRig(lab, { clampHeightM: 0.62, threadLengthM: 0.4 });
    // A stopwatch on the bench, next to the apparatus.
    this.#stopwatchObject = lab.spawn('stopwatch', {
      position: new THREE.Vector3(RIG.standX + 0.34, BENCH_HEIGHT, RIG.standZ + 0.12),
      rotationY: -0.4,
    }).object;
    this.#stopwatchView = (this.#stopwatchObject.userData.stopwatchView as StopwatchView) ?? null;

    this.#bindBench(services);
    this.#bindKeyboard(services);

    bus.emit('coach:say', {
      text: 'Drag the bob aside to start a swing, then time it with the stopwatch.',
    });
    services.viewport.focusOn(new THREE.Vector3(RIG.standX + 0.05, BENCH_HEIGHT + 0.45, RIG.standZ + 0.1), 1.6);
  }

  /** Wire up drags, clicks and the bench toolbar. */
  #bindBench(services: LabServices): void {
    const { lab, bus } = services;
    const rig = this.#rig;
    if (!rig) return;

    // --- Dragging the boss head changes the height of the pivot ------------
    this.onDispose(
      lab.bus.on('object:dragged', (event) => {
        if (!rig) return;
        if (event.instanceId === rig.parts.bossHead.instanceId) {
          rig.setClampHeight(event.object.position.y - BENCH_HEIGHT);
          this.#refreshPanel(services);
          return;
        }
        if (event.instanceId === rig.parts.bob.instanceId) {
          this.#grabBob(event.pointerPoint);
          return;
        }
      }),
    );

    this.onDispose(
      lab.bus.on('object:dragEnd', (event) => {
        if (!rig) return;
        if (event.instanceId === rig.parts.bob.instanceId) this.#releaseBob(services);
      }),
    );

    // --- Validating typed rule readings ------------------------------------
    this.onDispose(
      lab.bus.on('object:selected', () => {
        /* selection styling is handled by the Lab */
      }),
    );

    void bus;
  }

  #bindKeyboard(services: LabServices): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;

      if (event.code === 'Space') {
        event.preventDefault();
        this.toggleStopwatch(services);
      } else if (event.key === 'r' || event.key === 'R') {
        this.#resetSwing();
        services.bus.emit('coach:say', { text: 'Bob brought to rest.' });
      } else if (event.key === 'Enter') {
        this.recordTrial(services);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    this.onDispose(() => window.removeEventListener('keydown', onKeyDown));
  }

  // -------------------------------------------------------------------------
  // Physics
  // -------------------------------------------------------------------------

  override update(dt: number, services: LabServices): void {
    const rig = this.#rig;
    if (!rig) return;

    services.clock.timeScale = this.#timeScale;
    const stopwatch = this.#stopwatch;

    services.clock.advance(dt, (step) => {
      if (this.#mode === 'swinging') {
        this.#motion = integratePendulum(this.#motion, this.#parameters(), step);
        this.#countSwings();
        this.#currentAmplitudeRad = amplitudeFromState(this.#motion, this.#parameters());
        if (this.#draught) {
          this.#motion.omega += services.rng.jitter(0.05) * step * 60;
        }
        // Come to rest quietly rather than jittering forever.
        if (Math.abs(this.#motion.theta) < 1e-4 && Math.abs(this.#motion.omega) < 1e-4) {
          this.#motion.theta = 0;
          this.#motion.omega = 0;
          this.#mode = 'idle';
        }
      }
      stopwatch.tick(services.clock.simTime);
    });

    rig.setTheta(this.#motion.theta);

    // Stopwatch display only redraws when the hundredths change.
    const displayed = stopwatch.elapsed;
    if (Math.abs(displayed - this.#lastShownDisplay) >= 0.005) {
      this.#lastShownDisplay = displayed;
      this.#stopwatchView?.setDisplay(displayed, { running: stopwatch.running });
      // Keep the panel's large read-out in step with the 3D watch.
      if (this.#widgets.stopwatchDisplay) {
        this.#widgets.stopwatchDisplay.textContent = displayed.toFixed(2);
      }
    }

    this.#updateLens(services);
    this.#publishStatus(services);
  }

  #parameters() {
    const rig = this.#rig;
    const length = rig?.lengthM ?? 0.4;
    const radius = rig?.bob.radiusM ?? 0.0125;
    const mass = rig?.bob.massKg ?? 0.07;
    return parametersForLocation(this.#location, length, radius, mass);
  }

  /** Count completed oscillations by watching for turning points. */
  #countSwings(): void {
    if (this.#previousOmega === 0) {
      this.#previousOmega = this.#motion.omega;
      return;
    }
    if (Math.sign(this.#motion.omega) !== Math.sign(this.#previousOmega)) {
      // Each turning point completes half an oscillation.
      this.#halfSwings += 1;
    }
    this.#previousOmega = this.#motion.omega;
  }

  get completedSwings(): number {
    return this.#halfSwings / 2;
  }

  // -------------------------------------------------------------------------
  // Student actions
  // -------------------------------------------------------------------------

  /** Take hold of the bob and move it along its arc (called on drag). */
  #grabBob(point: THREE.Vector3): void {
    const rig = this.#rig;
    if (!rig) return;
    const angle = THREE.MathUtils.clamp(rig.angleFromPlanePoint(point), -0.7, 0.7);
    this.#mode = 'held';
    this.#motion = { theta: angle, omega: 0 };
    this.#previousOmega = 0;
    rig.setTheta(angle);
  }

  /** Let go — the swing starts from wherever the bob is. */
  #releaseBob(services: LabServices): void {
    const rig = this.#rig;
    if (!rig) return;
    this.#mode = 'swinging';
    this.#releaseAmplitudeRad = Math.abs(this.#motion.theta);
    this.#currentAmplitudeRad = this.#releaseAmplitudeRad;
    this.#halfSwings = 0;
    this.#previousOmega = this.#motion.omega;
    const degrees = (THREE.MathUtils.radToDeg(this.#releaseAmplitudeRad)).toFixed(1);
    services.bus.emit('coach:say', {
      text: `Released from ${degrees}°. Time ${this.#oscillations} swings with the stopwatch.`,
    });
    services.requestPanelRefresh();
  }

  /** Drop the bob from a chosen angle with no initial velocity. */
  release(services: LabServices, degrees = this.#releaseAngleDeg): void {
    const rig = this.#rig;
    if (!rig) return;
    const angle = THREE.MathUtils.degToRad(degrees);
    this.#motion = { theta: angle, omega: 0 };
    rig.setTheta(angle);
    this.#releaseBob(services);
  }

  #resetSwing(): void {
    this.#motion = { theta: 0, omega: 0 };
    this.#mode = 'idle';
    this.#halfSwings = 0;
    this.#previousOmega = 0;
    this.#rig?.setTheta(0);
  }

  /** Start or stop the stopwatch (space bar or the 3D button). */
  toggleStopwatch(services: LabServices): void {
    const time = services.clock.simTime;
    if (this.#stopwatch.running) {
      this.#stopwatch.pressStop(time);
      this.#stopwatchView?.flashButton('start');
      this.#publishStatus(services);
      this.#refreshPanel(services);
    } else {
      this.#stopwatch.pressStart(time);
      this.#stopwatchView?.flashButton('start');
      services.bus.emit('coach:say', {
        text: `Timing started. Stop it after ${this.#oscillations} complete swings.`,
      });
      this.#publishStatus(services);
      this.#refreshPanel(services);
    }
  }

  #resetStopwatch(services: LabServices): void {
    this.#stopwatch.reset();
    this.#stopwatchView?.flashButton('reset');
    this.#lastShownDisplay = -1;
    this.#publishStatus(services);
    this.#refreshPanel(services);
  }

  setLocation(services: LabServices, id: string): void {
    const found = id === 'planet-x' ? this.#mystery : LOCATIONS.find((location) => location.id === id);
    if (!found) return;
    this.#location = found;
    this.#resetSwing();
    services.bus.emit('coach:say', {
      text: found.hidden
        ? 'Relocated to Planet X. Nobody knows g here — measure it.'
        : `Relocated to ${found.name}.`,
    });
  }

  get location(): Location {
    return this.#location;
  }

  get trueG(): number {
    return this.#location.hidden ? Number.NaN : this.#location.g;
  }

  // -------------------------------------------------------------------------
  // The reading lens
  // -------------------------------------------------------------------------

  /** Height, above the bench, of the marker currently being read. */
  #apparentHeights(_services: LabServices): { bobM: number; pivotM: number; azimuth: number } {
    const rig = this.#rig;
    if (!rig) return { bobM: 0, pivotM: 0, azimuth: 0 };

    const camera = _services.viewport.camera;
    const scaleFaceCentre = new THREE.Vector3(RIG.ruleX, BENCH_HEIGHT + 0.5, RIG.ruleZ + 0.0025);
    const azimuth = viewAzimuth(
      camera.position,
      scaleFaceCentre,
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(0, 1, 0),
    );

    // Depth of the pendulum plane behind the rule's graduations.
    const depth = Math.abs(scaleFaceCentre.z - RIG.standZ);
    const shift = Math.tan(azimuth) * depth;

    return {
      bobM: rig.bobCentreHeightAboveBenchM + shift,
      pivotM: rig.pivotHeightAboveBenchM + shift,
      azimuth,
    };
  }

  #updateLens(services: LabServices): void {
    const lens = this.#lens;
    if (!lens) return;
    const { bobM, pivotM } = this.#apparentHeights(services);
    const target = this.#readingTarget;
    const height = target === 'bob' ? bobM : pivotM;

    // Redrawing the lens is not free, so only push a new marker when the
    // apparent position has actually moved by more than a fifth of a millimetre.
    if (Math.abs(height - this.#lastLensMarkerM) < 0.0002) return;
    this.#lastLensMarkerM = height;

    lens.setMarker({
      apparentHeightM: height,
      radiusM: target === 'bob' ? (this.#rig?.bob.radiusM ?? 0.0125) : RIG.corkHeightM / 2,
      colour: target === 'bob' ? '#c8961e' : '#8a6c3a',
      label: target === 'bob' ? 'centre of bob' : 'bottom of cork',
    });
  }

  /** Copy the current cursor position into one of the two reading fields. */
  #takeReading(services: LabServices, target: 'bob' | 'pivot'): void {
    const lens = this.#lens;
    if (!lens) return;
    const cm = Math.round(lens.cursorHeightM * 10000) / 100;
    const { azimuth } = this.#apparentHeights(services);
    if (target === 'bob') {
      this.#reading.bobCm = cm;
      this.#reading.bobAzimuth = azimuth;
      this.#reading.bobSource = 'lens';
    } else {
      this.#reading.pivotCm = cm;
      this.#reading.pivotAzimuth = azimuth;
      this.#reading.pivotSource = 'lens';
    }
    this.#syncReadingFields(services);
    this.#refreshPanel(services);
  }

  #syncReadingFields(services?: LabServices): void {
    const { pivotField, bobField } = this.#widgets;
    pivotField?.setValue(this.#reading.pivotCm);
    bobField?.setValue(this.#reading.bobCm);
    if (services) this.#validateReading(services);
  }

  /** Compare typed readings with the marks drawn in the lens and colour the fields. */
  #validateReading(services: LabServices): void {
    const { pivotField, bobField } = this.#widgets;
    if (!this.#rig) return;

    const { bobM, pivotM } = this.#apparentHeights(services);

    const check = (value: number | null, apparentM: number, field: NumberFieldWidget | undefined): void => {
      if (!field) return;
      if (value === null) {
        field.setStatus('none');
        return;
      }
      const errorMm = Math.abs(value - apparentM * 100) * 10;
      if (errorMm <= 1.0) field.setStatus('good', '✓');
      else if (errorMm <= 3.0) field.setStatus('warn', `${errorMm.toFixed(1)} mm off`);
      else field.setStatus('bad', `${errorMm.toFixed(1)} mm off — re-read`);
    };

    check(this.#reading.pivotCm, pivotM, pivotField);
    check(this.#reading.bobCm, bobM, bobField);
  }

  /** The length the student's readings imply, in metres. */
  get measuredLengthM(): number | null {
    const { pivotCm, bobCm } = this.#reading;
    if (pivotCm === null || bobCm === null) return null;
    return (pivotCm - bobCm) / 100;
  }

  // -------------------------------------------------------------------------
  // Recording
  // -------------------------------------------------------------------------

  /** Warnings attached to the row about to be recorded. */
  #collectWarnings(): string[] {
    const warnings: string[] = [];
    if (!this.#rig) return warnings;

    if (this.#reading.pivotAzimuth !== null && this.#reading.bobAzimuth !== null) {
      const mismatch = Math.abs(this.#reading.pivotAzimuth - this.#reading.bobAzimuth);
      if (mismatch > THREE.MathUtils.degToRad(4)) {
        warnings.push('The two heights were read from different viewing angles.');
      }
    }
    const amplitudeDeg = THREE.MathUtils.radToDeg(this.#releaseAmplitudeRad);
    if (amplitudeDeg > 15) {
      warnings.push(`Released from ${amplitudeDeg.toFixed(0)}° — the finite-amplitude correction matters.`);
    }
    if (this.#mode === 'swinging' && this.completedSwings > 0.2) {
      warnings.push('Recorded while the bob was still swinging.');
    }
    if (this.#draught) {
      warnings.push('The window was open during this timing.');
    }
    return warnings;
  }

  /** Add the current measurement to the table. */
  recordTrial(services: LabServices): void {
    const rig = this.#rig;
    if (!rig) return;

    const L = this.measuredLengthM;
    if (L === null) {
      services.bus.emit('toast', {
        message: 'Take both readings from the rule first (heights of the cork and of the bob).',
        level: 'warn',
      });
      return;
    }
    if (this.#stopwatch.running) {
      services.bus.emit('toast', { message: 'Stop the stopwatch before recording.', level: 'warn' });
      return;
    }
    const t = this.#stopwatch.elapsed;
    if (!(t > 0.1)) {
      services.bus.emit('toast', { message: 'No timing yet — run the stopwatch for a swing.', level: 'warn' });
      return;
    }

    const n = this.#oscillations;
    const T = t / n;
    const warnings = this.#collectWarnings();

    // Sanity-check the timing: did they actually stop after n swings?
    const swings = this.completedSwings;
    if (swings > 0.05 && Math.abs(swings - n) > 0.6) {
      warnings.push(
        `Stopwatch ran for ${swings.toFixed(1)} swings but n = ${n}. T = t/n will be wrong.`,
      );
    }

    if (t < 4) warnings.push('Short timing — time more oscillations to reduce the reaction-time error.');

    const note = [
      `n = ${n} swings`,
      `amplitude ${THREE.MathUtils.radToDeg(this.#releaseAmplitudeRad).toFixed(0)}°`,
      this.#reading.pivotSource === 'lens' && this.#reading.bobSource === 'lens'
        ? 'heights read from the lens'
        : 'heights partly typed in',
    ].join(' · ');

    services.data.addRow({ L, n, t, T, T2: T * T }, { note, warnings });

    services.bus.emit('toast', {
      message: `Recorded L = ${(L * 100).toFixed(1)} cm, T = ${T.toFixed(3)} s.`,
      level: warnings.length > 0 ? 'warn' : 'good',
    });
    for (const warning of warnings) {
      services.bus.emit('toast', { message: `⚠ ${warning}`, level: 'warn', durationMs: 7000 });
    }

    this.#resetStopwatch(services);
    services.bus.emit('graph:refresh', {});
    this.#publishStatus(services);
    this.#refreshPanel(services);
  }

  // -------------------------------------------------------------------------
  // Analysis
  // -------------------------------------------------------------------------

  override analyse(dataset: DataSet): AnalysisResult {    const rows = dataset.rows;
    const lines: string[] = [];
    const tips: string[] = [];

    if (rows.length < 2) {
      return {
        headline: 'Record at least two trials to plot a graph.',
        lines: ['Use the reading lens for L, then time the swings and press Record.'],
        tips: ['You need at least six lengths spread between about 20 cm and 55 cm.'],
      };
    }

    const xs = rows.map((row) => row.values.L);
    const ys = rows.map((row) => row.values.T2);
    const fit = linearFit(xs, ys);

    if (!fit) {
      return { headline: 'Not enough distinct lengths to fit a line.', lines };
    }

    const gradient = fit.slope;
    const g = gravityFromSlope(gradient);
    const gradientUncertainty = fit.slopeStdError;
    const gUncertainty = Number.isFinite(gradientUncertainty) ? g * Math.abs(gradientUncertainty / gradient) : Number.NaN;

    // Per-row values for comparison and for spotting outliers.
    const perRowG = rows.map((row) => (4 * Math.PI * Math.PI * row.values.L) / (row.values.T * row.values.T));
    const meanG = mean(perRowG.filter((value) => Number.isFinite(value) && value > 0));

    const headline = Number.isFinite(g)
      ? `g = ${g.toFixed(2)} ± ${Math.max(0.01, gUncertainty || 0.05).toFixed(2)} m/s²`
      : 'Could not compute g.';

    lines.push(
      `Gradient of the T²–L graph = ${gradient.toFixed(4)} s²/m   (uncertainty ±${(gradientUncertainty || 0).toFixed(4)})`,
    );
    lines.push(`Intercept = ${fit.intercept.toFixed(4)} s²   (ideal value: 0)`);
    lines.push(`g = 4π² / gradient = ${g.toFixed(2)} m/s²`);
    lines.push(`Mean of the individual 4π²L/T² values = ${meanG.toFixed(2)} m/s²`);
    lines.push(`Correlation coefficient r² = ${fit.r2.toFixed(5)}   (points: ${fit.n})`);

    // --- Quality checks ----------------------------------------------------
    if (!this.#location.hidden) {
      const error = percentError(g, this.#location.g);
      lines.push(
        `Accepted value here (${this.#location.name}): ${this.#location.g.toFixed(2)} m/s²` +
          ` → your result is ${error >= 0 ? '+' : ''}${error.toFixed(1)} % out.`,
      );
      if (Math.abs(error) < 1) tips.push('Excellent — within 1 % of the accepted value.');
      else if (Math.abs(error) < 3) tips.push('Good agreement — a real exam script would score this well.');
      else tips.push('More than 3 % out: check your timing and the amplitude of the swing.');
    } else {
      lines.push('This is Planet X: record carefully, then press "Reveal" in the analysis panel to check.');
    }

    if (fit.r2 < 0.995) {
      tips.push(`Your points are not very collinear (r² = ${fit.r2.toFixed(4)}). Something is inconsistent between trials.`);
    }

    const interceptMm = fit.intercept * 1000;
    if (Math.abs(interceptMm) > 12) {
      tips.push(
        `The intercept is ${interceptMm.toFixed(0)} mm away from zero. A positive value often means L was measured to the ` +
          'bottom of the bob instead of its centre (or that the rule was not parallel to the thread).',
      );
    }

    // Amplitude correction: T ≈ T₀(1 + θ₀²/16), so g is low by ~2×θ₀²/16.
    const amplitudes = rows
      .map((row) => row.note?.match(/amplitude (-?\d+)/)?.[1])
      .filter((value): value is string => value !== undefined)
      .map(Number);
    if (amplitudes.length > 0) {
      const meanAmplitudeDeg = mean(amplitudes);
      const meanAmplitudeRad = THREE.MathUtils.degToRad(meanAmplitudeDeg);
      const correction = 2 * (meanAmplitudeRad ** 2 / 16);
      if (meanAmplitudeDeg > 8) {
        tips.push(
          `Average release amplitude was ${meanAmplitudeDeg.toFixed(0)}°. The exact pendulum has T = T₀(1 + θ₀²/16), so your g is ` +
            `about ${(correction * 100).toFixed(1)} % low. Correcting for it would give ${(g * (1 + correction)).toFixed(2)} m/s².`,
        );
      }
    }

    // Timing advice.
    const meansN = mean(rows.map((row) => row.values.n));
    if (meansN < 10) {
      tips.push(
        `You timed ${meansN.toFixed(0)} swings on average. With ~0.2 s of reaction error, timing 20 swings would halve the ` +
          'scatter in T.',
      );
    }

    const flagged = rows.filter((row) => (row.warnings?.length ?? 0) > 0);
    if (flagged.length > 0) {
      tips.push(`${flagged.length} of ${rows.length} rows carried warnings — hover the ⚠ in the table to see why.`);
    }

    // Residuals, as a teaching aid.
    const worst = rows
      .map((row) => ({ row, residual: row.values.T2 - (gradient * row.values.L + fit.intercept) }))
      .sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual))[0];
    if (worst) {
      lines.push(
        `Largest residual: trial ${worst.row.index} (${(worst.residual * 1000).toFixed(2)} × 10⁻³ s²) — a good candidate for a repeat.`,
      );
    }

    return { headline, lines, fit, tips };
  }

  /**
   * Error bars and the theoretical line, so the graph can show the student how
   * close their data is to `T² = (4π²/g)L`.
   */
  graphDecorations(dataset: DataSet): {
    xErrors?: number[];
    yErrors?: number[];
    theory?: { slope: number; intercept: number; label: string };
  } {
    // The dominant random error is the operator's reaction time at each press,
    // so σ_t = √2 · σ_reaction and σ_T = σ_t / n.
    const sigmaT = (Math.SQRT2 * REACTION_MEAN_S) / 1;
    const yErrors = dataset.rows.map((row) => {
      const T = row.values.T;
      const n = Math.max(1, row.values.n);
      return 2 * T * (sigmaT / n);
    });
    // 1 mm on each height reading; the parallax cancels in the difference.
    const xErrors = dataset.rows.map(() => 0.001);

    if (this.#location.hidden) return { xErrors, yErrors };

    const gradient = (4 * Math.PI * Math.PI) / this.#location.g;
    return {
      xErrors,
      yErrors,
      theory: {
        slope: gradient,
        intercept: 0,
        label: `theory (g = ${this.#location.g.toFixed(2)})`,
      },
    };
  }

  /** Reveal the hidden gravity of Planet X. */
  reveal(): string | null {
    if (!this.#location.hidden) return null;
    return (
      `Planet X: g = ${this.#location.g.toFixed(3)} m/s², ` +
      `air density ${this.#location.airDensity.toFixed(2)} kg/m³.`
    );
  }

  // -------------------------------------------------------------------------
  // Status for the HUD
  // -------------------------------------------------------------------------
  #timeScale = 1;

  #publishStatus(services: LabServices): void {
    services.bus.emit('status:changed', this.status(services));
  }

  override status(services: LabServices): ExperimentStatus {
    const chips: ExperimentStatus['chips'] = [];
    const measured = this.measuredLengthM;

    const stopwatchValue = this.#stopwatch.elapsed;
    chips.push({
      label: 't',
      value: `${stopwatchValue.toFixed(2)} s`,
      tone: this.#stopwatch.running ? 'good' : 'default',
    });
    chips.push({ label: 'n', value: String(this.#oscillations) });
    chips.push({
      label: 'swings',
      value: this.#showSwingCounter ? this.completedSwings.toFixed(1) : '—',
    });
    chips.push({
      label: 'amplitude',
      value: `${THREE.MathUtils.radToDeg(this.#mode === 'idle' ? this.#releaseAmplitudeRad : this.#currentAmplitudeRad).toFixed(1)}°`,
    });
    chips.push({ label: 'L', value: measured === null ? 'not read' : `${(measured * 100).toFixed(1)} cm`, tone: measured === null ? 'warn' : 'default' });
    chips.push({ label: 'g here', value: `${this.#location.g.toFixed(2)} m/s²` });

    let state = 'ready';
    let hint = 'Drag the boss head up or down to change the pivot height; drag the bob aside to start a swing.';
    if (this.#mode === 'held') {
      state = 'held';
      hint = 'Bob held. Let go to start the swing, then press START (or Space).';
    } else if (this.#mode === 'swinging') {
      state = 'swinging';
      hint = this.#stopwatch.running
        ? `Timing… stop the watch after ${this.#oscillations} complete swings.`
        : 'Swinging. Press START as the bob passes the centre.';
    } else if (this.#stopwatch.elapsed > 0.1) {
      state = 'measured';
      hint = 'Recording ready — press Record (or Enter) to add the trial to the table.';
    }
    if (services.clock.timeScale !== 1) {
      chips.push({ label: 'time', value: `${services.clock.timeScale}×`, tone: 'warn' });
    }

    return { state, chips, hint };
  }

  // -------------------------------------------------------------------------
  // Controls panel
  // -------------------------------------------------------------------------

  #refreshPanel(services: LabServices): void {
    services.bus.emit('panel:refresh', {});
  }

  buildControls(container: HTMLElement, services: LabServices): void {
    const rig = this.#rig;
    if (!rig) return;
    this.#widgets = {};

    // ---- 1. Apparatus -----------------------------------------------------
    const apparatus = card('Apparatus', { glyph: '🧰' });
    const bar = document.createElement('div');
    bar.className = 'pl-btnrow';

    bar.append(
      button({
        label: 'Release bob',
        glyph: '🎯',
        variant: 'primary',
        title: 'Displace the bob by the chosen angle and let it go',
        onClick: () => this.release(services),
      }).root,
    );
    bar.append(
      button({
        label: 'Stop swing',
        glyph: '✋',
        title: 'Bring the bob to rest (R)',
        onClick: () => {
          this.#resetSwing();
          this.#refreshPanel(services);
        },
      }).root,
    );
    bar.append(
      button({
        label: 'Square up',
        glyph: '👁',
        title: 'Move the camera so you look straight at the metre rule',
        onClick: () => this.squareUp(services),
      }).root,
    );
    apparatus.body.append(bar);

    this.#widgets.threadsSlider = slider({
      label: 'Thread paid out of the cork',
      min: RIG.minThreadM,
      max: RIG.maxThreadM,
      step: 0.005,
      value: rig.threadLengthM,
      decimals: 1,
      hint: 'Adjusting the thread is how you change L. Read L from the rule afterwards — never trust the slider.',
      onInput: (value) => {
        rig.setThreadLength(value);
        this.#resetSwing();
        this.#refreshPanel(services);
      },
    });
    // The absolute length is deliberately not displayed.
    this.#widgets.threadsSlider.setReadout(`${((rig.threadLengthM - RIG.minThreadM) * 100).toFixed(1)} cm from minimum`);
    apparatus.body.append(this.#widgets.threadsSlider.root);

    this.#widgets.clampSlider = slider({
      label: 'Height of the clamp on the rod',
      min: RIG.minClampHeightM,
      max: RIG.maxClampHeightM,
      step: 0.005,
      value: rig.clampHeightM,
      unit: ' m',
      decimals: 3,
      hint: 'Raising the clamp gives the pendulum more room; it does not change L.',
      onInput: (value) => {
        rig.setClampHeight(value);
        this.#refreshPanel(services);
      },
    });
    apparatus.body.append(this.#widgets.clampSlider.root);

    const releaseRow = slider({
      label: 'Release angle',
      min: 2,
      max: 30,
      step: 1,
      value: this.#releaseAngleDeg,
      unit: '°',
      decimals: 0,
      hint: 'Small angles give a more accurate g. Above ~15° the period grows measurably.',
      onInput: (value) => {
        this.#releaseAngleDeg = value;
      },
    });
    apparatus.body.append(releaseRow.root);

    const locationOptions = LOCATIONS.map((location) => ({
      value: location.id,
      label: location.hidden ? '🛸 Planet X (mystery g)' : location.name,
    }));
    this.#widgets.locationSelect = select({
      label: 'Location',
      options: locationOptions,
      value: this.#location.id,
      hint: 'The same apparatus, different gravity. Planet X hides its g until you measure it.',
      onChange: (value) => this.setLocation(services, value),
    });
    apparatus.body.append(this.#widgets.locationSelect.root);

    this.#widgets.draughtToggle = toggle({
      label: 'Window open (draughts)',
      hint: 'Random air currents perturb the swing and scatter your timings.',
      value: this.#draught,
      onChange: (value) => {
        this.#draught = value;
      },
    });
    apparatus.body.append(this.#widgets.draughtToggle.root);

    container.append(apparatus.root);

    // ---- 2. Reading the rule ---------------------------------------------
    const reading = card('Reading the metre rule', { glyph: '📏' });
    reading.body.append(
      note(
        'Read the height of the bottom of the cork and the height of the centre of the bob. L is the difference.',
        'info',
      ),
    );

    const targetSwitch = segmented<'bob' | 'pivot'>({
      label: 'Reading',
      options: [
        { value: 'bob', label: 'Centre of bob' },
        { value: 'pivot', label: 'Bottom of cork' },
      ],
      value: this.#readingTarget,
      onChange: (value) => {
        this.#readingTarget = value;
        const lens = this.#lens;
        if (lens) {
          const heights = this.#apparentHeights(services);
          lens.centreOn(value === 'bob' ? heights.bobM : heights.pivotM);
          lens.setCursor(value === 'bob' ? heights.bobM : heights.pivotM);
        }
      },
    });
    reading.body.append(targetSwitch.root);

    const lens = new ReadingLens({ heightPx: 300, windowHeightM: 0.06 });
    this.#lens = lens;
    const angles = this.#apparentHeights(services);
    lens.centreOn(this.#readingTarget === 'bob' ? angles.bobM : angles.pivotM);
    lens.setCursor(this.#readingTarget === 'bob' ? angles.bobM : angles.pivotM);
    reading.body.append(lens.root);

    const takeRow = document.createElement('div');
    takeRow.className = 'pl-btnrow';
    takeRow.append(
      button({
        label: 'Use this reading',
        glyph: '🔍',
        variant: 'primary',
        title: 'Copy the value under the red line into the field below',
        onClick: () => this.#takeReading(services, this.#readingTarget),
      }).root,
    );
    takeRow.append(
      button({
        label: 'Locate mark',
        glyph: '🎯',
        title: 'Centre the lens on the mark being read',
        onClick: () => {
          const heights = this.#apparentHeights(services);
          lens.centreOn(this.#readingTarget === 'bob' ? heights.bobM : heights.pivotM);
        },
      }).root,
    );
    reading.body.append(takeRow);

    this.#widgets.pivotField = numberField({
      label: 'Height of suspension point',
      unit: 'cm',
      step: 0.05,
      decimals: 2,
      value: this.#reading.pivotCm,
      placeholder: 'read from the rule',
      onCommit: (value) => {
        this.#reading.pivotCm = value;
        if (value !== null) this.#reading.pivotSource = 'typed';
        this.#validateReading(services);
      },
    });
    this.#widgets.bobField = numberField({
      label: 'Height of centre of bob',
      unit: 'cm',
      step: 0.05,
      decimals: 2,
      value: this.#reading.bobCm,
      placeholder: 'read from the rule',
      onCommit: (value) => {
        this.#reading.bobCm = value;
        if (value !== null) this.#reading.bobSource = 'typed';
        this.#validateReading(services);
      },
    });
    reading.body.append(this.#widgets.pivotField.root, this.#widgets.bobField.root);

    this.#widgets.length = stat('L (from your readings)', '—');
    const measured = this.measuredLengthM;
    this.#widgets.length.set(measured === null ? 'not read yet' : `${(measured * 100).toFixed(2)} cm`, measured === null ? 'warn' : 'good');
    reading.body.append(this.#widgets.length.root);

    const parallaxNote = document.createElement('p');
    parallaxNote.className = 'pl-slider__hint';
    const { azimuth } = this.#apparentHeights(services);
    const depth = Math.abs(RIG.ruleZ + 0.0025 - RIG.standZ);
    const shiftMm = Math.tan(azimuth) * depth * 1000;
    parallaxNote.textContent =
      `Viewing angle ${THREE.MathUtils.radToDeg(azimuth).toFixed(0)}° off the normal → each apparent height is displaced ` +
      `${shiftMm >= 0 ? '+' : ''}${shiftMm.toFixed(1)} mm. Both marks sit at the same depth, so the shift **cancels** in L.`;
    reading.body.append(parallaxNote);

    container.append(reading.root);

    // ---- 3. Timing --------------------------------------------------------
    const timing = card('Timing', { glyph: '⏱️' });

    const display = document.createElement('div');
    display.className = 'pl-stopwatch-display';
    display.textContent = this.#stopwatch.elapsed.toFixed(2);
    this.#widgets.stopwatchDisplay = display;
    timing.body.append(display);

    this.#widgets.nControl = segmented<string>({
      label: 'Oscillations to time (n)',
      options: ['1', '5', '10', '20'].map((value) => ({ value, label: value })),
      value: String(this.#oscillations),
      onChange: (value) => {
        this.#oscillations = Number(value);
        this.#refreshPanel(services);
      },
    });
    timing.body.append(this.#widgets.nControl.root);

    const timingRow = document.createElement('div');
    timingRow.className = 'pl-btnrow';
    this.#widgets.startButton = button({
      label: this.#stopwatch.running ? 'STOP' : 'START',
      glyph: this.#stopwatch.running ? '⏹' : '▶',
      variant: this.#stopwatch.running ? 'danger' : 'primary',
      title: 'Start or stop the stopwatch (Space)',
      onClick: () => this.toggleStopwatch(services),
    });
    timingRow.append(this.#widgets.startButton.root);
    timingRow.append(
      button({
        label: 'Reset',
        glyph: '↺',
        onClick: () => this.#resetStopwatch(services),
      }).root,
    );
    timingRow.append(
      button({
        label: 'Zero swing',
        glyph: '↔',
        title: 'Reset the oscillation counter (start again from the current position)',
        onClick: () => {
          this.#halfSwings = 0;
          this.#previousOmega = this.#motion.omega;
          this.#publishStatus(services);
          this.#refreshPanel(services);
        },
      }).root,
    );
    timing.body.append(timingRow);

    timing.body.append(
      note(
        'Your reaction time (~200 ms) is the biggest error here. Time 10 or 20 swings and always start and stop at the centre of the swing.',
        'info',
      ),
    );

    this.#widgets.counterToggle = toggle({
      label: 'Show swing counter (training wheels)',
      hint: 'Turn off for exam conditions: count the swings yourself.',
      value: this.#showSwingCounter,
      onChange: (value) => {
        this.#showSwingCounter = value;
        this.#refreshPanel(services);
      },
    });
    timing.body.append(this.#widgets.counterToggle.root);

    const speedRow = segmented<string>({
      label: 'Clock speed',
      options: [
        { value: '1', label: '1×', title: 'Real time' },
        { value: '2', label: '2×' },
        { value: '4', label: '4×', title: 'Fast-forward: the recorded times stay correct' },
      ],
      value: String(this.#timeScale),
      onChange: (value) => {
        this.#timeScale = Number(value);
        this.#publishStatus(services);
      },
    });
    timing.body.append(speedRow.root);

    container.append(timing.root);

    // ---- 4. Record --------------------------------------------------------
    const record = card('Record the trial', { glyph: '📝' });
    this.#widgets.recordButton = button({
      label: 'Record reading',
      glyph: '➕',
      variant: 'primary',
      title: 'Add L, n, t, T and T² to the table (Enter)',
      onClick: () => this.recordTrial(services),
    });
    record.body.append(this.#widgets.recordButton.root);
    record.body.append(
      note(
        'L comes from your two rule readings, t from the stopwatch and n from the selector. T = t/n and T² are computed for you.',
        'info',
      ),
    );
    container.append(record.root);

    // Keep the live widgets in step with the model.
    this.#syncReadingFields(services);
  }

  /** Put the camera square in front of the metre rule. */
  squareUp(services: LabServices): void {
    const target = new THREE.Vector3(RIG.ruleX, BENCH_HEIGHT + 0.45, RIG.ruleZ);
    const distance = 1.1;
    const { camera, controls } = services.viewport;
    camera.position.set(RIG.ruleX, BENCH_HEIGHT + 0.5, RIG.ruleZ + distance);
    controls.target.copy(target);
    controls.update();
    services.bus.emit('coach:say', {
      text: 'Camera squared up to the rule: parallax is now zero, so the apparent heights are the true heights.',
    });
  }

  // -------------------------------------------------------------------------

  override dispose(services: LabServices): void {
    super.dispose(services);
    this.#lens?.dispose();
    this.#lens = null;
    this.#rig = null;
    this.#stopwatchObject = null;
    this.#stopwatchView = null;
    this.#widgets = {};
  }

  /** Extra information shown in the "apparatus" tab header. */
  get summary(): string {
    const rig = this.#rig;
    if (!rig) return 'Not assembled';
    return `Thread ${(rig.threadLengthM * 100).toFixed(1)} cm · clamp at ${(rig.clampHeightM * 100).toFixed(0)} cm`;
  }
}
