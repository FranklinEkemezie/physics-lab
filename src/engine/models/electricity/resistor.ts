/**
 * Carbon-film resistors with their colour code.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { meshOf } from '../../geometry';

/** Colour bands for a carbon-film resistor, in the standard order. */
const RESISTOR_COLOURS: Record<number, string> = {
  0: '#111111',
  1: '#6b3f1d',
  2: '#c0392b',
  3: '#e67e22',
  4: '#f1c40f',
  5: '#27ae60',
  6: '#2980b9',
  7: '#8e44ad',
  8: '#7f8c8d',
  9: '#ecf0f1',
};

/** Decode a 4-band resistor value into band colours. */
export function resistorBands(ohms: number): string[] {
  const value = Math.max(1, Math.round(ohms));
  const digits = String(value);
  const first = Number(digits[0]);
  const second = digits.length > 1 ? Number(digits[1]) : 0;
  const multiplier = digits.length > 2 ? digits.length - 2 : 0;
  return [
    RESISTOR_COLOURS[first] ?? '#111',
    RESISTOR_COLOURS[second] ?? '#111',
    RESISTOR_COLOURS[Math.min(9, multiplier)] ?? '#111',
    '#c9a227', // gold tolerance band = ±5 %
  ];
}

/** A carbon-film resistor with authentic colour-code bands. */
export function buildResistor(ohms = 100): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Resistor';

  const lengthM = 0.014;
  const radius = 0.0028;

  const body = meshOf(new THREE.CylinderGeometry(radius, radius, lengthM, 24), Materials.paint('#cbb98a', 0.7), 'Body');
  body.rotation.z = Math.PI / 2;
  body.position.y = radius + 0.0004;
  group.add(body);

  const bands = resistorBands(ohms);
  bands.forEach((colour, index) => {
    const band = meshOf(
      new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, 0.0016, 24),
      Materials.paint(colour, 0.55),
      `Band${index}`,
    );
    band.rotation.z = Math.PI / 2;
    band.position.set(-lengthM / 2 + 0.0022 + index * 0.0028, radius + 0.0004, 0);
    group.add(band);
  });

  const leadGeometry = new THREE.CylinderGeometry(0.0006, 0.0006, 0.02, 10);
  const leadA = meshOf(leadGeometry, Materials.chrome(), 'LeadA');
  leadA.rotation.z = Math.PI / 2;
  leadA.position.set(-lengthM / 2 - 0.01, radius + 0.0004, 0);
  const leadB = leadA.clone();
  leadB.name = 'LeadB';
  leadB.position.x = lengthM / 2 + 0.01;
  group.add(leadA, leadB);

  group.userData.isHandle = true;
  group.userData.physics = { kind: 'resistor', resistanceOhms: ohms };
  group.userData.apparatus = { id: 'resistor', label: `Resistor ${ohms} Ω` };
  return group;
}
