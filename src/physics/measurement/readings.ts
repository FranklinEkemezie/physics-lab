/**
 * Reading errors on graduated instruments.
 *
 * Experienced readers can judge about ±0.25 of the smallest division; beginners
 * are closer to ±1 division. There is also a constant "eye" floor for blur and
 * squint. These are the numbers that turn a perfect simulation into a graph
 * with a little scatter around it — which is the one that teaches anything.
 */

/**
 * Human reading error on a graduated scale, in the scale's own units (metres
 * for a rule).
 */
export function readingUncertaintyM(divisionM: number, skill = 0.6): number {
  return divisionM * skill + 0.00015;
}

/** Description of how a value was obtained, for the data table's notes. */
export interface MeasurementNote {
  value: number;
  /** Instrument resolution, in the value's units. */
  resolution: number;
  /** Total estimated uncertainty (a standard uncertainty, not the full range). */
  uncertainty: number;
  /** Human-readable caveats, e.g. "parallax 8 mm right". */
  caveats: string[];
}

/**
 * Combine independent errors in quadrature — the honest way to add them.
 * (Adding the raw values would overstate the total.)
 */
export function combineUncertainties(...uncertainties: number[]): number {
  let sumSquares = 0;
  for (const u of uncertainties) sumSquares += u * u;
  return Math.sqrt(sumSquares);
}
