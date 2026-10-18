/**
 * A tiny assertion helper.
 *
 * Physics code full of units is easy to get subtly wrong, so the simulation
 * validates its own inputs at the boundaries. Assertions are cheap and, in a
 * teaching tool, a loud failure beats a plausible wrong answer.
 */

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[PhysicsLab] ${message}`);
  }
}

/** Assert that a number is finite and within [min, max]. */
export function assertRange(value: number, min: number, max: number, label: string): void {
  assert(Number.isFinite(value), `${label} must be a finite number, got ${value}`);
  assert(value >= min && value <= max, `${label} must be between ${min} and ${max}, got ${value}`);
}
