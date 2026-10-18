/**
 * Mechanical and thermal constants for the simulation.
 *
 * Real apparatus is imperfect. Every value here exists because it produces a
 * *measurable* effect that a careful student can observe — or fail to observe,
 * which is itself a lesson.
 */

/** Standard gravity in m/s² (the value WAEC answer scripts expect). */
export const STANDARD_G = 9.81;

/**
 * Gravity at different locations. The lab can be relocated, including to a
 * "mystery planet" whose g the student must determine experimentally.
 */
export interface Location {
  id: string;
  name: string;
  /** Surface gravity in m/s². */
  g: number;
  /** Air density at the surface, kg/m³ — affects aerodynamic damping. */
  airDensity: number;
  /** Ambient temperature in °C — affects the rule's length. */
  temperatureC: number;
  /** Hidden locations do not advertise their g in the UI. */
  hidden?: boolean;
}

export const EARTH: Location = {
  id: 'earth',
  name: 'Earth (school laboratory)',
  g: STANDARD_G,
  airDensity: 1.2,
  temperatureC: 27,
};

export const LOCATIONS: readonly Location[] = [
  EARTH,
  {
    id: 'moon',
    name: 'The Moon',
    g: 1.62,
    airDensity: 0, // no air, no drag, no sound — a very clean experiment
    temperatureC: -20,
  },
  {
    id: 'mars',
    name: 'Mars',
    g: 3.71,
    airDensity: 0.02,
    temperatureC: -60,
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    g: 24.79,
    airDensity: 0.16,
    temperatureC: -110,
  },
  {
    id: 'planet-x',
    name: 'Planet X (mystery)',
    g: 0, // filled in by createMysteryLocation()
    airDensity: 1.1,
    temperatureC: 22,
    hidden: true,
  },
];

/**
 * Build a "Planet X" whose gravity is unknown to the student.
 * @param rng Source of randomness (so a seed reproduces the same planet).
 */
export function createMysteryLocation(rng: { range(min: number, max: number): number }): Location {
  const template = LOCATIONS.find((location) => location.id === 'planet-x') ?? EARTH;
  return {
    ...template,
    // Deliberately *not* a familiar value, and not a round number.
    g: Number(rng.range(1.4, 16).toFixed(3)),
    airDensity: Number(rng.range(0.05, 1.35).toFixed(3)),
  };
}

/**
 * Coefficient of linear expansion for the metre rule's material, per °C.
 * A wooden rule is surprisingly thermally active (≈ 5 × 10⁻⁶ K⁻¹); this is
 * small, but it is real, and the lab models it so nothing is hand-waved.
 */
export const RULE_EXPANSION_PER_C = 5e-6;

/** Stopwatch quartz-crystal tolerance: ±100 ppm is typical for cheap units. */
export const STOPWATCH_TOLERANCE = 100e-6;

/** Human reaction time distribution, in seconds (mean, standard deviation). */
export const REACTION_MEAN_S = 0.21;
export const REACTION_SIGMA_S = 0.045;
