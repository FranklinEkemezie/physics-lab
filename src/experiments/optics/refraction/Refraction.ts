/**
 * WAEC-style practical: the refractive index of a glass block.
 *
 * ---------------------------------------------------------------------------
 * What is real here
 * ---------------------------------------------------------------------------
 * The rays are not animated decoration: the refracted ray is traced through the
 * block in `@/physics/optics`, so the picture on the paper is exactly what
 * Snell's law predicts. The ray box is moved round the protractor and its slit
 * is kept on the start of the beam, so the incident ray really does leave the
 * box.
 *
 * The refractive index of the block is randomised per run and printed nowhere,
 * so it has to be measured. The dominant error is the student's: angles read
 * off a protractor against a ray only a pencil-line wide, to the nearest degree.
 */

import { snap } from '@/core/math';
import { criticalAngleRad, refractiveIndexFromAngles, speedInMedium } from '@/physics/optics';
import type { GroupId } from '@/lab/types';
import {
  BaseExperiment,
  type AnalysisResult,
  type ColumnDef,
  type DataSet,
  type ExperimentStatus,
  type LabServices,
} from '../../types';
import { RefractionRig } from './RefractionRig';
import { analyseRefraction } from './analysis';
import { mountRefractionControls, type RefractionControlsModel, type RefractionSnapshot } from './controls';

/** Scatter on an angle read from a protractor, in degrees. */
const SIGMA_ANGLE_DEG = 0.5;
/** Angles are read to the nearest degree. */
const ANGLE_STEP_DEG = 1;
/** Where the ray box starts, and the range it may be moved over. */
const START_ANGLE_DEG = 30;
const MIN_ANGLE_DEG = 5;
const MAX_ANGLE_DEG = 80;

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

export class RefractionExperiment extends BaseExperiment {
  readonly id = 'refraction';
  readonly title = 'Refraction — the refractive index of a glass block';
  readonly group: GroupId = 'optics';

  readonly aim =
    'To trace the path of a ray of light through a rectangular glass block and hence determine the refractive index of the glass.';

  readonly theory = `When light passes from air into glass it slows down and bends **towards** the normal. Snell's law relates the two angles:

  **n = sin i / sin r**

where i is the angle of incidence and r the angle of refraction, both measured from the normal.

Rearranged, sin i = n sin r, so a graph of **sin i (y-axis) against sin r (x-axis)** is a straight line through the origin whose **gradient is the refractive index n**.

Because the block's faces are parallel, the ray that emerges is *parallel* to the ray that went in, merely shifted sideways — which is why you must mark the incident and emergent rays and join them up to find the hidden refracted ray.`;

  readonly procedure = [
    'Place the glass block in the middle of the paper and draw round it.',
    'Draw a normal (a dashed line at right angles to the face) at the point where the ray will enter.',
    'Direct the ray from the ray box so that it strikes that point at about 20° to the normal. Mark the incident ray.',
    'Mark the ray that emerges from the opposite face. Remove the block and join the entry and exit marks to find the refracted ray inside.',
    'Measure the angle of incidence i and the angle of refraction r from the normal, and record them.',
    'Repeat for at least six angles between about 10° and 75°, always striking the same point.',
    'Plot a graph of sin i against sin r and measure its gradient — that is the refractive index of the glass.',
  ];

  readonly columns: readonly ColumnDef[] = [
    { id: 'incidenceDeg', header: 'i', unit: '°', decimals: 0, role: 'raw', hint: 'Angle between the incident ray and the normal.' },
    { id: 'refractionDeg', header: 'r', unit: '°', decimals: 0, role: 'raw', hint: 'Angle between the refracted ray and the normal.' },
    {
      id: 'sinI',
      header: 'sin i',
      unit: '',
      decimals: 3,
      role: 'dependent',
      hint: 'Sine of the angle of incidence (plotted on the y-axis).',
    },
    {
      id: 'sinR',
      header: 'sin r',
      unit: '',
      decimals: 3,
      role: 'independent',
      hint: 'Sine of the angle of refraction (plotted on the x-axis).',
    },
  ];

  #services: LabServices | null = null;
  #rig: RefractionRig | null = null;
  /** The block on the paper, including the index the student must find. */
  #refractiveIndex = 1.5;
  #incidenceDeg = START_ANGLE_DEG;
  #refreshControls: (() => void) | null = null;

