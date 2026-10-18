/**
 * Spring balances (newton meters).
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { helixGeometry, meshOf } from '../../geometry';

/**
 * A spring balance (newton meter): a tube with a graduated window and a hook.
 * Handy for weighing apparatus directly in newtons.
 */
export class SpringBalance {
  readonly group = new THREE.Group();
  #pointer: THREE.Mesh;
  readonly maxNewtons: number;
  readonly lengthM: number;

  constructor(maxNewtons = 5, lengthM = 0.14) {
    this.maxNewtons = maxNewtons;
    this.lengthM = lengthM;
    this.group.name = 'SpringBalance';

    const radius = 0.011;
    const body = meshOf(
      new THREE.CylinderGeometry(radius, radius, lengthM, 28, 1, true),
      Materials.paint('#e8e3d6', 0.5),
      'Body',
    );
    body.position.y = lengthM / 2;
    this.group.add(body);

    const bodyInner = meshOf(
      new THREE.CylinderGeometry(radius * 0.96, radius * 0.96, lengthM * 0.98, 24, 1, true),
      Materials.paint('#3a3f45', 0.6),
      'Inner',
    );
    bodyInner.position.y = lengthM / 2;
    this.group.add(bodyInner);

    const cap = meshOf(new THREE.SphereGeometry(radius, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), Materials.paint('#c0392b', 0.45), 'Cap');
    cap.position.y = lengthM;
    this.group.add(cap);

    // Circular spring inside, visible through the slot.
    const spring = meshOf(helixGeometry(radius * 0.55, lengthM * 0.8, 22, 0.0006, 14), Materials.chrome(), 'InnerSpring');
    spring.position.y = lengthM * 0.06;
    this.group.add(spring);

    this.#pointer = meshOf(new THREE.BoxGeometry(radius * 1.6, 0.0009, 0.0012), Materials.paint('#c0392b', 0.4), 'Pointer');
    this.#pointer.position.set(0, lengthM * 0.85, radius * 0.95);
    this.group.add(this.#pointer);

    const hook = meshOf(new THREE.TorusGeometry(0.0075, 0.0016, 8, 20, Math.PI * 1.5), Materials.chrome(), 'Hook');
    hook.position.y = -0.004;
    hook.rotation.z = Math.PI;
    this.group.add(hook);

    const anchor = new THREE.Object3D();
    anchor.name = 'Hook';
    this.group.add(anchor);

    this.group.userData.isHandle = true;
    this.setLoad(0);
  }

  /** Move the pointer to reflect a load in newtons. */
  setLoad(newtons: number): void {
    const fraction = Math.min(1, Math.max(0, newtons / this.maxNewtons));
    this.#pointer.position.y = this.lengthM * (0.1 + fraction * 0.75);
  }
}
