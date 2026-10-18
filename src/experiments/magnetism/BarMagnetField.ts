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
import {
  DEFLECTION_READING_SIGMA_DEG,
  DISTANCE_READING_SIGMA_M,
  EARTH_HORIZONTAL_T,
  halfFieldDistanceM,
  inverseCubeError,
  momentFromGradient,
  tanError,
} from '@/physics/magnetism';
import { linearFit } from '@/physics/statistics';
import { button, card, note, numberField, stat, toggle } from '@/ui/widgets';
import type { ButtonWidget, NumberFieldWidget, ToggleWidget } from '@/ui/widgets';

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
  #readingDcm: number | null = null;
  #readingThetaDeg: number | null = null;
  #readFromApparatus = false;

  // --- Options -------------------------------------------------------------
  #showGuide = false;
  #showFilings = false;

  // --- Live widgets --------------------------------------------------------
  #widgets: {
    position?: ReturnType<typeof stat>;
    dField?: NumberFieldWidget;
    thetaField?: NumberFieldWidget;
    recordButton?: ButtonWidget;
    guideToggle?: ToggleWidget;
    filingsToggle?: ToggleWidget;
  } = {};

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
      this.#validate();
      this.#updatePositionStat();
    }
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
    this.#readingDcm = apparent.dCm;
    this.#readingThetaDeg = apparent.thetaDeg;
    this.#readFromApparatus = true;
    this.#widgets.dField?.setValue(apparent.dCm);
    this.#widgets.thetaField?.setValue(apparent.thetaDeg);
    this.#validate();
    services.bus.emit('coach:say', {
      text: `Read d = ${apparent.dCm.toFixed(1)} cm, θ = ${apparent.thetaDeg.toFixed(0)}°. Press Record to log it.`,
    });
  }

  #updatePositionStat(): void {
    const rig = this.#rig;
    const widget = this.#widgets.position;
    if (!rig || !widget) return;
    const offLine = rig.compassOffLine;
    const offLineText = offLine < 0.001 ? 'on the line' : `${(offLine * 1000).toFixed(0)} mm off line`;
    widget.set(`d = ${(rig.scaleDistanceM * 100).toFixed(1)} cm · ${offLineText}`, offLine > 0.004 ? 'warn' : 'good');
  }

  /** Colour the entry fields by how well they match what the apparatus shows. */
  #validate(): void {
    const apparent = this.#apparent();
    const { dField, thetaField } = this.#widgets;
    if (!apparent || !dField || !thetaField) return;

    const d = this.#readingDcm;
    if (d === null) dField.setStatus('none');
    else {
      const errorCm = Math.abs(d - apparent.dCm);
      if (errorCm <= 0.15) dField.setStatus('good', '✓');
      else if (errorCm <= 0.4) dField.setStatus('warn', `${(errorCm * 10).toFixed(1)} mm off`);
      else dField.setStatus('bad', `${(errorCm * 10).toFixed(1)} mm off — re-read`);
    }

    const theta = this.#readingThetaDeg;
    if (theta === null) thetaField.setStatus('none');
    else {
      const errorDeg = Math.abs(theta - apparent.thetaDeg);
      if (errorDeg <= 2) thetaField.setStatus('good', '✓');
      else if (errorDeg <= 5) thetaField.setStatus('warn', `${errorDeg.toFixed(0)}° off`);
      else thetaField.setStatus('bad', `${errorDeg.toFixed(0)}° off — re-read`);
    }
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
    const d = this.#readingDcm;
    if (d !== null) {
      if (d / 100 < MAGNET_RIG.minDistanceM) {
        warnings.push(
          `d = ${d.toFixed(1)} cm is closer than the magnet is long; the bar is not a point dipole there.`,
        );
      }
      if (d / 100 > MAGNET_RIG.maxDistanceM) warnings.push('That reading is at the very edge of the paper.');
    }
    const theta = this.#readingThetaDeg;
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

    const dCm = this.#readingDcm;
    const theta = this.#readingThetaDeg;
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
      this.#readFromApparatus ? 'read from the scale and needle' : 'partly typed in',
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
    this.#readingDcm = null;
    this.#readingThetaDeg = null;
    this.#readFromApparatus = false;
    this.#widgets.dField?.setValue(null);
    this.#widgets.thetaField?.setValue(null);
    this.#widgets.thetaField?.setStatus('none');

    services.bus.emit('graph:refresh', {});
    this.#publishStatus(services);
  }

  // -------------------------------------------------------------------------
  // Analysis
  // -------------------------------------------------------------------------

  override analyse(dataset: DataSet): AnalysisResult {
    const rows = dataset.rows;
    const lines: string[] = [];
    const tips: string[] = [];

    if (rows.length < 2) {
      return {
        headline: 'Record at least two readings to draw a graph.',
        lines: ['Put the compass on the equatorial line, read d from the scale and θ from the needle, then press Record.'],
        tips: ['Aim for six or more distances spread between about 12 cm and 45 cm.'],
      };
    }

    const xs = rows.map((row) => row.values.invD3);
    const ys = rows.map((row) => row.values.tanTheta);
    const fit = linearFit(xs, ys);
    if (!fit) {
      return { headline: 'Not enough distinct distances to fit a line.', lines };
    }

    const gradient = fit.slope;
    const moment = momentFromGradient(gradient, this.#earthH);
    const momentUncertainty =
      gradient !== 0 && Number.isFinite(fit.slopeStdError)
        ? Math.abs((moment * fit.slopeStdError) / gradient)
        : Number.NaN;

    const headline = `m ≈ ${moment.toFixed(2)} A·m²   (tan θ ∝ 1/d³, r² = ${fit.r2.toFixed(4)})`;

    lines.push(
      `Gradient of the tan θ–(1/d³) graph = ${gradient.toExponential(3)} m³   (± ${fit.slopeStdError.toExponential(2)})`,
    );
    lines.push(`Intercept = ${fit.intercept.toExponential(2)}   (ideal value: 0)`);
    lines.push(
      `m = 4πH·gradient/μ₀ = ${moment.toFixed(3)}` +
        (Number.isFinite(momentUncertainty) ? ` ± ${Math.max(0.005, momentUncertainty).toFixed(3)}` : '') +
        ' A·m²',
    );
    lines.push(
      `The needle sits at 45° (magnet's field = Earth's) at ${(Math.cbrt(gradient) * 100).toFixed(1)} cm from the centre.`,
    );
    lines.push(`Correlation coefficient r² = ${fit.r2.toFixed(5)}   (points: ${fit.n})`);
    lines.push(`Earth's horizontal field used: H = ${(this.#earthH * 1e6).toFixed(0)} µT.`);

    // --- Quality checks ----------------------------------------------------
    if (fit.r2 < 0.995) {
      tips.push(
        `Your points are not very collinear (r² = ${fit.r2.toFixed(4)}). The commonest cause is the compass not being ` +
          'exactly on the equatorial line, followed by measuring d from the end of the magnet instead of its centre.',
      );
    }

    const maxY = Math.max(...ys.map((value) => Math.abs(value)), 1e-6);
    if (Math.abs(fit.intercept) > 0.05 * maxY) {
      tips.push(
        `The intercept is ${fit.intercept.toExponential(2)}, well away from zero. A straight line that misses the origin ` +
          'usually means the compass was offset from the line, or that the needle has a zero error.',
      );
    }

    const tooClose = rows.filter((row) => row.values.d < MAGNET_RIG.minDistanceM);
    if (tooClose.length > 0) {
      tips.push(
        `${tooClose.length} of ${rows.length} readings used d < ${(MAGNET_RIG.minDistanceM * 100).toFixed(0)} cm, where the ` +
          'bar is too short to behave like a point dipole — those points bend the line downwards.',
      );
    }

    const tooFar = rows.filter((row) => row.values.tanTheta < Math.tan(THREE.MathUtils.degToRad(6)));
    if (tooFar.length > 0) {
      tips.push(
        `${tooFar.length} reading(s) had θ below 6°. Far from the magnet the ±1° you can read on the card is a very large ` +
          'fraction of θ, so the outermost points scatter most: weight the nearer, well-deflected readings more heavily.',
      );
    }

    if (rows.length < 5) {
      tips.push('Six or seven well-spread distances make a far more convincing graph than three.');
    }

    tips.push('Press Reveal in the analysis panel to check your moment against the one this magnet actually has.');

    return { headline, lines, fit, tips };
  }

  /**
   * Error bars from the two reading errors: ±0.5 mm on the scale position and
   * ±0.5° on the needle. The error on `1/d³` is `3δd/d⁴`; on `tan θ` it is
   * `δθ·sec²θ`. Both blow up where the physics is weakest, which is the point.
   */
  graphDecorations(dataset: DataSet): {
    xErrors?: number[];
    yErrors?: number[];
    theory?: { slope: number; intercept: number; label: string };
  } {
    const deltaTheta = THREE.MathUtils.degToRad(DEFLECTION_READING_SIGMA_DEG);
    return {
      xErrors: dataset.rows.map((row) => inverseCubeError(row.values.d, DISTANCE_READING_SIGMA_M)),
      yErrors: dataset.rows.map((row) => tanError(THREE.MathUtils.degToRad(row.values.theta), deltaTheta)),
    };
  }

  /** Reveal the moment of this particular bar magnet. */
  reveal(): string | null {
    const rig = this.#rig;
    if (!rig) return null;
    const halfCm = halfFieldDistanceM(rig.magnet, this.#earthH) * 100;
    return (
      `This bar magnet's moment is m = ${rig.magnet.momentAm2.toFixed(3)} A·m². ` +
      `Against the Earth's horizontal field of ${(this.#earthH * 1e6).toFixed(0)} µT the needle reaches 45° ` +
      `at ${halfCm.toFixed(1)} cm from the centre.`
    );
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
    if (this.#readingDcm !== null && this.#readingThetaDeg !== null) {
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
    this.#widgets = {};

    // ---- 1. Apparatus -----------------------------------------------------
    const apparatus = card('Plotting the field', { glyph: '🧭' });
    apparatus.body.append(
      note(
        'The needle points along the resultant of the magnet and the Earth, so every pencil mark you walk out is a real field line.',
        'info',
      ),
    );

    const bar = document.createElement('div');
    bar.className = 'pl-btnrow';
    bar.append(
      button({
        label: 'Walk one step',
        glyph: '👣',
        variant: 'primary',
        title: 'Advance the compass 1 cm along the needle and leave a pencil mark (W)',
        onClick: () => this.walkStep(services),
      }).root,
    );
    bar.append(
      button({
        label: 'New line',
        glyph: '✏️',
        title: 'Finish this pencil line and start a fresh one (N)',
        onClick: () => this.newLine(services),
      }).root,
    );
    apparatus.body.append(bar);

    const bar2 = document.createElement('div');
    bar2.className = 'pl-btnrow';
    bar2.append(
      button({
        label: 'Rub out lines',
        glyph: '🧹',
        title: 'Clear every pencil line',
        onClick: () => {
          rig.clearPencilLines();
          services.bus.emit('coach:say', { text: 'Pencil lines cleared — the paper is blank again.' });
        },
      }).root,
    );
    bar2.append(
      button({
        label: 'Square up',
        glyph: '👁',
        title: 'Look straight down on the paper',
        onClick: () => this.squareUp(services),
      }).root,
    );
    apparatus.body.append(bar2);

    this.#widgets.guideToggle = toggle({
      label: 'Training wheels — draw the whole field line',
      hint: 'Shows the complete field line through the compass (dashed). Turn it off in exam conditions and plot the line yourself.',
      value: this.#showGuide,
      onChange: (value) => {
        this.#showGuide = value;
        rig.updateGuideLine(value);
      },
    });
    apparatus.body.append(this.#widgets.guideToggle.root);

    this.#widgets.filingsToggle = toggle({
      label: 'Lay the iron-filings card over the magnet',
      hint: 'Sprinkle-on-a-card view of the same dipole field.',
      value: this.#showFilings,
      onChange: (value) => {
        this.#showFilings = value;
        rig.setFilingsVisible(value);
      },
    });
    apparatus.body.append(this.#widgets.filingsToggle.root);

    apparatus.body.append(
      stat('Earth\'s horizontal field', `${(this.#earthH * 1e6).toFixed(0)} µT`).root,
    );

    container.append(apparatus.root);

    // ---- 2. Reading the scale --------------------------------------------
    const reading = card('Reading the scale and the needle', { glyph: '📏' });
    reading.body.append(
      note(
        'Read the distance d from the printed centimetre scale and the deflection θ of the red end of the needle from N. The table stores d in metres.',
        'info',
      ),
    );

    this.#widgets.position = stat('Compass on the scale', '—');
    this.#updatePositionStat();
    reading.body.append(this.#widgets.position.root);

    const takeRow = document.createElement('div');
    takeRow.className = 'pl-btnrow';
    takeRow.append(
      button({
        label: 'Use this reading',
        glyph: '🔍',
        variant: 'primary',
        title: 'Copy the scale distance and the needle deflection into the fields below',
        onClick: () => this.#takeReading(services),
      }).root,
    );
    reading.body.append(takeRow);

    this.#widgets.dField = numberField({
      label: 'Distance d from the centre',
      unit: 'cm',
      step: 0.05,
      decimals: 2,
      value: this.#readingDcm,
      placeholder: 'read from the scale',
      hint: 'Measured along the equatorial line, from the centre of the magnet.',
      onCommit: (value) => {
        this.#readingDcm = value;
        if (value !== null) this.#readFromApparatus = false;
        this.#validate();
      },
    });
    this.#widgets.thetaField = numberField({
      label: 'Deflection θ of the needle',
      unit: '°',
      step: 1,
      decimals: 0,
      value: this.#readingThetaDeg,
      placeholder: 'read from the card',
      hint: 'Angle between the red end of the needle and the N mark.',
      onCommit: (value) => {
        this.#readingThetaDeg = value;
        if (value !== null) this.#readFromApparatus = false;
        this.#validate();
      },
    });
    reading.body.append(this.#widgets.dField.root, this.#widgets.thetaField.root);

    reading.body.append(
      note(
        'Where the magnet\'s field is comparable to the Earth\'s the needle swings a long way round — that is the part of the paper where the reading is most sensitive, and where the graph is best defined.',
        'info',
      ),
    );

    container.append(reading.root);

    // ---- 3. Record --------------------------------------------------------
    const record = card('Record the reading', { glyph: '📝' });
    this.#widgets.recordButton = button({
      label: 'Record reading',
      glyph: '➕',
      variant: 'primary',
      title: 'Add d, θ, 1/d³ and tan θ to the table (Enter)',
      onClick: () => this.recordTrial(services),
    });
    record.body.append(this.#widgets.recordButton.root);
    record.body.append(
      note('1/d³ and tan θ are computed for you. Keep the compass on the equatorial line or the graph will bend.', 'info'),
    );
    container.append(record.root);
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
    this.#rig?.dispose();
    this.#rig = null;
    this.#widgets = {};
    this.#readingDcm = null;
    this.#readingThetaDeg = null;
    this.#readFromApparatus = false;
    this.#lastValidatedPosition = null;
  }
}
