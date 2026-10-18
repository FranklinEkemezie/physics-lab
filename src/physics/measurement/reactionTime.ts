/**
 * The human holding the stopwatch.
 *
 * "Press the button when you hear the bang" takes 150–300 ms — an order of
 * magnitude bigger than the stopwatch's own 0.01 s display resolution, and the
 * dominant error in any timing practical.
 */

import type { Rng } from '@/core/math';

/**
 * Human reaction time, in seconds.
 *
 * Reaction times are slightly right-skewed: most people are ~200 ms, a few are
 * much slower. That is what makes repeated readings scatter.
 */
export function reactionTime(rng: Rng): number {
  const base = rng.normalClipped(0.21, 0.045, 3);
  return Math.max(0.1, base);
}
