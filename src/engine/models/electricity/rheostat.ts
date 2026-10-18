/**
 * Sliding-contact rheostats (variable resistors).
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { makeLabelPlane, meshOf, roundedBox } from '../../geometry';

/**
 * Sliding-contact rheostat (variable resistor) with a graduated ceramic
 * former, a metal slide rod and three terminals.
 *
 * <b>Anchors:</b> `Slider`.
 */
export class RheostatModel {
  readonly group = new THREE.Group();
  readonly maxResistanceOhms: number;
  #slider: THREE.Mesh;
  #fraction = 1;

  constructor(maxResistanceOhms = 20, lengthM = 0.14) {
    this.maxResistanceOhms = maxResistanceOhms;
    this.group.name = 'Rheostat';

    const former = meshOf(
      new THREE.CylinderGeometry(0.012, 0.012, lengthM, 28),
      Materials.paint('#d9d2c0', 0.85),
      'Former',
    );
    former.rotation.z = Math.PI / 2;
    former.position.y = 0.026;
    this.group.add(former);

    // Bare resistance wire wound round the former.
    const points: THREE.Vector3[] = [];
    const turns = 90;
    for (let i = 0; i <= turns * 12; i += 1) {
      const t = i / (turns * 12);
      const angle = t * turns * Math.PI * 2;
      points.push(
        new THREE.Vector3(-lengthM / 2 + t * lengthM, 0.026 + Math.sin(angle) * 0.0122, Math.cos(angle) * 0.0122),
      );
    }
    const winding = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), turns * 6, 0.00035, 5, false),
      Materials.agedBrass(),
    );
    winding.name = 'Winding';
    this.group.add(winding);

    const rail = meshOf(new THREE.CylinderGeometry(0.0028, 0.0028, lengthM + 0.03, 12), Materials.chrome(), 'SlideRod');
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 0.052, 0.004);
    this.group.add(rail);

    this.#slider = meshOf(new THREE.BoxGeometry(0.012, 0.016, 0.03), Materials.blackSteel(), 'Slider');
    this.#slider.position.set(0, 0.041, 0.002);
    this.group.add(this.#slider);

    const knob = meshOf(new THREE.CylinderGeometry(0.006, 0.006, 0.014, 16), Materials.paint('#c0392b', 0.45), 'SliderKnob');
    knob.position.set(0, 0.055, 0.015);
    this.group.add(knob);

    for (const x of [-lengthM / 2 - 0.005, lengthM / 2 + 0.005]) {
      const endCap = meshOf(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 24), Materials.paint('#3a3f45', 0.6), 'EndCap');
      endCap.rotation.z = Math.PI / 2;
      endCap.position.set(x, 0.026, 0);
      this.group.add(endCap);
    }

    const base = meshOf(roundedBox(0.16, 0.008, 0.05, 0.003), Materials.darkWood(), 'Base');
    base.position.y = 0.004;
    this.group.add(base);

    const label = makeLabelPlane({
      text: `0 – ${maxResistanceOhms} Ω`,
      widthM: 0.09,
      fontScale: 0.2,
      foreground: '#3a2b16',
    });
    label.rotation.x = -Math.PI / 2;
    label.position.set(0, 0.0085, 0.02);
    this.group.add(label);

    this.setResistance(maxResistanceOhms);
    this.group.userData.isHandle = true;
    this.group.userData.apparatus = { id: 'rheostat', label: `Rheostat 0–${maxResistanceOhms} Ω` };
  }

  setResistance(ohms: number): void {
    this.#fraction = Math.min(1, Math.max(0, ohms / this.maxResistanceOhms));
    const span = 0.12;
    this.#slider.position.x = -span / 2 + this.#fraction * span;
  }

  get resistanceOhms(): number {
    return this.#fraction * this.maxResistanceOhms;
  }
}
