/**
 * The reading model for the bar-magnet field practical.
 *
 * The student reads two numbers off the apparatus: the distance `d` from the
 * printed centimetre scale, and the deflection `θ` of the needle. This class
 * holds those readings, remembers whether they came from the apparatus or were
 * typed in, and judges how well a number agrees with what the compass currently
 * shows. No DOM, no rig — just the numbers.
 */

/** Which of the two readings an entry box holds. */
export type ReadingField = 'd' | 'theta';

/** Verdict on how close a reading is to what the apparatus shows. */
export interface ReadingStatus {
  level: 'none' | 'good' | 'warn' | 'bad';
  /** Short explanation shown beside the field, e.g. "1.2 mm off". */
  detail?: string;
}

export class CompassReading {
  #dCm: number | null = null;
  #thetaDeg: number | null = null;
  #fromApparatus = false;

  get dCm(): number | null {
    return this.#dCm;
  }

  get thetaDeg(): number | null {
    return this.#thetaDeg;
  }

  /** True when both readings were copied from the scale and needle. */
  get fromApparatus(): boolean {
    return this.#fromApparatus;
  }

  /** Copy both numbers as they appear on the apparatus. */
  setFromLens(dcm: number, thetaDeg: number): void {
    this.#dCm = dcm;
    this.#thetaDeg = thetaDeg;
    this.#fromApparatus = true;
  }

  /**
   * Record a value the student typed in. Clearing the field leaves the source
   * alone: an empty box is not evidence that the number was ever read.
   */
  setTyped(field: ReadingField, value: number | null): void {
    if (field === 'd') this.#dCm = value;
    else this.#thetaDeg = value;
    if (value !== null) this.#fromApparatus = false;
  }

  /** Forget both readings — used when a trial has just been recorded. */
  clear(): void {
    this.#dCm = null;
    this.#thetaDeg = null;
    this.#fromApparatus = false;
  }

  /**
   * Compare one reading with what the apparatus currently shows.
   *
   * @param value The reading to judge.
   * @param apparentValue What the scale or card reads now.
   * @param unit `'cm'` for the distance (judged in millimetres), `'°'` for the
   *   deflection (judged in whole degrees).
   */
  verdictFor(value: number | null, apparentValue: number, unit: 'cm' | '°'): ReadingStatus {
    if (value === null) return { level: 'none' };

    const error = Math.abs(value - apparentValue);
    if (unit === 'cm') {
      if (error <= 0.15) return { level: 'good', detail: '✓' };
      const detail = `${(error * 10).toFixed(1)} mm off`;
      return error <= 0.4 ? { level: 'warn', detail } : { level: 'bad', detail: `${detail} — re-read` };
    }

    if (error <= 2) return { level: 'good', detail: '✓' };
    const detail = `${error.toFixed(0)}° off`;
    return error <= 5 ? { level: 'warn', detail } : { level: 'bad', detail: `${detail} — re-read` };
  }
}
