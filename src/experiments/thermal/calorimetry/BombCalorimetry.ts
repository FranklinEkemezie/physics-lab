/**
 * WAEC-style practical: the specific heat capacity of water, by electrical
 * heating in a bomb calorimeter.
 *
 * ---------------------------------------------------------------------------
 * What is real here
 * ---------------------------------------------------------------------------
 * Nothing about the graph is a straight line by accident. The heater has a
 * fixed power `VI`; the water and the steel bomb together have a heat capacity;
 * and the calorimeter loses heat to the room at a rate proportional to how far
 * it is above room temperature. So:
 *
 *  - the first minute or so of Δθ against t is very nearly a straight line, and
 *    its gradient gives `c = VI / (m × gradient)` — the honest answer;
 *  - after that the curve **bends over** as Newton cooling eats into the rise,
 *    so the syllabus endpoint formula `c = VIt/(mΔθ)` reads a few per cent high;
 *  - the thermometer itself lags the water by a few seconds, so a reading taken
 *    the instant the heater goes on is slightly behind.
 *
 * The run is sped up tenfold so a five-minute experiment takes thirty seconds,
 * but every number recorded is the number a real five-minute run would give.
 */

import * as THREE from 'three';
import { BENCH_HEIGHT } from '@/engine/LabRoom';
import {
  heaterPowerW,
  initialCalorimetryState,
  stepCalorimetry,
  thermometerReadingC,
  type CalorimetryConfig,
  type CalorimetryState,
} from '@/physics/thermal';
import type { GroupId } from '@/lab/types';
import {
  BaseExperiment,
  type AnalysisResult,
  type ColumnDef,
  type DataSet,
  type ExperimentStatus,
  type LabServices,
} from '../../types';
import { CalorimeterRig } from './CalorimeterRig';
import { analyseBombCalorimetry } from './analysis';
import {
  mountCalorimetryControls,
  type CalorimetryControlsModel,
  type CalorimetrySnapshot,
} from './controls';

/** How long the student should heat for, in simulated seconds. */
const RUN_TARGET_S = 300;
/** Automatic datalogger interval, in simulated seconds. */
const RECORD_INTERVAL_S = 30;
/** Hard stop for the automatic recorder. */
const MAX_RUN_S = 600;
/** Simulated seconds per real second. */
const TIME_SCALE = 10;
/** Smallest division on the thermometer, °C. */
const THERMOMETER_RESOLUTION_C = 0.1;
/** A reading is the difference of two readings, so √2 times the error. */
const RISE_SIGMA_C = Math.SQRT2 * (THERMOMETER_RESOLUTION_C / Math.sqrt(12));

/** Where to point the camera: between the supply and the calorimeter. */
const CALORIMETER_RIG_VIEW = { x: -0.12, z: 0.0, distance: 1.45 } as const;

export class BombCalorimetryExperiment extends BaseExperiment {
  readonly id = 'bomb-calorimetry';
  readonly title = 'Specific heat capacity — bomb calorimeter';
  readonly group: GroupId = 'thermal';

  readonly aim =
    'To determine the specific heat capacity of water by heating it electrically in a bomb calorimeter, and to see why the initial gradient of the temperature–time graph is the honest measurement.';

  readonly theory = `An electric heater of power **P = VI** supplies energy **E = VIt**. If none of it escaped, the water and the calorimeter would warm by

  **E = m c Δθ**,  so  **c = V I t / (m Δθ)**,

with m the mass of water in kilograms and Δθ its rise in °C.

Two real effects spoil the endpoint formula. The steel bomb, jacket and stirrer have their own heat capacity, so part of the energy warms the apparatus rather than the water; and the calorimeter loses heat to the room at a rate proportional to how far it is above room temperature (Newton's law of cooling), which grows as the run goes on.

Both effects mean the graph of Δθ against t is straight only at the start. Its **initial gradient** is the cooling-free rate,

  **gradient = VI / (m c)**, so **c = VI / (m × gradient)**,

and that is the value to quote.`;

  readonly procedure = [
    'Weigh the empty bomb, then add about 400 g of water and weigh it again. Record the mass of water **in kilograms**.',
    'Stand the bomb in the calorimeter jacket, close the lid, and make sure the heater coil and the thermometer bulb are both under the water.',
    'Note the reading of the thermometer. If it is above room temperature, wait a moment until it drifts steadily.',
    'Record the initial temperature θ₁ at t = 0 — that is your first row.',
    'Switch on the supply (12 V, about 3.5 A) and start taking a temperature reading **every 30 s** for five minutes, stirring gently before each reading.',
    'Switch off the heater. Do not stop the clock until you have the reading at the end.',
    'Plot a graph of temperature rise Δθ against time t. The first part is straight; measure its **initial gradient**.',
    'Calculate c = VI / (m × gradient), and compare it with the endpoint value c = VIt/(mΔθ) to see the effect of cooling.',
  ];

