/**
 * WAEC-style practical: plotting the magnetic field of a bar magnet.
 *
 * ---------------------------------------------------------------------------
 * The two halves of the practical
 * ---------------------------------------------------------------------------
 * **Plotting the field lines.** The student walks a plotting compass across the
 * paper. The needle always settles along the *real* resultant of the magnet's
 * dipole field and the Earth's horizontal field, so the pencil line the student
 * walks out is a genuine field line — leave the compass still and it points
 * north, put it near a pole and it snaps round.
 *
 * **Measuring the field.** The classic quantitative version of this practical
 * puts the compass on the *equatorial line* (through the magnet's centre, at
 * right angles to it). There the magnet's field is perpendicular to the Earth's
 * horizontal field `H`, so the needle is deflected by θ with
 *
 * ```text
 *   tan θ = |B| / H = (μ₀/4π)·m / (H·d³) .
 * ```
 *
 * A graph of `tan θ` against `1/d³` is therefore a straight line through the
 * origin, and its gradient hands over the magnet's magnetic moment `m`. The
 * moment of the bar is not written anywhere on it: the student has to find it.
 *
 * ---------------------------------------------------------------------------
 * What is real here
 * ---------------------------------------------------------------------------
 *  - The needle follows the resultant field, so the Earth is *always* present.
 *    Far from the magnet the deflection dies away and the compass points north
 *    again — which is exactly why the graph runs out of road past ~45 cm.
 *  - `d` is read off a printed centimetre scale to about ±0.5 mm, and θ off the
 *    compass card to about ±1°. Both appear as scatter, and the scatter is
 *    worst for the far readings where tan θ is small.
 *  - The distance at which the two fields are equal (and the needle sits at
 *    45°) falls out of the maths instead of being told to the student.
 *  - The magnet is treated as a point dipole. Inside about 11 cm — comparable
 *    to the bar's own length — that approximation breaks down, and the
 *    analysis says so. Real data behaves the same way.
 */

import * as THREE from 'three';
import { BaseExperiment } from '../types';
import type { AnalysisResult, ColumnDef, DataSet, ExperimentStatus, LabServices } from '../types';
import type { GroupId } from '@/lab/types';
import { MAGNET_RIG, MagnetFieldRig } from './MagnetFieldRig';
import { EARTH_HORIZONTAL_T } from '@/physics/electromagnetism';
import { analyseMagnet, magnetGraphDecorations, revealMagnet } from './MagnetAnalysis';
import { CompassReading } from './MagnetReading';
import type { ReadingField, ReadingStatus } from './MagnetReading';
import { mountMagnetControls } from './MagnetControls';
import type { MagnetControlsHandle, MagnetControlsModel, MagnetSnapshot } from './MagnetControls';

export class BarMagnetFieldExperiment extends BaseExperiment {
  readonly id = 'magnetic-field';
  readonly title = 'Plotting the field of a bar magnet';
  readonly group: GroupId = 'magnetism';

  readonly aim =
    'To plot the magnetic field lines of a bar magnet with a plotting compass, and to verify that, on the ' +
    'equatorial line, the tangent of the deflection obeys an inverse-cube law in the distance.';

  readonly theory =
    'A plotting compass needle settles along the *resultant* of every field at that point. Put the compass on ' +
    'the **equatorial line** — the line through the magnet\'s centre at right angles to it — and the magnet\'s ' +
    'field `B` is perpendicular to the Earth\'s horizontal field `H`, so the needle is deflected by θ where ' +
    '`tan θ = B/H`. For a dipole the equatorial field is `B = (μ₀/4π)·m/d³`, hence\n\n' +
    '`tan θ = ((μ₀/4π)·m / H) · (1/d³)`.\n\n' +
    'So a graph of **tan θ against 1/d³** is a straight line through the origin whose gradient is `(μ₀/4π)·m/H`. ' +
    'The Earth\'s field also makes the compass swing back to north where the magnet is weak, which is why the ' +
    'data only behave beyond about 12 cm.';

