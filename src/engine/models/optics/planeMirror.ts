/**
 * Plane mirrors.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf, roundedBox } from '../../geometry';

/**
 * Plane mirror on a wooden block — the workhorse of reflection experiments.
 *
 * <b>Anchors:</b> `MirrorPlane` — the reflecting surface itself.
 */
export function buildPlaneMirror(options: { widthM?: number; heightM?: number } = {}): THREE.Group {
  const { widthM = 0.09, heightM = 0.06 } = options;
  const group = new THREE.Group();
  group.name = 'PlaneMirror';

  const backing = meshOf(new THREE.BoxGeometry(widthM, heightM, 0.004), Materials.paint('#3a3f45', 0.6), 'Backing');
  backing.position.y = heightM / 2 + 0.012;
  group.add(backing);

  const mirror = meshOf(new THREE.BoxGeometry(widthM * 0.985, heightM * 0.985, 0.0008), Materials.mirror(), 'MirrorSurface');
  mirror.position.set(0, heightM / 2 + 0.012, 0.0025);
  group.add(mirror);

  const block = meshOf(roundedBox(widthM * 0.6, 0.024, 0.03, 0.003), Materials.darkWood(), 'Block');
  block.position.y = 0.012;
  group.add(block);

  const plane = new THREE.Object3D();
  plane.name = 'MirrorPlane';
  plane.position.set(0, heightM / 2 + 0.012, 0.003);
  group.add(plane);

  group.userData.isHandle = true;
  group.userData.apparatus = { id: 'plane-mirror', label: 'Plane mirror' };
  return group;
}
