/**
 * Minimal 3-D vector maths.
 *
 * The physics layer must not depend on Three.js (so it can run in Node, in a
 * test, or inside a documentation article), so field and geometry code uses
 * these plain objects instead of `THREE.Vector3`.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const sub3 = (a: Vec3, b: Vec3): Vec3 => vec3(a.x - b.x, a.y - b.y, a.z - b.z);

export const dot3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross3 = (a: Vec3, b: Vec3): Vec3 =>
  vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export const length3 = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);
