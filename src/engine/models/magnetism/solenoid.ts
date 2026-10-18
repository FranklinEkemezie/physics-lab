/**
 * Solenoids.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { helixGeometry, meshOf, roundedBox } from '../../geometry';

/**
 * A solenoid: a long coil wound on a cardboard/delft former with terminals,
 * plus an optional soft-iron core that can be slid in and out.
 *
 * <b>Anchors:</b> `CoreSlot`.
 */
export class SolenoidModel {
  readonly group = new THREE.Group();
  #core: THREE.Mesh | null = null;
  #current = 0;

  constructor(options: { lengthM?: number; radiusM?: number; turns?: number } = {}) {
    const { lengthM = 0.14, radiusM = 0.013, turns = 120 } = options;
    this.group.name = 'Solenoid';

    const former = meshOf(
      new THREE.CylinderGeometry(radiusM, radiusM, lengthM, 28, 1, true),
      Materials.paint('#b98f5a', 0.9),
      'Former',
    );
    former.rotation.z = Math.PI / 2;
    former.position.y = radiusM + 0.003;
    this.group.add(former);

    const coil = new THREE.Mesh(
      helixGeometry(radiusM * 1.06, lengthM, turns, 0.0006, 16),
      Materials.copper(),
    );
    coil.name = 'Coil';
    coil.rotation.z = -Math.PI / 2;
    coil.position.set(-lengthM / 2, radiusM + 0.003, 0);
    // helixGeometry builds along +Y from origin; rotate about Z to lie along X.
    coil.castShadow = true;
    this.group.add(coil);

    const stand = meshOf(roundedBox(lengthM + 0.03, 0.006, 0.05, 0.002), Materials.darkWood(), 'Stand');
    stand.position.y = 0.003;
    this.group.add(stand);

    for (const [name, x] of [
      ['TerminalA', -lengthM / 2 - 0.012],
      ['TerminalB', lengthM / 2 + 0.012],
    ] as const) {
      const terminal = meshOf(new THREE.CylinderGeometry(0.0025, 0.0025, 0.02, 12), Materials.agedBrass(), name);
      terminal.position.set(x, radiusM * 2 + 0.012, 0);
      this.group.add(terminal);
      const anchor = new THREE.Object3D();
      anchor.name = name;
      anchor.position.set(x, radiusM * 2 + 0.022, 0);
      this.group.add(anchor);
    }

    const coreSlot = new THREE.Object3D();
    coreSlot.name = 'CoreSlot';
    coreSlot.position.y = radiusM + 0.003;
    this.group.add(coreSlot);

    this.group.userData.isHandle = true;
    this.group.userData.apparatus = { id: 'solenoid', label: 'Solenoid' };
  }

  /** Slide a soft-iron core in (`true`) or out (`false`) of the former. */
  setCore(inserted: boolean): void {
    if (inserted && !this.#core) {
      this.#core = meshOf(new THREE.CylinderGeometry(0.009, 0.009, 0.16, 20), Materials.softIron(), 'IronCore');
      this.#core.rotation.z = Math.PI / 2;
      this.#core.position.set(0, 0.016, 0);
      this.group.add(this.#core);
    }
    if (this.#core) this.#core.visible = inserted;
  }

  get hasCore(): boolean {
    return this.#core?.visible ?? false;
  }

  /** Field strength indicator used by experiments (proportional to NI/L). */
  setCurrent(amperes: number): void {
    this.#current = amperes;
  }

  get current(): number {
    return this.#current;
  }
}
