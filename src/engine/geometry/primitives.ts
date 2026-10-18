/** Solid primitive builders and thread/stretch helpers. */

import * as THREE from 'three';

/** A cylinder aligned along the Y axis, positioned/rotated by helper options. */
export function cylinder(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segments = 24,
): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, false);
}

/**
 * Build a mesh from a geometry + material, with sensible shadow defaults.
 * Every apparatus mesh casts and receives shadows in this lab.
 */
export function meshOf(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  name?: string,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (name) mesh.name = name;
  return mesh;
}

/** Slightly rounded box (chamfered look) built from a scaled box + segments. */
export function roundedBox(width: number, height: number, depth: number, radius = 0.02): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const w = width / 2 - radius;
  const h = height / 2 - radius;

  shape.moveTo(-w - radius, -h);
  shape.lineTo(-w - radius, h);
  shape.quadraticCurveTo(-w, h, -w, h + radius);
  shape.lineTo(w, h + radius);
  shape.quadraticCurveTo(w, h, w + radius, h);
  shape.lineTo(w + radius, -h);
  shape.quadraticCurveTo(w, -h, w, -h - radius);
  shape.lineTo(-w, -h - radius);
  shape.quadraticCurveTo(-w, -h, -w - radius, -h);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSize: radius * 0.5,
    bevelThickness: radius * 0.5,
    bevelSegments: 2,
    curveSegments: 4,
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A thin, taut line of thread between two points.
 * Uses a cylinder so it casts a shadow and reads correctly in 3D.
 */
export function threadBetween(radius = 0.0028, segments = 8): THREE.Mesh {
  const geometry = new THREE.CylinderGeometry(radius, radius, 1, segments, 1, true);
  geometry.translate(0, 0.5, 0); // pivot at the bottom so we can scale/orient
  const mesh = new THREE.Mesh(geometry);
  return mesh;
}

/**
 * Orient + stretch a unit-length "thread" mesh so it spans a → b.
 * The unit thread is 1 m tall and pivots at its base.
 */
export function stretchThread(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3): void {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  mesh.position.copy(from);
  mesh.scale.set(1, Math.max(length, 1e-5), 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
}
