/**
 * WAEC-style practical: the e.m.f. and internal resistance of a cell.
 *
 * ---------------------------------------------------------------------------
 * What is real here
 * ---------------------------------------------------------------------------
 * The circuit is solved properly, not with a fixed formula for `V = IR`:
 *
 *  - the cell has a **hidden** e.m.f. and internal resistance, so `V` really
 *    does sag as the current rises;
 *  - the **ammeter** has 0.5 Ω of its own resistance in series, so it changes
 *    the very current it is measuring;
 *  - the **voltmeter** has 1000 Ω, not infinity, so it shunts a little current
 *    around the cell and makes the measured e.m.f. a shade low.
 *
 * The student reads two moving-coil meters, which is the dominant error: what
 * you record is a needle against a graduated card, not a number.
 */

import { snap } from '@/core/math';
import {
  powerW,
  seriesResistanceOhm,
  solveLoadedCircuit,
  type Cell,
  type CircuitSolution,
} from '@/physics/electromagnetism';
import type { GroupId } from '@/lab/types';
import {
  BaseExperiment,
  type AnalysisResult,
  type ColumnDef,
  type DataSet,
  type ExperimentStatus,
  type LabServices,
} from '../../types';
import { CircuitRig } from './CircuitRig';
import { analyseOhmsLaw } from './analysis';
import { mountOhmsControls, type OhmsControlsModel, type OhmsSnapshot } from './controls';

/** Reading scatter on a moving-coil ammeter, in amperes (~1 % of full scale). */
const SIGMA_CURRENT_A = 0.008;
/** Reading scatter on a moving-coil voltmeter, in volts. */
const SIGMA_VOLTAGE_V = 0.035;
/** Display resolution: the nearest 0.02 A and 0.05 V. */
const CURRENT_STEP_A = 0.02;
const VOLTAGE_STEP_V = 0.05;

export class OhmsLawExperiment extends BaseExperiment {
  readonly id = 'ohms-law';
  readonly title = "Ohm's law — the e.m.f. and internal resistance of a cell";
  readonly group: GroupId = 'electricity';

  readonly aim =
    'To determine the e.m.f. and the internal resistance of a dry cell, and to show that the terminal potential difference falls linearly as the current increases.';

  readonly theory = `For a cell of e.m.f. E and internal resistance r, the terminal potential difference is less than the e.m.f. whenever a current I flows, because some of the energy is used driving the current through the cell's own resistance:

  **V = E − Ir**

Comparing this with the equation of a straight line, y = mx + c:

  - a graph of **V (y-axis) against I (x-axis)** is a straight line of gradient **−r**;
  - its **intercept on the V-axis is the e.m.f. E**.

So r = −gradient and E = intercept. Real meters spoil the ideal a little: the ammeter's own resistance is in series with the rheostat, and the voltmeter (1000 Ω, not infinite) draws a small current of its own.`;

  readonly procedure = [
    'Connect the cell, switch, ammeter and rheostat in series, with the voltmeter connected across the cell.',
    'Close the switch and set the rheostat to give the largest sensible current (ammeter reading well below full scale).',
    'Record the ammeter reading I and the voltmeter reading V together, before touching anything else.',
    'Reduce the current a little with the rheostat and record another pair of readings. Repeat for at least six settings, spreading them evenly over the range.',
    'Plot a graph of V against I. Draw the best straight line through your points.',
    'Measure the gradient and the intercept on the V-axis. Then r = −gradient, and E = intercept.',
  ];

  readonly columns: readonly ColumnDef[] = [
    {
      id: 'currentA',
      header: 'I',
      unit: 'A',
      decimals: 2,
      role: 'independent',
      hint: 'Ammeter reading — the current through the rheostat.',
    },
    {
      id: 'voltageV',
      header: 'V',
      unit: 'V',
      decimals: 2,
      role: 'dependent',
      hint: 'Voltmeter reading — the terminal p.d. of the cell.',
    },
    {
      id: 'rheostatOhm',
      header: 'R',
      unit: 'Ω',
      decimals: 1,
      role: 'raw',
      plottable: false,
      hint: 'Rheostat setting at which the pair was taken.',
    },
  ];

  #services: LabServices | null = null;
  #rig: CircuitRig | null = null;
  /** The cell on the bench, including the values the student must find. */
  #cell: Cell = { emfV: 2.2, internalResistanceOhm: 2.5 };
  #switchClosed = true;
  #refreshControls: (() => void) | null = null;

  setup(services: LabServices): void {
    this.#services = services;
    this.#refreshControls = null;

    // A fresh cell each run: the e.m.f. and internal resistance are hidden.
    this.#cell = {
      emfV: services.rng.range(2.0, 2.4),
      internalResistanceOhm: services.rng.range(1.4, 3.0),
    };
    this.#switchClosed = true;

