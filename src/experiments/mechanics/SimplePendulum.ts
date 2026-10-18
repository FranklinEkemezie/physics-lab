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
import { StopwatchInstrument, viewAzimuth } from '@/physics/measurement';
import type { StopwatchView } from '@/engine/models/stopwatch';
import { parametersForLocation } from '@/physics/mechanics/pendulum';
import { createMysteryLocation, EARTH, LOCATIONS } from '@/physics/constants';
import type { Location } from '@/physics/constants';
import type { LensMarker } from '@/ui/ReadingLens';
import { PendulumSwing } from './PendulumMotion';
import { PendulumReadings } from './PendulumReading';
import type { ReadingTarget } from './PendulumReading';
import { analysePendulum, pendulumGraphDecorations } from './PendulumAnalysis';
import { mountPendulumControls, type PendulumControlsHandle } from './PendulumControls';
import type { PendulumControlsModel, PendulumSnapshot } from './PendulumControls';

/** The five numbers a student writes in their book for one trial. */
export interface PendulumRow {
  L: number;
  n: number;
  t: number;
  T: number;
  T2: number;
}

/** Degrees ↔ radians, matching `THREE.MathUtils` to the last bit. */
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

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
  #swing = new PendulumSwing();

  // --- Controls ------------------------------------------------------------
  #location: Location = EARTH;
  #mystery: Location = EARTH;
  #oscillations = 5;
  #releaseAngleDeg = 12;
  #showSwingCounter = true;
  #timeScale = 1;
  #refreshControls: PendulumControlsHandle | null = null;

  // --- Length reading ------------------------------------------------------
  #readings = new PendulumReadings();
  #readingTarget: ReadingTarget = 'bob';
  #lensMarker: LensMarker | null = null;
  #lastLensMarkerM = Number.NaN;

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
    const parameters = this.#parameters();

    services.clock.advance(dt, (step) => {
      this.#swing.step(step, parameters, services.rng);
      stopwatch.tick(services.clock.simTime);
    });

    rig.setTheta(this.#swing.theta);

    // Stopwatch display only redraws when the hundredths change.
    const displayed = stopwatch.elapsed;
    if (Math.abs(displayed - this.#lastShownDisplay) >= 0.005) {
      this.#lastShownDisplay = displayed;
      this.#stopwatchView?.setDisplay(displayed, { running: stopwatch.running });
    }

    this.#updateLens(services);
    this.#publishStatus(services);
    this.#refreshPanel(services);
  }

  #parameters() {
    const rig = this.#rig;
    const length = rig?.lengthM ?? 0.4;
    const radius = rig?.bob.radiusM ?? 0.0125;
    const mass = rig?.bob.massKg ?? 0.07;
    return parametersForLocation(this.#location, length, radius, mass);
  }

  get completedSwings(): number {
    return this.#swing.completedSwings;
  }

  // -------------------------------------------------------------------------
  // Student actions
  // -------------------------------------------------------------------------

  /** Take hold of the bob and move it along its arc (called on drag). */
  #grabBob(point: THREE.Vector3): void {
    const rig = this.#rig;
    if (!rig) return;
    const angle = this.#swing.hold(rig.angleFromPlanePoint(point));
    rig.setTheta(angle);
  }

  /** Let go — the swing starts from wherever the bob is. */
  #releaseBob(services: LabServices): void {
    if (!this.#rig) return;
    this.#swing.releaseFrom(this.#swing.theta);
    this.#announceRelease(services);
  }

  /** Tell the student what they have just let go of. */
  #announceRelease(services: LabServices): void {
    const degrees = (this.#swing.releaseAmplitudeRad * RAD_TO_DEG).toFixed(1);
    services.bus.emit('coach:say', {
      text: `Released from ${degrees}°. Time ${this.#oscillations} swings with the stopwatch.`,
    });
    services.requestPanelRefresh();
  }

  /** Drop the bob from a chosen angle with no initial velocity. */
  release(services: LabServices, degrees = this.#releaseAngleDeg): void {
    const rig = this.#rig;
    if (!rig) return;
    const angle = degrees * DEG_TO_RAD;
    rig.setTheta(angle);
    this.#swing.releaseFrom(angle);
    this.#announceRelease(services);
  }

  #resetSwing(): void {
    this.#swing.reset();
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

  /** The apparent height of one of the two marks, in metres. */
  #apparentHeightM(services: LabServices, target: ReadingTarget): number {
    const { bobM, pivotM } = this.#apparentHeights(services);
    return target === 'bob' ? bobM : pivotM;
  }

  /**
   * Recompute the marker the reading lens should draw.
   *
   * Redrawing the lens is not free, so we only push a new marker when the
   * apparent position has actually moved by more than a fifth of a millimetre.
   */
  #updateLens(services: LabServices): void {
    const { bobM, pivotM } = this.#apparentHeights(services);
    const target = this.#readingTarget;
    const height = target === 'bob' ? bobM : pivotM;

    if (Math.abs(height - this.#lastLensMarkerM) < 0.0002) return;
    this.#lastLensMarkerM = height;

    this.#lensMarker = {
      apparentHeightM: height,
      radiusM: target === 'bob' ? (this.#rig?.bob.radiusM ?? 0.0125) : RIG.corkHeightM / 2,
      colour: target === 'bob' ? '#c8961e' : '#8a6c3a',
      label: target === 'bob' ? 'centre of bob' : 'bottom of cork',
    };
  }

  /** Copy the current lens cursor into one of the two reading fields. */
  #takeReading(services: LabServices, target: ReadingTarget, cursorHeightM: number): void {
    const cm = Math.round(cursorHeightM * 10000) / 100;
    const { azimuth } = this.#apparentHeights(services);
    this.#readings.setFromLens(target, cm, azimuth);
    this.#refreshPanel(services);
  }

  /** The length the student's readings imply, in metres. */
  get measuredLengthM(): number | null {
    return this.#readings.measuredLengthM;
  }

  // -------------------------------------------------------------------------
  // Recording
  // -------------------------------------------------------------------------

  /** Warnings attached to the row about to be recorded. */
  #collectWarnings(): string[] {
    const warnings: string[] = [];
    if (!this.#rig) return warnings;

    const mismatch = this.#readings.azimuthMismatchRadians;
    if (mismatch !== null && mismatch > DEG_TO_RAD * 4) {
      warnings.push('The two heights were read from different viewing angles.');
    }
    const amplitudeDeg = this.#swing.releaseAmplitudeRad * RAD_TO_DEG;
    if (amplitudeDeg > 15) {
      warnings.push(`Released from ${amplitudeDeg.toFixed(0)}° — the finite-amplitude correction matters.`);
    }
    if (this.#swing.mode === 'swinging' && this.completedSwings > 0.2) {
      warnings.push('Recorded while the bob was still swinging.');
    }
    if (this.#swing.draught) {
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

    const reading = this.#readings.snapshot;
    const note = [
      `n = ${n} swings`,
      `amplitude ${(this.#swing.releaseAmplitudeRad * RAD_TO_DEG).toFixed(0)}°`,
      reading.pivotSource === 'lens' && reading.bobSource === 'lens'
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

  override analyse(dataset: DataSet): AnalysisResult {
    return analysePendulum(dataset.rows, this.#location);
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
    const { yErrors } = pendulumGraphDecorations(dataset.rows);
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

  #publishStatus(services: LabServices): void {
    services.bus.emit('status:changed', this.status(services));
  }

  /** The amplitude the HUD should report: the release value once at rest. */
  #amplitudeDeg(): number {
    const amplitude = this.#swing.mode === 'idle' ? this.#swing.releaseAmplitudeRad : this.#swing.currentAmplitudeRad;
    return amplitude * RAD_TO_DEG;
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
    chips.push({ label: 'amplitude', value: `${this.#amplitudeDeg().toFixed(1)}°` });
    chips.push({ label: 'L', value: measured === null ? 'not read' : `${(measured * 100).toFixed(1)} cm`, tone: measured === null ? 'warn' : 'default' });
    chips.push({ label: 'g here', value: `${this.#location.g.toFixed(2)} m/s²` });

    let state = 'ready';
    let hint = 'Drag the boss head up or down to change the pivot height; drag the bob aside to start a swing.';
    if (this.#swing.mode === 'held') {
      state = 'held';
      hint = 'Bob held. Let go to start the swing, then press START (or Space).';
    } else if (this.#swing.mode === 'swinging') {
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

  #refreshPanel(_services: LabServices): void {
    this.#refreshControls?.refresh();
  }

  buildControls(container: HTMLElement, services: LabServices): void {
    const rig = this.#rig;
    if (!rig) return;

    // The app rebuilds this panel whenever the practical's state changes shape,
    // so let the outgoing panel release its reading lens before we mount another.
    this.#refreshControls?.dispose();
    this.#refreshControls = null;

    const model: PendulumControlsModel = {
      release: () => this.release(services),
      stopSwing: () => {
        this.#resetSwing();
        this.#refreshPanel(services);
      },
      squareUp: () => this.squareUp(services),
      setThreadLength: (lengthM) => {
        rig.setThreadLength(lengthM);
        this.#resetSwing();
        this.#refreshPanel(services);
      },
      setClampHeight: (heightM) => {
        rig.setClampHeight(heightM);
        this.#refreshPanel(services);
      },
      setReleaseAngleDeg: (degrees) => {
        this.#releaseAngleDeg = degrees;
      },
      setLocation: (id) => this.setLocation(services, id),
      setDraught: (on) => this.#swing.setDraught(on),
      setReadingTarget: (target) => {
        this.#readingTarget = target;
      },
      apparentHeightM: (target) => this.#apparentHeightM(services, target),
      takeReading: (target, cursorHeightM) => this.#takeReading(services, target, cursorHeightM),
      setTypedReading: (target, cm) => this.#readings.setTyped(target, cm),
      readingStatus: (target) => this.#readings.statusFor(target, this.#apparentHeightM(services, target)),
      toggleStopwatch: () => this.toggleStopwatch(services),
      resetStopwatch: () => this.#resetStopwatch(services),
      zeroSwings: () => {
        this.#swing.zeroSwings();
        this.#publishStatus(services);
        this.#refreshPanel(services);
      },
      setOscillations: (n) => {
        this.#oscillations = n;
        this.#refreshPanel(services);
      },
      setShowSwingCounter: (on) => {
        this.#showSwingCounter = on;
        this.#refreshPanel(services);
      },
      setTimeScale: (scale) => {
        this.#timeScale = scale;
        this.#publishStatus(services);
      },
      record: () => this.recordTrial(services),
      snapshot: () => this.#snapshot(services),
    };

    this.#refreshControls = mountPendulumControls(container, model);  }

  #snapshot(services: LabServices): PendulumSnapshot {
    const rig = this.#rig;
    const { azimuth } = this.#apparentHeights(services);
    return {
      threadLengthM: rig?.threadLengthM ?? 0.4,
      clampHeightM: rig?.clampHeightM ?? 0.62,
      releaseAngleDeg: this.#releaseAngleDeg,
      locationId: this.#location.id,
      draught: this.#swing.draught,
      showSwingCounter: this.#showSwingCounter,
      stopwatchElapsedS: this.#stopwatch.elapsed,
      stopwatchRunning: this.#stopwatch.running,
      oscillations: this.#oscillations,
      timeScale: this.#timeScale,
      completedSwings: this.completedSwings,
      amplitudeDeg: this.#amplitudeDeg(),
      readingTarget: this.#readingTarget,
      reading: this.#readings.snapshot,
      measuredLengthM: this.#readings.measuredLengthM,
      azimuthRad: azimuth,
      lensMarker: this.#lensMarker,
    };
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
    this.#refreshControls?.dispose();
    this.#refreshControls = null;
    this.#rig = null;
    this.#stopwatchObject = null;
    this.#stopwatchView = null;
  }

  /** Extra information shown in the "apparatus" tab header. */
  get summary(): string {
    const rig = this.#rig;
    if (!rig) return 'Not assembled';
    return `Thread ${(rig.threadLengthM * 100).toFixed(1)} cm · clamp at ${(rig.clampHeightM * 100).toFixed(0)} cm`;
  }
}
