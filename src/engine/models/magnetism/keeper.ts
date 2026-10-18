/**
 * Soft-iron keepers.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf, roundedBox } from '../../geometry';

/** A soft-iron keeper bar that clips across the poles when stored. */
export function buildKeeper(lengthM = 0.032): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Keeper';
  const bar = meshOf(roundedBox(lengthM, 0.009, 0.016, 0.002), Materials.softIron(), 'KeeperBar');
  bar.position.y = 0.0045;
  group.add(bar);
  group.userData.physics = { kind: 'keeper' };
  return group;
}
