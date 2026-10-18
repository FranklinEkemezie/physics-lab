/**
 * WAEC-style practical: verify Hooke's law and find the spring constant.
 *
 * ---------------------------------------------------------------------------
 * What is real here
 * ---------------------------------------------------------------------------
 * The spring is **not** a rubber band on a slider. Its extension is computed
 * from the load with a real elastic limit, so:
 *
 *  - with a few hundred grams on it, `x` is exactly proportional to `F` and the
 *    graph is a straight line through the origin whose gradient is `1/k`;
 *  - hang too much and the spring **yields**: each extra newton then stretches
 *    it much further, and the last points lift off the line. Recognising those
 *    points — and discarding them — is the point of the exercise.
 *
 * The reading carries the same errors as the bench: the pointer is read against
 * a millimetre scale, and the extension is the *difference* of two such
 * readings, so its uncertainty is √2 larger than a single reading's.
 */

import { snap } from '@/core/math';
import { STANDARD_G } from '@/physics/constants';
import { realExtensionM, type Spring } from '@/physics/mechanics/hookes';
import { readingUncertaintyM } from '@/physics/measurement';
import type { GroupId } from '@/lab/types';
import {
  BaseExperiment,
  type AnalysisResult,
  type ColumnDef,
  type DataSet,
  type ExperimentStatus,
  type LabServices,
} from '../../types';
import { SpringRig } from './SpringRig';
import { analyseHookesLaw } from './analysis';
import { mountHookesControls, type HookesControlsModel, type HookesSnapshot } from './controls';

/** Standard deviation of one pointer reading against a 1 mm scale. */
const READING_SIGMA_M = readingUncertaintyM(0.001);
/** An extension is the difference of two readings, so its error is √2 larger. */
const EXTENSION_SIGMA_M = Math.SQRT2 * READING_SIGMA_M;
/** Sensible ceiling on how many masses the hanger will take. */
const MAX_MASSES = 12;

export class HookesLawExperiment extends BaseExperiment {
  readonly id = 'hookes-law';
  readonly title = "Hooke's law — the spring constant";
  readonly group: GroupId = 'mechanics';

  readonly aim =
    'To verify Hooke’s law and determine the force constant (stiffness) of a helical spring, and to find the load beyond which the spring stops obeying the law.';

  readonly theory = `For a spring that is not stretched past its **elastic limit**, the extension x is directly proportional to the stretching force F:

  **F = kx**

where the constant k is the stiffness (spring constant), in N m⁻¹. A graph of extension x (y-axis) against load F (x-axis) is a straight line through the origin, and its **gradient is 1/k**, so

  **k = 1 / gradient**.

Loaded beyond the elastic limit the spring yields: the gradient falls, the line bends upwards, and the spring may not return to its original length. Those points must be left out of the fit.`;

  readonly procedure = [
    'Check that the spring hangs freely from the clamp and that the pointer moves past the graduated rule.',
    'With only the hanger on the spring, let it settle and take the **zero reading** of the pointer against the rule.',
    'Hang a slotted mass on the hanger. Wait for the spring to stop moving, then record the new pointer reading and the load.',
    'Repeat with increasing loads, recording each time the load F and the extension x = (zero reading − new reading).',
    'Spread your points out and take at least six of them across the full range of the rule.',
    'Plot a graph of x against F. Measure its gradient and hence find k = 1/gradient.',
    'Look at your graph: if the last point or two lift away from the line, the spring has passed its elastic limit. Discard them and re-draw the best line through the remaining points.',
  ];

  readonly columns: readonly ColumnDef[] = [
    {
      id: 'loadN',
      header: 'F',
      unit: 'N',
      decimals: 2,
      role: 'independent',
      hint: 'Weight of the slotted masses: F = mg, with g = 9.81 m s⁻².',
    },
    {
      id: 'extensionM',
      header: 'x',
      unit: 'm',
      decimals: 4,
      role: 'dependent',
      hint: 'Pointer reading with the load minus the zero reading (hanger alone).',
    },
    { id: 'massG', header: 'm', unit: 'g', decimals: 0, role: 'raw', plottable: false },
    { id: 'pointerCm', header: 'pointer', unit: 'cm', decimals: 2, role: 'raw', plottable: false },
  ];