  readonly procedure = [
    'Lay the paper with its equatorial line through the centre of the magnet and its scale pointing away from a pole.',
    'Put the plotting compass on the line, a short distance from the magnet, and let the needle settle.',
    'Read the distance d from the printed scale and the deflection θ of the red end of the needle from N.',
    'Record the pair, then move the compass to a new distance and repeat — six or more readings between about 12 cm and 45 cm.',
    'Plot a graph of tan θ against 1/d³; it should be a straight line through the origin.',
    'Take the gradient and compute the magnet\'s moment from m = 4πH·gradient/μ₀.',
    'To plot the field lines, walk the compass along the needle, marking the position after every small step.',
  ] as const;

  readonly columns: readonly ColumnDef[] = [
    {
      id: 'd',
      header: 'd',
      unit: 'm',
      decimals: 3,
      role: 'raw',
      hint: 'Distance from the centre of the magnet to the compass, read along the equatorial line.',
    },
    {
      id: 'theta',
      header: 'θ',
      unit: '°',
      decimals: 1,
      role: 'raw',
      hint: 'Deflection of the needle from magnetic north.',
    },
    {
      id: 'invD3',
      header: '1/d³',
      unit: 'm⁻³',
      decimals: 1,
      role: 'independent',
      hint: 'Plotted on the x-axis. The gradient of the graph is (μ₀/4π)·m/H.',
    },
    {
      id: 'tanTheta',
      header: 'tan θ',
      decimals: 4,
      role: 'dependent',
      hint: 'Plotted on the y-axis.',
    },
  ];

  // --- Apparatus -----------------------------------------------------------
  #rig: MagnetFieldRig | null = null;
  #earthH = EARTH_HORIZONTAL_T;

  // --- Reading -------------------------------------------------------------
  #reading = new CompassReading();

  // --- Options -------------------------------------------------------------
  #showGuide = false;
  #showFilings = false;

  // --- Controls ------------------------------------------------------------
  #refreshControls: MagnetControlsHandle | null = null;

  #lastValidatedPosition: { x: number; z: number } | null = null;

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------

