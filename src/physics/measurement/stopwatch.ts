/**
 * The stopwatch, and the human holding it.
 *
 * The timing error in a pendulum practical is *not* the stopwatch. A quartz
 * stopwatch is accurate to ~100 ppm (0.002 s over 20 s); a student's reaction
 * time is 200 ms, a hundred times larger, and it is *random* — so it scatters
 * repeated readings rather than shifting them all one way.
 *
 * This module models all three contributions so students can see where their
 * error budget actually goes:
 *  1. reaction delay at start and at stop (random, per press),
 *  2. a personal anticipation/hesitation bias (constant per student),
 *  3. the stopwatch's own resolution and crystal tolerance.
 */

import { Rng, snap } from '@/core/math';
import { REACTION_SIGMA_S } from '../constants';
import { reactionTime } from './reactionTime';

export interface StopwatchOptions {
  /** Display resolution in seconds (0.01 s on a typical digital stopwatch). */
  resolutionS?: number;
  /** Fractional rate error of the quartz movement (e.g. 40e-6 = 40 ppm). */
  calibrationError?: number;
  /** Seed for the operator's reaction times, so a run can be reproduced. */
  seed?: number;
}

/** One press of the button, with the human error attached to it. */
export interface ButtonPress {
  /** Simulated clock time at which the finger actually moved. */
  fingerTimeS: number;
  /** Simulated clock time the stopwatch registered. */
  registeredTimeS: number;
  /** Delay caused by the operator, in seconds. */
  reactionDelayS: number;
}

/**
 * A stopwatch with a human operator.
 *
 * The physics calls {@link pressStart} / {@link pressStop} with the current
 * *simulated* time; the stopwatch adds the operator's reaction delay itself,
 * so the recorded time is exactly what a student would have written down.
 */
export class StopwatchInstrument {
  readonly resolutionS: number;
  readonly calibrationError: number;

  #rng: Rng;
  #start: ButtonPress | null = null;
  #stop: ButtonPress | null = null;
  #running = false;
  #elapsedTrue = 0;
  #lastTrueTime = 0;

  /**
   * The operator's systematic bias: positive = they always react late
   * (hesitation), negative = they anticipate. Drawn once, then reused.
   */
  readonly operatorBiasS: number;

  constructor(options: StopwatchOptions = {}) {
    this.resolutionS = options.resolutionS ?? 0.01;
    this.calibrationError = options.calibrationError ?? 0;
    this.#rng = new Rng(options.seed ?? 0x5eed1234);
    this.operatorBiasS = this.#rng.normalClipped(0.02, 0.04, 2.5);
  }

  get running(): boolean {
    return this.#running;
  }

  /** Raw elapsed time in seconds, quantised to the display resolution. */
  get elapsed(): number {
    return snap(this.#elapsedTrue, this.resolutionS);
  }

  /** The same instant before quantisation — the "perfect" instrument. */
  get elapsedTrue(): number {
    return this.#elapsedTrue;
  }

  get startPress(): ButtonPress | null {
    return this.#start;
  }

  get stopPress(): ButtonPress | null {
    return this.#stop;
  }

  /** Fractional rate correction: a watch running fast reports larger times. */
  #applyCalibration(seconds: number): number {
    return seconds * (1 + this.calibrationError);
  }

  /** Press START. Resets any previous reading, like a real stopwatch. */
  pressStart(simTimeS: number): ButtonPress {
    const reactionDelayS = this.#drawReaction();
    const press: ButtonPress = {
      fingerTimeS: simTimeS,
      registeredTimeS: simTimeS + reactionDelayS,
      reactionDelayS,
    };
    this.#start = press;
    this.#stop = null;
    this.#running = true;
    this.#elapsedTrue = 0;
    this.#lastTrueTime = simTimeS;
    return press;
  }

  /** Press STOP. Ignored if the watch is not running. */
  pressStop(simTimeS: number): ButtonPress | null {
    if (!this.#running || !this.#start) return null;
    const reactionDelayS = this.#drawReaction();
    const press: ButtonPress = {
      fingerTimeS: simTimeS,
      registeredTimeS: simTimeS + reactionDelayS,
      reactionDelayS,
    };
    this.#stop = press;
    this.#running = false;
    this.#elapsedTrue = this.#applyCalibration(Math.max(0, press.registeredTimeS - this.#start.registeredTimeS));
    this.#lastTrueTime = simTimeS;
    return press;
  }

  /** Called every simulation step while running, so the display ticks over. */
  tick(simTimeS: number): void {
    if (!this.#running || !this.#start) return;
    // The watch's own clock started a reaction-time after the finger pressed,
    // so it reads zero until then — never a negative time.
    this.#elapsedTrue = this.#applyCalibration(Math.max(0, simTimeS - this.#start.registeredTimeS));
    this.#lastTrueTime = simTimeS;
  }

  /** Split/lap display while running, in seconds. */
  get displayed(): number {
    return this.elapsed;
  }

  /** Clear the display. */
  reset(): void {
    this.#running = false;
    this.#start = null;
    this.#stop = null;
    this.#elapsedTrue = 0;
  }

  /** Last simulated time the watch saw (used for "is it still going?"). */
  get lastSimTime(): number {
    return this.#lastTrueTime;
  }

  /**
   * Total error contributed by the human, in seconds.
   * `stopDelay − startDelay`; a positive value means the measurement is long.
   */
  get reactionErrorS(): number {
    if (!this.#start || !this.#stop) return 0;
    return this.#stop.registeredTimeS - this.#stop.fingerTimeS - (this.#start.registeredTimeS - this.#start.fingerTimeS);
  }

  #drawReaction(): number {
    // Reaction = population mean + this operator's personal bias + noise.
    const base = reactionTime(this.#rng) + this.operatorBiasS;
    const jitter = this.#rng.normalClipped(0, REACTION_SIGMA_S * 0.4, 2);
    return Math.max(0.08, base + jitter);
  }
}

/**
 * The error a stopwatch's own hardware contributes over a given interval.
 * @param calibrationError Fractional error (e.g. 100e-6 for 100 ppm).
 */
export function stopwatchErrorS(intervalS: number, calibrationError: number): number {
  return Math.abs(intervalS * calibrationError);
}

/**
 * Uncertainty in a period derived from timing `n` oscillations.
 *
 * `T = t/n`, so `ΔT = Δt/n`: timing many swings is the single cheapest way to
 * improve this experiment, which is why every textbook insists on it.
 */
export function periodUncertaintyS(timingUncertaintyS: number, oscillations: number): number {
  return timingUncertaintyS / Math.max(1, oscillations);
}
