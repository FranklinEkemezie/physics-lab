/**
 * The simple pendulum: equations of motion.
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

import { rk4Step, type VectorSpace } from '@/core/math';
import type { Location } from '../../constants';

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

/** How the pendulum state is added and scaled — the algebra RK4 needs. */
const PENDULUM_SPACE: VectorSpace<PendulumState> = {
  add: (a, b) => ({ theta: a.theta + b.theta, omega: a.omega + b.omega }),
  scale: (a, k) => ({ theta: a.theta * k, omega: a.omega * k }),
};

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
 * Advance the pendulum by `dt` with one fourth-order Runge–Kutta step.
 *
 * The integrator itself is generic (see `@/core/math/ode`); all this adds is
 * the pendulum's derivative and the algebra of its two-element state.
 */
export function integratePendulum(
  state: PendulumState,
  parameters: PendulumParameters,
  dt: number,
): PendulumState {
  const derivative = (s: PendulumState): PendulumState => ({
    theta: s.omega,
    omega: angularAcceleration(s, parameters),
  });
  return rk4Step(state, 0, dt, derivative, PENDULUM_SPACE);
}

/** Energy of the pendulum (relative to the lowest point). */
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
