/**
 * Analysis for the bar-magnet field practical.
 *
 * Pure arithmetic over the recorded rows: fit `tan θ` against `1/d³` and read
 * the magnet's moment `m` back off the gradient. Everything a marker would
 * write in the margin — the collinearity, the intercept, the effect of the
 * near readings where the bar is not yet a point dipole — is assembled here so
 * the experiment class stays a thin orchestrator.
 *
 * The module is deliberately free of Three.js and of the rig: the two limits
 * that depend on the apparatus (how close the dipole picture holds) are passed
 * in by the caller rather than imported, so nothing here drags the renderer in.
 */

import { linearFit } from '@/core/math';
import {
  DEFLECTION_READING_SIGMA_DEG,
  DISTANCE_READING_SIGMA_M,
  halfFieldDistanceM,
  inverseCubeError,
  momentFromGradient,
  tanError,
} from '@/physics/electromagnetism';
import type { AnalysisResult, TrialRow } from '../types';

/** Degrees per radian, kept local so this module stays free of Three.js. */
const DEG_TO_RAD = Math.PI / 180;

/**
 * Fit the recorded `tan θ`–`1/d³` points and report the magnetic moment.
 *
 * @param rows The recorded trials, in recording order.
 * @param earthH Earth's horizontal field at the bench, in tesla.
 * @param minDistanceM The closest separation at which the bar may still be
 *   treated as a point dipole; readings inside it are flagged, not discarded.
 */
export function analyseMagnet(
  rows: readonly TrialRow[],
  earthH: number,
  minDistanceM: number,
): AnalysisResult {
  const lines: string[] = [];
  const tips: string[] = [];

  if (rows.length < 2) {
    return {
      headline: 'Record at least two readings to draw a graph.',
      lines: ['Put the compass on the equatorial line, read d from the scale and θ from the needle, then press Record.'],
      tips: ['Aim for six or more distances spread between about 12 cm and 45 cm.'],
    };
  }

  const xs = rows.map((row) => row.values.invD3);
  const ys = rows.map((row) => row.values.tanTheta);
  const fit = linearFit(xs, ys);
  if (!fit) {
    return { headline: 'Not enough distinct distances to fit a line.', lines };
  }

  const gradient = fit.slope;
  const moment = momentFromGradient(gradient, earthH);
  const momentUncertainty =
    gradient !== 0 && Number.isFinite(fit.slopeStdError)
      ? Math.abs((moment * fit.slopeStdError) / gradient)
      : Number.NaN;

  const headline = `m ≈ ${moment.toFixed(2)} A·m²   (tan θ ∝ 1/d³, r² = ${fit.r2.toFixed(4)})`;

  lines.push(
    `Gradient of the tan θ–(1/d³) graph = ${gradient.toExponential(3)} m³   (± ${fit.slopeStdError.toExponential(2)})`,
  );
  lines.push(`Intercept = ${fit.intercept.toExponential(2)}   (ideal value: 0)`);
  lines.push(
    `m = 4πH·gradient/μ₀ = ${moment.toFixed(3)}` +
      (Number.isFinite(momentUncertainty) ? ` ± ${Math.max(0.005, momentUncertainty).toFixed(3)}` : '') +
      ' A·m²',
  );
  lines.push(
    `The needle sits at 45° (magnet's field = Earth's) at ${(Math.cbrt(gradient) * 100).toFixed(1)} cm from the centre.`,
  );
  lines.push(`Correlation coefficient r² = ${fit.r2.toFixed(5)}   (points: ${fit.n})`);
  lines.push(`Earth's horizontal field used: H = ${(earthH * 1e6).toFixed(0)} µT.`);

  // --- Quality checks ----------------------------------------------------
  if (fit.r2 < 0.995) {
    tips.push(
      `Your points are not very collinear (r² = ${fit.r2.toFixed(4)}). The commonest cause is the compass not being ` +
        'exactly on the equatorial line, followed by measuring d from the end of the magnet instead of its centre.',
    );
  }

  const maxY = Math.max(...ys.map((value) => Math.abs(value)), 1e-6);
  if (Math.abs(fit.intercept) > 0.05 * maxY) {
    tips.push(
      `The intercept is ${fit.intercept.toExponential(2)}, well away from zero. A straight line that misses the origin ` +
        'usually means the compass was offset from the line, or that the needle has a zero error.',
    );
  }

  const tooClose = rows.filter((row) => row.values.d < minDistanceM);
  if (tooClose.length > 0) {
    tips.push(
      `${tooClose.length} of ${rows.length} readings used d < ${(minDistanceM * 100).toFixed(0)} cm, where the ` +
        'bar is too short to behave like a point dipole — those points bend the line downwards.',
    );
  }

  const tooFar = rows.filter((row) => row.values.tanTheta < Math.tan(6 * DEG_TO_RAD));
  if (tooFar.length > 0) {
    tips.push(
      `${tooFar.length} reading(s) had θ below 6°. Far from the magnet the ±1° you can read on the card is a very large ` +
        'fraction of θ, so the outermost points scatter most: weight the nearer, well-deflected readings more heavily.',
    );
  }

  if (rows.length < 5) {
    tips.push('Six or seven well-spread distances make a far more convincing graph than three.');
  }

  tips.push('Press Reveal in the analysis panel to check your moment against the one this magnet actually has.');

  return { headline, lines, fit, tips };
}

/**
 * Error bars from the two reading errors: ±0.5 mm on the scale position and
 * ±0.5° on the needle. The error on `1/d³` is `3δd/d⁴`; on `tan θ` it is
 * `δθ·sec²θ`. Both blow up where the physics is weakest, which is the point.
 */
export function magnetGraphDecorations(rows: readonly TrialRow[]): {
  yErrors?: number[];
  xErrors?: number[];
} {
  const deltaTheta = DEG_TO_RAD * DEFLECTION_READING_SIGMA_DEG;
  return {
    xErrors: rows.map((row) => inverseCubeError(row.values.d, DISTANCE_READING_SIGMA_M)),
    yErrors: rows.map((row) => tanError(row.values.theta * DEG_TO_RAD, deltaTheta)),
  };
}

/**
 * Reveal the moment of this particular bar magnet.
 *
 * `halfFieldDistanceM` only looks at the moment, so a bare dipole is enough to
 * stand in for the real apparatus here — the paper position and the magnet's
 * orientation play no part in where the needle reaches 45°.
 */
export function revealMagnet(momentAm2: number, earthH: number): string {
  const halfCm = halfFieldDistanceM({ x: 0, z: 0, momentAm2, momentAngleRad: 0 }, earthH) * 100;
  return (
    `This bar magnet's moment is m = ${momentAm2.toFixed(3)} A·m². ` +
    `Against the Earth's horizontal field of ${(earthH * 1e6).toFixed(0)} µT the needle reaches 45° ` +
    `at ${halfCm.toFixed(1)} cm from the centre.`
  );
}
