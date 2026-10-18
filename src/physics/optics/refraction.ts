/**
 * Geometrical optics: refraction at an interface and through a glass block.
 *
 * Snell's law is the whole story,
 *
 * ```text
 *   n₁ sin i = n₂ sin r ,
 * ```
 *
 * and for the practical "find the refractive index of a glass block" the graph
 * of `sin i` against `sin r` is a straight line through the origin with
 * gradient `n`. Beyond the critical angle the light stops getting out at all —
 * total internal reflection — which a careful student will notice as readings
 * that suddenly refuse to appear.
 */

import type { Point2D } from '@/core/math';

/** Refractive index from a pair of angles: `n = sin i / sin r`. */
export function refractiveIndexFromAngles(incidenceRad: number, refractionRad: number): number {
  const sinR = Math.sin(refractionRad);
  return sinR === 0 ? Number.NaN : Math.sin(incidenceRad) / sinR;
}

/** Relative refractive index of medium 2 with respect to medium 1: `n = n₂/n₁`. */
export function relativeRefractiveIndex(index1: number, index2: number): number {
  return index2 / index1;
}

/**
 * Angle of refraction from Snell's law: `sin r = (n₁/n₂)·sin i`.
 *
 * Returns `NaN` when the ray cannot enter the medium at all (which, going from
 * dense to rare, is total internal reflection).
 */
export function refractionAngle(incidenceRad: number, index1: number, index2: number): number {
  const sinR = (index1 / index2) * Math.sin(incidenceRad);
  if (Math.abs(sinR) > 1) return Number.NaN;
  return Math.asin(sinR);
}

/**
 * Critical angle for total internal reflection, going from index `n` into a
 * rare medium of index 1: `sin c = 1/n`. Returns `NaN` when there is none.
 */
export function criticalAngleRad(n: number): number {
  if (n <= 1) return Number.NaN;
  return Math.asin(1 / n);
}

/** Apparent depth of an object seen through a medium: `apparent = real / n`. */
export function apparentDepthM(realDepthM: number, n: number): number {
  return realDepthM / n;
}

/** Real depth recovered from the apparent depth: `real = n · apparent`. */
export function realDepthM(apparentDepthM: number, n: number): number {
  return apparentDepthM * n;
}

/** Speed of light in a medium: `v = c / n`. */
export function speedInMedium(vacuumSpeedMps: number, n: number): number {
  return vacuumSpeedMps / n;
}

/** Refractive index recovered from the gradient of a `sin i` vs `sin r` graph. */
export function refractiveIndexFromGradient(gradient: number): number {
  return gradient;
}

/**
 * The path of a ray through a rectangular block, in the plane of the bench.
 *
 * The ray strikes the front face at `entry`, crosses `thicknessM` of glass and
 * leaves the back face **parallel to the way it came in** — that is the
 * give-away that the two surfaces are parallel — but shifted sideways. Joining
 * the incident and emergent rays with a straight line through the block and
 * measuring its angle to the normal is how an optical-pins experiment finds the
 * refracted ray without being able to see inside the glass.
 */
export interface BlockRayPath {
  /** Where the ray enters at the front face (bench coordinates). */
  entry: Point2D;
  /** Where the ray leaves at the back face (bench coordinates). */
  exit: Point2D;
  /** Angle of refraction inside the glass, in radians (`NaN` if it cannot enter). */
  refractionRad: number;
  /** Sideways shift of the emergent ray from the incident ray, in metres. */
  displacementM: number;
}

export interface BlockRayOptions {
  /** Angle of incidence in the surrounding medium, in radians. */
  incidenceRad: number;
  /** Refractive index of the block. */
  refractiveIndex: number;
  /** Distance the ray travels through the glass, in metres. */
  thicknessM: number;
  /** Where on the front face the ray strikes. */
  entry: Point2D;
}

/** Trace a ray through a rectangular glass block (air on both sides). */
export function traceBlockRay(options: BlockRayOptions): BlockRayPath {
  const { incidenceRad, refractiveIndex, thicknessM, entry } = options;
  const refractionRad = refractionAngle(incidenceRad, 1, refractiveIndex);

  // The ray travels away from the front face, so the back face lies at −thickness.
  const exit: Point2D = Number.isNaN(refractionRad)
    ? { x: entry.x, z: entry.z - thicknessM }
    : { x: entry.x + thicknessM * Math.tan(refractionRad), z: entry.z - thicknessM };

  const displacementM = Number.isNaN(refractionRad)
    ? 0
    : (thicknessM * Math.sin(incidenceRad - refractionRad)) / Math.cos(refractionRad);

  return { entry, exit, refractionRad, displacementM };
}