    const rig = new CircuitRig(services.lab, this.#cell);
    this.#rig = rig;
    this.onDispose(() => {
      rig.dispose();
      this.#rig = null;
      this.#refreshControls = null;
    });

    this.#updateMeters();

    services.bus.emit('coach:say', {
      text: 'Close the switch, set the rheostat, then record V and I together.',
    });
  }

  override update(dt: number): void {
    this.#rig?.update(dt);
    this.#refreshControls?.();
  }

  override status(): ExperimentStatus {
    const solution = this.#solution();
    const chips: ExperimentStatus['chips'] = [
      { label: 'I', value: `${solution.currentA.toFixed(2)} A` },
      { label: 'V', value: `${solution.terminalV.toFixed(2)} V` },
      { label: 'switch', value: this.#switchClosed ? 'closed' : 'open', tone: this.#switchClosed ? 'good' : 'warn' },
    ];

    const hint = !this.#switchClosed
      ? 'The switch is open, so no current flows. Close it to take a reading.'
      : 'Change the rheostat to get a range of currents, then record V and I together.';

    return { state: this.#switchClosed ? 'current flowing' : 'circuit open', chips, hint };
  }

  override analyse(dataset: DataSet): AnalysisResult {
    return analyseOhmsLaw(dataset.rows);
  }

  /**
   * The moving-coil voltmeter is read to the nearest small division, so every
   * point carries the same vertical uncertainty. No theoretical line is drawn:
   * its intercept *is* the e.m.f. the student is trying to find.
   */
  graphDecorations(dataset: DataSet): { yErrors: number[] } {
    return { yErrors: dataset.rows.map(() => SIGMA_VOLTAGE_V) };
  }

  reveal(): string | null {
    return (
      `This cell's e.m.f. is E = ${this.#cell.emfV.toFixed(2)} V and its internal resistance is ` +
      `r = ${this.#cell.internalResistanceOhm.toFixed(2)} Ω. ` +
      `The voltmeter's 1000 Ω has pulled your intercept a hair below the true e.m.f.`
    );
  }

  buildControls(container: HTMLElement): void {
    const model: OhmsControlsModel = {
      setRheostat: (ohms) => this.#setRheostat(ohms),
      setSwitchClosed: (closed) => this.#setSwitchClosed(closed),
      record: () => this.#record(),
      snapshot: () => this.#snapshot(),
    };
    this.#refreshControls = mountOhmsControls(container, model);
  }

  // -------------------------------------------------------------------------
  // Internal bookkeeping
  // -------------------------------------------------------------------------

  #solution(): CircuitSolution {
    const rig = this.#rig;
    if (!rig) {
      return { sourceCurrentA: 0, currentA: 0, terminalV: this.#cell.emfV, voltmeterCurrentA: 0 };
    }
    const series = this.#switchClosed
      ? seriesResistanceOhm(rig.rheostatOhm, rig.ammeterResistanceOhm)
      : Number.POSITIVE_INFINITY;

    return solveLoadedCircuit({
      cell: this.#cell,
      seriesResistanceOhm: series,
      voltmeterResistanceOhm: rig.voltmeterResistanceOhm,
    });
  }

  #updateMeters(): void {
    const solution = this.#solution();
    this.#rig?.setReadings(solution.currentA, solution.terminalV);
  }

  #setRheostat(ohms: number): void {
    this.#rig?.setRheostat(ohms);
    this.#updateMeters();
  }

  #setSwitchClosed(closed: boolean): void {
    this.#switchClosed = closed;
    this.#rig?.setSwitchClosed(closed);
    this.#updateMeters();
  }

  #record(): void {
    const services = this.#services;
    const rig = this.#rig;
    if (!services || !rig) return;
    if (!this.#switchClosed) {
      services.bus.emit('toast', { message: 'Close the switch first — no current is flowing.', level: 'warn' });
      return;
    }

    const solution = this.#solution();
    // Reading the two needles, with the scatter a real student has.
    const currentA = Math.max(0, snap(services.rng.normal(solution.currentA, SIGMA_CURRENT_A), CURRENT_STEP_A));
    const voltageV = Math.max(0, snap(services.rng.normal(solution.terminalV, SIGMA_VOLTAGE_V), VOLTAGE_STEP_V));

    services.data.addRow(
      { currentA, voltageV, rheostatOhm: rig.rheostatOhm },
      { note: `R = ${rig.rheostatOhm.toFixed(1)} Ω` },
    );

    services.bus.emit('toast', { message: `Recorded I = ${currentA.toFixed(2)} A, V = ${voltageV.toFixed(2)} V.`, level: 'good' });
  }

  #snapshot(): OhmsSnapshot {
    const solution = this.#solution();
    return {
      switchClosed: this.#switchClosed,
      rheostatOhm: this.#rig?.rheostatOhm ?? 0,
      currentA: solution.currentA,
      voltageV: solution.terminalV,
      powerW: powerW(solution.currentA, this.#rig?.rheostatOhm ?? 0),
      canRecord: this.#switchClosed && this.#rig !== null,
      recorded: this.#services?.data.rows.length ?? 0,
    };
  }
}
