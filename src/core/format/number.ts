/**
 * Turning numbers into the strings a student actually reads.
 *
 * Formatting is presentation, not physics, so it lives here and can be reused
 * by any panel, table or article.
 */

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
 * Format a value ± uncertainty with an appropriate number of digits.
 *
 * The uncertainty is quoted to one significant figure and the value is
 * rounded to match — the convention every mark scheme expects.
 */
export function formatWithUncertainty(value: number, uncertainty: number, unit = ''): string {
  if (!Number.isFinite(value)) return '—';
  if (!Number.isFinite(uncertainty) || uncertainty === 0) {
    return `${value.toPrecision(3)}${unit ? ` ${unit}` : ''}`;
  }
  const digits = Math.max(0, -Math.floor(Math.log10(Math.abs(uncertainty))));
  const factor = 10 ** digits;
  const roundedUncertainty = Math.round(uncertainty * factor) / factor;
  const roundedValue = Math.round(value * factor) / factor;
  const suffix = unit ? ` ${unit}` : '';
  return `${roundedValue.toFixed(digits)} ± ${roundedUncertainty.toFixed(digits)}${suffix}`;
}

/** Format a stopwatch display, e.g. `12.34`. */
export function formatSeconds(seconds: number, decimals = 2): string {
  return seconds.toFixed(decimals);
}
