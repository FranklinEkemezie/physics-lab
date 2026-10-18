/**
 * The simple pendulum: what the textbook predicts.
 *
 * These are the formulas a student is expected to compare their measurements
 * against — the ideal period, its first corrections, and the gradient that
 * hands back `g`. Kept apart from {@link ./motion} so "simulate the swing" and
 * "predict the answer" never get tangled.
 */

/** Ideal point-mass, infinitesimal-amplitude period `T = 2π√(L/g)`. */
export function idealPeriod(lengthM: number, g: number): number {
  return 2 * Math.PI * Math.sqrt(lengthM / g);
}

/**
 * Period including the two corrections a *good* student could spot:
 *  1. finite amplitude: `T ≈ T₀(1 + θ₀²/16 + 11θ₀⁴/3072)`
 *  2. finite bob size: `T = T₀·√(1 + (2/5)(r/L)²)`
 */
export function correctedPeriod(
  lengthM: number,
  g: number,
  amplitudeRad: number,
  bobRadiusM = 0,
): number {
  const t0 = idealPeriod(lengthM, g);
  const amplitudeFactor = 1 + amplitudeRad ** 2 / 16 + (11 * amplitudeRad ** 4) / 3072;
  const inertiaFactor = Math.sqrt(1 + (2 / 5) * (bobRadiusM / lengthM) ** 2);
  return t0 * amplitudeFactor * inertiaFactor;
}

/**
 * The headline result of the practical: the gradient of a `T²` against `L`
 * graph is `4π²/g`, so
 *
 * ```text
 *   g = 4π² / gradient
 * ```
 *
 * @param slopeSI Gradient of T² (s²) versus L (m).
 */
export function gravityFromSlope(slopeSI: number): number {
  if (!Number.isFinite(slopeSI) || slopeSI === 0) return Number.NaN;
  return (4 * Math.PI * Math.PI) / slopeSI;
}

/**
 * Uncertainty in g propagated from the uncertainty in the gradient:
 * `Δg/g = Δm/m`.
 */
export function gravityFromSlopeWithUncertainty(
  slopeSI: number,
  slopeUncertaintySI: number,
): { g: number; uncertainty: number } {
  const g = gravityFromSlope(slopeSI);
  const relative = Math.abs(slopeUncertaintySI / slopeSI);
  return { g, uncertainty: g * relative };
}