  #services: LabServices | null = null;
  #rig: SpringRig | null = null;
  /** The spring on the bench, including the stiffness the student must find. */
  #spring: Spring = { stiffnessNm: 25, naturalLengthM: 0.12, elasticLimitN: 4 };
  /** Slotted masses currently hung, in grams, bottom mass first. */
  #masses: number[] = [];
  #zeroReadingM = 0;
  #refreshControls: (() => void) | null = null;

  setup(services: LabServices): void {
    this.#services = services;

    // A fresh spring each run, with a stiffness the student has to measure.
    const stiffnessNm = services.rng.range(18, 34);
    this.#spring = {
      stiffnessNm,
      naturalLengthM: 0.12,
      elasticLimitN: stiffnessNm * services.rng.range(0.1, 0.17),
    };
    this.#masses = [];
    this.#refreshControls = null;

    const rig = new SpringRig(services.lab, this.#spring);
    this.#rig = rig;
    this.onDispose(() => {
      rig.dispose();
      this.#rig = null;
      this.#refreshControls = null;
    });

    // Zero the pointer with nothing but the hanger hanging on the spring.
    this.#applyLoad();
    rig.snapToTarget();
    this.#zeroReadingM = rig.fiducialHeightAboveBenchM;

    services.bus.emit('coach:say', {
      text: 'Hang a mass, wait for the spring to settle, then record the pointer reading.',
    });
  }

  override update(dt: number): void {
    this.#rig?.update(dt);
    this.#refreshControls?.();
  }

  override status(): ExperimentStatus {
    const snapshot = this.#snapshot();
    const chips: ExperimentStatus['chips'] = [
      { label: 'F', value: `${snapshot.slottedLoadN.toFixed(2)} N` },
      {
        label: 'x',
        value: `${(snapshot.extensionM * 100).toFixed(1)} cm`,
        tone: snapshot.pastLimit ? 'warn' : 'default',
      },
    ];

    let hint: string;
    if (this.#masses.length === 0) {
      hint = 'Hang a slotted mass on the hanger, then let the spring come to rest.';
    } else if (!snapshot.settled) {
      hint = 'The pointer is still moving — wait for the spring to settle.';
    } else if (snapshot.pastLimit) {
      hint = 'WARNING: the spring is past its elastic limit. Readings here will bend the graph.';
    } else {
      hint = 'Ready — press “Record reading” in the panel.';
    }

    const state = snapshot.pastLimit
      ? 'overloaded'
      : !snapshot.settled
        ? 'settling'
        : this.#masses.length > 0
          ? 'settled'
          : 'ready';

    return { state, chips, hint };
  }

