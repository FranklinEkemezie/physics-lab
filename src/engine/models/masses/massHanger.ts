/**
 * Mass hangers.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf } from '../../geometry';

/**
 * The mass hanger: a small plate with a stem that slotted masses slide onto
 * and a hook at the bottom for the next hanger.
 *
 * <b>Anchors:</b> `StemTop` (where the hanger is suspended) and `PlateTop`
 * (where masses rest).
 */
export function buildMassHanger(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'MassHanger';

  const plate = meshOf(new THREE.CylinderGeometry(0.019, 0.019, 0.002, 28), Materials.chrome(), 'Plate');
  plate.position.y = -0.022;
  group.add(plate);

  const stem = meshOf(new THREE.CylinderGeometry(0.0025, 0.0025, 0.05, 12), Materials.chrome(), 'Stem');
  stem.position.y = 0.003;
  group.add(stem);

  const stemTop = meshOf(new THREE.SphereGeometry(0.0035, 16, 12), Materials.chrome(), 'StemTop');
  stemTop.position.y = 0.028;
  group.add(stemTop);

  const hook = meshOf(new THREE.TorusGeometry(0.007, 0.0014, 8, 20, Math.PI * 1.5), Materials.chrome(), 'Hook');
  hook.position.y = -0.032;
  hook.rotation.z = Math.PI;
  group.add(hook);

  const stemAnchor = new THREE.Object3D();
  stemAnchor.name = 'StemTop';
  stemAnchor.position.y = 0.028;
  const plateAnchor = new THREE.Object3D();
  plateAnchor.name = 'PlateTop';
  plateAnchor.position.y = -0.02;
  group.add(stemAnchor, plateAnchor);

  group.userData.isHandle = true;
  group.userData.physics = { kind: 'hanger', massKg: 0.05 };
  return group;
}
