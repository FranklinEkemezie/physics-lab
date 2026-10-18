/**
 * Dry cells (and batteries built from them).
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { makeLabelPlane, meshOf } from '../../geometry';

/** A dry cell (Leclanché/dry cell) with terminals and a printed voltage. */
export function buildDryCell(voltageV = 1.5, options: { label?: string } = {}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'DryCell';

  const radius = 0.017;
  const height = 0.062;

  const shrink = meshOf(new THREE.CylinderGeometry(radius, radius, height, 28), Materials.paint('#1f2226', 0.55), 'Shrink');
  shrink.position.y = height / 2;
  group.add(shrink);

  const band = meshOf(new THREE.CylinderGeometry(radius * 1.02, radius * 1.02, height * 0.28, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5, side: THREE.DoubleSide }), 'Band');
  band.position.y = height * 0.34;
  group.add(band);

  const label = makeLabelPlane({
    text: `${voltageV.toFixed(1)} V\n${options.label ?? 'DRY CELL'}`,
    widthM: radius * 2.6,
    fontScale: 0.15,
    foreground: '#f3efe4',
    background: null,
  });
  label.rotation.y = 0;
  label.scale.set(1, 1, 1);
  label.position.set(0, height * 0.55, radius * 1.01);
  group.add(label);

  // Positive brass pip and negative flat cap.
  const pip = meshOf(new THREE.CylinderGeometry(0.004, 0.005, 0.006, 16), Materials.brass(), 'PositivePip');
  pip.position.y = height + 0.003;
  group.add(pip);
  const cap = meshOf(new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 0.003, 24), Materials.chrome(), 'NegativeCap');
  cap.position.y = -0.0015;
  group.add(cap);

  const positiveTerminal = new THREE.Object3D();
  positiveTerminal.name = 'Positive';
  positiveTerminal.position.y = height + 0.006;
  const negativeTerminal = new THREE.Object3D();
  negativeTerminal.name = 'Negative';
  negativeTerminal.position.y = -0.003;
  group.add(positiveTerminal, negativeTerminal);

  group.userData.isHandle = true;
  group.userData.physics = { kind: 'cell', emfV: voltageV, internalResistanceOhms: 0.6 };
  group.userData.apparatus = { id: 'dry-cell', label: `${voltageV.toFixed(1)} V cell` };
  return group;
}
