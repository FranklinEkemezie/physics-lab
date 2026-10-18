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
 *
 * A real bench makes this messier than the textbook: the ammeter adds its own
 * resistance in series, and the voltmeter is not infinite, so it shunts a
 * little current around the cell. Both are modelled here.
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

/** Resistance of resistors in series: `R = Σ Rᵢ`. */
export function seriesResistanceOhm(...resistances: number[]): number {
  return resistances.reduce((sum, r) => sum + r, 0);
}

/**
 * Resistance of resistors in parallel: `1/R = Σ 1/Rᵢ`.
 *
 * A resistance of `Infinity` is an open branch and is ignored, so
 * `parallel(R, Infinity) = R` — handy for "the switch is open".
 */
export function parallelResistanceOhm(...resistances: number[]): number {
  let reciprocalSum = 0;
  for (const r of resistances) {
    if (!Number.isFinite(r)) continue;
    if (r === 0) return 0;
    reciprocalSum += 1 / r;
  }
  return reciprocalSum === 0 ? Number.POSITIVE_INFINITY : 1 / reciprocalSum;
}

/** Power dissipated in a resistance: `P = I²R`. */
export function powerW(currentA: number, resistanceOhm: number): number {
  return currentA * currentA * resistanceOhm;
}

export interface LoadedCircuitOptions {
  cell: Cell;
  /** Resistance in series with the cell: the rheostat plus the ammeter. */
  seriesResistanceOhm: number;
  /** Resistance of the voltmeter connected across the cell (∞ for an ideal one). */
  voltmeterResistanceOhm: number;
}

/** Everything the meters and the student can read off the circuit. */
export interface CircuitSolution {
  /** Current delivered by the cell. */
  sourceCurrentA: number;
  /** Current the ammeter reads — the branch through the rheostat. */
  currentA: number;
  /** Terminal p.d. the voltmeter reads. */
  terminalV: number;
  /** Current shunted by the voltmeter (0 for an ideal meter). */
  voltmeterCurrentA: number;
}

/**
 * Solve the practical's circuit: a cell driving a rheostat through an ammeter,
 * with a voltmeter connected across the cell.
 */
export function solveLoadedCircuit(options: LoadedCircuitOptions): CircuitSolution {
  const { cell, seriesResistanceOhm: series, voltmeterResistanceOhm: voltmeter } = options;

  // The cell sees the rheostat/ammeter branch in parallel with the voltmeter.
  const externalOhm = parallelResistanceOhm(series, voltmeter);
  const sourceCurrentA = currentForLoadA(cell, externalOhm);
  const terminalV = terminalPotentialV(cell, sourceCurrentA);

  return {
    sourceCurrentA,
    currentA: Number.isFinite(series) ? terminalV / series : 0,
    terminalV,
    voltmeterCurrentA: Number.isFinite(voltmeter) ? terminalV / voltmeter : 0,
  };
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
