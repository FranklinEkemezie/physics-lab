/**
 * Electrical heating of a calorimeter.
 *
 * A bomb calorimeter is a sealed steel vessel inside a water jacket. A heater
 * of known power raises the water's temperature; from the energy supplied, the
 * mass of water and the temperature rise you get the specific heat capacity:
 *
 *   c = V I t / (m Δθ).
 *
 * That formula is only exact if none of the energy escapes and none of it heats
 * the vessel. In a real calorimeter:
 *
 *  - the vessel itself has a heat capacity, so some of the energy never reaches
 *    the water;
 *  - the calorimeter loses heat to the room at a rate proportional to how far
 *    it is above room temperature (Newton's law of cooling), so Δθ falls behind
 *    the straight line more and more as the run goes on;
 *  - the thermometer takes a few seconds to catch up with the water.
 *
 * The initial part of a Δθ–t graph is therefore the honest part: cooling is
 * still negligible there, and its gradient gives c directly. This module models
 * all three effects so the graph a student plots bends for a *reason*.
 *
 * Everything here is pure: no Three.js, no DOM, so the same model can drive a
 * chemistry display, a spreadsheet or the self-checks in `scripts/`.
 */

/** Configuration for one calorimeter run. All temperatures are in °C. */
export interface CalorimetryConfig {
  /** Heater p.d., in volts. */
  voltageV: number;
  /** Heater current, in amperes. */
  currentA: number;
  /** Mass of the water being heated, in kilograms. */
  waterMassKg: number;
  /** Specific heat capacity of the *liquid*, J kg⁻¹ K⁻¹. */
  specificHeatCapacityJKgK: number;
  /** Heat capacity of the bomb, jacket and stirrer, J K⁻¹. Default 0. */
  vesselHeatCapacityJK?: number;
  /** Newton cooling coefficient, W K⁻¹. Default 0 (perfectly lagged). */
  coolingCoefficientWK?: number;
  /** Room temperature, °C. Default 25. */
  ambientC?: number;
  /** Initial water temperature, °C. Defaults to {@link ambientC}. */
  initialC?: number;
  /**
   * Fraction of the heater's power that actually enters the water (the rest
   * warms the leads and the air). Default 1.
   */
  immersionFraction?: number;
  /** Thermometer time constant, s. Zero means an instantaneous reading. */
  thermometerTauS?: number;
  /** Simulated seconds per real second. Default 1. */
  timeScale?: number;
}

/** A config with every optional field filled in. */
export type ResolvedCalorimetryConfig = Required<CalorimetryConfig>;

/** Fill in the defaults. */
export function resolveCalorimetryConfig(config: CalorimetryConfig): ResolvedCalorimetryConfig {
  return {
    vesselHeatCapacityJK: 0,
    coolingCoefficientWK: 0,
    ambientC: 25,
    initialC: config.ambientC ?? 25,
    immersionFraction: 1,
    thermometerTauS: 0,
    timeScale: 1,
    ...config,
  };
}

/** Observable state of the calorimeter. */
export interface CalorimetryState {
  /** Lab time since the run started, in seconds. */
  timeS: number;
  /** True water temperature, °C. */
  temperatureC: number;
  /** What the thermometer shows, °C (lags the water). */
  readingC: number;
  /** Electrical energy supplied so far, in joules. */
  energyJ: number;
  /** Whether the heater is energised. */
  heating: boolean;
}

/** Starting state for a run. */
export function initialCalorimetryState(config: CalorimetryConfig): CalorimetryState {
  const resolved = resolveCalorimetryConfig(config);
  return {
    timeS: 0,
    temperatureC: resolved.initialC,
    readingC: resolved.initialC,
    energyJ: 0,
    heating: false,
  };
}

/** Total heat capacity that the heater's energy has to warm, J K⁻¹. */
export function totalHeatCapacityJK(config: CalorimetryConfig): number {
  const resolved = resolveCalorimetryConfig(config);
  return resolved.waterMassKg * resolved.specificHeatCapacityJKgK + resolved.vesselHeatCapacityJK;
}

/** Electrical power entering the water, in watts. */
export function heaterPowerW(config: CalorimetryConfig, heating: boolean): number {
  if (!heating) return 0;
  const resolved = resolveCalorimetryConfig(config);
  return resolved.voltageV * resolved.currentA * resolved.immersionFraction;
}

/**
 * Advance the calorimeter by `dtRealS` seconds of *real* time.
 *
 * The temperature is integrated analytically, not with Euler steps, so the
 * result does not depend on the frame rate and a long run cannot blow up.
 */
export function stepCalorimetry(
  state: CalorimetryState,
  config: CalorimetryConfig,
  dtRealS: number,
  heating: boolean = state.heating,
): CalorimetryState {
  const resolved = resolveCalorimetryConfig(config);
  const dt = Math.max(0, dtRealS);
  const simDt = dt * resolved.timeScale;
  if (simDt === 0) {
    return { ...state, heating };
  }

  const heatCapacity = totalHeatCapacityJK(resolved);
  const powerW = heaterPowerW(resolved, heating);
  const k = resolved.coolingCoefficientWK;

  let temperatureC = state.temperatureC;
  if (heatCapacity > 0) {
    if (k > 0) {
      // Approach the equilibrium the heater can hold against the losses.
      const equilibriumC = resolved.ambientC + powerW / k;
      const decay = Math.exp(-(k / heatCapacity) * simDt);
      temperatureC = equilibriumC + (state.temperatureC - equilibriumC) * decay;
    } else {
      temperatureC += (powerW / heatCapacity) * simDt;
    }
  }

  const alpha = resolved.thermometerTauS > 0 ? 1 - Math.exp(-simDt / resolved.thermometerTauS) : 1;
  const readingC = state.readingC + (temperatureC - state.readingC) * alpha;

  return {
    timeS: state.timeS + simDt,
    temperatureC,
    readingC,
    energyJ: state.energyJ + (heating ? resolved.voltageV * resolved.currentA * simDt : 0),
    heating,
  };
}

/**
 * The rate a graph of Δθ against t has at the start, before cooling matters.
 * K s⁻¹.
 */
export function initialGradientKPerS(config: CalorimetryConfig): number {
  const heatCapacity = totalHeatCapacityJK(config);
  return heatCapacity > 0 ? heaterPowerW(config, true) / heatCapacity : 0;
}

/**
 * c = V I / (m × gradient), the initial-gradient form of the electrical method.
 * @param gradientKPerS Gradient of the Δθ–t graph, in K s⁻¹.
 */
export function specificHeatFromGradient(
  voltageV: number,
  currentA: number,
  waterMassKg: number,
  gradientKPerS: number,
): number {
  if (waterMassKg <= 0 || gradientKPerS <= 0) return Number.NaN;
  return (voltageV * currentA) / (waterMassKg * gradientKPerS);
}

/**
 * c = V I t / (m Δθ), the endpoint form of the electrical method. Kept because
 * it is the formula in the syllabus, and because comparing it with the gradient
 * form shows *why* a graph is worth drawing.
 */
export function specificHeatFromEnergy(
  voltageV: number,
  currentA: number,
  timeS: number,
  waterMassKg: number,
  deltaTC: number,
): number {
  if (waterMassKg <= 0 || deltaTC <= 0) return Number.NaN;
  return (voltageV * currentA * timeS) / (waterMassKg * deltaTC);
}

/**
 * The reading a thermometer with 0.1 °C graduations would show.
 */
export function thermometerReadingC(state: CalorimetryState): number {
  return Math.round(state.readingC * 10) / 10;
}
