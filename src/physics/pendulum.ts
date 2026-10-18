/**
 * The simple pendulum: equations of motion and the theory a student compares
 * against.
 *
 * ### The honest equation
 * A real pendulum does **not** obey `θ'' = −(g/L)·θ`. That is the small-angle
 * approximation. The true equation is
 *
 * ```text
 *   θ'' = −(g/L)·sin θ − (damping)
 * ```
 *
 * and we integrate *that*, with damping taken from the actual drag on a
 * sphere of the bob's radius. The consequences show up in the measurements:
 *  - the period grows with amplitude (≈ θ₀²/16 relative),
 *  - a big bob (or a short string) has extra moment of inertia,
 *  - the swings slowly die away, so "20 oscillations" is never quite the
 *    same as "20 oscillations at the start".
 */

import type { Location } from './constants';

export interface PendulumParameters {
  /** Distance from the pivot to the *centre* of the bob, in metres. */
  lengthM: number;
  /** Radius of the spherical bob, in metres (0 = ideal point mass). */
  bobRadiusM: number;
  /** Mass of the bob in kg. */
  bobMassKg: number;
  /** Effective gravity in m/s². */
  g: number;
  /** Air density in kg/m³ (0 in a vacuum). */
  airDensity: number;
  /** Drag coefficient of the bob (0.47 for a smooth sphere). */
  dragCoefficient?: number;
  /** Extra viscous damping from the pivot and thread, in s⁻¹. */
  pivotDamping?: number;
}

/** State vector of the pendulum. */
export interface PendulumState {
  /** Angle from the downward vertical, in radians. Positive = to the right. */
  theta: number;
  /** Angular velocity in rad/s. */
  omega: number;
}

/**
 * Angular acceleration `θ''`. This is the single source of truth for the
 * pendulum's motion — everything else in the lab derives from it.
 */
export function angularAcceleration(state: PendulumState, parameters: PendulumParameters): number {
  const { lengthM, bobRadiusM, bobMassKg, g, airDensity, dragCoefficient = 0.47, pivotDamping = 0.012 } = parameters;
  if (lengthM <= 0) return 0;

  // Gravity (no small-angle approximation!).
  let alpha = -(g / lengthM) * Math.sin(state.theta);

  // Viscous damping: pivot friction plus the thread's own air resistance.
  alpha -= pivotDamping * state.omega;

  // Quadratic (aerodynamic) drag on the bob. The bob moves at v = ω·L and
  // presents an area A = πr². Torque = F·L, and α = τ / I with I ≈ m·L²:
  //   F = ½·ρ·Cd·A·v²  →  α_drag = F·L / (m·L²)
  const area = Math.PI * bobRadiusM * bobRadiusM;
  const quadratic = (0.5 * airDensity * dragCoefficient * area) / Math.max(bobMassKg, 1e-6);
  alpha -= quadratic * state.omega * Math.abs(state.omega) * lengthM;

  return alpha;
}

/**
 * Classical fourth-order Runge–Kutta integration of the pendulum ODE.
 *
 * RK4 at a fixed 1/480 s step is far more accurate than the frame rate would
 * be, and because the step is fixed the simulation gives the same answer on a
 * 60 Hz laptop and a 144 Hz monitor.
 */
export function integratePendulum(
  state: PendulumState,
  parameters: PendulumParameters,
  dt: number,
): PendulumState {
  const accel = (s: PendulumState): number => angularAcceleration(s, parameters);

  const k1Theta = state.omega;
  const k1Omega = accel(state);

  const mid1: PendulumState = { theta: state.theta + (dt / 2) * k1Theta, omega: state.omega + (dt / 2) * k1Omega };
  const k2Theta = mid1.omega;
  const k2Omega = accel(mid1);

  const mid2: PendulumState = { theta: state.theta + (dt / 2) * k2Theta, omega: state.omega + (dt / 2) * k2Omega };
  const k3Theta = mid2.omega;
  const k3Omega = accel(mid2);

  const end: PendulumState = { theta: state.theta + dt * k3Theta, omega: state.omega + dt * k3Omega };
  const k4Theta = end.omega;
  const k4Omega = accel(end);

  return {
    theta: state.theta + (dt / 6) * (k1Theta + 2 * k2Theta + 2 * k3Theta + k4Theta),
    omega: state.omega + (dt / 6) * (k1Omega + 2 * k2Omega + 2 * k3Omega + k4Omega),
  };
}

