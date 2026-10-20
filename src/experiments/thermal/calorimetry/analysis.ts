/**
 * Analysis for the bomb-calorimeter practical.
 *
 * Two answers are offered, because the syllabus formula and the graph disagree
 * for a physical reason:
 *
 *  - the **endpoint** value, c = VIt/(mΔθ), uses the whole run and is biased
 *    high by Newton cooling and by the heat the bomb itself absorbs;
 *  - the **initial-gradient** value, c = VI/(m × gradient), uses only the early
 *    straight part of Δθ against t, where cooling is still negligible.
 *
 * Seeing the second one come out nearer the accepted value is the lesson.
 */

import { linearFit } from '@/core/math';
import { fmt, formatWithUncertainty } from '@/core/format';
import type { AnalysisResult, TrialRow } from '../../types';

/** The quantities fixed for the run, read from the apparatus. */
export interface CalorimetryContext {
  voltageV: number;
  currentA: number;
  waterMassKg: number;
  /** Heat capacity of the bomb and jacket, J/K (used to explain a high answer). */
  vesselHeatCapacityJK?: number;
}

/** Accepted value for liquid water at room temperature, J kg⁻¹ K⁻¹. */
const ACCEPTED_C = 4180;
/** How much of the run is treated as the initial straight section, in seconds. */
const INITIAL_WINDOW_S = 90;

interface Point {
  t: number;
  rise: number;
}

export function analyseBombCalorimetry(
  rows: readonly TrialRow[],
  context: CalorimetryContext,
): AnalysisResult {
  const points = pointsFrom(rows);

  if (points.length < 3) {
    const missing = 3 - points.length;
    return {
      headline: `Record ${missing} more reading${missing === 1 ? '' : 's'}`,
      lines: ['You need the initial temperature plus at least two readings while the heater is on.'],
      tips: ['Switch on the heater, then take a reading every 30 s.'],
    };
  }

  const span = points[points.length - 1].t;
  if (span <= 0) {
    return {
      headline: 'No time has passed yet.',
      lines: [],
      tips: ['Let the heater run for a minute or two before recording a second reading.'],
    };
  }

  // The initial straight section: the first 90 s, but never more than 60 % of a
  // short run.
  const windowEnd = Math.max(30, Math.min(INITIAL_WINDOW_S, span * 0.6));
  let window = points.filter((point) => point.t <= windowEnd);
  if (window.length < 3) window = points.slice(0, Math.min(4, points.length));

  const fit = linearFit(
    window.map((point) => point.t),
    window.map((point) => point.rise),
  );

  const last = points[points.length - 1];
  const { voltageV, currentA, waterMassKg } = context;
  const energyJ = voltageV * currentA * last.t;
  const endpointC = last.rise > 0 ? energyJ / (waterMassKg * last.rise) : Number.NaN;

  if (!fit || fit.slope <= 0) {
    return {
      headline: 'The temperature never rose.',
      lines: [
        `Largest rise recorded: ${fmt(Math.max(...points.map((point) => point.rise)), 1)} °C`,
        'Check the heater connection and that the thermometer bulb is in the water.',
      ],
      tips: ['Switch the supply on and watch the coil glow.'],
    };
  }

  const gradient = fit.slope;
  const measuredC = (voltageV * currentA) / (waterMassKg * gradient);
  const measuredError = measuredC * (fit.slopeStdError / fit.slope);

  const lines = [
    `Initial gradient of Δθ against t: ${formatWithUncertainty(
      gradient * 1000,
      fit.slopeStdError * 1000,
      '× 10⁻³ °C/s',
    )} over the first ${fmt(window[window.length - 1].t, 0)} s`,
    `c = VI / (m × gradient) = ${formatWithUncertainty(
      measuredC,
      measuredError,
      'J kg⁻¹ K⁻¹',
    )}`,
    `Energy supplied: ${fmt(energyJ / 1000, 2)} kJ over ${fmt(last.t, 0)} s; rise: ${fmt(last.rise, 1)} °C`,
    `Endpoint method c = VIt / (mΔθ): ${fmt(endpointC, 0)} J kg⁻¹ K⁻¹`,
  ];

  if (Number.isFinite(endpointC)) {
    const excess = ((endpointC - measuredC) / measuredC) * 100;
    if (Math.abs(excess) >= 1) {
      lines.push(
        `The endpoint value is ${fmt(Math.abs(excess), 0)} % ${excess > 0 ? 'higher' : 'lower'} than the gradient value.`,
      );
    }
  }

  const deviation = ((measuredC - ACCEPTED_C) / ACCEPTED_C) * 100;
  lines.push(`Accepted value for water: ${fmt(ACCEPTED_C, 0)} J kg⁻¹ K⁻¹ (your result is ${signed(deviation)} %)`);

  const tips: string[] = [];

  if (fit.r2 < 0.995) {
    tips.push('The early points are not quite a straight line — stir before each reading so the water is uniform.');
  }
  if (Number.isFinite(endpointC) && endpointC > measuredC * 1.03) {
    tips.push(
      'Your endpoint value is higher: heat was escaping throughout the run. The initial gradient is the better estimate.',
    );
  }
  if (rows.length < 6) {
    tips.push('Take readings for the full five minutes — more points make the initial gradient reliable.');
  }
  if (Math.abs(deviation) > 12) {
    tips.push('Check the units: V in volts, I in amperes, m in kilograms and t in seconds.');
  }
  if (context.vesselHeatCapacityJK && context.vesselHeatCapacityJK > 0) {
    tips.push(
      `The bomb itself has a heat capacity of about ${fmt(context.vesselHeatCapacityJK, 0)} J/K, which is why a careful value is a little high.`,
    );
  }

  return {
    headline: `c = ${fmtScientificNative(measuredC)} J kg⁻¹ K⁻¹`,
    lines,
    fit,
    tips: tips.length > 0 ? tips : undefined,
  };
}

/** Rows in time order, with the temperature rise measured from the first one. */
function pointsFrom(rows: readonly TrialRow[]): Point[] {
  const ordered = [...rows].sort((a, b) => a.values.timeS - b.values.timeS);
  const first = ordered[0];
  if (!first) return [];
  const reference = first.values.readingC;
  return ordered.map((row) => ({
    t: Math.max(0, row.values.timeS - first.values.timeS),
    rise: row.values.readingC - reference,
  }));
}

/** "4.38 × 10³", the way a mark scheme quotes a specific heat capacity. */
function fmtScientificNative(value: number): string {
  if (!Number.isFinite(value)) return '-';
  if (value >= 1000) return `${(value / 1000).toFixed(2)} × 10³`;
  return fmt(value, 0);
}

function signed(value: number): string {
  if (!Number.isFinite(value)) return '-';
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(1)}`;
}
