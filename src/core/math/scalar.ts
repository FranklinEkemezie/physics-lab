/**
 * Scalar helpers — arithmetic only.
 *
 * Deliberately knows nothing about physics, the DOM or Three.js, so the same
 * functions can be reused by a physics model, a graphing routine, a chemistry
 * simulation or an article demo.
 */

/** Clamp `value` into the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Round to `decimals` decimal places (returns a number, not a string). */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Round to the nearest multiple of `step` (e.g. snap to the 0.5 cm ticks). */
export function snap(value: number, step: number): number {
  return step <= 0 ? value : Math.round(value / step) * step;
}

/** Convert radians to degrees. */
export const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/** Convert degrees to radians. */
export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
