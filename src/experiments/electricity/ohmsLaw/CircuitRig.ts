/**
 * The bench layout for the e.m.f./internal-resistance practical.
 *
 * Owns the whole circuit: the cell, switch, ammeter, voltmeter, rheostat and
 * the leads between them. The *physics* — what the meters should read — lives
 * in `@/physics/electromagnetism`; this class only turns currents and voltages
 * into needle positions and moves the rheostat's slider.
 *
 * The cell is built here rather than taken from the catalogue so the
 * experiment can give it a **hidden** e.m.f. and internal resistance: the
 * student has to measure them, not read them off a label.
 */

import * as THREE from 'three';
import type { Lab } from '@/lab/Lab';
import { BENCH_HEIGHT } from '@/engine/LabRoom';
import { KnifeSwitchModel, MeterModel, PatchLead, RheostatModel, buildDryCell } from '@/engine/models/electricity';
import type { Cell } from '@/physics/electromagnetism';

/** Where each piece of apparatus sits on the bench, in metres. */
export const CIRCUIT_RIG = {
  maxRheostatOhm: 20,
  ammeterFullScaleA: 1,
  voltmeterFullScaleV: 5,
  place: {
    cell: { x: -0.3, z: 0.17 },
    switch: { x: -0.06, z: 0.17 },
    ammeter: { x: 0.22, z: 0.17 },
    rheostat: { x: 0.22, z: -0.16 },
    voltmeter: { x: -0.1, z: -0.19 },
  },
} as const;

/** Terminal offsets on a lab meter, in the meter's own frame. */
const METER_TERMINAL = { spreadX: 0.0345, y: 0.014, z: 0.022 };
/** Terminal offsets on the knife switch, in its own frame. */
const SWITCH_TERMINAL = { spreadX: 0.035, y: 0.006 };

export class CircuitRig {
  /** The cell the student is measuring. */
  readonly cell: Cell;

  readonly #lab: Lab;
  readonly #overlay = new THREE.Group();
  readonly #case = new THREE.Group();
  readonly #meters = new THREE.Group();
  readonly #leads: PatchLead[] = [];

  readonly #cellGroup: THREE.Group;
  readonly #switchModel: KnifeSwitchModel;
  readonly #ammeter: MeterModel;
  readonly #voltmeter: MeterModel;
  readonly #rheostat: RheostatModel;

  #rheostatOhm = 10;

  constructor(lab: Lab, cell: Cell) {
    this.#lab = lab;
    this.cell = cell;

    this.#overlay.name = 'CircuitRigOverlay';
    lab.root.add(this.#overlay);

    const at = (place: { x: number; z: number }): THREE.Vector3 =>
      new THREE.Vector3(place.x, BENCH_HEIGHT, place.z);

    this.#cellGroup = buildDryCell(cell.emfV, { label: 'CELL', showVoltage: false });
    this.#cellGroup.position.copy(at(CIRCUIT_RIG.place.cell));

    this.#switchModel = new KnifeSwitchModel();
    this.#switchModel.group.position.copy(at(CIRCUIT_RIG.place.switch));

    this.#ammeter = new MeterModel({ label: 'AMMETER', unit: 'A', fullScale: CIRCUIT_RIG.ammeterFullScaleA }, 0.5);
    this.#ammeter.group.position.copy(at(CIRCUIT_RIG.place.ammeter));

    this.#voltmeter = new MeterModel({ label: 'VOLTMETER', unit: 'V', fullScale: CIRCUIT_RIG.voltmeterFullScaleV }, 1000);
    this.#voltmeter.group.position.copy(at(CIRCUIT_RIG.place.voltmeter));

    this.#rheostat = new RheostatModel(CIRCUIT_RIG.maxRheostatOhm, 0.14);
    this.#rheostat.group.position.copy(at(CIRCUIT_RIG.place.rheostat));

    this.#case.add(this.#switchModel.group);
    this.#meters.add(this.#ammeter.group, this.#voltmeter.group, this.#rheostat.group);
    this.#overlay.add(this.#cellGroup, this.#case, this.#meters);

    this.setRheostat(this.#rheostatOhm);
    this.setSwitchClosed(true);
    this.#wireUp();
    this.setReadings(0, cell.emfV);
  }

  /** Resistance of the ammeter, which sits in series with the rheostat. */
  get ammeterResistanceOhm(): number {
    return this.#ammeter.resistanceOhms;
  }

  /** Resistance of the voltmeter connected across the cell. */
  get voltmeterResistanceOhm(): number {
    return this.#voltmeter.resistanceOhms;
  }

  get rheostatOhm(): number {
    return this.#rheostatOhm;
  }

  /** Move the rheostat's sliding contact. */
  setRheostat(ohms: number): void {
    this.#rheostatOhm = Math.max(0, Math.min(CIRCUIT_RIG.maxRheostatOhm, ohms));
    this.#rheostat.setResistance(this.#rheostatOhm);
  }

  /** Close (or open) the knife switch, with the blade animated. */
  setSwitchClosed(closed: boolean): void {
    this.#switchModel.setClosed(closed, true);
  }

  /** Drive the two meters. */
  setReadings(currentA: number, voltageV: number): void {
    this.#ammeter.setReading(currentA);
    this.#voltmeter.setReading(voltageV);
  }

  update(dt: number): void {
    this.#switchModel.update(dt);
  }

  dispose(): void {
    for (const lead of this.#leads) {
      lead.group.traverse((object) => {
        const mesh = object as Partial<THREE.Mesh>;
        mesh.geometry?.dispose();
      });
    }
    this.#leads.length = 0;

    this.#overlay.traverse((object) => {
      const mesh = object as Partial<THREE.Mesh>;
      mesh.geometry?.dispose();
    });
    this.#overlay.removeFromParent();
  }

