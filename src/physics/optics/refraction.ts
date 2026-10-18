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
