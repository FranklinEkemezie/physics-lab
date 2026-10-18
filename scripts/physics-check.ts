/**
 * Physics self-checks for the pendulum practical.
 *
 * This is a *development* harness, not part of the shipped app: it imports the
 * pure simulation modules (no Three.js, no DOM) and asserts that they behave
 * the way a marker would expect. Run it with `npm run verify`.
 *
 * The checks deliberately compare the *integrated* motion against the textbook
 * formulas, so a regression in the ODE, the constants or the statistics shows
 * up immediately.
 */

import {
  correctedPeriod,
  gravityFromSlope,
  idealPeriod,
  integratePendulum,
  parametersForLocation,
} from '@/physics/pendulum';
import type { PendulumParameters } from '@/physics/pendulum';
import { linearFit } from '@/core/math';
import { StopwatchInstrument } from '@/physics/Stopwatch';
import { createMysteryLocation, EARTH, REACTION_MEAN_S } from '@/physics/constants';
import {
  EARTH_HORIZONTAL_T,
  MU0_OVER_4PI,
  dipoleFieldAt,
  fieldMagnitude,
  gradientFor,
  halfFieldDistanceM,
  momentFromGradient,
  momentVector,
  theoreticalDeflectionRad,
  totalFieldAt,
  traceFieldLine,
  uniformField,
} from '@/physics/magnetism';
import type { DipoleMagnet } from '@/physics/magnetism';
import { Rng } from '@/core/math';

export interface CheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

/** Integrate until `theta` crosses zero from positive to negative `cycles` times. */
function measurePeriod(parameters: PendulumParameters, amplitudeRad: number, cycles = 20): number {
  const step = 1 / 960;
  let state = { theta: amplitudeRad, omega: 0 };
  let previousTheta = state.theta;
  let crossings = 0;
  let lastCrossingTime = 0;
  let time = 0;

  for (let i = 0; i < 2_000_000; i += 1) {
    state = integratePendulum(state, parameters, step);
    time += step;
    if (previousTheta > 0 && state.theta <= 0) {
      crossings += 1;
      if (crossings === 1) lastCrossingTime = time;
      else if (crossings === cycles) break;
    }
    previousTheta = state.theta;
  }
  // Positive-to-negative crossings happen once per full period, so the time
  // between the first and last spans `cycles − 1` periods.
  return (time - lastCrossingTime) / (cycles - 1);
}

/** A pendulum with no drag and no pivot damping, for a clean comparison. */
function idealParameters(lengthM: number, g: number): PendulumParameters {
  return { lengthM, bobRadiusM: 0, bobMassKg: 0.07, g, airDensity: 0, pivotDamping: 0 };
}

