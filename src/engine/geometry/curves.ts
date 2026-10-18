/** Curve, helix and coil geometry builders. */

import * as THREE from 'three';

/** Build a helix (spring or coil) as a TubeGeometry along a helical curve. */
export function helixGeometry(
  radius: number,
  height: number,
  turns: number,
  wireRadius: number,
  segmentsPerTurn = 24,
): THREE.TubeGeometry {
  const points: THREE.Vector3[] = [];
  const total = Math.max(8, Math.floor(turns * segmentsPerTurn));
  for (let i = 0; i <= total; i += 1) {
    const t = i / total;
    const angle = t * turns * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, t * height, Math.sin(angle) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, total, wireRadius, 8, false);
}

/** A flat coil of wire lying in the XZ plane (used for solenoids/inductors). */
export function flatCoilGeometry(
  innerRadius: number,
  outerRadius: number,
  turns: number,
  wireRadius: number,
): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  const total = Math.max(16, Math.floor(turns * 32));
  for (let i = 0; i <= total; i += 1) {
    const t = i / total;
    const angle = t * turns * Math.PI * 2;
    const radius = innerRadius + (outerRadius - innerRadius) * t;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.TubeGeometry(curve, total, wireRadius, 6, false);
}
