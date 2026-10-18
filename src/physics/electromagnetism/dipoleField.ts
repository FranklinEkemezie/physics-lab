/**
 * The magnetic field of a bar magnet, in the horizontal (bench) plane.
 *
 * ---------------------------------------------------------------------------
 * What is real here
 * ---------------------------------------------------------------------------
 * A plotting compass does **not** point at the magnet. Its needle settles along
 * the *resultant* of every field at that spot: the magnet's own field **B** and
 * the Earth's horizontal field **H**.
 *
 * The magnet is modelled as an ideal magnetic **dipole** — the approximation
 * every textbook uses, and the reason a graph of `tan θ` against `1/d³` comes
 * out straight. A real steel bar magnet only behaves like a dipole once you are
 * further from it than its own length.
 *
 * Everything here is pure maths: no Three.js, no DOM. That keeps it testable by
 * `npm run verify` and reusable by any future magnetic practical.
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
  return {
    x: magnet.momentAm2 * Math.cos(magnet.momentAngleRad),
    z: magnet.momentAm2 * Math.sin(magnet.momentAngleRad),
  };
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
