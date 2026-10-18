/**
 * Tracing streamlines through a 2-D vector field.
 *
 * A streamline is the curve that is everywhere parallel to a field: a magnetic
 * field line, an electric field line, the path of a fluid particle. The maths
 * is identical whatever the field means, so the tracer lives here and knows
 * nothing about magnetism. Steps are normalised to unit length so the sample
 * points are evenly spaced along the curve instead of bunching up where the
 * field is strong.
 */

import { rk4Step, type VectorSpace } from './ode';

export interface Point2D {
  x: number;
  z: number;
}

export interface StreamlineOptions {
  /** Distance advanced per step, in the field's own units. */
  stepM?: number;
  /** Safety valve for lines that never leave the region. */
  maxSteps?: number;
  /** Stop the trace when it wanders outside this box. */
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Extra stop test, e.g. "we have reached the source". */
  stop?: (x: number, z: number) => boolean;
}

const SPACE2D: VectorSpace<Point2D> = {
  add: (a, b) => ({ x: a.x + b.x, z: a.z + b.z }),
  scale: (a, k) => ({ x: a.x * k, z: a.z * k }),
};

/**
 * Trace a streamline through `start`, forward and backward, as a list of
 * points ordered along the curve.
 */
export function traceStreamline(
  field: (x: number, z: number) => Point2D,
  start: Point2D,
  options: StreamlineOptions = {},
): Point2D[] {
  const { stepM = 0.005, maxSteps = 4000, bounds, stop } = options;

  const direction = (sign: 1 | -1) => (point: Point2D): Point2D => {
    const f = field(point.x, point.z);
    const magnitude = Math.hypot(f.x, f.z);
    if (magnitude < 1e-15) return { x: 0, z: 0 };
    return { x: (sign * f.x) / magnitude, z: (sign * f.z) / magnitude };
  };

  const outside = (x: number, z: number): boolean =>
    bounds !== undefined && (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ);

  const points: Point2D[] = [{ ...start }];

  for (const sign of [1, -1] as const) {
    let current = { ...start };
    for (let i = 0; i < maxSteps; i += 1) {
      const next = rk4Step(current, 0, stepM, direction(sign), SPACE2D);
      const stalled = Math.abs(next.x - current.x) < 1e-12 && Math.abs(next.z - current.z) < 1e-12;
      if (stalled) break;
      current = next;
      if (outside(current.x, current.z)) break;
      if (stop?.(current.x, current.z)) break;
      if (sign === 1) points.push(current);
      else points.unshift(current);
    }
  }

  return points;
}
