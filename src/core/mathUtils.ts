/**
 * Small numeric helpers shared across the physics engine and the UI.
 *
 * Everything here is deliberately pure and side-effect free so it can be
 * unit tested and reasoned about in isolation.
 */

/** Clamp `value` into the inclusive range [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation: `t = 0` gives `a`, `t = 1` gives `b`. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Frame-rate independent exponential smoothing.
 *
 * Use instead of `lerp(current, target, 0.1)` inside a render loop, where a
 * naive lerp would behave differently at 30fps and 144fps.
 *
 * @param smoothing Fraction of the remaining gap to close per second.
 */
export function damp(current: number, target: number, smoothing: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-smoothing * dt));
}

/** Round to `decimals` decimal places (returns a number, not a string). */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Round to the nearest multiple of `step` (e.g. snap to 0.5 cm ticks). */
export function snap(value: number, step: number): number {
  return step <= 0 ? value : Math.round(value / step) * step;
}

/** Convert radians to degrees. */
export const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/** Convert degrees to radians. */
export const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Format a number with a fixed precision, using a plain ASCII minus sign. */
export function fmt(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(decimals).replace('-', '\u2212');
}

/** Format a number in scientific-ish "mantissa × 10^exp" form (for slopes). */
export function fmtScientific(value: number, decimals = 3): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / 10 ** exponent;
  return `${fmt(mantissa, decimals)} × 10^${exponent}`;
}

/**
 * Linear least-squares fit of `y = m·x + c`.
 * Returns `null` when there are fewer than two distinct x values.
 */
export function linearRegression(
  xs: readonly number[],
  ys: readonly number[],
): { slope: number; intercept: number; r2: number } | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i += 1) {
    sumX += xs[i];
    sumY += ys[i];
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

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
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2 };
}

/** Trigger a client-side file download (used for CSV export of the table). */
export function downloadTextFile(filename: string, contents: string, mime = 'text/plain'): void {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