  // -------------------------------------------------------------------------
  // Wiring
  // -------------------------------------------------------------------------

  /** Connect the apparatus with patch leads, once the layout is settled. */
  #wireUp(): void {
    this.#lab.root.updateMatrixWorld(true);

    const positive = this.#worldAnchor(this.#cellGroup, 'Positive');
    const negative = this.#worldAnchor(this.#cellGroup, 'Negative');
    const switchLeft = this.#localToWorld(this.#switchModel.group, -SWITCH_TERMINAL.spreadX, SWITCH_TERMINAL.y, 0);
    const switchRight = this.#localToWorld(this.#switchModel.group, SWITCH_TERMINAL.spreadX, SWITCH_TERMINAL.y, 0);
    const ammeterLeft = this.#meterTerminal(this.#ammeter.group, -1);
    const ammeterRight = this.#meterTerminal(this.#ammeter.group, 1);
    const voltmeterLeft = this.#meterTerminal(this.#voltmeter.group, -1);
    const voltmeterRight = this.#meterTerminal(this.#voltmeter.group, 1);
    const rheostatLeft = this.#localToWorld(this.#rheostat.group, -0.075, 0.02, 0);
    const rheostatRight = this.#localToWorld(this.#rheostat.group, 0.075, 0.02, 0);

    const wiring: [THREE.Vector3, THREE.Vector3, string][] = [
      [positive.clone(), switchLeft, '#c0392b'],
      [switchRight, ammeterLeft, '#2e7d32'],
      [ammeterRight, rheostatLeft, '#1565c0'],
      [rheostatRight, negative.clone(), '#1f2226'],
      // The voltmeter is connected straight across the cell.
      [positive.clone().add(new THREE.Vector3(0, 0.004, 0)), voltmeterLeft, '#c0392b'],
      [negative.clone().add(new THREE.Vector3(0, 0.004, 0)), voltmeterRight, '#1f2226'],
    ];

    for (const [from, to, colour] of wiring) {
      const lead = new PatchLead(colour, 0.25);
      lead.connect(from, to, 0.35);
      this.#leads.push(lead);
      this.#overlay.add(lead.group);
    }
  }

  #meterTerminal(meter: THREE.Object3D, side: -1 | 1): THREE.Vector3 {
    return this.#localToWorld(
      meter,
      side * METER_TERMINAL.spreadX,
      METER_TERMINAL.y,
      METER_TERMINAL.z,
    );
  }

  #localToWorld(object: THREE.Object3D, x: number, y: number, z: number): THREE.Vector3 {
    return object.localToWorld(new THREE.Vector3(x, y, z));
  }

  #worldAnchor(object: THREE.Object3D, name: string): THREE.Vector3 {
    const anchor = object.getObjectByName(name);
    return anchor ? anchor.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
  }
}
