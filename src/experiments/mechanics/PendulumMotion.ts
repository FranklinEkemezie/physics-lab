/**
 * The swing state machine of the simple pendulum.
 *
 * The rigid-body *physics* lives in `@/physics/mechanics/pendulum`; what lives
 * here is the bookkeeping a real swing needs on top of it: whether the bob is
 * held, swinging or at rest, how many half-oscillations have gone by, the
 * amplitude at release and now, and the random kick a draught gives the bob.
 * Keeping it apart from the rig means the counting rules can be read (and
 * trusted) in one place.
 */

import { amplitudeFromState, integratePendulum } from '@/physics/mechanics/pendulum';
import type { PendulumParameters, PendulumState } from '@/physics/mechanics/pendulum';

/** How the bob is being held just now. */
export type PendulumMode = 'idle' | 'held' | 'swinging';

/**
 * The tiny slice of the random source this machine needs. Injecting it (rather
 * than reaching for a global) keeps the swing reproducible from a seed.
 */
export interface DraughtSource {
  /** Symmetric random value in [-sigma, +sigma]. */
  jitter(sigma: number): number;
}

export class PendulumSwing {
  /** Angle and angular velocity of the bob, in radians and rad/s. */
  #state: PendulumState = { theta: 0, omega: 0 };
  #mode: PendulumMode = 'idle';
  /** Turning points seen since release; two half-swings make one oscillation. */
  #halfSwings = 0;
  /** Previous angular velocity, used only to spot a change of sign. */
  #previousOmega = 0;
  #releaseAmplitudeRad = 0;
  #currentAmplitudeRad = 0;
  #draught = false;

  get theta(): number {
    return this.#state.theta;
  }

  get omega(): number {
    return this.#state.omega;
  }

  get mode(): PendulumMode {
    return this.#mode;
  }

  get halfSwings(): number {
    return this.#halfSwings;
  }

  get completedSwings(): number {
    return this.#halfSwings / 2;
  }

  get releaseAmplitudeRad(): number {
    return this.#releaseAmplitudeRad;
  }

  get currentAmplitudeRad(): number {
    return this.#currentAmplitudeRad;
  }

  get draught(): boolean {
    return this.#draught;
  }

  /**
   * Take hold of the bob and park it on its arc.
   *
   * The clamp of ±0.7 rad mirrors the reach of an arm: the student cannot drag
   * the bob right over the top of the pivot.
   * @returns The angle actually held, after clamping.
   */
  hold(thetaRad: number): number {
    const angle = Math.max(-0.7, Math.min(0.7, thetaRad));
    this.#mode = 'held';
    this.#state = { theta: angle, omega: 0 };
    this.#previousOmega = 0;
    return angle;
  }

  /** Let go from a chosen angle with no initial velocity. */
  releaseFrom(thetaRad: number): void {
    this.#state = { theta: thetaRad, omega: 0 };
    this.#mode = 'swinging';
    this.#releaseAmplitudeRad = Math.abs(this.#state.theta);
    this.#currentAmplitudeRad = this.#releaseAmplitudeRad;
    this.#halfSwings = 0;
    this.#previousOmega = this.#state.omega;
  }

  /** Bring the bob to rest at the bottom of its swing. */
  reset(): void {
    this.#state = { theta: 0, omega: 0 };
    this.#mode = 'idle';
    this.#halfSwings = 0;
    this.#previousOmega = 0;
  }

  /** Restart the swing counter from wherever the bob is now. */
  zeroSwings(): void {
    this.#halfSwings = 0;
    this.#previousOmega = this.#state.omega;
  }

  setDraught(on: boolean): void {
    this.#draught = on;
  }

  /**
   * Advance the bob by one fixed integration step and return the new angle.
   *
   * A held or idle bob does not move. A swinging one is integrated with RK4,
   * its turning points are counted, and — if the window is open — it takes a
   * random angular nudge. Left alone, the swing dies away; once both the angle
   * and the speed are vanishingly small it snaps to rest rather than jittering
   * for ever.
   */
  step(dt: number, parameters: PendulumParameters, rng: DraughtSource): number {
    if (this.#mode === 'swinging') {
      this.#state = integratePendulum(this.#state, parameters, dt);
      this.#countSwings();
      this.#currentAmplitudeRad = amplitudeFromState(this.#state, parameters);
      if (this.#draught) {
        this.#state.omega += rng.jitter(0.05) * dt * 60;
      }
      // Come to rest quietly rather than jittering forever.
      if (Math.abs(this.#state.theta) < 1e-4 && Math.abs(this.#state.omega) < 1e-4) {
        this.#state.theta = 0;
        this.#state.omega = 0;
        this.#mode = 'idle';
      }
    }
    return this.#state.theta;
  }

  /** Count completed oscillations by watching for turning points. */
  #countSwings(): void {
    if (this.#previousOmega === 0) {
      this.#previousOmega = this.#state.omega;
      return;
    }
    if (Math.sign(this.#state.omega) !== Math.sign(this.#previousOmega)) {
      // Each turning point completes half an oscillation.
      this.#halfSwings += 1;
    }
    this.#previousOmega = this.#state.omega;
  }
}