  override setup(services: LabServices): void {
    // A fresh bar magnet every time: its moment is the quantity to be measured.
    const momentAm2 = Number(services.rng.range(0.7, 1.8).toFixed(3));
    this.#rig = new MagnetFieldRig(services.lab, { momentAm2 });

    this.squareUp(services);
    this.#bindKeyboard(services);

    // React as soon as the student lets go of the compass rather than waiting
    // for the next animation frame, so the read-out never looks stuck.
    this.onDispose(
      services.lab.bus.on('object:dragged', (event) => {
        if (event.instanceId === this.#rig?.compass.instanceId) this.#refreshLive(true);
      }),
    );

    services.bus.emit('coach:say', {
      text: 'Drag the compass along the equatorial line, read d and θ, then press Record. Use the training-wheels toggle to see a whole field line.',
    });
    services.bus.emit('panel:refresh', {});
  }

  #bindKeyboard(services: LabServices): void {
    const onKeyDown = (event: KeyboardEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;

      if (event.key === 'Enter') {
        this.recordTrial(services);
      } else if (event.key === 'w' || event.key === 'W') {
        this.walkStep(services);
      } else if (event.key === 'n' || event.key === 'N') {
        this.newLine(services);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    this.onDispose(() => window.removeEventListener('keydown', onKeyDown));
  }

  // -------------------------------------------------------------------------
  // Per-frame
  // -------------------------------------------------------------------------

  override update(_dt: number, services: LabServices): void {
    if (!this.#rig) return;
    this.#refreshLive();
    this.#publishStatus(services);
  }

  /**
   * Bring everything that depends on *where the compass is* up to date: the
   * needle, the training-wheels guide, the scale read-out and the entry-field
   * validation. Called every frame, and directly whenever the compass moves, so
   * the apparatus never lags behind the hand.
   */
  #refreshLive(force = false): void {
    const rig = this.#rig;
    if (!rig) return;

    rig.setNeedle();
    rig.updateGuideLine(this.#showGuide);

    const position = rig.compassPosition();
    const moved =
      force ||
      !this.#lastValidatedPosition ||
      Math.hypot(position.x - this.#lastValidatedPosition.x, position.z - this.#lastValidatedPosition.z) > 0.001;
    if (moved) {
      this.#lastValidatedPosition = position;
      this.#refreshPanel();
    }
  }

  /** Push the current model values into the mounted control panel. */
  #refreshPanel(): void {
    this.#refreshControls?.refresh();
  }

  // -------------------------------------------------------------------------
  // Student actions
  // -------------------------------------------------------------------------

  /** Walk the compass one step along the needle, leaving a pencil mark. */
  walkStep(services: LabServices): void {
    const rig = this.#rig;
    if (!rig) return;
    rig.traceStep();
    this.#refreshLive(true);
    services.bus.emit('coach:say', {
      text: `Stepped ${(MAGNET_RIG.stepM * 100).toFixed(1)} cm along the needle. Keep going to follow the field line.`,
    });
  }

  /** Finish the current pencil line so the next step starts a new one. */
  newLine(services: LabServices): void {
    this.#rig?.startNewLine();
    this.#refreshLive(true);
    services.bus.emit('coach:say', { text: 'Started a fresh field line. Drag the compass to a new starting point.' });
  }

  /** Look down on the paper from a comfortable height. */
  squareUp(services: LabServices): void {
    const { camera, controls } = services.viewport;
    const lookAt = new THREE.Vector3(MAGNET_RIG.centreX + 0.05, 0.92, MAGNET_RIG.centreZ);
    camera.position.set(MAGNET_RIG.centreX + 0.12, 0.92 + 0.82, MAGNET_RIG.centreZ + 0.95);
    controls.target.copy(lookAt);
    controls.update();
    services.bus.emit('coach:say', {
      text: 'Camera squared up to the paper. The centimetre graduations beside the line read the distance d directly.',
    });
  }

  // -------------------------------------------------------------------------
  // Reading the apparatus
  // -------------------------------------------------------------------------

  /** What the student sees: the scale reading and the needle deflection. */
  #apparent(): { dCm: number; thetaDeg: number; offLineM: number } | null {
    const rig = this.#rig;
    if (!rig) return null;
    return {
      // The printed scale is read to the nearest millimetre...
      dCm: Math.round(rig.scaleDistanceM * 1000) / 10,
      // ...and the card to the nearest degree.
      thetaDeg: Math.round(Math.abs(THREE.MathUtils.radToDeg(rig.deflectionRad))),
      offLineM: rig.compassOffLine,
    };
  }

  /** Copy the scale and needle readings into the entry fields. */
  #takeReading(services: LabServices): void {
    const apparent = this.#apparent();
    if (!apparent) return;
    this.#reading.setFromLens(apparent.dCm, apparent.thetaDeg);
    this.#refreshPanel();
    services.bus.emit('coach:say', {
      text: `Read d = ${apparent.dCm.toFixed(1)} cm, θ = ${apparent.thetaDeg.toFixed(0)}°. Press Record to log it.`,
    });
  }

  /** Where the compass sits on the printed scale, and how far off the line. */
  #updatePositionStat(): { text: string; tone: 'default' | 'good' | 'warn' } {
    const rig = this.#rig;
    if (!rig) return { text: '—', tone: 'default' };
    const offLine = rig.compassOffLine;
    const offLineText = offLine < 0.001 ? 'on the line' : `${(offLine * 1000).toFixed(0)} mm off line`;
    return {
      text: `d = ${(rig.scaleDistanceM * 100).toFixed(1)} cm · ${offLineText}`,
      tone: offLine > 0.004 ? 'warn' : 'good',
    };
  }

