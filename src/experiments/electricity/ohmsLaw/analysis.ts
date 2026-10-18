/**
 * Analysis for the e.m.f./internal-resistance practical.
 *
 * Pure arithmetic over the recorded rows: fit `V` against `I`, take the
 * intercept as the e.m.f. and the (negated) gradient as the internal
 * resistance — the two quantities the practical asks for.
 */

import { formatWithUncertainty } from '@/core/format';
import { linearFit } from '@/core/math';
import { emfFromIntercept, internalResistanceFromGradient } from '@/physics/electromagnetism';
import type { AnalysisResult, TrialRow } from '../../types';

export function analyseOhmsLaw(rows: readonly TrialRow[]): AnalysisResult {
  if (rows.length < 3) {
    const missing = 3 - rows.length;
    return {
      headline: `Record ${missing} more set${missing === 1 ? '' : 's'} of readings`,
      lines: ['Three points are the minimum for a straight-line graph.'],
      tips: ['Close the switch, choose a rheostat setting, then record V and I.'],
    };
  }

  const currents = rows.map((row) => row.values.currentA);
  const voltages = rows.map((row) => row.values.voltageV);
  const fit = linearFit(currents, voltages);

  if (!fit) {
    return {
      headline: 'No straight-line fit yet.',
      lines: [],
      tips: ['You need at least two different rheostat settings with a current flowing.'],
    };
  }

  const emfV = emfFromIntercept(fit.intercept);
  const internalOhm = internalResistanceFromGradient(fit.slope);

  const lines = [
    `Gradient of V against I: ${formatWithUncertainty(fit.slope, fit.slopeStdError, 'V/A')}, so r = −gradient = ${formatWithUncertainty(internalOhm, fit.slopeStdError, 'Ω')}`,
    `Intercept on the V axis: ${formatWithUncertainty(emfV, fit.interceptStdError, 'V')} = the e.m.f. E`,
    `r² = ${fit.r2.toFixed(4)} over ${fit.n} points`,
  ];

  const tips: string[] = [];
  if (fit.slope >= 0) {
    tips.push('Your line does not fall as the current rises — check the ammeter and voltmeter are the right way round and the switch is closed.');
  } else if (fit.r2 < 0.96) {
    tips.push('The points are scattered: change the rheostat in even steps and read both meters at the same instant.');
  }
  if (internalOhm > 5) {
    tips.push('That internal resistance is very large. Is the rheostat joined in series with the cell, or has a lead come adrift?');
  }

  return {
    headline: `E = ${formatWithUncertainty(emfV, fit.interceptStdError, 'V')}`,
    lines,
    fit,
    tips: tips.length > 0 ? tips : undefined,
  };
}
