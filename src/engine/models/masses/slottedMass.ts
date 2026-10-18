/**
 * Slotted masses.
 */

import * as THREE from 'three';
import { Materials } from '../../materials';
import { makeLabelPlane, meshOf } from '../../geometry';

/**
 * A slotted Mass: a brass disc with a radial slot to the centre so it can be
 * dropped onto the hanger's stem.
 *
 * <b>Anchors:</b> `Centre` — the centre of the disc.
 */
export function buildSlottedMass(massG: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `SlottedMass${massG}g`;

  // Roughly constant thickness, radius ∝ √mass so they look like real sets.
  const thickness = 0.006;
  const radius = Math.max(0.014, 0.0032 * Math.sqrt(massG));
  const slotHalfWidth = Math.max(0.0035, radius * 0.12);

  const shape = new THREE.Shape();
  const halfAngle = Math.asin(Math.min(0.85, slotHalfWidth / radius));
  const a1 = Math.PI / 2 + halfAngle;
  const a0 = Math.PI / 2 - halfAngle;

  shape.moveTo(Math.cos(a1) * radius, Math.sin(a1) * radius);
  shape.absarc(0, 0, radius, a1, a0 - Math.PI * 2, true);
  shape.lineTo(0, 0);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelSize: 0.0008,
    bevelThickness: 0.0008,
    bevelSegments: 2,
    curveSegments: 32,
  });
  geometry.translate(0, 0, -thickness / 2);
  geometry.rotateX(-Math.PI / 2); // lay the disc flat (thickness along Y)

  const disc = meshOf(geometry, Materials.agedBrass(), 'Disc');
  group.add(disc);

  const label = makeLabelPlane({
    text: `${massG} g`,
    widthM: radius * 1.5,
    fontScale: 0.22,
    bold: true,
    foreground: '#3a2d12',
  });
  label.name = 'MassLabel';
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, thickness / 2 + 0.0004, -radius * 0.28);
  group.add(label);

  const centre = new THREE.Object3D();
  centre.name = 'Centre';
  group.add(centre);

  group.userData.isHandle = true;
  group.userData.physics = { kind: 'mass', massKg: massG / 1000 };
  group.userData.apparatus = { id: 'slotted-mass', label: `${massG} g mass` };
  return group;
}
