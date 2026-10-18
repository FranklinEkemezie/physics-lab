/**
 * Equilateral glass prisms.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';

/**
 * Equilateral glass prism for refraction and dispersion work.
 * The apex angle is exactly 60°, so minimum-deviation calculations work.
 */
export function buildPrism(options: { sideM?: number; refractiveIndex?: number } = {}): THREE.Group {
  const { sideM = 0.05, refractiveIndex = 1.52 } = options;
  const group = new THREE.Group();
  group.name = 'Prism';

  const shape = new THREE.Shape();
  const height = (Math.sqrt(3) / 2) * sideM;
  shape.moveTo(-sideM / 2, 0);
  shape.lineTo(sideM / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: false, curveSegments: 1 });
  geometry.translate(0, 0.035, 0);
  geometry.rotateX(-Math.PI / 2);

  const material = Materials.acrylic().clone();
  if ('ior' in material) (material as THREE.MeshPhysicalMaterial).ior = refractiveIndex;

  const body = new THREE.Mesh(geometry, material);
  body.name = 'PrismBody';
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const apex = new THREE.Object3D();
  apex.name = 'Apex';
  apex.position.set(0, height, 0);
  group.add(apex);

  group.userData.isHandle = true;
  group.userData.apparatus = { id: 'prism', label: 'Glass prism' };
  group.userData.optics = { refractiveIndex, apexAngleDeg: 60, kind: 'prism' };
  return group;
}
