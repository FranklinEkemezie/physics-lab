/**
 * Magnetism for the plotting-compass practical.
 *
 * ---------------------------------------------------------------------------
 * What is real here
 * ---------------------------------------------------------------------------
 * A plotting compass does **not** point at the magnet. Its needle settles along
 * the *resultant* of every field at that spot: the magnet's own field **B** and
 * the Earth's horizontal field **H**. That single fact is what turns "plotting
 * field lines" into a measurable experiment, because on the *equatorial line*
 * (the line through the magnet's centre at right angles to it) the two fields
 * are perpendicular, so the needle is deflected by an angle θ with
 *
 * ```text
 *   tan θ = |B| / H .
 * ```
 *
 * The magnet is modelled as an ideal magnetic **dipole** — the approximation
 * every textbook uses, and the reason a graph of `tan θ` against `1/d³` comes
 * out straight. A real steel bar magnet only behaves like a dipole once you are
 * further from it than its own length; the tip in the analysis points that out.
 *
 * Everything in this module is pure maths: no Three.js, no DOM. That keeps it
 * testable by `npm run verify` and reusable by any future magnetic practical.
 */

/** μ₀/4π, in T·m/A. The constant in the dipole field formula. */
export const MU0_OVER_4PI = 1e-7;

/**
 * Earth's horizontal magnetic flux density at the bench, in tesla.
 *
 * About 30 µT in West Africa (the total field is ~32 µT and the dip is small
 * near the magnetic equator), which is exactly the field a WAEC candidate's
 * plotting compass is fighting against.
 */
export const EARTH_HORIZONTAL_T = 30e-6;

/** A magnetic field in the horizontal (bench) plane, in tesla. */
export interface PlanarField {
  x: number;
  z: number;
}

/** Anything that samples a field at a point on the bench. */
export type PlanarFieldFn = (x: number, z: number) => PlanarField;

/** A bar magnet reduced to the point dipole a textbook would use. */
export interface DipoleMagnet {
  /** Centre of the magnet on the bench, in metres. */
  x: number;
  z: number;
  /** Magnetic moment, in A·m². Unknown to the student until they measure it. */
  momentAm2: number;
  /** Direction of the moment in the bench plane, radians CCW from +x. */
  momentAngleRad: number;
}

/** The moment as a planar vector. */
export function momentVector(magnet: DipoleMagnet): PlanarField {
  return { x: magnet.momentAm2 * Math.cos(magnet.momentAngleRad), z: magnet.momentAm2 * Math.sin(magnet.momentAngleRad) };
}

/**
 * Field of an ideal dipole, evaluated in the horizontal plane.
 *
 * ```text
 *   B(r) = (μ₀/4π) · [ 3(m·r̂)r̂ − m ] / r³
 * ```
 *
 * The `z` component of the true 3-D field is out of the plane of the bench and
 * a plotting compass ignores it, so only the horizontal part is returned.
 */
export function dipoleFieldAt(x: number, z: number, magnet: DipoleMagnet): PlanarField {
  const dx = x - magnet.x;
  const dz = z - magnet.z;
  const r2 = dx * dx + dz * dz;
  if (r2 < 1e-8) return { x: 0, z: 0 };

  const r = Math.sqrt(r2);
  const r3 = r2 * r;
  const r5 = r3 * r2;
  const moment = momentVector(magnet);
  const mDotR = moment.x * dx + moment.z * dz;
  const k = MU0_OVER_4PI;

  return {
    x: k * ((3 * mDotR * dx) / r5 - moment.x / r3),
    z: k * ((3 * mDotR * dz) / r5 - moment.z / r3),
  };
}

/** A uniform field of the given magnitude, pointing at `angleRad`. */
export function uniformField(angleRad: number, magnitudeT: number): PlanarField {
  return { x: magnitudeT * Math.cos(angleRad), z: magnitudeT * Math.sin(angleRad) };
}

export function addFields(a: PlanarField, b: PlanarField): PlanarField {
  return { x: a.x + b.x, z: a.z + b.z };
}

export function fieldMagnitude(field: PlanarField): number {
  return Math.hypot(field.x, field.z);
}

/**
 * The two fields a plotting compass actually feels: the magnet plus the Earth.
 * @param earth The Earth's horizontal field as a planar vector.
 */
export function totalFieldAt(x: number, z: number, magnet: DipoleMagnet, earth: PlanarField): PlanarField {
  return addFields(dipoleFieldAt(x, z, magnet), earth);
}

/**
 * The angle a student reads off a compass: the deflection of the needle from
 * magnetic north, signed. Zero when only the Earth's field is present.
 */
export function deflectionRad(field: PlanarField): number {
  return Math.atan2(field.z, field.x);
}

/**
 * Bearing for the 3-D compass model, which holds its red (north) tip along the
 * field. See `PlottingCompassModel.setHeading` for the convention.
 */
export function compassHeadingRad(field: PlanarField): number {
  return Math.atan2(-field.z, field.x);
}

/**
 * The deflection theory predicts on the equatorial line, where the magnet's
 * field is perpendicular to the Earth's:
 *
 * ```text
 *   tan θ = (μ₀/4π)·m / (H·d³)
 * ```
 */
