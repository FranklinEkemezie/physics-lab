/**
 * Viewing errors: parallax and how "square on" the reading is.
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

import { cross3, dot3, sub3, type Vec3 } from '@/core/math';

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

/** How far a reading is displaced by parallax, in metres. */
export function parallaxOffset({ viewAzimuthRad, scaleToObjectDepthM }: ParallaxOptions): number {
  return scaleToObjectDepthM * Math.tan(viewAzimuthRad);
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
  cameraPosition: Vec3,
  scaleFaceCentre: Vec3,
  scaleFaceNormal: Vec3,
  scaleUp: Vec3,
): number {
  const view = sub3(cameraPosition, scaleFaceCentre);

  // Component of the view direction along the face normal, and along the
  // horizontal in-plane axis (normal × up).
  const alongNormal = dot3(view, scaleFaceNormal);
  const side = cross3(scaleFaceNormal, scaleUp);
  const alongSide = dot3(view, side);

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
