/**
 * Knife switches (keys).
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf, roundedBox } from '../../geometry';

/** Knife switch on a wooden base. */
export class KnifeSwitchModel {
  readonly group = new THREE.Group();
  #blade: THREE.Group;
  #closed = false;

  constructor() {
    this.group.name = 'KnifeSwitch';

    const base = meshOf(roundedBox(0.1, 0.01, 0.045, 0.003), Materials.darkWood(), 'Base');
    base.position.y = 0.005;
    this.group.add(base);

    const jawPost = meshOf(new THREE.CylinderGeometry(0.004, 0.004, 0.018, 16), Materials.brass(), 'JawPost');
    jawPost.position.set(0.03, 0.019, 0);
    const pivotPost = jawPost.clone();
    pivotPost.name = 'PivotPost';
    pivotPost.position.set(-0.03, 0.019, 0);
    this.group.add(jawPost, pivotPost);

    for (const post of [jawPost, pivotPost]) {
      const terminal = meshOf(new THREE.CylinderGeometry(0.0042, 0.0042, 0.008, 16), Materials.agedBrass(), 'Terminal');
      terminal.position.set(post.position.x, 0.008, 0.016);
      this.group.add(terminal);
    }

    this.#blade = new THREE.Group();
    this.#blade.name = 'Blade';
    this.#blade.position.set(-0.03, 0.026, 0);
    const metal = meshOf(new THREE.BoxGeometry(0.062, 0.002, 0.008), Materials.brass(), 'BladeBar');
    metal.position.x = 0.031;
    const handle = meshOf(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 16), Materials.rubber(), 'BladeHandle');
    handle.rotation.z = Math.PI / 2;
    handle.position.x = 0.066;
    this.#blade.add(metal, handle);
    this.group.add(this.#blade);

    this.setClosed(false);
    this.group.userData.isHandle = true;
    this.group.userData.apparatus = { id: 'knife-switch', label: 'Switch' };
  }

  /** Open or close the switch — animated by the experiment each frame. */
  setClosed(closed: boolean, animate = false): void {
    this.#closed = closed;
    this.#blade.userData.targetAngle = closed ? 0 : -0.62;
    if (!animate) {
      this.#blade.rotation.z = this.#blade.userData.targetAngle as number;
    }
  }

  get isClosed(): boolean {
    return this.#closed;
  }

  update(dt: number): void {
    const target = (this.#blade.userData.targetAngle as number) ?? 0;
    this.#blade.rotation.z += (target - this.#blade.rotation.z) * Math.min(1, dt * 12);
  }
}
