/**
 * Seeded pseudo-random number generation.
 *
 * Using a *seeded* generator means an experiment can be reproduced exactly
 * (handy for marking) while still looking random. The statistical models that
 * consume these numbers — reaction time, reading error — live with the
 * physics and measurement code, not here.
 */

/** Mulberry32 — small, fast, good-enough 32-bit PRNG. */
export class Rng {
  #state: number;

  constructor(seed = 0x9e3779b9) {
    this.#state = seed >>> 0 || 1;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max]. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Symmetric value in [-magnitude, +magnitude]. */
  jitter(magnitude: number): number {
    return this.range(-magnitude, magnitude);
  }

  /**
   * Standard normal sample via the Box–Muller transform.
   * Mean 0, standard deviation 1.
   */
  gaussian(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Normal sample with the given mean and standard deviation. */
  normal(mean: number, stdDev: number): number {
    return mean + this.gaussian() * stdDev;
  }

  /**
   * Gaussian noise clipped to ±`sigma` standard deviations.
   * Clipping keeps the occasional 4σ outlier from ruining a reading.
   */
  normalClipped(mean: number, stdDev: number, sigma = 2.5): number {
    const z = Math.max(-sigma, Math.min(sigma, this.gaussian()));
    return mean + z * stdDev;
  }

  /** Pick one item from a non-empty array. */
  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}
