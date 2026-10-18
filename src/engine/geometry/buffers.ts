/** Low-level buffer geometry utilities. */

import * as THREE from 'three';

/** Merge a list of geometries into one buffer geometry (fewer draw calls). */
export function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  if (geometries.length === 0) return merged;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let offset = 0;

  for (const geometry of geometries) {
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const normal = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute | undefined;
    const index = geometry.getIndex();

    for (let i = 0; i < position.count; i += 1) {
      positions.push(position.getX(i), position.getY(i), position.getZ(i));
      if (normal) normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
      if (uv) uvs.push(uv.getX(i), uv.getY(i));
    }

    if (index) {
      for (let i = 0; i < index.count; i += 1) indices.push(index.getX(i) + offset);
    } else {
      for (let i = 0; i < position.count; i += 1) indices.push(i + offset);
    }

    offset += position.count;
    geometry.dispose();
  }

  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length) merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  if (uvs.length) merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  merged.computeVertexNormals();
  return merged;
}
