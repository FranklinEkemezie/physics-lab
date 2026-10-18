/**
 * Concave (converging) spherical mirrors.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf } from '../../geometry';

/**
 * Concave (converging) spherical mirror on a stand.
 *
 * <b>Anchors:</b> `Pole` — the centre of the mirror surface.
 */
export class ConcaveMirrorModel {
  readonly group = new THREE.Group();
  readonly focalLengthM: number;
  readonly radiusOfCurvatureM: number;

  constructor(focalLengthM = 0.15, apertureRadiusM = 0.035) {
    this.focalLengthM = focalLengthM;
    this.radiusOfCurvatureM = focalLengthM * 2;
    this.group.name = 'ConcaveMirror';

    const R = this.radiusOfCurvatureM;
    const r = apertureRadiusM;
    const sag = R - Math.sqrt(Math.max(1e-9, R * R - r * r));

    const profile: THREE.Vector2[] = [];
    const steps = 36;
    for (let i = 0; i <= steps; i += 1) {
      const x = (i / steps) * r;
      const y = -(Math.sqrt(Math.max(0, R * R - x * x)) - Math.sqrt(R * R - r * r) + sag);
      profile.push(new THREE.Vector2(x, y));
    }

    const geometry = new THREE.LatheGeometry(profile, 48);
    geometry.rotateX(Math.PI / 2);
    const mirrorMaterial = Materials.mirror().clone();
    mirrorMaterial.side = THREE.DoubleSide;
    const mirror = new THREE.Mesh(geometry, mirrorMaterial);
    mirror.name = 'MirrorSurface';
    mirror.castShadow = true;
    this.group.add(mirror);

    const rim = meshOf(new THREE.TorusGeometry(r, 0.0015, 8, 48), Materials.castIron(), 'Rim');
    this.group.add(rim);

    const stalk = meshOf(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 12), Materials.chrome(), 'Stalk');
    stalk.position.y = -r - 0.026;
    const base = meshOf(new THREE.CylinderGeometry(0.03, 0.034, 0.008, 28), Materials.castIron(), 'Base');
    base.position.y = -r - 0.05;
    this.group.add(stalk, base);

    const pole = new THREE.Object3D();
    pole.name = 'Pole';
    this.group.add(pole);

    this.group.userData.apparatus = { id: 'concave-mirror', label: 'Concave mirror' };
    this.group.userData.optics = { focalLengthM, radiusOfCurvatureM: R, kind: 'concave-mirror' };
  }
}
