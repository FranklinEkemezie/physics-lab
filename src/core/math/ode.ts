/**
 * Numerical integration of ordinary differential equations.
 *
 * Physics, chemistry and electronics all boil down to "how does this state
 * change over time?", so the integrator lives here in maths, with no idea what
 * a pendulum, a reaction or a capacitor is. A caller supplies the state, its
 * derivative and the two vector-space operations RK4 needs — nothing else.
 */

/** The operations RK4 needs from the state type (add and scale). */
export interface VectorSpace<S> {
  add(a: S, b: S): S;
  scale(a: S, k: number): S;
}

/** Rate of change of the state: `dS/dt = derivative(state, t)`. */
export type Derivative<S> = (state: S, t: number) => S;

/**
 * One classical fourth-order Runge–Kutta step.
 *
 * At a fixed 1/480 s step this is far more accurate than a frame rate would
 * be, and because the step is fixed the simulation gives the same answer on a
 * 60 Hz laptop and a 144 Hz monitor.
 */
export function rk4Step<S>(
  state: S,
  t: number,
  dt: number,
  derivative: Derivative<S>,
  space: VectorSpace<S>,
): S {
  const k1 = derivative(state, t);
  const k2 = derivative(space.add(state, space.scale(k1, dt / 2)), t + dt / 2);
  const k3 = derivative(space.add(state, space.scale(k2, dt / 2)), t + dt / 2);
  const k4 = derivative(space.add(state, space.scale(k3, dt)), t + dt);

  const weighted = space.add(k1, space.add(space.scale(k2, 2), space.add(space.scale(k3, 2), k4)));
  return space.add(state, space.scale(weighted, dt / 6));
}
