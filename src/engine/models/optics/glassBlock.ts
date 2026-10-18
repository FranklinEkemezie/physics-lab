/**
 * Rectangular glass blocks.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf } from '../../geometry';

/**
 * Rectangular glass block for refraction experiments.
 * Filled with the real refractive index so Snell's law can be applied.
 *
 * <b>Anchors:</b> `FaceFront`, `FaceBack`.
 */
export function buildGlassBlock(options: {
  lengthM?: number;
  widthM?: number;
  heightM?: number;
  refractiveIndex?: number;
  /** Name shown to the student. Defaults to "Glass block". */
  label?: string;
  /** Set false to keep the refractive index off the label (it is a hidden value). */
  showIndex?: boolean;
} = {}): THREE.Group {
  const {
    lengthM = 0.1,
    widthM = 0.06,
    heightM = 0.02,
    refractiveIndex = 1.5,
    label = 'Glass block',
    showIndex = true,
  } = options;
  const group = new THREE.Group();
  group.name = 'GlassBlock';

  const material = Materials.acrylic().clone();
  material.thickness = Math.min(lengthM, widthM);
  if ('ior' in material) (material as THREE.MeshPhysicalMaterial).ior = refractiveIndex;

  const block = meshOf(new THREE.BoxGeometry(lengthM, heightM, widthM), material, 'BlockBody');
  block.position.y = heightM / 2;
  group.add(block);

  const front = new THREE.Object3D();
  front.name = 'FaceFront';
  front.position.set(0, heightM / 2, widthM / 2);
  const back = new THREE.Object3D();
  back.name = 'FaceBack';
  back.position.set(0, heightM / 2, -widthM / 2);
  group.add(front, back);

  group.userData.apparatus = {
    id: 'glass-block',
    label: showIndex ? `${label} (n = ${refractiveIndex.toFixed(2)})` : label,
  };
  group.userData.optics = { refractiveIndex, lengthM, widthM, heightM, kind: 'glass-block' };
  group.userData.isHandle = true;
  return group;
}
