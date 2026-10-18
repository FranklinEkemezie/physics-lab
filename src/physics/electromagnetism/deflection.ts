/**
 * The quantitative half of the plotting-compass practical.
 *
 * On the *equatorial line* (through the magnet's centre, at right angles to it)
 * the magnet's field is perpendicular to the Earth's horizontal field `H`, so
 * the needle is deflected by θ with
 *
 * ```text
 *   tan θ = |B| / H = (μ₀/4π)·m / (H·d³) .
 * ```
 *
 * A graph of `tan θ` against `1/d³` is a straight line through the origin whose
 * gradient hands over the magnet's magnetic moment `m`. This module holds the
 * theory, the recovery of `m`, and the reading-error propagation that gives the
 * graph its scatter.
 */

import { EARTH_HORIZONTAL_T, MU0_OVER_4PI, type DipoleMagnet } from './dipoleField';

/**
 * The deflection theory predicts on the equatorial line:
 *
 * ```text
 *   tan θ = (μ₀/4π)·m / (H·d³)
 * ```
 */
export function theoreticalDeflectionRad(
  distanceM: number,
  magnet: DipoleMagnet,
  earthH = EARTH_HORIZONTAL_T,
): number {
  if (distanceM <= 0) return Math.PI / 2;
  const magnetField = (MU0_OVER_4PI * magnet.momentAm2) / distanceM ** 3;
  return Math.atan(magnetField / earthH);
}

/**
 * Gradient of the straight-line graph `tan θ` against `1/d³`.
 *
 * A perfect dipole gives a constant `G = (μ₀/4π)·m / H`, so the graph passes
 * through the origin with this gradient whatever the distance.
 */
export function gradientFor(magnet: DipoleMagnet, earthH = EARTH_HORIZONTAL_T): number {
  return (MU0_OVER_4PI * magnet.momentAm2) / earthH;
}

/** Recover the magnetic moment from the gradient the student measured. */
export function momentFromGradient(gradientM3: number, earthH = EARTH_HORIZONTAL_T): number {
  return (gradientM3 * earthH) / MU0_OVER_4PI;
}

/**
 * Distance from the centre at which the magnet's equatorial field exactly equals
 * the Earth's, so the needle sits at 45° to magnetic north.
 *
 * Note that this is *not* a neutral point: in this practical the magnet's axis
 * is at right angles to the Earth's field, so the two fields never cancel — the
 * needle is only ever deflected, never reversed. What this distance marks is
 * where `B = H`; it is the cube root of the graph's gradient.
 */
export function halfFieldDistanceM(magnet: DipoleMagnet, earthH = EARTH_HORIZONTAL_T): number {
  return Math.cbrt(gradientFor(magnet, earthH));
}

/**
 * A student reading the printed centimetre scale can do about ±0.5 mm; the
 * needle against a graduated card, about ±0.5°. Both are *random* errors, so
 * they show up as the scatter that makes the graph worth drawing.
 */
export const DISTANCE_READING_SIGMA_M = 0.0005;
export const DEFLECTION_READING_SIGMA_DEG = 0.5;

/**
 * Error in `1/d³` produced by an error `δd` in the distance:
 * `d(1/d³)/dd = −3/d⁴`.
 */
export function inverseCubeError(distanceM: number, deltaM: number): number {
  return (3 * deltaM) / distanceM ** 4;
}

/** Error in `tan θ` produced by an angular error `δθ`, from `d(tan θ)/dθ = sec²θ`. */
export function tanError(deflectionRadians: number, deltaRadians: number): number {
  const cosine = Math.cos(deflectionRadians);
  return Math.abs(deltaRadians) / (cosine * cosine);
}