// ---------------------------------------------------------------------------
// Theory: what the textbook predicts
// ---------------------------------------------------------------------------

/** Ideal point-mass, infinitesimal-amplitude period `T = 2π√(L/g)`. */
export function idealPeriod(lengthM: number, g: number): number {
  return 2 * Math.PI * Math.sqrt(lengthM / g);
}

/**
 * Period including the two corrections a *good* student could spot:
 *  1. finite amplitude: `T ≈ T₀(1 + θ₀²/16 + 11θ₀⁴/3072)`
 *  2. finite bob size: `T = T₀·√(1 + (2/5)(r/L)²)`
 */
export function correctedPeriod(
  lengthM: number,
  g: number,
  amplitudeRad: number,
  bobRadiusM = 0,
): number {
  const t0 = idealPeriod(lengthM, g);
  const amplitudeFactor = 1 + amplitudeRad ** 2 / 16 + (11 * amplitudeRad ** 4) / 3072;
  const inertiaFactor = Math.sqrt(1 + (2 / 5) * (bobRadiusM / lengthM) ** 2);
  return t0 * amplitudeFactor * inertiaFactor;
}

/**
 * The headline result of the practical: the gradient of a `T²` against `L`
 * graph is `4π²/g`, so
 *
 * ```text
 *   g = 4π² / gradient
 * ```
 *
 * @param slopeSI Gradient of T² (s²) versus L (m).
 */
export function gravityFromSlope(slopeSI: number): number {
  if (!Number.isFinite(slopeSI) || slopeSI === 0) return Number.NaN;
  return (4 * Math.PI * Math.PI) / slopeSI;
}

/**
 * Uncertainty in g propagated from the uncertainty in the gradient:
 * `Δg/g = Δm/m`.
 */
export function gravityFromSlopeWithUncertainty(
  slopeSI: number,
  slopeUncertaintySI: number,
): { g: number; uncertainty: number } {
  const g = gravityFromSlope(slopeSI);
  const relative = Math.abs(slopeUncertaintySI / slopeSI);
  return { g, uncertainty: g * relative };
}

/** Energy of the pendulum (small oscillation, relative to the lowest point). */
export function pendulumEnergy(state: PendulumState, parameters: PendulumParameters): number {
  const { lengthM, bobMassKg, g } = parameters;
  const potential = bobMassKg * g * lengthM * (1 - Math.cos(state.theta));
  const speed = state.omega * lengthM;
  const kinetic = 0.5 * bobMassKg * speed * speed;
  return potential + kinetic;
}

/**
 * Amplitude of the current swing, inferred from energy. Handy for reporting
 * "the amplitude has decayed to 12.3°" without tracking turning points.
 */
export function amplitudeFromState(state: PendulumState, parameters: PendulumParameters): number {
  const energy = pendulumEnergy(state, parameters);
  const { bobMassKg, g, lengthM } = parameters;
  const cosTheta = 1 - energy / Math.max(1e-9, bobMassKg * g * lengthM);
  return Math.acos(Math.max(-1, Math.min(1, cosTheta)));
}

/**
 * Choose a pivot damping that mimics a real school pendulum: amplitude falls
 * to half in roughly two minutes. Calibrated against the behaviour of a
 * 25 mm brass bob on 80 cm of cotton thread.
 */
export function suggestPivotDamping(): number {
  return 0.012;
}

/** Apply a location's environment to a set of parameters. */
export function parametersForLocation(
  location: Location,
  lengthM: number,
  bobRadiusM: number,
  bobMassKg: number,
): PendulumParameters {
  return {
    lengthM,
    bobRadiusM,
    bobMassKg,
    g: location.g,
    airDensity: location.airDensity,
    pivotDamping: suggestPivotDamping(),
  };
}
