/**
 * Physics self-checks for every practical in the lab.
 *
 * This is a *development* harness, not part of the shipped app: it imports the
 * pure simulation modules (no Three.js, no DOM) and asserts that they behave
 * the way a marker would expect. Run it with `npm run verify`.
 *
 * The checks deliberately compare the *integrated* motion against the textbook
 * formulas, so a regression in the ODE, the constants or the statistics shows
 * up immediately. The last group simulates an entire practical — noise, rounded
 * readings and all — and asserts that the graph still recovers the hidden
 * answer within a sensible tolerance.
 */

import {
  correctedPeriod,
  gravityFromSlope,
  idealPeriod,
  integratePendulum,
  parametersForLocation,
} from '@/physics/mechanics/pendulum';
import type { PendulumParameters } from '@/physics/mechanics/pendulum';
import { linearFit } from '@/core/math';
import { StopwatchInstrument } from '@/physics/measurement';
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
  uniformField,
} from '@/physics/electromagnetism';
import type { DipoleMagnet } from '@/physics/electromagnetism';
import { Rng, snap, traceStreamline } from '@/core/math';
import { realExtensionM, stiffnessFromGradient, type Spring } from '@/physics/mechanics';
import {
  emfFromIntercept,
  internalResistanceFromGradient,
  parallelResistanceOhm,
  powerW,
  seriesResistanceOhm,
  solveLoadedCircuit,
  terminalPotentialV,
  type Cell,
} from '@/physics/electromagnetism';
import {
  criticalAngleRad,
  refractionAngle,
  refractiveIndexFromGradient,
  traceBlockRay,
} from '@/physics/optics';
import {
  initialCalorimetryState,
  specificHeatFromEnergy,
  specificHeatFromGradient,
  stepCalorimetry,
  thermometerReadingC,
  type CalorimetryConfig,
  type CalorimetryState,
} from '@/physics/thermal';

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
    const points = traceStreamline((x, z) => totalFieldAt(x, z, magnet, earth), { x: 0.06, z: 0.02 }, {
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

  // -------------------------------------------------------------------------
  // Hooke's law practical
  // -------------------------------------------------------------------------

  // 14. A spring must be linear up to its elastic limit, and yield past it.
  {
    const spring: Spring = { stiffnessNm: 26, naturalLengthM: 0.12, elasticLimitN: 3.6 };
    const x1 = realExtensionM(spring, 1);
    const x2 = realExtensionM(spring, 2);
    const linear = Math.abs(x2 - 2 * x1) < 1e-12;

    const overloadN = spring.elasticLimitN + 1;
    const past = realExtensionM(spring, overloadN);
    const yields = past > overloadN / spring.stiffnessNm + 1e-9;
    add(
      'a spring obeys F = kx up to its elastic limit, then yields',
      linear && yields,
      `x(1 N) = ${(x1 * 1000).toFixed(2)} mm, x(2 N) = ${(x2 * 1000).toFixed(2)} mm, x(${overloadN} N) = ${(past * 1000).toFixed(2)} mm`,
    );
  }

  // 15. A realistic student's extension–load graph must recover k.
  {
    const rng = new Rng(4242);
    const trueStiffness = 27.5;
    const spring: Spring = { stiffnessNm: trueStiffness, naturalLengthM: 0.12, elasticLimitN: 4.5 };
    const loads = [0.2, 0.4, 0.6, 0.8, 1, 1.2];
    const xs: number[] = [];
    const ys: number[] = [];
    for (const load of loads) {
      // Two pointer readings, each good to ±0.5 mm, so the extension carries √2 of it.
      const reading = realExtensionM(spring, load) + rng.normalClipped(0, Math.SQRT2 * 0.0005, 2.5);
      xs.push(load);
      ys.push(Math.max(0, snap(reading, 0.001)));
    }
    const fit = linearFit(xs, ys);
    const recovered = fit ? stiffnessFromGradient(fit.slope) : Number.NaN;
    const error = Math.abs(recovered - trueStiffness) / trueStiffness;
    add(
      "a student's x–F graph recovers k within 5 %",
      fit !== null && error < 0.05,
      fit
        ? `k = ${recovered.toFixed(2)} N/m vs true ${trueStiffness} (${(error * 100).toFixed(1)} %), r² = ${fit.r2.toFixed(4)}`
        : 'no fit produced',
    );
  }

  // -------------------------------------------------------------------------
  // Ohm's law / e.m.f. practical
  // -------------------------------------------------------------------------

  // 16. The loaded circuit must satisfy both V = IR and the cell equation.
  {
    const cell: Cell = { emfV: 2.2, internalResistanceOhm: 2.5 };
    const series = seriesResistanceOhm(6, 0.5); // rheostat + ammeter
    const solution = solveLoadedCircuit({
      cell,
      seriesResistanceOhm: series,
      voltmeterResistanceOhm: Number.POSITIVE_INFINITY,
    });
    const fromCell = terminalPotentialV(cell, solution.sourceCurrentA);
    add(
      'the loaded circuit obeys V = IR and V = E − Ir at once',
      Math.abs(solution.terminalV - solution.currentA * series) < 1e-12 &&
        Math.abs(solution.terminalV - fromCell) < 1e-12 &&
        Math.abs(solution.sourceCurrentA - solution.currentA) < 1e-12,
      `I = ${solution.currentA.toFixed(4)} A, V = ${solution.terminalV.toFixed(4)} V, P(rheostat) = ${powerW(solution.currentA, 6).toFixed(3)} W`,
    );
  }

  // 17. A real voltmeter is not an open circuit: it shunts current and reads low.
  {
    const cell: Cell = { emfV: 2.2, internalResistanceOhm: 2.5 };
    const ideal = solveLoadedCircuit({ cell, seriesResistanceOhm: 6.5, voltmeterResistanceOhm: Number.POSITIVE_INFINITY });
    const real = solveLoadedCircuit({ cell, seriesResistanceOhm: 6.5, voltmeterResistanceOhm: 1000 });
    const external = parallelResistanceOhm(6.5, 1000);
    add(
      'a 1000 Ω voltmeter shunts a little current and reads a hair low',
      real.terminalV < ideal.terminalV &&
        real.voltmeterCurrentA > 0 &&
        ideal.terminalV - real.terminalV < 0.005 &&
        external < 6.5,
      `V ideal ${ideal.terminalV.toFixed(4)} V vs real ${real.terminalV.toFixed(4)} V, shunt current ${(real.voltmeterCurrentA * 1000).toFixed(3)} mA`,
    );
  }

  // 18. A realistic student's V–I graph must recover both E and r.
  {
    const rng = new Rng(99);
    const cell: Cell = { emfV: 2.15, internalResistanceOhm: 2.2 };
    const settings = [0.5, 1.5, 3, 5, 8, 12, 18];
    const xs: number[] = [];
    const ys: number[] = [];
    for (const rheostat of settings) {
      const solution = solveLoadedCircuit({
        cell,
        seriesResistanceOhm: seriesResistanceOhm(rheostat, 0.5),
        voltmeterResistanceOhm: 1000,
      });
      xs.push(Math.max(0, snap(solution.currentA + rng.normalClipped(0, 0.008, 2.5), 0.02)));
      ys.push(Math.max(0, snap(solution.terminalV + rng.normalClipped(0, 0.035, 2.5), 0.05)));
    }
    const fit = linearFit(xs, ys);
    const emf = fit ? emfFromIntercept(fit.intercept) : Number.NaN;
    const internal = fit ? internalResistanceFromGradient(fit.slope) : Number.NaN;
    const emfError = Math.abs(emf - cell.emfV) / cell.emfV;
    const internalError = Math.abs(internal - cell.internalResistanceOhm) / cell.internalResistanceOhm;
    add(
      "a student's V–I graph recovers E and r within 10 %",
      fit !== null && emfError < 0.1 && internalError < 0.1,
      fit
        ? `E = ${emf.toFixed(3)} V (true ${cell.emfV}), r = ${internal.toFixed(3)} Ω (true ${cell.internalResistanceOhm}), r² = ${fit.r2.toFixed(4)}`
        : 'no fit produced',
    );
  }

  // -------------------------------------------------------------------------
  // Refraction practical
  // -------------------------------------------------------------------------

  // 19. The traced ray must obey Snell's law, and the emergent ray must be
  //     parallel to the incident ray with the textbook lateral shift.
  {
    const n = 1.52;
    const thickness = 0.06;
    let worstSnell = 0;
    let worstShift = 0;
    let onFarFace = true;
    for (const incidenceDeg of [10, 25, 40, 55, 70, 80]) {
      const incidence = (incidenceDeg * Math.PI) / 180;
      const path = traceBlockRay({
        incidenceRad: incidence,
        refractiveIndex: n,
        thicknessM: thickness,
        entry: { x: 0, z: thickness / 2 },
      });
      worstSnell = Math.max(worstSnell, Math.abs(Math.sin(incidence) - n * Math.sin(path.refractionRad)));
      const textbook = (thickness * Math.sin(incidence - path.refractionRad)) / Math.cos(path.refractionRad);
      worstShift = Math.max(worstShift, Math.abs(textbook - path.displacementM));
      if (Math.abs(path.exit.z - -thickness / 2) > 1e-12) onFarFace = false;
      // The refracted ray must be shallower than the incident ray going into glass.
      if (!(path.refractionRad < incidence)) onFarFace = false;
    }
    add(
      'the ray through the block obeys Snell, exits on the far face, and is shifted sideways',
      worstSnell < 1e-12 && worstShift < 1e-12 && onFarFace,
      `worst |sin i − n sin r| = ${worstSnell.toExponential(1)}, worst shift error = ${worstShift.toExponential(1)}`,
    );
  }

  // 20. A realistic student's sin i–sin r graph must recover n.
  {
    const rng = new Rng(7);
    const trueIndex = 1.52;
    const xs: number[] = [];
    const ys: number[] = [];
    for (const incidenceDeg of [15, 25, 35, 45, 55, 65, 75]) {
      const incidence = (incidenceDeg * Math.PI) / 180;
      const refractionDeg = (refractionAngle(incidence, 1, trueIndex) * 180) / Math.PI;
      // Both angles are read off a protractor to the nearest degree.
      const iRead = snap(incidenceDeg + rng.normalClipped(0, 0.25, 2.5), 1);
      const rRead = snap(refractionDeg + rng.normalClipped(0, 0.4, 2.5), 1);
      xs.push(Math.sin((rRead * Math.PI) / 180));
      ys.push(Math.sin((iRead * Math.PI) / 180));
    }
    const fit = linearFit(xs, ys);
    const recovered = fit ? refractiveIndexFromGradient(fit.slope) : Number.NaN;
    const error = Math.abs(recovered - trueIndex) / trueIndex;
    add(
      "a student's sin i–sin r graph recovers n within 4 %",
      fit !== null && error < 0.04,
      fit
        ? `n = ${recovered.toFixed(3)} vs true ${trueIndex} (${(error * 100).toFixed(1)} %), r² = ${fit.r2.toFixed(4)}`
        : 'no fit produced',
    );
  }

  // 21. The critical angle of ordinary glass must be the textbook 41.8°.
  {
    const criticalDeg = (criticalAngleRad(1.5) * 180) / Math.PI;
    add(
      'the critical angle of glass (n = 1.5) is about 41.8°',
      Math.abs(criticalDeg - 41.81) < 0.05,
      `c = ${criticalDeg.toFixed(2)}°`,
    );
  }

  // 22. With no losses, the electrical energy all goes into the water.
  {
    const config: CalorimetryConfig = {
      voltageV: 12,
      currentA: 3.5,
      waterMassKg: 0.4,
      specificHeatCapacityJKgK: 4180,
    };
    let state = initialCalorimetryState(config);
    for (let second = 0; second < 300; second += 1) {
      state = stepCalorimetry(state, config, 1, true);
    }
    const expected = (12 * 3.5 * 300) / (0.4 * 4180);
    const error = Math.abs(state.temperatureC - 25 - expected);
    add(
      'a lagged calorimeter converts VIt into m c Δθ exactly',
      error < 1e-9,
      `Δθ = ${(state.temperatureC - 25).toFixed(6)} K vs ${expected.toFixed(6)} K`,
    );
  }

  // 23. With the heater off, the calorimeter cools towards room temperature.
  {
    const config: CalorimetryConfig = {
      voltageV: 12,
      currentA: 3.5,
      waterMassKg: 0.4,
      specificHeatCapacityJKgK: 4180,
      coolingCoefficientWK: 0.7,
      ambientC: 20,
      initialC: 30,
    };
    let state = initialCalorimetryState(config);
    for (let step = 0; step < 120; step += 1) {
      state = stepCalorimetry(state, config, 0.5, false);
    }
    const expected = 20 + 10 * Math.exp((-0.7 / (0.4 * 4180)) * 60);
    add(
      "Newton cooling brings a warm calorimeter back towards room temperature",
      Math.abs(state.temperatureC - expected) < 1e-9,
      `θ(60 s) = ${state.temperatureC.toFixed(4)} °C vs ${expected.toFixed(4)} °C`,
    );
  }

  // 24. The thermometer lags the water by about τ × (dθ/dt).
  {
    const config: CalorimetryConfig = {
      voltageV: 12,
      currentA: 3.5,
      waterMassKg: 0.4,
      specificHeatCapacityJKgK: 4180,
      thermometerTauS: 1.5,
    };
    let state = initialCalorimetryState(config);
    for (let step = 0; step < 1200; step += 1) {
      state = stepCalorimetry(state, config, 0.05, true);
    }
    const gradient = 12 * 3.5 / (0.4 * 4180);
    const expectedLag = 1.5 * gradient;
    const lag = state.temperatureC - state.readingC;
    const error = Math.abs(lag - expectedLag) / expectedLag;
    add(
      'a thermometer with τ = 1.5 s lags the water by τ × gradient',
      error < 0.03,
      `lag = ${lag.toFixed(4)} K vs ${expectedLag.toFixed(4)} K (${(error * 100).toFixed(1)} %)`,
    );
  }

  // 25. A student's initial-gradient graph recovers c, and shows the endpoint
  //     formula reading high because of cooling.
  {
    const config: CalorimetryConfig = {
      voltageV: 12,
      currentA: 3.5,
      waterMassKg: 0.4,
      specificHeatCapacityJKgK: 4180,
      vesselHeatCapacityJK: 30,
      coolingCoefficientWK: 0.7,
      ambientC: 20.5,
      initialC: 21.2,
      thermometerTauS: 1.5,
    };
    let state: CalorimetryState = initialCalorimetryState(config);
    const initialReading = thermometerReadingC(state);
    const times: number[] = [0];
    const rises: number[] = [0];
    for (let second = 1; second <= 300; second += 1) {
      state = stepCalorimetry(state, config, 1, true);
      if (second % 30 === 0) {
        times.push(second);
        rises.push(thermometerReadingC(state) - initialReading);
      }
    }

    const window = times
      .map((time, index) => ({ time, rise: rises[index] }))
      .filter((point) => point.time <= 90);
    const fit = linearFit(
      window.map((point) => point.time),
      window.map((point) => point.rise),
    );
    const gradientC = fit ? specificHeatFromGradient(12, 3.5, 0.4, fit.slope) : Number.NaN;
    const error = Math.abs(gradientC - 4180) / 4180;

    add(
      "a student's initial-gradient value is within 10 % of the true c",
      fit !== null && error < 0.1,
      fit
        ? `c = ${gradientC.toFixed(0)} J/kg K vs 4180 (${(error * 100).toFixed(1)} %), gradient = ${fit.slope.toFixed(5)} K/s`
        : 'no fit produced',
    );

    const endpointC = specificHeatFromEnergy(12, 3.5, 300, 0.4, rises[rises.length - 1]);
    add(
      'the endpoint formula reads higher than the initial gradient, because of cooling',
      endpointC > gradientC,
      `endpoint ${endpointC.toFixed(0)} vs gradient ${gradientC.toFixed(0)} J/kg K (${(
        ((endpointC - gradientC) / gradientC) *
        100
      ).toFixed(1)} % higher)`,
    );
  }

  return results;
}