  setup(services: LabServices): void {
    this.#services = services;
    this.#refreshControls = null;

    // A fresh block each run, with an index the student has to measure.
    this.#refractiveIndex = services.rng.range(1.45, 1.6);
    this.#incidenceDeg = START_ANGLE_DEG;

    const rig = new RefractionRig(services.lab, this.#refractiveIndex, this.#incidenceDeg * RAD_PER_DEG);
    this.#rig = rig;
    this.onDispose(() => {
      rig.dispose();
      this.#rig = null;
      this.#refreshControls = null;
    });

    services.bus.emit('coach:say', {
      text: 'Set an angle with the ray box, read i and r from the normal, then record them.',
    });
  }

  override update(): void {
    this.#refreshControls?.();
  }

  override status(): ExperimentStatus {
    const rawRefractionDeg = this.#refractionDeg();
    const refractionDeg = Number.isNaN(rawRefractionDeg) ? 0 : rawRefractionDeg;
    const criticalDeg = criticalAngleRad(this.#refractiveIndex) * DEG_PER_RAD;

    const chips: ExperimentStatus['chips'] = [
      { label: 'i', value: `${this.#incidenceDeg.toFixed(0)}°` },
      { label: 'r', value: `${refractionDeg.toFixed(0)}°` },
      { label: 'sin i / sin r', value: (Math.sin(this.#incidenceDeg * RAD_PER_DEG) / Math.sin(refractionDeg * RAD_PER_DEG)).toFixed(2) },
    ];

    const already = this.#seenAngles().has(this.#incidenceDeg);
    let hint: string;
    if (this.#incidenceDeg < 15 || this.#incidenceDeg > 75) {
      hint = 'Angles near the ends of the range are hard to read accurately. Keep between 15° and 75°.';
    } else if (already) {
      hint = `You already have a reading at ${this.#incidenceDeg.toFixed(0)}°. Move the ray box to a fresh angle.`;
    } else {
      hint = 'Read both angles from the normal, then press “Record angles”.';
    }

    const state = this.#services?.data.rows.length ? 'recording' : 'ready';
    return {
      state,
      chips,
      hint:
        this.#incidenceDeg > criticalDeg
          ? `${hint} (Past the critical angle the light cannot get back out of the far face.)`
          : hint,
    };
  }

  override analyse(dataset: DataSet): AnalysisResult {
    return analyseRefraction(dataset.rows);
  }

  /**
   * Every point carries a vertical uncertainty of its own: an error of ±δ in an
   * angle shifts `sin i` by `cos i · δ`, which is largest for small angles.
   */
  graphDecorations(dataset: DataSet): { yErrors: number[] } {
    return {
      yErrors: dataset.rows.map((row) => Math.abs(Math.cos(row.values.incidenceDeg * RAD_PER_DEG)) * SIGMA_ANGLE_DEG * RAD_PER_DEG),
    };
  }

  reveal(): string | null {
    const criticalDeg = criticalAngleRad(this.#refractiveIndex) * DEG_PER_RAD;
    const speedKmPerS = speedInMedium(299_792.458, this.#refractiveIndex);
    return (
      `This block's refractive index is n = ${this.#refractiveIndex.toFixed(3)}. ` +
      `Light inside it travels at ${speedKmPerS.toFixed(0)} km/s, and its critical angle is ${criticalDeg.toFixed(1)}°.`
    );
  }

  buildControls(container: HTMLElement): void {
    const model: RefractionControlsModel = {
      setIncidenceDeg: (degrees) => this.#setIncidenceDeg(degrees),
      record: () => this.#record(),
      snapshot: () => this.#snapshot(),
    };
    this.#refreshControls = mountRefractionControls(container, model);
  }

  // -------------------------------------------------------------------------
  // Internal bookkeeping
  // -------------------------------------------------------------------------

  /** The angle of refraction the beam actually makes, in degrees. */
  #refractionDeg(): number {
    const rig = this.#rig;
    if (!rig) return Number.NaN;
    return rig.refractionRad * DEG_PER_RAD;
  }

  #seenAngles(): Set<number> {
    const rows = this.#services?.data.rows ?? [];
    return new Set(rows.map((row) => row.values.incidenceDeg));
  }

  #setIncidenceDeg(degrees: number): void {
    this.#incidenceDeg = Math.max(MIN_ANGLE_DEG, Math.min(MAX_ANGLE_DEG, degrees));
    this.#rig?.setIncidenceRad(this.#incidenceDeg * RAD_PER_DEG);
  }

  #record(): void {
    const services = this.#services;
    const rig = this.#rig;
    if (!services || !rig) return;

    if (this.#seenAngles().has(this.#incidenceDeg)) {
      services.bus.emit('toast', {
        message: `You have already recorded a reading at ${this.#incidenceDeg.toFixed(0)}°. Move the ray box.`,
        level: 'warn',
      });
      return;
    }

    // Two angles are read off the protractor, each to the nearest degree.
    const trueRefractionDeg = this.#refractionDeg();
    const incidenceDeg = clampAngle(snap(services.rng.normal(this.#incidenceDeg, SIGMA_ANGLE_DEG), ANGLE_STEP_DEG));
    const refractionDeg = clampAngle(snap(services.rng.normal(trueRefractionDeg, SIGMA_ANGLE_DEG), ANGLE_STEP_DEG));

    const sinI = Math.sin(incidenceDeg * RAD_PER_DEG);
    const sinR = Math.sin(refractionDeg * RAD_PER_DEG);

    services.data.addRow(
      { incidenceDeg, refractionDeg, sinI, sinR },
      { note: `i = ${incidenceDeg.toFixed(0)}°, r = ${refractionDeg.toFixed(0)}°` },
    );

    const ratio = refractiveIndexFromAngles(incidenceDeg * RAD_PER_DEG, refractionDeg * RAD_PER_DEG);
    services.bus.emit('toast', {
      message: `Recorded i = ${incidenceDeg.toFixed(0)}°, r = ${refractionDeg.toFixed(0)}° — sin i / sin r = ${ratio.toFixed(2)}.`,
      level: 'good',
    });
  }

  #snapshot(): RefractionSnapshot {
    const refractionDeg = this.#refractionDeg();
    const sinI = Math.sin(this.#incidenceDeg * RAD_PER_DEG);
    const sinR = Math.sin(refractionDeg * RAD_PER_DEG);
    return {
      incidenceDeg: this.#incidenceDeg,
      refractionDeg: Number.isNaN(refractionDeg) ? 0 : refractionDeg,
      sinI: Number.isNaN(sinI) ? 0 : sinI,
      sinR: Number.isNaN(sinR) ? 0 : sinR,
      canRecord: this.#rig !== null && !this.#seenAngles().has(this.#incidenceDeg),
      recorded: this.#services?.data.rows.length ?? 0,
    };
  }
}

/** Keep a read angle inside the 0–89° range a protractor can show. */
function clampAngle(degrees: number): number {
  return Math.max(0, Math.min(89, degrees));
}
