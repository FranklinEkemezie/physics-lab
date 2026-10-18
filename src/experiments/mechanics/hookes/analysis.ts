/**
 * Analysis for the Hooke's-law practical.
 *
 * Pure arithmetic over the recorded rows: fit `x` against `F`, hand back the
 * spring constant `k = 1/gradient`, and flag the readings that were taken past
 * the spring's elastic limit — the points that bend the graph upwards.
 */

import { linearFit } from '@/core/math';
import { fmt, formatWithUncertainty } from '@/core/format';
import { stiffnessFromGradient } from '@/physics/mechanics';
import type { AnalysisResult, TrialRow } from '../../types';

export interface HookesTruth {
  /** The spring's real stiffness, in N/m. */
  stiffnessNm: number;
  /** Total load (hanger included) at which the spring yields, in N. */
  elasticLimitN: number;
  /** Weight of the hanger alone, in N. */
  hangerLoadN: number;
}

/** Loads and extensions from the recorded rows. */
function columns(rows: readonly TrialRow[]): { loads: number[]; extensions: number[] } {
  return {
    loads: rows.map((row) => row.values.loadN),
    extensions: rows.map((row) => row.values.extensionM),
  };
}

export function analyseHookesLaw(rows: readonly TrialRow[], truth: HookesTruth): AnalysisResult {
  if (rows.length < 3) {
    const missing = 3 - rows.length;
    return {
      headline: `Record ${missing} more reading${missing === 1 ? '' : 's'}`,
      lines: ['Three points are the minimum for a straight-line graph.'],
      tips: ['Hang a mass, let the spring settle, then press “Record reading”.'],
    };
  }

  const { loads, extensions } = columns(rows);
  const fit = linearFit(loads, extensions);
  if (!fit || fit.slope <= 0) {
    return {
      headline: 'No straight-line fit yet.',
      lines: [],
      tips: ['Check that the extension grows with the load, and that you recorded the pointer properly.'],
    };
  }

  const stiffness = stiffnessFromGradient(fit.slope);
  const stiffnessError = stiffness * (fit.slopeStdError / fit.slope);

  // Readings taken past the elastic limit bend the graph; a good candidate
  // refits without them, so offer both numbers.
  const yielded = rows.filter((row) => row.values.loadN + truth.hangerLoadN > truth.elasticLimitN);
  const elasticRows = rows.filter((row) => row.values.loadN + truth.hangerLoadN <= truth.elasticLimitN);

  const lines = [
    `Gradient of x against F: ${formatWithUncertainty(fit.slope, fit.slopeStdError, 'm/N')}`,
    `k = 1 / gradient = ${formatWithUncertainty(stiffness, stiffnessError, 'N/m')}`,
    `Intercept: ${fmt(fit.intercept * 1000, 1)} mm (should be near zero)`,
    `r² = ${fit.r2.toFixed(4)}`,
  ];

  const tips: string[] = [];

  if (yielded.length > 0 && elasticRows.length >= 3) {
    const inner = linearFit(
      elasticRows.map((row) => row.values.loadN),
      elasticRows.map((row) => row.values.extensionM),
    );
    if (inner && inner.slope > 0) {
      const k = stiffnessFromGradient(inner.slope);
      lines.push(
        `Elastic points only (${elasticRows.length} of ${rows.length}): k = ${formatWithUncertainty(
          k,
          k * (inner.slopeStdError / inner.slope),
          'N/m',
        )}`,
      );
    }
  }

  if (yielded.length > 0) {
    tips.push(
      `${yielded.length} reading(s) were taken past the elastic limit — the spring yielded, so those points sit too high. Drop them.`,
    );
  } else if (fit.r2 < 0.99) {
    tips.push('The points are quite scattered: sight straight across to the rule and let the spring settle fully.');
  }

  if (Math.abs(fit.intercept) > 0.004) {
    tips.push('Your line misses the origin — re-check the zero reading you took with the hanger alone.');
  }

  return {
    headline: `k = ${formatWithUncertainty(stiffness, stiffnessError, 'N/m')}`,
    lines,
    fit,
    tips: tips.length > 0 ? tips : undefined,
  };
}
