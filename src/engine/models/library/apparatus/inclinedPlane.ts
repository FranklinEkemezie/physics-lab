/**
 * An adjustable inclined plane.
 *
 * The ramp is a real hinge: changing `angleDeg` rotates the board about its
 * lower end and moves the support strut with it. A small block sits on the
 * slope, ready for a friction or resolving-forces experiment.
 */

import * as THREE from 'three';
import { meshOf, roundedBox } from '../../../geometry';
import { Materials } from '../../../materials';
import { applyDisplayOptions, type ModelDisplayOptions, type ModelEntry } from '../types';

export interface InclinedPlaneOptions extends ModelDisplayOptions {
  /** Angle of the slope in degrees. */
  angleDeg?: number;
  /** Length of the ramp in metres. */
  lengthM?: number;
  /** Put a block on the slope. */
  block?: boolean;
}

export function buildInclinedPlane(options: InclinedPlaneOptions = {}): THREE.Group {
  const { angleDeg = 25, lengthM = 0.3, block = true, accent = '#b98a55' } = options;
  const group = new THREE.Group();
  group.name = 'InclinedPlane';

  const base = meshOf(roundedBox(lengthM + 0.04, 0.012, 0.13, 0.004), Materials.paint('#2b2f33', 0.55), 'Base');
  base.position.y = 0.006;
  group.add(base);

  const pivotX = -lengthM / 2;
  const ramp = new THREE.Group();
  ramp.name = 'Ramp';
  ramp.position.set(pivotX, 0.012, 0);
  ramp.rotation.z = THREE.MathUtils.degToRad(angleDeg);

  const boardMaterial = Materials.paint(accent, 0.72);
  const board = meshOf(new THREE.BoxGeometry(lengthM, 0.008, 0.1), boardMaterial, 'Board');
  board.position.set(lengthM / 2, 0.004, 0);
  ramp.add(board);

  for (const side of [-1, 1]) {
    const rail = meshOf(new THREE.BoxGeometry(lengthM, 0.012, 0.006), boardMaterial, 'Rail');
    rail.position.set(lengthM / 2, 0.012, side * 0.047);
    ramp.add(rail);
  }

  if (block) {
    const blockMesh = meshOf(
      roundedBox(0.045, 0.03, 0.045, 0.004),
      Materials.paint('#7f8a96', 0.5),
      'Block',
    );
    blockMesh.position.set(lengthM * 0.62, 0.023, 0);
    ramp.add(blockMesh);
  }

  group.add(ramp);

  // A vertical strut under the ramp, sized from the angle.
  const strutX = 0.08;
  const strutHeight = Math.max(0.012, Math.tan(THREE.MathUtils.degToRad(angleDeg)) * (strutX - pivotX));
  const strut = meshOf(
    new THREE.BoxGeometry(0.012, strutHeight, 0.05),
    Materials.paint('#4a5560', 0.5),
    'Strut',
  );
  strut.position.set(strutX, 0.012 + strutHeight / 2, 0);
  group.add(strut);

  group.userData.model = { id: 'apparatus-inclined-plane', label: 'Inclined plane' };
  group.userData.angleDeg = angleDeg;
  group.userData.facts = [
    `At ${angleDeg}°, the component of weight down the slope is mg sin ${angleDeg}°.`,
    'The normal reaction is mg cos θ, not mg.',
  ];
  return applyDisplayOptions(group, options) as THREE.Group;
}

export const INCLINED_PLANE_MODEL: ModelEntry = {
  id: 'apparatus-inclined-plane',
  label: 'Inclined plane',
  category: 'apparatus',
  summary: 'A hinged ramp with a support strut and a block on the slope.',
  facts: ['Used to study resolving forces and friction.'],
  build: (options) => buildInclinedPlane(options),
};
