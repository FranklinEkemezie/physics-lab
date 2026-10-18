/**
 * Statistics for experimental data: means, standard deviations and a
 * least-squares line *with uncertainties*.
 *
 * WAEC practicals are marked on how well you handle error, so the fit here
 * returns the standard error of the gradient — the number that turns
 * "g = 9.9 m/s²" into "g = 9.9 ± 0.2 m/s²".
 *
 * Nothing here is physics: it is the same maths a chemistry or biology
 * practical would use.
 */

export interface FitResult {
  slope: number;
  intercept: number;
  /** Standard error of the gradient. */
  slopeStdError: number;
  /** Standard error of the intercept. */
  interceptStdError: number;
  /** Coefficient of determination, 0..1. */
  r2: number;
  /** Number of points used. */
  n: number;
  /** Root-mean-square residual, in the units of y. */
  residualRms: number;
}

/** Arithmetic mean. Returns NaN for an empty list. */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return Number.NaN;
  let sum = 0;
  for (const value of values) sum += value;
  return sum / values.length;
}

/** Sample standard deviation (n − 1 denominator). */
export function stdDev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let sumSquares = 0;
  for (const value of values) sumSquares += (value - m) ** 2;
  return Math.sqrt(sumSquares / (values.length - 1));
}

/** Standard error of the mean. */
export function standardError(values: readonly number[]): number {
  if (values.length < 2) return 0;
  return stdDev(values) / Math.sqrt(values.length);
}

/**
 * Least-squares straight-line fit with full statistics.
 *
 * Uses the closed-form solution
 * `m = Σ(x−x̄)(y−ȳ) / Σ(x−x̄)²`, `c = ȳ − m·x̄`, and propagates the residual
 * variance to give standard errors on both parameters.
 */
export function linearFit(xs: readonly number[], ys: readonly number[]): FitResult | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;

  const meanX = mean(xs.slice(0, n));
  const meanY = mean(ys.slice(0, n));

  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    sxx += dx * dx;
    sxy += dx * dy;
    syy += dy * dy;
  }
  if (sxx === 0) return null;

  const slope = sxy / sxx;
  const intercept = meanY - slope * meanX;

  // Residual variance (0 when there are exactly two points — a line through
  // two points is exact, so we report zero uncertainty).
  let residualSumSquares = 0;
  for (let i = 0; i < n; i += 1) {
    const predicted = slope * xs[i] + intercept;
    residualSumSquares += (ys[i] - predicted) ** 2;
  }
  const dof = n - 2;
  const variance = dof > 0 ? residualSumSquares / dof : 0;

  const slopeStdError = sxx > 0 ? Math.sqrt(variance / sxx) : 0;
  const interceptStdError = dof > 0 ? Math.sqrt(variance * (1 / n + (meanX * meanX) / sxx)) : 0;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);

  return {
    slope,
    intercept,
    slopeStdError,
    interceptStdError,
    r2,
    n,
    residualRms: Math.sqrt(residualSumSquares / n),
  };
}

/** Percentage difference between an experimental and an accepted value. */
export function percentError(experimental: number, accepted: number): number {
  if (accepted === 0) return Number.NaN;
  return ((experimental - accepted) / accepted) * 100;
}