export function theoreticalDeflectionRad(distanceM: number, magnet: DipoleMagnet, earthH = EARTH_HORIZONTAL_T): number {
  if (distanceM <= 0) return Math.PI / 2;
  const magnetField = (MU0_OVER_4PI * magnet.momentAm2) / distanceM ** 3;
  return Math.atan(magnetField / earthH);
}

/**
 * Gradient of the straight-line graph `tan θ` against `1/d³`.
 *
 * A perfect dipole gives a constant `G = (μ₀/4π)·m / H`, so the graph passes
 * through the origin with this gradient whatever the distance.
 */
export function gradientFor(magnet: DipoleMagnet, earthH = EARTH_HORIZONTAL_T): number {
  return (MU0_OVER_4PI * magnet.momentAm2) / earthH;
}

/** Recover the magnetic moment from the gradient the student measured. */
export function momentFromGradient(gradientM3: number, earthH = EARTH_HORIZONTAL_T): number {
  return (gradientM3 * earthH) / MU0_OVER_4PI;
}

/**
 * Distance from the centre at which the magnet's equatorial field exactly equals
 * the Earth's, so the needle sits at 45° to magnetic north.
 *
 * Note that this is *not* a neutral point: in this practical the magnet's axis
 * is at right angles to the Earth's field, so the two fields never cancel — the
 * needle is only ever deflected, never reversed. What this distance marks is
 * where `B = H`; it is the cube root of the graph's gradient.
 */
export function halfFieldDistanceM(magnet: DipoleMagnet, earthH = EARTH_HORIZONTAL_T): number {
  return Math.cbrt(gradientFor(magnet, earthH));
}

// ---------------------------------------------------------------------------
// Streamlines
// ---------------------------------------------------------------------------

export interface TraceOptions {
  /** Distance advanced per step, in metres. */
  stepM?: number;
  /** Safety valve for lines that never leave the paper. */
  maxSteps?: number;
  /** Stop the trace when it wanders outside this box. */
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Extra stop test, e.g. "we have reached the magnet". */
  stop?: (x: number, z: number) => boolean;
}

/**
 * Trace a field line through `start`, forward and backward, as a list of
 * points. Uses RK4 on the *unit* field, so the points are evenly spaced along
 * the line instead of bunching up where the field is strong.
 */
export function traceFieldLine(
  fieldAt: PlanarFieldFn,
  start: { x: number; z: number },
  options: TraceOptions = {},
): { x: number; z: number }[] {
  const { stepM = 0.005, maxSteps = 4000, bounds, stop } = options;

  const unit = (x: number, z: number, sign: 1 | -1): PlanarField | null => {
    const field = fieldAt(x, z);
    const magnitude = fieldMagnitude(field);
    if (magnitude < 1e-15) return null;
    return { x: (sign * field.x) / magnitude, z: (sign * field.z) / magnitude };
  };

  const outOfBounds = (x: number, z: number): boolean =>
    bounds !== undefined && (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ);

  const points: { x: number; z: number }[] = [{ x: start.x, z: start.z }];

  for (const sign of [1, -1] as const) {
    let { x, z } = start;
    for (let i = 0; i < maxSteps; i += 1) {
      const k1 = unit(x, z, sign);
      if (!k1) break;
      const k2 = unit(x + (stepM / 2) * k1.x, z + (stepM / 2) * k1.z, sign);
      if (!k2) break;
      const k3 = unit(x + (stepM / 2) * k2.x, z + (stepM / 2) * k2.z, sign);
      if (!k3) break;
      const k4 = unit(x + stepM * k3.x, z + stepM * k3.z, sign);
      if (!k4) break;

      x += (stepM / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x);
      z += (stepM / 6) * (k1.z + 2 * k2.z + 2 * k3.z + k4.z);

      if (outOfBounds(x, z)) break;
      if (stop?.(x, z)) break;

      if (sign === 1) points.push({ x, z });
      else points.unshift({ x, z });
    }
  }

  return points;
}

// ---------------------------------------------------------------------------
// Reading error
// ---------------------------------------------------------------------------

/**
 * A student reading the printed centimetre scale can do about ±0.5 mm; the
 * needle against a graduated card, about ±0.5°. Both are *random* errors, so
 * they show up as the scatter that makes the graph worth drawing.
 */
export const DISTANCE_READING_SIGMA_M = 0.0005;
export const DEFLECTION_READING_SIGMA_DEG = 0.5;

/**
 * Error in `1/d³` produced by an error `δd` in the distance:
 * `d(1/d³)/dd = −3/d⁴`.
 */
export function inverseCubeError(distanceM: number, deltaM: number): number {
  return (3 * deltaM) / distanceM ** 4;
}

/** Error in `tan θ` produced by an angular error `δθ`, from `d(tan θ)/dθ = sec²θ`. */
export function tanError(deflectionRadians: number, deltaRadians: number): number {
  const cosine = Math.cos(deflectionRadians);
  return Math.abs(deltaRadians) / (cosine * cosine);
}
