/**
 * Analysis for the simple-pendulum practical.
 *
 * Pure arithmetic over the recorded rows: fit `T²` against `L` and read `g`
 * back off the gradient. Everything a marker would write in the margin — the
 * finite-amplitude correction, the reaction-time advice, the intercept — is
 * assembled here so the experiment class stays a thin orchestrator.
 */

import { gravityFromSlope } from '@/physics/mechanics/pendulum';
import { REACTION_MEAN_S } from '@/physics/constants';
import type { Location } from '@/physics/constants';
import { linearFit, mean, percentError } from '@/core/math';
import type { AnalysisResult, TrialRow } from '../types';

/** Degrees per radian, kept local so this module stays free of Three.js. */
const DEG_TO_RAD = Math.PI / 180;

/**
 * Fit the recorded `T²`–`L` points and report `g`.
 *
 * @param rows The recorded trials, in recording order.
 * @param location Where the apparatus stands — its accepted `g` is only shown
 *   when the location is not a hidden "mystery planet".
 */
export function analysePendulum(rows: readonly TrialRow[], location: Location): AnalysisResult {
  const lines: string[] = [];
  const tips: string[] = [];

  if (rows.length < 2) {
    return {
      headline: 'Record at least two trials to plot a graph.',
      lines: ['Use the reading lens for L, then time the swings and press Record.'],
      tips: ['You need at least six lengths spread between about 20 cm and 55 cm.'],
    };
  }

  const xs = rows.map((row) => row.values.L);
  const ys = rows.map((row) => row.values.T2);
  const fit = linearFit(xs, ys);

  if (!fit) {
    return { headline: 'Not enough distinct lengths to fit a line.', lines };
  }

  const gradient = fit.slope;
  const g = gravityFromSlope(gradient);
  const gradientUncertainty = fit.slopeStdError;
  const gUncertainty = Number.isFinite(gradientUncertainty) ? g * Math.abs(gradientUncertainty / gradient) : Number.NaN;

  // Per-row values for comparison and for spotting outliers.
  const perRowG = rows.map((row) => (4 * Math.PI * Math.PI * row.values.L) / (row.values.T * row.values.T));
  const meanG = mean(perRowG.filter((value) => Number.isFinite(value) && value > 0));

  const headline = Number.isFinite(g)
    ? `g = ${g.toFixed(2)} ± ${Math.max(0.01, gUncertainty || 0.05).toFixed(2)} m/s²`
    : 'Could not compute g.';

  lines.push(
    `Gradient of the T²–L graph = ${gradient.toFixed(4)} s²/m   (uncertainty ±${(gradientUncertainty || 0).toFixed(4)})`,
  );
  lines.push(`Intercept = ${fit.intercept.toFixed(4)} s²   (ideal value: 0)`);
  lines.push(`g = 4π² / gradient = ${g.toFixed(2)} m/s²`);
  lines.push(`Mean of the individual 4π²L/T² values = ${meanG.toFixed(2)} m/s²`);
  lines.push(`Correlation coefficient r² = ${fit.r2.toFixed(5)}   (points: ${fit.n})`);

  // --- Quality checks ----------------------------------------------------
  if (!location.hidden) {
    const error = percentError(g, location.g);
    lines.push(
      `Accepted value here (${location.name}): ${location.g.toFixed(2)} m/s²` +
        ` → your result is ${error >= 0 ? '+' : ''}${error.toFixed(1)} % out.`,
    );
    if (Math.abs(error) < 1) tips.push('Excellent — within 1 % of the accepted value.');
    else if (Math.abs(error) < 3) tips.push('Good agreement — a real exam script would score this well.');
    else tips.push('More than 3 % out: check your timing and the amplitude of the swing.');
  } else {
    lines.push('This is Planet X: record carefully, then press "Reveal" in the analysis panel to check.');
  }

  if (fit.r2 < 0.995) {
    tips.push(`Your points are not very collinear (r² = ${fit.r2.toFixed(4)}). Something is inconsistent between trials.`);
  }

  const interceptMm = fit.intercept * 1000;
  if (Math.abs(interceptMm) > 12) {
    tips.push(
      `The intercept is ${interceptMm.toFixed(0)} mm away from zero. A positive value often means L was measured to the ` +
        'bottom of the bob instead of its centre (or that the rule was not parallel to the thread).',
    );
  }

  // Amplitude correction: T ≈ T₀(1 + θ₀²/16), so g is low by ~2×θ₀²/16.
  const amplitudes = rows
    .map((row) => row.note?.match(/amplitude (-?\d+)/)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);
  if (amplitudes.length > 0) {
    const meanAmplitudeDeg = mean(amplitudes);
    const meanAmplitudeRad = meanAmplitudeDeg * DEG_TO_RAD;
    const correction = 2 * (meanAmplitudeRad ** 2 / 16);
    if (meanAmplitudeDeg > 8) {
      tips.push(
        `Average release amplitude was ${meanAmplitudeDeg.toFixed(0)}°. The exact pendulum has T = T₀(1 + θ₀²/16), so your g is ` +
          `about ${(correction * 100).toFixed(1)} % low. Correcting for it would give ${(g * (1 + correction)).toFixed(2)} m/s².`,
      );
    }
  }

  // Timing advice.
  const meansN = mean(rows.map((row) => row.values.n));
  if (meansN < 10) {
    tips.push(
      `You timed ${meansN.toFixed(0)} swings on average. With ~0.2 s of reaction error, timing 20 swings would halve the ` +
        'scatter in T.',
    );
  }

  const flagged = rows.filter((row) => (row.warnings?.length ?? 0) > 0);
  if (flagged.length > 0) {
    tips.push(`${flagged.length} of ${rows.length} rows carried warnings — hover the ⚠ in the table to see why.`);
  }

  // Residuals, as a teaching aid.
  const worst = rows
    .map((row) => ({ row, residual: row.values.T2 - (gradient * row.values.L + fit.intercept) }))
    .sort((a, b) => Math.abs(b.residual) - Math.abs(a.residual))[0];
  if (worst) {
    lines.push(
      `Largest residual: trial ${worst.row.index} (${(worst.residual * 1000).toFixed(2)} × 10⁻³ s²) — a good candidate for a repeat.`,
    );
  }

  return { headline, lines, fit, tips };
}

/**
 * The vertical error bar on each `T²` point.
 *
 * The dominant random error is the operator's reaction time at each press, so
 * σ_t = √2 · σ_reaction and σ_T = σ_t / n, which propagates to
 * `Δ(T²) = 2·T·σ_T`. The location plays no part, so this stays pure.
 */
export function pendulumGraphDecorations(rows: readonly TrialRow[]): { yErrors: number[] } {
  const sigmaT = (Math.SQRT2 * REACTION_MEAN_S) / 1;
  const yErrors = rows.map((row) => {
    const T = row.values.T;
    const n = Math.max(1, row.values.n);
    return 2 * T * (sigmaT / n);
  });
  return { yErrors };
}