  override analyse(dataset: DataSet): AnalysisResult {
    return analyseHookesLaw(dataset.rows, {
      stiffnessNm: this.#spring.stiffnessNm,
      elasticLimitN: this.#spring.elasticLimitN,
      hangerLoadN: (this.#rig?.hangerMassKg ?? 0.05) * STANDARD_G,
    });
  }

  /**
   * Every point carries the same reading uncertainty, so the graph gets error
   * bars but **no** theoretical line: the stiffness is what is being measured,
   * and drawing the answer on the graph would give it away.
   */
  graphDecorations(dataset: DataSet): { yErrors: number[] } {
    return { yErrors: dataset.rows.map(() => EXTENSION_SIGMA_M) };
  }

  reveal(): string | null {
    const hangerLoadN = (this.#rig?.hangerMassKg ?? 0.05) * STANDARD_G;
    const limitG = ((this.#spring.elasticLimitN - hangerLoadN) / STANDARD_G) * 1000;
    return (
      `This spring's real stiffness is k = ${this.#spring.stiffnessNm.toFixed(1)} N/m. ` +
      `It obeys Hooke's law up to a total load of ${this.#spring.elasticLimitN.toFixed(2)} N ` +
      `(about ${Math.max(0, limitG).toFixed(0)} g of slotted mass).`
    );
  }

  buildControls(container: HTMLElement): void {
    const model: HookesControlsModel = {
      addMass: (grams) => this.#addMass(grams),
      removeLastMass: () => this.#removeLastMass(),
      clearMasses: () => this.#clearMasses(),
      record: () => this.#record(),
      snapshot: () => this.#snapshot(),
    };
    this.#refreshControls = mountHookesControls(container, model);
  }

  // -------------------------------------------------------------------------
  // Internal bookkeeping
  // -------------------------------------------------------------------------

  #totalSlottedKg(): number {
    return this.#masses.reduce((sum, grams) => sum + grams, 0) / 1000;
  }

  /** Total load on the spring (hanger included), in newtons. */
  #totalLoadN(): number {
    const hangerMassKg = this.#rig?.hangerMassKg ?? 0.05;
    return (this.#totalSlottedKg() + hangerMassKg) * STANDARD_G;
  }

  /** True extension measured from the hanger-only zero, in metres. */
  #trueExtensionM(): number {
    const hangerMassKg = this.#rig?.hangerMassKg ?? 0.05;
    return realExtensionM(this.#spring, this.#totalLoadN()) - realExtensionM(this.#spring, hangerMassKg * STANDARD_G);
  }

  /** Push the current load into the physics and then the rig. */
  #applyLoad(): void {
    const rig = this.#rig;
    if (!rig) return;
    rig.setSpringLength(this.#spring.naturalLengthM + realExtensionM(this.#spring, this.#totalLoadN()));
    rig.setMasses(this.#masses);
  }

  #addMass(grams: number): void {
    const services = this.#services;
    if (!services) return;
    if (this.#masses.length >= MAX_MASSES) {
      services.bus.emit('toast', { message: 'That is as many masses as the hanger will take.', level: 'warn' });
      return;
    }
    this.#masses.push(grams);
    this.#applyLoad();
  }

  #removeLastMass(): void {
    if (this.#masses.length === 0) return;
    this.#masses.pop();
    this.#applyLoad();
  }

  #clearMasses(): void {
    if (this.#masses.length === 0) return;
    this.#masses = [];
    this.#applyLoad();
  }

  #record(): void {
    const services = this.#services;
    const rig = this.#rig;
    if (!services || !rig) return;

    if (this.#masses.length === 0) {
      services.bus.emit('toast', { message: 'Hang at least one slotted mass first.', level: 'warn' });
      return;
    }
    if (!rig.settled) {
      services.bus.emit('toast', { message: 'Let the spring stop moving before you record.', level: 'warn' });
      return;
    }

    // A squint-free reading of a millimetre scale still scatters.
    const readingM = snap(services.rng.normal(rig.fiducialHeightAboveBenchM, READING_SIGMA_M), 0.001);
    const extensionM = Math.max(0, snap(this.#zeroReadingM, 0.001) - readingM);
    const pastLimit = this.#totalLoadN() > this.#spring.elasticLimitN;

    services.data.addRow(
      {
        loadN: this.#totalSlottedKg() * STANDARD_G,
        extensionM,
        massG: this.#totalSlottedKg() * 1000,
        pointerCm: readingM * 100,
      },
      {
        note: `${this.#masses.join(' + ')} g`,
        warnings: pastLimit ? ['past the elastic limit'] : undefined,
      },
    );

    services.bus.emit('toast', {
      message: pastLimit ? 'Recorded — but the spring is past its elastic limit.' : 'Pointer reading recorded.',
      level: pastLimit ? 'warn' : 'good',
    });
  }

  #snapshot(): HookesSnapshot {
    const rig = this.#rig;
    const recorded = this.#services?.data.rows.length ?? 0;
    if (!rig) {
      return {
        slottedLoadN: 0,
        totalLoadN: 0,
        extensionM: 0,
        settled: true,
        pastLimit: false,
        canRecord: false,
        recorded,
      };
    }

    const totalLoadN = this.#totalLoadN();
    return {
      slottedLoadN: this.#totalSlottedKg() * STANDARD_G,
      totalLoadN,
      extensionM: this.#trueExtensionM(),
      settled: rig.settled,
      pastLimit: totalLoadN > this.#spring.elasticLimitN,
      canRecord: this.#masses.length > 0 && rig.settled,
      recorded,
    };
  }
}
