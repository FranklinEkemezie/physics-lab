/**
 * Painted bar magnets.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { makeLabelPlane, meshOf } from '../../geometry';

/**
 * The classic painted bar magnet: red north half, blue south half, with the
 * poles stamped on. Ships with a soft-iron keeper — the bit everyone loses.
 */
export function buildBarMagnet(lengthM = 0.1, options: { withKeeper?: boolean } = {}): THREE.Group {
  const { withKeeper = true } = options;
  const group = new THREE.Group();
  group.name = 'BarMagnet';

  const width = 0.014;
  const height = 0.007;

  const north = meshOf(new THREE.BoxGeometry(lengthM / 2, height, width), Materials.paint('#b3251e', 0.42), 'NorthHalf');
  north.position.set(lengthM / 4, height / 2, 0);
  const south = meshOf(new THREE.BoxGeometry(lengthM / 2, height, width), Materials.paint('#1f3f8f', 0.42), 'SouthHalf');
  south.position.set(-lengthM / 4, height / 2, 0);
  group.add(north, south);

  for (const [name, x, colour] of [
    ['NorthPole', lengthM / 2 - 0.01, '#f7e9c8'],
    ['SouthPole', -lengthM / 2 + 0.01, '#e8eefc'],
  ] as const) {
    const letter = makeLabelPlane({
      text: name.startsWith('North') ? 'N' : 'S',
      widthM: 0.008,
      fontScale: 0.5,
      foreground: colour,
    });
    letter.rotation.x = -Math.PI / 2;
    letter.position.set(x, height + 0.0004, 0);
    letter.name = name;
    group.add(letter);
  }

  const pivotAnchor = new THREE.Object3D();
  pivotAnchor.name = 'Centre';
  pivotAnchor.position.set(0, height / 2, 0);
  group.add(pivotAnchor);

  if (withKeeper) {
    group.userData.keeperName = 'Keeper';
  }

  group.userData.isHandle = true;
  group.userData.physics = {
    kind: 'magnet',
    lengthM,
    /** Magnetic moment in A·m², roughly right for a school bar magnet. */
    momentAm2: 1.2,
  };
  group.userData.apparatus = { id: 'bar-magnet', label: 'Bar magnet' };
  return group;
}