  /** Colour an entry field by how well it matches what the apparatus shows. */
  #readingStatus(field: ReadingField): ReadingStatus {
    const apparent = this.#apparent();
    if (!apparent) return { level: 'none' };
    return field === 'd'
      ? this.#reading.verdictFor(this.#reading.dCm, apparent.dCm, 'cm')
      : this.#reading.verdictFor(this.#reading.thetaDeg, apparent.thetaDeg, '°');
  }

  // -------------------------------------------------------------------------
  // Recording
  // -------------------------------------------------------------------------

  #collectWarnings(): string[] {
    const warnings: string[] = [];
    const rig = this.#rig;
    const apparent = this.#apparent();
    if (!rig || !apparent) return warnings;

    if (apparent.offLineM > 0.003) {
      warnings.push(
        `The compass sat ${(apparent.offLineM * 1000).toFixed(0)} mm off the equatorial line — tan θ = B/H only holds on it.`,
      );
    }
    const d = this.#reading.dCm;
    if (d !== null) {
      if (d / 100 < MAGNET_RIG.minDistanceM) {
        warnings.push(
          `d = ${d.toFixed(1)} cm is closer than the magnet is long; the bar is not a point dipole there.`,
        );
      }
      if (d / 100 > MAGNET_RIG.maxDistanceM) warnings.push('That reading is at the very edge of the paper.');
    }
    const theta = this.#reading.thetaDeg;
    if (theta !== null) {
      if (theta < 6) warnings.push('The needle is barely deflected: out here the ±1° reading error dominates.');
      if (theta > 80) warnings.push('The needle is nearly at right angles — the compass is very close to the magnet.');
    }
    return warnings;
  }

  /** Add the current reading to the table. */
  recordTrial(services: LabServices): void {
    const rig = this.#rig;
    if (!rig) return;

    const dCm = this.#reading.dCm;
    const theta = this.#reading.thetaDeg;
    if (dCm === null || theta === null) {
      services.bus.emit('toast', {
        message: 'Take both readings first: the distance from the scale and the deflection of the needle.',
        level: 'warn',
      });
      return;
    }
    if (dCm <= 0) {
      services.bus.emit('toast', { message: 'The distance must be positive.', level: 'warn' });
      return;
    }

    const d = dCm / 100;
    const invD3 = 1 / d ** 3;
    const tanTheta = Math.tan(THREE.MathUtils.degToRad(theta));
    const warnings = this.#collectWarnings();

    const note = [
      `d = ${dCm.toFixed(1)} cm`,
      `θ = ${theta.toFixed(0)}°`,
      this.#reading.fromApparatus ? 'read from the scale and needle' : 'partly typed in',
    ].join(' · ');

    services.data.addRow({ d, theta, invD3, tanTheta }, { note, warnings });

    services.bus.emit('toast', {
      message: `Recorded d = ${dCm.toFixed(1)} cm, θ = ${theta.toFixed(0)}°.`,
      level: warnings.length > 0 ? 'warn' : 'good',
    });
    for (const warning of warnings) {
      services.bus.emit('toast', { message: `⚠ ${warning}`, level: 'warn', durationMs: 7000 });
    }

    // Clear the entry so the next reading starts clean.
    this.#reading.clear();
    this.#refreshPanel();

    services.bus.emit('graph:refresh', {});
    this.#publishStatus(services);
  }

  // -------------------------------------------------------------------------
  // Analysis
  // -------------------------------------------------------------------------

  override analyse(dataset: DataSet): AnalysisResult {
    return analyseMagnet(dataset.rows, this.#earthH, MAGNET_RIG.minDistanceM);
  }

  /**
   * Error bars from the two reading errors: ±0.5 mm on the scale position and
   * ±0.5° on the needle. The theory line is not drawn here — the moment is the
   * unknown — so this only ever returns the per-point uncertainties.
   */
  graphDecorations(dataset: DataSet): {
    xErrors?: number[];
    yErrors?: number[];
    theory?: { slope: number; intercept: number; label: string };
  } {
    return magnetGraphDecorations(dataset.rows);
  }

  /** Reveal the moment of this particular bar magnet. */
  reveal(): string | null {
    const rig = this.#rig;
    if (!rig) return null;
    return revealMagnet(rig.magnet.momentAm2, this.#earthH);
  }

  // -------------------------------------------------------------------------
  // Status
  // -------------------------------------------------------------------------

  #publishStatus(services: LabServices): void {
    services.bus.emit('status:changed', this.status(services));
  }

  override status(_services: LabServices): ExperimentStatus {
    const rig = this.#rig;
    const chips: ExperimentStatus['chips'] = [
      { label: 'H', value: `${(this.#earthH * 1e6).toFixed(0)} µT` },
    ];

    if (rig) {
      chips.push({ label: 'd', value: `${(rig.scaleDistanceM * 100).toFixed(1)} cm` });
      chips.push({ label: 'θ', value: `${Math.abs(THREE.MathUtils.radToDeg(rig.deflectionRad)).toFixed(0)}°` });
      chips.push({
        label: 'off line',
        value: `${(rig.compassOffLine * 1000).toFixed(0)} mm`,
        tone: rig.compassOffLine > 0.004 ? 'warn' : 'default',
      });
      if (rig.pencilPointCount > 1) {
        chips.push({ label: 'field line', value: `${rig.pencilPointCount} marks` });
      }
    }

    let state = 'mapping';
    let hint =
      'Drag the compass anywhere on the paper: the needle follows the field. For a *measurement*, keep it on the equatorial line.';
    if (this.#reading.dCm !== null && this.#reading.thetaDeg !== null) {
      state = 'measured';
      hint = 'Recording ready — press Record (or Enter) to add the reading to the table.';
    }

    return { state, chips, hint };
  }

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------

  buildControls(container: HTMLElement, services: LabServices): void {
    const rig = this.#rig;
    if (!rig) return;

    // The app rebuilds this panel whenever the practical's state changes shape,
    // so let the outgoing panel release anything it owns before we mount another.
    this.#refreshControls?.dispose();
    this.#refreshControls = null;

    const model: MagnetControlsModel = {
      walkStep: () => this.walkStep(services),
      newLine: () => this.newLine(services),
      rubOutLines: () => {
        rig.clearPencilLines();
        this.#refreshLive(true);
        services.bus.emit('coach:say', { text: 'Pencil lines cleared — the paper is blank again.' });
      },
      squareUp: () => this.squareUp(services),
      setShowGuide: (value) => {
        this.#showGuide = value;
        rig.updateGuideLine(value);
      },
      setShowFilings: (value) => {
        this.#showFilings = value;
        rig.setFilingsVisible(value);
      },
      takeReading: () => this.#takeReading(services),
      setTypedReading: (field, value) => {
        this.#reading.setTyped(field, value);
        this.#refreshPanel();
      },
      readingStatus: (field) => this.#readingStatus(field),
      record: () => this.recordTrial(services),
      snapshot: () => this.#snapshot(),
    };

    this.#refreshControls = mountMagnetControls(container, model);
  }

  #snapshot(): MagnetSnapshot {
    return {
      earthFieldUT: this.#earthH * 1e6,
      showGuide: this.#showGuide,
      showFilings: this.#showFilings,
      dCm: this.#reading.dCm,
      thetaDeg: this.#reading.thetaDeg,
      position: this.#updatePositionStat(),
    };
  }

  // -------------------------------------------------------------------------

  /** Extra information shown in the apparatus tab header. */
  get summary(): string {
    const rig = this.#rig;
    if (!rig) return 'Not assembled';
    return `Bar magnet with m unknown · H = ${(this.#earthH * 1e6).toFixed(0)} µT`;
  }

  override dispose(services: LabServices): void {
    super.dispose(services);
    this.#refreshControls?.dispose();
    this.#refreshControls = null;
    this.#rig?.dispose();
    this.#rig = null;
    this.#reading.clear();
    this.#lastValidatedPosition = null;
  }
}
