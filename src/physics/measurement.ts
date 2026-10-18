/**
 * Measurement error models.
 *
 * These functions convert a *camera position* or an *instrument reading* into
 * the numbers a student would actually write in their book. They are the
 * difference between a simulation that plots a perfect parabola and one where
 * the graph has a little scatter around it — because the second is the one
 * that teaches anything.
 */

/** Angular quantities in this module are radians unless stated otherwise. */

export interface ParallaxOptions {
  /**
   * Angle between the line of sight and the normal to the scale face, in
   * radians. 0 = looking straight at the graduations (no parallax).
   */
  viewAzimuthRad: number;
  /**
   * Distance (perpendicular to the scale face) between the scale face and the
   * object whose position is being read, in metres.
   */
  scaleToObjectDepthM: number;
}

/**
 * How far a reading is displaced by parallax.
 *
 * ```text
 *   apparent offset = depth × tan(viewing angle)
 * ```
 *
 * A bob 3 cm in front of the rule, viewed 20° off the normal, reads
 * `0.03 × tan(20°) ≈ 11 mm` wrong — a whole centimetre. That is exactly the
 * error students are taught to avoid, and here it is unavoidable unless you
 * square up to the scale.
 */
export function parallaxOffset({ viewAzimuthRad, scaleToObjectDepthM }: ParallaxOptions): number {
  return scaleToObjectDepthM * Math.tan(viewAzimuthRad);
}

/**
 * Human reading error on a graduated scale: how well a student can read
 * between the smallest graduations.
 *
 * Experienced readers get about ±0.25 of a division; beginners are closer to
 * ±1 division. We also add a constant "eye" floor for blur and squint.
 */
export function readingUncertaintyM(divisionM: number, skill = 0.6): number {
  return divisionM * skill + 0.00015;
}

/** Description of how a value was obtained, for the data table's notes. */
export interface MeasurementNote {
  value: number;
  /** Instrument resolution, in the value's units. */
  resolution: number;
  /** Total estimated uncertainty (a standard uncertainty, not the full range). */
  uncertainty: number;
  /** Human-readable caveats, e.g. "parallax 8 mm right". */
  caveats: string[];
}

/**
 * Combine a nominal value with the errors it accumulated on the way out of the
 * apparatus, in quadrature — the honest way to add independent random errors.
 */
export function combineUncertainties(...uncertainties: number[]): number {
  let sumSquares = 0;
  for (const u of uncertainties) sumSquares += u * u;
  return Math.sqrt(sumSquares);
}

/**
 * The camera's azimuth relative to a scale's face normal.
 *
 * @param cameraPosition World position of the camera (or of the eye).
 * @param scaleFaceCentre World position of the centre of the scale face.
 * @param scaleFaceNormal Unit normal of the scale face, pointing at the reader.
 * @param scaleUp Axis along which the scale is graduated (Y for the metre rule).
 * @returns Signed angle in radians; positive when looking from the +side.
 */
export function viewAzimuth(
  cameraPosition: { x: number; y: number; z: number },
  scaleFaceCentre: { x: number; y: number; z: number },
  scaleFaceNormal: { x: number; y: number; z: number },
  scaleUp: { x: number; y: number; z: number },
): number {
  const dx = cameraPosition.x - scaleFaceCentre.x;
  const dy = cameraPosition.y - scaleFaceCentre.y;
  const dz = cameraPosition.z - scaleFaceCentre.z;

  // Component of the view direction along the face normal...
  const alongNormal = dx * scaleFaceNormal.x + dy * scaleFaceNormal.y + dz * scaleFaceNormal.z;
  // ...and along the horizontal in-plane axis (normal × up).
  const side = {
    x: scaleFaceNormal.y * scaleUp.z - scaleFaceNormal.z * scaleUp.y,
    y: scaleFaceNormal.z * scaleUp.x - scaleFaceNormal.x * scaleUp.z,
    z: scaleFaceNormal.x * scaleUp.y - scaleFaceNormal.y * scaleUp.x,
  };
  const alongSide = dx * side.x + dy * side.y + dz * side.z;

  // Angle of the viewing direction away from the normal, signed.
  return Math.atan2(alongSide, Math.abs(alongNormal)) * Math.sign(alongNormal || 1);
}

/**
 * How "square on" to a scale the student is looking.
 * @returns 0 = perfect (no parallax), 1 = hopeless (edge-on).
 */
export function viewingQuality(azimuthRad: number): number {
  return Math.min(1, Math.abs(azimuthRad) / (Math.PI / 3));
}

/**
 * The error a stopwatch's own hardware contributes over a given interval.
 * @param calibrationError Fractional error (e.g. 100e-6 for 100 ppm).
 */
export function stopwatchError(intervalS: number, calibrationError: number): number {
  return Math.abs(intervalS * calibrationError);
}

/**
 * Uncertainty in a period derived from timing `n` oscillations.
 *
 * `T = t/n`, so `ΔT = Δt/n`: timing many swings is the single cheapest way to
 * improve this experiment, which is why every textbook insists on it.
 */
export function periodUncertainty(timingUncertaintyS: number, oscillations: number): number {
  return timingUncertaintyS / Math.max(1, oscillations);
}

/**
 * Length of the rule at a given temperature — a wooden rule really does
 * change length, and a 100 cm rule at 40 °C is about 0.06 mm longer than at
 * 20 °C. Tiny, but the lab does not pretend otherwise.
 */
export function thermalLength(baseLengthM: number, expansionPerC: number, deltaTC: number): number {
  return baseLengthM * (1 + expansionPerC * deltaTC);
}
