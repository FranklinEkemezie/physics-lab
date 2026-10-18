/**
 * Analysis for the refraction practical.
 *
 * Pure arithmetic over the recorded rows: fit `sin i` against `sin r`. Snell's
 * law makes that a straight line through the origin whose gradient *is* the
 * refractive index of the block.
 */

import { formatWithUncertainty } from '@/core/format';
import { linearFit } from '@/core/math';
import { criticalAngleRad, refractiveIndexFromGradient } from '@/physics/optics';
import type { AnalysisResult, TrialRow } from '../../types';

export function analyseRefraction(rows: readonly TrialRow[]): AnalysisResult {
  if (rows.length < 3) {
    const missing = 3 - rows.length;
    return {
      headline: `Record ${missing} more reading${missing === 1 ? '' : 's'}`,
      lines: ['Three points are the minimum for a straight-line graph.'],
      tips: ['Set an angle of incidence, then press “Record angles”.'],
    };
  }

  const sinRs = rows.map((row) => row.values.sinR);
  const sinIs = rows.map((row) => row.values.sinI);
  const fit = linearFit(sinRs, sinIs);

  if (!fit || fit.slope <= 0) {
    return {
      headline: 'No straight-line fit yet.',
      lines: [],
      tips: ['Check that r grows with i — a ray bent the wrong way means the block or the ray box has been moved.'],
    };
  }

  const index = refractiveIndexFromGradient(fit.slope);
  // The index the student fitted, used only for the critical-angle note below.
  const criticalRad = criticalAngleRad(index);

  const lines = [
    `Gradient of sin i against sin r: ${formatWithUncertainty(fit.slope, fit.slopeStdError, '')}, so n = ${formatWithUncertainty(index, fit.slopeStdError, '')}`,
    `Intercept: ${formatWithUncertainty(fit.intercept, fit.interceptStdError, '')} (should be near zero)`,
    `Critical angle inside the glass: ${Number.isNaN(criticalRad) ? '—' : `${(criticalRad * (180 / Math.PI)).toFixed(1)}°`}`,
    `r² = ${fit.r2.toFixed(4)} over ${fit.n} points`,
  ];

  const tips: string[] = [];
  if (Math.abs(fit.intercept) > 0.03) {
    tips.push('Your line misses the origin. The block may have moved, or the ray was not aimed at the same point each time.');
  }
  if (fit.r2 < 0.995) {
    tips.push('The points are scattered: keep the ray box aimed at the same point on the face and read the angle from the normal, not the face.');
  }

  return {
    headline: `n = ${formatWithUncertainty(index, fit.slopeStdError, '')}`,
    lines,
    fit,
    tips: tips.length > 0 ? tips : undefined,
  };
}
