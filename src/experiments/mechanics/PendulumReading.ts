/**
 * The length-reading model for the simple pendulum.
 *
 * The student never measures `L` directly: they read the height of the bottom
 * of the cork and the height of the centre of the bob against the rule, and `L`
 * is the difference. This class holds those two readings (and the camera angle
 * each was taken from), works out the length, and judges how well a reading
 * agrees with the mark drawn in the lens. No DOM, no rig — just the numbers.
 */

/** How the length of the pendulum was obtained from the rule. */
export interface LengthReading {
  /** Height of the point of suspension above the bench, in centimetres. */
  pivotCm: number | null;
  /** Height of the centre of the bob above the bench, in centimetres. */
  bobCm: number | null;
  /** Camera azimuth when each reading was taken (radians). */
  pivotAzimuth: number | null;
  bobAzimuth: number | null;
  /** How each number got there: typed by the student, or copied from the lens. */
  pivotSource: 'typed' | 'lens' | null;
  bobSource: 'typed' | 'lens' | null;
}

/** Which mark on the rule is currently being read. */
export type ReadingTarget = 'bob' | 'pivot';

/** Verdict on how close a reading is to the mark in the lens. */
export interface ReadingStatus {
  level: 'none' | 'good' | 'warn' | 'bad';
  /** Short explanation shown beside the field, e.g. "1.2 mm off". */
  detail?: string;
}

/** A reading within this many millimetres of the mark is accepted. */
const GOOD_ERROR_MM = 1.0;
/** Beyond this the reading is treated as a misreading rather than a squint. */
const WARN_ERROR_MM = 3.0;

export class PendulumReadings {
  #pivotCm: number | null = null;
  #bobCm: number | null = null;
  #pivotAzimuth: number | null = null;
  #bobAzimuth: number | null = null;
  #pivotSource: 'typed' | 'lens' | null = null;
  #bobSource: 'typed' | 'lens' | null = null;

  get pivotCm(): number | null {
    return this.#pivotCm;
  }

  get bobCm(): number | null {
    return this.#bobCm;
  }

  get pivotAzimuth(): number | null {
    return this.#pivotAzimuth;
  }

  get bobAzimuth(): number | null {
    return this.#bobAzimuth;
  }

  /** A plain copy of the reading state, for the panel to render. */
  get snapshot(): LengthReading {
    return {
      pivotCm: this.#pivotCm,
      bobCm: this.#bobCm,
      pivotAzimuth: this.#pivotAzimuth,
      bobAzimuth: this.#bobAzimuth,
      pivotSource: this.#pivotSource,
      bobSource: this.#bobSource,
    };
  }

  /** The length the student's readings imply, in metres. */
  get measuredLengthM(): number | null {
    if (this.#pivotCm === null || this.#bobCm === null) return null;
    return (this.#pivotCm - this.#bobCm) / 100;
  }

  /**
   * How far apart the two viewing angles were, in radians, or null until both
   * readings have been taken. A large value means parallax has not cancelled.
   */
  get azimuthMismatchRadians(): number | null {
    if (this.#pivotAzimuth === null || this.#bobAzimuth === null) return null;
    return Math.abs(this.#pivotAzimuth - this.#bobAzimuth);
  }

  /** Copy a value read under the lens's red line. */
  setFromLens(target: ReadingTarget, cm: number, azimuthRad: number): void {
    if (target === 'bob') {
      this.#bobCm = cm;
      this.#bobAzimuth = azimuthRad;
      this.#bobSource = 'lens';
    } else {
      this.#pivotCm = cm;
      this.#pivotAzimuth = azimuthRad;
      this.#pivotSource = 'lens';
    }
  }

  /**
   * Record a value the student typed in. Clearing the field leaves the source
   * alone: an empty box is not evidence that the number was ever read.
   */
  setTyped(target: ReadingTarget, cm: number | null): void {
    if (target === 'bob') {
      this.#bobCm = cm;
      if (cm !== null) this.#bobSource = 'typed';
    } else {
      this.#pivotCm = cm;
      if (cm !== null) this.#pivotSource = 'typed';
    }
  }

  /** Forget both readings — used when the bench is set up afresh. */
  clear(): void {
    this.#pivotCm = null;
    this.#bobCm = null;
    this.#pivotAzimuth = null;
    this.#bobAzimuth = null;
    this.#pivotSource = null;
    this.#bobSource = null;
  }

  /**
   * Compare one reading with the mark drawn in the lens.
   *
   * @param target Which mark the number is supposed to be.
   * @param apparentM Where the mark appears, in metres above the bench.
   */
  statusFor(target: ReadingTarget, apparentM: number): ReadingStatus {
    const value = target === 'bob' ? this.#bobCm : this.#pivotCm;
    if (value === null) return { level: 'none' };

    const errorMm = Math.abs(value - apparentM * 100) * 10;
    if (errorMm <= GOOD_ERROR_MM) return { level: 'good', detail: '✓' };
    if (errorMm <= WARN_ERROR_MM) return { level: 'warn', detail: `${errorMm.toFixed(1)} mm off` };
    return { level: 'bad', detail: `${errorMm.toFixed(1)} mm off — re-read` };
  }
}
