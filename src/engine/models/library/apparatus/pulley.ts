/**
 * A bench pulley.
 *
 * The grooved wheel is not decoration: the groove keeps the string on the rim,
 * which is the difference between a pulley and a spinning disc. A string is
 * included so the model reads immediately as a machine.
 */

import * as THREE from 'three';
import { meshOf, roundedBox } from '../../../geometry';
import { Materials } from '../../../materials';
import { applyDisplayOptions, type ModelDisplayOptions, type ModelEntry } from '../types';

export interface PulleyOptions extends ModelDisplayOptions {
  /** Wheel radius in metres. */
  wheelRadiusM?: number;
  /** Show a string draped over the wheel. */
  string?: boolean;
}

export function buildPulley(options: PulleyOptions = {}): THREE.Group {
  const { wheelRadiusM = 0.035, accent = '#c8d0d8', string = true } = options;
  const group = new THREE.Group();
  group.name = 'Pulley';

  const base = meshOf(roundedBox(0.08, 0.012, 0.06, 0.004), Materials.paint('#2b2f33', 0.55), 'Base');
  base.position.y = 0.006;
  group.add(base);

  const axleHeight = 0.085;
  const frameMaterial = Materials.paint('#4a5560', 0.4);

  for (const side of [-1, 1]) {
    const plate = meshOf(new THREE.BoxGeometry(0.006, axleHeight, 0.05), frameMaterial, 'Cheek');
    plate.position.set(side * (wheelRadiusM * 0.42 + 0.004), 0.012 + axleHeight / 2, 0);
    group.add(plate);
  }

  const axle = meshOf(
    new THREE.CylinderGeometry(0.0042, 0.0042, wheelRadiusM * 0.9 + 0.02, 14),
    Materials.agedBrass(),
    'Axle',
  );
  axle.rotation.z = Math.PI / 2;
  axle.position.y = axleHeight;
  group.add(axle);

  // Two cheeks and a grooved rim, so the string has somewhere to sit.
  const wheelMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accent),
    metalness: 0.55,
    roughness: 0.32,
  });
  const wheel = new THREE.Group();
  wheel.name = 'Wheel';
  wheel.position.y = axleHeight;
  for (const side of [-1, 1]) {
    const cheek = meshOf(
      new THREE.CylinderGeometry(wheelRadiusM, wheelRadiusM, 0.006, 36),
      wheelMaterial,
      'WheelCheek',
    );
    cheek.rotation.z = Math.PI / 2;
    cheek.position.x = side * 0.005;
    wheel.add(cheek);
  }
  const groove = meshOf(
    new THREE.TorusGeometry(wheelRadiusM * 0.94, 0.0045, 8, 44),
    wheelMaterial,
    'Groove',
  );
  groove.rotation.y = Math.PI / 2;
  wheel.add(groove);
  group.add(wheel);

  if (string) {
    const ropeMaterial = Materials.paint('#d8cfb4', 0.95);
    const points = [
      new THREE.Vector3(0, 0.045, -0.055),
      new THREE.Vector3(0, axleHeight, -wheelRadiusM - 0.004),
      new THREE.Vector3(0, axleHeight + wheelRadiusM + 0.004, -wheelRadiusM * 0.55),
      new THREE.Vector3(0, axleHeight + wheelRadiusM + 0.005, 0),
      new THREE.Vector3(0, axleHeight + wheelRadiusM + 0.004, wheelRadiusM * 0.55),
      new THREE.Vector3(0, axleHeight, wheelRadiusM + 0.004),
      new THREE.Vector3(0, 0.045, 0.055),
    ];
    const curve = new THREE.CatmullRomCurve3(points);
    const rope = meshOf(new THREE.TubeGeometry(curve, 60, 0.0022, 8, false), ropeMaterial, 'String');
    group.add(rope);
  }

  group.userData.model = { id: 'apparatus-pulley', label: 'Pulley' };
  group.userData.facts = [
    'A single fixed pulley changes the direction of a force, not its size.',
    'A movable pulley can halve the effort needed — at the cost of pulling twice as far.',
  ];
  return applyDisplayOptions(group, options) as THREE.Group;
}

export const PULLEY_MODEL: ModelEntry = {
  id: 'apparatus-pulley',
  label: 'Pulley',
  category: 'apparatus',
  summary: 'A grooved wheel on a frame, with a string over the rim.',
  facts: ['Used to change the direction of a force or to gain mechanical advantage.'],
  build: (options) => buildPulley(options),
};
