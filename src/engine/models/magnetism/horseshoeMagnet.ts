/**
 * Horseshoe (U-shaped) magnets.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf } from '../../geometry';

/**
 * Horseshoe (U-shaped) magnet, built by extruding the arc of an annulus.
 *
 * <b>Anchors:</b> `PoleN`, `PoleS`.
 */
export function buildHorseshoeMagnet(options: { outerRadiusM?: number; gapM?: number; thicknessM?: number } = {}): THREE.Group {
  const { outerRadiusM = 0.032, gapM = 0.018, thicknessM = 0.012 } = options;
  const group = new THREE.Group();
  group.name = 'HorseshoeMagnet';

  const innerRadius = gapM / 2;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerRadiusM, 0, Math.PI, false);
  shape.absarc(0, 0, innerRadius, Math.PI, 0, true);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thicknessM, bevelEnabled: false });
  const body = new THREE.Mesh(geometry, Materials.paint('#8e2b22', 0.45));
  body.name = 'HorseshoeBody';
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Silver pole faces at the two ends.
  const poleGeometry = new THREE.BoxGeometry(innerRadius + 0.006, 0.006, thicknessM * 1.01);
  for (const [name, x] of [
    ['PoleN', -(innerRadius + 0.003)],
    ['PoleS', innerRadius + 0.003],
  ] as const) {
    const pole = meshOf(poleGeometry, Materials.softIron(), name);
    pole.position.set(x * 0.5, 0.003, thicknessM / 2);
    group.add(pole);
  }

  const poleN = new THREE.Object3D();
  poleN.name = 'PoleN';
  poleN.position.set(-(outerRadiusM + innerRadius) / 2, 0, thicknessM / 2);
  const poleS = new THREE.Object3D();
  poleS.name = 'PoleS';
  poleS.position.set((outerRadiusM + innerRadius) / 2, 0, thicknessM / 2);
  group.add(poleN, poleS);

  group.userData.isHandle = true;
  group.userData.physics = { kind: 'magnet', momentAm2: 0.9 };
  group.userData.apparatus = { id: 'horseshoe-magnet', label: 'Horseshoe magnet' };
  return group;
}
