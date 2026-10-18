/**
 * Basic d.c. circuits: Ohm's law, cells with internal resistance, and the
 * series/parallel algebra.
 *
 * The quantitative practical is "find the e.m.f. and internal resistance of a
 * cell". A cell's terminal p.d. sags as it delivers more current,
 *
 * ```text
 *   V = E − I·r ,
 * ```
 *
 * so a graph of `V` against `I` is a straight line whose *intercept* is the
 * e.m.f. `E` and whose *gradient* is `−r`.
 */

/** A real cell: an ideal source behind its own internal resistance. */
export interface Cell {
  /** Electromotive force in volts. */
  emfV: number;
  /** Internal resistance in ohms. */
  internalResistanceOhm: number;
}

/** Terminal p.d. of a cell delivering `currentA`: `V = E − I·r`. */
export function terminalPotentialV(cell: Cell, currentA: number): number {
  return cell.emfV - currentA * cell.internalResistanceOhm;
}

/** Current driven through an external resistance: `I = E/(R + r)`. */
export function currentForLoadA(cell: Cell, loadOhm: number): number {
  const total = loadOhm + cell.internalResistanceOhm;
  return total <= 0 ? 0 : cell.emfV / total;
}

/** Terminal p.d. across an external resistance: `V = E·R/(R + r)`. */
export function terminalPotentialForLoadV(cell: Cell, loadOhm: number): number {
  return terminalPotentialV(cell, currentForLoadA(cell, loadOhm));
}

/** Total power delivered by the cell: `P = E·I`. */
export function sourcePowerW(cell: Cell, currentA: number): number {
  return cell.emfV * currentA;
}

/** Power dissipated in a resistance: `P = I²R`. */
export function powerW(currentA: number, resistanceOhm: number): number {
  return currentA * currentA * resistanceOhm;
}

/** Power wasted inside the cell: `P = I²r`. */
export function internalPowerW(cell: Cell, currentA: number): number {
  return powerW(currentA, cell.internalResistanceOhm);
}

/** Resistance of resistors in series: `R = Σ Rᵢ`. */
export function seriesResistanceOhm(...resistances: number[]): number {
  return resistances.reduce((sum, r) => sum + r, 0);
}

/** Resistance of resistors in parallel: `1/R = Σ 1/Rᵢ`. */
export function parallelResistanceOhm(...resistances: number[]): number {
  const reciprocalSum = resistances.reduce((sum, r) => sum + (r === 0 ? Infinity : 1 / r), 0);
  return reciprocalSum === 0 ? Number.NaN : 1 / reciprocalSum;
}

/** Resistance of a uniform conductor: `R = ρL/A`. */
export function resistanceFromResistivityOhm(
  resistivityOhmMetre: number,
  lengthM: number,
  areaM2: number,
): number {
  return (resistivityOhmMetre * lengthM) / areaM2;
}

/** Current through a resistor from Ohm's law: `I = V/R`. */
export function currentFromVoltageA(voltageV: number, resistanceOhm: number): number {
  return resistanceOhm === 0 ? Number.NaN : voltageV / resistanceOhm;
}

/** Voltage across a resistor from Ohm's law: `V = I·R`. */
export function voltageAcrossV(currentA: number, resistanceOhm: number): number {
  return currentA * resistanceOhm;
}

/**
 * Internal resistance recovered from a `V`–`I` graph: the line falls with
 * gradient `−r`, so `r = −gradient`.
 */
export function internalResistanceFromGradient(gradientVPerA: number): number {
  return Math.abs(gradientVPerA);
}

/** E.m.f. recovered from the intercept of a `V`–`I` graph. */
export function emfFromIntercept(interceptV: number): number {
  return interceptV;
}
