/**
 * Extension springs.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { helixGeometry } from '../../geometry';

export interface SpringOptions {
  /** Natural (unstretched) length in metres. */
  naturalLengthM?: number;
  /** Coil radius in metres. */
  coilRadiusM?: number;
  /** Spring constant in N/m — the quantity the student is trying to find. */
  springConstantNm?: number;
}

/**
 * A helical extension spring with hooks at both ends.
 *
 * The <b>geometry is rebuilt</b> from the current extension so the coils
 * visibly open up as it stretches — the same cue students use in the lab to
 * see that a spring is loaded.
 *
 * <b>Anchors:</b> `Top` (fixed end) and `Bottom` (moving end).
 */
export class SpringModel {
  readonly group = new THREE.Group();
  readonly naturalLengthM: number;
  readonly springConstantNm: number;
  readonly coilRadiusM: number;

  #coils: THREE.Mesh;
  #topHook: THREE.Mesh;
  #bottomHook: THREE.Mesh;
  #sideWire: THREE.Mesh;
  #pointer: THREE.Mesh;

  constructor(options: SpringOptions = {}) {
    const { naturalLengthM = 0.12, coilRadiusM = 0.011, springConstantNm = 25 } = options;
    this.naturalLengthM = naturalLengthM;
    this.coilRadiusM = coilRadiusM;
    this.springConstantNm = springConstantNm;

    this.group.name = 'Spring';

    const wireRadius = 0.0007;
    const coilHeight = naturalLengthM - 0.028; // leave room for the hooks
    const turns = 42;

    this.#coils = new THREE.Mesh(helixGeometry(coilRadiusM, coilHeight, turns, wireRadius, 20), Materials.chrome());
    this.#coils.name = 'Coils';
    this.#coils.castShadow = true;
    this.group.add(this.#coils);

    // Hooks: half-tori at each end.
    const hookGeometry = new THREE.TorusGeometry(0.006, wireRadius * 1.3, 8, 20, Math.PI);
    this.#topHook = new THREE.Mesh(hookGeometry, Materials.chrome());
    this.#topHook.name = 'TopHook';
    this.#topHook.position.y = coilHeight;
    this.#topHook.rotation.z = Math.PI;
    this.#bottomHook = new THREE.Mesh(hookGeometry, Materials.chrome());
    this.#bottomHook.name = 'BottomHook';
    this.#bottomHook.rotation.z = Math.PI;
    this.group.add(this.#topHook, this.#bottomHook);

    // A straight wire run down the side carries the fiducial pointer. Real
    // school springs have exactly this, so the pointer does not wobble.
    this.#sideWire = new THREE.Mesh(
      new THREE.CylinderGeometry(wireRadius, wireRadius, coilHeight, 6),
      Materials.chrome(),
    );
    this.#sideWire.name = 'SideWire';
    this.#sideWire.position.set(coilRadiusM + 0.006, coilHeight / 2, 0);
    this.group.add(this.#sideWire);

    this.#pointer = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, 0.0008, 0.0008),
      Materials.paint('#c0392b', 0.4),
    );
    this.#pointer.name = 'Pointer';
    // The pointer marks the *moving* (lower) end, so it tracks the extension.
    this.#pointer.position.set(coilRadiusM + 0.019, 0, 0);
    this.group.add(this.#pointer);

    const top = new THREE.Object3D();
    top.name = 'Top';
    top.position.y = naturalLengthM;
    const bottom = new THREE.Object3D();
    bottom.name = 'Bottom';
    this.group.add(top, bottom);

    this.group.userData.isHandle = true;
    this.group.userData.physics = {
      kind: 'spring',
      springConstantNm,
      naturalLengthM,
    };

    this.setLength(naturalLengthM);
  }

  /**
   * Redraw the spring at a given total length.
   * Coils stretch uniformly; the wire radius stays constant, so the spring
   * genuinely looks like metal being pulled apart.
   */
  setLength(totalLengthM: number): void {
    const length = Math.max(this.naturalLengthM * 0.35, totalLengthM);
    const coilHeight = Math.max(0.02, length - 0.028);
    const turns = 42;

    this.#coils.geometry.dispose();
    this.#coils.geometry = helixGeometry(this.coilRadiusM, coilHeight, turns, 0.0007, 20);

    this.#topHook.position.y = coilHeight;
    this.#bottomHook.position.y = 0;

    this.#sideWire.scale.y = coilHeight / (this.naturalLengthM - 0.028);
    this.#sideWire.position.y = coilHeight / 2;

    const bottom = this.group.getObjectByName('Bottom');
    if (bottom) bottom.position.y = length;
  }

  get pointer(): THREE.Object3D {
    return this.#pointer;
  }

  dispose(): void {
    this.#coils.geometry.dispose();
    this.#topHook.geometry.dispose();
    this.#bottomHook.geometry.dispose();
  }
}