export function runChecks(): CheckResult[] {
  const results: CheckResult[] = [];
  const add = (name: string, pass: boolean, detail: string): void => {
    results.push({ name, pass, detail });
  };

  // 1. Small-amplitude period must match 2π√(L/g).
  {
    const length = 0.4;
    const measured = measurePeriod(idealParameters(length, EARTH.g), 0.002);
    const expected = idealPeriod(length, EARTH.g);
    const relativeError = Math.abs(measured - expected) / expected;
    add(
      'small-amplitude period matches 2π√(L/g)',
      relativeError < 0.002,
      `measured ${measured.toFixed(5)} s vs ideal ${expected.toFixed(5)} s (${(relativeError * 100).toFixed(3)} %)`,
    );
  }

  // 2. Finite amplitude must *lengthen* the period, matching the theory.
  {
    const length = 0.4;
    const amplitude = (20 * Math.PI) / 180;
    const measured = measurePeriod(idealParameters(length, EARTH.g), amplitude);
    const expected = correctedPeriod(length, EARTH.g, amplitude, 0);
    const relativeError = Math.abs(measured - expected) / expected;
    const longerThanIdeal = measured > idealPeriod(length, EARTH.g);
    add(
      'finite amplitude lengthens the period (≈ θ₀²/16)',
      relativeError < 0.004 && longerThanIdeal,
      `measured ${measured.toFixed(5)} s vs theory ${expected.toFixed(5)} s (${(relativeError * 100).toFixed(3)} %)`,
    );
  }

  // 3. g = 4π² / gradient must round-trip.
  {
    const g = EARTH.g;
    const slope = (4 * Math.PI * Math.PI) / g;
    const recovered = gravityFromSlope(slope);
    add(
      'g = 4π² / gradient round-trips',
      Math.abs(recovered - g) < 1e-9,
      `slope ${slope.toFixed(6)} s²/m → g ${recovered.toFixed(6)} m/s²`,
    );
  }

  // 4. A least-squares fit of realistic data must recover g.
  {
    const g = EARTH.g;
    const rng = new Rng(1234);
    const lengths = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55];
    const xs: number[] = [];
    const ys: number[] = [];
    for (const length of lengths) {
      const period = correctedPeriod(length, g, (10 * Math.PI) / 180, 0.0125);
      // 0.4 % of timing noise, like a real student's stopwatch readings.
      xs.push(length);
      ys.push(period * period * (1 + rng.normalClipped(0, 0.004, 2.5)));
    }
    const fit = linearFit(xs, ys);
    const recovered = fit ? gravityFromSlope(fit.slope) : Number.NaN;
    const relativeError = Math.abs(recovered - g) / g;
    add(
      'least-squares T²–L fit recovers g within 1 %',
      fit !== null && relativeError < 0.01,
      fit
        ? `g = ${recovered.toFixed(3)} m/s² (${(relativeError * 100).toFixed(3)} %), r² = ${fit.r2.toFixed(5)}`
        : 'no fit produced',
    );
  }

  // 5. The stopwatch's human error must average out and stay near 200 ms.
  {
    const operator = new StopwatchInstrument({ resolutionS: 0.01, seed: 99 });
    const trials = 400;
    let sumError = 0;
    let sumSquares = 0;
    let maxAbsError = 0;
    for (let i = 0; i < trials; i += 1) {
      operator.pressStart(0);
      for (let t = 0; t <= 5; t += 0.01) operator.tick(t);
      operator.pressStop(5);
      const error = operator.elapsed - 5;
      sumError += error;
      sumSquares += error * error;
      maxAbsError = Math.max(maxAbsError, Math.abs(error));
    }
    const meanError = sumError / trials;
    const stdError = Math.sqrt(sumSquares / trials - meanError * meanError);
    add(
      'stopwatch error averages out over many trials',
      Math.abs(meanError) < 0.03 && stdError > 0.02 && stdError < 0.15,
      `mean ${(meanError * 1000).toFixed(1)} ms, σ ${(stdError * 1000).toFixed(1)} ms, max |err| ${(maxAbsError * 1000).toFixed(0)} ms`,
    );
    add(
      'stopwatch display is quantised to its resolution',
      Math.abs(operator.elapsed / 0.01 - Math.round(operator.elapsed / 0.01)) < 1e-6,
      `elapsed = ${operator.elapsed} s (resolution 0.01 s)`,
    );
  }

  // 6. The mystery planet must be hidden and physically plausible.
  {
    const mystery = createMysteryLocation(new Rng(2026));
    add(
      'Planet X hides a plausible, non-round g',
      mystery.hidden === true && mystery.g >= 1.4 && mystery.g <= 16 && Math.round(mystery.g) !== mystery.g,
      `g = ${mystery.g} m/s², air density ${mystery.airDensity} kg/m³`,
    );
  }

  // 7. The running display must never go negative (the start reaction delay
  //    must not count *against* the student while the watch is still running).
  {
    const watch = new StopwatchInstrument({ resolutionS: 0.01, seed: 3 });
    watch.pressStart(10);
    watch.tick(10.05);
    const justAfterStart = watch.elapsed;
    watch.tick(13.4);
    const partway = watch.elapsed;
    watch.pressStop(13.4);
    const final = watch.elapsed;
    add(
      'running display never shows a negative time',
      justAfterStart >= 0 && partway > 0 && final >= 0,
      `just after start ${justAfterStart.toFixed(2)} s, partway ${partway.toFixed(2)} s, final ${final.toFixed(2)} s`,
    );
  }

  // 8. The reaction-time constant the error model advertises must be sane.
  add(
    'reaction-time constant is around 200 ms',
    REACTION_MEAN_S > 0.15 && REACTION_MEAN_S < 0.3,
    `REACTION_MEAN_S = ${REACTION_MEAN_S} s`,
  );

  // -------------------------------------------------------------------------
  // Bar-magnet field practical
  // -------------------------------------------------------------------------

  // The magnet used throughout the checks: moment across the bench (+z), the
  // same arrangement the practical uses.
  const magnet: DipoleMagnet = { x: 0, z: 0, momentAm2: 1.2, momentAngleRad: Math.PI / 2 };
  const earth = uniformField(0, EARTH_HORIZONTAL_T);

  // 9. On the equatorial line the dipole field is μ₀m/4πr³ and points opposite
  //    the moment (perpendicular to it, as the theory requires).
  {
    const distance = 0.25;
    const field = dipoleFieldAt(distance, 0, magnet);
    const expected = (MU0_OVER_4PI * magnet.momentAm2) / distance ** 3;
    const measured = fieldMagnitude(field);
    const moment = momentVector(magnet);
    const dot = field.x * moment.x + field.z * moment.z;
    add(
      'equatorial dipole field is μ₀m/4πd³ and perpendicular to the moment',
      Math.abs(measured - expected) / expected < 1e-9 && dot < 0,
      `|B| = ${measured.toExponential(4)} T vs ${expected.toExponential(4)} T, m·B = ${dot.toExponential(2)}`,
    );
  }

  // 10. The needle deflection on the equatorial line must obey tan θ = G/d³.
  {
    let worst = 0;
    for (const distance of [0.12, 0.18, 0.25, 0.32, 0.4, 0.45]) {
      const field = totalFieldAt(distance, 0, magnet, earth);
      const measured = Math.abs(Math.tan(Math.atan2(field.z, field.x)));
      const predicted = gradientFor(magnet) / distance ** 3;
      worst = Math.max(worst, Math.abs(measured - predicted));
    }
    add(
      'tan θ follows the inverse-cube law on the equatorial line',
      worst < 1e-9,
      `worst deviation over 12–45 cm: ${worst.toExponential(2)}`,
    );
  }

  // 11. A realistic student's graph must recover the magnet's moment.
  {
    const rng = new Rng(2026);
    const distances = [0.12, 0.15, 0.18, 0.22, 0.26, 0.31, 0.37, 0.44];
    const xs: number[] = [];
    const ys: number[] = [];
    for (const trueDistance of distances) {
      // The student reads the scale to ±0.5 mm and the needle to ±1° (half a
      // graduation, each way).
      const dRead = trueDistance + rng.normalClipped(0, 0.0005, 2.5);
      const thetaTrue = theoreticalDeflectionRad(trueDistance, magnet);
      const thetaRead = (thetaTrue + (rng.normalClipped(0, Math.PI / 180, 2.5))) * (180 / Math.PI);
      const thetaRad = thetaRead * (Math.PI / 180);
      xs.push(1 / dRead ** 3);
      ys.push(Math.tan(thetaRad));
    }
    const fit = linearFit(xs, ys);
    const recovered = fit ? momentFromGradient(fit.slope) : Number.NaN;
    const error = Math.abs(recovered - magnet.momentAm2) / magnet.momentAm2;
    add(
      "a student's tan θ–1/d³ graph recovers the moment within 10 %",
      fit !== null && error < 0.1,
      fit
        ? `m = ${recovered.toFixed(3)} A·m² vs true ${magnet.momentAm2} (${(error * 100).toFixed(1)} %), r² = ${fit.r2.toFixed(4)}`
        : 'no fit produced',
    );
  }

  // 12. Where the magnet's field equals the Earth's the needle sits at 45°.
  {
    const half = halfFieldDistanceM(magnet);
    let worst = 0;
    for (const sign of [-1, 1] as const) {
      const field = totalFieldAt(sign * half, 0, magnet, earth);
      const deflectionDeg = Math.abs(Math.atan2(field.z, field.x)) * (180 / Math.PI);
      worst = Math.max(worst, Math.abs(deflectionDeg - 45));
    }
    add(
      'the needle reaches 45° where the magnet’s field equals the Earth’s',
      worst < 0.02,
      `deflection ${(45 + worst).toFixed(3)}° at d = ${(half * 100).toFixed(2)} cm`,
    );
  }

  // 13. The streamline tracer must advance evenly and stay inside its box.
  {
    const bounds = { minX: -0.5, maxX: 0.5, minZ: -0.2, maxZ: 0.2 };
    const points = traceFieldLine((x, z) => totalFieldAt(x, z, magnet, earth), { x: 0.06, z: 0.02 }, {
      stepM: 0.005,
      bounds,
      stop: (x, z) => Math.hypot(x, z) < 0.03,
    });
    let inside = true;
    let maxStep = 0;
    for (let i = 0; i < points.length; i += 1) {
      const point = points[i];
      if (point.x < bounds.minX || point.x > bounds.maxX || point.z < bounds.minZ || point.z > bounds.maxZ) {
        inside = false;
      }
      if (i > 0) {
        const previous = points[i - 1];
        maxStep = Math.max(maxStep, Math.hypot(point.x - previous.x, point.z - previous.z));
      }
    }
    add(
      'the field-line tracer stays inside the paper and steps evenly',
      points.length > 10 && inside && maxStep < 0.0051,
      `${points.length} points, largest step ${(maxStep * 1000).toFixed(2)} mm`,
    );
  }

  return results;
}
