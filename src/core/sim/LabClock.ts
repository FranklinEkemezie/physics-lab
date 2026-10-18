/**
 * Simulation time.
 *
 * Physics is integrated on a *fixed* step so results do not depend on the
 * frame rate, and the whole simulation can be run faster than real time
 * (a 20-second swing measured in 5 seconds) without changing any recorded
 * number. The clock therefore keeps two scales: real seconds since the last
 * frame, and simulated seconds that everything else uses.
 *
 * Nothing here is physics-specific: any stepwise simulation (a titration, a
 * population model) can drive itself from this clock.
 */

export interface ClockOptions {
  /** Integration step in seconds. */
  fixedStep?: number;
  /** Safety valve so a stalled tab cannot trigger thousands of steps. */
  maxStepsPerFrame?: number;
  /** Simulated seconds per real second. */
  timeScale?: number;
}

export class LabClock {
  /** Simulated seconds per real second (1 = real time). */
  timeScale: number;
  /** When true, `advance` does nothing — the world freezes. */
  paused = false;
  /** Total simulated seconds elapsed since the last `reset`. */
  simTime = 0;

  readonly fixedStep: number;
  readonly maxStepsPerFrame: number;

  #accumulator = 0;
  /** Fraction of a step carried over, used to interpolate rendered positions. */
  #alpha = 0;

  constructor(options: ClockOptions = {}) {
    this.fixedStep = options.fixedStep ?? 1 / 480;
    this.maxStepsPerFrame = options.maxStepsPerFrame ?? 600;
    this.timeScale = options.timeScale ?? 1;
  }

  /** Interpolation factor between the last two steps (0..1). */
  get alpha(): number {
    return this.#alpha;
  }

  /**
   * Advance the simulation.
   *
   * @param realDt Seconds elapsed in the real world since the last frame.
   * @param onStep Called once per fixed step with that step's duration.
   * @returns Simulated seconds consumed this frame.
   */
  advance(realDt: number, onStep: (stepSeconds: number) => void): number {
    if (this.paused) return 0;

    const scaled = realDt * this.timeScale;
    this.#accumulator += scaled;

    let steps = 0;
    const limit = Math.min(this.maxStepsPerFrame, Math.ceil(scaled / this.fixedStep) + 2);
    while (this.#accumulator >= this.fixedStep && steps < limit) {
      onStep(this.fixedStep);
      this.#accumulator -= this.fixedStep;
      this.simTime += this.fixedStep;
      steps += 1;
    }

    // If we hit the limit (slow machine), drop the backlog rather than
    // spiralling: real-time behaviour beats perfect bookkeeping here.
    if (steps >= limit) this.#accumulator = 0;

    this.#alpha = this.#accumulator / this.fixedStep;
    return steps * this.fixedStep;
  }

  reset(): void {
    this.#accumulator = 0;
    this.#alpha = 0;
    this.simTime = 0;
  }
}
