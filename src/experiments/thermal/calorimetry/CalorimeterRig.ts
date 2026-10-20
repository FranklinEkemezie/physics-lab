/**
 * The bench layout for the bomb-calorimeter practical.
 *
 * It owns the apparatus and nothing else: a bomb calorimeter from the reusable
 * model library, a bench power supply, and the two leads between them. The
 * hidden value — how much heat the water really needs — is in the physics
 * module, never in a label on the model.
 *
 * The calorimeter exposes a small view object (`userData.calorimeter`) with
 * `setTemperature`, `setHeating` and `setStirring`; this rig is the only code
 * that has to know the model even exists.
 */

import * as THREE from 'three';
import type { Lab } from '@/lab/Lab';
import type { PlacedObject } from '@/lab/types';
import { BENCH_HEIGHT } from '@/engine/LabRoom';
import { Materials } from '@/engine/materials';
import {
  buildBombCalorimeter,
  buildPowerSupply,
  type BombCalorimeterView,
  type PowerSupplyView,
} from '@/engine/models/library';

/** Where everything stands. All x/z are relative to the bench centre. */
export const CALORIMETER_RIG = {
  calorimeterX: 0.06,
  calorimeterZ: -0.03,
  supplyX: -0.34,
  supplyZ: -0.05,
  /** Supply socket positions, in the supply's own frame. */
  supplySocketY: 0.032,
  supplySocketZ: 0.109,
  supplySocketX: 0.045,
  /** Calorimeter terminal positions, in the calorimeter's own frame. */
  calorimeterTerminalX: [0.083, 0.101] as const,
  calorimeterTerminalY: 0.026,
  calorimeterTerminalZ: 0.012,
} as const;

export interface CalorimeterRigOptions {
  waterMassKg: number;
  voltageV: number;
  currentA: number;
}

export class CalorimeterRig {
  readonly parts: {
    calorimeter: PlacedObject;
    supply: PlacedObject;
  };

  readonly #lab: Lab;
  readonly #overlay = new THREE.Group();
  readonly #spawned: PlacedObject[] = [];
  readonly #calorimeterView: BombCalorimeterView;
  readonly #supplyView: PowerSupplyView;
  #heating = false;

  constructor(lab: Lab, options: CalorimeterRigOptions) {
    this.#lab = lab;

    const calorimeter = lab.adopt(buildBombCalorimeter({ waterMassKg: options.waterMassKg }), {
      position: new THREE.Vector3(
        CALORIMETER_RIG.calorimeterX,
        BENCH_HEIGHT,
        CALORIMETER_RIG.calorimeterZ,
      ),
      definitionId: 'apparatus-bomb-calorimeter',
    });
    const supply = lab.adopt(
      buildPowerSupply({ voltageV: options.voltageV, currentA: options.currentA }),
      {
        position: new THREE.Vector3(CALORIMETER_RIG.supplyX, BENCH_HEIGHT, CALORIMETER_RIG.supplyZ),
        definitionId: 'apparatus-power-supply',
      },
    );

    this.parts = { calorimeter, supply };
    this.#spawned.push(calorimeter, supply);

    // Both are bolted down: only the experiment's switches move anything.
    for (const placed of this.#spawned) placed.object.userData.dragMode = 'none';

    this.#calorimeterView = calorimeter.object.userData.calorimeter as BombCalorimeterView;
    this.#supplyView = supply.object.userData.supply as PowerSupplyView;

    this.#overlay.name = 'CalorimeterLeads';
    this.#overlay.add(...this.#buildLeads());
    lab.root.add(this.#overlay);

    this.#calorimeterView.setStirring(false);
    this.#calorimeterView.setHeating(false);
    this.#supplyView.setOutput(false);
  }

  /** Push a thermometer reading into the 3D model. */
  setReading(celsius: number): void {
    this.#calorimeterView.setTemperature(celsius);
  }

  /** Switch the heater (and its glow) on or off. */
  setHeating(on: boolean): void {
    if (on === this.#heating) return;
    this.#heating = on;
    this.#calorimeterView.setHeating(on);
    this.#calorimeterView.setStirring(on);
    this.#supplyView.setOutput(on);
  }

  dispose(): void {
    for (const placed of this.#spawned) this.#lab.remove(placed.instanceId);
    this.#spawned.length = 0;

    this.#overlay.traverse((object) => {
      const mesh = object as Partial<THREE.Mesh>;
      mesh.geometry?.dispose();
    });
    this.#overlay.removeFromParent();
  }

  /** Two sagging leads, in world space, from the supply to the bomb's terminals. */
  #buildLeads(): THREE.Mesh[] {
    const { supplyX, supplyZ, calorimeterX, calorimeterZ } = CALORIMETER_RIG;
    const red = Materials.paint('#a83226', 0.75);
    const black = Materials.paint('#1e2226', 0.75);

    const socket = (sign: number): THREE.Vector3 =>
      new THREE.Vector3(
        supplyX + sign * CALORIMETER_RIG.supplySocketX,
        BENCH_HEIGHT + CALORIMETER_RIG.supplySocketY,
        supplyZ + CALORIMETER_RIG.supplySocketZ,
      );
    const terminal = (x: number): THREE.Vector3 =>
      new THREE.Vector3(
        calorimeterX + x,
        BENCH_HEIGHT + CALORIMETER_RIG.calorimeterTerminalY,
        calorimeterZ + CALORIMETER_RIG.calorimeterTerminalZ,
      );

    const build = (from: THREE.Vector3, to: THREE.Vector3, material: THREE.Material, sagZ: number): THREE.Mesh => {
      const beforeMid = from.clone().lerp(to, 0.3);
      beforeMid.y = BENCH_HEIGHT + 0.018;
      const low = from.clone().lerp(to, 0.5);
      low.y = BENCH_HEIGHT + 0.01;
      low.z = sagZ;
      const afterMid = from.clone().lerp(to, 0.7);
      afterMid.y = BENCH_HEIGHT + 0.014;

      const curve = new THREE.CatmullRomCurve3([from, beforeMid, low, afterMid, to]);
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.0026, 8, false), material);
      mesh.name = 'Lead';
      return mesh;
    };

    return [
      build(socket(-1), terminal(CALORIMETER_RIG.calorimeterTerminalX[0]), red, 0.06),
      build(socket(1), terminal(CALORIMETER_RIG.calorimeterTerminalX[1]), black, 0.09),
    ];
  }
}
