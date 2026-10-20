/**
 * The knife edge.
 *
 * A hardened steel wedge on a pedestal. It is the pivot for a metre rule in
 * moments experiments, and it is deliberately *sharp*: a blunt support would
 * give the rule a wide contact patch and ruin the moment calculation.
 */

import * as THREE from 'three';
import { meshOf, roundedBox } from '../../../geometry';
import { Materials } from '../../../materials';
import { applyDisplayOptions, type ModelDisplayOptions, type ModelEntry } from '../types';

export interface KnifeEdgeOptions extends ModelDisplayOptions {
  /** Length of the cutting edge in metres. */
  bladeLengthM?: number;
  /** Height of the edge above the bench, in metres. */
  edgeHeightM?: number;
}

export function buildKnifeEdge(options: KnifeEdgeOptions = {}): THREE.Group {
  const { bladeLengthM = 0.07, edgeHeightM = 0.045, accent = '#b9c4cf' } = options;
  const group = new THREE.Group();
  group.name = 'KnifeEdge';

  const base = meshOf(roundedBox(0.07, 0.012, 0.05, 0.004), Materials.paint('#2b2f33', 0.55), 'Base');
  base.position.y = 0.006;
  group.add(base);

  const pedestal = meshOf(
    new THREE.BoxGeometry(0.026, edgeHeightM * 0.62, 0.018),
    Materials.blackSteel(),
    'Pedestal',
  );
  pedestal.position.y = 0.012 + (edgeHeightM * 0.62) / 2;
  group.add(pedestal);

  // A triangular prism with the apex upwards. Extruded along Z, so the edge
  // runs across the bench — which is how a rule balances on it.
  const width = 0.018;
  const height = 0.016;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(0, height);
  shape.closePath();
  const bladeGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: bladeLengthM,
    bevelEnabled: true,
    bevelSize: 0.0006,
    bevelThickness: 0.0006,
    bevelSegments: 1,
  });
  bladeGeometry.translate(0, 0, -bladeLengthM / 2);

  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color(accent),
    metalness: 0.9,
    roughness: 0.18,
  });
  const blade = meshOf(bladeGeometry, bladeMaterial, 'Blade');
  blade.position.y = 0.012 + edgeHeightM * 0.62;
  group.add(blade);

  group.userData.model = { id: 'apparatus-knife-edge', label: 'Knife edge' };
  group.userData.facts = [
    'A knife edge gives an almost frictionless pivot with a known line of action.',
    'It is used to balance a metre rule in moments experiments.',
  ];
  return applyDisplayOptions(group, options) as THREE.Group;
}

export const KNIFE_EDGE_MODEL: ModelEntry = {
  id: 'apparatus-knife-edge',
  label: 'Knife edge',
  category: 'apparatus',
  summary: 'A sharp steel pivot for balancing a metre rule.',
  facts: ['The narrower the edge, the better the moment measurement.'],
  build: (options) => buildKnifeEdge(options),
};