  readonly columns: readonly ColumnDef[] = [
    {
      id: 'timeS',
      header: 't',
      unit: 's',
      decimals: 1,
      role: 'independent',
      hint: 'Time from switching the heater on.',
    },
    {
      id: 'deltaTC',
      header: 'Δθ',
      unit: '°C',
      decimals: 1,
      role: 'dependent',
      hint: 'Temperature rise measured from the first reading.',
    },
    {
      id: 'readingC',
      header: 'θ',
      unit: '°C',
      decimals: 1,
      role: 'raw',
      hint: 'Thermometer reading, to the nearest 0.1 °C.',
    },
  ];

  #services: LabServices | null = null;
  #rig: CalorimeterRig | null = null;
  #config: CalorimetryConfig = {
    voltageV: 12,
    currentA: 3.5,
    waterMassKg: 0.4,
    specificHeatCapacityJKgK: 4180,
  };
  #state: CalorimetryState = initialCalorimetryState(this.#config);
  /** The thermometer reading the rise is measured from (the first row). */
  #referenceReadingC: number | null = null;
  #autoRecord = true;
  #nextAutoRecordS = RECORD_INTERVAL_S;
  #refreshControls: (() => void) | null = null;

  setup(services: LabServices): void {
    this.#services = services;
    const { rng } = services;

    // A fresh calorimeter each run: the mass, the current and the water's
    // specific heat capacity are all slightly different, and none of them is
    // written on a label.
    const waterMassKg = Number((0.4 + rng.range(-0.006, 0.006)).toFixed(4));
    const currentA = Number((3.5 + rng.range(-0.18, 0.18)).toFixed(2));
    const ambientC = Number((20.5 + rng.range(-0.5, 0.5)).toFixed(2));
    const initialC = Number((ambientC + rng.range(0.4, 1.0)).toFixed(2));

    this.#config = {
      voltageV: 12,
      currentA,
      waterMassKg,
      specificHeatCapacityJKgK: 4180 + rng.range(-12, 12),
      vesselHeatCapacityJK: 30,
      coolingCoefficientWK: 0.7,
      ambientC,
      initialC,
      immersionFraction: 1,
      thermometerTauS: 1.5,
      timeScale: TIME_SCALE,
    };

    this.#state = initialCalorimetryState(this.#config);
    this.#referenceReadingC = null;
    this.#autoRecord = true;
    this.#nextAutoRecordS = RECORD_INTERVAL_S;
    this.#refreshControls = null;

    const rig = new CalorimeterRig(services.lab, {
      waterMassKg,
      voltageV: this.#config.voltageV,
      currentA,
    });
    this.#rig = rig;
    rig.setReading(this.#state.readingC);

    this.onDispose(() => {
      rig.dispose();
      this.#rig = null;
      this.#refreshControls = null;
    });

    // Frame the apparatus for the student.
    services.viewport.focusOn(
      new THREE.Vector3(CALORIMETER_RIG_VIEW.x, BENCH_HEIGHT + 0.12, CALORIMETER_RIG_VIEW.z),
      CALORIMETER_RIG_VIEW.distance,
    );

    services.bus.emit('coach:say', {
      text: 'Check the water mass and the starting temperature, then switch on the heater. Readings are logged every 30 s.',
    });
  }

  override update(dt: number, services: LabServices): void {
    const step = Math.min(Math.max(dt, 0), 0.25);
    this.#state = stepCalorimetry(this.#state, this.#config, step, this.#state.heating);

    this.#rig?.setReading(this.#state.readingC);
    this.#rig?.setHeating(this.#state.heating);

    while (
      this.#state.heating &&
      this.#autoRecord &&
      this.#state.timeS >= this.#nextAutoRecordS &&
      this.#nextAutoRecordS <= MAX_RUN_S
    ) {
      const boundary = this.#nextAutoRecordS;
      if (!this.#timeAlreadyRecorded(boundary)) this.#record(services, boundary, true);
      this.#nextAutoRecordS += RECORD_INTERVAL_S;
    }

    this.#refreshControls?.();
  }

  override status(): ExperimentStatus {
    const snapshot = this.#snapshot();
    const chips: ExperimentStatus['chips'] = [
      { label: 't', value: `${snapshot.timeS.toFixed(0)} s` },
      { label: 'θ', value: `${snapshot.readingC.toFixed(1)} °C` },
      {
        label: 'Δθ',
        value: `${snapshot.deltaTC.toFixed(1)} °C`,
        tone: snapshot.deltaTC > 0 ? 'good' : 'default',
      },
      { label: 'P', value: `${snapshot.powerW.toFixed(0)} W`, tone: snapshot.heating ? 'warn' : 'default' },
    ];

    let state: string;
    let hint: string;

    if (snapshot.recorded === 0) {
      state = 'ready';
      hint = 'Read the thermometer, then switch on the heater to start the clock.';
    } else if (snapshot.heating && !snapshot.enoughData) {
      state = 'heating';
      hint = 'Heating — a reading is logged every 30 s. Stir gently before each one.';
    } else if (snapshot.heating) {
      state = 'finishing';
      hint = 'Five minutes of heating is enough — switch off the heater.';
    } else {
      state = 'stopped';
      hint = 'Plot Δθ against t and use the initial, straight part of the graph.';
    }

    return { state, chips, hint };
  }

  override analyse(dataset: DataSet): AnalysisResult {
    return analyseBombCalorimetry(dataset.rows, {
      voltageV: this.#config.voltageV,
      currentA: this.#config.currentA,
      waterMassKg: this.#config.waterMassKg,
      vesselHeatCapacityJK: this.#config.vesselHeatCapacityJK,
    });
  }

  /** Every temperature reading carries the same ±0.1 °C rounding. */
  graphDecorations(dataset: DataSet): { yErrors: number[] } {
    return { yErrors: dataset.rows.map(() => RISE_SIGMA_C) };
  }

  reveal(): string | null {
    const trueC = this.#config.specificHeatCapacityJKgK;
    return (
      `The water in this calorimeter really has c = ${trueC.toFixed(0)} J kg⁻¹ K⁻¹. ` +
      `The steel bomb adds about ${this.#config.vesselHeatCapacityJK ?? 0} J/K of its own, ` +
      'and the calorimeter loses heat to the room throughout the run — so a careful value still reads a few per cent high.'
    );
  }

  buildControls(container: HTMLElement): void {
    const model: CalorimetryControlsModel = {
      setHeating: (on) => this.#setHeating(on),
      record: () => this.#recordManual(),
      setAutoRecord: (on) => {
        this.#autoRecord = on;
      },
      snapshot: () => this.#snapshot(),
    };
    this.#refreshControls = mountCalorimetryControls(container, model);
  }

  // -------------------------------------------------------------------------
  // Internal bookkeeping
  // -------------------------------------------------------------------------

  #setHeating(on: boolean): void {
    const services = this.#services;
    if (!services || on === this.#state.heating) return;

    this.#state = { ...this.#state, heating: on };

    if (on) {
      // θ₁ at t = 0 is part of the data, not an afterthought.
      if (services.data.rows.length === 0) this.#record(services, 0, true);
      // Pick up the datalogger at the next whole 30 s, even if the heater is
      // being switched on again part-way through a run.
      this.#nextAutoRecordS =
        Math.max(RECORD_INTERVAL_S, Math.ceil((this.#state.timeS + 0.001) / RECORD_INTERVAL_S) * RECORD_INTERVAL_S);
      services.bus.emit('coach:say', {
        text: 'Heating. A reading goes into the table every 30 s — watch the column climb.',
        level: 'info',
      });
    } else {
      services.bus.emit('coach:say', {
        text: 'Heater off. Plot Δθ against t: the first part is straight, and its gradient gives c.',
        level: 'good',
      });
    }
  }

  #recordManual(): void {
    const services = this.#services;
    if (!services) return;

    const timeS = Number(this.#state.timeS.toFixed(1));
    if (this.#timeAlreadyRecorded(timeS)) {
      services.bus.emit('toast', { message: 'That moment is already in the table.', level: 'warn' });
      return;
    }
    if (timeS <= 0 && !this.#state.heating) {
      services.bus.emit('toast', { message: 'Switch on the heater to start the run.', level: 'warn' });
      return;
    }

    const reading = this.#record(services, timeS, false);
    services.bus.emit('toast', { message: `Recorded θ = ${reading.toFixed(1)} °C at ${timeS.toFixed(0)} s.`, level: 'good' });
  }

  /** Add one row and return the reading that went into it. */
  #record(services: LabServices, timeS: number, auto: boolean): number {
    const readingC = thermometerReadingC(this.#state);
    if (this.#referenceReadingC === null) this.#referenceReadingC = readingC;
    const deltaTC = Number((readingC - this.#referenceReadingC).toFixed(1));

    services.data.addRow(
      { timeS: Number(timeS.toFixed(1)), readingC, deltaTC },
      { note: auto ? 'datalogger' : undefined },
    );
    return readingC;
  }

  #timeAlreadyRecorded(timeS: number): boolean {
    const rows = this.#services?.data.rows ?? [];
    return rows.some((row) => Math.abs(row.values.timeS - timeS) < 0.5);
  }

  #snapshot(): CalorimetrySnapshot {
    const rows = this.#services?.data.rows ?? [];
    const readingC = thermometerReadingC(this.#state);
    const reference = this.#referenceReadingC;

    return {
      timeS: this.#state.timeS,
      readingC,
      deltaTC: reference === null ? 0 : readingC - reference,
      heating: this.#state.heating,
      powerW: heaterPowerW(this.#config, this.#state.heating),
      waterMassKg: this.#config.waterMassKg,
      autoRecord: this.#autoRecord,
      recorded: rows.length,
      canRecord: !this.#timeAlreadyRecorded(Number(this.#state.timeS.toFixed(1))),
      enoughData: this.#state.timeS >= RUN_TARGET_S,
    };
  }
}
